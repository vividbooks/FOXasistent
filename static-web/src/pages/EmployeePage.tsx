import { FoodExpenseForm } from "../components/FoodExpenseForm";
import { ExpenseReceiptExplorer } from "../components/ExpenseReceiptExplorer";
import { useAuth } from "../auth/AuthContext";
import { fetchExpensesList } from "../data/queries";
import type { Period } from "../lib/ranges";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const PING_MS = 30 * 60 * 1000;

type Shift = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  pings?: { id: string }[];
};

export default function EmployeePage() {
  const navigate = useNavigate();
  const { displayName, appUserId, signOut } = useAuth();
  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [expensePeriod, setExpensePeriod] = useState<Period>("month");
  const [expenses, setExpenses] = useState<Awaited<ReturnType<typeof fetchExpensesList>>["expenses"]>([]);
  const [expenseRange, setExpenseRange] = useState<{ from: string; to: string } | null>(null);

  const loadExpenses = useCallback(async () => {
    try {
      const ex = await fetchExpensesList(expensePeriod);
      setExpenses(ex.expenses);
      setExpenseRange({ from: ex.from, to: ex.to });
    } catch (e) {
      console.error(e);
      setMsg("Nepovedlo se načíst účtenky.");
    }
  }, [expensePeriod]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  const loadActive = useCallback(async () => {
    if (!appUserId) return;
    const { data, error } = await supabase
      .from("Shift")
      .select("id, startedAt, endedAt")
      .eq("userId", appUserId)
      .is("endedAt", null)
      .maybeSingle();
    if (error) console.error(error);
    setShift(data ?? null);
    setLoading(false);
  }, [appUserId]);

  useEffect(() => {
    void loadActive();
  }, [loadActive]);

  const sendPing = useCallback(
    async (shiftId: string) => {
      if (!navigator.geolocation) {
        setMsg("Prohlížeč nepodporuje polohu.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { error } = await supabase.from("LocationPing").insert({
            id: crypto.randomUUID(),
            shiftId,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracyM: pos.coords.accuracy,
            recordedAt: new Date().toISOString(),
          });
          if (error) setMsg(error.message);
          else setMsg(null);
        },
        () => {
          setMsg("Poloha zamítnuta nebo nedostupná. Povolte přístup v prohlížeči.");
        },
        { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 },
      );
    },
    [],
  );

  useEffect(() => {
    if (!shift?.id || shift.endedAt) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    const id = shift.id;
    const t = setTimeout(() => void sendPing(id), 5000);
    timerRef.current = setInterval(() => void sendPing(id), PING_MS);
    return () => {
      clearTimeout(t);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [shift?.id, shift?.endedAt, sendPing]);

  async function startShift() {
    if (!appUserId) return;
    setMsg(null);
    const { data: existing } = await supabase
      .from("Shift")
      .select("id")
      .eq("userId", appUserId)
      .is("endedAt", null)
      .maybeSingle();
    if (existing) {
      setMsg("Už máte rozpracovanou směnu.");
      void loadActive();
      return;
    }
    const { data, error } = await supabase
      .from("Shift")
      .insert({ userId: appUserId, startedAt: new Date().toISOString() })
      .select("id, startedAt, endedAt")
      .single();
    if (error) {
      if (error.code === "23505" || error.message.includes("duplicate")) {
        setMsg("Už máte rozpracovanou směnu.");
        void loadActive();
        return;
      }
      setMsg(error.message);
      return;
    }
    setShift(data);
    if (data?.id) void sendPing(data.id);
  }

  async function stopShift() {
    if (!shift) return;
    setMsg(null);
    const { error } = await supabase
      .from("Shift")
      .update({ endedAt: new Date().toISOString() })
      .eq("id", shift.id);
    if (error) setMsg(error.message);
    else setShift(null);
  }

  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm text-zinc-500">Zaměstnanec</p>
            <p className="font-semibold text-zinc-900">{displayName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/credentials" className="text-sm text-sky-700 underline">
              Účty a hesla
            </Link>
            <button
              type="button"
              onClick={() => {
                void signOut().then(() => navigate("/login", { replace: true }));
              }}
              className="text-sm text-zinc-600 underline"
            >
              Odhlásit
            </button>
          </div>
        </header>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-medium text-zinc-900">Směna</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Během směny se každých 30 minut uloží poloha (s vaším souhlasem v prohlížeči).
          </p>
          {loading ? (
            <p className="mt-4 text-zinc-500">Načítám…</p>
          ) : shift && !shift.endedAt ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm">
                Směna od <strong>{new Date(shift.startedAt).toLocaleString("cs-CZ")}</strong>
              </p>
              <button
                type="button"
                onClick={() => void stopShift()}
                className="w-full rounded-xl bg-red-600 py-3 font-medium text-white"
              >
                Ukončit směnu
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void startShift()}
              className="mt-4 w-full rounded-xl bg-emerald-600 py-3 font-medium text-white"
            >
              Začít směnu
            </button>
          )}
          {msg ? <p className="mt-3 text-sm text-amber-700">{msg}</p> : null}
        </section>

        {appUserId ? (
          <FoodExpenseForm
            appUserId={appUserId}
            onSuccess={() => {
              setMsg("Náklad na jídlo byl uložen.");
              void loadExpenses();
            }}
          />
        ) : null}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium text-zinc-900">Moje účtenky</h2>
            <div className="flex flex-wrap gap-2">
              {(["day", "week", "month"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setExpensePeriod(p)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    expensePeriod === p ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 shadow"
                  }`}
                >
                  {p === "day" ? "Den" : p === "week" ? "Týden" : "Měsíc"}
                </button>
              ))}
            </div>
          </div>
          {expenseRange ? (
            <ExpenseReceiptExplorer
              expenses={expenses}
              rangeFromIso={expenseRange.from}
              rangeToIso={expenseRange.to}
              title="Přehled podle týdnů a dnů"
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

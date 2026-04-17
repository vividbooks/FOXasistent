"use client";

import { ExpenseReceiptExplorer } from "@/components/expense-receipt-explorer";
import { FoodExpenseForm } from "@/components/food-expense-form";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

const PING_MS = 30 * 60 * 1000;

type Period = "day" | "week" | "month";

type ExpenseRow = {
  id: string;
  amountKc: number;
  date: string;
  kind: string;
  note: string | null;
  receiptUrl: string | null;
  user: { name: string; username: string };
};

type Shift = {
  id: string;
  startedAt: string;
  endedAt: string | null;
};

export default function EmployeePage() {
  const { data: session } = useSession();
  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [expensePeriod, setExpensePeriod] = useState<Period>("month");
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [expenseRange, setExpenseRange] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const loadExpenses = useCallback(async () => {
    const r = await fetch(`/api/expenses?period=${expensePeriod}`);
    const ex = await r.json();
    setExpenses(ex.expenses ?? []);
    if (ex.from != null && ex.to != null) {
      setExpenseRange({
        from: String(ex.from),
        to: String(ex.to),
      });
    } else {
      setExpenseRange(null);
    }
  }, [expensePeriod]);

  useEffect(() => {
    void loadExpenses();
  }, [loadExpenses]);

  const loadActive = useCallback(async () => {
    const r = await fetch("/api/shifts/active");
    const j = await r.json();
    setShift(j.shift ?? null);
    setLoading(false);
  }, []);

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
          const res = await fetch(`/api/shifts/${shiftId}/ping`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracyM: pos.coords.accuracy,
            }),
          });
          if (!res.ok) {
            const e = await res.json().catch(() => ({}));
            setMsg((e as { error?: string }).error ?? "Poloha se nepovedla uložit.");
          } else {
            setMsg(null);
          }
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
    setMsg(null);
    const r = await fetch("/api/shifts", { method: "POST" });
    const j = await r.json();
    if (!r.ok) {
      setMsg(j.error ?? "Chyba");
      return;
    }
    setShift(j.shift);
    if (j.shift?.id) void sendPing(j.shift.id);
  }

  async function stopShift() {
    if (!shift) return;
    setMsg(null);
    const r = await fetch(`/api/shifts/${shift.id}/stop`, { method: "POST" });
    const j = await r.json();
    if (!r.ok) {
      setMsg(j.error ?? "Chyba");
      return;
    }
    setShift(null);
  }

  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-500">Zaměstnanec</p>
            <p className="font-semibold text-zinc-900">{session?.user?.name}</p>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-zinc-600 underline"
          >
            Odhlásit
          </button>
        </header>

        <section className="rounded-2xl bg-white p-6 shadow">
          <h2 className="text-lg font-medium text-zinc-900">Směna</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Během směny se každých 30 minut uloží poloha (s vaším souhlasem v
            prohlížeči).
          </p>
          {loading ? (
            <p className="mt-4 text-zinc-500">Načítám…</p>
          ) : shift && !shift.endedAt ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm">
                Směna od{" "}
                <strong>
                  {new Date(shift.startedAt).toLocaleString("cs-CZ")}
                </strong>
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
          {msg && <p className="mt-3 text-sm text-amber-700">{msg}</p>}
        </section>

        <FoodExpenseForm
          onSuccess={() => {
            setMsg("Náklad na jídlo byl uložen.");
            void loadExpenses();
          }}
        />

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
                    expensePeriod === p
                      ? "bg-zinc-900 text-white"
                      : "bg-white text-zinc-700 shadow"
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

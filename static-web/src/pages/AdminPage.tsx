import { ExpenseReceiptExplorer } from "../components/ExpenseReceiptExplorer";
import { FoodExpenseForm } from "../components/FoodExpenseForm";
import { useAuth } from "../auth/AuthContext";
import {
  computeAdminSummary,
  fetchAdminShifts,
  fetchExpensesList,
  fetchUsersForAdmin,
  type ShiftRow,
  type Summary,
  type UserRow,
} from "../data/queries";
import { slugifyForAuthEmail } from "@foxasistent/lib/auth-email-local";
import { formatKc } from "../lib/money";
import type { Period } from "../lib/ranges";
import bcrypt from "bcryptjs";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export default function AdminPage() {
  const navigate = useNavigate();
  const { displayName, appUserId, session, signOut } = useAuth();
  const [period, setPeriod] = useState<Period>("day");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [expenses, setExpenses] = useState<Awaited<ReturnType<typeof fetchExpensesList>>["expenses"]>([]);
  const [expenseRange, setExpenseRange] = useState<{ from: string; to: string } | null>(null);
  const [tab, setTab] = useState<"prehled" | "tym" | "smeny" | "naklady">("prehled");
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const [s, u, sh, ex] = await Promise.all([
        computeAdminSummary(period),
        fetchUsersForAdmin(),
        fetchAdminShifts(period),
        fetchExpensesList(period),
      ]);
      setSummary(s);
      setUsers(u);
      setShifts(sh.shifts);
      setExpenses(ex.expenses);
      setExpenseRange({ from: ex.from, to: ex.to });
    } catch (e) {
      console.error(e);
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : e instanceof Error
            ? e.message
            : "Chyba načtení";
      setLoadErr(msg);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-zinc-100 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">Administrace · GitHub Pages + Supabase</p>
            <p className="text-lg font-semibold text-zinc-900">{displayName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["day", "week", "month"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  period === p ? "bg-zinc-900 text-white" : "bg-white text-zinc-700 shadow"
                }`}
              >
                {p === "day" ? "Den" : p === "week" ? "Týden" : "Měsíc"}
              </button>
            ))}
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

        {loadErr ? <p className="text-sm text-red-700">{loadErr}</p> : null}

        <nav className="flex flex-wrap gap-2">
          {(
            [
              ["prehled", "Přehled"],
              ["naklady", "Náklady na jídlo"],
              ["tym", "Tým"],
              ["smeny", "Směny a poloha"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                tab === k ? "bg-white shadow" : "text-zinc-600 hover:bg-white/50"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "prehled" && summary && (
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow">
              <p className="text-sm text-zinc-500">Náklady na potraviny</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-900">{formatKc(summary.foodTotalKc)}</p>
              <p className="mt-1 text-xs text-zinc-400">{summary.expenseCount} záznamů</p>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow">
              <p className="text-sm text-zinc-500">Náklady na práci (dokončené směny)</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-900">{formatKc(summary.laborTotalKc)}</p>
            </div>
            <div className="sm:col-span-2 rounded-2xl bg-white p-6 shadow">
              <h3 className="font-medium text-zinc-900">Dokončené směny v období</h3>
              <ul className="mt-3 divide-y divide-zinc-100 text-sm">
                {summary.shiftSummaries.length === 0 && (
                  <li className="py-2 text-zinc-500">Žádné dokončené směny.</li>
                )}
                {summary.shiftSummaries.map((row) => (
                  <li key={row.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>{row.userName}</span>
                    <span className="text-zinc-600">
                      {row.hours} h → {formatKc(row.costKc)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {tab === "naklady" && appUserId && (
          <section className="space-y-6">
            <FoodExpenseForm title="Přidat náklad na jídlo" appUserId={appUserId} onSuccess={() => void load()} />
            {expenseRange ? (
              <ExpenseReceiptExplorer
                expenses={expenses}
                rangeFromIso={expenseRange.from}
                rangeToIso={expenseRange.to}
                title="Evidence podle týdnů a dnů"
              />
            ) : null}
          </section>
        )}

        {tab === "tym" && (
          <section className="space-y-6">
            <NewEmployeeForm session={session} onDone={() => void load()} />
            <div className="rounded-2xl bg-white p-6 shadow">
              <h3 className="font-medium text-zinc-900">Zaměstnanci</h3>
              <ul className="mt-3 space-y-4">
                {users
                  .filter((u) => u.role === "EMPLOYEE")
                  .map((u) => (
                    <li key={u.id}>
                      <EmployeeRateEditor user={u} onSaved={() => void load()} />
                    </li>
                  ))}
              </ul>
            </div>
          </section>
        )}

        {tab === "smeny" && (
          <section className="rounded-2xl bg-white p-6 shadow">
            <h3 className="font-medium text-zinc-900">Směny a záznamy polohy</h3>
            <ul className="mt-4 space-y-6 text-sm">
              {shifts.map((sh) => (
                <li key={sh.id} className="border-b border-zinc-100 pb-4">
                  <p className="font-medium text-zinc-900">
                    {sh.user.name}{" "}
                    <span className="font-normal text-zinc-500">
                      {new Date(sh.startedAt).toLocaleString("cs-CZ")}
                      {sh.endedAt
                        ? ` – ${new Date(sh.endedAt).toLocaleString("cs-CZ")}`
                        : " (probíhá)"}
                    </span>
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                    {sh.pings.length === 0 && <li>Žádná poloha (ještě nebo zamítnuto).</li>}
                    {sh.pings.map((p) => (
                      <li key={p.id}>
                        {new Date(p.recordedAt).toLocaleTimeString("cs-CZ")}: {p.latitude.toFixed(5)},{" "}
                        {p.longitude.toFixed(5)}
                        {p.accuracyM != null ? ` (±${Math.round(p.accuracyM)} m)` : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function NewEmployeeForm({
  session,
  onDone,
}: {
  session: Session | null;
  onDone: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [rate, setRate] = useState("200");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const login = username.trim().toLowerCase();
      const { data: dup } = await supabase.from("User").select("id").eq("username", login).maybeSingle();
      if (dup) {
        setErr("Uživatel už existuje.");
        setBusy(false);
        return;
      }
      const authLocal = slugifyForAuthEmail(login);
      const { data: nameRows, error: namesErr } = await supabase.from("User").select("username");
      if (namesErr) throw new Error(namesErr.message);
      if (nameRows?.some((r) => slugifyForAuthEmail(r.username) === authLocal)) {
        setErr(
          "Účet se stejným přihlášením na GitHub Pages už existuje (stejný tvar po odstranění diakritiky).",
        );
        setBusy(false);
        return;
      }
      const id = crypto.randomUUID();
      const hash = await bcrypt.hash(password, 10);
      const { error } = await supabase.from("User").insert({
        id,
        username: login,
        passwordHash: hash,
        name: name.trim(),
        role: "EMPLOYEE",
        hourlyRateKc: parseInt(rate, 10),
        createdAt: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);

      const apiBase = import.meta.env.VITE_NEXT_API_ORIGIN?.replace(/\/$/, "");
      const token = session?.access_token;
      if (apiBase && token) {
        const pr = await fetch(`${apiBase}/api/admin/provision-supabase-auth`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId: id }),
        });
        if (!pr.ok) {
          const body = (await pr.json().catch(() => null)) as { error?: string } | null;
          throw new Error(
            body?.error ??
              `Účet v databázi je vytvořený, ale přihlášení na Pages se nepodařilo nastavit (${pr.status}). Zkontroluj VITE_NEXT_API_ORIGIN a deploy na Vercelu, případně npm run sync-auth.`,
          );
        }
      }

      setUsername("");
      setPassword("");
      setName("");
      onDone();
    } catch (er) {
      setErr(er instanceof Error ? er.message : "Chyba");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-2xl bg-white p-6 shadow">
      <h3 className="font-medium text-zinc-900">Nový zaměstnanec</h3>
      {err ? <p className="mt-2 text-sm text-red-700">{err}</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          className="rounded-lg border border-zinc-300 px-3 py-2"
          placeholder="uživatelské jméno"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          className="rounded-lg border border-zinc-300 px-3 py-2"
          placeholder="heslo"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <input
          className="rounded-lg border border-zinc-300 px-3 py-2"
          placeholder="Jméno"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="number"
          min={0}
          className="rounded-lg border border-zinc-300 px-3 py-2"
          placeholder="Kč za hodinu"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          required
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Přidat
      </button>
    </form>
  );
}

function EmployeeRateEditor({ user, onSaved }: { user: UserRow; onSaved: () => void }) {
  const [rate, setRate] = useState(String(user.hourlyRateKc ?? 0));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await supabase.from("User").update({ hourlyRateKc: parseInt(rate, 10) }).eq("id", user.id);
    setBusy(false);
    onSaved();
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <p className="text-sm font-medium text-zinc-900">{user.name}</p>
        <p className="text-xs text-zinc-500">@{user.username}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          className="w-28 rounded-lg border border-zinc-300 px-2 py-1 text-sm"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
        <span className="text-sm text-zinc-500">Kč/h</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-lg bg-zinc-200 px-3 py-1 text-sm"
        >
          Uložit
        </button>
      </div>
    </div>
  );
}

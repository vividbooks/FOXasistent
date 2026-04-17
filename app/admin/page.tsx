"use client";

import { ExpenseReceiptExplorer } from "@/components/expense-receipt-explorer";
import { FoodExpenseForm } from "@/components/food-expense-form";
import { formatKc } from "@/lib/money";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

type Period = "day" | "week" | "month";

type Summary = {
  foodTotalKc: number;
  laborTotalKc: number;
  expenseCount: number;
  shiftSummaries: {
    id: string;
    userName: string;
    hours: number;
    costKc: number;
    startedAt: string;
    endedAt: string;
  }[];
};

type UserRow = {
  id: string;
  username: string;
  name: string;
  role: string;
  hourlyRateKc: number | null;
};

type ShiftRow = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  user: { name: string; username: string };
  pings: {
    id: string;
    latitude: number;
    longitude: number;
    recordedAt: string;
    accuracyM: number | null;
  }[];
};

type ExpenseRow = {
  id: string;
  amountKc: number;
  date: string;
  kind: string;
  note: string | null;
  receiptUrl: string | null;
  user: { name: string; username: string };
};

export default function AdminPage() {
  const { data: session } = useSession();
  const [period, setPeriod] = useState<Period>("day");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [expenseRange, setExpenseRange] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [tab, setTab] = useState<"prehled" | "tym" | "smeny" | "naklady">(
    "prehled",
  );

  const load = useCallback(async () => {
    const [s, u, sh, ex] = await Promise.all([
      fetch(`/api/admin/summary?period=${period}`).then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
      fetch(`/api/admin/shifts?period=${period}`).then((r) => r.json()),
      fetch(`/api/expenses?period=${period}`).then((r) => r.json()),
    ]);
    setSummary(s);
    setUsers(u.users ?? []);
    setShifts(sh.shifts ?? []);
    setExpenses(ex.expenses ?? []);
    if (ex.from != null && ex.to != null) {
      setExpenseRange({
        from: String(ex.from),
        to: String(ex.to),
      });
    } else {
      setExpenseRange(null);
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
            <p className="text-sm text-zinc-500">Administrace</p>
            <p className="text-lg font-semibold text-zinc-900">
              {session?.user?.name}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["day", "week", "month"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  period === p
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-700 shadow"
                }`}
              >
                {p === "day" ? "Den" : p === "week" ? "Týden" : "Měsíc"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm text-zinc-600 underline"
            >
              Odhlásit
            </button>
          </div>
        </header>

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
                tab === k
                  ? "bg-white shadow"
                  : "text-zinc-600 hover:bg-white/50"
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
              <p className="mt-2 text-3xl font-semibold text-zinc-900">
                {formatKc(summary.foodTotalKc)}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {summary.expenseCount} záznamů
              </p>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow">
              <p className="text-sm text-zinc-500">Náklady na práci (dokončené směny)</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-900">
                {formatKc(summary.laborTotalKc)}
              </p>
            </div>
            <div className="sm:col-span-2 rounded-2xl bg-white p-6 shadow">
              <h3 className="font-medium text-zinc-900">Dokončené směny v období</h3>
              <ul className="mt-3 divide-y divide-zinc-100 text-sm">
                {summary.shiftSummaries.length === 0 && (
                  <li className="py-2 text-zinc-500">Žádné dokončené směny.</li>
                )}
                {summary.shiftSummaries.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap justify-between gap-2 py-2"
                  >
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

        {tab === "naklady" && (
          <section className="space-y-6">
            <FoodExpenseForm
              title="Přidat náklad na jídlo"
              onSuccess={() => void load()}
            />
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
            <NewEmployeeForm onDone={() => void load()} />
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
                    {sh.pings.length === 0 && (
                      <li>Žádná poloha (ještě nebo zamítnuto).</li>
                    )}
                    {sh.pings.map((p) => (
                      <li key={p.id}>
                        {new Date(p.recordedAt).toLocaleTimeString("cs-CZ")}:{" "}
                        {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                        {p.accuracyM != null
                          ? ` (±${Math.round(p.accuracyM)} m)`
                          : ""}
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

function NewEmployeeForm({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [rate, setRate] = useState("200");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        name,
        hourlyRateKc: parseInt(rate, 10),
      }),
    });
    setBusy(false);
    if (r.ok) {
      setUsername("");
      setPassword("");
      setName("");
      onDone();
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="rounded-2xl bg-white p-6 shadow"
    >
      <h3 className="font-medium text-zinc-900">Nový zaměstnanec</h3>
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
        className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
      >
        Přidat
      </button>
    </form>
  );
}

function EmployeeRateEditor({
  user,
  onSaved,
}: {
  user: UserRow;
  onSaved: () => void;
}) {
  const [rate, setRate] = useState(String(user.hourlyRateKc ?? 0));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hourlyRateKc: parseInt(rate, 10) }),
    });
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


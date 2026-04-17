import type { ExpenseListItem } from "../lib/group-expenses";
import { getRange, type Period } from "../lib/ranges";
import { supabase } from "../lib/supabase";

export type UserRow = {
  id: string;
  username: string;
  name: string;
  role: string;
  hourlyRateKc: number | null;
  createdAt?: string;
};

export async function loadUserMap(): Promise<
  Map<string, { id: string; name: string; username: string; hourlyRateKc: number | null }>
> {
  const { data, error } = await supabase.from("User").select("id,name,username,hourlyRateKc");
  if (error) throw error;
  return new Map((data ?? []).map((u) => [u.id, u]));
}

export async function fetchExpensesList(period: Period): Promise<{
  expenses: ExpenseListItem[];
  from: string;
  to: string;
}> {
  const { from, to } = getRange(period);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const { data: expenses, error } = await supabase
    .from("Expense")
    .select("*")
    .gte("date", fromIso)
    .lte("date", toIso)
    .order("date", { ascending: false });
  if (error) throw error;
  const umap = await loadUserMap();
  const list: ExpenseListItem[] = (expenses ?? []).map((e) => ({
    id: e.id,
    amountKc: e.amountKc,
    date: e.date,
    kind: e.kind,
    note: e.note,
    receiptUrl: e.receiptUrl,
    user: umap.get(e.createdById) ?? { name: "?", username: "?" },
  }));
  return { expenses: list, from: fromIso, to: toIso };
}

export type ShiftRow = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  userId: string;
  user: { name: string; username: string; hourlyRateKc: number | null };
  pings: {
    id: string;
    latitude: number;
    longitude: number;
    recordedAt: string;
    accuracyM: number | null;
  }[];
};

export async function fetchAdminShifts(period: Period): Promise<{
  shifts: ShiftRow[];
  from: string;
  to: string;
}> {
  const { from, to } = getRange(period);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const { data: shiftsRaw, error } = await supabase
    .from("Shift")
    .select("*, pings(*)")
    .lte("startedAt", toIso)
    .order("startedAt", { ascending: false });
  if (error) throw error;
  const fromT = new Date(fromIso).getTime();
  const shifts = (shiftsRaw ?? []).filter(
    (s) => !s.endedAt || new Date(s.endedAt as string).getTime() >= fromT,
  );
  const umap = await loadUserMap();
  const rows: ShiftRow[] = shifts.map((s) => {
    const u = umap.get(s.userId);
    const pings = [...((s.pings as ShiftRow["pings"]) ?? [])].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );
    return {
      id: s.id,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      userId: s.userId,
      user: u ?? { name: "?", username: "?", hourlyRateKc: null },
      pings,
    };
  });
  return { shifts: rows, from: fromIso, to: toIso };
}

export type Summary = {
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

export async function computeAdminSummary(period: Period): Promise<Summary> {
  const { from, to } = getRange(period);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const { data: expenses, error: e1 } = await supabase
    .from("Expense")
    .select("amountKc")
    .gte("date", fromIso)
    .lte("date", toIso);
  if (e1) throw e1;
  const foodTotalKc = (expenses ?? []).reduce((s, x) => s + x.amountKc, 0);

  const { data: shiftsDone, error: e2 } = await supabase
    .from("Shift")
    .select("id, startedAt, endedAt, userId")
    .not("endedAt", "is", null)
    .gte("endedAt", fromIso)
    .lte("endedAt", toIso);
  if (e2) throw e2;

  const umap = await loadUserMap();
  let laborTotalKc = 0;
  const shiftSummaries: Summary["shiftSummaries"] = [];
  for (const sh of shiftsDone ?? []) {
    if (!sh.endedAt) continue;
    const user = umap.get(sh.userId);
    const rate = user?.hourlyRateKc ?? 0;
    const ms = new Date(sh.endedAt).getTime() - new Date(sh.startedAt).getTime();
    const hours = ms / 3600000;
    const cost = Math.round(hours * rate);
    laborTotalKc += cost;
    shiftSummaries.push({
      id: sh.id,
      userName: user?.name ?? "?",
      hours: Math.round(hours * 100) / 100,
      costKc: cost,
      startedAt: sh.startedAt,
      endedAt: sh.endedAt,
    });
  }

  return {
    foodTotalKc,
    laborTotalKc,
    expenseCount: expenses?.length ?? 0,
    shiftSummaries,
  };
}

export async function fetchUsersForAdmin(): Promise<UserRow[]> {
  const { data, error } = await supabase
    .from("User")
    .select("id,username,name,role,hourlyRateKc,createdAt")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as UserRow[];
}

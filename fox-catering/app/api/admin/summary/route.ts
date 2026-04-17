import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getRange, type Period } from "@/lib/ranges";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nepovoleno" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") ?? "day") as Period;
  const ref = searchParams.get("ref")
    ? new Date(searchParams.get("ref")!)
    : new Date();

  const p: Period =
    period === "week" || period === "month" || period === "day" ? period : "day";
  const { from, to } = getRange(p, ref);

  const expenses = await prisma.expense.findMany({
    where: { date: { gte: from, lte: to } },
  });
  const foodTotalKc = expenses.reduce((s, e) => s + e.amountKc, 0);

  const shifts = await prisma.shift.findMany({
    where: {
      endedAt: { not: null, gte: from, lte: to },
    },
    include: { user: true },
  });

  let laborTotalKc = 0;
  const shiftSummaries: {
    id: string;
    userName: string;
    hours: number;
    costKc: number;
    startedAt: string;
    endedAt: string;
  }[] = [];

  for (const sh of shifts) {
    if (!sh.endedAt) continue;
    const rate = sh.user.hourlyRateKc ?? 0;
    const ms = sh.endedAt.getTime() - sh.startedAt.getTime();
    const hours = ms / 3600000;
    const cost = Math.round(hours * rate);
    laborTotalKc += cost;
    shiftSummaries.push({
      id: sh.id,
      userName: sh.user.name,
      hours: Math.round(hours * 100) / 100,
      costKc: cost,
      startedAt: sh.startedAt.toISOString(),
      endedAt: sh.endedAt.toISOString(),
    });
  }

  return NextResponse.json({
    period: p,
    from: from.toISOString(),
    to: to.toISOString(),
    foodTotalKc,
    laborTotalKc,
    expenseCount: expenses.length,
    shiftSummaries,
  });
}

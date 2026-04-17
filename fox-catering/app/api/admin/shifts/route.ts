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

  const shifts = await prisma.shift.findMany({
    where: {
      AND: [
        { startedAt: { lte: to } },
        { OR: [{ endedAt: null }, { endedAt: { gte: from } }] },
      ],
    },
    include: {
      user: { select: { name: true, username: true, hourlyRateKc: true } },
      pings: { orderBy: { recordedAt: "asc" } },
    },
    orderBy: { startedAt: "desc" },
  });

  return NextResponse.json({ shifts, from, to });
}

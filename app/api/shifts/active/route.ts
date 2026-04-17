import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Nepovoleno" }, { status: 403 });
  }

  const shift = await prisma.shift.findFirst({
    where: { userId: session.user.id, endedAt: null },
    include: { pings: { orderBy: { recordedAt: "asc" } } },
  });

  return NextResponse.json({ shift });
}

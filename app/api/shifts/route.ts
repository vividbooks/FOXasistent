import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Zahájit směnu */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Nepovoleno" }, { status: 403 });
  }

  const existing = await prisma.shift.findFirst({
    where: { userId: session.user.id, endedAt: null },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Už máte rozpracovanou směnu", shift: existing },
      { status: 400 },
    );
  }

  const shift = await prisma.shift.create({
    data: {
      userId: session.user.id,
      startedAt: new Date(),
    },
  });

  return NextResponse.json({ shift });
}

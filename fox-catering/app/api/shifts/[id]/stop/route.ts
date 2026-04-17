import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Nepovoleno" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const shift = await prisma.shift.findFirst({
    where: { id, userId: session.user.id, endedAt: null },
  });
  if (!shift) {
    return NextResponse.json({ error: "Směna nenalezena" }, { status: 404 });
  }

  const updated = await prisma.shift.update({
    where: { id },
    data: { endedAt: new Date() },
  });

  return NextResponse.json({ shift: updated });
}

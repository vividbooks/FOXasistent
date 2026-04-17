import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  accuracyM: z.number().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Nepovoleno" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
  }

  const shift = await prisma.shift.findFirst({
    where: { id, userId: session.user.id, endedAt: null },
  });
  if (!shift) {
    return NextResponse.json({ error: "Aktivní směna nenalezena" }, { status: 404 });
  }

  const ping = await prisma.locationPing.create({
    data: {
      shiftId: id,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      accuracyM: parsed.data.accuracyM,
      recordedAt: new Date(),
    },
  });

  return NextResponse.json({ ping });
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  hourlyRateKc: z.number().int().nonnegative(),
  name: z.string().min(1).max(128).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nepovoleno" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      hourlyRateKc: parsed.data.hourlyRateKc,
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
    },
    select: {
      id: true,
      username: true,
      name: true,
      hourlyRateKc: true,
    },
  });

  return NextResponse.json({ user });
}

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nepovoleno" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      hourlyRateKc: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ users });
}

const createSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(4).max(128),
  name: z.string().min(1).max(128),
  hourlyRateKc: z.number().int().nonnegative(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nepovoleno" }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
  }

  const username = parsed.data.username.trim().toLowerCase();
  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    return NextResponse.json({ error: "Uživatel už existuje" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      name: parsed.data.name,
      role: "EMPLOYEE",
      hourlyRateKc: parsed.data.hourlyRateKc,
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      hourlyRateKc: true,
    },
  });

  return NextResponse.json({ user });
}

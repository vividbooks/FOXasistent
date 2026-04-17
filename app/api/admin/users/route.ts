import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { slugifyForAuthEmail } from "@/lib/auth-email-local";
import { prisma } from "@/lib/prisma";
import { provisionSupabaseAuthForUserById } from "@/lib/sync-supabase-auth-for-user";
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

  const authLocal = slugifyForAuthEmail(username);
  const others = await prisma.user.findMany({ select: { username: true } });
  if (others.some((row) => slugifyForAuthEmail(row.username) === authLocal)) {
    return NextResponse.json(
      {
        error:
          "Účet se stejným přihlášením na GitHub Pages už existuje (stejný tvar po odstranění diakritiky).",
      },
      { status: 400 },
    );
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

  const authProvision = await provisionSupabaseAuthForUserById(user.id);

  return NextResponse.json({
    user,
    supabaseAuthOk: authProvision.ok,
    supabaseAuthError: authProvision.ok ? null : authProvision.error,
  });
}

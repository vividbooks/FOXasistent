import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { provisionSupabaseAuthForUserById } from "@/lib/sync-supabase-auth-for-user";

const bodySchema = z.object({
  userId: z.string().uuid(),
});

function withCors(res: NextResponse, req: Request): NextResponse {
  const origin = req.headers.get("origin");
  const allowed = process.env.PAGES_ADMIN_ALLOWED_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowOrigin =
    origin && allowed?.length && allowed.includes(origin)
      ? origin
      : allowed?.length === 1
        ? allowed[0]!
        : "*";
  res.headers.set("Access-Control-Allow-Origin", allowOrigin);
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type",
  );
  res.headers.set("Access-Control-Max-Age", "86400");
  return res;
}

export async function OPTIONS(req: Request) {
  return withCors(new NextResponse(null, { status: 204 }), req);
}

/**
 * Pro GitHub Pages admin: po INSERT do User zavolá tento endpoint se Supabase JWT,
 * aby vznikl Auth účet bez npm run sync-auth.
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anon) {
    return withCors(
      NextResponse.json(
        { error: "Chybí Supabase URL nebo publishable key na serveru." },
        { status: 500 },
      ),
      req,
    );
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (!token) {
    return withCors(
      NextResponse.json({ error: "Chybí Bearer token" }, { status: 401 }),
      req,
    );
  }

  const supabase = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user: authUser },
    error: authErr,
  } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return withCors(
      NextResponse.json({ error: "Neplatná session" }, { status: 401 }),
      req,
    );
  }

  const meta = authUser.user_metadata as {
    app_user_id?: string;
    role?: string;
  } | undefined;
  const adminAppId = meta?.app_user_id;
  if (!adminAppId || meta?.role !== "ADMIN") {
    return withCors(
      NextResponse.json({ error: "Jen administrátor" }, { status: 403 }),
      req,
    );
  }

  const adminRow = await prisma.user.findUnique({
    where: { id: adminAppId },
  });
  if (!adminRow || adminRow.role !== "ADMIN") {
    return withCors(
      NextResponse.json({ error: "Jen administrátor" }, { status: 403 }),
      req,
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return withCors(
      NextResponse.json({ error: "Neplatná data" }, { status: 400 }),
      req,
    );
  }

  const provision = await provisionSupabaseAuthForUserById(parsed.data.userId);
  if (!provision.ok) {
    return withCors(
      NextResponse.json({ error: provision.error }, { status: 502 }),
      req,
    );
  }

  return withCors(
    NextResponse.json({ ok: true, authUserId: provision.authUserId }),
    req,
  );
}

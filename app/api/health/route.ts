import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Diagnostika: je DB dostupná a jsou v ní uživatelé? (veřejné, bez přihlášení) */
export async function GET() {
  try {
    const users = await prisma.user.count();
    return NextResponse.json({ ok: true, users });
  } catch (e) {
    console.error("GET /api/health", e);
    return NextResponse.json({ ok: false, users: null }, { status: 503 });
  }
}

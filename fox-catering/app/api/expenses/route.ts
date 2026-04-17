import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sniffLikelyRasterImage } from "@/lib/image-sniff";
import {
  fallbackReceiptExt,
  isAllowedReceiptUpload,
  receiptExtLower,
} from "@/lib/receipt-upload-formats";
import { uploadReceiptToSupabase } from "@/lib/upload-receipt";
import { z } from "zod";

const kinds = ["MANUAL", "INVOICE", "RECEIPT"] as const;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nepřihlášeno" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "month";
  const ref = searchParams.get("ref")
    ? new Date(searchParams.get("ref")!)
    : new Date();

  const { getRange } = await import("@/lib/ranges");
  const p = period === "day" || period === "week" || period === "month" ? period : "month";
  const { from, to } = getRange(p, ref);

  const where =
    session.user.role === "ADMIN"
      ? { date: { gte: from, lte: to } }
      : {
          createdById: session.user.id,
          date: { gte: from, lte: to },
        };

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { date: "desc" },
    include: { user: { select: { name: true, username: true } } },
  });

  return NextResponse.json({ expenses, from, to });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nepřihlášeno" }, { status: 401 });
  }

  const ct = req.headers.get("content-type") ?? "";
  let amountKc: number;
  let date: Date;
  let note: string | null = null;
  let kind: (typeof kinds)[number];
  let receiptUrl: string | null = null;

  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const amountRaw = form.get("amountKc");
    const dateRaw = form.get("date");
    const kindRaw = form.get("kind");
    note = (form.get("note") as string) || null;
    const file = form.get("file") as File | null;

    const parsed = z
      .object({
        amountKc: z.coerce.number().int().positive(),
        date: z.string().transform((s) => new Date(s)),
        kind: z.enum(kinds),
      })
      .safeParse({
        amountKc: amountRaw,
        date: dateRaw,
        kind: kindRaw,
      });
    if (!parsed.success) {
      return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
    }
    amountKc = parsed.data.amountKc;
    date = parsed.data.date;
    kind = parsed.data.kind;

    const expense = await prisma.expense.create({
      data: {
        amountKc,
        date,
        note,
        kind,
        createdById: session.user.id,
      },
    });

    if (file && file.size > 0) {
      const maxBytes = 12 * 1024 * 1024;
      if (file.size > maxBytes) {
        await prisma.expense.delete({ where: { id: expense.id } });
        return NextResponse.json({ error: "Soubor je příliš velký (max 12 MB)." }, { status: 400 });
      }

      const mime = file.type || "";
      const extLower = receiptExtLower(file.name);
      const buf = Buffer.from(await file.arrayBuffer());
      if (!isAllowedReceiptUpload(file) && !sniffLikelyRasterImage(buf)) {
        await prisma.expense.delete({ where: { id: expense.id } });
        return NextResponse.json(
          {
            error:
              "Povolené jsou obrázky (JPEG, PNG, HEIC, WebP, AVIF, TIFF…) nebo PDF.",
          },
          { status: 400 },
        );
      }

      const ext = fallbackReceiptExt(mime, extLower);
      try {
        receiptUrl = await uploadReceiptToSupabase({
          expenseId: expense.id,
          extWithDot: ext,
          mime,
          buffer: buf,
        });
      } catch (e) {
        console.error(e);
        await prisma.expense.delete({ where: { id: expense.id } });
        return NextResponse.json(
          {
            error:
              "Nahrání přílohy do úložiště selhalo. Zkontrolujte Supabase (bucket „receipts“, proměnné prostředí).",
          },
          { status: 500 },
        );
      }
      await prisma.expense.update({
        where: { id: expense.id },
        data: { receiptUrl },
      });
    }

    const full = await prisma.expense.findUnique({
      where: { id: expense.id },
      include: { user: { select: { name: true, username: true } } },
    });
    return NextResponse.json({ expense: full });
  }

  const json = await req.json().catch(() => null);
  const parsed = z
    .object({
      amountKc: z.number().int().positive(),
      date: z.string().transform((s) => new Date(s)),
      kind: z.enum(kinds),
      note: z.string().optional().nullable(),
    })
    .safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      amountKc: parsed.data.amountKc,
      date: parsed.data.date,
      note: parsed.data.note ?? null,
      kind: parsed.data.kind,
      createdById: session.user.id,
    },
    include: { user: { select: { name: true, username: true } } },
  });

  return NextResponse.json({ expense });
}

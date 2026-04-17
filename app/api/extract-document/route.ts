import { auth } from "@/auth";
import { extractDocumentCorsHeaders } from "@/lib/extract-cors";
import {
  extractReceiptTextWithGemini,
  isGeminiConfigured,
} from "@/lib/gemini-receipt-text";
import { buildOcrPngCandidates } from "@/lib/image-for-ocr";
import { sniffLikelyRasterImage } from "@/lib/image-sniff";
import { isAllowedReceiptUpload } from "@/lib/receipt-upload-formats";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
/** OCR může trvat déle (stahování jazykových dat při prvním běhu). */
export const maxDuration = 120;

function isPdf(file: File, name: string) {
  return file.type === "application/pdf" || name.endsWith(".pdf");
}

/** Max. počet stran PDF, které při skenu projdeme OCR (čas / paměť). */
const PDF_OCR_MAX_PAGES = 30;
/** Šířka rasteru pro OCR (px) — vyšší = čitelnější drobný text. */
const PDF_OCR_RENDER_WIDTH = 1400;

async function extractPdfText(buf: Buffer): Promise<{
  text: string;
  hint?: string;
  pageCount: number;
}> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buf });
  try {
    const textResult = await parser.getText();
    const pageCount = textResult.total;
    const trimmedFull = (textResult.text || "").trim();

    const emptyPageNums: number[] = [];
    for (let i = 1; i <= pageCount; i++) {
      if (!textResult.getPageText(i).trim()) {
        emptyPageNums.push(i);
      }
    }

    // Čistě digitální PDF — text na všech stranách
    if (emptyPageNums.length === 0 && trimmedFull) {
      return { text: trimmedFull, pageCount };
    }

    const needsFullRasterOcr =
      emptyPageNums.length === pageCount || !trimmedFull;
    let pagesToRaster = needsFullRasterOcr
      ? Array.from({ length: pageCount }, (_, j) => j + 1)
      : emptyPageNums;

    let truncatedOcr = false;
    if (pagesToRaster.length > PDF_OCR_MAX_PAGES) {
      truncatedOcr = true;
      pagesToRaster = pagesToRaster.slice(0, PDF_OCR_MAX_PAGES);
    }

    const shotParams =
      pagesToRaster.length === pageCount
        ? { desiredWidth: PDF_OCR_RENDER_WIDTH, imageDataUrl: false as const }
        : {
            partial: pagesToRaster,
            desiredWidth: PDF_OCR_RENDER_WIDTH,
            imageDataUrl: false as const,
          };

    const screenshots = await parser.getScreenshot(shotParams);

    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("ces+eng", 1, {
      logger: () => {},
    });

    try {
      const ocrByPage = new Map<number, string>();
      for (const page of screenshots.pages) {
        if (!page.data?.length) continue;
        const {
          data: { text },
        } = await worker.recognize(Buffer.from(page.data));
        const t = (text || "").trim();
        if (t) ocrByPage.set(page.pageNumber, t);
      }

      const chunks: string[] = [];
      for (let i = 1; i <= pageCount; i++) {
        let t = textResult.getPageText(i).trim();
        if (!t) {
          t = ocrByPage.get(i) ?? "";
        }
        if (t) {
          chunks.push(t);
        }
      }

      const merged = chunks.join("\n\n").trim();

      let hint: string | undefined;
      if (!merged) {
        hint =
          "V PDF nebyl nalezen text — jde pravděpodobně o sken. Nahrajte prosím účtenku jako fotku (JPG), aby šla přečíst OCR.";
      } else if (truncatedOcr) {
        hint = `Sken PDF: OCR proběhlo jen pro ${pagesToRaster.length} stran(y) z ${pageCount}. Zbytek dopište ručně nebo rozdělte soubor.`;
      }

      return { text: merged, hint, pageCount };
    } finally {
      await worker.terminate();
    }
  } finally {
    await parser.destroy();
  }
}

function withCors(req: Request, res: NextResponse) {
  const h = extractDocumentCorsHeaders(req);
  for (const [k, v] of Object.entries(h)) {
    res.headers.set(k, v);
  }
  return res;
}

/** Předvolba prohlížeče před POST z jiné domény (GitHub Pages). */
export async function OPTIONS(req: Request) {
  return withCors(req, new NextResponse(null, { status: 204 }));
}

async function assertExtractAuthorized(req: Request): Promise<NextResponse | null> {
  const nextSession = await auth();
  if (nextSession?.user?.id) return null;

  const authz = req.headers.get("authorization");
  const m = authz?.match(/^Bearer\s+(.+)$/i);
  if (!m) {
    return withCors(
      req,
      NextResponse.json({ error: "Nepřihlášeno" }, { status: 401 }),
    );
  }
  try {
    const supabase = createSupabaseAdmin();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(m[1]);
    if (error || !user) {
      return withCors(
        req,
        NextResponse.json({ error: "Nepřihlášeno" }, { status: 401 }),
      );
    }
    return null;
  } catch {
    return withCors(
      req,
      NextResponse.json({ error: "Nepřihlášeno" }, { status: 401 }),
    );
  }
}

export async function POST(req: Request) {
  const deny = await assertExtractAuthorized(req);
  if (deny) return deny;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return withCors(req, NextResponse.json({ error: "Chybí soubor" }, { status: 400 }));
  }

  if (file.size > 12 * 1024 * 1024) {
    return withCors(
      req,
      NextResponse.json({ error: "Soubor je příliš velký" }, { status: 400 }),
    );
  }

  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    if (isGeminiConfigured()) {
      try {
        const geminiText = await extractReceiptTextWithGemini(buf, file);
        const trimmed = geminiText.trim();
        const looksLikeFailure = /^\[čitelný text/i.test(trimmed);
        if (trimmed.length >= 20 && !looksLikeFailure) {
          return withCors(req, NextResponse.json({ text: trimmed }));
        }
      } catch (e) {
        console.warn("extract-document: Gemini selhalo, zkouším Tesseract", e);
      }
    }

    if (isPdf(file, name)) {
      const { text, hint, pageCount } = await extractPdfText(buf);
      if (!text) {
        return withCors(
          req,
          NextResponse.json({
            text: "",
            hint:
              hint ??
              "V PDF nebyl nalezen text — jde pravděpodobně o sken. Nahrajte prosím účtenku jako fotku (JPG), aby šla přečíst OCR.",
            pageCount,
          }),
        );
      }
      return withCors(req, NextResponse.json({ text, hint, pageCount }));
    }

    if (!isAllowedReceiptUpload(file) && !sniffLikelyRasterImage(buf)) {
      return withCors(
        req,
        NextResponse.json({ error: "Nepodporovaný typ souboru" }, { status: 400 }),
      );
    }

    let pngs: Buffer[];
    try {
      pngs = await buildOcrPngCandidates(buf);
    } catch {
      return withCors(
        req,
        NextResponse.json(
          {
            error:
              "Obrázek se nepodařilo načíst (zkuste JPG/PNG nebo jiný telefon může ukládat HEIC — mělo by to projít, jinak uložte jako JPEG).",
          },
          { status: 400 },
        ),
      );
    }

    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("ces+eng", 1, {
      logger: () => {},
    });
    try {
      let best = "";
      for (const png of pngs) {
        const {
          data: { text },
        } = await worker.recognize(png);
        const t = (text || "").trim();
        if (t.length > best.length) best = t;
      }
      return withCors(
        req,
        NextResponse.json({
          text: best,
          hint: best
            ? undefined
            : "Text se nepodařilo spolehlivě přečíst — zkuste ostřejší fotku, větší kontrast nebo lepší osvětlení.",
        }),
      );
    } finally {
      await worker.terminate();
    }
  } catch (e) {
    console.error("extract-document", e);
    return withCors(
      req,
      NextResponse.json(
        { error: "Čtení dokumentu selhalo. Zkuste jiný soubor nebo menší velikost." },
        { status: 500 },
      ),
    );
  }
}

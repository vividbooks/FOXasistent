import { createWorker, type Worker } from "tesseract.js";

/** Max. počet stran PDF pro OCR (čas / paměť v prohlížeči). */
const PDF_OCR_MAX_PAGES = 30;
/** Šířka rasteru pro OCR (px). */
const PDF_OCR_RENDER_WIDTH = 1400;
const IMAGE_MAX_EDGE = 2800;

function isPdf(file: File, nameLower: string): boolean {
  return file.type === "application/pdf" || nameLower.endsWith(".pdf");
}

function isHeicLike(file: File, nameLower: string): boolean {
  const t = (file.type || "").toLowerCase();
  return t === "image/heic" || t === "image/heif" || /\.(heic|heif)$/i.test(nameLower);
}

function pageTextFromPdfContent(textContent: { items: readonly unknown[] }): string {
  const parts: string[] = [];
  for (const item of textContent.items) {
    if (item && typeof item === "object" && "str" in item && typeof (item as { str: unknown }).str === "string") {
      parts.push((item as { str: string }).str);
    }
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

async function bitmapFromFile(file: File, nameLower: string): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    if (isHeicLike(file, nameLower)) {
      const heic2any = (await import("heic2any")).default;
      const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
      const blob = Array.isArray(out) ? out[0] : out;
      return await createImageBitmap(blob);
    }
    throw new Error(
      "Obrázek se nepodařilo načíst (zkuste JPG/PNG; HEIC na některých prohlížečích neprojde — uložte jako JPEG).",
    );
  }
}

function canvasFromBitmap(bitmap: ImageBitmap): HTMLCanvasElement {
  const maxEdge = IMAGE_MAX_EDGE;
  let w = bitmap.width;
  let h = bitmap.height;
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas není k dispozici.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

async function ocrImageBest(worker: Worker, sourceCanvas: HTMLCanvasElement): Promise<string> {
  let best = "";
  const run = async (c: HTMLCanvasElement) => {
    const {
      data: { text },
    } = await worker.recognize(c);
    const t = (text || "").trim();
    if (t.length > best.length) best = t;
  };

  await run(sourceCanvas);

  const c2 = document.createElement("canvas");
  c2.width = sourceCanvas.width;
  c2.height = sourceCanvas.height;
  const x = c2.getContext("2d");
  if (x) {
    x.filter = "grayscale(1) contrast(1.25) brightness(1.05)";
    x.drawImage(sourceCanvas, 0, 0);
    await run(c2);
  }

  return best;
}

async function extractImageClient(file: File): Promise<{ text: string; hint?: string }> {
  const nameLower = file.name.toLowerCase();
  const bitmap = await bitmapFromFile(file, nameLower);
  try {
    const canvas = canvasFromBitmap(bitmap);
    const worker = await createWorker("ces+eng", 1, { logger: () => {} });
    try {
      const best = await ocrImageBest(worker, canvas);
      return {
        text: best,
        hint: best
          ? undefined
          : "Text se nepodařilo spolehlivě přečíst — zkuste ostřejší fotku, větší kontrast nebo lepší osvětlení.",
      };
    } finally {
      await worker.terminate();
    }
  } finally {
    bitmap.close();
  }
}

async function extractPdfClient(file: File): Promise<{
  text: string;
  hint?: string;
  pageCount: number;
}> {
  const pdfjs = await import("pdfjs-dist");
  const workerMod = await import("pdfjs-dist/build/pdf.worker.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;

  const raw = await file.arrayBuffer();
  const data = new Uint8Array(raw);
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  const perPageText: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    perPageText.push(pageTextFromPdfContent(textContent));
  }

  const emptyPageNums: number[] = [];
  for (let i = 0; i < perPageText.length; i++) {
    if (!perPageText[i].trim()) emptyPageNums.push(i + 1);
  }

  const trimmedFull = perPageText.map((t) => t.trim()).join("\n\n").trim();

  if (emptyPageNums.length === 0 && trimmedFull) {
    return { text: trimmedFull, pageCount };
  }

  const needsFullRasterOcr = emptyPageNums.length === pageCount || !trimmedFull;
  let pagesToRaster = needsFullRasterOcr
    ? Array.from({ length: pageCount }, (_, j) => j + 1)
    : emptyPageNums;

  let truncatedOcr = false;
  if (pagesToRaster.length > PDF_OCR_MAX_PAGES) {
    truncatedOcr = true;
    pagesToRaster = pagesToRaster.slice(0, PDF_OCR_MAX_PAGES);
  }

  const worker = await createWorker("ces+eng", 1, { logger: () => {} });
  try {
    const ocrByPage = new Map<number, string>();

    for (const pageNum of pagesToRaster) {
      const page = await pdf.getPage(pageNum);
      const baseVp = page.getViewport({ scale: 1 });
      const scale = PDF_OCR_RENDER_WIDTH / baseVp.width;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const best = await ocrImageBest(worker, canvas);
      if (best) ocrByPage.set(pageNum, best);
    }

    const chunks: string[] = [];
    for (let i = 1; i <= pageCount; i++) {
      let t = perPageText[i - 1]?.trim() ?? "";
      if (!t) t = ocrByPage.get(i) ?? "";
      if (t) chunks.push(t);
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
}

/**
 * Čtení textu z účtenky / faktury přímo v prohlížeči (GitHub Pages bez vlastního serveru).
 */
export async function extractDocumentClient(file: File): Promise<{
  text: string;
  hint?: string;
  pageCount?: number;
}> {
  const nameLower = file.name.toLowerCase();
  if (isPdf(file, nameLower)) {
    return extractPdfClient(file);
  }
  return extractImageClient(file);
}

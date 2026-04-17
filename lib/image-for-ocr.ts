import sharp from "sharp";
import { sniffHeicOrHeif } from "@/lib/image-sniff";

const OCR_MAX_EDGE = 4096;

async function sharpCanDecode(buf: Buffer): Promise<boolean> {
  try {
    await sharp(buf, { failOn: "none" })
      .resize({ width: 32, height: 32, fit: "inside" })
      .raw()
      .toBuffer();
    return true;
  } catch {
    return false;
  }
}

/**
 * Vrátí buffer, který umí sharp přečíst (HEIC → JPEG přes heic-convert).
 */
export async function resolveImageBufferForSharp(buf: Buffer): Promise<Buffer> {
  if (await sharpCanDecode(buf)) return buf;
  if (sniffHeicOrHeif(buf)) {
    const { default: convert } = await import("heic-convert");
    const jpeg = await convert({
      buffer: buf,
      format: "JPEG",
      quality: 0.92,
    });
    if (Buffer.isBuffer(jpeg)) return jpeg;
    if (jpeg instanceof ArrayBuffer) return Buffer.from(jpeg);
    return Buffer.from(jpeg);
  }
  throw new Error("Nepodařilo se dekódovat obrázek.");
}

/** contrast = šedá + normalizace (účtenky); soft = jen zmenšení (barevné fotky). */
export async function bufferToPngForOcr(
  buf: Buffer,
  variant: "contrast" | "soft",
): Promise<Buffer> {
  let pipeline = sharp(buf, { failOn: "none" })
    .rotate()
    .resize({
      width: OCR_MAX_EDGE,
      height: OCR_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    });
  if (variant === "contrast") {
    pipeline = pipeline.grayscale().normalize();
  }
  const out = await pipeline.png({ compressionLevel: 6 }).toBuffer();
  return Buffer.from(out);
}

/** Jedna až dvě varianty PNG — OCR vezme delší výsledek. */
export async function buildOcrPngCandidates(originalBuf: Buffer): Promise<Buffer[]> {
  const raster = await resolveImageBufferForSharp(originalBuf);
  const contrast = await bufferToPngForOcr(raster, "contrast");
  try {
    const soft = await bufferToPngForOcr(raster, "soft");
    if (soft.equals(contrast)) return [contrast];
    return [contrast, soft];
  } catch {
    return [contrast];
  }
}

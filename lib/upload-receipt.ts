import { createSupabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "receipts";

function contentTypeForUpload(mime: string, extLower: string): string {
  if (mime && mime !== "application/octet-stream") return mime;
  const m: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".avif": "image/avif",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".bmp": "image/bmp",
    ".jxl": "image/jxl",
  };
  return m[extLower] ?? "application/octet-stream";
}

/** Nahraje přílohu do Supabase Storage a vrátí veřejnou URL. */
export async function uploadReceiptToSupabase(opts: {
  expenseId: string;
  extWithDot: string;
  mime: string;
  buffer: Buffer;
}): Promise<string> {
  const supabase = createSupabaseAdmin();
  const path = `receipt-${opts.expenseId}${opts.extWithDot}`;
  const contentType = contentTypeForUpload(opts.mime, opts.extWithDot.toLowerCase());

  const { error } = await supabase.storage.from(BUCKET).upload(path, opts.buffer, {
    contentType,
    upsert: false,
  });

  if (error) {
    console.error("Supabase storage upload", error);
    throw new Error(error.message || "Nahrání souboru do úložiště selhalo.");
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

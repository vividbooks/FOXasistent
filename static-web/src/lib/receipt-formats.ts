export const RECEIPT_FILE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
  ".avif",
  ".jxl",
  ".pdf",
]);

const RECEIPT_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/avif",
  "image/heic",
  "image/heif",
  "image/jxl",
  "application/pdf",
]);

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/pjpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/bmp": ".bmp",
  "image/tiff": ".tif",
  "image/avif": ".avif",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "image/jxl": ".jxl",
  "application/pdf": ".pdf",
};

export function receiptExtLower(filename: string): string {
  const i = filename.lastIndexOf(".");
  if (i < 0) return "";
  return filename.slice(i).toLowerCase();
}

export function isAllowedReceiptUpload(file: Pick<File, "name" | "type">): boolean {
  const ext = receiptExtLower(file.name);
  const mime = (file.type || "").toLowerCase();
  if (RECEIPT_FILE_EXTENSIONS.has(ext)) return true;
  if (mime && RECEIPT_MIMES.has(mime)) return true;
  if (mime === "application/octet-stream" && RECEIPT_FILE_EXTENSIONS.has(ext)) return true;
  if (!ext && mime.startsWith("image/")) return true;
  return false;
}

export function fallbackReceiptExt(mime: string, extLower: string): string {
  if (extLower) return extLower;
  const m = mime.toLowerCase();
  return MIME_TO_EXT[m] ?? (m === "application/pdf" ? ".pdf" : ".jpg");
}

const LEGACY_BUCKET = "receipts";

const DEFAULT_PROJECT_BUCKET = "fakturyauctenky";

export function configuredReceiptBucket(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() ||
    process.env.SUPABASE_STORAGE_BUCKET?.trim() ||
    DEFAULT_PROJECT_BUCKET
  );
}

/** Viz static-web/src/lib/receipt-storage-url.ts */
export function normalizeReceiptPublicUrl(url: string): string {
  if (!url) return url;
  const target = configuredReceiptBucket();
  let u = url;
  u = u.replaceAll(`/object/public/${LEGACY_BUCKET}/`, `/object/public/${target}/`);
  u = u.replaceAll(`/object/${LEGACY_BUCKET}/`, `/object/public/${target}/`);
  return u;
}

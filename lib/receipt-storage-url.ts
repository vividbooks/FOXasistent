const LEGACY_BUCKET = "receipts";

/** Bucket pro náhledy v prohlížeči (Next client — jen NEXT_PUBLIC_*). */
export function configuredReceiptBucket(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() ||
    process.env.SUPABASE_STORAGE_BUCKET?.trim() ||
    LEGACY_BUCKET
  );
}

/** Viz static-web/src/lib/receipt-storage-url.ts — přemapování starých URL z „receipts“. */
export function normalizeReceiptPublicUrl(url: string): string {
  const bucket = configuredReceiptBucket();
  if (!url || bucket === LEGACY_BUCKET) return url;

  let u = url;
  const to = `/object/public/${bucket}/`;
  u = u.replaceAll(`/object/public/${LEGACY_BUCKET}/`, to);
  u = u.replaceAll(`/object/${LEGACY_BUCKET}/`, to);
  return u;
}

const LEGACY_BUCKET = "receipts";

/** Aktuální bucket z buildu (např. fakturyauctenky). */
export function configuredReceiptBucket(): string {
  return (
    (import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string | undefined)?.trim() ||
    LEGACY_BUCKET
  );
}

/**
 * Staré záznamy v DB mají často URL s bucketem „receipts“, zatímco ve Storage je jen jiný bucket.
 * Přemapuje veřejné URL na aktuální bucket (jen pokud se liší od výchozího receipts).
 */
export function normalizeReceiptPublicUrl(url: string): string {
  const bucket = configuredReceiptBucket();
  if (!url || bucket === LEGACY_BUCKET) return url;

  let u = url;
  const to = `/object/public/${bucket}/`;
  u = u.replaceAll(`/object/public/${LEGACY_BUCKET}/`, to);
  // Varianty bez segmentu „public“ (nebo zastaralý tvar) — doplníme veřejnou cestu.
  u = u.replaceAll(`/object/${LEGACY_BUCKET}/`, to);
  return u;
}

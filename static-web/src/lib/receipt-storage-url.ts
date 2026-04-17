const LEGACY_BUCKET = "receipts";

/**
 * V tomto repu je ve Storage bucket „fakturyauctenky“. Jiný název nastav přes VITE_SUPABASE_STORAGE_BUCKET.
 * Dřívější výchozí „receipts“ vede k 400/404, pokud bucket v projektu neexistuje.
 */
const DEFAULT_PROJECT_BUCKET = "fakturyauctenky";

/** Aktuální bucket (env má přednost). */
export function configuredReceiptBucket(): string {
  const fromEnv = (import.meta.env.VITE_SUPABASE_STORAGE_BUCKET as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_PROJECT_BUCKET;
}

/**
 * DB často obsahuje staré URL s „receipts“ nebo bez segmentu „public“.
 * Vždy přemapuj na cílový bucket — i když v buildu chybí env (fallback fakturyauctenky).
 */
export function normalizeReceiptPublicUrl(url: string): string {
  if (!url) return url;
  const target = configuredReceiptBucket();
  let u = url;
  u = u.replaceAll(`/object/public/${LEGACY_BUCKET}/`, `/object/public/${target}/`);
  u = u.replaceAll(`/object/${LEGACY_BUCKET}/`, `/object/public/${target}/`);
  return u;
}

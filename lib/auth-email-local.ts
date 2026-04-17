/**
 * Syntetický Supabase Auth e-mail: `${slugifyForAuthEmail(username)}@fox-app.local`.
 * GoTrue odmítá ne-ASCII v local part → „Unable to validate email address: invalid format“.
 */
export function slugifyForAuthEmail(raw: string): string {
  const s = raw.trim().toLowerCase();
  const decomposed = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const ascii = decomposed.replace(/[^a-z0-9._+-]/g, "-");
  const collapsed = ascii.replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  return collapsed.length > 0 ? collapsed : "user";
}

export function syntheticAuthEmail(username: string): string {
  return `${slugifyForAuthEmail(username)}@fox-app.local`;
}

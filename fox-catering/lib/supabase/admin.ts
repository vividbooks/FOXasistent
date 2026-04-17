import { createClient } from "@supabase/supabase-js";

/**
 * Klient s oprávněním service role — jen na serveru (API routes).
 * Nepřidávejte SUPABASE_SERVICE_ROLE_KEY do NEXT_PUBLIC_*.
 */
export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Chybí NEXT_PUBLIC_SUPABASE_URL nebo SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

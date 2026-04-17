/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Název Storage bucketu pro účtenky (výchozí receipts). */
  readonly VITE_SUPABASE_STORAGE_BUCKET?: string;
  /** „1“ / „true“ = čtení dokladu přes Vercel API (Gemini Vision, viz GEMINI_API_KEY). */
  readonly VITE_USE_GEMINI_EXTRACT?: string;
  /** Kořen Next na Vercelu (stejné jako u provision auth). */
  readonly VITE_NEXT_API_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

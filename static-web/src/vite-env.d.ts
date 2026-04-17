/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Kořen Next.js na Vercelu (OCR /api/extract-document), bez koncového lomítka */
  readonly VITE_EXTRACT_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

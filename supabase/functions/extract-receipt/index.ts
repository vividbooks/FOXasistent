import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/** Musí odpovídat `GEMINI_RECEIPT_MODEL_ID` v lib/gemini-model.ts (Next.js). */
const GEMINI_RECEIPT_MODEL_ID = "gemini-2.5-flash";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, x-supabase-api-version, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  /** Sníží počet preflightů z prohlížeče (GitHub Pages → Supabase). */
  "Access-Control-Max-Age": "86400",
};

const PROMPT = `Jsi OCR pro české účtenky, paragony a faktury.
Přepiš veškerý viditelný text z přiloženého obrázku nebo PDF.

Požadavky na výstup:
- Pouze přepsaný text, bez úvodu, bez vysvětlení a bez komentářů.
- Zachovej přibližně řádky tam, kde to pomáhá (názvy zboží, částky, DPH).
- Nepřidávej součty ani opravy — jen přepis toho, co je na dokladu.
- Pokud text nejde přečíst, napiš jednu krátkou větu: [čitelný text se nepodařil zachytit]`;

const MAX_BYTES = 12 * 1024 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function mimeFromFile(file: File, nameLower: string): string {
  const t = (file.type || "").trim().toLowerCase();
  if (t && t !== "application/octet-stream") return t;
  if (nameLower.endsWith(".pdf")) return "application/pdf";
  if (nameLower.endsWith(".png")) return "image/png";
  if (nameLower.endsWith(".webp")) return "image/webp";
  if (nameLower.endsWith(".gif")) return "image/gif";
  if (nameLower.endsWith(".jpg") || nameLower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (nameLower.endsWith(".heic")) return "image/heic";
  if (nameLower.endsWith(".heif")) return "image/heif";
  return "image/jpeg";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Chybí Authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const jwt = authHeader.slice(7);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseAnon);
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser(jwt);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Nepřihlášeno" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim();
  if (!geminiKey) {
    return new Response(
      JSON.stringify({
        error: "Na projektu chybí secret GEMINI_API_KEY (supabase secrets set GEMINI_API_KEY=…)",
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new Response(JSON.stringify({ error: "Neplatný formulář" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const file = form.get("file") as File | null;
  if (!file || file.size === 0) {
    return new Response(JSON.stringify({ error: "Chybí soubor" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (file.size > MAX_BYTES) {
    return new Response(JSON.stringify({ error: "Soubor je příliš velký (max 12 MB)" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const nameLower = file.name.toLowerCase();
  const mimeType = mimeFromFile(file, nameLower);
  const buf = new Uint8Array(await file.arrayBuffer());
  const b64 = bytesToBase64(buf);

  const geminiUrl =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_RECEIPT_MODEL_ID}:generateContent?key=${encodeURIComponent(geminiKey)}`;

  const geminiRes = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: PROMPT },
            {
              inline_data: {
                mime_type: mimeType,
                data: b64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.05,
      },
    }),
  });

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    console.error("Gemini error", geminiRes.status, errText);
    return new Response(
      JSON.stringify({ error: "Gemini odmítl požadavek — zkuste znovu nebo menší soubor." }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const geminiJson = (await geminiRes.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    geminiJson.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text?.trim() ?? "";

  return new Response(JSON.stringify({ text }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

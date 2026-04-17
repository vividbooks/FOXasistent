import { GoogleGenerativeAI } from "@google/generative-ai";

const RECEIPT_OCR_PROMPT = `Jsi OCR pro české účtenky, paragony a faktury.
Přepiš veškerý viditelný text z přiloženého obrázku nebo PDF.

Požadavky na výstup:
- Pouze přepsaný text, bez úvodu, bez vysvětlení a bez komentářů.
- Zachovej přibližně řádky tam, kde to pomáhá (názvy zboží, částky, DPH).
- Nepřidávej součty ani opravy — jen přepis toho, co je na dokladu.
- Pokud text nejde přečíst, napiš jednu krátkou větu: [čitelný text se nepodařil zachytit]`;

/** Gemini inline limit — při větším souboru necháme fallback na Tesseract. */
const MAX_BYTES_FOR_GEMINI = 12 * 1024 * 1024;

function resolveMime(file: File, nameLower: string): string {
  const t = (file.type || "").trim().toLowerCase();
  if (t && t !== "application/octet-stream") return t;
  if (nameLower.endsWith(".pdf")) return "application/pdf";
  if (nameLower.endsWith(".png")) return "image/png";
  if (nameLower.endsWith(".webp")) return "image/webp";
  if (nameLower.endsWith(".gif")) return "image/gif";
  if (nameLower.endsWith(".jpg") || nameLower.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}

/**
 * Přepis dokladu přes Gemini Vision (vyžaduje GEMINI_API_KEY).
 */
export async function extractReceiptTextWithGemini(
  buf: Buffer,
  file: File,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error("Chybí GEMINI_API_KEY");
  }
  if (buf.length > MAX_BYTES_FOR_GEMINI) {
    throw new Error("Soubor je příliš velký pro Gemini");
  }

  const nameLower = file.name.toLowerCase();
  const mimeType = resolveMime(file, nameLower);
  const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.05,
    },
  });

  const b64 = buf.toString("base64");
  const result = await model.generateContent([
    RECEIPT_OCR_PROMPT,
    {
      inlineData: {
        mimeType,
        data: b64,
      },
    },
  ]);

  const text = result.response.text();
  return (text || "").trim();
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

import { parseReceiptFromText } from "./parse-receipt-from-text";

const MAX_LEN = 72;

function clip(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= MAX_LEN) return t;
  return `${t.slice(0, MAX_LEN - 1).trimEnd()}…`;
}

function tryDodavatelOneLine(text: string): string | null {
  const m = text.match(/\b[Dd]odavatel\s*[:\s]+\s*([^,\n|]+)/);
  const s = m?.[1]?.trim();
  if (s && s.length >= 2) return clip(s);
  return null;
}

function tryMakro(text: string): string | null {
  if (!/\bMAKRO\b/i.test(text)) return null;
  const m = text.match(/\bMAKRO[^\n,]{0,58}/i);
  return m ? clip(m[0]) : null;
}

function tryParsedItems(raw: string): string | null {
  const parsed = parseReceiptFromText(raw);
  if (parsed.items.length === 0) return null;
  const parts = parsed.items
    .slice(0, 2)
    .map((i) => i.label.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 2);
  if (parts.length === 0) return null;
  return clip(parts.join(" · "));
}

function tryObchod(text: string): string | null {
  const m = text.match(
    /\b(?:OBCHOD|PROVOZOVNA|ESHOP)\s*[:\s]+\s*([^,\n]{3,60})/i,
  );
  return m?.[1] ? clip(m[1].trim()) : null;
}

function tryFirstMeaningfulLine(raw: string): string | null {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (line.length < 10 || line.length > 88) continue;
    if (/^[\d\s,.:€%KčkčCZKczk-]+$/i.test(line)) continue;
    if (
      /^(faktura|fa[ck]tura|daňový|účtenka|paragon|děkujeme|www\.|http|e-?mail|tel\.)/i.test(
        line,
      )
    ) {
      continue;
    }
    if (/^\d{1,3}\s+\d{4,}\s+\d+[,.]?\d*\s+/i.test(line)) continue;
    return clip(line);
  }
  return null;
}

/**
 * Krátký popis dokladu pro pole note / nadpis v seznamu (z OCR nebo PDF textu).
 */
export function deriveExpenseTitleFromDocumentText(
  raw: string,
  kind: "RECEIPT" | "INVOICE" | "MANUAL",
): string | null {
  if (kind === "MANUAL") return null;
  const text = raw.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 6) return null;

  const invoiceLike =
    kind === "INVOICE" || /\bfaktura|fa[ck]tura|daňový\s+doklad/i.test(text);

  if (invoiceLike) {
    return (
      tryDodavatelOneLine(text) ??
      tryMakro(text) ??
      tryObchod(text) ??
      tryParsedItems(raw) ??
      tryFirstMeaningfulLine(raw)
    );
  }

  return (
    tryParsedItems(raw) ??
    tryDodavatelOneLine(text) ??
    tryMakro(text) ??
    tryObchod(text) ??
    tryFirstMeaningfulLine(raw)
  );
}

/** Hlavní řádek v seznamu nákladů: uložený popis, jinak kdo zadal. */
export function expenseListPrimaryLine(e: {
  note: string | null;
  user: { name: string };
}): string {
  const n = e.note?.trim();
  if (n) return n;
  return e.user.name;
}

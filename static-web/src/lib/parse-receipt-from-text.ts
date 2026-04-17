export type ReceiptItem = { label: string; amountKc: number };

export type ParsedReceipt = {
  items: ReceiptItem[];
  /** Součet rozpoznaných řádků (může být nepřesný kvůli OCR). */
  lineSumKc: number | null;
  /** Částka z řádku typu CELKEM / k úhradě. */
  declaredTotalKc: number | null;
};

function parsePriceToken(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(/\u00a0/g, "");
  if (!/^\d/.test(t)) return null;
  const comma = t.indexOf(",");
  let intStr: string;
  let dec = 0;
  if (comma >= 0) {
    intStr = t.slice(0, comma).replace(/\./g, "");
    const decPart = t.slice(comma + 1).replace(/\D/g, "").slice(0, 2);
    dec = decPart ? parseInt(decPart.padEnd(2, "0"), 10) : 0;
  } else {
    intStr = t.replace(/\./g, "");
  }
  const whole = parseInt(intStr, 10);
  if (!Number.isFinite(whole)) return null;
  return Math.round(whole + dec / 100);
}

/** Poslední částka na řádku (u souhrnných řádků bývá konečná částka vpravo). */
function lastMoneyOnLine(line: string): number | null {
  let best: number | null = null;
  const re =
    /(\d{1,3}(?:[ \u00a0]\d{3})*(?:,\d{1,2})?|\d+,\d{2})\s*(?:Kč|Kc|CZK)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const n = parsePriceToken(m[1]);
    if (n != null && n > 0 && n < 10_000_000) best = n;
  }
  return best;
}

/** Mezisoučet za stránku (Makro apod.) — není k úhradě. */
function isPageSubtotalLine(line: string): boolean {
  return /strana\s+celkem|poslední\s+strana\s+celkem|celkem\s+bez\s*dph/i.test(
    line,
  );
}

function isInvoiceTableHeaderLine(line: string): boolean {
  return /řádek\s+číslo\s+zboží|cena\s+celkem\s+dph/i.test(line);
}

/** Typický řádek položky faktury (č. řádku + kód zboží + množství). */
function looksLikeInvoiceLineItem(line: string): boolean {
  return /^\d{1,3}\s+\d{5,7}\s+\d+[,.]?\d*\s+/i.test(line);
}

function extractDeclaredTotalKc(lines: string[]): number | null {
  for (const line of lines) {
    if (/celková\s+částka/i.test(line)) {
      const n = lastMoneyOnLine(line);
      if (n != null) return n;
    }
  }

  const candidates: number[] = [];

  for (const line of lines) {
    if (isPageSubtotalLine(line) || isInvoiceTableHeaderLine(line)) continue;
    if (looksLikeInvoiceLineItem(line)) continue;

    if (
      /celkem\s+k\s*úhradě|částka\s*k\s*úhradě/i.test(line) ||
      /^\s*zaplatit(?:\s|$|:)/i.test(line) ||
      (/bezhotovostní/i.test(line) && /\d/.test(line))
    ) {
      const n = lastMoneyOnLine(line);
      if (n != null) candidates.push(n);
    }
  }

  for (const line of lines) {
    if (isPageSubtotalLine(line) || isInvoiceTableHeaderLine(line)) continue;
    if (looksLikeInvoiceLineItem(line)) continue;
    if (
      /cena\s+celkem/i.test(line) &&
      !/celkem\s+k\s*úhradě|celková/i.test(line)
    ) {
      continue;
    }

    if (/celkem|k\s*úhradě|zaplatit|částka\s*k\s*úhradě/i.test(line)) {
      const n = lastMoneyOnLine(line);
      if (n != null) candidates.push(n);
    }
  }

  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

/**
 * Heuristika z OCR / PDF textu — české účtenky (název + cena na řádku).
 */
export function parseReceiptFromText(text: string): ParsedReceipt {
  const items: ReceiptItem[] = [];
  if (!text || text.length < 3) {
    return { items, lineSumKc: null, declaredTotalKc: null };
  }

  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const headerLike =
    /^(datum|čas|děkujeme|di[čc]|i[čc]|telefon|www\.|http|email|parkov|provoz|obsazeno|číslo|doklad|účtenka|paragon|pokladna)/i;
  const skipLine =
    /celkem|úhrad|zaplatit|hotov|kartou|vráceno|součet|mezisoučet|^\s*dph|^\s*zdph|^\s*21\s*%|^\s*12\s*%|^\s*0\s*%|^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]{2,4}\s+\d/i;

  const linePrice =
    /^(.{2,72}?)\s+(\d{1,3}(?:[ \u00a0]\d{3})*(?:,\d{1,2})?|\d{1,5},\d{2})\s*(?:Kč|Kc|CZK)?\s*$/i;

  for (const line of lines) {
    if (items.length >= 28) break;
    if (line.length > 88) continue;
    if (headerLike.test(line)) continue;
    if (skipLine.test(line)) continue;

    const m = line.match(linePrice);
    if (!m) continue;

    const label = m[1].trim().replace(/\s+/g, " ");
    const priceRaw = m[2];
    if (label.length < 2) continue;
    if (/^\d+[,.]?\d*\s*[x×]\s*\d/i.test(label)) continue;
    if (/^[\d\s.,]+$/.test(label)) continue;

    const amountKc = parsePriceToken(priceRaw);
    if (amountKc == null || amountKc <= 0 || amountKc > 250_000) continue;

    items.push({ label, amountKc });
  }

  const declaredTotalKc = extractDeclaredTotalKc(lines);

  const lineSumKc = items.length ? items.reduce((s, i) => s + i.amountKc, 0) : null;

  return { items, lineSumKc, declaredTotalKc };
}

/** Nejlepší odhad „konečné“ částky z parseru (deklarované celkem > součet řádků). */
export function bestParsedTotalKc(p: ParsedReceipt): number | null {
  if (p.declaredTotalKc != null) return p.declaredTotalKc;
  if (p.lineSumKc != null) return p.lineSumKc;
  return null;
}

/**
 * Hrubý odhad částky v Kč z textu účtenky/faktury (české formáty).
 * Používá se jen jako návrh — vždy zkontrolujte.
 */
export function suggestAmountKcFromText(text: string): number | null {
  if (!text || text.length < 3) return null;

  const normalized = text.replace(/\u00a0/g, " ");
  for (const line of normalized.split(/\n/)) {
    if (!/celková\s+částka/i.test(line)) continue;
    const m = line.match(
      /(\d{1,3}(?:[ \u00a0]\d{3})*(?:,\d{1,2})?|\d+,\d{2})/g,
    );
    if (!m?.length) continue;
    const lastRaw = m[m.length - 1];
    const n = parseCzechMoneyNumber(lastRaw);
    if (n != null && n > 0 && n < 10_000_000) return n;
  }

  const candidates: number[] = [];

  const withCurrency =
    /(\d{1,3}(?:[ .]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(?:Kč|Kc|CZK)/gi;
  let m: RegExpExecArray | null;
  while ((m = withCurrency.exec(normalized)) !== null) {
    const n = parseCzechMoneyNumber(m[1]);
    if (n != null && n > 0 && n < 10_000_000) candidates.push(n);
  }

  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

function parseCzechMoneyNumber(raw: string): number | null {
  let t = raw.trim().replace(/\s/g, "").replace(/\u00a0/g, "");
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

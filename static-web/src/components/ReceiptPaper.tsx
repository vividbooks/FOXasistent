import { formatKc } from "../lib/money";
import type { ParsedReceipt, ReceiptItem } from "../lib/parse-receipt-from-text";
import { bestParsedTotalKc } from "../lib/parse-receipt-from-text";

type Props = {
  items: ReceiptItem[];
  parsed: ParsedReceipt;
  formAmountKc: string;
  dateLabel: string;
  loading: boolean;
  fileLabel?: string;
};

export function ReceiptPaper({
  items,
  parsed,
  formAmountKc,
  dateLabel,
  loading,
  fileLabel,
}: Props) {
  const formNum = parseInt(formAmountKc, 10);
  const formOk = Number.isFinite(formNum) && formNum > 0;
  const recognized = bestParsedTotalKc(parsed);

  return (
    <div className="relative mx-auto w-full max-w-[340px]">
      <div
        className="pointer-events-none absolute -inset-1 rounded-sm bg-gradient-to-br from-zinc-300/40 to-zinc-400/20 blur-sm"
        aria-hidden
      />
      <div
        className="relative overflow-hidden rounded-sm border border-zinc-400/70 bg-[#f7f4ec] shadow-[0_2px_0_0_rgba(0,0,0,0.06),0_8px_24px_-4px_rgba(0,0,0,0.12)]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(0,0,0,0.04) 23px, rgba(0,0,0,0.04) 24px)",
        }}
      >
        <div
          className="h-2 w-full bg-[repeating-linear-gradient(90deg,transparent,transparent_6px,rgba(0,0,0,0.12)_6px,rgba(0,0,0,0.12)_8px)]"
          aria-hidden
        />

        <div className="px-5 pb-6 pt-4 font-mono text-[13px] leading-snug text-zinc-900">
          <div className="border-b border-dashed border-zinc-400/80 pb-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600">Účtenka</p>
            {fileLabel && (
              <p className="mt-1 truncate text-[10px] text-zinc-500">{fileLabel}</p>
            )}
            <p className="mt-1 text-[11px] text-zinc-600">
              {dateLabel
                ? new Date(dateLabel + "T12:00:00").toLocaleDateString("cs-CZ", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
            </p>
          </div>

          {loading && (
            <p className="mt-4 animate-pulse text-center text-[12px] text-zinc-500">Načítám text…</p>
          )}

          {!loading && items.length === 0 && (
            <p className="mt-4 text-center text-[12px] text-zinc-500">
              Žádné položky se nepodařilo rozpoznat.
              <br />
              <span className="text-[11px]">Zkuste upravit částku vlevo.</span>
            </p>
          )}

          {!loading && items.length > 0 && (
            <ul className="mt-4 space-y-2.5">
              {items.map((row, i) => (
                <li
                  key={i}
                  className="flex gap-2 border-b border-dotted border-zinc-300/90 pb-2 last:border-0"
                >
                  <span className="min-w-0 flex-1 break-words text-zinc-800">{row.label}</span>
                  <span className="shrink-0 tabular-nums text-zinc-900">{formatKc(row.amountKc)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 border-t-2 border-dashed border-zinc-400/90 pt-4">
            <div className="flex items-end justify-between gap-2">
              <span className="text-sm font-bold uppercase tracking-wide text-zinc-800">
                Celkem k úhradě
              </span>
              <span className="text-lg font-bold tabular-nums text-zinc-900">
                {formOk ? formatKc(formNum) : "—"}
              </span>
            </div>
            {!loading && recognized != null && (!formOk || formNum !== recognized) && (
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                Rozpoznáno v dokladu: {formatKc(recognized)}
                {parsed.declaredTotalKc != null && parsed.lineSumKc != null
                  ? ` (řádky: ${formatKc(parsed.lineSumKc)})`
                  : null}
              </p>
            )}
          </div>

          <p className="mt-4 text-center text-[9px] uppercase tracking-wider text-zinc-400">
            Děkujeme za nákup
          </p>
        </div>

        <div
          className="h-2 w-full bg-[repeating-linear-gradient(90deg,transparent,transparent_6px,rgba(0,0,0,0.12)_6px,rgba(0,0,0,0.12)_8px)]"
          aria-hidden
        />
      </div>
    </div>
  );
}

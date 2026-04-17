"use client";

import { ReceiptPaper } from "@/components/receipt-paper";
import {
  bestParsedTotalKc,
  parseReceiptFromText,
} from "@/lib/parse-receipt-from-text";
import { isAllowedReceiptUpload } from "@/lib/receipt-upload-formats";
import { suggestAmountKcFromText } from "@/lib/suggest-amount-from-text";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type FlowMode = "photo" | "upload" | "manual";

function czechPdfStranaWord(n: number): string {
  const z = n % 100;
  if (z >= 11 && z <= 14) return "stran";
  const u = n % 10;
  if (u === 1) return "strana";
  if (u >= 2 && u <= 4) return "strany";
  return "stran";
}

type Props = {
  onSuccess: () => void;
  title?: string;
};

export function FoodExpenseForm({ onSuccess, title = "Náklady na jídlo" }: Props) {
  const inputPhotoRef = useRef<HTMLInputElement>(null);
  const inputUploadRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"pick" | "form">("pick");
  const [mode, setMode] = useState<FlowMode | null>(null);
  const [file, setFile] = useState<File | null>(null);
  /** Pro nahrání: účtenka vs faktura (foto je vždy účtenka) */
  const [docKind, setDocKind] = useState<"RECEIPT" | "INVOICE">("RECEIPT");

  const [amountKc, setAmountKc] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadDragActive, setUploadDragActive] = useState(false);

  const [extractedText, setExtractedText] = useState("");
  /** Počet stran PDF z API (jen informativně). */
  const [extractPdfPages, setExtractPdfPages] = useState<number | null>(null);
  const [extractHint, setExtractHint] = useState<string | null>(null);
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep("pick");
    setMode(null);
    setFile(null);
    setAmountKc("");
    setNote("");
    setDocKind("RECEIPT");
    setError(null);
    setExtractedText("");
    setExtractPdfPages(null);
    setExtractHint(null);
    setExtractError(null);
    setExtractLoading(false);
    if (inputPhotoRef.current) inputPhotoRef.current.value = "";
    if (inputUploadRef.current) inputUploadRef.current.value = "";
    setUploadDragActive(false);
  }, []);

  const openPhoto = () => {
    setError(null);
    inputPhotoRef.current?.click();
  };

  const openUpload = () => {
    setError(null);
    inputUploadRef.current?.click();
  };

  const openManual = () => {
    setError(null);
    setMode("manual");
    setStep("form");
    setFile(null);
  };

  const isAcceptableUpload = useCallback((f: File) => isAllowedReceiptUpload(f), []);

  const onFilePicked = (f: File | null, m: "photo" | "upload") => {
    setError(null);
    if (!f || f.size === 0) return;
    if (f.size > 12 * 1024 * 1024) {
      setError("Soubor je větší než 12 MB.");
      return;
    }
    if (m === "upload" && !isAcceptableUpload(f)) {
      setError("Povolené jsou obrázky (včetně HEIC) nebo PDF.");
      return;
    }
    setMode(m);
    setFile(f);
    setStep("form");
    if (m === "upload") {
      const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      setDocKind(isPdf ? "INVOICE" : "RECEIPT");
    }
  };

  const onUploadDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUploadDragActive(true);
  };

  const onUploadDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = e.relatedTarget as Node | null;
    if (!next || !e.currentTarget.contains(next)) {
      setUploadDragActive(false);
    }
  };

  const onUploadDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const onUploadDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUploadDragActive(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    onFilePicked(f, "upload");
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (mode === "manual") {
        const r = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountKc: parseInt(amountKc, 10),
            date,
            kind: "MANUAL",
            note: note.trim() || null,
          }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? "Uložení se nepovedlo.");
        }
        onSuccess();
        reset();
        return;
      }

      if (!file) {
        setError("Chybí soubor.");
        setSaving(false);
        return;
      }

      const kind = mode === "photo" ? "RECEIPT" : docKind;

      const fd = new FormData();
      fd.set("amountKc", amountKc);
      fd.set("date", date);
      fd.set("kind", kind);
      if (note.trim()) fd.set("note", note.trim());
      fd.set("file", file);

      const r = await fetch("/api/expenses", { method: "POST", body: fd });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Uložení se nepovedlo.");
      }
      onSuccess();
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSaving(false);
    }
  }

  const previewUrl = useMemo(() => {
    if (!file || !file.type.startsWith("image/")) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (step !== "form" || !file || mode === "manual") {
      setExtractedText("");
      setExtractPdfPages(null);
      setExtractHint(null);
      setExtractError(null);
      setExtractLoading(false);
      return;
    }

    const ac = new AbortController();
    setExtractLoading(true);
    setExtractError(null);
    setExtractHint(null);
    setExtractedText("");
    setExtractPdfPages(null);

    const fd = new FormData();
    fd.set("file", file);

    void (async () => {
      try {
        const r = await fetch("/api/extract-document", {
          method: "POST",
          body: fd,
          signal: ac.signal,
        });
        const j = (await r.json()) as {
          text?: string;
          hint?: string;
          error?: string;
          pageCount?: number;
        };
        if (ac.signal.aborted) return;
        if (!r.ok) {
          setExtractError(j.error ?? "Nepodařilo se přečíst dokument.");
          return;
        }
        const text = (j.text ?? "").trim();
        setExtractedText(text);
        setExtractHint(j.hint ?? null);
        setExtractPdfPages(
          typeof j.pageCount === "number" && j.pageCount > 0 ? j.pageCount : null,
        );
      } catch {
        if (ac.signal.aborted) return;
        setExtractError("Chyba při čtení dokumentu.");
      } finally {
        if (!ac.signal.aborted) setExtractLoading(false);
      }
    })();

    return () => ac.abort();
  }, [file, mode, step]);

  const parsedReceipt = useMemo(
    () => parseReceiptFromText(extractedText),
    [extractedText],
  );

  useEffect(() => {
    if (extractLoading || step !== "form" || mode === "manual" || !extractedText) {
      return;
    }
    setAmountKc((prev) => {
      if (prev !== "") return prev;
      const best =
        bestParsedTotalKc(parsedReceipt) ??
        suggestAmountKcFromText(extractedText);
      return best != null ? String(best) : prev;
    });
  }, [extractedText, extractLoading, step, mode, parsedReceipt]);

  function applyRecognizedAmount() {
    const best =
      bestParsedTotalKc(parsedReceipt) ??
      suggestAmountKcFromText(extractedText);
    if (best != null) setAmountKc(String(best));
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow sm:p-6">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Vyberte způsob — pak doplníte částku a datum.
      </p>

      <input
        ref={inputPhotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          onFilePicked(f, "photo");
        }}
      />
      <input
        ref={inputUploadRef}
        type="file"
        accept="image/*,application/pdf,.pdf,.heic,.heif,.avif,.tif,.tiff,.bmp,.jxl"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          onFilePicked(f, "upload");
        }}
      />

      {step === "pick" && (
        <div className="mt-6 flex flex-col gap-4">
          <button
            type="button"
            onClick={openPhoto}
            className="flex min-h-[5.5rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-4 py-5 text-center transition hover:border-emerald-400 hover:bg-emerald-100 active:scale-[0.99]"
          >
            <span className="text-3xl" aria-hidden>
              📷
            </span>
            <span className="text-base font-semibold text-emerald-900">
              Vyfotit účtenku
            </span>
            <span className="text-xs text-emerald-700/80">
              Otevře fotoaparát (mobil)
            </span>
          </button>

          <div
            role="group"
            aria-label="Nahrát soubor kliknutím nebo přetažením"
            onDragEnter={onUploadDragEnter}
            onDragLeave={onUploadDragLeave}
            onDragOver={onUploadDragOver}
            onDrop={onUploadDrop}
            className={`rounded-2xl border-2 border-dashed px-4 py-5 transition-colors ${
              uploadDragActive
                ? "border-sky-500 bg-sky-100 ring-2 ring-sky-400 ring-offset-2"
                : "border-sky-300 bg-sky-50 hover:border-sky-400 hover:bg-sky-100/90"
            }`}
          >
            <button
              type="button"
              onClick={openUpload}
              className="flex min-h-[5rem] w-full flex-col items-center justify-center gap-2 text-center active:scale-[0.99]"
            >
              <span className="text-3xl" aria-hidden>
                📎
              </span>
              <span className="text-base font-semibold text-sky-900">
                Nahrát účtenku nebo fakturu
              </span>
              <span className="text-xs text-sky-800/80">
                Klikněte pro výběr — nebo přetáhněte soubor sem
              </span>
              <span className="text-xs text-sky-700/70">
                Obrázek (JPEG, PNG, HEIC, WebP, AVIF, TIFF…) nebo PDF · max. 12 MB
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={openManual}
            className="flex min-h-[5.5rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-zinc-200 bg-zinc-50 px-4 py-5 text-center transition hover:border-zinc-400 hover:bg-zinc-100 active:scale-[0.99]"
          >
            <span className="text-3xl" aria-hidden>
              ✏️
            </span>
            <span className="text-base font-semibold text-zinc-900">
              Zadat ručně
            </span>
            <span className="text-xs text-zinc-600">
              Bez souboru — jen částka a poznámka
            </span>
          </button>
        </div>
      )}

      {step === "form" && mode && (
        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-700">
              {mode === "manual" && "Ruční zadání"}
              {mode === "photo" && "Foto účtenky"}
              {mode === "upload" && "Nahraný soubor"}
            </p>
            <button
              type="button"
              onClick={reset}
              className="text-sm text-zinc-500 underline"
            >
              Zpět na výběr
            </button>
          </div>

          {mode === "manual" ? (
            <>
              <div>
                <label className="text-sm font-medium text-zinc-700">
                  Částka (Kč) <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-3 text-lg text-zinc-900"
                  value={amountKc}
                  onChange={(e) => setAmountKc(e.target.value)}
                  inputMode="numeric"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-700">
                  Datum <span className="text-red-600">*</span>
                </label>
                <input
                  type="date"
                  required
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-700">
                  Poznámka
                </label>
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="např. Albert, Makro…"
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
              <div className="min-w-0 space-y-4">
                {mode === "upload" && file && (
                  <div>
                    <p className="text-sm font-medium text-zinc-700">
                      Typ dokladu
                    </p>
                    <div
                      role="radiogroup"
                      aria-label="Typ dokladu"
                      className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2"
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={docKind === "RECEIPT"}
                        onClick={() => setDocKind("RECEIPT")}
                        className={`flex min-h-[5.25rem] w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 px-4 py-4 text-center transition hover:brightness-[0.98] active:scale-[0.99] ${
                          docKind === "RECEIPT"
                            ? "border-amber-500 bg-amber-100 ring-2 ring-amber-400 ring-offset-2"
                            : "border-amber-200 bg-amber-50 hover:border-amber-400"
                        }`}
                      >
                        <span className="text-3xl leading-none" aria-hidden>
                          🧾
                        </span>
                        <span className="text-base font-semibold text-amber-950">
                          Účtenka
                        </span>
                        <span className="text-[11px] text-amber-900/75">
                          Paragon, rychlý nákup
                        </span>
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={docKind === "INVOICE"}
                        onClick={() => setDocKind("INVOICE")}
                        className={`flex min-h-[5.25rem] w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 px-4 py-4 text-center transition hover:brightness-[0.98] active:scale-[0.99] ${
                          docKind === "INVOICE"
                            ? "border-violet-500 bg-violet-100 ring-2 ring-violet-400 ring-offset-2"
                            : "border-violet-200 bg-violet-50 hover:border-violet-400"
                        }`}
                      >
                        <span className="text-3xl leading-none" aria-hidden>
                          📄
                        </span>
                        <span className="text-base font-semibold text-violet-950">
                          Faktura
                        </span>
                        <span className="text-[11px] text-violet-900/75">
                          Daňový doklad, PDF
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-zinc-700">
                    Datum nákupu <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-700">
                    Poznámka
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-3 text-zinc-900"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="např. Albert, Makro…"
                  />
                </div>

                <div>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <label className="text-sm font-medium text-zinc-700">
                      Částka k uložení (Kč){" "}
                      <span className="text-red-600">*</span>
                    </label>
                    {(bestParsedTotalKc(parsedReceipt) != null ||
                      suggestAmountKcFromText(extractedText) != null) && (
                      <button
                        type="button"
                        onClick={applyRecognizedAmount}
                        className="text-xs font-medium text-indigo-700 underline"
                      >
                        Doplnit z rozpoznání
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min={1}
                    required
                    className="mt-1 w-full rounded-xl border border-zinc-300 px-4 py-3 text-lg text-zinc-900"
                    value={amountKc}
                    onChange={(e) => setAmountKc(e.target.value)}
                    inputMode="numeric"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-2xl bg-zinc-900 py-4 text-base font-semibold text-white shadow-lg shadow-zinc-900/20 disabled:opacity-50"
                >
                  {saving ? "Ukládám…" : "Uložit náklad"}
                </button>
              </div>

              <div className="flex w-full max-w-[340px] flex-col items-stretch lg:max-w-none lg:items-end">
                <p className="mb-3 w-full max-w-[340px] text-center text-xs font-medium uppercase tracking-wide text-zinc-500 lg:text-right">
                  Náhled účtenky
                </p>
                <ReceiptPaper
                  items={parsedReceipt.items}
                  parsed={parsedReceipt}
                  formAmountKc={amountKc}
                  dateLabel={date}
                  loading={extractLoading}
                  fileLabel={file?.name}
                />
              </div>

              <div className="col-span-1 space-y-4 border-t border-zinc-100 pt-6 lg:col-span-2">
                {file && (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <p className="truncate text-sm text-zinc-700">{file.name}</p>
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt="Náhled"
                        className="mt-2 max-h-40 w-full max-w-md rounded-lg object-contain"
                      />
                    )}
                    {file.type === "application/pdf" ||
                    file.name.toLowerCase().endsWith(".pdf") ? (
                      <p className="mt-2 text-xs text-zinc-500">
                        Soubor PDF
                        {extractPdfPages != null
                          ? ` · ${extractPdfPages} ${czechPdfStranaWord(extractPdfPages)}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                )}

                <details className="rounded-xl border border-zinc-200 bg-zinc-50/90 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-500 marker:content-none">
                    <span className="underline decoration-zinc-300 decoration-dotted underline-offset-2">
                      Rozpoznání dokladu (volitelné)
                    </span>
                  </summary>
                  <div className="border-t border-zinc-200 px-4 pb-4 pt-2">
                    <p className="text-xs text-zinc-500">
                      Položky a částky jsou odhad z OCR — ověřte je na náhledu
                      vpravo.
                    </p>
                    {extractLoading && (
                      <p className="mt-3 text-sm text-zinc-700">
                        Čtu dokument… (OCR může chvíli trvat.)
                      </p>
                    )}
                    {extractError && (
                      <p className="mt-3 text-sm text-red-600" role="alert">
                        {extractError}
                      </p>
                    )}
                    {extractHint && !extractLoading && (
                      <p className="mt-3 text-sm text-amber-900">{extractHint}</p>
                    )}
                    {!extractLoading && extractedText && (
                      <details className="mt-3 rounded-lg border border-zinc-200 bg-white">
                        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-700">
                          Surový text z dokladu
                        </summary>
                        <div className="border-t border-zinc-200 px-3 py-2">
                          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] text-zinc-700">
                            {extractedText}
                          </pre>
                          <button
                            type="button"
                            onClick={() =>
                              void navigator.clipboard.writeText(extractedText)
                            }
                            className="mt-2 text-xs font-medium text-zinc-700 underline"
                          >
                            Zkopírovat
                          </button>
                        </div>
                      </details>
                    )}
                    {!extractLoading &&
                      !extractedText &&
                      !extractError &&
                      !extractHint && (
                        <p className="mt-3 text-sm text-zinc-500">
                          Žádný text nebyl rozpoznán.
                        </p>
                      )}
                  </div>
                </details>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {mode === "manual" && (
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl bg-zinc-900 py-4 text-base font-semibold text-white shadow-lg shadow-zinc-900/20 disabled:opacity-50"
            >
              {saving ? "Ukládám…" : "Uložit náklad"}
            </button>
          )}
        </form>
      )}
    </section>
  );
}

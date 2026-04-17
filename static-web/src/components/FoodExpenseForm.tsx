import { ReceiptPaper } from "./ReceiptPaper";
import {
  bestParsedTotalKc,
  parseReceiptFromText,
} from "../lib/parse-receipt-from-text";
import {
  fallbackReceiptExt,
  isAllowedReceiptUpload,
  receiptExtLower,
} from "../lib/receipt-formats";
import { suggestAmountKcFromText } from "../lib/suggest-amount-from-text";
import type { Session } from "@supabase/supabase-js";
import { useAuth } from "../auth/AuthContext";
import type { ExtractSupabaseOpts } from "../lib/extract-document-client";
import { deriveExpenseTitleFromDocumentText } from "../../../lib/expense-display-title";
import { configuredReceiptBucket } from "../lib/receipt-storage-url";
import { supabase } from "../lib/supabase";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";

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
  appUserId: string;
  onSuccess: () => void;
  title?: string;
};

function geminiSupabaseExtractOpts(session: Session | null): ExtractSupabaseOpts | undefined {
  const on =
    import.meta.env.VITE_USE_GEMINI_EXTRACT === "1" ||
    import.meta.env.VITE_USE_GEMINI_EXTRACT === "true";
  const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!on || !url || !anon || !session?.access_token) return undefined;
  return {
    supabaseUrl: url,
    anonKey: anon,
    accessToken: session.access_token,
  };
}

/** Stejná logika jako u náhledů (výchozí fakturyauctenky). */
const BUCKET = configuredReceiptBucket();

function formatSupabaseError(e: unknown): string {
  if (e == null) return "Neznámá chyba";
  if (typeof e === "object" && "message" in e) {
    const x = e as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [x.message, x.details, x.hint].filter((s) => typeof s === "string" && s.length > 0);
    if (parts.length) return parts.join(" — ");
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

export function FoodExpenseForm({ appUserId, onSuccess, title = "Náklady na jídlo" }: Props) {
  const { session } = useAuth();
  const inputPhotoRef = useRef<HTMLInputElement>(null);
  const inputUploadRef = useRef<HTMLInputElement>(null);
  const saveFeedbackRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<"pick" | "form">("pick");
  const [mode, setMode] = useState<FlowMode | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [docKind, setDocKind] = useState<"RECEIPT" | "INVOICE">("RECEIPT");

  const [amountKc, setAmountKc] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveInfo, setSaveInfo] = useState<string | null>(null);
  const [uploadDragActive, setUploadDragActive] = useState(false);

  const [extractedText, setExtractedText] = useState("");
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
    setSaveInfo(null);
    inputPhotoRef.current?.click();
  };

  const openUpload = () => {
    setError(null);
    setSaveInfo(null);
    inputUploadRef.current?.click();
  };

  const openManual = () => {
    setError(null);
    setSaveInfo(null);
    setMode("manual");
    setStep("form");
    setFile(null);
  };

  const isAcceptableUpload = useCallback((f: File) => isAllowedReceiptUpload(f), []);

  const onFilePicked = (f: File | null, m: "photo" | "upload") => {
    setError(null);
    setSaveInfo(null);
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

  const onUploadDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUploadDragActive(true);
  };

  const onUploadDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = e.relatedTarget as Node | null;
    if (!next || !e.currentTarget.contains(next)) {
      setUploadDragActive(false);
    }
  };

  const onUploadDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const onUploadDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUploadDragActive(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    onFilePicked(f, "upload");
  };

  async function saveExpenseToSupabase(opts: {
    amount: number;
    dateIso: string;
    kind: "MANUAL" | "RECEIPT" | "INVOICE";
    noteTrim: string | null;
    uploadFile: File | null;
  }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const { error: e1 } = await supabase.from("Expense").insert({
      id,
      amountKc: opts.amount,
      date: opts.dateIso,
      note: opts.noteTrim,
      kind: opts.kind,
      createdById: appUserId,
      createdAt: now,
    });
    if (e1) throw new Error(formatSupabaseError(e1));

    const f = opts.uploadFile;
    if (f && f.size > 0) {
      if (f.size > 12 * 1024 * 1024) {
        await supabase.from("Expense").delete().eq("id", id);
        throw new Error("Soubor je větší než 12 MB.");
      }
      if (!isAllowedReceiptUpload(f)) {
        await supabase.from("Expense").delete().eq("id", id);
        throw new Error("Nepodporovaný typ souboru.");
      }
      const ext = fallbackReceiptExt(f.type || "", receiptExtLower(f.name));
      const path = `receipt-${id}${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, f, {
        contentType: f.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) {
        await supabase.from("Expense").delete().eq("id", id);
        throw new Error(formatSupabaseError(upErr) || "Nahrání souboru selhalo.");
      }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error: e2 } = await supabase.from("Expense").update({ receiptUrl: pub.publicUrl }).eq("id", id);
      if (e2) throw new Error(formatSupabaseError(e2));
    }
  }

  useEffect(() => {
    if (!error && !saveInfo) return;
    saveFeedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [error, saveInfo]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaveInfo(null);
    setSaving(true);

    try {
      if (!appUserId?.trim()) {
        throw new Error(
          "Chybí propojení účtu s aplikací. Odhlásit se a znovu přihlásit; když to nepomůže, dej vědět administrátorovi.",
        );
      }

      const dateIso = new Date(date + "T12:00:00").toISOString();
      let noteTrim = note.trim() || null;

      if (mode === "manual") {
        const amount = parseInt(amountKc, 10);
        if (!amount || amount <= 0) throw new Error("Zadej částku v Kč.");
        await saveExpenseToSupabase({
          amount,
          dateIso,
          kind: "MANUAL",
          noteTrim,
          uploadFile: null,
        });
        onSuccess();
        reset();
        setSaveInfo(
          "Uloženo. V seznamu účtenek zvol období (Den / Týden / Měsíc), které obsahuje datum nákupu — jinak záznam v seznamu neuvidíš.",
        );
        return;
      }

      if (!file) {
        setError("Chybí soubor.");
        setSaving(false);
        return;
      }

      const kind = mode === "photo" ? "RECEIPT" : docKind;
      if (!noteTrim && extractedText.trim()) {
        const derived = deriveExpenseTitleFromDocumentText(extractedText, kind);
        if (derived) noteTrim = derived;
      }
      const amount = parseInt(amountKc, 10);
      if (!amount || amount <= 0) throw new Error("Zadej částku v Kč.");

      await saveExpenseToSupabase({
        amount,
        dateIso,
        kind,
        noteTrim,
        uploadFile: file,
      });
      onSuccess();
      reset();
      setSaveInfo(
        `Uloženo. Účtenka a soubor jsou v databázi a úložišti („${BUCKET}“). V seznamu níže nastav období podle data nákupu.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Chyba";
      setError(
        /row-level security|rls|permission denied|policy/i.test(msg)
          ? `${msg} — typicky jde o přihlášení / oprávnění v Supabase nebo politiku u bucketu „${BUCKET}“ (viz supabase/storage-*.sql).`
          : msg,
      );
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

    void (async () => {
      try {
        const { extractDocumentClient } = await import("../lib/extract-document-client");
        if (ac.signal.aborted) return;
        const supabaseExtract = geminiSupabaseExtractOpts(session);
        const j = await extractDocumentClient(file, {
          supabase: supabaseExtract,
          signal: ac.signal,
        });
        if (ac.signal.aborted) return;
        const text = (j.text ?? "").trim();
        setExtractedText(text);
        setExtractHint(j.hint ?? null);
        setExtractPdfPages(
          typeof j.pageCount === "number" && j.pageCount > 0 ? j.pageCount : null,
        );
      } catch (e) {
        if (ac.signal.aborted) return;
        setExtractError(
          e instanceof Error ? e.message : "Čtení dokumentu selhalo. Zkuste jiný soubor nebo menší velikost.",
        );
      } finally {
        if (!ac.signal.aborted) setExtractLoading(false);
      }
    })();

    return () => ac.abort();
  }, [file, mode, step, session?.access_token]);

  const parsedReceipt = useMemo(() => parseReceiptFromText(extractedText), [extractedText]);

  useEffect(() => {
    if (extractLoading || step !== "form" || mode === "manual" || !extractedText) {
      return;
    }
    setAmountKc((prev) => {
      if (prev !== "") return prev;
      const best =
        bestParsedTotalKc(parsedReceipt) ?? suggestAmountKcFromText(extractedText);
      return best != null ? String(best) : prev;
    });
  }, [extractedText, extractLoading, step, mode, parsedReceipt]);

  function applyRecognizedAmount() {
    const best =
      bestParsedTotalKc(parsedReceipt) ?? suggestAmountKcFromText(extractedText);
    if (best != null) setAmountKc(String(best));
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow sm:p-6">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">Vyberte způsob — pak doplníte částku a datum.</p>

      <div ref={saveFeedbackRef} className="mt-4 space-y-2">
        {saveInfo ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {saveInfo}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
      </div>

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
            <span className="text-base font-semibold text-emerald-900">Vyfotit účtenku</span>
            <span className="text-xs text-emerald-700/80">Otevře fotoaparát (mobil)</span>
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
              <span className="text-base font-semibold text-sky-900">Nahrát účtenku nebo fakturu</span>
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
            <span className="text-base font-semibold text-zinc-900">Zadat ručně</span>
            <span className="text-xs text-zinc-600">Bez souboru — jen částka a poznámka</span>
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
            <button type="button" onClick={reset} className="text-sm text-zinc-500 underline">
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
                <label className="text-sm font-medium text-zinc-700">Poznámka</label>
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
                    <p className="text-sm font-medium text-zinc-700">Typ dokladu</p>
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
                        <span className="text-base font-semibold text-amber-950">Účtenka</span>
                        <span className="text-[11px] text-amber-900/75">Paragon, rychlý nákup</span>
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
                        <span className="text-base font-semibold text-violet-950">Faktura</span>
                        <span className="text-[11px] text-violet-900/75">Daňový doklad, PDF</span>
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
                  <label className="text-sm font-medium text-zinc-700">Poznámka</label>
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
                      Částka k uložení (Kč) <span className="text-red-600">*</span>
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
                  hasExtractedText={extractedText.trim().length > 0}
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
                    {file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") ? (
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
                      OCR běží přímo v prohlížeči (GitHub Pages nepotřebuje Vercel). První čtení může stáhnout jazyková data — chvíli to trvá. Po aktualizaci aplikace proveď tvrdé obnovení stránky (Ctrl+Shift+R nebo ⌘+Shift+R), ať se nenačte starý skript z mezipaměti.
                    </p>
                    {extractLoading && (
                      <p className="mt-3 text-sm text-zinc-700">Čtu dokument… (OCR může chvíli trvat.)</p>
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
                            onClick={() => void navigator.clipboard.writeText(extractedText)}
                            className="mt-2 text-xs font-medium text-zinc-700 underline"
                          >
                            Zkopírovat
                          </button>
                        </div>
                      </details>
                    )}
                    {!extractLoading && !extractedText && !extractError && !extractHint && (
                      <p className="mt-3 text-sm text-zinc-500">Žádný text nebyl rozpoznán.</p>
                    )}
                  </div>
                </details>
              </div>
            </div>
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

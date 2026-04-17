import { useCallback, useRef, useState, type FormEvent } from "react";
import {
  fallbackReceiptExt,
  isAllowedReceiptUpload,
  receiptExtLower,
} from "../lib/receipt-formats";
import { supabase } from "../lib/supabase";

type Props = {
  appUserId: string;
  onSuccess: () => void;
  title?: string;
};

const BUCKET = "receipts";

export function FoodExpenseForm({ appUserId, onSuccess, title = "Náklady na jídlo" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [amountKc, setAmountKc] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<"MANUAL" | "RECEIPT" | "INVOICE">("RECEIPT");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetFile = useCallback(() => {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const amount = parseInt(amountKc, 10);
    if (!amount || amount <= 0) {
      setError("Zadej částku v Kč.");
      return;
    }
    const dateIso = new Date(date + "T12:00:00").toISOString();
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const { error: e1 } = await supabase
        .from("Expense")
        .insert({
          id,
          amountKc: amount,
          date: dateIso,
          note: note.trim() || null,
          kind,
          createdById: appUserId,
          createdAt: now,
        })
        .select()
        .single();
      if (e1) throw new Error(e1.message);

      if (file && file.size > 0) {
        if (file.size > 12 * 1024 * 1024) {
          await supabase.from("Expense").delete().eq("id", id);
          throw new Error("Soubor je větší než 12 MB.");
        }
        if (!isAllowedReceiptUpload(file)) {
          await supabase.from("Expense").delete().eq("id", id);
          throw new Error("Povolené jsou obrázky nebo PDF.");
        }
        const ext = fallbackReceiptExt(file.type || "", receiptExtLower(file.name));
        const path = `receipt-${id}${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (upErr) {
          await supabase.from("Expense").delete().eq("id", id);
          throw new Error(upErr.message || "Nahrání souboru selhalo.");
        }
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const { error: e2 } = await supabase
          .from("Expense")
          .update({ receiptUrl: pub.publicUrl })
          .eq("id", id);
        if (e2) throw new Error(e2.message);
      }

      setAmountKc("");
      setNote("");
      resetFile();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow">
      <h2 className="text-lg font-medium text-zinc-900">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Automatické čtení účtenek z PDF zatím jen ve verzi Next.js na serveru — tady zadej částku ručně a případně přilož soubor.
      </p>
      {error ? <p className="mt-3 text-sm text-amber-800">{error}</p> : null}
      <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Částka (Kč) *
            <input
              type="number"
              min={1}
              required
              value={amountKc}
              onChange={(e) => setAmountKc(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Datum *
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2"
            />
          </label>
        </div>
        <label className="text-sm">
          Typ
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2"
          >
            <option value="RECEIPT">Účtenka</option>
            <option value="INVOICE">Faktura</option>
            <option value="MANUAL">Ručně</option>
          </select>
        </label>
        <label className="text-sm">
          Poznámka
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2"
          />
        </label>
        <div>
          <p className="text-sm font-medium text-zinc-800">Příloha (volitelně)</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf,.heic,.heif"
            className="mt-2 block w-full text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <button type="button" onClick={resetFile} className="mt-2 text-sm text-zinc-600 underline">
              Odebrat soubor
            </button>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Ukládám…" : "Uložit"}
        </button>
      </form>
    </section>
  );
}

"use client";

import { formatKc } from "@/lib/money";
import {
  groupExpensesByWeekAndDay,
  type ExpenseListItem,
} from "@/lib/group-expenses-by-calendar";
import { expenseListPrimaryLine } from "@/lib/expense-display-title";
import { normalizeReceiptPublicUrl } from "@/lib/receipt-storage-url";
import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";

function kindLabel(kind: string): string {
  switch (kind) {
    case "RECEIPT":
      return "Účtenka";
    case "INVOICE":
      return "Faktura";
    case "MANUAL":
      return "Ručně";
    default:
      return kind;
  }
}

function ReceiptPreview({ url }: { url: string }) {
  const src = normalizeReceiptPublicUrl(url);
  const isPdf = src.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    return (
      <iframe
        title="Náhled PDF"
        src={src}
        className="mt-3 h-[min(65vh,560px)] w-full rounded-xl border border-zinc-200 bg-zinc-50"
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Příloha k dokladu"
      className="mt-3 max-h-[min(65vh,560px)] w-full rounded-xl border border-zinc-200 object-contain"
    />
  );
}

function ExpenseDetailPanel({ e }: { e: ExpenseListItem }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-zinc-200/80 pb-3">
        <p className="text-xl font-semibold tabular-nums text-zinc-900">
          {formatKc(e.amountKc)}
        </p>
        <p className="text-sm text-zinc-600">
          {new Date(e.date).toLocaleDateString("cs-CZ", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>
      <dl className="grid gap-2 text-sm">
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-zinc-500">Zadal</dt>
          <dd className="font-medium text-zinc-900">
            {e.user.name}{" "}
            <span className="font-normal text-zinc-500">@{e.user.username}</span>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 shrink-0 text-zinc-500">Typ</dt>
          <dd className="text-zinc-900">{kindLabel(e.kind)}</dd>
        </div>
        {e.note ? (
          <div className="flex gap-2">
            <dt className="w-28 shrink-0 text-zinc-500">Poznámka</dt>
            <dd className="text-zinc-900">{e.note}</dd>
          </div>
        ) : null}
      </dl>

      {e.receiptUrl ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Příloha
          </p>
          <ReceiptPreview url={e.receiptUrl} />
          <a
            href={normalizeReceiptPublicUrl(e.receiptUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm font-medium text-sky-700 underline"
          >
            Otevřít v novém okně
          </a>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">Bez přiloženého souboru.</p>
      )}
    </div>
  );
}

type Props = {
  expenses: ExpenseListItem[];
  rangeFromIso: string;
  rangeToIso: string;
  title?: string;
};

export function ExpenseReceiptExplorer({
  expenses,
  rangeFromIso,
  rangeToIso,
  title = "Účtenky a faktury v období",
}: Props) {
  const groups = useMemo(
    () => groupExpensesByWeekAndDay(expenses, rangeFromIso, rangeToIso),
    [expenses, rangeFromIso, rangeToIso],
  );

  const dayRows = useMemo(() => {
    const rows: {
      dayKey: string;
      weekLabel: string;
      dayLabel: string;
      items: ExpenseListItem[];
    }[] = [];
    for (const week of groups) {
      for (const day of week.days) {
        rows.push({
          dayKey: format(day.date, "yyyy-MM-dd"),
          weekLabel: week.label,
          dayLabel: day.dayLabel,
          items: day.items,
        });
      }
    }
    return rows;
  }, [groups]);

  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const first = dayRows[0]?.dayKey ?? null;
    setSelectedDayKey((prev) => {
      if (prev && dayRows.some((r) => r.dayKey === prev)) return prev;
      return first;
    });
  }, [dayRows]);

  const selectedDay = useMemo(
    () => dayRows.find((r) => r.dayKey === selectedDayKey) ?? null,
    [dayRows, selectedDayKey],
  );

  function selectDay(dayKey: string) {
    setSelectedDayKey(dayKey);
    setOpenId(null);
  }

  function toggleRow(id: string) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  if (expenses.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 shadow">
        V tomto období zatím nejsou žádné záznamy.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg">
      <h3 className="border-b border-zinc-100 px-4 py-3 text-sm font-medium text-zinc-900">
        {title}
      </h3>
      <div className="flex max-h-[min(85vh,900px)] min-h-[min(52vh,520px)] flex-col lg:flex-row">
        <aside
          aria-label="Kalendářní dny"
          className="max-h-52 shrink-0 overflow-y-auto border-b border-zinc-200 bg-zinc-50/50 lg:max-h-none lg:w-[min(100%,280px)] lg:border-b-0 lg:border-r"
        >
          <div className="p-2">
            {dayRows.map((row, i) => {
              const showWeek =
                i === 0 || dayRows[i - 1]!.weekLabel !== row.weekLabel;
              const selected = selectedDayKey === row.dayKey;
              return (
                <div key={row.dayKey} className="mb-1">
                  {showWeek ? (
                    <p className="sticky top-0 z-10 bg-zinc-50/95 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 backdrop-blur-sm">
                      Týden {row.weekLabel}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => selectDay(row.dayKey)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      selected
                        ? "bg-zinc-900 text-white shadow-md"
                        : "text-zinc-900 hover:bg-zinc-200/80"
                    }`}
                  >
                    <span className="min-w-0 capitalize">{row.dayLabel}</span>
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs tabular-nums ${
                        selected
                          ? "bg-white/20 text-white"
                          : "bg-zinc-200 text-zinc-700"
                      }`}
                    >
                      {row.items.length}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        <main
          aria-label="Doklady za vybraný den"
          className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3"
        >
          {selectedDay ? (
            <>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                {selectedDay.dayLabel} · {selectedDay.items.length}{" "}
                {selectedDay.items.length === 1
                  ? "položka"
                  : selectedDay.items.length < 5
                    ? "položky"
                    : "položek"}
              </p>
              <ul className="space-y-2">
                {selectedDay.items.map((e) => {
                  const open = openId === e.id;
                  return (
                    <li
                      key={e.id}
                      className="rounded-xl border border-zinc-200 bg-zinc-50/50"
                    >
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => toggleRow(e.id)}
                        className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm transition hover:bg-zinc-100/80"
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-xs text-zinc-500 transition ${
                            open ? "rotate-90" : ""
                          }`}
                          aria-hidden
                        >
                          ▸
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="line-clamp-2 min-w-0 font-medium text-zinc-900">
                              {expenseListPrimaryLine(e)}
                            </span>
                            <span className="shrink-0 tabular-nums font-semibold text-zinc-900">
                              {formatKc(e.amountKc)}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-xs text-zinc-500">
                            {e.user.name} · {kindLabel(e.kind)}
                            {e.receiptUrl ? " · příloha" : ""}
                          </span>
                        </span>
                      </button>
                      {open ? (
                        <div className="border-t border-zinc-200 bg-white px-4 py-4">
                          <ExpenseDetailPanel e={e} />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="text-sm text-zinc-500">Vyberte den vlevo.</p>
          )}
        </main>
      </div>
    </div>
  );
}

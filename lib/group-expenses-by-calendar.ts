import {
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfWeek,
  format,
  isSameDay,
  max,
  min,
  parseISO,
} from "date-fns";
import { cs } from "date-fns/locale";

export type ExpenseListItem = {
  id: string;
  amountKc: number;
  date: string;
  kind: string;
  note: string | null;
  receiptUrl: string | null;
  user: { name: string; username: string };
};

export type WeekGroup = {
  label: string;
  days: {
    date: Date;
    dayLabel: string;
    items: ExpenseListItem[];
  }[];
};

/** Seskupí výdaje podle ISO týdne (pondělí–neděle) a v něm podle kalendářního dne. */
export function groupExpensesByWeekAndDay(
  expenses: ExpenseListItem[],
  rangeFromIso: string,
  rangeToIso: string,
): WeekGroup[] {
  const from = parseISO(rangeFromIso);
  const to = parseISO(rangeToIso);

  const sorted = [...expenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const weekStarts = eachWeekOfInterval(
    { start: from, end: to },
    { weekStartsOn: 1 },
  );

  const out: WeekGroup[] = [];

  for (const weekStart of weekStarts) {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const sliceStart = max([from, weekStart]);
    const sliceEnd = min([to, weekEnd]);
    const daysInRange = eachDayOfInterval({
      start: sliceStart,
      end: sliceEnd,
    });

    const days = daysInRange
      .map((day) => {
        const items = sorted.filter((e) => isSameDay(parseISO(e.date), day));
        return {
          date: day,
          dayLabel: format(day, "EEEE d. M.", { locale: cs }),
          items,
        };
      })
      .filter((d) => d.items.length > 0);

    if (days.length === 0) continue;

    out.push({
      label: `${format(weekStart, "d. M.", { locale: cs })} – ${format(weekEnd, "d. M. yyyy", { locale: cs })}`,
      days,
    });
  }

  return out;
}

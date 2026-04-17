import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
export type Period = "day" | "week" | "month";

export function getRange(period: Period, ref: Date = new Date()) {
  switch (period) {
    case "day":
      return { from: startOfDay(ref), to: endOfDay(ref) };
    case "week":
      return {
        from: startOfWeek(ref, { weekStartsOn: 1 }),
        to: endOfWeek(ref, { weekStartsOn: 1 }),
      };
    case "month":
      return { from: startOfMonth(ref), to: endOfMonth(ref) };
    default:
      return { from: startOfDay(ref), to: endOfDay(ref) };
  }
}

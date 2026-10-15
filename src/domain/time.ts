export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const hourFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric" });
const weekdayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });

/** "9:40 AM" */
export function formatTime(ms: number): string {
  return timeFmt.format(ms);
}

/** "6 AM" */
export function formatHour(ms: number): string {
  return hourFmt.format(ms);
}

/** "Thu" */
export function formatWeekday(ms: number): string {
  return weekdayFmt.format(ms);
}

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "Today", "Yesterday", or "Mon, Oct 12" */
export function dayLabel(ms: number, nowMs: number): string {
  const today = startOfDay(nowMs);
  const day = startOfDay(ms);
  if (day === today) return "Today";
  // Compare calendar days rather than subtracting 24 h, so DST shifts don't matter.
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === yesterday.getTime()) return "Yesterday";
  return dayFmt.format(ms);
}

/** "9:40 AM", prefixed with the day when it isn't today. */
export function formatWhen(ms: number, nowMs: number): string {
  const label = dayLabel(ms, nowMs);
  return label === "Today" ? formatTime(ms) : `${label}, ${formatTime(ms)}`;
}

/** "12 min ago", "2 h 5 min ago" */
export function formatAgo(ms: number, nowMs: number): string {
  const mins = Math.round((nowMs - ms) / MINUTE);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h ago` : `${h} h ${m} min ago`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Value for <input type="datetime-local">, in local time. */
export function toLocalInputValue(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse an <input type="datetime-local"> value (local time). */
export function fromLocalInputValue(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(y, mo - 1, d, h, mi).getTime();
}

/** "5 h", "4.5 h" */
export function formatHours(h: number): string {
  return Number.isInteger(h) ? `${h} h` : `${h.toFixed(1)} h`;
}

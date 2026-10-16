// Numbers for the Insights tab: per-day totals, bedtime levels and patterns
// over the last week or month.

import { levelAt } from "./caffeine";
import { drinkById, type Drink } from "./drinks";
import { bedtimeEndingDay } from "./sleep";
import { startOfDay } from "./time";
import type { Entry, Settings } from "./types";

export interface DayStat {
  /** Local midnight that starts the day. */
  day: number;
  totalMg: number;
  drinks: number;
  /** Modelled level at that night's bedtime; null until that bedtime has passed. */
  bedtimeMg: number | null;
}

export interface DrinkTotal {
  drink: Drink;
  mg: number;
  count: number;
}

export interface Insights {
  days: DayStat[];
  /** Average over complete days (today is left out unless it's the only day). */
  averageMg: number;
  averageOver: number;
  busiest: DayStat | null;
  nightsUnder: number;
  nightsCounted: number;
  /** Median time of the first and last drink on days with any, minutes after midnight. */
  firstCupMinutes: number | null;
  lastCupMinutes: number | null;
  byDrink: DrinkTotal[];
  /** True when the log doesn't go back as far as the range asked for. */
  clipped: boolean;
}

export function computeInsights(
  entries: readonly Entry[],
  nowMs: number,
  rangeDays: number,
  settings: Settings,
): Insights {
  const today = startOfDay(nowMs);
  const first = entries.reduce((m, e) => Math.min(m, e.at), Infinity);
  const firstDay = Number.isFinite(first) ? startOfDay(first) : today;

  // Calendar days, oldest first, starting no earlier than the first entry.
  const days: number[] = [];
  const d = new Date(today);
  for (let i = 0; i < rangeDays; i++) {
    if (d.getTime() < firstDay) break;
    days.unshift(d.getTime());
    d.setDate(d.getDate() - 1);
  }
  const clipped = days.length < rangeDays;

  const byDay = new Map<number, Entry[]>(days.map((day) => [day, []]));
  for (const e of entries) {
    if (e.at > nowMs) continue;
    byDay.get(startOfDay(e.at))?.push(e);
  }

  const stats: DayStat[] = days.map((day) => {
    const list = byDay.get(day) ?? [];
    const bed = bedtimeEndingDay(day, settings.bedtimeMinutes);
    return {
      day,
      totalMg: list.reduce((sum, e) => sum + e.mg, 0),
      drinks: list.length,
      bedtimeMg: bed <= nowMs ? levelAt(entries, bed, settings.halfLifeHours) : null,
    };
  });

  const complete = stats.length > 1 ? stats.filter((s) => s.day !== today) : stats;
  const averageMg = complete.length ? complete.reduce((sum, s) => sum + s.totalMg, 0) / complete.length : 0;
  const busiest = stats.reduce<DayStat | null>((b, s) => (s.totalMg > (b?.totalMg ?? 0) ? s : b), null);

  const nights = stats.filter((s) => s.bedtimeMg !== null);
  const nightsUnder = nights.filter((s) => (s.bedtimeMg ?? 0) <= settings.sleepTargetMg).length;

  const firsts: number[] = [];
  const lasts: number[] = [];
  for (const day of days) {
    const list = byDay.get(day) ?? [];
    if (!list.length) continue;
    const mins = list.map((e) => minutesOfDay(e.at));
    firsts.push(Math.min(...mins));
    lasts.push(Math.max(...mins));
  }

  const totals = new Map<string, DrinkTotal>();
  for (const day of days) {
    for (const e of byDay.get(day) ?? []) {
      const drink = drinkById(e.drink);
      const t = totals.get(drink.id) ?? { drink, mg: 0, count: 0 };
      t.mg += e.mg;
      t.count += 1;
      totals.set(drink.id, t);
    }
  }

  return {
    days: stats,
    averageMg,
    averageOver: complete.length,
    busiest: busiest && busiest.totalMg > 0 ? busiest : null,
    nightsUnder,
    nightsCounted: nights.length,
    firstCupMinutes: median(firsts),
    lastCupMinutes: median(lasts),
    byDrink: [...totals.values()].sort((a, b) => b.mg - a.mg),
    clipped,
  };
}

function minutesOfDay(ms: number): number {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

// Bedtime projection and "last call": what the model says about tonight.

import { amountFromDose, hoursToPeak, levelAt } from "./caffeine";
import { DRINKS, drinkById, effectiveMg, type Drink } from "./drinks";
import { DAY, HOUR, MINUTE } from "./time";
import type { Entry, Settings } from "./types";

/** For this long after bedtime, "tonight" still means the night that just started. */
const PAST_BEDTIME_WINDOW = 4 * HOUR;

/** The local time `minutes` after midnight on the day of `dayMs`. */
function atMinutes(dayMs: number, minutes: number): number {
  const d = new Date(dayMs);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.getTime();
}

export interface Bedtime {
  /** Tonight's bedtime (epoch ms). */
  at: number;
  /** True for a few hours after bedtime has passed. */
  past: boolean;
}

/** The bedtime "tonight" refers to: the next one, or the one that just passed. */
export function tonightsBedtime(nowMs: number, bedtimeMinutes: number): Bedtime {
  let at = atMinutes(nowMs, bedtimeMinutes);
  // Calendar arithmetic (not ± 24 h) so DST changes don't shift it.
  if (at <= nowMs - PAST_BEDTIME_WINDOW) {
    const d = new Date(at);
    d.setDate(d.getDate() + 1);
    at = d.getTime();
  } else if (at - nowMs > DAY - PAST_BEDTIME_WINDOW) {
    // e.g. a 12:30 AM bedtime checked at 1 AM: that bedtime was last night's.
    const d = new Date(at);
    d.setDate(d.getDate() - 1);
    at = d.getTime();
  }
  return { at, past: at <= nowMs };
}

/**
 * The bedtime that ends the day starting at `dayMs`. A bedtime in the small
 * hours (before 6 AM) belongs to the evening before, so it falls on the next
 * calendar day.
 */
export function bedtimeEndingDay(dayMs: number, bedtimeMinutes: number): number {
  const at = new Date(atMinutes(dayMs, bedtimeMinutes));
  if (bedtimeMinutes < 6 * 60) at.setDate(at.getDate() + 1);
  return at.getTime();
}

/** Every bedtime between two moments (for marking them on the chart). */
export function bedtimesBetween(startMs: number, endMs: number, bedtimeMinutes: number): number[] {
  const out: number[] = [];
  const d = new Date(atMinutes(startMs, bedtimeMinutes));
  if (d.getTime() < startMs) d.setDate(d.getDate() + 1);
  while (d.getTime() <= endMs) {
    out.push(d.getTime());
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/**
 * The drink "last call" is about: whatever you've logged most in the last two
 * weeks, at your usual amount. Pour-over until there's a history.
 */
export function usualDrink(entries: readonly Entry[], nowMs: number, settings: Settings): Drink {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (e.at < nowMs - 14 * DAY || e.at > nowMs) continue;
    counts.set(e.drink, (counts.get(e.drink) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [id, n] of counts) if (best === null || n > (counts.get(best) ?? 0)) best = id;
  const drink = best ? drinkById(best) : (DRINKS.find((d) => d.id === "pour-over") ?? DRINKS[0]);
  return { ...drink, mg: effectiveMg(drink, settings.drinkDefaults) };
}

export type LastCall =
  /** Have it by `at` to stay under the target. */
  | { kind: "by"; at: number }
  /** That time has gone for tonight. */
  | { kind: "passed"; at: number }
  /** Even with nothing more you'll be over the target at bedtime. */
  | { kind: "over" }
  /** Small enough that even right before bed keeps you under. */
  | { kind: "anytime" };

/**
 * The latest moment you could take `doseMg` and still be at or under
 * `targetMg` at `bedtimeMs`, given what's already logged.
 */
export function lastCall(
  entries: readonly Entry[],
  nowMs: number,
  bedtimeMs: number,
  doseMg: number,
  targetMg: number,
  halfLifeHours: number,
): LastCall {
  const budget = targetMg - levelAt(entries, bedtimeMs, halfLifeHours);
  if (budget <= 0) return { kind: "over" };

  // After its peak a single dose only falls, so search that stretch for the
  // shortest gap before bed at which it's down to the budget.
  const peak = hoursToPeak(halfLifeHours);
  if (amountFromDose(doseMg, peak, halfLifeHours) <= budget) return { kind: "anytime" };
  let lo = peak;
  let hi = 72;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (amountFromDose(doseMg, mid, halfLifeHours) <= budget) hi = mid;
    else lo = mid;
  }
  // Round down to 5 minutes so the advice errs on the safe side.
  const at = Math.floor((bedtimeMs - hi * HOUR) / (5 * MINUTE)) * 5 * MINUTE;
  return at < nowMs ? { kind: "passed", at } : { kind: "by", at };
}

// Caffeine pharmacokinetics — a one-compartment model with first-order
// absorption and first-order elimination (the Bateman function).
//
// A dose D taken at t = 0 leaves this much caffeine in circulation at time t:
//
//   A(t) = D · ka / (ka − ke) · (e^(−ke·t) − e^(−ka·t))
//
// ke = ln 2 / half-life  — how fast the body clears it (default half-life 5 h)
// ka                     — how fast the gut absorbs it. Caffeine is absorbed
//                          quickly and peaks in the blood ~45 min after
//                          drinking; ka = 5 / h puts the peak there for a
//                          typical 5 h half-life.
//
// Doses are additive, so the level at any moment is the sum over all entries.
// This is a population-average estimate, not a measurement.

import type { Entry } from "./types";

const HOUR = 3_600_000;

export const DEFAULT_HALF_LIFE_HOURS = 5;
export const MIN_HALF_LIFE_HOURS = 2;
export const MAX_HALF_LIFE_HOURS = 10;

/** First-order absorption rate constant, per hour. */
export const ABSORPTION_RATE_PER_HOUR = 5;

/** Common guidance for healthy adults (FDA): up to ~400 mg a day. */
export const DAILY_GUIDANCE_MG = 400;

/** Caffeine (mg) in circulation `hoursSince` hours after taking `doseMg`. */
export function amountFromDose(doseMg: number, hoursSince: number, halfLifeHours: number): number {
  if (hoursSince <= 0 || doseMg <= 0) return 0;
  const ke = Math.LN2 / halfLifeHours;
  const ka = ABSORPTION_RATE_PER_HOUR;
  if (Math.abs(ka - ke) < 1e-9) {
    // Limit of the Bateman function when ka → ke.
    return doseMg * ke * hoursSince * Math.exp(-ke * hoursSince);
  }
  return (doseMg * ka) / (ka - ke) * (Math.exp(-ke * hoursSince) - Math.exp(-ka * hoursSince));
}

/** One entry's contribution at `timeMs`. */
export function entryAmountAt(entry: Entry, timeMs: number, halfLifeHours: number): number {
  return amountFromDose(entry.mg, (timeMs - entry.at) / HOUR, halfLifeHours);
}

/** Total caffeine (mg) in circulation at `timeMs`. */
export function levelAt(entries: readonly Entry[], timeMs: number, halfLifeHours: number): number {
  let total = 0;
  for (const e of entries) total += entryAmountAt(e, timeMs, halfLifeHours);
  return total;
}

/** Hours after a single dose at which its level peaks. */
export function hoursToPeak(halfLifeHours: number): number {
  const ke = Math.LN2 / halfLifeHours;
  const ka = ABSORPTION_RATE_PER_HOUR;
  return Math.log(ka / ke) / (ka - ke);
}

export interface Point {
  t: number;
  mg: number;
}

/** Sample the level from `startMs` to `endMs` (inclusive) every `stepMs`. */
export function sampleLevels(
  entries: readonly Entry[],
  startMs: number,
  endMs: number,
  stepMs: number,
  halfLifeHours: number,
): Point[] {
  const points: Point[] = [];
  for (let t = startMs; t <= endMs; t += stepMs) {
    points.push({ t, mg: levelAt(entries, t, halfLifeHours) });
  }
  return points;
}

export type Trend = "rising" | "falling" | "flat";

export interface Outlook {
  trend: Trend;
  /** When the current rise tops out (only while rising). */
  peak: Point | null;
}

/**
 * Is the level going up or down right now, and if up, where does it top out?
 * Scans forward minute by minute — cheap for a handful of entries.
 */
export function outlook(entries: readonly Entry[], nowMs: number, halfLifeHours: number): Outlook {
  const MINUTE = 60_000;
  const now = levelAt(entries, nowMs, halfLifeHours);
  const next = levelAt(entries, nowMs + MINUTE, halfLifeHours);
  if (now < 0.5 && next < 0.5) return { trend: "flat", peak: null };
  if (next <= now) return { trend: "falling", peak: null };

  let best: Point = { t: nowMs + MINUTE, mg: next };
  for (let t = nowMs + 2 * MINUTE; t <= nowMs + 6 * HOUR; t += MINUTE) {
    const mg = levelAt(entries, t, halfLifeHours);
    if (mg < best.mg) break;
    best = { t, mg };
  }
  return { trend: "rising", peak: best };
}

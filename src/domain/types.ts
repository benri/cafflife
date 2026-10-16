import type { DrinkId } from "./drinks";

/** One logged drink. */
export interface Entry {
  id: string;
  drink: DrinkId;
  /** Caffeine actually consumed, after any adjustment / half-caf. */
  mg: number;
  halfCaf: boolean;
  /** When it was drunk (epoch ms). */
  at: number;
}

export interface Settings {
  halfLifeHours: number;
  /** Usual bedtime, minutes after local midnight (e.g. 22:30 → 1350). */
  bedtimeMinutes: number;
  /** The most caffeine (mg) you want left in your system at bedtime. */
  sleepTargetMg: number;
  /** Your own default amount per drink, replacing the built-in one. */
  drinkDefaults: Partial<Record<DrinkId, number>>;
}

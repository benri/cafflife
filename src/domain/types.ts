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
}

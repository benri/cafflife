// Starting points for each drink. Real caffeine content varies a lot with
// the bean or leaf, dose, grind and steep time, so every value is adjustable
// before an entry is saved.
//
// Sources for the typical values: Mayo Clinic / USDA FoodData Central
// (8 oz brewed coffee ≈ 96 mg, 1 oz espresso ≈ 64 mg, 8 oz black tea ≈ 47 mg,
// 8 oz green tea ≈ 28 mg). Pour-over and AeroPress are scaled from those to
// a typical home recipe (≈ 20 g / 12 oz and ≈ 15 g respectively). Instant
// coffee: ≈ 62 mg for an 8 oz cup (USDA), so check your jar or packet. Milk
// tea (including bubble tea) is usually strong black tea, but shops vary a
// lot — roughly 30 to 150+ mg for 16 oz — so 80 mg is a middle starting point.
//
// `range` is the rough spread you'd see across brands, cafés and recipes for
// the same serving, shown next to the default so it's clear how much it varies.

export type BuiltInDrinkId =
  | "green-tea"
  | "black-tea"
  | "milk-tea"
  | "pour-over"
  | "aeropress"
  | "instant"
  | "espresso-single"
  | "espresso-double";

/** Built-in drinks, plus the ones you add yourself (`custom-…`). */
export type DrinkId = BuiltInDrinkId | `custom-${string}`;

export type DrinkIcon =
  | "tea"
  | "milktea"
  | "pourover"
  | "aeropress"
  | "instant"
  | "espresso"
  | "doppio"
  | "mug"
  | "iced"
  | "can"
  | "bottle"
  | "bolt"
  | "bowl";

/** Icons offered when you add your own drink. */
export const CUSTOM_ICONS: readonly DrinkIcon[] = ["mug", "iced", "can", "bottle", "bolt", "bowl", "tea", "espresso"];
export const MAX_CUSTOM_DRINKS = 30;
export const MAX_DRINK_NAME = 24;
export const MAX_SERVING = 30;

export interface Drink {
  id: DrinkId;
  name: string;
  /** What the default amount assumes. */
  serving: string;
  mg: number;
  /** Typical low–high caffeine for the serving (built-in drinks only). */
  range?: readonly [number, number];
  /** Coffee can be made with half-caf beans; tea can't. */
  coffee: boolean;
  icon: DrinkIcon;
  /** One you added yourself. */
  custom?: boolean;
  /** Deleted, but kept so older entries still show its name and icon. */
  hidden?: boolean;
}

export const DRINKS: readonly Drink[] = [
  { id: "green-tea", name: "Green tea", serving: "8 oz cup", mg: 30, range: [20, 45], coffee: false, icon: "tea" },
  { id: "black-tea", name: "Black tea", serving: "8 oz cup", mg: 47, range: [40, 70], coffee: false, icon: "tea" },
  { id: "milk-tea", name: "Milk tea", serving: "16 oz cup", mg: 80, range: [30, 150], coffee: false, icon: "milktea" },
  { id: "pour-over", name: "Pour-over", serving: "12 oz cup", mg: 145, range: [100, 200], coffee: true, icon: "pourover" },
  { id: "aeropress", name: "AeroPress", serving: "15 g dose", mg: 110, range: [80, 150], coffee: true, icon: "aeropress" },
  { id: "instant", name: "Instant coffee", serving: "8 oz cup", mg: 60, range: [30, 90], coffee: true, icon: "instant" },
  { id: "espresso-single", name: "Espresso", serving: "single shot", mg: 64, range: [50, 80], coffee: true, icon: "espresso" },
  { id: "espresso-double", name: "Double espresso", serving: "double shot", mg: 128, range: [100, 160], coffee: true, icon: "doppio" },
];

export const BUILT_IN_IDS: ReadonlySet<string> = new Set(DRINKS.map((d) => d.id));

export function isCustomId(id: string): id is `custom-${string}` {
  return id.startsWith("custom-");
}

// Lookup for every drink, built-in and your own. The store keeps the custom
// part current, so history, the chart and Insights can resolve any entry.
let byId = new Map<string, Drink>(DRINKS.map((d) => [d.id, d]));

export function registerCustomDrinks(custom: readonly Drink[]) {
  byId = new Map<string, Drink>([...DRINKS, ...custom].map((d) => [d.id, d]));
}

/** A drink's default amount: your own if you've saved one, else the built-in. */
export function effectiveMg(drink: Drink, defaults: Partial<Record<DrinkId, number>>): number {
  return defaults[drink.id] ?? drink.mg;
}

/**
 * "typically 80 mg (30–150)", or just "typically 80 mg" without a range. A
 * no-break space and word joiners keep "80 mg" and "(30–150)" from wrapping
 * apart (browsers otherwise allow a line break after the dash).
 */
export function typicalText(drink: Drink): string {
  const mg = `${drink.mg}\u00a0mg`;
  return drink.range ? `typically ${mg} (${drink.range[0]}\u2060–\u2060${drink.range[1]})` : `typically ${mg}`;
}

export function drinkById(id: string): Drink {
  return byId.get(id) ?? { id: id as DrinkId, name: "Drink", serving: "", mg: 0, coffee: false, icon: "mug" };
}

// Starting points for each drink. Real caffeine content varies a lot with
// the bean or leaf, dose, grind and steep time, so every value is adjustable
// before an entry is saved.
//
// Sources for the typical values: Mayo Clinic / USDA FoodData Central
// (8 oz brewed coffee ≈ 96 mg, 1 oz espresso ≈ 64 mg, 8 oz black tea ≈ 47 mg,
// 8 oz green tea ≈ 28 mg). Pour-over and AeroPress are scaled from those to
// a typical home recipe (≈ 20 g / 12 oz and ≈ 15 g respectively). Instant
// coffee: ≈ 62 mg for an 8 oz cup (USDA), so check your jar or packet.

export type BuiltInDrinkId =
  | "green-tea"
  | "black-tea"
  | "pour-over"
  | "aeropress"
  | "instant"
  | "espresso-single"
  | "espresso-double";

/** Built-in drinks, plus the ones you add yourself (`custom-…`). */
export type DrinkId = BuiltInDrinkId | `custom-${string}`;

export type DrinkIcon =
  | "tea"
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
  /** Coffee can be made with half-caf beans; tea can't. */
  coffee: boolean;
  icon: DrinkIcon;
  /** One you added yourself. */
  custom?: boolean;
  /** Deleted, but kept so older entries still show its name and icon. */
  hidden?: boolean;
}

export const DRINKS: readonly Drink[] = [
  { id: "green-tea", name: "Green tea", serving: "8 oz cup", mg: 30, coffee: false, icon: "tea" },
  { id: "black-tea", name: "Black tea", serving: "8 oz cup", mg: 47, coffee: false, icon: "tea" },
  { id: "pour-over", name: "Pour-over", serving: "12 oz cup", mg: 145, coffee: true, icon: "pourover" },
  { id: "aeropress", name: "AeroPress", serving: "15 g dose", mg: 110, coffee: true, icon: "aeropress" },
  { id: "instant", name: "Instant coffee", serving: "8 oz cup", mg: 60, coffee: true, icon: "instant" },
  { id: "espresso-single", name: "Espresso", serving: "single shot", mg: 64, coffee: true, icon: "espresso" },
  { id: "espresso-double", name: "Double espresso", serving: "double shot", mg: 128, coffee: true, icon: "doppio" },
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

export function drinkById(id: string): Drink {
  return byId.get(id) ?? { id: id as DrinkId, name: "Drink", serving: "", mg: 0, coffee: false, icon: "mug" };
}

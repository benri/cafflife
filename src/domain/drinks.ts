// Starting points for each drink. Real caffeine content varies a lot with
// the bean or leaf, dose, grind and steep time, so every value is adjustable
// before an entry is saved.
//
// Sources for the typical values: Mayo Clinic / USDA FoodData Central
// (8 oz brewed coffee ≈ 96 mg, 1 oz espresso ≈ 64 mg, 8 oz black tea ≈ 47 mg,
// 8 oz green tea ≈ 28 mg). Pour-over and AeroPress are scaled from those to
// a typical home recipe (≈ 20 g / 12 oz and ≈ 15 g respectively).

export type DrinkId =
  | "green-tea"
  | "black-tea"
  | "pour-over"
  | "aeropress"
  | "espresso-single"
  | "espresso-double";

export type DrinkIcon = "tea" | "pourover" | "aeropress" | "espresso" | "doppio";

export interface Drink {
  id: DrinkId;
  name: string;
  /** What the default amount assumes. */
  serving: string;
  mg: number;
  /** Coffee can be made with half-caf beans; tea can't. */
  coffee: boolean;
  icon: DrinkIcon;
}

export const DRINKS: readonly Drink[] = [
  { id: "green-tea", name: "Green tea", serving: "8 oz cup", mg: 30, coffee: false, icon: "tea" },
  { id: "black-tea", name: "Black tea", serving: "8 oz cup", mg: 47, coffee: false, icon: "tea" },
  { id: "pour-over", name: "Pour-over", serving: "12 oz cup", mg: 145, coffee: true, icon: "pourover" },
  { id: "aeropress", name: "AeroPress", serving: "15 g dose", mg: 110, coffee: true, icon: "aeropress" },
  { id: "espresso-single", name: "Espresso", serving: "single shot", mg: 64, coffee: true, icon: "espresso" },
  { id: "espresso-double", name: "Double espresso", serving: "double shot", mg: 128, coffee: true, icon: "doppio" },
];

const BY_ID = new Map<string, Drink>(DRINKS.map((d) => [d.id, d]));

export function drinkById(id: string): Drink {
  return BY_ID.get(id) ?? { id: id as DrinkId, name: "Drink", serving: "", mg: 0, coffee: false, icon: "tea" };
}

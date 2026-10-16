// All data lives in this browser's localStorage — GitHub Pages is static, so
// there is no server. Each device keeps its own log.

import { useSyncExternalStore } from "react";
import {
  DEFAULT_BEDTIME_MINUTES,
  DEFAULT_HALF_LIFE_HOURS,
  DEFAULT_SLEEP_TARGET_MG,
  MAX_HALF_LIFE_HOURS,
  MAX_SLEEP_TARGET_MG,
  MIN_HALF_LIFE_HOURS,
} from "../domain/caffeine";
import {
  BUILT_IN_IDS,
  CUSTOM_ICONS,
  drinkById,
  isCustomId,
  MAX_CUSTOM_DRINKS,
  MAX_DRINK_NAME,
  MAX_SERVING,
  registerCustomDrinks,
  type Drink,
  type DrinkIcon,
  type DrinkId,
} from "../domain/drinks";
import type { Entry, Settings } from "../domain/types";

const KEY = "cafflife:v1";

export interface State {
  entries: Entry[];
  settings: Settings;
  /** Drinks you added yourself, including deleted ones that history still uses. */
  customDrinks: Drink[];
}

const DEFAULT_SETTINGS: Settings = {
  halfLifeHours: DEFAULT_HALF_LIFE_HOURS,
  bedtimeMinutes: DEFAULT_BEDTIME_MINUTES,
  sleepTargetMg: DEFAULT_SLEEP_TARGET_MG,
  drinkDefaults: {},
};
const EMPTY: State = { entries: [], settings: DEFAULT_SETTINGS, customDrinks: [] };
/** The most caffeine one drink can have, matching the log sheet. */
export const MAX_DRINK_MG = 1000;
const ICONS = new Set<string>(CUSTOM_ICONS);

function clampHalfLife(h: unknown): number {
  const n = typeof h === "number" && Number.isFinite(h) ? h : DEFAULT_HALF_LIFE_HOURS;
  return Math.min(MAX_HALF_LIFE_HOURS, Math.max(MIN_HALF_LIFE_HOURS, n));
}

function num(x: unknown, fallback: number, lo: number, hi: number): number {
  const n = typeof x === "number" && Number.isFinite(x) ? x : fallback;
  return Math.min(hi, Math.max(lo, n));
}

function parseSettings(raw: unknown): Settings {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Settings, unknown>>;
  const drinkDefaults: Settings["drinkDefaults"] = {};
  if (s.drinkDefaults && typeof s.drinkDefaults === "object") {
    for (const [id, mg] of Object.entries(s.drinkDefaults)) {
      // Only built-ins: a custom drink's amount is part of the drink itself.
      if (BUILT_IN_IDS.has(id) && typeof mg === "number" && Number.isFinite(mg)) {
        drinkDefaults[id as DrinkId] = Math.round(num(mg, 0, 0, MAX_DRINK_MG));
      }
    }
  }
  return {
    halfLifeHours: clampHalfLife(s.halfLifeHours),
    bedtimeMinutes: Math.round(num(s.bedtimeMinutes, DEFAULT_BEDTIME_MINUTES, 0, 24 * 60 - 1)),
    sleepTargetMg: Math.round(num(s.sleepTargetMg, DEFAULT_SLEEP_TARGET_MG, 0, MAX_SLEEP_TARGET_MG)),
    drinkDefaults,
  };
}

function parseCustomDrinks(raw: unknown): Drink[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Drink[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const d = x as Record<string, unknown>;
    const id = typeof d.id === "string" ? d.id : "";
    const name = typeof d.name === "string" ? d.name.trim().slice(0, MAX_DRINK_NAME) : "";
    if (!isCustomId(id) || seen.has(id) || !name) continue;
    seen.add(id);
    out.push({
      id,
      name,
      serving: typeof d.serving === "string" ? d.serving.trim().slice(0, MAX_SERVING) : "",
      mg: Math.round(num(d.mg, 0, 0, MAX_DRINK_MG)),
      coffee: d.coffee === true,
      icon: typeof d.icon === "string" && ICONS.has(d.icon) ? (d.icon as DrinkIcon) : "mug",
      custom: true,
      ...(d.hidden === true ? { hidden: true } : {}),
    });
  }
  return out.slice(0, 200);
}

function isEntry(x: unknown, drinkIds: ReadonlySet<string>): x is Entry {
  if (!x || typeof x !== "object") return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.drink === "string" &&
    drinkIds.has(e.drink) &&
    typeof e.mg === "number" &&
    Number.isFinite(e.mg) &&
    e.mg >= 0 &&
    typeof e.at === "number" &&
    Number.isFinite(e.at)
  );
}

/** Check and clean stored or restored data. Anything unreadable is dropped. */
function parseState(data: unknown): State {
  if (!data || typeof data !== "object") return EMPTY;
  const d = data as Partial<Record<keyof State, unknown>>;
  const customDrinks = parseCustomDrinks(d.customDrinks);
  const ids = new Set<string>([...BUILT_IN_IDS, ...customDrinks.map((c) => c.id)]);
  const entries = Array.isArray(d.entries)
    ? d.entries
        .filter((e): e is Entry => isEntry(e, ids))
        .map((e) => ({ id: e.id, drink: e.drink, mg: e.mg, halfCaf: Boolean(e.halfCaf), at: e.at }))
    : [];
  return { entries: sortEntries(entries), settings: parseSettings(d.settings), customDrinks };
}

function parse(raw: string | null): State {
  if (!raw) return EMPTY;
  try {
    return parseState(JSON.parse(raw));
  } catch {
    return EMPTY;
  }
}

function read(): State {
  try {
    return parse(localStorage.getItem(KEY));
  } catch {
    return EMPTY;
  }
}

/** Newest first. */
function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => b.at - a.at);
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

let state: State = read();
registerCustomDrinks(state.customDrinks);
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function commit(next: State) {
  state = next;
  registerCustomDrinks(state.customDrinks);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked (private mode) — keep working in memory.
  }
  emit();
}

let askedToPersist = false;
function askToPersist() {
  // Ask the browser not to evict our data under storage pressure.
  if (askedToPersist) return;
  askedToPersist = true;
  navigator.storage?.persist?.().catch(() => {});
}

// Keep several open tabs in sync.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    state = parse(e.newValue);
    registerCustomDrinks(state.customDrinks);
    emit();
  });
}

export interface NewEntry {
  drink: DrinkId;
  mg: number;
  halfCaf: boolean;
  at: number;
}

/** What the drink editor collects. */
export interface DrinkInput {
  name: string;
  serving: string;
  mg: number;
  coffee: boolean;
  icon: DrinkIcon;
}

/** Your drinks that still have a tile (not deleted). */
export function visibleCustomDrinks(s: State): Drink[] {
  return s.customDrinks.filter((d) => !d.hidden);
}

export const store = {
  getState: (): State => state,

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  addEntry(input: NewEntry): Entry {
    const entry: Entry = { id: newId(), ...input };
    commit({ ...state, entries: sortEntries([...state.entries, entry]) });
    askToPersist();
    return entry;
  },

  updateEntry(id: string, patch: Partial<NewEntry>) {
    commit({
      ...state,
      entries: sortEntries(state.entries.map((e) => (e.id === id ? { ...e, ...patch } : e))),
    });
  },

  removeEntry(id: string): Entry | undefined {
    const removed = state.entries.find((e) => e.id === id);
    commit({ ...state, entries: state.entries.filter((e) => e.id !== id) });
    return removed;
  },

  /** Put back an entry that was just removed (undo). */
  restoreEntry(entry: Entry) {
    if (state.entries.some((e) => e.id === entry.id)) return;
    commit({ ...state, entries: sortEntries([...state.entries, entry]) });
  },

  setHalfLife(hours: number) {
    commit({ ...state, settings: { ...state.settings, halfLifeHours: clampHalfLife(hours) } });
  },

  setBedtime(minutes: number) {
    commit({ ...state, settings: parseSettings({ ...state.settings, bedtimeMinutes: minutes }) });
  },

  setSleepTarget(mg: number) {
    commit({ ...state, settings: parseSettings({ ...state.settings, sleepTargetMg: mg }) });
  },

  /**
   * Save your usual amount for a drink, or `null` to go back to the built-in
   * one. For your own drinks this changes the drink's amount.
   */
  setDrinkDefault(id: DrinkId, mg: number | null) {
    if (isCustomId(id)) {
      if (mg !== null) store.updateCustomDrink(id, { mg });
      return;
    }
    const drinkDefaults = { ...state.settings.drinkDefaults };
    if (mg === null) delete drinkDefaults[id];
    else drinkDefaults[id] = mg;
    commit({ ...state, settings: parseSettings({ ...state.settings, drinkDefaults }) });
  },

  addCustomDrink(input: DrinkInput): Drink | null {
    if (visibleCustomDrinks(state).length >= MAX_CUSTOM_DRINKS) return null;
    const [drink] = parseCustomDrinks([{ ...input, id: `custom-${newId()}` }]);
    if (!drink) return null;
    commit({ ...state, customDrinks: [...state.customDrinks, drink] });
    askToPersist();
    return drink;
  },

  updateCustomDrink(id: string, patch: Partial<DrinkInput>) {
    const customDrinks = parseCustomDrinks(state.customDrinks.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    commit({ ...state, customDrinks });
  },

  /**
   * Remove one of your drinks. If your history uses it, it's only hidden, so
   * those entries keep their name and icon. Returns it for undo.
   */
  removeCustomDrink(id: string): Drink | undefined {
    const drink = state.customDrinks.find((d) => d.id === id);
    if (!drink) return undefined;
    const used = state.entries.some((e) => e.drink === id);
    const customDrinks = used
      ? state.customDrinks.map((d) => (d.id === id ? { ...d, hidden: true } : d))
      : state.customDrinks.filter((d) => d.id !== id);
    commit({ ...state, customDrinks });
    return drink;
  },

  /** Undo `removeCustomDrink`. */
  restoreCustomDrink(drink: Drink) {
    const others = state.customDrinks.filter((d) => d.id !== drink.id);
    commit({ ...state, customDrinks: [...others, { ...drink, hidden: undefined }] });
  },

  clearEntries() {
    commit({ ...state, entries: [] });
  },

  /** Replace everything with a backup that `readBackup` has checked. */
  replaceAll(next: State) {
    commit(next);
    askToPersist();
  },
};

// ---------- files ----------

const pad2 = (n: number) => String(n).padStart(2, "0");

function dateStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Save a file. On phones this opens the share sheet (so it can go to Files,
 * AirDrop, email…), because downloads from an installed home-screen app are
 * unreliable on iOS. Elsewhere it downloads. Resolves to false if the person
 * cancels the share sheet.
 */
async function saveFile(name: string, type: string, text: string): Promise<boolean> {
  const blob = new Blob([text], { type });
  const file = new File([blob], name, { type });
  const touch = window.matchMedia?.("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return false;
      // Sharing failed for another reason: fall back to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

// ---------- backup & restore (JSON, everything) ----------

const BACKUP_APP = "cafflife";
const BACKUP_VERSION = 1;

/** The file `exportBackup` writes: the whole stored state plus a header. */
interface BackupFile extends State {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
}

/** Save everything — drinks you logged, settings and your own drinks — as JSON. */
export function exportBackup(): Promise<boolean> {
  const backup: BackupFile = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    ...state,
  };
  return saveFile(`cafflife-backup-${dateStamp()}.json`, "application/json", JSON.stringify(backup, null, 2));
}

export interface CheckedBackup {
  state: State;
  /** Entries in the file that couldn't be read. */
  skipped: number;
  exportedAt: number | null;
}

/** Read and check a backup file. Throws with a readable message if it isn't one. */
export async function readBackup(file: File): Promise<CheckedBackup> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error("That file isn't a cafflife backup. Restore takes the .json file from Back up.");
  }
  const obj = data as Partial<BackupFile> | null;
  if (!obj || typeof obj !== "object" || obj.app !== BACKUP_APP || !Array.isArray(obj.entries)) {
    throw new Error("That file isn't a cafflife backup. Restore takes the .json file from Back up.");
  }
  if (typeof obj.version === "number" && obj.version > BACKUP_VERSION) {
    throw new Error("That backup is from a newer version of cafflife. Reload the app and try again.");
  }
  const checked = parseState(obj);
  const exportedAt = typeof obj.exportedAt === "string" ? Date.parse(obj.exportedAt) : NaN;
  return {
    state: checked,
    skipped: obj.entries.length - checked.entries.length,
    exportedAt: Number.isFinite(exportedAt) ? exportedAt : null,
  };
}

// ---------- CSV export (for spreadsheets) ----------

const CSV_COLUMNS = ["date", "time", "drink", "mg", "half_caf", "drink_id", "timestamp"] as const;

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(entries: readonly Entry[]): string {
  const rows = [...entries]
    .sort((a, b) => a.at - b.at)
    .map((e) => {
      const d = new Date(e.at);
      return [
        `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
        `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
        drinkById(e.drink).name,
        e.mg,
        e.halfCaf ? "yes" : "no",
        e.drink,
        d.toISOString(),
      ]
        .map(csvCell)
        .join(",");
    });
  return [CSV_COLUMNS.join(","), ...rows].join("\r\n") + "\r\n";
}

/** Every logged drink as a CSV, one row each, for opening in a spreadsheet. */
export function exportCsv(): Promise<boolean> {
  return saveFile(`cafflife-${dateStamp()}.csv`, "text/csv", toCsv(state.entries));
}

export function useStore(): State {
  return useSyncExternalStore(store.subscribe, store.getState);
}

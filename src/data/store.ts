// All data lives in this browser's localStorage — GitHub Pages is static, so
// there is no server. Each device keeps its own log.

import { useSyncExternalStore } from "react";
import { DEFAULT_HALF_LIFE_HOURS, MAX_HALF_LIFE_HOURS, MIN_HALF_LIFE_HOURS } from "../domain/caffeine";
import { DRINKS, type DrinkId } from "../domain/drinks";
import type { Entry, Settings } from "../domain/types";

const KEY = "cafflife:v1";

export interface State {
  entries: Entry[];
  settings: Settings;
}

const EMPTY: State = { entries: [], settings: { halfLifeHours: DEFAULT_HALF_LIFE_HOURS } };
const DRINK_IDS = new Set<string>(DRINKS.map((d) => d.id));

function clampHalfLife(h: unknown): number {
  const n = typeof h === "number" && Number.isFinite(h) ? h : DEFAULT_HALF_LIFE_HOURS;
  return Math.min(MAX_HALF_LIFE_HOURS, Math.max(MIN_HALF_LIFE_HOURS, n));
}

function isEntry(x: unknown): x is Entry {
  if (!x || typeof x !== "object") return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.drink === "string" &&
    DRINK_IDS.has(e.drink) &&
    typeof e.mg === "number" &&
    Number.isFinite(e.mg) &&
    typeof e.at === "number" &&
    Number.isFinite(e.at)
  );
}

function parse(raw: string | null): State {
  if (!raw) return EMPTY;
  try {
    const data = JSON.parse(raw) as Partial<State>;
    const entries = Array.isArray(data.entries)
      ? data.entries.filter(isEntry).map((e) => ({ ...e, halfCaf: Boolean(e.halfCaf) }))
      : [];
    return {
      entries: sortEntries(entries),
      settings: { halfLifeHours: clampHalfLife(data.settings?.halfLifeHours) },
    };
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
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function commit(next: State) {
  state = next;
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
    emit();
  });
}

export interface NewEntry {
  drink: DrinkId;
  mg: number;
  halfCaf: boolean;
  at: number;
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

  clearEntries() {
    commit({ ...state, entries: [] });
  },
};

export function useStore(): State {
  return useSyncExternalStore(store.subscribe, store.getState);
}

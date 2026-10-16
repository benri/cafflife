import { useCallback, useEffect, useRef, useState } from "react";
import { CaffeineChart } from "./components/CaffeineChart";
import { EntryList } from "./components/EntryList";
import { Insights } from "./components/Insights";
import { DrinkEditorSheet } from "./components/DrinkEditorSheet";
import { DrinkIcon, GearIcon, LogoMark, PlusIcon } from "./components/icons";
import { LevelHero } from "./components/LevelHero";
import { LogSheet, type LogTarget } from "./components/LogSheet";
import { SettingsSheet } from "./components/SettingsSheet";
import { TonightCard } from "./components/TonightCard";
import { store, useStore, visibleCustomDrinks } from "./data/store";
import { useNow } from "./data/useNow";
import { DRINKS, drinkById, effectiveMg, MAX_CUSTOM_DRINKS, type Drink } from "./domain/drinks";
import { formatHours } from "./domain/time";

interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

export default function App() {
  const state = useStore();
  const { entries, settings } = state;
  const myDrinks = visibleCustomDrinks(state);
  // Adding a drink (no drink) or editing one of yours.
  const [editor, setEditor] = useState<{ drink?: Drink } | null>(null);
  const now = useNow();
  const [logTarget, setLogTarget] = useState<LogTarget | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { toast, showToast, dismissToast } = useToast();
  const [tab, setTab] = useTab();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <LogoMark size={30} />
          <span className="wordmark">cafflife</span>
        </div>
        <nav className="tabs" aria-label="Views">
          {TABS.map((t) => (
            <a
              key={t.id}
              href={t.id === "today" ? "#" : `#${t.id}`}
              className="tab"
              aria-current={tab === t.id ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                setTab(t.id);
              }}
            >
              {t.label}
            </a>
          ))}
        </nav>
        <button type="button" className="icon-button" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
          <GearIcon />
        </button>
      </header>

      {tab === "insights" ? (
        <main key="insights" className="view">
          <Insights entries={entries} now={now} settings={settings} />
          <footer className="footer">
            Estimates from a standard caffeine model, not medical advice. Data stays on this device.
          </footer>
        </main>
      ) : (
        <main key="today" className="view">
          <LevelHero entries={entries} now={now} halfLifeHours={settings.halfLifeHours} />

          <TonightCard entries={entries} now={now} settings={settings} onChange={() => setSettingsOpen(true)} />

          <section className="card" aria-labelledby="chart-title">
            <div className="card-header">
              <h2 id="chart-title" className="section-title">
                Caffeine in your system
              </h2>
              <p className="card-sub">Estimated from your log · {formatHours(settings.halfLifeHours)} half-life</p>
            </div>
            <CaffeineChart
              entries={entries}
              now={now}
              halfLifeHours={settings.halfLifeHours}
              bedtimeMinutes={settings.bedtimeMinutes}
            />
          </section>

          <section aria-labelledby="log-title">
            <h2 id="log-title" className="section-title">
              Log a drink
            </h2>
            <div className="drink-grid">
              {[...DRINKS, ...myDrinks].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="drink"
                  onClick={() => setLogTarget({ kind: "new", drink: d })}
                >
                  <DrinkIcon kind={d.icon} />
                  <span className="drink-name">{d.name}</span>
                  <span className="drink-mg">{effectiveMg(d, settings.drinkDefaults)} mg</span>
                </button>
              ))}
              {myDrinks.length < MAX_CUSTOM_DRINKS && (
                <button type="button" className="drink drink-add" onClick={() => setEditor({})}>
                  <PlusIcon size={28} />
                  <span className="drink-name">Add drink</span>
                  <span className="drink-mg">your own</span>
                </button>
              )}
            </div>
          </section>

          <section aria-labelledby="history-title">
            <h2 id="history-title" className="section-title">
              History
            </h2>
            <EntryList
              entries={entries}
              now={now}
              halfLifeHours={settings.halfLifeHours}
              onEdit={(entry) => setLogTarget({ kind: "edit", entry })}
            />
          </section>

          <footer className="footer">
            Estimates from a standard caffeine model, not medical advice. Data stays on this device.
          </footer>
        </main>
      )}

      {logTarget && (
        <LogSheet
          onEditDrink={(drink) => {
            setLogTarget(null);
            setEditor({ drink });
          }}
          key={logTarget.kind === "new" ? `new-${logTarget.drink.id}` : `edit-${logTarget.entry.id}`}
          target={logTarget}
          now={now}
          usualMg={effectiveMg(
            logTarget.kind === "new" ? logTarget.drink : drinkById(logTarget.entry.drink),
            settings.drinkDefaults,
          )}
          onClose={() => setLogTarget(null)}
          onSubmit={(input, rememberMg) => {
            const name = drinkById(input.drink).name;
            if (rememberMg !== null) store.setDrinkDefault(input.drink, rememberMg);
            if (logTarget.kind === "edit") {
              store.updateEntry(logTarget.entry.id, input);
              showToast({ message: `Updated ${name}` });
            } else {
              const entry = store.addEntry(input);
              showToast({
                message: `Logged ${name} · ${entry.mg} mg`,
                action: {
                  label: "Undo",
                  run: () => store.removeEntry(entry.id),
                },
              });
            }
            setLogTarget(null);
          }}
          onDelete={(entry) => {
            const removed = store.removeEntry(entry.id);
            setLogTarget(null);
            if (removed) {
              showToast({
                message: `Deleted ${drinkById(removed.drink).name}`,
                action: {
                  label: "Undo",
                  run: () => store.restoreEntry(removed),
                },
              });
            }
          }}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          settings={settings}
          myDrinks={myDrinks}
          entryCount={entries.length}
          onClose={() => setSettingsOpen(false)}
          onEditDrink={(drink) => {
            setSettingsOpen(false);
            setEditor({ drink });
          }}
          onAddDrink={() => {
            setSettingsOpen(false);
            setEditor({});
          }}
        />
      )}

      {editor && (
        <DrinkEditorSheet
          key={editor.drink?.id ?? "new"}
          drink={editor.drink}
          onClose={() => setEditor(null)}
          onSave={(input) => {
            if (editor.drink) {
              store.updateCustomDrink(editor.drink.id, input);
              showToast({ message: `Saved ${input.name}` });
            } else {
              const added = store.addCustomDrink(input);
              if (added) {
                showToast({
                  message: `Added ${added.name}`,
                  action: { label: "Undo", run: () => store.removeCustomDrink(added.id) },
                });
              }
            }
            setEditor(null);
          }}
          onDelete={(drink) => {
            const removed = store.removeCustomDrink(drink.id);
            setEditor(null);
            if (removed) {
              showToast({
                message: `Deleted ${removed.name}`,
                action: { label: "Undo", run: () => store.restoreCustomDrink(removed) },
              });
            }
          }}
        />
      )}

      <div className="toast-region" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  toast.action?.run();
                  dismissToast();
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type Tab = "today" | "insights";
const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "insights", label: "Insights" },
];

/** The current tab, kept in the URL hash so reload and Back work. */
function useTab(): [Tab, (t: Tab) => void] {
  const read = (): Tab => (location.hash === "#insights" ? "insights" : "today");
  const [tab, setTabState] = useState<Tab>(read);

  useEffect(() => {
    const onHash = () => setTabState(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const setTab = useCallback((t: Tab) => {
    if (t === read()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (t === "today") history.pushState(null, "", location.pathname + location.search);
    else location.hash = t;
    setTabState(t);
    window.scrollTo({ top: 0 });
  }, []);

  return [tab, setTab];
}

function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const dismissToast = useCallback(() => {
    window.clearTimeout(timer.current);
    setToast(null);
  }, []);

  const showToast = useCallback((t: Omit<Toast, "id">) => {
    window.clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), 6000);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { toast, showToast, dismissToast };
}

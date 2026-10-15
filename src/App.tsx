import { useCallback, useEffect, useRef, useState } from "react";
import { CaffeineChart } from "./components/CaffeineChart";
import { EntryList } from "./components/EntryList";
import { DrinkIcon, GearIcon, LogoMark } from "./components/icons";
import { LevelHero } from "./components/LevelHero";
import { LogSheet, type LogTarget } from "./components/LogSheet";
import { SettingsSheet } from "./components/SettingsSheet";
import { store, useStore } from "./data/store";
import { useNow } from "./data/useNow";
import { DRINKS, drinkById } from "./domain/drinks";
import { formatHours } from "./domain/time";

interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

export default function App() {
  const { entries, settings } = useStore();
  const now = useNow();
  const [logTarget, setLogTarget] = useState<LogTarget | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { toast, showToast, dismissToast } = useToast();

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <LogoMark size={30} />
          <span className="wordmark">cafflife</span>
        </div>
        <button type="button" className="icon-button" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
          <GearIcon />
        </button>
      </header>

      <main>
        <LevelHero entries={entries} now={now} halfLifeHours={settings.halfLifeHours} />

        <section className="card" aria-labelledby="chart-title">
          <div className="card-header">
            <h2 id="chart-title" className="section-title">Caffeine in your system</h2>
            <p className="card-sub">
              Last 24 h and next 12 h · {formatHours(settings.halfLifeHours)} half-life
            </p>
          </div>
          <CaffeineChart entries={entries} now={now} halfLifeHours={settings.halfLifeHours} />
        </section>

        <section aria-labelledby="log-title">
          <h2 id="log-title" className="section-title">Log a drink</h2>
          <div className="drink-grid">
            {DRINKS.map((d) => (
              <button
                key={d.id}
                type="button"
                className="drink"
                onClick={() => setLogTarget({ kind: "new", drink: d })}
              >
                <DrinkIcon kind={d.icon} />
                <span className="drink-name">{d.name}</span>
                <span className="drink-mg">{d.mg} mg</span>
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="history-title">
          <h2 id="history-title" className="section-title">History</h2>
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

      {logTarget && (
        <LogSheet
          key={logTarget.kind === "new" ? `new-${logTarget.drink.id}` : `edit-${logTarget.entry.id}`}
          target={logTarget}
          now={now}
          onClose={() => setLogTarget(null)}
          onSubmit={(input) => {
            const name = drinkById(input.drink).name;
            if (logTarget.kind === "edit") {
              store.updateEntry(logTarget.entry.id, input);
              showToast({ message: `Updated ${name}` });
            } else {
              const entry = store.addEntry(input);
              showToast({
                message: `Logged ${name} · ${entry.mg} mg`,
                action: { label: "Undo", run: () => store.removeEntry(entry.id) },
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
                action: { label: "Undo", run: () => store.restoreEntry(removed) },
              });
            }
          }}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          halfLifeHours={settings.halfLifeHours}
          entryCount={entries.length}
          onClose={() => setSettingsOpen(false)}
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

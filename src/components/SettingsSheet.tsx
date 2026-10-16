import { useRef, useState } from "react";
import {
  DEFAULT_BEDTIME_MINUTES,
  DEFAULT_HALF_LIFE_HOURS,
  DEFAULT_SLEEP_TARGET_MG,
  hoursToPeak,
  MAX_HALF_LIFE_HOURS,
  MAX_SLEEP_TARGET_MG,
  MIN_HALF_LIFE_HOURS,
} from "../domain/caffeine";
import { DRINKS, MAX_CUSTOM_DRINKS, type Drink } from "../domain/drinks";
import { dayLabel, formatHours } from "../domain/time";
import type { Settings } from "../domain/types";
import { exportBackup, exportCsv, readBackup, store, type CheckedBackup } from "../data/store";
import { DrinkIcon, GearIcon, PlusIcon } from "./icons";
import { Sheet } from "./Sheet";

interface Props {
  settings: Settings;
  /** Your own drinks that still have a tile. */
  myDrinks: Drink[];
  entryCount: number;
  onClose: () => void;
  onEditDrink: (drink: Drink) => void;
  onAddDrink: () => void;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function SettingsSheet({ settings, myDrinks, entryCount, onClose, onEditDrink, onAddDrink }: Props) {
  const { halfLifeHours, bedtimeMinutes, sleepTargetMg, drinkDefaults } = settings;
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // A checked backup waiting for "Replace" when it would overwrite entries.
  const [pending, setPending] = useState<CheckedBackup | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const peakMin = Math.round(hoursToPeak(halfLifeHours) * 60);
  const customized = DRINKS.filter((d) => drinkDefaults[d.id] !== undefined);

  function restore(b: CheckedBackup) {
    store.replaceAll(b.state);
    setPending(null);
    const n = b.state.entries.length;
    setNotice(
      `Restored ${n} ${n === 1 ? "entry" : "entries"} and your settings.` +
        (b.skipped ? ` Skipped ${b.skipped} that couldn't be read.` : ""),
    );
  }

  async function onFile(files: FileList | null) {
    const file = files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setNotice(null);
    try {
      const b = await readBackup(file);
      if (entryCount === 0) restore(b);
      else setPending(b);
    } catch (e) {
      setPending(null);
      setNotice(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  }

  async function onBackup() {
    setNotice(null);
    if (await exportBackup()) setNotice("Backup saved.");
  }

  async function onExportCsv() {
    setNotice(null);
    if (await exportCsv()) setNotice("CSV exported.");
  }

  return (
    <Sheet title="Settings" icon={<GearIcon size={26} />} onClose={onClose}>
      <div className="settings">
        <section className="field">
          <h3 className="field-label">Sleep</h3>
          <label className="setting-row">
            <span>Bedtime</span>
            <input
              className="time-input"
              type="time"
              value={`${pad2(Math.floor(bedtimeMinutes / 60))}:${pad2(bedtimeMinutes % 60)}`}
              onChange={(e) => {
                const m = /^(\d{2}):(\d{2})/.exec(e.target.value);
                if (m) store.setBedtime(Number(m[1]) * 60 + Number(m[2]));
              }}
            />
          </label>
          <div className="field-label-row setting-subrow">
            <label htmlFor="sleep-target">Under this at bedtime</label>
            <span className="field-value">{sleepTargetMg} mg</span>
          </div>
          <input
            id="sleep-target"
            className="slider"
            type="range"
            min={0}
            max={MAX_SLEEP_TARGET_MG}
            step={5}
            value={sleepTargetMg}
            onChange={(e) => store.setSleepTarget(Number(e.target.value))}
          />
          <div className="slider-scale" aria-hidden="true">
            <span>0 mg · strict</span>
            <span>{MAX_SLEEP_TARGET_MG} mg · relaxed</span>
          </div>
          <p className="help">
            How much caffeine you're happy to still have in your system when you go to sleep. There's no
            official number. {DEFAULT_SLEEP_TARGET_MG} mg, about half a cup of brewed coffee, is a cautious
            place to start. Tonight's estimate and last call use these.
          </p>
          {(bedtimeMinutes !== DEFAULT_BEDTIME_MINUTES || sleepTargetMg !== DEFAULT_SLEEP_TARGET_MG) && (
            <button
              type="button"
              className="link-button"
              onClick={() => {
                store.setBedtime(DEFAULT_BEDTIME_MINUTES);
                store.setSleepTarget(DEFAULT_SLEEP_TARGET_MG);
              }}
            >
              Reset to 10:30 PM and {DEFAULT_SLEEP_TARGET_MG} mg
            </button>
          )}
        </section>

        <section className="field">
          <div className="field-label-row">
            <label className="field-label" htmlFor="half-life">
              Caffeine half-life
            </label>
            <span className="field-value">{formatHours(halfLifeHours)}</span>
          </div>
          <input
            id="half-life"
            className="slider"
            type="range"
            min={MIN_HALF_LIFE_HOURS}
            max={MAX_HALF_LIFE_HOURS}
            step={0.5}
            value={halfLifeHours}
            onChange={(e) => store.setHalfLife(Number(e.target.value))}
          />
          <div className="slider-scale" aria-hidden="true">
            <span>{MIN_HALF_LIFE_HOURS} h · clears fast</span>
            <span>{MAX_HALF_LIFE_HOURS} h · lingers</span>
          </div>
          <p className="help">
            About 5 h is typical for healthy adults, but it varies a lot from person to person. Smoking
            shortens it. Pregnancy, oral contraceptives and some medications make it longer. If caffeine
            keeps you up long after your last cup, try a longer half-life.
          </p>
          {halfLifeHours !== DEFAULT_HALF_LIFE_HOURS && (
            <button type="button" className="link-button" onClick={() => store.setHalfLife(DEFAULT_HALF_LIFE_HOURS)}>
              Reset to {DEFAULT_HALF_LIFE_HOURS} h
            </button>
          )}
        </section>

        <section className="field">
          <h3 className="field-label">Your drinks</h3>
          {myDrinks.length > 0 && (
            <ul className="defaults-list">
              {myDrinks.map((d) => (
                <li key={d.id} className="defaults-row">
                  <DrinkIcon kind={d.icon} size={20} />
                  <span className="defaults-name">{d.name}</span>
                  <span className="defaults-mg">{d.mg} mg</span>
                  <button type="button" className="link-button" onClick={() => onEditDrink(d)}>
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          )}
          {myDrinks.length < MAX_CUSTOM_DRINKS && (
            <button type="button" className="link-button add-drink-link" onClick={onAddDrink}>
              <PlusIcon size={16} /> Add a drink
            </button>
          )}
        </section>

        {customized.length > 0 && (
          <section className="field">
            <h3 className="field-label">Your amounts</h3>
            <ul className="defaults-list">
              {customized.map((d) => (
                <li key={d.id} className="defaults-row">
                  <DrinkIcon kind={d.icon} size={20} />
                  <span className="defaults-name">{d.name}</span>
                  <span className="defaults-mg">{drinkDefaults[d.id]} mg</span>
                  <button type="button" className="link-button" onClick={() => store.setDrinkDefault(d.id, null)}>
                    Reset to {d.mg}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="field">
          <h3 className="field-label">How the estimate works</h3>
          <p className="help">
            Each drink is absorbed over the first hour. With your half-life it peaks about {peakMin} min after
            you drink it, then halves every {formatHours(halfLifeHours)}. Drinks add up, and the big number is
            the total still in circulation. It's an estimate from a standard model, not a measurement.
          </p>
        </section>

        <section className="field">
          <h3 className="field-label">Your data</h3>
          <p className="help">
            Your {entryCount} {entryCount === 1 ? "entry is" : "entries are"} stored only in this browser on this
            device. Nothing is sent anywhere. Back up now and then, or to move everything to another device:
            the backup has your log, settings and your own drinks.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => onFile(e.target.files)}
          />
          <div className="button-row">
            <button type="button" className="button button-quiet" onClick={onBackup}>
              Back up
            </button>
            <button type="button" className="button button-quiet" onClick={() => fileRef.current?.click()}>
              Restore…
            </button>
          </div>
          <button
            type="button"
            className="link-button csv-link"
            onClick={onExportCsv}
            disabled={entryCount === 0}
          >
            Export CSV for a spreadsheet
          </button>
          {pending && (
            <div className="confirm-box" role="alertdialog" aria-label="Replace your log?">
              <p className="help">
                Replace everything here ({entryCount} {entryCount === 1 ? "entry" : "entries"}, your settings and
                your drinks) with this backup
                {pending.exportedAt ? ` from ${dayLabel(pending.exportedAt, Date.now()).toLowerCase()}` : ""}? It has{" "}
                {pending.state.entries.length} {pending.state.entries.length === 1 ? "entry" : "entries"}.
              </p>
              <div className="button-row">
                <button type="button" className="button button-danger" onClick={() => restore(pending)}>
                  Replace
                </button>
                <button type="button" className="button button-quiet" onClick={() => setPending(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {notice && (
            <p className="help backup-notice" role="status">
              {notice}
            </p>
          )}
          {entryCount > 0 && (
            <button
              type="button"
              className="button button-danger"
              onClick={() => {
                if (!confirmClear) {
                  setConfirmClear(true);
                  return;
                }
                store.clearEntries();
                setConfirmClear(false);
              }}
            >
              {confirmClear ? "Tap again to delete everything" : "Delete all entries"}
            </button>
          )}
        </section>
      </div>
    </Sheet>
  );
}

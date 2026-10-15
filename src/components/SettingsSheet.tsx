import { useState } from "react";
import {
  DEFAULT_HALF_LIFE_HOURS,
  hoursToPeak,
  MAX_HALF_LIFE_HOURS,
  MIN_HALF_LIFE_HOURS,
} from "../domain/caffeine";
import { formatHours } from "../domain/time";
import { store } from "../data/store";
import { GearIcon } from "./icons";
import { Sheet } from "./Sheet";

interface Props {
  halfLifeHours: number;
  entryCount: number;
  onClose: () => void;
}

export function SettingsSheet({ halfLifeHours, entryCount, onClose }: Props) {
  const [confirmClear, setConfirmClear] = useState(false);
  const peakMin = Math.round(hoursToPeak(halfLifeHours) * 60);

  return (
    <Sheet title="Settings" icon={<GearIcon size={26} />} onClose={onClose}>
      <div className="settings">
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
            device. Nothing is sent anywhere.
          </p>
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

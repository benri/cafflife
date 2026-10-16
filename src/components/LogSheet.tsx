import { useState } from "react";
import { drinkById, typicalText, type Drink } from "../domain/drinks";
import { formatAgo, fromLocalInputValue, MINUTE, toLocalInputValue } from "../domain/time";
import type { Entry } from "../domain/types";
import type { NewEntry } from "../data/store";
import { DrinkIcon } from "./icons";
import { Sheet } from "./Sheet";

export type LogTarget = { kind: "new"; drink: Drink } | { kind: "edit"; entry: Entry };

type When = { kind: "now" } | { kind: "ago"; minutes: number } | { kind: "at"; ms: number };

const AGO_CHOICES = [15, 30, 60, 120];
const MAX_MG = 1000;
const SLIDER_MAX = 300;

interface Props {
  target: LogTarget;
  now: number;
  /** This drink's usual amount: your saved one, or the built-in default. */
  usualMg: number;
  /** `rememberMg` is a new usual amount to save for this drink, or null. */
  onSubmit: (entry: NewEntry, rememberMg: number | null) => void;
  onDelete?: (entry: Entry) => void;
  /** Open the editor for one of your own drinks. */
  onEditDrink?: (drink: Drink) => void;
  onClose: () => void;
}

export function LogSheet({ target, now, usualMg, onSubmit, onDelete, onEditDrink, onClose }: Props) {
  const editing = target.kind === "edit" ? target.entry : null;
  const drink = target.kind === "new" ? target.drink : drinkById(target.entry.drink);

  const [mgText, setMgText] = useState(String(editing ? editing.mg : usualMg));
  // Off by default, so a one-off change doesn't become the new usual.
  const [remember, setRemember] = useState(false);
  const [halfCaf, setHalfCaf] = useState(editing ? editing.halfCaf : false);
  const [when, setWhen] = useState<When>(editing ? { kind: "at", ms: editing.at } : { kind: "now" });

  const mg = clampMg(parseInt(mgText, 10));
  const at = resolveWhen(when, now);
  const inFuture = at > now + MINUTE;
  const defaultMg = Math.round(usualMg * (halfCaf ? 0.5 : 1));
  // The usual is stored at full strength; half-caf halves it when logging.
  const fullMg = halfCaf ? mg * 2 : mg;
  const canRemember = !editing && fullMg !== usualMg;

  const setMg = (n: number) => setMgText(String(clampMg(n)));

  function toggleHalfCaf() {
    // Half-caf halves whatever amount is set; switching back doubles it.
    setMg(halfCaf ? mg * 2 : mg / 2);
    setHalfCaf(!halfCaf);
  }

  function submit() {
    if (inFuture) return;
    onSubmit(
      {
        drink: drink.id,
        mg,
        halfCaf: drink.coffee && halfCaf,
        at: when.kind === "now" ? Date.now() : resolveWhen(when, Date.now()),
      },
      canRemember && remember ? fullMg : null,
    );
  }

  return (
    <Sheet
      title={drink.name}
      subtitle={
        drink.custom
          ? [drink.serving, `${drink.mg} mg`].filter(Boolean).join(" · ")
          : usualMg === drink.mg
            ? `${drink.serving} · ${typicalText(drink)}`
            : `Your usual ${usualMg} mg · ${typicalText(drink)}`
      }
      icon={<DrinkIcon kind={drink.icon} size={30} />}
      onClose={onClose}
    >
      <form
        className="log-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <fieldset className="field">
          <legend className="field-label">Caffeine</legend>
          <div className="stepper">
            <button type="button" className="step-button" aria-label="5 mg less" onClick={() => setMg(mg - 5)}>
              −
            </button>
            <label className="mg-input-wrap">
              <span className="visually-hidden">Milligrams of caffeine</span>
              <input
                className="mg-input"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_MG}
                step={1}
                value={mgText}
                onChange={(e) => setMgText(e.target.value)}
                onBlur={() => setMg(mg)}
                onFocus={(e) => e.target.select()}
              />
              <span className="mg-suffix">mg</span>
            </label>
            <button type="button" className="step-button" aria-label="5 mg more" onClick={() => setMg(mg + 5)}>
              +
            </button>
          </div>
          <input
            className="slider"
            type="range"
            min={0}
            max={Math.max(SLIDER_MAX, mg)}
            step={5}
            value={mg}
            aria-label="Caffeine in milligrams"
            onChange={(e) => setMg(Number(e.target.value))}
          />
          {mg !== defaultMg && (
            <button type="button" className="link-button" onClick={() => setMg(defaultMg)}>
              Reset to {defaultMg} mg
            </button>
          )}
        </fieldset>

        {canRemember && (
          <label className="switch-row">
            <span>
              <span className="switch-title">Make {fullMg} mg my usual</span>
              <span className="switch-hint">Starts at this next time you log {drink.name.toLowerCase()}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
          </label>
        )}

        {drink.coffee && (
          <label className="switch-row">
            <span>
              <span className="switch-title">Half-caf beans</span>
              <span className="switch-hint">Halves the caffeine</span>
            </span>
            <input type="checkbox" role="switch" className="switch" checked={halfCaf} onChange={toggleHalfCaf} />
          </label>
        )}

        <fieldset className="field">
          <legend className="field-label">When</legend>
          <div className="chips">
            <button
              type="button"
              className="chip"
              aria-pressed={when.kind === "now"}
              onClick={() => setWhen({ kind: "now" })}
            >
              Now
            </button>
            {AGO_CHOICES.map((m) => (
              <button
                key={m}
                type="button"
                className="chip"
                aria-pressed={when.kind === "ago" && when.minutes === m}
                onClick={() => setWhen({ kind: "ago", minutes: m })}
              >
                {m < 60 ? `${m} min ago` : `${m / 60} h ago`}
              </button>
            ))}
          </div>
          <label className="time-row">
            <span className="visually-hidden">Date and time</span>
            <input
              className="time-input"
              type="datetime-local"
              value={toLocalInputValue(at)}
              max={toLocalInputValue(now)}
              onChange={(e) => {
                const ms = fromLocalInputValue(e.target.value);
                if (ms !== null) setWhen({ kind: "at", ms });
              }}
            />
            <span className="time-ago">{inFuture ? "That's in the future" : formatAgo(at, now)}</span>
          </label>
        </fieldset>

        {drink.custom && !drink.hidden && onEditDrink && (
          <button type="button" className="link-button" onClick={() => onEditDrink(drink)}>
            Edit {drink.name}
          </button>
        )}

        <div className="sheet-actions">
          {editing && onDelete && (
            <button type="button" className="button button-danger" onClick={() => onDelete(editing)}>
              Delete
            </button>
          )}
          <button type="submit" className="button button-primary" disabled={inFuture}>
            {editing ? "Save" : `Log ${mg} mg`}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function clampMg(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_MG, Math.max(0, Math.round(n)));
}

function resolveWhen(when: When, now: number): number {
  switch (when.kind) {
    case "now":
      return now;
    case "ago":
      return now - when.minutes * MINUTE;
    case "at":
      return when.ms;
  }
}

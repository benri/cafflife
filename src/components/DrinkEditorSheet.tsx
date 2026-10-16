import { useState } from "react";
import { CUSTOM_ICONS, MAX_DRINK_NAME, MAX_SERVING, type Drink, type DrinkIcon as DrinkIconKind } from "../domain/drinks";
import { MAX_DRINK_MG, type DrinkInput } from "../data/store";
import { DrinkIcon } from "./icons";
import { Sheet } from "./Sheet";

const ICON_NAMES: Record<string, string> = {
  mug: "Mug",
  iced: "Iced drink",
  can: "Can",
  bottle: "Bottle",
  bolt: "Energy drink",
  bowl: "Bowl",
  tea: "Tea cup",
  espresso: "Small cup",
};

interface Props {
  /** The drink to edit; leave out to add a new one. */
  drink?: Drink;
  onSave: (input: DrinkInput) => void;
  onDelete?: (drink: Drink) => void;
  onClose: () => void;
}

/** Add one of your own drinks, or edit or delete one. */
export function DrinkEditorSheet({ drink, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(drink?.name ?? "");
  const [icon, setIcon] = useState<DrinkIconKind>(drink?.icon ?? "mug");
  const [mgText, setMgText] = useState(String(drink?.mg ?? 100));
  const [serving, setServing] = useState(drink?.serving ?? "");
  const [coffee, setCoffee] = useState(drink?.coffee ?? false);

  const mg = clampMg(parseInt(mgText, 10));
  const setMg = (n: number) => setMgText(String(clampMg(n)));
  const trimmed = name.trim();

  return (
    <Sheet
      title={drink ? `Edit ${drink.name}` : "Add a drink"}
      subtitle={drink ? "Changes apply to future logs" : "It gets its own tile under Log a drink"}
      icon={<DrinkIcon kind={icon} size={30} />}
      onClose={onClose}
    >
      <form
        className="log-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!trimmed) return;
          onSave({ name: trimmed, serving: serving.trim(), mg, coffee, icon });
        }}
      >
        <label className="field">
          <span className="field-label">Name</span>
          <input
            className="text-input"
            type="text"
            value={name}
            maxLength={MAX_DRINK_NAME}
            placeholder="e.g. Cold brew"
            autoFocus={!drink}
            enterKeyHint="done"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <fieldset className="field">
          <legend className="field-label">Icon</legend>
          <div className="icon-picker" role="radiogroup" aria-label="Icon">
            {CUSTOM_ICONS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                className="icon-choice"
                aria-checked={icon === k}
                aria-label={ICON_NAMES[k] ?? k}
                onClick={() => setIcon(k)}
              >
                <DrinkIcon kind={k} size={26} />
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="field-label">Caffeine per serving</legend>
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
                max={MAX_DRINK_MG}
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
          <p className="help">Check the label or the café's website. You can still adjust it each time you log.</p>
        </fieldset>

        <label className="field">
          <span className="field-label">Serving (optional)</span>
          <input
            className="text-input"
            type="text"
            value={serving}
            maxLength={MAX_SERVING}
            placeholder="e.g. 16 oz can"
            onChange={(e) => setServing(e.target.value)}
          />
        </label>

        <label className="switch-row">
          <span>
            <span className="switch-title">Coffee</span>
            <span className="switch-hint">Shows the half-caf option when you log it</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            checked={coffee}
            onChange={(e) => setCoffee(e.target.checked)}
          />
        </label>

        <div className="sheet-actions">
          {drink && onDelete && (
            <button type="button" className="button button-danger" onClick={() => onDelete(drink)}>
              Delete
            </button>
          )}
          <button type="submit" className="button button-primary" disabled={!trimmed}>
            {drink ? "Save" : "Add drink"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function clampMg(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_DRINK_MG, Math.max(0, Math.round(n)));
}

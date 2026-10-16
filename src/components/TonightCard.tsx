import { useState } from "react";
import { levelAt } from "../domain/caffeine";
import { lastCall, tonightsBedtime, usualDrink } from "../domain/sleep";
import { formatTime } from "../domain/time";
import type { Entry, Settings } from "../domain/types";
import { ChevronIcon, DrinkIcon, MoonIcon } from "./icons";

const OPEN_KEY = "cafflife:tonight-open";

interface Props {
  entries: readonly Entry[];
  now: number;
  settings: Settings;
  onChange: () => void;
}

/**
 * Bedtime projection and last call, from the bedtime and target in Settings.
 * A one-line summary by default; tap to expand the details.
 */
export function TonightCard({ entries, now, settings, onChange }: Props) {
  const [open, setOpen] = useState(readOpen);
  const { halfLifeHours, sleepTargetMg } = settings;
  const bed = tonightsBedtime(now, settings.bedtimeMinutes);
  const atBed = levelAt(entries, bed.at, halfLifeHours);
  const under = atBed <= sleepTargetMg;
  const drink = usualDrink(entries, now, settings);
  const call = lastCall(entries, now, bed.at, drink.mg, sleepTargetMg, halfLifeHours);

  const summary = bed.past
    ? `past bedtime · ${Math.round(levelAt(entries, now, halfLifeHours))} mg now`
    : `~${Math.round(atBed)} mg at bedtime`;

  function toggle() {
    setOpen(!open);
    try {
      localStorage.setItem(OPEN_KEY, open ? "0" : "1");
    } catch {
      // Not remembering is fine.
    }
  }

  return (
    <section className={`tonight${open ? " tonight-open" : ""}`} aria-label="Tonight">
      <button type="button" className="tonight-summary" aria-expanded={open} onClick={toggle}>
        <MoonIcon size={16} />
        <span className="tonight-title">Tonight</span>
        <span className="tonight-glance">
          {!bed.past && <span className={`dot ${under ? "dot-good" : "dot-over"}`} aria-hidden="true" />}
          {summary}
          <span className="visually-hidden">{bed.past ? "" : under ? ", under target" : ", over target"}</span>
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="tonight-body">
          {bed.past ? (
            <p className="tonight-line">
              It's past your {formatTime(bed.at)} bedtime. About{" "}
              <strong>{Math.round(levelAt(entries, now, halfLifeHours))} mg</strong> is still in your system.
            </p>
          ) : (
            <>
              <div className="tonight-row">
                <span className="tonight-label">At bedtime ({formatTime(bed.at)})</span>
                <span className="tonight-value">
                  ~{Math.round(atBed)} mg
                  <span className={`pill ${under ? "pill-good" : "pill-over"}`}>
                    {under ? "under target" : "over target"}
                  </span>
                </span>
              </div>
              <div className="tonight-row">
                <span className="tonight-label">Last call</span>
                <span className="tonight-value">{lastCallText(call)}</span>
              </div>
              <p className="tonight-note">
                <DrinkIcon kind={drink.icon} size={16} />
                {lastCallNote(call, drink.name, drink.mg)}
              </p>
            </>
          )}
          <button type="button" className="link-button tonight-edit" onClick={onChange}>
            Target under {sleepTargetMg} mg · Change
          </button>
        </div>
      )}
    </section>
  );
}

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function lastCallText(call: ReturnType<typeof lastCall>): string {
  switch (call.kind) {
    case "by":
      return `by ${formatTime(call.at)}`;
    case "passed":
      return `passed at ${formatTime(call.at)}`;
    case "over":
      return "skip it";
    case "anytime":
      return "any time";
  }
}

function lastCallNote(call: ReturnType<typeof lastCall>, name: string, mg: number): string {
  const drink = `${name.toLowerCase()} (${mg} mg)`;
  switch (call.kind) {
    case "by":
      return `For one more ${drink} and still be under target at bedtime.`;
    case "passed":
      return `Another ${drink} now would leave you over target at bedtime.`;
    case "over":
      return `You'll be over target at bedtime even without another ${drink}.`;
    case "anytime":
      return `A ${drink} won't put you over target, even late.`;
  }
}

import { useState } from "react";
import { entryAmountAt } from "../domain/caffeine";
import { drinkById } from "../domain/drinks";
import { dayLabel, formatTime, startOfDay } from "../domain/time";
import type { Entry } from "../domain/types";
import { DrinkIcon } from "./icons";

interface Props {
  entries: readonly Entry[];
  now: number;
  halfLifeHours: number;
  onEdit: (entry: Entry) => void;
}

const PAGE = 30;

export function EntryList({ entries, now, halfLifeHours, onEdit }: Props) {
  const [limit, setLimit] = useState(PAGE);

  if (entries.length === 0) {
    return <p className="empty">No drinks yet. Tap one above to log it.</p>;
  }

  // Totals per calendar day, over every entry (not just the ones shown).
  const dayTotals = new Map<number, number>();
  for (const e of entries) {
    const day = startOfDay(e.at);
    dayTotals.set(day, (dayTotals.get(day) ?? 0) + e.mg);
  }

  // Entries are newest first, so each day is one contiguous run.
  const groups: { day: number; items: Entry[] }[] = [];
  for (const e of entries.slice(0, limit)) {
    const day = startOfDay(e.at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(e);
    else groups.push({ day, items: [e] });
  }

  return (
    <div className="history">
      {groups.map(({ day, items }) => (
        <section key={day} className="day">
          <h3 className="day-header">
            <span>{dayLabel(day, now)}</span>
            <span className="day-total">{dayTotals.get(day)} mg</span>
          </h3>
          <ul className="entries">
            {items.map((e) => {
              const drink = drinkById(e.drink);
              const left = entryAmountAt(e, now, halfLifeHours);
              return (
                <li key={e.id}>
                  <button type="button" className="entry" onClick={() => onEdit(e)}>
                    <span className="entry-icon">
                      <DrinkIcon kind={drink.icon} size={22} />
                    </span>
                    <span className="entry-main">
                      <span className="entry-name">
                        {drink.name}
                        {e.halfCaf && <span className="tag">half-caf</span>}
                      </span>
                      <span className="entry-time">{formatTime(e.at)}</span>
                    </span>
                    <span className="entry-amounts">
                      <span className="entry-mg">{e.mg} mg</span>
                      <span className="entry-left">{left >= 1 ? `${Math.round(left)} mg now` : "cleared"}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {entries.length > limit && (
        <button type="button" className="button button-quiet show-more" onClick={() => setLimit(limit + PAGE)}>
          Show older
        </button>
      )}
    </div>
  );
}

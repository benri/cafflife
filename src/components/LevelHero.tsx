import { DAILY_GUIDANCE_MG, levelAt, outlook } from "../domain/caffeine";
import { formatHours, formatTime, startOfDay } from "../domain/time";
import type { Entry } from "../domain/types";
import { ArrowIcon } from "./icons";

interface Props {
  entries: readonly Entry[];
  now: number;
  halfLifeHours: number;
}

export function LevelHero({ entries, now, halfLifeHours }: Props) {
  const level = levelAt(entries, now, halfLifeHours);
  const { trend, peak } = outlook(entries, now, halfLifeHours);

  const dayStart = startOfDay(now);
  const today = entries.filter((e) => e.at >= dayStart && e.at <= now);
  const todayMg = today.reduce((sum, e) => sum + e.mg, 0);
  const share = Math.min(1, todayMg / DAILY_GUIDANCE_MG);
  const over = todayMg > DAILY_GUIDANCE_MG;

  return (
    <section className="hero" aria-labelledby="hero-label">
      <p id="hero-label" className="eyebrow">In your system now</p>
      <p className="hero-value" aria-live="polite">
        {Math.round(level)}
        <span className="hero-unit">mg</span>
      </p>

      <p className={`hero-trend trend-${trend}`}>
        {trend === "rising" && peak && (
          <>
            <ArrowIcon direction="up" />
            <span>
              Still absorbing — peaks around{" "}
              <span className="nowrap">
                <strong>{Math.round(peak.mg)} mg</strong> at {formatTime(peak.t)}
              </span>
            </span>
          </>
        )}
        {trend === "falling" && (
          <>
            <ArrowIcon direction="down" />
            <span>
              Clearing — halves about every {formatHours(halfLifeHours)}
            </span>
          </>
        )}
        {trend === "flat" && <span>Nothing in your system. Log a drink below.</span>}
      </p>

      <div className="today">
        <div className="today-row">
          <span className="today-label">Today</span>
          <span className="today-value">
            {todayMg} mg
            <span className="today-sub">
              {" "}· {today.length} {today.length === 1 ? "drink" : "drinks"}
            </span>
          </span>
        </div>
        <div
          className={`meter${over ? " meter-over" : ""}`}
          role="meter"
          aria-label="Caffeine today versus 400 mg daily guidance"
          aria-valuemin={0}
          aria-valuemax={DAILY_GUIDANCE_MG}
          aria-valuenow={Math.min(todayMg, DAILY_GUIDANCE_MG)}
        >
          <div className="meter-fill" style={{ width: `${share * 100}%` }} />
        </div>
        <p className="today-note">
          {over
            ? `Over the ~${DAILY_GUIDANCE_MG} mg/day guidance for healthy adults`
            : `of ~${DAILY_GUIDANCE_MG} mg/day guidance for healthy adults`}
        </p>
      </div>
    </section>
  );
}

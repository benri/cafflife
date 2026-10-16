import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { DAILY_GUIDANCE_MG } from "../domain/caffeine";
import { computeInsights, type DayStat } from "../domain/insights";
import { dayLabel, formatTime, formatWeekday } from "../domain/time";
import type { Entry, Settings } from "../domain/types";
import { DrinkIcon } from "./icons";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
] as const;
const RANGE_KEY = "cafflife:insights-range";

interface Props {
  entries: readonly Entry[];
  now: number;
  settings: Settings;
}

export function Insights({ entries, now, settings }: Props) {
  const [rangeDays, setRangeDays] = useState(readRange);
  const ins = useMemo(() => computeInsights(entries, now, rangeDays, settings), [entries, now, rangeDays, settings]);

  function pickRange(days: number) {
    setRangeDays(days);
    try {
      localStorage.setItem(RANGE_KEY, String(days));
    } catch {
      // Not remembering the range is fine.
    }
  }

  if (entries.length === 0) {
    return (
      <section className="card insights-empty">
        <h2 className="section-title">Nothing to show yet</h2>
        <p className="card-sub">Log a few drinks on Today and your patterns will show up here.</p>
      </section>
    );
  }

  const target = settings.sleepTargetMg;
  const fromLabel = ins.days.length ? dayLabel(ins.days[0].day, now) : "";

  return (
    <>
      <div className="insights-head">
        <div className="zoom insights-range" role="group" aria-label="Range">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              className="zoom-button"
              aria-pressed={r.days === rangeDays}
              onClick={() => pickRange(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>
        {ins.clipped && <p className="card-sub">Since {fromLabel}, when your log starts</p>}
      </div>

      <div className="stats">
        <Stat
          label="Per day, on average"
          value={`${Math.round(ins.averageMg)} mg`}
          note={ins.averageOver > 1 ? `over ${ins.averageOver} days, not counting today` : "so far"}
        />
        <Stat
          label="Busiest day"
          value={ins.busiest ? `${ins.busiest.totalMg} mg` : "—"}
          note={ins.busiest ? dayLabel(ins.busiest.day, now) : "no drinks yet"}
        />
        <Stat
          label="Nights under target"
          value={ins.nightsCounted ? `${ins.nightsUnder} of ${ins.nightsCounted}` : "—"}
          note={`under ${target} mg at bedtime`}
        />
        <Stat
          wide
          label="Typical first · last cup"
          value={
            ins.firstCupMinutes === null || ins.lastCupMinutes === null
              ? "—"
              : `${clock(ins.firstCupMinutes)} · ${clock(ins.lastCupMinutes)}`
          }
          note="median times, on days with a drink"
        />
      </div>

      <section className="card" aria-labelledby="daily-title">
        <div className="card-header">
          <h2 id="daily-title" className="section-title">Caffeine per day</h2>
          <p className="card-sub">Everything you logged each day</p>
        </div>
        <ColumnChart
          days={ins.days}
          now={now}
          value={(d) => d.totalMg}
          reference={{ value: DAILY_GUIDANCE_MG, label: `${DAILY_GUIDANCE_MG} mg guidance` }}
          describe={(d) => `${d.totalMg} mg · ${d.drinks} ${d.drinks === 1 ? "drink" : "drinks"}`}
          title="Caffeine per day"
        />
      </section>

      <section className="card" aria-labelledby="bed-title">
        <div className="card-header">
          <h2 id="bed-title" className="section-title">At bedtime</h2>
          <p className="card-sub">Estimated caffeine left at your bedtime each night</p>
        </div>
        <ColumnChart
          days={ins.days}
          now={now}
          value={(d) => (d.bedtimeMg === null ? null : Math.round(d.bedtimeMg))}
          reference={{ value: target, label: `${target} mg target` }}
          describe={(d) =>
            d.bedtimeMg === null
              ? "tonight, not yet"
              : `${Math.round(d.bedtimeMg)} mg · ${d.bedtimeMg <= target ? "under" : "over"} target`
          }
          title="Caffeine at bedtime"
        />
      </section>

      {ins.byDrink.length > 0 && (
        <section className="card" aria-labelledby="drinks-title">
          <div className="card-header">
            <h2 id="drinks-title" className="section-title">By drink</h2>
            <p className="card-sub">Share of your caffeine over these {ins.days.length} days</p>
          </div>
          <ul className="drink-bars">
            {ins.byDrink.map((t) => {
              const total = ins.byDrink.reduce((s, x) => s + x.mg, 0);
              const share = total ? t.mg / total : 0;
              return (
                <li key={t.drink.id} className="drink-bar-row">
                  <span className="drink-bar-label">
                    <DrinkIcon kind={t.drink.icon} size={18} />
                    {t.drink.name}
                  </span>
                  <span className="drink-bar-value">
                    {t.mg} mg <span className="drink-bar-sub">· {t.count}×</span>
                  </span>
                  <span className="drink-bar-track" aria-hidden="true">
                    <span className="drink-bar-fill" style={{ width: `${Math.max(2, share * 100)}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

function Stat({ label, value, note, wide }: { label: string; value: string; note: string; wide?: boolean }) {
  return (
    <div className={`stat${wide ? " stat-wide" : ""}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-note">{note}</span>
    </div>
  );
}

// ---------- column chart ----------

const HEIGHT = 170;
const M = { top: 16, right: 8, bottom: 24, left: 38 };

interface ColumnChartProps {
  days: DayStat[];
  now: number;
  value: (d: DayStat) => number | null;
  reference: { value: number; label: string };
  describe: (d: DayStat) => string;
  title: string;
}

/** One column per day, a labelled reference line, and a tooltip per column. */
function ColumnChart({ days, now, value, reference, describe, title }: ColumnChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useWidth(wrapRef, 340);
  const [active, setActive] = useState<number | null>(null);

  const values = days.map(value);
  const max = Math.max(reference.value, ...values.map((v) => v ?? 0));
  const yMax = niceMax(max);
  const yTicks = [0, yMax / 2, yMax];
  const iw = Math.max(10, width - M.left - M.right);
  const ih = HEIGHT - M.top - M.bottom;
  const slot = iw / Math.max(1, days.length);
  const barW = Math.min(24, Math.max(3, slot - 2)); // ≤ 24 px, ≥ 2 px gap
  const xMid = (i: number) => M.left + slot * (i + 0.5);
  const y = (v: number) => M.top + ih - (v / yMax) * ih;
  const baseline = y(0);
  // Label about one day in every ~40 px.
  const labelEvery = Math.max(1, Math.ceil(40 / slot));

  function idxFrom(e: PointerEvent<SVGSVGElement>) {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left;
    return clamp(Math.floor((px - M.left) / slot), 0, days.length - 1);
  }

  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const from = active ?? days.length - 1;
      setActive(clamp(from + (e.key === "ArrowLeft" ? -1 : 1), 0, days.length - 1));
    } else if (e.key === "Escape") setActive(null);
  }

  const a = active === null ? null : days[active];
  const tipLeft = active === null ? 0 : clamp(xMid(active), 70, width - 70);
  const refY = y(reference.value);

  return (
    <div className="chart columns" ref={wrapRef}>
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="chart-svg"
        tabIndex={0}
        role="img"
        aria-label={`${title}, ${days.length} days. Use the arrow keys to read each day.`}
        onPointerMove={(e) => setActive(idxFrom(e))}
        onPointerDown={(e) => setActive(idxFrom(e))}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setActive(null);
        }}
        onFocus={() => setActive((i) => i ?? days.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line className="grid" x1={M.left} x2={M.left + iw} y1={y(v)} y2={y(v)} />
            <text className="axis-label" x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end">
              {Math.round(v)}
            </text>
          </g>
        ))}

        {active !== null && (
          <rect className="column-hover" x={M.left + slot * active} y={M.top} width={slot} height={ih} />
        )}

        {days.map((d, i) => {
          const v = values[i];
          if (v === null || v <= 0) return null;
          const h = baseline - y(v);
          const r = Math.min(4, h, barW / 2);
          const x0 = xMid(i) - barW / 2;
          return (
            <path
              key={d.day}
              className={`column${d.day === startOfToday(now) ? " column-today" : ""}`}
              d={`M${x0},${baseline}V${baseline - h + r}Q${x0},${baseline - h} ${x0 + r},${baseline - h}H${x0 + barW - r}Q${x0 + barW},${baseline - h} ${x0 + barW},${baseline - h + r}V${baseline}Z`}
            />
          );
        })}

        <line className="reference-line" x1={M.left} x2={M.left + iw} y1={refY} y2={refY} />
        <text className="axis-label reference-label" x={M.left + iw} y={refY - 5} textAnchor="end">
          {reference.label}
        </text>

        {days.map((d, i) =>
          (days.length - 1 - i) % labelEvery === 0 ? (
            <text key={d.day} className="axis-label" x={xMid(i)} y={HEIGHT - 6} textAnchor="middle">
              {days.length <= 7 ? formatWeekday(d.day) : shortDate(d.day)}
            </text>
          ) : null,
        )}
        <line className="baseline" x1={M.left} x2={M.left + iw} y1={baseline} y2={baseline} />
      </svg>

      {a && (
        <div className="tooltip" style={{ left: tipLeft }} role="status">
          <div className="tooltip-value">{describe(a)}</div>
          <div className="tooltip-time">{dayLabel(a.day, now)}</div>
        </div>
      )}
    </div>
  );
}

function startOfToday(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const shortDateFmt = new Intl.DateTimeFormat(undefined, { month: "numeric", day: "numeric" });
function shortDate(ms: number): string {
  return shortDateFmt.format(ms);
}

function clock(minutes: number): string {
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return formatTime(d.getTime());
}

function niceMax(v: number): number {
  const steps = [100, 200, 300, 400, 500, 600, 800, 1000, 1200, 1600, 2000];
  return steps.find((s) => s >= v * 1.1) ?? Math.ceil((v * 1.1) / 500) * 500;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function readRange(): number {
  try {
    const n = Number(localStorage.getItem(RANGE_KEY));
    if (RANGES.some((r) => r.days === n)) return n;
  } catch {
    // Storage blocked: use the default.
  }
  return 7;
}

function useWidth(ref: RefObject<HTMLElement | null>, fallback: number): number {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || fallback);
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width) || fallback));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, fallback]);
  return width;
}

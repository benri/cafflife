import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import { sampleLevels, type Point } from "../domain/caffeine";
import { drinkById } from "../domain/drinks";
import { formatHour, formatTime, formatWeekday, formatWhen, HOUR, MINUTE } from "../domain/time";
import type { Entry } from "../domain/types";

const PAST_HOURS = 24;
const FUTURE_HOURS = 12;
const STEP = 5 * MINUTE;
const HEIGHT = 220;
const M = { top: 22, right: 12, bottom: 26, left: 38 };

interface Props {
  entries: readonly Entry[];
  now: number;
  halfLifeHours: number;
}

export function CaffeineChart({ entries, now, halfLifeHours }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const width = useWidth(wrapRef, 360);
  const [hover, setHover] = useState<number | null>(null);

  // Align to the minute so "now" is always exactly one of the samples.
  const nowMin = Math.floor(now / MINUTE) * MINUTE;
  const start = nowMin - PAST_HOURS * HOUR;
  const end = nowMin + FUTURE_HOURS * HOUR;
  const nowIdx = (PAST_HOURS * HOUR) / STEP;

  const points = useMemo(
    () => sampleLevels(entries, start, end, STEP, halfLifeHours),
    [entries, start, end, halfLifeHours],
  );

  const maxMg = points.reduce((m, p) => Math.max(m, p.mg), 0);
  const yMax = niceMax(maxMg);
  const yTicks = ticksFor(yMax);
  const iw = Math.max(10, width - M.left - M.right);
  // Every 6 h normally; every 12 h when the chart is too narrow for that.
  const tickHours = iw / ((PAST_HOURS + FUTURE_HOURS) / 6) < 52 ? 12 : 6;
  const xTicks = useMemo(() => hourTicks(start, end, tickHours), [start, end, tickHours]);
  const showForecastLabel = (iw * FUTURE_HOURS) / (PAST_HOURS + FUTURE_HOURS) > 90;
  const ih = HEIGHT - M.top - M.bottom;
  const x = (t: number) => M.left + ((t - start) / (end - start)) * iw;
  const y = (mg: number) => M.top + ih - (mg / yMax) * ih;
  const baseline = y(0);

  const past = points.slice(0, nowIdx + 1);
  const future = points.slice(nowIdx);
  const line = (pts: Point[]) =>
    pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.mg).toFixed(1)}`).join("");
  const area = (pts: Point[]) =>
    `${line(pts)}L${x(pts[pts.length - 1].t).toFixed(1)},${baseline}L${x(pts[0].t).toFixed(1)},${baseline}Z`;

  const visible = entries.filter((e) => e.at >= start && e.at <= end);
  const nowPoint = points[nowIdx];

  const hovered = hover === null ? null : points[hover];
  const nearbyDrinks = hovered
    ? visible.filter((e) => Math.abs(e.at - hovered.t) <= 15 * MINUTE)
    : [];

  function idxFromClientX(clientX: number, rect: DOMRect): number {
    const px = clientX - rect.left;
    const t = start + ((px - M.left) / iw) * (end - start);
    return clamp(Math.round((t - start) / STEP), 0, points.length - 1);
  }

  function onPointer(e: PointerEvent<SVGSVGElement>) {
    setHover(idxFromClientX(e.clientX, e.currentTarget.getBoundingClientRect()));
  }

  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    const stepBy = e.shiftKey ? 12 : 3; // 1 h or 15 min
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const from = hover ?? nowIdx;
      setHover(clamp(from + (e.key === "ArrowLeft" ? -stepBy : stepBy), 0, points.length - 1));
    } else if (e.key === "Home") {
      setHover(0);
    } else if (e.key === "End") {
      setHover(points.length - 1);
    } else if (e.key === "Escape") {
      setHover(null);
    }
  }

  const tipLeft = hovered ? clamp(x(hovered.t), 72, width - 72) : 0;

  return (
    <div className="chart" ref={wrapRef}>
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="chart-svg"
        tabIndex={0}
        role="img"
        aria-label={`Caffeine over the last ${PAST_HOURS} hours and the next ${FUTURE_HOURS} hours. Now ${Math.round(
          nowPoint.mg,
        )} mg. Highest in this window ${Math.round(maxMg)} mg. Use the arrow keys to explore.`}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setHover(null);
        }}
        onPointerCancel={() => setHover(null)}
        onFocus={() => setHover((h) => h ?? nowIdx)}
        onBlur={() => setHover(null)}
        onKeyDown={onKey}
      >
        {/* grid */}
        {yTicks.map((v) => (
          <g key={v}>
            <line className="grid" x1={M.left} x2={M.left + iw} y1={y(v)} y2={y(v)} />
            <text className="axis-label" x={M.left - 6} y={y(v)} dy="0.32em" textAnchor="end">
              {v}
            </text>
          </g>
        ))}
        {xTicks
          .filter((t) => x(t) > M.left + 16 && x(t) < M.left + iw - 16)
          .map((t) => (
            <text key={t} className="axis-label" x={x(t)} y={HEIGHT - 6} textAnchor="middle">
              {new Date(t).getHours() === 0 ? formatWeekday(t) : formatHour(t)}
            </text>
          ))}

        {/* forecast region */}
        <rect className="forecast-bg" x={x(nowMin)} y={M.top} width={M.left + iw - x(nowMin)} height={ih} />
        {showForecastLabel && (
          <text className="axis-label forecast-label" x={M.left + iw - 4} y={M.top - 8} textAnchor="end">
            forecast
          </text>
        )}

        {/* the curve */}
        <path className="area-past" d={area(past)} />
        <path className="area-future" d={area(future)} />
        <path className="line-past" d={line(past)} />
        <path className="line-future" d={line(future)} />

        {/* now */}
        <line className="now-line" x1={x(nowMin)} x2={x(nowMin)} y1={M.top - 4} y2={baseline} />
        <text className="axis-label now-label" x={x(nowMin)} y={M.top - 8} textAnchor="middle">
          now
        </text>

        {/* drinks along the baseline */}
        {visible.map((e) => (
          <circle key={e.id} className="drink-dot" cx={x(e.at)} cy={baseline} r={4}>
            <title>{`${drinkById(e.drink).name} · ${e.mg} mg · ${formatTime(e.at)}`}</title>
          </circle>
        ))}

        <circle className="now-dot" cx={x(nowMin)} cy={y(nowPoint.mg)} r={4.5} />

        {/* crosshair */}
        {hovered && (
          <g className="crosshair" pointerEvents="none">
            <line x1={x(hovered.t)} x2={x(hovered.t)} y1={M.top} y2={baseline} />
            <circle className="hover-dot" cx={x(hovered.t)} cy={y(hovered.mg)} r={4.5} />
          </g>
        )}
        <line className="baseline" x1={M.left} x2={M.left + iw} y1={baseline} y2={baseline} />
      </svg>

      {hovered && (
        <div className="tooltip" style={{ left: tipLeft }} role="status">
          <div className="tooltip-value">{Math.round(hovered.mg)} mg</div>
          <div className="tooltip-time">
            {formatWhen(hovered.t, now)}
            {hovered.t > nowMin ? " · forecast" : ""}
          </div>
          {nearbyDrinks.map((e) => (
            <div key={e.id} className="tooltip-drink">
              <span className="tooltip-key" />
              {drinkById(e.drink).name} · {e.mg} mg
            </div>
          ))}
        </div>
      )}
    </div>
  );
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

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Round the top of the y-axis up to a clean value with a little headroom. */
function niceMax(maxMg: number): number {
  const target = Math.max(100, maxMg * 1.1);
  const steps = [100, 150, 200, 250, 300, 400, 500, 600, 800, 1000];
  return steps.find((s) => s >= target) ?? Math.ceil(target / 500) * 500;
}

function ticksFor(yMax: number): number[] {
  const step = yMax <= 300 ? 50 : yMax <= 600 ? 100 : yMax <= 1000 ? 200 : 500;
  const ticks: number[] = [];
  for (let v = 0; v <= yMax; v += step) ticks.push(v);
  return ticks;
}

/** Local-clock ticks every `every` hours (e.g. 12 AM, 6 AM, 12 PM, 6 PM). */
function hourTicks(start: number, end: number, every: number): number[] {
  const d = new Date(start);
  d.setMinutes(0, 0, 0);
  while (d.getTime() < start || d.getHours() % every !== 0) d.setHours(d.getHours() + 1);
  const ticks: number[] = [];
  while (d.getTime() <= end) {
    ticks.push(d.getTime());
    d.setHours(d.getHours() + every);
  }
  return ticks;
}

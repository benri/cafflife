import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { sampleLevels, type Point } from "../domain/caffeine";
import { drinkById } from "../domain/drinks";
import { bedtimesBetween } from "../domain/sleep";
import { dayLabel, formatHour, formatTime, formatWeekday, formatWhen, HOUR, MINUTE } from "../domain/time";
import type { Entry } from "../domain/types";

interface Zoom {
  id: string;
  label: string;
  pastHours: number;
  futureHours: number;
  /** Sample spacing: coarser for wide windows, so they stay quick to draw. */
  step: number;
  /** How far the ‹ / › buttons (and Page Up / Page Down) move. */
  pan: number;
}

const ZOOMS: readonly Zoom[] = [
  { id: "12h", label: "12 h", pastHours: 9, futureHours: 3, step: 5 * MINUTE, pan: 4 * HOUR },
  { id: "1d", label: "1 day", pastHours: 24, futureHours: 12, step: 5 * MINUTE, pan: 12 * HOUR },
  { id: "3d", label: "3 days", pastHours: 66, futureHours: 6, step: 15 * MINUTE, pan: 24 * HOUR },
  { id: "1w", label: "1 week", pastHours: 162, futureHours: 6, step: 30 * MINUTE, pan: 72 * HOUR },
];
const DEFAULT_ZOOM = "1d";
const ZOOM_KEY = "cafflife:chart-zoom";

/** Lookback stops this long before the first logged drink. */
const LOOKBACK_MARGIN = 6 * HOUR;
const HEIGHT = 220;
const M = { top: 22, right: 12, bottom: 26, left: 38 };

interface Props {
  entries: readonly Entry[];
  now: number;
  halfLifeHours: number;
  bedtimeMinutes: number;
}

export function CaffeineChart({ entries, now, halfLifeHours, bedtimeMinutes }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const width = useWidth(wrapRef, 360);
  const [hover, setHover] = useState<number | null>(null);
  // How far the window has been scrolled back from the default (ms, a
  // multiple of the step). 0 = ending just after now.
  const [offsetRaw, setOffset] = useState(0);
  const [zoomId, setZoomId] = useState(readZoom);
  const zoom = ZOOMS.find((z) => z.id === zoomId) ?? ZOOMS[1];
  const { pastHours: PAST_HOURS, futureHours: FUTURE_HOURS, step: STEP, pan: PAN } = zoom;

  // Align to the minute so "now" is always exactly one of the samples.
  const nowMin = Math.floor(now / MINUTE) * MINUTE;
  const earliest = entries.reduce((m, e) => Math.min(m, e.at), Infinity);
  const maxOffset = Number.isFinite(earliest)
    ? Math.max(0, Math.ceil((nowMin - PAST_HOURS * HOUR - (earliest - LOOKBACK_MARGIN)) / STEP) * STEP)
    : 0;
  const offset = Math.min(Math.round(offsetRaw / STEP) * STEP, maxOffset);
  const start = nowMin - PAST_HOURS * HOUR - offset;
  const end = nowMin + FUTURE_HOURS * HOUR - offset;
  // Index of the "now" sample. Past the last sample once you scroll back
  // more than the 12 h forecast.
  const nowIdx = (nowMin - start) / STEP;
  const nowInView = nowMin <= end;

  const points = useMemo(
    () => sampleLevels(entries, start, end, STEP, halfLifeHours),
    [entries, start, end, STEP, halfLifeHours],
  );

  const maxMg = points.reduce((m, p) => Math.max(m, p.mg), 0);
  const yMax = niceMax(maxMg);
  const yTicks = ticksFor(yMax);
  const iw = Math.max(10, width - M.left - M.right);
  // The densest of 3 / 6 / 12 h that leaves room for "12 PM"-style labels;
  // daily (at midnight, labelled with the weekday) for the wide views.
  const pxPerHour = iw / (PAST_HOURS + FUTURE_HOURS);
  const tickHours = [3, 6, 12].find((h) => h * pxPerHour >= 52) ?? 24;
  const xTicks = useMemo(() => hourTicks(start, end, tickHours), [start, end, tickHours]);
  const ih = HEIGHT - M.top - M.bottom;
  const x = (t: number) => M.left + ((t - start) / (end - start)) * iw;
  const y = (mg: number) => M.top + ih - (mg / yMax) * ih;
  const baseline = y(0);

  const lastIdx = points.length - 1;
  const past = points.slice(0, Math.min(nowIdx, lastIdx) + 1);
  const future = nowInView ? points.slice(nowIdx) : [];
  const line = (pts: Point[]) =>
    pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.mg).toFixed(1)}`).join("");
  const area = (pts: Point[]) =>
    `${line(pts)}L${x(pts[pts.length - 1].t).toFixed(1)},${baseline}L${x(pts[0].t).toFixed(1)},${baseline}Z`;

  const visible = entries.filter((e) => e.at >= start && e.at <= end);
  const beds = bedtimesBetween(start, end, bedtimeMinutes).filter(
    (t) => x(t) > M.left + 4 && x(t) < M.left + iw - 4,
  );
  const showForecastLabel = nowInView && M.left + iw - x(nowMin) > 90;
  // Label one bedtime only (the latest with room: clear of "now" and of the
  // "forecast" label). The dashed lines mark the rest.
  const labelledBed = beds
    .filter((t) => Math.abs(x(t) - x(nowMin)) > 30 && !(showForecastLabel && x(t) > M.left + iw - 80))
    .at(-1);
  const nowPoint = nowInView ? points[nowIdx] : null;
  const defaultIdx = Math.min(nowIdx, lastIdx);

  // Panning keeps the crosshair on the same moment where it can.
  function pan(by: number) {
    const next = clamp(offset + by, 0, maxOffset);
    if (next === offset) return;
    setOffset(next);
    setHover((h) => (h === null ? null : clamp(h + (next - offset) / STEP, 0, lastIdx)));
  }

  // Sideways trackpad / shift+wheel scrolling pans the window. A native,
  // non-passive listener so the page doesn't also scroll sideways; vertical
  // scrolls are left alone so the page still scrolls past the chart.
  const wheel = useRef({ msPerPx: 0, maxOffset: 0, step: STEP, carry: 0 });
  wheel.current.msPerPx = (end - start) / iw;
  wheel.current.maxOffset = maxOffset;
  wheel.current.step = STEP;
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const dx = e.deltaX || (e.shiftKey ? e.deltaY : 0);
      if (!dx || Math.abs(dx) < Math.abs(e.shiftKey ? 0 : e.deltaY)) return;
      e.preventDefault();
      const w = wheel.current;
      const px = e.deltaMode === 1 ? dx * 16 : dx;
      w.carry -= px * w.msPerPx;
      const steps = Math.trunc(w.carry / w.step);
      if (!steps) return;
      w.carry -= steps * w.step;
      setOffset((o) => clamp(Math.min(o, w.maxOffset) + steps * w.step, 0, w.maxOffset));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const hovered = hover === null ? null : points[hover];
  const nearbyDrinks = hovered
    ? visible.filter((e) => Math.abs(e.at - hovered.t) <= Math.max(15 * MINUTE, STEP))
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
    // 15 min, or 1 h with Shift (at least one sample).
    const stepBy = Math.max(1, Math.round(((e.shiftKey ? 60 : 15) * MINUTE) / STEP));
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const from = hover ?? defaultIdx;
      setHover(clamp(from + (e.key === "ArrowLeft" ? -stepBy : stepBy), 0, points.length - 1));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      pan(e.key === "PageUp" ? PAN : -PAN);
    } else if (e.key === "+" || e.key === "=" || e.key === "-") {
      const i = ZOOMS.indexOf(zoom) + (e.key === "-" ? 1 : -1);
      if (ZOOMS[i]) changeZoom(ZOOMS[i].id);
    } else if (e.key === "Home") {
      setHover(0);
    } else if (e.key === "End") {
      setHover(points.length - 1);
    } else if (e.key === "Escape") {
      setHover(null);
    }
  }

  function changeZoom(id: string) {
    setZoomId(id);
    setHover(null);
    try {
      localStorage.setItem(ZOOM_KEY, id);
    } catch {
      // Not remembering the zoom is fine.
    }
  }

  const tipLeft = hovered ? clamp(x(hovered.t), 72, width - 72) : 0;
  const rangeLabel =
    offset === 0
      ? PAST_HOURS <= 24
        ? `Last ${PAST_HOURS} h · next ${FUTURE_HOURS} h`
        : `From ${dayLabel(start, now)}, ${formatHour(start)} · next ${FUTURE_HOURS} h`
      : `${formatWeekday(start)} ${formatHour(start)} – ${formatWeekday(end)} ${formatHour(end)}`;

  return (
    <div className="chart" ref={wrapRef}>
      <div className="zoom" role="group" aria-label="Time span">
        {ZOOMS.map((z) => (
          <button
            key={z.id}
            type="button"
            className="zoom-button"
            aria-pressed={z.id === zoom.id}
            onClick={() => changeZoom(z.id)}
          >
            {z.label}
          </button>
        ))}
      </div>
      <svg
        ref={svgRef}
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="chart-svg"
        tabIndex={0}
        role="img"
        aria-label={`Caffeine from ${formatWhen(start, now)} to ${formatWhen(end, now)}.${
          nowPoint ? ` Now ${Math.round(nowPoint.mg)} mg.` : ""
        } Highest in this window ${Math.round(maxMg)} mg. Use the arrow keys to explore, and Page Up or Page Down to look further back or forward.`}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setHover(null);
        }}
        onPointerCancel={() => setHover(null)}
        onFocus={() => setHover((h) => h ?? defaultIdx)}
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
        {nowInView && (
          <rect className="forecast-bg" x={x(nowMin)} y={M.top} width={M.left + iw - x(nowMin)} height={ih} />
        )}
        {showForecastLabel && (
          <text className="axis-label forecast-label" x={M.left + iw - 4} y={M.top - 8} textAnchor="end">
            forecast
          </text>
        )}

        {/* the curve */}
        <path className="area-past" d={area(past)} />
        {future.length > 1 && <path className="area-future" d={area(future)} />}
        <path className="line-past" d={line(past)} />
        {future.length > 1 && <path className="line-future" d={line(future)} />}

        {/* bedtimes */}
        {beds.map((t) => (
          <g key={t} className="bed-marker" pointerEvents="none">
            <line x1={x(t)} x2={x(t)} y1={M.top} y2={baseline} />
            {t === labelledBed && (
              <text className="axis-label bed-label" x={x(t)} y={M.top - 8} textAnchor="middle">
                bed
              </text>
            )}
          </g>
        ))}

        {/* now */}
        {nowInView && (
          <>
            <line className="now-line" x1={x(nowMin)} x2={x(nowMin)} y1={M.top - 4} y2={baseline} />
            <text className="axis-label now-label" x={x(nowMin)} y={M.top - 8} textAnchor="middle">
              now
            </text>
          </>
        )}

        {/* drinks along the baseline */}
        {visible.map((e) => (
          <circle key={e.id} className="drink-dot" cx={x(e.at)} cy={baseline} r={4}>
            <title>{`${drinkById(e.drink).name} · ${e.mg} mg · ${formatTime(e.at)}`}</title>
          </circle>
        ))}

        {nowPoint && <circle className="now-dot" cx={x(nowMin)} cy={y(nowPoint.mg)} r={4.5} />}

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

      <div className="chart-nav">
        <button
          type="button"
          className="chip chip-arrow"
          aria-label="Earlier"
          onClick={() => pan(PAN)}
          disabled={offset >= maxOffset}
        >
          ‹
        </button>
        <span className="chart-range">{rangeLabel}</span>
        {offset > 0 ? (
          <button type="button" className="chip" onClick={() => pan(-offset)}>
            Now
          </button>
        ) : null}
        <button
          type="button"
          className="chip chip-arrow"
          aria-label="Later"
          onClick={() => pan(-PAN)}
          disabled={offset === 0}
        >
          ›
        </button>
      </div>
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

function readZoom(): string {
  try {
    const id = localStorage.getItem(ZOOM_KEY);
    if (id && ZOOMS.some((z) => z.id === id)) return id;
  } catch {
    // Storage blocked: use the default.
  }
  return DEFAULT_ZOOM;
}

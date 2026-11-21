import { useEffect, useRef, useState } from 'react';

export interface Datum { label: string; value: number; sub?: string }

/**
 * Column chart: one series, one colour. Bars are thin (24px max) with a rounded top and a flat base,
 * gridlines are hairlines, and the exact values are in a hidden table for screen readers.
 */
export function ColumnChart({ data, title, unit = '' }: { data: Datum[]; title: string; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the real pixel width so text stays a readable size on any card
  const box = useRef<HTMLElement>(null);
  const [W, setW] = useState(420);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setW(Math.max(240, Math.round(el.clientWidth))));
    ro.observe(el);
    setW(Math.max(240, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, []);
  const H = 200, padL = 30, padB = 26, padT = 12, padR = 6;
  const max = Math.max(1, ...data.map((d) => d.value));
  const top = niceMax(max);
  const ticks = [0, top / 2, top];
  const iw = W - padL - padR, ih = H - padT - padB;
  const slot = iw / Math.max(1, data.length);
  const bw = Math.min(24, slot * 0.6);
  const every = slot < 52 ? 2 : 1; // thin out the labels instead of letting them collide
  const y = (v: number) => padT + ih - (v / top) * ih;
  return (
    <figure ref={box} className="relative m-0" aria-label={title}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--c-faint)">{fmtTick(t)}</text>
          </g>
        ))}
        {data.map((d, n) => {
          const x = padL + slot * n + (slot - bw) / 2;
          const h = Math.max(d.value > 0 ? 2 : 0, (d.value / top) * ih);
          const r = Math.min(4, bw / 2, h);
          return (
            <g key={d.label} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(n)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${d.label}: ${d.value}${unit}`}>
              <rect x={padL + slot * n} y={padT} width={slot} height={ih + padB} fill="transparent" />
              {h > 0 && <path d={`M${x},${y(0)} V${y(0) - h + r} Q${x},${y(0) - h} ${x + r},${y(0) - h} H${x + bw - r} Q${x + bw},${y(0) - h} ${x + bw},${y(0) - h + r} V${y(0)} Z`} fill="var(--accent-ui)" opacity={hover === null || hover === n ? 1 : 0.45} />}
              {(data.length - 1 - n) % every === 0 && <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--c-muted)">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border bg-surface px-2.5 py-1.5 text-xs shadow-lg" style={{ left: Math.min(W - 60, Math.max(60, padL + slot * hover + slot / 2)), top: 0 }}>
          <div className="font-semibold tabular-nums">{data[hover].value}{unit}</div>
          <div className="text-muted">{data[hover].sub ?? data[hover].label}</div>
        </div>
      )}
      <table className="sr-only"><caption>{title}</caption><tbody>{data.map((d) => <tr key={d.label}><th>{d.sub ?? d.label}</th><td>{d.value}{unit}</td></tr>)}</tbody></table>
    </figure>
  );
}

/** Horizontal bars with the value at the tip. One series. */
export function BarList({ data, title, format }: { data: Datum[]; title: string; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = format ?? ((n: number) => String(n));
  return (
    <ul aria-label={title} className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3 text-sm" title={`${d.label}: ${fmt(d.value)}`}>
          <span className="truncate text-muted">{d.label}</span>
          <span className="h-3 rounded-full bg-surface2">
            <span className="block h-3" style={{ width: `${Math.max(d.value > 0 ? 2 : 0, (d.value / max) * 100)}%`, background: 'var(--accent-ui)', borderRadius: '0 4px 4px 0' }} />
          </span>
          <span className="w-12 text-right tabular-nums">{fmt(d.value)}</span>
        </li>
      ))}
    </ul>
  );
}

function niceMax(v: number): number {
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return Math.max(2, step * pow);
}
function fmtTick(n: number): string {
  return n >= 1000 ? `${n / 1000}K` : Number.isInteger(n) ? String(n) : n.toFixed(1);
}

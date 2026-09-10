'use client';

import { DEP_SHORT, DEP_VAR, STATE_LABEL, STATE_VAR, type ShotState } from '@/lib/types';

export function DepChip({ dep, big = false }: { dep: string; big?: boolean }) {
  if (!dep) return null;
  const c = DEP_VAR[dep] ?? 'var(--ink-3)';
  return (
    <span
      className="chip"
      style={{
        color: c,
        borderColor: c,
        fontSize: big ? 12 : 10.5,
        padding: big ? '3px 12px' : '2px 9px',
      }}
    >
      {DEP_SHORT[dep] ?? dep}
    </span>
  );
}

export function StateChip({ state, pct }: { state: ShotState; pct?: number | null }) {
  const c = STATE_VAR[state];
  return (
    <span className="chip" style={{ color: c, borderColor: c }}>
      {STATE_LABEL[state]}
      {state === 'partial' && pct ? ` ${pct}%` : ''}
    </span>
  );
}

export function Meta({ label, value, color }: { label: string; value: string; color?: string }) {
  if (!value) return null;
  return (
    <div style={{ fontSize: 12, color: color ?? 'var(--ink-2)', lineHeight: 1.55 }}>
      <span style={{ color: 'var(--ink-3)' }}>{label} </span>
      {value}
    </div>
  );
}

export function SyncBadge({
  sync,
  queued,
  onClick,
}: {
  sync: string;
  queued: number;
  onClick?: () => void;
}) {
  const map: Record<string, [string, string]> = {
    idle: ['var(--ink-3)', 'מחובר'],
    syncing: ['var(--st-partial)', 'שומר'],
    ok: ['var(--st-done)', 'נשמר'],
    queued: ['var(--st-partial)', 'ממתין'],
    offline: ['var(--st-delayed)', 'אין רשת — נשמר במכשיר'],
    error: ['var(--st-skipped)', 'לא נשמר — ננסה שוב'],
  };
  const [color, title] = map[sync] ?? map.idle;
  return (
    <button
      onClick={onClick}
      className="tap chip"
      title={queued ? `${title} (${queued})` : title}
      aria-label={queued ? `${title}, ${queued} ממתינים` : title}
      style={{
        color,
        borderColor: color,
        minHeight: 40,
        padding: '0 12px',
        background: 'var(--surface)',
        cursor: 'pointer',
        fontWeight: queued ? 800 : 600,
      }}
    >
      {sync === 'offline' ? '⚠' : sync === 'error' ? '⚠' : '☁'}
      {queued > 0 && <span className="mono">{queued}</span>}
    </button>
  );
}

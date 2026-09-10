'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Production, Shot, ShotStatus } from '@/lib/types';
import { DEP_SHORT, DEP_VAR } from '@/lib/types';
import { useBoard, type StatusPatch } from '@/lib/useBoard';
import { shift } from '@/lib/time';
import ThemeToggle from './ThemeToggle';
import { SyncBadge } from './chips';
import SetMode from './SetMode';
import ListMode from './ListMode';
import StatusSheet from './StatusSheet';

type Mode = 'set' | 'list';

export default function Board({
  production,
  shots: initialShots,
  status: initialStatus,
}: {
  production: Production;
  shots: Shot[];
  status: ShotStatus[];
}) {
  const { shots, status, sync, queued, setShotStatus, stateOf, tsOf, flush } = useBoard(
    production.id,
    initialShots,
    initialStatus,
  );

  const days = useMemo(() => {
    const out: string[] = [];
    for (const s of shots) if (s.day && !out.includes(s.day)) out.push(s.day);
    return out;
  }, [shots]);

  const [day, setDay] = useState(() => days[0] ?? '');
  const [mode, setMode] = useState<Mode>('set');
  const [depFilter, setDepFilter] = useState('all');
  const [sel, setSel] = useState<Shot | null>(null);

  const curDay = days.includes(day) ? day : (days[0] ?? '');
  const dayShots = useMemo(
    () => shots.filter((s) => !curDay || s.day === curDay),
    [shots, curDay],
  );
  const real = useMemo(() => dayShots.filter((s) => !s.is_break), [dayShots]);

  const deps = useMemo(() => {
    const out: string[] = [];
    for (const s of real) if (s.dep && !out.includes(s.dep)) out.push(s.dep);
    return out;
  }, [real]);

  const filtered = useMemo(
    () => (depFilter === 'all' ? dayShots : dayShots.filter((s) => s.is_break || s.dep === depFilter)),
    [dayShots, depFilter],
  );

  const total = real.length;
  const done = real.filter((s) => stateOf(s.id) === 'done').length;
  const partial = real.filter((s) => stateOf(s.id) === 'partial').length;
  const pct = total ? Math.round(((done + partial * 0.5) / total) * 100) : 0;

  function mark(shotId: string, p: StatusPatch) {
    setShotStatus(shotId, p);
    setSel(null);
  }

  /** דחיית כל מה שטרם בוצע ביום הנוכחי */
  function delayDay(mins: number) {
    for (const s of real) {
      const st = stateOf(s.id);
      if (st !== 'pending' && st !== 'partial') continue;
      const base = tsOf(s);
      if (base) setShotStatus(s.id, { ts_override: shift(base, mins) });
    }
  }

  return (
    <main style={{ minHeight: '100dvh' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'var(--bg)',
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '11px 13px 9px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 9,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <Link
                href="/"
                className="tap chip"
                title="כל הברייקדאונים"
                style={{
                  background: 'var(--surface)',
                  color: 'var(--ink-2)',
                  minHeight: 40,
                  padding: '0 12px',
                  textDecoration: 'none',
                  flexShrink: 0,
                }}
              >
                →
              </Link>
              <h1
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 800,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {production.name}
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <SyncBadge sync={sync} queued={queued} onClick={() => void flush()} />
              <ThemeToggle compact />
            </div>
          </div>

          {/* התקדמות */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
            <div
              style={{
                flex: 1,
                height: 6,
                background: 'var(--surface-2)',
                border: '1px solid var(--rule-2)',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--st-done)' }} />
            </div>
            <span
              className="mono"
              style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700, whiteSpace: 'nowrap' }}
            >
              {done}/{total} · {pct}%
            </span>
          </div>

          {/* מצב */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            {(['set', 'list'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="tap"
                style={{
                  flex: 1,
                  minHeight: 40,
                  borderRadius: 9,
                  border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--rule)'}`,
                  background: mode === m ? 'var(--accent)' : 'var(--surface)',
                  color: mode === m ? '#fff' : 'var(--ink-2)',
                  fontSize: 13.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {m === 'set' ? 'סט' : 'לו״ז מלא'}
              </button>
            ))}
            <button
              onClick={() => {
                const v = prompt('לדחות את כל מה שטרם בוצע היום בכמה דקות?', '30');
                const n = Number(v);
                if (n > 0) delayDay(n);
              }}
              className="tap chip"
              title="דחיית לו״ז"
              style={{
                background: 'var(--surface)',
                color: 'var(--st-delayed)',
                borderColor: 'var(--st-delayed)',
                minHeight: 40,
                padding: '0 13px',
                cursor: 'pointer',
                fontSize: 15,
              }}
            >
              ⏰
            </button>
          </div>

          {/* ימים */}
          {days.length > 1 && (
            <div
              className="no-scrollbar"
              style={{ display: 'flex', gap: 6, marginTop: 9, overflowX: 'auto' }}
            >
              {days.map((d) => {
                const dc = shots.filter((s) => s.day === d && !s.is_break);
                const dd = dc.filter((s) => stateOf(s.id) === 'done').length;
                const on = curDay === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDay(d)}
                    className="tap"
                    style={{
                      flexShrink: 0,
                      minHeight: 40,
                      padding: '0 13px',
                      borderRadius: 9,
                      border: `1px solid ${on ? 'var(--ink)' : 'var(--rule)'}`,
                      background: on ? 'var(--ink)' : 'var(--surface)',
                      color: on ? 'var(--bg)' : 'var(--ink-2)',
                      fontSize: 12.5,
                      fontWeight: on ? 800 : 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d}{' '}
                    <span className="mono" style={{ opacity: 0.75, fontSize: 11 }}>
                      {dd}/{dc.length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* תלות קאסט */}
          {mode === 'list' && deps.length > 1 && (
            <div
              className="no-scrollbar"
              style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto' }}
            >
              <FilterPill on={depFilter === 'all'} onClick={() => setDepFilter('all')}>
                הכל
              </FilterPill>
              {deps.map((d) => (
                <FilterPill
                  key={d}
                  on={depFilter === d}
                  color={DEP_VAR[d]}
                  onClick={() => setDepFilter(depFilter === d ? 'all' : d)}
                >
                  {DEP_SHORT[d] ?? d}
                </FilterPill>
              ))}
            </div>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '14px 13px 90px' }}>
        {mode === 'set' ? (
          <SetMode
            shots={dayShots}
            status={status}
            tsOf={tsOf}
            onMark={mark}
            onOpen={(s) => setSel(s)}
          />
        ) : (
          <ListMode shots={filtered} status={status} tsOf={tsOf} onOpen={(s) => setSel(s)} />
        )}
      </div>

      {sel && (
        <StatusSheet
          shot={sel}
          status={status[sel.id]}
          ts={tsOf(sel)}
          onSave={(p) => mark(sel.id, p)}
          onClose={() => setSel(null)}
        />
      )}
    </main>
  );
}

function FilterPill({
  on,
  color,
  onClick,
  children,
}: {
  on: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const c = color ?? 'var(--ink-2)';
  return (
    <button
      onClick={onClick}
      className="chip"
      style={{
        flexShrink: 0,
        minHeight: 34,
        cursor: 'pointer',
        color: on ? '#fff' : c,
        background: on ? c : 'var(--surface)',
        borderColor: c,
      }}
    >
      {children}
    </button>
  );
}

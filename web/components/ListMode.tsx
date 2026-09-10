'use client';

import type { Shot, ShotStatus } from '@/lib/types';
import { STATE_VAR } from '@/lib/types';
import { startMin } from '@/lib/time';
import { DepChip, StateChip } from './chips';

/** הלו״ז המלא של היום, מקובץ לפי בלוקי שעה, כולל שורות המקטע. */
export default function ListMode({
  shots,
  status,
  tsOf,
  onOpen,
}: {
  shots: Shot[];
  status: Record<string, ShotStatus>;
  tsOf: (s: Shot) => string;
  onOpen: (s: Shot) => void;
}) {
  if (!shots.length) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5, padding: '40px 0' }}>
        אין פריטים שמתאימים לסינון
      </div>
    );
  }

  // מקבצים לפי שעה, בסדר הלו״ז, ושומרים על שורות המקטע במקומן
  type Block = { key: string; ts: string; brk?: Shot; items: Shot[] };
  const blocks: Block[] = [];
  for (const s of shots) {
    if (s.is_break) {
      blocks.push({ key: `b-${s.id}`, ts: s.ts, brk: s, items: [] });
      continue;
    }
    const ts = tsOf(s);
    const last = blocks[blocks.length - 1];
    if (last && !last.brk && last.ts === ts) last.items.push(s);
    else blocks.push({ key: `t-${ts}-${s.id}`, ts, items: [s] });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {blocks.map((b) =>
        b.brk ? (
          <div
            key={b.key}
            style={{
              background: 'var(--surface-2)',
              border: '1px dashed var(--rule)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
              color: 'var(--ink-2)',
              fontStyle: 'italic',
              display: 'flex',
              gap: 10,
            }}
          >
            {b.ts && <span className="mono">{b.ts}</span>}
            <span>{b.brk.script}</span>
          </div>
        ) : (
          <section key={b.key}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}
            >
              <span
                className="mono chip"
                style={{ color: 'var(--accent)', borderColor: 'var(--accent)', fontSize: 12 }}
              >
                {b.ts || 'ללא שעה'}
              </span>
              <span
                style={{
                  flex: 1,
                  height: 1,
                  background:
                    'linear-gradient(to left, var(--rule), transparent)',
                }}
              />
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
                {b.items.length}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {b.items.map((s) => {
                const st = status[s.id];
                const state = st?.state ?? 'pending';
                const isDone = state === 'done';
                return (
                  <button
                    key={s.id}
                    onClick={() => onOpen(s)}
                    className="card"
                    style={{
                      padding: '12px 14px',
                      textAlign: 'right',
                      width: '100%',
                      cursor: 'pointer',
                      display: 'block',
                      borderRightWidth: 4,
                      borderRightColor: STATE_VAR[state],
                      opacity: isDone ? 0.62 : 1,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        alignItems: 'flex-start',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}
                        >
                          <DepChip dep={s.dep} />
                          {s.hotel && s.hotel !== '-' && <span className="chip">{s.hotel}</span>}
                          {s.loc && <span className="chip">📍 {s.loc}</span>}
                          {s.logistics_prod && (
                            <span
                              className="chip"
                              style={{
                                color: 'var(--st-partial)',
                                borderColor: 'var(--st-partial)',
                              }}
                            >
                              ⚙️ {s.logistics_prod}
                            </span>
                          )}
                          {s.logistics_client && (
                            <span
                              className="chip"
                              style={{ color: 'var(--st-done)', borderColor: 'var(--st-done)' }}
                            >
                              🎯 {s.logistics_client}
                            </span>
                          )}
                        </div>
                        {s.vid && (
                          <div
                            style={{
                              fontSize: 10.5,
                              fontWeight: 800,
                              color: 'var(--accent)',
                              marginBottom: 3,
                            }}
                          >
                            {s.vid}
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: 13.5,
                            lineHeight: 1.5,
                            textDecoration: isDone ? 'line-through' : 'none',
                            color: isDone ? 'var(--ink-3)' : 'var(--ink)',
                          }}
                        >
                          {s.script}
                        </div>
                        {s.cast_note && s.cast_note !== '—' && (
                          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>
                            👤 {s.cast_note}
                          </div>
                        )}
                        {st?.notes && (
                          <div
                            style={{
                              fontSize: 11.5,
                              color: 'var(--st-delayed)',
                              marginTop: 4,
                              fontStyle: 'italic',
                            }}
                          >
                            📝 {st.notes}
                          </div>
                        )}
                        {st?.reason && (
                          <div
                            style={{ fontSize: 11.5, color: 'var(--st-partial)', marginTop: 2 }}
                          >
                            💬 {st.reason}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: 5,
                          flexShrink: 0,
                        }}
                      >
                        <StateChip state={state} pct={st?.completion_pct} />
                        {st?.ts_override && (
                          <span style={{ fontSize: 10, color: 'var(--st-delayed)' }}>הוזז</span>
                        )}
                        {st?.updated_by_name && (
                          <span style={{ fontSize: 9.5, color: 'var(--ink-3)' }} dir="ltr">
                            {st.updated_by_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ),
      )}
    </div>
  );
}

export { startMin };

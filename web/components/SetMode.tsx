'use client';

import { useEffect, useState } from 'react';
import type { Shot, ShotStatus } from '@/lib/types';
import { STATE_VAR } from '@/lib/types';
import { drift, driftLabel, endMin, hasTime, nowMin, startMin } from '@/lib/time';
import type { StatusPatch } from '@/lib/useBoard';
import { DepChip, Meta } from './chips';

/**
 * מצב סט. הדבר היחיד שהמסך הזה עונה עליו: מה מצלמים עכשיו, ומה אחר כך.
 * לא רשימה של 75 כרטיסים – כרטיס אחד גדול, ושלושה הבאים.
 */
export default function SetMode({
  shots,
  status,
  tsOf,
  onMark,
  onOpen,
}: {
  shots: Shot[];
  status: Record<string, ShotStatus>;
  tsOf: (s: Shot) => string;
  onMark: (shotId: string, p: StatusPatch) => void;
  onOpen: (s: Shot) => void;
}) {
  const [now, setNow] = useState(() => nowMin());
  useEffect(() => {
    const iv = setInterval(() => setNow(nowMin()), 30000);
    return () => clearInterval(iv);
  }, []);

  const open = shots.filter((s) => {
    if (s.is_break) return false;
    const st = status[s.id]?.state ?? 'pending';
    return st === 'pending' || st === 'partial' || st === 'delayed';
  });

  if (!open.length) {
    return (
      <div className="card" style={{ padding: 34, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>✓</div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>היום נסגר</div>
        <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 6 }}>
          כל השוטים ביום הזה סומנו.
        </div>
      </div>
    );
  }

  // "עכשיו" = הבלוק שהשעה נמצאת בתוכו; אחרת הראשון שטרם בוצע
  const inNow = open.find((s) => {
    const t = tsOf(s);
    return hasTime(t) && startMin(t) <= now && now <= endMin(t) + 5;
  });
  const cur = inNow ?? open[0];
  const rest = open.filter((s) => s.id !== cur.id).slice(0, 3);

  const t = tsOf(cur);
  const d = drift(t, now);
  const late = d !== null && d > 4;
  const early = d !== null && d < -4;

  // מקטע (ארוחה/מעבר) שמופיע בין השוט הנוכחי לבא
  const nextBreak = shots.find(
    (s) => s.is_break && s.sort_key > cur.sort_key && s.sort_key < (rest[0]?.sort_key ?? Infinity),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ---------- עכשיו ---------- */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            padding: '11px 16px',
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--rule)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <span
              className="mono"
              style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-3)' }}
            >
              עכשיו
            </span>
            <span className="mono" style={{ fontSize: 17, fontWeight: 700 }}>
              {t || '—'}
            </span>
          </div>
          {d !== null && (
            <span
              className="chip"
              style={{
                color: late ? 'var(--st-skipped)' : early ? 'var(--st-done)' : 'var(--ink-2)',
                borderColor: late ? 'var(--st-skipped)' : early ? 'var(--st-done)' : 'var(--rule)',
              }}
            >
              {driftLabel(d)}
            </span>
          )}
        </div>

        <div style={{ padding: '15px 16px 0' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 9 }}>
            <DepChip dep={cur.dep} big />
            {cur.hotel && cur.hotel !== '-' && <span className="chip">{cur.hotel}</span>}
            {cur.loc && <span className="chip">📍 {cur.loc}</span>}
          </div>
          {cur.vid && (
            <div
              style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--accent)', marginBottom: 6 }}
            >
              🎬 {cur.vid}
            </div>
          )}
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.6, fontWeight: 600 }}>{cur.script}</p>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Meta label="👤" value={cur.cast_note === '—' ? '' : cur.cast_note} />
            <Meta label="🎯" value={cur.logistics_client} color="var(--st-done)" />
            <Meta label="⚙️" value={cur.logistics_prod} color="var(--st-partial)" />
            <Meta label="👕" value={cur.wardrobe} color="var(--dep-actor)" />
          </div>
        </div>

        {/* פעולה ראשית גדולה, ליד אחת */}
        <div style={{ display: 'flex', gap: 9, padding: 16 }}>
          <button
            onClick={() => onMark(cur.id, { state: 'done' })}
            className="tap"
            style={{
              flex: 3,
              minHeight: 58,
              borderRadius: 12,
              border: 'none',
              background: STATE_VAR.done,
              color: '#fff',
              fontSize: 18,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ✓ בוצע
          </button>
          <button
            onClick={() => onOpen(cur)}
            className="tap"
            style={{
              flex: 1,
              minHeight: 58,
              borderRadius: 12,
              border: '1px solid var(--rule)',
              background: 'var(--surface-2)',
              color: 'var(--ink-2)',
              fontSize: 20,
              fontWeight: 800,
              cursor: 'pointer',
            }}
            title="חלקית / נדחה / לא בוצע / הערות"
            aria-label="אפשרויות נוספות"
          >
            ⋯
          </button>
        </div>
      </div>

      {nextBreak && (
        <div
          style={{
            background: 'var(--surface-2)',
            border: '1px dashed var(--rule)',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 13,
            color: 'var(--ink-2)',
            fontStyle: 'italic',
          }}
        >
          {nextBreak.ts ? `${nextBreak.ts} · ` : ''}
          {nextBreak.script}
        </div>
      )}

      {/* ---------- הבאים ---------- */}
      {rest.length > 0 && (
        <div>
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              color: 'var(--ink-3)',
              margin: '2px 0 8px 2px',
            }}
          >
            הבאים בתור
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rest.map((s) => (
              <button
                key={s.id}
                onClick={() => onOpen(s)}
                className="card"
                style={{
                  padding: '11px 14px',
                  textAlign: 'right',
                  cursor: 'pointer',
                  display: 'block',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    alignItems: 'center',
                    marginBottom: 5,
                  }}
                >
                  <span className="mono" style={{ fontSize: 12.5, color: 'var(--accent)' }}>
                    {tsOf(s) || '—'}
                  </span>
                  <DepChip dep={s.dep} />
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink)' }}>
                  {s.script.length > 110 ? s.script.slice(0, 110) + '…' : s.script}
                </div>
                {s.loc && (
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 4 }}>
                    📍 {s.loc}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

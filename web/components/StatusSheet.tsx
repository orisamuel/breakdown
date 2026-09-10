'use client';

import { useState } from 'react';
import type { Shot, ShotStatus, ShotState } from '@/lib/types';
import { STATES, STATE_LABEL, STATE_VAR } from '@/lib/types';
import { shift } from '@/lib/time';
import type { StatusPatch } from '@/lib/useBoard';
import { DepChip, Meta } from './chips';

const DELAYS = [15, 30, 45, 60, 90, 120];

export default function StatusSheet({
  shot,
  status,
  ts,
  onSave,
  onClose,
}: {
  shot: Shot;
  status?: ShotStatus;
  ts: string;
  onSave: (p: StatusPatch) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<ShotState>(status?.state ?? 'pending');
  const [pct, setPct] = useState(status?.completion_pct ?? 50);
  const [reason, setReason] = useState(status?.reason ?? '');
  const [notes, setNotes] = useState(status?.notes ?? '');
  const [delayOpen, setDelayOpen] = useState(false);

  function save() {
    const p: StatusPatch = { state, reason, notes };
    p.completion_pct = state === 'partial' ? pct : null;
    onSave(p);
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgb(0 0 0 / 55%)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--rule)',
          borderRadius: '18px 18px 0 0',
          width: '100%',
          maxWidth: 620,
          maxHeight: '92dvh',
          overflowY: 'auto',
          padding: '0 0 max(20px, env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 38, height: 4, background: 'var(--rule)', borderRadius: 2 }} />
        </div>

        <div style={{ padding: '14px 18px 0' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <DepChip dep={shot.dep} />
            {ts && (
              <span className="chip mono" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                {ts}
              </span>
            )}
            {shot.hotel && shot.hotel !== '-' && <span className="chip">{shot.hotel}</span>}
            {shot.loc && <span className="chip">📍 {shot.loc}</span>}
          </div>

          {shot.vid && (
            <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--accent)', marginBottom: 5 }}>
              🎬 {shot.vid}
            </div>
          )}
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65 }}>{shot.script}</p>

          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Meta label="👤" value={shot.cast_note === '—' ? '' : shot.cast_note} />
            <Meta label="🎯 לקוח:" value={shot.logistics_client} color="var(--st-done)" />
            <Meta label="⚙️ הפקה:" value={shot.logistics_prod} color="var(--st-partial)" />
            <Meta label="👕" value={shot.wardrobe} color="var(--dep-actor)" />
            <Meta label="📝" value={shot.notes} color="var(--st-delayed)" />
          </div>

          <div style={{ height: 1, background: 'var(--rule-2)', margin: '16px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {STATES.map((s) => {
              const on = state === s;
              return (
                <button
                  key={s}
                  onClick={() => setState(s)}
                  className="tap"
                  style={{
                    padding: '12px 8px',
                    borderRadius: 10,
                    border: `2px solid ${on ? STATE_VAR[s] : 'var(--rule)'}`,
                    background: on ? STATE_VAR[s] : 'var(--surface)',
                    color: on ? '#fff' : 'var(--ink-2)',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {STATE_LABEL[s]}
                </button>
              );
            })}
          </div>

          {state === 'partial' && (
            <div
              style={{
                marginTop: 14,
                background: 'var(--surface-2)',
                border: '1px solid var(--rule)',
                borderRadius: 10,
                padding: 14,
              }}
            >
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--st-partial)',
                  display: 'block',
                  marginBottom: 10,
                }}
              >
                כמה בוצע? {pct}%
              </label>
              <input
                type="range"
                min={10}
                max={90}
                step={10}
                value={pct}
                onChange={(e) => setPct(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>
          )}

          <Field label="סיבה" value={reason} onChange={setReason} placeholder="למה? מה קרה?" />
          <Field label="הערות מהסט" value={notes} onChange={setNotes} placeholder="הערות נוספות..." />

          <div style={{ marginTop: 4, marginBottom: 14 }}>
            <button
              onClick={() => setDelayOpen(!delayOpen)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--st-delayed)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              ⏰ דחיית השוט {delayOpen ? '▲' : '▼'}
            </button>
            {delayOpen && (
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
                {DELAYS.map((m) => (
                  <button
                    key={m}
                    onClick={() =>
                      onSave({ state: 'delayed', ts_override: shift(ts, m), reason, notes })
                    }
                    className="tap"
                    style={{
                      padding: '0 14px',
                      minHeight: 42,
                      borderRadius: 9,
                      border: '1px solid var(--st-delayed)',
                      background: 'var(--surface)',
                      color: 'var(--st-delayed)',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    +{m < 60 ? `${m} דק׳` : `${m / 60} ש׳`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 9 }}>
            <button
              onClick={onClose}
              className="tap"
              style={{
                flex: 1,
                borderRadius: 11,
                border: '1px solid var(--rule)',
                background: 'var(--surface-2)',
                color: 'var(--ink-2)',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ביטול
            </button>
            <button
              onClick={save}
              className="tap"
              style={{
                flex: 2,
                borderRadius: 11,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              שמור ✓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <label
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: 'var(--ink-3)',
          display: 'block',
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          minHeight: 54,
          padding: '10px 12px',
          background: 'var(--surface-2)',
          border: '1px solid var(--rule)',
          borderRadius: 10,
          color: 'var(--ink)',
          fontSize: 14,
          resize: 'vertical',
        }}
      />
    </div>
  );
}

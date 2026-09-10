'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

type Link = {
  token: string;
  label: string;
  created_at: string;
  revoked_at: string | null;
};

function newToken() {
  const a = new Uint8Array(18);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/[+/=]/g, '').slice(0, 22);
}

/** ניהול קישורי הלקוח. הקישור נותן קריאה בלבד, ורק לדרישות ממנו. */
export default function ShareLinks({
  productionId,
  onClose,
}: {
  productionId: string;
  onClose: () => void;
}) {
  const [links, setLinks] = useState<Link[]>([]);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabaseBrowser()
      .from('share_links')
      .select('token, label, created_at, revoked_at')
      .eq('production_id', productionId)
      .order('created_at', { ascending: false });
    if (error) setErr(error.message);
    else setLinks((data ?? []) as Link[]);
  }, [productionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    setErr('');
    const { error } = await supabaseBrowser()
      .from('share_links')
      .insert({ token: newToken(), production_id: productionId, label: label.trim() || 'לקוח' });
    setBusy(false);
    if (error) setErr(error.message);
    else {
      setLabel('');
      void load();
    }
  }

  async function revoke(token: string) {
    if (!confirm('לבטל את הקישור? מי שיש לו אותו יאבד גישה מיד.')) return;
    const { error } = await supabaseBrowser()
      .from('share_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token', token);
    if (error) setErr(error.message);
    else void load();
  }

  function copy(token: string) {
    const url = `${location.origin}/c/${token}`;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(token);
        setTimeout(() => setCopied(''), 1800);
      },
      () => setErr('העתקה נכשלה'),
    );
  }

  const active = links.filter((l) => !l.revoked_at);

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
          maxWidth: 560,
          maxHeight: '88dvh',
          overflowY: 'auto',
          padding: '0 18px max(20px, env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 14px' }}>
          <div style={{ width: 38, height: 4, background: 'var(--rule)', borderRadius: 2 }} />
        </div>

        <h2 style={{ margin: '0 0 5px', fontSize: 17, fontWeight: 800 }}>קישור ללקוח</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          קריאה בלבד. הלקוח רואה את הלו״ז עם הדרישות ממנו — מי צריך להיות שם ומה
          צריך להיות מוכן. הוא לא רואה לוגיסטיקת הפקה, הערות פנימיות או סיבות.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="שם הקישור, למשל: מרטה / אסטרל"
            className="tap"
            style={{
              flex: 1,
              padding: '10px 13px',
              background: 'var(--surface-2)',
              border: '1px solid var(--rule)',
              borderRadius: 10,
              color: 'var(--ink)',
              fontSize: 14,
            }}
          />
          <button
            onClick={create}
            disabled={busy}
            className="tap"
            style={{
              padding: '0 18px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--accent)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 800,
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            צור
          </button>
        </div>

        {err && (
          <div style={{ color: 'var(--st-skipped)', fontSize: 12.5, marginBottom: 12 }}>⚠ {err}</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {active.map((l) => (
            <div
              key={l.token}
              className="card"
              style={{ padding: '11px 13px', background: 'var(--surface-2)' }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 9,
                  alignItems: 'center',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>{l.label}</div>
                  <div
                    className="mono"
                    dir="ltr"
                    style={{
                      fontSize: 10.5,
                      color: 'var(--ink-3)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      textAlign: 'left',
                    }}
                  >
                    /c/{l.token}
                  </div>
                </div>
                <button
                  onClick={() => copy(l.token)}
                  className="tap chip"
                  title="העתק קישור"
                  style={{
                    cursor: 'pointer',
                    minHeight: 38,
                    color: copied === l.token ? 'var(--st-done)' : 'var(--accent)',
                    borderColor: copied === l.token ? 'var(--st-done)' : 'var(--accent)',
                  }}
                >
                  {copied === l.token ? '✓' : '🔗'}
                </button>
                <button
                  onClick={() => revoke(l.token)}
                  className="tap chip"
                  title="בטל קישור"
                  style={{
                    cursor: 'pointer',
                    minHeight: 38,
                    color: 'var(--st-skipped)',
                    borderColor: 'var(--st-skipped)',
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {!active.length && (
            <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: '8px 0' }}>
              אין קישורים פעילים.
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="tap"
          style={{
            marginTop: 18,
            width: '100%',
            borderRadius: 11,
            border: '1px solid var(--rule)',
            background: 'var(--surface-2)',
            color: 'var(--ink-2)',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          סגור
        </button>
      </div>
    </div>
  );
}

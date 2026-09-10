'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';

export default function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
    >
      <div style={{ position: 'fixed', top: 14, left: 14 }}>
        <ThemeToggle />
      </div>

      <div className="card" style={{ width: '100%', maxWidth: 380, padding: 26 }}>
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.16em',
            color: 'var(--ink-3)',
            marginBottom: 10,
          }}
        >
          PRODUCTION SCHEDULE
        </div>
        <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800 }}>ברייקדאון 🎬</h1>

        {sent ? (
          <>
            <p style={{ color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.7, margin: '10px 0 0' }}>
              שלחנו קישור התחברות ל<strong style={{ color: 'var(--ink)' }}>{email}</strong>.
              פותחים אותו מאותו מכשיר.
            </p>
            <button
              onClick={() => setSent(false)}
              className="tap"
              style={{
                marginTop: 18,
                width: '100%',
                background: 'var(--surface-2)',
                border: '1px solid var(--rule)',
                borderRadius: 10,
                color: 'var(--ink-2)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              כתובת אחרת
            </button>
          </>
        ) : (
          <form onSubmit={send}>
            <p
              style={{
                color: 'var(--ink-2)',
                fontSize: 13.5,
                lineHeight: 1.6,
                margin: '8px 0 18px',
              }}
            >
              התחברות עם קישור למייל. הגישה פתוחה לכתובות של הצוות.
            </p>
            <input
              type="email"
              required
              dir="ltr"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@42creative.co.il"
              className="tap"
              style={{
                width: '100%',
                padding: '12px 14px',
                background: 'var(--surface-2)',
                border: '1px solid var(--rule)',
                borderRadius: 10,
                color: 'var(--ink)',
                fontSize: 15,
                textAlign: 'left',
              }}
            />
            {err && (
              <div style={{ color: 'var(--st-skipped)', fontSize: 12.5, marginTop: 10 }}>
                ⚠ {err}
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="tap"
              style={{
                marginTop: 14,
                width: '100%',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                fontSize: 15,
                fontWeight: 800,
                cursor: busy ? 'default' : 'pointer',
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy ? 'שולח...' : 'שלח קישור התחברות'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

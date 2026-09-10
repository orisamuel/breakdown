'use client';

import { useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'dark' | 'sun';

const ORDER: Theme[] = ['system', 'light', 'sun', 'dark'];
const LABEL: Record<Theme, string> = {
  system: 'אוטומטי',
  light: 'בהיר',
  sun: 'שמש',
  dark: 'כהה',
};
const ICON: Record<Theme, string> = { system: '◐', light: '☼', sun: '☀', dark: '☾' };

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    try {
      const t = localStorage.getItem('bd-theme') as Theme | null;
      if (t && ORDER.includes(t)) setTheme(t);
    } catch {
      /* noop */
    }
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    try {
      localStorage.setItem('bd-theme', next);
    } catch {
      /* noop */
    }
    const el = document.documentElement;
    if (next === 'system') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', next);
  }

  function cycle() {
    apply(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]);
  }

  return (
    <button
      onClick={cycle}
      className="tap chip"
      title={`ערכה: ${LABEL[theme]} — לחיצה מחליפה. "שמש" = ניגודיות מקסימלית לצילום בחוץ`}
      aria-label={`ערכת צבעים: ${LABEL[theme]}`}
      style={{
        background: 'var(--surface)',
        color: 'var(--ink-2)',
        minHeight: 40,
        padding: compact ? '0 10px' : '0 12px',
        fontSize: 14,
      }}
    >
      <span aria-hidden style={{ fontSize: 15 }}>
        {ICON[theme]}
      </span>
      {!compact && <span style={{ fontSize: 12 }}>{LABEL[theme]}</span>}
    </button>
  );
}

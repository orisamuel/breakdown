'use client';

import { useMemo, useState } from 'react';
import ThemeToggle from './ThemeToggle';

export type ReqBlock = {
  day: string;
  ts: string;
  hotel: string | null;
  locs: string | null;
  what: string | null;
  who: string | null;
  needs: string | null;
  wardrobe: string | null;
  shots: number;
  done: number;
  sort_key: number;
};

/**
 * מסך הלקוח.
 *
 * מה שקריטי לו זה *הדרישות ממנו*, ולכן זה לו״ז ולא רשימת סרטונים:
 * בשעה הזו, במלון הזה, מצלמים את זה – וצריך שם את האדם הזה ואת
 * הפרופס הזה. בלי לוגיסטיקת הפקה, בלי הערות פנימיות, בלי סיבות.
 */
export default function ClientBoard({
  name,
  shots,
  done,
  blocks,
}: {
  name: string;
  shots: number;
  done: number;
  blocks: ReqBlock[];
}) {
  const days = useMemo(() => {
    const out: string[] = [];
    for (const b of blocks) if (b.day && !out.includes(b.day)) out.push(b.day);
    return out;
  }, [blocks]);

  const [day, setDay] = useState(days[0] ?? '');
  const [onlyNeeds, setOnlyNeeds] = useState(false);

  const cur = days.includes(day) ? day : (days[0] ?? '');
  const list = blocks
    .filter((b) => b.day === cur)
    .filter((b) => !onlyNeeds || b.needs || b.who || b.wardrobe);

  const pct = shots ? Math.round((done / shots) * 100) : 0;

  // סיכום היום, מופרד לשני דברים שונים לגמרי: את מי צריך להביא,
  // ומה צריך שיהיה מוכן. רשימה שטוחה אחת קברה את הלו״ז עצמו.
  const [people, things] = useMemo(() => {
    const pick = (src: string | null, into: Set<string>) => {
      if (!src) return;
      for (const part of src.split(' · ')) {
        const t = part.trim().replace(/^\*+\s*|\s*\*+$/g, '');
        if (t && t !== '—') into.add(t);
      }
    };
    const p = new Set<string>();
    const t = new Set<string>();
    for (const b of blocks.filter((x) => x.day === cur)) {
      pick(b.who, p);
      pick(b.needs, t);
      pick(b.wardrobe, t);
    }
    return [[...p], [...t]] as const;
  }, [blocks, cur]);

  return (
    <main style={{ minHeight: '100dvh' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'var(--bg)',
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <div style={{ maxWidth: 820, margin: '0 auto', padding: '13px 14px 10px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                className="mono"
                style={{ fontSize: 10, letterSpacing: '0.15em', color: 'var(--ink-3)' }}
              >
                דרישות הפקה
              </div>
              <h1 style={{ margin: '3px 0 0', fontSize: 19, fontWeight: 800 }}>{name}</h1>
            </div>
            <ThemeToggle compact />
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 11 }}>
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
              {done}/{shots} צולמו
            </span>
          </div>

          {days.length > 1 && (
            <div
              className="no-scrollbar"
              style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto' }}
            >
              {days.map((d) => {
                const on = cur === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDay(d)}
                    className="tap"
                    style={{
                      flexShrink: 0,
                      minHeight: 40,
                      padding: '0 14px',
                      borderRadius: 9,
                      border: `1px solid ${on ? 'var(--ink)' : 'var(--rule)'}`,
                      background: on ? 'var(--ink)' : 'var(--surface)',
                      color: on ? 'var(--bg)' : 'var(--ink-2)',
                      fontSize: 13,
                      fontWeight: on ? 800 : 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={() => setOnlyNeeds(!onlyNeeds)}
            className="chip tap"
            style={{
              marginTop: 9,
              minHeight: 34,
              cursor: 'pointer',
              color: onlyNeeds ? '#fff' : 'var(--ink-2)',
              background: onlyNeeds ? 'var(--accent)' : 'var(--surface)',
              borderColor: onlyNeeds ? 'var(--accent)' : 'var(--rule)',
            }}
          >
            {onlyNeeds ? '✓ ' : ''}רק שעות שדורשות משהו מכם
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '16px 14px 70px' }}>
        {/* סיכום היום: מי, ומה */}
        {(people.length > 0 || things.length > 0) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 11,
              marginBottom: 18,
            }}
          >
            <Summary
              title={`מי צריך להיות זמין ב${cur}`}
              items={people}
              accent="var(--dep-actor)"
            />
            <Summary
              title={`מה צריך שיהיה מוכן ב${cur}`}
              items={things}
              accent="var(--st-done)"
            />
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {list.map((b) => {
            const complete = b.shots > 0 && b.done === b.shots;
            return (
              <section
                key={`${b.day}-${b.ts}-${b.sort_key}`}
                className="card"
                style={{ padding: 0, overflow: 'hidden', opacity: complete ? 0.66 : 1 }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 15px',
                    background: 'var(--surface-2)',
                    borderBottom: '1px solid var(--rule-2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                    <span className="mono" style={{ fontSize: 15, fontWeight: 700 }}>
                      {b.ts || '—'}
                    </span>
                    {b.hotel && (
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>
                        {b.hotel}
                      </span>
                    )}
                  </div>
                  <span
                    className="mono chip"
                    style={{
                      fontSize: 10.5,
                      color: complete ? 'var(--st-done)' : 'var(--ink-3)',
                      borderColor: complete ? 'var(--st-done)' : 'var(--rule)',
                    }}
                  >
                    {complete ? '✓ צולם' : `${b.done}/${b.shots}`}
                  </span>
                </div>

                <div style={{ padding: '13px 15px', display: 'grid', gap: 11 }}>
                  <Row label="מצלמים" value={b.what} />
                  <Row label="איפה" value={b.locs} />
                  <Row label="מי צריך להיות שם" value={b.who} accent="var(--dep-actor)" strong />
                  <Row label="מה צריך שיהיה מוכן" value={b.needs} accent="var(--st-done)" strong />
                  <Row label="מדים / הלבשה" value={b.wardrobe} accent="var(--st-partial)" />
                </div>
              </section>
            );
          })}
        </div>

        {!list.length && (
          <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 13.5, padding: 40 }}>
            אין שעות שדורשות משהו ביום הזה.
          </div>
        )}

        <p
          style={{
            marginTop: 26,
            fontSize: 11.5,
            color: 'var(--ink-3)',
            lineHeight: 1.6,
            textAlign: 'center',
          }}
        >
          הלו״ז מתעדכן בזמן אמת מהסט. שעות עשויות לזוז.
        </p>
      </div>
    </main>
  );
}

function Summary({
  title,
  items,
  accent,
}: {
  title: string;
  items: readonly string[];
  accent: string;
}) {
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const CAP = 6;
  const shown = all ? items : items.slice(0, CAP);
  const more = items.length - shown.length;
  return (
    <section className="card" style={{ padding: '14px 16px', borderColor: accent }}>
      {/* המונה בצד נפרד: כשהוא צמוד לכותרת שנגמרת בתאריך, ה-bidi מערבב אותם */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
          marginBottom: 9,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: accent }}>{title}</h2>
        <span
          className="mono"
          dir="ltr"
          style={{ color: 'var(--ink-3)', fontSize: 11, flexShrink: 0 }}
        >
          {items.length}
        </span>
      </div>
      <ul
        style={{
          margin: 0,
          paddingInlineStart: 17,
          display: 'grid',
          gap: 4,
          fontSize: 13,
          color: 'var(--ink-2)',
          lineHeight: 1.5,
        }}
      >
        {shown.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      {(more > 0 || all) && (
        <button
          onClick={() => setAll(!all)}
          style={{
            marginTop: 8,
            background: 'none',
            border: 'none',
            padding: 0,
            color: accent,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {all ? 'הצג פחות' : `עוד ${more}`}
        </button>
      )}
    </section>
  );
}

function Row({
  label,
  value,
  accent,
  strong = false,
}: {
  label: string;
  value: string | null;
  accent?: string;
  strong?: boolean;
}) {
  if (!value) return null;
  const parts = value.split(' · ').filter(Boolean);
  return (
    <div>
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: '0.12em',
          color: 'var(--ink-3)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {parts.length > 1 ? (
        <ul
          style={{
            margin: 0,
            paddingInlineStart: 17,
            display: 'grid',
            gap: 3,
            fontSize: strong ? 14 : 13,
            fontWeight: strong ? 600 : 400,
            color: accent ?? 'var(--ink)',
            lineHeight: 1.5,
          }}
        >
          {parts.map((p) => (
            <li key={p}>{p.replace(/^\*+\s*|\s*\*+$/g, '')}</li>
          ))}
        </ul>
      ) : (
        <div
          style={{
            fontSize: strong ? 14 : 13,
            fontWeight: strong ? 600 : 400,
            color: accent ?? 'var(--ink)',
            lineHeight: 1.5,
          }}
        >
          {parts[0].replace(/^\*+\s*|\s*\*+$/g, '')}
        </div>
      )}
    </div>
  );
}

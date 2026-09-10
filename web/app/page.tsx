import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import ThemeToggle from '@/components/ThemeToggle';
import SignOut from '@/components/SignOut';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  slug: string;
  name: string;
  sheet_url: string | null;
  shots: { count: number }[];
};

export default async function Home() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await sb
    .from('productions')
    .select('id, slug, name, sheet_url, shots(count)')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as unknown as Row[];

  // התקדמות לכל הפקה
  const { data: st } = await sb.from('shot_status').select('production_id, state');
  const done = new Map<string, number>();
  for (const s of st ?? []) {
    if ((s as { state: string }).state === 'done') {
      const k = (s as { production_id: string }).production_id;
      done.set(k, (done.get(k) ?? 0) + 1);
    }
  }

  return (
    <main style={{ minHeight: '100dvh' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '26px 16px 70px' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div>
            <div
              className="mono"
              style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--ink-3)' }}
            >
              PRODUCTION SCHEDULE
            </div>
            <h1 style={{ margin: '4px 0 3px', fontSize: 27, fontWeight: 800 }}>ברייקדאון 🎬</h1>
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }} dir="ltr">
              {user.email}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
            <ThemeToggle compact />
            <SignOut />
          </div>
        </header>

        {error && (
          <div
            className="card"
            style={{ padding: 16, borderColor: 'var(--st-skipped)', marginBottom: 14 }}
          >
            <div style={{ color: 'var(--st-skipped)', fontSize: 13.5, lineHeight: 1.6 }}>
              ⚠ {error.message}
              {error.message.includes('permission') && (
                <div style={{ color: 'var(--ink-2)', marginTop: 8 }}>
                  הכתובת {user.email} לא מזוהה כצוות. הגישה מוגבלת לכתובות של החברה.
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((p) => {
            const total = p.shots?.[0]?.count ?? 0;
            const d = done.get(p.id) ?? 0;
            const pct = total ? Math.round((d / total) * 100) : 0;
            return (
              <div key={p.id} className="card" style={{ padding: '15px 17px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <Link
                    href={`/p/${p.slug}`}
                    style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 3 }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                      {total} שורות · {d} בוצעו
                    </div>
                  </Link>
                  {p.sheet_url && (
                    <a
                      href={p.sheet_url}
                      target="_blank"
                      rel="noopener"
                      title="פתח בגוגל-שיטס"
                      className="tap chip"
                      style={{
                        color: 'var(--st-done)',
                        borderColor: 'var(--st-done)',
                        minHeight: 38,
                        textDecoration: 'none',
                      }}
                    >
                      📊
                    </a>
                  )}
                </div>
                <Link href={`/p/${p.slug}`} style={{ textDecoration: 'none' }}>
                  <div
                    style={{ display: 'flex', gap: 9, alignItems: 'center', marginTop: 12 }}
                  >
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
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: 'var(--st-done)',
                        }}
                      />
                    </div>
                    <span
                      className="mono"
                      style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 700 }}
                    >
                      {pct}%
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>

        {!rows.length && !error && (
          <div
            className="card"
            style={{ padding: 24, textAlign: 'center', color: 'var(--ink-2)', fontSize: 14 }}
          >
            אין עוד ברייקדאונים.
          </div>
        )}
      </div>
    </main>
  );
}

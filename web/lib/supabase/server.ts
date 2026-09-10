import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** קליינט לצד השרת. ב-Next 15 cookies() אסינכרוני. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(list: { name: string; value: string; options: CookieOptions }[]) {
          // ב-Server Component אין הרשאת כתיבה לעוגיות; ה-middleware מרענן.
          try {
            for (const { name, value, options } of list) store.set(name, value, options);
          } catch {
            /* noop */
          }
        },
      },
    },
  );
}

import { NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** ממיר את הקוד מקישור המייל לסשן, ומפנה הלאה. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/';

  if (!code) {
    return NextResponse.redirect(new URL('/login?e=missing-code', url.origin));
  }

  const store = await cookies();
  const response = NextResponse.redirect(new URL(next, url.origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(list: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value, options } of list) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?e=${encodeURIComponent(error.message)}`, url.origin),
    );
  }
  return response;
}

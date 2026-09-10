import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/** מרענן את הסשן בכל ניווט, כדי שהעוגייה לא תפוג באמצע יום צילום.
  * ב-Next 16 המוסכמה היא proxy.ts ולא middleware.ts. */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(list: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of list) request.cookies.set(name, value);
          for (const { name, value, options } of list) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    // הכל חוץ מנכסים סטטיים ומסך הלקוח (שלא דורש סשן)
    '/((?!_next/static|_next/image|favicon.ico|c/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};

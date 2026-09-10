import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import ClientBoard, { type ReqBlock } from '@/components/ClientBoard';

export const dynamic = 'force-dynamic';

/** קליינט anon בלבד – המסך הזה לא דורש סשן, רק טוקן בכתובת. */
function anon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data } = await anon().rpc('client_meta', { p_token: token });
  const name = data?.[0]?.name;
  return {
    title: name ? `${name} · דרישות הפקה` : 'דרישות הפקה',
    robots: { index: false, follow: false },
  };
}

export default async function ClientPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = anon();

  const [{ data: meta }, { data: blocks, error }] = await Promise.all([
    sb.rpc('client_meta', { p_token: token }),
    sb.rpc('client_requirements', { p_token: token }),
  ]);

  if (error) throw new Error(error.message);
  if (!meta?.length || !blocks?.length) notFound();

  return (
    <ClientBoard
      name={meta[0].name as string}
      shots={meta[0].shots as number}
      done={meta[0].done as number}
      blocks={blocks as ReqBlock[]}
    />
  );
}

import { notFound, redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import Board from '@/components/Board';
import type { Production, Shot, ShotStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await supabaseServer();
  const { data } = await sb.from('productions').select('name').eq('slug', slug).maybeSingle();
  return { title: data?.name ? `${data.name} · ברייקדאון` : 'ברייקדאון' };
}

export default async function BoardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await supabaseServer();

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/p/${slug}`)}`);

  const { data: prod } = await sb
    .from('productions')
    .select('id, slug, name, sheet_url')
    .eq('slug', slug)
    .maybeSingle();
  if (!prod) notFound();

  const [{ data: shots }, { data: status }] = await Promise.all([
    sb.from('shots').select('*').eq('production_id', prod.id).order('sort_key'),
    sb.from('shot_status').select('*').eq('production_id', prod.id),
  ]);

  return (
    <Board
      production={prod as Production}
      shots={(shots ?? []) as Shot[]}
      status={(status ?? []) as ShotStatus[]}
    />
  );
}

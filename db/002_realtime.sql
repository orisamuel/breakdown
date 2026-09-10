-- ============================================================
--  ברייקדאון · 002 · Realtime
--
--  בלי זה ה-subscription באפליקציה נרשם בהצלחה ו*לא מקבל כלום* –
--  Supabase משדר רק טבלאות שנמצאות בפרסום supabase_realtime.
--  replica identity full נדרש כדי שגם מחיקה תגיע עם השורה הישנה.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shot_status'
  ) then
    alter publication supabase_realtime add table public.shot_status;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shots'
  ) then
    alter publication supabase_realtime add table public.shots;
  end if;
end $$;

alter table public.shot_status replica identity full;

-- ============================================================
--  ברייקדאון · 003 · תיקון תצוגת הלקוח
--
--  ב-001 סיננתי גם את logistics_client, cast_note ו-wardrobe.
--  זו הייתה טעות: מה שקריטי ללקוח זה בדיוק *הדרישות ממנו* –
--  בשעה הזו, במלון הזה, מצלמים את זה, צריך את האדם הזה ואת
--  הפרופס הזה. בלי שלוש העמודות האלה התצוגה חסרת תועלת.
--
--  מה נשאר פנימי:
--    logistics_prod  – הציוד שלנו
--    notes           – רפרנסים, "אפשר להזיז לרביעי", "אם המציל יזרום"
--    reason          – למה שוט לא בוצע
--    dep             – תלות קאסט, מושג תזמון פנימי
-- ============================================================

drop function if exists public.client_board(text);

create or replace function public.client_board(p_token text)
returns table (
  seq        integer,
  day        text,
  ts         text,
  hotel      text,
  loc        text,
  cat        text,
  vid        text,
  script     text,
  needs_who  text,   -- cast_note: מי צריך להיות שם
  needs_what text,   -- logistics_client: מה הלקוח מספק
  wardrobe   text,   -- מדים והלבשה, בדרך כלל על הלקוח
  is_break   boolean,
  state      text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select s.seq, s.day, s.ts, s.hotel, s.loc, s.cat, s.vid, s.script,
         s.cast_note, s.logistics_client, s.wardrobe, s.is_break,
         coalesce(st.state, 'pending')::text
  from public.share_links l
  join public.shots s on s.production_id = l.production_id
  left join public.shot_status st on st.shot_id = s.id
  where l.token = p_token
    and l.revoked_at is null
    and (l.expires_at is null or l.expires_at > now())
    and s.client_visible
  order by s.sort_key
$$;

grant execute on function public.client_board(text) to anon, authenticated;

-- ------------------------------------------------------------
--  סיכום הדרישות מהלקוח, מקובץ לפי יום ובלוק שעה.
--  זה המסך שהלקוח באמת צריך: מה הוא צריך להביא ולמי לתאם, ומתי.
-- ------------------------------------------------------------
create or replace function public.client_requirements(p_token text)
returns table (
  day        text,
  ts         text,
  hotel      text,
  locs       text,
  what       text,
  who        text,
  needs      text,
  wardrobe   text,
  shots      integer,
  done       integer,
  sort_key   integer
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with rows as (
    select s.*, coalesce(st.state, 'pending')::text as state
    from public.share_links l
    join public.shots s on s.production_id = l.production_id
    left join public.shot_status st on st.shot_id = s.id
    where l.token = p_token
      and l.revoked_at is null
      and (l.expires_at is null or l.expires_at > now())
      and s.client_visible
      and not s.is_break
  )
  select
    r.day,
    r.ts,
    string_agg(distinct nullif(r.hotel, ''), ' · ')                        as hotel,
    string_agg(distinct nullif(r.loc, ''), ' · ')                          as locs,
    string_agg(distinct nullif(r.vid, ''), ' + ')                          as what,
    string_agg(distinct nullif(nullif(r.cast_note, ''), '—'), ' · ')       as who,
    string_agg(distinct nullif(r.logistics_client, ''), ' · ')             as needs,
    string_agg(distinct nullif(r.wardrobe, ''), ' · ')                     as wardrobe,
    count(*)::integer                                                       as shots,
    count(*) filter (where r.state = 'done')::integer                       as done,
    min(r.sort_key)::integer                                                as sort_key
  from rows r
  group by r.day, r.ts
  order by min(r.sort_key)
$$;

grant execute on function public.client_requirements(text) to anon, authenticated;

-- ============================================================
--  ברייקדאון · 004 · שער האישור
--
--  הזרימה החדשה:
--    תסריטים ─► שוט ליסט (עריכה) ─► *אישור* ─► תזמון ─► ברייקדאון
--
--  הברייקדאון הוא תוצר של השוט-ליסט, לא מקור עצמאי. אותה טבלת shots
--  משרתת את שני השלבים: לפני התזמון day/ts ריקים, והמתזמן ממלא אותם.
--
--  שלושת השדות שמאפשרים תזמון אוטומטי:
--    area      – כל מה שבאותו אזור מצטלם ביחד
--    props     – אביזר זהה = בלוק אחד
--    wardrobe  – מונע קפיצות בגד-ים → בגדים → בגד-ים
--  ו-est_min, שבלעדיו אין מה לתזמן בכלל.
-- ============================================================

-- ---------- שלב ההפקה ----------
do $$ begin
  create type public.production_stage as enum ('shotlist', 'approved', 'scheduled');
exception when duplicate_object then null; end $$;

alter table public.productions
  add column if not exists stage       public.production_stage not null default 'shotlist',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_by_name text not null default '';

-- ---------- שדות השוט-ליסט ----------
alter table public.shots
  add column if not exists area         text    not null default '',
  add column if not exists props        text[]  not null default '{}',
  add column if not exists participants text[]  not null default '{}',
  add column if not exists est_min      integer not null default 10,
  add column if not exists video_id     text    not null default '',
  add column if not exists shot_no      integer;

comment on column public.shots.area is 'אזור צילום – בסיס לאשכול לוגיסטי';
comment on column public.shots.props is 'אביזרים – אביזר זהה מקבץ שוטים';
comment on column public.shots.est_min is 'הערכת זמן כולל סטאפ, בדקות';

-- ---------- אילוצי זמינות: החלק שהמתזמן חייב לכבד ----------
create table if not exists public.cast_windows (
  id            uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  person        text not null,               -- 'שחקן', 'רינת', 'עדי פלד', 'פזית'...
  day           text not null default '',    -- ריק = כל הימים
  from_ts       text not null default '',    -- '09:00'
  to_ts         text not null default '',    -- '15:00'
  note          text not null default '',
  unique (production_id, person, day)
);

alter table public.cast_windows enable row level security;
drop policy if exists crew_all on public.cast_windows;
create policy crew_all on public.cast_windows
  for all using (public.is_crew()) with check (public.is_crew());

-- ---------- אילוצי יום: שעת התחלה וסיום ----------
create table if not exists public.shoot_days (
  id            uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  label         text not null,               -- 'שני 5.10'
  ord           integer not null default 0,
  starts_at     text not null default '',
  ends_at       text not null default '',
  base_hotel    text not null default '',
  note          text not null default '',
  unique (production_id, label)
);

alter table public.shoot_days enable row level security;
drop policy if exists crew_all on public.shoot_days;
create policy crew_all on public.shoot_days
  for all using (public.is_crew()) with check (public.is_crew());

-- ---------- סיכום זמנים: האם התוכנית בכלל נכנסת ----------
create or replace function public.shotlist_totals(p_production uuid)
returns table (
  bucket    text,
  kind      text,
  shots     integer,
  minutes   integer
)
language sql
stable
as $$
  with base as (
    select * from public.shots
    where production_id = p_production and not is_break
  )
  select 'סה״כ'::text, 'total'::text, count(*)::integer, sum(est_min)::integer from base
  union all
  select dep, 'dep', count(*)::integer, sum(est_min)::integer from base group by dep
  union all
  select area, 'area', count(*)::integer, sum(est_min)::integer from base group by area
  union all
  select wardrobe, 'wardrobe', count(*)::integer, sum(est_min)::integer from base group by wardrobe
  union all
  select hotel, 'hotel', count(*)::integer, sum(est_min)::integer from base group by hotel
$$;

grant execute on function public.shotlist_totals(uuid) to authenticated;

-- ---------- אישור השוט-ליסט ----------
create or replace function public.approve_shotlist(p_production uuid)
returns public.production_stage
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  n_missing integer;
  new_stage public.production_stage;
begin
  if not public.is_crew() then
    raise exception 'רק צוות יכול לאשר שוט ליסט';
  end if;

  -- שוט בלי הערכת זמן שובר את התזמון, ולכן חוסם אישור
  select count(*) into n_missing
  from public.shots
  where production_id = p_production and not is_break and coalesce(est_min, 0) <= 0;

  if n_missing > 0 then
    raise exception 'יש % שוטים בלי הערכת זמן – אי אפשר לתזמן', n_missing;
  end if;

  update public.productions
     set stage = 'approved',
         approved_at = now(),
         approved_by = auth.uid(),
         approved_by_name = coalesce(auth.jwt() ->> 'email', '')
   where id = p_production
  returning stage into new_stage;

  insert into public.activity (production_id, action, payload, actor, actor_name)
  values (p_production, 'approve_shotlist', '{}'::jsonb, auth.uid(),
          coalesce(auth.jwt() ->> 'email', ''));

  return new_stage;
end $$;

grant execute on function public.approve_shotlist(uuid) to authenticated;

-- החזרה לעריכה, אם צריך לשנות אחרי אישור
create or replace function public.reopen_shotlist(p_production uuid)
returns public.production_stage
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare new_stage public.production_stage;
begin
  if not public.is_crew() then
    raise exception 'רק צוות יכול להחזיר לעריכה';
  end if;
  update public.productions
     set stage = 'shotlist', approved_at = null, approved_by = null, approved_by_name = ''
   where id = p_production
  returning stage into new_stage;
  insert into public.activity (production_id, action, payload, actor, actor_name)
  values (p_production, 'reopen_shotlist', '{}'::jsonb, auth.uid(),
          coalesce(auth.jwt() ->> 'email', ''));
  return new_stage;
end $$;

grant execute on function public.reopen_shotlist(uuid) to authenticated;

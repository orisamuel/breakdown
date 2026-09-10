-- ============================================================
--  ברייקדאון · סכמה 001
--
--  הפרויקט מוקדש לברייקדאון, ולכן הטבלאות יושבות ב-public:
--  זו הסכמה שה-API של Supabase חושף כברירת מחדל, וה-RLS הוא מה
--  שמגן. סכמה נפרדת הייתה חוסמת גם את האפליקציה עצמה.
--
--  הרשאות:
--    צוות  – משתמש מאומת עם מייל @42creative.co.il, קריאה וכתיבה
--    לקוח  – קישור עם טוקן, קריאה בלבד, דרך RPC שמסננת גם עמודות
-- ============================================================

-- ---------- הפקות ----------
create table if not exists public.productions (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  sheet_id    text,
  sheet_url   text,
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

-- ---------- שוטים (כולל שורות מקטע: ארוחות, מעברים, שחרור קאסט) ----------
create table if not exists public.shots (
  id               uuid primary key default gen_random_uuid(),
  production_id    uuid not null references public.productions(id) on delete cascade,
  seq              integer not null,          -- מספר רץ לתצוגה
  sort_key         integer not null,          -- סדר סופי בלו״ז
  day              text not null default '',
  ts               text not null default '',
  hotel            text not null default '',
  dep              text not null default '',  -- תלות קאסט
  cluster          text not null default '',  -- אשכול לוגיסטי
  loc              text not null default '',
  cat              text not null default '',
  vid              text not null default '',
  kind             text not null default '',
  script           text not null default '',
  cast_note        text not null default '',
  logistics_client text not null default '',
  logistics_prod   text not null default '',
  wardrobe         text not null default '',
  notes            text not null default '',
  is_break         boolean not null default false,
  client_visible   boolean not null default true,
  unique (production_id, seq)
);

create index if not exists shots_prod_sort_idx
  on public.shots (production_id, sort_key);

-- ---------- סטטוסים ----------
do $$ begin
  create type public.shot_state as enum ('pending','done','partial','delayed','skipped');
exception when duplicate_object then null; end $$;

create table if not exists public.shot_status (
  shot_id         uuid primary key references public.shots(id) on delete cascade,
  production_id   uuid not null references public.productions(id) on delete cascade,
  state           public.shot_state not null default 'pending',
  completion_pct  integer check (completion_pct between 0 and 100),
  reason          text not null default '',
  notes           text not null default '',
  ts_override     text not null default '',
  updated_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id),
  updated_by_name text not null default ''
);

create index if not exists shot_status_prod_idx
  on public.shot_status (production_id);

-- ---------- קישורי שיתוף ללקוח ----------
create table if not exists public.share_links (
  token         text primary key,
  production_id uuid not null references public.productions(id) on delete cascade,
  role          text not null default 'client',
  label         text not null default '',
  created_at    timestamptz not null default now(),
  expires_at    timestamptz,
  revoked_at    timestamptz
);

-- ---------- לוג פעולות: מי סימן מה ומתי ----------
create table if not exists public.activity (
  id            bigserial primary key,
  production_id uuid not null references public.productions(id) on delete cascade,
  shot_id       uuid references public.shots(id) on delete set null,
  action        text not null,
  payload       jsonb not null default '{}'::jsonb,
  at            timestamptz not null default now(),
  actor         uuid references auth.users(id),
  actor_name    text not null default ''
);

create index if not exists activity_prod_at_idx
  on public.activity (production_id, at desc);

-- ============================================================
--  הרשאות
-- ============================================================

-- צוות = מייל מאומת בדומיין של החברה
create or replace function public.is_crew()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') like '%@42creative.co.il'
$$;

alter table public.productions enable row level security;
alter table public.shots       enable row level security;
alter table public.shot_status enable row level security;
alter table public.share_links enable row level security;
alter table public.activity    enable row level security;

-- הצוות: הכל. כל השאר: כלום (הלקוח עובר דרך ה-RPC בלבד).
drop policy if exists crew_all on public.productions;
create policy crew_all on public.productions
  for all using (public.is_crew()) with check (public.is_crew());

drop policy if exists crew_all on public.shots;
create policy crew_all on public.shots
  for all using (public.is_crew()) with check (public.is_crew());

drop policy if exists crew_all on public.shot_status;
create policy crew_all on public.shot_status
  for all using (public.is_crew()) with check (public.is_crew());

drop policy if exists crew_all on public.share_links;
create policy crew_all on public.share_links
  for all using (public.is_crew()) with check (public.is_crew());

drop policy if exists crew_read on public.activity;
create policy crew_read on public.activity
  for select using (public.is_crew());

drop policy if exists crew_write on public.activity;
create policy crew_write on public.activity
  for insert with check (public.is_crew());

-- ============================================================
--  תצוגת הלקוח
--  SECURITY DEFINER כדי לעקוף RLS בצורה מבוקרת, ומחזירה רק
--  את העמודות שהלקוח אמור לראות: בלי לוגיסטיקת הפקה, בלי הערות
--  פנימיות, בלי קאסט ובלי הסיבות שנרשמו בסט.
-- ============================================================
create or replace function public.client_board(p_token text)
returns table (
  seq      integer,
  day      text,
  ts       text,
  hotel    text,
  loc      text,
  cat      text,
  vid      text,
  script   text,
  is_break boolean,
  state    text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select s.seq, s.day, s.ts, s.hotel, s.loc, s.cat, s.vid, s.script, s.is_break,
         coalesce(st.state, 'pending')::text
  from public.share_links l
  join public.shots s      on s.production_id = l.production_id
  left join public.shot_status st on st.shot_id = s.id
  where l.token = p_token
    and l.revoked_at is null
    and (l.expires_at is null or l.expires_at > now())
    and s.client_visible
  order by s.sort_key
$$;

-- מטא-דאטה של ההפקה לקישור לקוח (שם + התקדמות), בלי לחשוף כלום נוסף
create or replace function public.client_meta(p_token text)
returns table (name text, shots integer, done integer)
language sql
security definer
set search_path = public, pg_temp
as $$
  select p.name,
         count(*) filter (where not s.is_break)::integer,
         count(*) filter (where not s.is_break and st.state = 'done')::integer
  from public.share_links l
  join public.productions p on p.id = l.production_id
  join public.shots s       on s.production_id = l.production_id
  left join public.shot_status st on st.shot_id = s.id
  where l.token = p_token
    and l.revoked_at is null
    and (l.expires_at is null or l.expires_at > now())
    and s.client_visible
  group by p.name
$$;

-- ============================================================
--  גישה לסכמה
-- ============================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- anon לא נוגע בטבלאות – רק ב-2 הפונקציות של הלקוח
revoke all on all tables in schema public from anon;
grant execute on function public.client_board(text) to anon, authenticated;
grant execute on function public.client_meta(text)  to anon, authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

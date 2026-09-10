# -*- coding: utf-8 -*-
"""
מייבא ברייקדאון מגוגל-שיט אל Supabase.

הזרימה:  גוגל-שיט  ->  Apps Script (האדפטר)  ->  Postgres

האפסקריפט נשאר האדפטר לשיטס: הוא מזהה את הגליון ושורת הכותרת, מטפל
בתאים ממוזגים ובכל שאר המוזרויות, ורץ בהרשאות של בעל הקובץ.
כאן אנחנו רק מזליגים את הפלט שלו לדאטהבייס.

עדכון הוא upsert לפי (production_id, seq), כדי שהסטטוסים – שמפתחם הוא
shot_id – לא יימחקו כשמייבאים מחדש אחרי עריכה בשיט.

שימוש:  python db/import_from_sheet.py astral-hr
"""
import io, json, os, sys, urllib.request, urllib.error

REF = os.environ.get('SB_PROJECT_REF', 'ceoegfwbwvdsbiztwskb')
TOKEN = os.environ.get('SUPABASE_ACCESS_TOKEN', '')
HERE = os.path.dirname(os.path.abspath(__file__))
WEBAPP = io.open(os.path.join(HERE, '..', 'apps-script', '.webapp-url'),
                 encoding='utf-8').read().strip()

# עמודות ב-shots לפי הסדר שבו נשלח ה-JSON
COLS = ['seq', 'sort_key', 'day', 'ts', 'hotel', 'dep', 'cluster', 'loc', 'cat',
        'vid', 'kind', 'script', 'cast_note', 'logistics_client', 'logistics_prod',
        'wardrobe', 'notes', 'is_break']
TYPES = ('seq integer, sort_key integer, day text, ts text, hotel text, dep text, '
         'cluster text, loc text, cat text, vid text, kind text, script text, '
         'cast_note text, logistics_client text, logistics_prod text, '
         'wardrobe text, notes text, is_break boolean')


def sql(query):
    body = json.dumps({'query': query}).encode('utf-8')
    req = urllib.request.Request(
        'https://api.supabase.com/v1/projects/%s/database/query' % REF,
        data=body,
        headers={'Authorization': 'Bearer ' + TOKEN,
                 'Content-Type': 'application/json',
                 # בלי UA אמיתי – Cloudflare חוסם את Python-urllib בשגיאה 1010
                 'User-Agent': 'breakdown-import/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        raise SystemExit('SQL failed: %s\n%s' % (e.code, e.read().decode('utf-8')[:600]))


def lit(s):
    """מחרוזת SQL בטוחה – מכפילים גרש בודד."""
    return "'" + str(s).replace("'", "''") + "'"


def fetch(slug):
    req = urllib.request.Request(WEBAPP + '?p=' + slug,
                                 headers={'User-Agent': 'breakdown-import/1.0'})
    with urllib.request.urlopen(req, timeout=180) as r:
        d = json.loads(r.read().decode('utf-8'))
    if d.get('error'):
        raise SystemExit('Apps Script: ' + d['error'])
    return d


def main(slug):
    if not TOKEN:
        raise SystemExit('חסר SUPABASE_ACCESS_TOKEN')
    d = fetch(slug)
    proj, items = d['project'], d['items']
    print('נמשך מהאפסקריפט: %s · %d שורות' % (proj.get('name'), len(items)))

    rows = []
    for i, it in enumerate(items, 1):
        rows.append({
            'seq': i,
            'sort_key': i,
            'day': it.get('day', '') or '',
            'ts': it.get('ts', '') or '',
            'hotel': it.get('hotel', '') or '',
            'dep': it.get('dep', '') or '',
            'cluster': it.get('cluster', '') or '',
            'loc': it.get('loc', '') or '',
            'cat': it.get('cat', '') or '',
            'vid': it.get('vid', '') or '',
            'kind': it.get('type', '') or '',
            'script': it.get('script', '') or '',
            'cast_note': it.get('cast', '') or '',
            'logistics_client': it.get('lc', '') or '',
            'logistics_prod': it.get('lp', '') or '',
            'wardrobe': it.get('wardrobe', '') or '',
            'notes': it.get('notes', '') or '',
            'is_break': bool(it.get('isBreak')),
        })

    payload = json.dumps(rows, ensure_ascii=False)

    stmt = """
with prod as (
  insert into public.productions (slug, name, sheet_id, sheet_url)
  values ({slug}, {name}, {sid}, {surl})
  on conflict (slug) do update
    set name = excluded.name,
        sheet_id = excluded.sheet_id,
        sheet_url = excluded.sheet_url
  returning id
),
src as (
  select * from jsonb_to_recordset({payload}::jsonb) as x({types})
),
up as (
  insert into public.shots (
    production_id, seq, sort_key, day, ts, hotel, dep, cluster, loc, cat, vid,
    kind, script, cast_note, logistics_client, logistics_prod, wardrobe, notes, is_break)
  select p.id, s.seq, s.sort_key, s.day, s.ts, s.hotel, s.dep, s.cluster, s.loc,
         s.cat, s.vid, s.kind, s.script, s.cast_note, s.logistics_client,
         s.logistics_prod, s.wardrobe, s.notes, s.is_break
  from src s cross join prod p
  on conflict (production_id, seq) do update set
    sort_key = excluded.sort_key, day = excluded.day, ts = excluded.ts,
    hotel = excluded.hotel, dep = excluded.dep, cluster = excluded.cluster,
    loc = excluded.loc, cat = excluded.cat, vid = excluded.vid, kind = excluded.kind,
    script = excluded.script, cast_note = excluded.cast_note,
    logistics_client = excluded.logistics_client,
    logistics_prod = excluded.logistics_prod, wardrobe = excluded.wardrobe,
    notes = excluded.notes, is_break = excluded.is_break
  returning 1
),
del as (
  delete from public.shots
  where production_id = (select id from prod)
    and seq > {n}
  returning 1
)
select (select count(*) from up) as upserted,
       (select count(*) from del) as removed,
       (select id from prod) as production_id
""".format(slug=lit(slug), name=lit(proj.get('name', slug)),
           sid=lit(proj.get('sheetId', '') or ''), surl=lit(proj.get('url', '') or ''),
           payload=lit(payload), types=TYPES, n=len(rows))

    res = sql(stmt)
    r = res[0] if res else {}
    print('נכתבו: %s · הוסרו: %s · production_id: %s'
          % (r.get('upserted'), r.get('removed'), r.get('production_id')))

    chk = sql("""select
      (select count(*) from public.shots where not is_break) as shots,
      (select count(*) from public.shots where is_break) as breaks,
      (select count(distinct day) from public.shots) as days,
      (select count(*) from public.shot_status) as statuses""")
    print('בדאטהבייס:', json.dumps(chk[0], ensure_ascii=False))


if __name__ == '__main__':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    main(sys.argv[1] if len(sys.argv) > 1 else 'astral-hr')

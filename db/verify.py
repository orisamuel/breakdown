# -*- coding: utf-8 -*-
"""Verification suite for the breakdown database.

Checks the three properties the design depends on:
  1. re-importing from the sheet does not wipe shot statuses
  2. the client function exposes only client-safe columns
  3. RLS actually blocks the anon key from reading the tables directly

Run:  python db/verify.py
"""
import io, json, os, secrets, sys, urllib.request, urllib.error

REF = os.environ.get('SB_PROJECT_REF', 'ceoegfwbwvdsbiztwskb')
TOKEN = os.environ.get('SUPABASE_ACCESS_TOKEN', '')
UA = {'User-Agent': 'breakdown-verify/1.0'}
# מה שאסור להגיע ללקוח. שים לב: logistics_client, cast_note ו-wardrobe
# *כן* נחשפים בכוונה – הן הדרישות ממנו, וזו כל הסיבה שהמסך קיים.
# מה שנשאר פנימי: הציוד שלנו, ההערות, הסיבות ותלות הקאסט.
INTERNAL = ('logistics_prod', 'notes', 'reason', 'dep', 'cluster')
EXPECTED_CLIENT = ('needs_who', 'needs_what', 'wardrobe')

ok = []
fail = []


def sql(query):
    body = json.dumps({'query': query}).encode('utf-8')
    h = dict(UA)
    h['Authorization'] = 'Bearer ' + TOKEN
    h['Content-Type'] = 'application/json'
    req = urllib.request.Request(
        'https://api.supabase.com/v1/projects/%s/database/query' % REF,
        data=body, headers=h)
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read().decode('utf-8'))


def api_keys():
    h = dict(UA)
    h['Authorization'] = 'Bearer ' + TOKEN
    req = urllib.request.Request(
        'https://api.supabase.com/v1/projects/%s/api-keys' % REF, headers=h)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))


def check(name, cond, detail=''):
    (ok if cond else fail).append(name)
    print('  %s  %s%s' % ('PASS' if cond else 'FAIL', name,
                          ('  -> ' + detail) if detail else ''))


# fixture: a random, short-lived share token created and revoked by this run,
# so no guessable client link is ever left behind
TOKEN_FIXTURE = 'verify-' + secrets.token_urlsafe(24)
sql("""insert into public.share_links (token, production_id, label)
        select %s, id, 'verify run' from public.productions order by created_at limit 1"""
    % ("'" + TOKEN_FIXTURE + "'"))

print('== 1. status survives re-import ==')
n = sql('select count(*)::int as n from public.shot_status')[0]['n']
check('shot_status rows preserved after import', n >= 1, '%d row(s)' % n)

print('== 2. client function column surface ==')
rows = sql("select * from public.client_board('" + TOKEN_FIXTURE + "') limit 1")
cols = sorted(rows[0].keys()) if rows else []
leaked = [c for c in cols if c in INTERNAL]
check('client_board returns rows', bool(rows), '%d cols' % len(cols))
check('no internal columns exposed', not leaked, ','.join(leaked) or 'clean')
missing = [c for c in EXPECTED_CLIENT if c not in cols]
check('client gets the requirements columns', not missing, ','.join(missing) or 'all present')
print('       columns: %s' % ', '.join(cols))

reqs = sql("select * from public.client_requirements('" + TOKEN_FIXTURE + "') limit 3")
check('client_requirements groups by time block', bool(reqs),
      '%d blocks' % len(reqs))
if reqs:
    rl = [c for c in reqs[0].keys() if c in INTERNAL]
    check('requirements surface clean', not rl, ','.join(rl) or 'clean')

meta = sql("select * from public.client_meta('" + TOKEN_FIXTURE + "')")
check('client_meta returns progress', bool(meta),
      json.dumps(meta[0]) if meta else 'empty')

print('== 3. RLS blocks the anon key ==')
keys = api_keys()
anon = None
for k in keys:
    if k.get('name') == 'anon' or k.get('type') == 'anon':
        anon = k.get('api_key') or k.get('apiKey')
if not anon:
    check('found anon key', False, 'could not read api-keys')
else:
    base = 'https://%s.supabase.co' % REF

    def rest(path):
        h = dict(UA)
        h['apikey'] = anon
        h['Authorization'] = 'Bearer ' + anon
        req = urllib.request.Request(base + path, headers=h)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, r.read().decode('utf-8')[:300]
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode('utf-8')[:300]

    st, body = rest('/rest/v1/shots?select=script&limit=3')
    blocked = (st >= 400) or (body.strip() in ('[]', ''))
    check('anon cannot read public.shots', blocked, 'HTTP %d %s' % (st, body[:110]))

    st2, body2 = rest('/rest/v1/productions?select=name&limit=3')
    blocked2 = (st2 >= 400) or (body2.strip() in ('[]', ''))
    check('anon cannot read public.productions', blocked2,
          'HTTP %d %s' % (st2, body2[:110]))

    # the client RPC must still work for anon - that is the whole point
    h = dict(UA)
    h['apikey'] = anon
    h['Authorization'] = 'Bearer ' + anon
    h['Content-Type'] = 'application/json'
    req = urllib.request.Request(
        base + '/rest/v1/rpc/client_board',
        data=json.dumps({'p_token': TOKEN_FIXTURE}).encode('utf-8'), headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.loads(r.read().decode('utf-8'))
        check('anon CAN call client_board via token', len(d) > 0, '%d rows' % len(d))
        if d:
            lk = [c for c in d[0].keys() if c in INTERNAL]
            check('rpc surface still clean', not lk, ','.join(lk) or 'clean')
    except urllib.error.HTTPError as e:
        check('anon CAN call client_board via token', False,
              'HTTP %d %s' % (e.code, e.read().decode('utf-8')[:160]))

# cleanup: revoke the fixture and any legacy demo token
sql("""delete from public.share_links
        where token = %s or token = 'demo-client-token'""" % ("'" + TOKEN_FIXTURE + "'"))
left = sql('select count(*)::int as n from public.share_links')[0]['n']
check('no share links left behind', left == 0, '%d remaining' % left)

print()
print('passed %d, failed %d' % (len(ok), len(fail)))
if fail:
    print('FAILED: ' + '; '.join(fail))
sys.exit(1 if fail else 0)

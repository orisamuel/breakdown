# -*- coding: utf-8 -*-
"""Verifies the RLS model the way the app actually sees it.

Creates two throwaway users, signs in as each, and drives the real REST API:

  crew     e2e-crew@42creative.co.il   -> must read shots and write a status
  outsider e2e-outside@example.com     -> must be blocked from everything

Both users are deleted at the end. Run:  python db/verify_auth.py
"""
import io, json, os, secrets, sys, urllib.request, urllib.error

REF = os.environ.get('SB_PROJECT_REF', 'ceoegfwbwvdsbiztwskb')
MGMT = os.environ.get('SUPABASE_ACCESS_TOKEN', '')
BASE = 'https://%s.supabase.co' % REF
UA = 'breakdown-verify/1.0'

ok, fail = [], []


def check(name, cond, detail=''):
    (ok if cond else fail).append(name)
    print('  %-4s %s%s' % ('PASS' if cond else 'FAIL', name, ('  -> ' + detail) if detail else ''))


def req(url, method='GET', body=None, headers=None, timeout=60):
    h = {'User-Agent': UA}
    h.update(headers or {})
    data = None
    if body is not None:
        data = json.dumps(body).encode('utf-8')
        h.setdefault('Content-Type', 'application/json')
    r = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw = resp.read().decode('utf-8')
            return resp.status, (json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8')
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {'raw': raw[:300]}


def keys():
    st, d = req('https://api.supabase.com/v1/projects/%s/api-keys' % REF,
                headers={'Authorization': 'Bearer ' + MGMT})
    out = {}
    for k in d or []:
        out[k.get('name') or k.get('type')] = k.get('api_key') or k.get('apiKey')
    return out


K = keys()
ANON, SERVICE = K.get('anon'), K.get('service_role')
if not (ANON and SERVICE):
    raise SystemExit('could not read api keys')

ADMIN = {'apikey': SERVICE, 'Authorization': 'Bearer ' + SERVICE}
PW = 'T' + secrets.token_urlsafe(20) + '9!'
USERS = [
    ('crew', 'e2e-crew@42creative.co.il'),
    ('outsider', 'e2e-outside@example.com'),
]
created = {}

print('== setup: throwaway users ==')
for role, email in USERS:
    st, d = req(BASE + '/auth/v1/admin/users', 'POST',
                {'email': email, 'password': PW, 'email_confirm': True}, ADMIN)
    if st >= 400 and 'already' in json.dumps(d).lower():
        st2, lst = req(BASE + '/auth/v1/admin/users?per_page=200', headers=ADMIN)
        for u in (lst or {}).get('users', []):
            if u.get('email') == email:
                created[role] = u['id']
        st, d = 200, {'id': created.get(role)}
    else:
        created[role] = (d or {}).get('id')
    check('created %s user' % role, bool(created.get(role)), email)


def signin(email):
    st, d = req(BASE + '/auth/v1/token?grant_type=password', 'POST',
                {'email': email, 'password': PW},
                {'apikey': ANON, 'Authorization': 'Bearer ' + ANON})
    return (d or {}).get('access_token')


def as_user(tok):
    return {'apikey': ANON, 'Authorization': 'Bearer ' + tok}


print('== crew path ==')
crew_tok = signin(USERS[0][1])
check('crew signed in', bool(crew_tok))
if crew_tok:
    h = as_user(crew_tok)
    st, d = req(BASE + '/rest/v1/shots?select=id,seq,script&limit=3', headers=h)
    check('crew can read shots', st == 200 and isinstance(d, list) and len(d) > 0,
          'HTTP %d, %d rows' % (st, len(d) if isinstance(d, list) else 0))

    shot_id = d[0]['id'] if isinstance(d, list) and d else None
    st2, pd = req(BASE + '/rest/v1/productions?select=id&limit=1', headers=h)
    prod_id = pd[0]['id'] if isinstance(pd, list) and pd else None

    if shot_id and prod_id:
        st3, _ = req(
            BASE + '/rest/v1/shot_status?on_conflict=shot_id', 'POST',
            [{'shot_id': shot_id, 'production_id': prod_id, 'state': 'partial',
              'completion_pct': 40, 'reason': 'e2e', 'updated_by_name': 'e2e-crew'}],
            dict(h, Prefer='resolution=merge-duplicates,return=representation'))
        check('crew can write a status', st3 in (200, 201), 'HTTP %d' % st3)

        st4, back = req(
            BASE + '/rest/v1/shot_status?shot_id=eq.%s&select=state,updated_by_name' % shot_id,
            headers=h)
        got = back[0] if isinstance(back, list) and back else {}
        check('write is readable back', got.get('state') == 'partial',
              json.dumps(got, ensure_ascii=False))

        # cleanup that status
        req(BASE + '/rest/v1/shot_status?shot_id=eq.%s' % shot_id, 'DELETE', None, h)

print('== outsider path ==')
out_tok = signin(USERS[1][1])
check('outsider signed in', bool(out_tok), 'authenticated but must see nothing')
if out_tok:
    h = as_user(out_tok)
    st, d = req(BASE + '/rest/v1/shots?select=id,script&limit=3', headers=h)
    empty = (st == 200 and isinstance(d, list) and len(d) == 0) or st >= 400
    check('outsider cannot read shots', empty,
          'HTTP %d, %s rows' % (st, len(d) if isinstance(d, list) else '?'))

    st2, d2 = req(BASE + '/rest/v1/productions?select=name', headers=h)
    empty2 = (st2 == 200 and isinstance(d2, list) and len(d2) == 0) or st2 >= 400
    check('outsider cannot read productions', empty2,
          'HTTP %d, %s rows' % (st2, len(d2) if isinstance(d2, list) else '?'))

    st3, _ = req(BASE + '/rest/v1/shot_status', 'POST',
                 [{'shot_id': '00000000-0000-0000-0000-000000000000',
                   'production_id': '00000000-0000-0000-0000-000000000000', 'state': 'done'}],
                 dict(h, Prefer='return=minimal'))
    check('outsider cannot write', st3 >= 400, 'HTTP %d' % st3)

print('== teardown ==')
for role, email in USERS:
    uid = created.get(role)
    if not uid:
        continue
    st, _ = req(BASE + '/auth/v1/admin/users/' + uid, 'DELETE', None, ADMIN)
    check('deleted %s user' % role, st in (200, 204), 'HTTP %d' % st)

print()
print('passed %d, failed %d' % (len(ok), len(fail)))
if fail:
    print('FAILED: ' + '; '.join(fail))
sys.exit(1 if fail else 0)

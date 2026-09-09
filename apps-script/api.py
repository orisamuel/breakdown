# -*- coding: utf-8 -*-
"""קליינט קטן ל-Web App של האפסקריפט. Apps Script מחזיר 302 ל-googleusercontent,
   והגוף האמיתי נמצא שם – אז עוקבים אחרי ה-Location ידנית ב-GET."""
import io, json, sys, urllib.request, urllib.parse, urllib.error

URL = io.open('.webapp-url', encoding='utf-8').read().strip()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req.full_url, code, msg, headers, fp)


_op = urllib.request.build_opener(NoRedirect)


def _body(url):
    with urllib.request.urlopen(url, timeout=180) as r:
        return r.read().decode('utf-8')


def call(payload=None, **params):
    """POST אם יש payload, אחרת GET עם params."""
    if payload is None:
        u = URL + ('?' + urllib.parse.urlencode(params) if params else '')
        return json.loads(_body(u))
    data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(URL, data=data,
                                 headers={'Content-Type': 'text/plain;charset=utf-8'})
    try:
        with _op.open(req, timeout=180) as r:
            return json.loads(r.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303, 307):
            return json.loads(_body(e.headers['Location']))
        raise


if __name__ == '__main__':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    arg = sys.argv[1] if len(sys.argv) > 1 else '{}'
    if arg.startswith('{'):
        print(json.dumps(call(json.loads(arg)), ensure_ascii=False, indent=1))
    else:
        print(json.dumps(call(**dict(p.split('=', 1) for p in arg.split('&') if p)),
                         ensure_ascii=False, indent=1))

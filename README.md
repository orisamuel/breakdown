# ברייקדאון

מערכת ברייקדאון להפקות. גוגל-שיט הוא **מקום הכתיבה**, Postgres הוא **המנוע**,
והאפליקציה היא שלושה משטחים על אותם נתונים.

```
דוק תסריטים ─┐
גוגל-שיט ────┼─► Apps Script (אדפטר) ─► Supabase/Postgres ─► Next.js על Vercel
זמינות ──────┘         מטפל בתאים              RLS + realtime      סט · לו״ז · לקוח
                       ממוזגים וכותרות
```

## קישורים

| | |
|---|---|
| אפליקציה (חדש) | https://breakdown.42creative.co.il — *ממתין לרשומת DNS, ראה למטה* |
| Vercel | פרויקט `breakdown` ב-team `42-team`, root `web` |
| Supabase | פרויקט `breakdown`, ארגון 42creative, `ceoegfwbwvdsbiztwskb`, eu-central-1 |
| גוגל-שיט אסטרל | https://docs.google.com/spreadsheets/d/12YslHLXOAoeqPFqpMzGRSg2AJX2Wqvuiay7qd_VAKwY/edit |
| Apps Script | https://script.google.com/home/projects/16by1gQ7-jxxiB-mMY_aVFtz40Ke4JN2hBZm-bWhm9PrkuHrY8pzdW3Rv/edit |
| אפליקציה (ישנה, גיבוי) | https://orisamuel.github.io/breakdown/ |

הגרסה הישנה על GitHub Pages נשארת עובדת עד שהחדשה מוכחת בסט. אין למחוק אותה
לפני 7.10.

## מה חסר כדי שזה יהיה נגיש

Vercel מגן על כל כתובת `*.vercel.app` בהתחברות לצוות, כך שהצוות והלקוח
חסומים. דומיין מותאם עוקף את זה. צריך שתי רשומות ב-DNS של `42creative.co.il`
(מנוהל ב-Hostinger — `ns1.dns-parking.com`):

| סוג | שם | ערך |
|---|---|---|
| `TXT` | `_vercel` | `vc-domain-verify=breakdown.42creative.co.il,1a049f1164a68ed4234a` |
| `CNAME` | `breakdown` | `4e263eec5b228ff2.vercel-dns-016.com` |

זו אותה תבנית שכבר עובדת ב-`eframe.42creative.co.il`.

## מבנה

| נתיב | מה זה |
|---|---|
| `web/` | האפליקציה — Next.js 16, App Router, TS, Tailwind 4 |
| `web/lib/useBoard.ts` | מנוע הלוח: תור כתיבה, realtime, אופליין |
| `web/components/SetMode.tsx` | מצב סט — "עכשיו" + הבאים |
| `db/001_schema.sql` | סכמה, RLS, ופונקציות הלקוח |
| `db/002_realtime.sql` | הוספת הטבלאות לפרסום ה-realtime |
| `db/import_from_sheet.py` | ייבוא: שיט → אפסקריפט → Postgres |
| `db/verify.py` | 9 בדיקות: סינון עמודות ללקוח, חסימת anon |
| `db/verify_auth.py` | 12 בדיקות: RLS מסשן אמיתי, צוות מול חיצוני |
| `apps-script/` | האדפטר לשיטס + ה-Web App הישן |
| `build.py` | מייצר את הברייקדאון של אסטרל (xlsx + appsdata.json) |
| `index.html` | האפליקציה הישנה, על GitHub Pages |

## הרשאות

| מי | איך | מה רואה |
|---|---|---|
| צוות | קישור למייל, דומיין `@42creative.co.il` | הכל |
| לקוח | קישור עם טוקן | **10 עמודות** — בלי לוגיסטיקת הפקה, הערות פנימיות, קאסט, הלבשה או סיבות |
| כל השאר | — | אפס שורות, 403 בכתיבה |

הסינון ללקוח הוא ברמת **העמודה**, דרך `client_board()` / `client_meta()` שהן
`SECURITY DEFINER`. זה מה שגליון משותף לא יכול לעשות בלי לתחזק שני קבצים.

`is_crew()` בודקת דומיין מייל. אם מישהו בצוות צריך לסמן מכתובת אחרת — צריך
טבלת allowlist במקום בדיקת דומיין.

## שיעורים שמובנים בקוד

- **סטטוסים לא נדרסים.** בגרסה הראשונה האפליקציה דחפה את כל אובייקט
  הסטטוסים והשרת כתב מחדש את כל הגליון, כך ששני מכשירים בסט מחקו אחד
  את השני. עכשיו כל סטטוס הוא שורה, וכותבים רק אותה.
- **הייבוא הוא upsert לפי `(production_id, seq)`** — עריכה בשיט וייבוא מחדש
  לא מוחקים סימונים.
- **תור הכתיבה נשמר ב-localStorage** ולא רק בזיכרון. בחוף באילת הקליטה
  תיפול, וסימון חייב לשרוד רענון.
- **מצב שמש.** ארבע ערכות ולא שתיים. רקע כהה בשמש ישירה פחות קריא —
  זה מה שפספסנו בגרסה הראשונה.
- **`002_realtime.sql` הוא חובה.** בלי הוספת הטבלאות לפרסום, ה-subscription
  נרשם בהצלחה ולא מקבל כלום.
- **Cloudflare חוסם `Python-urllib`** בשגיאה 1010 — צריך User-Agent אמיתי
  בכל קריאה ל-Management API.
- **PostgREST חושף רק `public`.** סכמה נפרדת הייתה מבודדת יפה וגם חוסמת
  את האפליקציה.

## פקודות

```bash
# עדכון הברייקדאון של אסטרל מ-build.py אל השיט
python build.py
cd apps-script && clasp push --force
python -c "from api import call; print(call({'action':'rebuild'}))"

# מהשיט אל הדאטהבייס
python db/import_from_sheet.py astral-hr

# בדיקות
python db/verify.py
python db/verify_auth.py

# האפליקציה
cd web && npm run dev
```

## סכנות מוכרות

- **הארגון `42 Production`** ב-Supabase ריק ונוצר בטעות בבדיקה. ה-API לא
  מוחק ארגונים — למחיקה מהדשבורד.
- **`gmach-pichefkes` מושהה** כדי לפנות מקום בתוכנית ה-Free. הפיך מהדשבורד.
- **סיסמת ה-DB** ב-`db/.db-password`, מחוץ לגיט. לא נדרשת לעבודה יומיומית.

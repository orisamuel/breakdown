// ============================================================
//  רישום הברייקדאונים – אילו גוגל-שיטס מחוברים למערכת
//  נשמר ב-ScriptProperties תחת המפתח PROJECTS
// ============================================================

var P_KEY = 'PROJECTS';

function props_() { return PropertiesService.getScriptProperties(); }

function projects_() {
  try {
    var raw = props_().getProperty(P_KEY);
    var list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch (e) { return []; }
}

function saveProjects_(list) { props_().setProperty(P_KEY, JSON.stringify(list)); }

/** מאתר ברייקדאון לפי id או לפי slug (הכתובת הקריאה לשיתוף) */
function findProject_(key) {
  key = String(key || '');
  var list = projects_(), i;
  for (i = 0; i < list.length; i++) if (list[i].id === key) return list[i];
  for (i = 0; i < list.length; i++) if (list[i].slug && list[i].slug === key) return list[i];
  return null;
}

/** כתובת קריאה: אנגלית/ספרות/מקפים בלבד. ריק אם אין מה לגזור. */
function slugify_(s) {
  var out = String(s || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40)
    .replace(/-+$/g, '');
  return out;
}

/** מוודא שה-slug פנוי; אם לא – מוסיף סיפרה */
function uniqueSlug_(base, exceptId) {
  if (!base) return '';
  var list = projects_(), taken = {};
  for (var i = 0; i < list.length; i++) {
    if (list[i].id !== exceptId && list[i].slug) taken[list[i].slug] = 1;
  }
  if (!taken[base]) return base;
  for (var n = 2; n < 50; n++) if (!taken[base + '-' + n]) return base + '-' + n;
  return '';
}

/** מחלץ מזהה קובץ מקישור גוגל-שיטס או מקבל מזהה ישר */
function extractId_(s) {
  s = String(s || '').trim();
  var m = s.match(/\/spreadsheets\/d\/([-\w]{20,})/);
  if (m) return m[1];
  m = s.match(/^[-\w]{20,}$/);
  if (m) return m[0];
  m = s.match(/([-\w]{25,})/);
  if (m) return m[1];
  throw new Error('לא זיהיתי מזהה גוגל-שיט בקישור הזה');
}

function newId_() { return 'p' + new Date().getTime().toString(36); }

/** מוסיף ברייקדאון חדש מקישור לגוגל-שיט. מאמת שאפשר לקרוא אותו. */
function addProject_(url, name, slug) {
  var ssId = extractId_(url);
  var list = projects_();
  for (var i = 0; i < list.length; i++) {
    if (list[i].ssId === ssId) throw new Error('הברייקדאון הזה כבר מחובר: ' + list[i].name);
  }

  var ss;
  try { ss = SpreadsheetApp.openById(ssId); }
  catch (e) { throw new Error('אין גישה לקובץ הזה. צריך שהחשבון שהסקריפט רץ בשמו יוכל לפתוח אותו.'); }

  var parsed = readBreakdown_(ss);   // זורק אם אין גליון ברייקדאון
  var shots = parsed.items.filter(function (x) { return !x.isBreak; }).length;
  if (!shots) throw new Error('נמצא גליון אבל בלי שוטים – בדוק שיש עמודת "תסריט" עם תוכן');

  var title = String(name || '').trim() || ss.getName();
  var entry = {
    id: newId_(),
    slug: uniqueSlug_(slugify_(slug) || slugify_(title)),
    name: title,
    ssId: ssId,
    url: ss.getUrl(),
    sheetName: parsed.sheetName,
    shots: shots,
    done: 0,
    addedAt: new Date().toISOString()
  };
  list.push(entry);
  saveProjects_(list);
  return entry;
}

function removeProject_(key) {
  var found = findProject_(key);
  var list = projects_(), out = [], hit = false;
  for (var i = 0; i < list.length; i++) {
    if (found && list[i].id === found.id) { hit = true; continue; }
    out.push(list[i]);
  }
  if (!hit) throw new Error('לא נמצא ברייקדאון כזה');
  saveProjects_(out);
  return true;
}

function renameProject_(key, name, slug) {
  var found = findProject_(key);
  if (!found) throw new Error('לא נמצא ברייקדאון כזה');
  var list = projects_(), hit = null;
  for (var i = 0; i < list.length; i++) {
    if (list[i].id !== found.id) continue;
    if (name !== undefined && String(name).trim()) list[i].name = String(name).trim();
    if (slug !== undefined) list[i].slug = uniqueSlug_(slugify_(slug), found.id);
    hit = list[i];
  }
  saveProjects_(list);
  return hit;
}

/** מעדכן את מוני השוטים/בוצעו ברישום (לתצוגה במסך הבחירה) */
function touchCounts_(id, shots, done) {  // id בלבד, לא slug
  var list = projects_(), changed = false;
  for (var i = 0; i < list.length; i++) {
    if (list[i].id !== id) continue;
    if (list[i].shots !== shots || list[i].done !== done) {
      list[i].shots = shots; list[i].done = done; changed = true;
    }
  }
  if (changed) saveProjects_(list);
}

/** רושם את הברייקדאון של אסטרל (שנבנה ב-setup) אם הוא עוד לא רשום */
function bootstrap() {
  var ssId = props_().getProperty('SS_ID');
  if (!ssId) { setup(); ssId = props_().getProperty('SS_ID'); }
  var list = projects_();
  for (var i = 0; i < list.length; i++) if (list[i].ssId === ssId) return list[i];
  var e = addProject_(ssId, DATA.title);
  Logger.log(JSON.stringify(e));
  return e;
}

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

function findProject_(id) {
  var list = projects_();
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
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

function slug_() { return 'p' + new Date().getTime().toString(36); }

/** מוסיף ברייקדאון חדש מקישור לגוגל-שיט. מאמת שאפשר לקרוא אותו. */
function addProject_(url, name) {
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

  var entry = {
    id: slug_(),
    name: String(name || '').trim() || ss.getName(),
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

function removeProject_(id) {
  var list = projects_(), out = [], hit = false;
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) { hit = true; continue; }
    out.push(list[i]);
  }
  if (!hit) throw new Error('לא נמצא ברייקדאון כזה');
  saveProjects_(out);
  return true;
}

function renameProject_(id, name) {
  var list = projects_(), hit = null;
  for (var i = 0; i < list.length; i++) if (list[i].id === id) { list[i].name = String(name).trim(); hit = list[i]; }
  if (!hit) throw new Error('לא נמצא ברייקדאון כזה');
  saveProjects_(list);
  return hit;
}

/** מעדכן את מוני השוטים/בוצעו ברישום (לתצוגה במסך הבחירה) */
function touchCounts_(id, shots, done) {
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

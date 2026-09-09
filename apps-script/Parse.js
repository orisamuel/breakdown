// ============================================================
//  קריאה גנרית של גליון ברייקדאון מכל גוגל-שיט
//  מזהה את הגליון ואת שורת הכותרת לבד, תומך בתאים ממוזגים
//  (מילוי כלפי מטה) ובפורמט של הברייקדאונים הישנים.
// ============================================================

// מפתח קנוני -> וריאציות של שם העמודה בכותרת
var ALIASES = {
  id:       ['#', 'מספר', 'id'],
  day:      ['יום'],
  ts:       ['שעה', 'שעות'],
  hotel:    ['מלון'],
  dep:      ['תלות קאסט', 'תלות'],
  cluster:  ['אשכול'],
  loc:      ['לוקיישן', 'מקום'],
  cat:      ['קטגוריה'],
  vid:      ['סרטון'],
  type:     ['סוג', 'סוג סרטון'],
  script:   ['תסריט', 'תיאור', 'שוט'],
  cast:     ['קאסט', 'שחקנים'],
  lc:       ['לוגיסטיקה - לקוח', 'לוגיסטיקה לקוח', 'לוגיסטיקה-לקוח', 'לקוח'],
  lp:       ['לוגיסטיקה - הפקה', 'לוגיסטיקה הפקה', 'לוגיסטיקה-הפקה', 'הפקה'],
  wardrobe: ['הלבשה', 'תלבושות'],
  notes:    ['הערות'],
  done:     ['בוצע']
};

// עמודות שנגררות כלפי מטה כשהתא ריק (תאים ממוזגים בשיטים הישנים)
var FILL_DOWN = ['day', 'ts', 'hotel', 'cat', 'vid', 'dep', 'cluster'];

var HEADER_SCAN_ROWS = 8;   // בכמה שורות ראשונות לחפש את הכותרת
var MIN_HEADER_HITS  = 3;   // כמה עמודות מזוהות נדרשות כדי להחליט שזו הכותרת

/** מנרמל כותרת: בלי רווחים, מקפים, גרשיים או סוגריים */
function norm_(s) {
  return String(s == null ? '' : s)
    .replace(/[\s\-‐-―_.,:()"'׳״]/g, '')
    .toLowerCase();
}

var ALIAS_INDEX = (function () {
  var m = {};
  for (var key in ALIASES) {
    for (var i = 0; i < ALIASES[key].length; i++) m[norm_(ALIASES[key][i])] = key;
  }
  return m;
})();

/** ממפה שורת כותרת -> { canonicalKey: colIndex }. מחזיר {} אם לא זוהה כלום */
function mapHeader_(row) {
  var map = {};
  for (var c = 0; c < row.length; c++) {
    var key = ALIAS_INDEX[norm_(row[c])];
    if (key && map[key] === undefined) map[key] = c;
  }
  return map;
}

function hits_(map) { var n = 0; for (var k in map) n++; return n; }

/** מוצא את הגליון ושורת הכותרת הטובים ביותר בקובץ */
function findBreakdown_(ss) {
  var sheets = ss.getSheets(), best = null;
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i], name = sh.getName();
    if (name.charAt(0) === '_') continue;              // גליונות פנימיים
    var lastRow = Math.min(sh.getLastRow(), HEADER_SCAN_ROWS);
    if (lastRow < 1 || sh.getLastColumn() < 2) continue;
    var head = sh.getRange(1, 1, lastRow, sh.getLastColumn()).getDisplayValues();
    for (var r = 0; r < head.length; r++) {
      var map = mapHeader_(head[r]), n = hits_(map);
      if (n < MIN_HEADER_HITS || map.script === undefined) continue;
      // בונוס לגליון שנקרא "ברייקדאון" ולשורת כותרת גבוהה
      var score = n * 10 + (norm_(name) === norm_('ברייקדאון') ? 25 : 0) - r;
      if (!best || score > best.score) {
        best = { sheet: sh, headerRow: r + 1, map: map, score: score, name: name };
      }
    }
  }
  return best;
}

/**
 * מזהה שורות מקטע/ארוחה: בגוגל-שיטס תא ממוזג שומר את הערך רק בתא
 * העוגן, ולכן אי אפשר לזהות אותן לפי תוכן – צריך את טווחי המיזוג.
 * מיזוג אופקי (שורה אחת, 3+ עמודות) = כותרת מקטע.
 * מיזוג אנכי לא נחשב – אותו מטפל מילוי כלפי מטה.
 */
function mergedBreakRows_(sh, firstRow, numRows) {
  var set = {};
  try {
    var ranges = sh.getRange(firstRow, 1, numRows, sh.getLastColumn()).getMergedRanges();
    for (var i = 0; i < ranges.length; i++) {
      var r = ranges[i];
      if (r.getNumRows() === 1 && r.getNumColumns() >= 3) set[r.getRow()] = true;
    }
  } catch (e) {}
  return set;
}

/** שורת כותרת שחוזרת בתוך הנתונים (נפוץ בסוף גליון) */
function isRepeatedHeader_(row) {
  var m = mapHeader_(row);
  return hits_(m) >= 3 && m.script !== undefined;
}

function firstText_(row) {
  for (var c = 0; c < row.length; c++) {
    var v = String(row[c] == null ? '' : row[c]).trim();
    if (v) return v;
  }
  return '';
}

/**
 * קורא את השוטים מקובץ. מחזיר { items, sheetName, headerRow, columns }
 * items: [{id, day, ts, hotel, dep, cluster, loc, cat, vid, type, script,
 *          cast, lc, lp, wardrobe, notes, isBreak}]
 */
function readBreakdown_(ss) {
  var found = findBreakdown_(ss);
  if (!found) throw new Error('לא נמצא גליון ברייקדאון בקובץ הזה. צריך שורת כותרת עם לפחות "תסריט" ועוד שתי עמודות מוכרות.');

  var sh = found.sheet, map = found.map;
  var last = sh.getLastRow();
  if (last <= found.headerRow) return { items: [], sheetName: found.name, headerRow: found.headerRow, columns: map };

  var firstRow = found.headerRow + 1, numRows = last - found.headerRow;
  var vals = sh.getRange(firstRow, 1, numRows, sh.getLastColumn()).getDisplayValues();
  var breaks = mergedBreakRows_(sh, firstRow, numRows);
  var items = [], carry = {}, auto = 0, nBreak = 0;

  for (var r = 0; r < vals.length; r++) {
    var row = vals[r];
    var raw = {};
    for (var k in map) raw[k] = String(row[map[k]] == null ? '' : row[map[k]]).trim();

    var anything = false;
    for (var c = 0; c < row.length; c++) { if (String(row[c] == null ? '' : row[c]).trim()) { anything = true; break; } }
    if (!anything) continue;

    if (isRepeatedHeader_(row)) continue;   // כותרת שחוזרת בתוך הנתונים

    if (breaks[firstRow + r]) {
      nBreak++;
      items.push({ id: 'b' + nBreak, isBreak: true, script: firstText_(row),
                   day: carry.day || '', ts: raw.ts || '' });
      continue;
    }

    // מילוי כלפי מטה לעמודות שנוטות להיות ממוזגות
    for (var i = 0; i < FILL_DOWN.length; i++) {
      var f = FILL_DOWN[i];
      if (map[f] === undefined) continue;
      if (raw[f]) carry[f] = raw[f]; else raw[f] = carry[f] || '';
    }

    if (!raw.script) continue;   // בלי תסריט זה לא שוט

    auto++;
    var o = { isBreak: false };
    for (var k2 in map) o[k2] = raw[k2] || '';
    o.id = raw.id ? (Number(raw.id) || raw.id) : auto;
    items.push(o);
  }

  return { items: items, sheetName: found.name, headerRow: found.headerRow, columns: map };
}

/** גליון הסטטוסים המוסתר של קובץ נתון */
function statusSheet_(ss) {
  var sh = ss.getSheetByName('_status');
  if (!sh) {
    sh = ss.insertSheet('_status');
    sh.getRange(1, 1, 1, 7)
      .setValues([['id', 'status', 'completionPct', 'reason', 'notes', 'tsOverride', 'updatedAt']])
      .setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  try { sh.hideSheet(); } catch (e) {}
  return sh;
}

function readStatusesOf_(ss) {
  var sh = ss.getSheetByName('_status');
  if (!sh || sh.getLastRow() < 2) return {};
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues();
  var out = {};
  for (var r = 0; r < vals.length; r++) {
    var id = String(vals[r][0]).trim();
    if (!id) continue;
    var o = { status: String(vals[r][1] || 'pending') };
    if (vals[r][2] !== '' && vals[r][2] !== null) o.completionPct = Number(vals[r][2]);
    if (vals[r][3]) o.reason = String(vals[r][3]);
    if (vals[r][4]) o.notes = String(vals[r][4]);
    if (vals[r][5]) o.tsOverride = String(vals[r][5]);
    if (vals[r][6]) o.updatedAt = String(vals[r][6]);
    out[id] = o;
  }
  return out;
}

var LABELS = {
  pending: '', done: 'בוצע', partial: 'חלקית', delayed: 'נדחה', skipped: 'לא בוצע'
};

/**
 * ממזג פאטץ׳ אל הסטטוסים הקיימים. קורא-ממזג-כותב *בתוך* ה-lock של doPost,
 * ולכן לקוח עם מצב מיושן לא יכול לדרוס שינוי של לקוח אחר.
 * patch = { <id>: {status?, completionPct?, reason?, notes?, tsOverride?} | null }
 *   null במקום אובייקט = מחיקת הסטטוס של הפריט.
 *   null בשדה בודד     = מחיקת השדה.
 */
function mergeStatusesOf_(ss, patch) {
  var cur = readStatusesOf_(ss);
  var stamp = new Date().toISOString();
  var changed = [];

  for (var id in patch) {
    if (!Object.prototype.hasOwnProperty.call(patch, id)) continue;
    var p = patch[id];
    changed.push(id);
    if (p === null || p === undefined) { delete cur[id]; continue; }
    var merged = {};
    if (cur[id]) for (var k0 in cur[id]) merged[k0] = cur[id][k0];
    for (var k in p) {
      if (!Object.prototype.hasOwnProperty.call(p, k)) continue;
      if (p[k] === null) delete merged[k];
      else merged[k] = p[k];
    }
    merged.updatedAt = stamp;
    cur[id] = merged;
  }

  writeAllStatuses_(ss, cur);
  return { statuses: cur, changed: changed };
}

/** כותב את המצב המלא. לקרוא רק מתוך lock, על מצב שמוזג מהשרת. */
function writeAllStatuses_(ss, statuses) {
  var sh = statusSheet_(ss);
  var ids = Object.keys(statuses);
  ids.sort(function (a, b) { return (Number(a) || 0) - (Number(b) || 0); });

  var rows = ids.map(function (id) {
    var s = statuses[id] || {};
    return [id, s.status || 'pending',
            (s.completionPct === undefined || s.completionPct === null) ? '' : s.completionPct,
            s.reason || '', s.notes || '', s.tsOverride || '', s.updatedAt || ''];
  });

  if (sh.getMaxRows() > 1) sh.getRange(2, 1, sh.getMaxRows() - 1, 7).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 7).setValues(rows);

  reflectDoneOf_(ss, statuses);
}

/** משקף סטטוסים לעמודת "בוצע" בגליון הברייקדאון, אם קיימת */
function reflectDoneOf_(ss, statuses) {
  var found = findBreakdown_(ss);
  if (!found || found.map.done === undefined) return;
  var sh = found.sheet, map = found.map;
  var last = sh.getLastRow();
  if (last <= found.headerRow) return;

  var idCol = map.id === undefined ? 0 : map.id;
  var vals = sh.getRange(found.headerRow + 1, 1, last - found.headerRow, sh.getLastColumn()).getDisplayValues();
  var col = [], auto = 0;
  for (var r = 0; r < vals.length; r++) {
    var id;
    if (map.id === undefined) { auto++; id = String(auto); }
    else id = String(vals[r][idCol]).trim();
    var s = statuses[id];
    var label = s ? (LABELS[s.status] === undefined ? s.status : LABELS[s.status]) : '';
    if (s && s.status === 'partial' && s.completionPct) label += ' ' + s.completionPct + '%';
    col.push([label]);
  }
  sh.getRange(found.headerRow + 1, map.done + 1, col.length, 1).setValues(col);
}

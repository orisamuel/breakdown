// ============================================================
//  Web App – ניתוב
//
//  GET  ?action=list            -> { projects:[...] }
//  GET  ?p=<projectId>          -> { project, items, statuses }
//
//  POST { action:'add', url, name }      -> { ok, project }
//  POST { action:'remove', p }           -> { ok }
//  POST { action:'rename', p, name }     -> { ok, project }
//  POST { p, statuses:{...} }            -> { ok, ts }
//
//  כל ברייקדאון הוא גוגל-שיט נפרד. הסטטוסים שלו נשמרים בגליון
//  מוסתר _status *בתוך אותו קובץ*, ומשוקפים לעמודת "בוצע".
// ============================================================

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    var q = (e && e.parameter) || {};
    if (q.action === 'diag' && q.p) return json_(diag_(q.p));
    if (q.p) return json_(loadProject_(q.p));
    return json_({ projects: projects_() });
  } catch (err) {
    return json_({ error: String((err && err.message) || err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = body.action || ((body.patch || body.statuses) ? 'statuses' : '');

    if (action === 'add')    return json_({ ok: true, project: addProject_(body.url, body.name, body.slug) });
    if (action === 'remove') return json_({ ok: removeProject_(body.p) });
    if (action === 'rename') return json_({ ok: true, project: renameProject_(body.p, body.name, body.slug) });
    if (action === 'rebuild') return json_({ ok: true, url: setup() });

    if (action === 'statuses') {
      var entry = body.p ? findProject_(body.p) : legacyProject_();
      if (!entry) throw new Error('לא נמצא ברייקדאון כזה');
      var ss = SpreadsheetApp.openById(entry.ssId);
      var result;
      if (body.replace === true) {
        // איפוס מלא – רק לניהול, לא ממסך הסט
        writeAllStatuses_(ss, body.statuses || {});
        result = { statuses: body.statuses || {}, changed: Object.keys(body.statuses || {}) };
      } else {
        // ברירת המחדל: מיזוג. body.patch עדיף; body.statuses נתמך לתאימות.
        result = mergeStatusesOf_(ss, body.patch || body.statuses || {});
      }
      refreshCounts_(entry, ss, result.statuses);
      // מחזירים את המצב המלא כדי שהלקוח יתיישר מיד, בלי להמתין לפול
      return json_({ ok: true, ts: new Date().getTime(),
                     changed: result.changed, statuses: result.statuses });
    }

    throw new Error('פעולה לא מוכרת: ' + action);
  } catch (err) {
    return json_({ error: String((err && err.message) || err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/** תאימות לאחור: POST בלי p מגיע לברייקדאון של אסטרל */
function legacyProject_() {
  var ssId = props_().getProperty('SS_ID');
  if (!ssId) return null;
  var list = projects_();
  for (var i = 0; i < list.length; i++) if (list[i].ssId === ssId) return list[i];
  return list.length ? list[0] : null;
}

function loadProject_(id) {
  var entry = findProject_(id);
  if (!entry) throw new Error('לא נמצא ברייקדאון כזה');
  var ss = SpreadsheetApp.openById(entry.ssId);
  var parsed = readBreakdown_(ss);
  var statuses = readStatusesOf_(ss);
  refreshCounts_(entry, ss, statuses, parsed);
  return {
    project: {
      id: entry.id, slug: entry.slug || '', name: entry.name, url: ss.getUrl(),
      sheetName: parsed.sheetName, columns: Object.keys(parsed.columns)
    },
    items: parsed.items,
    statuses: statuses
  };
}

function refreshCounts_(entry, ss, statuses, parsed) {
  try {
    if (!parsed) parsed = readBreakdown_(ss);
    var shots = 0;
    for (var i = 0; i < parsed.items.length; i++) if (!parsed.items[i].isBreak) shots++;
    var done = 0;
    for (var k in (statuses || {})) if (statuses[k] && statuses[k].status === 'done') done++;
    touchCounts_(entry.id, shots, done);
  } catch (e) {}
}

/** אבחון: מה בדיוק המנתח רואה בקובץ נתון */
function diag_(id) {
  var entry = findProject_(id);
  if (!entry) throw new Error('לא נמצא');
  var ss = SpreadsheetApp.openById(entry.ssId);
  var found = findBreakdown_(ss);
  var sh = found.sheet;
  var first = found.headerRow + 1, n = sh.getLastRow() - found.headerRow;
  var merged = sh.getRange(first, 1, n, sh.getLastColumn()).getMergedRanges();
  var mm = merged.slice(0, 25).map(function (r) {
    return { row: r.getRow(), rows: r.getNumRows(), cols: r.getNumColumns(),
             val: String(r.getCell(1, 1).getValue()).substring(0, 30) };
  });
  var vals = sh.getRange(first, 1, Math.min(n, 400), sh.getLastColumn()).getValues();
  var reps = [];
  for (var r = 0; r < vals.length; r++) {
    if (isRepeatedHeader_(vals[r])) reps.push({ row: first + r, hits: hits_(mapHeader_(vals[r])) });
  }
  return {
    sheetName: found.name, headerRow: found.headerRow,
    header: sh.getRange(found.headerRow, 1, 1, sh.getLastColumn()).getValues()[0],
    columns: found.map, lastRow: sh.getLastRow(), lastCol: sh.getLastColumn(),
    mergedTotal: merged.length, mergedSample: mm, repeatedHeaders: reps
  };
}

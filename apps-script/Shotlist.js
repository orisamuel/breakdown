// ============================================================
//  שוט ליסט · שער האישור
//
//  בונה גוגל-שיט נפרד לשוט-ליסט, שאורי עובר עליו ומעדכן.
//  אחרי העריכה readShotlist() מחזיר את התוכן, כדי לתזמן על
//  בסיס הגרסה המאושרת שלו ולא על ההערכות שלי.
// ============================================================

var SL_TAB = 'שוט ליסט';
var SL_TOTALS = 'סיכום זמנים';
var SL_KEY = 'SHOTLIST_SS_ID';

/** יוצר או מרענן את הגוגל-שיט של השוט-ליסט. מחזיר קישור. */
function buildShotlist() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(SL_KEY);
  var ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(SHOTLIST.title);
    props.setProperty(SL_KEY, ss.getId());
  }

  renderShotlist_(ss);
  renderTotals_(ss);

  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('גיליון1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  ss.setActiveSheet(ss.getSheetByName(SL_TAB));

  var url = ss.getUrl();
  Logger.log(url);
  return url;
}

function shotlistUrl() {
  var id = PropertiesService.getScriptProperties().getProperty(SL_KEY);
  return id ? SpreadsheetApp.openById(id).getUrl() : '';
}

function renderShotlist_(ss) {
  var D = SHOTLIST;
  var sh = fresh_(ss, SL_TAB);
  var nc = D.headers.length;
  var all = [D.headers].concat(D.rows);

  var rng = sh.getRange(1, 1, all.length, nc);
  rng.setValues(all);
  rng.setVerticalAlignment('top').setWrap(true)
     .setBorder(true, true, true, true, true, true, BORDER, SpreadsheetApp.BorderStyle.SOLID);
  header_(sh, nc);

  // צביעה מרוכזת: קטגוריה + מצב הלבשה
  var catBg = [], wBg = [];
  for (var r = 0; r < D.rows.length; r++) {
    var c = '#' + (D.catColors['' + D.rows[r][D.catCol]] || 'FFFFFF');
    catBg.push([c, c]);
    wBg.push(['#' + (D.wardrobeColors['' + D.rows[r][D.wardrobeCol]] || 'FFFFFF')]);
  }
  sh.getRange(2, D.catCol + 1, D.rows.length, 2).setBackgrounds(catBg);
  sh.getRange(2, D.wardrobeCol + 1, D.rows.length, 1).setBackgrounds(wBg);

  // הדקות – העמודה שהכי חשוב שתהיה קריאה ועריכה
  sh.getRange(2, D.minCol + 1, D.rows.length, 1)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setNumberFormat('0');

  // שם הסרטון מודגש רק בשורה הראשונה שלו
  var prev = null;
  for (var i = 0; i < D.rows.length; i++) {
    var vid = D.rows[i][D.vidCol];
    if (vid !== prev) { sh.getRange(i + 2, D.vidCol + 1).setFontWeight('bold'); prev = vid; }
  }

  // עמודת "אושר" – תיבות סימון, כדי שהאישור יהיה לחיצה ולא הקלדה
  var okCol = D.okCol + 1;
  sh.getRange(2, okCol, D.rows.length, 1)
    .insertCheckboxes()
    .setHorizontalAlignment('center');

  for (var w = 0; w < nc; w++) {
    sh.setColumnWidth(w + 1, Math.round((D.widths[w] || 14) * PX));
  }
  sh.setFrozenRows(1);
  sh.setFrozenColumns(4);
  sh.getRange(1, 1, all.length, nc).createFilter();
  trim_(sh, all.length, nc);

  // הערה על עמודת הדקות, כדי שיהיה ברור מה ההערכה כוללת
  sh.getRange(1, D.minCol + 1)
    .setNote('הערכת זמן כולל סטאפ, בדקות. זו ההנחה שלנו – לעדכן בחופשיות.\n' +
             'שוט בלי הערכה חוסם את התזמון.');
  sh.getRange(1, D.wardrobeCol + 1)
    .setNote('מצב הלבשה. המתזמן משתמש בזה כדי לא לקפוץ בגד ים → בגדים → בגד ים.');
  return sh;
}

function renderTotals_(ss) {
  var D = SHOTLIST.totals;
  var sh = fresh_(ss, SL_TOTALS);
  var row = 1;

  sh.getRange(row, 1).setValue('סיכום זמנים – לפני תזמון')
    .setFontWeight('bold').setFontSize(13);
  row += 2;

  function section(title, rows) {
    sh.getRange(row, 1).setValue(title).setFontWeight('bold').setFontSize(11);
    row += 1;
    sh.getRange(row, 1, 1, D.headers.length).setValues([D.headers])
      .setBackground(HEADER_BG).setFontColor('#FFFFFF').setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setBorder(true, true, true, true, true, true, BORDER, SpreadsheetApp.BorderStyle.SOLID);
    row += 1;
    if (rows.length) {
      sh.getRange(row, 1, rows.length, D.headers.length).setValues(rows)
        .setBorder(true, true, true, true, true, true, BORDER, SpreadsheetApp.BorderStyle.SOLID);
      sh.getRange(row, 2, rows.length, 3).setHorizontalAlignment('center');
      row += rows.length;
    }
    row += 1;
  }

  section('סה״כ', D.overall);
  section('לפי תלות קאסט', D.byDep);
  section('לפי מלון', D.byHotel);
  section('לפי הלבשה – החלפות הן זמן מבוזבז', D.byWardrobe);
  section('לפי אזור – בסיס לאשכול', D.byArea);

  var widths = [46, 9, 9, 9];
  for (var i = 0; i < widths.length; i++) sh.setColumnWidth(i + 1, Math.round(widths[i] * PX));
  trim_(sh, row, D.headers.length);
  return sh;
}

/**
 * קורא את השוט-ליסט חזרה אחרי עריכה.
 * מחזיר את השורות לפי שמות העמודות, כדי שהתזמון יתבסס על
 * הגרסה המאושרת ולא על מה שנוצר כאן.
 */
function readShotlist() {
  var id = PropertiesService.getScriptProperties().getProperty(SL_KEY);
  if (!id) throw new Error('השוט-ליסט עוד לא נבנה');
  var sh = SpreadsheetApp.openById(id).getSheetByName(SL_TAB);
  if (!sh) throw new Error('לא נמצא גליון "' + SL_TAB + '"');

  var last = sh.getLastRow();
  if (last < 2) return { items: [], approved: 0, total: 0 };

  var vals = sh.getRange(1, 1, last, sh.getLastColumn()).getDisplayValues();
  var head = vals[0];
  var idx = {};
  for (var c = 0; c < head.length; c++) idx[String(head[c]).trim()] = c;

  function pick(row, name) {
    var i = idx[name];
    return i === undefined ? '' : String(row[i] == null ? '' : row[i]).trim();
  }

  var out = [], approved = 0;
  for (var r = 1; r < vals.length; r++) {
    var row = vals[r];
    var desc = pick(row, 'תיאור');
    if (!desc) continue;
    var ok = /^(TRUE|true|כן|✓|V|v)$/.test(pick(row, 'אושר'));
    if (ok) approved++;
    out.push({
      seq: Number(pick(row, '#')) || out.length + 1,
      cat: pick(row, 'קטגוריה'),
      vid: pick(row, 'סרטון'),
      shotNo: Number(pick(row, 'שוט')) || null,
      desc: desc,
      hotel: pick(row, 'מלון'),
      area: pick(row, 'אזור'),
      who: pick(row, 'משתתפים'),
      props: pick(row, 'אביזרים').split(' · ').filter(String),
      wardrobe: pick(row, 'הלבשה'),
      estMin: Number(pick(row, 'דק׳')) || 0,
      dep: pick(row, 'תלות קאסט'),
      note: pick(row, 'הערות'),
      approved: ok
    });
  }
  return { items: out, approved: approved, total: out.length,
           missingEst: out.filter(function (x) { return !x.estMin; }).length };
}

// ============================================================
//  בונה את הגוגל-שיט של הברייקדאון – 4 גליונות
//  הרצה: setup() פעם אחת / rebuild() לרענון מהנתונים
//
//  אין יותר גליון "לוז" נפרד: הארוחות, המעברים ושחרור הקאסט
//  יושבים כשורות ממוזגות בתוך גליון הברייקדאון עצמו.
// ============================================================

var HEADER_BG = '#1E293B';
var BORDER    = '#CBD5E1';

var TAB_SHEETS = 'ברייקדאון';
var TAB_CLIENT = 'בקשות ללקוח';
var TAB_PROPS  = 'פרופס ומשימות';
var TAB_NOTES  = 'הנחות ושאלות';
var TAB_STATUS = '_status';
var TAB_OLD_SCHED = 'לוז';        // נמחק אם נשאר מגרסה קודמת

var PX = 7.2;   // רוחב-תווים של אקסל -> פיקסלים

/** יוצר או מרענן את הגוגל-שיט. מחזיר את הקישור. */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SS_ID');
  var ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(DATA.title);
    props.setProperty('SS_ID', ss.getId());
  }
  render_(ss);
  var url = ss.getUrl();
  Logger.log(url);
  return url;
}

function rebuild() { return setup(); }

function render_(ss) {
  buildShots_(ss);
  buildClient_(ss);
  tab_(ss, TAB_PROPS, DATA.propsHeaders, DATA.props, DATA.propsWidths);
  paintNotes_(tab_(ss, TAB_NOTES, DATA.notesHeaders, DATA.notes, DATA.notesWidths));

  statusSheet_(ss);
  reorder_(ss, [TAB_SHEETS, TAB_CLIENT, TAB_PROPS, TAB_NOTES]);

  var old = ss.getSheetByName(TAB_OLD_SCHED);
  if (old) ss.deleteSheet(old);
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('גיליון1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  ss.setActiveSheet(ss.getSheetByName(TAB_SHEETS));
}

/** גליון בסיסי: כותרת מעוצבת, גבולות, רוחבי עמודות */
function tab_(ss, name, headers, rows, widths) {
  var sh = fresh_(ss, name);
  var nc = headers.length;
  var all = [headers];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i].slice(0, nc);
    while (r.length < nc) r.push('');
    all.push(r);
  }
  var rng = sh.getRange(1, 1, all.length, nc);
  rng.setValues(all);
  rng.setVerticalAlignment('top').setWrap(true)
     .setBorder(true, true, true, true, true, true, BORDER, SpreadsheetApp.BorderStyle.SOLID);
  header_(sh, nc);
  for (var c = 0; c < nc; c++) sh.setColumnWidth(c + 1, Math.round((widths[c] || 14) * PX));
  sh.setFrozenRows(1);
  trim_(sh, all.length, nc);
  return sh;
}

function fresh_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clear();
  sh.clearConditionalFormatRules();
  var f = sh.getFilter(); if (f) f.remove();
  var merges = sh.getRange(1, 1, Math.max(sh.getMaxRows(), 1), Math.max(sh.getMaxColumns(), 1)).getMergedRanges();
  for (var i = 0; i < merges.length; i++) merges[i].breakApart();
  // חייבים לשחרר הקפאה מרנדור קודם – אחרת מיזוג שחוצה את גבול ההקפאה נכשל
  sh.setFrozenColumns(0);
  sh.setFrozenRows(0);
  sh.setRightToLeft(true);
  return sh;
}

function header_(sh, nc) {
  sh.getRange(1, 1, 1, nc)
    .setBackground(HEADER_BG).setFontColor('#FFFFFF').setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
}

function trim_(sh, rows, cols) {
  if (sh.getMaxColumns() > cols) sh.deleteColumns(cols + 1, sh.getMaxColumns() - cols);
  if (sh.getMaxRows() > rows) sh.deleteRows(rows + 1, sh.getMaxRows() - rows);
}

// ---------------- גליון הברייקדאון ----------------
function buildShots_(ss) {
  var headers = DATA.shotHeaders, rows = DATA.shots, nc = headers.length;
  var sh = tab_(ss, TAB_SHEETS, headers, rows, DATA.shotWidths);

  var isBreak = {};
  for (var i = 0; i < DATA.breakRows.length; i++) isBreak[DATA.breakRows[i]] = true;

  // צביעה מרוכזת: יום + תלות קאסט
  var dayBg = [], depBg = [];
  for (var r = 0; r < rows.length; r++) {
    var d = DATA.dayColors['' + rows[r][1]] || 'FFFFFF';
    var isB = !!isBreak[r + 1];
    var g = isB ? DATA.breakBg : d;
    dayBg.push(['#' + g, '#' + g, '#' + g, '#' + g]);
    depBg.push([isB ? '#' + DATA.breakBg
                    : '#' + (DATA.depColors['' + rows[r][4]] || 'FFFFFF')]);
  }
  if (rows.length) {
    sh.getRange(2, 1, rows.length, 4).setBackgrounds(dayBg);
    var dep = sh.getRange(2, 5, rows.length, 1);
    dep.setBackgrounds(depBg).setFontWeight('bold')
       .setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.getRange(2, 2, rows.length, 1).setFontWeight('bold');
  }

  // שורות מקטע: מיזוג אופקי מעמודת המלון ועד הסוף.
  // המיזוג הוא גם מה שמאפשר למנתח לזהות אותן כמקטע ולא כשוט.
  for (var b = 0; b < DATA.breakRows.length; b++) {
    var row = DATA.breakRows[b] + 1;      // +1 על שורת הכותרת
    var label = rows[DATA.breakRows[b] - 1][10];   // עמודת "תסריט"
    sh.getRange(row, 11, 1, nc - 10).clearContent();
    sh.getRange(row, 4, 1, nc - 3).merge();
    sh.getRange(row, 4)
      .setValue(label)
      .setFontWeight('bold').setFontStyle('italic').setFontColor('#334155')
      // בלי setHorizontalAlignment: ב-RTL הערכים left/right מתהפכים, ו-general
      // מיישר עברית לימין – בדיוק בתחילת המיזוג, ליד השעה
      .setHorizontalAlignment('general').setVerticalAlignment('middle').setWrap(true);
    sh.getRange(row, 1, 1, nc)
      .setBackground('#' + DATA.breakBg)
      .setBorder(true, true, true, true, null, null, BORDER, SpreadsheetApp.BorderStyle.SOLID);
  }

  sh.getRange(1, 1, rows.length + 1, nc).createFilter();
  // 3 בלבד: שורות המקטע ממוזגות מעמודה 4, ואי אפשר למזג מעבר לגבול ההקפאה
  sh.setFrozenColumns(3);
  appendLegend_(sh, nc);
  return sh;
}

function appendLegend_(sh, nc) {
  var start = sh.getLastRow() + 2;
  sh.insertRowsAfter(sh.getMaxRows(), DATA.legend.length + 2);
  sh.getRange(start, 2).setValue('מקרא – תלות קאסט').setFontWeight('bold').setFontSize(12);
  for (var i = 0; i < DATA.legend.length; i++) {
    var row = start + 1 + i;
    sh.getRange(row, 2).setValue(DATA.legend[i][0])
      .setBackground('#' + (DATA.depColors['' + DATA.legend[i][0]] || 'FFFFFF'))
      .setFontWeight('bold').setHorizontalAlignment('center');
    sh.getRange(row, 3).setValue(DATA.legend[i][1]);
  }
}

// ---------------- בקשות ללקוח: "מתי איפה" + הדרישות ----------------
function buildClient_(ss) {
  var sh = fresh_(ss, TAB_CLIENT);
  var W = DATA.clientWidths, IW = DATA.itinWidths;
  var nc = DATA.clientHeaders.length;
  var row = 1;

  sh.getRange(row, 1).setValue('מתי אנחנו איפה – סדר היום למלונות')
    .setFontWeight('bold').setFontSize(13);
  row += 1;

  var ih = DATA.itinHeaders;
  sh.getRange(row, 1, 1, ih.length).setValues([ih]);
  sh.getRange(row, 1, 1, ih.length)
    .setBackground(HEADER_BG).setFontColor('#FFFFFF').setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true)
    .setBorder(true, true, true, true, true, true, BORDER, SpreadsheetApp.BorderStyle.SOLID);
  var itinHeaderRow = row;
  row += 1;

  var itinStart = row;
  if (DATA.itin.length) {
    sh.getRange(row, 1, DATA.itin.length, ih.length).setValues(DATA.itin)
      .setVerticalAlignment('top').setWrap(true)
      .setBorder(true, true, true, true, true, true, BORDER, SpreadsheetApp.BorderStyle.SOLID);
  }
  var brk = {};
  for (var i = 0; i < DATA.itinBreaks.length; i++) brk[DATA.itinBreaks[i]] = true;
  for (var r = 0; r < DATA.itin.length; r++) {
    var abs = itinStart + r;
    if (brk[r + 1]) {
      sh.getRange(abs, 1, 1, ih.length).setBackground('#' + DATA.breakBg);
      sh.getRange(abs, 4).setFontWeight('bold').setFontStyle('italic').setFontColor('#334155');
    } else {
      var d = '#' + (DATA.dayColors['' + DATA.itin[r][0]] || 'FFFFFF');
      sh.getRange(abs, 1, 1, 2).setBackground(d);
      var dc = DATA.depColors['' + DATA.itin[r][4]];
      if (dc) {
        sh.getRange(abs, 5).setBackground('#' + dc)
          .setHorizontalAlignment('center').setVerticalAlignment('middle');
      }
    }
    sh.getRange(abs, 1).setFontWeight('bold');
  }
  row = itinStart + DATA.itin.length + 2;

  sh.getRange(row, 1).setValue('מה צריך מהלקוח – לפי סדר הצילום')
    .setFontWeight('bold').setFontSize(13);
  row += 1;
  sh.getRange(row, 1, 1, nc).setValues([DATA.clientHeaders]);
  sh.getRange(row, 1, 1, nc)
    .setBackground(HEADER_BG).setFontColor('#FFFFFF').setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true)
    .setBorder(true, true, true, true, true, true, BORDER, SpreadsheetApp.BorderStyle.SOLID);
  row += 1;

  if (DATA.client.length) {
    sh.getRange(row, 1, DATA.client.length, nc).setValues(DATA.client)
      .setVerticalAlignment('top').setWrap(true)
      .setBorder(true, true, true, true, true, true, BORDER, SpreadsheetApp.BorderStyle.SOLID);
    for (var k = 0; k < DATA.client.length; k++) {
      var f = '#' + (DATA.dayColors['' + DATA.client[k][1]] || 'FFFFFF');
      sh.getRange(row + k, 2, 1, 2).setBackground(f);
      sh.getRange(row + k, 2).setFontWeight('bold');
    }
  }

  var wide = Math.max(nc, ih.length);
  for (var c = 0; c < wide; c++) {
    var w = (c < W.length ? W[c] : 14);
    if (IW[c] && IW[c] > w) w = IW[c];
    sh.setColumnWidth(c + 1, Math.round(w * PX));
  }
  sh.setFrozenRows(itinHeaderRow);
  trim_(sh, row + DATA.client.length - 1, wide);
  return sh;
}

/** ירוק לסגור, אפור לפתוח, צהוב לשאלה */
function paintNotes_(sh) {
  var rows = DATA.notes;
  for (var i = 0; i < rows.length; i++) {
    var t = rows[i][1], bg = '#FEF3C7';
    if (t === 'סגור') bg = '#DCFCE7';
    else if (t === 'פתוח') bg = '#E2E8F0';
    sh.getRange(i + 2, 2).setBackground(bg).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  }
}

function reorder_(ss, names) {
  for (var i = 0; i < names.length; i++) {
    var sh = ss.getSheetByName(names[i]);
    if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); }
  }
}

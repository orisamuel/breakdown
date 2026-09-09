// ============================================================
//  בונה את הגוגל-שיט של הברייקדאון – כל 5 הגליונות
//  הרצה: setup()  (פעם אחת)  /  rebuild()  (רענון מהנתונים)
// ============================================================

var HEADER_BG = '#1E293B';
var BORDER    = '#CBD5E1';
var BREAK_BG  = '#F1F5F9';

var TAB_SHEETS  = 'ברייקדאון';
var TAB_SCHED   = 'לוז';
var TAB_CLIENT  = 'בקשות ללקוח';
var TAB_PROPS   = 'פרופס ומשימות';
var TAB_NOTES   = 'הנחות ושאלות';
var TAB_STATUS  = '_status';

var PX = 7.2; // המרה מרוחב-תווים של אקסל לפיקסלים

/** יוצר את הגוגל-שיט, שומר את ה-ID ומחזיר את הקישור */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SS_ID');
  var ss;
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(DATA.title);
    props.setProperty('SS_ID', ss.getId());
  }
  render_(ss);
  var url = ss.getUrl();
  Logger.log(url);
  return url;
}

/** מרנדר מחדש את כל הגליונות מתוך DATA (הסטטוסים נשמרים) */
function rebuild() { return setup(); }

/** מחזיר את הגוגל-שיט. אם עוד לא נוצר – יוצר אותו בפעם הראשונה. */
function ss_() {
  var id = PropertiesService.getScriptProperties().getProperty('SS_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) {}
  }
  setup();
  return SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('SS_ID'));
}

function render_(ss) {
  var shots = tab_(ss, TAB_SHEETS, DATA.shotHeaders, DATA.shots, DATA.shotWidths);
  paintShots_(shots);
  shots.getRange(1, 1, DATA.shots.length + 1, DATA.shotHeaders.length).createFilter();
  shots.setFrozenColumns(5);

  var sched = tab_(ss, TAB_SCHED, DATA.schedHeaders, DATA.sched, DATA.schedWidths);
  paintSched_(sched);
  appendLegend_(sched);

  tab_(ss, TAB_CLIENT, DATA.clientHeaders, DATA.client, DATA.clientWidths);
  tab_(ss, TAB_PROPS,  DATA.propsHeaders,  DATA.props,  DATA.propsWidths);
  paintNotes_(tab_(ss, TAB_NOTES, DATA.notesHeaders, DATA.notes, DATA.notesWidths));

  ensureStatusTab_(ss);
  reorder_(ss, [TAB_SCHED, TAB_SHEETS, TAB_CLIENT, TAB_PROPS, TAB_NOTES]);

  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('גיליון1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  ss.setActiveSheet(ss.getSheetByName(TAB_SCHED));
}

function tab_(ss, name, headers, rows, widths) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clear();
  sh.clearConditionalFormatRules();
  var filter = sh.getFilter();
  if (filter) filter.remove();
  sh.setRightToLeft(true);

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

  sh.getRange(1, 1, 1, nc)
    .setBackground(HEADER_BG).setFontColor('#FFFFFF').setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);

  for (var c = 0; c < nc; c++) {
    sh.setColumnWidth(c + 1, Math.round((widths[c] || 14) * PX));
  }
  sh.setFrozenRows(1);
  if (sh.getMaxColumns() > nc) sh.deleteColumns(nc + 1, sh.getMaxColumns() - nc);
  if (sh.getMaxRows() > all.length) sh.deleteRows(all.length + 1, sh.getMaxRows() - all.length);
  return sh;
}

/** צביעת גליון הברייקדאון: עמודות יום/שעה/מלון לפי יום, עמודת תלות קאסט לפי סוג */
function paintShots_(sh) {
  var rows = DATA.shots, n = rows.length;
  if (!n) return;
  var dayBg = [], depBg = [];
  for (var i = 0; i < n; i++) {
    var d = DATA.dayColors['' + rows[i][1]] || 'FFFFFF';
    dayBg.push(['#' + d, '#' + d, '#' + d, '#' + d]);
    depBg.push(['#' + (DATA.depColors['' + rows[i][4]] || 'FFFFFF')]);
  }
  sh.getRange(2, 1, n, 4).setBackgrounds(dayBg);
  var dep = sh.getRange(2, 5, n, 1);
  dep.setBackgrounds(depBg).setFontWeight('bold')
     .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.getRange(2, 2, n, 1).setFontWeight('bold');
}

/** צביעת הלו״ז + הבלטת שורות ארוחה/סוף יום */
function paintSched_(sh) {
  var rows = DATA.sched, n = rows.length;
  if (!n) return;
  for (var i = 0; i < n; i++) {
    var r = sh.getRange(i + 2, 1, 1, DATA.schedHeaders.length);
    var isBreak = !rows[i][2] && !rows[i][3];
    if (isBreak) {
      r.setBackground(BREAK_BG);
      sh.getRange(i + 2, 5).setFontStyle('italic').setFontWeight('bold').setFontColor('#475569');
    } else {
      var d = '#' + (DATA.dayColors['' + rows[i][0]] || 'FFFFFF');
      sh.getRange(i + 2, 1, 1, 2).setBackground(d);
      var dc = DATA.depColors['' + rows[i][3]];
      if (dc) sh.getRange(i + 2, 4).setBackground('#' + dc);
      sh.getRange(i + 2, 4).setHorizontalAlignment('center').setVerticalAlignment('middle');
    }
    sh.getRange(i + 2, 1).setFontWeight('bold');
  }
}

function appendLegend_(sh) {
  var start = sh.getLastRow() + 2;
  sh.getRange(start, 1).setValue('מקרא – תלות קאסט').setFontWeight('bold').setFontSize(12);
  for (var i = 0; i < DATA.legend.length; i++) {
    var row = start + 1 + i;
    sh.getRange(row, 2).setValue(DATA.legend[i][0])
      .setBackground('#' + (DATA.depColors['' + DATA.legend[i][0]] || 'FFFFFF'))
      .setFontWeight('bold').setHorizontalAlignment('center');
    sh.getRange(row, 3).setValue(DATA.legend[i][1]);
  }
}

/** גליון הנחות ושאלות: ירוק לסגור, צהוב לשאלה פתוחה */
function paintNotes_(sh) {
  var rows = DATA.notes;
  for (var i = 0; i < rows.length; i++) {
    sh.getRange(i + 2, 2)
      .setBackground(rows[i][1] === 'סגור' ? '#DCFCE7' : '#FEF3C7')
      .setFontWeight('bold').setHorizontalAlignment('center');
  }
}

function ensureStatusTab_(ss) {
  var sh = ss.getSheetByName(TAB_STATUS);
  if (!sh) {
    sh = ss.insertSheet(TAB_STATUS);
    sh.getRange(1, 1, 1, 6)
      .setValues([['id', 'status', 'completionPct', 'reason', 'notes', 'tsOverride']])
      .setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  sh.hideSheet();
  return sh;
}

function reorder_(ss, names) {
  for (var i = 0; i < names.length; i++) {
    var sh = ss.getSheetByName(names[i]);
    if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); }
  }
}

// Setup.gs — run initializeDatabase() ONCE from the Apps Script editor. Safe to re-run.
// Creates a PRIVATE spreadsheet (owned by you, shared with nobody), all 8 sheets, headers,
// and plain-text formatting (blocks formula injection). Stores SPREADSHEET_ID in Script Properties.
function initializeDatabase() {
  const props = PropertiesService.getScriptProperties();
  var ss;
  const id = props.getProperty('SPREADSHEET_ID');
  if (id) ss = SpreadsheetApp.openById(id);
  else { ss = SpreadsheetApp.create('WomenHealthTracker-DB'); props.setProperty('SPREADSHEET_ID', ss.getId()); }
  Object.keys(CONFIG.HEADERS).forEach(function (name) {
    const h = CONFIG.HEADERS[name];
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
    sh.getRange(1, 1, sh.getMaxRows(), h.length).setNumberFormat('@'); // plain text
    sh.setFrozenRows(1);
  });
  const blank = ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);
  console.log('Database ready. Do NOT share this spreadsheet.');
}

// OPTIONAL: run once to send e-mail reminders daily (~08:00 in the script's time zone).
// Set Script Property APP_URL to your site address first. Mail quotas apply (check Google's current limits).
function installReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sendReminderEmails') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sendReminderEmails').timeBased().everyDays(1).atHour(8).create();
}

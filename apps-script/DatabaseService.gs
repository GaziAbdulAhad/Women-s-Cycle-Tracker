// DatabaseService.gs — the ONLY file that touches SpreadsheetApp.
// Free-text columns are formatted as plain text by initializeDatabase(), so Sheets never evaluates
// user input as a formula. Reads are scoped by userId, so ownership is enforced by construction.
// Limit: each read scans one sheet (fine for thousands of rows; plan a real DB beyond ~50k rows).
function sheet_(name) {
  const s = SpreadsheetApp.openById(getProp_('SPREADSHEET_ID')).getSheetByName(name);
  if (!s) throw new ApiError('SERVER_MISCONFIGURED', 'Server is not configured');
  return s;
}
function toObj_(headers, row) {
  const o = {};
  headers.forEach(function (h, i) {
    var v = row[i];
    if (v instanceof Date) v = Utilities.formatDate(v, 'UTC', 'yyyy-MM-dd');
    o[h] = v;
  });
  return o;
}
// Returns [{row: <sheet row number>, rec: {...}}] for ONE user.
function readUserRecords_(name, userId) {
  const sh = sheet_(name), h = CONFIG.HEADERS[name], last = sh.getLastRow();
  if (last < 2) return [];
  const idx = h.indexOf('userId'), out = [];
  sh.getRange(2, 1, last - 1, h.length).getValues().forEach(function (r, i) {
    if (r[idx] === userId) out.push({ row: i + 2, rec: toObj_(h, r) });
  });
  return out;
}
function findOwned_(name, userId, idField, id) {
  const hit = readUserRecords_(name, userId).filter(function (x) { return x.rec[idField] === id; })[0];
  if (!hit) throw new ApiError('NOT_FOUND', 'Record not found'); // same answer whether it exists for someone else or not
  return hit;
}
function appendRecord_(name, obj) {
  sheet_(name).appendRow(CONFIG.HEADERS[name].map(function (k) { return obj[k] === undefined ? '' : obj[k]; }));
}
function writeRecord_(name, row, obj) {
  const h = CONFIG.HEADERS[name];
  sheet_(name).getRange(row, 1, 1, h.length).setValues([h.map(function (k) { return obj[k] === undefined ? '' : obj[k]; })]);
}
function deleteRow_(name, row) { sheet_(name).deleteRow(row); }

// Serialises read-modify-write sections.
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// ---- helpers for non-user-scoped sheets (admin / settings) and bulk operations ----
function readAll_(name) {
  const sh = sheet_(name), h = CONFIG.HEADERS[name], last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, h.length).getValues().map(function (r, i) { return { row: i + 2, rec: toObj_(h, r) }; });
}
// Deletes many rows efficiently (contiguous runs in one call, bottom-up so row numbers stay valid).
function deleteRows_(name, rowNumbers) {
  const sh = sheet_(name), rows = rowNumbers.slice().sort(function (a, b) { return b - a; });
  var i = 0;
  while (i < rows.length) {
    var j = i;
    while (j + 1 < rows.length && rows[j + 1] === rows[j] - 1) j++;
    sh.deleteRows(rows[j], j - i + 1);
    i = j + 1;
  }
}
function getSetting_(key, fallback) {
  const cache = CacheService.getScriptCache(), hit = cache.get('set:' + key);
  if (hit !== null && hit !== undefined) return hit;
  const f = readAll_('AppSettings').filter(function (x) { return x.rec.settingKey === key; })[0];
  const v = f ? String(f.rec.settingValue) : fallback;
  cache.put('set:' + key, v, 60);
  return v;
}
function upsertSetting_(key, value) {
  const f = readAll_('AppSettings').filter(function (x) { return x.rec.settingKey === key; })[0];
  const rec = { settingKey: key, settingValue: value, updatedAt: nowIso_() };
  if (f) writeRecord_('AppSettings', f.row, rec); else appendRecord_('AppSettings', rec);
  CacheService.getScriptCache().remove('set:' + key);
}

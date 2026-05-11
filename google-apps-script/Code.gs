/**
 * Stockholms Moské Festival 2026 — Backend (Google Apps Script)
 *
 * Hela backendlogiken: doGet/doPost-router, autentisering, sheet-helpers,
 * publika data-readers, admin-handlers, audit log och setup-funktioner.
 *
 * Datakontrakt: se SPEC.md §5.
 * API: se SPEC.md §6.
 * Säkerhet: se SPEC.md §7.
 * Validering: se SPEC.md §8.
 */

// =============================================================================
// SECTION 1 — KONSTANTER & SHEET-HELPERS
// =============================================================================

/** Namn på alla flikar i Google Sheets. */
const SHEET_NAMES = {
  SETTINGS: 'Settings',
  FORM_QUESTIONS: 'FormQuestions',
  SUBMISSIONS: 'Submissions',
  EXHIBITORS: 'Exhibitors',
  SOCIAL_LINKS: 'SocialLinks',
  SPORTS_PAGES: 'SportsPages',
  ADMIN_LOGS: 'AdminLogs'
};

/** Nycklar i Script Properties (lösenord-hash, salt, spreadsheet-id). */
const PROP_KEYS = {
  ADMIN_PASSWORD_HASH: 'ADMIN_PASSWORD_HASH',
  ADMIN_PASSWORD_SALT: 'ADMIN_PASSWORD_SALT',
  SPREADSHEET_ID: 'SPREADSHEET_ID'
};

/** Header-rad per flik. Ordningen styr kolumnerna. */
const SHEET_HEADERS = {
  Settings: ['Key', 'Value', 'Type', 'Label', 'Description'],
  FormQuestions: ['Order', 'Field ID', 'Label', 'Helper Text', 'Placeholder', 'Type', 'Required', 'Active', 'Options'],
  Submissions: ['ID', 'Timestamp', 'Status', 'Name', 'Company', 'Email', 'Phone', 'Data JSON', 'Internal Notes'],
  Exhibitors: ['ID', 'Order', 'Name', 'Company', 'Description', 'Category', 'Instagram', 'Website', 'Published'],
  SocialLinks: ['Order', 'Platform', 'Label', 'URL', 'Active'],
  SportsPages: ['Slug', 'Title', 'Description', 'Active', 'Registration Open'],
  AdminLogs: ['Timestamp', 'Action', 'Details', 'Session ID']
};

/** Sessions-token TTL: 6 timmar. */
const TOKEN_TTL_SECONDS = 6 * 60 * 60;

/** Login rate-limit: max 5 försök per 15 min. */
const LOGIN_RATE_LIMIT_MAX = 5;
const LOGIN_RATE_LIMIT_WINDOW = 15 * 60;

/** Submit rate-limit: 60s cooldown per fingerprint. */
const SUBMIT_RATE_LIMIT_WINDOW = 60;

/** Email- och telefon-regex som matchar klient-side. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^(\+46|0)[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d{2,5}$/;

/** Maxlängd för audit-log details. */
const AUDIT_DETAILS_MAX_LENGTH = 500;

/**
 * Hämtar Spreadsheet-objektet. Använder `SPREADSHEET_ID` från Script Properties
 * om satt, annars `SpreadsheetApp.getActiveSpreadsheet()` (om scriptet är bundet).
 *
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty(PROP_KEYS.SPREADSHEET_ID);
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('Inget kalkylark hittades. Sätt SPREADSHEET_ID i Script Properties eller bind scriptet till ett ark.');
  }
  return active;
}

/**
 * Hämtar en flik vid namn. Throw:ar om fliken saknas.
 *
 * @param {string} name
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet_(name) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(name);
  if (!sheet) {
    throw new Error('Fliken saknas: ' + name + '. Kör setupSpreadsheet() först.');
  }
  return sheet;
}

/**
 * Konverterar en header (t.ex. "Field ID") till camelCase ("fieldId").
 *
 * @param {string} header
 * @return {string}
 */
function headerToKey_(header) {
  if (!header) return '';
  const cleaned = String(header).trim();
  const parts = cleaned.split(/[\s_\-]+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0].toLowerCase();
  const rest = parts.slice(1).map(function (p) {
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  });
  return first + rest.join('');
}

/**
 * Normaliserar ett cell-värde. Boolean-strängar konverteras, datum lämnas som ISO.
 *
 * @param {*} value
 * @return {*}
 */
function normalizeCell_(value) {
  if (value === '' || value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return '';
    const upper = trimmed.toUpperCase();
    if (upper === 'TRUE') return true;
    if (upper === 'FALSE') return false;
    return value;
  }
  return value;
}

/**
 * Läser hela fliken som array av objekt med camelCase-nycklar från headers.
 *
 * @param {string} name
 * @return {Array<Object>}
 */
function readSheetAsObjects_(name) {
  const sheet = getSheet_(name);
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(function (h) { return headerToKey_(h); });
  const rows = values.slice(1);
  const result = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Hoppa helt tomma rader.
    let allEmpty = true;
    for (let j = 0; j < row.length; j++) {
      if (row[j] !== '' && row[j] !== null && row[j] !== undefined) {
        allEmpty = false;
        break;
      }
    }
    if (allEmpty) continue;
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      if (!key) continue;
      obj[key] = normalizeCell_(row[j]);
    }
    result.push(obj);
  }
  return result;
}

/**
 * Konverterar ett value tillbaka till ett sheet-cell-värde.
 * Booleans → "TRUE"/"FALSE" så att de visas konsekvent och kan toggles i ark.
 *
 * @param {*} value
 * @return {*}
 */
function toCellValue_(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch (e) { return String(value); }
  }
  return value;
}

/**
 * Skriver över hela fliken (utom header-raden) med nya rader baserat på objekten.
 *
 * @param {string} name
 * @param {Array<Object>} objects
 * @param {Array<string>} headerOrder Header-strängar i kolumnordning.
 */
function writeSheetFromObjects_(name, objects, headerOrder) {
  const sheet = getSheet_(name);
  const lastRow = sheet.getLastRow();
  const lastCol = headerOrder.length;
  // Rensa allt utom header-raden.
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, Math.max(sheet.getLastColumn(), lastCol)).clearContent();
  }
  // Säkerställ headers.
  sheet.getRange(1, 1, 1, lastCol).setValues([headerOrder]);
  if (!objects || objects.length === 0) return;
  const keyOrder = headerOrder.map(function (h) { return headerToKey_(h); });
  const rows = objects.map(function (obj) {
    return keyOrder.map(function (key) { return toCellValue_(obj[key]); });
  });
  sheet.getRange(2, 1, rows.length, lastCol).setValues(rows);
}

/**
 * Uppdaterar en specifik rad i en flik genom att hitta första kolumn-värdet.
 * Returnerar true om en rad uppdaterades.
 *
 * @param {string} sheetName
 * @param {string} matchHeader Header för kolumnen som ska matchas.
 * @param {string} matchValue Värdet att matcha.
 * @param {Object} updates Map: header → nytt värde.
 * @return {boolean}
 */
function updateRowByMatch_(sheetName, matchHeader, matchValue, updates) {
  const sheet = getSheet_(sheetName);
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length < 2) return false;
  const headers = values[0];
  const matchCol = headers.indexOf(matchHeader);
  if (matchCol === -1) return false;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][matchCol]) === String(matchValue)) {
      Object.keys(updates).forEach(function (header) {
        const colIdx = headers.indexOf(header);
        if (colIdx !== -1) {
          sheet.getRange(i + 1, colIdx + 1).setValue(toCellValue_(updates[header]));
        }
      });
      return true;
    }
  }
  return false;
}

/**
 * Tar bort en rad där matchHeader-kolumnen matchar matchValue.
 *
 * @param {string} sheetName
 * @param {string} matchHeader
 * @param {string} matchValue
 * @return {boolean}
 */
function deleteRowByMatch_(sheetName, matchHeader, matchValue) {
  const sheet = getSheet_(sheetName);
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length < 2) return false;
  const headers = values[0];
  const matchCol = headers.indexOf(matchHeader);
  if (matchCol === -1) return false;
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][matchCol]) === String(matchValue)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/**
 * Skapar svar i JSON-format (ContentService).
 *
 * @param {Object} obj
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Skapar svar i JSONP-format (för cross-origin GET från statisk sida).
 *
 * @param {string} callback
 * @param {Object} obj
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function jsonpResponse_(callback, obj) {
  const safeCallback = String(callback).replace(/[^a-zA-Z0-9_$.]/g, '');
  return ContentService.createTextOutput(safeCallback + '(' + JSON.stringify(obj) + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// =============================================================================
// SECTION 2 — doGet (PUBLIK DATA + ADMIN HtmlService)
// =============================================================================

/**
 * Webbappens GET-router.
 *
 *   ?view=admin                → renderar Admin.html via HtmlService
 *   ?action=publicData         → returnerar publik data som JSON eller JSONP
 *   ?action=publicData&callback=jsonp_xxx → JSONP-wrap
 *   default                    → enkel statussida (ingen känslig info)
 *
 * @param {GoogleAppsScript.Events.DoGet} e
 * @return {GoogleAppsScript.HTML.HtmlOutput|GoogleAppsScript.Content.TextOutput}
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};

    // --- Adminpanel via HtmlService ---
    if (params.view === 'admin') {
      return HtmlService.createTemplateFromFile('Admin')
        .evaluate()
        .setTitle('Admin – Stockholms Moské Festival')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }

    // --- Publik data (JSON eller JSONP) ---
    if (params.action === 'publicData') {
      const payload = buildPublicDataPayload_();
      if (params.callback) {
        return jsonpResponse_(params.callback, payload);
      }
      return jsonResponse_(payload);
    }

    // --- Default: enkel statussträng ---
    return ContentService
      .createTextOutput('Stockholms Moské Festival – Apps Script är igång.')
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    console.error('doGet error: ' + err + '\n' + (err && err.stack));
    const errPayload = { ok: false, error: 'internal_error' };
    if (e && e.parameter && e.parameter.callback) {
      return jsonpResponse_(e.parameter.callback, errPayload);
    }
    return jsonResponse_(errPayload);
  }
}

/**
 * Bygger publika data-payloaden (settings + frågor + utställare + sociala +
 * sportspages). Filtrerar bort inaktiva/opublicerade rader.
 *
 * @return {Object}
 */
function buildPublicDataPayload_() {
  const settings = readSettings_();
  const allQuestions = readQuestions_();
  const questions = allQuestions.filter(function (q) { return q.active === true; });
  const exhibitors = readApprovedExhibitors_();
  const socialLinks = readActiveSocialLinks_();
  const sportsPages = readSportsPages_();
  return {
    ok: true,
    data: {
      settings: settings,
      questions: questions,
      exhibitors: exhibitors,
      socialLinks: socialLinks,
      sportsPages: sportsPages
    }
  };
}

// =============================================================================
// SECTION 3 — doPost (FORMULÄR-INLÄMNING)
// =============================================================================

/**
 * Webbappens POST-router. Stödjer JSON, text/plain (frontend default) och
 * form-encoded body. Routar på `body.action`.
 *
 * @param {GoogleAppsScript.Events.DoPost} e
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function doPost(e) {
  try {
    const body = parseRequestBody_(e);
    const action = (body && body.action) || '';
    const adminAction = (body && body.adminAction) || '';

    if (action === 'submit') {
      return jsonResponse_(handleSubmit_(body));
    }

    if (adminAction) {
      return jsonResponse_(adminDispatch_(adminAction, body));
    }

    return jsonResponse_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    console.error('doPost error: ' + err + '\n' + (err && err.stack));
    return jsonResponse_({ ok: false, error: 'internal_error' });
  }
}

/**
 * Dispatcher för adminoperationer som anropas från static admin-SPA på
 * One.com via fetch POST. Whitelistar exakt vilka funktioner som får anropas
 * och mappar inkommande args-array till deras signaturer.
 *
 * @param {string} action  Namn på admin-funktion.
 * @param {Object} body    Hela request-body. body.args är arrayen med argument.
 * @return {Object}
 */
function adminDispatch_(action, body) {
  const args = (body && body.args) || [];
  switch (action) {
    case 'loginAdmin':
      return loginAdmin(args[0]);
    case 'logoutAdmin':
      return logoutAdmin(args[0]);
    case 'validateSession':
      return validateSession(args[0]);
    case 'getAdminData':
      return getAdminData(args[0]);
    case 'getOverview':
      return getOverview(args[0]);
    case 'saveSettings':
      return saveSettings(args[0], args[1]);
    case 'saveFormQuestions':
      return saveFormQuestions(args[0], args[1]);
    case 'saveExhibitors':
      return saveExhibitors(args[0], args[1]);
    case 'saveSocialLinks':
      return saveSocialLinks(args[0], args[1]);
    case 'saveSportsPages':
      return saveSportsPages(args[0], args[1]);
    case 'getSubmissions':
      return getSubmissions(args[0], args[1]);
    case 'updateSubmissionStatus':
      return updateSubmissionStatus(args[0], args[1], args[2], args[3]);
    case 'createExhibitorFromSubmission':
      return createExhibitorFromSubmission(args[0], args[1], args[2]);
    case 'deleteExhibitor':
      return deleteExhibitor(args[0], args[1]);
    case 'exportSubmissionsCsv':
      return exportSubmissionsCsv(args[0]);
    default:
      return { ok: false, error: 'unknown_admin_action' };
  }
}

/**
 * Parsar inkommande request-body. Returnerar tomt objekt vid fel.
 *
 * @param {GoogleAppsScript.Events.DoPost} e
 * @return {Object}
 */
function parseRequestBody_(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    const contents = e.postData.contents;
    const type = (e.postData.type || '').toLowerCase();
    // Frontend skickar text/plain;charset=utf-8 för att undvika CORS-preflight.
    if (type.indexOf('application/json') === 0 ||
        type.indexOf('text/plain') === 0) {
      try {
        return JSON.parse(contents);
      } catch (err) {
        // Fall igenom — kan vara form-encoded.
      }
    }
    if (type.indexOf('application/x-www-form-urlencoded') === 0) {
      return e.parameter || {};
    }
    // Sista försök: prova JSON-parse oavsett type.
    try {
      return JSON.parse(contents);
    } catch (err) {
      return e.parameter || {};
    }
  }
  return e.parameter || {};
}

/**
 * Hanterar formulär-inlämning från publika sidan.
 * Validerar honeypot, required-fält, e-post och telefon.
 *
 * @param {Object} body
 * @return {Object}
 */
function handleSubmit_(body) {
  const formType = body && body.formType;
  if (!formType || (formType !== 'bazaar' && formType !== 'fotboll' && formType !== 'basket')) {
    return { ok: false, error: 'invalid_form_type' };
  }
  const data = (body && body.data) || {};

  // --- Honeypot ---
  const honeypot = data.kontakttid;
  if (honeypot && String(honeypot).trim() !== '') {
    logAdminAction_('spam_blocked', {
      formType: formType,
      reason: 'honeypot_filled',
      honeypotValue: String(honeypot).substring(0, 50)
    }, null);
    // Silent success — botten ska inte få veta att den blockerats.
    return { ok: true };
  }

  // --- Validera mot aktiva FormQuestions ---
  const questions = readQuestions_().filter(function (q) { return q.active === true; });
  const errors = validateSubmission_(data, questions);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: 'validation_failed', details: errors };
  }

  // --- Skapa rad i Submissions ---
  const id = Utilities.getUuid();
  const timestamp = new Date().toISOString();
  const sheet = getSheet_(SHEET_NAMES.SUBMISSIONS);
  const dataJson = JSON.stringify(data);
  sheet.appendRow([
    id,
    timestamp,
    'new',
    data.name || '',
    data.company || '',
    data.email || '',
    data.phone || '',
    dataJson,
    ''
  ]);

  return { ok: true, data: { id: id } };
}

/**
 * Validerar formulärdata mot aktiva frågor. Returnerar map field → felmeddelande.
 *
 * @param {Object} data
 * @param {Array<Object>} questions
 * @return {Object}
 */
function validateSubmission_(data, questions) {
  const errors = {};
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const fieldId = q.fieldId;
    if (!fieldId) continue;
    const value = data[fieldId];
    const required = q.required === true;
    const type = (q.type || 'text').toLowerCase();

    if (required) {
      if (type === 'checkbox') {
        if (value !== true && value !== 'true' && value !== 'TRUE' && value !== 1) {
          errors[fieldId] = 'Detta fält måste bekräftas.';
          continue;
        }
      } else {
        if (value === undefined || value === null || String(value).trim() === '') {
          errors[fieldId] = 'Detta fält är obligatoriskt.';
          continue;
        }
      }
    }
    if (value === undefined || value === null || value === '') continue;

    if (type === 'email') {
      if (!EMAIL_REGEX.test(String(value).trim())) {
        errors[fieldId] = 'Ange en giltig e-postadress.';
      }
    } else if (type === 'tel') {
      const cleaned = String(value).trim();
      if (!PHONE_REGEX.test(cleaned)) {
        errors[fieldId] = 'Ange ett giltigt svenskt telefonnummer (+46 eller 0-prefix).';
      }
    } else if (type === 'textarea') {
      // Specialregel för "offering" — minst 30 tecken.
      if (fieldId === 'offering' && String(value).trim().length < 30) {
        errors[fieldId] = 'Beskriv minst 30 tecken så vi kan göra en bra bedömning.';
      }
    }
  }
  return errors;
}

// =============================================================================
// SECTION 4 — AUTH (login, logout, validateSession, hashPassword)
// =============================================================================

/**
 * SHA-256(salt + password), returnerar lowercase hex-sträng.
 *
 * @param {string} password
 * @param {string} salt
 * @return {string}
 */
function hashPassword_(password, salt) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + password,
    Utilities.Charset.UTF_8
  );
  return bytes.map(function (b) {
    return (b < 0 ? b + 256 : b).toString(16).padStart(2, '0');
  }).join('');
}

/**
 * Constant-time string comparison. Skyddar mot timing-attacker.
 *
 * @param {string} a
 * @param {string} b
 * @return {boolean}
 */
function constantTimeEqual_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Genererar en 64-tecken hex-token via två sammansatta UUID:er.
 *
 * @return {string}
 */
function generateToken_() {
  const a = Utilities.getUuid().replace(/-/g, '');
  const b = Utilities.getUuid().replace(/-/g, '');
  return a + b;
}

/**
 * Cache-nyckel för en sessions-token.
 *
 * @param {string} token
 * @return {string}
 */
function sessionCacheKey_(token) {
  return 'session_' + token;
}

/**
 * Försöker logga in en admin med lösenord. Rate-limit (5/15 min) tillämpas.
 *
 * @param {string} password
 * @return {Object} { ok, token?, expiresAt?, error?, message? }
 */
function loginAdmin(password) {
  try {
    const cache = CacheService.getScriptCache();
    const rateKey = 'login_attempts';
    const attempts = parseInt(cache.get(rateKey) || '0', 10);
    if (attempts >= LOGIN_RATE_LIMIT_MAX) {
      logAdminAction_('login_rate_limited', { attempts: attempts }, null);
      return {
        ok: false,
        error: 'rate_limited',
        message: 'För många försök. Vänta 15 minuter och försök igen.'
      };
    }

    const props = PropertiesService.getScriptProperties();
    const storedHash = props.getProperty(PROP_KEYS.ADMIN_PASSWORD_HASH);
    const storedSalt = props.getProperty(PROP_KEYS.ADMIN_PASSWORD_SALT);
    if (!storedHash || !storedSalt) {
      return {
        ok: false,
        error: 'not_configured',
        message: 'Adminlösenord är inte satt. Kör setupAdminPassword() i Apps Script-editorn först.'
      };
    }

    if (!password || typeof password !== 'string') {
      cache.put(rateKey, String(attempts + 1), LOGIN_RATE_LIMIT_WINDOW);
      logAdminAction_('login_failed', { reason: 'empty_password' }, null);
      return { ok: false, error: 'invalid_password', message: 'Fel lösenord.' };
    }

    const computed = hashPassword_(password, storedSalt);
    if (!constantTimeEqual_(computed, storedHash)) {
      cache.put(rateKey, String(attempts + 1), LOGIN_RATE_LIMIT_WINDOW);
      logAdminAction_('login_failed', { reason: 'wrong_password' }, null);
      return { ok: false, error: 'invalid_password', message: 'Fel lösenord.' };
    }

    // Korrekt — rensa rate-limit, skapa session.
    cache.remove(rateKey);
    const token = generateToken_();
    cache.put(sessionCacheKey_(token), '1', TOKEN_TTL_SECONDS);
    const expiresAt = Date.now() + TOKEN_TTL_SECONDS * 1000;
    logAdminAction_('login', { tokenPrefix: token.substring(0, 8) }, token);
    return { ok: true, token: token, expiresAt: expiresAt };
  } catch (err) {
    console.error('loginAdmin error: ' + err + '\n' + (err && err.stack));
    return { ok: false, error: 'internal_error' };
  }
}

/**
 * Loggar ut adminen genom att radera token från CacheService.
 *
 * @param {string} token
 * @return {Object}
 */
function logoutAdmin(token) {
  try {
    if (token) {
      const cache = CacheService.getScriptCache();
      cache.remove(sessionCacheKey_(token));
      logAdminAction_('logout', {}, token);
    }
    return { ok: true };
  } catch (err) {
    console.error('logoutAdmin error: ' + err);
    return { ok: false, error: 'internal_error' };
  }
}

/**
 * Validerar att en token fortfarande gäller. Förlänger inte TTL här (det gör
 * `requireAuth_` vid varje skydd-anrop).
 *
 * @param {string} token
 * @return {Object} { ok: true, valid: boolean }
 */
function validateSession(token) {
  try {
    if (!token) return { ok: true, valid: false };
    const cache = CacheService.getScriptCache();
    const v = cache.get(sessionCacheKey_(token));
    return { ok: true, valid: !!v };
  } catch (err) {
    console.error('validateSession error: ' + err);
    return { ok: false, valid: false, error: 'internal_error' };
  }
}

/**
 * Helper för admin-handlers. Throw:ar `Error('unauthorized')` om token saknas
 * eller är ogiltig. Förlänger sliding session (TTL återställs).
 *
 * @param {string} token
 */
function requireAuth_(token) {
  if (!token) {
    throw new Error('unauthorized');
  }
  const cache = CacheService.getScriptCache();
  const key = sessionCacheKey_(token);
  const v = cache.get(key);
  if (!v) {
    throw new Error('unauthorized');
  }
  // Sliding session: förläng TTL.
  cache.put(key, '1', TOKEN_TTL_SECONDS);
}

/**
 * Wrappar en handler i try/catch och konverterar `unauthorized` till
 * standardiserad svarstyp.
 *
 * @param {Function} fn
 * @return {*}
 */
function safeAdminCall_(fn) {
  try {
    return fn();
  } catch (err) {
    if (err && String(err.message || err).indexOf('unauthorized') !== -1) {
      return { ok: false, error: 'unauthorized', message: 'Sessionen har gått ut. Logga in igen.' };
    }
    console.error('admin handler error: ' + err + '\n' + (err && err.stack));
    return { ok: false, error: 'internal_error', message: String(err && err.message || err) };
  }
}

// =============================================================================
// SECTION 5 — PUBLIC DATA READERS
// =============================================================================

/**
 * Läser Settings-fliken som key/value-objekt. Konverterar Type-kolumnen:
 * boolean → true/false, number → Number, text/textarea → String.
 *
 * @return {Object}
 */
function readSettings_() {
  const rows = readSheetAsObjects_(SHEET_NAMES.SETTINGS);
  const out = {};
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const key = r.key;
    if (!key) continue;
    const type = String(r.type || 'text').toLowerCase();
    let val = r.value;
    if (type === 'boolean') {
      if (typeof val === 'string') {
        val = val.trim().toUpperCase() === 'TRUE';
      } else {
        val = !!val;
      }
    } else if (type === 'number') {
      const n = Number(val);
      val = isNaN(n) ? 0 : n;
    } else {
      val = (val === undefined || val === null) ? '' : String(val);
    }
    out[key] = val;
  }
  return out;
}

/**
 * Läser FormQuestions-fliken. Returnerar array sorterad efter `order`.
 * Konverterar Options (kommaseparerad) till array.
 *
 * @return {Array<Object>}
 */
function readQuestions_() {
  const rows = readSheetAsObjects_(SHEET_NAMES.FORM_QUESTIONS);
  const cleaned = rows.map(function (r) {
    return {
      order: Number(r.order) || 0,
      fieldId: String(r.fieldId || '').trim(),
      label: String(r.label || ''),
      helperText: String(r.helperText || ''),
      placeholder: String(r.placeholder || ''),
      type: String(r.type || 'text').toLowerCase(),
      required: r.required === true,
      active: r.active === true,
      options: r.options ? String(r.options).split(',').map(function (s) { return s.trim(); }).filter(Boolean) : []
    };
  });
  cleaned.sort(function (a, b) { return a.order - b.order; });
  return cleaned;
}

/**
 * Läser Exhibitors-fliken — endast publicerade. Sorterat efter order.
 *
 * @return {Array<Object>}
 */
function readApprovedExhibitors_() {
  const rows = readSheetAsObjects_(SHEET_NAMES.EXHIBITORS);
  const filtered = rows.filter(function (r) { return r.published === true; });
  filtered.sort(function (a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0); });
  return filtered.map(function (r) {
    return {
      id: r.id || '',
      order: Number(r.order) || 0,
      name: r.name || '',
      company: r.company || '',
      description: r.description || '',
      category: r.category || '',
      instagram: r.instagram || '',
      website: r.website || '',
      published: true
    };
  });
}

/**
 * Läser SocialLinks-fliken — endast aktiva. Sorterat efter order.
 *
 * @return {Array<Object>}
 */
function readActiveSocialLinks_() {
  const rows = readSheetAsObjects_(SHEET_NAMES.SOCIAL_LINKS);
  const filtered = rows.filter(function (r) { return r.active === true; });
  filtered.sort(function (a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0); });
  return filtered.map(function (r) {
    return {
      order: Number(r.order) || 0,
      platform: r.platform || '',
      label: r.label || '',
      url: r.url || '',
      active: true
    };
  });
}

/**
 * Läser SportsPages-fliken (alla rader, även inaktiva).
 *
 * @return {Array<Object>}
 */
function readSportsPages_() {
  const rows = readSheetAsObjects_(SHEET_NAMES.SPORTS_PAGES);
  return rows.map(function (r) {
    return {
      slug: r.slug || '',
      title: r.title || '',
      description: r.description || '',
      active: r.active === true,
      registrationOpen: r.registrationOpen === true
    };
  });
}

// =============================================================================
// SECTION 6 — ADMIN HANDLERS
// =============================================================================

/**
 * Returnerar all admin-relevant data (inklusive icke-publicerat och inaktivt).
 *
 * @param {string} token
 * @return {Object}
 */
function getAdminData(token) {
  return safeAdminCall_(function () {
    requireAuth_(token);
    return {
      ok: true,
      data: {
        settings: readSettings_(),
        questions: readQuestions_(),
        submissions: readAllSubmissions_(),
        exhibitors: readAllExhibitors_(),
        socialLinks: readAllSocialLinks_(),
        sportsPages: readSportsPages_()
      }
    };
  });
}

/**
 * Snabb översikt för admin-startsidan.
 *
 * @param {string} token
 * @return {Object}
 */
function getOverview(token) {
  return safeAdminCall_(function () {
    requireAuth_(token);
    const submissions = readAllSubmissions_();
    const exhibitors = readAllExhibitors_();
    const settings = readSettings_();
    let lastSubmissionAt = null;
    let newCount = 0;
    for (let i = 0; i < submissions.length; i++) {
      const s = submissions[i];
      if (s.status === 'new') newCount++;
      if (!lastSubmissionAt || (s.timestamp && s.timestamp > lastSubmissionAt)) {
        lastSubmissionAt = s.timestamp;
      }
    }
    let publishedExhibitorsCount = 0;
    for (let j = 0; j < exhibitors.length; j++) {
      if (exhibitors[j].published === true) publishedExhibitorsCount++;
    }
    return {
      ok: true,
      data: {
        newSubmissionsCount: newCount,
        totalSubmissions: submissions.length,
        publishedExhibitorsCount: publishedExhibitorsCount,
        registrationOpen: settings.registrationOpen === true,
        lastSubmissionAt: lastSubmissionAt
      }
    };
  });
}

/**
 * Sparar Settings — uppdaterar Value-kolumnen för varje matchande Key.
 *
 * @param {string} token
 * @param {Object} settingsObj
 * @return {Object}
 */
function saveSettings(token, settingsObj) {
  return safeAdminCall_(function () {
    requireAuth_(token);
    if (!settingsObj || typeof settingsObj !== 'object') {
      return { ok: false, error: 'invalid_input' };
    }
    const sheet = getSheet_(SHEET_NAMES.SETTINGS);
    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0];
    const keyCol = headers.indexOf('Key');
    const valueCol = headers.indexOf('Value');
    const typeCol = headers.indexOf('Type');
    if (keyCol === -1 || valueCol === -1) {
      throw new Error('Settings-flikens headers saknas (Key/Value).');
    }
    const updatedKeys = [];
    for (let i = 1; i < values.length; i++) {
      const rowKey = values[i][keyCol];
      if (!rowKey) continue;
      if (Object.prototype.hasOwnProperty.call(settingsObj, rowKey)) {
        const newVal = settingsObj[rowKey];
        const type = typeCol === -1 ? 'text' : String(values[i][typeCol] || 'text').toLowerCase();
        let cellVal;
        if (type === 'boolean') {
          cellVal = newVal ? 'TRUE' : 'FALSE';
        } else if (type === 'number') {
          const n = Number(newVal);
          cellVal = isNaN(n) ? 0 : n;
        } else {
          cellVal = newVal === undefined || newVal === null ? '' : String(newVal);
        }
        sheet.getRange(i + 1, valueCol + 1).setValue(cellVal);
        updatedKeys.push(rowKey);
      }
    }
    logAdminAction_('update_settings', { keys: updatedKeys }, token);
    return { ok: true, data: { updatedKeys: updatedKeys } };
  });
}

/**
 * Skriver över hela FormQuestions-fliken.
 *
 * @param {string} token
 * @param {Array<Object>} questionsArr
 * @return {Object}
 */
function saveFormQuestions(token, questionsArr) {
  return safeAdminCall_(function () {
    requireAuth_(token);
    if (!Array.isArray(questionsArr)) {
      return { ok: false, error: 'invalid_input' };
    }
    // Validera unika fieldIds.
    const seen = {};
    for (let i = 0; i < questionsArr.length; i++) {
      const q = questionsArr[i] || {};
      const fid = String(q.fieldId || '').trim();
      if (!fid) {
        return { ok: false, error: 'validation_failed', details: { index: i, field: 'fieldId', message: 'Field ID krävs.' } };
      }
      if (seen[fid]) {
        return { ok: false, error: 'validation_failed', details: { index: i, field: 'fieldId', message: 'Field ID måste vara unikt: ' + fid } };
      }
      seen[fid] = true;
    }
    // Normalisera till sheet-rader.
    const normalized = questionsArr.map(function (q, idx) {
      return {
        order: Number(q.order) || (idx + 1),
        fieldId: String(q.fieldId || '').trim(),
        label: String(q.label || ''),
        helperText: String(q.helperText || ''),
        placeholder: String(q.placeholder || ''),
        type: String(q.type || 'text').toLowerCase(),
        required: q.required === true,
        active: q.active === true,
        options: Array.isArray(q.options) ? q.options.join(', ') : String(q.options || '')
      };
    });
    writeSheetFromObjects_(SHEET_NAMES.FORM_QUESTIONS, normalized, SHEET_HEADERS.FormQuestions);
    logAdminAction_('save_form_questions', { count: normalized.length }, token);
    return { ok: true };
  });
}

/**
 * Skriver över hela Exhibitors-fliken.
 *
 * @param {string} token
 * @param {Array<Object>} exhibitorsArr
 * @return {Object}
 */
function saveExhibitors(token, exhibitorsArr) {
  return safeAdminCall_(function () {
    requireAuth_(token);
    if (!Array.isArray(exhibitorsArr)) {
      return { ok: false, error: 'invalid_input' };
    }
    const normalized = exhibitorsArr.map(function (e, idx) {
      return {
        id: e.id || Utilities.getUuid(),
        order: Number(e.order) || (idx + 1),
        name: String(e.name || ''),
        company: String(e.company || ''),
        description: String(e.description || ''),
        category: String(e.category || ''),
        instagram: String(e.instagram || ''),
        website: String(e.website || ''),
        published: e.published === true
      };
    });
    writeSheetFromObjects_(SHEET_NAMES.EXHIBITORS, normalized, SHEET_HEADERS.Exhibitors);
    logAdminAction_('save_exhibitors', { count: normalized.length }, token);
    return { ok: true };
  });
}

/**
 * Skriver över hela SocialLinks-fliken.
 *
 * @param {string} token
 * @param {Array<Object>} socialLinksArr
 * @return {Object}
 */
function saveSocialLinks(token, socialLinksArr) {
  return safeAdminCall_(function () {
    requireAuth_(token);
    if (!Array.isArray(socialLinksArr)) {
      return { ok: false, error: 'invalid_input' };
    }
    const normalized = socialLinksArr.map(function (s, idx) {
      return {
        order: Number(s.order) || (idx + 1),
        platform: String(s.platform || ''),
        label: String(s.label || ''),
        url: String(s.url || ''),
        active: s.active === true
      };
    });
    writeSheetFromObjects_(SHEET_NAMES.SOCIAL_LINKS, normalized, SHEET_HEADERS.SocialLinks);
    logAdminAction_('save_social_links', { count: normalized.length }, token);
    return { ok: true };
  });
}

/**
 * Skriver över hela SportsPages-fliken.
 *
 * @param {string} token
 * @param {Array<Object>} sportsPagesArr
 * @return {Object}
 */
function saveSportsPages(token, sportsPagesArr) {
  return safeAdminCall_(function () {
    requireAuth_(token);
    if (!Array.isArray(sportsPagesArr)) {
      return { ok: false, error: 'invalid_input' };
    }
    const normalized = sportsPagesArr.map(function (s) {
      return {
        slug: String(s.slug || ''),
        title: String(s.title || ''),
        description: String(s.description || ''),
        active: s.active === true,
        registrationOpen: s.registrationOpen === true
      };
    });
    writeSheetFromObjects_(SHEET_NAMES.SPORTS_PAGES, normalized, SHEET_HEADERS.SportsPages);
    logAdminAction_('save_sports_pages', { count: normalized.length }, token);
    return { ok: true };
  });
}

/**
 * Hämtar alla submissions med valfri filtrering.
 *
 * @param {string} token
 * @param {Object} [filter] { status?: string, search?: string }
 * @return {Object}
 */
function getSubmissions(token, filter) {
  return safeAdminCall_(function () {
    requireAuth_(token);
    let submissions = readAllSubmissions_();
    if (filter && filter.status) {
      submissions = submissions.filter(function (s) { return s.status === filter.status; });
    }
    if (filter && filter.search) {
      const q = String(filter.search).toLowerCase();
      submissions = submissions.filter(function (s) {
        return (s.name && String(s.name).toLowerCase().indexOf(q) !== -1) ||
               (s.email && String(s.email).toLowerCase().indexOf(q) !== -1) ||
               (s.company && String(s.company).toLowerCase().indexOf(q) !== -1) ||
               (s.phone && String(s.phone).toLowerCase().indexOf(q) !== -1);
      });
    }
    // Nyaste först.
    submissions.sort(function (a, b) {
      return String(b.timestamp || '').localeCompare(String(a.timestamp || ''));
    });
    return { ok: true, data: submissions };
  });
}

/**
 * Uppdaterar status och interna anteckningar för en submission.
 *
 * @param {string} token
 * @param {string} submissionId
 * @param {string} status
 * @param {string} notes
 * @return {Object}
 */
function updateSubmissionStatus(token, submissionId, status, notes) {
  return safeAdminCall_(function () {
    requireAuth_(token);
    const allowedStatuses = ['new', 'reviewed', 'approved', 'rejected', 'contacted'];
    if (allowedStatuses.indexOf(status) === -1) {
      return { ok: false, error: 'invalid_status' };
    }
    const updates = { 'Status': status };
    if (notes !== undefined && notes !== null) {
      updates['Internal Notes'] = String(notes);
    }
    const ok = updateRowByMatch_(SHEET_NAMES.SUBMISSIONS, 'ID', submissionId, updates);
    if (!ok) {
      return { ok: false, error: 'not_found' };
    }
    logAdminAction_('update_submission_status', {
      submissionId: submissionId,
      status: status,
      hasNotes: !!notes
    }, token);
    return { ok: true };
  });
}

/**
 * Skapar en utställare baserat på en submission. Skapas alltid med
 * `published=false` så att admin manuellt måste publicera.
 *
 * @param {string} token
 * @param {string} submissionId
 * @param {Object} additionalData Override/tillägg (category, description, etc).
 * @return {Object}
 */
function createExhibitorFromSubmission(token, submissionId, additionalData) {
  return safeAdminCall_(function () {
    requireAuth_(token);
    const submissions = readAllSubmissions_();
    let sub = null;
    for (let i = 0; i < submissions.length; i++) {
      if (submissions[i].id === submissionId) { sub = submissions[i]; break; }
    }
    if (!sub) {
      return { ok: false, error: 'not_found' };
    }
    let parsed = {};
    try {
      parsed = sub.dataJson ? JSON.parse(sub.dataJson) : {};
    } catch (err) {
      parsed = {};
    }
    const extra = additionalData || {};
    const exhibitorId = Utilities.getUuid();
    const sheet = getSheet_(SHEET_NAMES.EXHIBITORS);
    // Hitta nästa order.
    const existing = readAllExhibitors_();
    let maxOrder = 0;
    for (let j = 0; j < existing.length; j++) {
      if ((existing[j].order || 0) > maxOrder) maxOrder = existing[j].order;
    }
    const row = [
      exhibitorId,
      typeof extra.order === 'number' ? extra.order : maxOrder + 1,
      String(extra.name || sub.name || parsed.name || ''),
      String(extra.company || sub.company || parsed.company || ''),
      String(extra.description || parsed.offering || ''),
      String(extra.category || ''),
      String(extra.instagram || parsed.websiteSocials || ''),
      String(extra.website || ''),
      'FALSE'
    ];
    sheet.appendRow(row);
    logAdminAction_('create_exhibitor_from_submission', {
      submissionId: submissionId,
      exhibitorId: exhibitorId
    }, token);
    return { ok: true, data: { exhibitorId: exhibitorId } };
  });
}

/**
 * Tar bort en utställare. Bekräftar att raden hittades.
 *
 * @param {string} token
 * @param {string} exhibitorId
 * @return {Object}
 */
function deleteExhibitor(token, exhibitorId) {
  return safeAdminCall_(function () {
    requireAuth_(token);
    const ok = deleteRowByMatch_(SHEET_NAMES.EXHIBITORS, 'ID', exhibitorId);
    if (!ok) {
      return { ok: false, error: 'not_found' };
    }
    logAdminAction_('delete_exhibitor', { exhibitorId: exhibitorId }, token);
    return { ok: true };
  });
}

/**
 * Exporterar alla submissions som CSV-sträng.
 *
 * @param {string} token
 * @return {Object}
 */
function exportSubmissionsCsv(token) {
  return safeAdminCall_(function () {
    requireAuth_(token);
    const submissions = readAllSubmissions_();
    const headers = ['ID', 'Timestamp', 'Status', 'Name', 'Company', 'Email', 'Phone', 'Data JSON', 'Internal Notes'];
    const lines = [headers.map(csvEscape_).join(',')];
    for (let i = 0; i < submissions.length; i++) {
      const s = submissions[i];
      lines.push([
        s.id || '',
        s.timestamp || '',
        s.status || '',
        s.name || '',
        s.company || '',
        s.email || '',
        s.phone || '',
        s.dataJson || '',
        s.internalNotes || ''
      ].map(csvEscape_).join(','));
    }
    const csv = lines.join('\r\n');
    logAdminAction_('export_submissions_csv', { count: submissions.length }, token);
    return { ok: true, data: csv };
  });
}

/**
 * CSV-eskapering enligt RFC 4180.
 *
 * @param {*} v
 * @return {string}
 */
function csvEscape_(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * Läser alla submissions (utan filtrering).
 *
 * @return {Array<Object>}
 */
function readAllSubmissions_() {
  const rows = readSheetAsObjects_(SHEET_NAMES.SUBMISSIONS);
  return rows.map(function (r) {
    return {
      id: r.id || '',
      timestamp: r.timestamp || '',
      status: r.status || 'new',
      name: r.name || '',
      company: r.company || '',
      email: r.email || '',
      phone: r.phone || '',
      dataJson: r.dataJson || '',
      internalNotes: r.internalNotes || ''
    };
  });
}

/**
 * Läser alla utställare (även opublicerade) sorterat efter order.
 *
 * @return {Array<Object>}
 */
function readAllExhibitors_() {
  const rows = readSheetAsObjects_(SHEET_NAMES.EXHIBITORS);
  rows.sort(function (a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0); });
  return rows.map(function (r) {
    return {
      id: r.id || '',
      order: Number(r.order) || 0,
      name: r.name || '',
      company: r.company || '',
      description: r.description || '',
      category: r.category || '',
      instagram: r.instagram || '',
      website: r.website || '',
      published: r.published === true
    };
  });
}

/**
 * Läser alla sociala länkar (även inaktiva) sorterat efter order.
 *
 * @return {Array<Object>}
 */
function readAllSocialLinks_() {
  const rows = readSheetAsObjects_(SHEET_NAMES.SOCIAL_LINKS);
  rows.sort(function (a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0); });
  return rows.map(function (r) {
    return {
      order: Number(r.order) || 0,
      platform: r.platform || '',
      label: r.label || '',
      url: r.url || '',
      active: r.active === true
    };
  });
}

// =============================================================================
// SECTION 7 — AUDIT LOG
// =============================================================================

/**
 * Loggar en admin-action i AdminLogs-fliken. Tystas om fliken saknas så att
 * misslyckad logging inte sänker hela operationen.
 *
 * @param {string} action
 * @param {Object} details
 * @param {string|null} token
 */
function logAdminAction_(action, details, token) {
  try {
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName(SHEET_NAMES.ADMIN_LOGS);
    if (!sheet) return;
    const sessionId = token ? token.substring(0, 8) + '…' : 'public';
    let detailsStr;
    try {
      detailsStr = JSON.stringify(details || {});
    } catch (err) {
      detailsStr = String(details);
    }
    if (detailsStr.length > AUDIT_DETAILS_MAX_LENGTH) {
      detailsStr = detailsStr.substring(0, AUDIT_DETAILS_MAX_LENGTH) + '…';
    }
    sheet.appendRow([
      new Date().toISOString(),
      action,
      detailsStr,
      sessionId
    ]);
  } catch (err) {
    console.error('logAdminAction_ error: ' + err);
  }
}

/**
 * Publik wrapper för logAdminAction_ — kan kallas från klienten via
 * google.script.run om det behövs (kräver giltig token).
 *
 * @param {string} action
 * @param {Object} details
 * @param {string} token
 * @return {Object}
 */
function logAdminAction(action, details, token) {
  return safeAdminCall_(function () {
    requireAuth_(token);
    logAdminAction_(String(action || 'unknown'), details || {}, token);
    return { ok: true };
  });
}

// =============================================================================
// SECTION 8 — SETUP-FUNKTIONER
// =============================================================================

/**
 * Skapar alla flikar med rätt headers och default-data.
 * Idempotent: skapar bara saknade flikar och fyller bara tomma flikar.
 *
 * Manuell körning krävs en gång efter att scriptet bundits till ett ark.
 *
 * @return {Object}
 */
function setupSpreadsheet() {
  try {
    const ss = getSpreadsheet_();
    const created = [];
    const updated = [];

    // 1. Settings
    ensureSheet_(ss, SHEET_NAMES.SETTINGS, SHEET_HEADERS.Settings, created, updated, function (sheet) {
      if (sheet.getLastRow() < 2) {
        sheet.getRange(2, 1, DEFAULT_SETTINGS.length, SHEET_HEADERS.Settings.length)
          .setValues(DEFAULT_SETTINGS);
      }
    });

    // 2. FormQuestions
    ensureSheet_(ss, SHEET_NAMES.FORM_QUESTIONS, SHEET_HEADERS.FormQuestions, created, updated, function (sheet) {
      if (sheet.getLastRow() < 2) {
        sheet.getRange(2, 1, DEFAULT_FORM_QUESTIONS.length, SHEET_HEADERS.FormQuestions.length)
          .setValues(DEFAULT_FORM_QUESTIONS);
      }
      addBooleanValidation_(sheet, ['Required', 'Active']);
      addDropdownValidation_(sheet, 'Type', ['text', 'email', 'tel', 'textarea', 'checkbox', 'select']);
    });

    // 3. Submissions (tom + headers)
    ensureSheet_(ss, SHEET_NAMES.SUBMISSIONS, SHEET_HEADERS.Submissions, created, updated, function (sheet) {
      addDropdownValidation_(sheet, 'Status', ['new', 'reviewed', 'approved', 'rejected', 'contacted']);
    });

    // 4. Exhibitors
    ensureSheet_(ss, SHEET_NAMES.EXHIBITORS, SHEET_HEADERS.Exhibitors, created, updated, function (sheet) {
      addBooleanValidation_(sheet, ['Published']);
    });

    // 5. SocialLinks
    ensureSheet_(ss, SHEET_NAMES.SOCIAL_LINKS, SHEET_HEADERS.SocialLinks, created, updated, function (sheet) {
      if (sheet.getLastRow() < 2) {
        sheet.getRange(2, 1, DEFAULT_SOCIAL_LINKS.length, SHEET_HEADERS.SocialLinks.length)
          .setValues(DEFAULT_SOCIAL_LINKS);
      }
      addBooleanValidation_(sheet, ['Active']);
    });

    // 6. SportsPages
    ensureSheet_(ss, SHEET_NAMES.SPORTS_PAGES, SHEET_HEADERS.SportsPages, created, updated, function (sheet) {
      if (sheet.getLastRow() < 2) {
        sheet.getRange(2, 1, DEFAULT_SPORTS_PAGES.length, SHEET_HEADERS.SportsPages.length)
          .setValues(DEFAULT_SPORTS_PAGES);
      }
      addBooleanValidation_(sheet, ['Active', 'Registration Open']);
    });

    // 7. AdminLogs
    ensureSheet_(ss, SHEET_NAMES.ADMIN_LOGS, SHEET_HEADERS.AdminLogs, created, updated);

    logAdminAction_('setup_spreadsheet', { created: created, updated: updated }, null);
    return { ok: true, created: created, updated: updated };
  } catch (err) {
    console.error('setupSpreadsheet error: ' + err + '\n' + (err && err.stack));
    return { ok: false, error: 'internal_error', message: String(err && err.message || err) };
  }
}

/**
 * Säkerställer att en flik finns med rätt headers (frysta).
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @param {string} name
 * @param {Array<string>} headers
 * @param {Array<string>} createdList
 * @param {Array<string>} updatedList
 * @param {Function} [postSetup]
 */
function ensureSheet_(ss, name, headers, createdList, updatedList, postSetup) {
  let sheet = ss.getSheetByName(name);
  let isNew = false;
  if (!sheet) {
    sheet = ss.insertSheet(name);
    isNew = true;
  }
  // Sätt/uppdatera headers.
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
  // Standard kolumnbredd (skona ögonen).
  for (let i = 1; i <= headers.length; i++) {
    try { sheet.setColumnWidth(i, 180); } catch (e) { /* ignore */ }
  }
  if (postSetup) postSetup(sheet);
  if (isNew) createdList.push(name);
  else updatedList.push(name);
}

/**
 * Lägger till TRUE/FALSE-datavalidering på en hel kolumn (rad 2 → 1000).
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {Array<string>} headerNames
 */
function addBooleanValidation_(sheet, headerNames) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['TRUE', 'FALSE'], true)
    .setAllowInvalid(false)
    .build();
  for (let i = 0; i < headerNames.length; i++) {
    const idx = headers.indexOf(headerNames[i]);
    if (idx === -1) continue;
    sheet.getRange(2, idx + 1, 1000, 1).setDataValidation(rule);
  }
}

/**
 * Lägger till dropdown-datavalidering på en hel kolumn.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} headerName
 * @param {Array<string>} options
 */
function addDropdownValidation_(sheet, headerName, options) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn() || 1).getValues()[0];
  const idx = headers.indexOf(headerName);
  if (idx === -1) return;
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, idx + 1, 1000, 1).setDataValidation(rule);
}

/**
 * Sätter (eller ändrar) adminlösenord. Genererar nytt 32-byte salt.
 *
 * Manuell körning. Lösenordet aldrig loggas.
 *
 * @param {string} password
 * @return {Object}
 */
function setupAdminPassword(password) {
  try {
    if (!password || typeof password !== 'string' || password.length < 8) {
      return { ok: false, error: 'weak_password', message: 'Lösenordet måste vara minst 8 tecken.' };
    }
    // Generera 32-byte salt som hex-sträng.
    const saltBytes = [];
    for (let i = 0; i < 32; i++) {
      saltBytes.push(Math.floor(Math.random() * 256));
    }
    const salt = saltBytes.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    const hash = hashPassword_(password, salt);
    const props = PropertiesService.getScriptProperties();
    props.setProperty(PROP_KEYS.ADMIN_PASSWORD_HASH, hash);
    props.setProperty(PROP_KEYS.ADMIN_PASSWORD_SALT, salt);
    logAdminAction_('setup_admin_password', { changed: true }, null);
    return { ok: true, message: 'Lösenord satt. Du kan nu logga in i adminpanelen.' };
  } catch (err) {
    console.error('setupAdminPassword error: ' + err);
    return { ok: false, error: 'internal_error' };
  }
}

// =============================================================================
// SECTION 9 — DEFAULT-DATA
// =============================================================================

const DEFAULT_INTRO_TEXT = 'Bazaar, öppet hus och familjeaktiviteter på Stockholms Moské och Björns Trädgård vid Medborgarplatsen. Fri entré.';

const DEFAULT_WHO_CAN_APPLY_TEXT = 'Bazaren är öppen för företagare, kreatörer, föreningar och personer som vill sälja eller presentera produkter och tjänster som passar familjer och besökare. Anmälan är gratis – vi vill bara veta vad du planerar att erbjuda och vilket stånd du behöver.';

const DEFAULT_SELECTION_TEXT = 'Urvalet kommer att göras baserat på hur relevant ditt erbjudande är för besökarna samt hur genomförbart det är. Ju mer information du lämnar om vad du planerar att sälja eller presentera, desto enklare blir bedömningen. Vi hör av oss efter att urvalsprocessen är klar.';

const DEFAULT_IMPORTANT_INFO_TEXT = '• Att delta är gratis.\n• Anmälan är bindande – vid sen avanmälan kan en avgift debiteras.\n• Varje deltagare ansvarar för sin egen plats.\n• Varje deltagare ansvarar för städning efter avslutat evenemang.\n• Bazaren är öppen mellan kl. 13:00–17:00; festivalen pågår 12:00–19:00.';

/**
 * Settings-rader: [Key, Value, Type, Label, Description].
 */
const DEFAULT_SETTINGS = [
  ['eventTitle', 'Festival', 'text', 'Eventets titel', 'Stor hero-rubrik på publika sidan.'],
  ['eventSubtitle', '— en dag för gemenskap', 'text', 'Underrubrik (kursiv)', 'Visas i kursiv mässing-färg under titeln.'],
  ['eventDate', 'Lördag 13 juni', 'text', 'Datum', 'Visas i datum/tid-bandet.'],
  ['eventTime', '12:00–19:00', 'text', 'Eventets tid', 'Festivalens totala tid.'],
  ['bazaarTime', '13:00–17:00', 'text', 'Bazaarens tid', 'Specifik tid för bazaaren.'],
  ['eventLocation', 'Stockholms Moské & Björns trädgård, Medborgarplatsen', 'text', 'Plats', 'Visas i hero och info-kort.'],
  ['expectedChildren', 130, 'number', 'Förväntade barn', 'Används i info-kort.'],
  ['expectedAdults', 200, 'number', 'Förväntade vuxna', 'Används i info-kort.'],
  ['registrationOpen', 'TRUE', 'boolean', 'Anmälan öppen', 'TRUE = formuläret visas. FALSE = utställarlistan visas.'],
  ['showExhibitors', 'TRUE', 'boolean', 'Visa utställarlista', 'TRUE = visa publicerade utställare.'],
  ['heroButtonText', 'Anmäl dig till bazaaren', 'text', 'Text på hero-knapp', 'Primär CTA i hero.'],
  ['introText', DEFAULT_INTRO_TEXT, 'textarea', 'Introduktionstext', 'Inledande text under hero.'],
  ['whoCanApplyText', DEFAULT_WHO_CAN_APPLY_TEXT, 'textarea', 'Vem kan anmäla sig?', 'Sektion om målgrupp.'],
  ['selectionText', DEFAULT_SELECTION_TEXT, 'textarea', 'Så görs urvalet', 'Sektion om urvalsprocessen.'],
  ['importantInfoText', DEFAULT_IMPORTANT_INFO_TEXT, 'textarea', 'Viktigt att känna till', 'Punktlista med villkor.'],
  ['successMessage', 'Tack! Din intresseanmälan har skickats. Vi återkommer när urvalet är klart.', 'text', 'Tack-meddelande', 'Visas efter lyckad inlämning.'],
  ['closedMessage', 'Anmälan är stängd. Utställare publiceras här när programmet är klart.', 'text', 'Stängd-meddelande', 'Visas när registrationOpen=FALSE.'],
  ['purposeText', 'Stockholms Moskéfestival är en årlig familje- och gemenskapsfestival som arrangeras av Stockholms Moské för att samla människor i alla åldrar kring gemenskap, glädje, kultur och aktiviteter.\n\nFestivalen skapar en trygg och välkomnande mötesplats där familjer, ungdomar och besökare kan umgås, lära känna varandra och delta i aktiviteter för både barn och vuxna.\n\nGenom bazaar, sportturneringar, barnaktiviteter, mat, fika och kunskapsutställningar vill festivalen stärka gemenskapen i samhället och skapa positiva minnen för hela familjen – där människor möts i en öppen, familjevänlig och inkluderande miljö.', 'textarea', 'Syfte', 'Långt stycke som beskriver festivalens syfte.'],
  ['linktreeUrl', '', 'text', 'Linktree-URL', 'Om satt visas en länk till Linktree i marknadsförings-sektionen.'],
  ['activityBazaarText', 'Sälj eller presentera produkter och tjänster vid ett stånd. Begränsade platser — urval baseras på relevans.', 'textarea', 'Bazaar — beskrivning', 'Visas på bazaar-kortet.'],
  ['activitySportText', 'Fotbollsturnering för alla åldrar samt basket 3 mot 3. Spelschema publiceras närmare festivalen.', 'textarea', 'Sport — beskrivning', 'Visas på sport-kortet.'],
  ['activityMatText', 'Mat, fika och tilltugg från lokala kockar och bagerier. Meny och priser uppdateras inom kort.', 'textarea', 'Mat — beskrivning', 'Visas på mat-kortet.'],
  ['activityKidsText', 'Lek, pyssel och familjeaktiviteter för de yngsta. Ansvariga ledare på plats hela dagen.', 'textarea', 'Barnaktiviteter — beskrivning', 'Visas på barn-kortet.'],
  ['activityKnowledgeText', 'Utställningar och kortföredrag som introducerar besökare till moskéns verksamhet, historia och tro.', 'textarea', 'Kunskapsutställningar — beskrivning', 'Visas på kunskaps-kortet.']
];

/**
 * FormQuestions-rader: [Order, Field ID, Label, Helper Text, Placeholder, Type, Required, Active, Options].
 */
const DEFAULT_FORM_QUESTIONS = [
  [1, 'name', 'Namn och efternamn', '', 'För- och efternamn', 'text', 'TRUE', 'TRUE', ''],
  [2, 'company', 'Företagsnamn, om tillämpligt', '', 'Lämna tomt om du anmäler dig privat', 'text', 'FALSE', 'TRUE', ''],
  [3, 'email', 'Email', '', 'din@epost.se', 'email', 'TRUE', 'TRUE', ''],
  [4, 'phone', 'Telefon', '', '+46 70 123 45 67', 'tel', 'TRUE', 'TRUE', ''],
  [5, 'websiteSocials', 'Webbsida och sociala medier', '', 'Instagram, TikTok, hemsida eller annan länk', 'text', 'FALSE', 'TRUE', ''],
  [6, 'offering', 'Vad planerar du att sälja eller presentera?', 'Beskriv så detaljerat som möjligt.', '', 'textarea', 'TRUE', 'TRUE', ''],
  [7, 'standNeeds', 'Behov för stånd', 'Behöver du bord? Behöver du el? Hur mycket plats behöver du? Övriga behov?', '', 'textarea', 'TRUE', 'TRUE', ''],
  [8, 'consentAccepted', 'Jag godkänner villkoren och ansvarar för mitt eget stånd.', '', '', 'checkbox', 'TRUE', 'TRUE', '']
];

/**
 * SocialLinks-rader: [Order, Platform, Label, URL, Active].
 */
const DEFAULT_SOCIAL_LINKS = [
  [1, 'Instagram', 'Instagram', 'https://instagram.com/stockholmsmoske', 'TRUE'],
  [2, 'TikTok', 'TikTok', '', 'TRUE'],
  [3, 'Facebook', 'Facebook', 'https://facebook.com/sthlmsmoske', 'TRUE'],
  [4, 'YouTube', 'YouTube', 'https://youtube.com/c/StockholmsMoskéIF', 'TRUE'],
  [5, 'Hemsida', 'Hemsida', 'https://stockholmsmoske.se', 'TRUE']
];

/**
 * SportsPages-rader: [Slug, Title, Description, Active, Registration Open].
 */
const DEFAULT_SPORTS_PAGES = [
  ['festival-fotboll', 'Anmälan till fotboll', 'Mer information kommer snart.', 'FALSE', 'FALSE'],
  ['festival-basket-3vs3', 'Anmälan till basket 3 mot 3', 'Mer information kommer snart.', 'FALSE', 'FALSE']
];

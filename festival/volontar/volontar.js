/*
 * Volontäranmälan — Stockholms Moské Festival 2026
 * Fristående formulär. Hämtar publicData via JSONP från Apps Script och
 * renderar formuläret dynamiskt från `volunteerQuestions`-arrayen. Postar
 * sedan till samma URL med { action: 'submitVolunteer', data: { ... } }.
 *
 * Schema för en volontärfråga (samma som FormQuestions för bazaar, plus två
 * extra typer):
 *   { order, fieldId, label, helperText, placeholder, type, required, active,
 *     options }
 * type ∈ text | email | tel | textarea | checkbox | select | radio | multicheck
 * options: kommaseparerade pairs "value|label, value|label"
 */
(function () {
  'use strict';

  var INSTAGRAM_URL = 'https://instagram.com/stockholmsmoske';
  var CACHE_KEY = 'smf_publicData';
  var CACHE_TTL_MS = 60 * 1000;
  var FETCH_TIMEOUT_MS = 8000;

  var currentData = null;

  function getConfig() { return window.APP_CONFIG || {}; }

  function trim(s) { return (s == null ? '' : String(s)).trim(); }

  function toBool(v) {
    if (v === true || v === false) return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      var s = v.trim().toLowerCase();
      return s === 'true' || s === 'yes' || s === '1' || s === 'ja';
    }
    return Boolean(v);
  }

  function byOrder(a, b) {
    var ao = Number(a && a.order); var bo = Number(b && b.order);
    if (isNaN(ao)) ao = 0; if (isNaN(bo)) bo = 0;
    return ao - bo;
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v == null) return;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'html') node.innerHTML = v;
      else node.setAttribute(k, v === true ? '' : v);
    });
    if (children) children.forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  /**
   * Tolka options-strängen `"value|label, value2|label2"` till array av
   * { value, label }. Saknas `|label` används value som label.
   */
  function parseOptionPairs(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.map(function (item) {
        if (item && typeof item === 'object') {
          return { value: trim(item.value), label: trim(item.label) || trim(item.value) };
        }
        return parseOptionPairs(String(item))[0];
      }).filter(function (o) { return o && o.value; });
    }
    return String(raw).split(',').map(function (part) {
      var s = trim(part);
      if (!s) return null;
      var sep = s.indexOf('|');
      if (sep === -1) return { value: s, label: s };
      var value = trim(s.slice(0, sep));
      var label = trim(s.slice(sep + 1)) || value;
      return { value: value, label: label };
    }).filter(Boolean);
  }

  // ---------------------------------------------------------------------------
  // Cache + fetch
  // ---------------------------------------------------------------------------

  function readCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.ts || !parsed.data) return null;
      if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
      return parsed.data;
    } catch (e) { return null; }
  }

  function writeCache(data) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data })); }
    catch (e) { /* quota — ignorera */ }
  }

  function fetchPublicData(callback) {
    var cfg = getConfig();
    var url = cfg.appsScriptUrl;
    if (!url || url.indexOf('PASTE_') === 0) {
      callback(new Error('No appsScriptUrl configured'));
      return;
    }

    var cbName = 'smfVolCallback_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
    var settled = false;
    var timer = null;
    var script = null;

    function cleanup() {
      if (timer) { clearTimeout(timer); timer = null; }
      try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
      if (script && script.parentNode) script.parentNode.removeChild(script);
      script = null;
    }

    window[cbName] = function (resp) {
      if (settled) return;
      settled = true;
      cleanup();
      if (resp && resp.ok && resp.data) callback(null, resp.data);
      else callback(new Error('Bad JSONP response'));
    };

    timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      cleanup();
      callback(new Error('JSONP timeout'));
    }, FETCH_TIMEOUT_MS);

    var sep = url.indexOf('?') === -1 ? '?' : '&';
    var src = url + sep + 'action=publicData&callback=' + encodeURIComponent(cbName) +
              '&_=' + Date.now();

    script = document.createElement('script');
    script.async = true;
    script.src = src;
    script.onerror = function () {
      if (settled) return;
      settled = true;
      cleanup();
      callback(new Error('JSONP script error'));
    };
    document.head.appendChild(script);
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    var yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    // Stale-while-revalidate: rendera cache direkt, hämta nytt i bakgrunden.
    var cached = readCache();
    if (cached) applyData(cached);
    else renderLoading();

    fetchPublicData(function (err, data) {
      if (err || !data) {
        if (!cached) applyData(fallbackData());
        return;
      }
      writeCache(data);
      applyData(data);
    });
  }

  function fallbackData() {
    var cfg = getConfig();
    return (cfg && cfg.fallbackData) || { volunteerQuestions: [] };
  }

  function applyData(data) {
    currentData = data || {};
    var questions = Array.isArray(currentData.volunteerQuestions) ? currentData.volunteerQuestions : [];
    buildForm(questions);
  }

  function renderLoading() {
    var container = document.getElementById('form-container');
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(el('p', { class: 'form-status', text: 'Laddar formulär…' }));
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  function buildForm(questions) {
    var container = document.getElementById('form-container');
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);

    var active = (questions || [])
      .filter(function (q) { return q && toBool(q.active); })
      .slice()
      .sort(byOrder);

    if (active.length === 0) {
      container.appendChild(el('p', { class: 'form-status', 'data-tone': 'error',
        text: 'Formuläret är inte tillgängligt just nu. Mejla info@stockholmsmoske.se så återkommer vi.' }));
      return;
    }

    var form = el('form', { id: 'volunteer-form', novalidate: 'novalidate' });

    active.forEach(function (q) {
      var f = buildField(q);
      if (f) form.appendChild(f);
    });

    // Honeypot
    var hp = el('div', { class: 'honeypot', 'aria-hidden': 'true' });
    hp.appendChild(el('label', { 'for': 'kontakttid', text: 'Lämna detta fält tomt' }));
    hp.appendChild(el('input', { type: 'text', id: 'kontakttid', name: 'kontakttid', tabindex: '-1', autocomplete: 'off' }));
    form.appendChild(hp);

    form.appendChild(el('div', { id: 'form-status', class: 'form-status', role: 'status', 'aria-live': 'polite' }));

    var actions = el('div', { class: 'form-actions' });
    actions.appendChild(el('span', { class: 'form-card__foot-note', text: 'Vi återkommer inom någon vecka.' }));
    actions.appendChild(el('button', { type: 'submit', class: 'btn btn-primary', text: 'Skicka anmälan' }));
    form.appendChild(actions);

    form.addEventListener('submit', handleSubmit);
    container.appendChild(form);
  }

  function buildField(q) {
    var type = trim(q.type || 'text').toLowerCase();
    var fieldId = trim(q.fieldId || q.id) || ('field_' + Math.random().toString(36).slice(2, 8));
    var required = toBool(q.required);
    var label = trim(q.label);
    var helper = trim(q.helperText);
    var placeholder = trim(q.placeholder);
    var helperId = fieldId + '-helper';
    var errorId = fieldId + '-error';

    var wrap = el('div', { class: 'field field--' + type, 'data-field-id': fieldId, 'data-field-type': type });
    if (required) wrap.setAttribute('data-required', 'true');

    function appendLabel(forId, asGroup) {
      var labelEl = asGroup
        ? el('label', { class: 'field-label', text: label })
        : el('label', { 'for': forId, class: 'field-label', text: label });
      if (required) {
        labelEl.appendChild(el('span', { class: 'field__required', 'aria-hidden': 'true', text: ' *' }));
        labelEl.appendChild(el('span', { class: 'visually-hidden', text: ' (obligatoriskt)' }));
      }
      wrap.appendChild(labelEl);
    }

    function appendHelper() {
      if (helper) wrap.appendChild(el('p', { class: 'field-help', id: helperId, text: helper }));
    }

    function appendError() {
      wrap.appendChild(el('p', { class: 'field__error', id: errorId, role: 'alert' }));
    }

    if (type === 'checkbox') {
      // Singel-checkbox: input + label på en rad.
      var cb = el('input', {
        type: 'checkbox', id: fieldId, name: fieldId,
        required: required ? 'required' : false,
        'aria-describedby': errorId
      });
      var lbl = el('label', { 'for': fieldId, class: 'field-label field-label--checkbox' });
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(' '));
      lbl.appendChild(document.createTextNode(label));
      if (required) {
        lbl.appendChild(el('span', { class: 'field__required', 'aria-hidden': 'true', text: ' *' }));
        lbl.appendChild(el('span', { class: 'visually-hidden', text: ' (obligatoriskt)' }));
      }
      wrap.appendChild(lbl);
      appendHelper();
      appendError();
      return wrap;
    }

    if (type === 'radio') {
      wrap.classList.add('field--radio');
      appendLabel(fieldId, true);
      appendHelper();
      var rGroup = el('div', { class: 'field__radio-group', role: 'radiogroup', 'aria-label': label });
      parseOptionPairs(q.options).forEach(function (opt) {
        var rLbl = el('label');
        rLbl.appendChild(el('input', {
          type: 'radio', name: fieldId, value: opt.value,
          required: required ? 'required' : false
        }));
        rLbl.appendChild(document.createTextNode(opt.label));
        rGroup.appendChild(rLbl);
      });
      wrap.appendChild(rGroup);
      appendError();
      return wrap;
    }

    if (type === 'multicheck') {
      wrap.classList.add('field--multi');
      appendLabel(fieldId, true);
      appendHelper();
      var group = el('div', { class: 'check-group', role: 'group', 'aria-label': label });
      parseOptionPairs(q.options).forEach(function (opt) {
        var mLbl = el('label', { class: 'check-tile' });
        mLbl.appendChild(el('input', { type: 'checkbox', name: fieldId, value: opt.value }));
        var body = el('span', { class: 'check-tile__body' });
        // Stöd "Förmiddag (10:00–15:00)"-style — visa text i parentes som underrad om den finns.
        var match = opt.label.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
        if (match) {
          body.appendChild(el('span', { class: 'check-tile__label', text: match[1].trim() }));
          body.appendChild(el('span', { class: 'check-tile__sub', text: match[2].trim() }));
        } else {
          body.appendChild(el('span', { class: 'check-tile__label', text: opt.label }));
        }
        mLbl.appendChild(body);
        group.appendChild(mLbl);
      });
      wrap.appendChild(group);
      appendError();
      return wrap;
    }

    if (type === 'select') {
      appendLabel(fieldId, false);
      appendHelper();
      var sel = el('select', {
        id: fieldId, name: fieldId,
        required: required ? 'required' : false,
        'aria-describedby': (helper ? helperId + ' ' : '') + errorId
      });
      sel.appendChild(el('option', { value: '', text: placeholder || 'Välj…' }));
      parseOptionPairs(q.options).forEach(function (opt) {
        sel.appendChild(el('option', { value: opt.value, text: opt.label }));
      });
      wrap.appendChild(sel);
      appendError();
      return wrap;
    }

    if (type === 'textarea') {
      appendLabel(fieldId, false);
      appendHelper();
      var taAttrs = {
        id: fieldId, name: fieldId, rows: '4',
        placeholder: placeholder || false,
        required: required ? 'required' : false,
        'aria-describedby': (helper ? helperId + ' ' : '') + errorId
      };
      if (fieldId === 'about' && required) taAttrs.minlength = '10';
      wrap.appendChild(el('textarea', taAttrs));
      appendError();
      return wrap;
    }

    // text / email / tel / fallback
    appendLabel(fieldId, false);
    appendHelper();
    var inputType = (type === 'email' || type === 'tel') ? type : 'text';
    var attrs = {
      type: inputType, id: fieldId, name: fieldId,
      placeholder: placeholder || false,
      required: required ? 'required' : false,
      'aria-describedby': (helper ? helperId + ' ' : '') + errorId
    };
    if (inputType === 'email') { attrs.autocomplete = 'email'; attrs.inputmode = 'email'; }
    if (inputType === 'tel') { attrs.autocomplete = 'tel'; attrs.inputmode = 'tel'; }
    if (fieldId === 'name') attrs.autocomplete = 'name';
    if (fieldId === 'birthDate') {
      attrs.inputmode = 'numeric';
      attrs.pattern = '[0-9]{6}';
      attrs.maxlength = '6';
      if (!attrs.placeholder) attrs.placeholder = 'ÅÅMMDD';
    }
    wrap.appendChild(el('input', attrs));
    appendError();
    return wrap;
  }

  // ---------------------------------------------------------------------------
  // Submit + validering
  // ---------------------------------------------------------------------------

  function handleSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var status = form.querySelector('#form-status');
    if (status) { status.textContent = ''; status.removeAttribute('data-tone'); }

    var questions = (currentData && Array.isArray(currentData.volunteerQuestions))
      ? currentData.volunteerQuestions.filter(function (q) { return q && toBool(q.active); })
      : [];

    var data = {};
    var errors = {};

    questions.forEach(function (q) {
      var fid = trim(q.fieldId);
      if (!fid) return;
      var type = trim(q.type || 'text').toLowerCase();
      var required = toBool(q.required);

      if (type === 'multicheck') {
        var picked = Array.prototype.map.call(
          form.querySelectorAll('input[name="' + fid + '"]:checked'),
          function (i) { return i.value; }
        );
        data[fid] = picked;
        if (required && picked.length === 0) errors[fid] = 'Välj minst ett alternativ.';
        return;
      }

      if (type === 'radio') {
        var checked = form.querySelector('input[name="' + fid + '"]:checked');
        var rv = checked ? checked.value : '';
        data[fid] = rv;
        if (required && !rv) errors[fid] = 'Välj ett alternativ.';
        return;
      }

      if (type === 'checkbox') {
        var cbInput = form.querySelector('#' + cssEscape(fid));
        var cbVal = cbInput ? !!cbInput.checked : false;
        data[fid] = cbVal;
        if (required && !cbVal) errors[fid] = 'Detta fält måste bekräftas.';
        return;
      }

      var control = form.querySelector('#' + cssEscape(fid));
      var v = control ? trim(control.value) : '';
      data[fid] = v;
      if (required && !v) { errors[fid] = 'Detta fält är obligatoriskt.'; return; }
      if (!v) return;
      if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        errors[fid] = 'Ogiltig e-postadress.';
        return;
      }
      if (fid === 'birthDate' && !/^\d{6}$/.test(v)) {
        errors[fid] = 'Skriv födelsedatum som 6 siffror (ÅÅMMDD).';
        return;
      }
      if (fid === 'about' && required && v.length < 10) {
        errors[fid] = 'Skriv åtminstone några ord om dig själv.';
        return;
      }
    });

    data.kontakttid = (form.querySelector('#kontakttid') || {}).value || '';

    // Rensa gamla fel + visa nya
    form.querySelectorAll('.field--invalid').forEach(function (f) { f.classList.remove('field--invalid'); });
    form.querySelectorAll('.field__error').forEach(function (n) { n.textContent = ''; });

    if (Object.keys(errors).length) {
      Object.keys(errors).forEach(function (key) {
        var f = form.querySelector('[data-field-id="' + key + '"]');
        if (!f) return;
        f.classList.add('field--invalid');
        var errEl = f.querySelector('.field__error');
        if (errEl) errEl.textContent = errors[key];
      });
      var firstError = form.querySelector('.field--invalid');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    var submitBtn = form.querySelector('button[type="submit"]');
    var originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.setAttribute('aria-busy', 'true'); submitBtn.textContent = 'Skickar…'; }

    var payload = {
      action: 'submitVolunteer',
      submittedAt: new Date().toISOString(),
      data: data
    };

    sendVolunteer(payload, function (result) {
      if (result && result.ok) {
        showSuccess(form, data.name || '');
        return;
      }
      if (submitBtn) { submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); submitBtn.textContent = originalText || 'Skicka anmälan'; }
      if (status) {
        status.textContent = (result && result.message) || 'Det gick inte att skicka anmälan. Försök igen om en stund eller kontakta info@stockholmsmoske.se.';
        status.setAttribute('data-tone', 'error');
      }
    });
  }

  /** Enkel CSS.escape-polyfill för fältID:n (de är fraga_N / kända namn). */
  function cssEscape(s) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(s);
    return String(s).replace(/([^a-zA-Z0-9_\-])/g, '\\$1');
  }

  function sendVolunteer(payload, callback) {
    var url = trim(getConfig().appsScriptUrl);
    if (!url) { callback({ ok: false, message: 'Servern är inte konfigurerad.' }); return; }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',
      credentials: 'omit'
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (json) {
      callback(json);
    }).catch(function () {
      callback({ ok: false });
    });
  }

  function showSuccess(form, name) {
    var parent = form.parentNode;
    if (!parent) return;
    var success = el('div', { class: 'success-state', role: 'status', 'aria-live': 'polite' });
    success.appendChild(el('h3', { text: 'Tack' + (name ? ', ' + String(name).split(' ')[0] : '') + '!' }));
    success.appendChild(el('p', { text: 'Din intresseanmälan är mottagen. Vi återkommer inom någon vecka med besked om pass och områden.' }));

    var iaPanel = el('div', { class: 'success-ig' });
    iaPanel.appendChild(el('p', { class: 'success-ig__lede', text: 'Vi behöver fler följare — följ Stockholms Moské på Instagram och håll dig uppdaterad om festivalen!' }));
    var iaLink = el('a', {
      class: 'btn btn-primary success-ig__cta',
      href: INSTAGRAM_URL,
      target: '_blank',
      rel: 'noopener noreferrer'
    });
    iaLink.appendChild(document.createTextNode('Följ @stockholmsmoske på Instagram '));
    iaLink.appendChild(el('span', { 'aria-hidden': 'true', text: '↗' }));
    iaPanel.appendChild(iaLink);
    success.appendChild(iaPanel);

    parent.replaceChild(success, form);
    success.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
})();

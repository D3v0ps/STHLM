/*
 * Stockholms Moské Festival 2026 — publik sida
 * Vanilla JS, inga build-steg, inga moduler. Laddas av index.html efter config.js.
 * APP_CONFIG sätts av config.js: { appsScriptUrl, fallbackData, ... }
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Konstanter & hjälpvariabler
  // ---------------------------------------------------------------------------

  var CACHE_KEY = 'smf_publicData';
  var CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
  var FETCH_TIMEOUT_MS = 8000;
  var SUBMIT_COOLDOWN_MS = 60 * 1000;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var PHONE_RE = /^(\+46|0)[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d{2,5}$/;
  var OFFERING_MIN_LENGTH = 30;

  // Globalt namespace om något måste exponeras (t.ex. JSONP-callbacks).
  var SMF = (window.__SMF = window.__SMF || {});

  // Aktuell datasnapshot — sätts efter fetch/cache/fallback.
  var currentData = null;

  // ---------------------------------------------------------------------------
  // Småhjälpare
  // ---------------------------------------------------------------------------

  /** Hämta APP_CONFIG på ett säkert sätt. */
  function getConfig() {
    return window.APP_CONFIG || {};
  }

  /** Tolka boolean från Sheets (kan vara TRUE/FALSE, true/false, "yes" osv). */
  function toBool(v) {
    if (v === true || v === false) return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      var s = v.trim().toLowerCase();
      return s === 'true' || s === 'yes' || s === '1' || s === 'ja';
    }
    return Boolean(v);
  }

  /** Säker textsättning. */
  function setText(el, text) {
    if (!el) return;
    el.textContent = text == null ? '' : String(text);
  }

  /** Skapa element med attribut & barn. */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var val = attrs[key];
        if (val === false || val == null) return;
        if (key === 'class') node.className = val;
        else if (key === 'text') node.textContent = val;
        else if (key === 'html') node.innerHTML = val;
        else if (key.indexOf('data-') === 0 || key.indexOf('aria-') === 0) {
          node.setAttribute(key, val);
        } else if (key in node) {
          try { node[key] = val; } catch (e) { node.setAttribute(key, val); }
        } else {
          node.setAttribute(key, val);
        }
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  /** Trim helper som tolererar undefined. */
  function trim(s) { return (s == null ? '' : String(s)).trim(); }

  /** Sortera array efter `order`-fält (numeriskt, stabilt). */
  function byOrder(a, b) {
    var ao = Number(a && a.order);
    var bo = Number(b && b.order);
    if (isNaN(ao)) ao = 0;
    if (isNaN(bo)) bo = 0;
    return ao - bo;
  }

  // ---------------------------------------------------------------------------
  // Cache (sessionStorage)
  // ---------------------------------------------------------------------------

  /** Läs cachad publicData från sessionStorage om TTL inte gått ut. */
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

  /** Skriv publicData till sessionStorage med timestamp. */
  function writeCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
    } catch (e) { /* quota — ignorera */ }
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  /** Huvudstartfunktionen — körs vid DOMContentLoaded. */
  function init() {
    // Footer-år sätts alltid lokalt.
    var yearEl = document.getElementById('footer-year');
    if (yearEl) setText(yearEl, String(new Date().getFullYear()));

    // Bind popup direkt — fungerar oavsett data.
    bindPopup();

    var cached = readCache();
    if (cached) {
      applyData(cached);
      return;
    }

    fetchPublicData(function (err, data) {
      if (err || !data) {
        applyData((getConfig().fallbackData) || emptyData());
        return;
      }
      writeCache(data);
      applyData(data);
    });
  }

  /** Tom datafall — sista räddningen om allt fattas. */
  function emptyData() {
    return { settings: {}, questions: [], exhibitors: [], socialLinks: [], sportsPages: [] };
  }

  /** Normalisera data-objekt och kör render-funktioner. */
  function applyData(data) {
    currentData = normalizeData(data);
    renderHero(currentData.settings);
    renderForm(currentData.questions, currentData.settings);
    renderExhibitors(currentData.exhibitors, currentData.settings);
    renderSocialPopup(currentData.socialLinks);
  }

  /** Säkerställ att data har förväntad struktur. */
  function normalizeData(data) {
    var d = data || {};
    return {
      settings: d.settings || {},
      questions: Array.isArray(d.questions) ? d.questions.slice() : [],
      exhibitors: Array.isArray(d.exhibitors) ? d.exhibitors.slice() : [],
      socialLinks: Array.isArray(d.socialLinks) ? d.socialLinks.slice() : [],
      sportsPages: Array.isArray(d.sportsPages) ? d.sportsPages.slice() : []
    };
  }

  // ---------------------------------------------------------------------------
  // JSONP-loader
  // ---------------------------------------------------------------------------

  /** Hämta publicData via JSONP. callback(err, data). */
  function fetchPublicData(callback) {
    var cfg = getConfig();
    var url = cfg.appsScriptUrl;
    if (!url || url.indexOf('PASTE_') === 0) {
      callback(new Error('No appsScriptUrl configured'));
      return;
    }

    var cbName = 'smfCallback_' + Date.now() + '_' + Math.floor(Math.random() * 1e6);
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
  // Render: Hero & Settings (data-bind)
  // ---------------------------------------------------------------------------

  /** Uppdaterar alla [data-bind] från Settings; hanterar specialfall för besökare och listor. */
  function renderHero(settings) {
    if (!settings) return;
    var nodes = document.querySelectorAll('[data-bind]');
    Array.prototype.forEach.call(nodes, function (node) {
      var key = node.getAttribute('data-bind');
      if (!(key in settings)) return;
      var value = settings[key];

      if (key === 'importantInfoText') {
        renderImportantInfo(node, value);
        return;
      }

      // Specialfall för besökarsiffran: kombinera barn + vuxna i en wrapper.
      if (key === 'expectedChildren') {
        var adults = settings.expectedAdults;
        // Hitta wrapper-element (info-card__value) och uppdatera ENTIRE innehåll
        // till t.ex. "ca 130 barn och 200 vuxna".
        var wrapper = closestInfoCardValue(node);
        if (wrapper && (adults != null)) {
          // Bevara semantik: skriv om wrapperns innehåll.
          while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);
          wrapper.appendChild(document.createTextNode('ca '));
          wrapper.appendChild(el('span', { 'data-bind': 'expectedChildren', text: String(value) }));
          wrapper.appendChild(document.createTextNode(' barn och '));
          wrapper.appendChild(el('span', { 'data-bind': 'expectedAdults', text: String(adults) }));
          wrapper.appendChild(document.createTextNode(' vuxna'));
          return;
        }
      }
      if (key === 'expectedAdults') {
        // Hanteras tillsammans med expectedChildren ovan om wrappern finns;
        // annars uppdatera punkten direkt.
        setText(node, String(value));
        return;
      }

      setText(node, value);
    });

    // Uppdatera dokumenttiteln om eventTitle skickas.
    if (settings.eventTitle && document.title.indexOf(settings.eventTitle) === -1) {
      // Bara om de skiljer sig — undvik onödiga skrivningar.
      // (Lägger inte över hela titel, lämnar default i HTML.)
    }
  }

  /** Hitta info-card__value som omsluter ett expectedChildren-element. */
  function closestInfoCardValue(node) {
    var n = node;
    while (n && n !== document.body) {
      if (n.classList && n.classList.contains('info-card__value')) return n;
      n = n.parentNode;
    }
    return null;
  }

  /** Konvertera importantInfoText (textarea-rader) till semantisk lista eller paragraf. */
  function renderImportantInfo(node, raw) {
    if (!node) return;
    var text = trim(raw);
    while (node.firstChild) node.removeChild(node.firstChild);

    if (!text) return;
    var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var allBullets = lines.length > 0 && lines.every(function (l) {
      return l.charAt(0) === '•' || l.charAt(0) === '-' || l.charAt(0) === '*';
    });

    if (allBullets) {
      var ul = el('ul', null);
      lines.forEach(function (l) {
        var content = l.replace(/^[•\-\*]\s*/, '');
        ul.appendChild(el('li', { text: content }));
      });
      node.appendChild(ul);
      return;
    }

    var p = el('p', null);
    lines.forEach(function (l, i) {
      if (i > 0) p.appendChild(el('br', null));
      p.appendChild(document.createTextNode(l));
    });
    node.appendChild(p);
  }

  // ---------------------------------------------------------------------------
  // Render: Formulär
  // ---------------------------------------------------------------------------

  /** Bygg formuläret från questions och visa/dölj baserat på registrationOpen. */
  function renderForm(questions, settings) {
    var container = document.getElementById('form-container');
    if (!container) return;

    var open = toBool(settings && settings.registrationOpen);

    // Uppdatera chip i form-card head ("Anmälan öppen" / "Anmälan stängd")
    var chip = document.getElementById('form-status-chip');
    if (chip) {
      chip.className = open ? 'chip ok' : 'chip muted';
      chip.innerHTML = '';
      chip.appendChild(el('span', { class: open ? 'dot ok' : 'dot' }));
      chip.appendChild(document.createTextNode(open ? 'Anmälan öppen' : 'Anmälan stängd'));
    }

    if (!open) {
      container.hidden = true;
      while (container.firstChild) container.removeChild(container.firstChild);
      return;
    }

    container.hidden = false;
    while (container.firstChild) container.removeChild(container.firstChild);

    var form = el('form', { id: 'bazaar-form', novalidate: 'novalidate', noValidate: true });
    form.setAttribute('autocomplete', 'on');

    var active = (questions || []).filter(function (q) {
      return q && toBool(q.active);
    }).slice().sort(byOrder);

    active.forEach(function (q) {
      var fieldEl = buildField(q);
      if (fieldEl) form.appendChild(fieldEl);
    });

    // Honeypot — dolt fält "kontakttid".
    var honeypot = el('div', { class: 'honeypot', 'aria-hidden': 'true' }, [
      el('label', { 'for': 'kontakttid', text: 'Lämna detta fält tomt' }),
      el('input', {
        type: 'text', id: 'kontakttid', name: 'kontakttid',
        tabindex: '-1', autocomplete: 'off'
      })
    ]);
    form.appendChild(honeypot);

    // Inline statusmeddelande (för rate-limit och CORS-fel).
    var status = el('div', { id: 'form-status', class: 'form-status', 'aria-live': 'polite', role: 'status' });
    form.appendChild(status);

    // Submit-rad: notering + knapp.
    var actions = el('div', { class: 'form-actions' }, [
      el('span', { class: 'form-card__foot-note', text: 'Vi återkommer inom 1–2 veckor med besked.' }),
      el('button', { type: 'submit', class: 'btn btn-primary', text: 'Skicka anmälan' })
    ]);
    form.appendChild(actions);

    form.addEventListener('submit', handleSubmit);
    container.appendChild(form);
  }

  /** Bygg ett enskilt fält för en fråga. */
  function buildField(q) {
    var type = (q.type || 'text').toLowerCase();
    var fieldId = q.fieldId || q.id || ('field_' + Math.random().toString(36).slice(2, 8));
    var name = fieldId;
    var required = toBool(q.required);
    var helperId = fieldId + '-helper';
    var errorId = fieldId + '-error';

    var wrap = el('div', { class: 'field field--' + type });

    if (type === 'checkbox') {
      // Checkbox: input först, label efter.
      var inputCb = el('input', {
        type: 'checkbox', id: fieldId, name: name,
        required: required, 'aria-describedby': errorId
      });
      var labelCb = el('label', { 'for': fieldId, class: 'field__label field__label--checkbox' });
      labelCb.appendChild(inputCb);
      labelCb.appendChild(document.createTextNode(' '));
      labelCb.appendChild(document.createTextNode(q.label || ''));
      if (required) {
        labelCb.appendChild(el('span', { class: 'field__required', 'aria-hidden': 'true', text: ' *' }));
        labelCb.appendChild(el('span', { class: 'visually-hidden', text: ' (obligatoriskt)' }));
      }
      wrap.appendChild(labelCb);
    } else {
      // Label före kontroll.
      var labelEl = el('label', { 'for': fieldId, class: 'field__label', text: q.label || '' });
      if (required) {
        labelEl.appendChild(el('span', { class: 'field__required', 'aria-hidden': 'true', text: ' *' }));
        labelEl.appendChild(el('span', { class: 'visually-hidden', text: ' (obligatoriskt)' }));
      }
      wrap.appendChild(labelEl);

      if (q.helperText) {
        wrap.appendChild(el('p', { class: 'field__helper', id: helperId, text: q.helperText }));
      }

      var control;
      if (type === 'textarea') {
        control = el('textarea', {
          id: fieldId, name: name, rows: 4,
          placeholder: q.placeholder || '',
          required: required,
          'aria-describedby': (q.helperText ? helperId + ' ' : '') + errorId
        });
      } else if (type === 'select') {
        control = el('select', {
          id: fieldId, name: name, required: required,
          'aria-describedby': (q.helperText ? helperId + ' ' : '') + errorId
        });
        // Tom default-option.
        control.appendChild(el('option', { value: '', text: q.placeholder || 'Välj…' }));
        var opts = parseOptions(q.options);
        opts.forEach(function (opt) {
          control.appendChild(el('option', { value: opt, text: opt }));
        });
      } else {
        // text / email / tel / fallback
        var inputType = (type === 'email' || type === 'tel') ? type : 'text';
        var attrs = {
          type: inputType, id: fieldId, name: name,
          placeholder: q.placeholder || '',
          required: required,
          'aria-describedby': (q.helperText ? helperId + ' ' : '') + errorId
        };
        if (inputType === 'email') {
          attrs.autocomplete = 'email';
          attrs.inputmode = 'email';
        }
        if (inputType === 'tel') {
          attrs.autocomplete = 'tel';
          attrs.inputmode = 'tel';
        }
        if (fieldId === 'name') attrs.autocomplete = 'name';
        control = el('input', attrs);
      }
      wrap.appendChild(control);
    }

    // Felmeddelande-platshållare.
    wrap.appendChild(el('p', { class: 'field__error', id: errorId, role: 'alert', text: '' }));

    // Markera datatyp för senare access.
    wrap.setAttribute('data-field-id', fieldId);
    wrap.setAttribute('data-field-type', type);
    if (required) wrap.setAttribute('data-required', 'true');

    return wrap;
  }

  /** Tolka kommaseparerade options till array. */
  function parseOptions(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(trim).filter(Boolean);
    return String(raw).split(',').map(trim).filter(Boolean);
  }

  // ---------------------------------------------------------------------------
  // Render: Utställarlista
  // ---------------------------------------------------------------------------

  /** Visa utställarlista när formuläret är stängt. */
  function renderExhibitors(exhibitors, settings) {
    var container = document.getElementById('exhibitors-container');
    if (!container) return;

    var open = toBool(settings && settings.registrationOpen);
    var show = settings && settings.showExhibitors !== undefined
      ? toBool(settings.showExhibitors) : true;

    // När anmälan är öppen, eller admin valt att dölja listan: göm helt.
    if (open || !show) {
      container.hidden = true;
      while (container.firstChild) container.removeChild(container.firstChild);
      return;
    }

    container.hidden = false;
    while (container.firstChild) container.removeChild(container.firstChild);

    var list = (exhibitors || []).slice().sort(byOrder);

    var closedMsg = (settings && settings.closedMessage) ||
                    'Anmälan är stängd. Utställare publiceras här när programmet är klart.';
    var closedWrap = el('div', { class: 'closed-message' });
    closedWrap.appendChild(el('p', { text: closedMsg }));
    container.appendChild(closedWrap);

    if (list.length === 0) {
      // Tom-state hanteras av closed-message ovanför; ingen ytterligare dubblett.
      return;
    }

    container.appendChild(el('h3', { class: 'exhibitors-title', text: 'Årets utställare' }));

    var grid = el('ul', { class: 'exhibitors-grid', role: 'list' });
    list.forEach(function (ex) {
      grid.appendChild(buildExhibitorCard(ex));
    });
    container.appendChild(grid);
  }

  /** Bygg ett utställarkort. */
  function buildExhibitorCard(ex) {
    var card = el('li', { class: 'exhibitor-card' });
    var head = el('div', { class: 'exhibitor-card__head' });
    head.appendChild(el('h3', { class: 'exhibitor-card__title', text: ex.name || '' }));
    if (ex.company) {
      head.appendChild(el('p', { class: 'exhibitor-card__subtitle', text: ex.company }));
    }
    card.appendChild(head);

    if (ex.category) {
      card.appendChild(el('span', { class: 'exhibitor-card__chip', text: ex.category }));
    }

    if (ex.description) {
      card.appendChild(el('p', { class: 'exhibitor-card__description', text: ex.description }));
    }

    var links = [];
    if (ex.instagram) {
      links.push(el('a', {
        href: normalizeInstagramUrl(ex.instagram),
        target: '_blank', rel: 'noopener noreferrer',
        class: 'exhibitor-card__link exhibitor-card__link--ig',
        text: 'Instagram'
      }));
    }
    if (ex.website) {
      links.push(el('a', {
        href: ensureHttp(ex.website),
        target: '_blank', rel: 'noopener noreferrer',
        class: 'exhibitor-card__link exhibitor-card__link--web',
        text: 'Webbsida'
      }));
    }
    if (links.length) {
      var nav = el('p', { class: 'exhibitor-card__links' });
      links.forEach(function (a, i) {
        if (i > 0) nav.appendChild(document.createTextNode(' · '));
        nav.appendChild(a);
      });
      card.appendChild(nav);
    }

    return card;
  }

  /** Normalisera ev. instagram-handle till full URL. */
  function normalizeInstagramUrl(v) {
    var s = trim(v);
    if (!s) return '#';
    if (/^https?:\/\//i.test(s)) return s;
    if (s.charAt(0) === '@') s = s.slice(1);
    return 'https://instagram.com/' + s.replace(/^\/+/, '');
  }

  /** Säkerställ http(s) på en URL. */
  function ensureHttp(v) {
    var s = trim(v);
    if (!s) return '#';
    if (/^https?:\/\//i.test(s)) return s;
    return 'https://' + s.replace(/^\/+/, '');
  }

  // ---------------------------------------------------------------------------
  // Validering
  // ---------------------------------------------------------------------------

  /**
   * Validera ett enskilt fält. Returnerar felsträng eller null.
   * @param {HTMLElement} field — wrapper med data-attribut
   * @param {string|boolean} value — råvärde
   * @param {object} question — frågedefinition
   */
  function validateField(field, value, question) {
    var type = (field.getAttribute('data-field-type') || 'text').toLowerCase();
    var fieldId = field.getAttribute('data-field-id');
    var required = field.getAttribute('data-required') === 'true';

    if (type === 'checkbox') {
      if (required && !value) return 'Du måste godkänna villkoren.';
      return null;
    }

    var v = trim(value);
    if (required && !v) return 'Detta fält är obligatoriskt.';
    if (!v) return null; // Tomt och inte required → OK.

    if (type === 'email' && !EMAIL_RE.test(v)) {
      return 'Ogiltig e-postadress.';
    }

    if (type === 'tel' && !PHONE_RE.test(v)) {
      return 'Ogiltigt telefonnummer (svenskt format krävs).';
    }

    if (fieldId === 'offering' && question && toBool(question.active) && v.length < OFFERING_MIN_LENGTH) {
      return 'Beskriv mer detaljerat (minst ' + OFFERING_MIN_LENGTH + ' tecken).';
    }

    return null;
  }

  /** Sätt felmeddelande på fält och uppdatera aria. */
  function setFieldError(field, message) {
    var errEl = field.querySelector('.field__error');
    if (errEl) errEl.textContent = message || '';
    if (message) field.classList.add('field--invalid');
    else field.classList.remove('field--invalid');

    var control = field.querySelector('input, textarea, select');
    if (control) {
      if (message) control.setAttribute('aria-invalid', 'true');
      else control.removeAttribute('aria-invalid');
    }
  }

  /** Hämta råvärde från ett kontroll-element. */
  function readControlValue(control) {
    if (!control) return '';
    if (control.type === 'checkbox') return !!control.checked;
    return control.value;
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  /** Hantera submit av bazaar-formuläret. */
  function handleSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    if (!form) return;

    var statusEl = form.querySelector('#form-status');
    if (statusEl) { statusEl.textContent = ''; statusEl.classList.remove('form-status--error'); }

    // Honeypot-kontroll: om "kontakttid" är ifyllt, simulera ett tackmeddelande
    // utan att skicka något (silent reject).
    var honeyInput = form.querySelector('input[name="kontakttid"]');
    if (honeyInput && trim(honeyInput.value) !== '') {
      showSuccess(form);
      return;
    }

    // Rate-limit (60s).
    try {
      var lastRaw = localStorage.getItem('smf_lastSubmit');
      if (lastRaw) {
        var last = Number(lastRaw);
        if (!isNaN(last) && (Date.now() - last) < SUBMIT_COOLDOWN_MS) {
          if (statusEl) {
            statusEl.textContent = 'Vänta en minut innan du skickar igen.';
            statusEl.classList.add('form-status--error');
          }
          return;
        }
      }
    } catch (e) { /* ignore storage errors */ }

    // Validera alla fält.
    var fields = form.querySelectorAll('.field');
    var firstInvalid = null;
    var values = {};
    var questions = (currentData && currentData.questions) || [];
    var qById = {};
    questions.forEach(function (q) { if (q && (q.fieldId || q.id)) qById[q.fieldId || q.id] = q; });

    Array.prototype.forEach.call(fields, function (field) {
      var fieldId = field.getAttribute('data-field-id');
      var control = field.querySelector('input, textarea, select');
      var value = readControlValue(control);
      var err = validateField(field, value, qById[fieldId]);
      setFieldError(field, err);
      if (err && !firstInvalid) firstInvalid = field;
      values[fieldId] = value;
    });

    if (firstInvalid) {
      var ctrl = firstInvalid.querySelector('input, textarea, select');
      if (ctrl && ctrl.focus) try { ctrl.focus(); } catch (e) { /* ignore */ }
      return;
    }

    // Bygg payload — inkludera honeypot tomt enligt SPEC §6.
    values.kontakttid = '';
    var payload = {
      action: 'submit',
      formType: 'bazaar',
      submittedAt: new Date().toISOString(),
      data: values
    };

    var submitBtn = form.querySelector('button[type="submit"]');
    var originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
      submitBtn.textContent = 'Skickar…';
    }

    sendSubmission(payload, function (result) {
      if (result && result.ok) {
        try { localStorage.setItem('smf_lastSubmit', String(Date.now())); } catch (e) { /* ignore */ }
        showSuccess(form);
        return;
      }

      // Bekräftat fel — visa inline, behåll fältvärden.
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
        submitBtn.textContent = originalText || 'Skicka intresseanmälan';
      }
      if (statusEl) {
        statusEl.textContent = (result && result.message) ||
          'Det gick inte att skicka anmälan. Försök igen om en stund eller kontakta info@stockholmsmoske.se.';
        statusEl.classList.add('form-status--error');
      }
    });
  }

  /**
   * Skicka payload till Apps Script. Försök CORS först, fall tillbaka till no-cors
   * och anta att inlämningen lyckades (svaret går då inte att läsa).
   * callback({ ok, message? })
   */
  function sendSubmission(payload, callback) {
    var cfg = getConfig();
    var url = cfg.appsScriptUrl;
    if (!url || url.indexOf('PASTE_') === 0) {
      // Ingen backend uppsatt — låtsas att det lyckades så att lokal preview funkar.
      callback({ ok: true });
      return;
    }

    var body = JSON.stringify(payload);
    var corsAttempt = true;

    function attempt(mode) {
      var opts = {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body,
        mode: mode,
        credentials: 'omit'
      };

      fetch(url, opts).then(function (resp) {
        if (mode === 'no-cors') {
          // Svaret kan inte läsas — anta lyckad inlämning.
          callback({ ok: true });
          return;
        }
        if (resp && resp.ok) {
          // Försök läsa JSON-svaret men kraschar inte om det inte går.
          resp.json().then(function (json) {
            if (json && json.ok === false) {
              callback({ ok: false, message: json.message || null });
            } else {
              callback({ ok: true });
            }
          }).catch(function () {
            callback({ ok: true });
          });
        } else if (resp && resp.ok === false) {
          callback({ ok: false, message: null });
        } else {
          fallback();
        }
      }).catch(function () {
        fallback();
      });
    }

    function fallback() {
      if (corsAttempt) {
        corsAttempt = false;
        attempt('no-cors');
      } else {
        callback({ ok: false, message: null });
      }
    }

    attempt('cors');
  }

  /** Dölj formuläret och visa successMessage. */
  function showSuccess(form) {
    var settings = (currentData && currentData.settings) || {};
    var msg = settings.successMessage ||
      'Tack! Din intresseanmälan har skickats. Vi återkommer när urvalet är klart.';
    var parent = form.parentNode;
    if (!parent) return;
    var success = el('div', { class: 'success-state', role: 'status', 'aria-live': 'polite' }, [
      el('h3', { text: 'Tack för din anmälan!' }),
      el('p', { text: msg })
    ]);
    parent.replaceChild(success, form);
  }

  // ---------------------------------------------------------------------------
  // Render: Sociala länkar (popup)
  // ---------------------------------------------------------------------------

  /** Fyll #social-list med länkar (sorterade, aktiva). */
  function renderSocialPopup(socialLinks) {
    var listEl = document.getElementById('social-list');
    if (!listEl) return;

    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);

    var items = (socialLinks || []).filter(function (s) {
      return s && toBool(s.active);
    }).slice().sort(byOrder);

    if (items.length === 0) {
      listEl.appendChild(el('li', {
        class: 'social-list__empty',
        text: 'Sociala länkar publiceras inom kort.'
      }));
      return;
    }

    items.forEach(function (link) {
      var url = trim(link.url);
      var label = link.label || link.platform || 'Länk';
      var li = el('li', { class: 'social-list__item' });

      if (!url) {
        li.classList.add('social-list__item--disabled');
        li.appendChild(el('span', {
          class: 'social-list__link social-list__link--disabled',
          'aria-disabled': 'true',
          text: label + ' (kommer snart)'
        }));
      } else {
        li.appendChild(el('a', {
          href: url, target: '_blank', rel: 'noopener noreferrer',
          class: 'social-list__link',
          text: label
        }));
      }
      listEl.appendChild(li);
    });
  }

  // ---------------------------------------------------------------------------
  // Popup-bindningar
  // ---------------------------------------------------------------------------

  /** Bind FAB-knapp, dialog-stängning, ESC och klick utanför. */
  function bindPopup() {
    var fab = document.getElementById('social-fab');
    var navTrigger = document.getElementById('social-fab-trigger');
    var dialog = document.getElementById('social-dialog');
    if (!fab || !dialog) return;

    var closeBtn = dialog.querySelector('.dialog__close');
    var supportsModal = typeof dialog.showModal === 'function';

    function open() {
      try {
        if (supportsModal && !dialog.open) dialog.showModal();
        else dialog.setAttribute('open', '');
      } catch (e) {
        dialog.setAttribute('open', '');
      }
      fab.setAttribute('aria-expanded', 'true');
    }

    function close(manual) {
      try {
        if (supportsModal && dialog.open) dialog.close();
        else dialog.removeAttribute('open');
      } catch (e) {
        dialog.removeAttribute('open');
      }
      fab.setAttribute('aria-expanded', 'false');
      if (manual) {
        try { sessionStorage.setItem('smf_popupClosed', '1'); } catch (e) { /* ignore */ }
      }
    }

    fab.addEventListener('click', function () {
      if (dialog.open) close(true);
      else open();
    });

    if (navTrigger) {
      navTrigger.addEventListener('click', function () {
        if (dialog.open) close(true);
        else open();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function () { close(true); });
    }

    // Klick utanför dialog-content stänger.
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) {
        close(true);
      }
    });

    // ESC: native <dialog> hanterar detta men vi vill ändå sätta sessionStorage.
    dialog.addEventListener('cancel', function () {
      // 'cancel'-event fyrar när användaren trycker ESC i ett <dialog>.
      try { sessionStorage.setItem('smf_popupClosed', '1'); } catch (e) { /* ignore */ }
      fab.setAttribute('aria-expanded', 'false');
    });

    // Fallback ESC för browsers utan native dialog-stöd.
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && dialog.open) {
        close(true);
      }
    });

    // Auto-öppning görs INTE — användaren öppnar själv.
  }

  // ---------------------------------------------------------------------------
  // Exponera lite för debugging utan att läcka allt.
  // ---------------------------------------------------------------------------

  SMF.refresh = function () {
    try { sessionStorage.removeItem(CACHE_KEY); } catch (e) { /* ignore */ }
    fetchPublicData(function (err, data) {
      if (err || !data) return;
      writeCache(data);
      applyData(data);
    });
  };

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

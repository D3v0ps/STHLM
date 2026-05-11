/*
 * Volontäranmälan — Stockholms Moské Festival 2026
 * Fristående formulär. Postar till Apps Script Web App (samma URL som
 * huvudsidan, via window.APP_CONFIG.appsScriptUrl) med
 * { action: 'submitVolunteer', data: { ... } }.
 */
(function () {
  'use strict';

  var INSTAGRAM_URL = 'https://instagram.com/stockholmsmoske';

  var AREAS = [
    { value: 'reception', label: 'Reception & välkomna' },
    { value: 'mat',       label: 'Mat & fika' },
    { value: 'barn',      label: 'Barn & familj' },
    { value: 'sakerhet',  label: 'Säkerhet & ordning' },
    { value: 'bazaar',    label: 'Bazaar-stöd' },
    { value: 'stadning',  label: 'Städning & rivning' }
  ];

  var SHIFTS = [
    { value: 'forenoon',   label: 'Förmiddag', sub: '10:00–15:00' },
    { value: 'afternoon',  label: 'Eftermiddag', sub: '15:00–20:00' }
  ];

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

  function getConfig() { return window.APP_CONFIG || {}; }

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    var yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
    buildForm();
  }

  function buildForm() {
    var container = document.getElementById('form-container');
    if (!container) return;
    while (container.firstChild) container.removeChild(container.firstChild);

    var form = el('form', { id: 'volunteer-form', novalidate: 'novalidate' });

    // Namn
    form.appendChild(field('name', 'Namn och efternamn', null, true, function (id, name) {
      return el('input', { type: 'text', id: id, name: name, autocomplete: 'name', required: 'required' });
    }));

    // Nummer
    form.appendChild(field('phone', 'Telefonnummer', null, true, function (id, name) {
      return el('input', { type: 'tel', id: id, name: name, inputmode: 'tel', autocomplete: 'tel', placeholder: '+46 70 123 45 67', required: 'required' });
    }));

    // Födelsedatum ÅÅMMDD
    form.appendChild(field('birthDate', 'Födelsedatum (ÅÅMMDD)', 'Sex siffror — t.ex. 980415 för 15 april 1998.', true, function (id, name) {
      return el('input', { type: 'text', id: id, name: name, inputmode: 'numeric', pattern: '[0-9]{6}', maxlength: '6', placeholder: 'ÅÅMMDD', required: 'required' });
    }));

    // Tidigare erfarenhet
    var expWrap = el('div', { class: 'field field--radio', 'data-field-id': 'hasExperience', 'data-required': 'true' });
    expWrap.appendChild(el('label', { class: 'field-label', text: 'Tidigare volontärerfarenhet i moskén' }));
    var expGroup = el('div', { class: 'field__radio-group', role: 'radiogroup', 'aria-label': 'Tidigare volontärerfarenhet i moskén' });
    [['ja', 'Ja'], ['nej', 'Nej']].forEach(function (opt) {
      var lbl = el('label');
      lbl.appendChild(el('input', { type: 'radio', name: 'hasExperience', value: opt[0], required: 'required' }));
      lbl.appendChild(document.createTextNode(opt[1]));
      expGroup.appendChild(lbl);
    });
    expWrap.appendChild(expGroup);
    expWrap.appendChild(el('p', { class: 'field__error', role: 'alert' }));
    form.appendChild(expWrap);

    // Berätta om dig själv
    form.appendChild(field('about', 'Berätta kort om dig själv', 'Vad gör du till vardags? Något särskilt vi bör veta?', true, function (id, name) {
      return el('textarea', { id: id, name: name, rows: '4', required: 'required', minlength: '10' });
    }));

    // Områden (multi)
    form.appendChild(multiCheckbox('areas', 'Områden du vill hjälpa till med', 'Välj ett eller flera.', AREAS));

    // Pass (multi)
    form.appendChild(multiCheckbox('shifts', 'Pass du kan hjälpa till med', 'Välj ett eller flera.', SHIFTS));

    // Honeypot
    var hp = el('div', { class: 'honeypot', 'aria-hidden': 'true' });
    hp.appendChild(el('label', { 'for': 'kontakttid', text: 'Lämna detta fält tomt' }));
    hp.appendChild(el('input', { type: 'text', id: 'kontakttid', name: 'kontakttid', tabindex: '-1', autocomplete: 'off' }));
    form.appendChild(hp);

    // Status + submit
    form.appendChild(el('div', { id: 'form-status', class: 'form-status', role: 'status', 'aria-live': 'polite' }));
    var actions = el('div', { class: 'form-actions' });
    actions.appendChild(el('span', { class: 'form-card__foot-note', text: 'Vi återkommer inom någon vecka.' }));
    actions.appendChild(el('button', { type: 'submit', class: 'btn btn-primary', text: 'Skicka anmälan' }));
    form.appendChild(actions);

    form.addEventListener('submit', handleSubmit);
    container.appendChild(form);
  }

  function field(id, label, help, required, buildControl) {
    var wrap = el('div', { class: 'field', 'data-field-id': id });
    if (required) wrap.setAttribute('data-required', 'true');
    var labelEl = el('label', { 'for': id, class: 'field-label', text: label });
    if (required) {
      labelEl.appendChild(el('span', { class: 'field__required', 'aria-hidden': 'true', text: ' *' }));
      labelEl.appendChild(el('span', { class: 'visually-hidden', text: ' (obligatoriskt)' }));
    }
    wrap.appendChild(labelEl);
    if (help) wrap.appendChild(el('p', { class: 'field-help', text: help }));
    var ctrl = buildControl(id, id);
    wrap.appendChild(ctrl);
    wrap.appendChild(el('p', { class: 'field__error', role: 'alert' }));
    return wrap;
  }

  function multiCheckbox(id, label, help, options) {
    var wrap = el('div', { class: 'field field--multi', 'data-field-id': id, 'data-required': 'true' });
    wrap.appendChild(el('label', { class: 'field-label', text: label }));
    if (help) wrap.appendChild(el('p', { class: 'field-help', text: help }));
    var group = el('div', { class: 'check-group', role: 'group', 'aria-label': label });
    options.forEach(function (opt) {
      var lbl = el('label', { class: 'check-tile' });
      lbl.appendChild(el('input', { type: 'checkbox', name: id, value: opt.value }));
      var body = el('span', { class: 'check-tile__body' });
      body.appendChild(el('span', { class: 'check-tile__label', text: opt.label }));
      if (opt.sub) body.appendChild(el('span', { class: 'check-tile__sub', text: opt.sub }));
      lbl.appendChild(body);
      group.appendChild(lbl);
    });
    wrap.appendChild(group);
    wrap.appendChild(el('p', { class: 'field__error', role: 'alert' }));
    return wrap;
  }

  function handleSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var status = form.querySelector('#form-status');
    if (status) { status.textContent = ''; status.removeAttribute('data-tone'); }

    // Plocka värden
    var data = {
      name: form.querySelector('#name').value.trim(),
      phone: form.querySelector('#phone').value.trim(),
      birthDate: form.querySelector('#birthDate').value.trim(),
      hasExperience: (form.querySelector('input[name="hasExperience"]:checked') || {}).value || '',
      about: form.querySelector('#about').value.trim(),
      areas: Array.prototype.map.call(form.querySelectorAll('input[name="areas"]:checked'), function (i) { return i.value; }),
      shifts: Array.prototype.map.call(form.querySelectorAll('input[name="shifts"]:checked'), function (i) { return i.value; }),
      kontakttid: form.querySelector('#kontakttid').value
    };

    // Klient-validering
    var errors = {};
    if (!data.name) errors.name = 'Fyll i ditt namn.';
    if (!data.phone) errors.phone = 'Fyll i ditt telefonnummer.';
    if (!/^\d{6}$/.test(data.birthDate)) errors.birthDate = 'Skriv födelsedatum som 6 siffror (ÅÅMMDD).';
    if (!data.hasExperience) errors.hasExperience = 'Välj ja eller nej.';
    if (data.about.length < 10) errors.about = 'Skriv åtminstone några ord om dig själv.';
    if (data.areas.length === 0) errors.areas = 'Välj minst ett område.';
    if (data.shifts.length === 0) errors.shifts = 'Välj minst ett pass.';

    // Rensa gamla fel + visa nya
    form.querySelectorAll('.field--invalid').forEach(function (f) { f.classList.remove('field--invalid'); });
    form.querySelectorAll('.field__error').forEach(function (e) { e.textContent = ''; });
    if (Object.keys(errors).length) {
      Object.keys(errors).forEach(function (key) {
        var f = form.querySelector('[data-field-id="' + key + '"]');
        if (!f) return;
        f.classList.add('field--invalid');
        var errEl = f.querySelector('.field__error');
        if (errEl) errEl.textContent = errors[key];
      });
      // Scrolla till första felet
      var firstError = form.querySelector('.field--invalid');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Submit
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
        showSuccess(form, data.name);
        return;
      }
      if (submitBtn) { submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); submitBtn.textContent = originalText || 'Skicka anmälan'; }
      if (status) {
        status.textContent = (result && result.message) || 'Det gick inte att skicka anmälan. Försök igen om en stund eller kontakta info@stockholmsmoske.se.';
        status.setAttribute('data-tone', 'error');
      }
    });
  }

  function sendVolunteer(payload, callback) {
    var url = (getConfig().appsScriptUrl || '').trim();
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
    success.appendChild(el('h3', { text: 'Tack' + (name ? ', ' + name.split(' ')[0] : '') + '!' }));
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

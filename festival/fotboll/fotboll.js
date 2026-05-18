/*
 * Fotbollsturnering — anmälan
 * Stockholms Moské Festival 2026
 *
 * Enkel statisk form: namn, telefon, e-post, lagets namn, consent. Postar till
 * Apps Script med { action: 'submitFootball', data: { ... } }.
 */
(function () {
  'use strict';

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var PHONE_RE = /^(\+46|0)[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d[\s\-]?\d{2,5}$/;

  function getConfig() { return window.APP_CONFIG || {}; }

  function trim(s) { return (s == null ? '' : String(s)).trim(); }

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

    var form = el('form', { id: 'football-form', novalidate: 'novalidate' });

    // Namn
    form.appendChild(field('name', 'Förnamn och efternamn', null, true, function (id, name) {
      return el('input', { type: 'text', id: id, name: name, autocomplete: 'name', required: 'required' });
    }));

    // Telefon
    form.appendChild(field('phone', 'Telefonnummer', null, true, function (id, name) {
      return el('input', { type: 'tel', id: id, name: name, inputmode: 'tel', autocomplete: 'tel', placeholder: '+46 70 123 45 67', required: 'required' });
    }));

    // Email
    form.appendChild(field('email', 'E-postadress', null, true, function (id, name) {
      return el('input', { type: 'email', id: id, name: name, inputmode: 'email', autocomplete: 'email', placeholder: 'din@epost.se', required: 'required' });
    }));

    // Lagets namn
    form.appendChild(field('teamName', 'Lagets namn', 'Använd samma namn när du Swishar anmälningsavgiften.', true, function (id, name) {
      return el('input', { type: 'text', id: id, name: name, required: 'required' });
    }));

    // Consent (kryssruta)
    var consentWrap = el('div', { class: 'field field--checkbox', 'data-field-id': 'consentAccepted', 'data-required': 'true' });
    var consentLbl = el('label', { class: 'field__label field__label--checkbox', 'for': 'consentAccepted' });
    consentLbl.appendChild(el('input', { type: 'checkbox', id: 'consentAccepted', name: 'consentAccepted', required: 'required' }));
    consentLbl.appendChild(document.createTextNode(' Jag godkänner att anmäla mitt lag. Bekräftelse på plats kommer via SMS — utan bekräftelsen är man inte lovad en plats på turneringen.'));
    consentLbl.appendChild(el('span', { class: 'field__required', 'aria-hidden': 'true', text: ' *' }));
    consentLbl.appendChild(el('span', { class: 'visually-hidden', text: ' (obligatoriskt)' }));
    consentWrap.appendChild(consentLbl);
    consentWrap.appendChild(el('p', { class: 'field__error', role: 'alert' }));
    form.appendChild(consentWrap);

    // Honeypot
    var hp = el('div', { class: 'honeypot', 'aria-hidden': 'true' });
    hp.appendChild(el('label', { 'for': 'kontakttid', text: 'Lämna detta fält tomt' }));
    hp.appendChild(el('input', { type: 'text', id: 'kontakttid', name: 'kontakttid', tabindex: '-1', autocomplete: 'off' }));
    form.appendChild(hp);

    // Status + submit
    form.appendChild(el('div', { id: 'form-status', class: 'form-status', role: 'status', 'aria-live': 'polite' }));
    var actions = el('div', { class: 'form-actions' });
    actions.appendChild(el('span', { class: 'form-card__foot-note', text: 'Vi bekräftar din plats via SMS.' }));
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

  function handleSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var status = form.querySelector('#form-status');
    if (status) { status.textContent = ''; status.removeAttribute('data-tone'); }

    var data = {
      name: trim(form.querySelector('#name').value),
      phone: trim(form.querySelector('#phone').value),
      email: trim(form.querySelector('#email').value),
      teamName: trim(form.querySelector('#teamName').value),
      consentAccepted: !!form.querySelector('#consentAccepted').checked,
      kontakttid: form.querySelector('#kontakttid').value
    };

    var errors = {};
    if (!data.name) errors.name = 'Fyll i ditt namn.';
    if (!data.phone) errors.phone = 'Fyll i ditt telefonnummer.';
    else if (!PHONE_RE.test(data.phone)) errors.phone = 'Ogiltigt telefonnummer (svenskt format krävs).';
    if (!data.email) errors.email = 'Fyll i din e-postadress.';
    else if (!EMAIL_RE.test(data.email)) errors.email = 'Ogiltig e-postadress.';
    if (!data.teamName) errors.teamName = 'Fyll i lagets namn.';
    if (!data.consentAccepted) errors.consentAccepted = 'Du måste godkänna villkoren.';

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
      action: 'submitFootball',
      submittedAt: new Date().toISOString(),
      data: data
    };

    sendFootball(payload, function (result) {
      if (result && result.ok) {
        showSuccess(form, data.teamName, data.name);
        return;
      }
      if (submitBtn) { submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); submitBtn.textContent = originalText || 'Skicka anmälan'; }
      if (status) {
        status.textContent = (result && result.message) || 'Det gick inte att skicka anmälan. Försök igen om en stund eller kontakta info@stockholmsmoske.se.';
        status.setAttribute('data-tone', 'error');
      }
    });
  }

  function sendFootball(payload, callback) {
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

  function showSuccess(form, teamName, name) {
    var parent = form.parentNode;
    if (!parent) return;
    var success = el('div', { class: 'success-state', role: 'status', 'aria-live': 'polite' });
    success.appendChild(el('h3', { text: 'Tack' + (name ? ', ' + String(name).split(' ')[0] : '') + '!' }));
    success.appendChild(el('p', {
      text: 'Vi har tagit emot anmälan för ' + (teamName ? '"' + teamName + '"' : 'ditt lag') +
            '. Du får en bekräftelse via SMS när platsen är godkänd, tillsammans med Swish-uppgifter för anmälningsavgiften (500 kr).'
    }));
    success.appendChild(el('p', { class: 'success-state__dua', text: 'Vi ses på plan!' }));
    parent.replaceChild(success, form);
    success.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
})();

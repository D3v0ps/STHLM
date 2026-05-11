/**
 * admin.js – klient-side JS för adminpanelen.
 * Körs som static SPA på One.com. Pratar med Apps Script Web App via fetch POST
 * (Content-Type: text/plain för att undvika CORS-preflight).
 *
 * Innehåll:
 *  - State + token-hantering (sessionStorage)
 *  - fetch Promise-wrapper (runServer)
 *  - Login / logout
 *  - Tab-navigation
 *  - Render: översikt, eventform, frågor, anmälningar, utställare, sociala medier, sport-sidor
 *  - Toast / dialog / loading-overlay-helpers
 *  - Osparade ändringar-skydd
 */
(function() {
  'use strict';

  // ============================================================
  // KONFIGURATION
  // ============================================================

  /**
   * Settings-fält i ordningen från SPEC §5. Type styr renderingen.
   * help = hjälptext under inputen.
   */
  const EVENT_SECTIONS = [
    { id: 'identity', title: 'Eventets identitet', subtitle: 'Texten som dominerar publika sidans hero-sektion.' },
    { id: 'purpose', title: 'Festivalens syfte', subtitle: 'Lång beskrivning av festivalen som visas under hero-sektionen.' },
    { id: 'dateplace', title: 'Datum, tid & plats', subtitle: 'Visas i hero-strippen och i info-blocket längre ner.' },
    { id: 'visitors', title: 'Förväntade besökare', subtitle: 'Siffrorna visas som info till anmälare så de förstår skalan på eventet.' },
    { id: 'visibility', title: 'Anmälan & synlighet', subtitle: 'Slå av/på funktioner på publika sidan utan att behöva röra något annat.' },
    { id: 'activities', title: 'Aktiviteter', subtitle: 'En textruta per aktivitetskort. Varje kommitté uppdaterar sin egen ruta inför festivalen.' },
    { id: 'descriptions', title: 'Bazaarens beskrivningar', subtitle: 'Texter som visas tillsammans med anmälningsformuläret.' },
    { id: 'messages', title: 'Bekräftelse & statusmeddelanden', subtitle: 'Texter som visas för anmälaren beroende på status.' },
    { id: 'marketing', title: 'Marknadsföring', subtitle: 'Länkar och kanaler där festivalen syns utåt.' }
  ];

  const SETTINGS_FIELDS = [
    { key: 'eventTitle',       label: 'Eventets titel',                   type: 'text',     section: 'identity',    span: 6,
      help: 'Stor rubrik längst upp på publika sidan.' },
    { key: 'eventSubtitle',    label: 'Undertitel (kursiv)',              type: 'text',     section: 'identity',    span: 6,
      help: 'Visas under titeln i kursiv mässing-färg.' },
    { key: 'introText',        label: 'Introtext',                        type: 'textarea', section: 'identity',    span: 12,
      help: 'Inledande beskrivning under hero-rubriken. Cirka 1–2 meningar.', rows: 3 },

    { key: 'purposeText',      label: 'Syfte-text',                       type: 'textarea', section: 'purpose',     span: 12,
      help: 'Använd blankrad mellan stycken. Visas på den publika sidan strax under hero-sektionen.', rows: 8 },

    { key: 'eventDate',        label: 'Datum (visning)',                  type: 'text',     section: 'dateplace',   span: 4,
      help: 'T.ex. "Lördag 13 juni". Skriv som du vill att besökaren ska läsa det.' },
    { key: 'eventTime',        label: 'Tid (hela eventet)',               type: 'text',     section: 'dateplace',   span: 4,
      help: 'T.ex. "12:00–19:00".' },
    { key: 'bazaarTime',       label: 'Bazaarens tid',                     type: 'text',     section: 'dateplace',   span: 4,
      help: 'T.ex. "13:00–17:00".' },
    { key: 'eventLocation',    label: 'Plats',                            type: 'text',     section: 'dateplace',   span: 12,
      help: 'Visas i hero-sektionen och i info-blocket.' },

    { key: 'expectedChildren', label: 'Förväntat antal barn',             type: 'number',   section: 'visitors',    span: 6 },
    { key: 'expectedAdults',   label: 'Förväntat antal vuxna',            type: 'number',   section: 'visitors',    span: 6 },

    { key: 'registrationOpen', label: 'Anmälan öppen',                    type: 'boolean',  section: 'visibility',
      help: 'När påslaget visas anmälningsformuläret. När avstängd visas utställarlistan istället.',
      badgeOn: 'Öppen', badgeOff: 'Stängd' },
    { key: 'showExhibitors',   label: 'Visa utställarlistan',             type: 'boolean',  section: 'visibility',
      help: 'När avstängd döljs utställarlistan helt på publika sidan.',
      badgeOn: 'Synlig', badgeOff: 'Dold' },
    { key: 'heroButtonText',   label: 'Knapptext (primär CTA)',           type: 'text',     section: 'visibility',  span: 12,
      help: 'Texten på den stora knappen i hero-sektionen.' },

    { key: 'activityBazaarText',    label: 'Bazaar — beskrivning',                  type: 'textarea', section: 'activities', span: 12,
      help: 'Visas på bazaar-kortet på publika sidan.', rows: 3 },
    { key: 'activitySportText',     label: 'Sport — beskrivning',                  type: 'textarea', section: 'activities', span: 12,
      help: 'Visas på sport-kortet (fotboll och basket).', rows: 3 },
    { key: 'activityMatText',       label: 'Mat — beskrivning',                    type: 'textarea', section: 'activities', span: 12,
      help: 'Meny och priser publiceras närmare festivalen.', rows: 3 },
    { key: 'activityKidsText',      label: 'Barnaktiviteter — beskrivning',        type: 'textarea', section: 'activities', span: 12,
      help: 'Program och ledare för de yngsta.', rows: 3 },
    { key: 'activityKnowledgeText', label: 'Kunskapsutställningar — beskrivning',  type: 'textarea', section: 'activities', span: 12,
      help: 'Utställningar och kortföredrag under festivalen.', rows: 3 },

    { key: 'whoCanApplyText',  label: 'Vem kan anmäla sig?',              type: 'textarea', section: 'descriptions', span: 12,
      help: 'Förklaring av vem som får ansöka.', rows: 3 },
    { key: 'selectionText',    label: 'Så görs urvalet',                  type: 'textarea', section: 'descriptions', span: 12,
      help: 'Förklaring av urvalsprocessen.', rows: 3 },
    { key: 'importantInfoText',label: 'Viktigt att känna till',           type: 'textarea', section: 'descriptions', span: 12,
      help: 'Punktlista med viktiga villkor (en punkt per rad).', rows: 4 },

    { key: 'successMessage',   label: 'Tackmeddelande efter anmälan',     type: 'text',     section: 'messages',    span: 12,
      help: 'Visas när anmälan har skickats.' },
    { key: 'closedMessage',    label: 'Meddelande när anmälan är stängd', type: 'text',     section: 'messages',    span: 12,
      help: 'Visas ovanför utställarlistan när anmälan är avstängd.' },

    { key: 'linktreeUrl',      label: 'Linktree-URL',                     type: 'text',     section: 'marketing',   span: 12,
      help: 'Lämna tomt om ingen Linktree finns. Annars visas en "Öppna alla länkar i Linktree"-knapp i sektionen Följ oss.' }
  ];

  const QUESTION_TYPES = [
    { value: 'text',     label: 'Textfält (kort)' },
    { value: 'email',    label: 'E-post' },
    { value: 'tel',      label: 'Telefon' },
    { value: 'textarea', label: 'Textfält (lång)' },
    { value: 'checkbox', label: 'Kryssruta (godkänn villkor)' },
    { value: 'select',   label: 'Rullista (välj alternativ)' }
  ];

  const STATUS_LABELS = {
    'new':       'Ny',
    'reviewed':  'Granskad',
    'approved':  'Godkänd',
    'rejected':  'Nekad',
    'contacted': 'Kontaktad'
  };

  // ============================================================
  // STATE
  // ============================================================

  const state = {
    token: sessionStorage.getItem('smf_admin_token') || null,
    data: null,
    overview: null,
    unsavedChanges: {
      event: false,
      questions: false,
      exhibitors: false,
      social: false,
      sports: false
    },
    submissionsFilter: { status: 'all', search: '' },
    currentSubmissionId: null
  };

  // ============================================================
  // FETCH-WRAPPER MOT APPS SCRIPT WEB APP
  // ============================================================

  /**
   * POST:ar { adminAction, args } till Apps Script Web App och returnerar
   * svaret som JSON. Använder text/plain Content-Type så Apps Script kan
   * läsa kroppen utan att browsern utlöser CORS-preflight.
   *
   * @param {string} fnName  Namn på server-funktion (måste finnas i adminDispatch_).
   * @param {...*}   args    Argument som vidarebefordras till server-funktionen.
   * @return {Promise<*>}    Svaret deserialiserat från JSON.
   */
  function runServer(fnName, ...args) {
    const cfg = window.ADMIN_CONFIG || {};
    const url = (cfg.adminWebAppUrl || '').trim();
    if (!url) {
      return Promise.reject(new Error('ADMIN_CONFIG.adminWebAppUrl saknas i config.js.'));
    }
    const body = JSON.stringify({ adminAction: fnName, args: args });
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body,
      redirect: 'follow',
      cache: 'no-store',
      credentials: 'omit'
    }).then(function(res) {
      if (!res.ok) {
        throw new Error('HTTP ' + res.status + ' från Apps Script.');
      }
      return res.json();
    }).then(function(json) {
      if (!json || typeof json !== 'object') {
        throw new Error('invalid_response');
      }
      if (json.ok === false) {
        const code = json.error || 'unknown_error';
        const err = new Error(code + (json.message ? ': ' + json.message : ''));
        err.code = code;
        err.userMessage = json.message || '';
        throw err;
      }
      // Plocka ut json.data om det finns, annars returnera hela objektet utan ok-fältet
      // så att t.ex. validateSession kan läsa res.valid direkt.
      if (Object.prototype.hasOwnProperty.call(json, 'data')) {
        return json.data;
      }
      const out = {};
      for (const k in json) {
        if (k !== 'ok' && Object.prototype.hasOwnProperty.call(json, k)) {
          out[k] = json[k];
        }
      }
      return out;
    });
  }

  // ============================================================
  // INITIERING
  // ============================================================

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    bindStaticListeners();

    if (state.token) {
      try {
        const res = await runServer('validateSession', state.token);
        if (res && res.valid) {
          showDashboard();
          await loadData();
          return;
        }
      } catch (e) {
        // tyst fail – visa login
      }
      clearToken();
    }

    showLogin();
  }

  function bindStaticListeners() {
    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Tab-navigation
    bindTabs();

    // Spara-knappar
    const eventForm = document.getElementById('event-form');
    if (eventForm) eventForm.addEventListener('submit', handleEventSave);

    const addQBtn = document.getElementById('add-question-btn');
    if (addQBtn) addQBtn.addEventListener('click', handleAddQuestion);

    const saveQBtn = document.getElementById('save-questions-btn');
    if (saveQBtn) saveQBtn.addEventListener('click', handleQuestionsSave);

    const addExhBtn = document.getElementById('add-exhibitor-btn');
    if (addExhBtn) addExhBtn.addEventListener('click', handleAddExhibitor);

    const saveExhBtn = document.getElementById('save-exhibitors-btn');
    if (saveExhBtn) saveExhBtn.addEventListener('click', handleExhibitorsSave);

    const addSocBtn = document.getElementById('add-social-btn');
    if (addSocBtn) addSocBtn.addEventListener('click', handleAddSocial);

    const saveSocBtn = document.getElementById('save-social-btn');
    if (saveSocBtn) saveSocBtn.addEventListener('click', handleSocialSave);

    const saveSportsBtn = document.getElementById('save-sports-btn');
    if (saveSportsBtn) saveSportsBtn.addEventListener('click', handleSportsSave);

    // Submissions filter pills (Alla / Nya / Granskar / Godkända / Kontaktade / Nekade)
    document.querySelectorAll('.filter-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const value = btn.getAttribute('data-filter') || 'all';
        document.querySelectorAll('.filter-tab').forEach(function(other) {
          const isActive = other === btn;
          other.classList.toggle('is-active', isActive);
          other.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        state.submissionsFilter.status = value;
        renderSubmissionsTable();
      });
    });
    // Behåll dropdown-fallback för kompatibilitet
    const subFilter = document.getElementById('submissions-filter');
    if (subFilter) subFilter.addEventListener('change', function() {
      state.submissionsFilter.status = subFilter.value;
      renderSubmissionsTable();
    });
    const subSearch = document.getElementById('submissions-search');
    if (subSearch) {
      let searchTimer = null;
      subSearch.addEventListener('input', function() {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(function() {
          state.submissionsFilter.search = subSearch.value;
          renderSubmissionsTable();
        }, 200);
      });
    }
    const exportBtn = document.getElementById('export-csv-btn');
    if (exportBtn) exportBtn.addEventListener('click', handleExportCsv);

    // Toggle registration
    const toggleRegBtn = document.getElementById('toggle-registration-btn');
    if (toggleRegBtn) toggleRegBtn.addEventListener('click', handleToggleRegistration);

    // Dialog-stängare
    document.querySelectorAll('.dialog__close').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const dlg = btn.closest('dialog');
        if (dlg && dlg.open) dlg.close();
      });
    });

    // Klick på backdrop stänger dialog (vanligaste mobil-gesten)
    document.querySelectorAll('dialog').forEach(function(dlg) {
      if (dlg.id === 'loading-overlay') return;
      dlg.addEventListener('click', function(e) {
        if (e.target === dlg) dlg.close();
      });
    });

    // ESC stänger eventuella öppna dialoger (dialog gör detta nativt, men vi ser till att städa)
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        document.querySelectorAll('dialog[open]').forEach(function(dlg) {
          if (dlg.id !== 'loading-overlay') dlg.close();
        });
      }
    });

    // Beforeunload-varning
    window.addEventListener('beforeunload', function(e) {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    });

    // Globalt felfångande
    window.addEventListener('error', function(e) {
      try { console.error(e); } catch (_) { /* ignore */ }
      toast('Ett oväntat fel uppstod. Ladda om sidan om problemet kvarstår.', 'error');
    });
    window.addEventListener('unhandledrejection', function(e) {
      try { console.error(e); } catch (_) { /* ignore */ }
    });
  }

  // ============================================================
  // VY-VÄXLING
  // ============================================================

  function showLogin() {
    const loginView = document.getElementById('login-view');
    const dashView = document.getElementById('dashboard-view');
    if (loginView) loginView.hidden = false;
    if (dashView) dashView.hidden = true;
    const pwd = document.getElementById('login-password');
    if (pwd) {
      pwd.value = '';
      try { pwd.focus(); } catch (_) {}
    }
  }

  function showDashboard() {
    const loginView = document.getElementById('login-view');
    const dashView = document.getElementById('dashboard-view');
    if (loginView) loginView.hidden = true;
    if (dashView) dashView.hidden = false;
    // Visa user-pill
    const userPill = document.getElementById('user-pill');
    if (userPill) userPill.hidden = false;
    updateLastSaved();
    // Återställ senast aktiv flik
    const savedTab = sessionStorage.getItem('smf_admin_tab') || 'overview';
    activateTab(savedTab);
  }

  // ============================================================
  // Topbar live-chip — uppdateras efter varje sparning
  // ============================================================
  let lastSavedAt = null;
  function updateLastSaved() {
    lastSavedAt = Date.now();
    renderLastSaved();
  }
  function renderLastSaved() {
    const el = document.getElementById('last-saved');
    if (!el) return;
    if (!lastSavedAt) { el.textContent = 'just nu'; return; }
    const sec = Math.floor((Date.now() - lastSavedAt) / 1000);
    let text;
    if (sec < 30) text = 'just nu';
    else if (sec < 60) text = 'för någon minut sedan';
    else if (sec < 3600) text = 'för ' + Math.floor(sec / 60) + ' min sedan';
    else if (sec < 86400) text = 'för ' + Math.floor(sec / 3600) + ' h sedan';
    else text = 'för ' + Math.floor(sec / 86400) + ' dagar sedan';
    el.textContent = text;
  }
  setInterval(renderLastSaved, 30000);

  function clearToken() {
    state.token = null;
    sessionStorage.removeItem('smf_admin_token');
  }

  // ============================================================
  // LOGIN / LOGOUT
  // ============================================================

  async function handleLogin(e) {
    e.preventDefault();
    const pwdEl = document.getElementById('login-password');
    const errEl = document.getElementById('login-error');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const password = pwdEl ? pwdEl.value : '';

    if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.originalText = submitBtn.textContent;
      submitBtn.textContent = 'Loggar in…';
    }

    try {
      const result = await runServer('loginAdmin', password);
      if (!result || !result.token) {
        if (errEl) {
          errEl.textContent = 'Inget token från servern. Kontakta utvecklaren.';
          errEl.hidden = false;
        }
        return;
      }
      state.token = result.token;
      sessionStorage.setItem('smf_admin_token', state.token);
      showDashboard();
      await loadData();
    } catch (err) {
      const code = (err && err.code) || 'unknown';
      const msg = {
        invalid_password: 'Fel lösenord. Försök igen.',
        rate_limited: 'För många misslyckade försök. Försök igen om 15 minuter.',
        not_configured: 'Adminlösenord är inte satt. Kontakta utvecklaren.',
        missing_password: 'Skriv in lösenordet.'
      }[code] || (err && err.userMessage) || 'Tekniskt fel: kunde inte nå servern. Kontakta utvecklaren.';
      if (errEl) {
        errEl.textContent = msg;
        errEl.hidden = false;
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.originalText || 'Logga in';
      }
    }
  }

  async function handleLogout() {
    if (hasUnsavedChanges()) {
      const ok = await confirmDialog(
        'Du har osparade ändringar som kommer att försvinna. Vill du logga ut ändå?',
        'Logga ut',
        true
      );
      if (!ok) return;
    }
    if (state.token) {
      try { await runServer('logoutAdmin', state.token); } catch (_) { /* best-effort */ }
    }
    clearToken();
    state.data = null;
    state.overview = null;
    state.unsavedChanges = { event: false, questions: false, exhibitors: false, social: false, sports: false };
    showLogin();
  }

  // ============================================================
  // SESSION-FEL HANTERING
  // ============================================================

  /**
   * Returnerar true om felet beror på utgången/ogiltig token.
   * Hanterar både Error-objekt och vanliga strängar.
   */
  function isAuthError(err) {
    if (err && err.code === 'unauthorized') return true;
    const msg = err && err.message ? String(err.message) : String(err || '');
    return msg.indexOf('unauthorized') !== -1
        || msg.indexOf('invalid_token') !== -1
        || msg.indexOf('expired_token') !== -1;
  }

  async function handleAuthError() {
    toast('Din session har gått ut. Logga in igen.', 'error');
    clearToken();
    state.data = null;
    state.overview = null;
    state.unsavedChanges = { event: false, questions: false, exhibitors: false, social: false, sports: false };
    showLogin();
  }

  // ============================================================
  // DATA-INLADDNING
  // ============================================================

  async function loadData() {
    showLoadingOverlay();
    try {
      state.data = await runServer('getAdminData', state.token);

      // getOverview kan saknas i vissa miljöer; ignorera fel
      try {
        state.overview = await runServer('getOverview', state.token);
      } catch (_) {
        state.overview = null;
      }

      state.unsavedChanges = { event: false, questions: false, exhibitors: false, social: false, sports: false };

      renderOverview();
      renderEventForm();
      renderQuestionsList();
      renderSubmissionsTable();
      renderExhibitorsList();
      renderSocialList();
      renderSportsList();
    } catch (err) {
      if (isAuthError(err)) {
        await handleAuthError();
        return;
      }
      toast('Kunde inte ladda data. Försök igen.', 'error');
    } finally {
      hideLoadingOverlay();
    }
  }

  // ============================================================
  // TAB-NAVIGATION
  // ============================================================

  function bindTabs() {
    const tabBtns = Array.from(document.querySelectorAll('[data-tab]'));
    tabBtns.forEach(function(btn, idx) {
      btn.addEventListener('click', function() {
        const tab = btn.getAttribute('data-tab');
        activateTab(tab, { focus: false });
      });
      btn.addEventListener('keydown', function(e) {
        let next = -1;
        if (e.key === 'ArrowRight') next = (idx + 1) % tabBtns.length;
        else if (e.key === 'ArrowLeft') next = (idx - 1 + tabBtns.length) % tabBtns.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabBtns.length - 1;
        if (next !== -1) {
          e.preventDefault();
          const nextTab = tabBtns[next].getAttribute('data-tab');
          activateTab(nextTab, { focus: true });
        }
      });
    });
    document.querySelectorAll('[data-goto-tab]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const tab = btn.getAttribute('data-goto-tab');
        activateTab(tab);
      });
    });
  }

  function activateTab(tabName, opts) {
    if (!tabName) tabName = 'overview';
    opts = opts || {};

    // Knappar
    document.querySelectorAll('[data-tab]').forEach(function(btn) {
      const isActive = btn.getAttribute('data-tab') === tabName;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
      if (isActive && opts.focus) btn.focus();
      if (isActive) {
        try { btn.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } catch (_) {}
      }
    });

    // Paneler
    document.querySelectorAll('[data-tab-panel]').forEach(function(panel) {
      const isActive = panel.getAttribute('data-tab-panel') === tabName;
      panel.hidden = !isActive;
    });

    sessionStorage.setItem('smf_admin_tab', tabName);

    // Scrolla upp till toppen vid byte
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (_) {}
  }

  // ============================================================
  // ÖVERSIKT
  // ============================================================

  function renderOverview() {
    const settings = (state.data && state.data.settings) || {};
    const subs = (state.data && state.data.submissions) || [];
    const exhibitors = (state.data && state.data.exhibitors) || [];
    const overview = state.overview || {};

    const isOpen = !!(overview.registrationOpen !== undefined ? overview.registrationOpen : settings.registrationOpen);
    const newCount = overview.newSubmissionsCount !== undefined
      ? overview.newSubmissionsCount
      : subs.filter(function(s) { return (s.status || '').toLowerCase() === 'new'; }).length;
    const totalCount = overview.totalSubmissions !== undefined ? overview.totalSubmissions : subs.length;
    const publishedCount = overview.publishedExhibitorsCount !== undefined
      ? overview.publishedExhibitorsCount
      : exhibitors.filter(function(x) { return !!x.published; }).length;

    setText('overview-registration-status', isOpen ? 'Öppen' : 'Stängd');
    const statusEl = document.getElementById('overview-registration-status');
    const regCard = statusEl ? statusEl.closest('.status-card--registration') : null;
    if (regCard) {
      regCard.classList.toggle('is-open', isOpen);
      regCard.classList.toggle('is-closed', !isOpen);
    }
    setText('overview-new-count', String(newCount));
    setText('overview-total-count', String(totalCount));
    setText('overview-published-count', String(publishedCount));

    // Tab-badge för Anmälningar
    const badge = document.getElementById('tab-badge-submissions');
    if (badge) {
      if (newCount > 0) {
        badge.textContent = String(newCount);
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    }

    const toggleBtn = document.getElementById('toggle-registration-btn');
    if (toggleBtn) {
      toggleBtn.textContent = isOpen ? 'Stäng anmälan' : 'Öppna anmälan';
      toggleBtn.classList.toggle('btn--danger', isOpen);
      toggleBtn.classList.toggle('btn--primary', !isOpen);
    }
  }

  async function handleToggleRegistration() {
    const settings = (state.data && state.data.settings) || {};
    const isOpen = !!settings.registrationOpen;
    const next = !isOpen;

    const message = isOpen
      ? 'Vill du verkligen stänga anmälan? Besökare kommer inte kunna skicka in nya intresseanmälningar.'
      : 'Vill du öppna anmälan igen? Besökare kommer kunna skicka in intresseanmälningar.';
    const okText = isOpen ? 'Stäng anmälan' : 'Öppna anmälan';
    const ok = await confirmDialog(message, okText, isOpen);
    if (!ok) return;

    showLoadingOverlay();
    try {
      const merged = Object.assign({}, settings, { registrationOpen: next });
      await runServer('saveSettings', state.token, merged);
      state.data.settings = merged;
      // Uppdatera overview också
      try { state.overview = await runServer('getOverview', state.token); } catch (_) {}
      renderOverview();
      renderEventForm();
      toast(next ? 'Anmälan är öppen igen.' : 'Anmälan är stängd.', 'success');
    } catch (err) {
      if (isAuthError(err)) { await handleAuthError(); return; }
      toast('Kunde inte uppdatera. Försök igen.', 'error');
    } finally {
      hideLoadingOverlay();
    }
  }

  // ============================================================
  // EVENTINFORMATION
  // ============================================================

  function renderEventForm() {
    const container = document.getElementById('event-fields');
    if (!container) return;
    container.innerHTML = '';

    const settings = (state.data && state.data.settings) || {};

    EVENT_SECTIONS.forEach(function(section) {
      const fields = SETTINGS_FIELDS.filter(function(f) { return f.section === section.id; });
      if (!fields.length) return;

      const card = document.createElement('section');
      card.className = 'section-card';

      const head = document.createElement('div');
      head.className = 'section-card__head';
      const headInner = document.createElement('div');
      const titleEl = document.createElement('h2');
      titleEl.className = 'section-card__title';
      titleEl.textContent = section.title;
      headInner.appendChild(titleEl);
      if (section.subtitle) {
        const subEl = document.createElement('p');
        subEl.className = 'section-card__subtitle';
        subEl.textContent = section.subtitle;
        headInner.appendChild(subEl);
      }
      head.appendChild(headInner);
      card.appendChild(head);

      const body = document.createElement('div');
      body.className = 'section-card__body';

      const toggles = fields.filter(function(f) { return f.type === 'boolean'; });
      const grids = fields.filter(function(f) { return f.type !== 'boolean'; });

      toggles.forEach(function(f) { body.appendChild(buildToggleField(f, settings)); });

      if (grids.length) {
        const grid = document.createElement('div');
        grid.className = 'form-grid';
        if (toggles.length) grid.style.marginTop = '12px';
        grids.forEach(function(f) { grid.appendChild(buildSettingField(f, settings)); });
        body.appendChild(grid);
      }

      card.appendChild(body);
      container.appendChild(card);
    });

    // Sticky save-bar (uppdaterar status-chip + knapptext)
    container.appendChild(buildSaveBar('event', 'Spara eventinfo'));
    updateSaveBar();
  }

  function buildSettingField(field, settings) {
    const cell = document.createElement('div');
    cell.className = 'form-cell' + (field.span ? ' form-cell--' + field.span : '');

    const label = document.createElement('label');
    label.className = 'field-label';
    label.setAttribute('for', 'set-' + field.key);
    label.textContent = field.label;
    cell.appendChild(label);

    const value = settings[field.key];
    let input;
    if (field.type === 'textarea') {
      input = document.createElement('textarea');
      input.className = 'textarea';
      input.rows = field.rows || 3;
      input.value = value != null ? String(value) : '';
    } else if (field.type === 'number') {
      input = document.createElement('input');
      input.type = 'number';
      input.className = 'input';
      input.value = (value != null && value !== '') ? Number(value) : '';
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.className = 'input';
      input.value = value != null ? String(value) : '';
    }
    input.id = 'set-' + field.key;
    input.dataset.settingKey = field.key;
    input.dataset.settingType = field.type;
    if (field.placeholder) input.placeholder = field.placeholder;
    input.addEventListener('input', markEventDirty);
    cell.appendChild(input);

    if (field.help) {
      const help = document.createElement('p');
      help.className = 'field-help';
      help.textContent = field.help;
      cell.appendChild(help);
    }
    return cell;
  }

  function buildToggleField(field, settings) {
    const wrap = document.createElement('div');
    wrap.className = 'toggle-field';

    const main = document.createElement('div');
    main.className = 'toggle-field__main';

    const head = document.createElement('div');
    head.className = 'toggle-field__head';

    const title = document.createElement('span');
    title.className = 'toggle-field__title';
    title.textContent = field.label;
    head.appendChild(title);

    const value = !!settings[field.key];
    const chip = document.createElement('span');
    chip.className = value ? 'chip ok' : 'chip muted';
    renderToggleChip(chip, value, field);
    head.appendChild(chip);
    main.appendChild(head);

    if (field.help) {
      const help = document.createElement('p');
      help.className = 'toggle-field__help';
      help.textContent = field.help;
      main.appendChild(help);
    }

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = 'set-' + field.key;
    input.dataset.settingKey = field.key;
    input.dataset.settingType = 'boolean';
    input.checked = value;

    const track = document.createElement('span');
    track.className = 'toggle__track';
    const thumb = document.createElement('span');
    thumb.className = 'toggle__thumb';
    track.appendChild(thumb);

    toggleLabel.appendChild(input);
    toggleLabel.appendChild(track);

    input.addEventListener('change', function() {
      markEventDirty();
      chip.className = input.checked ? 'chip ok' : 'chip muted';
      renderToggleChip(chip, input.checked, field);
    });

    wrap.appendChild(main);
    wrap.appendChild(toggleLabel);
    return wrap;
  }

  function renderToggleChip(chip, on, field) {
    while (chip.firstChild) chip.removeChild(chip.firstChild);
    const dot = document.createElement('span');
    dot.className = on ? 'dot ok' : 'dot';
    chip.appendChild(dot);
    chip.appendChild(document.createTextNode(' ' + (on ? (field.badgeOn || 'På') : (field.badgeOff || 'Av'))));
  }

  function markEventDirty() {
    state.unsavedChanges.event = true;
    updateSaveBar();
  }

  function buildSaveBar(scope, saveLabel) {
    const bar = document.createElement('div');
    bar.className = 'save-bar is-clean';
    bar.dataset.scope = scope;

    const left = document.createElement('div');
    left.className = 'save-bar__left';

    const chip = document.createElement('span');
    chip.className = 'chip save-bar__chip';
    const dot = document.createElement('span');
    dot.className = 'dot';
    chip.appendChild(dot);
    chip.appendChild(document.createTextNode(' '));
    const chipText = document.createElement('span');
    chipText.className = 'save-bar__chip-text';
    chipText.textContent = 'Sparat';
    chip.appendChild(chipText);
    left.appendChild(chip);

    const hint = document.createElement('span');
    hint.className = 'save-bar__hint';
    hint.textContent = 'Förhandsgranska sidan för att se hur ändringarna ser ut.';
    left.appendChild(hint);

    bar.appendChild(left);

    const actions = document.createElement('div');
    actions.className = 'save-bar__actions';

    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'btn btn-ghost';
    undo.textContent = 'Ångra';
    undo.addEventListener('click', function() {
      if (scope === 'event') renderEventForm();
    });
    actions.appendChild(undo);

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'btn btn--primary';
    save.textContent = saveLabel || 'Spara';
    save.addEventListener('click', function() {
      const form = document.getElementById(scope + '-form');
      if (form) form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    });
    actions.appendChild(save);

    bar.appendChild(actions);
    return bar;
  }

  function updateSaveBar() {
    document.querySelectorAll('.save-bar').forEach(function(bar) {
      const scope = bar.dataset.scope;
      const isDirty = !!(state.unsavedChanges && state.unsavedChanges[scope]);
      bar.classList.toggle('is-clean', !isDirty);
      const text = bar.querySelector('.save-bar__chip-text');
      if (text) text.textContent = isDirty ? 'Osparade ändringar' : 'Sparat';
    });
  }

  function collectEventForm() {
    const out = {};
    SETTINGS_FIELDS.forEach(function(field) {
      const el = document.getElementById('set-' + field.key);
      if (!el) return;
      if (field.type === 'boolean') {
        out[field.key] = !!el.checked;
      } else if (field.type === 'number') {
        const v = el.value;
        out[field.key] = (v === '' || v == null) ? '' : Number(v);
      } else {
        out[field.key] = el.value;
      }
    });
    return out;
  }

  async function handleEventSave(e) {
    e.preventDefault();
    const settings = collectEventForm();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.dataset.originalText = submitBtn.textContent;
      submitBtn.textContent = 'Sparar…';
    }
    try {
      await runServer('saveSettings', state.token, settings);
      state.data.settings = settings;
      state.unsavedChanges.event = false;
      updateSaveBar();
      updateLastSaved();
      showSavedMsg('event-saved-msg');
      renderOverview();
      toast('Inställningarna är sparade. Syns publikt inom 5 minuter.', 'success');
    } catch (err) {
      if (isAuthError(err)) { await handleAuthError(); return; }
      toast('Kunde inte spara. Försök igen.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.originalText || 'Spara ändringar';
      }
    }
  }

  // ============================================================
  // FORMULÄRFRÅGOR
  // ============================================================

  function renderQuestionsList() {
    const list = document.getElementById('questions-list');
    if (!list) return;
    list.innerHTML = '';

    const questions = ((state.data && state.data.questions) || []).slice().sort(function(a, b) {
      return (a.order || 0) - (b.order || 0);
    });

    if (questions.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty-state';
      empty.textContent = 'Inga frågor än. Klicka på "+ Ny fråga" för att lägga till.';
      list.appendChild(empty);
      return;
    }

    questions.forEach(function(q, idx) {
      list.appendChild(buildQuestionItem(q, idx, questions.length));
    });
  }

  function buildQuestionItem(q, idx, total) {
    const li = document.createElement('li');
    li.className = 'question-item';
    li.draggable = true;
    li.dataset.fieldId = q.fieldId || '';

    // Header: drag-handle + flytta-knappar + ta bort
    const header = document.createElement('div');
    header.className = 'question-item__header';

    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.setAttribute('aria-hidden', 'true');
    handle.textContent = '⋮⋮';
    handle.title = 'Dra för att ändra ordning';
    header.appendChild(handle);

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'btn btn--small btn--ghost';
    upBtn.textContent = 'Flytta upp';
    upBtn.disabled = idx === 0;
    upBtn.addEventListener('click', function() { moveQuestion(idx, idx - 1); });
    header.appendChild(upBtn);

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'btn btn--small btn--ghost';
    downBtn.textContent = 'Flytta ned';
    downBtn.disabled = idx === total - 1;
    downBtn.addEventListener('click', function() { moveQuestion(idx, idx + 1); });
    header.appendChild(downBtn);

    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'btn btn--small btn--ghost';
    previewBtn.textContent = 'Förhandsgranska';
    previewBtn.addEventListener('click', function() { previewQuestion(q); });
    header.appendChild(previewBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn--small btn--danger';
    delBtn.textContent = 'Ta bort';
    delBtn.addEventListener('click', function() { handleDeleteQuestion(idx); });
    header.appendChild(delBtn);

    li.appendChild(header);

    // Field ID (read-only chip)
    const fieldIdRow = document.createElement('div');
    fieldIdRow.className = 'form-row';
    const fieldIdLabel = document.createElement('label');
    fieldIdLabel.textContent = 'Fält-ID (teknisk identifierare)';
    const fieldIdChip = document.createElement('input');
    fieldIdChip.type = 'text';
    fieldIdChip.className = 'field-chip';
    fieldIdChip.value = q.fieldId || '';
    fieldIdChip.dataset.questionField = 'fieldId';
    fieldIdChip.addEventListener('input', function() {
      q.fieldId = fieldIdChip.value;
      state.unsavedChanges.questions = true;
    });
    const fieldIdHelp = document.createElement('p');
    fieldIdHelp.className = 'help';
    fieldIdHelp.textContent = 'Ändra inte detta om du inte vet vad du gör. Används för att matcha fält i Anmälningar-fliken.';
    fieldIdRow.appendChild(fieldIdLabel);
    fieldIdRow.appendChild(fieldIdChip);
    fieldIdRow.appendChild(fieldIdHelp);
    li.appendChild(fieldIdRow);

    // Label
    li.appendChild(buildTextInputRow('Etikett (visas för besökaren)', q.label || '', function(v) {
      q.label = v;
      state.unsavedChanges.questions = true;
    }));

    // Helper text
    li.appendChild(buildTextInputRow('Hjälptext (visas under fältet)', q.helperText || '', function(v) {
      q.helperText = v;
      state.unsavedChanges.questions = true;
    }));

    // Placeholder
    li.appendChild(buildTextInputRow('Platshållare (grå text inuti fältet)', q.placeholder || '', function(v) {
      q.placeholder = v;
      state.unsavedChanges.questions = true;
    }));

    // Type
    const typeRow = document.createElement('div');
    typeRow.className = 'form-row';
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Typ av fält';
    const typeSelect = document.createElement('select');
    QUESTION_TYPES.forEach(function(t) {
      const opt = document.createElement('option');
      opt.value = t.value;
      opt.textContent = t.label;
      if ((q.type || 'text') === t.value) opt.selected = true;
      typeSelect.appendChild(opt);
    });
    typeRow.appendChild(typeLabel);
    typeRow.appendChild(typeSelect);
    li.appendChild(typeRow);

    // Options (bara för select)
    const optionsRow = document.createElement('div');
    optionsRow.className = 'form-row';
    const optionsLabel = document.createElement('label');
    optionsLabel.textContent = 'Alternativ (kommaseparerade)';
    const optionsInput = document.createElement('input');
    optionsInput.type = 'text';
    optionsInput.value = q.options || '';
    optionsInput.placeholder = 'T.ex. Ja, Nej, Kanske';
    optionsInput.addEventListener('input', function() {
      q.options = optionsInput.value;
      state.unsavedChanges.questions = true;
    });
    optionsRow.appendChild(optionsLabel);
    optionsRow.appendChild(optionsInput);
    optionsRow.hidden = (q.type || 'text') !== 'select';
    li.appendChild(optionsRow);

    typeSelect.addEventListener('change', function() {
      q.type = typeSelect.value;
      optionsRow.hidden = q.type !== 'select';
      state.unsavedChanges.questions = true;
    });

    // Toggles: Required, Active
    const toggleRow = document.createElement('div');
    toggleRow.className = 'form-row form-row--toggles';

    toggleRow.appendChild(buildToggle('Obligatorisk', !!q.required, function(checked) {
      q.required = checked;
      state.unsavedChanges.questions = true;
    }));

    toggleRow.appendChild(buildToggle('Aktiv (visas i formuläret)', q.active !== false, function(checked) {
      q.active = checked;
      state.unsavedChanges.questions = true;
    }));

    li.appendChild(toggleRow);

    // Drag and drop
    li.addEventListener('dragstart', function(e) {
      li.classList.add('is-dragging');
      try { e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
      try { e.dataTransfer.setData('text/plain', String(idx)); } catch (_) {}
    });
    li.addEventListener('dragend', function() {
      li.classList.remove('is-dragging');
    });
    li.addEventListener('dragover', function(e) {
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
      li.classList.add('is-drop-target');
    });
    li.addEventListener('dragleave', function() {
      li.classList.remove('is-drop-target');
    });
    li.addEventListener('drop', function(e) {
      e.preventDefault();
      li.classList.remove('is-drop-target');
      let fromIdx = -1;
      try { fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10); } catch (_) {}
      if (isNaN(fromIdx)) return;
      moveQuestion(fromIdx, idx);
    });

    return li;
  }

  function buildTextInputRow(labelText, value, onChange) {
    const row = document.createElement('div');
    row.className = 'form-row';
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = value || '';
    input.addEventListener('input', function() { onChange(input.value); });
    row.appendChild(label);
    row.appendChild(input);
    return row;
  }

  function buildToggle(labelText, initial, onChange) {
    const wrap = document.createElement('label');
    wrap.className = 'toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!initial;
    const track = document.createElement('span');
    track.className = 'toggle__track';
    const thumb = document.createElement('span');
    thumb.className = 'toggle__thumb';
    track.appendChild(thumb);
    const labelEl = document.createElement('span');
    labelEl.className = 'toggle__label';
    labelEl.textContent = labelText;
    input.addEventListener('change', function() { onChange(input.checked); });
    wrap.appendChild(input);
    wrap.appendChild(track);
    wrap.appendChild(labelEl);
    return wrap;
  }

  function moveQuestion(fromIdx, toIdx) {
    if (!state.data || !state.data.questions) return;
    const arr = state.data.questions;
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= arr.length || toIdx >= arr.length || fromIdx === toIdx) return;
    const item = arr.splice(fromIdx, 1)[0];
    arr.splice(toIdx, 0, item);
    arr.forEach(function(q, i) { q.order = i + 1; });
    state.unsavedChanges.questions = true;
    renderQuestionsList();
  }

  function handleAddQuestion() {
    if (!state.data) return;
    if (!state.data.questions) state.data.questions = [];
    const ts = Date.now().toString(36);
    state.data.questions.push({
      order: state.data.questions.length + 1,
      fieldId: 'field_' + ts,
      label: 'Ny fråga',
      helperText: '',
      placeholder: '',
      type: 'text',
      required: false,
      active: true,
      options: ''
    });
    state.unsavedChanges.questions = true;
    renderQuestionsList();
    // Scrolla ner
    try {
      const list = document.getElementById('questions-list');
      if (list && list.lastElementChild) list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) {}
  }

  async function handleDeleteQuestion(idx) {
    if (!state.data || !state.data.questions) return;
    const q = state.data.questions[idx];
    if (!q) return;
    const ok = await confirmDialog(
      'Vill du verkligen ta bort frågan "' + (q.label || q.fieldId || 'Namnlös') + '"? Det går inte att ångra utan att spara om.',
      'Ta bort',
      true
    );
    if (!ok) return;
    state.data.questions.splice(idx, 1);
    state.data.questions.forEach(function(qq, i) { qq.order = i + 1; });
    state.unsavedChanges.questions = true;
    renderQuestionsList();
  }

  function previewQuestion(q) {
    let dlg = document.getElementById('preview-question-dialog');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'preview-question-dialog';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'dialog__close';
      closeBtn.setAttribute('aria-label', 'Stäng');
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', function() { if (dlg.open) dlg.close(); });
      dlg.appendChild(closeBtn);
      const content = document.createElement('div');
      content.className = 'preview-content';
      dlg.appendChild(content);
      document.body.appendChild(dlg);
    }
    const content = dlg.querySelector('.preview-content');
    content.innerHTML = '';

    const heading = document.createElement('h3');
    heading.textContent = 'Förhandsgranskning';
    content.appendChild(heading);

    const labelEl = document.createElement('label');
    labelEl.textContent = (q.label || 'Namnlös fråga') + (q.required ? ' *' : '');
    content.appendChild(labelEl);

    let field;
    const t = q.type || 'text';
    if (t === 'textarea') {
      field = document.createElement('textarea');
      field.rows = 4;
    } else if (t === 'checkbox') {
      const cbWrap = document.createElement('label');
      cbWrap.className = 'checkbox';
      field = document.createElement('input');
      field.type = 'checkbox';
      cbWrap.appendChild(field);
      const cbText = document.createElement('span');
      cbText.textContent = q.label || '';
      cbWrap.appendChild(cbText);
      content.appendChild(cbWrap);
    } else if (t === 'select') {
      field = document.createElement('select');
      const placeholderOpt = document.createElement('option');
      placeholderOpt.value = '';
      placeholderOpt.textContent = q.placeholder || 'Välj…';
      field.appendChild(placeholderOpt);
      (q.options || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean).forEach(function(o) {
        const opt = document.createElement('option');
        opt.value = o;
        opt.textContent = o;
        field.appendChild(opt);
      });
    } else {
      field = document.createElement('input');
      field.type = t;
    }
    if (field && t !== 'checkbox') {
      if (q.placeholder) field.placeholder = q.placeholder;
      content.appendChild(field);
    }

    if (q.helperText) {
      const help = document.createElement('p');
      help.className = 'help';
      help.textContent = q.helperText;
      content.appendChild(help);
    }

    const closeRow = document.createElement('div');
    closeRow.className = 'dialog__actions';
    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'btn';
    okBtn.textContent = 'Stäng';
    okBtn.addEventListener('click', function() { if (dlg.open) dlg.close(); });
    closeRow.appendChild(okBtn);
    content.appendChild(closeRow);

    try { dlg.showModal(); } catch (_) { dlg.setAttribute('open', ''); }
  }

  async function handleQuestionsSave() {
    if (!state.data || !state.data.questions) return;

    // Validering: alla fieldId unika, inga tomma labels
    const ids = {};
    let hasError = false;
    let errorMsg = '';
    state.data.questions.forEach(function(q, i) {
      const id = (q.fieldId || '').trim();
      const label = (q.label || '').trim();
      if (!id) { hasError = true; errorMsg = 'Fråga ' + (i + 1) + ' saknar fält-ID.'; }
      else if (ids[id]) { hasError = true; errorMsg = 'Fält-ID "' + id + '" används flera gånger. Varje fält måste ha ett unikt ID.'; }
      else { ids[id] = true; }
      if (!label) { hasError = true; errorMsg = 'Fråga ' + (i + 1) + ' saknar etikett.'; }
    });

    if (hasError) {
      toast(errorMsg, 'error');
      return;
    }

    // Sätt korrekt order
    state.data.questions.forEach(function(q, i) { q.order = i + 1; });

    const btn = document.getElementById('save-questions-btn');
    if (btn) {
      btn.disabled = true;
      btn.dataset.originalText = btn.textContent;
      btn.textContent = 'Sparar…';
    }

    try {
      await runServer('saveFormQuestions', state.token, state.data.questions);
      state.unsavedChanges.questions = false;
      showSavedMsg('questions-saved-msg');
      toast('Frågorna är sparade. Syns publikt inom 5 minuter.', 'success');
    } catch (err) {
      if (isAuthError(err)) { await handleAuthError(); return; }
      toast('Kunde inte spara frågorna. Försök igen.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText || 'Spara ändringar';
      }
    }
  }

  // ============================================================
  // ANMÄLNINGAR
  // ============================================================

  function renderSubmissionsTable() {
    const tbody = document.getElementById('submissions-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const subs = ((state.data && state.data.submissions) || []).slice();
    // Sortera nyaste först
    subs.sort(function(a, b) {
      const ta = parseTimestamp(a.timestamp);
      const tb = parseTimestamp(b.timestamp);
      return tb - ta;
    });

    // Uppdatera filter-tab-räknare
    updateFilterTabCounts(subs);
    // Uppdatera page-header subtitle
    const sub = document.getElementById('submissions-subtitle');
    if (sub) {
      const total = subs.length;
      sub.textContent = total + (total === 1 ? ' anmälan' : ' anmälningar') +
        ' totalt. Klicka på en rad för att se hela formuläret och uppdatera status.';
    }

    const filtered = subs.filter(function(s) {
      const status = (s.status || '').toLowerCase();
      if (state.submissionsFilter.status !== 'all' && status !== state.submissionsFilter.status) return false;
      const q = (state.submissionsFilter.search || '').trim().toLowerCase();
      if (!q) return true;
      const hay = ((s.name || '') + ' ' + (s.company || '') + ' ' + (s.email || '') + ' ' + (s.phone || '')).toLowerCase();
      return hay.indexOf(q) !== -1;
    });

    if (filtered.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7;
      td.className = 'empty-state';
      td.textContent = subs.length === 0
        ? 'Inga anmälningar än.'
        : 'Inga anmälningar matchar dina filter.';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    filtered.forEach(function(s) {
      const tr = document.createElement('tr');

      const dateTd = document.createElement('td');
      dateTd.dataset.label = 'Datum';
      dateTd.textContent = formatDateTime(s.timestamp);
      tr.appendChild(dateTd);

      const nameTd = document.createElement('td');
      nameTd.dataset.label = 'Namn';
      nameTd.textContent = s.name || '–';
      tr.appendChild(nameTd);

      const compTd = document.createElement('td');
      compTd.dataset.label = 'Företag';
      compTd.textContent = s.company || '–';
      tr.appendChild(compTd);

      const emailTd = document.createElement('td');
      emailTd.dataset.label = 'E-post';
      emailTd.textContent = s.email || '–';
      tr.appendChild(emailTd);

      const phoneTd = document.createElement('td');
      phoneTd.dataset.label = 'Telefon';
      phoneTd.textContent = s.phone || '–';
      tr.appendChild(phoneTd);

      const statusTd = document.createElement('td');
      statusTd.dataset.label = 'Status';
      statusTd.appendChild(buildStatusChip(s.status || 'new'));
      tr.appendChild(statusTd);

      const actTd = document.createElement('td');
      actTd.dataset.label = '';
      const viewBtn = document.createElement('button');
      viewBtn.type = 'button';
      viewBtn.className = 'btn btn--small';
      viewBtn.textContent = 'Öppna anmälan';
      viewBtn.addEventListener('click', function() { openSubmissionDetail(s.id); });
      actTd.appendChild(viewBtn);
      tr.appendChild(actTd);

      tbody.appendChild(tr);
    });
  }

  function updateFilterTabCounts(subs) {
    const counts = { all: subs.length, new: 0, reviewed: 0, approved: 0, rejected: 0, contacted: 0 };
    subs.forEach(function(s) {
      const status = (s.status || 'new').toLowerCase();
      if (counts.hasOwnProperty(status)) counts[status]++;
    });
    Object.keys(counts).forEach(function(key) {
      const el = document.querySelector('.filter-tab__count[data-count="' + key + '"]');
      if (el) el.textContent = String(counts[key]);
    });
  }

  function buildStatusChip(status) {
    const chip = document.createElement('span');
    const s = (status || 'new').toLowerCase();
    chip.className = 'status-badge status-badge--' + s;
    chip.textContent = STATUS_LABELS[s] || s;
    return chip;
  }

  function findSubmission(id) {
    return ((state.data && state.data.submissions) || []).filter(function(s) { return s.id === id; })[0];
  }

  function openSubmissionDetail(id) {
    const sub = findSubmission(id);
    if (!sub) return;

    const dlg = document.getElementById('submission-detail');
    if (!dlg) return;
    state.currentSubmissionId = id;

    const content = document.getElementById('submission-detail-content');
    if (!content) return;
    content.innerHTML = '';

    const h = document.createElement('h3');
    h.textContent = 'Anmälan från ' + (sub.name || '–');
    content.appendChild(h);

    const meta = document.createElement('p');
    meta.className = 'help';
    meta.textContent = 'Inkommen: ' + formatDateTime(sub.timestamp);
    content.appendChild(meta);

    // Parsa Data JSON
    let dataObj = null;
    if (sub.dataJson) {
      try { dataObj = typeof sub.dataJson === 'string' ? JSON.parse(sub.dataJson) : sub.dataJson; }
      catch (_) { dataObj = null; }
    }
    if (!dataObj && sub.data) dataObj = sub.data;

    const fieldsList = document.createElement('dl');
    fieldsList.className = 'submission-fields';
    addDt(fieldsList, 'Namn', sub.name);
    addDt(fieldsList, 'Företag', sub.company);
    addDt(fieldsList, 'E-post', sub.email);
    addDt(fieldsList, 'Telefon', sub.phone);
    if (dataObj && typeof dataObj === 'object') {
      Object.keys(dataObj).forEach(function(key) {
        if (['name', 'company', 'email', 'phone'].indexOf(key) !== -1) return;
        if (key === 'kontakttid') return; // honeypot, intressant bara om det är ifyllt
        const val = dataObj[key];
        if (val == null || val === '') return;
        const labelOut = labelForFieldId(key);
        addDt(fieldsList, labelOut, formatFieldValue(val));
      });
      if (dataObj.kontakttid) {
        addDt(fieldsList, 'Honeypot (spam-flagga)', String(dataObj.kontakttid));
      }
    }
    content.appendChild(fieldsList);

    // Status-dropdown
    const statusRow = document.createElement('div');
    statusRow.className = 'form-row';
    const statusLabel = document.createElement('label');
    statusLabel.setAttribute('for', 'submission-status');
    statusLabel.textContent = 'Status';
    const statusSelect = document.createElement('select');
    statusSelect.id = 'submission-status';
    Object.keys(STATUS_LABELS).forEach(function(key) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = STATUS_LABELS[key];
      if ((sub.status || 'new').toLowerCase() === key) opt.selected = true;
      statusSelect.appendChild(opt);
    });
    statusRow.appendChild(statusLabel);
    statusRow.appendChild(statusSelect);
    content.appendChild(statusRow);

    // Notes
    const notesRow = document.createElement('div');
    notesRow.className = 'form-row';
    const notesLabel = document.createElement('label');
    notesLabel.setAttribute('for', 'submission-notes');
    notesLabel.textContent = 'Interna anteckningar';
    const notesArea = document.createElement('textarea');
    notesArea.id = 'submission-notes';
    notesArea.rows = 4;
    notesArea.value = sub.internalNotes || sub.notes || '';
    notesRow.appendChild(notesLabel);
    notesRow.appendChild(notesArea);
    content.appendChild(notesRow);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'dialog__actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn--primary';
    saveBtn.textContent = 'Spara ändringar';
    saveBtn.addEventListener('click', async function() {
      await handleSubmissionSave(id, statusSelect.value, notesArea.value, saveBtn);
    });
    actions.appendChild(saveBtn);

    // Skapa-utställare-knapp om approved
    const wasOriginallyApproved = (sub.status || '').toLowerCase() === 'approved';
    const createExhBtn = document.createElement('button');
    createExhBtn.type = 'button';
    createExhBtn.className = 'btn';
    createExhBtn.textContent = 'Skapa utställare från denna anmälan';
    createExhBtn.hidden = !wasOriginallyApproved;
    createExhBtn.addEventListener('click', function() { handleCreateExhibitor(id); });
    actions.appendChild(createExhBtn);

    statusSelect.addEventListener('change', function() {
      const isApproved = statusSelect.value === 'approved';
      // Om man precis byter till approved → erbjud även här
      createExhBtn.hidden = !isApproved;
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn--ghost';
    closeBtn.textContent = 'Stäng';
    closeBtn.addEventListener('click', function() { if (dlg.open) dlg.close(); });
    actions.appendChild(closeBtn);

    content.appendChild(actions);

    try { dlg.showModal(); } catch (_) { dlg.setAttribute('open', ''); }
  }

  function addDt(dl, label, value) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = (value == null || value === '') ? '–' : String(value);
    dl.appendChild(dt);
    dl.appendChild(dd);
  }

  function labelForFieldId(fieldId) {
    const questions = (state.data && state.data.questions) || [];
    for (let i = 0; i < questions.length; i++) {
      if (questions[i].fieldId === fieldId) return questions[i].label || fieldId;
    }
    return fieldId;
  }

  function formatFieldValue(val) {
    if (val === true) return 'Ja';
    if (val === false) return 'Nej';
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  }

  async function handleSubmissionSave(id, status, notes, btn) {
    const sub = findSubmission(id);
    if (!sub) return;

    const wasApproved = (sub.status || '').toLowerCase() === 'approved';
    const isRejected = status === 'rejected';

    // Bekräfta destruktiva statusändringar
    if (isRejected && (sub.status || '').toLowerCase() !== 'rejected') {
      const ok = await confirmDialog(
        'Vill du verkligen neka denna anmälan? Anmälaren kommer inte att informeras automatiskt.',
        'Neka anmälan',
        true
      );
      if (!ok) return;
    }
    if (wasApproved && status !== 'approved') {
      const ok = await confirmDialog(
        'Den här anmälan är redan godkänd. Vill du ändra status?',
        'Ändra status',
        false
      );
      if (!ok) return;
    }

    if (btn) {
      btn.disabled = true;
      btn.dataset.originalText = btn.textContent;
      btn.textContent = 'Sparar…';
    }

    try {
      await runServer('updateSubmissionStatus', state.token, id, status, notes);
      sub.status = status;
      sub.internalNotes = notes;
      showSavedMsg(null);
      toast('Anmälan är uppdaterad.', 'success');
      renderSubmissionsTable();
      renderOverview();
    } catch (err) {
      if (isAuthError(err)) { await handleAuthError(); return; }
      toast('Kunde inte spara anmälan. Försök igen.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText || 'Spara ändringar';
      }
    }
  }

  async function handleCreateExhibitor(id) {
    const sub = findSubmission(id);
    if (!sub) return;

    const ok = await confirmDialog(
      'Vill du skapa en utställare från denna anmälan? Utställaren skapas som opublicerad så att du kan granska innan den syns publikt.',
      'Skapa utställare',
      false
    );
    if (!ok) return;

    showLoadingOverlay();
    try {
      const additional = {
        name: sub.name || '',
        company: sub.company || '',
        description: '',
        category: '',
        instagram: '',
        website: '',
        published: false
      };
      // Försök hämta extra fält ur Data JSON
      try {
        const dj = sub.dataJson ? (typeof sub.dataJson === 'string' ? JSON.parse(sub.dataJson) : sub.dataJson) : null;
        if (dj) {
          if (dj.offering && !additional.description) additional.description = String(dj.offering);
          if (dj.websiteSocials && !additional.website) additional.website = String(dj.websiteSocials);
        }
      } catch (_) {}

      await runServer('createExhibitorFromSubmission', state.token, id, additional);

      const dlg = document.getElementById('submission-detail');
      if (dlg && dlg.open) dlg.close();

      toast('Utställare skapad. Granska och publicera i fliken Utställare.', 'success');
      // Reload data så utställarlistan är uppdaterad
      await loadData();
      activateTab('exhibitors');
    } catch (err) {
      if (isAuthError(err)) { await handleAuthError(); return; }
      toast('Kunde inte skapa utställare. Försök igen.', 'error');
    } finally {
      hideLoadingOverlay();
    }
  }

  async function handleExportCsv() {
    showLoadingOverlay();
    try {
      const csv = await runServer('exportSubmissionsCsv', state.token);
      if (!csv) {
        toast('Inget att exportera.', 'info');
        return;
      }
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'anmalningar-' + dateStampForFile() + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { try { URL.revokeObjectURL(url); } catch (_) {} }, 1000);
      toast('Exporten är klar.', 'success');
    } catch (err) {
      if (isAuthError(err)) { await handleAuthError(); return; }
      toast('Kunde inte exportera. Försök igen.', 'error');
    } finally {
      hideLoadingOverlay();
    }
  }

  // ============================================================
  // UTSTÄLLARE
  // ============================================================

  function renderExhibitorsList() {
    const list = document.getElementById('exhibitors-list');
    if (!list) return;
    list.innerHTML = '';

    if (!state.data) return;
    if (!state.data.exhibitors) state.data.exhibitors = [];
    const exhibitors = state.data.exhibitors.slice().sort(function(a, b) {
      return (a.order || 0) - (b.order || 0);
    });

    if (exhibitors.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty-state';
      empty.textContent = 'Inga utställare än. Lägg till manuellt eller från en godkänd anmälan.';
      list.appendChild(empty);
      return;
    }

    exhibitors.forEach(function(x, idx) {
      list.appendChild(buildExhibitorItem(x, idx, exhibitors.length));
    });
  }

  function buildExhibitorItem(x, idx, total) {
    const li = document.createElement('li');
    li.className = 'exhibitor-item';

    // Header
    const header = document.createElement('div');
    header.className = 'exhibitor-item__header';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'btn btn--small btn--ghost';
    upBtn.textContent = 'Flytta upp';
    upBtn.disabled = idx === 0;
    upBtn.addEventListener('click', function() { moveExhibitor(idx, idx - 1); });
    header.appendChild(upBtn);

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'btn btn--small btn--ghost';
    downBtn.textContent = 'Flytta ned';
    downBtn.disabled = idx === total - 1;
    downBtn.addEventListener('click', function() { moveExhibitor(idx, idx + 1); });
    header.appendChild(downBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn--small btn--danger';
    delBtn.textContent = 'Ta bort';
    delBtn.addEventListener('click', function() { handleDeleteExhibitor(idx); });
    header.appendChild(delBtn);

    li.appendChild(header);

    // Name
    li.appendChild(buildTextInputRow('Namn', x.name || '', function(v) {
      x.name = v;
      state.unsavedChanges.exhibitors = true;
    }));

    // Company
    li.appendChild(buildTextInputRow('Företag', x.company || '', function(v) {
      x.company = v;
      state.unsavedChanges.exhibitors = true;
    }));

    // Description (textarea)
    const descRow = document.createElement('div');
    descRow.className = 'form-row';
    const descLabel = document.createElement('label');
    descLabel.textContent = 'Beskrivning';
    const descArea = document.createElement('textarea');
    descArea.rows = 3;
    descArea.value = x.description || '';
    descArea.addEventListener('input', function() {
      x.description = descArea.value;
      state.unsavedChanges.exhibitors = true;
    });
    descRow.appendChild(descLabel);
    descRow.appendChild(descArea);
    li.appendChild(descRow);

    // Category
    li.appendChild(buildTextInputRow('Kategori', x.category || '', function(v) {
      x.category = v;
      state.unsavedChanges.exhibitors = true;
    }));

    // Instagram
    li.appendChild(buildTextInputRow('Instagram', x.instagram || '', function(v) {
      x.instagram = v;
      state.unsavedChanges.exhibitors = true;
    }));

    // Website
    li.appendChild(buildTextInputRow('Hemsida', x.website || '', function(v) {
      x.website = v;
      state.unsavedChanges.exhibitors = true;
    }));

    // Order
    const orderRow = document.createElement('div');
    orderRow.className = 'form-row';
    const orderLabel = document.createElement('label');
    orderLabel.textContent = 'Ordning';
    const orderInput = document.createElement('input');
    orderInput.type = 'number';
    orderInput.value = x.order != null ? x.order : (idx + 1);
    orderInput.addEventListener('input', function() {
      x.order = orderInput.value === '' ? null : Number(orderInput.value);
      state.unsavedChanges.exhibitors = true;
    });
    orderRow.appendChild(orderLabel);
    orderRow.appendChild(orderInput);
    li.appendChild(orderRow);

    // Published
    const togglesRow = document.createElement('div');
    togglesRow.className = 'form-row form-row--toggles';
    togglesRow.appendChild(buildToggle('Publicerad (synlig på publika sidan)', !!x.published, function(checked) {
      x.published = checked;
      state.unsavedChanges.exhibitors = true;
    }));
    li.appendChild(togglesRow);

    return li;
  }

  function moveExhibitor(fromIdx, toIdx) {
    if (!state.data || !state.data.exhibitors) return;
    const arr = state.data.exhibitors;
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= arr.length || toIdx >= arr.length || fromIdx === toIdx) return;
    const item = arr.splice(fromIdx, 1)[0];
    arr.splice(toIdx, 0, item);
    arr.forEach(function(x, i) { x.order = i + 1; });
    state.unsavedChanges.exhibitors = true;
    renderExhibitorsList();
  }

  function handleAddExhibitor() {
    if (!state.data) return;
    if (!state.data.exhibitors) state.data.exhibitors = [];
    state.data.exhibitors.push({
      order: state.data.exhibitors.length + 1,
      name: '',
      company: '',
      description: '',
      category: '',
      instagram: '',
      website: '',
      published: false
    });
    state.unsavedChanges.exhibitors = true;
    renderExhibitorsList();
    try {
      const list = document.getElementById('exhibitors-list');
      if (list && list.lastElementChild) list.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) {}
  }

  async function handleDeleteExhibitor(idx) {
    if (!state.data || !state.data.exhibitors) return;
    const x = state.data.exhibitors[idx];
    if (!x) return;
    const ok = await confirmDialog(
      'Vill du verkligen ta bort utställaren "' + (x.name || x.company || 'Namnlös') + '"? Det går inte att ångra utan att spara om.',
      'Ta bort',
      true
    );
    if (!ok) return;
    state.data.exhibitors.splice(idx, 1);
    state.data.exhibitors.forEach(function(xx, i) { xx.order = i + 1; });
    state.unsavedChanges.exhibitors = true;
    renderExhibitorsList();
  }

  async function handleExhibitorsSave() {
    if (!state.data || !state.data.exhibitors) return;
    state.data.exhibitors.forEach(function(x, i) {
      if (!x.order) x.order = i + 1;
    });

    const btn = document.getElementById('save-exhibitors-btn');
    if (btn) {
      btn.disabled = true;
      btn.dataset.originalText = btn.textContent;
      btn.textContent = 'Sparar…';
    }

    try {
      await runServer('saveExhibitors', state.token, state.data.exhibitors);
      state.unsavedChanges.exhibitors = false;
      showSavedMsg('exhibitors-saved-msg');
      try { state.overview = await runServer('getOverview', state.token); } catch (_) {}
      renderOverview();
      toast('Utställarna är sparade. Syns publikt inom 5 minuter.', 'success');
    } catch (err) {
      if (isAuthError(err)) { await handleAuthError(); return; }
      toast('Kunde inte spara. Försök igen.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText || 'Spara ändringar';
      }
    }
  }

  // ============================================================
  // SOCIALA MEDIER
  // ============================================================

  function renderSocialList() {
    const list = document.getElementById('social-list');
    if (!list) return;
    list.innerHTML = '';

    if (!state.data) return;
    if (!state.data.socialLinks) state.data.socialLinks = [];
    const links = state.data.socialLinks.slice().sort(function(a, b) {
      return (a.order || 0) - (b.order || 0);
    });

    if (links.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty-state';
      empty.textContent = 'Inga länkar än. Lägg till en med "+ Lägg till länk".';
      list.appendChild(empty);
      return;
    }

    links.forEach(function(l, idx) {
      list.appendChild(buildSocialItem(l, idx, links.length));
    });
  }

  function buildSocialItem(l, idx, total) {
    const li = document.createElement('li');
    li.className = 'social-item';

    const header = document.createElement('div');
    header.className = 'social-item__header';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'btn btn--small btn--ghost';
    upBtn.textContent = 'Flytta upp';
    upBtn.disabled = idx === 0;
    upBtn.addEventListener('click', function() { moveSocial(idx, idx - 1); });
    header.appendChild(upBtn);

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'btn btn--small btn--ghost';
    downBtn.textContent = 'Flytta ned';
    downBtn.disabled = idx === total - 1;
    downBtn.addEventListener('click', function() { moveSocial(idx, idx + 1); });
    header.appendChild(downBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn--small btn--danger';
    delBtn.textContent = 'Ta bort';
    delBtn.addEventListener('click', function() { handleDeleteSocial(idx); });
    header.appendChild(delBtn);

    li.appendChild(header);

    li.appendChild(buildTextInputRow('Plattform (t.ex. Instagram, TikTok)', l.platform || '', function(v) {
      l.platform = v;
      state.unsavedChanges.social = true;
    }));

    li.appendChild(buildTextInputRow('Etikett (texten på knappen)', l.label || '', function(v) {
      l.label = v;
      state.unsavedChanges.social = true;
    }));

    li.appendChild(buildTextInputRow('URL', l.url || '', function(v) {
      l.url = v;
      state.unsavedChanges.social = true;
    }));

    const togglesRow = document.createElement('div');
    togglesRow.className = 'form-row form-row--toggles';
    togglesRow.appendChild(buildToggle('Aktiv (visas på publika sidan)', l.active !== false, function(checked) {
      l.active = checked;
      state.unsavedChanges.social = true;
    }));
    li.appendChild(togglesRow);

    return li;
  }

  function moveSocial(fromIdx, toIdx) {
    if (!state.data || !state.data.socialLinks) return;
    const arr = state.data.socialLinks;
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= arr.length || toIdx >= arr.length || fromIdx === toIdx) return;
    const item = arr.splice(fromIdx, 1)[0];
    arr.splice(toIdx, 0, item);
    arr.forEach(function(l, i) { l.order = i + 1; });
    state.unsavedChanges.social = true;
    renderSocialList();
  }

  function handleAddSocial() {
    if (!state.data) return;
    if (!state.data.socialLinks) state.data.socialLinks = [];
    state.data.socialLinks.push({
      order: state.data.socialLinks.length + 1,
      platform: '',
      label: '',
      url: '',
      active: true
    });
    state.unsavedChanges.social = true;
    renderSocialList();
  }

  async function handleDeleteSocial(idx) {
    if (!state.data || !state.data.socialLinks) return;
    const l = state.data.socialLinks[idx];
    if (!l) return;
    const ok = await confirmDialog(
      'Vill du verkligen ta bort länken "' + (l.label || l.platform || 'Namnlös') + '"?',
      'Ta bort',
      true
    );
    if (!ok) return;
    state.data.socialLinks.splice(idx, 1);
    state.data.socialLinks.forEach(function(ll, i) { ll.order = i + 1; });
    state.unsavedChanges.social = true;
    renderSocialList();
  }

  async function handleSocialSave() {
    if (!state.data || !state.data.socialLinks) return;
    state.data.socialLinks.forEach(function(l, i) {
      if (!l.order) l.order = i + 1;
    });

    const btn = document.getElementById('save-social-btn');
    if (btn) {
      btn.disabled = true;
      btn.dataset.originalText = btn.textContent;
      btn.textContent = 'Sparar…';
    }

    try {
      await runServer('saveSocialLinks', state.token, state.data.socialLinks);
      state.unsavedChanges.social = false;
      showSavedMsg('social-saved-msg');
      toast('Länkarna är sparade. Syns publikt inom 5 minuter.', 'success');
    } catch (err) {
      if (isAuthError(err)) { await handleAuthError(); return; }
      toast('Kunde inte spara. Försök igen.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText || 'Spara ändringar';
      }
    }
  }

  // ============================================================
  // SPORT-SIDOR
  // ============================================================

  function renderSportsList() {
    const wrap = document.getElementById('sports-list');
    if (!wrap) return;
    wrap.innerHTML = '';

    if (!state.data) return;
    if (!state.data.sportsPages) state.data.sportsPages = [];

    const pages = state.data.sportsPages;
    if (pages.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Inga sport-sidor konfigurerade. Kör setupSpreadsheet i Apps Script.';
      wrap.appendChild(empty);
      return;
    }

    pages.forEach(function(p) {
      wrap.appendChild(buildSportsCard(p));
    });
  }

  function buildSportsCard(p) {
    const card = document.createElement('div');
    card.className = 'sports-card';

    const slugLabel = document.createElement('p');
    slugLabel.className = 'sports-card__slug';
    const slugTxt = (p.slug === 'festival-fotboll') ? 'Fotboll'
      : (p.slug === 'festival-basket-3vs3') ? 'Basket 3 mot 3'
      : (p.slug || 'Sport');
    slugLabel.textContent = slugTxt;
    card.appendChild(slugLabel);

    const slugChip = document.createElement('span');
    slugChip.className = 'sports-card__slug-chip help';
    slugChip.textContent = 'Slug: ' + (p.slug || '');
    card.appendChild(slugChip);

    card.appendChild(buildTextInputRow('Titel', p.title || '', function(v) {
      p.title = v;
      state.unsavedChanges.sports = true;
    }));

    const descRow = document.createElement('div');
    descRow.className = 'form-row';
    const descLabel = document.createElement('label');
    descLabel.textContent = 'Beskrivning';
    const descArea = document.createElement('textarea');
    descArea.rows = 4;
    descArea.value = p.description || '';
    descArea.addEventListener('input', function() {
      p.description = descArea.value;
      state.unsavedChanges.sports = true;
    });
    descRow.appendChild(descLabel);
    descRow.appendChild(descArea);
    card.appendChild(descRow);

    const togglesRow = document.createElement('div');
    togglesRow.className = 'form-row form-row--toggles';
    togglesRow.appendChild(buildToggle('Aktiv (sidan är publicerad)', !!p.active, function(checked) {
      p.active = checked;
      state.unsavedChanges.sports = true;
    }));
    togglesRow.appendChild(buildToggle('Anmälan öppen', !!p.registrationOpen, function(checked) {
      p.registrationOpen = checked;
      state.unsavedChanges.sports = true;
    }));
    card.appendChild(togglesRow);

    return card;
  }

  async function handleSportsSave() {
    if (!state.data || !state.data.sportsPages) return;

    const btn = document.getElementById('save-sports-btn');
    if (btn) {
      btn.disabled = true;
      btn.dataset.originalText = btn.textContent;
      btn.textContent = 'Sparar…';
    }

    try {
      await runServer('saveSportsPages', state.token, state.data.sportsPages);
      state.unsavedChanges.sports = false;
      showSavedMsg('sports-saved-msg');
      toast('Sport-sidorna är sparade. Syns publikt inom 5 minuter.', 'success');
    } catch (err) {
      if (isAuthError(err)) { await handleAuthError(); return; }
      toast('Kunde inte spara. Försök igen.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset.originalText || 'Spara ändringar';
      }
    }
  }

  // ============================================================
  // HJÄLPFUNKTIONER – UI
  // ============================================================

  /**
   * Visar ett toast-meddelande som auto-stängs efter ~4 sekunder.
   * @param {string} message  Meddelandetext (svenska).
   * @param {string} [type]   'info' | 'success' | 'error'
   */
  // Banner-system: en inline-banner ovanför dashboarden istället för flytande toasts.
  // Lugnt, läsbart, syns tills användaren stänger eller en ny händelse skriver över.
  let bannerHideTimer = null;
  function toast(message, type) {
    const banner = document.getElementById('banner');
    if (!banner) return;
    const variant = type || 'info';
    banner.className = 'banner banner--' + variant;
    banner.setAttribute('role', variant === 'error' ? 'alert' : 'status');
    banner.hidden = false;

    while (banner.firstChild) banner.removeChild(banner.firstChild);
    const txt = document.createElement('span');
    txt.className = 'banner__text';
    txt.textContent = message;
    banner.appendChild(txt);

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'banner__close';
    close.setAttribute('aria-label', 'Stäng meddelande');
    close.textContent = '×';
    close.addEventListener('click', function() { hideBanner(); });
    banner.appendChild(close);

    if (bannerHideTimer) { clearTimeout(bannerHideTimer); bannerHideTimer = null; }
    // Auto-dölj success/info efter 5s. Errors stannar kvar tills användaren stänger.
    if (variant !== 'error') {
      bannerHideTimer = setTimeout(hideBanner, 5000);
    }
  }

  function hideBanner() {
    const banner = document.getElementById('banner');
    if (!banner) return;
    banner.hidden = true;
    while (banner.firstChild) banner.removeChild(banner.firstChild);
    if (bannerHideTimer) { clearTimeout(bannerHideTimer); bannerHideTimer = null; }
  }

  /**
   * Visar inline "✓ Sparat"-meddelande i 2 sekunder.
   */
  function showSavedMsg(elId) {
    if (!elId) return;
    const el = document.getElementById(elId);
    if (!el) return;
    el.hidden = false;
    el.classList.add('is-visible');
    setTimeout(function() {
      el.classList.remove('is-visible');
      el.hidden = true;
    }, 2000);
  }

  /**
   * Visar en bekräftelseruta. Returnerar Promise<boolean>.
   * @param {string} message
   * @param {string} [okText]
   * @param {boolean} [danger]
   */
  function confirmDialog(message, okText, danger) {
    return new Promise(function(resolve) {
      const dlg = document.getElementById('confirm-dialog');
      if (!dlg) {
        resolve(false);
        return;
      }
      const msgEl = document.getElementById('confirm-message');
      const okBtn = document.getElementById('confirm-ok');
      const cancelBtn = document.getElementById('confirm-cancel');
      if (msgEl) msgEl.textContent = message;
      if (okBtn) {
        okBtn.textContent = okText || 'OK';
        okBtn.classList.toggle('btn--danger', !!danger);
        okBtn.classList.toggle('btn--primary', !danger);
      }

      function cleanup() {
        if (okBtn) okBtn.removeEventListener('click', onOk);
        if (cancelBtn) cancelBtn.removeEventListener('click', onCancel);
        dlg.removeEventListener('close', onClose);
      }
      function onOk() { cleanup(); if (dlg.open) dlg.close(); resolve(true); }
      function onCancel() { cleanup(); if (dlg.open) dlg.close(); resolve(false); }
      function onClose() { cleanup(); resolve(false); }

      if (okBtn) okBtn.addEventListener('click', onOk);
      if (cancelBtn) cancelBtn.addEventListener('click', onCancel);
      dlg.addEventListener('close', onClose);

      try { dlg.showModal(); } catch (_) { dlg.setAttribute('open', ''); }
    });
  }

  function showLoadingOverlay() {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.className = 'loading-overlay';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      const spinner = document.createElement('div');
      spinner.className = 'loading-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      const txt = document.createElement('p');
      txt.className = 'loading-text';
      txt.textContent = 'Laddar…';
      overlay.appendChild(spinner);
      overlay.appendChild(txt);
      document.body.appendChild(overlay);
    }
    overlay.hidden = false;
    overlay.classList.add('is-visible');
  }

  function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    overlay.hidden = true;
  }

  function hasUnsavedChanges() {
    return Object.keys(state.unsavedChanges).some(function(k) { return !!state.unsavedChanges[k]; });
  }

  // ============================================================
  // HJÄLPFUNKTIONER – FORMATERING
  // ============================================================

  function setText(elId, text) {
    const el = document.getElementById(elId);
    if (el) el.textContent = text;
  }

  function parseTimestamp(ts) {
    if (!ts) return 0;
    if (typeof ts === 'number') return ts;
    const d = new Date(ts);
    const t = d.getTime();
    return isNaN(t) ? 0 : t;
  }

  /**
   * Formaterar en ISO-tidsstämpel som "13 jun, 14:32".
   */
  function formatDateTime(iso) {
    if (!iso) return '–';
    const d = (iso instanceof Date) ? iso : new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    const day = d.getDate();
    const month = months[d.getMonth()] || '';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return day + ' ' + month + ', ' + hours + ':' + minutes;
  }

  function dateStampForFile() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

})();

/* ============================================================
   PING BRO Invoice — shell aplikasi: login, bootstrap, router
   ============================================================ */
(function (PB) {
  'use strict';
  const $ = PB.$;

  PB.state = { user: null, settings: {}, banks: [], customers: [], products: [], today: '', methods: [], logos: { light: 'assets/logo-light.png', dark: 'assets/logo-dark.png' } };
  PB.views = PB.views || {};

  const NAV = [
    { route: 'dashboard', label: 'Dashboard', icon: 'chart' },
    { route: 'invoice/new', label: 'Buat Invoice', icon: 'edit', match: /^invoice\// },
    { route: 'history', label: 'Riwayat', icon: 'history' },
    { route: 'customers', label: 'Customer', icon: 'users' },
    { route: 'settings', label: 'Pengaturan', icon: 'settings' }
  ];

  function renderNav() {
    const html = NAV.map(function (n) {
      return '<a class="nav-item" href="#/' + n.route + '" data-route="' + n.route + '">' + PB.icon(n.icon, 20) + '<span>' + n.label + '</span></a>';
    }).join('');
    $('#nav-desktop').innerHTML = html;
    $('#nav-mobile').innerHTML = html;
    $('#btn-logout').innerHTML = PB.icon('logout', 18);
    $('#btn-logout-m').innerHTML = PB.icon('logout', 18);
  }
  function markNav(path) {
    PB.$$('.nav-item').forEach(function (a) {
      const n = NAV.filter(function (x) { return x.route === a.dataset.route; })[0];
      const on = n.match ? n.match.test(path) : path === n.route;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  // ---------- Router ----------
  let current = null;
  PB.router = function () {
    if (!PB.state.user) return;
    const path = (location.hash || '#/dashboard').replace(/^#\//, '');
    const parts = path.split('/');
    let name = parts[0], params = {};
    if (name === 'invoice') {
      name = 'editor';
      params = parts[1] === 'edit' ? { id: parts[2] } : { id: null, dupOf: null };
    }
    const view = PB.views[name];
    if (!view) { location.hash = '#/dashboard'; return; }
    if (current && current.unmount) { try { current.unmount(); } catch (e) {} }
    current = view;
    markNav(path);
    const el = $('#view');
    el.innerHTML = '';
    el.className = 'main view-' + name;
    window.scrollTo(0, 0);
    view.mount(el, params);
  };
  window.addEventListener('hashchange', function () { PB.router(); });

  // ---------- Logo ----------
  async function toDataUrl(url) {
    try {
      const r = await fetch(url); const b = await r.blob();
      return await new Promise(function (res) { const f = new FileReader(); f.onload = function () { res(String(f.result)); }; f.onerror = function () { res(url); }; f.readAsDataURL(b); });
    } catch (e) { return url; }
  }
  PB.loadLogos = async function () {
    const s = PB.state.settings;
    const out = { light: null, dark: null };
    for (const v of ['light', 'dark']) {
      if (s['has_logo_' + v]) {
        try { out[v] = (await PB.api.call('file.get', { type: 'logo', id: v })).data_url; } catch (e) {}
      }
      if (!out[v]) out[v] = await toDataUrl('assets/logo-' + v + '.png');
    }
    PB.state.logos = out;
    PB.$$('.side-brand img,.topbar img').forEach(function (i) { i.src = out.dark; });
  };

  // ---------- Bootstrap & login ----------
  function showLogin(msg, isErr) {
    $('#app').classList.add('hidden');
    $('#login').classList.remove('hidden');
    const m = $('#login-msg');
    m.textContent = msg || '';
    m.className = 'login-msg' + (msg ? (isErr ? ' err' : ' info') : '');
    setupGsi();
  }

  let gsiInit = false;
  function setupGsi() {
    const cfg = window.PB_CONFIG || {};
    const box = $('#gsi-btn');
    if (!window.google || !google.accounts || !google.accounts.id) { box.innerHTML = '<div class="muted small">Memuat tombol Google…</div>'; return; }
    if (!cfg.GOOGLE_CLIENT_ID || /GANTI_DENGAN/.test(cfg.GOOGLE_CLIENT_ID)) {
      box.innerHTML = '<div class="login-msg err">GOOGLE_CLIENT_ID belum diisi di js/config.js</div>'; return;
    }
    if (!gsiInit) {
      google.accounts.id.initialize({ client_id: cfg.GOOGLE_CLIENT_ID, callback: onCredential, auto_select: false, cancel_on_tap_outside: true });
      gsiInit = true;
    }
    box.innerHTML = '';
    google.accounts.id.renderButton(box, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', locale: 'id', width: 280 });
  }
  PB.gsiReady = function () { if (!$('#login').classList.contains('hidden')) setupGsi(); };

  async function onCredential(resp) {
    if (!resp || !resp.credential) return;
    PB.api.setToken(resp.credential);
    $('#login-msg').className = 'login-msg info'; $('#login-msg').textContent = 'Memverifikasi akun…';
    await start();
  }

  PB.onUnauthorized = function (err) {
    PB.state.user = null;
    showLogin(err && err.message ? err.message : 'Sesi berakhir. Silakan masuk lagi.', true);
  };

  async function start() {
    try {
      const b = await PB.api.call('app.bootstrap');
      const st = PB.state;
      st.user = b.user; st.settings = b.settings; st.banks = b.banks; st.customers = b.customers;
      st.products = b.products; st.today = b.today; st.methods = b.payment_methods || ['Transfer', 'Tunai', 'QRIS', 'Lainnya'];
      $('#login').classList.add('hidden');
      $('#app').classList.remove('hidden');
      $('#user-email').textContent = b.user.email;
      $('#user-av').textContent = (b.user.email || 'P').charAt(0).toUpperCase();
      if (!location.hash || location.hash === '#/') location.hash = '#/dashboard';
      PB.router();
      PB.loadLogos();
    } catch (e) {
      if (e.code === 'FORBIDDEN') { PB.api.setToken(''); showLogin(e.message, true); }
      else if (e.code === 'UNAUTHORIZED') { /* sudah ditangani onUnauthorized */ }
      else if (e.code === 'NOT_CONFIGURED' || e.code === 'NOT_CONFIGURED_FRONTEND') showLogin(e.message, true);
      else showLogin(e.message || 'Gagal memuat aplikasi.', true);
    }
  }

  PB.logout = function () {
    PB.api.setToken('');
    PB.state.user = null;
    try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) {}
    location.hash = '';
    showLogin('Anda telah keluar.', false);
  };

  /** Muat ulang data referensi setelah perubahan (customer/bank/produk/pengaturan) */
  PB.refreshRef = async function () {
    const b = await PB.api.call('app.bootstrap');
    const st = PB.state;
    st.settings = b.settings; st.banks = b.banks; st.customers = b.customers; st.products = b.products; st.today = b.today;
    return st;
  };

  document.addEventListener('DOMContentLoaded', function () {
    renderNav();
    $('#btn-logout').onclick = PB.logout;
    $('#btn-logout-m').onclick = PB.logout;
    if (PB.api.hasToken()) start(); else showLogin('', false);
  });
})(window.PB);

/* ============================================================
   PING BRO Invoice — klien API (fetch ke Google Apps Script)
   ============================================================ */
(function (PB) {
  'use strict';
  const KEY = 'pb_id_token';
  let token = '';
  try { token = sessionStorage.getItem(KEY) || ''; } catch (e) {}

  PB.api = {
    setToken: function (t) {
      token = t || '';
      try { if (t) sessionStorage.setItem(KEY, t); else sessionStorage.removeItem(KEY); } catch (e) {}
    },
    hasToken: function () { return !!token; },

    /** Panggil action GAS. Mengembalikan data, atau melempar Error dengan .code */
    call: async function (action, data) {
      const cfg = window.PB_CONFIG || {};
      if (!cfg.GAS_URL || /GANTI_DENGAN/.test(cfg.GAS_URL)) {
        const e = new Error('GAS_URL belum diisi di js/config.js'); e.code = 'NOT_CONFIGURED_FRONTEND'; throw e;
      }
      let res;
      try {
        res = await fetch(cfg.GAS_URL, {
          method: 'POST',
          // text/plain menghindari CORS preflight yang diblok Apps Script
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: action, token: token, data: data || {} })
        });
      } catch (err) {
        const e = new Error('Tidak dapat terhubung ke server. Periksa koneksi internet Anda.'); e.code = 'NETWORK'; throw e;
      }
      let json;
      try { json = await res.json(); }
      catch (err) { const e = new Error('Respons server tidak valid.'); e.code = 'BAD_RESPONSE'; throw e; }
      if (!json.success) {
        const e = new Error(json.message || 'Terjadi kesalahan.'); e.code = json.code || 'ERROR';
        if (e.code === 'UNAUTHORIZED') {
          PB.api.setToken('');
          if (PB.onUnauthorized) PB.onUnauthorized(e);
        }
        throw e;
      }
      return json.data;
    },

    ping: async function () {
      const cfg = window.PB_CONFIG || {};
      const res = await fetch(cfg.GAS_URL + (cfg.GAS_URL.indexOf('?') >= 0 ? '&' : '?') + 'action=ping');
      return (await res.json()).data;
    }
  };
})(window.PB);

/* ============================================================
   PING BRO Invoice — utilitas UI (format, ikon, toast, modal)
   ============================================================ */
window.PB = window.PB || {};
window.PB.views = window.PB.views || {};

(function (PB) {
  'use strict';

  // ---------- Escape & format ----------
  PB.esc = function (s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  PB.escBr = function (s) { return PB.esc(s).replace(/\r?\n/g, '<br>'); };

  PB.fmtNum = function (n) {
    const v = Math.round(Number(n) || 0);
    const neg = v < 0;
    return (neg ? '-' : '') + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };
  PB.fmtRp = function (n) { const v = Math.round(Number(n) || 0); return (v < 0 ? '-Rp ' : 'Rp ') + PB.fmtNum(Math.abs(v)); };
  PB.fmtQty = function (n) {
    const v = Number(n) || 0;
    return Number.isInteger(v) ? PB.fmtNum(v) : String(Math.round(v * 100) / 100).replace('.', ',');
  };
  PB.parseNum = function (s) { const d = String(s || '').replace(/[^0-9]/g, ''); return d ? parseInt(d, 10) : 0; };
  PB.parseQty = function (s) {
    const t = String(s === undefined || s === null ? '' : s).trim().replace(',', '.');
    const v = parseFloat(t);
    return isFinite(v) ? v : 0;
  };
  /** Isi input Rupiah dengan titik ribuan; kembalikan angka */
  PB.maskMoney = function (input) {
    const n = PB.parseNum(input.value);
    input.value = n ? PB.fmtNum(n) : '';
    return n;
  };

  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const BULAN_S = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  PB.BULAN = BULAN; PB.BULAN_S = BULAN_S;
  PB.fmtDate = function (iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? parseInt(m[3], 10) + ' ' + BULAN[parseInt(m[2], 10) - 1] + ' ' + m[1] : '-';
  };
  PB.fmtDateShort = function (iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? parseInt(m[3], 10) + ' ' + BULAN_S[parseInt(m[2], 10) - 1] + ' ' + m[1] : '-';
  };
  PB.monthLabel = function (ym) {
    const m = /^(\d{4})-(\d{2})$/.exec(ym || '');
    return m ? BULAN[parseInt(m[2], 10) - 1] + ' ' + m[1] : '-';
  };
  PB.todayIso = function () {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  /** 6281234567890 → 0812-3456-7890 */
  PB.fmtPhone = function (p) {
    let s = String(p || '').replace(/\D/g, '');
    if (!s) return '';
    if (s.indexOf('62') === 0) s = '0' + s.substring(2);
    const parts = [];
    parts.push(s.substring(0, 4));
    if (s.length > 4) parts.push(s.substring(4, 8));
    if (s.length > 8) parts.push(s.substring(8));
    return parts.join('-');
  };
  PB.normPhone = function (p) {
    let s = String(p || '').replace(/[^0-9+]/g, '');
    if (s.charAt(0) === '+') s = s.substring(1);
    s = s.replace(/\D/g, '');
    if (!s) return '';
    if (s.charAt(0) === '0') s = '62' + s.substring(1);
    else if (s.charAt(0) === '8') s = '62' + s;
    return s;
  };
  PB.compactRp = function (n) {
    const v = Number(n) || 0;
    if (v >= 1e9) return (Math.round(v / 1e8) / 10).toString().replace('.', ',') + ' M';
    if (v >= 1e6) return (Math.round(v / 1e5) / 10).toString().replace('.', ',') + ' jt';
    if (v >= 1e3) return Math.round(v / 1e3) + ' rb';
    return String(v);
  };
  PB.safeName = function (s, max) {
    const t = String(s || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return (t || 'Customer').substring(0, max || 40);
  };
  /** INV/2026/001 + "Padel Paradise" → INV-2026-001_Padel-Paradise.jpg */
  PB.invoiceFileName = function (no, customer) { return String(no).replace(/\//g, '-') + '_' + PB.safeName(customer) + '.jpg'; };

  PB.debounce = function (fn, ms) { let t; return function () { const a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; };
  PB.uid = function () { return 'u' + Math.random().toString(36).slice(2, 10); };
  PB.$ = function (sel, root) { return (root || document).querySelector(sel); };
  PB.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // ---------- Status ----------
  PB.STATUS = { UNPAID: 'Belum Dibayar', PARTIAL: 'Dibayar Sebagian', PAID: 'Lunas' };
  PB.statusClass = function (s) { return s === PB.STATUS.PAID ? 'paid' : (s === PB.STATUS.PARTIAL ? 'partial' : 'unpaid'); };
  PB.statusBadge = function (s) { return '<span class="badge badge-' + PB.statusClass(s) + '">' + PB.esc(String(s || '').toUpperCase()) + '</span>'; };

  // ---------- Ikon (garis, 24x24) ----------
  const ICONS = {
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/>',
    bank: '<path d="M3 21h18M5 21V10M9 21V10M15 21V10M19 21V10M2 10l10-7 10 7z"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    insta: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
    pencil: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    chart: '<path d="M3 3v18h18M7 14v4M12 8v10M17 11v7"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
    hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.4 1-3 0 1.6 1.2 2.5 2.5 2.5z"/>',
    whatsapp: '<path d="M3 21l1.7-5.1A8.5 8.5 0 1 1 8 19.4z"/><path d="M9 10c0 3 2.5 5 5 5l1.5-1.5-2-1-1 .8c-.8-.4-1.700-1.300-2.100-2.100l.8-1-1-2z"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01"/>',
    refresh: '<path d="M21 12a9 9 0 0 0-15-6.7L3 8M3 3v5h5M3 12a9 9 0 0 0 15 6.7L21 16M21 21v-5h-5"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>'
  };
  PB.icon = function (name, size, cls) {
    const s = size || 18;
    return '<svg class="ic ' + (cls || '') + '" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  };

  // ---------- Toast ----------
  PB.toast = function (message, type, opts) {
    opts = opts || {};
    const root = document.getElementById('toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast toast-' + (type || 'info');
    el.setAttribute('role', 'status');
    const icon = type === 'success' ? 'check' : (type === 'error' ? 'alert' : (type === 'warning' ? 'alert' : 'flame'));
    el.innerHTML = '<span class="toast-ic">' + PB.icon(icon, 18) + '</span><span class="toast-msg">' + PB.esc(message) + '</span>' +
      (opts.action ? '<button class="toast-action" type="button">' + PB.esc(opts.action.label) + '</button>' : '') +
      '<button class="toast-close" type="button" aria-label="Tutup">' + PB.icon('x', 14) + '</button>';
    while (root.children.length >= 3) root.removeChild(root.firstChild);   // maksimal 3 toast sekaligus
    root.appendChild(el);
    const close = function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 200); };
    el.querySelector('.toast-close').onclick = close;
    if (opts.action) el.querySelector('.toast-action').onclick = function () { close(); opts.action.onClick(); };
    const ttl = opts.duration || (type === 'error' || type === 'warning' ? 7000 : 3500);
    if (ttl > 0) setTimeout(close, ttl);
    return { close: close };
  };

  // ---------- Modal ----------
  PB.modal = function (html, opts) {
    opts = opts || {};
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop' + (opts.side ? ' drawer-wrap' : '');
    wrap.innerHTML = '<div class="modal ' + (opts.side ? 'drawer ' : '') + (opts.cls || '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    root.appendChild(wrap);
    document.body.classList.add('modal-open');
    const box = wrap.firstElementChild;
    let closed = false;
    const close = function (result) {
      if (closed) return; closed = true;
      wrap.classList.add('out');
      setTimeout(function () { wrap.remove(); if (!root.children.length) document.body.classList.remove('modal-open'); }, 160);
      document.removeEventListener('keydown', onKey);
      if (opts.onClose) opts.onClose(result);
    };
    const onKey = function (e) { if (e.key === 'Escape' && !opts.persistent) close(); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap && !opts.persistent) close(); });
    box.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(); });
    const first = box.querySelector('[autofocus],input:not([type=hidden]),textarea,select');
    if (first && !opts.noFocus) setTimeout(function () { try { if (!box.contains(document.activeElement)) first.focus(); } catch (x) {} }, 30);
    return { el: box, close: close };
  };

  PB.confirm = function (o) {
    return new Promise(function (resolve) {
      let decided = false;
      const m = PB.modal(
        '<div class="confirm">' +
        '<div class="confirm-ic ' + (o.danger ? 'danger' : '') + '">' + PB.icon(o.danger ? 'trash' : 'alert', 24) + '</div>' +
        '<h3>' + PB.esc(o.title || 'Konfirmasi') + '</h3>' +
        '<p>' + PB.esc(o.message || '') + '</p>' +
        '<div class="modal-actions"><button class="btn btn-secondary" type="button" data-close>' + PB.esc(o.cancelText || 'Batal') + '</button>' +
        '<button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" type="button" id="cf-ok">' + PB.esc(o.confirmText || 'Ya, lanjutkan') + '</button></div></div>',
        { cls: 'modal-sm', onClose: function () { if (!decided) resolve(false); } }
      );
      m.el.querySelector('#cf-ok').onclick = function () { decided = true; m.close(); resolve(true); };
    });
  };

  /** Dialog dengan input teks (mis. alasan pembatalan) */
  PB.prompt = function (o) {
    return new Promise(function (resolve) {
      let decided = false;
      const m = PB.modal(
        '<form class="confirm" novalidate><h3>' + PB.esc(o.title) + '</h3><p>' + PB.esc(o.message || '') + '</p>' +
        '<label class="field"><span class="label">' + PB.esc(o.label || '') + '</span><textarea name="v" rows="3" maxlength="300" autofocus></textarea><span class="err" data-err="v"></span></label>' +
        '<div class="modal-actions"><button class="btn btn-secondary" type="button" data-close>Batal</button>' +
        '<button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" type="submit">' + PB.esc(o.confirmText || 'Simpan') + '</button></div></form>',
        { cls: 'modal-sm', onClose: function () { if (!decided) resolve(null); } }
      );
      m.el.querySelector('form').onsubmit = function (e) {
        e.preventDefault();
        const v = this.v.value.trim();
        if (o.required && !v) { m.el.querySelector('[data-err=v]').textContent = 'Wajib diisi.'; return; }
        decided = true; m.close(); resolve(v);
      };
    });
  };

  // ---------- Misc ----------
  PB.setBusy = function (btn, busy, text) {
    if (!btn) return;
    if (busy) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.classList.add('busy'); if (text) btn.innerHTML = '<span class="spin"></span>' + PB.esc(text); }
    else { btn.disabled = false; btn.classList.remove('busy'); if (btn.dataset.html) { btn.innerHTML = btn.dataset.html; delete btn.dataset.html; } }
  };

  PB.skeleton = function (lines) {
    let h = '<div class="skeleton-wrap">';
    for (let i = 0; i < (lines || 4); i++) h += '<div class="skeleton" style="width:' + (60 + (i * 13) % 40) + '%"></div>';
    return h + '</div>';
  };

  PB.emptyState = function (title, text, ctaHtml) {
    return '<div class="empty"><div class="empty-art">' + PB.icon('box', 44) + '</div><h4>' + PB.esc(title) + '</h4><p>' + PB.esc(text || '') + '</p>' + (ctaHtml || '') + '</div>';
  };

  PB.downloadBlob = function (blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
  };

  PB.blobToBase64 = function (blob) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(new Error('Gagal membaca file')); };
      r.readAsDataURL(blob);
    });
  };

  /** Perkecil gambar (logo / lampiran) agar ringan diunggah. Mengembalikan {mime, base64}. */
  PB.resizeImage = function (file, maxW, preferPng) {
    return new Promise(function (resolve, reject) {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error('Format gambar harus PNG, JPG, atau WEBP.'));
      if (file.size > 12 * 1024 * 1024) return reject(new Error('Ukuran gambar terlalu besar (maksimal 12 MB).'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        const sc = Math.min(1, maxW / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        const mime = preferPng ? 'image/png' : 'image/jpeg';
        const data = c.toDataURL(mime, 0.88);
        resolve({ mime: mime, base64: data.split(',')[1], dataUrl: data });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Gambar tidak dapat dibaca.')); };
      img.src = url;
    });
  };

  PB.csvCell = function (v, delim) {
    if (typeof v === 'number') return String(v);
    let s = String(v === null || v === undefined ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;                // cegah injeksi rumus saat dibuka di Excel
    if (s.indexOf(delim) >= 0 || /["\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  };

  PB.go = function (route) { if (location.hash !== '#/' + route) location.hash = '#/' + route; else if (PB.router) PB.router(); };
})(window.PB);

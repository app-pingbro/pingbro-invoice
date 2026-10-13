/* Notifikasi WhatsApp & Email: tab Pengaturan → Notifikasi (konfigurasi, matriks event, antrean) */
(function (PB) {
  'use strict';
  const E = PB.esc, $ = PB.$;

  /** Dipakai editor/pembayaran: apakah ada kanal notifikasi aktif? */
  PB.notifOn = function () { const n = PB.state.notif || {}; return !!(n.wa_aktif || n.email_aktif); };
  PB.notifLabel = function () {
    const n = PB.state.notif || {};
    return n.wa_aktif && n.email_aktif ? 'WhatsApp & email' : (n.wa_aktif ? 'WhatsApp' : 'email');
  };
  /** Checkbox "kirim notifikasi" (kosong bila tidak ada kanal aktif) */
  PB.notifCheckbox = function (id, text, checked) {
    if (!PB.notifOn()) return '';
    return '<label class="check notif-check"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '> ' + PB.icon('whatsapp', 15) + ' ' + E(text.replace('{kanal}', PB.notifLabel())) + '</label>';
  };
  PB.notifToast = function (r) {
    if (r && r.notif_queued) PB.toast(r.notif_queued + ' notifikasi masuk antrean, terkirim dalam ±1 menit.', 'info');
  };

  const STATUS_CLS = { Terkirim: 'green', Gagal: 'red', Antri: 'gold', Proses: 'gold', Batal: '' };

  PB.notifTab = async function (body) {
    body.innerHTML = PB.skeleton(6);
    let cfg;
    try { cfg = await PB.api.call('notif.config'); }
    catch (e) { body.innerHTML = PB.emptyState('Gagal memuat', e.message); return; }
    PB.state.notif = { wa_aktif: cfg.wa_aktif, email_aktif: cfg.email_aktif };
    let qFilter = '';

    function draw() {
      const q = cfg.antrian || {};
      body.innerHTML =
        '<div class="grid-2"><section class="panel"><h3>' + PB.icon('whatsapp', 18) + ' WhatsApp (Fonnte)</h3>' +
        '<p class="muted small">Pesan masuk antrean dan dikirim otomatis tiap menit oleh trigger. Daftar di fonnte.com, tambahkan perangkat, scan QR, lalu tempel token di sini.</p>' +
        '<form id="n-wa" novalidate>' +
        '<label class="field"><span class="label">Token Fonnte ' + (cfg.has_token ? '<span class="tag green">tersimpan</span>' : '<span class="tag">belum diisi</span>') + '</span>' +
        '<input name="token" type="password" autocomplete="off" placeholder="' + (cfg.has_token ? E(cfg.token_mask) + ' (kosongkan = tidak diubah)' : 'Tempel token dari fonnte.com') + '"></label>' +
        '<label class="field"><span class="label">Jeda antarpesan (detik)</span><input name="jeda" value="' + E(cfg.jeda) + '" maxlength="7" placeholder="5 atau 3-8"><span class="err" data-err="jeda"></span></label>' +
        '<label class="check"><input type="checkbox" name="wa_aktif"' + (cfg.wa_aktif ? ' checked' : '') + '> Aktifkan notifikasi WhatsApp otomatis</label>' +
        '<div class="btn-row"><button class="btn btn-primary" type="submit">' + PB.icon('save', 16) + 'Simpan</button>' +
        '<button class="btn btn-secondary" type="button" id="n-dev"' + (cfg.has_token ? '' : ' disabled') + '>Cek perangkat</button>' +
        (cfg.has_token ? '<button class="btn btn-danger-ghost" type="button" id="n-deltoken">Hapus token</button>' : '') + '</div></form>' +
        '<div id="n-devinfo" class="hint" hidden></div>' +
        '<div class="row-2 n-test"><label class="field"><span class="label">Tes kirim ke nomor</span><input id="n-testno" inputmode="tel" placeholder="0812-…"></label>' +
        '<div class="field"><span class="label">&nbsp;</span><button class="btn btn-secondary" type="button" id="n-test"' + (cfg.has_token ? '' : ' disabled') + '>Kirim tes</button></div></div></section>' +

        '<section class="panel"><h3>' + PB.icon('mail', 18) + ' Email</h3>' +
        '<p class="muted small">Dikirim lewat akun Google pemilik script. Kuota harian: ' + (cfg.email_quota === null ? 'tidak diketahui' : '<b>' + cfg.email_quota + '</b> email tersisa') + '.</p>' +
        '<form id="n-em" novalidate><label class="field"><span class="label">Nama pengirim</span><input name="email_sender" maxlength="80" value="' + E(cfg.email_sender) + '" placeholder="PING BRO"></label>' +
        '<label class="check"><input type="checkbox" name="email_aktif"' + (cfg.email_aktif ? ' checked' : '') + '> Aktifkan notifikasi email</label>' +
        '<div class="btn-row"><button class="btn btn-primary" type="submit">' + PB.icon('save', 16) + 'Simpan</button></div></form>' +
        '<div class="row-2 n-test"><label class="field"><span class="label">Tes kirim ke email</span><input id="n-testem" type="email" placeholder="nama@email.com"></label>' +
        '<div class="field"><span class="label">&nbsp;</span><button class="btn btn-secondary" type="button" id="n-testem-b">Kirim tes</button></div></div></section></div>' +

        '<section class="panel"><div class="panel-head"><h3>Kapan notifikasi dikirim</h3></div>' +
        '<p class="muted small">Pilih kanal per kejadian. Pesan hanya terkirim bila saklar kanal di atas aktif <b>dan</b> customer punya nomor/email valid dan tidak opt-out.' +
        (cfg.trigger_aktif ? '' : ' <span class="bad">Trigger otomatis belum terpasang, jalankan <code>pasangTrigger()</code> di Apps Script atau simpan konfigurasi dengan kanal aktif.</span>') + '</p>' +
        '<div class="table-wrap"><table class="tbl rs"><thead><tr><th>Kejadian</th><th class="c">WA</th><th class="c">Email</th><th></th></tr></thead><tbody>' +
        cfg.matriks.map(function (m) {
          return '<tr><td data-l="Kejadian"><b>' + E(m.label) + '</b><div class="muted small n-prev">' + E(m.pesan.split('\n')[0]) + '</div></td>' +
            '<td class="c" data-l="WA"><input type="checkbox" data-ev="' + E(m.kode) + '" data-k="wa"' + (m.wa ? ' checked' : '') + ' aria-label="WA ' + E(m.label) + '"></td>' +
            '<td class="c" data-l="Email"><input type="checkbox" data-ev="' + E(m.kode) + '" data-k="email"' + (m.email ? ' checked' : '') + ' aria-label="Email ' + E(m.label) + '"></td>' +
            '<td class="r act"><button class="btn btn-sm btn-secondary" data-edit="' + E(m.kode) + '">Edit pesan</button></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="btn-row"><button class="btn btn-primary" id="n-mx-save">' + PB.icon('save', 16) + 'Simpan pilihan</button></div></section>' +

        '<section class="panel"><div class="panel-head"><h3>Antrean & riwayat kirim</h3><div class="btn-row">' +
        '<button class="btn btn-secondary btn-sm" id="n-proc">Kirim sekarang</button><button class="btn btn-secondary btn-sm" id="n-retry"' + (q.Gagal ? '' : ' disabled') + '>Ulangi yang gagal</button>' +
        '<button class="btn btn-ghost btn-sm" id="n-refresh">Muat ulang</button></div></div>' +
        '<div class="n-sum">' + ['Antri', 'Proses', 'Terkirim', 'Gagal'].map(function (k) { return '<button class="tag ' + (STATUS_CLS[k] || '') + (qFilter === k ? ' on' : '') + '" data-qf="' + k + '">' + k + ': ' + (q[k] || 0) + '</button>'; }).join('') +
        (qFilter ? '<button class="tag" data-qf="">Semua</button>' : '') + '</div><div id="n-queue">' + PB.skeleton(3) + '</div></section>';
      wire(); loadQueue();
    }

    async function save(patch, btn, okMsg) {
      PB.setBusy(btn, true, 'Menyimpan…');
      try {
        cfg = await PB.api.call('notif.configSave', patch);
        PB.state.notif = { wa_aktif: cfg.wa_aktif, email_aktif: cfg.email_aktif };
        if (cfg.peringatan) PB.toast(cfg.peringatan, 'warning'); else PB.toast(okMsg || 'Tersimpan.', 'success');
        draw();
      } catch (e) { PB.setBusy(btn, false); const er = body.querySelector('[data-err=jeda]'); if (er && /jeda/i.test(e.message)) er.textContent = e.message; else PB.toast(e.message, 'error'); }
    }

    async function loadQueue() {
      const box = $('#n-queue', body); if (!box) return;
      try {
        const r = await PB.api.call('notif.queue', qFilter ? { status: qFilter } : {});
        box.innerHTML = r.rows.length ? '<div class="table-wrap"><table class="tbl rs"><thead><tr><th>Waktu</th><th>Kanal</th><th>Tujuan</th><th>Kejadian</th><th>Status</th><th>Keterangan</th></tr></thead><tbody>' +
          r.rows.map(function (x) {
            return '<tr><td data-l="Waktu" class="nowrap">' + E(String(x.dibuat_pada || '').substring(0, 16).replace('T', ' ')) + '</td><td data-l="Kanal">' + E(x.kanal) + '</td>' +
              '<td data-l="Tujuan">' + E(x.nama_penerima || '') + '<div class="muted small">' + E(x.tujuan) + '</div></td><td data-l="Kejadian">' + E(x.event) + '</td>' +
              '<td data-l="Status"><span class="tag ' + (STATUS_CLS[x.status] || '') + '">' + E(x.status) + '</span></td><td data-l="Keterangan" class="muted small">' + E(x.respon || '') + '</td></tr>';
          }).join('') + '</tbody></table></div>' : PB.emptyState('Belum ada pesan', 'Pesan otomatis akan tercatat di sini.');
      } catch (e) { box.innerHTML = PB.emptyState('Gagal memuat', e.message); }
    }

    function editEvent(kode) {
      const m = cfg.matriks.filter(function (x) { return x.kode === kode; })[0];
      const dlg = PB.modal('<form class="form-modal" novalidate><div class="modal-h"><h3>' + E(m.label) + '</h3><button type="button" class="icon-btn" data-close aria-label="Tutup">' + PB.icon('x', 18) + '</button></div>' +
        '<label class="field"><span class="label">Subjek email</span><input name="subjek" maxlength="150" value="' + E(m.subjek) + '"></label>' +
        '<label class="field"><span class="label">Isi pesan (WhatsApp & email)</span><textarea name="pesan" rows="8" maxlength="800">' + E(m.pesan) + '</textarea><span class="err" data-err="pesan"></span></label>' +
        '<div class="hint">Variabel: ' + cfg.variabel.map(function (v) { return '<code>{' + v + '}</code>'; }).join(' ') + '. Gunakan <code>*teks*</code> untuk tebal di WhatsApp.</div>' +
        '<div class="modal-actions"><button type="button" class="btn btn-ghost" id="ev-reset">Kembalikan bawaan</button><button type="button" class="btn btn-secondary" data-close>Batal</button><button class="btn btn-primary" type="submit">Simpan</button></div></form>', { cls: 'modal-md' });
      const f = dlg.el.querySelector('form');
      $('#ev-reset', dlg.el).onclick = function () { f.subjek.value = m.subjekDefault; f.pesan.value = m.pesanDefault; };
      f.onsubmit = async function (ev) {
        ev.preventDefault();
        if (!f.pesan.value.trim()) { dlg.el.querySelector('[data-err=pesan]').textContent = 'Isi pesan wajib diisi.'; return; }
        const mx = {}; mx[kode] = { subjek: f.subjek.value, pesan: f.pesan.value };
        cfg.matriks.forEach(function (x) { if (x.kode !== kode) mx[x.kode] = { wa: x.wa, email: x.email, subjek: x.subjek, pesan: x.pesan }; else Object.assign(mx[kode], { wa: x.wa, email: x.email }); });
        const btn = f.querySelector('[type=submit]');
        await save({ matriks: mx }, btn, 'Pesan disimpan.'); dlg.close();
      };
    }

    function wire() {
      $('#n-wa', body).onsubmit = function (e) {
        e.preventDefault(); const f = this;
        const patch = { jeda: f.jeda.value.trim(), wa_aktif: f.wa_aktif.checked };
        if (f.token.value.trim()) patch.token = f.token.value.trim();
        save(patch, f.querySelector('[type=submit]'), 'Pengaturan WhatsApp disimpan.');
      };
      $('#n-em', body).onsubmit = function (e) {
        e.preventDefault(); const f = this;
        save({ email_aktif: f.email_aktif.checked, email_sender: f.email_sender.value.trim() }, f.querySelector('[type=submit]'), 'Pengaturan email disimpan.');
      };
      const del = $('#n-deltoken', body);
      if (del) del.onclick = async function () {
        if (await PB.confirm({ danger: true, title: 'Hapus token Fonnte?', message: 'WhatsApp otomatis akan dimatikan sampai token diisi lagi.', confirmText: 'Ya, hapus' })) save({ token: '__HAPUS__', wa_aktif: false }, del, 'Token dihapus.');
      };
      $('#n-dev', body).onclick = async function () {
        const b = this, box = $('#n-devinfo', body); PB.setBusy(b, true, 'Mengecek…');
        try {
          const d = await PB.api.call('wa.device');
          box.hidden = false; box.innerHTML = 'Perangkat <b>' + E(d.device || '-') + '</b> · status <b>' + E(d.status || '-') + '</b>' + (d.paket ? ' · paket ' + E(d.paket) : '') + (d.kuota !== '' ? ' · kuota ' + E(d.kuota) : '') + (d.kadaluarsa ? ' · berlaku s.d. ' + E(d.kadaluarsa) : '');
        } catch (e) { box.hidden = false; box.textContent = e.message; } finally { PB.setBusy(b, false); }
      };
      $('#n-test', body).onclick = async function () {
        const b = this, no = $('#n-testno', body).value.trim(); if (!no) return PB.toast('Isi nomor tujuan tes.', 'error');
        PB.setBusy(b, true, 'Mengirim…');
        try { const r = await PB.api.call('wa.test', { nomor: no }); PB.toast('Tes terkirim ke ' + r.terkirim_ke, 'success'); }
        catch (e) { PB.toast(e.message, 'error'); } finally { PB.setBusy(b, false); }
      };
      $('#n-testem-b', body).onclick = async function () {
        const b = this, em = $('#n-testem', body).value.trim(); if (!em) return PB.toast('Isi alamat email tes.', 'error');
        PB.setBusy(b, true, 'Mengirim…');
        try { const r = await PB.api.call('email.test', { email: em }); PB.toast('Email tes terkirim ke ' + r.terkirim_ke, 'success'); }
        catch (e) { PB.toast(e.message, 'error'); } finally { PB.setBusy(b, false); }
      };
      $('#n-mx-save', body).onclick = function () {
        const mx = {};
        cfg.matriks.forEach(function (m) { mx[m.kode] = { wa: m.wa, email: m.email, subjek: m.subjek, pesan: m.pesan }; });
        PB.$$('[data-ev]', body).forEach(function (c) { mx[c.dataset.ev][c.dataset.k] = c.checked; });
        save({ matriks: mx }, this, 'Pilihan notifikasi disimpan.');
      };
      PB.$$('[data-edit]', body).forEach(function (b) { b.onclick = function () { editEvent(b.dataset.edit); }; });
      $('#n-proc', body).onclick = async function () {
        const b = this; PB.setBusy(b, true, 'Memproses…');
        try { const r = await PB.api.call('notif.processNow'); PB.toast(r && r.info ? r.info : 'Antrean diproses.', 'success'); cfg = await PB.api.call('notif.config'); draw(); }
        catch (e) { PB.setBusy(b, false); PB.toast(e.message, 'error'); }
      };
      $('#n-retry', body).onclick = async function () {
        const b = this; PB.setBusy(b, true, 'Memproses…');
        try { const r = await PB.api.call('notif.retry', {}); PB.toast(r.diulang + ' pesan diantrekan ulang.', 'success'); cfg = await PB.api.call('notif.config'); draw(); }
        catch (e) { PB.setBusy(b, false); PB.toast(e.message, 'error'); }
      };
      $('#n-refresh', body).onclick = async function () { try { cfg = await PB.api.call('notif.config'); draw(); } catch (e) { PB.toast(e.message, 'error'); } };
      PB.$$('[data-qf]', body).forEach(function (b) { b.onclick = function () { qFilter = b.dataset.qf; draw(); }; });
    }
    draw();
  };
})(window.PB);

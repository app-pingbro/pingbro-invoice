/* Riwayat Invoice: filter, tabel, paginasi, ekspor CSV, drawer detail + pembayaran */
(function (PB) {
  'use strict';
  const E = PB.esc, $ = PB.$;

  // ---------- Drawer detail ----------
  PB.openInvoiceDetail = function (id, onChange) {
    const S = PB.state;
    const m = PB.modal('<div class="drawer-body" id="dv">' + PB.skeleton(8) + '</div>', { side: true, noFocus: true });
    const box = m.el.querySelector('#dv');
    let full = null;

    async function load() {
      try { full = await PB.api.call('invoice.get', { invoice_id: id }); render(); }
      catch (e) { box.innerHTML = PB.emptyState('Gagal memuat invoice', e.message); }
    }
    function changed() { if (onChange) onChange(); }

    function render() {
      const inv = full.invoice;
      const pays = full.payments;
      const canPay = inv.balance > 0;
      box.innerHTML =
        '<div class="modal-h"><div><div class="mono dv-no">' + E(inv.invoice_no) + '</div><div class="muted small">' + PB.fmtDate(inv.invoice_date) + (inv.order_code ? ' · Order ' + E(inv.order_code) : '') + '</div></div>' +
        '<div class="dv-h-r">' + PB.statusBadge(inv.payment_status) + '<button type="button" class="icon-btn" data-close aria-label="Tutup">' + PB.icon('x', 18) + '</button></div></div>' +
        '<div class="dv-cust"><b>' + E(inv.customer_name_snap) + '</b>' +
          (inv.customer_phone_snap ? '<span>' + PB.icon('phone', 13) + E(PB.fmtPhone(inv.customer_phone_snap)) + '</span>' : '') +
          (inv.customer_email_snap ? '<span>' + PB.icon('mail', 13) + E(inv.customer_email_snap) + '</span>' : '') +
          (inv.customer_address_snap ? '<span>' + PB.icon('pin', 13) + E(inv.customer_address_snap) + '</span>' : '') + '</div>' +
        '<div class="dv-sum"><div><span>Total</span><b>' + PB.fmtRp(inv.total) + '</b></div><div><span>Dibayar</span><b class="ok">' + PB.fmtRp(inv.paid_total) + '</b></div><div><span>Sisa</span><b class="' + (inv.balance > 0 ? 'bad' : 'ok') + '">' + PB.fmtRp(inv.balance) + '</b></div></div>' +
        '<div class="dv-actions">' +
          '<button class="btn btn-secondary" data-a="view">' + PB.icon('eye', 16) + 'Lihat</button>' +
          '<button class="btn btn-secondary" data-a="jpg">' + PB.icon('download', 16) + 'Unduh JPG</button>' +
          '<button class="btn btn-wa" data-a="wa">' + PB.icon('whatsapp', 16) + 'WhatsApp</button>' +
          (PB.notifOn() && inv.balance > 0 ? '<button class="btn btn-secondary" data-a="remind">' + PB.icon('whatsapp', 16) + 'Kirim pengingat</button>' : '') +
          '<a class="btn btn-secondary" href="#/invoice/edit/' + E(inv.invoice_id) + '" data-close>' + PB.icon('pencil', 16) + 'Edit</a>' +
          '<button class="btn btn-secondary" data-a="dup">' + PB.icon('copy', 16) + 'Duplikat</button>' +
          '<button class="btn btn-danger-ghost" data-a="del">' + PB.icon('trash', 16) + 'Hapus</button></div>' +
        (inv.jpg_url ? '<div class="hint">' + PB.icon('image', 14) + 'JPG tersimpan di Drive: <a class="link" href="' + E(inv.jpg_url) + '" target="_blank" rel="noopener">' + E(inv.jpg_filename) + '</a></div>' : '') +
        '<h4 class="dv-t">Item</h4><div class="dv-items">' + full.items.map(function (it) {
          return '<div class="dv-item"><div><b>' + E(it.name) + '</b>' + (it.description ? '<div class="muted small">' + PB.escBr(it.description) + '</div>' : '') +
            '<div class="muted small">' + PB.fmtQty(it.qty) + ' ' + E(it.unit) + ' × ' + PB.fmtRp(it.unit_price) + (it.discount_amount > 0 ? ' · diskon ' + PB.fmtRp(it.discount_amount) : '') + '</div></div><b>' + PB.fmtRp(it.line_total) + '</b></div>';
        }).join('') + '</div>' +
        '<div class="dv-t-row"><h4 class="dv-t">Pembayaran</h4><div class="dv-pay-actions">' +
          (canPay ? '<button class="btn btn-sm btn-primary" data-a="payfull">' + PB.icon('check', 14) + 'Tandai Lunas</button><button class="btn btn-sm btn-secondary" data-a="pay">' + PB.icon('plus', 14) + 'Catat</button>' : '') + '</div></div>' +
        (pays.length ? '<div class="dv-pays">' + pays.map(function (p) {
          const v = p.status === 'dibatalkan';
          return '<div class="dv-pay' + (v ? ' void' : '') + '"><div><b>' + PB.fmtRp(p.amount) + '</b> <span class="muted small">· ' + E(p.method) + ' · ' + PB.fmtDateShort(p.payment_date) + '</span>' +
            (p.note ? '<div class="muted small">' + E(p.note) + '</div>' : '') +
            (v ? '<div class="small bad">Dibatalkan: ' + E(p.void_reason) + '</div>' : '') + '</div>' +
            '<div class="dv-pay-r">' + (p.proof_file_id ? '<button class="btn btn-sm btn-ghost" data-proof="' + E(p.payment_id) + '">' + PB.icon('image', 14) + 'Bukti</button>' : '') +
            (!v ? '<button class="btn btn-sm btn-danger-ghost" data-void="' + E(p.payment_id) + '">Batalkan</button>' : '') + '</div></div>';
        }).join('') + '</div>' : '<div class="muted small pad">Belum ada pembayaran.</div>') +
        ((full.notifs || []).length ? '<h4 class="dv-t">Notifikasi terkirim</h4><div class="dv-pays">' + full.notifs.map(function (n) {
          return '<div class="dv-notif"><div><b>' + E(n.kanal) + '</b> · ' + E(n.event) + '<div class="muted small">' + E(String(n.dibuat_pada || '').substring(0, 16).replace('T', ' ')) + (n.respon ? ' · ' + E(n.respon) : '') + '</div></div><span class="tag ' + (n.status === 'Terkirim' ? 'green' : (n.status === 'Gagal' ? 'red' : 'gold')) + '">' + E(n.status) + '</span></div>';
        }).join('') + '</div>' : '') +
        '<div class="dv-t-row"><h4 class="dv-t">Lampiran</h4><label class="btn btn-sm btn-secondary file-btn">' + PB.icon('upload', 14) + 'Unggah gambar<input type="file" accept="image/png,image/jpeg,image/webp" id="att-file" hidden></label></div>' +
        (full.attachments.length ? '<div class="dv-pays">' + full.attachments.map(function (a) {
          return '<div class="dv-pay"><div><b>' + E(a.filename) + '</b> <span class="muted small">· ' + E(a.type) + '</span></div><div class="dv-pay-r"><button class="btn btn-sm btn-ghost" data-att="' + E(a.attachment_id) + '">' + PB.icon('eye', 14) + 'Lihat</button><button class="btn btn-sm btn-danger-ghost" data-attdel="' + E(a.attachment_id) + '">Hapus</button></div></div>';
        }).join('') + '</div>' : '<div class="muted small pad">Belum ada lampiran (mockup desain, dll).</div>') +
        (inv.notes ? '<h4 class="dv-t">Catatan</h4><div class="muted pad">' + PB.escBr(inv.notes) + '</div>' : '');
    }

    async function guard(btn, text, fn) {
      PB.setBusy(btn, true, text);
      try { await fn(); } catch (e) { PB.toast(e.message, 'error'); }
      finally { if (btn && btn.isConnected) PB.setBusy(btn, false); }
    }
    async function makeBlob() { return PB.sheet.toJpeg(PB.invoiceModel(full)); }
    async function showImage(type, itemId, title) {
      const t = PB.toast('Membuka gambar…', 'info', { duration: 1500 });
      try {
        const r = await PB.api.call('file.get', { type: type, id: itemId });
        PB.modal('<div class="modal-h"><h3>' + E(title) + '</h3><button type="button" class="icon-btn" data-close aria-label="Tutup">' + PB.icon('x', 18) + '</button></div><div class="img-view"><img src="' + r.data_url + '" alt="' + E(title) + '"></div>', { cls: 'modal-lg' });
      } catch (e) { PB.toast(e.message, 'error'); }
    }

    function payModal(preAmount) {
      const inv = full.invoice;
      const pm = PB.modal('<form class="form-modal" novalidate><div class="modal-h"><h3>Catat pembayaran</h3><button type="button" class="icon-btn" data-close aria-label="Tutup">' + PB.icon('x', 18) + '</button></div>' +
        '<div class="hint">Sisa tagihan: <b>' + PB.fmtRp(inv.balance) + '</b></div>' +
        '<div class="row-2"><label class="field"><span class="label">Nominal (Rp)</span><input name="amount" inputmode="numeric" value="' + (preAmount ? PB.fmtNum(preAmount) : '') + '" autofocus><span class="err" data-err="amount"></span></label>' +
        '<label class="field"><span class="label">Tanggal</span><input type="date" name="date" value="' + S.today + '"><span class="err" data-err="date"></span></label></div>' +
        '<div class="row-2"><label class="field"><span class="label">Metode</span><select name="method">' + S.methods.map(function (x) { return '<option>' + E(x) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field"><span class="label">Bukti transfer (opsional)</span><input type="file" name="proof" accept="image/png,image/jpeg,image/webp"></label></div>' +
        '<label class="field"><span class="label">Catatan (opsional)</span><input name="note" maxlength="300"></label>' +
        PB.notifCheckbox('pm-notify', 'Kirim konfirmasi pembayaran ke customer via {kanal}', true) +
        '<div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Batal</button><button class="btn btn-primary" type="submit">Simpan pembayaran</button></div></form>', { cls: 'modal-md' });
      const f = pm.el.querySelector('form');
      f.amount.oninput = function () { PB.maskMoney(f.amount); };
      const err = function (k, t) { pm.el.querySelector('[data-err=' + k + ']').textContent = t; };
      f.onsubmit = async function (ev) {
        ev.preventDefault(); err('amount', ''); err('date', '');
        const amount = PB.parseNum(f.amount.value);
        if (!(amount > 0)) return err('amount', 'Nominal harus lebih dari 0.');
        if (amount > inv.balance) return err('amount', 'Melebihi sisa tagihan (' + PB.fmtRp(inv.balance) + ').');
        if (!f.date.value) return err('date', 'Tanggal wajib diisi.');
        const btn = f.querySelector('[type=submit]');
        PB.setBusy(btn, true, 'Menyimpan…');
        try {
          const data = { invoice_id: inv.invoice_id, amount: amount, payment_date: f.date.value, method: f.method.value, note: f.note.value.trim(), notify: !!(f.querySelector('#pm-notify') && f.querySelector('#pm-notify').checked) };
          if (f.proof.files[0]) { const img = await PB.resizeImage(f.proof.files[0], 1600, false); data.proof = { mime: img.mime, base64: img.base64 }; }
          full = await PB.api.call('payment.add', data);
          pm.close(); render(); changed();
          if (data.notify) { if (full.notif_queued) PB.notifToast(full); else PB.toast('Konfirmasi tidak dikirim: customer tanpa nomor/email valid atau opt-out.', 'warning'); }
          PB.toast(full.invoice.payment_status === PB.STATUS.PAID ? 'Pembayaran dicatat. Invoice LUNAS.' : 'Pembayaran dicatat.', 'success');
        } catch (e) { PB.setBusy(btn, false); err('amount', e.message); }
      };
    }

    box.onclick = async function (e) {
      const inv = full && full.invoice; if (!inv) return;
      const a = e.target.closest('[data-a]');
      if (a) {
        const act = a.dataset.a;
        if (act === 'view') {
          const vm = PB.modal('<div class="modal-h"><h3>' + E(inv.invoice_no) + '</h3><button type="button" class="icon-btn" data-close aria-label="Tutup">' + PB.icon('x', 18) + '</button></div><div class="preview-wrap" id="pv-m"></div>', { cls: 'modal-lg' });
          const w = vm.el.querySelector('#pv-m');
          w.innerHTML = PB.sheet.render(PB.invoiceModel(full));
          setTimeout(function () { PB.sheet.fit(w); }, 30);
        }
        else if (act === 'jpg') guard(a, 'Menyiapkan…', async function () {
          const blob = await makeBlob(); PB.downloadBlob(blob, PB.invoiceFileName(inv.invoice_no, inv.customer_name_snap));
          if (!inv.jpg_url) { try { await PB.uploadJpg(inv.invoice_id, blob); load(); changed(); } catch (x) {} }
          PB.toast('JPG diunduh.', 'success');
        });
        else if (act === 'wa') guard(a, 'Menyiapkan…', async function () { const blob = await makeBlob(); const r = await PB.shareInvoice(blob, inv); if (r === 'link') PB.toast('JPG diunduh. Lampirkan ke chat WhatsApp yang terbuka.', 'info'); });
        else if (act === 'remind') guard(a, 'Mengantre…', async function () {
          const r = await PB.api.call('notif.sendInvoice', { invoice_id: inv.invoice_id, event: 'PENGINGAT_TAGIHAN' });
          PB.toast(r.queued + ' pengingat masuk antrean, terkirim dalam ±1 menit.', 'success');
          full = await PB.api.call('invoice.get', { invoice_id: inv.invoice_id }); render();
        });
        else if (act === 'dup') guard(a, 'Menduplikat…', async function () {
          const r = await PB.api.call('invoice.duplicate', { invoice_id: inv.invoice_id });
          PB.toast('Duplikat dibuat: ' + r.invoice.invoice_no, 'success'); changed(); id = r.invoice.invoice_id; full = r; render();
        });
        else if (act === 'del') {
          const ok = await PB.confirm({ danger: true, title: 'Hapus invoice?', message: 'Invoice ' + inv.invoice_no + ' akan disembunyikan dari daftar. Nomor tidak akan dipakai ulang.', confirmText: 'Ya, hapus' });
          if (ok) guard(a, 'Menghapus…', async function () { await PB.api.call('invoice.delete', { invoice_id: inv.invoice_id }); m.close(); PB.toast('Invoice dihapus.', 'success'); changed(); });
        }
        else if (act === 'pay') payModal(0);
        else if (act === 'payfull') payModal(inv.balance);
        return;
      }
      const v = e.target.closest('[data-void]');
      if (v) {
        const reason = await PB.prompt({ title: 'Batalkan pembayaran', message: 'Pembayaran tidak dihapus, hanya ditandai dibatalkan dan tidak dihitung.', label: 'Alasan pembatalan', required: true, danger: true, confirmText: 'Batalkan pembayaran' });
        if (reason) guard(v, '…', async function () { full = await PB.api.call('payment.void', { payment_id: v.dataset.void, reason: reason }); render(); changed(); PB.toast('Pembayaran dibatalkan.', 'success'); });
        return;
      }
      const pr = e.target.closest('[data-proof]'); if (pr) return showImage('proof', pr.dataset.proof, 'Bukti pembayaran');
      const at = e.target.closest('[data-att]'); if (at) return showImage('attachment', at.dataset.att, 'Lampiran');
      const ad = e.target.closest('[data-attdel]');
      if (ad) {
        const ok = await PB.confirm({ danger: true, title: 'Hapus lampiran?', message: 'File lampiran akan dibuang dari Drive.', confirmText: 'Hapus' });
        if (ok) guard(ad, '…', async function () { await PB.api.call('attachment.delete', { attachment_id: ad.dataset.attdel }); await load(); PB.toast('Lampiran dihapus.', 'success'); });
      }
    };
    box.onchange = async function (e) {
      if (e.target.id !== 'att-file' || !e.target.files[0]) return;
      const file = e.target.files[0]; e.target.value = '';
      try {
        const img = await PB.resizeImage(file, 1600, false);
        PB.toast('Mengunggah lampiran…', 'info', { duration: 1500 });
        await PB.api.call('file.uploadAttachment', { invoice_id: full.invoice.invoice_id, mime: img.mime, base64: img.base64, filename: file.name, type: 'mockup' });
        await load(); PB.toast('Lampiran diunggah.', 'success');
      } catch (err) { PB.toast(err.message, 'error'); }
    };
    load();
  };

  // ---------- Halaman Riwayat ----------
  PB.views.history = {
    mount: function (el) {
      const f = { q: '', status: '', date_from: '', date_to: '', customer_id: '' };
      let page = 1, seq = 0;
      el.innerHTML =
        '<div class="page-head"><div><h1>Riwayat Invoice</h1><p class="muted">Cari, filter, dan kelola semua invoice</p></div>' +
        '<div class="filters-inline"><button class="btn btn-secondary" id="h-csv">' + PB.icon('download', 16) + 'Ekspor CSV</button><a class="btn btn-primary" href="#/invoice/new">' + PB.icon('plus', 16) + 'Buat Invoice</a></div></div>' +
        '<section class="panel filters">' +
        '<label class="field grow"><span class="label">Cari</span><div class="search">' + PB.icon('search', 16) + '<input id="h-q" type="search" placeholder="No. invoice, kode order, atau nama customer"></div></label>' +
        '<label class="field"><span class="label">Status</span><select id="h-status"><option value="">Semua status</option><option>Belum Dibayar</option><option>Dibayar Sebagian</option><option>Lunas</option></select></label>' +
        '<label class="field"><span class="label">Customer</span><select id="h-cust"><option value="">Semua customer</option>' + PB.state.customers.map(function (c) { return '<option value="' + E(c.customer_id) + '">' + E(c.name) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field"><span class="label">Dari</span><input type="date" id="h-from"></label><label class="field"><span class="label">Sampai</span><input type="date" id="h-to"></label>' +
        '<button class="btn btn-ghost" id="h-reset" type="button">Reset</button></section>' +
        '<section class="panel" id="h-list">' + PB.skeleton(6) + '</section>';
      const list = $('#h-list', el);

      async function load() {
        const my = ++seq;
        try {
          const d = await PB.api.call('invoice.list', Object.assign({ page: page, page_size: 15 }, f));
          if (my !== seq) return;
          page = d.page;
          if (!d.rows.length) {
            const filtered = f.q || f.status || f.date_from || f.date_to || f.customer_id;
            list.innerHTML = PB.emptyState(filtered ? 'Tidak ada invoice yang cocok' : 'Belum ada invoice', filtered ? 'Coba ubah kata kunci atau filter.' : 'Invoice yang Anda buat akan muncul di sini.', filtered ? '<button class="btn btn-secondary" id="h-reset2">Reset filter</button>' : '<a class="btn btn-primary" href="#/invoice/new">Buat Invoice</a>');
            const r2 = $('#h-reset2', el); if (r2) r2.onclick = reset;
            return;
          }
          list.innerHTML = '<div class="table-wrap"><table class="tbl rs"><thead><tr><th>No. Invoice</th><th>Tanggal</th><th>Customer</th><th class="r">Total</th><th class="r">Sisa</th><th>Status</th></tr></thead><tbody>' +
            d.rows.map(function (r) {
              return '<tr class="click" data-open="' + E(r.invoice_id) + '" tabindex="0"><td class="mono" data-l="No. Invoice"><span>' + E(r.invoice_no) + (r.order_code ? '<div class="muted small">' + E(r.order_code) + '</div>' : '') + '</span></td><td data-l="Tanggal">' + PB.fmtDateShort(r.invoice_date) + '</td><td data-l="Customer">' + E(r.customer_name_snap) + '</td><td class="r" data-l="Total">' + PB.fmtRp(r.total) + '</td><td class="r" data-l="Sisa">' + PB.fmtRp(r.balance) + '</td><td data-l="Status">' + PB.statusBadge(r.payment_status) + '</td></tr>';
            }).join('') + '</tbody></table></div>' +
            '<div class="pager"><span class="muted small">' + d.total + ' invoice · halaman ' + d.page + ' dari ' + d.pages + '</span><div><button class="btn btn-sm btn-secondary" id="h-prev"' + (d.page <= 1 ? ' disabled' : '') + '>Sebelumnya</button><button class="btn btn-sm btn-secondary" id="h-next"' + (d.page >= d.pages ? ' disabled' : '') + '>Berikutnya</button></div></div>';
          PB.$$('[data-open]', list).forEach(function (r) {
            const open = function () { PB.openInvoiceDetail(r.dataset.open, load); };
            r.onclick = open; r.onkeydown = function (e) { if (e.key === 'Enter') open(); };
          });
          $('#h-prev', el).onclick = function () { page--; load(); };
          $('#h-next', el).onclick = function () { page++; load(); };
        } catch (e) { if (my === seq) list.innerHTML = PB.emptyState('Gagal memuat', e.message); }
      }
      function reset() {
        Object.keys(f).forEach(function (k) { f[k] = ''; });
        ['h-q', 'h-status', 'h-cust', 'h-from', 'h-to'].forEach(function (i) { $('#' + i, el).value = ''; });
        page = 1; load();
      }
      const apply = PB.debounce(function () { page = 1; load(); }, 250);
      $('#h-q', el).oninput = function () { f.q = this.value; apply(); };
      $('#h-status', el).onchange = function () { f.status = this.value; page = 1; load(); };
      $('#h-cust', el).onchange = function () { f.customer_id = this.value; page = 1; load(); };
      $('#h-from', el).onchange = function () { f.date_from = this.value; page = 1; load(); };
      $('#h-to', el).onchange = function () { f.date_to = this.value; page = 1; load(); };
      $('#h-reset', el).onclick = reset;

      $('#h-csv', el).onclick = async function () {
        const btn = this; PB.setBusy(btn, true, 'Menyiapkan…');
        try {
          const d = await PB.api.call('invoice.exportRows', f);
          if (!d.rows.length) { PB.toast('Tidak ada data untuk diekspor.', 'warning'); return; }
          const D = ';';
          const head = ['No. Invoice', 'Tanggal', 'Customer', 'Subtotal', 'Diskon', 'Total', 'Dibayar', 'Sisa', 'Status'];
          const lines = [head.join(D)].concat(d.rows.map(function (r) {
            return [r.invoice_no, r.invoice_date, r.customer_name, r.subtotal, r.total_discount, r.total, r.paid_total, r.balance, r.payment_status].map(function (v) { return PB.csvCell(v, D); }).join(D);
          }));
          const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
          PB.downloadBlob(blob, 'invoice-pingbro-' + PB.todayIso() + '.csv');
          PB.toast(d.rows.length + ' invoice diekspor (mengikuti filter).', 'success');
        } catch (e) { PB.toast(e.message, 'error'); } finally { PB.setBusy(btn, false); }
      };
      load();
    }
  };
})(window.PB);

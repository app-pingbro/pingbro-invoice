/* Data Customer: daftar, cari, tambah/edit/hapus */
(function (PB) {
  'use strict';
  const E = PB.esc, $ = PB.$;

  PB.views.customers = {
    mount: function (el) {
      let all = [], q = '';
      el.innerHTML =
        '<div class="page-head"><div><h1>Data Customer</h1><p class="muted">Kelola pelanggan PING BRO</p></div>' +
        '<button class="btn btn-primary" id="c-new">' + PB.icon('plus', 16) + 'Customer baru</button></div>' +
        '<section class="panel"><div class="search">' + PB.icon('search', 16) + '<input id="c-q" type="search" placeholder="Cari nama, nomor, atau alamat"></div><div id="c-list">' + PB.skeleton(5) + '</div></section>';
      const list = $('#c-list', el);

      function draw() {
        const t = q.trim().toLowerCase();
        const rows = all.filter(function (c) { return !t || (c.name + ' ' + c.phone + ' ' + c.address).toLowerCase().indexOf(t) >= 0; });
        if (!rows.length) {
          list.innerHTML = PB.emptyState(t ? 'Tidak ditemukan' : 'Belum ada customer', t ? 'Coba kata kunci lain.' : 'Tambahkan customer pertama Anda.', t ? '' : '<button class="btn btn-primary" id="c-new2">Customer baru</button>');
          const b = $('#c-new2', el); if (b) b.onclick = function () { form(null); };
          return;
        }
        list.innerHTML = '<div class="table-wrap"><table class="tbl rs"><thead><tr><th>Nama</th><th>WhatsApp</th><th>Alamat</th><th class="r">Invoice</th><th></th></tr></thead><tbody>' +
          rows.map(function (c) {
            return '<tr><td data-l="Nama"><b>' + E(c.name) + '</b></td><td data-l="WhatsApp">' + (c.phone ? E(PB.fmtPhone(c.phone)) : '<span class="muted">–</span>') + '</td><td class="addr" data-l="Alamat">' + (c.address ? E(c.address) : '<span class="muted">–</span>') + '</td><td class="r" data-l="Invoice">' + c.invoice_count + '</td>' +
              '<td class="r nowrap act"><button class="btn btn-sm btn-secondary" data-edit="' + E(c.customer_id) + '">' + PB.icon('pencil', 14) + 'Edit</button><button class="btn btn-sm btn-danger-ghost" data-del="' + E(c.customer_id) + '" aria-label="Hapus ' + E(c.name) + '">' + PB.icon('trash', 14) + '</button></td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      async function load() {
        try { all = await PB.api.call('customer.list'); draw(); }
        catch (e) { list.innerHTML = PB.emptyState('Gagal memuat', e.message); }
      }
      function form(c) {
        const m = PB.modal('<form class="form-modal" novalidate><div class="modal-h"><h3>' + (c ? 'Edit customer' : 'Customer baru') + '</h3><button type="button" class="icon-btn" data-close aria-label="Tutup">' + PB.icon('x', 18) + '</button></div>' +
          '<label class="field"><span class="label">Nama customer</span><input name="name" maxlength="120" value="' + E(c ? c.name : '') + '" autofocus><span class="err" data-err="name"></span></label>' +
          '<label class="field"><span class="label">No. WhatsApp</span><input name="phone" inputmode="tel" value="' + E(c ? PB.fmtPhone(c.phone) : '') + '" placeholder="0812-3456-7890"><span class="err" data-err="phone"></span></label>' +
          '<label class="field"><span class="label">Alamat</span><textarea name="address" rows="3" maxlength="300">' + E(c ? c.address : '') + '</textarea></label>' +
          '<div class="hint">Perubahan tidak mengubah invoice lama (data invoice tersimpan sebagai salinan).</div>' +
          '<div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Batal</button><button class="btn btn-primary" type="submit">Simpan</button></div></form>', { cls: 'modal-md' });
        const f = m.el.querySelector('form');
        const err = function (k, t) { m.el.querySelector('[data-err=' + k + ']').textContent = t; };
        f.onsubmit = async function (ev) {
          ev.preventDefault(); err('name', ''); err('phone', '');
          const p = { customer_id: c ? c.customer_id : undefined, name: f.name.value.trim(), phone: f.phone.value.trim(), address: f.address.value.trim() };
          if (!p.name) return err('name', 'Nama wajib diisi.');
          const btn = f.querySelector('[type=submit]'); PB.setBusy(btn, true, 'Menyimpan…');
          try {
            try { await PB.api.call('customer.save', p); }
            catch (e) {
              if (e.code !== 'DUPLICATE') throw e;
              PB.setBusy(btn, false);
              if (!(await PB.confirm({ title: 'Nama sudah ada', message: e.message + ' Tetap simpan?', confirmText: 'Tetap simpan' }))) return;
              PB.setBusy(btn, true, 'Menyimpan…');
              await PB.api.call('customer.save', Object.assign({ force: true }, p));
            }
            m.close(); await PB.refreshRef(); await load(); PB.toast('Customer disimpan.', 'success');
          } catch (e) { PB.setBusy(btn, false); err(/nomor/i.test(e.message) ? 'phone' : 'name', e.message); }
        };
      }
      $('#c-new', el).onclick = function () { form(null); };
      $('#c-q', el).oninput = function () { q = this.value; draw(); };
      list.onclick = async function (e) {
        const ed = e.target.closest('[data-edit]');
        if (ed) return form(all.filter(function (c) { return c.customer_id === ed.dataset.edit; })[0]);
        const del = e.target.closest('[data-del]');
        if (del) {
          const c = all.filter(function (x) { return x.customer_id === del.dataset.del; })[0];
          const ok = await PB.confirm({ danger: true, title: 'Hapus customer?', message: c.name + ' akan disembunyikan dari daftar. Invoice lama tetap utuh (' + c.invoice_count + ' invoice).', confirmText: 'Ya, hapus' });
          if (!ok) return;
          try { await PB.api.call('customer.delete', { customer_id: c.customer_id }); await PB.refreshRef(); await load(); PB.toast('Customer dihapus.', 'success'); }
          catch (er) { PB.toast(er.message, 'error'); }
        }
      };
      load();
    }
  };
})(window.PB);

/* Pengaturan: identitas usaha & logo, rekening bank, katalog produk, penomoran & teks */
(function (PB) {
  'use strict';
  const E = PB.esc, $ = PB.$;

  PB.views.settings = {
    mount: function (el) {
      const S = PB.state;
      let tab = 'identity';
      el.innerHTML = '<div class="page-head"><div><h1>Pengaturan</h1><p class="muted">Identitas usaha, rekening, katalog, dan penomoran</p></div></div>' +
        '<div class="tabs" id="s-tabs"><button data-t="identity" class="on">Identitas</button><button data-t="banks">Rekening</button><button data-t="catalog">Katalog</button><button data-t="numbering">Penomoran & Teks</button></div>' +
        '<div id="s-body"></div>';
      const body = $('#s-body', el);

      function field(key, label, opts) {
        opts = opts || {};
        const v = S.settings[key] || '';
        return '<label class="field"><span class="label">' + label + '</span>' + (opts.area
          ? '<textarea name="' + key + '" rows="' + opts.area + '" maxlength="' + (opts.max || 300) + '">' + E(v) + '</textarea>'
          : '<input name="' + key + '" value="' + E(v) + '" maxlength="' + (opts.max || 120) + '" placeholder="' + E(opts.ph || '') + '">') + '<span class="err" data-err="' + key + '"></span></label>';
      }
      async function saveSettings(form, keys, btn) {
        const data = {}; keys.forEach(function (k) { data[k] = form[k].value; });
        PB.setBusy(btn, true, 'Menyimpan…');
        try { S.settings = await PB.api.call('settings.save', data); PB.toast('Pengaturan disimpan.', 'success'); }
        catch (e) { PB.toast(e.message, 'error'); } finally { PB.setBusy(btn, false); }
      }

      // --- identitas ---
      function identity() {
        body.innerHTML = '<div class="grid-2"><section class="panel"><h3>Identitas usaha</h3><form id="f-id" novalidate>' +
          field('business_name', 'Nama usaha') + field('tagline', 'Tagline') + field('address', 'Alamat usaha', { area: 2, max: 300 }) +
          '<div class="row-2">' + field('whatsapp', 'WhatsApp usaha', { ph: '0812-…' }) + field('instagram', 'Instagram', { ph: '@pingbro' }) + '</div>' + field('email', 'Email (opsional)') +
          field('closing_note', 'Catatan penutup di invoice', { area: 3, max: 600 }) +
          '<button class="btn btn-primary" type="submit">' + PB.icon('save', 16) + 'Simpan</button></form></section>' +
          '<section class="panel"><h3>Logo invoice</h3><p class="muted small">Ganti logo bila perlu. PNG/JPG/WEBP, otomatis diperkecil.</p>' +
          '<div class="logo-box"><div class="logo-prev light"><img id="lg-light" src="' + E(S.logos.light) + '" alt="Logo untuk invoice (latar putih)"></div><div class="logo-cap">Logo untuk invoice (latar terang)</div>' +
          '<label class="btn btn-secondary file-btn">' + PB.icon('upload', 16) + 'Ganti logo terang<input type="file" accept="image/png,image/jpeg,image/webp" data-logo="light" hidden></label></div>' +
          '<div class="logo-box"><div class="logo-prev dark"><img id="lg-dark" src="' + E(S.logos.dark) + '" alt="Logo untuk aplikasi (latar gelap)"></div><div class="logo-cap">Logo untuk aplikasi (latar gelap)</div>' +
          '<label class="btn btn-secondary file-btn">' + PB.icon('upload', 16) + 'Ganti logo gelap<input type="file" accept="image/png,image/jpeg,image/webp" data-logo="dark" hidden></label></div></section></div>';
        $('#f-id', body).onsubmit = function (e) { e.preventDefault(); saveSettings(this, ['business_name', 'tagline', 'address', 'whatsapp', 'instagram', 'email', 'closing_note'], this.querySelector('[type=submit]')); };
        PB.$$('[data-logo]', body).forEach(function (inp) {
          inp.onchange = async function () {
            const file = inp.files[0]; if (!file) return; inp.value = '';
            const v = inp.dataset.logo;
            try {
              PB.toast('Mengunggah logo…', 'info', { duration: 1500 });
              const img = await PB.resizeImage(file, 1200, true);
              await PB.api.call('file.uploadLogo', { variant: v, mime: img.mime, base64: img.base64 });
              S.logos[v] = img.dataUrl; $('#lg-' + v, body).src = img.dataUrl;
              if (v === 'dark') PB.$$('.side-brand img,.topbar img').forEach(function (i) { i.src = img.dataUrl; });
              S.settings['has_logo_' + v] = true;
              PB.toast('Logo diperbarui.', 'success');
            } catch (e) { PB.toast(e.message, 'error'); }
          };
        });
      }

      // --- rekening ---
      function banks() {
        const rows = S.banks;
        body.innerHTML = '<section class="panel"><div class="panel-head"><h3>Rekening bank</h3><button class="btn btn-primary" id="b-new">' + PB.icon('plus', 16) + 'Tambah rekening</button></div>' +
          (rows.length ? '<div class="cards-list">' + rows.map(function (b) {
            return '<div class="bank-row"><div class="bank-chip">' + E(b.bank_name.toUpperCase()) + '</div><div class="grow"><b>' + E(b.account_no) + '</b><div class="muted small">a.n. ' + E(b.account_holder) + '</div></div>' +
              (b.is_default ? '<span class="tag gold">Utama</span>' : '') + (!b.is_active ? '<span class="tag">Nonaktif</span>' : '') +
              '<div class="nowrap"><button class="btn btn-sm btn-secondary" data-be="' + E(b.bank_id) + '">Edit</button>' +
              (!b.is_default && b.is_active ? '<button class="btn btn-sm btn-ghost" data-bd="' + E(b.bank_id) + '">Jadikan utama</button>' : '') +
              '<button class="btn btn-sm btn-danger-ghost" data-bx="' + E(b.bank_id) + '" aria-label="Hapus rekening">' + PB.icon('trash', 14) + '</button></div></div>';
          }).join('') + '</div>' : PB.emptyState('Belum ada rekening', 'Tambahkan rekening agar tampil di invoice.')) + '</section>';
        $('#b-new', body).onclick = function () { bankForm(null); };
        body.onclick = async function (e) {
          const find = function (id) { return S.banks.filter(function (b) { return b.bank_id === id; })[0]; };
          const be = e.target.closest('[data-be]'), bd = e.target.closest('[data-bd]'), bx = e.target.closest('[data-bx]');
          try {
            if (be) bankForm(find(be.dataset.be));
            else if (bd) { await PB.api.call('bank.save', Object.assign({}, find(bd.dataset.bd), { is_default: true })); await PB.refreshRef(); banks(); PB.toast('Rekening utama diganti.', 'success'); }
            else if (bx) {
              if (await PB.confirm({ danger: true, title: 'Hapus rekening?', message: 'Invoice lama tetap menampilkan rekening ini (tersimpan sebagai salinan).', confirmText: 'Ya, hapus' })) {
                await PB.api.call('bank.delete', { bank_id: bx.dataset.bx }); await PB.refreshRef(); banks(); PB.toast('Rekening dihapus.', 'success');
              }
            }
          } catch (er) { PB.toast(er.message, 'error'); }
        };
      }
      function bankForm(b) {
        const m = PB.modal('<form class="form-modal" novalidate><div class="modal-h"><h3>' + (b ? 'Edit rekening' : 'Tambah rekening') + '</h3><button type="button" class="icon-btn" data-close aria-label="Tutup">' + PB.icon('x', 18) + '</button></div>' +
          '<label class="field"><span class="label">Nama bank</span><input name="bank_name" maxlength="60" value="' + E(b ? b.bank_name : '') + '" placeholder="BCA, BRI, Mandiri…" autofocus><span class="err" data-err="bank_name"></span></label>' +
          '<label class="field"><span class="label">Nomor rekening</span><input name="account_no" inputmode="numeric" maxlength="40" value="' + E(b ? b.account_no : '') + '"><span class="err" data-err="account_no"></span></label>' +
          '<label class="field"><span class="label">Nama pemilik</span><input name="account_holder" maxlength="100" value="' + E(b ? b.account_holder : '') + '"><span class="err" data-err="account_holder"></span></label>' +
          '<label class="check"><input type="checkbox" name="is_active"' + (!b || b.is_active ? ' checked' : '') + '> Aktif (bisa dipilih di invoice)</label>' +
          '<div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Batal</button><button class="btn btn-primary" type="submit">Simpan</button></div></form>', { cls: 'modal-md' });
        const f = m.el.querySelector('form');
        f.onsubmit = async function (ev) {
          ev.preventDefault();
          PB.$$('.err', m.el).forEach(function (x) { x.textContent = ''; });
          let bad = false;
          ['bank_name', 'account_no', 'account_holder'].forEach(function (k) { if (!f[k].value.trim()) { m.el.querySelector('[data-err=' + k + ']').textContent = 'Wajib diisi.'; bad = true; } });
          if (bad) return;
          const btn = f.querySelector('[type=submit]'); PB.setBusy(btn, true, 'Menyimpan…');
          try {
            await PB.api.call('bank.save', { bank_id: b ? b.bank_id : undefined, bank_name: f.bank_name.value.trim(), account_no: f.account_no.value.trim(), account_holder: f.account_holder.value.trim(), is_active: f.is_active.checked });
            m.close(); await PB.refreshRef(); banks(); PB.toast('Rekening disimpan.', 'success');
          } catch (e) { PB.setBusy(btn, false); m.el.querySelector('[data-err=account_no]').textContent = e.message; }
        };
      }

      // --- katalog ---
      function catalog() {
        const rows = S.products;
        body.innerHTML = '<section class="panel"><div class="panel-head"><h3>Katalog produk & jasa</h3><button class="btn btn-primary" id="p-new">' + PB.icon('plus', 16) + 'Tambah produk</button></div>' +
          '<p class="muted small">Produk aktif muncul sebagai saran saat mengisi item invoice. Harga di invoice tetap bisa diubah per transaksi.</p>' +
          (rows.length ? '<div class="table-wrap"><table class="tbl rs"><thead><tr><th>Nama</th><th>Kategori</th><th class="r">Harga</th><th>Status</th><th></th></tr></thead><tbody>' +
            rows.map(function (p) {
              return '<tr><td data-l="Nama"><b>' + E(p.name) + '</b><div class="muted small">' + E(p.description) + '</div></td><td data-l="Kategori">' + E(p.category || '–') + '</td><td class="r" data-l="Harga">' + PB.fmtRp(p.unit_price) + ' <span class="muted small">/ ' + E(p.unit) + '</span></td><td data-l="Status">' + (p.is_active ? '<span class="tag green">Aktif</span>' : '<span class="tag">Nonaktif</span>') + '</td>' +
                '<td class="r nowrap act"><button class="btn btn-sm btn-secondary" data-pe="' + E(p.product_id) + '">Edit</button><button class="btn btn-sm btn-ghost" data-pt="' + E(p.product_id) + '">' + (p.is_active ? 'Nonaktifkan' : 'Aktifkan') + '</button></td></tr>';
            }).join('') + '</tbody></table></div>' : PB.emptyState('Katalog masih kosong', 'Tambahkan produk yang sering dijual, mis. Jersey Futsal atau Kaos Sablon.')) + '</section>';
        $('#p-new', body).onclick = function () { prodForm(null); };
        body.onclick = async function (e) {
          const pe = e.target.closest('[data-pe]'), pt = e.target.closest('[data-pt]');
          const find = function (id) { return S.products.filter(function (p) { return p.product_id === id; })[0]; };
          try {
            if (pe) prodForm(find(pe.dataset.pe));
            else if (pt) { await PB.api.call('product.toggle', { product_id: pt.dataset.pt }); await PB.refreshRef(); catalog(); }
          } catch (er) { PB.toast(er.message, 'error'); }
        };
      }
      function prodForm(p) {
        const m = PB.modal('<form class="form-modal" novalidate><div class="modal-h"><h3>' + (p ? 'Edit produk' : 'Tambah produk') + '</h3><button type="button" class="icon-btn" data-close aria-label="Tutup">' + PB.icon('x', 18) + '</button></div>' +
          '<label class="field"><span class="label">Nama produk / jasa</span><input name="name" maxlength="150" value="' + E(p ? p.name : '') + '" autofocus><span class="err" data-err="name"></span></label>' +
          '<div class="row-3"><label class="field"><span class="label">Kategori</span><input name="category" maxlength="80" value="' + E(p ? p.category : '') + '"></label>' +
          '<label class="field"><span class="label">Satuan</span><input name="unit" maxlength="20" value="' + E(p ? p.unit : 'pcs') + '"></label>' +
          '<label class="field"><span class="label">Harga (Rp)</span><input name="unit_price" inputmode="numeric" value="' + (p && p.unit_price ? PB.fmtNum(p.unit_price) : '') + '"></label></div>' +
          '<label class="field"><span class="label">Deskripsi bawaan (opsional)</span><textarea name="description" rows="2" maxlength="600">' + E(p ? p.description : '') + '</textarea></label>' +
          '<div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Batal</button><button class="btn btn-primary" type="submit">Simpan</button></div></form>', { cls: 'modal-md' });
        const f = m.el.querySelector('form');
        f.unit_price.oninput = function () { PB.maskMoney(f.unit_price); };
        f.onsubmit = async function (ev) {
          ev.preventDefault();
          if (!f.name.value.trim()) { m.el.querySelector('[data-err=name]').textContent = 'Nama wajib diisi.'; return; }
          const btn = f.querySelector('[type=submit]'); PB.setBusy(btn, true, 'Menyimpan…');
          try {
            await PB.api.call('product.save', { product_id: p ? p.product_id : undefined, name: f.name.value.trim(), category: f.category.value.trim(), unit: f.unit.value.trim(), unit_price: PB.parseNum(f.unit_price.value), description: f.description.value.trim() });
            m.close(); await PB.refreshRef(); catalog(); PB.toast('Produk disimpan.', 'success');
          } catch (e) { PB.setBusy(btn, false); m.el.querySelector('[data-err=name]').textContent = e.message; }
        };
      }

      // --- penomoran & teks ---
      function numbering() {
        const pre = S.settings.invoice_prefix || 'INV', dg = parseInt(S.settings.invoice_digits, 10) || 3;
        body.innerHTML = '<div class="grid-2"><section class="panel"><h3>Penomoran invoice</h3><form id="f-num" novalidate>' +
          '<div class="row-2">' + field('invoice_prefix', 'Awalan', { max: 10, ph: 'INV' }) + field('invoice_digits', 'Jumlah digit urut', { max: 1, ph: '3' }) + '</div>' +
          '<div class="hint">Contoh nomor berikutnya: <b id="num-ex">' + E(pre) + '/' + PB.todayIso().substring(0, 4) + '/' + '1'.padStart(dg, '0') + '</b>. Urutan mulai dari awal setiap tahun dan nomor tidak pernah dipakai ulang. Perubahan berlaku untuk invoice berikutnya.</div>' +
          '<button class="btn btn-primary" type="submit">' + PB.icon('save', 16) + 'Simpan</button></form></section>' +
          '<section class="panel"><h3>Template pesan WhatsApp</h3><form id="f-wa" novalidate>' + field('wa_template', 'Isi pesan', { area: 6, max: 800 }) +
          '<div class="hint">Variabel: <code>{nama}</code> <code>{no_invoice}</code> <code>{total}</code> <code>{sisa}</code></div>' +
          '<button class="btn btn-primary" type="submit">' + PB.icon('save', 16) + 'Simpan</button></form></section></div>';
        const f1 = $('#f-num', body), upd = function () { const d = Math.max(1, Math.min(8, parseInt(f1.invoice_digits.value, 10) || 3)); $('#num-ex', body).textContent = (f1.invoice_prefix.value.toUpperCase() || 'INV') + '/' + PB.todayIso().substring(0, 4) + '/' + '1'.padStart(d, '0'); };
        f1.invoice_prefix.oninput = upd; f1.invoice_digits.oninput = upd;
        f1.onsubmit = function (e) { e.preventDefault(); saveSettings(f1, ['invoice_prefix', 'invoice_digits'], f1.querySelector('[type=submit]')).then(numbering); };
        $('#f-wa', body).onsubmit = function (e) { e.preventDefault(); saveSettings(this, ['wa_template'], this.querySelector('[type=submit]')); };
      }

      const T = { identity: identity, banks: banks, catalog: catalog, numbering: numbering };
      function show(t) {
        tab = t; body.onclick = null;
        PB.$$('#s-tabs button', el).forEach(function (b) { b.classList.toggle('on', b.dataset.t === t); });
        T[t]();
      }
      $('#s-tabs', el).onclick = function (e) { const b = e.target.closest('button'); if (b) show(b.dataset.t); };
      show(tab);
    }
  };
})(window.PB);

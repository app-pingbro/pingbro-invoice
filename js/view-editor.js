/* Buat / Edit Invoice: formulir di kiri, preview A4 di kanan */
(function (PB) {
  'use strict';
  const E = PB.esc, $ = PB.$;
  const DRAFT_KEY = 'pb_draft_new_v1';

  // ---------- Helper bersama (dipakai juga oleh Riwayat) ----------
  /** Dari respons invoice.get/save menjadi model lembar A4 */
  PB.invoiceModel = function (full) {
    const inv = full.invoice;
    return {
      settings: PB.state.settings, logo: PB.state.logos.light,
      invoice_no: inv.invoice_no, invoice_date: inv.invoice_date, order_code: inv.order_code,
      customer_name: inv.customer_name_snap, customer_phone: inv.customer_phone_snap, customer_address: inv.customer_address_snap,
      items: full.items, banks: inv.bank_snap, notes: inv.notes, paid: inv.paid_total, status: inv.payment_status
    };
  };
  PB.waText = function (inv) {
    const tpl = PB.state.settings.wa_template || '';
    return tpl.replace(/\{nama\}/g, inv.customer_name_snap).replace(/\{no_invoice\}/g, inv.invoice_no)
      .replace(/\{total\}/g, PB.fmtRp(inv.total)).replace(/\{sisa\}/g, PB.fmtRp(inv.balance));
  };
  /** Bagikan JPG via WhatsApp: Web Share API (HP) atau unduh + buka wa.me */
  PB.shareInvoice = async function (blob, inv) {
    const filename = PB.invoiceFileName(inv.invoice_no, inv.customer_name_snap);
    const text = PB.waText(inv);
    const file = new File([blob], filename, { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: text, title: inv.invoice_no }); return 'shared'; }
      catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    }
    PB.downloadBlob(blob, filename);
    const phone = PB.normPhone(inv.customer_phone_snap);
    const url = 'https://wa.me/' + (phone || '') + '?text=' + encodeURIComponent(text);
    window.open(url, '_blank', 'noopener');
    return 'link';
  };
  PB.uploadJpg = async function (invoiceId, blob) {
    const b64 = await PB.blobToBase64(blob);
    return PB.api.call('file.uploadInvoiceJpg', { invoice_id: invoiceId, base64: b64 });
  };

  function blankItem() { return { uid: PB.uid(), product_id: '', name: '', description: '', qty: 1, unit: 'pcs', unit_price: 0, discount_type: 'rp', discount_value: 0 }; }

  PB.views.editor = {
    unmount: function () { if (this._onResize) window.removeEventListener('resize', this._onResize); },
    mount: async function (el, params) {
      const self = this;
      const S = PB.state;
      const editing = !!params.id;
      const st = {
        invoice_id: null, invoice_no: '', invoice_date: S.today, order_code: '', customer_id: '',
        items: [blankItem()], bank_ids: [], notes: '', dp_amount: 0, dp_method: 'Transfer',
        paid_total: 0, status: null, jpg_url: ''
      };
      let dirty = false, busy = false, extraCustomer = null;

      // ---- muat data ----
      if (editing) {
        el.innerHTML = '<div class="page-head"><h1>Edit Invoice</h1></div>' + PB.skeleton(6);
        try {
          const full = await PB.api.call('invoice.get', { invoice_id: params.id });
          const i = full.invoice;
          Object.assign(st, {
            invoice_id: i.invoice_id, invoice_no: i.invoice_no, invoice_date: i.invoice_date, order_code: i.order_code,
            customer_id: i.customer_id, notes: i.notes, paid_total: i.paid_total, status: i.payment_status, jpg_url: i.jpg_url,
            items: full.items.map(function (x) { return Object.assign({ uid: PB.uid() }, x); }),
            bank_ids: i.bank_snap.map(function (b) { return b.bank_id; }).filter(function (id) { return S.banks.some(function (b) { return b.bank_id === id && b.is_active; }); })
          });
          if (!S.customers.some(function (c) { return c.customer_id === i.customer_id; })) {
            extraCustomer = { customer_id: i.customer_id, name: i.customer_name_snap, phone: i.customer_phone_snap, address: i.customer_address_snap };
          }
        } catch (e) { el.innerHTML = PB.emptyState('Invoice tidak dapat dibuka', e.message, '<a class="btn btn-secondary" href="#/history">Kembali ke Riwayat</a>'); return; }
      } else {
        const def = S.banks.filter(function (b) { return b.is_active && b.is_default; })[0] || S.banks.filter(function (b) { return b.is_active; })[0];
        if (def) st.bank_ids = [def.bank_id];
        try {
          const raw = localStorage.getItem(DRAFT_KEY);
          if (raw) {
            const dr = JSON.parse(raw);
            if (dr && Array.isArray(dr.items) && dr.items.length) {
              Object.assign(st, { invoice_date: dr.invoice_date || st.invoice_date, order_code: dr.order_code || '', customer_id: dr.customer_id || '', notes: dr.notes || '', dp_amount: dr.dp_amount || 0, dp_method: dr.dp_method || 'Transfer' });
              st.items = dr.items.map(function (x) { return Object.assign(blankItem(), x, { uid: PB.uid() }); });
              if (Array.isArray(dr.bank_ids) && dr.bank_ids.length) st.bank_ids = dr.bank_ids.filter(function (id) { return S.banks.some(function (b) { return b.bank_id === id && b.is_active; }); });
              if (st.customer_id && !S.customers.some(function (c) { return c.customer_id === st.customer_id; })) st.customer_id = '';
              setTimeout(function () { PB.toast('Draf terakhir dipulihkan.', 'info', { action: { label: 'Mulai baru', onClick: function () { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} PB.router(); } } }); }, 200);
            }
          }
        } catch (e) {}
      }

      const customers = function () { return extraCustomer ? S.customers.concat([extraCustomer]) : S.customers; };
      const customer = function () { return customers().filter(function (c) { return c.customer_id === st.customer_id; })[0] || null; };

      // ---- kerangka ----
      el.innerHTML =
        '<div class="page-head"><div><h1>' + (editing ? 'Edit Invoice' : 'Buat Invoice') + '</h1>' +
        '<p class="muted">' + (editing ? E(st.invoice_no) + ' · nomor tidak berubah' : 'Isi data di kiri, preview invoice tampil langsung di kanan') + '</p></div></div>' +
        '<div class="seg" id="ed-seg"><button type="button" data-pane="form" class="on">Formulir</button><button type="button" data-pane="preview">Preview</button></div>' +
        '<div class="editor" data-pane="form">' +
          '<div class="ed-form" id="ed-form"></div>' +
          '<div class="ed-preview"><div class="preview-bar"><span>Preview A4</span><span class="muted small">Sama persis dengan hasil JPG</span></div>' +
          '<div class="preview-wrap" id="ed-prev"></div></div>' +
        '</div>' +
        '<div class="actionbar" id="ed-actions"></div>';

      const root = $('#ed-form', el);
      const actions = $('#ed-actions', el);

      function section(n, title, body) { return '<section class="card"><div class="card-h"><span class="num">' + n + '</span><h3>' + title + '</h3></div>' + body + '</section>'; }

      function itemCard(it, idx) {
        const c = PB.sheet.calc([it]).items[0];
        return '<div class="item" data-uid="' + it.uid + '">' +
          '<div class="item-top"><span class="item-n">Item ' + (idx + 1) + '</span>' +
          '<button type="button" class="icon-btn danger" data-act="del" aria-label="Hapus item ' + (idx + 1) + '"' + (st.items.length === 1 ? ' disabled' : '') + '>' + PB.icon('trash', 16) + '</button></div>' +
          '<label class="field"><span class="label">Nama produk / jasa</span><input type="text" data-f="name" list="dl-products" maxlength="150" value="' + E(it.name) + '" placeholder="mis. Jersey Futsal Custom" autocomplete="off"><span class="err" data-err="name"></span></label>' +
          '<label class="field"><span class="label">Deskripsi (opsional)</span><textarea data-f="description" rows="2" maxlength="1200" placeholder="Ukuran, bahan, warna, catatan produksi…">' + E(it.description) + '</textarea></label>' +
          '<div class="row-3"><label class="field"><span class="label">Qty</span><input type="text" inputmode="decimal" data-f="qty" value="' + E(PB.fmtQty(it.qty)) + '"><span class="err" data-err="qty"></span></label>' +
          '<label class="field"><span class="label">Satuan</span><input type="text" data-f="unit" maxlength="20" value="' + E(it.unit) + '"></label>' +
          '<label class="field"><span class="label">Harga satuan (Rp)</span><input type="text" inputmode="numeric" data-f="unit_price" value="' + (it.unit_price ? PB.fmtNum(it.unit_price) : '') + '" placeholder="0"><span class="err" data-err="unit_price"></span></label></div>' +
          '<div class="row-disc"><div class="field"><span class="label">Diskon</span><div class="disc"><div class="seg seg-sm" data-f="discount_type"><button type="button" data-v="rp" class="' + (it.discount_type === 'rp' ? 'on' : '') + '">Rp</button><button type="button" data-v="persen" class="' + (it.discount_type === 'persen' ? 'on' : '') + '">%</button></div>' +
          '<input type="text" inputmode="decimal" data-f="discount_value" value="' + (it.discount_value ? (it.discount_type === 'rp' ? PB.fmtNum(it.discount_value) : String(it.discount_value).replace('.', ',')) : '') + '" placeholder="0"></div><span class="err" data-err="discount_value"></span></div>' +
          '<div class="line-total"><span>Jumlah</span><b data-line>' + PB.fmtRp(c.line_total) + '</b></div></div>' +
        '</div>';
      }

      function renderForm() {
        const cust = customer();
        const activeBanks = S.banks.filter(function (b) { return b.is_active; });
        const custOpts = '<option value="">— Pilih customer —</option>' + customers().map(function (c) { return '<option value="' + E(c.customer_id) + '"' + (c.customer_id === st.customer_id ? ' selected' : '') + '>' + E(c.name) + '</option>'; }).join('');
        root.innerHTML =
          '<datalist id="dl-products">' + S.products.filter(function (p) { return p.is_active; }).map(function (p) { return '<option value="' + E(p.name) + '">' + PB.fmtRp(p.unit_price) + '</option>'; }).join('') + '</datalist>' +
          section(1, 'Informasi Invoice',
            '<div class="row-2"><label class="field"><span class="label">Tanggal invoice</span><input type="date" id="f-date" value="' + E(st.invoice_date) + '"><span class="err" data-err="invoice_date"></span></label>' +
            '<label class="field"><span class="label">Kode Order (opsional)</span><input type="text" id="f-order" maxlength="40" value="' + E(st.order_code) + '" placeholder="mis. ORD-0142"></label></div>' +
            '<div class="hint">' + PB.icon('hash', 14) + (editing ? 'Nomor invoice: <b>' + E(st.invoice_no) + '</b>' : 'Nomor invoice dibuat otomatis saat disimpan.') + '</div>') +
          section(2, 'Customer',
            '<div class="cust-row"><label class="field grow"><span class="label">Pilih customer</span><select id="f-cust">' + custOpts + '</select><span class="err" data-err="customer"></span></label>' +
            '<button type="button" class="btn btn-secondary" id="btn-newcust">' + PB.icon('plus', 16) + 'Customer baru</button></div>' +
            (cust ? '<div class="cust-card"><div>' + PB.icon('phone', 14) + (cust.phone ? E(PB.fmtPhone(cust.phone)) : '<span class="muted">Tanpa nomor</span>') + '</div><div>' + PB.icon('pin', 14) + (cust.address ? E(cust.address) : '<span class="muted">Tanpa alamat</span>') + '</div></div>' : '')) +
          section(3, 'Item Invoice', '<div id="items">' + st.items.map(itemCard).join('') + '</div><button type="button" class="btn btn-ghost add-item" id="btn-additem">' + PB.icon('plus', 16) + 'Tambah item</button>') +
          section(4, 'Pembayaran',
            editing
              ? '<div class="hint">' + PB.icon('check', 14) + 'Sudah dibayar: <b>' + PB.fmtRp(st.paid_total) + '</b>. Catat atau batalkan pembayaran dari menu <a class="link" href="#/history">Riwayat</a>.</div>'
              : '<div class="row-2"><label class="field"><span class="label">Uang muka / DP (opsional)</span><input type="text" inputmode="numeric" id="f-dp" value="' + (st.dp_amount ? PB.fmtNum(st.dp_amount) : '') + '" placeholder="0"><span class="err" data-err="dp"></span></label>' +
                '<label class="field"><span class="label">Metode</span><select id="f-dpm">' + S.methods.map(function (m) { return '<option' + (m === st.dp_method ? ' selected' : '') + '>' + E(m) + '</option>'; }).join('') + '</select></label></div>') +
          section(5, 'Rekening Pembayaran',
            activeBanks.length
              ? '<div class="chips" id="banks">' + activeBanks.map(function (b) {
                  return '<button type="button" class="chip' + (st.bank_ids.indexOf(b.bank_id) >= 0 ? ' on' : '') + '" data-bank="' + E(b.bank_id) + '" aria-pressed="' + (st.bank_ids.indexOf(b.bank_id) >= 0) + '"><b>' + E(b.bank_name) + '</b><span>' + E(b.account_no) + ' · ' + E(b.account_holder) + '</span></button>';
                }).join('') + '</div><span class="err" data-err="banks"></span>'
              : '<div class="empty-inline">Belum ada rekening aktif. <a class="link" href="#/settings">Tambah rekening di Pengaturan</a>.<span class="err" data-err="banks"></span></div>') +
          section(6, 'Catatan', '<label class="field"><span class="label">Catatan di invoice (opsional)</span><textarea id="f-notes" rows="3" maxlength="800" placeholder="mis. Produksi 14 hari kerja setelah DP.">' + E(st.notes) + '</textarea></label>');
        bindForm();
      }

      // ---- ringkasan & preview ----
      function totals() {
        const c = PB.sheet.calc(st.items);
        const paid = editing ? st.paid_total : Math.min(st.dp_amount || 0, c.total);
        return { c: c, paid: paid, balance: Math.max(0, c.total - paid) };
      }
      function model() {
        const cu = customer(), t = totals();
        return {
          settings: S.settings, logo: S.logos.light, invoice_no: st.invoice_no, invoice_date: st.invoice_date, order_code: st.order_code,
          customer_name: cu ? cu.name : '', customer_phone: cu ? cu.phone : '', customer_address: cu ? cu.address : '',
          items: st.items, banks: S.banks.filter(function (b) { return st.bank_ids.indexOf(b.bank_id) >= 0; }), notes: st.notes, paid: t.paid
        };
      }
      const prev = $('#ed-prev', el);
      function renderPreview() { prev.innerHTML = PB.sheet.render(model()); PB.sheet.fit(prev); }
      const refreshPreview = PB.debounce(renderPreview, 120);

      function renderActions() {
        const t = totals();
        actions.innerHTML =
          '<div class="sumbar"><div><span>Total</span><b>' + PB.fmtRp(t.c.total) + '</b></div>' +
          (t.c.total_discount ? '<div class="hide-sm"><span>Diskon</span><b>- ' + PB.fmtRp(t.c.total_discount) + '</b></div>' : '') +
          '<div class="hide-sm"><span>Dibayar</span><b>' + PB.fmtRp(t.paid) + '</b></div><div class="due"><span>Sisa</span><b>' + PB.fmtRp(t.balance) + '</b></div></div>' +
          '<div class="btns"><button class="btn btn-secondary" id="a-jpg" type="button">' + PB.icon('download', 16) + '<span>Unduh JPG</span></button>' +
          '<button class="btn btn-wa" id="a-wa" type="button">' + PB.icon('whatsapp', 16) + '<span>WhatsApp</span></button>' +
          '<button class="btn btn-primary" id="a-save" type="button">' + PB.icon('save', 16) + '<span>' + (editing || st.invoice_id ? 'Simpan Perubahan' : 'Simpan Invoice') + '</span></button></div>';
        $('#a-save', actions).onclick = function () { run('save', this); };
        $('#a-jpg', actions).onclick = function () { run('jpg', this); };
        $('#a-wa', actions).onclick = function () { run('wa', this); };
      }

      function changed() {
        dirty = true;
        refreshPreview(); renderActions(); saveDraft();
      }
      function saveDraft() {
        if (editing || st.invoice_id) return;
        try {
          localStorage.setItem(DRAFT_KEY, JSON.stringify({
            invoice_date: st.invoice_date, order_code: st.order_code, customer_id: st.customer_id, notes: st.notes,
            dp_amount: st.dp_amount, dp_method: st.dp_method, bank_ids: st.bank_ids,
            items: st.items.map(function (i) { const o = Object.assign({}, i); delete o.uid; return o; })
          }));
        } catch (e) {}
      }

      // ---- binding ----
      function item(uid) { return st.items.filter(function (i) { return i.uid === uid; })[0]; }
      function clearErr() { PB.$$('.err', root).forEach(function (x) { x.textContent = ''; }); PB.$$('.invalid', root).forEach(function (x) { x.classList.remove('invalid'); }); }
      function setErr(sel, msg, scope) {
        const box = (scope || root).querySelector('[data-err="' + sel + '"]');
        if (box) { box.textContent = msg; const inp = box.parentElement.querySelector('input,select,textarea'); if (inp) inp.classList.add('invalid'); }
      }

      function bindForm() {
        $('#f-date', root).onchange = function () { st.invoice_date = this.value; changed(); };
        $('#f-order', root).oninput = function () { st.order_code = this.value; changed(); };
        $('#f-cust', root).onchange = function () { st.customer_id = this.value; renderForm(); changed(); };
        $('#btn-newcust', root).onclick = function () { customerModal(); };
        const dp = $('#f-dp', root);
        if (dp) { dp.oninput = function () { st.dp_amount = PB.maskMoney(dp); changed(); }; $('#f-dpm', root).onchange = function () { st.dp_method = this.value; saveDraft(); }; }
        $('#f-notes', root).oninput = function () { st.notes = this.value; changed(); };
        $('#btn-additem', root).onclick = function () {
          st.items.push(blankItem()); renderForm(); changed();
          const cards = PB.$$('.item', root); const last = cards[cards.length - 1];
          if (last) { last.scrollIntoView({ block: 'center', behavior: 'smooth' }); const f = last.querySelector('input'); if (f) f.focus(); }
        };
        const banks = $('#banks', root);
        if (banks) banks.onclick = function (e) {
          const b = e.target.closest('[data-bank]'); if (!b) return;
          const id = b.dataset.bank, i = st.bank_ids.indexOf(id);
          if (i >= 0) st.bank_ids.splice(i, 1); else { if (st.bank_ids.length >= 4) { PB.toast('Maksimal 4 rekening per invoice.', 'warning'); return; } st.bank_ids.push(id); }
          b.classList.toggle('on', i < 0); b.setAttribute('aria-pressed', String(i < 0)); changed();
        };
        const items = $('#items', root);
        items.oninput = function (e) {
          const card = e.target.closest('.item'); if (!card) return;
          const it = item(card.dataset.uid), f = e.target.dataset.f; if (!it || !f) return;
          if (f === 'unit_price') it.unit_price = PB.maskMoney(e.target);
          else if (f === 'qty') it.qty = PB.parseQty(e.target.value);
          else if (f === 'discount_value') {
            if (it.discount_type === 'rp') it.discount_value = PB.maskMoney(e.target); else it.discount_value = PB.parseQty(e.target.value);
          } else it[f] = e.target.value;
          card.querySelector('[data-line]').textContent = PB.fmtRp(PB.sheet.calc([it]).items[0].line_total);
          changed();
        };
        items.onchange = function (e) {   // pilih produk dari katalog → isi otomatis
          const card = e.target.closest('.item'); if (!card || e.target.dataset.f !== 'name') return;
          const it = item(card.dataset.uid);
          const p = S.products.filter(function (x) { return x.is_active && x.name.toLowerCase() === it.name.trim().toLowerCase(); })[0];
          if (p) {
            it.product_id = p.product_id; it.unit = p.unit || it.unit; if (!it.unit_price) it.unit_price = p.unit_price;
            if (!it.description && p.description) it.description = p.description;
            renderForm(); changed();
          } else it.product_id = '';
        };
        items.onclick = function (e) {
          const card = e.target.closest('.item'); if (!card) return;
          const it = item(card.dataset.uid);
          const del = e.target.closest('[data-act=del]');
          if (del && st.items.length > 1) { st.items = st.items.filter(function (x) { return x !== it; }); renderForm(); changed(); return; }
          const seg = e.target.closest('[data-f=discount_type] button');
          if (seg) { it.discount_type = seg.dataset.v; it.discount_value = 0; renderForm(); changed(); }
        };
      }

      // ---- modal customer baru ----
      function customerModal() {
        const m = PB.modal('<form class="form-modal" novalidate><div class="modal-h"><h3>Customer baru</h3><button type="button" class="icon-btn" data-close aria-label="Tutup">' + PB.icon('x', 18) + '</button></div>' +
          '<label class="field"><span class="label">Nama customer</span><input name="name" maxlength="120" autofocus><span class="err" data-err="name"></span></label>' +
          '<label class="field"><span class="label">No. WhatsApp</span><input name="phone" inputmode="tel" placeholder="0812-3456-7890"><span class="err" data-err="phone"></span></label>' +
          '<label class="field"><span class="label">Alamat</span><textarea name="address" rows="2" maxlength="300"></textarea></label>' +
          '<div class="modal-actions"><button type="button" class="btn btn-secondary" data-close>Batal</button><button class="btn btn-primary" type="submit">Simpan</button></div></form>', { cls: 'modal-md' });
        m.el.querySelector('form').onsubmit = async function (ev) {
          ev.preventDefault();
          const f = this, btn = f.querySelector('[type=submit]');
          const payload = { name: f.name.value.trim(), phone: f.phone.value.trim(), address: f.address.value.trim() };
          if (!payload.name) { setErr('name', 'Nama wajib diisi.', m.el); return; }
          PB.setBusy(btn, true, 'Menyimpan…');
          try {
            let res;
            try { res = await PB.api.call('customer.save', payload); }
            catch (e) {
              if (e.code === 'DUPLICATE') {
                PB.setBusy(btn, false);
                const ok = await PB.confirm({ title: 'Nama sudah ada', message: e.message + ' Tetap simpan sebagai customer baru?', confirmText: 'Tetap simpan' });
                if (!ok) return;
                PB.setBusy(btn, true, 'Menyimpan…');
                res = await PB.api.call('customer.save', Object.assign({ force: true }, payload));
              } else throw e;
            }
            await PB.refreshRef();
            st.customer_id = res.customer_id; m.close(); renderForm(); changed();
            PB.toast('Customer ditambahkan.', 'success');
          } catch (e) { PB.setBusy(btn, false); setErr(e.code === 'VALIDATION' && /nomor/i.test(e.message) ? 'phone' : 'name', e.message, m.el); }
        };
      }

      // ---- validasi & simpan ----
      function validate() {
        clearErr();
        let first = null, ok = true;
        function bad(sel, msg) { ok = false; setErr(sel, msg); if (!first) first = root.querySelector('[data-err="' + sel + '"]'); }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(st.invoice_date)) bad('invoice_date', 'Tanggal wajib diisi.');
        if (!st.customer_id) bad('customer', 'Pilih customer terlebih dulu.');
        st.items.forEach(function (it) {
          const card = root.querySelector('[data-uid="' + it.uid + '"]'); if (!card) return;
          const sc = function (k, msg) { ok = false; const b = card.querySelector('[data-err="' + k + '"]'); if (b) { b.textContent = msg; const inp = b.parentElement.querySelector('input'); if (inp) inp.classList.add('invalid'); if (!first) first = b; } };
          if (!it.name.trim()) sc('name', 'Nama wajib diisi.');
          if (!(it.qty > 0)) sc('qty', 'Qty harus lebih dari 0.');
          const gross = Math.round(it.qty * it.unit_price);
          if (it.discount_type === 'persen' && it.discount_value > 100) sc('discount_value', 'Maksimal 100%.');
          else if (PB.sheet.calc([it]).items[0].discount_amount >= 0 && it.discount_type === 'rp' && it.discount_value > gross) sc('discount_value', 'Diskon melebihi nilai item.');
        });
        if (!st.bank_ids.length) bad('banks', 'Pilih minimal satu rekening.');
        if (!editing && !st.invoice_id && st.dp_amount > totals().c.total) bad('dp', 'DP tidak boleh melebihi total.');
        if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return ok;
      }

      async function saveInvoice() {
        const payload = {
          invoice_id: st.invoice_id || undefined, invoice_date: st.invoice_date, order_code: st.order_code.trim(), customer_id: st.customer_id,
          bank_ids: st.bank_ids, notes: st.notes.trim(), dp_amount: st.dp_amount || 0, dp_method: st.dp_method,
          items: st.items.map(function (i) { return { product_id: i.product_id, name: i.name.trim(), description: i.description.trim(), qty: i.qty, unit: (i.unit || '').trim() || 'pcs', unit_price: i.unit_price, discount_type: i.discount_type, discount_value: i.discount_value }; })
        };
        const full = await PB.api.call('invoice.save', payload);
        const i = full.invoice;
        st.invoice_id = i.invoice_id; st.invoice_no = i.invoice_no; st.paid_total = i.paid_total; st.status = i.payment_status;
        dirty = false;
        try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
        if (full.warning) PB.toast(full.warning, 'warning');
        return full;
      }

      /** mode: save | jpg | wa */
      async function run(mode, btn) {
        if (busy) return;
        if (!validate()) { PB.toast('Lengkapi data yang ditandai merah.', 'error'); return; }
        busy = true;
        const label = { save: 'Menyimpan…', jpg: 'Menyiapkan JPG…', wa: 'Menyiapkan…' }[mode];
        PB.setBusy(btn, true, label);
        PB.$$('button', actions).forEach(function (b) { if (b !== btn) b.disabled = true; });
        let full = null;
        try {
          const needSave = dirty || !st.invoice_id || mode === 'save';
          if (needSave) full = await saveInvoice();
          else full = await PB.api.call('invoice.get', { invoice_id: st.invoice_id });
          PB.refreshRef().catch(function () {});
          const inv = full.invoice;
          const blob = await PB.sheet.toJpeg(PB.invoiceModel(full));
          const filename = PB.invoiceFileName(inv.invoice_no, inv.customer_name_snap);
          let driveMsg = '';
          if (needSave || !inv.jpg_url) {
            try { await PB.uploadJpg(inv.invoice_id, blob); driveMsg = ' Tersimpan di Google Drive.'; }
            catch (e) { PB.toast('Invoice tersimpan, tetapi JPG belum terunggah ke Drive: ' + e.message, 'warning'); }
          }
          if (mode === 'jpg') { PB.downloadBlob(blob, filename); PB.toast('JPG diunduh: ' + filename + '.' + driveMsg, 'success'); }
          else if (mode === 'wa') { const r = await PB.shareInvoice(blob, inv); if (r === 'link') PB.toast('JPG diunduh. Lampirkan ke chat WhatsApp yang terbuka.', 'info'); }
          else PB.toast('Invoice ' + inv.invoice_no + ' berhasil disimpan.' + driveMsg, 'success');
          if (!editing) { location.hash = '#/invoice/edit/' + inv.invoice_id; return; }
          st.invoice_no = inv.invoice_no; st.paid_total = inv.paid_total; renderPreview(); renderActions();
        } catch (e) {
          PB.toast(e.message || 'Gagal memproses invoice.', 'error');
        } finally {
          busy = false;
          if ($('#a-save', actions)) { renderActions(); }
        }
      }

      // ---- tab mobile ----
      const pane = $('.editor', el);
      $('#ed-seg', el).onclick = function (e) {
        const b = e.target.closest('button'); if (!b) return;
        PB.$$('#ed-seg button', el).forEach(function (x) { x.classList.toggle('on', x === b); });
        pane.dataset.pane = b.dataset.pane; actions.classList.toggle('hide-m', false);
        if (b.dataset.pane === 'preview') setTimeout(function () { PB.sheet.fit(prev); }, 30);
      };
      self._onResize = PB.debounce(function () { PB.sheet.fit(prev); }, 100);
      window.addEventListener('resize', self._onResize);

      renderForm(); renderPreview(); renderActions();
      dirty = false;
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { PB.sheet.fit(prev); });
    }
  };
})(window.PB);

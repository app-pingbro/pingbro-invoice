/* ============================================================
   PING BRO Invoice — lembar invoice A4 (preview = hasil JPG)
   Satu fungsi render dipakai untuk preview dan ekspor JPG.
   ============================================================ */
(function (PB) {
  'use strict';
  const E = PB.esc;
  const W = 794, H = 1123;

  /** Hitung total — harus sama dengan calcItems_ di server */
  function calc(items) {
    let subtotal = 0, totalDisc = 0;
    const rows = (items || []).map(function (it) {
      const qty = Number(it.qty) || 0;
      const price = Math.round(Number(it.unit_price) || 0);
      const type = it.discount_type === 'persen' ? 'persen' : 'rp';
      const dv = Number(it.discount_value) || 0;
      const gross = Math.round(qty * price);
      let disc = type === 'persen' ? Math.round(gross * Math.min(dv, 100) / 100) : Math.round(dv);
      if (disc > gross) disc = gross;
      subtotal += gross; totalDisc += disc;
      return Object.assign({}, it, { qty: qty, unit_price: price, discount_type: type, discount_amount: disc, line_total: gross - disc, gross: gross });
    });
    return { items: rows, subtotal: subtotal, total_discount: totalDisc, total: subtotal - totalDisc };
  }

  function statusStamp(status) {
    const cls = PB.statusClass(status);
    return '<div class="sh-stamp sh-stamp-' + cls + '">' + E(String(status || '').toUpperCase()) + '</div>';
  }

  function render(m) {
    const s = m.settings || {};
    const c = calc(m.items);
    const paid = Number(m.paid) || 0;
    const balance = Math.max(0, c.total - paid);
    const status = m.status || (paid <= 0 ? PB.STATUS.UNPAID : (paid >= c.total && c.total > 0 ? PB.STATUS.PAID : PB.STATUS.PARTIAL));
    const hasDisc = c.items.some(function (i) { return i.discount_amount > 0; });
    const logo = m.logo || 'assets/logo-light.png';

    const rows = c.items.length ? c.items.map(function (it, i) {
      const discTxt = it.discount_amount > 0
        ? (it.discount_type === 'persen' ? PB.fmtQty(it.discount_value) + '%' : PB.fmtRp(it.discount_amount))
        : '–';
      return '<tr>' +
        '<td class="c">' + (i + 1) + '</td>' +
        '<td><div class="it-name">' + E(it.name || '—') + '</div>' +
        (it.description ? '<div class="it-desc">' + PB.escBr(it.description) + '</div>' : '') + '</td>' +
        '<td class="c">' + PB.fmtQty(it.qty) + ' ' + E(it.unit || '') + '</td>' +
        '<td class="r">' + PB.fmtRp(it.unit_price) + '</td>' +
        (hasDisc ? '<td class="r">' + discTxt + '</td>' : '') +
        '<td class="r b">' + PB.fmtRp(it.line_total) + '</td></tr>';
    }).join('') : '<tr><td colspan="' + (hasDisc ? 6 : 5) + '" class="sh-empty">Belum ada item. Tambahkan item di formulir.</td></tr>';

    const banks = (m.banks || []).map(function (b) {
      return '<div class="sh-bank"><span class="sh-bank-chip">' + E(String(b.bank_name || '').toUpperCase()) + '</span>' +
        '<div><div class="sh-bank-no">' + E(b.account_no) + '</div><div class="sh-bank-an">a.n. ' + E(b.account_holder) + '</div></div></div>';
    }).join('');

    const contact = [];
    if (s.whatsapp) contact.push(PB.icon('phone', 13) + '<span>' + E(s.whatsapp) + '</span>');
    if (s.instagram) contact.push(PB.icon('insta', 13) + '<span>' + E(s.instagram) + '</span>');
    if (s.email) contact.push(PB.icon('mail', 13) + '<span>' + E(s.email) + '</span>');
    if (s.address) contact.push(PB.icon('pin', 13) + '<span>' + E(s.address) + '</span>');

    return '<div class="sheet" data-sheet>' +
      '<div class="sh-flame"></div>' +
      '<div class="sh-head">' +
        '<div class="sh-brand"><img class="sh-logo" src="' + E(logo) + '" alt="PING BRO"><div class="sh-tag">' + E(s.tagline || '') + '</div></div>' +
        '<div class="sh-title"><div class="sh-inv">INVOICE</div>' +
          '<div class="sh-no">' + (m.invoice_no ? E(m.invoice_no) : '<span class="sh-pending">Nomor dibuat saat disimpan</span>') + '</div>' +
          '<div class="sh-meta"><span>Tanggal</span><b>' + PB.fmtDate(m.invoice_date) + '</b></div>' +
          (m.order_code ? '<div class="sh-meta"><span>Kode Order</span><b>' + E(m.order_code) + '</b></div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="sh-bar"></div>' +
      '<div class="sh-to"><div class="sh-lbl">Ditagihkan kepada</div>' +
        '<div class="sh-cust">' + (m.customer_name ? E(m.customer_name) : '<span class="sh-pending">Pilih customer</span>') + '</div>' +
        (m.customer_phone ? '<div class="sh-line">' + PB.icon('phone', 12) + E(PB.fmtPhone(m.customer_phone)) + '</div>' : '') +
        (m.customer_address ? '<div class="sh-line">' + PB.icon('pin', 12) + PB.escBr(m.customer_address) + '</div>' : '') +
      '</div>' +
      '<table class="sh-table"><thead><tr><th class="c" style="width:34px">No</th><th>Deskripsi</th><th class="c" style="width:84px">Qty</th><th class="r" style="width:104px">Harga</th>' +
        (hasDisc ? '<th class="r" style="width:92px">Diskon</th>' : '') + '<th class="r" style="width:116px">Jumlah</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="sh-bottom">' +
        '<div class="sh-left">' +
          (banks ? '<div class="sh-lbl">Pembayaran via transfer</div>' + banks : '') +
          (m.notes ? '<div class="sh-lbl" style="margin-top:12px">Catatan</div><div class="sh-notes">' + PB.escBr(m.notes) + '</div>' : '') +
        '</div>' +
        '<div class="sh-right"><div class="sh-sum">' +
          '<div class="row"><span>Subtotal</span><b>' + PB.fmtRp(c.subtotal) + '</b></div>' +
          (c.total_discount > 0 ? '<div class="row disc"><span>Total diskon</span><b>- ' + PB.fmtRp(c.total_discount) + '</b></div>' : '') +
          '<div class="row total"><span>TOTAL</span><b>' + PB.fmtRp(c.total) + '</b></div>' +
          (paid > 0 ? '<div class="row"><span>Sudah dibayar</span><b>' + PB.fmtRp(paid) + '</b></div>' : '') +
          '<div class="row due"><span>Sisa tagihan</span><b>' + PB.fmtRp(balance) + '</b></div>' +
        '</div>' + statusStamp(status) + '</div>' +
      '</div>' +
      '<div class="sh-thanks"><div class="sh-script">Terima Kasih</div>' +
        (s.closing_note ? '<div class="sh-closing">' + PB.escBr(s.closing_note) + '</div>' : '') + '</div>' +
      '<div class="sh-foot">' + contact.map(function (x) { return '<div class="ct">' + x + '</div>'; }).join('') + '</div>' +
    '</div>';
  }

  /** Skala preview agar muat di wadah */
  function fit(wrap) {
    const sheet = wrap.querySelector('.sheet');
    if (!sheet) return;
    const avail = wrap.clientWidth || W;
    const sc = Math.min(1, avail / W);
    const h = Math.max(H, sheet.offsetHeight);
    sheet.style.transform = 'scale(' + sc + ')';
    wrap.style.height = Math.round(h * sc) + 'px';
  }

  async function waitImages(root) {
    const imgs = Array.prototype.slice.call(root.querySelectorAll('img'));
    await Promise.all(imgs.map(function (im) {
      return im.complete ? Promise.resolve() : new Promise(function (r) { im.onload = im.onerror = r; });
    }));
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
  }

  /** Ekspor ke Blob JPG di node tersembunyi berukuran asli 794x1123 */
  async function toJpeg(model) {
    if (!window.htmlToImage) throw new Error('Pustaka ekspor gambar belum termuat.');
    const host = document.createElement('div');
    host.className = 'sheet-offscreen';
    host.innerHTML = render(model);
    document.body.appendChild(host);
    try {
      const node = host.firstElementChild;
      await waitImages(host);
      await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });
      const height = Math.max(H, node.offsetHeight);
      const canvas = await window.htmlToImage.toCanvas(node, {
        pixelRatio: 2.5, backgroundColor: '#ffffff',
        width: W, height: height, style: { transform: 'none', margin: '0' }
      });
      // Selalu JPEG (toBlob bawaan pustaka bisa menghasilkan PNG)
      const blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/jpeg', 0.92); });
      if (blob && blob.type !== 'image/jpeg') throw new Error('Browser tidak dapat membuat JPG.');
      if (!blob || blob.size < 2000) throw new Error('Gagal membuat gambar JPG.');
      return blob;
    } finally { host.remove(); }
  }

  PB.sheet = { calc: calc, render: render, fit: fit, toJpeg: toJpeg, W: W, H: H };
})(window.PB);

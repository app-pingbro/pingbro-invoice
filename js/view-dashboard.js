/* Dashboard: kartu ringkasan, grafik batang bulanan, donut status, invoice terbaru */
(function (PB) {
  'use strict';
  const E = PB.esc;
  const COLORS = { 'Belum Dibayar': '#EF4444', 'Dibayar Sebagian': '#F59E0B', 'Lunas': '#10B981' };

  function barChart(monthly) {
    const W = 640, H = 240, padL = 8, padB = 28, padT = 26;
    const max = Math.max.apply(null, monthly.map(function (m) { return m.total; }).concat([1]));
    const n = monthly.length, bw = (W - padL * 2) / n;
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="Nilai invoice per bulan">';
    for (let g = 1; g <= 3; g++) {
      const y = padT + (H - padT - padB) * (1 - g / 3);
      svg += '<line x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '" class="grid"/>';
    }
    monthly.forEach(function (m, i) {
      const h = Math.max(m.total > 0 ? 3 : 0, (H - padT - padB) * (m.total / max));
      const x = padL + i * bw + bw * 0.18, w = bw * 0.64, y = H - padB - h;
      const last = i === n - 1;
      svg += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="5" class="bar' + (last ? ' cur' : '') + '"><title>' + PB.monthLabel(m.month) + ': ' + PB.fmtRp(m.total) + '</title></rect>';
      if (m.total > 0) svg += '<text x="' + (x + w / 2) + '" y="' + (y - 6) + '" text-anchor="middle" class="val">' + PB.compactRp(m.total) + '</text>';
      svg += '<text x="' + (x + w / 2) + '" y="' + (H - 8) + '" text-anchor="middle" class="lbl">' + PB.BULAN_S[parseInt(m.month.substring(5), 10) - 1] + '</text>';
    });
    return svg + '</svg>';
  }

  function donut(status) {
    const keys = ['Lunas', 'Dibayar Sebagian', 'Belum Dibayar'];
    const total = keys.reduce(function (a, k) { return a + (status[k] || 0); }, 0);
    const R = 62, C = 2 * Math.PI * R;
    let off = 0, arcs = '';
    if (total > 0) {
      keys.forEach(function (k) {
        const v = status[k] || 0; if (!v) return;
        const len = C * v / total;
        arcs += '<circle r="' + R + '" cx="80" cy="80" fill="none" stroke="' + COLORS[k] + '" stroke-width="22" stroke-dasharray="' + len + ' ' + (C - len) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 80 80)"/>';
        off += len;
      });
    } else arcs = '<circle r="' + R + '" cx="80" cy="80" fill="none" stroke="#27303F" stroke-width="22"/>';
    return '<div class="donut-wrap"><svg viewBox="0 0 160 160" class="donut" role="img" aria-label="Komposisi status pembayaran">' + arcs +
      '<text x="80" y="78" text-anchor="middle" class="d-num">' + total + '</text><text x="80" y="98" text-anchor="middle" class="d-lbl">invoice</text></svg>' +
      '<ul class="legend">' + keys.map(function (k) {
        return '<li><i style="background:' + COLORS[k] + '"></i><span>' + k + '</span><b>' + (status[k] || 0) + '</b></li>';
      }).join('') + '</ul></div>';
  }

  PB.views.dashboard = {
    mount: function (el) {
      let month = PB.state.today.substring(0, 7), range = 6, seq = 0;
      el.innerHTML =
        '<div class="page-head"><div><h1>Dashboard</h1><p class="muted">Ringkasan usaha PING BRO</p></div>' +
        '<div class="filters-inline"><label class="field-inline"><span>Bulan</span><input type="month" id="d-month" value="' + month + '"></label>' +
        '<label class="field-inline"><span>Grafik</span><select id="d-range"><option value="6">6 bulan</option><option value="12">12 bulan</option></select></label>' +
        '<a class="btn btn-primary" href="#/invoice/new">' + PB.icon('plus', 16) + 'Buat Invoice</a></div></div>' +
        '<div id="d-body">' + PB.skeleton(6) + '</div>';

      async function load() {
        const my = ++seq;
        const body = PB.$('#d-body', el);
        try {
          const d = await PB.api.call('dashboard.summary', { month: month, range: range });
          if (my !== seq) return;
          const s = d.stats;
          body.innerHTML =
            '<div class="stat-grid">' +
            card('Nilai Invoice', PB.fmtRp(s.invoice_value_month), s.invoice_count_month + ' invoice · ' + PB.monthLabel(d.month), 'file', 'gold') +
            card('Pembayaran Masuk', PB.fmtRp(s.payments_month), 'Diterima pada ' + PB.monthLabel(d.month), 'download', 'green') +
            card('Total Piutang', PB.fmtRp(s.outstanding), s.unpaid_count + ' invoice belum lunas', 'alert', 'red') +
            card('Invoice Bulan Ini', String(s.invoice_count_month), 'Dibuat pada ' + PB.monthLabel(d.month), 'hash', 'blue') +
            '</div>' +
            '<div class="grid-2"><section class="panel"><h3>Nilai invoice per bulan</h3>' + barChart(d.monthly) + '</section>' +
            '<section class="panel"><h3>Status pembayaran</h3>' + donut(d.status) + '</section></div>' +
            '<section class="panel"><div class="panel-head"><h3>Invoice terbaru</h3><a href="#/history" class="link">Lihat semua</a></div>' + recent(d.recent) + '</section>';
          PB.$$('[data-open]', body).forEach(function (r) { r.onclick = function () { PB.openInvoiceDetail(r.dataset.open, load); }; });
        } catch (e) { if (my === seq) body.innerHTML = PB.emptyState('Gagal memuat', e.message, '<button class="btn btn-secondary" id="d-retry">Coba lagi</button>'); const b = PB.$('#d-retry', el); if (b) b.onclick = load; }
      }
      function card(label, value, sub, icon, tone) {
        return '<div class="stat stat-' + tone + '"><div class="stat-ic">' + PB.icon(icon, 20) + '</div><div class="stat-label">' + label + '</div><div class="stat-value">' + E(value) + '</div><div class="stat-sub">' + E(sub) + '</div></div>';
      }
      function recent(rows) {
        if (!rows.length) return PB.emptyState('Belum ada invoice', 'Buat invoice pertama Anda untuk mulai mencatat.', '<a class="btn btn-primary" href="#/invoice/new">Buat Invoice</a>');
        return '<div class="table-wrap"><table class="tbl rs"><thead><tr><th>No. Invoice</th><th>Tanggal</th><th>Customer</th><th class="r">Total</th><th>Status</th></tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr class="click" data-open="' + E(r.invoice_id) + '"><td class="mono" data-l="No. Invoice">' + E(r.invoice_no) + '</td><td data-l="Tanggal">' + PB.fmtDateShort(r.invoice_date) + '</td><td data-l="Customer">' + E(r.customer_name_snap) + '</td><td class="r" data-l="Total">' + PB.fmtRp(r.total) + '</td><td data-l="Status">' + PB.statusBadge(r.payment_status) + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      PB.$('#d-month', el).onchange = function () { if (/^\d{4}-\d{2}$/.test(this.value)) { month = this.value; load(); } };
      PB.$('#d-range', el).onchange = function () { range = parseInt(this.value, 10); load(); };
      load();
    }
  };
})(window.PB);

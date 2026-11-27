(function () {
  const { S, redrawSel, fmtInt, fmtPct, dateLabel, cls, tidy, open, lineChart, mountLine, failNote, stockOptions, segColor } = window.__sj;
  const nf = (v, d) => v == null ? '—' : d3.format(',.' + (d == null ? (Number.isInteger(v) ? 0 : 2) : d) + 'f')(v);
  const dLabel = (s) => s ? String(s).replace(/^(\d{4})-0?(\d+)-0?(\d+)$/, '$1.$2.$3') : '—';
  const addRow = (tb, key, cells, cls2) => {
    const tr = document.createElement('tr'); if (cls2) tr.className = cls2;
    for (const [t, c, v] of cells) { const td = document.createElement('td'); td.textContent = t; if (c) td.className = c; if (v !== undefined && v !== null) cls(td, v); tr.append(td); }
    tb.append(tr);
  };
  const numv = (v) => v === '' || v == null || isNaN(+v) ? null : +v;

  // ---------- dividends ----------
  dash.calc('div_view', { inputs: ['dividends', 'stock_stats'], fn: (dividends, stock_stats) => {
    const st = new Map(stock_stats.map((r) => [r.code, r]));
    return dividends.map((r) => {
      const s = st.get(r.code) || {};
      const fc = numv(r.dps_fc), p1 = numv(r.dps_prev1), nd = numv(r.next_dps);
      return { code: r.code, name: s.name || r.code, fy: r.fy, dps_fc: fc, interim: numv(r.interim), yearend_fc: numv(r.yearend_fc),
        dps_prev1: p1, dps_prev2: numv(r.dps_prev2), growth: fc != null && p1 ? Math.round((fc / p1 - 1) * 1000) / 10 : null,
        yield_pct: numv(r.yield_pct), payout_pct: numv(r.payout_pct),
        next_record: r.next_record, next_last_cum: r.next_last_cum, next_ex: r.next_ex, next_kind: r.next_kind, next_dps: nd,
        next_yield: nd != null && s.price ? Math.round(nd / s.price * 10000) / 100 : null, last_ex: r.last_ex, last_dps: r.last_dps, note: r.note };
    });
  } });
  dash.draw('exdiv-rows', (tb) => {
    const d = dash.data('div_view'); tb.replaceChildren();
    if (d.status !== 'ok' || !d.data) return;
    const rows = d.data.filter((r) => r.next_ex && r.next_dps).sort((a, b) => a.next_ex.localeCompare(b.next_ex) || (b.next_yield || 0) - (a.next_yield || 0));
    const soon = rows.length ? rows[0].next_ex : '';
    for (const r of rows) addRow(tb, r.code, [[dLabel(r.next_ex), 'l'], [dLabel(r.next_last_cum), 'l'], [dLabel(r.next_record), 'l'], [r.name, 'l'], [r.next_kind, 'l'], [nf(r.next_dps)], [r.next_yield == null ? '—' : r.next_yield.toFixed(2) + '%']], r.next_ex === soon ? 'sj-soon' : '');
  });
  document.querySelectorAll('#div-sort').forEach((s) => s.addEventListener('change', () => { S.divSort = s.value; dash.draw('div-rows'); }));
  dash.draw('div-rows', (tb) => {
    const d = dash.data('div_view'); tb.replaceChildren();
    if (d.status !== 'ok' || !d.data) return;
    const k = S.divSort || 'yield_pct';
    const rows = d.data.slice().sort((a, b) => (b[k] == null ? -1e9 : b[k]) - (a[k] == null ? -1e9 : a[k]));
    for (const r of rows) addRow(tb, r.code, [[r.code, 'l'], [r.name, 'l'], [r.fy, 'l'], [r.dps_fc == null ? '미정' : nf(r.dps_fc)], [nf(r.interim)], [r.yearend_fc == null ? '미정' : nf(r.yearend_fc)], [nf(r.dps_prev1)], [nf(r.dps_prev2)],
      [r.growth == null ? '—' : fmtPct(r.growth, true), '', r.growth], [r.yield_pct == null ? '—' : r.yield_pct.toFixed(2)], [r.payout_pct == null ? '—' : r.payout_pct.toFixed(1)], [dLabel(r.last_ex), 'l'], [r.last_dps === '' ? '—' : String(r.last_dps)], [r.note || '', 'l wrap']]);
  });

  // ---------- company history ----------
  dash.draw('hist-select', (sel) => { stockOptions(sel, S.hist || '7203', false); sel.onchange = () => { S.hist = sel.value; redrawHist(); }; });
  const HISTN = ['hist-select', 'hist-list', 'hist-name', 'hist-link', 'hist-trivia', 'hist-tree', 'hist-rel', 'hist-groups', 'hist-holders', 'hist-owns', 'hold-rows'];
  const redrawHist = () => HISTN.forEach((n) => dash.draw(n));
  const HC = () => S.hist || '7203';
  const setHist = (code) => { S.hist = code; redrawHist(); document.querySelectorAll('#h-history').forEach((h2) => h2.scrollIntoView({ behavior: 'smooth', block: 'start' })); };
  const nameOf = (code) => { const d = dash.data('stock_stats'); const r = d.status === 'ok' && d.data ? d.data.find((x) => x.code === code) : null; return r ? tidy(r.name) : code; };
  const chip = (code, on) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'sj-hit' + (on ? ' on' : ''); b.textContent = nameOf(code); b.title = code; b.addEventListener('click', () => setHist(code)); return b; };
  const holdAll = () => { const d = dash.data('holdings'); return d.status === 'ok' && Array.isArray(d.data) ? d.data.map((r) => ({ ...r, code: String(r.code), holder_code: r.holder_code == null ? '' : String(r.holder_code), pct: +r.pct })) : null; };
  const holdRow = (label, pct, max, sub, code, kind) => {
    const row = document.createElement('div'); row.className = 'sj-hrow';
    const top = document.createElement('div'); top.className = 'sj-hrow-top';
    const name = document.createElement('span');
    if (code) name.append(chip(code, false)); else name.textContent = label;
    if (code && label) { const s = document.createElement('span'); s.className = 'sj-muted'; s.textContent = ' ' + label; name.append(s); }
    const v = document.createElement('b'); v.textContent = pct.toFixed(2) + '%';
    top.append(name, v);
    const bar = document.createElement('div'); bar.className = 'sj-hbar'; const fill = document.createElement('i'); fill.style.width = Math.max(1.5, pct / max * 100) + '%';
    fill.style.background = code ? dash.colors[0] : kind === '정부' ? dash.colors[2] : 'var(--cds-chart-muted)'; bar.append(fill);
    row.append(top, bar);
    if (sub) { const m = document.createElement('div'); m.className = 'sj-muted'; m.textContent = sub; row.append(m); }
    return row;
  };
  dash.draw('hist-holders', (box) => {
    box.replaceChildren(); const all = holdAll(); if (!all) return;
    const rows = all.filter((r) => r.code === HC()).sort((a, b) => b.pct - a.pct);
    if (!rows.length) { box.className = 'sj-muted'; box.textContent = '상위 주주가 모두 신탁은행·해외 보관은행 명의라 표시할 주주가 없습니다(특정 대주주 없이 기관투자자가 나눠 가진 회사).'; return; }
    box.className = '';
    const max = Math.max(20, rows[0].pct);
    for (const r of rows) box.append(holdRow(r.holder_code ? (r.via || '') : r.holder_ko, r.pct, max, (r.holder_code ? '' : r.kind + ' · ') + r.period + ' 기준', r.holder_code, r.kind));
  });
  dash.draw('hist-owns', (box) => {
    box.replaceChildren(); const all = holdAll(); if (!all) return;
    const rows = all.filter((r) => r.holder_code === HC() && r.code !== HC()).sort((a, b) => b.pct - a.pct);
    if (!rows.length) { box.className = 'sj-muted'; box.textContent = '다른 62종목의 10대 주주 명단에는 이 회사(와 자회사)가 없습니다.'; return; }
    box.className = '';
    const max = Math.max(20, rows[0].pct);
    for (const r of rows) box.append(holdRow(r.holder_ko + ' 명의', r.pct, max, r.period + ' 기준' + (r.via ? ' · ' + r.via : ''), r.code, r.kind));
  });
  dash.draw('hold-rows', (tb) => {
    tb.replaceChildren(); const all = holdAll(); if (!all) return;
    for (const r of all.filter((x) => x.holder_code && x.holder_code !== x.code).sort((a, b) => b.pct - a.pct)) {
      const tr = document.createElement('tr'); tr.className = 'sj-click' + (r.code === HC() || r.holder_code === HC() ? ' sj-on' : '');
      const cells = [[nameOf(r.holder_code) + (r.via ? ' (' + r.holder_ko + ')' : ''), 'l'], [nameOf(r.code), 'l'], [r.pct.toFixed(2) + '%'], [r.via || '', 'l'], [r.period, 'l']];
      for (const [t, c] of cells) { const td = document.createElement('td'); td.textContent = t; if (c) td.className = c; tr.append(td); }
      tr.addEventListener('click', () => setHist(r.code)); tb.append(tr);
    }
  });
  dash.draw('hist-trivia', (box) => {
    box.replaceChildren(); const d = dash.data('trivia'); if (d.status !== 'ok' || !d.data) return;
    const rows = d.data.filter((r) => r.code === HC()).sort((a, b) => +a.no - +b.no);
    if (!rows.length) { box.textContent = '—'; return; }
    for (const r of rows) { const c = document.createElement('div'); c.className = 'sj-tv'; const k = document.createElement('b'); k.textContent = r.kind; c.append(k, document.createTextNode(r.text)); box.append(c); }
  });
  dash.draw('hist-tree', (box) => {
    box.replaceChildren(); const d = dash.data('lineage'); if (d.status !== 'ok' || !d.data) return;
    const rows = d.data.filter((r) => r.code === HC()); if (!rows.length) return;
    const pk = (v) => v == null ? '' : String(v);
    const kids = new Map(); for (const r of rows) { const p = pk(r.parent); if (!kids.has(p)) kids.set(p, []); kids.get(p).push(r); }
    const build = (r) => { const li = document.createElement('li');
      const n = document.createElement('span'); n.className = 'sj-node' + (pk(r.parent) ? '' : ' root'); n.textContent = r.name; li.append(n);
      if (r.note) { const t = document.createElement('span'); t.className = 'sj-node-note'; t.textContent = r.note; li.append(t); }
      const ks = kids.get(pk(r.id)) || []; if (ks.length) { const ul = document.createElement('ul'); ks.forEach((k) => ul.append(build(k))); li.append(ul); }
      return li; };
    const ul = document.createElement('ul'); ul.className = 'sj-tree'; (kids.get('') || []).forEach((r) => ul.append(build(r))); box.append(ul);
    if (rows.length === 1) { const p = document.createElement('p'); p.className = 'sj-muted'; p.textContent = '창업 후 합병 없이 이어 온 회사입니다.'; box.append(p); }
  });
  dash.draw('hist-rel', (box) => {
    box.replaceChildren(); const d = dash.data('relations'); if (d.status !== 'ok' || !d.data) return;
    const c = HC(); const rows = d.data.map((r) => ({ ...r, a: String(r.a), b: String(r.b) })).filter((r) => r.a === c || r.b === c);
    if (!rows.length) { box.className = 'sj-muted'; box.textContent = '62종목 안에서 직접 이어진 회사는 없습니다.'; return; }
    box.className = '';
    const ul = document.createElement('ul'); ul.className = 'sj-list';
    for (const r of rows) { const other = r.a === c ? r.b : r.a; const li = document.createElement('li'); li.style.alignItems = 'baseline';
      const left = document.createElement('span'); const badge = document.createElement('span'); badge.className = 'sj-badge neu'; badge.textContent = r.kind;
      left.append(chip(other, false), document.createTextNode(' '), badge);
      const right = document.createElement('span'); right.className = 'sj-muted'; right.style.textAlign = 'right'; right.textContent = r.text;
      li.append(left, right); ul.append(li); }
    box.append(ul);
  });
  dash.draw('hist-groups', (box) => {
    box.replaceChildren(); const d = dash.data('groups'); if (d.status !== 'ok' || !d.data) return;
    const c = HC(); const rows = d.data.slice().sort((a, b) => (String(b.codes).split(' ').includes(c) ? 1 : 0) - (String(a.codes).split(' ').includes(c) ? 1 : 0));
    for (const g of rows) { const codes = String(g.codes).split(' ').filter(Boolean); const on = codes.includes(c);
      const card = document.createElement('div'); card.className = 'sj-grp' + (on ? ' on' : '');
      const h = document.createElement('h3'); h.textContent = g.grp + (on ? ' ✓' : '');
      const p = document.createElement('p'); p.className = 'sj-muted'; p.style.margin = '0 0 8px'; p.textContent = g.desc;
      const hits = document.createElement('div'); hits.className = 'sj-hits'; codes.forEach((k) => hits.append(chip(k, k === c)));
      card.append(h, p, hits); box.append(card); }
  });
  const histRows = () => { const d = dash.data('company_history'); return d.status === 'ok' && d.data ? d.data.filter((r) => r.code === HC()) : null; };
  dash.draw('hist-name', (el) => { const d = dash.data('stock_stats'); const r = d.status === 'ok' && d.data ? d.data.find((x) => x.code === HC()) : null; el.textContent = r ? r.name + ' (' + r.code + ')' : '—'; });
  dash.draw('hist-list', (ol) => {
    ol.replaceChildren(); const rows = histRows(); if (!rows) return;
    rows.slice().sort((a, b) => a.ym.localeCompare(b.ym)).forEach((r) => { const li = document.createElement('li'); const b = document.createElement('span'); b.className = 'sj-tl-date'; b.textContent = r.ym; li.append(b, document.createTextNode(r.event)); ol.append(li); });
  });
  dash.draw('hist-link', (a) => {
    const rows = histRows(); const u = rows && rows.length ? rows[0].source_url : '';
    if (u && /^https:\/\/irbank\.net\//.test(u)) { a.href = u; a.textContent = 'IR BANK 沿革'; } else { a.removeAttribute('href'); a.textContent = '—'; }
  });

  // ---------- nikkei ----------
  dash.calc('nikkei_view', { inputs: ['nikkei_daily', 'nikkei_live'], fn: (nikkei_daily, nikkei_live) => {
    const m = new Map();
    for (const r of nikkei_daily) m.set(r.date, { date: r.date, open: numv(r.open), high: numv(r.high), low: numv(r.low), close: numv(r.close), t1100: null });
    for (const r of (Array.isArray(nikkei_live) ? nikkei_live : [])) {
      const date = r.date || r.id; if (!date) continue;
      const o = m.get(date) || { date, open: null, high: null, low: null, close: null, t1100: null };
      for (const k of ['open', 'high', 'low', 'close', 't1100']) if (numv(r[k]) != null) o[k] = numv(r[k]);
      m.set(date, o);
    }
    const rows = [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
    return rows.map((r, i) => { const pc = i > 0 ? rows[i - 1].close : null;
      return { ...r, chg: r.close != null && pc != null ? Math.round((r.close - pc) * 100) / 100 : null, chg_pct: r.close != null && pc != null ? Math.round((r.close / pc - 1) * 10000) / 100 : null,
        am_chg: r.t1100 != null && pc != null ? Math.round((r.t1100 - pc) * 100) / 100 : null, pm_move: r.t1100 != null && r.close != null ? Math.round((r.close - r.t1100) * 100) / 100 : null }; });
  } });
  const nkFmt = (v, f) => v == null ? '—' : f === 'num2' ? d3.format(',.2f')(v) : f === 'signed' ? (v > 0 ? '+' : '') + d3.format(',.2f')(v) : f === 'pct' ? (v > 0 ? '+' : '') + v.toFixed(2) + '%' : f === 'date' ? dLabel(v) : String(v);
  const nkStat = (el, pick) => { const d = dash.data('nikkei_view'); const rows = d.status === 'ok' && d.data ? d.data : []; const r = pick(rows);
    if (!r) { el.textContent = '—'; return; } const v = r[el.dataset.field]; el.textContent = nkFmt(v, el.dataset.fmt);
    el.classList.remove('up', 'down'); if (el.dataset.fmt === 'signed' || el.dataset.fmt === 'pct') cls(el, v); };
  dash.draw('nk-stat', (el) => nkStat(el, (rows) => rows.filter((r) => r.close != null).pop()));
  dash.draw('nk-1100', (el) => nkStat(el, (rows) => rows.filter((r) => r.t1100 != null).pop()));
  dash.draw('nk-rows', (tb) => {
    const d = dash.data('nikkei_view'); tb.replaceChildren();
    if (d.status !== 'ok' || !d.data) return;
    for (const r of d.data.slice().reverse().filter((x) => x.date >= '2026-09-25')) addRow(tb, r.date, [[dLabel(r.date), 'l'], [nkFmt(r.open, 'num2')], [nkFmt(r.t1100, 'num2')], [nkFmt(r.high, 'num2')], [nkFmt(r.low, 'num2')], [nkFmt(r.close, 'num2')],
      [nkFmt(r.chg, 'signed'), '', r.chg], [nkFmt(r.chg_pct, 'pct'), '', r.chg_pct], [nkFmt(r.pm_move, 'signed'), '', r.pm_move]]);
  });
  document.querySelectorAll('#nk-legend .sj-sw[data-series]').forEach((sw) => { sw.style.background = dash.colors[+sw.dataset.series]; });
  dash.draw('nk-chart', {
    mount: (el) => { el.replaceChildren(); const svg = d3.select(el).append('svg'); const tip = document.createElement('div'); tip.className = 'sj-tip'; tip.hidden = true; el.append(tip); return { svg, tip }; },
    update: (el, made) => {
      const d = dash.data('nikkei_view'); const svg = made.svg; svg.selectAll('*').remove();
      if (d.status !== 'ok' || !d.data) { svg.attr('height', 40); return; }
      const rows = d.data.filter((r) => r.date >= '2026-09-25' && (r.close != null || r.t1100 != null));
      const W = Math.max(300, el.clientWidth), H = 300, m = { t: 10, r: 12, b: 26, l: 60 };
      svg.attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H).attr('role', 'img').attr('aria-label', '닛케이225 일별 고가~저가 범위, 종가, 오전 11시 지수');
      const dates = rows.map((r) => r.date);
      const x = d3.scalePoint().domain(dates).range([m.l, W - m.r]).padding(0.5);
      const vals = rows.flatMap((r) => [r.high, r.low, r.close, r.t1100]).filter((v) => v != null);
      const [lo, hi] = d3.extent(vals); const pad = (hi - lo) * 0.05 || 1;
      const y = d3.scaleLinear().domain([lo - pad, hi + pad]).nice().range([H - m.b, m.t]);
      svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(d3.format(','))).call((g) => g.select('.domain').remove());
      const step = Math.ceil(dates.length / Math.max(2, Math.floor((W - m.l - m.r) / 52)));
      svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(dates.filter((dd, i) => i % step === 0 || i === dates.length - 1)).tickFormat(dateLabel).tickSizeOuter(0));
      const bw = Math.max(2, x.step() * 0.35);
      svg.append('g').selectAll('rect').data(rows.filter((r) => r.high != null && r.low != null)).join('rect').attr('x', (r) => x(r.date) - bw / 2).attr('width', bw).attr('rx', 2)
        .attr('y', (r) => y(r.high)).attr('height', (r) => Math.max(1, y(r.low) - y(r.high))).style('fill', 'var(--cds-chart-muted)').attr('opacity', 0.6);
      svg.append('path').attr('fill', 'none').attr('stroke-width', 2).style('stroke', dash.colors[0]).attr('d', d3.line().defined((r) => r.close != null).x((r) => x(r.date)).y((r) => y(r.close))(rows));
      svg.append('g').selectAll('circle').data(rows.filter((r) => r.t1100 != null)).join('circle').attr('r', 5).attr('cx', (r) => x(r.date)).attr('cy', (r) => y(r.t1100)).style('fill', dash.colors[1]).style('stroke', 'var(--color-bg)').attr('stroke-width', 2);
      const cross = svg.append('line').attr('opacity', 0).attr('stroke-dasharray', '3 3').style('stroke', 'var(--cds-chart-reference)');
      const tip = made.tip;
      svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
        .on('pointermove', (ev) => {
          const [px] = d3.pointer(ev); const i = Math.max(0, Math.min(dates.length - 1, Math.round((px - x(dates[0])) / x.step()))); const r = rows[i];
          cross.attr('x1', x(r.date)).attr('x2', x(r.date)).attr('y1', m.t).attr('y2', H - m.b).attr('opacity', 1);
          tip.hidden = false; tip.replaceChildren();
          const head = document.createElement('div'); head.style.fontWeight = '600'; head.textContent = dLabel(r.date); tip.append(head);
          [['시가', r.open], ['11:00', r.t1100], ['고가', r.high], ['저가', r.low], ['종가', r.close]].forEach(([k, v]) => { const row = document.createElement('div'); row.textContent = k + '  ' + nkFmt(v, 'num2'); tip.append(row); });
          const tx = x(r.date) / W * el.clientWidth; tip.style.left = (tx > el.clientWidth / 2 ? tx - tip.offsetWidth - 12 : tx + 12) + 'px'; tip.style.top = '8px';
        })
        .on('pointerleave', () => { tip.hidden = true; cross.attr('opacity', 0); });
    }
  });

  // ---------- performance ----------
  const growth = (a, b) => a == null || b == null || b <= 0 ? null : Math.round((a / b - 1) * 1000) / 10;
  dash.calc('perf_years', { inputs: ['performance'], fn: (performance) => {
    const oku = (v) => { const n = numv(v); return n == null ? null : Math.round(n / 100); };
    const rows = performance.map((r) => ({ code: r.code, fy: r.fy, fy_label: r.fy_label, forecast: +r.forecast === 1, fy_end: r.fy_end,
      sales: oku(r.sales), op: oku(r.op), ordinary: oku(r.ordinary), net: oku(r.net), standard: r.standard }));
    rows.sort((a, b) => a.code.localeCompare(b.code) || a.fy_end.localeCompare(b.fy_end));
    return rows.map((r, i) => { const p = i > 0 && rows[i - 1].code === r.code ? rows[i - 1] : null; return { ...r, net_chg: p ? growth(r.net, p.net) : null }; });
  } });
  dash.calc('perf_view', { inputs: ['perf_years', 'stock_stats'], fn: (perf_years, stock_stats) => {
    const st = new Map(stock_stats.map((r) => [r.code, r]));
    const by = new Map();
    for (const r of perf_years) { if (!by.has(r.code)) by.set(r.code, []); by.get(r.code).push(r); }
    const out = [];
    for (const [code, rows] of by) {
      const act = rows.filter((r) => !r.forecast), fc = rows.find((r) => r.forecast) || {};
      const last = act[act.length - 1] || {}, first = act[0] || {};
      const s = st.get(code) || {};
      out.push({ code, name: s.name || code, sector: s.sector || '', fy_last: last.fy_label || '', fy_fc: fc.fy_label || '', fy_first: first.fy_label || '',
        sales_last: last.sales, sales_fc: fc.sales ?? null, sales_g: growth(fc.sales, last.sales),
        op_last: last.op, op_fc: fc.op ?? null, op_g: growth(fc.op, last.op),
        net_last: last.net, net_fc: fc.net ?? null, net_g: growth(fc.net, last.net), net_first: first.net, net_2y: growth(last.net, first.net) });
    }
    return out;
  } });
  const okuF = (v) => v == null ? '—' : d3.format(',.0f')(v);
  const pctF = (v) => v == null ? '—' : fmtPct(v, true);
  const sortDesc = (k) => (a, b) => (b[k] == null ? -1e12 : b[k]) - (a[k] == null ? -1e12 : a[k]);
  const DT = () => S.detail || '7203';
  const redrawDetail = () => ['dt-select', 'dt-name', 'dt-cards', 'dt-price', 'dt-sales', 'dt-profit', 'dt-perf-rows', 'dt-target', 'dt-target-note', 'dt-pie', 'dt-div', 'dt-hist', 'dt-news', 'dt-board', 'dt-outlook', 'dt-trivia'].forEach((n) => dash.draw(n));
  const goDetail = (code) => { S.detail = code; open('detail'); redrawDetail(); document.querySelectorAll('#h-detail').forEach((h2) => h2.scrollIntoView({ block: 'start' })); };
  document.querySelectorAll('#perf-sort').forEach((s) => s.addEventListener('change', () => { S.perfSort = s.value; dash.draw('perf-rows'); }));
  dash.draw('perf-rows', (tb) => {
    const d = dash.data('perf_view'); tb.replaceChildren();
    if (d.status !== 'ok' || !d.data) return;
    for (const r of d.data.slice().sort(sortDesc(S.perfSort || 'net_g'))) {
      addRow(tb, r.code, [[r.code, 'l'], [r.name, 'l'], [r.fy_fc || '—', 'l'], [okuF(r.sales_last)], [okuF(r.sales_fc)], [pctF(r.sales_g), '', r.sales_g],
        [okuF(r.op_last)], [okuF(r.op_fc)], [pctF(r.op_g), '', r.op_g], [okuF(r.net_last)], [okuF(r.net_fc)], [pctF(r.net_g), '', r.net_g], [pctF(r.net_2y), '', r.net_2y]], 'sj-click');
      tb.lastChild.addEventListener('click', () => goDetail(r.code));
    }
  });

  // ---------- targets ----------
  dash.calc('target_view', { inputs: ['targets', 'stock_stats'], fn: (targets, stock_stats) => {
    const st = new Map(stock_stats.map((r) => [r.code, r]));
    return targets.map((r) => {
      const s = st.get(r.code) || {}; const p = s.price || numv(r.price_ref);
      const up = (v) => v != null && p ? Math.round((v / p - 1) * 1000) / 10 : null;
      const t = numv(r.target), pb = numv(r.pbr_theory), pe = numv(r.per_theory);
      return { code: r.code, name: s.name || r.code, sector: s.sector || '', price: p, target: t, up_target: up(t), target_view: r.target_view, rating: numv(r.rating), rating_label: r.rating_label, analysts: numv(r.analysts),
        buy: (numv(r.strong_buy) || 0) + (numv(r.buy) || 0), neutral: numv(r.neutral) || 0, sell: (numv(r.sell) || 0) + (numv(r.strong_sell) || 0),
        pbr_low: numv(r.pbr_low), pbr_theory: pb, pbr_high: numv(r.pbr_high), up_pbr: up(pb), pbr_view: r.pbr_view,
        per_low: numv(r.per_low), per_theory: pe, per_high: numv(r.per_high), up_per: up(pe), per_view: r.per_view, pbr: numv(r.pbr), per_fc: numv(r.per_fc), flag: r.flag || '', asof: r.asof };
    });
  } });
  const rng = (a, b) => a == null || b == null ? '—' : fmtInt(Math.round(a)) + '~' + fmtInt(Math.round(b));
  const intF = (v) => v == null ? '—' : fmtInt(Math.round(v));
  document.querySelectorAll('#tg-sort').forEach((s) => s.addEventListener('change', () => { S.tgSort = s.value; dash.draw('tg-rows'); }));
  document.querySelectorAll('#tg-view').forEach((s) => s.addEventListener('change', () => { S.tgView = s.value; dash.draw('tg-rows'); }));
  dash.draw('tg-rows', (tb) => {
    const d = dash.data('target_view'); tb.replaceChildren();
    if (d.status !== 'ok' || !d.data) return;
    for (const r of d.data.filter((r) => !S.tgView || r.target_view === S.tgView).sort(sortDesc(S.tgSort || 'up_target'))) {
      addRow(tb, r.code, [[r.code, 'l'], [r.name, 'l'], [intF(r.price)], [intF(r.target)], [pctF(r.up_target), '', r.up_target], [r.target_view || '—', 'l'],
        [r.rating == null ? '—' : r.rating.toFixed(2)], [r.rating_label || '—', 'l'], [r.buy + '·' + r.neutral + '·' + r.sell + ' (' + (r.analysts || 0) + '명)', 'l'],
        [intF(r.pbr_theory)], [rng(r.pbr_low, r.pbr_high), 'l'], [pctF(r.up_pbr), '', r.up_pbr], [intF(r.per_theory)], [rng(r.per_low, r.per_high), 'l'], [pctF(r.up_per), '', r.up_per], [r.flag, 'l']], 'sj-click');
      tb.lastChild.addEventListener('click', () => goDetail(r.code));
    }
  });
  window.__sj3 = { nf, dLabel, addRow, numv, DT, redrawDetail, goDetail, okuF, pctF, intF, rng, setHist, nameOf, HISTN, redrawHist, nkFmt };
})();

(function () {
  dash.calc('summary', { inputs: ['index'], fn: (index) => {
    const rows = index.map((r) => ({ date: r.date, ns: +r.nikkei_style, tp: +r.topix_style, n: +r.nikkei225 }));
    rows.sort((a, b) => a.date.localeCompare(b.date));
    const last = rows[rows.length - 1], first = rows[0], prev3 = rows[rows.length - 4];
    const pct = (a, b) => Math.round((a / b - 1) * 1000) / 10;
    return [{ last_date: last.date,
      ns_last: Math.round(last.ns * 10) / 10, ns_chg3: pct(last.ns, prev3.ns), ns_total: pct(last.ns, first.ns),
      tp_last: Math.round(last.tp * 10) / 10, tp_chg3: pct(last.tp, prev3.tp), tp_total: pct(last.tp, first.tp),
      n225_last: Math.round(last.n), n225_chg3: pct(last.n, prev3.n), n225_total: pct(last.n, first.n) }];
  } });

  dash.calc('stock_stats', { inputs: ['prices'], fn: (prices) => {
    const by = new Map();
    for (const r of prices) { if (!by.has(r.code)) by.set(r.code, []); by.get(r.code).push(r); }
    const out = [];
    for (const [code, rows] of by) {
      rows.sort((a, b) => a.date.localeCompare(b.date));
      const n = rows.length, last = rows[n - 1];
      const p = (i) => +rows[i].price;
      const pct = (a, b) => Math.round((a / b - 1) * 1000) / 10;
      out.push({ code, name: last.name, sector: last.sector, price: +last.price,
        chg_1d: pct(p(n - 1), p(n - 2)), chg_3d: pct(p(n - 1), p(n - 4)), chg_total: pct(p(n - 1), p(0)),
        volume: +last.volume, mcap_bil_yen: Math.round(+last.mcap_mil_yen / 1000) });
    }
    return out;
  } });

  dash.calc('sector_view', { inputs: ['sectors'], fn: (sectors) => sectors.map((r) => ({
    sector: r.sector, stocks: +r.stocks, flow_p4: Math.round(+r.flow_p4 * 1000) / 10,
    return_p4: Math.round(+r.return_p4 * 1000) / 10, volume_ratio: Math.round(+r.volume_ratio * 100) / 100, verdict: r.verdict })) });

  dash.calc('flow_view', { inputs: ['flows'], fn: (flows) => flows.map((r) => ({
    code: r.code, name: r.name, sector: r.sector, volume_ratio: Math.round(+r.volume_ratio * 100) / 100,
    return_p4: Math.round(+r.return_p4 * 1000) / 10, flow_p4: Math.round(+r.flow_p4 * 1000) / 10, verdict: r.verdict })) });

  dash.calc('tech_daily', { inputs: ['history', 'prices'], fn: (history, prices) => {
    const by = new Map(), names = new Map();
    const add = (r, vol) => { if (!by.has(r.code)) by.set(r.code, new Map()); by.get(r.code).set(r.date, { date: r.date, price: +r.price, volume: vol }); };
    for (const r of history) add(r, null);
    for (const r of prices) { add(r, +r.volume); names.set(r.code, r.name); }
    const out = [];
    const r2 = (x) => x == null || !isFinite(x) ? null : Math.round(x * 100) / 100;
    for (const [code, m] of by) {
      const rows = [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
      const p = rows.map((r) => r.price), n = p.length;
      const win = (i, k) => i < k - 1 ? null : p.slice(i - k + 1, i + 1);
      const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
      const ema = (arr, k) => { const a = 2 / (k + 1); let e = null; return arr.map((x) => { if (x == null) return null; e = e == null ? x : a * x + (1 - a) * e; return e; }); };
      const e12 = ema(p, 12), e26 = ema(p, 26);
      const macd = p.map((_, i) => i < 25 ? null : e12[i] - e26[i]);
      const sig = ema(macd, 9).map((x, i) => i < 33 ? null : x);
      const mid = (i, k) => { const w = win(i, k); return w ? (Math.max(...w) + Math.min(...w)) / 2 : null; };
      const tenkan = p.map((_, i) => mid(i, 9)), kijun = p.map((_, i) => mid(i, 26));
      const spanA0 = p.map((_, i) => tenkan[i] != null && kijun[i] != null ? (tenkan[i] + kijun[i]) / 2 : null);
      const spanB0 = p.map((_, i) => mid(i, 52));
      for (let i = 0; i < n; i++) {
        const w5 = win(i, 5), w20 = win(i, 20), w60 = win(i, 60);
        const ma20 = w20 ? mean(w20) : null;
        const sd = w20 ? Math.sqrt(mean(w20.map((x) => (x - ma20) ** 2))) : null;
        let rsi = null;
        if (i >= 14) { let g = 0, l = 0; for (let k = i - 13; k <= i; k++) { const d = p[k] - p[k - 1]; if (d > 0) g += d; else l -= d; } rsi = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
        out.push({ code, name: names.get(code) || code, date: rows[i].date, price: p[i], volume: rows[i].volume,
          ma5: r2(w5 ? mean(w5) : null), ma20: r2(ma20), ma60: r2(w60 ? mean(w60) : null),
          bb_up: r2(ma20 == null ? null : ma20 + 2 * sd), bb_dn: r2(ma20 == null ? null : ma20 - 2 * sd),
          rsi14: r2(rsi), macd: r2(macd[i]), macd_signal: r2(sig[i]), macd_hist: r2(macd[i] != null && sig[i] != null ? macd[i] - sig[i] : null),
          tenkan: r2(tenkan[i]), kijun: r2(kijun[i]),
          span_a: r2(i >= 26 ? spanA0[i - 26] : null), span_b: r2(i >= 26 ? spanB0[i - 26] : null) });
      }
    }
    return out;
  } });

  dash.calc('tech', { inputs: ['tech_daily'], fn: (tech_daily) => {
    const by = new Map();
    for (const r of tech_daily) { if (!by.has(r.code)) by.set(r.code, []); by.get(r.code).push(r); }
    const crossed = (rows, a, b) => {
      for (let k = rows.length - 1; k > rows.length - 4; k--) {
        const x = rows[k], y = rows[k - 1];
        if ([x[a], x[b], y[a], y[b]].some((v) => v == null)) continue;
        if (x[a] > x[b] && y[a] <= y[b]) return 'up';
        if (x[a] < x[b] && y[a] >= y[b]) return 'down';
      }
      return null;
    };
    const out = [];
    for (const [code, rows] of by) {
      rows.sort((a, b) => a.date.localeCompare(b.date));
      const L = rows[rows.length - 1];
      const vols = rows.filter((r) => r.volume != null).slice(-20).map((r) => r.volume);
      const avgV = vols.reduce((s, x) => s + x, 0) / vols.length;
      const mc = crossed(rows, 'ma5', 'ma20'), dc = crossed(rows, 'macd', 'macd_signal');
      const top = Math.max(L.span_a, L.span_b), bot = Math.min(L.span_a, L.span_b);
      const pb = (L.price - L.bb_dn) / (L.bb_up - L.bb_dn);
      out.push({ code, name: L.name, price: L.price, ma5: L.ma5, ma20: L.ma20, ma60: L.ma60,
        gap20: Math.round((L.price / L.ma20 - 1) * 1000) / 10, gap60: Math.round((L.price / L.ma60 - 1) * 1000) / 10,
        rsi14: Math.round(L.rsi14 * 10) / 10,
        rsi_state: L.rsi14 >= 70 ? '과매수 (70 이상)' : L.rsi14 <= 30 ? '과매도 (30 이하)' : '중립',
        trend: mc === 'up' ? '골든크로스 (최근 3일)' : mc === 'down' ? '데드크로스 (최근 3일)' : L.ma5 > L.ma20 ? '정배열 (5일선 > 20일선)' : '역배열 (5일선 < 20일선)',
        macd: L.macd, macd_signal: L.macd_signal,
        macd_state: dc === 'up' ? 'MACD 상향돌파 (최근 3일)' : dc === 'down' ? 'MACD 하향돌파 (최근 3일)' : L.macd > L.macd_signal ? 'MACD > 시그널' : 'MACD < 시그널',
        bb_pctb: Math.round(pb * 100) / 100,
        bb_state: pb > 1 ? '상단 돌파' : pb < 0 ? '하단 이탈' : pb >= 0.8 ? '상단 근접' : pb <= 0.2 ? '하단 근접' : '밴드 안',
        cloud_state: L.price > top ? '구름 위' : L.price < bot ? '구름 아래' : '구름 안',
        vol_ratio: Math.round(L.volume / avgV * 100) / 100 });
    }
    return out;
  } });

  const S = window.sjState = window.sjState || { sel: '285A', sort: 'chg_3d', verdict: '', sector: '', seg: '7203', noteStock: '', signal: '', overlay: 'ma', range: 'all' };
  const redrawSel = () => ['stock-rows', 'stock-chart', 'sel-name', 'tech-stat', 'tech-rows'].forEach((n) => dash.draw(n));
  const fmtInt = d3.format(',');
  const fmt1 = d3.format(',.1f');
  const fmtPct = (v, sign) => (sign && v > 0 ? '+' : '') + d3.format('.1f')(v) + '%';
  const dateLabel = (s) => { const [, m, d] = s.split('-'); return (+m) + '.' + (+d); };
  const setDash = (el) => { el.textContent = '—'; };
  const cls = (el, v) => { el.classList.toggle('up', v > 0); el.classList.toggle('down', v < 0); };
  const tidy = (s) => (s || '').replace(/\s*\(구\).*$/, '');

  document.querySelectorAll('#index-legend .sj-sw').forEach((sw) => { sw.style.background = dash.colors[+sw.dataset.series]; });

  const open = (id) => {
    document.querySelectorAll('.sj section[data-tab]').forEach((s) => { s.hidden = s.id !== id; });
    document.querySelectorAll('.sj .sj-tab').forEach((b) => { b.setAttribute('aria-selected', String(b.dataset.go === id)); });
    dash.setLink(id);
    dash._all();
  };
  document.querySelectorAll('.sj .sj-tab').forEach((b) => b.addEventListener('click', () => open(b.dataset.go)));
  const h = (location.hash || '').slice(1);
  if (h && document.getElementById(h) && document.getElementById(h).matches('section[data-tab]')) { document.querySelectorAll('.sj section[data-tab]').forEach((s) => { s.hidden = s.id !== h; }); document.querySelectorAll('.sj .sj-tab').forEach((b) => { b.setAttribute('aria-selected', String(b.dataset.go === h)); }); }

  // 공개판 전용: 맨 위 시장 동향 = 시장 보고서의 가장 최근 기록
  dash.draw('pub-lede', (box) => {
    box.replaceChildren();
    const d = dash.data('market_reports');
    if (d.status !== 'ok' || !d.data || !d.data.length) { box.textContent = d.status === 'error' ? '불러오지 못했습니다' : '불러오는 중…'; return; }
    const rows = d.data.slice().sort((a, b) => a.date.localeCompare(b.date) || String(a.written).localeCompare(String(b.written)));
    const r = rows[rows.length - 1];
    const am = /오전장/.test(r.written || '') || /^\[오전장\]/.test(r.title || '');
    const head = document.createElement('p'); head.style.margin = '0 0 6px';
    const b = document.createElement('b'); b.textContent = '시장 동향 · ' + dateLabel(r.date) + (am ? ' 오전장(11:30) 기준' : ' 종가 기준') + ' — ' + String(r.title).replace(/^\[오전장\]\s*/, '');
    head.append(b); box.append(head);
    const p0 = document.createElement('p'); p0.style.margin = '0 0 6px'; p0.textContent = r.lede; box.append(p0);
    String(r.body || '').split(/\n+|\s*¶\s*/).filter(Boolean).forEach((t) => { const p = document.createElement('p'); p.style.margin = '0 0 6px'; p.textContent = t; box.append(p); });
  });

  dash.draw('last-date', (el) => {
    const d = dash.data('summary');
    if (d.status !== 'ok' || !d.data) return setDash(el);
    el.textContent = dateLabel(d.data[0].last_date);
  });
  dash.draw('kpi', (el) => {
    const d = dash.data('summary');
    if (d.status !== 'ok' || !d.data) return setDash(el);
    const v = d.data[0][el.dataset.field];
    const f = el.dataset.fmt;
    el.textContent = f === 'pct' ? fmtPct(v, el.hasAttribute('data-sign')) : f === 'int' ? fmtInt(v) : fmt1(v);
    if (f === 'pct') cls(el, v);
  });
  const sortedMovers = () => {
    const d = dash.data('stock_stats');
    if (d.status !== 'ok' || !d.data) return null;
    return d.data.slice().sort((a, b) => b.chg_3d - a.chg_3d);
  };
  dash.draw('movers-list', (ul) => {
    const rows = sortedMovers();
    ul.replaceChildren();
    if (!rows) { ul.append(Object.assign(document.createElement('li'), { textContent: '—' })); return; }
    const pick = ul.dataset.pick === 'best' ? rows.slice(0, 5) : rows.slice(-5).reverse();
    for (const r of pick) {
      const li = document.createElement('li');
      const a = document.createElement('span'); a.textContent = r.name + ' · ' + r.sector;
      const b = document.createElement('span'); b.textContent = fmtPct(r.chg_3d, true); cls(b, r.chg_3d);
      li.append(a, b); ul.append(li);
    }
  });

  function lineChart(el, made, series, opts) {
    const W = Math.max(280, el.clientWidth), H = opts.height || 280;
    const m = { t: 10, r: 12, b: 26, l: 44 };
    const svg = made.svg.attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H);
    svg.attr('role', 'img').attr('aria-label', opts.label);
    const dates = series[0].values.map((v) => v.date);
    const x = d3.scalePoint().domain(dates).range([m.l, W - m.r]);
    const all = series.flatMap((s) => s.values.map((v) => v.y));
    const [lo, hi] = d3.extent(all); const pad = (hi - lo) * 0.08 || 1;
    const y = d3.scaleLinear().domain([lo - pad, hi + pad]).nice().range([H - m.b, m.t]);
    const yAxis = d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(opts.yFmt || d3.format(','));
    made.gy.attr('class', 'grid').attr('transform', `translate(${m.l},0)`).call(yAxis).call((g) => g.select('.domain').remove());
    const step = Math.ceil(dates.length / Math.max(2, Math.floor((W - m.l - m.r) / 52)));
    made.gx.attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues(dates.filter((d, i) => i % step === 0 || i === dates.length - 1)).tickFormat(dateLabel).tickSizeOuter(0));
    const line = d3.line().x((v) => x(v.date)).y((v) => y(v.y));
    made.lines.selectAll('path').data(series).join('path')
      .attr('fill', 'none').attr('stroke-width', 2).attr('stroke-linejoin', 'round')
      .style('stroke', (s, i) => s.color || dash.colors[i]).attr('d', (s) => line(s.values));
    made.ends.selectAll('circle').data(series).join('circle').attr('r', 4)
      .style('fill', (s, i) => s.color || dash.colors[i]).style('stroke', 'var(--color-bg)').attr('stroke-width', 2)
      .attr('cx', (s) => x(s.values[s.values.length - 1].date)).attr('cy', (s) => y(s.values[s.values.length - 1].y));
    const tip = made.tip;
    made.hit.attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('pointermove', (ev) => {
        const [px] = d3.pointer(ev);
        const i = Math.max(0, Math.min(dates.length - 1, Math.round((px - m.l) / x.step())));
        const d = dates[i];
        made.cross.attr('x1', x(d)).attr('x2', x(d)).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--cds-chart-reference)').attr('opacity', 1);
        tip.hidden = false; tip.replaceChildren();
        const head = document.createElement('div'); head.style.fontWeight = '600'; head.textContent = dateLabel(d); tip.append(head);
        series.forEach((s, k) => {
          const row = document.createElement('div');
          const sw = document.createElement('i'); sw.className = 'sj-sw'; sw.style.background = s.color || dash.colors[k];
          row.append(sw, document.createTextNode(s.name + '  ' + opts.tipFmt(s.values[i].y)));
          tip.append(row);
        });
        const tx = x(d) / W * el.clientWidth;
        tip.style.left = Math.min(el.clientWidth - tip.offsetWidth - 4, Math.max(0, tx + 12)) + 'px';
        tip.style.top = '8px';
      })
      .on('pointerleave', () => { tip.hidden = true; made.cross.attr('opacity', 0); });
  }
  function mountLine(el) {
    el.replaceChildren();
    const svg = d3.select(el).append('svg');
    const gy = svg.append('g'), gx = svg.append('g'), lines = svg.append('g'), ends = svg.append('g');
    const cross = svg.append('line').attr('opacity', 0).attr('stroke-dasharray', '3 3');
    const hit = svg.append('rect');
    const tip = document.createElement('div'); tip.className = 'sj-tip'; tip.hidden = true; el.append(tip);
    return { svg, gy, gx, lines, ends, cross, hit, tip };
  }
  function failNote(el, made, status) {
    made.lines.selectAll('*').remove(); made.ends.selectAll('circle').remove();
    made.svg.attr('height', 40).attr('viewBox', null);
    made.gy.selectAll('*').remove(); made.gx.selectAll('*').remove();
    if (status === 'error') { made.lines.append('text').attr('x', 0).attr('y', 20).text('불러오지 못했습니다'); }
  }
  window.__sj = { S, redrawSel, fmtInt, fmt1, fmtPct, dateLabel, setDash, cls, tidy, open, lineChart, mountLine, failNote };
})();

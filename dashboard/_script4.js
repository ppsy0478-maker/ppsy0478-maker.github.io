(function () {
  const { S, redrawSel, fmtInt, fmtPct, dateLabel, cls, tidy, open, lineChart, mountLine, failNote, stockOptions, segColor } = window.__sj;
  const { nf, dLabel, addRow, numv, DT, redrawDetail, goDetail, okuF, pctF, intF, rng, HISTN } = window.__sj3;

  // ---------- outlook (defined early: detail search uses it) ----------
  dash.calc('outlook_view', { inputs: ['outlook', 'stock_stats'], fn: (outlook, stock_stats) => {
    const st = new Map(stock_stats.map((r) => [r.code, r]));
    return outlook.map((r) => { const s = st.get(r.code) || {};
      return { code: r.code, name: tidy(s.name || r.name || r.code), sector: s.sector || r.sector, industry: r.industry, verdict: r.verdict,
        score: r.score === '' || r.score == null ? null : +r.score, env_ko: r.env_ko, forecast: r.forecast, outlook_ko: r.outlook_ko, src: r.src,
        doc_date: r.doc_date, doc_title: r.doc_title, doc_url: r.doc_url, slide_title: r.slide_title, slide_url: r.slide_url, chg_total: s.chg_total ?? null, asof: r.asof }; });
  } });
  dash.calc('outlook_sector', { inputs: ['outlook_view'], fn: (rows) => {
    const m = new Map();
    for (const r of rows) { const g = m.get(r.sector) || { sector: r.sector, stocks: 0, scored: 0, sum: 0, good: 0, bad: 0 }; g.stocks++; if (r.score != null) { g.scored++; g.sum += r.score; } if (r.score > 0) g.good++; if (r.score < 0) g.bad++; m.set(r.sector, g); }
    return [...m.values()].map((g) => ({ sector: g.sector, stocks: g.stocks, scored: g.scored, avg: g.scored ? Math.round(g.sum / g.scored * 100) / 100 : null, good: g.good, bad: g.bad }));
  } });
  const olAll = () => { const d = dash.data('outlook_view'); return d.status === 'ok' && d.data ? d.data : null; };

  // ---------- stock detail ----------
  dash.draw('dt-trivia', (box) => {
    box.replaceChildren(); const d = dash.data('trivia'); if (d.status !== 'ok' || !d.data) return;
    for (const r of d.data.filter((x) => x.code === DT()).sort((a, b) => +a.no - +b.no)) { const c = document.createElement('div'); c.className = 'sj-tv'; const k = document.createElement('b'); k.textContent = r.kind; c.append(k, document.createTextNode(r.text)); box.append(c); }
  });
  document.querySelectorAll('#dt-go-hist').forEach((b) => b.addEventListener('click', () => { S.hist = DT(); open('history'); HISTN.forEach((n) => dash.draw(n)); document.querySelectorAll('#h-history').forEach((h2) => h2.scrollIntoView({ block: 'start' })); }));
  const rowsOf = (src) => { const d = dash.data(src); return d.status === 'ok' && Array.isArray(d.data) ? d.data.filter((r) => r.code === DT()) : null; };
  const oneOf = (src) => { const r = rowsOf(src); return r && r.length ? r[0] : null; };
  document.querySelectorAll('#dt-price-legend .sj-sw[data-series], #dt-profit-legend .sj-sw[data-series]').forEach((sw) => { sw.style.background = dash.colors[+sw.dataset.series]; });
  dash.draw('dt-select', (sel) => { stockOptions(sel, DT(), false); sel.onchange = () => { S.detail = sel.value; redrawDetail(); }; });
  const normQ = (s) => String(s || '').toLowerCase().replace(/[\s·()\-]/g, '');
  const dtHits = (q) => {
    const d = dash.data('stock_stats'); if (d.status !== 'ok' || !d.data || !q) return [];
    const ind = new Map((olAll() || []).map((r) => [r.code, r.industry || '']));
    const n = normQ(q);
    const score = (r) => { const nm = normQ(r.name), cd = normQ(r.code);
      if (cd === n || nm === n) return 0; if (nm.startsWith(n) || cd.startsWith(n)) return 1; if (nm.includes(n)) return 2;
      if (normQ(r.sector).includes(n)) return 3; if (normQ(ind.get(r.code)).includes(n)) return 4; return 9; };
    return d.data.map((r) => [score(r), r]).filter(([s]) => s < 9).sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name, 'ko')).map(([, r]) => r);
  };
  const pickDetail = (code) => {
    S.detail = code; redrawDetail();
    document.querySelectorAll('#dt-search').forEach((i) => { i.value = ''; });
    document.querySelectorAll('#dt-hits').forEach((b) => { b.hidden = true; b.replaceChildren(); });
  };
  const showHits = (inp) => {
    const box = document.getElementById('dt-hits'); if (!box) return;
    const q = inp.value.trim(); box.replaceChildren();
    if (!q) { box.hidden = true; return; }
    const hits = dtHits(q); box.hidden = false;
    if (!hits.length) { const s = document.createElement('span'); s.className = 'sj-muted'; s.textContent = '검색 결과가 없습니다.'; box.append(s); return; }
    for (const r of hits.slice(0, 12)) { const b = document.createElement('button'); b.type = 'button'; b.className = 'sj-hit'; b.textContent = tidy(r.name) + ' (' + r.code + ') · ' + r.sector + ' ' + fmtPct(r.chg_1d, true); b.addEventListener('click', () => pickDetail(r.code)); box.append(b); }
    if (hits.length > 12) { const s = document.createElement('span'); s.className = 'sj-muted'; s.textContent = '외 ' + (hits.length - 12) + '종목 — 더 자세히 입력해 보세요.'; box.append(s); }
  };
  document.querySelectorAll('#dt-search').forEach((inp) => {
    inp.addEventListener('input', () => showHits(inp));
    inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { const h = dtHits(inp.value.trim()); if (h.length) pickDetail(h[0].code); } if (ev.key === 'Escape') { inp.value = ''; showHits(inp); } });
  });
  dash.draw('dt-name', (el) => { const r = oneOf('stock_stats'); el.textContent = r ? r.name + ' (' + r.code + ') · ' + r.sector : '—'; });
  dash.draw('dt-cards', (box) => {
    box.replaceChildren();
    const s = oneOf('stock_stats'), t = oneOf('tech'), g = oneOf('target_view'), dv = oneOf('div_view');
    const items = [['종가(엔)', s && fmtInt(s.price)], ['전일 대비', s && fmtPct(s.chg_1d, true), s && s.chg_1d], ['3거래일', s && fmtPct(s.chg_3d, true), s && s.chg_3d],
      ['9.25 이후', s && fmtPct(s.chg_total, true), s && s.chg_total], ['시가총액(십억엔)', s && fmtInt(s.mcap_bil_yen)],
      ['RSI(14)', t && t.rsi14.toFixed(1), null, t && t.rsi_state], ['추세', t && t.trend, null, null, true],
      ['평균 목표주가', g && intF(g.target), null, g && ('괴리 ' + pctF(g.up_target))], ['PER 이론주가', g && intF(g.per_theory), null, g && ('괴리 ' + pctF(g.up_per))],
      ['배당수익률', dv && (dv.yield_pct == null ? '—' : dv.yield_pct.toFixed(2) + '%'), null, dv && ('연 ' + (dv.dps_fc == null ? '미정' : nf(dv.dps_fc) + '엔'))]];
    for (const [lab, text, signed, sub, isText] of items) {
      const c = document.createElement('div'); c.className = 'sj-stat';
      const l = document.createElement('div'); l.className = 'sj-card-label'; l.textContent = lab;
      const v = document.createElement('div'); v.className = isText ? 'sj-stat-t' : 'sj-stat-v'; v.textContent = text || '—';
      if (signed != null) cls(v, signed);
      c.append(l, v);
      if (sub) { const m = document.createElement('div'); m.className = 'sj-muted'; m.textContent = sub; c.append(m); }
      box.append(c);
    }
  });
  dash.draw('dt-price', { mount: mountLine, update: (el, made) => {
    const d = dash.data('tech_daily'); if (d.status !== 'ok') return failNote(el, made, d.status);
    made.lines.selectAll('text').remove();
    const rows = d.data.filter((r) => r.code === DT() && r.date >= '2026-09-25' && r.ma20 != null && r.ma60 != null).sort((a, b) => a.date.localeCompare(b.date));
    if (!rows.length) return failNote(el, made, 'empty');
    const mk = (name, key) => ({ name, values: rows.map((r) => ({ date: r.date, y: r[key] })) });
    lineChart(el, made, [mk('종가', 'price'), mk('20일선', 'ma20'), mk('60일선', 'ma60')], { label: '종가와 20일·60일 이동평균', tipFmt: d3.format(',.0f'), yFmt: d3.format(','), height: 240 });
  } });
  const mountSvg = (el) => { el.replaceChildren(); const svg = d3.select(el).append('svg'); const tip = document.createElement('div'); tip.className = 'sj-tip'; tip.hidden = true; el.append(tip); return { svg, tip }; };
  function perfChart(el, made, keys, label) {
    const d = dash.data('perf_years'); const svg = made.svg; svg.selectAll('*').remove();
    const rows = d.status === 'ok' && d.data ? d.data.filter((r) => r.code === DT()) : [];
    const used = keys.filter(([k]) => rows.some((r) => r[k] != null));
    if (!rows.length || !used.length) { svg.attr('height', 40).attr('viewBox', null); svg.append('text').attr('y', 20).text(d.status === 'error' ? '불러오지 못했습니다' : '공시 값 없음'); return; }
    const W = Math.max(280, el.clientWidth), H = 240, m = { t: 20, r: 12, b: 26, l: 56 };
    svg.attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H).attr('role', 'img').attr('aria-label', label);
    const labs = rows.map((r) => r.fy_label);
    const x = d3.scaleBand().domain(labs).range([m.l, W - m.r]).padding(0.35);
    const vals = rows.flatMap((r) => used.map(([k]) => r[k])).filter((v) => v != null).concat([0]);
    const [lo, hi] = d3.extent(vals);
    const y = d3.scaleLinear().domain([lo < 0 ? lo * 1.15 : 0, hi > 0 ? hi * 1.12 : 1]).nice().range([H - m.b, m.t]);
    svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickFormat(d3.format(',.0f'))).call((g) => g.select('.domain').remove());
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickSizeOuter(0));
    if (lo < 0) svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).style('stroke', 'var(--cds-chart-axis)');
    const cx = (r) => x(r.fy_label) + x.bandwidth() / 2;
    if (keys.length === 1) {
      const [k] = keys[0]; const pts = rows.filter((r) => r[k] != null);
      svg.append('g').selectAll('rect').data(pts).join('rect').attr('x', (r) => x(r.fy_label)).attr('width', x.bandwidth()).attr('rx', 3)
        .attr('y', (r) => Math.min(y(0), y(r[k]))).attr('height', (r) => Math.max(1, Math.abs(y(r[k]) - y(0)))).style('fill', dash.colors[0]).attr('opacity', (r) => r.forecast ? 0.4 : 1);
      svg.append('g').selectAll('text').data(pts).join('text').attr('x', cx).attr('y', (r) => y(Math.max(0, r[k])) - 5).attr('text-anchor', 'middle').text((r) => okuF(r[k]));
    } else {
      used.forEach(([k]) => {
        const ci = keys.findIndex(([kk]) => kk === k); const pts = rows.filter((r) => r[k] != null);
        const act = pts.filter((r) => !r.forecast), fcp = pts.filter((r) => r.forecast);
        const line = d3.line().x(cx).y((r) => y(r[k]));
        svg.append('path').attr('fill', 'none').attr('stroke-width', 2).style('stroke', dash.colors[ci]).attr('d', line(act));
        if (fcp.length && act.length) svg.append('path').attr('fill', 'none').attr('stroke-width', 2).attr('stroke-dasharray', '5 4').style('stroke', dash.colors[ci]).attr('d', line([act[act.length - 1], ...fcp]));
        svg.append('g').selectAll('circle').data(pts).join('circle').attr('r', 4).attr('cx', cx).attr('cy', (r) => y(r[k]))
          .style('fill', (r) => r.forecast ? 'var(--color-bg)' : dash.colors[ci]).style('stroke', (r) => r.forecast ? dash.colors[ci] : 'var(--color-bg)').attr('stroke-width', 2);
      });
    }
    const tip = made.tip;
    svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', (r) => x(r.fy_label) - x.step() * x.paddingInner() / 2).attr('width', x.step()).attr('y', m.t).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('pointermove', (ev, r) => {
        tip.hidden = false; tip.replaceChildren();
        const head = document.createElement('div'); head.style.fontWeight = '600'; head.textContent = r.fy_label + (r.forecast ? ' 회사 예상' : '') + ' · ' + r.standard; tip.append(head);
        keys.forEach(([k, lab], i) => { const row = document.createElement('div'); const sw = document.createElement('i'); sw.className = 'sj-sw'; sw.style.background = dash.colors[i]; row.append(sw, document.createTextNode(lab + '  ' + okuF(r[k]) + '억엔')); tip.append(row); });
        const tx = cx(r) / W * el.clientWidth; tip.style.left = (tx > el.clientWidth / 2 ? tx - tip.offsetWidth - 12 : tx + 12) + 'px'; tip.style.top = '8px';
      })
      .on('pointerleave', () => { tip.hidden = true; });
  }
  dash.draw('dt-sales', { mount: mountSvg, update: (el, made) => perfChart(el, made, [['sales', '매출액']], '결산기별 매출액(억엔)') });
  dash.draw('dt-profit', { mount: mountSvg, update: (el, made) => perfChart(el, made, [['op', '영업이익'], ['ordinary', '경상(세전)이익'], ['net', '순이익']], '결산기별 이익(억엔)') });
  dash.draw('dt-perf-rows', (tb) => {
    tb.replaceChildren(); const rows = rowsOf('perf_years'); if (!rows) return;
    for (const r of rows) addRow(tb, r.code, [[r.fy_label, 'l'], [okuF(r.sales)], [okuF(r.op)], [okuF(r.ordinary)], [okuF(r.net), '', r.net < 0 ? -1 : null], [pctF(r.net_chg), '', r.net_chg], [r.standard, 'l']], r.forecast ? 'sj-muted' : '');
  });
  dash.draw('dt-target', { mount: mountSvg, update: (el, made) => {
    const svg = made.svg; svg.selectAll('*').remove();
    const r = oneOf('target_view');
    if (!r) { svg.attr('height', 40).attr('viewBox', null); svg.append('text').attr('y', 20).text('자료 없음'); return; }
    const items = [['현재가 (최근 종가)', r.price, null, null], ['애널리스트 평균 목표', r.target, null, null], ['PBR 기준 이론주가', r.pbr_theory, r.pbr_low, r.pbr_high], ['PER 기준 이론주가', r.per_theory, r.per_low, r.per_high]]
      .map((it, i) => [...it, i]).filter((it) => it[1] != null);
    const W = Math.max(300, el.clientWidth), rowH = 34, m = { t: 8, r: 120, b: 24, l: 130 };
    const H = m.t + m.b + items.length * rowH;
    svg.attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H).attr('role', 'img').attr('aria-label', '현재가·목표주가·이론주가 비교');
    const all = items.flatMap((it) => [it[1], it[2], it[3]]).filter((v) => v != null);
    const [lo, hi] = d3.extent(all); const pad = (hi - lo) * 0.08 || hi * 0.05;
    const x = d3.scaleLinear().domain([lo - pad, hi + pad]).nice().range([m.l, W - m.r]);
    svg.append('g').attr('class', 'grid').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(5).tickSize(-(H - m.t - m.b)).tickFormat(d3.format(','))).call((g) => g.select('.domain').remove());
    svg.append('line').attr('x1', x(r.price)).attr('x2', x(r.price)).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--cds-chart-reference)').attr('stroke-dasharray', '4 3');
    items.forEach(([lab, v, a, b, ci], i) => {
      const g = svg.append('g').attr('transform', `translate(0,${m.t + i * rowH + rowH / 2})`);
      g.append('text').attr('x', m.l - 10).attr('dy', '0.35em').attr('text-anchor', 'end').style('fill', 'var(--color-fg)').text(lab);
      if (a != null && b != null) g.append('rect').attr('x', x(a)).attr('width', Math.max(2, x(b) - x(a))).attr('y', -6).attr('height', 12).attr('rx', 6).style('fill', dash.colors[ci]).attr('opacity', 0.3);
      g.append('circle').attr('cx', x(v)).attr('r', 6).style('fill', dash.colors[ci]).style('stroke', 'var(--color-bg)').attr('stroke-width', 2);
      const gap = ci > 0 && r.price ? ' (' + fmtPct(Math.round((v / r.price - 1) * 1000) / 10, true) + ')' : '';
      const right = x(Math.max(v, b == null ? v : b)), left = x(Math.min(v, a == null ? v : a));
      const txt = g.append('text').attr('dy', '0.35em').text(fmtInt(Math.round(v)) + '엔' + gap + (a != null ? ' · ' + rng(a, b) : ''));
      const tw = txt.node().getComputedTextLength ? txt.node().getComputedTextLength() : txt.text().length * 7;
      if (right + 10 + tw <= W - 4) txt.attr('x', right + 10);
      else if (left - 10 - tw >= m.l) txt.attr('x', left - 10).attr('text-anchor', 'end');
      else txt.attr('x', Math.min(W - 4 - tw / 2, Math.max(m.l + tw / 2, x(v)))).attr('text-anchor', 'middle').attr('dy', '1.6em');
    });
  } });
  dash.draw('dt-target-note', (el) => {
    const r = oneOf('target_view'); if (!r) { el.textContent = '—'; return; }
    el.textContent = '목표 판단 ' + (r.target_view || '—') + ' · 레이팅 ' + (r.rating == null ? '—' : r.rating.toFixed(2)) + '/5 (' + (r.rating_label || '—') + ') · 애널리스트 ' + (r.analysts || 0) + '명: 매수 ' + r.buy + ' · 중립 ' + r.neutral + ' · 매도 ' + r.sell +
      ' · PBR 판단 ' + (r.pbr_view || '—') + ' · PER 판단 ' + (r.per_view || '—') + ' · 실적 PBR ' + (r.pbr == null ? '—' : r.pbr.toFixed(2) + '배') + ' · 예상 PER ' + (r.per_fc == null ? '—' : r.per_fc.toFixed(1) + '배') +
      (r.flag ? ' · ⚠ 목표주가 괴리가 커서 확인 필요' : '') + ' · kabuyoho.jp ' + dLabel(r.asof) + ' 기준';
  });
  dash.draw('dt-pie', (el) => {
    el.replaceChildren(); const rows = rowsOf('segments'); if (!rows || !rows.length) { el.textContent = '—'; return; }
    const colors = segColor(rows);
    const W = Math.max(220, Math.min(el.clientWidth, 300)), R = W / 2 - 6;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${W}`).attr('height', W).style('max-width', W + 'px').attr('role', 'img').attr('aria-label', '부문별 비중');
    const g = svg.append('g').attr('transform', `translate(${W / 2},${W / 2})`);
    const pie = d3.pie().sort(null).value((r) => +r.share_pct)(rows);
    const arc = d3.arc().innerRadius(R * 0.5).outerRadius(R).padAngle(0.01);
    g.selectAll('path').data(pie).join('path').attr('d', arc).style('fill', (p, i) => colors[i]).style('stroke', 'var(--color-bg)').attr('stroke-width', 2);
    const total = d3.sum(rows, (r) => +r.share_pct);
    g.selectAll('text').data(pie.filter((p) => +p.data.share_pct / total >= 0.06)).join('text').attr('transform', (p) => `translate(${arc.centroid(p)})`).attr('text-anchor', 'middle').attr('dy', '0.35em').text((p) => Math.round(+p.data.share_pct) + '%');
    const ul = document.createElement('ul'); ul.className = 'sj-list';
    rows.forEach((r, i) => { const li = document.createElement('li'); const a = document.createElement('span'); const sw = document.createElement('i'); sw.className = 'sj-sw'; sw.style.background = colors[i]; a.append(sw, document.createTextNode(r.segment)); const b = document.createElement('span'); b.textContent = (+r.share_pct).toFixed(1) + '%'; li.append(a, b); ul.append(li); });
    const cap = document.createElement('p'); cap.className = 'sj-muted'; cap.textContent = rows[0].basis + ' · ' + rows[0].fiscal + '기';
    el.append(ul, cap);
  });
  dash.draw('dt-div', (ul) => {
    ul.replaceChildren(); const r = oneOf('div_view');
    if (!r) { ul.append(Object.assign(document.createElement('li'), { textContent: '—' })); return; }
    const items = [['결산기', r.fy], ['연간 예상 배당', r.dps_fc == null ? '미정' : nf(r.dps_fc) + '엔'], ['전기 배당', r.dps_prev1 == null ? '—' : nf(r.dps_prev1) + '엔'], ['배당수익률', r.yield_pct == null ? '—' : r.yield_pct.toFixed(2) + '%'],
      ['배당성향', r.payout_pct == null ? '—' : r.payout_pct.toFixed(1) + '%'], ['다음 배당락일', r.next_ex ? dLabel(r.next_ex) + ' (' + r.next_kind + (r.next_dps ? ', ' + nf(r.next_dps) + '엔' : '') + ')' : '—'], ['권리부 최종일', dLabel(r.next_last_cum)]];
    for (const [k, v] of items) { const li = document.createElement('li'); const a = document.createElement('span'); a.textContent = k; const b = document.createElement('span'); b.textContent = v; li.append(a, b); ul.append(li); }
  });
  dash.draw('dt-hist', (ol) => {
    ol.replaceChildren(); const rows = rowsOf('company_history'); if (!rows) return;
    rows.slice().sort((a, b) => b.ym.localeCompare(a.ym)).slice(0, 5).forEach((r) => { const li = document.createElement('li'); const b = document.createElement('span'); b.className = 'sj-tl-date'; b.textContent = r.ym; li.append(b, document.createTextNode(r.event)); ol.append(li); });
  });
  window.__sj4 = { olAll, normQ, dtHits, rowsOf, oneOf, mountSvg };
})();

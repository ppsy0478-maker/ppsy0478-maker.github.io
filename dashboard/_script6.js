(function () {
  const { S, fmtPct, dateLabel, cls, tidy, lineChart, mountLine, failNote } = window.__sj;
  const { dLabel, addRow, DT, goDetail, redrawHist } = window.__sj3;
  const { olAll, normQ, dtHits } = window.__sj4;
  const { redrawNews } = window.__sj5;

  // ---------- US Treasuries ----------
  dash.calc('treasury_view', { inputs: ['treasury'], fn: (rows) => {
    const t = rows.map((r) => ({ date: r.date, m3: +r.m3, y2: +r.y2, y5: +r.y5, y10: +r.y10, y20: +r.y20, y30: +r.y30 })).sort((a, b) => a.date.localeCompare(b.date));
    const r2 = (v) => Math.round(v * 100) / 100;
    return t.map((r, i) => ({ ...r, d30: i ? Math.round((r.y30 - t[i - 1].y30) * 100) : null, s30_2: r2(r.y30 - r.y2), s30_10: r2(r.y30 - r.y10), s30_20: r2(r.y30 - r.y20) }));
  } });
  dash.calc('treasury_events', { inputs: ['treasury_view', 'treasury_notes'], fn: (tv, notes) => { const m = new Map(tv.map((r) => [r.date, r])); return notes.map((n) => { const r = m.get(n.date) || {}; return { date: n.date, y30: r.y30 ?? null, d30: r.d30 ?? null, y10: r.y10 ?? null, y2: r.y2 ?? null, note: n.note }; }).sort((a, b) => b.date.localeCompare(a.date)); } });
  document.querySelectorAll('#ust-legend .sj-sw[data-series], #ust-sp-legend .sj-sw[data-series]').forEach((sw) => { sw.style.background = dash.colors[+sw.dataset.series]; });
  const ustRows = () => { const d = dash.data('treasury_view'); if (d.status !== 'ok' || !d.data) return null; return d.data.filter((r) => S.ustRange === 'ytd' || r.date >= '2026-09-25'); };
  const bp = (v) => v == null ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + 'bp';
  document.querySelectorAll('#ust-range').forEach((s) => s.addEventListener('change', () => { S.ustRange = s.value; ['ust-chart', 'ust30-chart', 'ust-sp-chart'].forEach((n) => dash.draw(n)); }));
  const ustSum = () => { const d = dash.data('treasury_summary'); return d.status === 'ok' && d.data && d.data.length ? d.data.slice().sort((a, b) => b.date.localeCompare(a.date))[0] : null; };
  dash.draw('ust-title', (el) => { const r = ustSum(); el.textContent = r ? dateLabel(r.date) + ' 미국 국채 · ' + r.title : '미국 국채'; });
  dash.draw('ust-note', (box) => { box.replaceChildren(); const r = ustSum(); if (!r) return; box.className = 'sj-report';
    const p0 = document.createElement('p'); p0.className = 'rp-lede'; p0.textContent = r.lede; box.append(p0);
    for (const para of String(r.body || '').split(/\n+|\s*¶\s*/).filter(Boolean)) { const p = document.createElement('p'); p.textContent = para; box.append(p); } });
  const statCard = (box, lab, val, sub, sign) => { const c = document.createElement('div'); c.className = 'sj-stat'; const l = document.createElement('div'); l.className = 'sj-card-label'; l.textContent = lab;
    const v = document.createElement('div'); v.className = 'sj-stat-v'; v.textContent = val; const m = document.createElement('div'); m.className = 'sj-muted'; m.textContent = sub;
    if (sign != null) { m.classList.toggle('up', sign < 0); m.classList.toggle('down', sign > 0); } c.append(l, v, m); box.append(c); };
  dash.draw('ust-cards', (box) => { box.replaceChildren(); const d = dash.data('treasury_view'); if (d.status !== 'ok' || !d.data || d.data.length < 2) return;
    const t = d.data, L = t[t.length - 1], P = t[t.length - 2], B = t.find((r) => r.date >= '2026-09-25') || t[0];
    for (const [k, lab] of [['m3', '3개월물'], ['y2', '2년물'], ['y10', '10년물'], ['y30', '30년물']]) { const d1 = Math.round((L[k] - P[k]) * 100), dt = Math.round((L[k] - B[k]) * 100); statCard(box, lab + ' (' + dateLabel(L.date) + ')', L[k].toFixed(2) + '%', '전일 ' + bp(d1) + ' · 9.25 이후 ' + bp(dt), dt); } });
  dash.draw('ust30-cards', (box) => { box.replaceChildren(); const d = dash.data('treasury_view'); if (d.status !== 'ok' || !d.data || !d.data.length) return;
    const t = d.data, L = t[t.length - 1], since = t.filter((r) => r.date >= '2026-09-25');
    const hi = (a) => a.reduce((m, r) => r.y30 > m.y30 ? r : m, a[0]), lo = (a) => a.reduce((m, r) => r.y30 < m.y30 ? r : m, a[0]);
    const H = hi(t), Lo = lo(t), H2 = hi(since), L2 = lo(since);
    const avg = (n) => (t.slice(-n).reduce((s, r) => s + r.y30, 0) / Math.min(n, t.length)).toFixed(2);
    statCard(box, '2026년 최고', H.y30.toFixed(2) + '%', dateLabel(H.date) + ' · 지금보다 ' + bp(Math.round((H.y30 - L.y30) * 100)) + ' 높음', null);
    statCard(box, '2026년 최저', Lo.y30.toFixed(2) + '%', dateLabel(Lo.date) + ' · 연초 이후 ' + bp(Math.round((L.y30 - t[0].y30) * 100)), null);
    statCard(box, '9.25 이후 범위', L2.y30.toFixed(2) + '~' + H2.y30.toFixed(2) + '%', '저점 ' + dateLabel(L2.date) + ' · 고점 ' + dateLabel(H2.date), null);
    statCard(box, '평균 (최근 20·60거래일)', avg(20) + '%', '60거래일 ' + avg(60) + '%', null);
    statCard(box, '30년 − 2년', L.s30_2.toFixed(2) + '%p', '9.25 ' + (since[0] ? since[0].s30_2.toFixed(2) : '—') + '%p', null);
    statCard(box, '30년 − 10년', L.s30_10.toFixed(2) + '%p', '9.25 ' + (since[0] ? since[0].s30_10.toFixed(2) : '—') + '%p', null);
    statCard(box, '30년 − 20년', (L.s30_20 > 0 ? '+' : '') + L.s30_20.toFixed(2) + '%p', L.s30_20 < 0 ? '20년물이 30년물보다 높음' : '30년물이 더 높음', null); });
  const ustLine = (keys, label, fmt) => ({ mount: mountLine, update: (el, made) => { const d = dash.data('treasury_view'); if (d.status !== 'ok') return failNote(el, made, d.status);
    made.lines.selectAll('text').remove(); const rows = ustRows(); if (!rows || !rows.length) return failNote(el, made, 'empty');
    lineChart(el, made, keys.map(([k, name, c]) => ({ name, color: c == null ? undefined : dash.colors[c], values: rows.map((r) => ({ date: r.date, y: r[k] })) })), { label, tipFmt: fmt, yFmt: d3.format('.2f'), height: 260 }); } });
  dash.draw('ust-chart', ustLine([['y2', '2년물', 0], ['y10', '10년물', 1], ['y30', '30년물', 2]], '미국 국채 2년·10년·30년물 금리', (v) => v.toFixed(2) + '%'));
  dash.draw('ust30-chart', ustLine([['y30', '30년물', 2]], '미국 국채 30년물 금리', (v) => v.toFixed(2) + '%'));
  dash.draw('ust-sp-chart', ustLine([['s30_2', '30년−2년', 0], ['s30_10', '30년−10년', 1], ['s30_20', '30년−20년', 3]], '30년물과 2·10·20년물의 금리 차이', (v) => v.toFixed(2) + '%p'));
  dash.draw('ust-ev-rows', (tb) => { tb.replaceChildren(); const d = dash.data('treasury_events'); if (d.status !== 'ok' || !d.data) return;
    for (const r of d.data) addRow(tb, r.date, [[dateLabel(r.date), 'l'], [r.y30 == null ? '—' : r.y30.toFixed(2) + '%'], [bp(r.d30), '', r.d30 == null ? null : -r.d30], [r.y10 == null ? '—' : r.y10.toFixed(2) + '%'], [r.y2 == null ? '—' : r.y2.toFixed(2) + '%'], [r.note, 'l wrap']]); });
  dash.draw('ust-rows', (tb) => { tb.replaceChildren(); const d = dash.data('treasury_view'); if (d.status !== 'ok' || !d.data) return;
    for (const r of d.data.slice().reverse().filter((x) => x.date >= '2026-09-01')) addRow(tb, r.date, [[dateLabel(r.date), 'l'], [r.m3.toFixed(2)], [r.y2.toFixed(2)], [r.y5.toFixed(2)], [r.y10.toFixed(2)], [r.y20.toFixed(2)], [r.y30.toFixed(2)], [bp(r.d30), '', r.d30 == null ? null : -r.d30], [r.s30_2.toFixed(2)], [r.s30_10.toFixed(2)]]); });

  // ---------- board ----------
  dash.calc('board_view', { inputs: ['board', 'stock_stats'], fn: (board, stock_stats) => {
    const st = new Map(stock_stats.map((r) => [r.code, r])); const n = (v) => v === '' || v == null ? null : +v;
    return board.map((r) => ({ date: r.date, time: r.time, code: r.code, name: tidy((st.get(r.code) || {}).name || r.code), sector: (st.get(r.code) || {}).sector || '',
      strong_buy: n(r.strong_buy), buy: n(r.buy), strong_sell: n(r.strong_sell), sell: n(r.sell), span_h: n(r.span_h), posts: n(r.posts),
      buy_pct: n(r.buy_pct), hold: n(r.hold), sell_pct: n(r.sell_pct), net: n(r.net), posts_24h: n(r.posts_24h), rate_h: n(r.rate_h), activity: r.activity,
      bull: n(r.bull), bear: n(r.bear), themes: r.themes, small: r.sample_note, note: r.note }));
  } });
  const bdDate = () => { const d = dash.data('board_notes'); const ds = d.status === 'ok' && d.data ? d.data.map((r) => r.date).sort() : []; return ds.includes(S.bd) ? S.bd : ds[ds.length - 1] || null; };
  const bdRows = () => { const d = dash.data('board_view'); const date = bdDate(); if (d.status !== 'ok' || !d.data || !date) return null; const k = S.bdSort || 'rate_h'; return d.data.filter((r) => r.date === date).sort((a, b) => (b[k] ?? -999) - (a[k] ?? -999)); };
  const redrawBd = () => ['bd-select', 'bd-title', 'bd-note', 'bd-co-select', 'bd-co', 'bd-bars', 'bd-rows'].forEach((n) => dash.draw(n));
  const bdCode = () => { const rows = bdRows(); if (!rows || !rows.length) return null; return rows.some((r) => r.code === S.bdCode) ? S.bdCode : rows[0].code; };
  const bdPick = (code) => { S.bdCode = code; redrawBd(); document.querySelectorAll('#h-board-co').forEach((h2) => h2.scrollIntoView({ behavior: 'smooth', block: 'start' })); };
  dash.draw('bd-co-select', (sel) => { const rows = (bdRows() || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'ko')); sel.replaceChildren(...rows.map((r) => new Option(r.name + ' (' + r.code + ')' + (r.small ? ' *' : ''), r.code))); const c = bdCode(); if (c) sel.value = c; sel.onchange = () => { S.bdCode = sel.value; redrawBd(); }; });
  function boardCard(box, r, hist, withDate) {
    box.className = 'sj-report';
    const h = document.createElement('p'); h.className = 'rp-lede'; h.textContent = (withDate ? dateLabel(r.date) + ' ' + (r.time || '') + ' 기준 · ' : r.name + ' (' + r.code + ') · ' + r.sector + ' · ') + '활동 ' + r.activity + (r.small ? ' · 표본 적음' : ''); box.append(h);
    const parts = [['강한 매수', r.strong_buy, 'var(--color-ok)', 1], ['매수', r.buy, 'var(--color-ok)', 0.55], ['관망', r.hold, 'var(--cds-chart-muted)', 1], ['매도', r.sell, 'var(--color-bad)', 0.55], ['강한 매도', r.strong_sell, 'var(--color-bad)', 1]];
    if (parts.some(([, v]) => v != null)) {
      const bar = document.createElement('div'); bar.style.cssText = 'display:flex;height:22px;border-radius:4px;overflow:hidden;margin:8px 0 4px';
      for (const [lab, v, col, op] of parts) { if (!v) continue; const s = document.createElement('div'); s.style.cssText = `width:${v}%;background:${col};opacity:${op}`; s.title = lab + ' ' + v.toFixed(1) + '%'; bar.append(s); }
      const leg = document.createElement('div'); leg.className = 'sj-muted'; leg.textContent = parts.map(([lab, v]) => lab + ' ' + (v == null ? '—' : v.toFixed(0) + '%')).join(' · ') + " (최근 1주일 '모두의 평가')"; box.append(bar, leg);
    } else { const p = document.createElement('p'); p.className = 'sj-muted'; p.textContent = "이 게시판은 '모두의 평가' 정보가 없습니다."; box.append(p); }
    const dl = document.createElement('dl');
    const items = [['매수 − 매도', r.net == null ? '—' : (r.net > 0 ? '+' : '') + r.net.toFixed(0) + '%p'], ['활동량', (r.rate_h == null ? '—' : r.rate_h.toFixed(1) + '건/시간') + ' · 최근 24시간 ' + (r.posts_24h ?? '—') + '건'],
      ['표현', '긍정 ' + (r.bull ?? 0) + '회 · 부정 ' + (r.bear ?? 0) + '회'], ['많이 나온 주제', r.themes || '—'], ['최근 글 요약', r.note || '이번 기록에서는 요약 대상(활발하거나 분위기가 극단적인 종목)이 아니었습니다.']];
    for (const [k, v] of items) { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); }
    const dt = document.createElement('dt'); dt.textContent = '게시판'; const dd = document.createElement('dd'); const a = document.createElement('a'); a.href = 'https://finance.yahoo.co.jp/quote/' + encodeURIComponent(r.code) + '.T/forum'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = '야후재팬 게시판 열기'; dd.append(a); dl.append(dt, dd);
    box.append(dl);
    const hp = document.createElement('p'); hp.className = 'sj-muted'; hp.style.marginTop = '10px';
    hp.textContent = hist.length > 1 ? '날짜별 추이: ' + hist.map((x) => dateLabel(x.date) + ' ' + (x.net == null ? '—' : (x.net > 0 ? '+' : '') + x.net.toFixed(0)) + '·' + (x.rate_h == null ? '—' : x.rate_h.toFixed(1) + '건/h')).join(' → ') : '날짜별 추이는 기록이 쌓이면 여기에 이어서 나옵니다.';
    box.append(hp);
  }
  dash.draw('dt-board', (box) => { box.replaceChildren(); const d = dash.data('board_view'); const code = DT(); if (d.status !== 'ok' || !d.data || !code) return;
    const hist = d.data.filter((x) => x.code === code).sort((a, b) => a.date.localeCompare(b.date)); if (!hist.length) { box.className = 'sj-muted'; box.textContent = '게시판 기록이 없습니다.'; return; } boardCard(box, hist[hist.length - 1], hist, true); });
  dash.draw('bd-co', (box) => { box.replaceChildren(); const d = dash.data('board_view'); const code = bdCode(); const date = bdDate(); if (d.status !== 'ok' || !d.data || !code) return;
    const r = d.data.find((x) => x.code === code && x.date === date); if (!r) return; boardCard(box, r, d.data.filter((x) => x.code === code).sort((a, b) => a.date.localeCompare(b.date)), false); });
  document.querySelectorAll('#bd-sort').forEach((s) => s.addEventListener('change', () => { S.bdSort = s.value; redrawBd(); }));
  dash.draw('bd-select', (sel) => { const d = dash.data('board_notes'); const rows = d.status === 'ok' && d.data ? d.data.slice().sort((a, b) => b.date.localeCompare(a.date)) : [];
    sel.replaceChildren(...rows.map((r) => new Option(dateLabel(r.date) + ' ' + (r.time || '') + ' · ' + r.title, r.date))); const c = bdDate(); if (c) sel.value = c; sel.onchange = () => { S.bd = sel.value; redrawBd(); }; });
  dash.draw('bd-title', (el) => { const d = dash.data('board_notes'); const date = bdDate(); const r = d.status === 'ok' && d.data ? d.data.find((x) => x.date === date) : null; el.textContent = r ? dateLabel(r.date) + ' ' + (r.time || '') + ' 게시판 동향 · ' + r.title : '—'; });
  dash.draw('bd-note', (box) => { box.replaceChildren(); const d = dash.data('board_notes'); const date = bdDate(); const r = d.status === 'ok' && d.data ? d.data.find((x) => x.date === date) : null; if (!r) return;
    box.className = 'sj-report'; const p0 = document.createElement('p'); p0.className = 'rp-lede'; p0.textContent = r.summary; box.append(p0);
    for (const para of String(r.body || '').split(/\n+|\s*¶\s*/).filter(Boolean)) { const p = document.createElement('p'); p.textContent = para; box.append(p); } });
  dash.draw('bd-bars', (el) => {
    el.replaceChildren(); const all = bdRows(); if (!all) return;
    const rows = all.filter((r) => r.net != null).slice().sort((a, b) => b.net - a.net);
    const W = Math.max(300, el.clientWidth), bh = 14, gap = 4, m = { t: 4, r: 56, b: 22, l: 120 }; const H = m.t + m.b + rows.length * (bh + gap);
    const x = d3.scaleLinear().domain([-100, 100]).range([m.l, W - m.r]);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H).attr('role', 'img').attr('aria-label', '종목별 게시판 감정');
    svg.append('g').attr('class', 'grid').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues([-100, -50, 0, 50, 100]).tickFormat((v) => (v > 0 ? '+' : '') + v).tickSize(-(H - m.t - m.b))).call((g) => g.select('.domain').remove());
    const cur = bdCode();
    const g = svg.selectAll('g.bar').data(rows).join('g').attr('class', 'bar').attr('transform', (r, i) => `translate(0,${m.t + i * (bh + gap)})`).style('cursor', 'pointer').on('click', (ev, r) => bdPick(r.code));
    g.append('rect').attr('x', m.l).attr('width', W - m.l - m.r).attr('height', bh).attr('fill', 'transparent');
    g.append('rect').attr('x', (r) => Math.min(x(0), x(r.net))).attr('width', (r) => Math.max(1, Math.abs(x(r.net) - x(0)))).attr('height', bh).attr('rx', 2)
      .style('fill', (r) => r.net >= 0 ? 'var(--color-ok)' : 'var(--color-bad)').attr('opacity', (r) => r.code === cur ? 1 : r.small ? 0.3 : 0.75).style('stroke', (r) => r.code === cur ? 'var(--color-fg)' : 'none').attr('stroke-width', 1.5);
    g.append('text').attr('x', m.l - 6).attr('y', bh / 2).attr('dy', '0.35em').attr('text-anchor', 'end').style('fill', 'var(--color-fg)').text((r) => r.name);
    g.append('text').attr('y', bh / 2).attr('dy', '0.35em').attr('x', (r) => r.net >= 0 ? x(r.net) + 4 : x(r.net) - 4).attr('text-anchor', (r) => r.net >= 0 ? 'start' : 'end').text((r) => (r.net > 0 ? '+' : '') + r.net.toFixed(0) + (r.small ? ' *' : ''));
  });
  dash.draw('bd-rows', (tb) => {
    tb.replaceChildren(); const rows = bdRows(); if (!rows) return; const p = (v) => v == null ? '—' : v.toFixed(0) + '%';
    for (const r of rows) { addRow(tb, r.code, [[r.name + (r.small ? ' *' : ''), 'l'], [p(r.buy_pct)], [p(r.hold)], [p(r.sell_pct)], [r.net == null ? '—' : (r.net > 0 ? '+' : '') + r.net.toFixed(0), '', r.net], [r.rate_h == null ? '—' : r.rate_h.toFixed(1)], [r.posts_24h == null ? '—' : String(r.posts_24h)], [r.activity, 'l'], [r.themes || '', 'l wrap'], [r.note || '', 'l wrap']], 'sj-click' + (r.code === bdCode() ? ' sj-on' : ''));
      tb.lastChild.addEventListener('click', () => bdPick(r.code)); }
    const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 10; td.className = 'l wrap'; td.textContent = '* 표본 적음: 최근 24시간 글이 10건 미만이거나 활동이 한산해 감정 비율이 몇 표에 크게 좌우됩니다.'; tr.append(td); tb.append(tr);
  });

  // ---------- outlook ----------
  const OLV = ['개선', '양호', '중립', '혼조', '악화', '언급 없음'];
  const olBadge = (v) => { const b = document.createElement('span'); b.className = 'sj-badge ' + (v === '개선' || v === '양호' ? 'up' : v === '악화' ? 'down' : 'neu'); b.textContent = v; return b; };
  const fcText = (f) => !f || f === '–' ? '언급 없음' : f;
  const olRows = () => { const all = olAll(); if (!all) return null; const k = S.olSort || 'score'; const nz = (v) => v == null ? -99 : v;
    return all.filter((r) => !S.olV || r.verdict === S.olV).sort((a, b) => k === 'sector' ? a.sector.localeCompare(b.sector, 'ko') || nz(b.score) - nz(a.score) : k === 'doc_date' ? String(b.doc_date).localeCompare(String(a.doc_date)) : k === 'chg_total' ? nz(b.chg_total) - nz(a.chg_total) : nz(b.score) - nz(a.score) || a.name.localeCompare(b.name, 'ko')); };
  const olCur = () => { const rows = olRows(); if (!rows || !rows.length) return null; return rows.find((r) => r.code === S.ol) || rows[0]; };
  const redrawOl = () => ['ol-stats', 'ol-sector', 'ol-title', 'ol-card', 'ol-rows'].forEach((n) => dash.draw(n));
  document.querySelectorAll('#ol-verdict').forEach((s) => s.addEventListener('change', () => { S.olV = s.value; redrawOl(); }));
  document.querySelectorAll('#ol-sort').forEach((s) => s.addEventListener('change', () => { S.olSort = s.value; redrawOl(); }));
  function olCard(box, r, withName) {
    box.className = 'sj-report';
    const h = document.createElement('p'); h.className = 'rp-lede'; h.append(olBadge(r.verdict), document.createTextNode(' ' + (withName ? r.name + ' (' + r.code + ') · ' : '') + r.industry + ' · 연간 전망 ' + fcText(r.forecast))); box.append(h);
    const p1 = document.createElement('p'); p1.textContent = r.env_ko; box.append(p1);
    const dl = document.createElement('dl');
    const add = (k, v, href) => { if (!v) return; const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd');
      if (href && /^https:\/\/www\.release\.tdnet\.info\//.test(href)) { const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = v; dd.append(a); } else dd.textContent = v; dl.append(dt, dd); };
    add('실적 전망', r.outlook_ko); add('근거 공시', r.doc_title ? dLabel(r.doc_date) + ' ' + r.doc_title : '', r.doc_url); add('설명자료', r.slide_title || '', r.slide_url);
    add('9.25 이후 주가', r.chg_total == null ? '' : fmtPct(r.chg_total, true)); add('정리일', dLabel(r.asof)); box.append(dl);
  }
  dash.draw('ol-stats', (box) => { box.replaceChildren(); const all = olAll(); if (!all) return;
    for (const v of OLV) { const n = all.filter((r) => r.verdict === v).length; const c = document.createElement('div'); c.className = 'sj-stat'; c.style.cursor = 'pointer'; if (S.olV === v) c.style.outline = '2px solid var(--color-fg)';
      const l = document.createElement('div'); l.className = 'sj-card-label'; l.textContent = v; const val = document.createElement('div'); val.className = 'sj-stat-v'; val.textContent = n + '종목'; if (v === '개선' || v === '양호') cls(val, 1); if (v === '악화') cls(val, -1);
      c.append(l, val); c.addEventListener('click', () => { S.olV = S.olV === v ? '' : v; document.querySelectorAll('#ol-verdict').forEach((s) => { s.value = S.olV; }); redrawOl(); }); box.append(c); }
    const up = all.filter((r) => r.forecast === '상향').length, dn = all.filter((r) => r.forecast === '하향').length;
    const c = document.createElement('div'); c.className = 'sj-stat'; const l = document.createElement('div'); l.className = 'sj-card-label'; l.textContent = '연간 전망 상향 · 하향';
    const val = document.createElement('div'); val.className = 'sj-stat-v'; val.textContent = up + ' · ' + dn; const m = document.createElement('div'); m.className = 'sj-muted'; m.textContent = '62종목 중 (이번 결산 시즌)'; c.append(l, val, m); box.append(c); });
  dash.draw('ol-sector', (el) => {
    el.replaceChildren(); const d = dash.data('outlook_sector'); if (d.status !== 'ok' || !d.data) return;
    const rows = d.data.filter((r) => r.avg != null).sort((a, b) => b.avg - a.avg);
    const W = Math.max(300, el.clientWidth), bh = 18, gap = 6, m = { t: 4, r: 120, b: 22, l: 110 }; const H = m.t + m.b + rows.length * (bh + gap);
    const x = d3.scaleLinear().domain([-2, 2]).range([m.l, W - m.r]);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H).attr('role', 'img').attr('aria-label', '업종별 평균 업황 점수');
    svg.append('g').attr('class', 'grid').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickValues([-2, -1, 0, 1, 2]).tickFormat((v) => (v > 0 ? '+' : '') + v).tickSize(-(H - m.t - m.b))).call((g) => g.select('.domain').remove());
    svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--cds-chart-axis)');
    const g = svg.selectAll('g.bar').data(rows).join('g').attr('class', 'bar').attr('transform', (r, i) => `translate(0,${m.t + i * (bh + gap)})`);
    g.append('rect').attr('x', (r) => Math.min(x(0), x(r.avg))).attr('width', (r) => Math.max(1, Math.abs(x(r.avg) - x(0)))).attr('height', bh).attr('rx', 3).style('fill', (r) => r.avg >= 0 ? 'var(--color-ok)' : 'var(--color-bad)');
    g.append('text').attr('x', m.l - 8).attr('y', bh / 2).attr('dy', '0.35em').attr('text-anchor', 'end').style('fill', 'var(--color-fg)').text((r) => r.sector);
    g.append('text').attr('y', bh / 2).attr('dy', '0.35em').attr('x', (r) => Math.max(x(0), x(r.avg)) + 4).text((r) => (r.avg > 0 ? '+' : '') + r.avg.toFixed(1) + ' (' + r.scored + '/' + r.stocks + '종목)');
  });
  dash.draw('ol-title', (el) => { const r = olCur(); el.textContent = r ? r.name + ' (' + r.code + ') · ' + r.verdict : '—'; });
  dash.draw('ol-card', (box) => { box.replaceChildren(); const r = olCur(); if (r) olCard(box, r, true); });
  dash.draw('ol-rows', (tb) => { tb.replaceChildren(); const rows = olRows(); if (!rows) return; const cur = olCur();
    for (const r of rows) { addRow(tb, r.code, [[r.name, 'l'], [r.sector, 'l'], [r.industry, 'l'], [r.verdict, 'l', r.score == null || r.score === 0 ? null : r.score], [fcText(r.forecast), 'l', r.forecast === '상향' ? 1 : r.forecast === '하향' ? -1 : null], [r.env_ko, 'l wrap'], [dLabel(r.doc_date), 'l'], [r.chg_total == null ? '—' : fmtPct(r.chg_total, true), '', r.chg_total]], 'sj-click' + (cur && r.code === cur.code ? ' sj-on' : ''));
      tb.lastChild.addEventListener('click', () => { S.ol = r.code; redrawOl(); document.querySelectorAll('#h-ol-card').forEach((h2) => h2.scrollIntoView({ behavior: 'smooth', block: 'start' })); }); } });
  dash.draw('dt-outlook', (box) => { box.replaceChildren(); const all = olAll(); if (!all) return; const r = all.find((x) => x.code === DT()); if (!r) { box.className = 'sj-muted'; box.textContent = '업황 코멘트 기록이 없습니다.'; return; } olCard(box, r, false); });

  // ---------- per-tab search ----------
  const TAB_PICK = {
    stocks: (c) => { S.sel = c; window.__sj.redrawSel(); },
    history: (c) => { S.hist = c; redrawHist(); },
    segments: (c) => { S.seg = c; ['seg-select', 'seg-pie', 'seg-rows', 'seg-basis', 'seg-total', 'seg-detail'].forEach((n) => dash.draw(n)); },
    news: (c) => { S.news = c; redrawNews(); }, board: (c) => { S.bdCode = c; redrawBd(); }, outlook: (c) => { S.ol = c; redrawOl(); },
    perf: goDetail, targets: goDetail, dividends: goDetail, flows: goDetail, etf: goDetail, overview: goDetail
  };
  const PICK_LABEL = { perf: 1, targets: 1, dividends: 1, flows: 1, etf: 1, overview: 1 };
  document.querySelectorAll('.sj section[data-tab]').forEach((sec) => {
    if (sec.id === 'detail') return;
    const pick = TAB_PICK[sec.id];
    const bar = document.createElement('div'); bar.className = 'sj-controls';
    const lab = document.createElement('label'); lab.textContent = '검색 ';
    const inp = document.createElement('input'); inp.type = 'search'; inp.className = 'sj-search'; inp.autocomplete = 'off';
    inp.placeholder = pick ? '종목명·코드·업종, 또는 표 안의 단어' : '표·목록 안의 단어 (예: 반도체, 금리)'; inp.setAttribute('aria-label', '이 탭에서 검색'); lab.append(inp);
    const cnt = document.createElement('span'); cnt.className = 'sj-muted'; bar.append(lab, cnt);
    const hits = document.createElement('div'); hits.className = 'sj-hits'; hits.hidden = true;
    sec.prepend(bar, hits);
    const apply = () => { const q = normQ(inp.value.trim()); let shown = 0, total = 0;
      sec.querySelectorAll('table tbody tr, ul.sj-news > li').forEach((el) => { if (el.closest('.sj-hits')) return; if (el.matches('tr') && el.querySelector('td[colspan]')) return; total++; const ok = !q || normQ(el.textContent).includes(q); el.style.display = ok ? '' : 'none'; if (ok) shown++; });
      const msg = q ? (total ? '표·목록 ' + shown + '/' + total + '줄 일치' : '') : ''; if (cnt.textContent !== msg) cnt.textContent = msg; };
    const showHits = () => { hits.replaceChildren(); const q = inp.value.trim(); if (!pick || !q) { hits.hidden = true; return; } const hs = dtHits(q).slice(0, 10); if (!hs.length) { hits.hidden = true; return; } hits.hidden = false;
      for (const r of hs) { const b = document.createElement('button'); b.type = 'button'; b.className = 'sj-hit'; b.textContent = tidy(r.name) + ' (' + r.code + ')' + (PICK_LABEL[sec.id] ? ' → 종목 상세로' : ''); b.addEventListener('click', () => { pick(r.code); inp.value = ''; showHits(); apply(); }); hits.append(b); } };
    let t = null;
    inp.addEventListener('input', () => { showHits(); apply(); });
    inp.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { inp.value = ''; showHits(); apply(); } if (ev.key === 'Enter' && pick) { const h = dtHits(inp.value.trim()); if (h.length) { pick(h[0].code); inp.value = ''; showHits(); apply(); } } });
    new MutationObserver((muts) => { if (!inp.value.trim() || muts.every((m) => bar.contains(m.target) || hits.contains(m.target))) return; clearTimeout(t); t = setTimeout(apply, 30); }).observe(sec, { childList: true, subtree: true });
  });

  window.__dashLoad();
})();

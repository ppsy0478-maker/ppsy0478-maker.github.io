/* 신용·공매도 탭 + 종목 상세 신용·공매도 카드 (독립 코드: 깃허브판·Claude판 공용) */
(() => {
  const rowsOf = (n) => { const d = dash.data(n); return d.status === 'ok' && d.data ? d.data : null; };
  const nf = (v) => (v == null || isNaN(v) ? '—' : Math.round(v).toLocaleString('ko-KR'));
  const p1 = (v) => (v == null || isNaN(v) ? '—' : (+v).toFixed(1) + '%');
  const p2 = (v) => (v == null || isNaN(v) ? '—' : (+v).toFixed(2) + '%');
  const x2 = (v) => (v == null || v === '' || isNaN(v) ? '—' : (+v).toFixed(2) + '배');
  const md = (d) => (d ? +d.slice(5, 7) + '.' + +d.slice(8, 10) : '');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const names = () => { const m = new Map(); (rowsOf('prices') || []).forEach((r) => m.set(String(r.code), r)); return m; };
  const latestPrices = () => { const m = new Map(); (rowsOf('prices') || []).forEach((r) => { const k = String(r.code); const o = m.get(k); if (!o || r.date > o.date) m.set(k, r); }); return m; };

  // ---- 종목별 묶음 ----
  const build = () => {
    const mg = rowsOf('margin'), ss = rowsOf('short_sector'), sp = rowsOf('short_positions'), s33 = rowsOf('sector33');
    if (!mg || !ss || !s33) return null;
    const lp = latestPrices();
    const byCode = new Map();
    mg.forEach((r) => { const k = String(r.code); if (!byCode.has(k)) byCode.set(k, []); byCode.get(k).push(r); });
    const sDates = [...new Set(ss.map((r) => r.date))].sort();
    const sLast = sDates[sDates.length - 1], last5 = new Set(sDates.slice(-5));
    const secLast = new Map(), sec5 = new Map(), secAll = new Map();
    ss.forEach((r) => {
      const k = r.sector_ja; const v = +r.short_pct;
      if (r.date === sLast) secLast.set(k, v);
      if (last5.has(r.date)) { const a = sec5.get(k) || []; a.push(v); sec5.set(k, a); }
      const b = secAll.get(k) || []; b.push(v); secAll.set(k, b);
    });
    const avg = (a) => (a && a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
    const pos = new Map(); (sp || []).forEach((r) => { const k = String(r.code); const o = pos.get(k) || { pct: 0, n: 0, last: '', list: [] }; o.pct += +r.pct; o.n += 1; if (r.date > o.last) o.last = r.date; o.list.push(r); pos.set(k, o); });
    const out = s33.map((s) => {
      const k = String(s.code); const h = (byCode.get(k) || []).slice().sort((a, b) => a.date.localeCompare(b.date));
      const L = h[h.length - 1] || {}, F = h[0] || {}; const pr = lp.get(k) || {};
      const shares = pr.mcap_mil_yen && pr.price ? (+pr.mcap_mil_yen * 1e6) / +pr.price : null;
      const ps = pos.get(k);
      return {
        code: k, name: pr.name || k, sector: s.sector, sector_ja: s.sector_ja,
        date: L.date, sell: +L.sell, buy: +L.buy, ratio: L.ratio === '' ? null : +L.ratio,
        ratio0: F.ratio === '' ? null : +F.ratio, buy0: +F.buy,
        buy_pct: shares ? (+L.buy / shares) * 100 : null, sell_pct: shares ? (+L.sell / shares) * 100 : null,
        sec_last: secLast.get(s.sector_ja), sec5: avg(sec5.get(s.sector_ja)), sec_all: avg(secAll.get(s.sector_ja)),
        big_pct: ps ? ps.pct : 0, big_n: ps ? ps.n : 0, big_last: ps ? ps.last : '', big_list: ps ? ps.list : [], hist: h,
      };
    });
    return { rows: out, sDates, sLast, secLast, sec5, secAll, avg };
  };

  // ---- 표 ----
  const COLS = [
    ['name', '종목', 'l'], ['sector', '업종(33)', 'l'], ['sec_last', '업종 공매도', ''], ['sec5', '5일 평균', ''],
    ['big_pct', '기관 공매도 잔고', ''], ['ratio', '신용배율', ''], ['ratio_chg', '9.25 대비', ''],
    ['buy', '신용매수잔(주)', ''], ['sell', '신용매도잔(주)', ''], ['buy_pct', '매수잔/발행주식', ''],
  ];
  let sortKey = 'ratio', sortDir = -1;
  const val = (r, k) => (k === 'ratio_chg' ? (r.ratio != null && r.ratio0 ? r.ratio - r.ratio0 : null) : r[k]);
  dash.draw('cr-table', (tbl) => {
    tbl.replaceChildren(); const B = build(); if (!B) { tbl.append(el('caption', 'sj-muted', '데이터를 불러오지 못했습니다.')); return; }
    const th = el('thead'); const tr = el('tr');
    COLS.forEach(([k, lab, c]) => { const h = el('th', c, lab + (k === sortKey ? (sortDir < 0 ? ' ▼' : ' ▲') : '')); h.style.cursor = 'pointer'; h.onclick = () => { if (sortKey === k) sortDir = -sortDir; else { sortKey = k; sortDir = (c === 'l' ? 1 : -1); } dash.draw('cr-table'); }; tr.append(h); });
    th.append(tr); tbl.append(th);
    const body = el('tbody');
    const rows = B.rows.slice().sort((a, b) => { const x = val(a, sortKey), y = val(b, sortKey); if (typeof x === 'string' || typeof y === 'string') return sortDir * String(x).localeCompare(String(y), 'ko'); return sortDir * ((x ?? -1e9) - (y ?? -1e9)); });
    rows.forEach((r) => {
      const t = el('tr');
      const n = el('td', 'l'); n.textContent = r.name + ' (' + r.code + ')'; t.append(n);
      t.append(el('td', 'l', r.sector));
      t.append(el('td', null, p1(r.sec_last))); t.append(el('td', null, p1(r.sec5)));
      const b = el('td', null, r.big_n ? p2(r.big_pct) + ' (' + r.big_n + '곳)' : '—'); if (r.big_n) b.title = r.big_list.map((x) => x.holder + ' ' + (+x.pct).toFixed(2) + '% (' + x.date + ')').join('\n'); t.append(b);
      t.append(el('td', null, x2(r.ratio)));
      const cv = val(r, 'ratio_chg'); const c = el('td', null, cv == null ? '—' : (cv > 0 ? '+' : '') + cv.toFixed(2)); c.classList.toggle('up', cv > 0); c.classList.toggle('down', cv < 0); t.append(c);
      t.append(el('td', null, nf(r.buy))); t.append(el('td', null, nf(r.sell))); t.append(el('td', null, p2(r.buy_pct)));
      body.append(t);
    });
    tbl.append(body);
  });

  // ---- 업종 표 ----
  dash.draw('cr-sectors', (tbl) => {
    tbl.replaceChildren(); const B = build(); if (!B) return;
    const cnt = new Map(); B.rows.forEach((r) => cnt.set(r.sector_ja, (cnt.get(r.sector_ja) || 0) + 1));
    const ss = rowsOf('short_sector'); const ko = new Map(ss.map((r) => [r.sector_ja, r.sector]));
    const th = el('thead'); const tr = el('tr'); ['업종', md(B.sLast) + ' 공매도 비율', '5일 평균', '9.25 이후 평균', '62종목 중'].forEach((h, i) => tr.append(el('th', i === 0 ? 'l' : null, h))); th.append(tr); tbl.append(th);
    const body = el('tbody');
    [...B.secLast.keys()].sort((a, b) => (a === 'TOTAL' ? -1 : b === 'TOTAL' ? 1 : B.secLast.get(b) - B.secLast.get(a))).forEach((k) => {
      const t = el('tr'); if (k === 'TOTAL') t.style.fontWeight = '600';
      t.append(el('td', 'l', ko.get(k) || k)); t.append(el('td', null, p1(B.secLast.get(k)))); t.append(el('td', null, p1(B.avg(B.sec5.get(k))))); t.append(el('td', null, p1(B.avg(B.secAll.get(k)))));
      t.append(el('td', null, k === 'TOTAL' ? '62' : (cnt.get(k) ? cnt.get(k) + '종목' : '—'))); body.append(t);
    });
    tbl.append(body);
  });

  // ---- 상단 카드 ----
  dash.draw('cr-cards', (box) => {
    box.replaceChildren(); const B = build(); if (!B) return;
    const tot = B.secLast.get('TOTAL'), t5 = B.avg(B.sec5.get('TOTAL')), ta = B.avg(B.secAll.get('TOTAL'));
    const rs = B.rows.filter((r) => r.ratio != null).map((r) => r.ratio).sort((a, b) => a - b); const avgR = rs.length ? (rs.length % 2 ? rs[(rs.length - 1) / 2] : (rs[rs.length / 2 - 1] + rs[rs.length / 2]) / 2) : null;
    const big = B.rows.filter((r) => r.big_n).length; const mgd = B.rows.find((r) => r.date)?.date;
    [['시장 전체 공매도 비율', p1(tot), md(B.sLast) + ' · 5일 평균 ' + p1(t5)], ['9.25 이후 평균', p1(ta), B.sDates.length + '거래일'],
      ['62종목 신용배율 중앙값', x2(avgR), md(mgd) + ' 신용잔 기준(주간)'], ['기관 대량 공매도 보고 종목', big + '종목', '0.5% 이상 보고분']].forEach(([l, v, s]) => {
      const c = el('div', 'sj-stat'); c.append(el('div', 'sj-card-label', l), el('div', 'sj-stat-v', v), el('div', 'sj-muted', s)); box.append(c);
    });
  });

  // ---- 시장 전체 공매도 비율 차트 ----
  dash.draw('cr-chart', (box) => {
    box.replaceChildren(); const ss = rowsOf('short_sector'); if (!ss || typeof d3 === 'undefined') return;
    const pts = ss.filter((r) => r.sector_ja === 'TOTAL').map((r) => ({ d: new Date(r.date + 'T00:00:00'), v: +r.short_pct, s: r.date })).sort((a, b) => a.d - b.d);
    const W = Math.max(320, box.clientWidth || 800), H = 220, m = { t: 12, r: 16, b: 26, l: 40 };
    const x = d3.scaleTime().domain(d3.extent(pts, (p) => p.d)).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([Math.floor(d3.min(pts, (p) => p.v) - 2), Math.ceil(d3.max(pts, (p) => p.v) + 2)]).range([H - m.b, m.t]);
    const svg = d3.select(box).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', '시장 전체 공매도 비율 추이');
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(6).tickFormat((d) => (d.getMonth() + 1) + '.' + d.getDate())).call((g) => g.select('.domain').attr('opacity', 0.3));
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat((v) => v + '%')).call((g) => g.select('.domain').remove()).call((g) => g.selectAll('.tick line').clone().attr('x2', W - m.l - m.r).attr('opacity', 0.1));
    const avgV = d3.mean(pts, (p) => p.v);
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(avgV)).attr('y2', y(avgV)).attr('stroke', 'currentColor').attr('opacity', 0.35).attr('stroke-dasharray', '4 4');
    svg.append('text').attr('x', W - m.r).attr('y', y(avgV) - 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'currentColor').attr('opacity', 0.6).text('평균 ' + avgV.toFixed(1) + '%');
    svg.append('path').datum(pts).attr('fill', 'none').attr('stroke', '#c0392b').attr('stroke-width', 2).attr('d', d3.line().x((p) => x(p.d)).y((p) => y(p.v)));
    const tip = svg.append('text').attr('font-size', 12).attr('fill', 'currentColor');
    svg.selectAll('circle').data(pts).join('circle').attr('cx', (p) => x(p.d)).attr('cy', (p) => y(p.v)).attr('r', 9).attr('fill', 'transparent')
      .on('mouseenter', (e, p) => tip.attr('x', Math.min(x(p.d), W - 110)).attr('y', y(p.v) - 10).text(md(p.s) + ' ' + p.v.toFixed(1) + '%')).on('mouseleave', () => tip.text(''));
  });

  // ---- 종목 상세 카드 ----
  const detailCode = () => { const s = document.querySelector('[data-draw="dt-select"]'); return s && s.value ? String(s.value) : '7203'; };
  dash.draw('dt-credit', (box) => {
    box.replaceChildren(); const B = build(); if (!B) return; const r = B.rows.find((x) => x.code === detailCode()); if (!r) return;
    const cv = r.ratio != null && r.ratio0 ? r.ratio - r.ratio0 : null;
    [['신용배율', x2(r.ratio), md(r.date) + ' · 9.25 대비 ' + (cv == null ? '—' : (cv > 0 ? '+' : '') + cv.toFixed(2))], ['신용매수잔', nf(r.buy) + '주', '발행주식의 ' + p2(r.buy_pct)],
      ['신용매도잔', nf(r.sell) + '주', '발행주식의 ' + p2(r.sell_pct)], ['업종 공매도 비율', p1(r.sec_last), r.sector + ' · 5일 평균 ' + p1(r.sec5)],
      ['기관 공매도 잔고', r.big_n ? p2(r.big_pct) : '보고 없음', r.big_n ? r.big_n + '곳 · 최근 ' + md(r.big_last) : '0.5% 이상 보고 없음']].forEach(([l, v, s]) => {
      const c = el('div', 'sj-stat'); c.append(el('div', 'sj-card-label', l), el('div', 'sj-stat-v', v), el('div', 'sj-muted', s)); box.append(c);
    });
  });
  dash.draw('dt-links', (p) => {
    p.replaceChildren(); const c = detailCode();
    [['실시간 차트 (야후재팬) ↗', 'https://finance.yahoo.co.jp/quote/' + c + '.T/chart'], ['실시간 시세·호가 ↗', 'https://finance.yahoo.co.jp/quote/' + c + '.T'], ['카부탄 차트 ↗', 'https://kabutan.jp/stock/chart?code=' + c]].forEach(([t, u]) => {
      const a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener'; a.textContent = t; p.append(a);
    });
  });
  const hook = () => { const s = document.querySelector('[data-draw="dt-select"]'); if (s && !s.__cr) { s.__cr = 1; s.addEventListener('change', () => setTimeout(() => { dash.draw('dt-credit'); dash.draw('dt-links'); }, 0)); } };
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-go="detail"],#perf,#targets,#stocks')) setTimeout(() => { hook(); dash.draw('dt-credit'); dash.draw('dt-links'); }, 50); }, true);
  setTimeout(hook, 1500);
})();

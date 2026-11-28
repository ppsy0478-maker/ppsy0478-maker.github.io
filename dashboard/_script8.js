/* 장중 시세 탭: data/live.json(현재값)·data/live_hist.json(30분 간격 누적). GitHub Actions가 장중 30분마다 갱신 */
(() => {
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const sg = (v, d = 2) => (v == null ? '—' : (v > 0 ? '+' : '') + (+v).toFixed(d) + '%');
  const nf = (v, d = 0) => (v == null ? '—' : (+v).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const cls = (e, v) => { e.classList.toggle('up', v > 0); e.classList.toggle('down', v < 0); };
  const UP = '#d23c3c', DN = '#2563eb';
  let LV = null, LH = [], sortK = 'vs_base_pct', dir = -1, pick = null;
  const tmin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const xDom = [9 * 60, 15 * 60 + 30];
  const lastDay = () => LH.length ? LH[LH.length - 1] : null;
  const W = (box) => Math.max(320, box.clientWidth || 800);

  const axes = (svg, x, y, w, h, m, yfmt) => {
    svg.append('g').attr('transform', `translate(0,${h - m.b})`).call(d3.axisBottom(x).tickValues([540, 600, 660, 690, 750, 810, 870, 930]).tickFormat((v) => Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0'))).call((g) => g.select('.domain').attr('opacity', 0.3));
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(yfmt)).call((g) => g.select('.domain').remove()).call((g) => g.selectAll('.tick line').clone().attr('x2', w - m.l - m.r).attr('opacity', 0.1));
    svg.append('rect').attr('x', x(690)).attr('width', x(750) - x(690)).attr('y', m.t).attr('height', h - m.t - m.b).attr('fill', 'currentColor').attr('opacity', 0.05);
    svg.append('text').attr('x', (x(690) + x(750)) / 2).attr('y', m.t + 12).attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', 'currentColor').attr('opacity', 0.5).text('점심 휴장');
  };
  const empty = (box, msg) => { box.replaceChildren(el('p', 'sj-muted', msg)); };

  const drawTrend = () => {
    const box = document.getElementById('lv-trend'); if (!box || typeof d3 === 'undefined') return; box.replaceChildren();
    const d = lastDay(); const dayEl = document.getElementById('lv-day');
    if (!d || !d.points.length) return empty(box, '아직 장중 기록이 없습니다. 다음 장중(평일 9:00~)부터 10분마다 점이 쌓입니다.');
    if (dayEl) dayEl.textContent = '· ' + d.date.slice(5).replace('-', '.') + ' (점 ' + d.points.length + '개)';
    const S = [['nk_pct', '닛케이225', '#c0392b']];
    const pts = d.points.filter((p) => tmin(p.t) >= 540 && tmin(p.t) <= 960);
    const vals = pts.flatMap((p) => S.map(([k]) => p[k]).filter((v) => v != null)).concat([0]);
    const w = W(box), h = 260, m = { t: 14, r: 70, b: 26, l: 44 };
    const x = d3.scaleLinear().domain(xDom).range([m.l, w - m.r]).clamp(true);
    const pad = Math.max(0.3, (d3.max(vals) - d3.min(vals)) * 0.15);
    const y = d3.scaleLinear().domain([d3.min(vals) - pad, d3.max(vals) + pad]).range([h - m.b, m.t]);
    const svg = d3.select(box).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%').attr('role', 'img').attr('aria-label', '장중 등락률 추이');
    axes(svg, x, y, w, h, m, (v) => (v > 0 ? '+' : '') + v.toFixed(1) + '%');
    svg.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'currentColor').attr('opacity', 0.4).attr('stroke-dasharray', '4 4');
    const tip = svg.append('text').attr('font-size', 12).attr('fill', 'currentColor');
    S.forEach(([k, name, col]) => {
      const ps = pts.filter((p) => p[k] != null);
      svg.append('path').datum(ps).attr('fill', 'none').attr('stroke', col).attr('stroke-width', 2).attr('d', d3.line().x((p) => x(tmin(p.t))).y((p) => y(p[k])));
      svg.selectAll(null).data(ps).join('circle').attr('cx', (p) => x(tmin(p.t))).attr('cy', (p) => y(p[k])).attr('r', 3.5).attr('fill', col)
        .on('mouseenter', (e, p) => tip.attr('x', Math.min(x(tmin(p.t)) + 6, w - 160)).attr('y', y(p[k]) - 8).text(p.t + ' ' + name + ' ' + sg(p[k]))).on('mouseleave', () => tip.text(''));
      const L = ps[ps.length - 1]; if (L) svg.append('text').attr('x', x(tmin(L.t)) + 6).attr('y', y(L[k]) + 4).attr('font-size', 11).attr('fill', col).text(sg(L[k], 1));
    });
  };

  const fillPick = () => {
    const s = document.getElementById('lv-pick'); if (!s || !LV || s.options.length) return;
    LV.quotes.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko')).forEach((q) => { const o = el('option', null, q.name + ' (' + q.code + ')'); o.value = q.code; s.append(o); });
    s.value = pick || '7203'; pick = s.value; s.onchange = () => { pick = s.value; drawStock(); };
  };
  const drawStock = () => {
    const box = document.getElementById('lv-stock'); if (!box || typeof d3 === 'undefined' || !LV) return; box.replaceChildren();
    const d = lastDay(); const c = pick || '7203'; const q = LV.quotes.find((z) => z.code === c);
    const base = d && d.base && d.base[c] != null ? d.base[c] : (q && q.prev);
    const ps = d ? d.points.filter((p) => p.p && p.p[c] != null).map((p) => ({ t: p.t, v: p.p[c] })) : [];
    if (!ps.length) return empty(box, '이 종목의 장중 기록이 아직 없습니다.');
    const vals = ps.map((p) => p.v).concat(base ? [base] : []);
    const w = W(box), h = 240, m = { t: 14, r: 70, b: 26, l: 56 };
    const x = d3.scaleLinear().domain(xDom).range([m.l, w - m.r]).clamp(true);
    const pad = Math.max((d3.max(vals) - d3.min(vals)) * 0.15, d3.max(vals) * 0.003);
    const y = d3.scaleLinear().domain([d3.min(vals) - pad, d3.max(vals) + pad]).range([h - m.b, m.t]);
    const svg = d3.select(box).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%').attr('role', 'img').attr('aria-label', '종목 장중 주가');
    axes(svg, x, y, w, h, m, (v) => v.toLocaleString('ko-KR'));
    if (base) { svg.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(base)).attr('y2', y(base)).attr('stroke', 'currentColor').attr('opacity', 0.45).attr('stroke-dasharray', '4 4');
      svg.append('text').attr('x', w - m.r + 4).attr('y', y(base) + 4).attr('font-size', 11).attr('fill', 'currentColor').attr('opacity', 0.6).text('전일 ' + nf(base, base < 1000 ? 1 : 0)); }
    const L = ps[ps.length - 1]; const col = base && L.v >= base ? UP : DN;
    svg.append('path').datum(ps).attr('fill', 'none').attr('stroke', col).attr('stroke-width', 2.2).attr('d', d3.line().x((p) => x(tmin(p.t))).y((p) => y(p.v)));
    const tip = svg.append('text').attr('font-size', 12).attr('fill', 'currentColor');
    svg.selectAll(null).data(ps).join('circle').attr('cx', (p) => x(tmin(p.t))).attr('cy', (p) => y(p.v)).attr('r', 3.5).attr('fill', col)
      .on('mouseenter', (e, p) => tip.attr('x', Math.min(x(tmin(p.t)) + 6, w - 170)).attr('y', y(p.v) - 8).text(p.t + ' ' + nf(p.v, p.v < 1000 ? 1 : 0) + '엔 ' + (base ? sg((p.v / base - 1) * 100) : ''))).on('mouseleave', () => tip.text(''));
    svg.append('text').attr('x', x(tmin(L.t)) + 6).attr('y', y(L.v) + 4).attr('font-size', 11).attr('fill', col).text(base ? sg((L.v / base - 1) * 100, 1) : '');
  };

  const drawBars = () => {
    const box = document.getElementById('lv-bars'); if (!box || typeof d3 === 'undefined' || !LV) return; box.replaceChildren();
    const qs = LV.quotes.filter((q) => q.vs_base_pct != null).slice().sort((a, b) => b.vs_base_pct - a.vs_base_pct);
    const w = W(box), rh = 18, m = { t: 8, r: 56, b: 8, l: 150 }, h = m.t + m.b + rh * qs.length;
    const ext = d3.max(qs, (q) => Math.abs(q.vs_base_pct)) || 1;
    const x = d3.scaleLinear().domain([-ext, ext]).range([m.l, w - m.r]);
    const svg = d3.select(box).append('svg').attr('viewBox', `0 0 ${w} ${h}`).attr('width', '100%').attr('role', 'img').attr('aria-label', '62종목 등락률 막대');
    svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', m.t).attr('y2', h - m.b).attr('stroke', 'currentColor').attr('opacity', 0.3);
    qs.forEach((q, i) => {
      const yy = m.t + i * rh, v = q.vs_base_pct;
      const g = svg.append('g').style('cursor', 'pointer').on('click', () => { pick = q.code; const s = document.getElementById('lv-pick'); if (s) s.value = q.code; drawStock(); document.getElementById('lv-stock').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
      g.append('text').attr('x', m.l - 6).attr('y', yy + rh / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11).attr('fill', 'currentColor').text(q.name);
      g.append('rect').attr('x', Math.min(x(0), x(v))).attr('width', Math.max(1, Math.abs(x(v) - x(0)))).attr('y', yy + 3).attr('height', rh - 6).attr('rx', 2).attr('fill', v >= 0 ? UP : DN).attr('opacity', 0.85);
      g.append('text').attr('x', v >= 0 ? x(v) + 4 : x(v) - 4).attr('y', yy + rh / 2 + 4).attr('text-anchor', v >= 0 ? 'start' : 'end').attr('font-size', 11).attr('fill', 'currentColor').text(sg(v, 1));
    });
  };

  const drawCards = () => {
    const cards = document.getElementById('lv-cards'); if (!cards || !LV) return; cards.replaceChildren();
    const nk = LV.nikkei || {};
    [['닛케이225', nf(nk.price, 2), nk.chg_pct, (nk.time || '') + ' 기준(15분 지연)'], ['62종목 상승·하락', LV.up + ' · ' + LV.down, null, '전일 종가 ' + LV.base_date.slice(5).replace('-', '.') + ' 대비'], ['마지막 갱신', LV.updated_jst.slice(11), null, LV.updated_jst.slice(0, 10) + ' (한국·일본 같은 시각)']].forEach(([l, v, p, s]) => {
      const c = el('div', 'sj-stat'); c.append(el('div', 'sj-card-label', l), el('div', 'sj-stat-v', v));
      if (p != null) { const d = el('div', null, sg(p)); cls(d, p); c.append(d); }
      c.append(el('div', 'sj-muted', s)); cards.append(c);
    });
  };
  const drawTable = () => {
    const tbl = document.getElementById('lv-table'); if (!tbl || !LV) return; tbl.replaceChildren();
    const C = [['name', '종목', 'l'], ['sector', '업종', 'l'], ['price', '현재가(엔)'], ['chg', '전일 대비'], ['vs_base_pct', '등락률'], ['time', '시각']];
    const th = el('thead'); const tr = el('tr');
    C.forEach(([k, lab, c]) => { const h = el('th', c || null, lab + (k === sortK ? (dir < 0 ? ' ▼' : ' ▲') : '')); h.style.cursor = 'pointer'; h.onclick = () => { if (sortK === k) dir = -dir; else { sortK = k; dir = c ? 1 : -1; } drawTable(); }; tr.append(h); });
    th.append(tr); tbl.append(th);
    const body = el('tbody');
    LV.quotes.slice().sort((a, b) => { const x = a[sortK], y = b[sortK]; return typeof x === 'string' ? dir * String(x).localeCompare(String(y), 'ko') : dir * ((x ?? -1e9) - (y ?? -1e9)); }).forEach((q) => {
      const t = el('tr'); t.style.cursor = 'pointer'; t.onclick = () => { pick = q.code; const s = document.getElementById('lv-pick'); if (s) s.value = q.code; drawStock(); document.getElementById('lv-stock').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
      t.append(el('td', 'l', q.name + ' (' + q.code + ')'), el('td', 'l', q.sector), el('td', null, nf(q.price, q.price < 1000 ? 1 : 0)));
      const c1 = el('td', null, q.chg == null ? '—' : (q.chg > 0 ? '+' : '') + nf(q.chg, Math.abs(q.chg) < 10 ? 1 : 0)); cls(c1, q.chg);
      const c2 = el('td', null, sg(q.vs_base_pct)); cls(c2, q.vs_base_pct); t.append(c1, c2, el('td', null, q.time || '—')); body.append(t);
    });
    tbl.append(body);
  };
  const all = () => { drawCards(); fillPick(); drawTrend(); drawStock(); drawBars(); drawTable(); };
  const load = async () => {
    try {
      const [a, b] = await Promise.all([fetch('data/live.json?t=' + Date.now(), { cache: 'no-store' }), fetch('data/live_hist.json?t=' + Date.now(), { cache: 'no-store' })]);
      if (a.ok) LV = await a.json(); if (b.ok) LH = await b.json();
      const sec = document.getElementById('live'); if (sec && !sec.hidden) all(); else drawCards();
    } catch (e) {}
  };
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-go="live"]')) setTimeout(all, 30); }, true);
  window.addEventListener('resize', () => { const sec = document.getElementById('live'); if (sec && !sec.hidden) { drawTrend(); drawStock(); drawBars(); } });
  load(); setInterval(load, 5 * 60 * 1000);
  if (location.hash === '#live') setTimeout(all, 800);
})();

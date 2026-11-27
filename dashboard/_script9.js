/* 일정 · 투자자별 매매 · 52주 고가·저가 (독립 코드: 깃허브판·Claude판 공용) */
(() => {
  const rowsOf = (n) => { const d = dash.data(n); return d.status === 'ok' && Array.isArray(d.data) ? d.data : null; };
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const md = (d) => (d ? +String(d).slice(5, 7) + '.' + +String(d).slice(8, 10) : '');
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const wd = (d) => WD[new Date(String(d).slice(0, 10) + 'T00:00:00').getDay()];
  const oku = (v) => (v == null || isNaN(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(Math.round(v)).toLocaleString('ko-KR') + '억엔');
  const tidy = (s) => String(s || '').replace(/\s*\(구\).*$/, '');
  const todayKst = () => { const n = new Date(Date.now() + 9 * 3600e3); return n.toISOString().slice(0, 10); };
  const lastPrices = () => { const m = new Map(); (rowsOf('prices') || []).forEach((r) => { const k = String(r.code); const o = m.get(k); if (!o || r.date > o.date) m.set(k, r); }); return m; };
  const stat = (box, label, value, sub, sign) => {
    const c = el('div', 'sj-stat'); const v = el('div', 'sj-stat-v', value);
    if (sign) { v.classList.toggle('up', sign > 0); v.classList.toggle('down', sign < 0); }
    c.append(el('div', 'sj-card-label', label), v); if (sub) c.append(el('div', 'sj-muted', sub)); box.append(c);
  };

  /* ---------------- 일정 캘린더 ---------------- */
  const KINDS = ['전체', '금리', '미국 지표', '실적', '배당락', '수급', '휴장'];
  let calKind = '전체', calPast = false;
  const calRows = () => (rowsOf('calendar') || []).map((r) => ({ ...r, date: String(r.date).slice(0, 10), code: r.code == null ? '' : String(r.code) }));
  dash.draw('cal-cards', (box) => {
    box.replaceChildren(); const rows = calRows(); if (!rows.length) return;
    const t = todayKst(); const in14 = new Date(new Date(t + 'T00:00:00').getTime() + 14 * 864e5).toISOString().slice(0, 10);
    const next = rows.filter((r) => r.date >= t);
    const n14 = next.filter((r) => r.date <= in14);
    const nx = (k) => next.find((r) => r.kind === k);
    const f = nx('금리'), e = next.find((r) => r.kind === '실적'), u = nx('미국 지표');
    stat(box, '앞으로 2주 일정', n14.length + '건', md(t) + ' ~ ' + md(in14));
    if (f) stat(box, '다음 금리 결정', md(f.date) + '(' + wd(f.date) + ')', f.title.replace(/결과 /, ''));
    if (u) stat(box, '다음 미국 지표', md(u.date) + '(' + wd(u.date) + ')', u.title);
    if (e) stat(box, '다음 62종목 실적', md(e.date) + '(' + wd(e.date) + ')', tidy(e.title) + (e.status === '추정' ? ' · 추정' : ''));
  });
  dash.draw('cal-filter', (bar) => {
    bar.replaceChildren();
    KINDS.forEach((k) => { const b = el('button', 'sj-hit' + (k === calKind ? ' on' : ''), k); b.type = 'button'; b.onclick = () => { calKind = k; dash.draw('cal-filter'); dash.draw('cal-list'); }; bar.append(b); });
    const lab = el('label', 'sj-muted'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = calPast; cb.onchange = () => { calPast = cb.checked; dash.draw('cal-list'); };
    lab.append(cb, document.createTextNode(' 지난 일정도 보기')); lab.style.marginLeft = '8px'; bar.append(lab);
  });
  const KCOL = { '금리': '#c0392b', '미국 지표': '#2f6fd6', '실적': '#7b5cc7', '배당락': '#22a094', '수급': '#e0862f', '휴장': '#7d8793' };
  dash.draw('cal-list', (box) => {
    box.replaceChildren(); const rows = calRows(); if (!rows.length) return;
    const t = todayKst();
    const list = rows.filter((r) => (calPast || r.date >= t) && (calKind === '전체' || r.kind === calKind));
    if (!list.length) { box.append(el('p', 'sj-muted', '해당하는 일정이 없습니다.')); return; }
    let month = '', day = '', ul = null;
    for (const r of list) {
      const m = r.date.slice(0, 7);
      if (m !== month) { month = m; box.append(el('h3', 'sj-h3', +m.slice(0, 4) + '년 ' + +m.slice(5, 7) + '월')); ul = el('ul', 'sj-list'); box.append(ul); day = ''; }
      const li = el('li'); li.style.alignItems = 'baseline';
      if (r.date < t) li.style.opacity = '0.5';
      const left = el('span'); left.style.display = 'flex'; left.style.gap = '10px'; left.style.alignItems = 'baseline';
      const d = el('b', null, r.date === day ? '' : md(r.date) + '(' + wd(r.date) + ')'); d.style.minWidth = '64px'; d.style.fontVariantNumeric = 'tabular-nums'; day = r.date;
      const k = el('span', 'sj-badge', r.kind); k.style.color = KCOL[r.kind] || 'inherit'; k.style.minWidth = '56px';
      const tt = el('span', null, tidy(r.title) + (r.time_kst ? ' · ' + r.time_kst : ''));
      if (r.date === t) tt.style.fontWeight = '600';
      left.append(d, k, tt);
      const right = el('span', 'sj-muted', (r.status === '추정' ? '추정 · ' : '') + (r.note || '')); right.style.textAlign = 'right'; right.style.whiteSpace = 'normal';
      li.append(left, right); ul.append(li);
    }
  });

  /* ---------------- 투자자별 매매 ---------------- */
  const GROUPS = [['for', '외국인', '#c0392b'], ['ind', '개인', '#2f6fd6'], ['trust', '신탁은행(연기금 등)', '#22a094'], ['biz', '사업법인(자사주 매입 등)', '#7b5cc7'], ['itr', '투자신탁', '#e0862f'], ['prop', '증권사 자기매매', '#7d8793']];
  let ivGroup = 'for';
  const ivRows = () => (rowsOf('investor_flows') || []).map((r) => { const o = { ws: String(r.week_start).slice(0, 10), we: String(r.week_end).slice(0, 10) }; for (const [g] of GROUPS) for (const s of ['sell', 'buy', 'net']) o[g + '_' + s] = +r[g + '_' + s]; return o; }).sort((a, b) => a.ws.localeCompare(b.ws));
  const nkClose = () => { const m = new Map(); (rowsOf('nikkei_daily') || []).forEach((r) => m.set(String(r.date).slice(0, 10), +r.close)); return m; };
  const weekNk = (nk, we) => { const ds = [...nk.keys()].filter((d) => d <= we).sort(); return ds.length ? nk.get(ds[ds.length - 1]) : null; };
  dash.draw('iv-cards', (box) => {
    box.replaceChildren(); const R = ivRows(); if (!R.length) return;
    const L = R[R.length - 1]; const since = R.filter((r) => r.we >= '2026-09-25');
    const sum = (a, k) => a.reduce((s, r) => s + r[k], 0);
    stat(box, '외국인 · ' + md(L.ws) + '~' + md(L.we) + ' 주', oku(L.for_net), '매도 ' + Math.round(L.for_sell).toLocaleString('ko-KR') + ' · 매수 ' + Math.round(L.for_buy).toLocaleString('ko-KR') + '억엔', L.for_net);
    stat(box, '외국인 최근 4주 누적', oku(sum(R.slice(-4), 'for_net')), R.length >= 4 ? md(R[R.length - 4].ws) + ' 주부터' : '', sum(R.slice(-4), 'for_net'));
    stat(box, '외국인 9.25 이후 누적', oku(sum(since, 'for_net')), since.length + '주', sum(since, 'for_net'));
    stat(box, '개인 · 같은 주', oku(L.ind_net), '최근 4주 ' + oku(sum(R.slice(-4), 'ind_net')), L.ind_net);
    stat(box, '신탁은행 · 같은 주', oku(L.trust_net), '최근 4주 ' + oku(sum(R.slice(-4), 'trust_net')), L.trust_net);
    stat(box, '사업법인 · 같은 주', oku(L.biz_net), '최근 4주 ' + oku(sum(R.slice(-4), 'biz_net')), L.biz_net);
  });
  dash.draw('iv-pick', (bar) => {
    bar.replaceChildren();
    GROUPS.forEach(([g, lab]) => { const b = el('button', 'sj-hit' + (g === ivGroup ? ' on' : ''), lab); b.type = 'button'; b.onclick = () => { ivGroup = g; dash.draw('iv-pick'); dash.draw('iv-chart'); }; bar.append(b); });
  });
  dash.draw('iv-chart', (box) => {
    box.replaceChildren(); const R = ivRows(); if (!R.length || typeof d3 === 'undefined') return;
    const nk = nkClose(); const g = GROUPS.find((x) => x[0] === ivGroup);
    const pts = R.map((r) => ({ lab: md(r.ws) + '~' + md(r.we), v: r[ivGroup + '_net'], nk: weekNk(nk, r.we), r }));
    const W = Math.max(320, box.clientWidth || 800), H = 280, m = { t: 16, r: 56, b: 30, l: 64 };
    const x = d3.scaleBand().domain(pts.map((p) => p.lab)).range([m.l, W - m.r]).padding(0.3);
    const ext = d3.max(pts, (p) => Math.abs(p.v)) || 1;
    const y = d3.scaleLinear().domain([-ext * 1.1, ext * 1.1]).nice().range([H - m.b, m.t]);
    const nkv = pts.map((p) => p.nk).filter((v) => v != null);
    const y2 = d3.scaleLinear().domain(nkv.length ? [d3.min(nkv) * 0.98, d3.max(nkv) * 1.02] : [0, 1]).range([H - m.b, m.t]);
    const svg = d3.select(box).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', g[1] + ' 주간 순매수(억엔)와 그 주 마지막 날 닛케이225 종가');
    svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat((v) => (v > 0 ? '+' : '') + d3.format(',')(v))).call((s) => s.select('.domain').remove());
    svg.append('g').attr('transform', `translate(${W - m.r},0)`).call(d3.axisRight(y2).ticks(4).tickFormat(d3.format(','))).call((s) => s.select('.domain').remove()).selectAll('text').attr('opacity', 0.7);
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).tickSizeOuter(0)).selectAll('text').attr('font-size', 11);
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', 'currentColor').attr('opacity', 0.4);
    const tip = svg.append('text').attr('font-size', 12).attr('fill', 'currentColor');
    svg.selectAll('rect.b').data(pts).join('rect').attr('class', 'b').attr('x', (p) => x(p.lab)).attr('width', x.bandwidth())
      .attr('y', (p) => Math.min(y(0), y(p.v))).attr('height', (p) => Math.max(1, Math.abs(y(p.v) - y(0)))).attr('rx', 3)
      .style('fill', (p) => (p.v >= 0 ? 'var(--color-ok)' : 'var(--color-bad)')).attr('opacity', 0.85)
      .on('mouseenter', (e, p) => tip.attr('x', Math.min(x(p.lab), W - 220)).attr('y', m.t + 2).text(p.lab + ' ' + g[1] + ' ' + oku(p.v) + (p.nk ? ' · 닛케이 ' + d3.format(',.0f')(p.nk) : '')))
      .on('mouseleave', () => tip.text(''));
    const ln = pts.filter((p) => p.nk != null);
    svg.append('path').datum(ln).attr('fill', 'none').attr('stroke', 'currentColor').attr('stroke-width', 1.5).attr('stroke-dasharray', '4 3').attr('opacity', 0.6)
      .attr('d', d3.line().x((p) => x(p.lab) + x.bandwidth() / 2).y((p) => y2(p.nk)));
    svg.selectAll('circle.n').data(ln).join('circle').attr('class', 'n').attr('r', 3).attr('cx', (p) => x(p.lab) + x.bandwidth() / 2).attr('cy', (p) => y2(p.nk)).attr('fill', 'currentColor').attr('opacity', 0.6);
  });
  dash.draw('iv-table', (tbl) => {
    tbl.replaceChildren(); const R = ivRows(); if (!R.length) return; const nk = nkClose();
    const th = el('thead'); const tr = el('tr'); ['주', ...GROUPS.map((g) => g[1]), '닛케이225 (주말 종가)'].forEach((h, i) => tr.append(el('th', i === 0 ? 'l' : null, h))); th.append(tr); tbl.append(th);
    const body = el('tbody');
    R.slice().reverse().forEach((r) => {
      const t = el('tr'); t.append(el('td', 'l', md(r.ws) + ' ~ ' + md(r.we)));
      GROUPS.forEach(([g]) => { const v = r[g + '_net']; const c = el('td', null, oku(v)); c.classList.toggle('up', v > 0); c.classList.toggle('down', v < 0); t.append(c); });
      const n = weekNk(nk, r.we); t.append(el('td', null, n == null ? '—' : d3.format(',.2f')(n))); body.append(t);
    });
    tbl.append(body);
  });

  /* ---------------- 52주 고가·저가 ---------------- */
  const w52 = () => {
    const w = rowsOf('week52'), lp = lastPrices(); if (!w || !lp.size) return null;
    return w.map((r) => {
      const k = String(r.code); const p = lp.get(k) || {}; const price = +p.price;
      let hi = +r.high, lo = +r.low, hw = String(r.high_week).slice(0, 10), lw = String(r.low_week).slice(0, 10);
      const pd = String(p.date || '').slice(0, 10);
      if (price > hi) { hi = price; hw = pd; } if (price < lo) { lo = price; lw = pd; }
      return { code: k, name: tidy(p.name || k), sector: p.sector || '', price, hi, lo, hw, lw,
        pos: hi > lo ? (price - lo) / (hi - lo) * 100 : null, from_hi: (price / hi - 1) * 100, from_lo: (price / lo - 1) * 100 };
    });
  };
  const rangeBar = (pos) => {
    const wrap = el('div'); wrap.style.cssText = 'position:relative;height:8px;min-width:120px;border-radius:4px;background:linear-gradient(90deg,var(--color-bad),var(--cds-chart-muted,#aaa) 50%,var(--color-ok));opacity:.85';
    const dot = el('i'); dot.style.cssText = `position:absolute;top:-4px;left:calc(${Math.max(0, Math.min(100, pos))}% - 2px);width:4px;height:16px;border-radius:2px;background:var(--color-fg)`; wrap.append(dot); return wrap;
  };
  let wSort = 'pos', wDir = 1;
  const WCOLS = [['name', '종목', 'l'], ['sector', '업종', 'l'], ['price', '종가', ''], ['lo', '52주 저가', ''], ['hi', '52주 고가', ''], ['pos', '범위 안 위치', 'l'], ['from_hi', '고가 대비', ''], ['from_lo', '저가 대비', '']];
  dash.draw('w52-table', (tbl) => {
    tbl.replaceChildren(); const R = w52(); if (!R) return;
    const th = el('thead'); const tr = el('tr');
    WCOLS.forEach(([k, lab, c]) => { const h = el('th', c, lab + (k === wSort ? (wDir < 0 ? ' ▼' : ' ▲') : '')); h.style.cursor = 'pointer'; h.onclick = () => { if (wSort === k) wDir = -wDir; else { wSort = k; wDir = c === 'l' && k !== 'pos' ? 1 : -1; } dash.draw('w52-table'); }; tr.append(h); });
    th.append(tr); tbl.append(th);
    const body = el('tbody'); const f0 = (v) => Math.round(v).toLocaleString('ko-KR');
    R.slice().sort((a, b) => { const x = a[wSort], y = b[wSort]; return typeof x === 'string' ? wDir * x.localeCompare(y, 'ko') : wDir * ((x ?? -1e9) - (y ?? -1e9)); }).forEach((r) => {
      const t = el('tr');
      t.append(el('td', 'l', r.name + ' (' + r.code + ')'), el('td', 'l', r.sector), el('td', null, f0(r.price)));
      const lo = el('td', null, f0(r.lo)); lo.title = md(r.lw) + ' 주'; const hi = el('td', null, f0(r.hi)); hi.title = md(r.hw) + ' 주'; t.append(lo, hi);
      const pc = el('td', 'l'); pc.style.minWidth = '170px'; const row = el('div'); row.style.cssText = 'display:flex;align-items:center;gap:8px'; row.append(rangeBar(r.pos), el('span', null, Math.round(r.pos) + '%')); pc.append(row); t.append(pc);
      const a = el('td', null, (r.from_hi > 0 ? '+' : '') + r.from_hi.toFixed(1) + '%'); a.classList.toggle('down', r.from_hi < -0.05);
      const b = el('td', null, '+' + r.from_lo.toFixed(1) + '%'); b.classList.toggle('up', r.from_lo > 0.05);
      t.append(a, b); body.append(t);
    });
    tbl.append(body);
  });
  dash.draw('w52-cards', (box) => {
    box.replaceChildren(); const R = w52(); if (!R) return;
    const nearHi = R.filter((r) => r.from_hi >= -5).length, nearLo = R.filter((r) => r.from_lo <= 5).length;
    const med = R.map((r) => r.pos).sort((a, b) => a - b)[Math.floor(R.length / 2)];
    stat(box, '52주 고가 5% 이내', nearHi + '종목', '고가 근처');
    stat(box, '52주 저가 5% 이내', nearLo + '종목', '저가 근처');
    stat(box, '범위 안 위치 중앙값', Math.round(med) + '%', '0% = 저가, 100% = 고가');
    const top = R.slice().sort((a, b) => a.from_hi - b.from_hi)[0];
    stat(box, '고가에서 가장 먼 종목', top.name, '고가 대비 ' + top.from_hi.toFixed(1) + '%', -1);
  });

  /* ---------------- 시장 특징 뉴스 ---------------- */
  const MCAT = ['전체', '시황', '특징주', '수급', '전망', '해외'];
  const MCOL = { '시황': '#2f6fd6', '특징주': '#c0392b', '수급': '#22a094', '전망': '#7b5cc7', '해외': '#e0862f' };
  let mnCat = '전체', mnDate = '';
  const mnRows = () => (rowsOf('market_news') || []).map((r) => ({ ...r, date: String(r.date).slice(0, 10), datetime: String(r.datetime) })).sort((a, b) => b.datetime.localeCompare(a.datetime));
  const mnItem = (r) => {
    const li = el('li');
    const d = el('span', 'd', md(r.date) + ' ' + r.datetime.slice(11, 16));
    const b = el('span', 'sj-badge', r.cat); b.style.color = MCOL[r.cat] || 'inherit';
    const body = el('span'); const a = el('a', null, r.title);
    if (/^https:\/\/kabutan\.jp\//.test(r.url)) { a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; }
    body.append(a, el('span', 't', r.source || '株探'));
    if (r.summary) body.append(el('div', 'nd', r.summary));
    li.append(d, b, body); return li;
  };
  dash.draw('mn-filter', (bar) => {
    bar.replaceChildren(); const R = mnRows(); const dates = [...new Set(R.map((r) => r.date))];
    const sel = document.createElement('select'); sel.className = 'dash-select'; sel.setAttribute('aria-label', '시장 뉴스 날짜');
    sel.append(new Option('최근 전체', ''), ...dates.map((d) => new Option(md(d) + '(' + wd(d) + ')', d))); sel.value = mnDate;
    sel.onchange = () => { mnDate = sel.value; dash.draw('mn-list'); };
    bar.append(sel);
    MCAT.forEach((k) => { const b = el('button', 'sj-hit' + (k === mnCat ? ' on' : ''), k); b.type = 'button'; b.onclick = () => { mnCat = k; dash.draw('mn-filter'); dash.draw('mn-list'); }; bar.append(b); });
  });
  dash.draw('mn-list', (ul) => {
    ul.replaceChildren(); const R = mnRows().filter((r) => (!mnDate || r.date === mnDate) && (mnCat === '전체' || r.cat === mnCat));
    if (!R.length) { ul.append(el('li', 'sj-muted', '해당하는 뉴스가 없습니다.')); return; }
    R.slice(0, 60).forEach((r) => ul.append(mnItem(r)));
  });
  dash.draw('ov-mnews', (ul) => {
    ul.replaceChildren(); const R = mnRows(); if (!R.length) return;
    const d = R[0].date; R.filter((r) => r.date === d).slice(0, 8).forEach((r) => ul.append(mnItem(r)));
  });
  const rpDate = () => { const s = document.querySelector('[data-draw="rp-select"]'); return s && s.value ? s.value : null; };
  dash.draw('rp-mnews', (ul) => {
    ul.replaceChildren(); const R = mnRows(); if (!R.length) return;
    const d = rpDate() || R[0].date; const rows = R.filter((r) => r.date === d).reverse();
    if (!rows.length) { ul.append(el('li', 'sj-muted', '이 날짜는 정리한 시장 뉴스가 없습니다(11.26부터 기록).')); return; }
    rows.forEach((r) => ul.append(mnItem(r)));
  });
  const rpHook = () => { const s = document.querySelector('[data-draw="rp-select"]'); if (s && !s.__mn) { s.__mn = 1; s.addEventListener('change', () => setTimeout(() => dash.draw('rp-mnews'), 0)); } };
  setTimeout(rpHook, 1500);
  document.addEventListener('click', (e) => { const t = e.target.closest && e.target.closest('[data-go="reports"],[data-go="news"],#rp-table tr'); if (t) setTimeout(() => { rpHook(); dash.draw('rp-mnews'); dash.draw('mn-list'); }, 60); }, true);
  const detailCode = () => { const s = document.querySelector('[data-draw="dt-select"]'); return s && s.value ? String(s.value) : '7203'; };
  dash.draw('dt-w52', (box) => {
    box.replaceChildren(); const R = w52(); if (!R) return; const r = R.find((x) => x.code === detailCode()); if (!r) return;
    const f0 = (v) => Math.round(v).toLocaleString('ko-KR') + '엔';
    const c = el('div', 'sj-stat'); c.style.gridColumn = 'span 2';
    c.append(el('div', 'sj-card-label', '52주 범위 안 위치'), el('div', 'sj-stat-v', Math.round(r.pos) + '%'));
    const bar = rangeBar(r.pos); bar.style.margin = '8px 0 4px'; c.append(bar, el('div', 'sj-muted', '저가 ' + f0(r.lo) + ' (' + md(r.lw) + ' 주) · 고가 ' + f0(r.hi) + ' (' + md(r.hw) + ' 주)'));
    box.append(c);
    stat(box, '52주 고가 대비', (r.from_hi > 0 ? '+' : '') + r.from_hi.toFixed(1) + '%', '고가 ' + f0(r.hi), r.from_hi < -0.05 ? -1 : 0);
    stat(box, '52주 저가 대비', '+' + r.from_lo.toFixed(1) + '%', '저가 ' + f0(r.lo), r.from_lo > 0.05 ? 1 : 0);
  });
  const hook = () => { const s = document.querySelector('[data-draw="dt-select"]'); if (s && !s.__w52) { s.__w52 = 1; s.addEventListener('change', () => setTimeout(() => dash.draw('dt-w52'), 0)); } };
  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('[data-go]'); if (!t) return;
    setTimeout(() => { hook(); ({ detail: ['dt-w52'], calendar: ['cal-cards', 'cal-list'], investors: ['iv-chart'], stocks: ['w52-table'] }[t.dataset.go] || []).forEach((n) => dash.draw(n)); }, 50);
  }, true);
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#dt-hits, .sj-click')) setTimeout(() => dash.draw('dt-w52'), 60); }, true);
  setTimeout(hook, 1500);
})();

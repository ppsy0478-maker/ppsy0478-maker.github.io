(function () {
  const { S, redrawSel, fmtInt, fmtPct, dateLabel, cls, tidy, open, lineChart, mountLine, failNote, stockOptions } = window.__sj;
  const { nf, dLabel, addRow, numv, DT, redrawDetail, goDetail, redrawHist } = window.__sj3;
  const { olAll, normQ, dtHits } = window.__sj4;

  // ---------- sector ETF ----------
  const ALL = '62종목 전체';
  const groupPrices = (prices) => { const g = new Map();
    for (const r of prices) for (const key of [r.sector, ALL]) { if (!g.has(key)) g.set(key, new Map()); const c = g.get(key); if (!c.has(r.code)) c.set(r.code, new Map()); c.get(r.code).set(r.date, { p: +r.price, m: +r.mcap_mil_yen, name: r.name }); }
    return g; };
  dash.calc('sector_etf', { inputs: ['prices'], fn: (prices) => {
    const dates = [...new Set(prices.map((r) => r.date))].sort(); const out = [];
    for (const [sector, codes] of groupPrices(prices)) {
      let ic = 100, ie = 100;
      dates.forEach((d, i) => {
        let n = 0;
        if (i > 0) { let a = 0, b = 0, s = 0; for (const c of codes.values()) { const x = c.get(dates[i - 1]), y = c.get(d); if (x && y) { a += y.m; b += x.m; s += y.p / x.p; n++; } } if (b > 0) ic *= a / b; if (n) ie *= s / n; }
        else n = [...codes.values()].filter((c) => c.has(d)).length;
        out.push({ sector, date: d, idx_cap: Math.round(ic * 100) / 100, idx_eq: Math.round(ie * 100) / 100, stocks: n });
      });
    }
    return out;
  } });
  dash.calc('sector_etf_members', { inputs: ['prices'], fn: (prices) => {
    const out = [];
    for (const [sector, codes] of groupPrices(prices)) {
      if (sector === ALL) continue;
      const rows = [...codes].map(([code, m]) => { const ds = [...m.keys()].sort(); return { code, name: m.get(ds[ds.length - 1]).name, f: m.get(ds[0]), l: m.get(ds[ds.length - 1]) }; });
      const s0 = rows.reduce((s, r) => s + r.f.m, 0), s1 = rows.reduce((s, r) => s + r.l.m, 0);
      for (const r of rows) { const ret = (r.l.p / r.f.p - 1) * 100, w0 = r.f.m / s0 * 100;
        out.push({ sector, code: r.code, name: r.name, w_start: Math.round(w0 * 10) / 10, w_last: Math.round(r.l.m / s1 * 1000) / 10, ret: Math.round(ret * 10) / 10, contrib: Math.round(w0 * ret / 100 * 100) / 100 }); }
    }
    return out;
  } });
  dash.calc('sector_etf_sum', { inputs: ['sector_etf', 'sector_etf_members'], fn: (sector_etf, members) => {
    const by = new Map(); for (const r of sector_etf) { if (!by.has(r.sector)) by.set(r.sector, []); by.get(r.sector).push(r); }
    const out = [];
    for (const [sector, rows] of by) {
      rows.sort((a, b) => a.date.localeCompare(b.date));
      const L = rows[rows.length - 1], P3 = rows[rows.length - 4];
      let peak = rows[0], mdd = 0, hi = rows[0].idx_cap;
      for (const r of rows) { if (r.idx_cap > peak.idx_cap) peak = r; hi = Math.max(hi, r.idx_cap); mdd = Math.min(mdd, r.idx_cap / hi - 1); }
      const ms = members.filter((m) => m.sector === sector).sort((a, b) => b.ret - a.ret);
      const r1 = (v) => Math.round(v * 10) / 10;
      out.push({ sector, is_all: sector === ALL, stocks: sector === ALL ? 62 : ms.length, ret_cap: r1(L.idx_cap - 100), ret_eq: r1(L.idx_eq - 100), ret_3d: r1((L.idx_cap / P3.idx_cap - 1) * 100),
        peak: peak.idx_cap, peak_date: peak.date, from_peak: r1((L.idx_cap / peak.idx_cap - 1) * 100), mdd: r1(mdd * 100),
        best: ms.length ? tidy(ms[0].name) + ' ' + fmtPct(ms[0].ret, true) : '—', worst: ms.length ? tidy(ms[ms.length - 1].name) + ' ' + fmtPct(ms[ms.length - 1].ret, true) : '—' });
    }
    return out;
  } });
  document.querySelectorAll('#etf-legend .sj-sw[data-series]').forEach((sw) => { sw.style.background = dash.colors[+sw.dataset.series]; });
  const etfPick = () => { const d = dash.data('sector_etf_sum'); if (d.status !== 'ok' || !d.data) return null; const rows = d.data.filter((r) => !r.is_all).sort((a, b) => b.ret_cap - a.ret_cap); return rows.find((r) => r.sector === (S.etf || '')) || rows[0] || null; };
  const redrawEtf = () => ['etf-select', 'etf-name', 'etf-line', 'etf-member-rows', 'etf-rows', 'etf-bars'].forEach((n) => dash.draw(n));
  dash.draw('etf-bars', (el) => {
    const d = dash.data('sector_etf_sum'); el.replaceChildren();
    if (d.status !== 'ok' || !d.data) return;
    const rows = d.data.slice().sort((a, b) => b.ret_cap - a.ret_cap); const cur = etfPick();
    const W = Math.max(300, el.clientWidth), bh = 22, gap = 6, m = { t: 6, r: 60, b: 22, l: 130 };
    const H = m.t + m.b + rows.length * (bh + gap);
    const ext = d3.max(rows, (r) => Math.abs(r.ret_cap)) || 1; const lo = d3.min(rows, (r) => r.ret_cap), hi = d3.max(rows, (r) => r.ret_cap);
    const x = d3.scaleLinear().domain([Math.min(0, lo) - ext * 0.05, Math.max(0, hi) + ext * 0.05]).nice().range([m.l, W - m.r]);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H).attr('role', 'img').attr('aria-label', '업종 ETF별 9.25 이후 수익률');
    svg.append('g').attr('class', 'grid').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(6).tickFormat((v) => v + '%').tickSize(-(H - m.t - m.b))).call((g) => g.select('.domain').remove());
    svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--cds-chart-axis)');
    const g = svg.selectAll('g.bar').data(rows).join('g').attr('class', 'bar').attr('transform', (r, i) => `translate(0,${m.t + i * (bh + gap)})`).style('cursor', (r) => r.is_all ? 'default' : 'pointer')
      .on('click', (ev, r) => { if (!r.is_all) { S.etf = r.sector; redrawEtf(); } });
    g.append('rect').attr('x', (r) => Math.min(x(0), x(r.ret_cap))).attr('width', (r) => Math.max(1, Math.abs(x(r.ret_cap) - x(0)))).attr('height', bh).attr('rx', 3)
      .style('fill', (r) => r.is_all ? 'var(--cds-chart-muted)' : r.ret_cap >= 0 ? 'var(--color-ok)' : 'var(--color-bad)').attr('opacity', (r) => cur && !r.is_all && r.sector !== cur.sector ? 0.55 : 1);
    g.append('text').attr('x', m.l - 8).attr('y', bh / 2).attr('dy', '0.35em').attr('text-anchor', 'end').style('fill', 'var(--color-fg)').style('font-weight', (r) => r.is_all || (cur && r.sector === cur.sector) ? '600' : '400').text((r) => r.sector + (r.is_all ? '' : ' (' + r.stocks + ')'));
    g.append('text').attr('y', bh / 2).attr('dy', '0.35em').attr('x', (r) => r.ret_cap >= 0 ? x(r.ret_cap) + 4 : x(r.ret_cap) - 4).attr('text-anchor', (r) => r.ret_cap >= 0 ? 'start' : 'end').text((r) => fmtPct(r.ret_cap, true));
  });
  dash.draw('etf-rows', (tb) => {
    const d = dash.data('sector_etf_sum'); tb.replaceChildren(); if (d.status !== 'ok' || !d.data) return; const cur = etfPick();
    for (const r of d.data.slice().sort((a, b) => b.ret_cap - a.ret_cap)) {
      addRow(tb, r.sector, [[r.sector, 'l'], [String(r.stocks)], [fmtPct(r.ret_cap, true), '', r.ret_cap], [fmtPct(r.ret_eq, true), '', r.ret_eq], [fmtPct(r.ret_3d, true), '', r.ret_3d],
        [r.peak.toFixed(1)], [dLabel(r.peak_date), 'l'], [fmtPct(r.from_peak, true), '', r.from_peak], [fmtPct(r.mdd, true), '', r.mdd], [r.best, 'l'], [r.worst, 'l']], r.is_all ? 'sj-soon' : 'sj-click' + (cur && r.sector === cur.sector ? ' sj-on' : ''));
      if (!r.is_all) tb.lastChild.addEventListener('click', () => { S.etf = r.sector; redrawEtf(); document.querySelectorAll('#h-etf-line').forEach((h2) => h2.scrollIntoView({ behavior: 'smooth', block: 'start' })); });
    }
  });
  dash.draw('etf-select', (sel) => {
    const d = dash.data('sector_etf_sum'); const rows = d.status === 'ok' && d.data ? d.data.filter((r) => !r.is_all).sort((a, b) => b.ret_cap - a.ret_cap) : [];
    sel.replaceChildren(...rows.map((r) => new Option(r.sector + ' (' + fmtPct(r.ret_cap, true) + ')', r.sector))); const cur = etfPick(); if (cur) sel.value = cur.sector;
    sel.onchange = () => { S.etf = sel.value; redrawEtf(); };
  });
  dash.draw('etf-name', (el) => { const cur = etfPick(); el.textContent = cur ? cur.sector : '—'; });
  dash.draw('etf-line', { mount: mountLine, update: (el, made) => {
    const d = dash.data('sector_etf'); if (d.status !== 'ok') return failNote(el, made, d.status);
    made.lines.selectAll('text').remove(); const cur = etfPick(); if (!cur) return failNote(el, made, 'empty');
    const pick = (s) => d.data.filter((r) => r.sector === s).sort((a, b) => a.date.localeCompare(b.date)); const a = pick(cur.sector), all = pick(ALL);
    lineChart(el, made, [{ name: cur.sector + ' 시총 가중', values: a.map((r) => ({ date: r.date, y: r.idx_cap })) }, { name: cur.sector + ' 동일 가중', values: a.map((r) => ({ date: r.date, y: r.idx_eq })) }, { name: ALL, values: all.map((r) => ({ date: r.date, y: r.idx_cap })) }],
      { label: '업종 ETF 지수와 62종목 전체 비교', tipFmt: d3.format('.1f'), yFmt: d3.format('d') });
  } });
  dash.draw('etf-member-rows', (tb) => {
    const d = dash.data('sector_etf_members'); tb.replaceChildren(); const cur = etfPick(); if (d.status !== 'ok' || !d.data || !cur) return;
    for (const r of d.data.filter((x) => x.sector === cur.sector).sort((a, b) => b.contrib - a.contrib)) addRow(tb, r.code, [[r.code, 'l'], [tidy(r.name), 'l'], [r.w_start.toFixed(1) + '%'], [r.w_last.toFixed(1) + '%'], [fmtPct(r.ret, true), '', r.ret], [(r.contrib > 0 ? '+' : '') + r.contrib.toFixed(2), '', r.contrib]]);
  });

  // ---------- news ----------
  dash.calc('news_view', { inputs: ['news', 'stock_stats'], fn: (news, stock_stats) => {
    const st = new Map(stock_stats.map((r) => [r.code, r]));
    return news.map((r) => ({ code: r.code, name: (st.get(r.code) || {}).name || r.code, datetime: r.datetime, date: r.date, sentiment: r.sentiment, type: r.type, headline: r.headline, source: r.source, url: r.url, detail: r.detail || '' })).sort((a, b) => b.datetime.localeCompare(a.datetime));
  } });
  dash.calc('news_sum', { inputs: ['news_view', 'stock_stats'], fn: (news_view, stock_stats) => stock_stats.map((s) => {
    const rows = news_view.filter((r) => r.code === s.code); const c = (k) => rows.filter((r) => r.sentiment === k).length;
    return { code: s.code, name: s.name, pos: c('호재'), neg: c('악재'), neu: c('중립'), net: c('호재') - c('악재'), last_date: rows[0] ? rows[0].date : '', last_headline: rows[0] ? rows[0].headline : '' };
  }) });
  const NEWS_ALL = '__all'; const newsCode = () => S.news || NEWS_ALL;
  const redrawNews = () => ['news-select', 'news-title', 'news-count', 'news-list', 'news-rows'].forEach((n) => dash.draw(n));
  const newsItem = (r, showName) => {
    const li = document.createElement('li');
    const d = document.createElement('span'); d.className = 'd'; d.textContent = dLabel(r.date) + ' ' + (r.datetime.slice(11, 16) || '');
    const b = document.createElement('span'); b.className = 'sj-badge ' + (r.sentiment === '호재' ? 'up' : r.sentiment === '악재' ? 'down' : 'neu'); b.textContent = r.sentiment;
    const body = document.createElement('span');
    const a = document.createElement('a'); a.textContent = (showName ? tidy(r.name) + ' · ' : '') + r.headline;
    if (/^https:\/\/kabutan\.jp\//.test(r.url)) { a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; }
    const t = document.createElement('span'); t.className = 't'; t.textContent = r.type + ' · ' + r.source;
    body.append(a, t);
    if (r.detail) { const nd = document.createElement('div'); nd.className = 'nd'; nd.textContent = r.detail; body.append(nd); }
    li.append(d, b, body); return li;
  };
  const newsRows = () => { const d = dash.data('news_view'); if (d.status !== 'ok' || !d.data) return null; return d.data.filter((r) => (newsCode() === NEWS_ALL || r.code === newsCode()) && (!S.newsKind || r.sentiment === S.newsKind)); };
  dash.draw('news-select', (sel) => {
    const d = dash.data('stock_stats'); const rows = d.status === 'ok' && d.data ? d.data.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko')) : [];
    sel.replaceChildren(new Option('전체 종목 (최신순)', NEWS_ALL), ...rows.map((r) => new Option(r.name + ' (' + r.code + ')', r.code))); sel.value = newsCode();
    sel.onchange = () => { S.news = sel.value; redrawNews(); };
  });
  document.querySelectorAll('#news-kind').forEach((s) => s.addEventListener('change', () => { S.newsKind = s.value; redrawNews(); }));
  dash.draw('news-title', (el) => { if (newsCode() === NEWS_ALL) { el.textContent = '전체 종목 뉴스'; return; } const d = dash.data('stock_stats'); const r = d.status === 'ok' && d.data ? d.data.find((x) => x.code === newsCode()) : null; el.textContent = r ? r.name + ' (' + r.code + ') 뉴스' : '—'; });
  dash.draw('news-count', (el) => { const d = dash.data('news_view'); if (d.status !== 'ok' || !d.data) { el.textContent = '—'; return; } const all = d.data.filter((r) => newsCode() === NEWS_ALL || r.code === newsCode()); const c = (k) => all.filter((r) => r.sentiment === k).length; el.textContent = '호재 ' + c('호재') + '건 · 악재 ' + c('악재') + '건 · 중립 ' + c('중립') + '건'; });
  dash.draw('news-list', (ul) => { ul.replaceChildren(); const rows = newsRows(); if (!rows) return; if (!rows.length) { const li = document.createElement('li'); li.textContent = '해당하는 뉴스가 없습니다.'; ul.append(li); return; } const all = newsCode() === NEWS_ALL; for (const r of (all ? rows.slice(0, 60) : rows)) ul.append(newsItem(r, all)); });
  dash.draw('news-rows', (tb) => {
    const d = dash.data('news_sum'); tb.replaceChildren(); if (d.status !== 'ok' || !d.data) return;
    for (const r of d.data.slice().sort((a, b) => b.net - a.net || b.pos - a.pos)) {
      addRow(tb, r.code, [[r.code, 'l'], [tidy(r.name), 'l'], [String(r.pos)], [String(r.neg)], [String(r.neu)], [(r.net > 0 ? '+' : '') + r.net, '', r.net], [dLabel(r.last_date), 'l'], [r.last_headline, 'l wrap']], 'sj-click' + (r.code === newsCode() ? ' sj-on' : ''));
      tb.lastChild.addEventListener('click', () => { S.news = r.code; redrawNews(); document.querySelectorAll('#h-news').forEach((h2) => h2.scrollIntoView({ behavior: 'smooth', block: 'start' })); });
    }
  });
  dash.draw('dt-news', (ul) => { ul.replaceChildren(); const d = dash.data('news_view'); if (d.status !== 'ok' || !d.data) return; const rows = d.data.filter((r) => r.code === DT()).slice(0, 8); if (!rows.length) { const li = document.createElement('li'); li.textContent = '최근 뉴스 없음'; ul.append(li); return; } for (const r of rows) ul.append(newsItem(r, false)); });

  // ---------- daily market reports ----------
  dash.calc('day_stats', { inputs: ['index', 'prices'], fn: (index, prices) => {
    const ix = index.slice().sort((a, b) => a.date.localeCompare(b.date)); const by = new Map();
    for (const r of prices) { if (!by.has(r.date)) by.set(r.date, new Map()); by.get(r.date).set(r.code, +r.price); }
    const r1 = (v) => Math.round(v * 100) / 100;
    return ix.map((r, i) => {
      if (i === 0) return { date: r.date, nk_close: +r.nikkei225, nk_chg: null, nk_pts: null, ns_chg: null, tp_chg: null, up: null, down: null };
      const p = ix[i - 1], a = by.get(p.date) || new Map(), b = by.get(r.date) || new Map(); let up = 0, down = 0;
      for (const [c, v] of b) { const o = a.get(c); if (o == null) continue; if (v > o) up++; else if (v < o) down++; }
      return { date: r.date, nk_close: +r.nikkei225, nk_pts: r1(+r.nikkei225 - +p.nikkei225), nk_chg: r1((+r.nikkei225 / +p.nikkei225 - 1) * 100), ns_chg: r1((+r.nikkei_style / +p.nikkei_style - 1) * 100), tp_chg: r1((+r.topix_style / +p.topix_style - 1) * 100), up, down };
    });
  } });
  dash.calc('day_sectors', { inputs: ['prices'], fn: (prices) => {
    const dates = [...new Set(prices.map((r) => r.date))].sort(); const m = new Map(); for (const r of prices) m.set(r.date + '|' + r.code, r);
    const codes = [...new Set(prices.map((r) => r.code))]; const out = [];
    dates.forEach((d, i) => { if (!i) return; const agg = new Map();
      for (const c of codes) { const a = m.get(dates[i - 1] + '|' + c), b = m.get(d + '|' + c); if (!a || !b) continue; const g = agg.get(b.sector) || [0, 0]; g[0] += +b.mcap_mil_yen; g[1] += +a.mcap_mil_yen; agg.set(b.sector, g); }
      for (const [sector, [x, y]] of agg) out.push({ date: d, sector, chg: Math.round((x / y - 1) * 1000) / 10 }); });
    return out;
  } });
  const RP = () => { const d = dash.data('day_stats'); const rows = d.status === 'ok' && d.data ? d.data.filter((r) => r.nk_chg != null) : []; if (S.rp && rows.some((r) => r.date === S.rp)) return S.rp; return rows.length ? rows[rows.length - 1].date : null; };
  const rpReport = (date) => { const d = dash.data('market_reports'); if (d.status !== 'ok' || !d.data) return null; const rs = d.data.filter((r) => r.date === date && !/오전장/.test(r.written || '')); return rs.length ? rs[rs.length - 1] : null; };
  const WD = ['일', '월', '화', '수', '목', '금', '토']; const wd = (s) => WD[new Date(s + 'T00:00:00').getDay()];
  const redrawRp = () => ['rp-select', 'rp-title', 'rp-stats', 'rp-body', 'rp-sectors', 'rp-movers', 'rp-news', 'rp-rows'].forEach((n) => dash.draw(n));
  dash.draw('rp-select', (sel) => {
    const d = dash.data('day_stats'); const rp = dash.data('market_reports'); const has = new Set(rp.status === 'ok' && rp.data ? rp.data.map((r) => r.date) : []);
    const rows = d.status === 'ok' && d.data ? d.data.filter((r) => r.nk_chg != null).slice().reverse() : [];
    sel.replaceChildren(...rows.map((r) => new Option((has.has(r.date) ? '● ' : '　') + dateLabel(r.date) + '(' + wd(r.date) + ') · 닛케이 ' + fmtPct(r.nk_chg, true), r.date)));
    const cur = RP(); if (cur) sel.value = cur; sel.onchange = () => { S.rp = sel.value; redrawRp(); };
  });
  dash.draw('rp-title', (el) => { const date = RP(); if (!date) { el.textContent = '—'; return; } const r = rpReport(date); el.textContent = dateLabel(date) + '(' + wd(date) + ') 시장 보고서' + (r ? ' · ' + r.title : ''); });
  dash.draw('rp-stats', (box) => {
    box.replaceChildren(); const d = dash.data('day_stats'); const date = RP(); const r = d.status === 'ok' && d.data && date ? d.data.find((x) => x.date === date) : null; if (!r) return;
    const items = [['닛케이225 종가', d3.format(',.2f')(r.nk_close), (r.nk_pts > 0 ? '+' : '') + d3.format(',.2f')(r.nk_pts) + ' (' + fmtPct(r.nk_chg, true) + ')', r.nk_chg, 'nk_close'],
      ['상승 · 하락', r.up + ' · ' + r.down, '62종목 중', null, 'up']];
    for (const [lab, v, sub, sg, field] of items) { const c = document.createElement('div'); c.className = 'sj-stat'; const l = document.createElement('div'); l.className = 'sj-card-label'; l.textContent = lab;
      const val = document.createElement('div'); val.className = 'sj-stat-v'; val.textContent = v; if (sg != null && field !== 'nk_close') cls(val, sg);
      const m = document.createElement('div'); m.className = 'sj-muted'; m.textContent = sub; if (field === 'nk_close') cls(m, sg); c.append(l, val, m); box.append(c); }
  });
  dash.draw('rp-body', (box) => {
    box.replaceChildren(); const date = RP(); if (!date) return; const r = rpReport(date);
    if (!r) { box.className = 'sj-muted'; box.textContent = '이 날짜는 작성된 보고서가 없습니다. 아래 업종·종목 등락과 뉴스는 데이터로 자동 계산한 값입니다.'; return; }
    box.className = 'sj-report';
    const lede = document.createElement('p'); lede.className = 'rp-lede'; lede.textContent = r.lede; box.append(lede);
    for (const para of String(r.body || '').split(/\n+|\s*¶\s*/).filter(Boolean)) { const p = document.createElement('p'); p.textContent = para; box.append(p); }
    const dl = document.createElement('dl');
    for (const [k, v] of [['강세', r.up], ['약세', r.down], ['다음 체크포인트', r.watch], ['출처', r.source]]) { if (!v) continue; const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); }
    box.append(dl);
  });
  dash.draw('rp-sectors', (el) => {
    el.replaceChildren(); const d = dash.data('day_sectors'); const date = RP(); if (d.status !== 'ok' || !d.data || !date) return;
    const rows = d.data.filter((r) => r.date === date).sort((a, b) => b.chg - a.chg); if (!rows.length) return;
    const W = Math.max(280, el.clientWidth), bh = 18, gap = 6, m = { t: 4, r: 52, b: 22, l: 110 }; const H = m.t + m.b + rows.length * (bh + gap);
    const ext = d3.max(rows, (r) => Math.abs(r.chg)) || 1; const x = d3.scaleLinear().domain([-ext * 1.05, ext * 1.05]).nice().range([m.l, W - m.r]);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H).attr('role', 'img').attr('aria-label', '업종별 전일 대비 등락률');
    svg.append('g').attr('class', 'grid').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(5).tickFormat((v) => v + '%').tickSize(-(H - m.t - m.b))).call((g) => g.select('.domain').remove());
    svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--cds-chart-axis)');
    const g = svg.selectAll('g.bar').data(rows).join('g').attr('class', 'bar').attr('transform', (r, i) => `translate(0,${m.t + i * (bh + gap)})`);
    g.append('rect').attr('x', (r) => Math.min(x(0), x(r.chg))).attr('width', (r) => Math.max(1, Math.abs(x(r.chg) - x(0)))).attr('height', bh).attr('rx', 3).style('fill', (r) => r.chg >= 0 ? 'var(--color-ok)' : 'var(--color-bad)');
    g.append('text').attr('x', m.l - 8).attr('y', bh / 2).attr('dy', '0.35em').attr('text-anchor', 'end').style('fill', 'var(--color-fg)').text((r) => r.sector);
    g.append('text').attr('y', bh / 2).attr('dy', '0.35em').attr('x', (r) => r.chg >= 0 ? x(r.chg) + 4 : x(r.chg) - 4).attr('text-anchor', (r) => r.chg >= 0 ? 'start' : 'end').text((r) => fmtPct(r.chg, true));
  });
  dash.draw('rp-movers', (ul) => {
    ul.replaceChildren(); const d = dash.data('prices'); const date = RP(); if (d.status !== 'ok' || !d.data || !date) return;
    const dates = [...new Set(d.data.map((r) => r.date))].sort(); const prev = dates[dates.indexOf(date) - 1];
    const a = new Map(d.data.filter((r) => r.date === prev).map((r) => [r.code, +r.price]));
    const rows = d.data.filter((r) => r.date === date && a.has(r.code)).map((r) => ({ name: tidy(r.name), sector: r.sector, price: +r.price, chg: Math.round((+r.price / a.get(r.code) - 1) * 1000) / 10 })).sort((x, y) => y.chg - x.chg);
    for (const r of (ul.dataset.pick === 'best' ? rows.slice(0, 5) : rows.slice(-5).reverse())) { const li = document.createElement('li'); const s1 = document.createElement('span'); s1.textContent = r.name + ' · ' + r.sector + ' · ' + fmtInt(r.price) + '엔'; const s2 = document.createElement('span'); s2.textContent = fmtPct(r.chg, true); cls(s2, r.chg); li.append(s1, s2); ul.append(li); }
  });
  dash.draw('rp-news', (ul) => {
    ul.replaceChildren(); const d = dash.data('news_view'); const date = RP(); if (d.status !== 'ok' || !d.data || !date) return;
    const dates = [...new Set((dash.data('day_stats').data || []).map((r) => r.date))].sort(); const prev = dates[dates.indexOf(date) - 1] || date;
    const rows = d.data.filter((r) => (r.date === date && r.datetime.slice(11, 16) < '15:30') || (r.date > prev && r.date < date) || (r.date === prev && r.datetime.slice(11, 16) >= '15:30'));
    if (!rows.length) { const li = document.createElement('li'); li.textContent = '이 날짜에 기록된 뉴스가 없습니다.'; ul.append(li); return; }
    for (const r of rows) ul.append(newsItem(r, true));
  });
  dash.draw('rp-rows', (tb) => {
    tb.replaceChildren(); const d = dash.data('market_reports'), st = dash.data('day_stats'); if (d.status !== 'ok' || !d.data) return;
    const sm = new Map(st.status === 'ok' && st.data ? st.data.map((r) => [r.date, r]) : []); const cur = RP();
    for (const r of d.data.slice().sort((a, b) => b.date.localeCompare(a.date))) {
      const s = sm.get(r.date) || {};
      addRow(tb, r.date, [[dateLabel(r.date) + '(' + wd(r.date) + ')', 'l'], [r.title, 'l wrap'], [s.nk_chg == null ? '—' : fmtPct(s.nk_chg, true), '', s.nk_chg], [r.up, 'l wrap'], [r.down, 'l wrap']], 'sj-click' + (r.date === cur ? ' sj-on' : ''));
      tb.lastChild.addEventListener('click', () => { S.rp = r.date; redrawRp(); document.querySelectorAll('#h-report').forEach((h2) => h2.scrollIntoView({ behavior: 'smooth', block: 'start' })); });
    }
  });

  // ---------- Sony Financial Group reports ----------
  const sfRows = () => { const d = dash.data('sony_reports'); if (d.status !== 'ok' || !d.data) return null; return d.data.filter((r) => !S.sfSeries || r.series === S.sfSeries).slice().sort((a, b) => b.date.localeCompare(a.date) || String(a.series).localeCompare(String(b.series))); };
  const sfKey = (r) => r.date + '|' + r.series;
  const sfCur = () => { const rows = sfRows(); if (!rows || !rows.length) return null; return rows.find((r) => sfKey(r) === S.sf) || rows[0]; };
  const redrawSf = () => ['sf-select', 'sf-title', 'sf-body', 'sf-rows'].forEach((n) => dash.draw(n));
  document.querySelectorAll('#sf-series').forEach((s) => s.addEventListener('change', () => { S.sfSeries = s.value; redrawSf(); }));
  dash.draw('sf-select', (sel) => { const rows = sfRows() || []; sel.replaceChildren(...(rows.length ? rows.map((r) => new Option(dateLabel(r.date) + ' · ' + r.series + ' · ' + (r.title_ko || ''), sfKey(r))) : [new Option('—', '')])); const c = sfCur(); if (c) sel.value = sfKey(c); sel.onchange = () => { S.sf = sel.value; redrawSf(); }; });
  dash.draw('sf-title', (el) => { const r = sfCur(); el.textContent = r ? dateLabel(r.date) + ' ' + r.series + ' · ' + r.title_ko : '—'; });
  dash.draw('sf-body', (box) => {
    box.replaceChildren(); const r = sfCur(); if (!r) return;
    box.className = 'sj-report';
    if (r.summary_ko) { const p = document.createElement('p'); p.className = 'rp-lede'; p.textContent = r.summary_ko; box.append(p); }
    for (const para of String(r.body_ko || '').split(/\n+|\s*¶\s*/).filter(Boolean)) { const p = document.createElement('p'); p.textContent = para; box.append(p); }
    const dl = document.createElement('dl');
    for (const [k, v] of [['원제', r.title_ja], ['작성', r.author]]) { if (!v) continue; const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); }
    if (/^https:\/\/www\.sonyfg\.co\.jp\//.test(r.url || '')) { const dt = document.createElement('dt'); dt.textContent = '원문'; const dd = document.createElement('dd'); const a = document.createElement('a'); a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = '소니파이낸셜그룹 원문 열기'; dd.append(a); dl.append(dt, dd); }
    box.append(dl);
  });
  dash.draw('sf-rows', (tb) => { tb.replaceChildren(); const rows = sfRows(); if (!rows) return; const c = sfCur();
    for (const r of rows) { addRow(tb, sfKey(r), [[dateLabel(r.date), 'l'], [r.series, 'l'], [r.title_ko || '', 'l wrap'], [r.summary_ko || '', 'l wrap'], [r.author || '', 'l']], 'sj-click' + (c && sfKey(r) === sfKey(c) ? ' sj-on' : ''));
      tb.lastChild.addEventListener('click', () => { S.sf = sfKey(r); redrawSf(); document.querySelectorAll('#h-sf').forEach((h2) => h2.scrollIntoView({ behavior: 'smooth', block: 'start' })); }); } });
  window.__sj5 = { newsItem, redrawNews, ALL };
})();

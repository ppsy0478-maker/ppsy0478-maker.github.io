(function () {
  const { S, redrawSel, fmtInt, fmt1, fmtPct, dateLabel, setDash, cls, tidy, open, lineChart, mountLine, failNote } = window.__sj;

  dash.draw('index-chart', {
    mount: mountLine,
    update: (el, made) => {
      const d = dash.data('index');
      if (d.status !== 'ok') return failNote(el, made, d.status);
      made.lines.selectAll('text').remove();
      const rows = d.data.slice().sort((a, b) => a.date.localeCompare(b.date));
      const mk = (name, key) => ({ name, values: rows.map((r) => ({ date: r.date, y: +r[key] })) });
      lineChart(el, made, [mk('닛케이225', 'nikkei225')],
        { label: '9.25 이후 닛케이225 일별 종가', tipFmt: d3.format(',.2f'), yFmt: d3.format(',') });
    }
  });

  document.querySelectorAll('#sort-select').forEach((s) => s.addEventListener('change', () => { S.sort = s.value; dash.draw('stock-rows'); }));
  dash.draw('sector-filter', (sel) => {
    const d = dash.data('stock_stats');
    const secs = d.status === 'ok' && d.data ? [...new Set(d.data.map((r) => r.sector))].sort() : [];
    sel.replaceChildren(new Option('전체', ''), ...secs.map((s) => new Option(s, s)));
    sel.value = S.sector;
    sel.onchange = () => { S.sector = sel.value; dash.draw('stock-rows'); };
  });
  dash.draw('stock-rows', (tb) => {
    const d = dash.data('stock_stats');
    tb.replaceChildren();
    if (d.status !== 'ok' || !d.data) return;
    const rows = d.data.filter((r) => !S.sector || r.sector === S.sector).sort((a, b) => b[S.sort] - a[S.sort]);
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.className = 'sj-click' + (r.code === S.sel ? ' sj-on' : '');
      const cells = [[r.code, 'l'], [r.name, 'l'], [r.sector, 'l'], [fmtInt(r.price)],
        [fmtPct(r.chg_1d, true), '', r.chg_1d], [fmtPct(r.chg_3d, true), '', r.chg_3d], [fmtPct(r.chg_total, true), '', r.chg_total],
        [fmtInt(r.volume)], [fmtInt(r.mcap_bil_yen)]];
      for (const [t, c, v] of cells) { const td = document.createElement('td'); td.textContent = t; if (c) td.className = c; if (v !== undefined) cls(td, v); tr.append(td); }
      tr.addEventListener('click', () => { S.sel = r.code; redrawSel(); });
      tb.append(tr);
    }
  });
  dash.draw('sel-name', (el) => {
    const d = dash.data('stock_stats');
    const r = d.status === 'ok' && d.data ? d.data.find((x) => x.code === S.sel) : null;
    el.textContent = r ? r.name + ' (' + r.code + ')' : '—';
  });
  document.querySelectorAll('#tech-legend .sj-sw[data-series]').forEach((sw) => { sw.style.background = dash.colors[+sw.dataset.series]; });

  dash.draw('stock-chart', {
    mount: (el) => {
      el.replaceChildren();
      const svg = d3.select(el).append('svg');
      const tip = document.createElement('div'); tip.className = 'sj-tip'; tip.hidden = true; el.append(tip);
      return { svg, tip };
    },
    update: (el, made) => {
      const d = dash.data('tech_daily');
      const svg = made.svg; svg.selectAll('*').remove();
      if (d.status !== 'ok' || !d.data) { svg.attr('height', 40).attr('viewBox', null); if (d.status === 'error') svg.append('text').attr('y', 20).text('불러오지 못했습니다'); return; }
      const rows = d.data.filter((r) => r.code === S.sel && (S.range === 'all' || r.date >= '2026-09-25')).sort((a, b) => a.date.localeCompare(b.date));
      if (!rows.length) { svg.attr('height', 40); return; }
      const dates = rows.map((r) => r.date), col = (k) => rows.map((r) => r[k]);
      const ov = S.overlay;
      const lines = ov === 'ma' ? [['ma5', '5일선', 1], ['ma20', '20일선', 2], ['ma60', '60일선', 4]]
        : ov === 'bb' ? [['ma20', '중심선', 2], ['bb_up', '상단', null], ['bb_dn', '하단', null]]
        : [['tenkan', '전환선', 1], ['kijun', '기준선', 2], ['span_a', '선행A', null], ['span_b', '선행B', null]];
      const W = Math.max(300, el.clientWidth), m = { l: 56, r: 12 };
      const P1 = [8, 232], P2 = [254, 312], P3 = [334, 400], P4 = [422, 512], H = 540;
      svg.attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H).attr('role', 'img').attr('aria-label', '선택한 종목의 종가와 지표, 거래량, RSI, MACD 차트');
      const x = d3.scalePoint().domain(dates).range([m.l, W - m.r]).padding(0.5);
      const allP = col('price').concat(...lines.map(([k]) => col(k))).filter((y) => y != null);
      const [lo, hi] = d3.extent(allP); const pad = (hi - lo) * 0.05 || 1;
      const y1 = d3.scaleLinear().domain([lo - pad, hi + pad]).nice().range([P1[1], P1[0]]);
      const vmax = d3.max(rows, (r) => r.volume) || 1;
      const y2 = d3.scaleLinear().domain([0, vmax]).nice().range([P2[1], P2[0]]);
      const y3 = d3.scaleLinear().domain([0, 100]).range([P3[1], P3[0]]);
      const mExt = d3.extent(rows.flatMap((r) => [r.macd, r.macd_signal, r.macd_hist]).filter((v) => v != null).concat([0]));
      const mPad = (mExt[1] - mExt[0]) * 0.08 || 1;
      const y4 = d3.scaleLinear().domain([mExt[0] - mPad, mExt[1] + mPad]).range([P4[1], P4[0]]);
      const grid = (y, ticks, fmt) => svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.l},0)`)
        .call(d3.axisLeft(y).tickValues(ticks).tickSize(-(W - m.l - m.r)).tickFormat(fmt)).call((g) => g.select('.domain').remove());
      grid(y1, y1.ticks(4), d3.format(','));
      grid(y2, [y2.domain()[1] / 2, y2.domain()[1]], d3.format('.2~s'));
      grid(y3, [0, 50, 100], d3.format('d'));
      grid(y4, y4.ticks(3), d3.format('~s'));
      [30, 70].forEach((t) => svg.append('line').attr('class', 'ref').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y3(t)).attr('y2', y3(t)));
      svg.append('line').attr('class', 'ref').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y4(0)).attr('y2', y4(0));
      [[P2, '거래량 (9.25부터)'], [P3, 'RSI(14)'], [P4, 'MACD (12·26·9)']].forEach(([P, t]) => svg.append('text').attr('x', m.l + 4).attr('y', P[0] - 4).text(t));
      const step = Math.ceil(dates.length / Math.max(2, Math.floor((W - m.l - m.r) / 52)));
      svg.append('g').attr('transform', `translate(0,${P4[1]})`).call(d3.axisBottom(x).tickValues(dates.filter((dd, i) => i % step === 0 || i === dates.length - 1)).tickFormat(dateLabel).tickSizeOuter(0));
      const bw = Math.max(1.5, x.step() * 0.6);
      svg.append('g').selectAll('rect').data(rows.filter((r) => r.volume != null)).join('rect').attr('x', (r) => x(r.date) - bw / 2).attr('width', bw)
        .attr('y', (r) => y2(r.volume)).attr('height', (r) => P2[1] - y2(r.volume)).attr('rx', 1).style('fill', 'var(--cds-chart-muted)');
      svg.append('g').selectAll('rect').data(rows.filter((r) => r.macd_hist != null)).join('rect').attr('x', (r) => x(r.date) - bw / 2).attr('width', bw)
        .attr('y', (r) => Math.min(y4(0), y4(r.macd_hist))).attr('height', (r) => Math.abs(y4(r.macd_hist) - y4(0))).attr('opacity', 0.5)
        .style('fill', (r) => r.macd_hist >= 0 ? 'var(--color-ok)' : 'var(--color-bad)');
      const ln = (y) => d3.line().defined((val) => val != null).x((val, i) => x(dates[i])).y((val) => y(val));
      if (ov === 'bb') {
        svg.append('path').attr('opacity', 0.25).style('fill', 'var(--cds-chart-muted)')
          .attr('d', d3.area().defined((r) => r.bb_up != null).x((r) => x(r.date)).y0((r) => y1(r.bb_dn)).y1((r) => y1(r.bb_up))(rows));
        ['bb_up', 'bb_dn'].forEach((k) => svg.append('path').attr('fill', 'none').attr('stroke-width', 1).style('stroke', 'var(--cds-chart-muted)').attr('d', ln(y1)(col(k))));
      }
      if (ov === 'ichi') {
        for (let i = 1; i < rows.length; i++) {
          const a = rows[i - 1], b = rows[i];
          if ([a.span_a, a.span_b, b.span_a, b.span_b].some((v) => v == null)) continue;
          const up = (a.span_a + b.span_a) >= (a.span_b + b.span_b);
          svg.append('path').attr('opacity', 0.22).style('fill', up ? 'var(--color-ok)' : 'var(--color-bad)')
            .attr('d', `M${x(a.date)},${y1(a.span_a)}L${x(b.date)},${y1(b.span_a)}L${x(b.date)},${y1(b.span_b)}L${x(a.date)},${y1(a.span_b)}Z`);
        }
      }
      lines.filter(([, , c]) => c != null).forEach(([k, , c]) => svg.append('path').attr('fill', 'none').attr('stroke-width', 1.5).attr('stroke-linejoin', 'round').style('stroke', dash.colors[c]).attr('d', ln(y1)(col(k))));
      svg.append('path').attr('fill', 'none').attr('stroke-width', 2).attr('stroke-linejoin', 'round').style('stroke', dash.colors[0]).attr('d', ln(y1)(col('price')));
      svg.append('path').attr('fill', 'none').attr('stroke-width', 1.5).style('stroke', dash.colors[3]).attr('d', ln(y3)(col('rsi14')));
      svg.append('path').attr('fill', 'none').attr('stroke-width', 1.5).style('stroke', dash.colors[0]).attr('d', ln(y4)(col('macd')));
      svg.append('path').attr('fill', 'none').attr('stroke-width', 1.5).style('stroke', dash.colors[1]).attr('d', ln(y4)(col('macd_signal')));
      const last = rows[rows.length - 1];
      svg.append('circle').attr('r', 4).attr('cx', x(last.date)).attr('cy', y1(last.price)).style('fill', dash.colors[0]).style('stroke', 'var(--color-bg)').attr('stroke-width', 2);
      const cross = svg.append('line').attr('opacity', 0).attr('stroke-dasharray', '3 3').style('stroke', 'var(--cds-chart-reference)');
      const tip = made.tip;
      const f0 = d3.format(','), f1 = d3.format(',.1f');
      const fv = (v, f) => v == null ? '—' : f(v);
      svg.append('rect').attr('x', m.l).attr('y', P1[0]).attr('width', W - m.l - m.r).attr('height', P4[1] - P1[0]).attr('fill', 'transparent')
        .on('pointermove', (ev) => {
          const [px] = d3.pointer(ev);
          const i = Math.max(0, Math.min(dates.length - 1, Math.round((px - x(dates[0])) / x.step())));
          const r = rows[i];
          cross.attr('x1', x(r.date)).attr('x2', x(r.date)).attr('y1', P1[0]).attr('y2', P4[1]).attr('opacity', 1);
          tip.hidden = false; tip.replaceChildren();
          const head = document.createElement('div'); head.style.fontWeight = '600'; head.textContent = dateLabel(r.date); tip.append(head);
          const items = [['종가', fv(r.price, f0), dash.colors[0]]]
            .concat(lines.map(([k, lab, c]) => [lab, fv(r[k], f1), c == null ? 'var(--cds-chart-muted)' : dash.colors[c]]))
            .concat([['거래량', fv(r.volume, f0), 'var(--cds-chart-muted)'], ['RSI', fv(r.rsi14, d3.format('.1f')), dash.colors[3]],
              ['MACD', fv(r.macd, f1), dash.colors[0]], ['시그널', fv(r.macd_signal, f1), dash.colors[1]]]);
          items.forEach(([k, val, c]) => { const row = document.createElement('div'); const sw = document.createElement('i'); sw.className = 'sj-sw'; sw.style.background = c; row.append(sw, document.createTextNode(k + '  ' + val)); tip.append(row); });
          const tx = x(r.date) / W * el.clientWidth;
          tip.style.left = (tx > el.clientWidth / 2 ? tx - tip.offsetWidth - 12 : tx + 12) + 'px';
          tip.style.top = '8px';
        })
        .on('pointerleave', () => { tip.hidden = true; cross.attr('opacity', 0); });
    }
  });
  const syncLegend = () => document.querySelectorAll('#tech-legend [data-ov]').forEach((s) => { s.hidden = s.dataset.ov !== S.overlay; });
  syncLegend();
  document.querySelectorAll('#overlay-select').forEach((s) => s.addEventListener('change', () => { S.overlay = s.value; syncLegend(); dash.draw('stock-chart'); }));
  document.querySelectorAll('#range-select').forEach((s) => s.addEventListener('change', () => { S.range = s.value; dash.draw('stock-chart'); }));

  dash.draw('tech-stat', (el) => {
    const d = dash.data('tech');
    const r = d.status === 'ok' && d.data ? d.data.find((x) => x.code === S.sel) : null;
    if (!r) return setDash(el);
    const val = r[el.dataset.field], f = el.dataset.fmt;
    if (val == null) { el.textContent = '—'; return; }
    el.textContent = f === 'int' ? fmtInt(val) : f === 'pct' ? fmtPct(val, true) : f === 'x' ? val.toFixed(2) + '배' : f === 'num1' ? fmt1(val) : f === 'dec2' ? val.toFixed(2) : String(val);
    el.classList.remove('up', 'down');
    if (f === 'pct') cls(el, val);
    if (f === 'text') { el.classList.toggle('up', /정배열|골든|상향|> 시그널|구름 위/.test(val)); el.classList.toggle('down', /역배열|데드|하향|< 시그널|구름 아래/.test(val)); }
  });
  document.querySelectorAll('#signal-select').forEach((s) => s.addEventListener('change', () => { S.signal = s.value; dash.draw('tech-rows'); }));
  dash.draw('tech-rows', (tb) => {
    const d = dash.data('tech');
    tb.replaceChildren();
    if (d.status !== 'ok' || !d.data) return;
    const rows = d.data.filter((r) => !S.signal || [r.trend, r.rsi_state, r.macd_state, r.bb_state, r.cloud_state].some((t) => t.includes(S.signal))).sort((a, b) => a.rsi14 - b.rsi14);
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.className = 'sj-click' + (r.code === S.sel ? ' sj-on' : '');
      const cells = [[r.code, 'l'], [r.name, 'l'], [fmtInt(r.price)], [fmtPct(r.gap20, true), '', r.gap20], [fmtPct(r.gap60, true), '', r.gap60], [r.rsi14.toFixed(1)], [r.rsi_state, 'l'], [r.trend, 'l'], [r.macd_state, 'l'], [r.bb_state, 'l'], [r.cloud_state, 'l'], [r.vol_ratio.toFixed(2)]];
      for (const [t, c, val] of cells) { const td = document.createElement('td'); td.textContent = t; if (c) td.className = c; if (val !== undefined) cls(td, val); tr.append(td); }
      tr.addEventListener('click', () => { S.sel = r.code; redrawSel(); document.querySelectorAll('#h-stock-chart').forEach((h2) => h2.scrollIntoView({ behavior: 'smooth', block: 'start' })); });
      tb.append(tr);
    }
  });

  const hbars = (el, rows, key, label, colorFn, fmtFn, lW) => {
    el.replaceChildren();
    const W = Math.max(280, el.clientWidth), bh = 22, gap = 6, m = { t: 6, r: 52, b: 22, l: lW || 104 };
    const H = m.t + m.b + rows.length * (bh + gap);
    const ext = d3.max(rows, (r) => Math.abs(r[key])) || 1;
    const x = d3.scaleLinear().domain([-ext, ext]).nice().range([m.l, W - m.r]);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H).attr('role', 'img').attr('aria-label', label);
    svg.append('g').attr('class', 'grid').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(5).tickFormat((v) => v + '%').tickSize(-(H - m.t - m.b))).call((g) => g.select('.domain').remove());
    svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--cds-chart-axis)');
    const g = svg.selectAll('g.bar').data(rows).join('g').attr('class', 'bar').attr('transform', (r, i) => `translate(0,${m.t + i * (bh + gap)})`);
    g.append('rect').attr('x', (r) => Math.min(x(0), x(r[key]))).attr('width', (r) => Math.max(1, Math.abs(x(r[key]) - x(0)))).attr('height', bh).attr('rx', 3).style('fill', colorFn);
    g.append('text').attr('x', m.l - 8).attr('y', bh / 2).attr('dy', '0.35em').attr('text-anchor', 'end').style('fill', 'var(--color-fg)').text((r) => r.sector);
    g.append('text').attr('y', bh / 2).attr('dy', '0.35em').attr('x', (r) => r[key] >= 0 ? x(r[key]) + 4 : x(r[key]) - 4).attr('text-anchor', (r) => r[key] >= 0 ? 'start' : 'end').text(fmtFn);
    return svg;
  };
  dash.draw('sector-chart', (el) => {
    const d = dash.data('sector_view');
    el.replaceChildren();
    if (d.status !== 'ok' || !d.data) { if (d.status === 'error') el.textContent = '불러오지 못했습니다'; return; }
    hbars(el, d.data.slice().sort((a, b) => b.flow_p4 - a.flow_p4), 'flow_p4', '업종별 구간 ④ 순자금흐름', (r) => r.flow_p4 >= 0 ? dash.colors[0] : dash.colors[1], (r) => (r.flow_p4 > 0 ? '+' : '') + r.flow_p4.toFixed(1) + '%');
  });
  dash.draw('sector-rows', (tb) => {
    const d = dash.data('sector_view');
    tb.replaceChildren();
    if (d.status !== 'ok' || !d.data) return;
    for (const r of d.data.slice().sort((a, b) => b.flow_p4 - a.flow_p4)) {
      const tr = document.createElement('tr');
      for (const [t, c, v] of [[r.sector, 'l'], [String(r.stocks)], [fmtPct(r.flow_p4, true), '', r.flow_p4], [fmtPct(r.return_p4, true), '', r.return_p4], [r.volume_ratio.toFixed(2)], [r.verdict, 'l']]) {
        const td = document.createElement('td'); td.textContent = t; if (c) td.className = c; if (v !== undefined) cls(td, v); tr.append(td);
      }
      tb.append(tr);
    }
  });
  document.querySelectorAll('#verdict-select').forEach((s) => s.addEventListener('change', () => { S.verdict = s.value; dash.draw('flow-rows'); }));
  dash.draw('flow-rows', (tb) => {
    const d = dash.data('flow_view');
    tb.replaceChildren();
    if (d.status !== 'ok' || !d.data) return;
    for (const r of d.data.filter((x) => !S.verdict || x.verdict.startsWith(S.verdict))) {
      const tr = document.createElement('tr');
      for (const [t, c, v] of [[r.code, 'l'], [tidy(r.name), 'l'], [r.sector, 'l'], [r.volume_ratio.toFixed(2)], [fmtPct(r.return_p4, true), '', r.return_p4], [fmtPct(r.flow_p4, true), '', r.flow_p4], [r.verdict, 'l']]) {
        const td = document.createElement('td'); td.textContent = t; if (c) td.className = c; if (v !== undefined) cls(td, v); tr.append(td);
      }
      tb.append(tr);
    }
  });

  const stockOptions = (sel, current, withNone) => {
    const d = dash.data('stock_stats');
    const rows = d.status === 'ok' && d.data ? d.data.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko')) : [];
    sel.replaceChildren(...(withNone ? [new Option('종목 없음', '')] : []), ...rows.map((r) => new Option(r.name + ' (' + r.code + ')', r.code)));
    sel.value = current;
  };
  window.__sj.stockOptions = stockOptions;
  dash.draw('seg-select', (sel) => {
    stockOptions(sel, S.seg, false);
    sel.onchange = () => { S.seg = sel.value; ['seg-pie', 'seg-rows', 'seg-basis', 'seg-total', 'seg-detail'].forEach((n) => dash.draw(n)); };
  });
  const segSales = () => {
    const rows = (() => { const d = dash.data('segments'); return d.status === 'ok' && d.data ? d.data.filter((r) => r.code === S.seg) : []; })();
    const p = dash.data('perf_years');
    if (!rows.length || p.status !== 'ok' || !p.data) return null;
    const fy = String(rows[0].fiscal);
    const pr = p.data.find((r) => r.code === S.seg && String(r.fy) === fy && !r.forecast);
    if (!pr || pr.sales == null || !/매출/.test(rows[0].basis)) return null;
    return { fy, sales: pr.sales };
  };
  dash.draw('seg-total', (el) => {
    const s = segSales();
    el.textContent = s ? s.fy + '기 전체 매출 ' + d3.format(',')(s.sales) + '억엔 × 부문 비중으로 계산한 대략의 금액입니다(부문 간 거래 조정 때문에 회사 발표 숫자와 조금 다를 수 있음).' : '이 회사는 매출 비중 자료가 아니라서(은행 등은 이익 구성) 금액을 계산하지 않았습니다.';
  });
  dash.draw('seg-detail', (box) => {
    box.replaceChildren();
    const d = dash.data('seg_detail'); if (d.status !== 'ok' || !d.data) return;
    const rows = d.data.filter((r) => String(r.code) === S.seg); if (!rows.length) return;
    const bySeg = new Map(); for (const r of rows) { if (!bySeg.has(r.segment)) bySeg.set(r.segment, []); bySeg.get(r.segment).push(r); }
    const head = document.createElement('h2'); head.id = 'h-seg-detail'; head.textContent = '부문별 세부 내역'; box.append(head);
    for (const [seg, rs] of bySeg) {
      const has = (r) => r.amount !== '' && r.amount != null && !isNaN(+r.amount);
      const metric = rs[0].metric || '매출', unit = rs[0].unit || '억엔';
      const h = document.createElement('h3'); h.className = 'sj-h3'; h.textContent = seg + ' · ' + metric + ' (' + rs[0].fiscal + '기, ' + unit + ')'; box.append(h);
      if (!rs.some(has)) { const p = document.createElement('p'); p.className = 'sj-muted'; p.textContent = '세부 미공개 — ' + (rs[0].note || '회사가 이 부문을 더 나눈 숫자를 공개하지 않습니다.'); box.append(p); continue; }
      const total = d3.sum(rs.filter(has), (r) => Math.max(0, +r.amount)); const max = d3.max(rs.filter(has), (r) => Math.abs(+r.amount)) || 1;
      for (const r of rs.filter(has).sort((a, b) => +b.amount - +a.amount)) {
        const row = document.createElement('div'); row.className = 'sj-hrow';
        const top = document.createElement('div'); top.className = 'sj-hrow-top';
        const nm = document.createElement('span'); nm.textContent = r.sub + (r.kind === '차감 추정' ? ' (차감 추정)' : '');
        const v = document.createElement('b'); const pv = r.prev === '' || r.prev == null || isNaN(+r.prev) ? null : +r.prev;
        v.textContent = d3.format(',')(+r.amount) + unit + (+r.amount > 0 && total ? ' · ' + (+r.amount / total * 100).toFixed(0) + '%' : '') + (pv ? '  (전년 ' + d3.format(',')(pv) + (pv > 0 && +r.amount > 0 ? ', ' + fmtPct(Math.round((+r.amount / pv - 1) * 1000) / 10, true) : '') + ')' : '');
        top.append(nm, v);
        const bar = document.createElement('div'); bar.className = 'sj-hbar'; const f = document.createElement('i'); f.style.width = Math.max(1, Math.abs(+r.amount) / max * 100) + '%';
        f.style.background = +r.amount < 0 ? 'var(--color-bad)' : /방위/.test(r.sub) ? dash.colors[1] : /우주/.test(r.sub) ? dash.colors[2] : /기타/.test(r.sub) ? 'var(--cds-chart-muted)' : dash.colors[0]; bar.append(f);
        const m = document.createElement('div'); m.className = 'sj-muted'; m.textContent = r.note;
        row.append(top, bar, m); box.append(row);
      }
      const src = document.createElement('p'); src.className = 'sj-muted'; src.textContent = '출처: ' + rs[0].source + (rs.some((r) => r.kind === '차감 추정') ? '. "차감 추정"은 회사가 발표한 합계에서 다른 항목을 빼서 구한 값입니다.' : '') + (rs.filter(has).length > 1 && metric !== '매출' ? ' 비율은 플러스 항목 합계 기준입니다.' : ''); box.append(src);
    }
  });
  const segRows = () => { const d = dash.data('segments'); if (d.status !== 'ok' || !d.data) return null; return d.data.filter((r) => r.code === S.seg); };
  dash.draw('seg-basis', (el) => { const rows = segRows(); el.textContent = rows && rows.length ? rows[0].basis + ' · ' + rows[0].fiscal + '기 · 출처 ' + rows[0].source : '—'; });
  const segColor = (rows) => { let k = 0; return rows.map((r) => r.segment.startsWith('기타') ? 'var(--cds-chart-muted)' : dash.colors[(k++) % dash.colors.length]); };
  window.__sj.segColor = segColor;
  dash.draw('seg-pie', (el) => {
    el.replaceChildren();
    const rows = segRows();
    if (!rows || !rows.length) { el.textContent = '—'; return; }
    const colors = segColor(rows);
    const W = Math.max(260, Math.min(el.clientWidth, 420)), R = W / 2 - 8;
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${W}`).attr('height', W).style('max-width', W + 'px').attr('role', 'img').attr('aria-label', '부문별 비중 원그래프');
    const g = svg.append('g').attr('transform', `translate(${W / 2},${W / 2})`);
    const pie = d3.pie().sort(null).value((r) => +r.share_pct)(rows);
    const arc = d3.arc().innerRadius(R * 0.45).outerRadius(R).padAngle(0.01);
    const tip = document.createElement('div'); tip.className = 'sj-tip'; tip.hidden = true; el.append(tip);
    g.selectAll('path').data(pie).join('path').attr('d', arc).style('fill', (p, i) => colors[i]).style('stroke', 'var(--color-bg)').attr('stroke-width', 2)
      .on('pointermove', (ev, p) => { const [mx, my] = d3.pointer(ev, el); tip.hidden = false; tip.textContent = p.data.segment + '  ' + (+p.data.share_pct).toFixed(1) + '%'; tip.style.left = Math.min(el.clientWidth - tip.offsetWidth - 4, mx + 12) + 'px'; tip.style.top = (my + 12) + 'px'; })
      .on('pointerleave', () => { tip.hidden = true; });
    const total = d3.sum(rows, (r) => +r.share_pct);
    g.selectAll('text').data(pie.filter((p) => +p.data.share_pct / total >= 0.05)).join('text').attr('transform', (p) => `translate(${arc.centroid(p)})`).attr('text-anchor', 'middle').attr('dy', '0.35em').text((p) => Math.round(+p.data.share_pct) + '%');
  });
  dash.draw('seg-rows', (tb) => {
    tb.replaceChildren();
    const rows = segRows(); if (!rows) return;
    const colors = segColor(rows);
    rows.forEach((r, i) => {
      const tr = document.createElement('tr');
      const a = document.createElement('td'); a.className = 'l';
      const sw = document.createElement('i'); sw.className = 'sj-sw'; sw.style.background = colors[i];
      a.append(sw, document.createTextNode(r.segment));
      const b = document.createElement('td'); b.textContent = (+r.share_pct).toFixed(1);
      const ss = segSales(); const c = document.createElement('td'); c.textContent = ss ? d3.format(',')(Math.round(ss.sales * +r.share_pct / 100)) : '—';
      tr.append(a, b, c); tb.append(tr);
    });
  });
})();

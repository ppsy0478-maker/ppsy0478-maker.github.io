/* 실시간 시세: TradingView 무료 위젯. 도쿄증권거래소 개별 종목·닛케이 현물지수는 무료 위젯에서 제공되지 않아 CFD·선물로 대신함 */
(() => {
  const TAPE = [{"proName": "OANDA:JP225USD", "title": "닛케이225(CFD)"}, {"proName": "OSE:NK2251!", "title": "닛케이 선물"}, {"proName": "OSE:TOPIX1!", "title": "TOPIX 선물"}, {"proName": "FX_IDC:USDJPY", "title": "달러/엔"}, {"proName": "OANDA:SPX500USD", "title": "S&P500(CFD)"}, {"proName": "OANDA:NAS100USD", "title": "나스닥100(CFD)"}, {"proName": "OANDA:XAUUSD", "title": "금"}];
  const GROUPS = [{"name": "일본", "symbols": [{"name": "OANDA:JP225USD", "displayName": "닛케이225 (CFD, 실시간)"}, {"name": "OSE:NK2251!", "displayName": "닛케이225 선물 (오사카, 지연)"}, {"name": "OSE:TOPIX1!", "displayName": "TOPIX 선물 (오사카, 지연)"}, {"name": "FX_IDC:USDJPY", "displayName": "달러/엔"}, {"name": "FX_IDC:EURJPY", "displayName": "유로/엔"}]}, {"name": "미국", "symbols": [{"name": "OANDA:SPX500USD", "displayName": "S&P500 (CFD)"}, {"name": "OANDA:NAS100USD", "displayName": "나스닥100 (CFD)"}, {"name": "OANDA:US30USD", "displayName": "다우 (CFD)"}]}, {"name": "원자재", "symbols": [{"name": "OANDA:XAUUSD", "displayName": "금"}, {"name": "OANDA:WTICOUSD", "displayName": "WTI 원유"}]}];
  const dark = () => window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  const mount = (box, src, cfg) => {
    if (!box || box.__tv) return; box.__tv = 1;
    const w = document.createElement('div'); w.className = 'tradingview-widget-container';
    const inner = document.createElement('div'); inner.className = 'tradingview-widget-container__widget'; w.append(inner);
    const s = document.createElement('script'); s.type = 'text/javascript'; s.async = true; s.src = src; s.textContent = JSON.stringify(cfg); w.append(s);
    box.append(w);
  };
  const tape = () => mount(document.getElementById('tv-tape'), 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js',
    { symbols: TAPE, showSymbolLogo: false, isTransparent: true, displayMode: 'adaptive', colorTheme: dark() ? 'dark' : 'light', locale: 'kr' });
  const live = () => {
    mount(document.getElementById('tv-chart'), 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js',
      { autosize: false, width: '100%', height: 460, symbol: 'OANDA:JP225USD', interval: '5', timezone: 'Asia/Tokyo', theme: dark() ? 'dark' : 'light', style: '1', locale: 'kr', allow_symbol_change: true, hide_side_toolbar: true, calendar: false, support_host: 'https://www.tradingview.com' });
    mount(document.getElementById('tv-quotes'), 'https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js',
      { width: '100%', height: 520, symbolsGroups: GROUPS, showSymbolLogo: false, isTransparent: true, colorTheme: dark() ? 'dark' : 'light', locale: 'kr' });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tape); else tape();
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-go="live"]')) setTimeout(live, 30); }, true);
  if (location.hash === '#live') setTimeout(live, 500);
})();

/* 장중 시세 표: data/live.json (GitHub Actions가 장중 30분마다 갱신) */
(() => {
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const sg = (v, d = 2) => (v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(d) + '%');
  const nf = (v, d = 0) => (v == null ? '—' : v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const cls = (e, v) => { e.classList.toggle('up', v > 0); e.classList.toggle('down', v < 0); };
  let sortK = 'vs_base_pct', dir = -1, LV = null;
  const render = () => {
    const cards = document.getElementById('lv-cards'), tbl = document.getElementById('lv-table'); if (!cards || !LV) return;
    cards.replaceChildren(); tbl.replaceChildren();
    const nk = LV.nikkei || {};
    [['닛케이225', nf(nk.price, 2), nk.chg_pct, (nk.time || '') + ' 기준(15분 지연)'], ['62종목 지수(닛케이식)', nf(LV.ns, 1), LV.ns_pct, '전일 종가 ' + LV.base_date.slice(5).replace('-', '.') + ' 대비'],
      ['62종목 지수(시총 가중)', nf(LV.tp, 1), LV.tp_pct, '상승 ' + LV.up + ' · 하락 ' + LV.down], ['마지막 갱신', LV.updated_jst.slice(11), null, LV.updated_jst.slice(0, 10) + ' (한국·일본 같은 시각)']].forEach(([l, v, p, s]) => {
      const c = el('div', 'sj-stat'); const vv = el('div', 'sj-stat-v', v); c.append(el('div', 'sj-card-label', l), vv);
      if (p != null) { const d = el('div', null, sg(p)); cls(d, p); c.append(d); }
      c.append(el('div', 'sj-muted', s)); cards.append(c);
    });
    const C = [['name', '종목', 'l'], ['sector', '업종', 'l'], ['price', '현재가(엔)'], ['chg', '전일 대비'], ['vs_base_pct', '등락률'], ['time', '시각']];
    const th = el('thead'); const tr = el('tr');
    C.forEach(([k, lab, c]) => { const h = el('th', c || null, lab + (k === sortK ? (dir < 0 ? ' ▼' : ' ▲') : '')); h.style.cursor = 'pointer'; h.onclick = () => { if (sortK === k) dir = -dir; else { sortK = k; dir = c ? 1 : -1; } render(); }; tr.append(h); });
    th.append(tr); tbl.append(th);
    const body = el('tbody');
    LV.quotes.slice().sort((a, b) => { const x = a[sortK], y = b[sortK]; return typeof x === 'string' ? dir * String(x).localeCompare(String(y), 'ko') : dir * ((x ?? -1e9) - (y ?? -1e9)); }).forEach((q) => {
      const t = el('tr'); t.append(el('td', 'l', q.name + ' (' + q.code + ')'), el('td', 'l', q.sector), el('td', null, nf(q.price, q.price < 1000 ? 1 : 0)));
      const c1 = el('td', null, q.chg == null ? '—' : (q.chg > 0 ? '+' : '') + nf(q.chg, Math.abs(q.chg) < 10 ? 1 : 0)); cls(c1, q.chg);
      const c2 = el('td', null, sg(q.vs_base_pct)); cls(c2, q.vs_base_pct); t.append(c1, c2, el('td', null, q.time || '—')); body.append(t);
    });
    tbl.append(body);
  };
  const load = async () => { try { const r = await fetch('data/live.json?t=' + Date.now(), { cache: 'no-store' }); if (r.ok) { LV = await r.json(); render(); } } catch (e) {} };
  load(); setInterval(load, 5 * 60 * 1000);
})();

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

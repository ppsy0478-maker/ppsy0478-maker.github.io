/* AI 브리핑 캐릭터 (PC 전용, 깃허브판만): Live2D 무료 샘플 모델 + 브라우저 내장 음성(Web Speech) — 서버·요금 없음 */
(() => {
  if (window.__vtb) return; window.__vtb = 1;
  const MODEL = 'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@master/test/assets/haru/haru_greeter_t03.model3.json';
  const LIBS = ['https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
    'https://cdn.jsdelivr.net/npm/pixi.js@6.5.10/dist/browser/pixi.min.js',
    'https://cdn.jsdelivr.net/npm/pixi-live2d-display@0.4.0/dist/cubism4.min.js'];
  const pc = () => window.matchMedia('(min-width: 1000px) and (pointer: fine)').matches;
  const rowsOf = (n) => { const d = dash.data(n); return d.status === 'ok' && Array.isArray(d.data) ? d.data : []; };
  const md = (d) => +String(d).slice(5, 7) + '월 ' + +String(d).slice(8, 10) + '일';
  const say = (s) => String(s || '')
    .replace(/\s*¶\s*/g, ' ').replace(/[＋+](\d)/g, '플러스 $1').replace(/[−–-](\d)/g, '마이너스 $1')
    .replace(/·/g, ', ').replace(/~/g, '에서 ').replace(/\(([^()]{0,40})\)/g, ', $1, ').replace(/\s+/g, ' ').trim();

  /* ---------- 대본 만들기 ---------- */
  const TYPE_RANK = { '실적': 0, 'M&A': 1, '애널리스트': 2, '업황': 3, '제휴': 4, '신제품': 5, '수급': 6, '정책': 7 };
  function stockNews(d, limit = 5) {
    const P = rowsOf('prices'); const ds = [...new Set(P.map((r) => String(r.date)))].sort(); const i = ds.indexOf(d);
    const name = new Map(P.map((r) => [String(r.code), String(r.name).replace(/\(.*?\)|㈜/g, '')])); const chg = new Map();
    if (i > 0) { const p0 = new Map(P.filter((r) => String(r.date) === ds[i - 1]).map((r) => [String(r.code), +r.price])); P.filter((r) => String(r.date) === d).forEach((r) => { const b = p0.get(String(r.code)); if (b) chg.set(String(r.code), (+r.price / b - 1) * 100); }); }
    const g = new Map();
    rowsOf('news').filter((r) => String(r.date).slice(0, 10) === d && r.sentiment !== '중립' && r.type in TYPE_RANK).forEach((r) => { const m = String(r.url).match(/b=(\w+)/); const k = m ? m[1] : r.code + r.headline; if (!g.has(k)) g.set(k, []); g.get(k).push(r); });
    const score = (x) => new Set(x.map((r) => String(r.code))).size * 10 + Math.max(...x.map((r) => Math.abs(chg.get(String(r.code)) || 0)));
    const ranked = [...g.values()].sort((a, b) => score(b) - score(a) || TYPE_RANK[a[0].type] - TYPE_RANK[b[0].type]);
    const out = [], used = new Set();
    for (const x of ranked) {
      const codes = [...new Set(x.map((r) => String(r.code)))].filter((c) => !used.has(c)); if (!codes.length) continue; codes.forEach((c) => used.add(c));
      const hs = x.map((r) => r.headline), multi = hs.filter((h) => /동반|일제|\d사/.test(h)); const pool = codes.length > 1 && multi.length ? multi : hs;
      const head = pool.reduce((a, b) => (b.length < a.length ? b : a));
      out.push(codes.map((c) => (name.get(c) || c) + (chg.has(c) ? ' ' + (chg.get(c) > 0 ? '+' : '') + chg.get(c).toFixed(1).replace('.0', '') + '%' : '')).join(', ') + '. ' + head.replace(' + ', ', ') + '.');
      if (out.length >= limit) break;
    }
    return out;
  }
  function script() {
    const rep = rowsOf('market_reports').slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).pop();
    const out = [];
    if (!rep) return ['아직 오늘 보고서가 없어요. 밤 업데이트 뒤에 다시 불러 주세요.'];
    const d = String(rep.date).slice(0, 10);
    out.push('안녕하세요! ' + md(d) + ' 닛케이 브리핑을 시작할게요.');
    String(rep.lede || '').split(/(?<=다\.)\s*/).filter(Boolean).forEach((s) => out.push(say(s)));
    const up = String(rep.up || '').split(/,\s*(?![^()]*\))/).slice(0, 3).join(', ');
    const dn = String(rep.down || '').split(/\s*\/\s*/)[0].split(/,\s*(?![^()]*\))/).slice(0, 3).join(', ');
    if (up) out.push('강했던 쪽은 ' + say(up.replace(/\s*\([^)]*\)/g, '')) + ' 입니다.');
    if (dn) out.push('약했던 쪽은 ' + say(dn) + ' 였어요.');
    const mn = rowsOf('market_news').filter((r) => String(r.date).slice(0, 10) === d);
    const pick = mn.filter((r) => r.cat === '특징주').slice(0, 2).concat(mn.filter((r) => r.cat === '전망').slice(-1));
    if (pick.length) { out.push('오늘의 시장 특징 뉴스예요.'); pick.forEach((r) => out.push(say(r.title) + '. ' + say(String(r.summary || '').split(/(?<=다\.)\s*/)[0]))); }
    const sn = stockNews(d); if (sn.length) { out.push('이어서 오늘의 종목 뉴스입니다.'); sn.forEach((l) => out.push(say(l))); }
    const iv = rowsOf('investor_flows').slice().sort((a, b) => String(a.week_end).localeCompare(String(b.week_end))).pop();
    if (iv) { const v = Math.round(+iv.for_net); out.push('수급을 보면, 가장 최근 집계 주에 외국인은 ' + Math.abs(v).toLocaleString('ko-KR') + '억 엔을 순' + (v >= 0 ? '매수' : '매도') + '했어요.'); }
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const cal = rowsOf('calendar').filter((r) => String(r.date).slice(0, 10) >= today && /금리|미국 지표|실적/.test(r.kind)).slice(0, 3);
    if (cal.length) out.push('앞으로 일정은 ' + cal.map((r) => md(String(r.date).slice(0, 10)) + ' ' + say(String(r.title).replace(/\s*\([^)]*\)/g, ''))).join(', ') + ' 입니다.');
    out.push('투자 판단은 언제나 본인 몫이에요. 오늘도 수고 많으셨어요!');
    return out.filter(Boolean);
  }


  /* ---------- 검색 대본 ---------- */
  const norm = (x) => String(x || '').toLowerCase().replace(/[\s·()（）\-㈜]/g, '').replace(/(주식회사|홀딩스|그룹|hd)$/, '');
  const pct = (v) => (v > 0 ? '플러스 ' : v < 0 ? '마이너스 ' : '') + Math.abs(v).toFixed(1) + '퍼센트';
  const won = (v) => Math.round(v).toLocaleString('ko-KR') + '엔';
  function findStock(q) {
    const P = rowsOf('prices'); if (!P.length) return null;
    const last = new Map(), first = new Map(), prev = new Map();
    const dates = [...new Set(P.map((r) => String(r.date)))].sort(); const L = dates[dates.length - 1], PV = dates[dates.length - 2], F = dates[0];
    P.forEach((r) => { const d = String(r.date); if (d === L) last.set(String(r.code), r); if (d === PV) prev.set(String(r.code), r); if (d === F) first.set(String(r.code), r); });
    const n = norm(q); if (!n) return null;
    const list = [...last.values()];
    let hit = list.find((r) => String(r.code).toLowerCase() === n) || list.find((r) => norm(String(r.name).replace(/\s*\(구\).*$/, '')) === n)
      || list.find((r) => norm(r.name).startsWith(n)) || (n.length >= 2 ? list.find((r) => norm(r.name).includes(n)) : null);
    if (!hit) return null;
    const c = String(hit.code); return { r: hit, p0: prev.get(c), f0: first.get(c), date: L };
  }
  function stockLines(S) {
    const r = S.r, c = String(r.code), name = String(r.name).replace(/\s*\(구\).*$/, ''), price = +r.price, out = [];
    const d1 = S.p0 ? (price / +S.p0.price - 1) * 100 : null, dt = S.f0 ? (price / +S.f0.price - 1) * 100 : null;
    out.push(name + ', ' + r.sector + ' 업종이에요. ' + md(S.date) + ' 종가는 ' + won(price) + (d1 == null ? '' : ', 전일 대비 ' + pct(d1)) + (dt == null ? '' : ', 9월 25일 이후로는 ' + pct(dt)) + '입니다.');
    const w = rowsOf('week52').find((x) => String(x.code) === c);
    if (w) { const hi = Math.max(+w.high, price), lo = Math.min(+w.low, price); out.push('52주 범위에서는 아래에서 ' + Math.round((price - lo) / (hi - lo) * 100) + '퍼센트 위치이고, 52주 고가보다 ' + Math.abs((price / hi - 1) * 100).toFixed(1) + '퍼센트 ' + (price >= hi ? '높아요.' : '낮아요.')); }
    const t = rowsOf('targets').find((x) => String(x.code) === c);
    if (t && t.target && t.flag) out.push('목표주가 자료는 주식분할이 반영되지 않았을 수 있어서 이번엔 건너뛸게요.');
    else if (t && t.target) out.push('애널리스트 평균 목표주가는 ' + won(+t.target) + '으로 지금보다 ' + pct((+t.target / price - 1) * 100) + ', 의견은 ' + (t.rating_label || '정보 없음') + '입니다.');
    const m = rowsOf('margin').filter((x) => String(x.code) === c).sort((a, b) => String(a.date).localeCompare(String(b.date))).pop();
    if (m && m.ratio !== '' && m.ratio != null) out.push(md(String(m.date)) + ' 기준 신용배율은 ' + (+m.ratio).toFixed(2) + '배예요.');
    const nw = rowsOf('news').filter((x) => String(x.code) === c).sort((a, b) => String(b.datetime).localeCompare(String(a.datetime))).slice(0, 2);
    if (nw.length) out.push('최근 뉴스는 ' + nw.map((x) => md(String(x.date)) + ', ' + say(x.headline) + (x.sentiment ? ', ' + x.sentiment : '')).join('. 그리고 ') + '입니다.');
    const b = rowsOf('board').filter((x) => String(x.code) === c).sort((a, b2) => String(a.date).localeCompare(String(b2.date))).pop();
    if (b && b.buy_pct !== '' && b.buy_pct != null) out.push('야후 게시판 분위기는 매수 ' + Math.round(+b.buy_pct) + '퍼센트, 매도 ' + Math.round(+b.sell_pct) + '퍼센트로 활동은 ' + (b.activity || '보통') + '이에요.');
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const cal = rowsOf('calendar').filter((x) => String(x.code) === c && String(x.date).slice(0, 10) >= today).slice(0, 2);
    if (cal.length) out.push('다가오는 일정은 ' + cal.map((x) => md(String(x.date).slice(0, 10)) + ' ' + say(String(x.title).replace(name, '').replace(/\s*\([^)]*\)/g, '')) + (x.status === '추정' ? ', 추정' : '')).join(', ') + '입니다.');
    return out;
  }
  function wordLines(q) {
    const n = String(q).trim(); const hit = (x) => String(x || '').includes(n);
    const mn = rowsOf('market_news').filter((r) => hit(r.title) || hit(r.summary)).sort((a, b) => String(b.datetime).localeCompare(String(a.datetime))).slice(0, 3);
    const nw = rowsOf('news').filter((r) => hit(r.headline) || hit(r.detail)).sort((a, b) => String(b.datetime).localeCompare(String(a.datetime))).slice(0, 2);
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const cal = rowsOf('calendar').filter((r) => String(r.date).slice(0, 10) >= today && (hit(r.title) || hit(r.kind) || hit(r.note))).slice(0, 3);
    const out = [];
    const P = rowsOf('prices'); const ds = [...new Set(P.map((r) => String(r.date)))].sort(); const L = ds[ds.length - 1], PV = ds[ds.length - 2];
    const pv = new Map(P.filter((r) => String(r.date) === PV).map((r) => [String(r.code), +r.price]));
    const sec = P.filter((r) => String(r.date) === L && String(r.sector).includes(n)).map((r) => ({ name: nmOf(r), ch: pv.get(String(r.code)) ? (+r.price / pv.get(String(r.code)) - 1) * 100 : 0 })).sort((a, b) => b.ch - a.ch);
    if (sec.length) out.push(md(L) + ' ' + n + ' 업종 ' + sec.length + '종목은 평균 ' + pct(sec.reduce((a, x) => a + x.ch, 0) / sec.length) + ', ' + sec.slice(0, 3).map((x) => x.name + ' ' + pct(x.ch)).join(', ') + (sec.length > 3 ? ' 순이에요.' : '이에요.'));
    if (!sec.length && !mn.length && !nw.length && !cal.length) return ['"' + n + '"에 대한 내용은 찾지 못했어요. 종목 이름이나 코드, 또는 반도체·금리 같은 단어로 다시 찾아 주세요.'];
    out.unshift('"' + n + '" 관련 내용을 찾았어요.');
    mn.forEach((r) => out.push(md(String(r.date)) + ' 시장 뉴스, ' + say(r.title) + '. ' + say(String(r.summary || '').split(/(?<=다\.)\s*/)[0])));
    const nm = new Map(rowsOf('prices').map((x) => [String(x.code), String(x.name).replace(/\s*\(구\).*$/, '')]));
    nw.forEach((r) => out.push(md(String(r.date)) + ' ' + (nm.get(String(r.code)) || '') + ' 뉴스, ' + say(r.headline) + '.'));
    if (cal.length) out.push('관련 일정은 ' + cal.map((r) => md(String(r.date).slice(0, 10)) + ' ' + say(String(r.title).replace(/\s*\([^)]*\)/g, ''))).join(', ') + '입니다.');
    return out;
  }
  /* ---------- 대화형 답변 (대시보드 데이터에서 직접 찾아 답함 · 무료) ---------- */
  let ctx = null; // 마지막으로 이야기한 종목
  const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const nmOf = (r) => String(r.name).replace(/\s*\(구\).*$/, '').replace(/\(.*?\)|㈜/g, '');
  function snap() {
    const P = rowsOf('prices'); const ds = [...new Set(P.map((r) => String(r.date)))].sort();
    const L = ds[ds.length - 1], PV = ds[ds.length - 2], F = ds[0];
    const at = (d) => new Map(P.filter((r) => String(r.date) === d).map((r) => [String(r.code), r]));
    const last = at(L), prev = at(PV), first = at(F);
    const list = [...last.values()].map((r) => { const c = String(r.code), p = +r.price, p0 = prev.get(c), f0 = first.get(c);
      return { c, r, name: nmOf(r), sector: r.sector, price: p, d1: p0 ? (p / +p0.price - 1) * 100 : 0, dt: f0 ? (p / +f0.price - 1) * 100 : 0 }; });
    return { L, PV, F, list };
  }
  const ALIAS = { '7203': '토요타 toyota', '8306': 'mufg 미쓰비시유에프제이', '2914': '재팬타바코 일본담배', '8031': '미쓰이물산 미츠이', '6178': '일본우정 우정', '9020': 'jr동일본 jr히가시니혼',
    '9202': 'ana 전일공', '1605': '인펙스', '5020': '에네오스', '6758': '소니', '7013': '아이에이치아이', '9104': 'mol', '9101': 'nyk', '3635': '코에이', '6920': '레이저텍', '7267': '혼다', '8058': '미쓰비시상사',
    '8316': 'smbc 미쓰이스미토모', '8411': '미즈호', '8766': '도쿄해상', '8750': '다이이치생명', '8309': '스미토모미쓰이트러스트', '7182': '유초', '7832': '반다이', '4816': '도에이', '285A': 'kioxia', '7974': 'nintendo', '5253': 'cover' };
  function stocksIn(q) {
    const S = snap(), n = norm(q), found = [];
    S.list.forEach((x) => {
      const keys = [norm(x.name), norm(x.name.replace(/(자동차|그룹|홀딩스|상사|은행|식품)$/, ''))].concat(String(ALIAS[x.c] || '').split(' ').map(norm)).filter((k) => k.length >= 2);
      let best = null; keys.forEach((k) => { const i = n.indexOf(k); if (i >= 0 && (!best || k.length > best.len)) best = { pos: i, len: k.length }; });
      const j = n.indexOf(String(x.c).toLowerCase()); if (!best && j >= 0 && /\d/.test(x.c)) best = { pos: j, len: 4 };
      if (best) found.push({ x, pos: best.pos, len: best.len }); });
    found.sort((a, b) => a.pos - b.pos || b.len - a.len);
    const dedup = found.filter((f) => !found.some((g) => g !== f && g.len > f.len && g.pos <= f.pos && g.pos + g.len >= f.pos + f.len));
    found.length = 0; dedup.forEach((f) => found.push(f));
    found.sort((a, b) => a.pos - b.pos || b.len - a.len);
    const out = []; found.forEach((f) => { if (!out.some((o) => o.c === f.x.c)) out.push(f.x); });
    if (!out.length) { const one = findStock(q.replace(/[?？.!]/g, '').trim().split(/\s+/)[0]); if (one) { const x = S.list.find((y) => y.c === String(one.r.code)); if (x) out.push(x); } }
    return out;
  }
  const has = (q, re) => re.test(q);
  const topN = (arr, k, f) => arr.slice().sort(f).slice(0, k);
  function aspectLines(x, q) {
    const c = x.c, out = [];
    if (has(q, /목표|적정|애널|의견|저평가|고평가/)) {
      const t = rowsOf('targets').find((y) => String(y.code) === c);
      if (!t || !t.target) return [x.name + '은 애널리스트 목표주가 자료가 없어요.'];
      if (t.flag) return [x.name + '은 주식분할이 반영 안 됐을 수 있어 목표주가는 참고만 해 주세요. 평균 ' + won(+t.target) + '이에요.'];
      out.push(x.name + ' 애널리스트 평균 목표주가는 ' + won(+t.target) + '으로 지금보다 ' + pct((+t.target / x.price - 1) * 100) + '예요. 의견은 ' + (t.rating_label || '정보 없음') + ', 참여 애널리스트는 ' + (t.analysts || '?') + '명입니다.');
      if (t.pbr_view || t.per_view) out.push('PBR 기준으로는 ' + (t.pbr_view || '판단 보류') + ', PER 기준으로는 ' + (t.per_view || '판단 보류') + '으로 봐요.');
      return out;
    }
    if (has(q, /배당/)) {
      const v = rowsOf('dividends').find((y) => String(y.code) === c);
      if (!v) return [x.name + '은 배당 자료가 없어요.'];
      out.push(x.name + ' 예상 연간 배당은 주당 ' + v.dps_fc + '엔, 배당수익률은 ' + (+v.yield_pct).toFixed(2) + '퍼센트, 배당성향은 ' + v.payout_pct + '퍼센트예요.');
      if (v.next_last_cum) out.push('다음 배당은 ' + v.next_kind + ' ' + v.next_dps + '엔이고, 받으려면 ' + md(v.next_last_cum) + '까지 갖고 있어야 해요. 권리락일은 ' + md(v.next_ex) + '입니다.');
      return out;
    }
    if (has(q, /실적|결산|발표|매출|이익|영업/)) {
      const pf = rowsOf('performance').filter((y) => String(y.code) === c).sort((a, b) => String(a.fy).localeCompare(String(b.fy)));
      const act = pf.filter((y) => String(y.forecast) !== '1').pop(), fc = pf.filter((y) => String(y.forecast) === '1').pop();
      const oku = (v) => (v === '' || v == null) ? '정보 없음' : Math.round(+v / 100).toLocaleString('ko-KR') + '억 엔';
      if (act) out.push(x.name + ' ' + act.fy_label + ' 실적은 매출 ' + oku(act.sales) + ', 영업이익 ' + oku(act.op) + ', 순이익 ' + oku(act.net) + '이었어요.');
      if (fc) out.push('회사 예상 ' + fc.fy_label + ' 실적은 매출 ' + oku(fc.sales) + ', 영업이익 ' + oku(fc.op) + '입니다.');
      const cal = rowsOf('calendar').filter((y) => String(y.code) === c && String(y.date).slice(0, 10) >= today()).slice(0, 1);
      if (cal.length) out.push('다음 실적 발표는 ' + md(String(cal[0].date).slice(0, 10)) + (cal[0].status === '추정' ? ' 쯤으로 추정돼요.' : '로 확정이에요.'));
      return out.length ? out : [x.name + '은 실적 자료가 없어요.'];
    }
    if (has(q, /뉴스|왜|이유|무슨\s*일|소식|재료/)) {
      const nw = rowsOf('news').filter((y) => String(y.code) === c).sort((a, b) => String(b.datetime).localeCompare(String(a.datetime))).slice(0, 3);
      if (!nw.length) return [x.name + '은 최근 종목 뉴스가 없어요. ' + md(snap().L) + ' 종가는 ' + won(x.price) + ', 전일 대비 ' + pct(x.d1) + '이에요.'];
      out.push(x.name + ' 최근 뉴스예요. ' + md(snap().L) + ' 주가는 전일 대비 ' + pct(x.d1) + '였어요.');
      nw.forEach((y) => out.push(md(String(y.date)) + ', ' + say(y.headline) + '. ' + say(String(y.detail || '').split(/(?<=다\.)\s*/)[0])));
      return out;
    }
    if (has(q, /52주|신고가|최고가|최저가|고점|저점/)) {
      const w = rowsOf('week52').find((y) => String(y.code) === c);
      if (!w) return [x.name + '은 52주 자료가 없어요.'];
      const hi = Math.max(+w.high, x.price), lo = Math.min(+w.low, x.price);
      return [x.name + ' 52주 최고가는 ' + won(+w.high) + ', 최저가는 ' + won(+w.low) + '이에요. 지금 ' + won(x.price) + '은 그 범위 아래에서 ' + Math.round((x.price - lo) / (hi - lo || 1) * 100) + '퍼센트 위치예요.'];
    }
    if (has(q, /신용|공매도|대차/)) {
      const m = rowsOf('margin').filter((y) => String(y.code) === c).sort((a, b) => String(a.date).localeCompare(String(b.date))).pop();
      const sp = rowsOf('short_positions').filter((y) => String(y.code) === c);
      if (m) out.push(md(String(m.date)) + ' 기준 ' + x.name + ' 신용매수 잔고는 ' + (+m.buy).toLocaleString('ko-KR') + '주, 신용매도는 ' + (+m.sell).toLocaleString('ko-KR') + '주, 신용배율 ' + (+m.ratio).toFixed(2) + '배예요.');
      out.push(sp.length ? '기관 대량 공매도 보고는 ' + sp.length + '건 있어요.' : '기관 대량 공매도 보고는 없어요.');
      return out;
    }
    if (has(q, /게시판|분위기|개미|여론/)) {
      const b = rowsOf('board').filter((y) => String(y.code) === c).sort((a, b2) => String(a.date).localeCompare(String(b2.date))).pop();
      if (!b) return [x.name + '은 게시판 자료가 없어요.'];
      return [md(String(b.date)) + ' 야후 게시판 ' + x.name + ' 분위기는 매수 ' + Math.round(+b.buy_pct) + '퍼센트, 매도 ' + Math.round(+b.sell_pct) + '퍼센트예요.' + (b.summary ? ' ' + say(String(b.summary).split(/(?<=다\.)\s*/)[0]) : '')];
    }
    if (has(q, /주주|대주주|누가\s*갖/)) {
      const h = rowsOf('holdings').filter((y) => String(y.code) === c).sort((a, b) => +b.pct - +a.pct).slice(0, 3);
      if (!h.length) return [x.name + '은 주주 자료가 없어요.'];
      return [x.name + ' 대주주는 ' + h.map((y) => y.holder_ko + ' ' + (+y.pct).toFixed(1) + '퍼센트').join(', ') + '입니다.'];
    }
    if (has(q, /전망|업황|앞으로|괜찮/)) {
      const o = rowsOf('outlook').find((y) => String(y.code) === c);
      if (!o) return [x.name + '은 업황 코멘트가 아직 없어요.'];
      return [x.name + ' 업황 판단은 ' + o.verdict + '이에요.', say(String(o.env_ko || '').replace(/\s*\([^)]*\)/g, '').split(/(?<=다\.)\s*/).slice(0, 2).join(' ')), '투자 판단은 본인 몫이라는 것, 잊지 마세요.'];
    }
    return null;
  }
  function compareLines(a, b) {
    const t = (x) => rowsOf('targets').find((y) => String(y.code) === x.c), v = (x) => rowsOf('dividends').find((y) => String(y.code) === x.c);
    const out = [a.name + '과 ' + b.name + '을 비교해 볼게요.'];
    out.push('전일 대비는 ' + a.name + ' ' + pct(a.d1) + ', ' + b.name + ' ' + pct(b.d1) + '이고, 9월 25일 이후로는 ' + a.name + ' ' + pct(a.dt) + ', ' + b.name + ' ' + pct(b.dt) + '예요.');
    const ta = t(a), tb = t(b); if (ta && tb && ta.target && tb.target) out.push('목표주가까지 남은 폭은 ' + a.name + ' ' + pct((+ta.target / a.price - 1) * 100) + ', ' + b.name + ' ' + pct((+tb.target / b.price - 1) * 100) + '입니다.');
    const va = v(a), vb = v(b); if (va && vb) out.push('배당수익률은 ' + a.name + ' ' + (+va.yield_pct).toFixed(2) + '퍼센트, ' + b.name + ' ' + (+vb.yield_pct).toFixed(2) + '퍼센트예요.');
    return out;
  }
  function marketLines(q) {
    const S = snap(), L = S.L;
    const since = has(q, /이후|누적|9월|지금까지|그동안/);
    const key = since ? 'dt' : 'd1', when = since ? '9월 25일 이후' : md(L);
    if (has(q, /오른|상승|강세|급등|좋았|올랐/)) return [when + ' 가장 많이 오른 종목은 ' + topN(S.list, 5, (a, b) => b[key] - a[key]).map((x) => x.name + ' ' + pct(x[key])).join(', ') + '이에요.'];
    if (has(q, /내린|하락|약세|급락|빠진|떨어/)) return [when + ' 가장 많이 내린 종목은 ' + topN(S.list, 5, (a, b) => a[key] - b[key]).map((x) => x.name + ' ' + pct(x[key])).join(', ') + '이에요.'];
    if (has(q, /외국인|수급|투자자|개인|매매동향/)) {
      const iv = rowsOf('investor_flows').slice().sort((a, b) => String(a.week_end).localeCompare(String(b.week_end))).slice(-2);
      if (!iv.length) return ['투자자별 매매 자료가 아직 없어요.'];
      const w = iv[iv.length - 1], f = (v) => (v >= 0 ? '순매수 ' : '순매도 ') + Math.abs(Math.round(v)).toLocaleString('ko-KR') + '억 엔';
      return [md(w.week_start) + '부터 ' + md(w.week_end) + '까지 한 주 동안 외국인은 ' + f(+w.for_net) + ', 개인은 ' + f(+w.ind_net) + ', 신탁은행은 ' + f(+w.trust_net) + ', 사업법인은 ' + f(+w.biz_net) + '이었어요.'];
    }
    if (has(q, /금리|국채|채권|미국채/)) {
      const t = rowsOf('treasury_summary').slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).pop();
      const y = rowsOf('treasury').slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).pop();
      const out = []; if (y) out.push(md(y.date) + ' 미국 국채 금리는 2년물 ' + y.y2 + ', 10년물 ' + y.y10 + ', 30년물 ' + y.y30 + '퍼센트예요.');
      if (t) out.push(say(t.title) + '.'); return out.length ? out : ['국채 자료가 없어요.'];
    }
    if (has(q, /공매도/)) {
      const ss = rowsOf('short_sector').filter((r) => r.sector === '시장 전체').sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const z = ss[ss.length - 1], y = ss[ss.length - 2]; if (!z) return ['공매도 자료가 없어요.'];
      return [md(z.date) + ' 시장 전체 공매도 비율은 ' + (+z.short_pct).toFixed(1) + '퍼센트' + (y ? ', 전날 ' + (+y.short_pct).toFixed(1) + '퍼센트에서 ' + (+z.short_pct >= +y.short_pct ? '올랐어요.' : '내렸어요.') : '예요.')];
    }
    if (has(q, /일정|캘린더|이번\s*주|다음\s*주|언제|예정/)) {
      const end = new Date(Date.now() + 9 * 3600e3 + 10 * 864e5).toISOString().slice(0, 10);
      let cal = rowsOf('calendar').filter((r) => String(r.date).slice(0, 10) >= today() && String(r.date).slice(0, 10) <= end).slice(0, 6);
      if (cal.length < 3) cal = rowsOf('calendar').filter((r) => String(r.date).slice(0, 10) >= today()).slice(0, 5);
      return cal.length ? ['다가오는 일정이에요. ' + cal.map((r) => md(String(r.date).slice(0, 10)) + ' ' + say(String(r.title).replace(/\s*\([^)]*\)/g, '')) + (r.status === '추정' ? ', 추정' : '')).join('. ') + '.'] : ['앞으로 열흘 안에 잡힌 일정은 없어요.'];
    }
    if (has(q, /배당/)) {
      const v = rowsOf('dividends').filter((r) => +r.yield_pct > 0).sort((a, b) => +b.yield_pct - +a.yield_pct).slice(0, 5);
      const nm = new Map(S.list.map((x) => [x.c, x.name]));
      return ['배당수익률이 높은 종목은 ' + v.map((r) => (nm.get(String(r.code)) || r.code) + ' ' + (+r.yield_pct).toFixed(2) + '퍼센트').join(', ') + '이에요.'];
    }
    if (has(q, /목표|저평가|싼|싸/)) {
      const nm = new Map(S.list.map((x) => [x.c, x])); const t = rowsOf('targets').filter((r) => r.target && !r.flag && nm.get(String(r.code)))
        .map((r) => ({ x: nm.get(String(r.code)), g: (+r.target / nm.get(String(r.code)).price - 1) * 100 })).sort((a, b) => b.g - a.g).slice(0, 5);
      return ['목표주가까지 여유가 큰 종목은 ' + t.map((z) => z.x.name + ' ' + pct(z.g)).join(', ') + '이에요. 목표주가는 애널리스트 의견이라 참고만 해 주세요.'];
    }
    if (has(q, /신고가|52주|고점\s*근처|최고가/)) {
      const nm = new Map(S.list.map((x) => [x.c, x])); const w = rowsOf('week52').map((r) => { const x = nm.get(String(r.code)); if (!x) return null; const hi = Math.max(+r.high, x.price), lo = Math.min(+r.low, x.price); return { x, p: (x.price - lo) / (hi - lo || 1) * 100 }; }).filter(Boolean);
      const low = has(q, /신저가|최저가|저점/);
      return [(low ? '52주 저가 근처 종목은 ' : '52주 고가 근처 종목은 ') + topN(w, 5, (a, b) => low ? a.p - b.p : b.p - a.p).map((z) => z.x.name + ' ' + Math.round(z.p) + '퍼센트 위치').join(', ') + '예요.'];
    }
    if (has(q, /뉴스|소식|이슈|특징/)) {
      const d = String(rowsOf('market_news').map((r) => String(r.date).slice(0, 10)).sort().pop() || '');
      const mn = rowsOf('market_news').filter((r) => String(r.date).slice(0, 10) === d).slice(0, 5);
      return mn.length ? [md(d) + ' 시장 뉴스 제목만 빠르게 읽어 드릴게요.'].concat(mn.map((r) => say(r.title) + '.')) : ['시장 뉴스가 아직 없어요.'];
    }
    if (has(q, /닛케이|지수|시장|증시|시황|오늘/)) {
      const rep = rowsOf('market_reports').slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).pop();
      if (!rep) return null; return String(rep.lede || '').split(/(?<=다\.)\s*/).filter(Boolean).map(say);
    }
    return null;
  }
  const josa = (t) => String(t).replace(/([가-힣A-Za-z0-9]+)(을|를|과|와|이에요|예요)(?=[\s,.!?]|$)/g, (m, w, j) => {
    const ch = w.charCodeAt(w.length - 1); const bat = ch >= 0xac00 && ch <= 0xd7a3 ? (ch - 0xac00) % 28 !== 0 : /[0-9lmnLMN]$/.test(w);
    const pair = { '을': ['을', '를'], '를': ['을', '를'], '과': ['과', '와'], '와': ['과', '와'], '이에요': ['이에요', '예요'], '예요': ['이에요', '예요'] }[j];
    return w + (bat ? pair[0] : pair[1]); }).replace(/,\s*,/g, ',').replace(/,\s*([.!?])/g, '$1').replace(/\s+,/g, ',');
  let meta = { ok: true, stock: null };
  function answer(q) { return answer0(q).map(josa); }
  function answer0(q) {
    meta = { ok: true, stock: null };
    const raw = String(q || '').trim();
    if (!raw) return ['무엇이 궁금하세요? 종목 이름이나 "오늘 제일 오른 종목" 같은 질문을 해 주세요.'];
    if (/^(안녕|하이|hi|hello)/i.test(raw)) return ['안녕하세요! 종목, 수급, 금리, 일정, 배당 같은 걸 물어보시면 대시보드 자료에서 찾아 드릴게요.'];
    if (/고마워|감사|땡큐|thanks/i.test(raw)) return ['천만에요! 또 궁금한 거 있으면 불러 주세요.'];
    if (/(뭐|뭘|무엇을?|어떤\s*걸)\s*(할\s*수|물어|알려)|도움말|사용법|기능/.test(raw)) return ['이런 걸 물어볼 수 있어요.', '소니 어때, 미쓰비시중공업 목표주가, 토요타 배당, 키옥시아 왜 올랐어.', '오늘 제일 오른 종목, 9월 이후 많이 내린 종목, 외국인 수급, 미국 금리, 이번 주 일정, 배당 높은 종목.', '두 종목을 말하면 비교도 해 드려요. 예를 들어 소니랑 닌텐도 비교.'];
    let st = stocksIn(raw);
    const follow = !st.length && ctx && /그럼|거기|그\s*종목|걔|그거|이건|여기|그\s*회사|그\s*주식|얘/.test(raw);
    if (follow) st = [ctx];
    if (st.length >= 2 && /비교|vs|랑|하고|와|과|중에|어느/i.test(raw)) { ctx = st[0]; meta.stock = st[0]; meta.stock2 = st[1]; if (/왜|어떻게|생각|어느\s*게|뭐가\s*나|추천|좋아|나아/.test(raw)) meta.ok = false; return compareLines(st[0], st[1]); }
    if (st.length) { const x = st[0]; ctx = x; meta.stock = x;
      if (raw.length > 18 && !/목표|적정|배당|실적|결산|매출|이익|뉴스|왜|이유|52주|신고가|신용|공매도|게시판|분위기|주주|전망|업황|어때|알려|정보/.test(raw)) meta.ok = false; const a = aspectLines(x, raw); if (a) return a.filter(Boolean); const S = findStock(x.c); return S ? stockLines(S) : [x.name + ' 자료를 찾지 못했어요.']; }
    const m = marketLines(raw); if (m && m.length) { if (raw.length > 22 && /왜|어떻게|생각|전망|괜찮|추천|해야|할까|일까|이유/.test(raw)) meta.ok = false; return m.filter(Boolean); }
    meta.ok = false;
    const clean = raw.replace(/[?？.!]+\s*$/, '').replace(/(에 대해|에대해)?\s*(알려\s*줘|알려줄래|어때|어때요|브리핑|찾아\s*줘|검색|해\s*줘|좀)\s*[?？.!]*$/g, '').replace(/(은|는|이|가)$/, '').trim();
    return wordLines(clean || raw);
  }
  const TAB = [[/목표|적정|애널/, 'targets', '목표주가 탭'], [/배당/, 'dividends', '배당 탭'], [/실적|결산|매출|이익/, 'perf', '실적 탭'], [/신용|공매도/, 'credit', '신용·공매도 탭'],
    [/게시판|분위기/, 'board', '게시판 탭'], [/전망|업황/, 'outlook', '업황 탭'], [/외국인|수급|투자자/, 'investors', '투자자별 매매 탭'], [/금리|국채|채권/, 'ust', '미국 국채 탭'],
    [/일정|캘린더|언제/, 'calendar', '일정 탭'], [/뉴스|소식|이슈/, 'news', '뉴스 탭'], [/닛케이|지수|시장|증시|시황/, 'reports', '시장 보고서 탭'], [/주주/, 'history', '회사 연혁 탭']];
  function linksFor(q) {
    const out = []; if (meta.stock) out.push({ label: meta.stock.name + ' 상세 보기', code: meta.stock.c });
    if (meta.stock2) out.push({ label: meta.stock2.name + ' 상세 보기', code: meta.stock2.c });
    const t = TAB.find(([re]) => re.test(q)); if (t && !(meta.stock && t[1] === 'history')) out.push({ label: t[2] + ' 열기', tab: t[1] });
    return out.slice(0, 3);
  }
  function aiContext(q) {
    const S = snap(), f1 = (v) => (v > 0 ? '+' : '') + v.toFixed(1) + '%', out = [];
    const rep = rowsOf('market_reports').slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).pop();
    out.push('[기준일] 최근 거래일 ' + S.L + ' (9.25부터 추적한 62종목)');
    if (rep) out.push('[최근 시장 보고서 ' + String(rep.date).slice(0, 10) + '] ' + String(rep.lede || '').replace(/\s*¶\s*/g, ' ') + ' ' + String(rep.body || '').replace(/\s*¶\s*/g, ' ').slice(0, 900));
    const DV = new Map(rowsOf('dividends').map((r) => [String(r.code), r])), TG = new Map(rowsOf('targets').map((r) => [String(r.code), r]));
    out.push('[62종목: 이름(코드,업종) 종가 전일비 9.25이후누적 배당수익률 목표주가괴리] ' + S.list.map((x) => { const v = DV.get(x.c), t = TG.get(x.c);
      return x.name + '(' + x.c + ',' + x.sector + ') ' + Math.round(x.price) + '엔 ' + f1(x.d1) + ' 누적' + f1(x.dt) + (v && v.yield_pct !== '' ? ' 배당' + (+v.yield_pct).toFixed(1) + '%' : '') + (t && t.target && !t.flag ? ' 목표' + f1((+t.target / x.price - 1) * 100) : ''); }).join('; '));
    const iv = rowsOf('investor_flows').slice().sort((a, b) => String(a.week_end).localeCompare(String(b.week_end))).slice(-3);
    if (iv.length) out.push('[투자자별 순매수, 억엔, 주간] ' + iv.map((w) => w.week_start + '~' + w.week_end + ' 외국인 ' + Math.round(w.for_net) + ' 개인 ' + Math.round(w.ind_net) + ' 신탁 ' + Math.round(w.trust_net) + ' 사업법인 ' + Math.round(w.biz_net)).join(' / '));
    const ty = rowsOf('treasury').slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).pop(), ts = rowsOf('treasury_summary').slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).pop();
    if (ty) out.push('[미국 국채 ' + ty.date + '] 2Y ' + ty.y2 + ' 10Y ' + ty.y10 + ' 30Y ' + ty.y30 + (ts ? ' / ' + ts.title : ''));
    const ss = rowsOf('short_sector').filter((r) => r.sector === '시장 전체').sort((a, b) => String(a.date).localeCompare(String(b.date))).pop(); if (ss) out.push('[공매도 비율 시장 전체 ' + ss.date + '] ' + ss.short_pct + '%');
    out.push('[다가오는 일정] ' + rowsOf('calendar').filter((r) => String(r.date).slice(0, 10) >= today()).slice(0, 10).map((r) => String(r.date).slice(0, 10) + ' ' + r.title + (r.status === '추정' ? '(추정)' : '')).join('; '));
    const md0 = String(rowsOf('market_news').map((r) => String(r.date).slice(0, 10)).sort().pop() || '');
    out.push('[시장 뉴스 ' + md0 + '] ' + rowsOf('market_news').filter((r) => String(r.date).slice(0, 10) === md0).slice(0, 10).map((r) => r.title + ': ' + String(r.summary || '').slice(0, 160)).join(' | '));
    const sn = rowsOf('news').slice().sort((a, b) => String(b.datetime).localeCompare(String(a.datetime))).slice(0, 15);
    const nm = new Map(S.list.map((x) => [x.c, x.name]));
    out.push('[최근 종목 뉴스] ' + sn.map((r) => String(r.date).slice(5, 10) + ' ' + (nm.get(String(r.code)) || r.code) + ': ' + r.headline).join(' | '));
    const st = stocksIn(q); if (!st.length && ctx) st.push(ctx);
    st.slice(0, 3).forEach((x) => {
      const c = x.c, info = [];
      const t = rowsOf('targets').find((y) => String(y.code) === c); if (t && t.target) info.push('평균 목표주가 ' + t.target + '엔(' + (t.rating_label || '') + ', ' + (t.analysts || '?') + '명' + (t.flag ? ', 분할 미반영 가능' : '') + '), PBR ' + t.pbr + ' PER(예) ' + t.per_fc);
      const v = rowsOf('dividends').find((y) => String(y.code) === c); if (v) info.push('예상배당 ' + v.dps_fc + '엔 수익률 ' + v.yield_pct + '% 성향 ' + v.payout_pct + '%');
      const w = rowsOf('week52').find((y) => String(y.code) === c); if (w) info.push('52주 고가 ' + w.high + ' 저가 ' + w.low);
      const pf = rowsOf('performance').filter((y) => String(y.code) === c).slice(-3); if (pf.length) info.push('실적(백만엔) ' + pf.map((y) => y.fy_label + ' 매출 ' + y.sales + ' 영업 ' + y.op + ' 순익 ' + y.net).join(' / '));
      const o = rowsOf('outlook').find((y) => String(y.code) === c); if (o) info.push('업황 ' + o.verdict + ': ' + String(o.env_ko || '').slice(0, 300));
      const n = rowsOf('news').filter((y) => String(y.code) === c).sort((a, b) => String(b.datetime).localeCompare(String(a.datetime))).slice(0, 4); if (n.length) info.push('뉴스 ' + n.map((y) => String(y.date).slice(5, 10) + ' ' + y.headline + ' - ' + String(y.detail || '').slice(0, 150)).join(' | '));
      const cal = rowsOf('calendar').filter((y) => String(y.code) === c && String(y.date).slice(0, 10) >= today()).slice(0, 2); if (cal.length) info.push('일정 ' + cal.map((y) => String(y.date).slice(0, 10) + ' ' + y.title + (y.status === '추정' ? '(추정)' : '')).join(', '));
      out.push('[종목 ' + x.name + ' ' + c + '] ' + info.join(' / '));
    });
    return out.join('\n').slice(0, 14000);
  }
  window.__vtbContext = aiContext;
  window.__vtbScript = script;
  window.__vtbAnswer = answer;
  /* ---------- 화면 ---------- */
  const css = document.createElement('style');
  css.textContent = `
  .vtb{position:fixed;right:18px;bottom:18px;z-index:50;font-family:var(--font-anthropic-sans);color:var(--color-fg)}
  .vtb-fab{border:0;border-radius:999px;padding:12px 18px;font:inherit;font-size:15px;font-weight:700;cursor:pointer;color:#fff;background:linear-gradient(135deg,#c0392b,#e0862f);box-shadow:0 6px 20px rgba(0,0,0,.25)}
  .vtb-box{width:300px;background:var(--color-panel);border:1px solid var(--color-border-line);border-radius:16px;box-shadow:0 10px 32px rgba(0,0,0,.28);overflow:hidden}
  .vtb-stage{position:relative;height:300px;background:radial-gradient(circle at 50% 35%,rgba(224,134,47,.18),transparent 70%)}
  .vtb-stage canvas{width:100%;height:100%;display:block}
  .vtb-fallback{position:absolute;inset:0;display:none;align-items:center;justify-content:center}
  .vtb-fallback img{width:150px;height:150px;border-radius:50%;object-fit:cover;border:3px solid #e0862f}
  .vtb.talking .vtb-fallback img{animation:vtbtalk .28s ease-in-out infinite alternate}
  @keyframes vtbtalk{from{transform:translateY(0) scale(1)}to{transform:translateY(-4px) scale(1.03)}}
  .vtb-sub{min-height:66px;max-height:120px;overflow:auto;padding:10px 12px;font-size:14.5px;line-height:1.55;border-top:1px solid var(--color-border-line)}
  .vtb-bar{display:flex;gap:6px;align-items:center;padding:8px 10px;border-top:1px solid var(--color-border-line);flex-wrap:wrap}
  .vtb-bar button{font:inherit;font-size:13.5px;padding:6px 10px;border-radius:8px;border:1px solid var(--color-border-line);background:var(--color-bg);color:var(--color-fg);cursor:pointer}
  .vtb-bar button.main{background:#c0392b;color:#fff;border-color:#c0392b;font-weight:700}
  .vtb-bar select{font:inherit;font-size:12.5px;padding:4px;border-radius:6px;border:1px solid var(--color-border-line);background:var(--color-bg);color:var(--color-fg);max-width:120px}
  .vtb-note{font-size:11px;color:var(--color-fg-muted);padding:0 12px 8px}
  .vtb-q{display:flex;gap:6px;padding:8px 10px 0}
  .vtb-q input{flex:1;min-width:0;font:inherit;font-size:14px;padding:6px 8px;border-radius:8px;border:1px solid var(--color-border-line);background:var(--color-bg);color:var(--color-fg)}
  .vtb-q button{font-size:15px;padding:4px 9px;border-radius:8px;border:1px solid var(--color-border-line);background:var(--color-bg);cursor:pointer}
  .vtb-q button.on{background:#c0392b;border-color:#c0392b}
  .vtb-log{display:none;flex-direction:column;gap:8px;max-height:300px;overflow:auto;padding:10px 10px 4px;border-top:1px solid var(--color-border-line)}
  .vtb.chat .vtb-log{display:flex}.vtb.chat .vtb-stage{height:170px}.vtb.chat .vtb-sub{display:none}.vtb.chat.brief .vtb-sub{display:block}
  .vtb-m{max-width:88%;padding:7px 10px;border-radius:12px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere}
  .vtb-m.me{align-self:flex-end;background:#c0392b;color:#fff;border-bottom-right-radius:4px}
  .vtb-m.bot{align-self:flex-start;background:var(--color-bg);border:1px solid var(--color-border-line);border-bottom-left-radius:4px}
  .vtb-m.bot .ai{display:inline-block;font-size:10.5px;font-weight:700;color:#e0862f;border:1px solid #e0862f;border-radius:4px;padding:0 4px;margin-right:4px;vertical-align:1px}
  .vtb-m.bot .lk{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
  .vtb-m.bot .lk button{font:inherit;font-size:12px;padding:2px 7px;border-radius:6px;border:1px solid #e0862f;background:transparent;color:var(--color-fg);cursor:pointer}
  .vtb-m.bot small{display:block;margin-top:4px;font-size:11px;color:var(--color-fg-muted)}
  .vtb-m.wait{opacity:.7;font-style:italic}
  .vtb-box{width:340px}
  .vtb-chips{display:flex;flex-wrap:wrap;gap:5px;padding:6px 10px 0}
  .vtb-chips button{font:inherit;font-size:12px;padding:3px 8px;border-radius:999px;border:1px solid var(--color-border-line);background:var(--color-bg);color:var(--color-fg);cursor:pointer}
  .vtb-chips button:hover{border-color:#e0862f}
  .vtb-x{position:absolute;top:8px;right:8px;z-index:2;border:0;background:rgba(0,0,0,.35);color:#fff;border-radius:999px;width:26px;height:26px;cursor:pointer}`;
  document.head.append(css);
  const root = document.createElement('div'); root.className = 'vtb';
  root.innerHTML = `<button class="vtb-fab" type="button">🎙 AI 브리핑</button>
  <div class="vtb-box" hidden>
    <div class="vtb-stage"><button class="vtb-x" type="button" aria-label="접기">✕</button><div class="vtb-fallback"><img src="../img/title-cat.jpg" alt="브리핑 캐릭터"></div></div>
    <div class="vtb-log" aria-live="polite"></div><div class="vtb-sub">▶ 를 누르면 오늘 시장을 브리핑해 드려요. 아래에 궁금한 걸 물어봐도 돼요.</div>
    <form class="vtb-q"><input type="search" placeholder="예: 소니 목표주가, 오늘 제일 오른 종목" aria-label="캐릭터에게 질문"><button type="submit" aria-label="검색">🔍</button><button type="button" data-a="mic" aria-label="말로 묻기">🎤</button><button type="button" data-a="read" aria-label="답변 소리내어 읽기" title="답변 소리내어 읽기">🔈</button></form>
    <div class="vtb-chips"><button type="button">오늘 제일 오른 종목</button><button type="button">외국인 수급</button><button type="button">이번 주 일정</button><button type="button">배당 높은 종목</button><button type="button">뭘 물어볼 수 있어?</button></div>
    <div class="vtb-bar"><button class="main" type="button" data-a="play">▶ 브리핑</button><button type="button" data-a="pause">⏸</button><button type="button" data-a="stop">■</button>
      <select data-a="rate" aria-label="말 빠르기"><option value="0.9">느리게</option><option value="1.05" selected>보통</option><option value="1.25">빠르게</option></select>
      <select data-a="voice" aria-label="목소리"></select></div>
    <div class="vtb-note">브리핑은 AI 음성 · 채팅은 대시보드 자료로 답하고, 어려운 질문은 AI가 답해요(틀릴 수 있음) · 캐릭터 Live2D 샘플 모델(Live2D Inc.)</div>
  </div>`;
  const fab = root.querySelector('.vtb-fab'), box = root.querySelector('.vtb-box'), stage = root.querySelector('.vtb-stage'), sub = root.querySelector('.vtb-sub');
  const vsel = root.querySelector('[data-a="voice"]'), rsel = root.querySelector('[data-a="rate"]');
  const show = () => { if (!pc()) { root.hidden = true; return; } root.hidden = false; };
  document.body.append(root); show(); window.addEventListener('resize', show);

  /* ---------- 목소리 ---------- */
  const synth = window.speechSynthesis;
  let voices = [];
  const loadVoices = () => {
    if (!synth) return;
    voices = synth.getVoices().filter((v) => /^ko/i.test(v.lang));
    const rank = (v) => (/SunHi/i.test(v.name) && /Online|Natural/i.test(v.name) ? 0 : /Natural|Online/i.test(v.name) ? 1 : /Google/i.test(v.name) ? 2 : 3);
    voices.sort((a, b) => rank(a) - rank(b));
    vsel.replaceChildren(new Option('AI 음성 (브리핑)', 'ai'), ...voices.map((v, i) => new Option('브라우저: ' + (v.name.replace(/Microsoft |\(.*?\)| - Korean.*$/g, '').trim() || v.name), i)));
    try { const s = localStorage.getItem('vtb-voice2'); if (s && voices.some((v) => v.name === s)) vsel.value = String(voices.findIndex((v) => v.name === s)); else vsel.value = 'ai'; } catch (e) {}
  };
  if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }
  vsel.onchange = () => { try { localStorage.setItem('vtb-voice2', vsel.value === 'ai' ? 'ai' : voices[+vsel.value].name); } catch (e) {} };

  /* ---------- 캐릭터 ---------- */
  let model = null, talking = false, loading = null;
  const loadScript = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); });
  function initModel() {
    if (loading) return loading;
    loading = (async () => {
      for (const u of LIBS) await loadScript(u);
      const PIXI = window.PIXI; const canvas = document.createElement('canvas'); stage.append(canvas);
      const app = new PIXI.Application({ view: canvas, autoStart: true, backgroundAlpha: 0, width: stage.clientWidth, height: stage.clientHeight, resolution: Math.min(2, window.devicePixelRatio || 1), autoDensity: true });
      model = await PIXI.live2d.Live2DModel.from(MODEL, { autoInteract: false });
      app.stage.addChild(model);
      const fit = () => { const s = stage.clientHeight / model.internalModel.height * 1.75; model.scale.set(s); model.anchor.set(0.5, 0); model.x = stage.clientWidth / 2; model.y = 6; }; window.__vtbModel = model;
      fit();
      let t = 0;
      model.internalModel.on('beforeModelUpdate', () => { t += 0.35; const v = !talking ? 0 : (analyser && audioEl && !audioEl.paused) ? audioLevel() : Math.max(0, Math.sin(t) * 0.6 + Math.sin(t * 2.3) * 0.35 + 0.2); model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', Math.min(1, v)); });
      stage.addEventListener('click', () => { try { model.motion('TapBody'); } catch (e) {} });
    })().catch(() => { stage.querySelector('.vtb-fallback').style.display = 'flex'; });
    return loading;
  }

  /* ---------- 재생 ---------- */
  let queue = [], idx = 0;
  const setTalk = (on) => { talking = on; root.classList.toggle('talking', on); };
  function speakNext() {
    if (idx >= queue.length) { setTalk(false); return; }
    const text = queue[idx]; sub.textContent = text;
    if (!synth) { sub.textContent = '이 브라우저는 음성 읽기를 지원하지 않아요. 자막만 보여 드릴게요.'; return; }
    const u = new SpeechSynthesisUtterance(text); u.lang = 'ko-KR'; u.rate = +rsel.value; u.pitch = 1.08;
    const bv = vsel.value === 'ai' ? voices[0] : voices[+vsel.value]; if (bv) u.voice = bv;
    u.onstart = () => setTalk(true);
    u.onend = () => { setTalk(false); idx++; setTimeout(speakNext, 180); };
    u.onerror = () => { setTalk(false); };
    synth.speak(u);
  }
  function playLines(lines) { stopAudio(); if (synth) synth.cancel(); queue = lines; idx = 0; speakNext(); }
  const qf = root.querySelector('.vtb-q'), qi = qf.querySelector('input'), mic = qf.querySelector('[data-a="mic"]');
  const log = root.querySelector('.vtb-log'), readBtn = qf.querySelector('[data-a="read"]');
  let readOn = false; try { readOn = localStorage.getItem('vtb-read') === '1'; } catch (e) {}
  const paintRead = () => { readBtn.textContent = readOn ? '🔊' : '🔈'; readBtn.classList.toggle('on', readOn); };
  paintRead(); readBtn.onclick = () => { readOn = !readOn; paintRead(); try { localStorage.setItem('vtb-read', readOn ? '1' : '0'); } catch (e) {} if (!readOn && synth) { synth.cancel(); setTalk(false); } };
  const hist = [];
  let chatApi = null;
  fetch('data/chat_config.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((c) => { chatApi = c && c.api ? c.api : null; }).catch(() => {});
  function goTo(l) {
    const b = document.querySelector('.sj .sj-tab[data-go="' + (l.code ? 'detail' : l.tab) + '"]'); if (b) b.click();
    if (l.code) setTimeout(() => { const sel = document.querySelector('[data-draw="dt-select"]'); if (sel) { sel.value = l.code; sel.dispatchEvent(new Event('change')); } const h = document.getElementById('h-detail'); if (h) h.scrollIntoView({ block: 'start' }); }, 60);
  }
  function bubble(kind, text, opt = {}) {
    root.classList.add('chat'); root.classList.remove('brief');
    const m = document.createElement('div'); m.className = 'vtb-m ' + kind + (opt.wait ? ' wait' : '');
    if (opt.ai) { const b = document.createElement('span'); b.className = 'ai'; b.textContent = 'AI'; m.append(b); }
    m.append(document.createTextNode(text));
    if (opt.links && opt.links.length) { const lk = document.createElement('div'); lk.className = 'lk'; opt.links.forEach((l) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = l.label; b.onclick = () => goTo(l); lk.append(b); }); m.append(lk); }
    if (opt.note) { const sm = document.createElement('small'); sm.textContent = opt.note; m.append(sm); }
    log.append(m); while (log.children.length > 40) log.firstChild.remove(); log.scrollTop = log.scrollHeight; return m;
  }
  async function askAI(q) {
    const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 50000);
    const r = await fetch(chatApi, { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q, context: aiContext(q), history: hist.slice(-6) }) }).finally(() => clearTimeout(tm));
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.answer) throw new Error(j.error || ('HTTP ' + r.status));
    return String(j.answer).trim();
  }
  const ask = async (q) => {
    q = String(q || '').trim(); if (!q) return;
    bubble('me', q);
    const lines = answer(q), links = linksFor(q);
    let text = lines.join('\n'), ai = false, note = '';
    if (!meta.ok && chatApi) {
      const w = bubble('bot', '자료를 살펴보는 중이에요…', { wait: true });
      try { text = await askAI(q); ai = true; note = 'AI 답변은 틀릴 수 있어요. 투자 판단은 본인 몫이에요.'; }
      catch (e) { note = /limit|429|quota/i.test(String(e.message)) ? '오늘 AI 사용 한도가 끝나서 기본 검색으로 답했어요.' : 'AI 연결이 안 돼서 기본 검색으로 답했어요.'; }
      w.remove();
    }
    bubble('bot', text, { ai, links, note });
    hist.push({ role: 'user', text: q }, { role: 'model', text: text.slice(0, 600) }); while (hist.length > 12) hist.shift();
    if (readOn) playLines(ai ? text.split(/(?<=[.!?。])\s+/).filter(Boolean) : lines);
  };
  window.__vtbAsk = ask;
  qf.onsubmit = (e) => { e.preventDefault(); ask(qi.value); qi.value = ''; };
  root.querySelectorAll('.vtb-chips button').forEach((b) => { b.onclick = () => ask(b.textContent); });
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) mic.hidden = true; else {
    let rec = null;
    mic.onclick = () => {
      if (rec) { rec.stop(); return; }
      if (synth) synth.cancel(); setTalk(false);
      rec = new SR(); rec.lang = 'ko-KR'; rec.interimResults = true; rec.maxAlternatives = 1;
      mic.classList.add('on'); sub.textContent = '듣고 있어요… 예: "소니 어때?", "오늘 제일 오른 종목"';
      rec.onresult = (ev) => { const r = ev.results[ev.results.length - 1]; qi.value = r[0].transcript; if (r.isFinal) { ask(qi.value); qi.value = ''; } };
      rec.onerror = (ev) => { sub.textContent = ev.error === 'not-allowed' ? '마이크 권한이 꺼져 있어요. 주소창 왼쪽 자물쇠에서 마이크를 허용해 주세요.' : '잘 못 들었어요. 다시 눌러 말해 주세요.'; };
      rec.onend = () => { mic.classList.remove('on'); rec = null; };
      rec.start();
    };
  }

  /* ---------- AI 음성 파일 재생 ---------- */
  let audioEl = null, analyser = null, actx = null, abuf = null, aMeta = null;
  const audioLevel = () => { if (!abuf) abuf = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(abuf); let s2 = 0; for (const x of abuf) { const d = (x - 128) / 128; s2 += d * d; } return Math.min(1, Math.sqrt(s2 / abuf.length) * 7); };
  const latestRep = () => rowsOf('market_reports').map((r) => String(r.date).slice(0, 10)).sort().pop();
  async function briefMeta() { try { const r = await fetch('data/brief.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return null; const m = await r.json(); return m && m.date === latestRep() && m.audio ? m : null; } catch (e) { return null; } }
  function stopAudio() { if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; } }
  async function playBrief() {
    const m = await briefMeta();
    if (!m) { sub.textContent = '오늘 AI 음성 파일이 아직 없어서 브라우저 음성으로 읽을게요.'; setTimeout(() => playLines(script()), 600); return; }
    if (synth) synth.cancel();
    if (!audioEl || aMeta !== m.date) {
      stopAudio(); audioEl = new Audio('data/' + m.audio + '?d=' + m.date); aMeta = m.date;
      try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); const src = actx.createMediaElementSource(audioEl); analyser = actx.createAnalyser(); analyser.fftSize = 1024; src.connect(analyser); analyser.connect(actx.destination); } catch (e) { analyser = null; }
      audioEl.ontimeupdate = () => { const t = audioEl.currentTime; let i = 0; m.starts.forEach((st, k) => { if (st <= t + 0.05) i = k; }); if (sub.textContent !== m.lines[i]) sub.textContent = m.lines[i]; };
      audioEl.onplay = () => setTalk(true); audioEl.onpause = () => setTalk(false); audioEl.onended = () => setTalk(false);
    }
    if (actx && actx.state === 'suspended') actx.resume();
    audioEl.playbackRate = +rsel.value / 1.05;
    audioEl.currentTime = 0; audioEl.play();
  }
  root.querySelector('[data-a="play"]').onclick = () => {
    if (audioEl && audioEl.paused && audioEl.currentTime > 0 && !audioEl.ended) { audioEl.play(); return; }
    if (synth && synth.paused) { synth.resume(); setTalk(true); return; }
    root.classList.add('brief');
    if (vsel.value === 'ai') playBrief(); else playLines(script());
    try { model && model.motion('Idle'); } catch (e) {}
  };
  root.querySelector('[data-a="pause"]').onclick = () => { if (audioEl && !audioEl.paused) { audioEl.pause(); return; } if (synth && synth.speaking) { synth.pause(); setTalk(false); } };
  root.querySelector('[data-a="stop"]').onclick = () => { stopAudio(); if (synth) synth.cancel(); queue = []; setTalk(false); sub.textContent = '▶ 를 누르면 오늘 시장을 브리핑해 드려요.'; root.classList.remove('brief'); };
  fab.onclick = () => { fab.hidden = true; box.hidden = false; initModel(); };
  root.querySelector('.vtb-x').onclick = (e) => { e.stopPropagation(); stopAudio(); if (synth) synth.cancel(); setTalk(false); box.hidden = true; fab.hidden = false; };
})();

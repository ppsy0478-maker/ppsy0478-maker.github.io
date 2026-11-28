/* AI 비서 (PC 전용, 깃허브판만): 메신저형 채팅 + AI 음성 브리핑 */
(() => {
  if (window.__vtb) return; window.__vtb = 1;
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
  const ALIAS = { '7203': '토요타 toyota', '8306': 'mufg 미쓰비시유에프제이', '2914': '재팬타바코 일본담배', '8031': '미쓰이물산 미츠이', '6178': '일본우정', '9020': 'jr동일본 jr히가시니혼',
    '9202': '전일공', '1605': '인펙스', '5020': '에네오스', '6758': '소니', '7013': '아이에이치아이', '9101': 'nyk', '3635': '코에이', '6920': '레이저텍', '7267': '혼다', '8058': '미쓰비시상사',
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
  let chatApiReady = () => false;
  /* 관심 종목 (이 브라우저에만 저장) */
  const WKEY = 'vtb-watch-v1';
  const getWatch = () => { try { return JSON.parse(localStorage.getItem(WKEY) || '[]'); } catch (e) { return []; } };
  const setWatch = (a) => { try { localStorage.setItem(WKEY, JSON.stringify([...new Set(a)].slice(0, 15))); } catch (e) {} };
  const watchStocks = () => { const S = snap(), w = getWatch(); return w.map((c) => S.list.find((x) => x.c === c)).filter(Boolean); };
  function watchLines(raw) {
    if (!/관심\s*종목|관심종목|찜/.test(raw)) return null;
    const st = stocksIn(raw.replace(/관심\s*종목|관심종목/g, ' '));
    if (st.length && /빼|삭제|제외|지워/.test(raw)) { setWatch(getWatch().filter((c) => !st.some((x) => x.c === c))); meta.mood = 'stock'; return [st.map((x) => x.name).join(', ') + '을 관심 종목에서 뺐어요.' + (getWatch().length ? ' 남은 관심 종목은 ' + watchStocks().map((x) => x.name).join(', ') + '이에요.' : '')]; }
    if (st.length) { const add = /추가|넣어|더/.test(raw); setWatch((add ? getWatch() : []).concat(st.map((x) => x.c))); meta.mood = 'proud'; return ['선생님 관심 종목으로 ' + watchStocks().map((x) => x.name).join(', ') + '을 기억해 둘게요.', '앞으로 인사할 때랑 답할 때 먼저 챙겨 드릴게요.']; }
    const W = watchStocks(); if (!W.length) return ['아직 관심 종목이 없어요. "관심 종목은 소니, IHI야"처럼 말해 주시면 기억해 둘게요.'];
    const S = snap(); const best = W.slice().sort((a, b) => b.d1 - a.d1)[0];
    meta.mood = best.d1 >= 2 ? 'proud' : W.every((x) => x.d1 < -1) ? 'worried' : 'stock';
    return [md(S.L) + ' 선생님 관심 종목이에요.', W.map((x) => x.name + ' ' + pct(x.d1) + ' (9.25 이후 ' + pct(x.dt) + ')').join(', ') + '.'];
  }
  /* 친밀도 (대화 수, 이 브라우저에만 저장) */
  const BKEY = 'vtb-bond-v1';
  const bondN = () => { try { return +(localStorage.getItem(BKEY) || 0); } catch (e) { return 0; } };
  const bondLv = () => { const n = bondN(); return n >= 120 ? 3 : n >= 50 ? 2 : n >= 15 ? 1 : 0; };
  let paintBond = () => {};
  const bondUp = () => { try { localStorage.setItem(BKEY, String(bondN() + 1)); } catch (e) {} paintBond(); };
  const BOND_TXT = ['경계 단계: 새침하고 퉁명스러움을 강하게, 칭찬엔 크게 허둥댄다.', '조금 친해짐: 퉁명스럽지만 걱정하는 말이 자주 새어 나온다.', '꽤 친해짐: 츤데레가 약해지고 가끔 먼저 챙겨 주다가 부끄러워한다.', '아주 친함: 거의 다정하다. 가끔만 "착각하지 마세요"로 부끄러움을 감춘다.'];
  const bondNote = () => '\n[친밀도 ' + bondLv() + '/3] ' + BOND_TXT[bondLv()];
  const watchNote = () => { const W = watchStocks(); return W.length ? '\n[선생님 관심 종목] ' + W.map((x) => x.name).join(', ') + ' — 관련 있으면 먼저 언급한다.' : ''; };
  const MOOD_RULE = '\n[표정 규칙] 답변 맨 앞에 [표정:웃음] [표정:새침] [표정:놀람] [표정:걱정] [표정:부끄러움] [표정:뿌듯함] 중 내용에 가장 어울리는 하나를 붙인다. 태그는 한 번만.';
  function answer(q) { return answer0(q).map(josa); }
  function answer0(q) {
    meta = { ok: true, stock: null, casual: false, mood: null };
    const raw = String(q || '').trim();
    const wl = watchLines(raw); if (wl) return wl;
    if (!raw) return ['무엇이 궁금하세요? 종목 이름이나 "오늘 제일 오른 종목" 같은 질문을 해 주세요.'];
    if (!chatApiReady() && /^(안녕|하이|hi|hello)/i.test(raw)) return ['안녕하세요! 종목, 수급, 금리, 일정, 배당 같은 걸 물어보시면 대시보드 자료에서 찾아 드릴게요.'];
    if (!chatApiReady() && /고마워|감사|땡큐|thanks/i.test(raw)) return ['천만에요! 또 궁금한 거 있으면 불러 주세요.'];
    if (/(뭐|뭘|무엇을?|어떤\s*걸)\s*(할\s*수|물어|알려)|도움말|사용법|기능/.test(raw)) { meta.mood = 'proud'; return ['이런 걸 물어볼 수 있어요.', '관심 종목도 기억해요. "관심 종목은 소니, IHI야"라고 말해 보세요.', '소니 어때, 미쓰비시중공업 목표주가, 토요타 배당, 키옥시아 왜 올랐어.', '오늘 제일 오른 종목, 9월 이후 많이 내린 종목, 외국인 수급, 미국 금리, 이번 주 일정, 배당 높은 종목.', '두 종목을 말하면 비교도 해 드려요. 예를 들어 소니랑 닌텐도 비교.']; }
    let st = stocksIn(raw);
    const follow = !st.length && ctx && /그럼|거기|그\s*종목|걔|그거|이건|여기|그\s*회사|그\s*주식|얘/.test(raw);
    if (follow) st = [ctx];
    if (st.length >= 2 && /비교|vs|랑|하고|와|과|중에|어느/i.test(raw)) { ctx = st[0]; meta.stock = st[0]; meta.stock2 = st[1]; if (/왜|어떻게|생각|어느\s*게|뭐가\s*나|추천|좋아|나아/.test(raw)) meta.ok = false; return compareLines(st[0], st[1]); }
    if (st.length) { const x = st[0]; ctx = x; meta.stock = x; meta.mood = x.d1 >= 3 ? 'proud' : x.d1 <= -3 ? 'worried' : 'stock';
      if (raw.length > 18 && !/목표|적정|배당|실적|결산|매출|이익|뉴스|왜|이유|52주|신고가|신용|공매도|게시판|분위기|주주|전망|업황|어때|알려|정보/.test(raw)) meta.ok = false; const a = aspectLines(x, raw); if (a) return a.filter(Boolean); const S = findStock(x.c); return S ? stockLines(S) : [x.name + ' 자료를 찾지 못했어요.']; }
    const m = (chatApiReady() && !isFin(raw)) ? null : marketLines(raw); if (m && m.length) { meta.mood = /내린|하락|약세|급락|빠진|떨어|공매도/.test(raw) ? 'worried' : /오른|상승|강세|급등|배당|목표/.test(raw) ? 'proud' : 'stock'; if (raw.length > 22 && /왜|어떻게|생각|전망|괜찮|추천|해야|할까|일까|이유/.test(raw)) meta.ok = false; return m.filter(Boolean); }
    meta.ok = false;
    if (chatApiReady() && !isFin(raw)) { meta.casual = true; return ['(AI 연결이 안 돼서 지금은 주식 질문만 답할 수 있어요.)']; }
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
    const st = stocksIn(q); if (!st.length && ctx && /그|거기|걔|얘|이\s*종목/.test(q)) st.push(ctx);
    if (/관심|내\s*종목|내\s*주식|보유/.test(q)) watchStocks().forEach((x) => { if (!st.some((y) => y.c === x.c)) st.push(x); });
    const THEME = [[/방산|방위|군수/, ['7011', '7012', '7013']], [/해운|선박/, ['9101', '9104']], [/메가뱅크|은행주/, ['8306', '8316', '8411']], [/종합상사|상사주/, ['8058', '8001', '8031', '8053', '8002']], [/게임|엔터|애니/, ['7974', '6758', '3659', '7832', '3635', '9468', '4816']], [/보험/, ['8766', '8725', '8750']], [/철강/, ['5401', '5406']], [/식품|음식료/, ['2802', '2587', '2897', '2282', '2002', '2229', '2602']]];
    THEME.forEach(([re, codes]) => { if (re.test(q)) codes.forEach((c) => { const x = S.list.find((y) => y.c === c); if (x && !st.some((y) => y.c === c)) st.push(x); }); });
    S.list.forEach((x) => { const sec = String(x.sector || ''); sec.split(/[·\s/]+/).filter((w) => w.length >= 2).forEach((w) => { if (q.includes(w) && !st.some((y) => y.c === x.c)) st.push(x); }); });
    st.slice(0, 6).forEach((x) => {
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
  const FIN = /주식|종목|주가|시장|증시|닛케이|지수|배당|목표|실적|결산|매출|이익|뉴스|수급|외국인|금리|국채|채권|공매도|신용|업종|섹터|반도체|방산|은행|상사|전망|업황|매수|매도|투자|수익|손실|포트폴리오|엔화|환율|달러|주주|52주|신고가|ETF|PER|PBR|일정|캘린더|FOMC|고용통계|CPI|물가|상승|하락|오른|내린|급등|급락|올랐|떨어진|코스피|나스닥|엔저|엔고/i;
  const isFin = (q) => FIN.test(q) || stocksIn(q).length > 0;
  function casualContext() {
    const S = snap(), rep0 = rowsOf('market_reports').slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).pop();
    const now = new Date(Date.now() + 9 * 3600e3);
    return '[지금] 한국 시각 ' + now.toISOString().slice(0, 16).replace('T', ' ') + ' (' + '일월화수목금토'[now.getUTCDay()] + '요일)\n[최근 시장 한 줄] ' + (rep0 ? String(rep0.lede || '').replace(/\s*¶\s*/g, ' ').slice(0, 400) : '') + '\n[최근 거래일] ' + S.L;
  }
  window.__vtbContext = aiContext;
  window.__vtbScript = script;
  window.__vtbAnswer = answer;
  /* ---------- 화면 (메신저형: 위쪽 프로필 + 말풍선) ---------- */
  const MOODS = ['stock', 'casual', 'surprised', 'worried', 'embarrassed', 'proud'];
  const AV = Object.fromEntries(MOODS.map((m) => [m, 'img/avatar_' + m + '.webp']));
  const PT = Object.fromEntries(MOODS.map((m) => [m, 'img/portrait_' + m + '.webp']));
  const MOOD_KO = { '웃음': 'stock', '새침': 'casual', '놀람': 'surprised', '걱정': 'worried', '부끄러움': 'embarrassed', '뿌듯함': 'proud' };
  const MOOD_STATUS = { stock: '친절한 주식 비서 모드', casual: '…흥, 수다 상대 해 드릴게요', surprised: '엣, 잠깐만요…!', worried: '선생님이 좀 걱정돼요', embarrassed: '그, 그런 거 아니에요…', proud: '이 정도는 기본이죠' };
  const NAME = '쿠로사키 레이코', FAB_NAME = 'AI 비서';
  const css = document.createElement('style');
  css.textContent = `
  .vtb{position:fixed;right:18px;bottom:18px;z-index:50;font-family:var(--font-anthropic-sans);color:var(--color-fg)}
  .vtb-fab{display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:6px 16px 6px 6px;font:inherit;font-size:15px;font-weight:700;cursor:pointer;color:#fff;background:linear-gradient(135deg,#c0392b,#e0862f);box-shadow:0 6px 20px rgba(0,0,0,.25)}
  .vtb-fab img{width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid #fff}
  .vtb-box[hidden],.vtb-fab[hidden]{display:none!important}
  .vtb-box{width:340px;position:relative;display:flex;flex-direction:column;max-height:calc(100vh - 36px);background:var(--color-panel);border:1px solid var(--color-border-line);border-radius:16px;box-shadow:0 10px 32px rgba(0,0,0,.28);overflow:hidden}
  .vtb-box>*:not(.vtb-log){flex:none}
  .vtb-head{position:relative;height:min(380px,40vh);background:#f8f9f3;border-bottom:1px solid var(--color-border-line);overflow:hidden}
  .vtb-head .pt{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:50% 0;opacity:0;transition:opacity .35s ease}
  .vtb-head .pt.on{opacity:1}
  .vtb.talking .vtb-head .pt.on{animation:vtbtalk .35s ease-in-out infinite alternate}
  @keyframes vtbtalk{from{transform:translateY(0) scale(1)}to{transform:translateY(-3px) scale(1.012)}}
  .vtb-head .cap{position:absolute;left:0;right:0;bottom:0;padding:22px 12px 8px;background:linear-gradient(transparent,rgba(0,0,0,.62));color:#fff}
  .vtb-head b{display:block;font-size:16px}.vtb-head span{font-size:12.5px;opacity:.9}
  .vtb-x{position:absolute;top:12px;right:10px;z-index:2;border:0;background:rgba(0,0,0,.35);color:#fff;border-radius:999px;width:26px;height:26px;cursor:pointer}
  .vtb-sub{display:none;max-height:120px;overflow:auto;padding:9px 12px;font-size:14px;line-height:1.55;border-bottom:1px solid var(--color-border-line);background:rgba(224,134,47,.06)}
  .vtb.brief .vtb-sub{display:block}
  .vtb-log{display:flex;flex-direction:column;gap:8px;flex:1 1 auto;min-height:160px;max-height:360px;overflow:auto;padding:10px}
  .vtb-row{display:flex;gap:8px;align-items:flex-start;max-width:94%}
  .vtb-row>img{width:52px;height:52px;border-radius:40%;object-fit:cover;flex:none;border:1px solid var(--color-border-line);background:#fff}
  .vtb-row .who{font-size:11.5px;color:var(--color-fg-muted);margin:0 0 2px 2px}
  .vtb-m{padding:7px 10px;border-radius:12px;font-size:14px;line-height:1.55;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere}
  .vtb-m.me{align-self:flex-end;max-width:85%;background:#c0392b;color:#fff;border-top-right-radius:4px}
  .vtb-m.bot{background:var(--color-bg);border:1px solid var(--color-border-line);border-top-left-radius:4px}
  .vtb-m.bot .ai{display:inline-block;font-size:10.5px;font-weight:700;color:#e0862f;border:1px solid #e0862f;border-radius:4px;padding:0 4px;margin-right:4px;vertical-align:1px}
  .vtb-m.bot .lk{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
  .vtb-m.bot .lk button{font:inherit;font-size:12px;padding:2px 7px;border-radius:6px;border:1px solid #e0862f;background:transparent;color:var(--color-fg);cursor:pointer}
  .vtb-m.bot small{display:block;margin-top:4px;font-size:11px;color:var(--color-fg-muted)}
  .vtb-m.wait{opacity:.7;font-style:italic}
  .vtb-hello{font-size:13px;color:var(--color-fg-muted);text-align:center;margin:auto 0}
  .vtb-q{display:flex;gap:6px;padding:8px 10px 0;border-top:1px solid var(--color-border-line)}
  .vtb-q input{flex:1;min-width:0;font:inherit;font-size:14px;padding:6px 8px;border-radius:8px;border:1px solid var(--color-border-line);background:var(--color-bg);color:var(--color-fg)}
  .vtb-q button{font-size:15px;padding:4px 9px;border-radius:8px;border:1px solid var(--color-border-line);background:var(--color-bg);cursor:pointer}
  .vtb-q button.on{background:#c0392b;border-color:#c0392b}
  .vtb-chips{display:flex;flex-wrap:wrap;gap:5px;padding:6px 10px 0}
  .vtb-chips button{font:inherit;font-size:12px;padding:3px 8px;border-radius:999px;border:1px solid var(--color-border-line);background:var(--color-bg);color:var(--color-fg);cursor:pointer}
  .vtb-chips button:hover{border-color:#e0862f}
  .vtb-bar{display:flex;gap:6px;align-items:center;padding:8px 10px;flex-wrap:wrap}
  .vtb-bar button{font:inherit;font-size:13.5px;padding:6px 10px;border-radius:8px;border:1px solid var(--color-border-line);background:var(--color-bg);color:var(--color-fg);cursor:pointer}
  .vtb-bar button.main{background:#c0392b;color:#fff;border-color:#c0392b;font-weight:700}
  .vtb-bar select{font:inherit;font-size:12.5px;padding:4px;border-radius:6px;border:1px solid var(--color-border-line);background:var(--color-bg);color:var(--color-fg);max-width:120px}
  .vtb-note{font-size:11px;color:var(--color-fg-muted);padding:0 12px 8px}
  .vtb-head b i{font-style:normal;font-size:12px;font-weight:400;margin-left:4px;letter-spacing:1px;color:#ffb3c1}
  .vtb-dots span{display:inline-block;width:6px;height:6px;margin:0 2px;border-radius:50%;background:var(--color-fg-muted);animation:vtbdot 1s infinite}
  .vtb-dots span:nth-child(2){animation-delay:.15s}.vtb-dots span:nth-child(3){animation-delay:.3s}
  @keyframes vtbdot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
  .vtb-m .sg{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
  .vtb-m .sg button{font:inherit;font-size:12px;padding:2px 8px;border-radius:999px;border:1px solid var(--color-border-line);background:var(--color-panel);color:var(--color-fg);cursor:pointer}
  .vtb-m .spark{display:block;margin-top:6px}.vtb-m .spark small{display:block;margin:0;font-size:11px;color:var(--color-fg-muted)}
  .vtb-balloon{position:absolute;right:0;bottom:calc(100% + 10px);width:250px;display:flex;gap:8px;align-items:flex-start;padding:9px 10px;border-radius:12px;background:var(--color-panel);border:1px solid var(--color-border-line);box-shadow:0 8px 24px rgba(0,0,0,.22);font-size:13.5px;line-height:1.5;cursor:pointer;animation:vtbpop .25s ease-out}
  .vtb-m.solo{font-style:italic;color:var(--color-fg-muted);background:transparent;border-style:dashed}
  .vtb-fab{position:relative}.vtb-fab .badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#ff3b30;color:#fff;font-size:12px;line-height:20px;text-align:center;box-shadow:0 0 0 2px #fff}
  .vtb-balloon b{display:block;font-size:12px;margin-bottom:1px}
  .vtb-balloon img{width:40px;height:40px;border-radius:40%;object-fit:cover;flex:none}
  @keyframes vtbpop{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`;
  document.head.append(css);
  const root = document.createElement('div'); root.className = 'vtb';
  root.innerHTML = `<button class="vtb-fab" type="button"><img src="${AV.stock}" alt="">${FAB_NAME}</button>
  <div class="vtb-box" hidden>
    <button class="vtb-x" type="button" aria-label="닫기">✕</button>
    <div class="vtb-head">${MOODS.map((m, i) => '<img class="pt' + (i ? '' : ' on') + '" data-m="' + m + '" src="' + PT[m] + '" alt="' + (i ? '' : NAME) + '"' + (i > 1 ? ' loading="lazy"' : '') + '>').join('')}<div class="cap"><b>${NAME} <i data-a="bond"></i></b><span data-a="status">주식 얘기도, 수다도 OK</span></div></div>
    <div class="vtb-sub"></div>
    <div class="vtb-log" aria-live="polite"><div class="vtb-hello">▶ 브리핑을 누르면 오늘 시장을 읽어 드려요.<br>아래에 궁금한 걸 물어보세요.</div></div>
    <form class="vtb-q"><input type="search" placeholder="예: 소니 목표주가, 오늘 제일 오른 종목" aria-label="메시지 입력"><button type="submit" aria-label="보내기">➤</button><button type="button" data-a="mic" aria-label="말로 묻기">🎤</button></form>
    <div class="vtb-chips"><button type="button">오늘 제일 오른 종목</button><button type="button">외국인 수급</button><button type="button">이번 주 일정</button><button type="button">배당 높은 종목</button><button type="button">뭘 물어볼 수 있어?</button></div>
    <div class="vtb-bar"><button class="main" type="button" data-a="play">▶ 브리핑</button><button type="button" data-a="pause">⏸</button><button type="button" data-a="stop">■</button>
      <select data-a="rate" aria-label="말 빠르기"><option value="0.9">느리게</option><option value="1.05" selected>보통</option><option value="1.25">빠르게</option></select>
      <select data-a="voice" aria-label="목소리"></select></div>
    <div class="vtb-note">브리핑은 AI 음성 · 채팅은 대시보드 자료로 답하고, 어려운 질문·수다는 Google AI가 답해요(틀릴 수 있음). 대화는 이 브라우저에만 저장되고 AI로 전송되니 개인정보는 적지 마세요.</div>
  </div>`;
  const fab = root.querySelector('.vtb-fab'), box = root.querySelector('.vtb-box'), stage = root.querySelector('.vtb-head'), sub = root.querySelector('.vtb-sub');
  const statusEl = root.querySelector('[data-a="status"]');
  const setMood = (m) => { m = MOODS.includes(m) ? m : 'stock'; root.querySelectorAll('.vtb-head .pt').forEach((im) => im.classList.toggle('on', im.dataset.m === m)); statusEl.textContent = MOOD_STATUS[m]; };
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
  function initModel() { return null; }

  /* ---------- 재생 ---------- */
  let queue = [], idx = 0;
  const setTalk = (on) => { talking = on; root.classList.toggle('talking', on); if (on && root.classList.contains('brief')) setMood('stock'); };
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
  const log = root.querySelector('.vtb-log');
  const HKEY = 'vtb-chat-v1'; let hist = [];
  try { hist = JSON.parse(localStorage.getItem(HKEY) || '[]').slice(-24); } catch (e) { hist = []; }
  const saveHist = () => { try { localStorage.setItem(HKEY, JSON.stringify(hist.slice(-24))); } catch (e) {} };
  let chatApi = null, persona = '', personaStock = '', exCasual = [], exStock = [];
  fetch('data/chat_config.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((c) => { chatApi = c && c.api ? c.api : null; chatApiReady = () => !!chatApi; persona = c && c.persona ? String(c.persona) : ''; personaStock = c && c.persona_stock ? String(c.persona_stock) : ''; exCasual = c && Array.isArray(c.examples_casual) ? c.examples_casual : []; exStock = c && Array.isArray(c.examples_stock) ? c.examples_stock : []; }).catch(() => {});
  function goTo(l) {
    const b = document.querySelector('.sj .sj-tab[data-go="' + (l.code ? 'detail' : l.tab) + '"]'); if (b) b.click();
    if (l.code) setTimeout(() => { const sel = document.querySelector('[data-draw="dt-select"]'); if (sel) { sel.value = l.code; sel.dispatchEvent(new Event('change')); } const h = document.getElementById('h-detail'); if (h) h.scrollIntoView({ block: 'start' }); }, 60);
  }
  function sparkFor(code) {
    const P = rowsOf('prices').filter((r) => String(r.code) === String(code)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (P.length < 3) return null;
    const v = P.map((r) => +r.price), lo = Math.min(...v), hi = Math.max(...v), W = 220, H = 44;
    const pts = v.map((y, i) => (i / (v.length - 1) * W).toFixed(1) + ',' + (H - 3 - (y - lo) / (hi - lo || 1) * (H - 6)).toFixed(1)).join(' ');
    const ch = (v[v.length - 1] / v[0] - 1) * 100, col = ch >= 0 ? '#c0392b' : '#2563eb';
    const box0 = document.createElement('div'); box0.className = 'spark';
    box0.innerHTML = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="9월 25일 이후 주가 흐름"><polyline fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round" points="' + pts + '"/></svg><small>9.25 이후 ' + (ch >= 0 ? '+' : '') + ch.toFixed(1) + '% · 최저 ' + lo.toLocaleString('ko-KR') + ' / 최고 ' + hi.toLocaleString('ko-KR') + '엔</small>';
    return box0;
  }
  function bubble(kind, text, opt = {}) {
    const hello = log.querySelector('.vtb-hello'); if (hello) hello.remove();
    const m = document.createElement('div'); m.className = 'vtb-m ' + kind + (opt.wait ? ' wait' : '') + (opt.solo ? ' solo' : '');
    if (opt.ai) { const b = document.createElement('span'); b.className = 'ai'; b.textContent = 'AI'; m.append(b); }
    if (opt.dots) { const d = document.createElement('span'); d.className = 'vtb-dots'; d.innerHTML = '<span></span><span></span><span></span>'; m.append(d); }
    const tn = document.createTextNode(opt.type ? '' : text); m.append(tn);
    if (opt.spark) { const sp = sparkFor(opt.spark); if (sp) m.append(sp); }
    if (opt.suggest && opt.suggest.length) { const sg = document.createElement('div'); sg.className = 'sg'; opt.suggest.forEach((q) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = q; b.onclick = () => ask(q); sg.append(b); }); m.append(sg); }
    if (opt.links && opt.links.length) { const lk = document.createElement('div'); lk.className = 'lk'; opt.links.forEach((l) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = l.label; b.onclick = () => goTo(l); lk.append(b); }); m.append(lk); }
    if (opt.note) { const sm = document.createElement('small'); sm.textContent = opt.note; m.append(sm); }
    let el = m;
    if (kind === 'bot') { el = document.createElement('div'); el.className = 'vtb-row'; const im = document.createElement('img'); im.src = AV[opt.mood] || AV.stock; im.alt = ''; const col = document.createElement('div'); const who = document.createElement('div'); who.className = 'who'; who.textContent = NAME; col.append(who, m); el.append(im, col); }
    log.append(el); while (log.children.length > 40) log.firstChild.remove(); log.scrollTop = log.scrollHeight;
    if (opt.type && text) { const step = Math.max(1, Math.ceil(text.length / 60)); let i = 0; const tick = () => { i = Math.min(text.length, i + step); tn.nodeValue = text.slice(0, i); log.scrollTop = log.scrollHeight; if (i < text.length) setTimeout(tick, 22); }; tick(); }
    return el;
  }
  const typing = (mood) => bubble('bot', '', { dots: true, mood });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function exampleBlock(casual) {
    const pool = (casual ? exCasual : exStock).slice(); if (!pool.length) return '';
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return '\n\n[말투 참고용 대화 예시 — 이런 말투·길이·표정 태그를 따라 하되 문장을 그대로 베끼지 말고, ○ 자리는 실제 자료의 숫자로 채운다]\n' + pool.slice(0, casual ? 8 : 3).map((e) => '사용자: ' + e.u + '\n레이코: ' + e.a).join('\n');
  }
  async function askAI(q, casual) {
    const ac = new AbortController(); const tm = setTimeout(() => ac.abort(), 50000);
    const r = await fetch(chatApi, { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q, mode: casual ? 'casual' : 'stock', persona: (casual ? persona + bondNote() : personaStock + watchNote()) + MOOD_RULE, context: (casual ? casualContext() : aiContext(q)) + exampleBlock(casual), history: hist.slice(casual ? -12 : -6) }) }).finally(() => clearTimeout(tm));
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.answer) throw new Error(j.error || ('HTTP ' + r.status));
    return String(j.answer).trim();
  }
  const ask = async (q) => {
    q = String(q || '').trim(); if (!q) return;
    bubble('me', q); bondUp();
    const lines = answer(q), links = linksFor(q);
    let text = lines.join('\n'), ai = false, note = '', mood = meta.mood || (meta.casual ? 'casual' : 'stock');
    if (!meta.ok && chatApi) {
      setMood(meta.casual ? 'casual' : 'stock');
      const w = typing(meta.casual ? 'casual' : 'stock');
      try {
        text = await askAI(q, meta.casual); ai = true;
        const tag = text.match(/^\s*\[\s*표정\s*[:：]\s*([^\]\s]+)\s*\]\s*/); mood = meta.casual ? 'casual' : 'stock';
        if (tag) { text = text.slice(tag[0].length); if (MOOD_KO[tag[1]]) mood = MOOD_KO[tag[1]]; }
        text = text.replace(/\[\s*표정\s*[:：][^\]]*\]\s*/g, '');
        if (!meta.casual && personaStock.includes('선생님') && !/^선생님/.test(text)) text = '선생님, ' + text;
        note = meta.casual ? '' : 'AI 답변은 틀릴 수 있어요. 투자 판단은 본인 몫이에요.';
      } catch (e) { if (meta.casual) { text = '지, 지금은 업무가 밀려서요…! 조금 있다가 다시 말 걸어 주세요. …기다리고 있을게요.'; mood = 'embarrassed'; } note = /limit|429|quota/i.test(String(e.message)) ? '오늘 AI 사용 한도가 끝났어요.' : 'AI 연결이 안 됐어요.'; }
      w.remove();
    } else { const w = typing(mood); await sleep(450); w.remove(); }
    setMood(mood);
    bubble('bot', text, { ai: ai && !meta.casual, links: meta.casual ? [] : links, note, mood, type: true, spark: !meta.casual && meta.stock ? meta.stock.c : null });
    hist.push({ role: 'user', text: q }, { role: 'model', text: text.slice(0, 600), mood }); while (hist.length > 24) hist.shift(); saveHist();
  };
  window.__vtbAsk = ask;
  const bondEl = root.querySelector('[data-a="bond"]');
  paintBond = () => { const lv = bondLv(); bondEl.textContent = '♥'.repeat(lv + 1) + '♡'.repeat(3 - lv); bondEl.title = '친밀도 ' + lv + '/3 (대화 ' + bondN() + '번)'; };
  paintBond();
  function greeting() {
    const now = new Date(Date.now() + 9 * 3600e3), hr = now.getUTCHours(), dow = now.getUTCDay(), lv = bondLv();
    const nd = rowsOf('nikkei_daily').slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const a = nd[nd.length - 1], b = nd[nd.length - 2];
    const ch = a && b ? (+a.close / +b.close - 1) * 100 : 0;
    const lines = []; let mood = 'stock';
    const hi = hr < 11 ? '좋은 아침이에요' : hr < 18 ? '안녕하세요' : '오늘도 수고 많으셨어요';
    if (dow === 0 || dow === 6) { mood = 'casual'; lines.push(['주말에도 차트 보세요? …뭐, 저도 마침 대기 중이었지만요.', '주말인데 또 오셨네요. 쉬, 쉬는 것도 업무예요!', '주말에도 와 주셨네요. …딱히 기다린 건 아니에요.', '주말에도 와 주셔서 …조금 기뻐요.'][lv]); }
    else if (hr >= 23 || hr < 6) { mood = 'worried'; lines.push('이 시간까지 안 주무세요? 잠깐만 보고 쉬세요. 걱정돼서 하는 말이에요.'); }
    else lines.push('선생님, ' + hi + '.');
    if (a && b) {
      const s = 'm/d'.replace('m', +String(a.date).slice(5, 7)).replace('d', +String(a.date).slice(8, 10));
      if (ch >= 1.5) { if (mood === 'stock') mood = 'proud'; lines.push(s + ' 닛케이는 ' + (+a.close).toLocaleString('ko-KR', { maximumFractionDigits: 0 }) + '엔, +' + ch.toFixed(1) + '%로 크게 올랐어요.'); }
      else if (ch <= -1.5) { mood = 'worried'; lines.push(s + ' 닛케이는 ' + ch.toFixed(1) + '%로 많이 내렸어요. …오늘은 좀 힘든 날이었죠.'); }
      else lines.push(s + ' 닛케이는 ' + (ch >= 0 ? '+' : '') + ch.toFixed(1) + '%로 마감했어요.');
    }
    const W = watchStocks();
    if (W.length) { const t = W.slice().sort((x, y) => Math.abs(y.d1) - Math.abs(x.d1))[0]; lines.push('관심 종목 중에선 ' + t.name + '가 ' + (t.d1 >= 0 ? '+' : '') + t.d1.toFixed(1) + '%로 제일 많이 움직였어요.'); if (Math.abs(t.d1) >= 5) mood = 'surprised'; }
    return { text: lines.join(' '), mood, suggest: W.length ? ['내 관심 종목 어때?', '오늘 제일 오른 종목'] : ['오늘 제일 오른 종목', '관심 종목 정하는 법'] };
  }
  let greeted = false;
  async function greet() {
    if (greeted) return; greeted = true;
    for (let i = 0; i < 20 && !rowsOf('nikkei_daily').length; i++) await sleep(250);
    const g = greeting(); setMood(g.mood);
    const w = typing(g.mood); await sleep(700); w.remove();
    bubble('bot', g.text, { mood: g.mood, type: true, suggest: g.suggest.map((x) => x === '관심 종목 정하는 법' ? '관심 종목은 소니, IHI야' : x) });
  }
  /* 탭을 열면 한마디 (탭마다 하루 한 번) */
  const TAB_TALK = { dividends: ['배당 보세요? 배당수익률 높은 종목부터 정리해 드릴까요?', '배당 높은 종목'], targets: ['목표주가는 애널리스트 의견이라 참고용이에요. 여유가 큰 종목 볼까요?', '목표주가 여유 큰 종목'],
    investors: ['외국인이 사는지 파는지 궁금하시죠?', '외국인 수급'], calendar: ['다가오는 일정 짚어 드릴까요?', '이번 주 일정'], credit: ['공매도 비율도 같이 볼까요?', '공매도'],
    ust: ['미국 금리가 일본 증시에도 영향이 커요. 요약해 드릴까요?', '미국 금리'], news: ['오늘 시장 뉴스 제목만 빠르게 읽어 드릴까요?', '오늘 시장 뉴스'], reports: ['오늘 시장은 ▶ 브리핑으로 들으셔도 돼요. 아니면 요약해 드릴까요?', '오늘 시장 어땠어'] };
  const TKEY = 'vtb-tabseen-v1';
  let balloon = null;
  function showBalloon(text, q, mood) {
    if (balloon) balloon.remove();
    balloon = document.createElement('div'); balloon.className = 'vtb-balloon';
    balloon.innerHTML = '<img src="' + (AV[mood] || AV.stock) + '" alt="">'; const sp = document.createElement('span'); const nm = document.createElement('b'); nm.textContent = NAME; sp.append(nm, document.createTextNode(text)); balloon.append(sp);
    balloon.onclick = () => { balloon.remove(); balloon = null; fab.click(); if (q) setTimeout(() => ask(q), 300); };
    root.append(balloon); const me = balloon; setTimeout(() => { if (balloon === me) { me.remove(); balloon = null; } }, 12000);
  }
  document.querySelectorAll('.sj .sj-tab').forEach((t) => t.addEventListener('click', () => {
    const id = t.dataset.go, tk = TAB_TALK[id]; if (!tk || !pc()) return;
    const today0 = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    let seen = {}; try { seen = JSON.parse(localStorage.getItem(TKEY) || '{}'); } catch (e) {}
    if (seen[id] === today0) return; seen[id] = today0; try { localStorage.setItem(TKEY, JSON.stringify(seen)); } catch (e) {}
    if (!box.hidden) { setMood('stock'); bubble('bot', tk[0], { mood: 'stock', type: true, suggest: [tk[1]] }); }
    else showBalloon(tk[0], tk[1]);
  }));
  if (hist.length) { hist.slice(-10).forEach((h) => bubble(h.role === 'user' ? 'me' : 'bot', h.text, { mood: h.mood })); }
  const clr = document.createElement('button'); clr.type = 'button'; clr.textContent = '대화 지우기';
  clr.onclick = () => { hist = []; saveHist(); log.replaceChildren(); setMood('stock'); };
  root.querySelector('.vtb-chips').append(clr);
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
  /* ---------- 혼잣말 (몇 분마다, 무료·미리 써 둔 대사: data/reiko_lines.json 100개 + 상황 대사) ---------- */
  let soloBank = []; const soloUsed = new Set();
  fetch('data/reiko_lines.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((d) => { soloBank = d && Array.isArray(d.lines) ? d.lines.filter((x) => x && x.text) : []; }).catch(() => {});
  function soloLine() {
    const now = new Date(Date.now() + 9 * 3600e3), hr = now.getUTCHours(), dow = now.getUTCDay(), lv = bondLv();
    const S = snap(), up = S.list.slice().sort((a, b) => b.d1 - a.d1)[0], dn = S.list.slice().sort((a, b) => a.d1 - b.d1)[0];
    const W = watchStocks(), w = W.length ? W[Math.floor(Math.random() * W.length)] : null;
    const dyn = [
      up ? ['surprised', '어머, ' + up.name + ' ' + (up.d1 >= 0 ? '+' : '') + up.d1.toFixed(1) + '%… 오늘 제일 신났네요.'] : null,
      dn && dn.d1 < -2 ? ['worried', dn.name + '는 ' + dn.d1.toFixed(1) + '%… 괜히 제가 다 신경 쓰이네요.'] : null,
      w ? ['proud', '선생님 관심 종목 ' + w.name + ', 오늘 ' + (w.d1 >= 0 ? '+' : '') + w.d1.toFixed(1) + '%. …따, 딱히 계속 지켜본 건 아니에요.'] : null,
      hr < 9 ? ['casual', '아침부터 부지런하시네요. 저보다 먼저 출근하시면 곤란한데요.'] : null,
      hr >= 12 && hr < 14 ? ['worried', '점심은 드셨어요? 굶으면서 차트 보는 건 비효율이에요.'] : null,
      hr >= 15 && hr < 16 ? ['casual', '도쿄 장 마감 시간이네요. 오늘 하루도 수고했어요, 시장도… 선생님도.'] : null,
      hr >= 22 || hr < 5 ? ['worried', '벌써 이 시간… 내일 장은 내일 봐도 돼요. 얼른 주무세요.'] : null,
      dow === 0 || dow === 6 ? ['casual', '주말엔 장도 쉬는데… 선생님도 좀 쉬셨으면.'] : null,
      lv >= 2 ? ['embarrassed', '요즘 선생님이랑 얘기하는 시간이… 조금, 아주 조금 기다려져요.'] : null,
      lv >= 3 ? ['stock', '오늘도 와 주셔서 고마워요. …이번만 솔직하게 말한 거예요.'] : null,
    ].filter((x) => x && !soloUsed.has(x[1]));
    if (dyn.length && (!soloBank.length || Math.random() < 0.3)) { const x = dyn[Math.floor(Math.random() * dyn.length)]; soloUsed.add(x[1]); return x; }
    if (!soloBank.length) return ['casual', '…오늘도 별일 없이 지나가면 좋겠어요.'];
    let bag = []; try { bag = JSON.parse(localStorage.getItem('vtb-solo-bag') || '[]'); } catch (e) {}
    bag = bag.filter((i) => i < soloBank.length);
    if (!bag.length) { bag = soloBank.map((_, i) => i); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; } }
    const k = bag.pop(); try { localStorage.setItem('vtb-solo-bag', JSON.stringify(bag)); } catch (e) {}
    return [soloBank[k].mood, soloBank[k].text];
  }
  let lastAct = Date.now(), soloCount = 0, soloTimer = null;
  root.addEventListener('pointerdown', () => { lastAct = Date.now(); });
  qi.addEventListener('input', () => { lastAct = Date.now(); });
  /* 안 읽은 혼잣말: 버튼 배지 + 탭 제목 (1) + 돌아오면 말풍선 */
  const unread = []; const baseTitle = document.title;
  const paintUnread = () => {
    let bd = fab.querySelector('.badge'); if (!bd) { bd = document.createElement('span'); bd.className = 'badge'; fab.append(bd); }
    bd.textContent = unread.length; bd.hidden = !unread.length;
    document.title = unread.length ? '(' + unread.length + ') ' + baseTitle : baseTitle;
  };
  function deliverSolo(mood, text) {
    if (!box.hidden && !document.hidden) { setMood(mood); bubble('bot', text, { mood, type: true, solo: true }); return; }
    unread.push([mood, text]); while (unread.length > 9) unread.shift(); paintUnread();
    if (!document.hidden) showBalloon(text, null, mood);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !unread.length) return;
    const [mood, text] = unread[unread.length - 1];
    setTimeout(() => { if (box.hidden) showBalloon(text, null, mood); else flushUnread(); }, 1200);
  });
  function flushUnread() { if (!unread.length) return; unread.splice(0).forEach(([mood, text]) => { setMood(mood); bubble('bot', text, { mood, solo: true }); }); paintUnread(); }
  function soloTick() {
    soloTimer = setTimeout(soloTick, (4 + Math.random() * 4) * 60e3);
    if (!pc() || soloCount >= 10 || Date.now() - lastAct < 90e3 || root.classList.contains('talking')) return;
    if (document.hidden && unread.length >= 3) return;
    const [mood, text] = soloLine(); soloCount++;
    deliverSolo(mood, text);
  }
  soloTimer = setTimeout(soloTick, (2 + Math.random() * 2) * 60e3);
  window.__vtbSolo = () => { lastAct = 0; soloCount = 0; clearTimeout(soloTimer); soloTick(); };
  fab.onclick = () => { fab.hidden = true; box.hidden = false; if (balloon) { balloon.remove(); balloon = null; } greet().then(flushUnread); };
  root.querySelector('.vtb-x').onclick = (e) => { e.stopPropagation(); stopAudio(); if (synth) synth.cancel(); setTalk(false); box.hidden = true; fab.hidden = false; };
})();

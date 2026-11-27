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
    const iv = rowsOf('investor_flows').slice().sort((a, b) => String(a.week_end).localeCompare(String(b.week_end))).pop();
    if (iv) { const v = Math.round(+iv.for_net); out.push('수급을 보면, 가장 최근 집계 주에 외국인은 ' + Math.abs(v).toLocaleString('ko-KR') + '억 엔을 순' + (v >= 0 ? '매수' : '매도') + '했어요.'); }
    const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
    const cal = rowsOf('calendar').filter((r) => String(r.date).slice(0, 10) >= today && /금리|미국 지표|실적/.test(r.kind)).slice(0, 3);
    if (cal.length) out.push('앞으로 일정은 ' + cal.map((r) => md(String(r.date).slice(0, 10)) + ' ' + say(String(r.title).replace(/\s*\([^)]*\)/g, ''))).join(', ') + ' 입니다.');
    out.push('투자 판단은 언제나 본인 몫이에요. 오늘도 수고 많으셨어요!');
    return out.filter(Boolean);
  }

  window.__vtbScript = script;
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
  .vtb-x{position:absolute;top:8px;right:8px;z-index:2;border:0;background:rgba(0,0,0,.35);color:#fff;border-radius:999px;width:26px;height:26px;cursor:pointer}`;
  document.head.append(css);
  const root = document.createElement('div'); root.className = 'vtb';
  root.innerHTML = `<button class="vtb-fab" type="button">🎙 AI 브리핑</button>
  <div class="vtb-box" hidden>
    <div class="vtb-stage"><button class="vtb-x" type="button" aria-label="접기">✕</button><div class="vtb-fallback"><img src="../img/title-cat.jpg" alt="브리핑 캐릭터"></div></div>
    <div class="vtb-sub">▶ 를 누르면 오늘 시장을 브리핑해 드려요.</div>
    <div class="vtb-bar"><button class="main" type="button" data-a="play">▶ 브리핑</button><button type="button" data-a="pause">⏸</button><button type="button" data-a="stop">■</button>
      <select data-a="rate" aria-label="말 빠르기"><option value="0.9">느리게</option><option value="1.05" selected>보통</option><option value="1.25">빠르게</option></select>
      <select data-a="voice" aria-label="목소리"></select></div>
    <div class="vtb-note">기본 목소리 SunHi(엣지 브라우저에서 사용 가능, 크롬은 Google 음성) · 캐릭터 Live2D 샘플 모델(Live2D Inc.)</div>
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
    vsel.replaceChildren(...(voices.length ? voices.map((v, i) => new Option(v.name.replace(/Microsoft |\(.*?\)| - Korean.*$/g, '').trim() || v.name, i)) : [new Option('한국어 음성 없음', '')]));
    try { const s = localStorage.getItem('vtb-voice2'); if (s && voices.some((v) => v.name === s)) vsel.value = String(voices.findIndex((v) => v.name === s)); } catch (e) {}
  };
  if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }
  vsel.onchange = () => { try { localStorage.setItem('vtb-voice2', voices[+vsel.value].name); } catch (e) {} };

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
      model.internalModel.on('beforeModelUpdate', () => { t += 0.35; const v = talking ? Math.max(0, Math.sin(t) * 0.6 + Math.sin(t * 2.3) * 0.35 + 0.2) : 0; model.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', Math.min(1, v)); });
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
    if (voices[+vsel.value]) u.voice = voices[+vsel.value];
    u.onstart = () => setTalk(true);
    u.onend = () => { setTalk(false); idx++; setTimeout(speakNext, 180); };
    u.onerror = () => { setTalk(false); };
    synth.speak(u);
  }
  root.querySelector('[data-a="play"]').onclick = () => {
    if (synth && synth.paused) { synth.resume(); setTalk(true); return; }
    if (synth) synth.cancel(); queue = script(); idx = 0; speakNext();
    try { model && model.motion('Idle'); } catch (e) {}
  };
  root.querySelector('[data-a="pause"]').onclick = () => { if (synth && synth.speaking) { synth.pause(); setTalk(false); } };
  root.querySelector('[data-a="stop"]').onclick = () => { if (synth) synth.cancel(); queue = []; setTalk(false); sub.textContent = '▶ 를 누르면 오늘 시장을 브리핑해 드려요.'; };
  fab.onclick = () => { fab.hidden = true; box.hidden = false; initModel(); };
  root.querySelector('.vtb-x').onclick = (e) => { e.stopPropagation(); if (synth) synth.cancel(); setTalk(false); box.hidden = true; fab.hidden = false; };
})();

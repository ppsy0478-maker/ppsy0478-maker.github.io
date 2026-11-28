"""매일 브리핑 대본 만들기 (dashboard/data/*.csv → 문장 목록).
숫자·기호를 한국어 읽는 말로 바꿔서 TTS가 자연스럽게 읽게 한다. 표준 라이브러리만 사용."""
import csv, json, re, sys, datetime as dt
from pathlib import Path

D = Path(__file__).resolve().parent.parent / 'dashboard' / 'data'

def rows(name):
    p = D / f'{name}.csv'
    return list(csv.DictReader(open(p, encoding='utf-8'))) if p.exists() else []

DIG = '영일이삼사오육칠팔구'
def _under10000(n):
    out = ''
    for unit, v in (('천', 1000), ('백', 100), ('십', 10)):
        q, n = divmod(n, v)
        if q: out += ('' if q == 1 else DIG[q]) + unit
    if n: out += DIG[n]
    return out
def num_ko(n):
    n = int(n)
    if n == 0: return '영'
    parts = []
    for unit, v in (('조', 10**12), ('억', 10**8), ('만', 10**4)):
        q, n = divmod(n, v)
        if q: parts.append(('' if (q == 1 and unit == '만') else _under10000(q)) + unit)
    if n: parts.append(_under10000(n))
    return ' '.join(parts)
def read_number(s):
    s = s.replace(',', '')
    if '.' in s:
        a, b = s.split('.', 1)
        return num_ko(int(a or 0)) + ' 점 ' + ''.join(DIG[int(c)] for c in b)
    return num_ko(int(s))

NAT = {1: '한', 2: '두', 3: '세', 4: '네', 5: '다섯', 6: '여섯', 7: '일곱', 8: '여덟', 9: '아홉', 10: '열', 11: '열한', 12: '열두'}
SPOKEN = True
def speak(text):
    if not SPOKEN:
        t = re.sub(r'\s*¶\s*', ' ', str(text or '')); t = re.sub(r'\s*\([^()]*\)', '', t); return re.sub(r'\s+', ' ', t).strip()
    t = str(text or '')
    t = re.sub(r'\s*¶\s*', ' ', t)
    t = re.sub(r'\s*\([^()]*\)', '', t)            # 괄호 속 보충 설명은 읽지 않음
    t = t.replace('·', ', ').replace('~', '에서 ').replace('→', '에서 ')
    t = t.replace('닛케이225', '닛케이 이백이십오').replace('TOWA', '토와').replace('AD플라즈마', '에이디플라즈마')
    t = re.sub(r'(\d{1,2})\.(\d{1,2})\(([월화수목금토일])\)', lambda m: f'{month_ko(m[1])} {num_ko(m[2])}일', t)
    t = re.sub(r'(\d{1,2})월', lambda m: month_ko(m[1]), t)
    t = re.sub(r'(\d{1,2})시\s*(\d{1,2})분', lambda m: NAT.get(int(m[1]), num_ko(m[1])) + ' 시 ' + num_ko(m[2]) + ' 분', t)
    t = re.sub(r'(\d{1,2})시(?!간)', lambda m: NAT.get(int(m[1]), num_ko(m[1])) + ' 시', t)
    t = re.sub(r'[+＋](?=\d)', '플러스 ', t)
    t = re.sub(r'[−–](?=\d)', '마이너스 ', t)
    t = re.sub(r'(?<![\w.])-(?=\d)', '마이너스 ', t)
    t = re.sub(r'(\d[\d,]*(?:\.\d+)?)\s*%p', lambda m: read_number(m[1]) + ' 퍼센트포인트', t)
    t = re.sub(r'(\d[\d,]*(?:\.\d+)?)\s*%', lambda m: read_number(m[1]) + ' 퍼센트', t)
    t = re.sub(r'(\d[\d,]*(?:\.\d+)?)\s*배', lambda m: read_number(m[1]) + ' 배', t)
    t = re.sub(r'(\d[\d,]*(?:\.\d+)?)\s*엔', lambda m: read_number(m[1]) + ' 엔', t)
    t = re.sub(r'(\d{1,2})\s*종(?!목)', lambda m: NAT.get(int(m[1]), num_ko(m[1])) + ' 종', t)
    t = re.sub(r'(\d[\d,]*)\s*(종목|거래일|주|건|명|곳|개)', lambda m: read_number(m[1]) + ' ' + m[2], t)
    t = re.sub(r'(?<![A-Za-z])\d[\d,]*(?:\.\d+)?', lambda m: read_number(m[0]), t)
    t = re.sub(r'\bAI\b', '에이아이', t).replace('TOPIX', '토픽스').replace('SSD', '에스에스디').replace('EUV', '이유브이').replace('NT배율', '엔티배율').replace('PER', '피이알').replace('FOMC', '에프오엠씨')
    t = t.replace('CPI', '씨피아이').replace('DAX', '닥스').replace('FTSE', '풋시').replace('IHI', '아이에이치아이').replace('JT', '제이티').replace('ENEOS', '에네오스').replace('MUFG', '엠유에프지')
    t = re.sub(r'\s+', ' ', t).strip()
    return t

MONTH = {6: '유월', 10: '시월'}
def month_ko(m): return MONTH.get(int(m), num_ko(m) + '월')
def md(d):
    if not SPOKEN: return f'{int(d[5:7])}월 {int(d[8:10])}일'
    return f'{month_ko(d[5:7])} {num_ko(d[8:10])}일'

def build_both():
    global SPOKEN
    SPOKEN = False; d, disp = build()
    SPOKEN = True; _, sp = build()
    return d, disp, sp

TYPE_RANK = {'실적': 0, 'M&A': 1, '애널리스트': 2, '업황': 3, '제휴': 4, '신제품': 5, '수급': 6, '정책': 7}

def stock_news(d, limit=5):
    """그날 62종목 뉴스 중 중요한 것 limit건 (같은 기사로 묶인 종목은 한 줄로)."""
    pr = rows('prices')
    dates = sorted({r['date'] for r in pr})
    name = {r['code']: re.sub(r'\(.*?\)|㈜', '', r['name']) for r in pr}
    chg = {}
    if d in dates and dates.index(d) > 0:
        prev = dates[dates.index(d) - 1]
        p0 = {r['code']: float(r['price']) for r in pr if r['date'] == prev and r['price']}
        for r in pr:
            if r['date'] == d and r['price'] and p0.get(r['code']):
                chg[r['code']] = (float(r['price']) / p0[r['code']] - 1) * 100
    news = [r for r in rows('news') if r['date'][:10] == d and r['sentiment'] != '중립' and r['type'] in TYPE_RANK]
    groups = {}
    for r in news:
        m = re.search(r'b=(\w+)', r['url'])
        key = m[1] if m else r['code'] + r['headline']
        groups.setdefault(key, []).append(r)
    ranked = sorted(groups.values(), key=lambda g: (-(len({r['code'] for r in g}) * 10 + max(abs(chg.get(r['code'], 0)) for r in g)), TYPE_RANK[g[0]['type']], g[0]['datetime']))
    out, used = [], set()
    for g in ranked:
        codes = [c for c in dict.fromkeys(r['code'] for r in g) if c not in used]
        if not codes: continue
        used.update(codes)
        hs = [r['headline'] for r in g]
        multi = [h for h in hs if re.search(r'동반|일제|\d사', h)]
        head = min(multi if len(codes) > 1 and multi else hs, key=len)
        moves = [name.get(c, c) + (' ' + f'{chg[c]:+.1f}'.replace('.0', '') + '%' if c in chg else '') for c in codes]
        line = f"{', '.join(moves)}. {head.replace(' + ', ', ')}."
        out.append(speak(line) if SPOKEN else line)
        if len(out) >= limit: break
    return out

def build():
    reps = sorted(rows('market_reports'), key=lambda r: r['date'])
    if not reps: return None, []
    rep = reps[-1]; d = rep['date'][:10]
    out = [f'안녕하세요! {md(d)} 닛케이 브리핑을 시작할게요.']
    for s in re.split(r'(?<=다\.)\s*', rep.get('lede', '')):
        if s.strip(): out.append(speak(s))
    up = re.split(r',\s*(?![^()]*\))', rep.get('up', ''))[:3]
    dn = re.split(r',\s*(?![^()]*\))', re.split(r'\s*/\s*', rep.get('down', ''))[0])[:3]
    if any(up): out.append('강했던 쪽은 ' + speak(', '.join(up)) + ' 입니다.')
    if any(dn): out.append('약했던 쪽은 ' + speak(', '.join(dn)) + ' 였어요.')
    mn = [r for r in rows('market_news') if r['date'][:10] == d]
    pick = [r for r in mn if r['cat'] == '특징주'][:2] + [r for r in mn if r['cat'] == '전망'][-1:]
    if pick:
        out.append('오늘의 시장 특징 뉴스예요.')
        for r in pick:
            first = re.split(r'(?<=다\.)\s*', r.get('summary', ''))[0]
            out.append(speak(r['title']) + '. ' + speak(first))
    stock = stock_news(d)
    if stock:
        out.append('이어서 오늘의 종목 뉴스입니다.')
        out += stock
    iv = sorted(rows('investor_flows'), key=lambda r: r['week_end'])
    if iv:
        v = round(float(iv[-1]['for_net']))
        out.append(f'수급을 보면, 가장 최근 집계 주에 외국인은 {num_ko(abs(v)) if SPOKEN else format(abs(v), ",")}억 엔을 순{"매수" if v >= 0 else "매도"}했어요.')
    today = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=9)).date().isoformat()
    cal = [r for r in rows('calendar') if r['date'][:10] >= max(today, d) and re.search('금리|미국 지표|실적', r['kind'])][:3]
    if cal:
        out.append('앞으로 일정은 ' + ', '.join(md(r['date'][:10]) + ' ' + speak(r['title']) for r in cal) + ' 입니다.')
    out.append('투자 판단은 언제나 본인 몫이에요. 오늘도 수고 많으셨어요!')
    return d, [s for s in out if s]

if __name__ == '__main__':
    d, disp, lines = build_both()
    if '--print' in sys.argv:
        print(d); print('\n'.join(a + '\n   → ' + b for a, b in zip(disp, lines))); sys.exit()
    json.dump({'date': d, 'lines': lines}, open(sys.argv[1] if len(sys.argv) > 1 else '/dev/stdout', 'w', encoding='utf-8'), ensure_ascii=False)

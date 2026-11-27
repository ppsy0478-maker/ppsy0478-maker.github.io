"""장중 시세: 야후재팬에서 62종목 현재가와 닛케이225를 받아 dashboard/data/live.json 에 쓴다.
GitHub Actions(.github/workflows/live.yml)가 장중 30분마다 실행한다. 외부 패키지 없이 표준 라이브러리만 쓴다."""
import csv, json, re, time, urllib.request, concurrent.futures as cf
from datetime import datetime, timezone, timedelta

ROOT = __file__.rsplit('/scripts/', 1)[0]
DATA = ROOT + '/dashboard/data'
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept-Language': 'ja,en;q=0.8'}
num = lambda s: float(s.replace(',', '')) if s not in (None, '', '---') else None

def get(path):
    for k in range(3):
        try:
            req = urllib.request.Request('https://finance.yahoo.co.jp' + path, headers=UA)
            return urllib.request.urlopen(req, timeout=20).read().decode('utf-8', 'replace').replace('\\"', '"')
        except Exception:
            time.sleep(2 + k * 3)
    return ''

def stock(code):
    t = get(f'/quote/{code}.T')
    i = t.find('"priceBoard":{')
    if i < 0: return None
    b = t[i:i + 3000]
    m = lambda pat: (re.search(pat, b) or [None, None])[1]
    prev = re.search(r'"name":"前日終値","value":"([\d,.]+)"[^}]*?"updateDateMeta":"([\d-]+)"', t)
    return {'code': code, 'price': num(m(r'"price":\{"value":"([\d,.]+)"')), 'chg': num(m(r'"priceChange":\{"value":"(-?[\d,.]+)"')),
            'chg_pct': num(m(r'"priceChangeRate":\{"value":"(-?[\d,.]+)"')), 'time': m(r'"japanUpdateTime":"([^"]*)"'),
            'prev': num(prev[1]) if prev else None, 'prev_date': prev[2] if prev else None}

def nikkei():
    t = get('/quote/998407.O')
    i = t.find('"priceBoard":{'); b = t[i:i + 1500]
    v = re.search(r'"price":\{"changePrice":"(-?[\d,.]+)","changePriceRate":"(-?[\d,.]+)","move":"[a-z]*","updateDate":"([^"]*)","value":"([\d,.]+)"', b)
    p = re.search(r'"name":"前日終値","value":"([\d,.]+)"', t)
    if not v: return None
    return {'price': num(v[4]), 'chg': num(v[1]), 'chg_pct': num(v[2]), 'time': v[3], 'prev': num(p[1]) if p else None}

def main():
    prices = list(csv.DictReader(open(DATA + '/prices.csv', encoding='utf-8')))
    last = {}
    for r in prices:
        if r['code'] not in last or r['date'] > last[r['code']]['date']: last[r['code']] = r
    codes = list(last)
    with cf.ThreadPoolExecutor(6) as ex: qs = [q for q in ex.map(stock, codes) if q and q['price']]
    nk = nikkei()
    idx = sorted(csv.DictReader(open(DATA + '/index.csv', encoding='utf-8')), key=lambda r: r['date'])[-1]
    # 62종목 지수 장중 추정: 전일(=index.csv 마지막 행) 종가 대비 비율
    base = {r['code']: float(r['price']) for r in last.values()}
    mc = {r['code']: float(r['mcap_mil_yen']) for r in last.values()}
    ok = [q for q in qs if q['code'] in base]
    sp = sum(q['price'] for q in ok); sb = sum(base[q['code']] for q in ok)
    sm = sum(mc[q['code']] * q['price'] / base[q['code']] for q in ok); smb = sum(mc[q['code']] for q in ok)
    for q in qs:
        q['name'] = last[q['code']]['name']; q['sector'] = last[q['code']]['sector']
        b = base.get(q['code']); q['vs_base_pct'] = round((q['price'] / b - 1) * 100, 2) if b else None
    out = {'updated_utc': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
           'updated_jst': datetime.now(timezone(timedelta(hours=9))).strftime('%Y-%m-%d %H:%M'),
           'base_date': idx['date'], 'n': len(qs), 'nikkei': nk,
           'ns': round(float(idx['nikkei_style']) * sp / sb, 2) if sb else None,
           'tp': round(float(idx['topix_style']) * sm / smb, 2) if smb else None,
           'ns_pct': round((sp / sb - 1) * 100, 2) if sb else None, 'tp_pct': round((sm / smb - 1) * 100, 2) if smb else None,
           'up': sum(1 for q in ok if q['price'] > base[q['code']]), 'down': sum(1 for q in ok if q['price'] < base[q['code']]),
           'quotes': sorted(qs, key=lambda q: -(q['vs_base_pct'] or 0))}
    json.dump(out, open(DATA + '/live.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    # 장중 추이 누적: live_hist.json = 최근 5거래일, 날짜별 30분 간격 점들
    hp = DATA + '/live_hist.json'
    try: H = json.load(open(hp, encoding='utf-8'))
    except Exception: H = []
    now = datetime.now(timezone(timedelta(hours=9)))
    day = now.strftime('%Y-%m-%d'); hm = now.strftime('%H:%M')
    pt = {'t': hm, 'nk': nk and nk['price'], 'nk_pct': nk and nk['chg_pct'], 'ns_pct': out['ns_pct'], 'tp_pct': out['tp_pct'],
          'p': {q['code']: q['price'] for q in qs}}
    # 장이 안 열린 날(값이 전일과 같고 시각이 오늘 장중이 아님)은 쌓지 않음
    live_today = any(q.get('time') and ':' in q['time'] for q in qs) and now.weekday() < 5 and '08:55' <= hm <= '16:30'
    if live_today and not all(q['price'] == base.get(q['code']) for q in ok):
        d = next((x for x in H if x['date'] == day), None)
        if not d: d = {'date': day, 'base_date': idx['date'], 'base': base, 'nk_prev': nk and nk['prev'], 'points': []}; H.append(d)
        if not d['points'] or d['points'][-1]['t'] != hm: d['points'].append(pt)
        H = sorted(H, key=lambda x: x['date'])[-5:]
        json.dump(H, open(hp, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('ok', out['updated_jst'], out['n'], nk and nk['price'], out['ns_pct'])

if __name__ == '__main__': main()

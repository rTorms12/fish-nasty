#!/usr/bin/env python3
"""Build data/rankings.json — the Top 20 lakes for big fish and lots of fish
(walleye, northern pike, crappie) from Minnesota DNR LakeFinder survey data.

Run:  python3 tools/build_rankings.py           (full refresh, about 3-5 minutes)
      python3 tools/build_rankings.py --resume  (continue an interrupted run)
      python3 tools/build_rankings.py --quick   (no fetching: re-rank from the last run's cache)

The raw survey JSON is not kept; per-lake metrics are written to tools/cache/metrics.jsonl while the
run progresses. A normal run starts from scratch so new DNR surveys are picked up.
"""
import json, os, sys, time, urllib.request, urllib.parse, threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(ROOT, 'tools', 'cache')
CACHE = os.path.join(CACHE_DIR, 'metrics.jsonl')
OUT = os.path.join(ROOT, 'data', 'rankings.json')
SEARCH = 'https://maps.dnr.state.mn.us/cgi-bin/lakefinder/search.cgi?context=desktop&name=&county='
DETAIL = 'https://maps.dnr.state.mn.us/cgi-bin/lakefinder/detail.cgi?type=lake_survey&id='
WORKERS = 6
MIN_YEAR = date.today().year - 12          # ignore surveys older than this
QUICK = '--quick' in sys.argv
RESUME = '--resume' in sys.argv or QUICK

SPECIES = {
    'WAE': {'name': 'Walleye',       'codes': ['WAE'],                      'big': 20, 'trophy': 25, 'minN': 40, 'gear': ['Standard gill nets', 'Standard gill net sets']},
    'NOP': {'name': 'Northern pike', 'codes': ['NOP', 'SIP'],               'big': 30, 'trophy': 36, 'minN': 25, 'gear': ['Standard gill nets', 'Standard gill net sets']},
    'BLC': {'name': 'Crappie',       'codes': ['BLC', 'WHC', 'CRP', 'HCR'], 'big': 11, 'trophy': 13, 'minN': 40, 'gear': ['Standard trap nets', 'Standard trap net sets', 'Standard gill nets']},
}
STANDARD_TYPES = ('Standard Survey', 'Population Assessment', 'Re-Survey', 'Large Lake Survey', 'Targeted Survey', 'Special Assessment', 'Initial Survey')

def get_json(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'FishNasty/1.0 (rankings build)'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.loads(r.read().decode('utf-8', 'replace'))
        except Exception as e:
            if i == tries - 1:
                raise
            time.sleep(1.5 * (i + 1))

def lake_list():
    lakes = {}
    for county in range(1, 88):
        try:
            d = get_json(SEARCH + str(county))
        except Exception as e:
            print(f'  county {county}: FAILED {e}', flush=True)
            continue
        for r in d.get('results') or []:
            res = r.get('resources') or {}
            if not res.get('lakeSurvey'):
                continue
            m = r.get('morphology') or {}
            pt = (r.get('point') or {}).get('epsg:4326') or [None, None]
            lakes[str(r['id'])] = {
                'id': str(r['id']), 'name': r['name'], 'county': r.get('county', ''), 'town': r.get('nearest_town', ''),
                'lat': pt[1], 'lon': pt[0], 'acres': float(m.get('area') or 0), 'maxDepth': float(m.get('max_depth') or 0),
            }
        print(f'  county {county}: {len(lakes)} lakes with surveys so far', flush=True)
    return lakes

def lake_metrics(lake):
    """Fetch the survey detail for one lake and reduce it to per-species size/quantity metrics."""
    d = get_json(DETAIL + lake['id'])
    if not d or d.get('status') != 'SUCCESS' or not d.get('result'):
        return {'id': lake['id'], 'newest': None, 'species': {}}
    surveys = sorted(d['result'].get('surveys') or [], key=lambda s: s.get('surveyDate', ''), reverse=True)
    newest = surveys[0]['surveyDate'] if surveys else None
    out = {'id': lake['id'], 'newest': newest, 'species': {}}
    for key, sp in SPECIES.items():
        # ---- size: aggregate lengths from the 2 most recent surveys (within MIN_YEAR) that measured this species
        counts, used, dates = {}, 0, []
        for s in surveys:
            yr = int((s.get('surveyDate') or '0000')[:4] or 0)
            if yr < MIN_YEAR or used >= 2:
                continue
            lengths = s.get('lengths') or {}
            got = False
            for code in sp['codes']:
                L = lengths.get(code)
                if L and L.get('fishCount'):
                    for inch, n in L['fishCount']:
                        try:
                            counts[int(inch)] = counts.get(int(inch), 0) + int(n)
                        except (TypeError, ValueError):
                            pass
                    got = True
            if got:
                used += 1; dates.append(s['surveyDate'][:4])
        n = sum(counts.values())
        size = None
        if n:
            nBig = sum(c for inch, c in counts.items() if inch >= sp['big'])
            nTrophy = sum(c for inch, c in counts.items() if inch >= sp['trophy'])
            size = {'n': n, 'max': max(counts), 'nBig': nBig, 'pctBig': round(100.0 * nBig / n, 1), 'nTrophy': nTrophy,
                    'pct15': None, 'years': sorted(set(dates))}
        # ---- quantity: most recent survey with a standard-gear catch summary for this species
        qty = None
        for s in surveys:
            yr = int((s.get('surveyDate') or '0000')[:4] or 0)
            if yr < MIN_YEAR:
                continue
            best = None
            for c in s.get('fishCatchSummaries') or []:
                if c.get('species') in sp['codes'] and c.get('gear') in sp['gear']:
                    rank = sp['gear'].index(c['gear'])
                    try:
                        cp = float(c.get('CPUE') or 0)
                    except ValueError:
                        cp = 0.0
                    cand = {'cpue': cp, 'gear': c['gear'], 'catch': int(c.get('totalCatch') or 0), 'nets': int(c.get('gearCount') or 0),
                            'normal': c.get('quartileCount') or '', 'avgLb': c.get('averageWeight') or '', 'year': s['surveyDate'][:4], 'rank': rank}
                    if best is None or cand['rank'] < best['rank'] or (cand['rank'] == best['rank'] and cand['cpue'] > best['cpue']):
                        best = cand
            if best:
                best.pop('rank', None); qty = best; break
        if size or qty:
            out['species'][key] = {'size': size, 'qty': qty}
    return out

def load_cache():
    cache = {}
    if os.path.exists(CACHE):
        with open(CACHE) as f:
            for line in f:
                try:
                    rec = json.loads(line); cache[rec['id']] = rec
                except Exception:
                    pass
    return cache

def main():
    os.makedirs(CACHE_DIR, exist_ok=True); os.makedirs(os.path.dirname(OUT), exist_ok=True)
    t0 = time.time()
    print('Listing lakes with DNR surveys by county…', flush=True)
    lakes = lake_list()
    print(f'{len(lakes)} lakes with surveys ({time.time() - t0:.0f}s)', flush=True)
    if not RESUME and os.path.exists(CACHE):
        os.remove(CACHE)  # fresh run: refetch everything so new surveys are included
    cache = load_cache()
    todo = [] if QUICK else [l for l in lakes.values() if l['id'] not in cache]
    print(f'{len(todo)} lakes to fetch, {len(cache)} cached', flush=True)
    lock = threading.Lock(); done = 0; failed = []
    with open(CACHE, 'a') as cf, ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = {ex.submit(lake_metrics, l): l for l in todo}
        for fut in as_completed(futs):
            l = futs[fut]
            try:
                rec = fut.result()
                with lock:
                    cache[rec['id']] = rec; cf.write(json.dumps(rec) + '\n'); cf.flush()
            except Exception as e:
                failed.append(l['id'])
            done += 1
            if done % 100 == 0 or done == len(todo):
                print(f'  {done}/{len(todo)} fetched, {len(failed)} failed, {time.time() - t0:.0f}s', flush=True)

    # ---------- rank ----------
    rankings = {'built': date.today().isoformat(), 'lakesScanned': len(lakes), 'lakesWithData': 0, 'minYear': MIN_YEAR,
                'species': {}}
    with_data = set()
    for key, sp in SPECIES.items():
        big, many = [], []
        for lid, rec in cache.items():
            lake = lakes.get(lid)
            if not lake or key not in rec.get('species', {}):
                continue
            with_data.add(lid)
            m = rec['species'][key]
            base = {'id': lid, 'name': lake['name'], 'county': lake['county'], 'acres': round(lake['acres']), 'lat': lake['lat'], 'lon': lake['lon']}
            s = m.get('size')
            if s and s['n'] >= sp['minN'] and lake['acres'] >= 50:
                big.append({**base, 'n': s['n'], 'max': s['max'], 'nBig': s['nBig'], 'pctBig': s['pctBig'], 'nTrophy': s['nTrophy'], 'years': s['years']})
            q = m.get('qty')
            if q and q['nets'] >= 2 and q['cpue'] > 0 and lake['acres'] >= 50:
                many.append({**base, **q})
        big.sort(key=lambda r: (-r['pctBig'], -r['max'], -r['n']))
        many.sort(key=lambda r: (-r['cpue'], -r['catch']))
        rankings['species'][key] = {
            'name': sp['name'], 'big': sp['big'], 'trophy': sp['trophy'], 'minN': sp['minN'],
            'gearNote': sp['gear'][0],
            'bigLakes': big[:20], 'manyLakes': many[:20],
            'eligibleBig': len(big), 'eligibleMany': len(many)
        }
    rankings['lakesWithData'] = len(with_data)
    with open(OUT, 'w') as f:
        json.dump(rankings, f, separators=(',', ':'))
    print(f'Wrote {OUT} ({os.path.getsize(OUT) // 1024} KB) in {time.time() - t0:.0f}s; failed lakes: {len(failed)}', flush=True)
    for key, r in rankings['species'].items():
        print(f"  {r['name']}: {r['eligibleBig']} lakes ranked for size, {r['eligibleMany']} for quantity")
        for i, l in enumerate(r['bigLakes'][:5], 1):
            print(f"    big #{i}: {l['name']} ({l['county']}) {l['pctBig']}% ≥{r['big']}\" max {l['max']}\" n={l['n']}")
        for i, l in enumerate(r['manyLakes'][:5], 1):
            print(f"    many #{i}: {l['name']} ({l['county']}) {l['cpue']} per net ({l['gear']}, {l['year']})")

if __name__ == '__main__':
    main()

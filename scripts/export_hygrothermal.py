"""Export the WUFI Pro wall-moisture study (ASHRAE 160) for the Wall moisture page.

Reads the frozen run register `_private/hygrothermal/register.csv`; `--refresh` first copies it
from `report.json` `hygrothermal_register`. Writes `site/data/hygrothermal.json` and
`site/downloads/wall-moisture-results.csv`. Mold index and moisture content are dimensionless,
so no unit conversion applies. Every count, peak and pass/fail is derived here from the register.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import io
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FROZEN = ROOT / '_private/hygrothermal/register.csv'
LIMIT = 3.0

WALLS = {
    'cedar': 'Cedar siding on a ventilated rainscreen',
    'stone_drawn': 'Stone as drawn (FE3): mortar directly on the ZIP-R',
    'stone_mat': 'Stone on a drainage mat (DELTA-DRY & LATH)',
}
WEATHER = {
    'nyc_cold_n': 'NYC cold year, north wall',
    'nyc_hot_ne': 'NYC hot year, northeast wall',
    'nyc_hot_n': 'NYC hot year, north wall',
    'nyc_hot_e': 'NYC hot year, east wall',
    'nyc_hot_se': 'NYC hot year, southeast wall',
    'prv_cold_n': 'Providence cold year, north wall',
}
SCENARIOS = {
    'base': 'As designed',
    'm309': 'More indoor moisture (3.09 lb/h)',
    'm125': 'Less indoor moisture (1.25 lb/h)',
    'dh60': 'Cooling also dehumidifies to 60% RH',
    'mu1': 'Wood fiber more vapor-open',
    'rho3': 'Wood fiber at 3.0 pcf',
    'foam03': 'ZIP-R foam at 0.3 perm',
    'osb': 'OSB in place of the plywood',
    'noleak': 'No rain leakage',
    'init90': 'Built wet',
    'lk01': 'Small leak into the ZIP-R (0.1% of rain)',
    'lk1': 'Larger leak into the ZIP-R (1% of rain)',
    'gran': 'Granite',
    'rue': 'Rüthen sandstone',
    'abs8': 'Dark stone',
    'ach05': 'Drainage gap with less airflow (0.5 ACH)',
    'ach5': 'Drainage gap vented top and bottom (5 ACH)',
    'zipwet1': 'Rain behind the mat, onto the ZIP-R (gap 1 ACH)',
    'zipwet5': 'Rain behind the mat, onto the ZIP-R (gap 5 ACH)',
    'zipwet10': 'Rain behind the mat, onto the ZIP-R (gap 10 ACH)',
    'zipwet20': 'Rain behind the mat, onto the ZIP-R (gap 20 ACH)',
}
# Register tag -> (wall, weather, scenario). Pipeline tests T-* and the P-wrb duplicate of PRVc-base are not cases.
BASES = {'c': 'nyc_cold_n', 'h': 'nyc_hot_ne', 'hN': 'nyc_hot_n', 'hSE': 'nyc_hot_se', 'P': 'prv_cold_n'}
EXCLUDED = {'T-base', 'T-noleak', 'P-wrb'}


def classify(tag: str) -> tuple[str, str, str]:
    cedar = {'NYCc-base': ('nyc_cold_n', 'base'), 'NYCh-base': ('nyc_hot_n', 'base'), 'NYCh-NE': ('nyc_hot_ne', 'base'),
             'NYCh-E': ('nyc_hot_e', 'base'), 'PRVc-base': ('prv_cold_n', 'base')}
    if tag in cedar:
        return ('cedar', *cedar[tag])
    if tag.startswith(('NYCc-', 'NYCh-')):
        return 'cedar', 'nyc_cold_n' if tag[3] == 'c' else 'nyc_hot_ne', tag[5:]
    prefix, _, rest = tag.partition('-')
    base, _, variant = rest.partition('-')
    weather = BASES[base]
    if prefix == 'SM':
        return 'stone_drawn', weather, variant or 'base'
    if prefix == 'SD':
        return 'stone_mat', weather, variant or 'base'
    if prefix == 'SDz':
        return 'stone_mat', weather, 'zipwet' + (variant.removeprefix('ach') if variant else '1')
    raise ValueError(f'Unclassified register tag {tag}')


def num(row: dict, key: str) -> float:
    return round(float(row[key]), 2)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--refresh', action='store_true', help='copy the register from report.json first')
    args = parser.parse_args()
    if args.refresh:
        report = json.loads((ROOT / 'report.json').read_text())
        FROZEN.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2((ROOT / report['hygrothermal_register']).resolve(), FROZEN)
    source = FROZEN.read_bytes()
    runs = []
    for row in csv.DictReader(io.StringIO(source.decode())):
        tag = row['tag']
        if tag in EXCLUDED:
            continue
        wall, weather, scenario = classify(tag)
        assert scenario in SCENARIOS, (tag, scenario)
        run = {
            'tag': tag, 'wall': wall, 'weather': weather, 'scenario': scenario,
            'zip_outer': num(row, 'OSB outer M max'), 'zip_inner': num(row, 'OSB inner M max'),
            'fiber_face': num(row, 'TimberFill face M max'), 'plywood': num(row, 'Sheathing outer M max'),
            'zip_year5': max(num(row, 'OSB outer M last yr'), num(row, 'OSB inner M last yr')),
            'zip_mc_pct': max(num(row, f'MC OSB board {i} max %') for i in (1, 2, 3)),
        }
        run['zip'] = max(run['zip_outer'], run['zip_inner'])
        run['peak'] = max(run['zip'], run['fiber_face'], run['plywood'])
        run['passes'] = run['peak'] <= LIMIT
        assert run['passes'] == (row['ASHRAE 160 (M<=3)'] == 'pass'), tag
        runs.append(run)
    tags = [r['tag'] for r in runs]
    assert len(tags) == len(set(tags))
    summary = {w: {'runs': sum(r['wall'] == w for r in runs), 'pass': sum(r['wall'] == w and r['passes'] for r in runs)} for w in WALLS}
    data = {
        'release': {'status': 'draft_first_pass', 'study_date': '5 November 2026',
                    'exported': datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
                    'source': 'WUFI Pro run register, 13_WUFI/Hygrothermal/_outputs/register.csv',
                    'source_sha256': hashlib.sha256(source).hexdigest()},
        'limit': LIMIT, 'walls': WALLS, 'weather': WEATHER, 'scenarios': SCENARIOS,
        'summary': summary, 'runs': runs,
    }
    site = ROOT / 'site'
    (site / 'data/hygrothermal.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    buf = io.StringIO(newline='')
    out = csv.writer(buf)
    out.writerow(['run', 'wall', 'weather', 'scenario', 'zip_osb_outer_mold_index', 'zip_osb_inner_mold_index',
                  'wood_fiber_face_mold_index', 'interior_plywood_mold_index', 'zip_osb_year5_mold_index',
                  'zip_osb_max_moisture_content_pct', 'passes_mold_index_3'])
    for r in runs:
        out.writerow([r['tag'], WALLS[r['wall']], WEATHER[r['weather']], SCENARIOS[r['scenario']], r['zip_outer'], r['zip_inner'],
                      r['fiber_face'], r['plywood'], r['zip_year5'], r['zip_mc_pct'], 'yes' if r['passes'] else 'no'])
    (site / 'downloads/wall-moisture-results.csv').write_text(buf.getvalue())
    print(f'{len(runs)} runs: ' + ', '.join(f"{w} {s['pass']}/{s['runs']} pass" for w, s in summary.items()))


if __name__ == '__main__':
    main()

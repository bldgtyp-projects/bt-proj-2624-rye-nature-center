"""Release selected outputs from the reviewed annual run; source files stay private."""
from __future__ import annotations
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import re
import shutil
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / '_private/annual'
SITE = ROOT / 'site'
VARIABLES = {
    'Heating Coil Electricity Energy': 'heating',
    'Cooling Coil Electricity Energy': 'cooling',
    'Water Heater Electricity Energy': 'hot_water',
    'Fan Electricity Energy': 'fans_pumps',
    'Pump Electricity Energy': 'fans_pumps',
    'Zone Lights Electricity Energy': 'lighting',
    'Zone Electric Equipment Electricity Energy': 'equipment',
}
END_USES = [
    {'id': 'heating', 'label': 'Heating', 'color': '#b65e38'},
    {'id': 'cooling', 'label': 'Cooling', 'color': '#527f9b'},
    {'id': 'hot_water', 'label': 'Hot water', 'color': '#aa8640'},
    {'id': 'fans_pumps', 'label': 'Fans & pumps', 'color': '#64816b'},
    {'id': 'lighting', 'label': 'Lighting', 'color': '#d2b86b'},
    {'id': 'equipment', 'label': 'Equipment', 'color': '#848991'},
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2) + '\n')


def objects(path):
    return [[v.strip() for v in o.strip().split(',')]
            for o in re.sub(r'!.*', '', path.read_text()).split(';') if o.strip()]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true')
    args = parser.parse_args()
    config = json.loads((ROOT / 'report.json').read_text())
    if args.refresh:
        PRIVATE.mkdir(parents=True, exist_ok=True)
        run = (ROOT / config['annual_run']).resolve()
        review = json.loads((ROOT / config['annual_review']).read_text())
        # Require the exact run already reviewed by the modeling work.
        for rel in ['out.osw', 'run/in.idf', 'run/eplusout.sql', 'run/eplusout.err']:
            p = run / rel
            assert digest(p) == review['source_hashes'][str(p.relative_to(ROOT.parent))], p
            shutil.copyfile(p, PRIVATE / p.name)
        shutil.copyfile(run / 'run/in.osm', PRIVATE / 'in.osm')
        shutil.copyfile(ROOT / config['annual_review'], PRIVATE / 'review.json')
        shutil.copyfile(ROOT / config['comparison_review'], PRIVATE / 'comparison.json')
        shutil.copyfile(ROOT / config['annual_diagnostics'], PRIVATE / 'diagnostics.json')
        workflow = json.loads((PRIVATE / 'out.osw').read_text())
        weather = Path(workflow['weather_file'])
        code = {}
        for p in (run / 'measures').rglob('*'):
            if p.is_file() and p.suffix in ['.rb', '.json']:
                code[str(p.relative_to(run / 'measures'))] = digest(p)
        write_json(PRIVATE / 'source.json', {'run': str(run.relative_to(ROOT.parent)),
                   'weather': weather.name, 'weather_sha256': digest(weather),
                   'measure_sha256': code,
                   'files': {p.name: digest(p) for p in PRIVATE.iterdir() if p.is_file() and p.name != 'source.json'}})
    provenance = json.loads((PRIVATE / 'source.json').read_text())
    for name, sha in provenance['files'].items():
        assert digest(PRIVATE / name) == sha, name
    inputs = json.loads((SITE / 'data/inputs.json').read_text())
    assert inputs['source']['final_idf_sha256'] == digest(PRIVATE / 'in.idf')
    review = json.loads((PRIVATE / 'review.json').read_text())
    input_path = inputs['source']['path']
    assert inputs['source']['sha256'] == review['source_hashes'][input_path]
    workflow = json.loads((PRIVATE / 'out.osw').read_text())
    assert workflow['completed_status'] == 'Success'
    assert all(s['result']['step_result'] == 'Success' and not s['result'].get('step_errors') for s in workflow['steps'])
    error = (PRIVATE / 'eplusout.err').read_text()
    assert not re.search(r'\*\*\s+(Severe|Fatal)\s+\*\*', error)
    idf = objects(PRIVATE / 'in.idf')
    osm_version = next(o[2] for o in objects(PRIVATE / 'in.osm') if o[0].lower() == 'os:version')
    assert osm_version == '3.10.0'
    tank = next(o for o in idf if o[0].lower() == 'waterheater:mixed')
    # This run's electric tank has 20 W off-cycle parasitics, zero on-cycle
    # parasitics and 1 MW placeholder capacity. Verify rather than generalize.
    assert tank[11:13] == ['Electricity', '1']
    assert tank[7] == '1000000' and tank[14] == '20' and tank[17] == '0'
    c = sqlite3.connect(f'file:{PRIVATE / "eplusout.sql"}?mode=ro', uri=True)
    rows = c.execute('''select t.Month,t.Day,t.Hour,t.Minute,d.Name,r.Value
        from ReportData r join ReportDataDictionary d using(ReportDataDictionaryIndex)
        join Time t using(TimeIndex) join EnvironmentPeriods e using(EnvironmentPeriodIndex)
        where e.EnvironmentType=3 and d.ReportingFrequency='Hourly'
        and d.Name in ({})'''.format(','.join('?' for _ in VARIABLES)), tuple(VARIABLES)).fetchall()
    hourly = {}
    for month, day, hour, minute, variable, joules in rows:
        key = (month, day, hour, minute)
        h = hourly.setdefault(key, {u['id']: 0.0 for u in END_USES})
        h[VARIABLES[variable]] += joules / 3_600_000
    assert len(hourly) == 8760
    monthly = [{'month': m, 'label': label, 'total_kWh': 0.0,
                'end_uses_kWh': {u['id']: 0.0 for u in END_USES}}
               for m, label in enumerate(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], 1)]
    for key, h in hourly.items():
        # Heater runtime = input energy / rated electric power. Include its
        # separately metered parasitics in hot-water consumption.
        h['hot_water'] += 0.020 * (1 - h['hot_water'] / 1000)
        for use, kwh in h.items():
            monthly[key[0]-1]['end_uses_kWh'][use] += kwh
    # The measure reports dehumidifier electricity at zone timestep only.
    # Sum it once into Cooling, independently of hourly coil electricity.
    for month, joules in c.execute("""select t.Month,sum(r.Value) from ReportData r
        join ReportDataDictionary d using(ReportDataDictionaryIndex) join Time t using(TimeIndex)
        join EnvironmentPeriods e using(EnvironmentPeriodIndex) where e.EnvironmentType=3
        and d.Name='Zone Dehumidifier Electricity Energy' and d.ReportingFrequency='Zone Timestep'
        group by t.Month"""):
        monthly[month-1]['end_uses_kWh']['cooling'] += joules / 3_600_000
    for month, day, hour, minute, interval, joules in c.execute('''select t.Month,t.Day,t.Hour,t.Minute,t.Interval,r.Value
        from ReportData r join ReportDataDictionary d using(ReportDataDictionaryIndex)
        join Time t using(TimeIndex) join EnvironmentPeriods e using(EnvironmentPeriodIndex)
        where e.EnvironmentType=3 and d.Name='Electricity:Facility' and d.ReportingFrequency='Zone Timestep' '''):
        monthly[month-1]['total_kWh'] += joules / 3_600_000
    for m in monthly:
        assert abs(sum(m['end_uses_kWh'].values()) - m['total_kWh']) < 1e-5, m
    annual = {u['id']: sum(m['end_uses_kWh'][u['id']] for m in monthly) for u in END_USES}
    total = sum(m['total_kWh'] for m in monthly)
    assert abs(total - review['windows']['electricity_kWh']) < 1e-6
    versions = c.execute('select EnergyPlusVersion from Simulations').fetchone()[0]
    occupied_cooling_unmet = float(c.execute("select Value from TabularDataWithStrings where TableName='Comfort and Setpoint Not Met Summary' and RowName='Time Setpoint Not Met During Occupied Cooling' and ColumnName='Facility'").fetchone()[0])
    c.close()
    area = sum(z['floor_area_m2'] for z in inputs['zones'])
    comparison = json.loads((PRIVATE / 'comparison.json').read_text())
    diagnostics = json.loads((PRIVATE / 'diagnostics.json').read_text())
    history = [{'label': 'Previous annual model, before material/mass/sizing updates',
                'total_kWh': comparison['windows']['electricity_kWh']},
               {'label': 'Current annual model', 'total_kWh': total}]
    humidity = [{'zone': key, 'label': label,
                 'occupied_hourly_max_RH_percent': diagnostics['interior'][key]['RH_percent']['occupied_maximum'],
                 'all_hourly_max_RH_percent': diagnostics['interior'][key]['RH_percent']['maximum'],
                 'all_quarter_hour_max_RH_percent': diagnostics['dehumidifiers'].get(key, {}).get('maximum_quarter_hour_RH_percent')}
                for key, label in [('labs','Learning Labs'),('visitor','Visitor Center'),('core','Core'),('restrooms','Restrooms')]]
    output = {'schema_version': 3, 'release': {'id': 'annual-2026-current-materials-mass-sizing',
              'review_date': '2026-10-20', 'status': 'reviewed_design_model',
              'scenario': 'Current materials, internal mass and sized GSHPs; windows with moisture limits and Visitor/Core dehumidification',
              'source': {**provenance, 'hbjson_sha256': inputs['source']['sha256'],
                         'idf_sha256': digest(PRIVATE / 'in.idf'), 'osm_sha256': digest(PRIVATE / 'in.osm'),
                         'sql_sha256': digest(PRIVATE / 'eplusout.sql'),
                         'energyplus': versions, 'openstudio': osm_version,
                         'design_days': {'count': len([o for o in idf if o[0].lower() == 'sizingperiod:designday']),
                                         'names': [o[1] for o in idf if o[0].lower() == 'sizingperiod:designday'],
                                         'purpose': 'Annual autosizing inputs; the separate four-condition design-day package has its own provenance'},
                         'calendar': inputs['calendar'], 'weather_description': 'White Plains / Westchester County Airport TMYx typical-year weather'}},
              'areas': [{'id': 'annual', 'title': 'Annual energy use', 'status': 'reviewed'},
                        {'id': 'peaks', 'title': 'Peak loads', 'subtitle': 'Winter and summer design days', 'status': 'pending',
                         'description': 'Design-day heating and cooling loads will be added for mechanical coordination.',
                         'sections': ['Winter design day','Summer design day']},
                        {'id': 'resilience', 'title': 'Resiliency', 'subtitle': 'Phius REVIVE study', 'status': 'pending',
                         'description': 'One-week winter and summer outage studies remain in progress. This study does not imply certification.',
                         'sections': ['Winter outage · 1 week','Summer outage · 1 week']}],
              'annual': {'total_kWh': total, 'floor_area_m2': area, 'eui_kWh_m2_year': total/area,
                         'end_uses': END_USES, 'end_uses_kWh': annual, 'monthly': monthly,
                         'history': history, 'humidity': humidity,
                         'dehumidification_kWh': diagnostics['energy']['Dehumidifier Electricity Energy'], 'reporting_basis': 'Purchased site electricity, before any PV credit. Heating and cooling are equipment electricity, not thermal loads. Cooling includes supplemental dehumidifier electricity. Hot water includes tank parasitics. Fans and pumps include the shared ERV and conditioning equipment.',
                         'calculation': 'Hourly component-energy outputs plus 15-minute supplemental dehumidifier electricity summed by reporting month. Dehumidifiers are included once in Cooling. Electric water-heater off-cycle parasitics reconstructed from its 20 W input, rated capacity and hourly heater electricity. Every monthly sum reconciles to the quarter-hour Electricity:Facility meter within 0.00001 kWh.',
                         'review': {'severe_errors': 0, 'humidity_status': 'visitor_core_control_verified_labs_and_winter_comfort_open',
                                    'occupied_cooling_unmet_hours': occupied_cooling_unmet, 'annual_latch_intervals_checked': 35040},
                         'systems': [
                             ['Heating and cooling','Four recirculating water-source heat-pump zones; explicit project capacities and matching air/water/fan flows, ERV-first sequencing, 15-minute sizing average. Template curves and the EMS ground-temperature surrogate remain provisional.'],
                             ['Humidity control','Visitor Center/Core each use a generic 120 L/day dehumidifier with a 60% RH target all day; disabled with window opening or outage controls. Electricity is included in Cooling. Labs and Restrooms have no supplemental device.'],
                             ['Ventilation','One shared ERV, separate from heating and cooling. Sensible / latent effectiveness: 75% / 50%, held constant at reduced flow before frost control.'],
                             ['Air paths','Supply to Labs, Visitor Center and Core; transfer through Core; Core and Restrooms extract through the ERV. No separate restroom exhaust-fan energy.'],
                             ['Controls','Shared ERV follows reviewed ventilation and extract profiles. Positive window-opening permission disables conditioning in that zone.'],
                             ['Window operation','Occupancy permission in all four zones; indoor 22 to 26°C; outdoor 15 to 25°C; indoor minus outdoor at least 1.5°C. Block at outdoor dew point ≥13°C; re-enable below 12°C. Retain prior permission between.'],
                             ['Thermostats','Occupied heating / cooling: 70°F / 75°F. Closed-hours setbacks: 68°F / 80°F, with the program-specific ready periods shown on the Program page.'],
                             ['Hot water','Electric resistance tank, fixed 10°C mains, 60°C storage; Restrooms 35°C and Core 49°C fixture targets. Tank capacity, storage volume and distribution design remain provisional.'],
                             ['Ground and weather','Simplified constant 18°C slab-ground boundary; typical-year White Plains weather. Borefield and equipment design are not established by these results.']]} }
    write_json(SITE / 'data/results.json', output)
    write_json(SITE / 'downloads/annual-results.json', output)
    buf = io.StringIO(newline=''); writer = csv.writer(buf)
    writer.writerow(['month', 'total_electricity_kWh', *[u['id'] + '_electricity_kWh' for u in END_USES]])
    for m in monthly:
        writer.writerow([m['label'], m['total_kWh'], *[m['end_uses_kWh'][u['id']] for u in END_USES]])
    writer.writerow(['Annual', total, *[annual[u['id']] for u in END_USES]])
    (SITE / 'downloads/monthly-energy.csv').write_text(buf.getvalue())
    print(f'PASS: 12 monthly component sums reconcile to {total:.6f} kWh; {total/area:.2f} kWh/m²/year.')


if __name__ == '__main__':
    main()

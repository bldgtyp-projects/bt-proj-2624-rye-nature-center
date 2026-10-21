"""Independently check public monthly values against the frozen reviewed SQL."""
import calendar
import csv
import hashlib
import json
from pathlib import Path
import sqlite3

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'site/data/results.json').read_text())
annual = data['annual']
private = ROOT / '_private/annual'
for name, field in [('eplusout.sql','sql_sha256'), ('in.idf','idf_sha256'), ('in.osm','osm_sha256')]:
    assert hashlib.sha256((private/name).read_bytes()).hexdigest() == data['release']['source'][field]
c = sqlite3.connect(f'file:{private / "eplusout.sql"}?mode=ro', uri=True)
q = '''select t.Month,d.Name,sum(r.Value)/3600000 from ReportData r
 join ReportDataDictionary d using(ReportDataDictionaryIndex)
 join Time t using(TimeIndex) join EnvironmentPeriods e using(EnvironmentPeriodIndex)
 where e.EnvironmentType=3 and d.ReportingFrequency=? and d.Name=? group by t.Month,d.Name'''
variables = {'heating':['Heating Coil Electricity Energy'], 'cooling':['Cooling Coil Electricity Energy','Zone Dehumidifier Electricity Energy'],
             'hot_water':['Water Heater Electricity Energy'], 'fans_pumps':['Fan Electricity Energy','Pump Electricity Energy'],
             'lighting':['Zone Lights Electricity Energy'], 'equipment':['Zone Electric Equipment Electricity Energy']}
expected = {month: {} for month in range(1,13)}
for use, names in variables.items():
    for name in names:
        for month, _, kwh in c.execute(q,('Zone Timestep' if name=='Zone Dehumidifier Electricity Energy' else 'Hourly',name)):
            expected[month][use] = expected[month].get(use,0) + kwh
for m in range(1,13):
    heater = expected[m]['hot_water']
    hours = calendar.monthrange(2026,m)[1]*24
    expected[m]['hot_water'] = heater + 0.020*(hours-heater/1000)
facility = {m:v for m,_,v in c.execute(q,('Zone Timestep','Electricity:Facility'))}
c.close()
csv_rows = list(csv.DictReader((ROOT/'site/downloads/monthly-energy.csv').open()))
assert len(csv_rows) == 13
for m, row in zip(annual['monthly'],csv_rows):
    assert m['month'] in expected
    for use, value in m['end_uses_kWh'].items():
        assert abs(expected[m['month']][use]-value) < 1e-6, (m['label'],use)
        assert float(row[use+'_electricity_kWh']) == value
    assert abs(m['total_kWh']-facility[m['month']]) < 1e-6
    assert float(row['total_electricity_kWh']) == m['total_kWh']
assert csv_rows[-1]['month'] == 'Annual'
assert abs(sum(facility.values())-annual['total_kWh']) < 1e-6
review = json.loads((private/'review.json').read_text())
assert abs(annual['total_kWh']-review['windows']['electricity_kWh']) < 1e-6
assert abs(sum(annual['end_uses_kWh'].values())-annual['total_kWh']) < 1e-6
print('PASS: 12 monthly totals and 72 end-use values match reviewed SQL; CSV round trip and provenance match.')

"""Check the published outage package against frozen native SQL, CSV and EnergyPlus Pierce SET."""
import csv,hashlib,json,sqlite3
from collections import defaultdict
from pathlib import Path
R=Path(__file__).resolve().parents[1]
d=json.loads((R/'site/data/resilience.json').read_text())
p=R/'_private/resilience'
assert json.loads((R/'site/downloads/resilience-results.json').read_text())==d
assert d['release']['status']=='draft_first_pass'
assert hashlib.sha256((p/'input.hbjson').read_bytes()).hexdigest()==d['release']['source']['hbjson_sha256']
prefix={'labs':'LEARNING-LABS_','visitor':'VISITOR-CENTER_','core':'MAIN_','restrooms':'BATHROOMS_'}
people={'labs':'PEOPLE 1'}
rows=list(csv.DictReader((R/'site/downloads/resilience-hourly.csv').open()))
assert len(rows)==432
cr=d['criteria'];bands=[b['from_C'] for b in cr['heat_index_bands_C']]+[float('inf')]
for season in ['winter','summer']:
    b=d[season];sql=p/season/'eplusout.sql'
    for name,field in [('in.idf','idf_sha256'),('in.osm','osm_sha256'),('eplusout.sql','sql_sha256')]:
        assert hashlib.sha256((p/season/name).read_bytes()).hexdigest()==b['source'][field]
    c=sqlite3.connect(f'file:{sql}?mode=ro',uri=True)
    q='''select d.KeyValue,r.Value from ReportData r join ReportDataDictionary d using(ReportDataDictionaryIndex) join Time t using(TimeIndex)
         where d.Name=? and d.ReportingFrequency='Hourly' and (t.WarmupFlag is null or t.WarmupFlag=0)
         and t.EnvironmentPeriodIndex in (select EnvironmentPeriodIndex from EnvironmentPeriods where EnvironmentType=3) order by t.TimeIndex'''
    def hourly(name):
        out=defaultdict(list)
        for k,v in c.execute(q,(name,)):out[k.upper()].append(v)
        assert all(len(v)==216 for v in out.values()),name
        return out
    air=hourly('Zone Mean Air Temperature');rh=hourly('Zone Air Relative Humidity')
    assert hourly('Site Outdoor Air Drybulb Temperature')['ENVIRONMENT']==b['outdoor_air_C']
    w=slice(24,192)
    season_rows=[r for r in rows if r['season']==season]
    assert [int(r['outage_hour']) for r in season_rows]==[int(24<=h<192) for h in range(216)]
    for k,z in b['zones'].items():
        key=next(n for n in air if n.startswith(prefix[k]))
        assert air[key]==z['air_C'] and rh[key]==z['RH_percent']
        for h,r in enumerate(season_rows):
            assert float(r[f'{k}_air_C'])==z['air_C'][h] and float(r[f'{k}_RH_percent'])==z['RH_percent'][h]
        if season=='winter':
            assert min(air[key][w])==z['air_min_C'] and sum(v<cr['cold_air_limit_C'] for v in air[key][w])==z['hours_below_cold_limit']
            total=sum(max(0.0,cr['set_threshold_C']-v) for v in z['set_C'][w])*1.8
            assert abs(total-z['set_degree_hours_F_h'])<1e-6
            assert all(float(r[f'{k}_SET_C'])==z['set_C'][h] for h,r in enumerate(season_rows))
            if k in people:
                pierce=hourly('Zone Thermal Comfort Pierce Model Standard Effective Temperature')[people[k]]
                native=sum(max(0.0,cr['set_threshold_C']-v) for v in pierce[w])*1.8
                assert abs(native-total)/native<0.03,(native,total)
        else:
            hi=hourly('Zone Heat Index')[key];assert hi==z['heat_index_C']
            assert max(hi[w])==z['heat_index_max_C']
            for n,band in enumerate(cr['heat_index_bands_C']):
                assert sum(bands[n]<=v<bands[n+1] for v in hi[w])==z['band_hours'][band['id']]
            for day,rec in enumerate(z['days']):
                t=sum(air[key][24+day*24:48+day*24])/24;h=sum(rh[key][24+day*24:48+day*24])/2400
                assert abs(t-rec['mean_air_C'])<1e-9 and rec['deadly']==(t>49.593-48.580*h+25.887*h*h)
            assert z['deadly_days']==sum(r['deadly'] for r in z['days'])
            assert all(float(r[f'{k}_heat_index_C'])==z['heat_index_C'][h] for h,r in enumerate(season_rows))
    assert b['checks']['outage_conditioning_kWh']==0 and b['checks']['severe_errors']==0
combined=json.loads((R/'site/data/results.json').read_text())
assert next(a for a in combined['areas'] if a['id']=='resilience')['status']=='draft_first_pass'
print('PASS: resilience air/RH/heat-index series match native SQL; SET totals within 3% of EnergyPlus Pierce SET for Labs; band hours, deadly days, cold hours, CSV and hashes check.')

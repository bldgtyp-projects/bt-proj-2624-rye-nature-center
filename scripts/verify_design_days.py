"""Check published Design-Day loads against frozen native SQL, CSV and reviewed traces."""
import csv,hashlib,json,sqlite3
from pathlib import Path
R=Path(__file__).resolve().parents[1]
d=json.loads((R/'site/downloads/design-day-results.json').read_text())
p=R/'_private/design_days'
for name,field in [('in.idf','idf_sha256'),('in.osm','osm_sha256'),('eplusout.sql','sql_sha256')]:assert hashlib.sha256((p/name).read_bytes()).hexdigest()==d['release']['source'][field]
c=sqlite3.connect(f'file:{p/"eplusout.sql"}?mode=ro',uri=True)
assert c.execute('select count(*) from EnvironmentPeriods').fetchone()[0]==4
assert c.execute('select count(*) from EnvironmentPeriods where EnvironmentType=3').fetchone()[0]==0
rows=list(csv.DictReader((R/'site/downloads/design-day-loads.csv').open()))
assert len(rows)==4
prefix={'labs':'LEARNING-LABS_','visitor':'VISITOR-CENTER_','core':'MAIN_','restrooms':'BATHROOMS_'}
for z,row in zip(d['zones'],rows):
 for load,field,col in [('Heating','heating_room_load_W','room_heating_W'),('Cooling','sensible_cooling_room_load_W','room_sensible_cooling_W')]:
  value=c.execute('select CalcDesLoad from ZoneSizes where ZoneName like ? and LoadType=?',(prefix[z['id']]+'%',load)).fetchone()[0]
  assert abs(value-z[field])<1e-9
  assert float(row[col])==z[field]
 for field in ['rated_heating_W','rated_total_cooling_W','rated_sensible_cooling_W']:assert float(row[field])==z['equipment'][field]
 for field,description,suffix in [('rated_heating_W','User-Specified Rated Heating Capacity','% HTG COIL'),('rated_total_cooling_W','User-Specified Rated Total Cooling Capacity','% CLG COIL'),('rated_sensible_cooling_W','User-Specified Rated Sensible Cooling Capacity','% CLG COIL'),('airflow_m3_s','User-Specified Cooling Supply Air Flow Rate','% WSHP')]:
  value=c.execute('select Value from ComponentSizes where CompName like ? and Description=?',(prefix[z['id']]+suffix,description)).fetchone()[0]
  assert abs(value-z['equipment'][field])<1e-9,(z['id'],field)

 assert z['maximum_backup_W']==0
 assert z['summer_max_air_C']<d['controls']['cooling_setpoint_C']+.5
 assert abs(z['winter_min_air_C']-d['controls']['heating_setpoint_C'])<.001
review=json.loads((p/'review.json').read_text())
for k,v in d['coincident_room_loads_W'].items():assert v==review['coincident_zone_loads'][k]['peak_W']
combined=json.loads((R/'site/data/results.json').read_text())
assert combined['design_days']==d
assert combined['release']['source']['hbjson_sha256']==d['release']['source']['annual_hbjson_sha256']
assert next(a for a in combined['areas'] if a['id']=='resilience')['status']=='pending'
print('PASS: all eight room loads match native SQL; four CSV rows, source hashes, controls, operating bounds and matched annual inputs pass; resilience pending.')

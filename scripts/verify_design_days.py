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
# Zone heat-pump coil peaks, recomputed independently of the exporter.
def peak(name,like):
 return c.execute('''select max(d.Value) from ReportData d join ReportDataDictionary r using(ReportDataDictionaryIndex) join Time t using(TimeIndex)
  where r.Name=? and r.KeyValue like ? and r.ReportingFrequency='Zone Timestep' and t.WarmupFlag=0''',(name,like)).fetchone()[0]
for z,row in zip(d['zones'],rows):
 k=z['coil']
 for value,name,like in [(k['heating']['W'],'Heating Coil Heating Rate','%HP HTG COIL'),(k['total_cooling']['W'],'Cooling Coil Total Cooling Rate','%CLG COIL'),(k['sensible_cooling']['W'],'Cooling Coil Sensible Cooling Rate','%CLG COIL')]:
  assert abs(peak(name,prefix[z['id']]+like)-value)<1e-6,(z['id'],name)
 assert k['supplemental_heating_W']==0
 for part,coil_name,suffix in [('heating','Heating Coil Runtime Fraction','%HP HTG COIL'),('total_cooling','Cooling Coil Runtime Fraction','%CLG COIL')]:
  step=k[part];rtf=c.execute('''select d.Value from ReportData d join ReportDataDictionary r using(ReportDataDictionaryIndex) join Time t using(TimeIndex) join EnvironmentPeriods e using(EnvironmentPeriodIndex)
   where r.Name=? and r.KeyValue like ? and r.ReportingFrequency='Zone Timestep' and t.WarmupFlag=0 and upper(e.EnvironmentName)=upper(?) and t.Hour=? and t.Minute=?''',(coil_name,prefix[z['id']]+suffix,step['condition'],step['hour'],step['minute'])).fetchone()[0]
  assert abs(rtf-step['runtime_fraction'])<1e-12 and 0<=rtf<=1,(z['id'],part)
 for col,value in [('coil_heating_W',k['heating']['W']),('coil_sensible_cooling_W',k['sensible_cooling']['W']),('coil_total_cooling_W',k['total_cooling']['W'])]:assert float(row[col])==value
reviewed=review['diagnostics']['coincident_operating_coil_peaks'].values()
assert abs(d['coil_peaks']['heating_W']-max(v['heating_W']['W'] for v in reviewed))<1e-6
assert abs(d['coil_peaks']['total_cooling_W']-max(v['total_cooling_W']['W'] for v in reviewed))<1e-6
assert abs(d['coil_peaks']['sensible_cooling_W']-max(v['sensible_cooling_W']['W'] for v in reviewed))<1e-6
# Room-to-coil reconciliation: parts add up, signs are physical and the room part matches the sizing loads.
h,cl=d['room_to_coil']['heating'],d['room_to_coil']['cooling']
assert abs(h['room_sensible_W']+h['ventilation_sensible_W']+h['fan_and_other_W']-h['coil_W'])<1e-6 and h['coil_W']==d['coil_peaks']['heating_W']
assert abs(cl['room_sensible_W']+cl['ventilation_sensible_W']+cl['fan_and_other_W']-cl['coil_sensible_W'])<1e-6
assert abs(cl['room_latent_W']+cl['ventilation_latent_W']-cl['coil_latent_W'])<1e-6 and abs(cl['coil_sensible_W']+cl['coil_latent_W']-cl['coil_total_W'])<1e-3
assert h['ventilation_sensible_W']>0 and cl['ventilation_latent_W']>0 and cl['room_latent_W']>0 and h['erv_supply_C']<d['controls']['heating_setpoint_C']
assert abs(h['fan_and_other_W'])<0.1*h['coil_W'] and abs(cl['fan_and_other_W'])<0.1*cl['coil_sensible_W']
assert abs(h['room_sensible_W']/d['coincident_room_loads_W']['heating']-1)<0.01 and abs(cl['room_sensible_W']/d['coincident_room_loads_W']['cooling']-1)<0.02
for side,sign in [('heating',-1),('cooling',1)]:
 total=sign*sum(r['sensible_W'] for r in d['room_load_components'][side])
 assert abs(total/d['coincident_room_loads_W'][side]-1)<0.01,(side,total)
# Independent SQL checks on the reconciliation: peak times, heat-pump fan power and the ERV outdoor-air flow.
env={n.upper():i for i,n in c.execute('select EnvironmentPeriodIndex,EnvironmentName from EnvironmentPeriods')}
def value(name,like,step,frequency='Zone Timestep'):
 rows=c.execute('''select d.Value from ReportData d join ReportDataDictionary r using(ReportDataDictionaryIndex) join Time t using(TimeIndex)
  where r.Name=? and r.KeyValue like ? and r.ReportingFrequency=? and t.EnvironmentPeriodIndex=? and t.Hour=? and t.Minute=? and t.WarmupFlag=0''',(name,like,frequency,env[step['condition'].upper()],step['hour'],step['minute'])).fetchall()
 return [r[0] for r in rows]
for side,field in [('heating','heating_W'),('cooling','total_cooling_W')]:
 step=d['room_to_coil'][side]
 assert step['hour']*60+step['minute']==review['diagnostics']['coincident_operating_coil_peaks'][step['condition']][field]['minute']
 fans=value('Fan Electricity Energy','%WSHP FAN',step);assert len(fans)==4
 fan=sum(fans)/(3600/d['controls']['timesteps_per_hour'])
 assert abs(fan/step['unit_fan_W']-1)<1e-9 and abs(abs(step['fan_and_other_W'])/fan-1)<0.10,(side,fan,step['fan_and_other_W'])
 hourly={**step,'hour':step['hour'] if step['minute']==0 else step['hour']+1,'minute':0}
 outdoor=value('System Node Mass Flow Rate','OUTBOARD OA NODE',hourly,'Hourly')[0]
 assert abs(outdoor/d['room_to_coil']['air_density_kg_m3']/step['erv_supply_m3_s']-1)<0.01,(side,outdoor)
combined=json.loads((R/'site/data/results.json').read_text())
assert combined['design_days']==d
assert combined['release']['source']['hbjson_sha256']==d['release']['source']['annual_hbjson_sha256']
assert next(a for a in combined['areas'] if a['id']=='resilience')['status'] in ('pending','draft_first_pass')
print('PASS: eight room loads and twelve zone coil peaks match native SQL; room-to-coil steps close, with peak times, heat-pump fan power and ERV outdoor-air flow checked against SQL; component sums close; CSV rows, source hashes, controls, operating bounds and matched annual inputs pass.')

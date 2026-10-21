"""Publish the first-pass winter/summer outage package separately from annual and Design-Day results."""
from __future__ import annotations
import argparse,csv,io,json,shutil,sqlite3
from collections import defaultdict
from pathlib import Path
from statistics import fmean
from export_results import digest,write_json
from honeybee_revive.output._shared import _time_index_before_window,get_time_series_data
import honeybee_revive.output.set_calculator as set_calculator
from honeybee_revive.output.resilience_winter_graphs import envelope_conduction_records,get_surface_data
from honeybee_revive.output.set_calculator import (ACTIVITY_LEVEL_W_PER_PERSON,AIR_SPEED_M_S,CLOTHING_INSULATION_CLO,
    DEGREE_HOUR_F_PER_K,EDGE_BUFFER_HOURS,OUTAGE_HOURS,SET_THRESHOLD_C,calculate_winter_set_from_sql)

ROOT=Path(__file__).resolve().parents[1]
PRIVATE=ROOT/'_private/resilience'
SITE=ROOT/'site'
PREFIX={'labs':'LEARNING-LABS_','visitor':'VISITOR-CENTER_','core':'MAIN_','restrooms':'BATHROOMS_'}
LABELS={'labs':'Learning Labs','visitor':'Visitor Center','core':'Core','restrooms':'Restrooms'}
SEASONS=['winter','summer']
RUN_FILES=['out.osw','run/in.idf','run/in.osm','run/eplusout.sql','run/eplusout.err']
COLD_AIR_LIMIT_C=(36-32)/1.8
SET_LIMIT_F_H=216.0
# NOAA heat-index bands, defined in F (80/90/103/125 F) and named in REVIVE 2024 6.4.2. Exact conversions, not the
# rounded 26.7/32.2/39.4/51.7 C lines honeybee-REVIVE draws: an hour at 39.41 C is below Danger (103 F = 39.44 C).
HI_BANDS=[(i,l,(f-32)/1.8) for i,l,f in [('caution','Caution',80),('extreme_caution','Extreme Caution',90),('danger','Danger',103),('extreme_danger','Extreme Danger',125)]]
WINDOW=slice(EDGE_BUFFER_HOURS,EDGE_BUFFER_HOURS+OUTAGE_HOURS)
EVALUATION_HOURS=EDGE_BUFFER_HOURS*2+OUTAGE_HOURS

def zone_key(name:str)->str:
    return next(k for k,p in PREFIX.items() if name.upper().startswith(p))

def series(sql:Path,variable:str)->dict[str,list[float]]:
    """Hourly values per zone/key in time order; site variables are keyed 'outdoor'."""
    grouped=defaultdict(list)
    for r in get_time_series_data(sql,variable):grouped[r.Zone].append(r)
    out={}
    for key,records in grouped.items():
        records.sort(key=lambda r:r.Date)
        assert len(records)==EDGE_BUFFER_HOURS*2+OUTAGE_HOURS,(variable,key,len(records))
        out['outdoor' if variable.startswith('Site ') else zone_key(key)]=[float(r.Value) for r in records]
    return out

def dates(sql:Path)->list[str]:
    records=sorted(get_time_series_data(sql,'Site Outdoor Air Drybulb Temperature'),key=lambda r:r.Date)
    return [r.Date.strftime('%m-%d %H:%M') for r in records]

def daily(values:list[float],hours:slice=WINDOW)->list[float]:
    v=values[hours];return [fmean(v[d*24:(d+1)*24]) for d in range(len(v)//24)]

J_PER_KWH=3.6e6
# Hourly zone energy flows and air-change rates, as graphed by honeybee-REVIVE; (gain, loss) pairs are netted.
ENERGY_FLOWS=[('people','People heat gain','Zone People Total Heating Energy',None),
    ('lighting','Lighting heat gain','Zone Lights Total Heating Energy',None),
    ('equipment','Electric equipment heat gain','Zone Electric Equipment Total Heating Energy',None),
    ('windows','Window net heat gain','Zone Windows Total Heat Gain Energy','Zone Windows Total Heat Loss Energy'),
    ('infiltration','Infiltration net heat gain','Zone Infiltration Total Heat Gain Energy','Zone Infiltration Total Heat Loss Energy'),
    ('ventilation','Window-ventilation net heat gain','Zone Ventilation Total Heat Gain Energy','Zone Ventilation Total Heat Loss Energy')]
AIR_CHANGES=[('infiltration','Envelope infiltration','Zone Infiltration Standard Density Air Change Rate'),
    ('window_ventilation','Window ventilation','Zone Ventilation Standard Density Air Change Rate'),
    ('mechanical','Mechanical ventilation (ERV)','Zone Mechanical Ventilation Air Changes per Hour')]
ENVELOPE=[('conduction','Opaque envelope conduction','Surface Average Face Conduction Heat Transfer Energy','kWh'),
    ('window_net','Window net heat transfer','Surface Window Net Heat Transfer Energy','kWh'),
    ('window_gain','Window heat gain','Surface Window Heat Gain Energy','kWh'),
    ('window_loss','Window heat loss','Surface Window Heat Loss Energy','kWh'),
    ('storage','Surface heat storage','Surface Heat Storage Energy','kWh'),
    ('shading','Shading device on','Surface Shading Device Is On Time Fraction','fraction'),
    ('inside_temp','Inside face temperature','Surface Inside Face Temperature','C')]

def keyed(records,scale=1.0)->dict[str,list[float]]:
    out=defaultdict(list)
    for r in sorted(records,key=lambda r:r.Date):out[r.Zone].append(round(float(r.Value)*scale,4))
    assert all(len(v)==EVALUATION_HOURS for v in out.values())
    return dict(out)

def details(sql:Path,envelope:bool)->dict:
    """Supporting hourly figures for the final nine days, keyed by zone or surface."""
    figures={'energy':[],'air_changes':[],'envelope':[]}
    for fid,title,gain,loss in ENERGY_FLOWS:
        g=keyed(get_time_series_data(sql,gain),1/J_PER_KWH)
        if loss:
            l=keyed(get_time_series_data(sql,loss),1/J_PER_KWH)
            g={k:[round(a-b,4) for a,b in zip(v,l[k])] for k,v in g.items()}
        figures['energy'].append({'id':fid,'title':title,'unit':'kWh','series':[{'name':LABELS[zone_key(k)],'zone':zone_key(k),'values':v} for k,v in sorted(g.items())]})
    solar=[keyed(get_time_series_data(sql,f'Enclosure Exterior Windows Total Transmitted {kind} Solar Radiation Energy'),1/J_PER_KWH) for kind in ('Beam','Diffuse')]
    figures['energy'].insert(3,{'id':'solar','title':'Transmitted window solar (beam + diffuse)','unit':'kWh',
        'series':[{'name':'Whole building','zone':None,'values':[round(a+b,4) for a,b in zip(v,solar[1][k])]} for k,v in solar[0].items()]})
    for fid,title,variable in AIR_CHANGES:
        figures['air_changes'].append({'id':fid,'title':title,'unit':'ACH','series':[{'name':LABELS[zone_key(k)],'zone':zone_key(k),'values':v} for k,v in sorted(keyed(get_time_series_data(sql,variable)).items())]})
    if envelope:
        surfaces=get_surface_data(sql)
        c=sqlite3.connect(f'file:{sql}?mode=ro',uri=True)
        zones={i:zone_key(n) for i,n in c.execute('select ZoneIndex,ZoneName from Zones')}
        zone_of={s.Name:zones.get(s.ZoneIndex) for s in surfaces}
        exterior={s.Name for s in surfaces if s.ExtBoundCond<=0}
        for fid,title,variable,unit in ENVELOPE:
            records=get_time_series_data(sql,variable)
            if fid=='conduction':
                records=envelope_conduction_records(records,get_time_series_data(sql,'Surface Inside Face Conduction Heat Transfer Energy'),exterior)
            elif fid not in ('shading','inside_temp'):
                records=[r for r in records if r.Zone in exterior]
            values=keyed(records,1/J_PER_KWH if unit=='kWh' else 1.0)
            figures['envelope'].append({'id':fid,'title':title,'unit':unit,'series':[{'name':k,'zone':zone_of.get(k.split(' (')[0]),'values':v} for k,v in sorted(values.items())]})
    return figures

def lead_in_note(data:dict)->str:
    w,s=data['winter'],data['summer']
    if not (w['checks']['lead_in_hours'] or s['checks']['lead_in_hours']):
        return ('The nine-day runs start the Kiva ground from its initialization rather than its seasonal state. A scratch seasonal lead-in test in the 21 October Kiva foundation review '
                'found winter almost unchanged, but summer warmer: Labs heat index {temperature:39.6} with 1 hour in Danger. That test is a diagnostic, not a reviewed result; the values shown here are from the nine-day runs.')
    month=lambda md:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][int(md[:2])-1]+' '+str(int(md[3:]))
    return (f"Each run starts with a conditioned seasonal lead-in (winter from {month(w['simulation_period'][0])}, summer from {month(s['simulation_period'][0])}) "
            'so the Kiva ground reaches its seasonal state before the outage; results use the final nine days.')

def run_checks(sql:Path,idf:str)->dict:
    """Checks over the final nine days; any earlier conditioned lead-in is reported separately."""
    c=sqlite3.connect(f'file:{sql}?mode=ro',uri=True)
    cutoff=_time_index_before_window(c.cursor(),EVALUATION_HOURS)
    base='''select t.TimeIndex,r.Value,d.KeyValue from ReportData r join ReportDataDictionary d using(ReportDataDictionaryIndex)
         join Time t using(TimeIndex) where d.Name=? and d.ReportingFrequency=? and (t.WarmupFlag is null or t.WarmupFlag=0)
         and t.EnvironmentPeriodIndex in (select EnvironmentPeriodIndex from EnvironmentPeriods where EnvironmentType=3)'''
    q=base+' and t.TimeIndex>? order by t.TimeIndex'
    lead=base+' and t.TimeIndex<=? order by t.TimeIndex'
    def meter(name):
        rows=c.execute(q,(name,'Zone Timestep',cutoff)).fetchall();assert len(rows)%EVALUATION_HOURS==0;n=len(rows)//EVALUATION_HOURS
        return [sum(v for _,v,_ in rows[h*n:(h+1)*n])/3.6e6 for h in range(EVALUATION_HOURS)]
    lead_rows=[c.execute(lead,(name,'Zone Timestep',cutoff)).fetchall() for name in ('DistrictHeatingWater:Facility','DistrictCooling:Facility')]
    lead_hours=len(c.execute(lead,('Site Outdoor Air Drybulb Temperature','Hourly',cutoff)).fetchall())
    district=[a+b for a,b in zip(meter('DistrictHeatingWater:Facility'),meter('DistrictCooling:Facility'))]
    elec=meter('Electricity:Facility')
    def hourly_total(name,scale):
        totals=defaultdict(float)
        for t,v,_ in c.execute(q,(name,'Hourly',cutoff)):totals[t]+=v*scale
        return [totals[t] for t in sorted(totals)]
    mech=hourly_total('Zone Mechanical Ventilation Standard Density Volume Flow Rate',3600)
    window=hourly_total('Zone Ventilation Standard Density Volume Flow Rate',3600)
    people={}
    for t,v,k in c.execute(q,('Zone People Total Heating Energy','Hourly',cutoff)):people[zone_key(k)]=people.get(zone_key(k),0)+v/3.6e6
    err=(sql.parent/'eplusout.err').read_text(errors='replace').splitlines()[-1]
    assert 'Completed Successfully' in err and ' 0 Severe Errors' in err,err
    return {'severe_errors':0,'warnings':int(err.split('--')[1].split('Warning')[0]),
            'timesteps_per_hour':int(idf.split('Timestep,')[1].split(';')[0]),
            'lead_in_hours':lead_hours,'lead_in_conditioning_kWh':sum(v for rows in lead_rows for _,v,_ in rows)/3.6e6,
            'outage_conditioning_kWh':sum(district[WINDOW]),'conditioning_day1_kWh':sum(district[:24]),'conditioning_day9_kWh':sum(district[-24:]),
            'outage_electricity_kWh_per_day':sum(elec[WINDOW])/7,'outage_mechanical_ventilation_m3':sum(mech[WINDOW]),
            'outage_window_ventilation_m3':sum(window[WINDOW]),'outage_ventilated_hours':sum(v>0 for v in mech[WINDOW]),'outage_people_heat_kWh':{k:people.get(k,0.0) for k in PREFIX}}

def main()->None:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh',action='store_true')
    args=parser.parse_args()
    config=json.loads((ROOT/'report.json').read_text())
    if args.refresh:
        source={'weather':config['resilience_weather'],'files':{}}
        models=[]
        for season in SEASONS:
            run=(ROOT/config[f'resilience_{season}_run']).resolve();target=PRIVATE/season
            target.mkdir(parents=True,exist_ok=True)
            for relative in RUN_FILES:shutil.copyfile(run/relative,target/Path(relative).name)
            models.append(next(run.glob('*.hbjson')))
            source[f'{season}_run']=str(run.relative_to(ROOT.parent))
        # Both seasons must run the same HBJSON; freeze the copy the runs actually used.
        assert digest(models[0])==digest(models[1]),models
        source['model']=str(models[0].relative_to(ROOT.parent))
        shutil.copyfile(models[0],PRIVATE/'input.hbjson')
        source['weather_sha256']=digest(ROOT/config['resilience_weather'])
        source['files']={str(p.relative_to(PRIVATE)):digest(p) for p in sorted(PRIVATE.rglob('*')) if p.is_file() and p.name!='source.json'}
        write_json(PRIVATE/'source.json',source)
    source=json.loads((PRIVATE/'source.json').read_text())
    for name,sha in source['files'].items():assert digest(PRIVATE/name)==sha,name
    annual=json.loads((SITE/'data/results.json').read_text())
    data={'schema_version':1,'release':{'id':'resilience-2026-10-21-first-pass','run_date':'2026-10-21','status':'draft_first_pass',
        'source':{'hbjson_sha256':source['files']['input.hbjson'],'weather_file':Path(source['weather']).name,'weather_sha256':source['weather_sha256'],
                  'energyplus':'25.1.0','openstudio':'3.10.0','set_calculator_sha256':digest(Path(set_calculator.__file__))}},
        'zones':[{'id':k,'label':LABELS[k]} for k in PREFIX],
        'criteria':{'basis':'Phius REVIVE 2024 Standard v24.1.1, sections 6.3.2 and 6.4.2, evaluated over the central 168 outage hours of the final nine days of each run.',
            'set_threshold_C':SET_THRESHOLD_C,'set_limit_F_h':SET_LIMIT_F_H,'cold_air_limit_C':COLD_AIR_LIMIT_C,
            'set_conditions':{'clo':CLOTHING_INSULATION_CLO,'W_per_person':ACTIVITY_LEVEL_W_PER_PERSON,'air_speed_m_s':AIR_SPEED_M_S},
            'heat_index_bands_C':[{'id':i,'label':l,'from_C':t} for i,l,t in HI_BANDS],
            'deadly_day':'Mean daily zone air temperature above Tdead [C] = 49.593 - 48.580 RH + 25.887 RH^2 (RH as a fraction), Mora et al. as printed in REVIVE 6.4.2.'},
        'outage':{'buffer_hours':EDGE_BUFFER_HOURS,'outage_hours':OUTAGE_HOURS,'refuge_hours':'09:00-18:00 daily, Learning Labs'}}
    for season in SEASONS:
        folder=PRIVATE/season;sql=folder/'eplusout.sql';idf=(folder/'in.idf').read_text()
        checks=run_checks(sql,idf)
        assert checks['outage_conditioning_kWh']==0 and checks['conditioning_day1_kWh']>0 and checks['conditioning_day9_kWh']>0,checks
        period=idf.split('RunPeriod,')[1].split(';')[0].split('\n')
        begin,end=[f"{int(period[i].split(',')[0]):02d}-{int(period[i+1].split(',')[0]):02d}" for i in (2,5)]
        hours=dates(sql)
        air=series(sql,'Zone Mean Air Temperature');rh=series(sql,'Zone Air Relative Humidity')
        out_t=series(sql,'Site Outdoor Air Drybulb Temperature')['outdoor'];out_rh=series(sql,'Site Outdoor Air Relative Humidity')['outdoor']
        block={'run':source[f'{season}_run'],'run_period':[hours[0][:5],hours[-1][:5]],'simulation_period':[begin,end],'hours':hours,
               'source':{f'{kind}_sha256':source['files'][f'{season}/{n}'] for kind,n in [('idf','in.idf'),('osm','in.osm'),('sql','eplusout.sql')]},
               'checks':checks,'outdoor_air_C':out_t,'outdoor_RH_percent':out_rh,'zones':{}}
        if season=='winter':
            result=calculate_winter_set_from_sql(sql)
            set_values=defaultdict(list)
            for r in sorted(result.full_records,key=lambda r:r.Date):set_values[zone_key(r.Zone)].append(float(r.Value))
            metrics={zone_key(z):m for z,m in result.zone_metrics.items()}
            for k in PREFIX:
                outage_air=air[k][WINDOW]
                block['zones'][k]={'air_C':air[k],'RH_percent':rh[k],'set_C':set_values[k],
                    'set_degree_hours_F_h':metrics[k].degree_hours_f_h,'set_min_C':min(set_values[k][WINDOW]),
                    'air_min_C':min(outage_air),'hours_below_cold_limit':sum(v<COLD_AIR_LIMIT_C for v in outage_air),
                    'refuge_occupied':checks['outage_people_heat_kWh'][k]>0}
        else:
            hi=series(sql,'Zone Heat Index')
            for k in PREFIX:
                outage_hi=hi[k][WINDOW];bounds=[t for _,_,t in HI_BANDS]+[float('inf')]
                days=[]
                for t,h in zip(daily(air[k]),daily([v/100 for v in rh[k]])):
                    printed=49.593-48.580*h+25.887*h*h;fahrenheit=((121.91-87.444*h+46.597*h*h)-32)/1.8
                    days.append({'mean_air_C':t,'mean_RH':h,'t_dead_C':printed,'t_dead_from_F_formula_C':fahrenheit,'deadly':t>printed,'deadly_F_formula':t>fahrenheit})
                block['zones'][k]={'air_C':air[k],'RH_percent':rh[k],'heat_index_C':hi[k],'heat_index_max_C':max(outage_hi),
                    'band_hours':{i:sum(lo<=v<bounds[n+1] for v in outage_hi) for n,(i,_,lo) in enumerate(HI_BANDS)},
                    'days':days,'deadly_days':sum(d['deadly'] for d in days),'deadly_days_F_formula':sum(d['deadly_F_formula'] for d in days),
                    'air_max_C':max(air[k][WINDOW]),'refuge_occupied':checks['outage_people_heat_kWh'][k]>0}
        data[season]=block
    data['limitations']=[
        'First-pass results prepared for design review; not yet recorded as a reviewed package in the project QA folder. No refuge designation or certification outcome is implied.',
        'Active heating, cooling and water heating are off for the seven outage days. Backup loads draw a constant 8.5 kWh/day; the ERV runs during refuge hours. Backup power supply is not sized here.',
        'Outage ventilation follows the refuge programs: 10 cfm/person plus 0.12 cfm/ft2 in Learning Labs and area rates in Core and Visitor Center, during refuge hours, through 75% sensible / 50% latent heat recovery. REVIVE 6.3.3 lists 5 cfm/person for the ERV during an outage.',
        'Window openings are modeled with the annual controls (open only when indoors is {temperature:22} to {temperature:26} and outdoors is {temperature:15} to {temperature:25}, wind effectiveness 0) and delivered no airflow in either outage. Opening windows during a summer outage has not been studied.',
        'Only Learning Labs carries refuge occupancy (22 people, 09:00-18:00). REVIVE exempts thermal blocks unoccupied during a winter outage from the SET criterion; the 36 F air-temperature criterion applies to every block.',
        'REVIVE 6.3.2 names no metric for the 36 F limit; zone mean air temperature is used. SET is calculated from zone air temperature, mean radiant temperature and humidity at 1 clo, {power:120} per person and {speed:0.16}.',
        'The C and F deadly-day formulas printed in REVIVE 6.4.2 differ by {temperature_delta:0.36:2} at their constant term. Results use the C formula; the F formula gives the same deadly-day count unless noted.',
        lead_in_note(data),
        'Ground coupling uses the Kiva foundation measure with provisional inputs; its initial indoor temperature is {temperature:21.11:0} for winter and {temperature:23.89:0} for summer. ERV fan power, backup-circuit loads and refuge occupancy remain design assumptions to confirm.']
    if any(z['deadly_days']!=z['deadly_days_F_formula'] for z in data['summer']['zones'].values()):
        data['limitations']=[l.replace(' the same deadly-day count unless noted',' a different deadly-day count; both are in the data') for l in data['limitations']]
    write_json(SITE/'data/resilience.json',data)
    # Supporting figures load on demand; compact JSON keeps the envelope surfaces under 1 MB.
    (SITE/'data/resilience-details.json').write_text(json.dumps({'release':data['release']['id'],'hours':{s:data[s]['hours'] for s in SEASONS},
        'winter':details(PRIVATE/'winter'/'eplusout.sql',envelope=True),'summer':details(PRIVATE/'summer'/'eplusout.sql',envelope=False)},separators=(',',':'),allow_nan=False)+'\n')
    write_json(SITE/'downloads/resilience-results.json',data)
    buf=io.StringIO(newline='');writer=csv.writer(buf)
    head=['season','hour','month_day_time','outage_hour','outdoor_air_C','outdoor_RH_percent']
    for k in PREFIX:head+=[f'{k}_air_C',f'{k}_RH_percent',f'{k}_SET_C',f'{k}_heat_index_C']
    writer.writerow(head)
    for season in SEASONS:
        b=data[season]
        for h,label in enumerate(b['hours']):
            row=[season,h,label,int(WINDOW.start<=h<WINDOW.stop),b['outdoor_air_C'][h],b['outdoor_RH_percent'][h]]
            for k in PREFIX:
                z=b['zones'][k];row+=[z['air_C'][h],z['RH_percent'][h],z['set_C'][h] if 'set_C' in z else '',z['heat_index_C'][h] if 'heat_index_C' in z else '']
            writer.writerow(row)
    (SITE/'downloads/resilience-hourly.csv').write_text(buf.getvalue())
    next(x for x in annual['areas'] if x['id']=='resilience').update(status='draft_first_pass',title='Resilience',
        subtitle='Seven-day winter and summer power outages',
        description='First-pass Phius REVIVE 2024 outage simulations for design review; not a certification result.',
        sections=['Winter outage','Summer outage'])
    write_json(SITE/'data/results.json',annual)
    write_json(SITE/'downloads/annual-results.json',annual)
    print('PASS: winter SET and summer heat-index outage package exported with frozen source identity; status draft_first_pass.')

if __name__=='__main__':main()

"""Publish the reviewed four-condition package separately from annual energy."""
from __future__ import annotations
import argparse,collections,csv,io,json,math,shutil,sqlite3
from pathlib import Path
from export_results import digest,objects,write_json

ROOT=Path(__file__).resolve().parents[1]
PRIVATE=ROOT/'_private/design_days'
SITE=ROOT/'site'
PREFIX={'labs':'LEARNING-LABS_','visitor':'VISITOR-CENTER_','core':'MAIN_','restrooms':'BATHROOMS_'}
LABELS={'labs':'Learning Labs','visitor':'Visitor Center','core':'Core','restrooms':'Restrooms'}

CP,HFG=1006.0,2.45e6
COMPONENTS=['People','Lights','Equipment','Infiltration','Interzone Mixing','Roof','Exterior Wall','Interzone Wall','Ground Contact Floor','Fenestration Conduction','Fenestration Solar']

def coil_analysis(sql:Path,idf:list,design:list) -> dict:
    """Zone heat-pump coil peaks and the coincident room-to-coil reconciliation from the frozen SQL."""
    source=sqlite3.connect(sql.as_uri()+'?mode=ro',uri=True);c=sqlite3.connect(':memory:');source.backup(c);source.close()
    c.execute('create index if not exists coil_lookup on ReportData(ReportDataDictionaryIndex,TimeIndex)')
    env=dict(c.execute('select EnvironmentPeriodIndex,EnvironmentName from EnvironmentPeriods'))
    def series(name,key,frequency='Zone Timestep'):
        return {(e,h,m):v for e,h,m,v in c.execute('''select t.EnvironmentPeriodIndex,t.Hour,t.Minute,d.Value from ReportData d
            join ReportDataDictionary r using(ReportDataDictionaryIndex) join Time t using(TimeIndex)
            where r.Name=? and upper(r.KeyValue)=upper(?) and r.ReportingFrequency=? and t.WarmupFlag=0''',(name,key,frequency))}
    def key(name,prefix,kind=''):
        keys=[k for (k,) in c.execute('select distinct KeyValue from ReportDataDictionary where Name=? and KeyValue like ? and KeyValue like ?',(name,prefix+'%','%'+kind+'%'))]
        assert len(keys)==1,(name,prefix,kind);return keys[0]
    zone_names=[z for (z,) in c.execute('select ZoneName from Zones')]
    terminals={o[1].split()[3]:o[4] for o in idf if o[0].lower()=='airterminal:singleduct:constantvolume:noreheat' and o[1].startswith('RNC Shared ERV ')}
    assert sorted(terminals)==sorted(PREFIX)
    pressure={o[1].upper():float(o[15]) for o in design}
    z={}
    for k,prefix in PREFIX.items():
        zone=next(n for n in zone_names if n.startswith(prefix))
        z[k]={'heat':series('Heating Coil Heating Rate',key('Heating Coil Heating Rate',prefix,'HP HTG')),
              'supplemental':series('Heating Coil Heating Rate',key('Heating Coil Heating Rate',prefix,'SUPPLEMENTAL')),
              **{f:series(f'Cooling Coil {n} Cooling Rate',key(f'Cooling Coil {n} Cooling Rate',prefix)) for f,n in [('total','Total'),('sensible','Sensible'),('latent','Latent')]},
              'heat_rtf':series('Heating Coil Runtime Fraction',key('Heating Coil Runtime Fraction',prefix,'HP HTG')),
              'cool_rtf':series('Cooling Coil Runtime Fraction',key('Cooling Coil Runtime Fraction',prefix)),
              'room_heating':series('Zone Predicted Sensible Load to Heating Setpoint Heat Transfer Rate',zone),
              'room_cooling':series('Zone Predicted Sensible Load to Cooling Setpoint Heat Transfer Rate',zone),
              'air_C':series('Zone Mean Air Temperature',zone),'RH':series('Zone Air Relative Humidity',zone),
              **{f:series(f'System Node {n}',terminals[k],'Hourly') for f,n in [('supply_C','Temperature'),('supply_W','Humidity Ratio'),('supply_kg_s','Mass Flow Rate')]}}
    def when(t):return {'condition':env[t[0]],'hour':t[1],'minute':t[2]}
    def peak(k,field,rtf=None):
        """A runtime fraction of 1.0 at the peak means the coil is at full modeled capacity."""
        t=max(z[k][field],key=z[k][field].get);return {'W':z[k][field][t],**when(t),**({'runtime_fraction':z[k][rtf][t]} if rtf else {})}
    def coincident(fields):
        total=collections.defaultdict(float)
        for k in PREFIX:
            for f in fields:
                for t,v in z[k][f].items():total[t]+=v
        t=max(total,key=total.get);return t,total[t]
    def ventilation(t):
        """Hourly ERV supply air relative to each room: sensible and moisture load it adds to the zone heat pumps."""
        e,h,m=t;hour=h if m==0 else h+1;sensible=latent=flow=0.0
        for k in PREFIX:
            steps=[s for s in z[k]['air_C'] if s[0]==e and ((s[1]==hour-1 and s[2]>0) or (s[1]==hour and s[2]==0))];assert steps,(k,t)
            air=sum(z[k]['air_C'][s] for s in steps)/len(steps);rh=sum(z[k]['RH'][s] for s in steps)/len(steps)
            vapor=rh/100*610.94*math.exp(17.625*air/(air+243.04));room_w=0.622*vapor/(pressure[env[e].upper()]-vapor)
            mass=z[k]['supply_kg_s'][(e,hour,0)];flow+=mass
            sensible+=mass*CP*(air-z[k]['supply_C'][(e,hour,0)]);latent+=mass*HFG*(z[k]['supply_W'][(e,hour,0)]-room_w)
        supply=[(z[k]['supply_C'][(e,hour,0)],z[k]['supply_kg_s'][(e,hour,0)]) for k in PREFIX if z[k]['supply_kg_s'][(e,hour,0)]>0];assert supply,t
        return sensible,latent,flow,sum(c*m for c,m in supply)/sum(m for _,m in supply)
    th,heating=coincident(['heat','supplemental']);vent_heat,_,flow_heat,supply_heat=ventilation(th)
    room_heat=sum(max(0.0,z[k]['room_heating'][th]) for k in PREFIX) # Positive when heating is needed; cooling below is negative.
    tc,total=coincident(['total']);vent_sens,vent_lat,flow_cool,supply_cool=ventilation(tc)
    room_cool=sum(max(0.0,-z[k]['room_cooling'][tc]) for k in PREFIX)
    coil_sens=sum(z[k]['sensible'][tc] for k in PREFIX);coil_lat=sum(z[k]['latent'][tc] for k in PREFIX)
    ts,sensible=coincident(['sensible'])
    # EnergyPlus standard air density (dry air, 20 C) at the design-day pressure converts the ERV mass flow to volume.
    density=pressure[env[th[0]].upper()]/(287.04*293.15)
    fans=[k for (k,) in c.execute("select distinct KeyValue from ReportDataDictionary where Name='Fan Electricity Energy' and KeyValue like '%WSHP FAN'")]
    assert len(fans)==4
    step=3600/int(next(o for o in idf if o[0].lower()=='timestep')[1])
    fan_W=lambda t:sum(series('Fan Electricity Energy',f)[t] for f in fans)/step
    bridge={'heating':{**when(th),'room_sensible_W':room_heat,'ventilation_sensible_W':vent_heat,'fan_and_other_W':heating-room_heat-vent_heat,'coil_W':heating,
                       'erv_supply_m3_s':flow_heat/density,'erv_supply_C':supply_heat,'unit_fan_W':fan_W(th)},
            'cooling':{**when(tc),'room_sensible_W':room_cool,'ventilation_sensible_W':-vent_sens,'fan_and_other_W':coil_sens-room_cool+vent_sens,'coil_sensible_W':coil_sens,
                       'room_latent_W':coil_lat-vent_lat,'ventilation_latent_W':vent_lat,'coil_latent_W':coil_lat,'coil_total_W':total,
                       'erv_supply_m3_s':flow_cool/density,'erv_supply_C':supply_cool,'unit_fan_W':fan_W(tc)},
            'air_density_kg_m3':density}
    zones={k:{'heating':peak(k,'heat','heat_rtf'),'total_cooling':peak(k,'total','cool_rtf'),'sensible_cooling':peak(k,'sensible'),'supplemental_heating_W':max(z[k]['supplemental'].values())} for k in PREFIX}
    rows=c.execute("select TableName,RowName,ColumnName,Value from TabularDataWithStrings where ReportName='Facility Component Load Summary' and ReportForString='Facility'").fetchall()
    table=collections.defaultdict(dict)
    for name,row,column,value in rows:table[name].setdefault(row,{})[column]=value.strip()
    number=lambda v:float(v) if v not in ('',None) else 0.0
    def components(name):
        return [{'component':r,'sensible_W':number(table[name][r].get('Sensible - Instant'))+number(table[name][r].get('Sensible - Delayed')),
                 'latent_W':number(table[name][r].get('Latent'))} for r in COMPONENTS]
    peaks={'cooling':table['Cooling Peak Conditions']['Time of Peak Load']['Value'],'heating':table['Heating Peak Conditions']['Time of Peak Load']['Value']}
    # Identify each component-summary peak by its outdoor dry bulb.
    peak_day={side:next(o[1] for o in design if (o[4]=='WinterDesignDay')==(side=='heating') and abs(float(o[5])-float(table[f'{side.title()} Peak Conditions']['Outside Dry Bulb Temperature']['Value']))<0.05) for side in ['cooling','heating']}
    c.close()
    return {'zones':zones,'coincident':{'heating_W':heating,**{f'heating_{k}':v for k,v in when(th).items()},'total_cooling_W':total,**{f'total_cooling_{k}':v for k,v in when(tc).items()},
            'sensible_cooling_W':sensible,**{f'sensible_cooling_{k}':v for k,v in when(ts).items()}},'room_to_coil':bridge,
            'room_load_components':{'cooling':components('Estimated Cooling Peak Load Components'),'heating':components('Estimated Heating Peak Load Components'),
                                    'cooling_time':peaks['cooling'],'heating_time':peaks['heating'],'cooling_condition':peak_day['cooling'],'heating_condition':peak_day['heating']}}

def design_day_programs(inputs:dict)->dict:
    """Per zone, what the winter and summer design-day schedules switch on, from the exported SI inputs."""
    def window(values):
        on=[i for i,v in enumerate(values) if v>0]
        if not on:return None
        return [on[0]*15,(on[-1]+1)*15]  # minutes from midnight, 15-minute schedule steps
    out={}
    for key,prefix in PREFIX.items():
        zone=next(z for z in inputs['zones'] if z['id'].upper().startswith(prefix))
        loads,refs,area=zone['loads'],zone['schedule_refs'],zone['floor_area_m2']
        sched=lambda ref,season:inputs['schedules'][refs[ref]][season] if ref in refs else None
        seasons={}
        for season in ('winter_design','summer_design'):
            occ=sched('people.occupancy_schedule',season) or [0]*96
            def gain(load,ref):
                s=sched(ref,season)
                return loads[load]['watts_per_area']*area*max(s) if loads.get(load) and s else 0.0
            vent=sched('ventilation.schedule',season)
            seasons[season.split('_')[0]]={
                'people_peak':zone['design_people']*max(occ),'occupied':window(occ),
                'lighting_peak_W':gain('lighting','lighting.schedule'),'equipment_peak_W':gain('electric_equipment','electric_equipment.schedule'),
                'ventilation':None if vent is None else ('all_day' if min(vent)>0 else window(vent)),
                'heating_setpoint_C':sorted(set(sched('setpoint.heating_schedule',season))),'cooling_setpoint_C':sorted(set(sched('setpoint.cooling_schedule',season)))}
        out[key]=seasons
    return out

def main() -> None:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh',action='store_true')
    args=parser.parse_args()
    config=json.loads((ROOT/'report.json').read_text())
    if args.refresh:
        PRIVATE.mkdir(parents=True,exist_ok=True)
        run=(ROOT/config['design_day_run']).resolve()
        review=json.loads((ROOT/config['design_day_review']).read_text())
        for relative in ['out.osw','run/in.idf','run/in.osm','run/eplusout.sql','run/eplusout.err']:
            path=run/relative
            assert digest(path)==review['source_hashes'][str(path.relative_to(ROOT.parent))],path
            shutil.copyfile(path,PRIVATE/path.name)
        model=next(run.glob('*.hbjson'))
        assert digest(model)==review['source_hashes'][str(model.relative_to(ROOT.parent))]
        for setting,name in [('design_day_review','review.json'),('design_day_verification','verification.json'),('design_day_input_match','input_match.json')]:
            shutil.copyfile(ROOT/config[setting],PRIVATE/name)
        write_json(PRIVATE/'source.json',{'run':str(run.relative_to(ROOT.parent)),
            'hbjson_sha256':digest(model),'files':{p.name:digest(p) for p in PRIVATE.iterdir() if p.is_file() and p.name!='source.json'}})
    source=json.loads((PRIVATE/'source.json').read_text())
    for name,sha in source['files'].items():assert digest(PRIVATE/name)==sha,name
    review=json.loads((PRIVATE/'review.json').read_text())
    verified=json.loads((PRIVATE/'verification.json').read_text())
    matched=json.loads((PRIVATE/'input_match.json').read_text())
    annual=json.loads((SITE/'data/results.json').read_text())
    assert verified['success'] and matched['success']
    assert matched['annual_input_sha256']==annual['release']['source']['hbjson_sha256']
    assert matched['design_input_sha256']==source['hbjson_sha256']
    idf=objects(PRIVATE/'in.idf')
    design=[o for o in idf if o[0].lower()=='sizingperiod:designday']
    assert len(design)==review['sizing_days']==4 and review['weather_run_environments']==0
    # SizingPeriod:DesignDay fields: date, peak dry bulb, daily range, moisture, wind and sky model, as EnergyPlus runs them.
    conditions=[{'name':o[1],'label':'Winter DB' if o[4]=='WinterDesignDay' else 'Summer '+('DP' if 'DP=>' in o[1] else 'WB' if 'WB=>' in o[1] else 'DB'),
                 'dry_bulb_C':float(o[5]),'humidity_basis':o[9],'humidity_value_C':float(o[10]),
                 'season':'heating' if o[4]=='WinterDesignDay' else 'cooling','annual_percentile':'99.6%' if '99.6%' in o[1] else '0.4%',
                 'month':int(o[2]),'day':int(o[3]),'daily_range_K':float(o[6]),'wind_m_s':float(o[16]),'sky_model':o[21],
                 'sky_clearness':float(o[26]) if o[21]=='ASHRAEClearSky' and o[26] else None} for o in design]
    programs=design_day_programs(json.loads((SITE/'data/inputs.json').read_text()))
    units={}
    for key in PREFIX:
        hp=next(o for o in idf if o[0].lower()=='zonehvac:watertoairheatpump' and o[1].startswith(PREFIX[key]))
        heating=next(o for o in idf if o[0].lower()=='coil:heating:watertoairheatpump:equationfit' and o[1]==hp[17])
        cooling=next(o for o in idf if o[0].lower()=='coil:cooling:watertoairheatpump:equationfit' and o[1]==hp[19])
        units[key]={'rated_heating_W':float(heating[8]),'rated_total_cooling_W':float(cooling[8]),'rated_sensible_cooling_W':float(cooling[9]),
                    'airflow_m3_s':float(heating[6]),'source_water_flow_m3_s':float(heating[7])}
    analysis=coil_analysis(PRIVATE/'eplusout.sql',idf,design)
    zones=[]
    for key,prefix in PREFIX.items():
        loads={load.lower():next(r[3] for r in review['zone_sizes'] if r[1].startswith(prefix) and r[2]==load) for load in ['Heating','Cooling']}
        days=verified['operating_summary'][key]
        summer=[v for n,v in days.items() if 'CLG' in n];winter=next(v for n,v in days.items() if 'HTG' in n)
        zones.append({'id':key,'label':LABELS[key],'heating_room_load_W':loads['heating'],'sensible_cooling_room_load_W':loads['cooling'],
            'winter_min_air_C':winter['min_air_C'],'summer_max_air_C':max(v['max_air_C'] for v in summer),
            'summer_max_RH_percent':max(v['max_RH_percent'] for v in summer),'maximum_backup_W':max(v['max_backup_W'] for v in days.values()),
            'equipment':units[key],'coil':analysis['zones'][key],'conditions':[{'name':n,**v} for n,v in days.items()]})
    data={'schema_version':1,'release':{'id':'design-days-2026-four-conditions-sized','review_date':'2026-10-21','status':'reviewed_design_model',
        'source':{**source,'idf_sha256':digest(PRIVATE/'in.idf'),'osm_sha256':digest(PRIVATE/'in.osm'),'sql_sha256':digest(PRIVATE/'eplusout.sql'),
                  'energyplus':'25.1.0','openstudio':'3.10.0','annual_hbjson_sha256':matched['annual_input_sha256'],'physical_inputs_match_annual':True}},
        'conditions':conditions,'design_day_programs':programs,'zones':zones,'coincident_room_loads_W':{k:v['peak_W'] for k,v in review['coincident_zone_loads'].items()},
        'operating_coil_peaks':review['diagnostics']['coincident_operating_coil_peaks'],
        'coil_peaks':analysis['coincident'],'room_to_coil':analysis['room_to_coil'],'room_load_components':analysis['room_load_components'],
        'controls':{'timesteps_per_hour':12,'sizing_average_minutes':15,'heating_factor':1,'cooling_factor':1,'windows_closed':True,'equipment_sequence':'ERV, WSHP, supplemental dehumidifier',
                    'heating_setpoint_C':21.1111111111,'cooling_setpoint_C':23.8888888889,'slab_ground_C':18.0,'ERV_channels_verified':13,'severe_errors':0},
        'basis':'Room loads are unfactored sensible thermal loads. Individual zone peaks are noncoincident. Detailed coil output includes ventilation and latent effects. Rated equipment inputs are provisional allowances.',
        'sizing_notes':['ERV heat recovery is a provisional 75% sensible and 50% latent, with frost control at a {temperature:0} minimum exhaust temperature. Frost control lowers the winter supply temperature, and the coil heating above includes it. The selected ERV sets the actual winter coil load.',
                        'Infiltration is a constant design rate until the airtightness basis is set. Its share of the room loads is in the component table.',
                        f"On the summer design day the Core kettle and dishwasher run at full draw at the {analysis['room_load_components']['cooling_time'].split()[1][:5]} building room-load peak.",
                        'Design days use a constant {temperature:18} slab ground, which credits the slab with some summer cooling. The annual run models the ground with Kiva and has warmer summer soil.',
                        'Heat-pump performance curves and entering-water temperatures are generic, and the ground loop is a fixed-temperature stand-in for a borefield. MEP and manufacturer data replace both.',
                        'Community-event occupancy and additional summer weather cases are not yet run.',
                        'These results do not size the borefield or select equipment.']}
    write_json(SITE/'downloads/design-day-results.json',data)
    buf=io.StringIO(newline='');writer=csv.writer(buf)
    writer.writerow(['zone','room_heating_W','room_sensible_cooling_W','rated_heating_W','rated_total_cooling_W','rated_sensible_cooling_W','unit_airflow_m3_s','source_water_flow_m3_s','winter_min_air_C','summer_max_air_C','summer_max_RH_percent','coil_heating_W','coil_sensible_cooling_W','coil_total_cooling_W'])
    for z in zones:
        e,k=z['equipment'],z['coil'];writer.writerow([z['label'],z['heating_room_load_W'],z['sensible_cooling_room_load_W'],e['rated_heating_W'],e['rated_total_cooling_W'],e['rated_sensible_cooling_W'],e['airflow_m3_s'],e['source_water_flow_m3_s'],z['winter_min_air_C'],z['summer_max_air_C'],z['summer_max_RH_percent'],k['heating']['W'],k['sensible_cooling']['W'],k['total_cooling']['W']])
    (SITE/'downloads/design-day-loads.csv').write_text(buf.getvalue())
    annual['design_days']=data
    next(x for x in annual['areas'] if x['id']=='peaks').update(
        status='reviewed', title='Design-day loads',
        subtitle='Winter and summer sensible/humidity conditions',
        description='Four reviewed annual design conditions: room loads, heat-pump coil loads and operating checks; equipment allowances remain provisional.',
        sections=['Winter DB','Summer DB','Summer DP','Summer WB'])
    write_json(SITE/'data/results.json',annual)
    write_json(SITE/'downloads/annual-results.json',annual)
    print('PASS: four reviewed design conditions, loads, operating checks and separate provenance exported.')

if __name__=='__main__':main()

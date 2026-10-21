"""Publish the reviewed four-condition package separately from annual energy."""
from __future__ import annotations
import argparse,csv,io,json,shutil
from pathlib import Path
from export_results import digest,objects,write_json

ROOT=Path(__file__).resolve().parents[1]
PRIVATE=ROOT/'_private/design_days'
SITE=ROOT/'site'
PREFIX={'labs':'LEARNING-LABS_','visitor':'VISITOR-CENTER_','core':'MAIN_','restrooms':'BATHROOMS_'}
LABELS={'labs':'Learning Labs','visitor':'Visitor Center','core':'Core','restrooms':'Restrooms'}

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
    conditions=[{'name':o[1],'label':'Winter DB' if o[4]=='WinterDesignDay' else 'Summer '+('DP' if 'DP=>' in o[1] else 'WB' if 'WB=>' in o[1] else 'DB'),
                 'dry_bulb_C':float(o[5]),'humidity_basis':o[9],'humidity_value_C':float(o[10])} for o in design]
    units={}
    for key in PREFIX:
        hp=next(o for o in idf if o[0].lower()=='zonehvac:watertoairheatpump' and o[1].startswith(PREFIX[key]))
        heating=next(o for o in idf if o[0].lower()=='coil:heating:watertoairheatpump:equationfit' and o[1]==hp[17])
        cooling=next(o for o in idf if o[0].lower()=='coil:cooling:watertoairheatpump:equationfit' and o[1]==hp[19])
        units[key]={'rated_heating_W':float(heating[8]),'rated_total_cooling_W':float(cooling[8]),'rated_sensible_cooling_W':float(cooling[9]),
                    'airflow_m3_s':float(heating[6]),'source_water_flow_m3_s':float(heating[7])}
    zones=[]
    for key,prefix in PREFIX.items():
        loads={load.lower():next(r[3] for r in review['zone_sizes'] if r[1].startswith(prefix) and r[2]==load) for load in ['Heating','Cooling']}
        days=verified['operating_summary'][key]
        summer=[v for n,v in days.items() if 'CLG' in n];winter=next(v for n,v in days.items() if 'HTG' in n)
        zones.append({'id':key,'label':LABELS[key],'heating_room_load_W':loads['heating'],'sensible_cooling_room_load_W':loads['cooling'],
            'winter_min_air_C':winter['min_air_C'],'summer_max_air_C':max(v['max_air_C'] for v in summer),
            'summer_max_RH_percent':max(v['max_RH_percent'] for v in summer),'maximum_backup_W':max(v['max_backup_W'] for v in days.values()),
            'equipment':units[key],'conditions':[{'name':n,**v} for n,v in days.items()]})
    data={'schema_version':1,'release':{'id':'design-days-2026-four-conditions-sized','review_date':'2026-10-20','status':'reviewed_design_model',
        'source':{**source,'idf_sha256':digest(PRIVATE/'in.idf'),'osm_sha256':digest(PRIVATE/'in.osm'),'sql_sha256':digest(PRIVATE/'eplusout.sql'),
                  'energyplus':'25.1.0','openstudio':'3.10.0','annual_hbjson_sha256':matched['annual_input_sha256'],'physical_inputs_match_annual':True}},
        'conditions':conditions,'zones':zones,'coincident_room_loads_W':{k:v['peak_W'] for k,v in review['coincident_zone_loads'].items()},
        'operating_coil_peaks':review['diagnostics']['coincident_operating_coil_peaks'],
        'controls':{'timesteps_per_hour':12,'sizing_average_minutes':15,'heating_factor':1,'cooling_factor':1,'windows_closed':True,'equipment_sequence':'ERV, WSHP, supplemental dehumidifier',
                    'heating_setpoint_C':21.1111111111,'cooling_setpoint_C':23.8888888889,'ERV_channels_verified':13,'severe_errors':0},
        'basis':'Room loads are unfactored sensible thermal loads in W. Individual zone peaks are noncoincident. Detailed coil output includes ventilation and latent effects. Rated equipment inputs are provisional allowances.',
        'limitations':['Ground-source entering-water temperatures and performance curves need MEP/manufacturer confirmation; the template uses an EMS temperature surrogate.',
                      'Labs has no supplemental humidity control and reaches 63.62% RH; Visitor/Core remain below 60% in these design-day tests.',
                      'Separate community-event and additional summer solar/weather sensitivities remain to be evaluated before final equipment selection.',
                      'This is a design-analysis model. The results do not size the borefield or establish a final equipment selection.']}
    write_json(SITE/'downloads/design-day-results.json',data)
    buf=io.StringIO(newline='');writer=csv.writer(buf)
    writer.writerow(['zone','room_heating_W','room_sensible_cooling_W','rated_heating_W','rated_total_cooling_W','rated_sensible_cooling_W','unit_airflow_m3_s','source_water_flow_m3_s','winter_min_air_C','summer_max_air_C','summer_max_RH_percent'])
    for z in zones:
        e=z['equipment'];writer.writerow([z['label'],z['heating_room_load_W'],z['sensible_cooling_room_load_W'],e['rated_heating_W'],e['rated_total_cooling_W'],e['rated_sensible_cooling_W'],e['airflow_m3_s'],e['source_water_flow_m3_s'],z['winter_min_air_C'],z['summer_max_air_C'],z['summer_max_RH_percent']])
    (SITE/'downloads/design-day-loads.csv').write_text(buf.getvalue())
    annual['design_days']=data
    next(x for x in annual['areas'] if x['id']=='peaks').update(
        status='reviewed', title='Design-day loads',
        subtitle='Winter and summer sensible/humidity conditions',
        description='Four reviewed annual design conditions, room loads and operating checks; equipment allowances remain provisional.',
        sections=['Winter DB','Summer DB','Summer DP','Summer WB'])
    write_json(SITE/'data/results.json',annual)
    write_json(SITE/'downloads/annual-results.json',annual)
    print('PASS: four reviewed design conditions, loads, operating checks and separate provenance exported; resilience remains pending.')

if __name__=='__main__':main()

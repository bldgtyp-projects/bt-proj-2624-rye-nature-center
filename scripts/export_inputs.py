"""Export a read-only HBJSON snapshot using the installed Ladybug Tools runtime."""
from __future__ import annotations
import csv
import argparse
import hashlib
import importlib.metadata
import io
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from honeybee.model import Model
from honeybee_energy.schedule.ruleset import ScheduleRuleset

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
SOURCE = ROOT / '_private/input.hbjson'
PARAMS = ROOT / '_private/simulation_parameter.json'
NAMES = {'LEARNING-LABS': 'Learning labs', 'VISITOR-CENTER': 'Visitor center', 'MAIN': 'Core', 'BATHROOMS': 'Restrooms'}

def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')

def csv_text(rows: list) -> str:
    buf = io.StringIO(newline='')
    writer = csv.writer(buf)
    writer.writerows(rows)
    return buf.getvalue()

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true', help='Capture the sources named in report.json before export.')
    args = parser.parse_args()
    SOURCE.parent.mkdir(exist_ok=True)
    config = json.loads((ROOT / 'report.json').read_text())
    if args.refresh:
        model_bytes = (ROOT / config['input_source']).read_bytes()
        parameter_bytes = (ROOT / config['simulation_parameters']).read_bytes()
        SOURCE.write_bytes(model_bytes)
        PARAMS.write_bytes(parameter_bytes)
        (ROOT / '_private/final.idf').write_bytes((ROOT / config['final_idf']).read_bytes())
        write_json(ROOT / '_private/snapshot.json', {key:config[key] for key in ('input_source','simulation_parameters','snapshot_label','final_idf')})
    snapshot = json.loads((ROOT / '_private/snapshot.json').read_text())
    params = json.loads(PARAMS.read_text())
    rp = params['run_period']
    final_idf = ROOT / '_private/final.idf'
    objects = [[v.strip() for v in o.strip().split(',')] for o in re.sub(r'!.*', '', final_idf.read_text()).split(';') if o.strip()]
    run = next(o for o in objects if o[0].lower() == 'runperiod')
    assert run[2:8] == ['1','1','2026','12','31','2026']
    effective_day = run[8]
    if rp['leap_year'] or rp['start_date'] != [1, 1] or rp['end_date'] != [12, 31]:
        raise ValueError('Exporter currently requires a full non-leap annual calendar.')
    model = Model.from_hbjson(str(SOURCE))
    model.convert_to_units('Meters')
    schedules: dict = {}
    zones = []
    geometry = []
    csv_rows = [['zone_id', 'zone', 'floor_area_m2', 'design_people', 'lighting_W_m2', 'equipment_W_m2', 'oa_m3_s_person', 'oa_m3_s_m2', 'infiltration_m3_s_m2_exterior']]
    archive = ZipFile(SITE / 'downloads/schedules.zip', 'w', ZIP_DEFLATED)
    for room in model.rooms:
        e = room.properties.energy
        refs = {}
        for key in ('people', 'lighting', 'electric_equipment', 'gas_equipment', 'service_hot_water', 'ventilation', 'infiltration', 'setpoint'):
            load = getattr(e, key, None)
            if load is None:
                continue
            for attr in ('occupancy_schedule', 'activity_schedule', 'schedule', 'heating_schedule', 'cooling_schedule', 'humidifying_schedule', 'dehumidifying_schedule'):
                schedule = getattr(load, attr, None)
                if schedule is not None:
                    refs[f'{key}.{attr}'] = schedule.identifier
                    schedules[schedule.identifier] = schedule
        people = e.people.people_per_area * room.floor_area if e.people else 0
        zone = {'id': room.identifier, 'name': NAMES.get(room.display_name, room.display_name), 'source_name': room.display_name, 'program_id': e.program_type.identifier,
                'floor_area_m2': room.floor_area, 'volume_m3': room.volume, 'design_people': people,
                'loads': {key: getattr(e, key).to_dict(abridged=True) if getattr(e, key, None) else None for key in ('people','lighting','electric_equipment','gas_equipment','service_hot_water','ventilation','infiltration','setpoint')},
                'schedule_refs': refs, 'hvac_id': e.hvac.identifier if e.hvac else None,
                'internal_mass': [v.to_dict() for v in e.internal_masses]}
        zones.append(zone)
        csv_rows.append([room.identifier, zone['name'], room.floor_area, people, e.lighting.watts_per_area if e.lighting else '', e.electric_equipment.watts_per_area if e.electric_equipment else '',
                         e.ventilation.flow_per_person if e.ventilation else '', e.ventilation.flow_per_area if e.ventilation else '', e.infiltration.flow_per_exterior_area if e.infiltration else ''])
        for face in room.faces:
            items = [(face.identifier, face.type.name, face.punched_geometry)]
            items.extend((a.identifier, 'Aperture', a.geometry) for a in face.apertures)
            items.extend((a.identifier, 'Door', a.geometry) for a in face.doors)
            for ident, kind, geo in items:
                mesh = geo.triangulated_mesh3d
                geometry.append({'id': ident, 'zone': room.identifier, 'kind': kind, 'vertices': [[p.x,p.y,p.z] for p in mesh.vertices], 'triangles': mesh.faces})
    exported = {}
    for ident, schedule in sorted(schedules.items()):
        if not isinstance(schedule, ScheduleRuleset):
            raise ValueError(f'Unsupported schedule {ident}: {type(schedule).__name__}')
        collection = schedule.data_collection(timestep=4, start_dow=effective_day)
        values = list(collection.values)
        assert len(values) == 35040
        profiles = []
        by_day = []
        for i in range(365):
            day = values[i*96:(i+1)*96]
            if day not in profiles:
                profiles.append(day)
            by_day.append(profiles.index(day))
        exported[ident] = {'unit': collection.header.unit, 'profiles': profiles, 'annual_days': by_day,
                           'winter_design': (schedule.winter_designday_schedule or schedule.default_day_schedule).values_at_timestep(4),
                           'summer_design': (schedule.summer_designday_schedule or schedule.default_day_schedule).values_at_timestep(4), 'definition': schedule.to_dict()}
        rows = [['month','day','interval_start_local_standard_time','value','unit']]
        for dt, value in zip(collection.datetimes, values):
            rows.append([dt.month, dt.day, f'{dt.hour:02d}:{dt.minute:02d}', value, collection.header.unit])
        archive.writestr(f'{ident}.csv', csv_text(rows))
        for season in ('winter','summer'):
            archive.writestr(f'{ident}_{season}_design.csv', csv_text([['interval_start_local_standard_time','value','unit']] + [[f'{i//4:02d}:{i%4*15:02d}',v,collection.header.unit] for i,v in enumerate(exported[ident][f'{season}_design'])]))
    archive.close()
    data = {'schema_version':1, 'exported_at':datetime.now(timezone.utc).isoformat(), 'status':'Draft input snapshot',
            'snapshot_label':snapshot['snapshot_label'],
            'source':{'path':str(Path(snapshot['input_source']).relative_to('..')), 'sha256':digest(SOURCE), 'simulation_parameters_sha256':digest(PARAMS), 'final_idf_sha256':digest(final_idf), 'honeybee_core':importlib.metadata.version('honeybee-core'), 'honeybee_energy':importlib.metadata.version('honeybee-energy')},
            'calendar':{'year':2026,'days':365,'jan_1_day':effective_day,'saved_parameter_jan_1_day':rp['start_day_of_week'],'steps_per_hour':4,'time_basis':'2026 calendar, January 1 on a Thursday. Times mark the start of each interval, in local standard time with no daylight saving and no holidays.'},
            'notes':['Reference People is the occupant density times modeled floor area.', 'Modeled floor area comes from the energy-model geometry and differs from the architectural gross area.'],
            'zones':zones,'schedules':exported}
    write_json(SITE / 'data/inputs.json', data)
    shades = []
    for shade in model.shades:
        mesh = shade.geometry.triangulated_mesh3d
        shades.append({'id': shade.identifier, 'group': shade.display_name, 'vertices': [[p.x,p.y,p.z] for p in mesh.vertices], 'triangles': mesh.faces})
    write_json(SITE / 'data/geometry.json', {'units':'m','source_sha256':digest(SOURCE),'surfaces':geometry,'shades':shades})
    (SITE / 'downloads/zone-inputs.csv').write_text(csv_text(csv_rows))
    write_json(SITE / 'downloads/program-definitions.json', data)
    print(f'Exported {len(zones)} zones, {len(exported)} schedules, {len(geometry)} surfaces, {len(shades)} shades. Source {digest(SOURCE)[:12]}')

if __name__ == '__main__':
    main()

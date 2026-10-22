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

def cardinal(face) -> str:
    # EnergyPlus Window-Wall Ratio bins: North 315 to 45 degrees, East 45 to 135, and so on.
    azimuth = face.horizontal_orientation() % 360
    return ['North', 'East', 'South', 'West'][int(((azimuth + 45) % 360) // 90)]

def envelope(model: Model) -> tuple[dict, list]:
    """Exterior assemblies, windows by orientation and infiltration, from the native constructions."""
    kinds = {('Wall', 'Outdoors'): ('wall', 'Exterior wall'), ('RoofCeiling', 'Outdoors'): ('roof', 'Roof'), ('Floor', 'Ground'): ('floor', 'Slab on grade')}
    assemblies: dict = {}
    windows: dict = {}
    directions = {d: {'direction': d, 'wall_gross_m2': 0.0, 'window_m2': 0.0} for d in ('North', 'East', 'South', 'West')}
    exterior_m2 = 0.0
    for face in model.faces:
        bc = face.boundary_condition.name
        if bc not in ('Outdoors', 'Ground'):
            continue
        if (face.type.name, bc) not in kinds or face.doors:
            raise ValueError(f'Envelope summary does not handle {face.type.name}/{bc} faces or doors: {face.identifier}')
        kind, label = kinds[(face.type.name, bc)]
        c = face.properties.energy.construction
        a = assemblies.setdefault(c.identifier, {'id': c.identifier, 'kind': kind, 'label': label, 'gross_area_m2': 0.0, 'net_area_m2': 0.0,
              'u_value_W_m2K': c.u_factor, 'r_value_m2K_W': 1 / c.u_factor, 'layers': [
                  {'name': m.display_name, 'thickness_m': m.thickness, 'conductivity_W_mK': m.conductivity, 'r_value_m2K_W': m.r_value}
                  for m in c.materials]})
        assert a['kind'] == kind, c.identifier
        a['gross_area_m2'] += face.area
        a['net_area_m2'] += face.punched_geometry.area
        if bc == 'Outdoors':
            exterior_m2 += face.area
        if kind == 'wall':
            directions[cardinal(face)]['wall_gross_m2'] += face.area
        for aperture in face.apertures:
            glazing = aperture.properties.energy.construction
            (material,) = glazing.materials
            w = windows.setdefault(glazing.identifier, {'id': glazing.identifier, 'label': 'Skylights' if kind == 'roof' else 'Windows', 'count': 0, 'area_m2': 0.0,
                  'u_value_W_m2K': material.u_factor, 'shgc': material.shgc, 'vt': material.vt, 'by_direction_m2': {}})
            assert w['label'] == ('Skylights' if kind == 'roof' else 'Windows'), glazing.identifier
            w['count'] += 1
            w['area_m2'] += aperture.area
            if kind == 'wall':
                directions[cardinal(face)]['window_m2'] += aperture.area
                w['by_direction_m2'][cardinal(face)] = w['by_direction_m2'].get(cardinal(face), 0.0) + aperture.area
    for d in directions.values():
        d['window_wall_ratio'] = d['window_m2'] / d['wall_gross_m2']
    roof = [a for a in assemblies.values() if a['kind'] == 'roof']
    skylight_m2 = sum(w['area_m2'] for w in windows.values() if w['label'] == 'Skylights')
    infiltration = {e.infiltration.flow_per_exterior_area for e in (r.properties.energy for r in model.rooms)}
    (flow_per_area,) = infiltration
    data = {'assemblies': sorted(assemblies.values(), key=lambda a: ['wall', 'roof', 'floor'].index(a['kind'])),
            'windows': sorted(windows.values(), key=lambda w: w['label'] != 'Windows'),
            'orientations': list(directions.values()),
            'skylight_roof_ratio': skylight_m2 / sum(a['gross_area_m2'] for a in roof),
            'infiltration': {'flow_per_exterior_area_m3_s_m2': flow_per_area, 'exterior_area_m2': exterior_m2, 'flow_m3_s': flow_per_area * exterior_m2,
                             'ach': flow_per_area * exterior_m2 * 3600 / sum(r.volume for r in model.rooms)},
            'notes': ['U-values include standard inside and outside air films. Opaque values are clear-field: framing is blended into the cavity layers, and no junction thermal bridges are modeled.',
                      'Windows and skylights are single whole-unit values (U-value, SHGC and visible transmittance). Frames are not modeled separately. Product and frame specifications are provisional.',
                      'The slab U-value is the floor assembly alone. The annual model adds the Kiva two-dimensional ground model with 2 in perimeter XPS; the design-day model holds the ground at a constant {temperature:18}.',
                      'Infiltration is a constant flow per unit of above-grade exterior surface area (walls and roofs, including windows), always on, with no wind or temperature dependence.']}
    rows = [['element', 'construction', 'direction', 'gross_area_m2', 'net_area_m2', 'u_value_W_m2K_with_films', 'r_value_m2K_W_with_films', 'shgc', 'visible_transmittance', 'infiltration_m3_s_per_m2_exterior', 'infiltration_m3_s']]
    for a in data['assemblies']:
        rows.append([a['label'], a['id'], '', a['gross_area_m2'], a['net_area_m2'], a['u_value_W_m2K'], a['r_value_m2K_W'], '', '', '', ''])
    for w in data['windows']:
        for direction, area in sorted(w['by_direction_m2'].items()) or [('Roof', w['area_m2'])]:
            rows.append([w['label'], w['id'], direction, area, area, w['u_value_W_m2K'], 1 / w['u_value_W_m2K'], w['shgc'], w['vt'], '', ''])
    i = data['infiltration']
    rows.append(['Infiltration', 'above-grade exterior surface', '', i['exterior_area_m2'], '', '', '', '', '', i['flow_per_exterior_area_m3_s_m2'], i['flow_m3_s']])
    return data, rows

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
    envelope_data, envelope_rows = envelope(model)
    (SITE / 'downloads/envelope-summary.csv').write_text(csv_text(envelope_rows))
    data ={'schema_version':1, 'exported_at':datetime.now(timezone.utc).isoformat(), 'status':'Draft input snapshot',
            'snapshot_label':snapshot['snapshot_label'],
            'source':{'path':str(Path(snapshot['input_source']).relative_to('..')), 'sha256':digest(SOURCE), 'simulation_parameters_sha256':digest(PARAMS), 'final_idf_sha256':digest(final_idf), 'honeybee_core':importlib.metadata.version('honeybee-core'), 'honeybee_energy':importlib.metadata.version('honeybee-energy')},
            'calendar':{'year':2026,'days':365,'jan_1_day':effective_day,'saved_parameter_jan_1_day':rp['start_day_of_week'],'steps_per_hour':4,'time_basis':'2026 calendar, January 1 on a Thursday. Times mark the start of each interval, in local standard time with no daylight saving and no holidays.'},
            'notes':['Reference People is the occupant density times modeled floor area.', 'Modeled floor area comes from the energy-model geometry and differs from the architectural gross area.'],
            'zones':zones,'envelope':envelope_data,'schedules':exported}
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

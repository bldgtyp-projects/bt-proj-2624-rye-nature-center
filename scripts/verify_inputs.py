"""Compare the client projection and CSV downloads against native Honeybee objects."""
from __future__ import annotations
import csv
import hashlib
import io
import json
import math
import sqlite3
from pathlib import Path
from zipfile import ZipFile
from honeybee.model import Model

ROOT = Path(__file__).resolve().parents[1]

def main() -> None:
    site = ROOT / 'site'
    data = json.loads((site / 'data/inputs.json').read_text())
    source = ROOT / '_private/input.hbjson'
    assert hashlib.sha256(source.read_bytes()).hexdigest() == data['source']['sha256']
    assert hashlib.sha256((ROOT / '_private/simulation_parameter.json').read_bytes()).hexdigest() == data['source']['simulation_parameters_sha256']
    assert hashlib.sha256((ROOT / '_private/final.idf').read_bytes()).hexdigest() == data['source']['final_idf_sha256']
    assert data['calendar']['jan_1_day'] == 'Thursday'
    assert json.loads((site / 'downloads/program-definitions.json').read_text()) == data
    model = Model.from_hbjson(str(source))
    model.convert_to_units('Meters')
    assert len(model.rooms) == len(data['zones']) == 4
    zone_rows = list(csv.DictReader(io.StringIO((site / 'downloads/zone-inputs.csv').read_text())))
    assert len(zone_rows) == 4
    native_schedules = {}
    for zone, room, row in zip(data['zones'], model.rooms, zone_rows):
        assert zone['id'] == room.identifier
        assert row['zone_id'] == room.identifier
        assert math.isclose(zone['floor_area_m2'],room.floor_area,rel_tol=1e-10)
        assert float(row['floor_area_m2']) == room.floor_area
        energy = room.properties.energy
        assert float(row['design_people']) == energy.people.people_per_area * room.floor_area
        for column, load, attr in [('lighting_W_m2','lighting','watts_per_area'),('equipment_W_m2','electric_equipment','watts_per_area'),('oa_m3_s_person','ventilation','flow_per_person'),('oa_m3_s_m2','ventilation','flow_per_area'),('infiltration_m3_s_m2_exterior','infiltration','flow_per_exterior_area')]:
            obj = getattr(energy,load)
            assert (float(row[column]) if row[column] else None) == (getattr(obj,attr) if obj else None)
        for key,value in zone['loads'].items():
            native = getattr(room.properties.energy,key)
            assert value == (json.loads(json.dumps(native.to_dict(abridged=True))) if native else None), (zone['id'],key)
        for key, ident in zone['schedule_refs'].items():
            load,attr = key.split('.')
            native_schedules[ident] = getattr(getattr(room.properties.energy,load),attr)
    with ZipFile(site / 'downloads/schedules.zip') as archive:
        for ident, schedule in native_schedules.items():
            projection = data['schedules'][ident]
            values = schedule.values(timestep=4,start_dow=data['calendar']['jan_1_day'])
            flattened = [v for i in projection['annual_days'] for v in projection['profiles'][i]]
            assert flattened == list(values), ident
            rows = list(csv.DictReader(io.StringIO(archive.read(f'{ident}.csv').decode())))
            assert len(rows) == 35040
            assert [float(r['value']) for r in rows] == list(values)
            assert rows[0]['interval_start_local_standard_time'] == '00:00'
            assert rows[-1]['interval_start_local_standard_time'] == '23:45'
            for season in ('winter','summer'):
                native = getattr(schedule, f'{season}_designday_schedule') or schedule.default_day_schedule
                assert projection[f'{season}_design'] == native.values_at_timestep(4)
                rows = list(csv.DictReader(io.StringIO(archive.read(f'{ident}_{season}_design.csv').decode())))
                assert [float(r['value']) for r in rows] == native.values_at_timestep(4)
    geometry = json.loads((site / 'data/geometry.json').read_text())
    assert geometry['source_sha256'] == data['source']['sha256']
    expected = {}
    for room in model.rooms:
        for face in room.faces:
            expected[face.identifier] = face.punched_geometry.area
            for sub in list(face.apertures) + list(face.doors):
                expected[sub.identifier] = sub.geometry.area
    shade_areas = {shade.identifier: shade.area for shade in model.shades}
    assert len(expected) == len(geometry['surfaces']) and len(shade_areas) == len(geometry['shades'])
    expected.update(shade_areas)
    for surface in geometry['surfaces'] + geometry['shades']:
        area=0.0
        for triangle in surface['triangles']:
            assert len(triangle)==3
            a,b,c = [surface['vertices'][i] for i in triangle]
            u=[b[i]-a[i] for i in range(3)]; v=[c[i]-a[i] for i in range(3)]
            cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
            area += math.sqrt(sum(t*t for t in cross))/2
        assert math.isclose(area,expected[surface['id']],rel_tol=1e-6,abs_tol=1e-6), surface['id']
    envelope = data['envelope']
    rows = list(csv.DictReader(io.StringIO((site / 'downloads/envelope-summary.csv').read_text())))
    for a in envelope['assemblies']:
        row = next(r for r in rows if r['construction'] == a['id'])
        assert float(row['u_value_W_m2K_with_films']) == a['u_value_W_m2K'] and float(row['gross_area_m2']) == a['gross_area_m2']
        assert math.isclose(sum(l['r_value_m2K_W'] for l in a['layers']), 1 / next(c for c in model.properties.energy.constructions if c.identifier == a['id']).u_value, rel_tol=1e-9)
    # The simulated EnergyPlus Envelope Summary of both frozen runs must report the same envelope.
    for run in ('annual', 'design_days'):
        sql = sqlite3.connect(f'file:{ROOT / "_private" / run / "eplusout.sql"}?mode=ro', uri=True)
        table = {}
        for name, row, column, value in sql.execute("select TableName,RowName,ColumnName,Value from TabularDataWithStrings where ReportName in ('EnvelopeSummary','InputVerificationandResultsSummary') and TableName in ('Opaque Exterior','Exterior Fenestration','Window-Wall Ratio','Skylight-Roof Ratio')"):
            table.setdefault((name, row), {})[column] = value.strip()
        sql.close()
        for a in envelope['assemblies']:
            surfaces = [v for (n, _), v in table.items() if n == 'Opaque Exterior' and v.get('Construction', '').upper() == a['id'].upper()]
            assert math.isclose(sum(float(v['Gross Area']) for v in surfaces), a['gross_area_m2'], abs_tol=0.01 * len(surfaces)), (run, a['id'])
            assert math.isclose(sum(float(v['Net Area']) for v in surfaces), a['net_area_m2'], abs_tol=0.01 * len(surfaces)), (run, a['id'])
            assert all(math.isclose(float(v['U-Factor with Film']), a['u_value_W_m2K'], abs_tol=0.001) for v in surfaces), (run, a['id'])
        # EnergyPlus reports the SHGC of the layer it derives from the simple-glazing inputs (Duratherm 0.33 reads 0.331).
        for w in envelope['windows']:
            openings = [v for (n, _), v in table.items() if n == 'Exterior Fenestration' and v.get('Construction', '').upper() == w['id'].upper()]
            assert len(openings) == w['count'], (run, w['id'])
            assert math.isclose(sum(float(v['Area of Multiplied Openings']) for v in openings), w['area_m2'], abs_tol=0.01 * len(openings)), (run, w['id'])
            assert all(math.isclose(float(v['Glass U-Factor']), w['u_value_W_m2K'], abs_tol=0.001) and math.isclose(float(v['Glass SHGC']), w['shgc'], abs_tol=0.002) for v in openings), (run, w['id'])
        for o in envelope['orientations']:
            column = next(c for c in table[('Window-Wall Ratio', 'Gross Window-Wall Ratio')] if c.startswith(o['direction']))
            assert math.isclose(float(table[('Window-Wall Ratio', 'Gross Wall Area')][column]), o['wall_gross_m2'], abs_tol=0.01), (run, o['direction'])
            assert math.isclose(float(table[('Window-Wall Ratio', 'Gross Window-Wall Ratio')][column]), 100 * o['window_wall_ratio'], abs_tol=0.01), (run, o['direction'])
        assert math.isclose(float(table[('Skylight-Roof Ratio', 'Skylight-Roof Ratio')]['Total']), 100 * envelope['skylight_roof_ratio'], abs_tol=0.01), run
    print(f'PASS: 4 native zones, {len(native_schedules)} full annual schedules and 50 design profiles, CSV round trips, {len(geometry["surfaces"])} surface and {len(shade_areas)} shade mesh areas and source hashes; envelope areas, U-values, SHGC and window ratios match the Annual and Design-Day EnergyPlus Envelope Summary.')

if __name__ == '__main__':
    main()

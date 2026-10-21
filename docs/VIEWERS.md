# Browser model viewer research

Reviewed 20 October 2026. The immediate job is to explain the four thermal zones and energy-model geometry. Simulation contours, BIM editing and cloud model uploads are outside this first version.

| Option | Evidence | Fit and limits |
| --- | --- | --- |
| Honeybee Display + Ladybug VTK | [CLI documentation](https://www.ladybug.tools/honeybee-display/docs/cli/main.html) supports HBJSON to VisualizationSet and HTML with embedded VTKJS; room/face attributes can drive colors. | Most direct existing Honeybee export. HTML can be hosted beside the site in an iframe. `ladybug-vtk` is required and is absent from the installed modeling runtime. Trial it in an isolated environment before changing the modeling environment. |
| Honeybee VTK | [Repository](https://github.com/ladybug-tools/honeybee-vtk) documents `Model.from_hbjson(...).to_html(...)`. [License](https://github.com/ladybug-tools/honeybee-vtk/blob/master/LICENSE) is AGPL-3.0. | Portable export already exists. More viewer UI than this page needs; review distribution/source obligations if bundling or modifying it. No runtime or browser trial was performed. |
| OpenStudio ViewModel | [Measure README](https://github.com/NatLabRockies/openstudio-common-measures-gem/blob/develop/lib/measures/view_model/README.md) documents a web viewer using vA3C JSON and Three.js. | A useful alternative when the final OSM is the desired geometry source. The checked repository contains Three r98 resources. A local test with this project's OSM remains necessary. No measure or simulation was run for this website. |
| Ladybug Tools Spider | [Spider 2021 repository](https://github.com/ladybug-tools/spider-2021) documents HBJSON, OSM, gbXML and RAD browsing. | Existing multi-format viewer. Review current maintenance, browser dependencies and source-level embedding before selecting it; not trialed here. |
| Three.js plus a small Honeybee geometry export | [Three.js documentation](https://threejs.org/docs/) and [r180 MIT license](https://github.com/mrdoob/three.js/blob/r180/LICENSE). | Selected for the local version. Honeybee's native geometry triangulation handles concavity and aperture holes. The site only implements orbit/pan/zoom, zone isolation, roof visibility and links to Program. We own the small viewer adapter. |

## Implemented choice

The website vendors Three.js 0.180.0 and its matching OrbitControls. There is no viewer-service account or remote model endpoint. Geometry is a 64 KB JSON projection of the frozen HBJSON: 125 surfaces including windows and doors, with room IDs and meter coordinates. No material database or full HBJSON is required in the browser. Native surface areas are compared against the exported triangle areas in `verify_inputs.py`.

Colors use BLDGTYP tokens. Roofs are initially hidden; windows and doors remain visible. The viewer supports touch and mouse controls, arrow-key rotation, plus/minus zoom, and a reset button. A text zone list links directly to each zone's Program page. Site context/shades are explicitly omitted. It is an explanatory model view, not a model-checking replacement.

The exported geometry and Program share a source SHA-256. The viewer refuses to load mismatched source identities. A WebGL failure shows a route to the input data. Full HBJSON/OSM downloads should be added later only as reviewed, versioned handoff packages with the appropriate licensed-material checks.

## Vendor record

- BLDGTYP `tokens.css` and `components.css`: copied from [the live brand reference](https://bldgtyp.github.io/bt-branding/) on 20 October 2026. Icon/favicon copied from the local branding repository. Use semantic text aliases such as `--accent-text`.
- Three.js 0.180.0: `build/three.module.min.js`, `build/three.core.min.js`, `examples/jsm/controls/OrbitControls.js` from the versioned jsDelivr npm distribution. Original license retained at `site/assets/vendor/three/LICENSE`.
- Google Fonts: Outfit, Geist and Geist Mono. Font requests go to Google; project model data stays on the report origin. Font bundling is an optional later refinement.

To refresh the design system, replace the two vendored CSS files together from the branding repository, inspect the visible layouts, and record the source revision. To update Three.js, replace core/module/controls together at one exact version, retain its license, then repeat model interaction checks. Do not mix dependency releases.

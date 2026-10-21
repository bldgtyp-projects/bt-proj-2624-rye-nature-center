import * as THREE from "three";
import { OrbitControls } from "./vendor/three/OrbitControls.js";
export async function showModel(inputs) {
  const host = document.querySelector("#viewer"),
    select = document.querySelector("#model-zone");
  const response = await fetch("data/geometry.json", { cache: "no-cache" });
  if (!response.ok) throw new Error("Geometry could not be loaded");
  const geometry = await response.json();
  if (geometry.source_sha256 !== inputs.source.sha256)
    throw new Error("Geometry and inputs have different source identities");
  const tokens = getComputedStyle(document.documentElement);
  const colors = [
    "--accent",
    "--highlight",
    "--text-secondary",
    "--accent-dark",
  ].map((c) => tokens.getPropertyValue(c).trim());
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(
    tokens.getPropertyValue("--bg-section-alt").trim(),
  );
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 10000);
  camera.up.set(0, 0, 1);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.replaceChildren(renderer.domElement);
  renderer.domElement.setAttribute("aria-hidden", "true");
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  const group = new THREE.Group();
  const shadeGroup = new THREE.Group();
  scene.add(group, shadeGroup);
  scene.add(new THREE.AmbientLight(0xffffff, 2));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(-10, -20, 40);
  scene.add(light);
  for (const surface of geometry.surfaces) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(surface.vertices.flat(), 3),
    );
    geo.setIndex(surface.triangles.flat());
    geo.computeVertexNormals();
    const zoneIndex = inputs.zones.findIndex((z) => z.id === surface.zone);
    const aperture = surface.kind === "Aperture";
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: aperture ? 0xe9f6fc : colors[zoneIndex],
        side: THREE.DoubleSide,
        roughness: 1,
        transparent: aperture,
        opacity: aperture ? 0.65 : 1,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    );
    mesh.userData = surface;
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 20),
      new THREE.LineBasicMaterial({
        color: 0x343c42,
        transparent: true,
        opacity: 0.48,
      }),
    );
    mesh.add(edges);
    group.add(mesh);
  }
  const shadeMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9bec4,
    side: THREE.DoubleSide,
    roughness: 1,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const shadeEdges = new THREE.LineBasicMaterial({ color: 0x6b7280, transparent: true, opacity: 0.35 });
  for (const shade of geometry.shades ?? []) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(shade.vertices.flat(), 3));
    geo.setIndex(shade.triangles.flat());
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, shadeMaterial);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), shadeEdges));
    shadeGroup.add(mesh);
  }
  // Frame the building; shading and site context can extend well beyond it.
  const bounds = new THREE.Box3().setFromObject(group),
    center = bounds.getCenter(new THREE.Vector3()),
    size = bounds.getSize(new THREE.Vector3());
  group.position.sub(center);
  shadeGroup.position.sub(center);
  controls.target.set(0, 0, 0);
  const distance = Math.max(size.x, size.y, size.z) * 1.65;
  function render() {
    renderer.render(scene, camera);
  }
  function reset() {
    camera.position.set(distance * 0.6, -distance * 0.9, distance * 0.72);
    controls.target.set(0, 0, 0);
    controls.update();
    render();
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    render();
  }
  function visibility() {
    for (const mesh of group.children)
      mesh.visible =
        (select.value === "all" || mesh.userData.zone === select.value) &&
        (document.querySelector("#roofs").checked ||
          mesh.userData.kind !== "RoofCeiling");
    shadeGroup.visible = document.querySelector("#shades").checked;
    render();
  }
  for (const zone of inputs.zones) {
    const option = document.createElement("option");
    option.value = zone.id;
    option.textContent = zone.name;
    select.append(option);
  }
  const query = new URLSearchParams(location.search).get("zone");
  if (inputs.zones.some((z) => z.id === query)) select.value = query;
  const legend = document.querySelector("#model-legend");
  for (const zone of inputs.zones) {
    const a = document.createElement("a");
    a.href = `program.html?zone=${encodeURIComponent(zone.id)}`;
    a.textContent = zone.name;
    legend.append(a);
  }
  const info = document.querySelector("#geometry-info");
  const p = document.createElement("p");
  p.textContent = `${inputs.zones.length} zones · ${geometry.surfaces.length} surfaces including windows and doors · ${(geometry.shades ?? []).length} shading surfaces`;
  info.append(p);
  const north = new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(-size.x * 0.6, -size.y * 0.4, -size.z * 0.5),
    size.y * 0.18,
    0x2d6b80,
  );
  scene.add(north);
  const axis = document.createElement("span");
  axis.className = "axis-label";
  axis.textContent = "+Y arrow = model north";
  host.append(axis);
  controls.addEventListener("change", render);
  select.addEventListener("change", visibility);
  document.querySelector("#roofs").addEventListener("change", visibility);
  document.querySelector("#shades").addEventListener("change", visibility);
  document.querySelector("#reset-view").addEventListener("click", reset);
  host.addEventListener("keydown", (event) => {
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "+",
        "=",
        "-",
      ].includes(event.key)
    )
      return;
    event.preventDefault();
    if (["+", "=", "-"].includes(event.key)) {
      camera.position
        .sub(controls.target)
        .multiplyScalar(event.key === "-" ? 1.12 : 0.88)
        .add(controls.target);
    } else {
      const offset = camera.position.clone().sub(controls.target);
      if (event.key === "ArrowLeft" || event.key === "ArrowRight")
        offset.applyAxisAngle(
          new THREE.Vector3(0, 0, 1),
          event.key === "ArrowLeft" ? 0.12 : -0.12,
        );
      else {
        const axis = new THREE.Vector3()
          .crossVectors(offset, camera.up)
          .normalize();
        offset.applyAxisAngle(axis, event.key === "ArrowUp" ? 0.1 : -0.1);
      }
      camera.position.copy(controls.target).add(offset);
    }
    controls.update();
    render();
  });
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    const p = document.createElement("p");
    p.className = "error";
    p.setAttribute("role", "alert");
    p.textContent =
      "The 3D graphics context was lost. Reload to restore the model. Zone data remains available on the Program page.";
    host.replaceChildren(p);
  });
  new ResizeObserver(resize).observe(host);
  reset();
  resize();
  visibility();
}

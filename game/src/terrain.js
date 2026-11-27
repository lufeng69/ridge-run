// RIDGE RUN — terrain: one height function shared by the physics and the
// mesh, so the ground the plane can hit is exactly the ground you see.
// A valley runs down -Z with a winding river, patchwork fields, a village
// by airfield A, a lake by airfield B, and mountains on both sides.

import * as THREE from 'three';
import { WORLD, smoothstep, clamp } from './config.js';
import { makeNoise2, mulberry32 } from './rng.js';

const noise = makeNoise2(WORLD.seed);
const noise2 = makeNoise2(WORLD.seed + 101);

// The river's centreline: a gentle S-curve down the valley, pushed clear
// of both airfields so it never crosses a runway.
export function riverX(z) {
  let x = 120 * Math.sin(z * 0.0009) - 40 * Math.sin(z * 0.0021 + 1.3);
  for (const rw of [WORLD.runwayA, WORLD.runwayB]) {
    const d = Math.abs(z - rw.z);
    x += 260 * smoothstep(420, 120, d);
  }
  return x;
}

// True ground height at (x, z). Runways are flattened pads.
export function terrainHeight(x, z) {
  const ax = Math.abs(x);
  // Mountains rise on both sides of the valley.
  const side = smoothstep(280, 900, ax);
  const ridge = noise(x * 0.0016, z * 0.0016) * 0.5 + 0.5;
  const ridge2 = noise2(x * 0.004 + 7, z * 0.004 + 3) * 0.5 + 0.5;
  let h = side * (60 + 260 * ridge + 80 * ridge2);
  // Gentle undulation on the valley floor.
  h += (1 - side) * noise(x * 0.006, z * 0.006) * 4;
  // End walls: hills behind airfield A and past airfield B.
  h += smoothstep(200, 700, z) * 220;
  h += smoothstep(3800, 4200, -z) * 220;
  // River channel carve.
  const d = Math.abs(x - riverX(z));
  h -= smoothstep(42, 8, d) * 6;
  // Flatten the two airfield pads.
  h = flattenPad(h, x, z, WORLD.runwayA);
  h = flattenPad(h, x, z, WORLD.runwayB);
  return h;
}

function flattenPad(h, x, z, rw) {
  const dx = Math.abs(x - rw.x);
  const dz = Math.abs(z - rw.z);
  const insideX = smoothstep(rw.width / 2 + 90, rw.width / 2 + 10, dx);
  const insideZ = smoothstep(rw.length / 2 + 90, rw.length / 2 + 10, dz);
  const w = insideX * insideZ;
  return h * (1 - w);
}

// Is (x, z) on the river water?
export function onWater(x, z) {
  return Math.abs(x - riverX(z)) < 17 && terrainHeight(x, z) < 1.6;
}

// Is (x, z) on a runway strip? Returns the runway or null.
export function onRunway(x, z) {
  for (const rw of [WORLD.runwayA, WORLD.runwayB]) {
    if (
      Math.abs(x - rw.x) <= rw.width / 2 + 4 &&
      Math.abs(z - rw.z) <= rw.length / 2 + 4
    ) {
      return rw;
    }
  }
  return null;
}

// Field-patch colour: the valley floor is a patchwork of farm fields.
function fieldShade(x, z, rand) {
  const cx = Math.floor(x / 130);
  const cz = Math.floor(z / 130);
  const v = Math.abs(Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453) % 1;
  if (v < 0.22) return [0.42, 0.55, 0.24]; // pale green
  if (v < 0.45) return [0.32, 0.48, 0.2]; // mid green
  if (v < 0.62) return [0.55, 0.5, 0.28]; // wheat
  if (v < 0.78) return [0.36, 0.42, 0.22]; // dark green
  return [0.48, 0.44, 0.3]; // tan
}

function terrainColor(x, z, h, slope) {
  if (h > 300) return [0.92, 0.93, 0.95]; // snow
  if (h > 150 || slope > 0.55) return [0.45, 0.42, 0.38]; // rock
  if (h > 55) return [0.3, 0.42, 0.22]; // high grass
  if (Math.abs(x - riverX(z)) < 20) return [0.72, 0.66, 0.5]; // sandy bank
  const f = fieldShade(x, z);
  const shade = 0.92 + 0.16 * ((noise(x * 0.02, z * 0.02) + 1) / 2);
  return [f[0] * shade, f[1] * shade, f[2] * shade];
}

// Build the visible world: terrain mesh, river, runways, trees, village,
// lake, clouds, sun. Returns { group, clouds, riverMat }.
export function buildWorld() {
  const group = new THREE.Group();
  const rand = mulberry32(WORLD.seed + 7);

  // --- Terrain mesh ---
  const W = WORLD.xMax - WORLD.xMin;
  const D = WORLD.zMax - WORLD.zMin;
  const segX = 150;
  const segZ = 300;
  const geo = new THREE.PlaneGeometry(W, D, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cx = (WORLD.xMin + WORLD.xMax) / 2;
  const cz = (WORLD.zMin + WORLD.zMax) / 2;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i) + cx;
    const z = pos.getZ(i) + cz;
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    // Slope estimate from neighbours for rock colouring.
    const hx = terrainHeight(x + 6, z) - h;
    const hz = terrainHeight(x, z + 6) - h;
    const slope = Math.sqrt(hx * hx + hz * hz) / 6;
    const c = terrainColor(x, z, h, slope);
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
  );
  terrain.position.set(cx, 0, cz);
  group.add(terrain);

  // --- River ribbon ---
  const riverPts = [];
  const riverCols = [];
  const riverGeo = new THREE.BufferGeometry();
  const steps = 120;
  for (let i = 0; i <= steps; i += 1) {
    const z = WORLD.zMax - ((WORLD.zMax - WORLD.zMin) * i) / steps;
    const rx = riverX(z);
    riverPts.push(rx - 16, 1.0, z, rx + 16, 1.0, z);
    riverCols.push(0.25, 0.5, 0.75, 0.25, 0.5, 0.75);
  }
  const riverIdx = [];
  for (let i = 0; i < steps; i += 1) {
    const a = i * 2;
    riverIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(riverPts, 3));
  riverGeo.setAttribute('color', new THREE.Float32BufferAttribute(riverCols, 3));
  riverGeo.setIndex(riverIdx);
  riverGeo.computeVertexNormals();
  const riverMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.25,
    metalness: 0.1,
    transparent: true,
    opacity: 0.9,
  });
  const river = new THREE.Mesh(riverGeo, riverMat);
  group.add(river);

  // --- Lake by airfield B ---
  const lake = new THREE.Mesh(
    new THREE.CircleGeometry(190, 40),
    new THREE.MeshStandardMaterial({ color: 0x3f7fc4, roughness: 0.2, metalness: 0.15, transparent: true, opacity: 0.92 }),
  );
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(430, 1.0, -3750);
  group.add(lake);

  // --- Runways: dark strips with white centreline dashes and numbers ---
  for (const rw of [WORLD.runwayA, WORLD.runwayB]) {
    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(rw.width + 16, rw.length + 24),
      new THREE.MeshStandardMaterial({ color: 0x4a4d52, roughness: 0.95 }),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(rw.x, 0.35, rw.z);
    group.add(pad);
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(rw.width, rw.length),
      new THREE.MeshStandardMaterial({ color: 0x2e3134, roughness: 0.95 }),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(rw.x, 0.45, rw.z);
    group.add(strip);
    // Centreline dashes.
    const dashGeo = new THREE.PlaneGeometry(1.2, 14);
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xf2f2e8, roughness: 0.9 });
    for (let d = -rw.length / 2 + 30; d < rw.length / 2 - 20; d += 32) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(rw.x, 0.55, rw.z + d);
      group.add(dash);
    }
    // Threshold bars at both ends.
    for (const end of [-1, 1]) {
      for (let k = -2; k <= 2; k += 1) {
        const bar = new THREE.Mesh(
          new THREE.PlaneGeometry(3.4, 12),
          dashMat,
        );
        bar.rotation.x = -Math.PI / 2;
        bar.position.set(rw.x + k * 4.4, 0.55, rw.z + end * (rw.length / 2 - 12));
        group.add(bar);
      }
    }
    // Windsock pole + cone at the side.
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 9, 6),
      new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.6 }),
    );
    pole.position.set(rw.x + rw.width / 2 + 12, 4.5, rw.z + 60);
    group.add(pole);
    const sock = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 5, 10),
      new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.7, emissive: 0x431600 }),
    );
    sock.rotation.z = Math.PI / 2;
    sock.position.set(rw.x + rw.width / 2 + 15, 8.6, rw.z + 60);
    group.add(sock);
    // A small hangar beside runway A.
    if (rw === WORLD.runwayA) {
      const hangar = new THREE.Mesh(
        new THREE.BoxGeometry(34, 12, 24),
        new THREE.MeshStandardMaterial({ color: 0x9aa5ad, roughness: 0.8 }),
      );
      hangar.position.set(rw.x + 52, 6, rw.z + 90);
      group.add(hangar);
      const roof = new THREE.Mesh(
        new THREE.CylinderGeometry(12, 12, 34, 12, 1, false, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x7d8891, roughness: 0.8 }),
      );
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      roof.position.set(rw.x + 52, 12, rw.z + 90);
      group.add(roof);
    }
  }

  // --- Trees: instanced cones + trunks on gentle low ground ---
  const treeSpots = [];
  let guard = 0;
  while (treeSpots.length < 650 && guard < 20000) {
    guard += 1;
    const x = WORLD.xMin + rand() * (WORLD.xMax - WORLD.xMin);
    const z = WORLD.zMin + rand() * (WORLD.zMax - WORLD.zMin);
    const h = terrainHeight(x, z);
    if (h > 55 || h < 0) continue;
    if (Math.abs(x - riverX(z)) < 26) continue;
    if (onRunway(x, z)) continue;
    if (Math.abs(x) < 90 && z > -200 && z < 200) continue; // keep A clear
    if (Math.abs(x) < 90 && z > -3800 && z < -3400) continue; // keep B clear
    treeSpots.push({ x, z, h, s: 0.7 + rand() * 0.9 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3.2, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const coneGeo = new THREE.ConeGeometry(2.6, 8.5, 7);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0x2e6b34, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, treeSpots.length);
  const m4 = new THREE.Matrix4();
  treeSpots.forEach((t, i) => {
    m4.makeScale(t.s, t.s, t.s);
    m4.setPosition(t.x, t.h + 1.6 * t.s, t.z);
    trunks.setMatrixAt(i, m4);
    m4.makeScale(t.s, t.s, t.s);
    m4.setPosition(t.x, t.h + (3.2 + 4.2) * t.s, t.z);
    cones.setMatrixAt(i, m4);
  });
  group.add(trunks);
  group.add(cones);

  // --- Village: a dozen houses with pitched roofs near airfield A, on
  // the west side so the river (pushed east) never runs through it ---
  const houseCols = [0xe8e0d0, 0xdcc9a8, 0xc9d6e2, 0xe2c9c9];
  const roofCols = [0xa34a32, 0x7a4a2e, 0x4a5a6a];
  for (let i = 0; i < 14; i += 1) {
    const hx = -410 + rand() * 260;
    const hz = -60 + rand() * 320;
    const h = terrainHeight(hx, hz);
    if (h > 8) continue;
    const w = 9 + rand() * 6;
    const d = 8 + rand() * 5;
    const ht = 5 + rand() * 2.5;
    const house = new THREE.Mesh(
      new THREE.BoxGeometry(w, ht, d),
      new THREE.MeshStandardMaterial({ color: houseCols[i % houseCols.length], roughness: 0.9 }),
    );
    house.position.set(hx, h + ht / 2, hz);
    house.rotation.y = rand() * Math.PI;
    group.add(house);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(w, d) * 0.75, 3.5, 4),
      new THREE.MeshStandardMaterial({ color: roofCols[i % roofCols.length], roughness: 0.9 }),
    );
    roof.position.set(hx, h + ht + 1.7, hz);
    roof.rotation.y = Math.PI / 4 + house.rotation.y;
    group.add(roof);
  }

  // --- Clouds: flattened white blobs drifting slowly ---
  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 1, transparent: true, opacity: 0.85,
  });
  for (let i = 0; i < 14; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 3);
    for (let p = 0; p < puffs; p += 1) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(14 + rand() * 16, 10, 8), cloudMat);
      s.position.set((rand() - 0.5) * 46, (rand() - 0.5) * 6, (rand() - 0.5) * 20);
      s.scale.y = 0.45;
      cloud.add(s);
    }
    cloud.position.set(
      -900 + rand() * 1800,
      260 + rand() * 120,
      400 - rand() * 4200,
    );
    cloud.userData.speed = 2 + rand() * 3;
    clouds.push(cloud);
    group.add(cloud);
  }

  // --- Sun disc ---
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(46, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, fog: false }),
  );
  sun.position.set(-900, 620, -2600);
  sun.lookAt(0, 60, -1800);
  group.add(sun);

  return { group, clouds, riverMat };
}

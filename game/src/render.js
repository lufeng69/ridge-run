// RIDGE RUN — the picture: three.js scene, chase and cockpit cameras,
// sky dome, sun, fog, the glowing ring course, and the plane itself.
// The camera never looks at a wireframe or a placeholder: every frame is
// the valley, the river, the runways and the plane.

import * as THREE from 'three';
import { RINGS, WORLD, clamp, lerp } from './config.js';
import { buildWorld } from './terrain.js';
import { buildPlane } from './plane.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    const resParam = new URLSearchParams(window.location.search).get('res');
    let rw = 1280;
    let rh = 720;
    if (resParam) {
      const m = resParam.match(/^(\d+)x(\d+)$/);
      if (m) {
        rw = Number(m[1]);
        rh = Number(m[2]);
      }
    }
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(rw, rh, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xbfd9ea, 500, 3800);

    this.camera = new THREE.PerspectiveCamera(62, rw / rh, 0.5, 9000);
    this.cameraMode = 'chase'; // chase | cockpit
    this.chasePos = new THREE.Vector3(0, 8, 170);
    this.chaseLook = new THREE.Vector3(0, 2, 0);

    // Sky dome: a gradient shader sphere, always behind everything.
    const skyGeo = new THREE.SphereGeometry(7000, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x2f6fc4) },
        mid: { value: new THREE.Color(0x7fb4dd) },
        low: { value: new THREE.Color(0xd8ecf5) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 top; uniform vec3 mid; uniform vec3 low;
        void main() {
          float h = normalize(vPos).y;
          vec3 c = h > 0.18 ? mix(mid, top, smoothstep(0.18, 0.75, h))
                            : mix(low, mid, smoothstep(-0.08, 0.18, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);

    // Light: warm afternoon sun + sky bounce.
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    sun.position.set(-1400, 1600, 900);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xbfd9f2, 0x4a5a3a, 1.15));

    // The world itself.
    const world = buildWorld();
    this.scene.add(world.group);
    this.clouds = world.clouds;

    // The plane.
    const plane = buildPlane();
    this.planeGroup = plane.group;
    this.prop = plane.prop;
    this.disc = plane.disc;
    this.gear = plane.gear;
    this.scene.add(this.planeGroup);

    // The ring course: glowing hoops. The next ring burns bright orange,
    // done ones go green, later ones stay dim blue.
    this.ringMeshes = RINGS.map((r, i) => {
      const geo = new THREE.TorusGeometry(18, 1.5, 12, 40);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x2f6fd0,
        emissive: 0x1a4a9e,
        emissiveIntensity: 1.4,
        roughness: 0.4,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(r.x, r.y, r.z);
      // Rings face along the course (torus lies in XY, facing -Z already).
      mesh.userData.index = i;
      this.scene.add(mesh);
      // A small beacon light above each ring.
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xffcc44, emissive: 0xffaa00, emissiveIntensity: 2 }),
      );
      beacon.position.set(r.x, r.y + 22, r.z);
      this.scene.add(beacon);
      mesh.userData.beacon = beacon;
      return mesh;
    });

    // A floating next-ring marker: a pulsing chevron the camera can see.
    this.marker = new THREE.Mesh(
      new THREE.ConeGeometry(3, 9, 4),
      new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0xff8800, emissiveIntensity: 2.2 }),
    );
    this.scene.add(this.marker);
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
  }

  // Snap the chase camera onto the plane at once — staged screenshots
  // jump the plane across the valley, and a smoothed camera would still
  // be hundreds of metres behind it when the frame is taken.
  snapChase(flight) {
    const f = flight;
    const fwd = f.forward();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x).normalize();
    const ideal = f.pos.clone().addScaledVector(fwd, -17).addScaledVector(right, 6.5);
    ideal.y += 4.5 - f.pitch * 6;
    this.chasePos.copy(ideal);
    const lookIdeal = f.pos.clone().addScaledVector(fwd, 30);
    lookIdeal.y += 1;
    this.chaseLook.copy(lookIdeal);
  }

  // One frame: place the plane, chase it, pulse the rings, drift clouds.
  render(flight, time, dt, cinematic = false) {
    const f = flight;

    // Plane transform: heading + pitch + bank.
    this.planeGroup.position.copy(f.pos);
    this.planeGroup.rotation.set(0, 0, 0);
    this.planeGroup.rotation.order = 'YXZ';
    this.planeGroup.rotation.y = f.heading;
    this.planeGroup.rotation.x = -f.pitch;
    this.planeGroup.rotation.z = f.bank;
    // Prop spins with throttle; the blur disc fades in with RPM.
    const rpm = 4 + f.throttle * 42 + f.speed * 0.15;
    this.prop.rotation.z += rpm * dt;
    this.disc.material.opacity = clamp(f.throttle * 0.22, 0, 0.22);
    this.disc.rotation.z -= rpm * dt * 0.5;
    this.gear.visible = f.gear;

    // Ring colours: next = hot orange, done = green, later = dim blue.
    const pulse = 0.75 + 0.25 * Math.sin(time * 4);
    this.ringMeshes.forEach((mesh, i) => {
      const r = f.rings[i];
      const mat = mesh.material;
      if (r.done) {
        mat.color.setHex(0x2fae5f);
        mat.emissive.setHex(0x0d7a33);
        mat.emissiveIntensity = 0.9;
        mesh.userData.beacon.material.emissive.setHex(0x00cc44);
      } else if (i === f.nextRing) {
        mat.color.setHex(0xff8c1a);
        mat.emissive.setHex(0xff6a00);
        mat.emissiveIntensity = 1.6 * pulse;
        mesh.userData.beacon.material.emissive.setHex(0xffaa00);
      } else {
        mat.color.setHex(0x2f6fd0);
        mat.emissive.setHex(0x1a4a9e);
        mat.emissiveIntensity = 0.9;
      }
    });
    // Ring flash on collect: the whole course briefly glows.
    if (f.ringFlash > 0) {
      const m = this.ringMeshes[Math.max(0, f.nextRing - 1)];
      if (m) m.material.emissiveIntensity = 2.5;
    }

    // Next-target marker floats above the next ring / runway B.
    const target = f.nextRingTarget();
    if (f.state === 'flying') {
      this.marker.visible = true;
      const ty = f.nextRing < f.rings.length ? f.rings[f.nextRing].y + 30 : 40;
      this.marker.position.set(target.x, ty + Math.sin(time * 2) * 2, target.z);
      this.marker.rotation.x = Math.PI;
      this.marker.rotation.y = time * 1.2;
    } else {
      this.marker.visible = false;
    }

    // Clouds drift east and wrap.
    for (const c of this.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 1200) c.position.x = -1200;
    }

    // Camera.
    const fwd = f.forward();
    if (cinematic) {
      // Title backdrop: slow orbit around the parked plane.
      const a = time * 0.07;
      const eye = new THREE.Vector3(
        f.pos.x + Math.sin(a) * 34,
        f.pos.y + 9 + Math.sin(time * 0.3) * 1.5,
        f.pos.z + Math.cos(a) * 34,
      );
      this.camera.position.copy(eye);
      this.camera.lookAt(f.pos.x, f.pos.y + 1, f.pos.z - 10);
    } else if (this.cameraMode === 'cockpit') {
      // In the cockpit: just behind the canopy, looking along the nose.
      const eye = f.pos.clone().addScaledVector(fwd, 1.6);
      eye.y += 0.9;
      this.camera.position.copy(eye);
      const look = f.pos.clone().addScaledVector(fwd, 60);
      look.y += f.pitch * 30;
      this.camera.lookAt(look);
      this.camera.rotation.z += f.bank * 0.55;
    } else {
      // Chase: behind, to the side and above, smoothed so the valley
      // stays readable — a three-quarter rear view, so the wingspan and
      // the fuselage both read in frame.
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x).normalize();
      const ideal = f.pos.clone().addScaledVector(fwd, -17).addScaledVector(right, 6.5);
      ideal.y += 4.5 - f.pitch * 6;
      const k = 1 - Math.exp(-dt * 5);
      this.chasePos.lerp(ideal, k);
      const lookIdeal = f.pos.clone().addScaledVector(fwd, 30);
      lookIdeal.y += 1;
      this.chaseLook.lerp(lookIdeal, 1 - Math.exp(-dt * 8));
      this.camera.position.copy(this.chasePos);
      this.camera.lookAt(this.chaseLook);
      this.camera.rotation.z += f.bank * 0.12;
    }
    // Sky dome follows the camera so the horizon never runs out.
    this.sky.position.copy(this.camera.position);

    this.renderer.render(this.scene, this.camera);
  }
}

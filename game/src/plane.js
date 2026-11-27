// RIDGE RUN — the bush plane: a low-poly prop plane built from primitives,
// cream fuselage with a red cheatline, glass canopy, spinning prop and
// landing gear that actually retracts. Forward is -Z when heading is 0.

import * as THREE from 'three';

export function buildPlane() {
  const group = new THREE.Group();
  const cream = new THREE.MeshStandardMaterial({ color: 0xf2e8d5, roughness: 0.55, metalness: 0.15 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: 0.5, metalness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.6, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x1c2f42, roughness: 0.15, metalness: 0.6,
  });

  // Fuselage: a tapered cylinder along Z, nose at -Z.
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.4, 12), cream);
  fus.rotation.x = Math.PI / 2;
  fus.position.set(0, 0, 0.4);
  group.add(fus);
  // Nose cone.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.2, 12), red);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0, -2.9);
  group.add(nose);
  // Red cheatline stripe along the fuselage.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.34, 5.0), red);
  stripe.position.set(0.86, -0.1, 0.4);
  group.add(stripe);
  const stripe2 = stripe.clone();
  stripe2.position.x = -0.86;
  group.add(stripe2);

  // Canopy: a flattened glass bubble on top.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 14, 10), glass);
  canopy.scale.set(1, 0.62, 1.7);
  canopy.position.set(0, 0.62, -0.6);
  group.add(canopy);

  // Main wing: long, slightly tapered by two boxes.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.22, 2.1), cream);
  wing.position.set(0, 0.05, -0.2);
  group.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 1.9), red);
  wingTipL.position.set(5.5, 0.05, -0.2);
  group.add(wingTipL);
  const wingTipR = wingTipL.clone();
  wingTipR.position.x = -5.5;
  group.add(wingTipR);

  // Tail: horizontal stabiliser + vertical fin.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 1.3), cream);
  stab.position.set(0, 0.25, 2.9);
  group.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.7, 1.5), red);
  fin.position.set(0, 0.95, 2.9);
  group.add(fin);

  // Propeller: hub + two blades, spins around Z. Plus a faint blur disc.
  const prop = new THREE.Group();
  prop.position.set(0, 0, -3.55);
  const hub = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 10), dark);
  hub.rotation.x = -Math.PI / 2;
  prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.34, 2.6, 0.08);
  const blade1 = new THREE.Mesh(bladeGeo, dark);
  prop.add(blade1);
  const blade2 = new THREE.Mesh(bladeGeo, dark);
  blade2.rotation.z = Math.PI / 2;
  prop.add(blade2);
  group.add(prop);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.45, 24),
    new THREE.MeshBasicMaterial({
      color: 0xcccccc, transparent: true, opacity: 0.1, side: THREE.DoubleSide,
    }),
  );
  disc.position.set(0, 0, -3.6);
  group.add(disc);

  // Nav lights: red left, green right, white tail.
  const navL = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff0000, emissiveIntensity: 2 }),
  );
  navL.position.set(-5.6, 0.05, -0.2);
  group.add(navL);
  const navR = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x22ff66, emissive: 0x00cc33, emissiveIntensity: 2 }),
  );
  navR.position.set(5.6, 0.05, -0.2);
  group.add(navR);
  const navT = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.5 }),
  );
  navT.position.set(0, 0.3, 3.55);
  group.add(navT);

  // Landing gear: two mains + nose wheel, hidden when retracted.
  const gear = new THREE.Group();
  const legGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.28, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, dark);
    leg.position.set(sx * 0.95, -0.85, -0.3);
    gear.add(leg);
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(sx * 0.95, -1.35, -0.3);
    gear.add(wheel);
  }
  const noseLeg = new THREE.Mesh(legGeo, dark);
  noseLeg.position.set(0, -0.85, -2.2);
  gear.add(noseLeg);
  const noseWheel = new THREE.Mesh(wheelGeo, dark);
  noseWheel.position.set(0, -1.35, -2.2);
  gear.add(noseWheel);
  group.add(gear);

  return { group, prop, disc, gear };
}

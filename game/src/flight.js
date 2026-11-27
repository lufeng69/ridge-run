// RIDGE RUN — flight rules: arcade physics, the ring course, landing,
// crashes, respawns and scoring. The terrain height function is the only
// ground truth; the plane never flies through a hill it can see.

import * as THREE from 'three';
import { FLIGHT, RINGS, RING_RADIUS, SCORE, WORLD, clamp, lerp, wrapAngle, angleDiff } from './config.js';
import { terrainHeight, onWater, onRunway } from './terrain.js';

export class Flight {
  constructor() {
    this.reset();
  }

  reset() {
    // Parked on runway A, nose down the valley (-Z), engine idling.
    this.pos = new THREE.Vector3(WORLD.runwayA.x, 1.4, WORLD.runwayA.z + 150);
    this.heading = 0;
    this.pitch = 0;
    this.bank = 0;
    this.speed = 0;
    this.vspeed = 0;
    this.throttle = 0;
    this.flaps = false;
    this.gear = true;
    this.airborne = false;
    this.tookOff = false; // true once the plane has really left the ground
    this.rings = RINGS.map((r) => ({ ...r, done: false }));
    this.ringsDone = 0;
    this.score = 0;
    this.time = 0;
    this.lives = FLIGHT.maxLives;
    this.state = 'parked'; // parked | flying | rolling | crashed | landed | done
    this.crashReason = '';
    this.landingBonus = 0;
    this.timeBonus = 0;
    this.message = '';
    this.messageT = 0;
    this.stallWarn = false;
    this.ringFlash = 0;
    this.nextRing = 0;
    this.rolloutT = 0;
  }

  // Forward unit vector from heading + pitch. Heading 0 = -Z.
  forward() {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(
      -Math.sin(this.heading) * cp,
      Math.sin(this.pitch),
      -Math.cos(this.heading) * cp,
    );
  }

  // Bearing (heading) from the plane to a target point.
  bearingTo(x, z) {
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    return Math.atan2(-dx, -dz);
  }

  distanceToRing(i) {
    const r = this.rings[i];
    return Math.sqrt(
      (r.x - this.pos.x) ** 2 + (r.y - this.pos.y) ** 2 + (r.z - this.pos.z) ** 2,
    );
  }

  say(text, seconds = 3) {
    this.message = text;
    this.messageT = seconds;
  }

  // One simulation step. input: { pitch: -1..1, roll: -1..1, throttle: -1..1 }
  // pitch +1 = climb, roll +1 = bank left.
  update(dt, input) {
    if (this.messageT > 0) this.messageT -= dt;
    if (this.state === 'crashed' || this.state === 'landed' || this.state === 'done') {
      return;
    }
    // Rollout after touchdown: bleed speed on the runway, stay on the
    // ground, no more flying until the run ends.
    if (this.state === 'rolling') {
      this.speed = Math.max(0, this.speed - 14 * dt);
      const fwd = this.forward();
      this.pos.x += fwd.x * this.speed * dt;
      this.pos.z += fwd.z * this.speed * dt;
      this.pos.y = terrainHeight(this.pos.x, this.pos.z) + 1.35;
      this.time += dt;
      this.rolloutT += dt;
      if (this.speed < 6) this.state = 'landed';
      return;
    }

    const f = FLIGHT;
    // Throttle.
    this.throttle = clamp(this.throttle + input.throttle * 0.55 * dt, 0, 1);

    // Target speed from throttle; flaps cost top speed but lower the stall.
    const maxSpd = this.flaps ? f.maxSpeedFlaps : f.maxSpeed;
    const targetSpeed = this.throttle * maxSpd;
    this.speed += clamp(targetSpeed - this.speed, -f.accel * dt, f.accel * dt);

    // Pitch and bank chase their targets. Hands off the stick at cruise,
    // the plane holds a gentle climb trim so the valley floor never
    // catches a pilot who forgot to pull back after takeoff.
    const stall0 = this.flaps ? f.stallSpeedFlaps : f.stallSpeed;
    const pitchTarget = input.pitch !== 0
      ? input.pitch * f.maxPitch
      : (this.airborne && this.speed > stall0 ? 0.06 : 0);
    const bankTarget = input.roll * f.maxBank;
    this.pitch += clamp(pitchTarget - this.pitch, -f.pitchRate * dt, f.pitchRate * dt);
    this.bank += clamp(bankTarget - this.bank, -f.bankRate * dt, f.bankRate * dt);

    // Turning: bank rolls the heading around.
    const speedFrac = clamp(this.speed / 55, f.minTurnSpeed, 1.2);
    this.heading += this.bank * f.turnRate * speedFrac * dt;
    this.heading = wrapAngle(this.heading);

    // Stall: too slow and the nose drops, the wing stops lifting — but
    // only once the plane is really in the air, never on the takeoff roll.
    const groundY0 = terrainHeight(this.pos.x, this.pos.z);
    const agl0 = this.pos.y - groundY0;
    const stall = this.flaps ? f.stallSpeedFlaps : f.stallSpeed;
    this.stallWarn = this.airborne && agl0 > 2.5 && this.speed < stall + 4;
    let sink = 0;
    if (agl0 > 2.5 && this.speed < stall) {
      sink = (stall - this.speed) * 0.9;
      this.pitch = lerp(this.pitch, -0.18, dt * 1.5);
    }
    if (agl0 > 5) this.tookOff = true;

    // Vertical speed: climb from pitch, minus sink; ground effect softens
    // the last metre and a half.
    const groundY = terrainHeight(this.pos.x, this.pos.z);
    const agl = this.pos.y - groundY;
    let vs = this.speed * Math.sin(this.pitch) - sink;
    if (agl < f.groundEffect && vs < 0 && this.speed > stall * 0.8) {
      vs *= 0.45;
    }
    this.vspeed = vs;

    // Move.
    const fwd = this.forward();
    this.pos.x += fwd.x * this.speed * dt;
    this.pos.y += vs * dt;
    this.pos.z += fwd.z * this.speed * dt;
    if (this.state === 'parked' && this.speed > 8) {
      this.state = 'flying';
      this.airborne = true;
      this.say('AIRBORNE — follow the rings down the valley', 4);
    }
    if (this.state === 'flying' || this.state === 'rolling') {
      this.time += dt;
    }

    // Rings: fly within the hoop to collect it.
    if (this.state === 'flying') {
      for (let i = 0; i < this.rings.length; i += 1) {
        const r = this.rings[i];
        if (r.done) continue;
        const d = Math.sqrt(
          (r.x - this.pos.x) ** 2 + (r.y - this.pos.y) ** 2 + (r.z - this.pos.z) ** 2,
        );
        if (d < RING_RADIUS) {
          r.done = true;
          this.ringsDone += 1;
          this.score += SCORE.ring;
          this.nextRing = i + 1;
          this.say(`RING ${this.ringsDone} / ${this.rings.length}  +${SCORE.ring}`, 2.5);
          this.ringFlash = 1;
        }
      }
    }
    if (this.ringFlash > 0) this.ringFlash -= dt * 2;

    // Ground contact: at the ground and sinking (or actually under it —
    // a climbing low pass at a metre up is not a landing).
    const newGroundY = terrainHeight(this.pos.x, this.pos.z);
    const newAgl = this.pos.y - newGroundY;
    if ((newAgl <= 1.35 && this.vspeed <= 0.5) || newAgl <= 0.2) {
      this.touchGround(newGroundY, dt);
    }
    // Water is always a crash — but never on a paved runway.
    if (this.state === 'flying' && !onRunway(this.pos.x, this.pos.z) && onWater(this.pos.x, this.pos.z) && this.pos.y < 2.2) {
      this.crash('Ditched in the river');
    }
    // Out of the valley: turn back.
    if (Math.abs(this.pos.x) > 1150 || this.pos.z > 520 || this.pos.z < -4150) {
      this.say('Turn back — leaving the valley', 2);
    }
  }

  touchGround(groundY, dt) {
    const f = FLIGHT;
    const rw = onRunway(this.pos.x, this.pos.z);
    this.pos.y = groundY + 1.35;
    if (this.state === 'parked') {
      this.vspeed = 0;
      return;
    }
    // Still on the takeoff roll (never left the ground): keep rolling,
    // do not call it a landing or a crash.
    if (this.state === 'flying' && !this.tookOff) {
      this.vspeed = 0;
      return;
    }
    // Rolling on the ground: only a runway landing counts.
    if (rw && this.gear && this.vspeed > f.crashVs && this.speed < f.landMaxSpeed && Math.abs(this.bank) < f.landMaxBank) {
      if (this.state !== 'rolling') {
        // Touchdown!
        const centerOff = Math.abs(this.pos.x - rw.x);
        const smooth = clamp(1 - Math.abs(this.vspeed) / 4.5, 0, 1);
        const centred = clamp(1 - centerOff / (rw.width / 2), 0, 1);
        this.landingBonus = Math.round(SCORE.landingBase * (0.4 + 0.6 * smooth) * (0.5 + 0.5 * centred));
        this.score += this.landingBonus;
        this.timeBonus = Math.max(0, Math.round((SCORE.timeBonusWindow - this.time) * SCORE.timeBonusPerSec));
        this.score += this.timeBonus;
        this.say(`TOUCHDOWN  +${this.landingBonus}`, 3);
        this.state = 'rolling';
        this.rolloutT = 0;
        this.pitch = 0;
        this.bank = 0;
        this.vspeed = 0;
      }
      return;
    }
    // Anything else touching the ground is a crash — unless we are parked.
    if (this.state === 'flying') {
      if (!this.gear && rw) this.crash('Landed with the gear up');
      else if (rw && this.speed >= f.landMaxSpeed) this.crash('Too fast for the runway');
      else if (rw && this.vspeed <= f.crashVs) this.crash('Slammed into the runway');
      else if (rw && Math.abs(this.bank) >= f.landMaxBank) this.crash('Touched down banked over');
      else this.crash('Flew into the terrain');
    }
  }

  crash(reason) {
    if (this.state === 'crashed') return;
    this.state = 'crashed';
    this.crashReason = reason;
    this.lives -= 1;
    this.speed = 0;
    this.vspeed = 0;
  }

  // Respawn after a crash: just before the last ring collected, or back on
  // runway A if none. Returns false when no lives are left.
  respawn() {
    if (this.lives <= 0) {
      this.state = 'done';
      return false;
    }
    const last = this.nextRing > 0 ? this.rings[this.nextRing - 1] : null;
    if (last) {
      this.pos.set(last.x, last.y + 25, last.z + 260);
      this.heading = 0;
      this.pitch = -0.05;
      this.bank = 0;
      this.speed = 42;
      this.throttle = 0.55;
    } else {
      this.pos.set(WORLD.runwayA.x, 1.4, WORLD.runwayA.z + 150);
      this.heading = 0;
      this.pitch = 0;
      this.bank = 0;
      this.speed = 0;
      this.throttle = 0;
    }
    this.flaps = false;
    this.gear = true;
    this.vspeed = 0;
    this.tookOff = false;
    this.airborne = !!last;
    this.state = last ? 'flying' : 'parked';
    this.say(last ? 'Back in the air — ring ahead' : 'Back on runway A', 3);
    return true;
  }

  // Next ring target for the HUD arrow / minimap.
  nextRingTarget() {
    if (this.nextRing >= this.rings.length) {
      return { x: WORLD.runwayB.x, z: WORLD.runwayB.z, label: 'RUNWAY B', dist: this.bearingTo(WORLD.runwayB.x, WORLD.runwayB.z) };
    }
    const r = this.rings[this.nextRing];
    return { x: r.x, z: r.z, label: `RING ${this.nextRing + 1}`, dist: this.bearingTo(r.x, r.z) };
  }
}

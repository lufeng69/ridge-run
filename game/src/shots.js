// RIDGE RUN — the ?shot= scenes. Each one drives the real flight model
// from a set state, so every frame is the game itself flying, and the same
// staging always gives the same frame. No compositing, no borrowed pixels.

import { RINGS } from './config.js';

// Place the plane just short of a ring, on course, at cruise speed.
function placeBeforeRing(game, index, distance) {
  const f = game.flight;
  const r = RINGS[index];
  for (let i = 0; i < index; i += 1) {
    f.rings[i].done = true;
  }
  f.ringsDone = index;
  f.nextRing = index;
  f.score = index * 100;
  f.pos.set(r.x, r.y, r.z + distance);
  f.heading = 0;
  f.pitch = 0;
  f.bank = 0;
  f.speed = 58;
  f.throttle = 0.72;
  f.flaps = false;
  f.gear = true;
  f.airborne = true;
  f.state = 'flying';
  f.time = 60 + index * 22;
}

export function stageShot(name, game) {
  const f = game.flight;
  game.screen = 'play';

  if (name === 'start') {
    // Parked on runway A, title screen over the valley.
    f.reset();
    game.screen = 'title';
    return;
  }

  if (name === 'flight') {
    // Mid-course: chasing ring 3 over the river, fields below.
    placeBeforeRing(game, 2, 420);
    f.pos.y = 95;
    stepFlight(game, 2.5);
    game.renderer.snapChase(f);
    return;
  }

  if (name === 'ring') {
    // Right on ring 5: the hoop fills the view ahead.
    placeBeforeRing(game, 4, 170);
    stepFlight(game, 1.2);
    game.renderer.snapChase(f);
    return;
  }

  if (name === 'land') {
    // Final approach to runway B: gear and flaps down, all rings done.
    for (let i = 0; i < RINGS.length; i += 1) f.rings[i].done = true;
    f.ringsDone = 8;
    f.nextRing = 8;
    f.score = 800;
    f.pos.set(4, 26, -3290);
    f.heading = 0;
    f.pitch = -0.06;
    f.bank = 0;
    f.speed = 40;
    f.throttle = 0.45;
    f.flaps = true;
    f.gear = true;
    f.airborne = true;
    f.state = 'flying';
    f.time = 312;
    f.say('FINAL — RUNWAY B', 4);
    stepFlight(game, 2.0);
    game.renderer.snapChase(f);
    return;
  }

  // Default: same as flight.
  placeBeforeRing(game, 2, 420);
  stepFlight(game, 2.5);
}

// Step the real sim forward without rendering, so the staged moment is
// alive (prop spinning, clouds drifted, HUD settled).
function stepFlight(game, seconds) {
  const STEP = 1 / 60;
  const steps = Math.ceil(seconds / STEP);
  const input = { pitch: 0, roll: 0, throttle: 0 };
  for (let i = 0; i < steps; i += 1) {
    game.flight.update(STEP, input);
    game.time += STEP;
    if (game.flight.state !== 'flying') break;
  }
}

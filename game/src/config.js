// RIDGE RUN — config: every tunable number and every piece of data the
// flight runs on. Nothing here is copied from any other game: the valley,
// the airfields, the rings and the numbers are this game's own.

export const VIEW = { width: 1280, height: 720 };

// The valley runs along -Z: airfield A (Pinefield) at z = 0, airfield B
// (Lakeside) at z = -3600. X runs across the valley.
export const WORLD = {
  seed: 20261127,
  xMin: -1200,
  xMax: 1200,
  zMin: -4200,
  zMax: 600,
  // Runway A: takeoff field. Runway B: destination field.
  runwayA: { x: 0, z: 0, heading: 0, length: 420, width: 26 },
  runwayB: { x: 0, z: -3600, heading: 0, length: 420, width: 26 },
  // The river winds down the valley floor; the road village sits near A.
  riverBase: 0,
};

// The ring course: eight glowing rings from A to B. x weaves, altitude
// climbs and falls so the pilot works the whole valley.
export const RINGS = [
  { x: 0, y: 70, z: -450 },
  { x: 130, y: 95, z: -900 },
  { x: -110, y: 80, z: -1350 },
  { x: 90, y: 120, z: -1800 },
  { x: -150, y: 100, z: -2250 },
  { x: 70, y: 140, z: -2700 },
  { x: -90, y: 110, z: -3150 },
  { x: 0, y: 70, z: -3450 },
];
export const RING_RADIUS = 18;
export const RING_SCORE = 100;

// Flight model (arcade, metres / seconds).
export const FLIGHT = {
  maxSpeed: 88, // m/s at full throttle, clean
  maxSpeedFlaps: 70, // m/s at full throttle, flaps down
  stallSpeed: 25, // m/s clean; flaps lower it
  stallSpeedFlaps: 20,
  accel: 11, // m/s^2 towards the throttle target speed
  maxPitch: 0.42, // rad, nose up
  maxBank: 1.05, // rad
  pitchRate: 1.6, // rad/s towards the pitch target
  bankRate: 2.4, // rad/s towards the bank target
  turnRate: 0.55, // rad/s of heading per rad of bank at cruise
  minTurnSpeed: 0.3, // turn authority scales down below this speed fraction
  groundEffect: 1.5, // metres above ground where the sink softens
  crashVs: -4.5, // vertical speed (m/s) harder than this on touchdown = crash
  landMaxSpeed: 52, // m/s: faster than this on touchdown = crash
  landMaxBank: 0.3, // rad of bank allowed at touchdown
  maxLives: 3,
};

// Scoring.
export const SCORE = {
  ring: 100,
  landingBase: 500, // smooth, centred landing
  timeBonusWindow: 600, // seconds: finish inside this for a time bonus
  timeBonusPerSec: 1,
};

// Layout rectangles for the DOM HUD, in view coordinates.
export const LAYOUT = {
  topBar: { x: 0, y: 0, w: 1280, h: 64 },
  minimap: { x: 1064, y: 76, w: 200, h: 200 },
  panel: { x: 0, y: 610, w: 1280, h: 110 },
  rings: { x: 16, y: 76, w: 300, h: 90 },
  toast: { x: 0, y: 300, w: 1280, h: 60 },
};

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Wrap an angle to [-PI, PI].
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Smallest signed difference from a to b, in [-PI, PI].
export function angleDiff(a, b) {
  return wrapAngle(b - a);
}

// Unit conversions for the HUD (aviation style).
export const MS_TO_KT = 1.94384;
export const M_TO_FT = 3.28084;
export const MS_TO_FPM = 196.85;

// RIDGE RUN — the HUD: lit instruments, a compass tape, a live minimap,
// rings/score/time and the pilot's warnings. All of it is the game's own
// DOM and canvas, drawn every frame from the flight state.

import { WORLD, RINGS, MS_TO_KT, M_TO_FT, MS_TO_FPM, clamp, wrapAngle } from './config.js';
import { riverX } from './terrain.js';

const GLOW = '#7dffb0';
const AMBER = '#ffb020';
const CYAN = '#6fd8ff';
const RED = '#ff5d5d';

export function initHud() {
  return {
    ringsEl: document.getElementById('rings'),
    scoreEl: document.getElementById('score'),
    timeEl: document.getElementById('time'),
    livesEl: document.getElementById('lives'),
    toastEl: document.getElementById('toast'),
    stallEl: document.getElementById('stallwarn'),
    gearEl: document.getElementById('gearwarn'),
    gauges: document.getElementById('gauges'),
    compass: document.getElementById('compass'),
    minimap: document.getElementById('minimap'),
  };
}

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function headingDeg(heading) {
  // Heading 0 = north (-Z); compass degrees clockwise from north.
  let deg = (-heading * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  return deg;
}

// --- Instrument panel: attitude ball, airspeed, altimeter, throttle ---
function drawGauges(hud, f) {
  const c = hud.gauges;
  const ctx = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(8, 14, 22, 0.88)';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(125, 255, 176, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  // Attitude ball (artificial horizon).
  const ax = 90;
  const ay = H / 2;
  const ar = 36;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(ax, ay);
  ctx.rotate(-f.bank);
  ctx.translate(0, clamp(f.pitch, -0.5, 0.5) * 90);
  ctx.fillStyle = '#2f6fc4';
  ctx.fillRect(-ar - 2, -ar - 2, ar * 2 + 4, ar + 2);
  ctx.fillStyle = '#8a6a42';
  ctx.fillRect(-ar - 2, 0, ar * 2 + 4, ar + 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-ar, 0);
  ctx.lineTo(ar, 0);
  ctx.stroke();
  ctx.restore();
  // Fixed wings + bezel.
  ctx.strokeStyle = GLOW;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ax, ay, ar, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ax - 26, ay);
  ctx.lineTo(ax - 8, ay);
  ctx.moveTo(ax + 8, ay);
  ctx.lineTo(ax + 26, ay);
  ctx.stroke();
  ctx.fillStyle = GLOW;
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATT', ax, ay + ar + 12);

  // Airspeed dial (knots).
  const sx = 250;
  const sy = H / 2;
  const sr = 36;
  drawDial(ctx, sx, sy, sr, clamp((f.speed * MS_TO_KT) / 200, 0, 1), CYAN, 'AIRSPEED');
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(String(Math.round(f.speed * MS_TO_KT)), sx, sy + 2);
  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = CYAN;
  ctx.fillText('KT', sx, sy + 18);

  // Altimeter dial (feet, 0-10000).
  const lx = 410;
  drawDial(ctx, lx, sy, sr, clamp((f.pos.y * M_TO_FT) / 10000, 0, 1), GLOW, 'ALTITUDE');
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(String(Math.round(f.pos.y * M_TO_FT)), lx, sy + 2);
  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = GLOW;
  ctx.fillText('FT', lx, sy + 18);

  // Vertical speed.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  const vs = Math.round(f.vspeed * MS_TO_FPM);
  ctx.fillText(`${vs >= 0 ? '+' : ''}${vs}`, 480, sy - 6);
  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = '#9fb4c4';
  ctx.fillText('VERT FT/MIN', 480, sy + 14);

  // Throttle bar.
  const tx = 640;
  ctx.fillStyle = '#22303c';
  ctx.fillRect(tx, sy - 26, 220, 16);
  ctx.fillStyle = AMBER;
  ctx.fillRect(tx, sy - 26, 220 * f.throttle, 16);
  ctx.strokeStyle = 'rgba(255, 176, 32, 0.6)';
  ctx.strokeRect(tx + 0.5, sy - 26.5, 220, 16);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`THR ${Math.round(f.throttle * 100)}%`, tx, sy + 22);
  // Flaps / gear lamps.
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = f.flaps ? AMBER : '#5a6a76';
  ctx.fillText(`FLAPS ${f.flaps ? 'DOWN' : 'UP'}`, tx, sy + 42);
  ctx.fillStyle = f.gear ? GLOW : RED;
  ctx.fillText(`GEAR ${f.gear ? 'DOWN' : 'UP'}`, tx + 130, sy + 42);

  // Next target readout.
  const t = f.nextRingTarget();
  const dist = Math.round(
    Math.sqrt((t.x - f.pos.x) ** 2 + (t.z - f.pos.z) ** 2),
  );
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`${t.label}`, 920, sy - 6);
  ctx.font = 'bold 13px sans-serif';
  ctx.fillStyle = AMBER;
  ctx.fillText(`${dist} m ahead`, 920, sy + 16);
  ctx.fillStyle = '#9fb4c4';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('NEXT TARGET', 920, sy + 36);
}

function drawDial(ctx, x, y, r, frac, color, label) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#101c26';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r - 5, -Math.PI * 0.75, -Math.PI * 0.75 + frac * Math.PI * 1.5);
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y + r + 12);
}

// --- Compass tape: heading degrees with the next-target bearing ---
function drawCompass(hud, f) {
  const c = hud.compass;
  const ctx = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(8, 14, 22, 0.8)';
  ctx.fillRect(0, 0, W, H);
  const hdg = headingDeg(f.heading);
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px sans-serif';
  // Ticks every 10 degrees across the tape.
  for (let d = -60; d <= 60; d += 10) {
    let deg = Math.round(hdg + d);
    deg = ((deg % 360) + 360) % 360;
    const x = W / 2 + d * 4.4;
    const major = deg % 30 === 0;
    ctx.strokeStyle = major ? '#ffffff' : '#7a8a96';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, major ? 8 : 14);
    ctx.lineTo(x, 22);
    ctx.stroke();
    if (major) {
      ctx.fillStyle = '#ffffff';
      const label = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg);
      ctx.fillText(label, x, 36);
    }
  }
  // Next-target bearing marker.
  const t = f.nextRingTarget();
  const targetHdg = headingDeg(f.bearingTo(t.x, t.z));
  let rel = wrapAngle((targetHdg - hdg) * (Math.PI / 180)) * (180 / Math.PI);
  if (Math.abs(rel) < 75) {
    const x = W / 2 + rel * 4.4;
    ctx.fillStyle = AMBER;
    ctx.beginPath();
    ctx.moveTo(x, 40);
    ctx.lineTo(x - 7, 52);
    ctx.lineTo(x + 7, 52);
    ctx.closePath();
    ctx.fill();
  }
  // Centre caret + digital heading.
  ctx.fillStyle = GLOW;
  ctx.beginPath();
  ctx.moveTo(W / 2, 0);
  ctx.lineTo(W / 2 - 6, 8);
  ctx.lineTo(W / 2 + 6, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`${String(Math.round(hdg)).padStart(3, '0')}°`, W / 2, H - 6);
}

// --- Minimap: the whole valley top-down ---
function drawMinimap(hud, f) {
  const c = hud.minimap;
  const ctx = c.getContext('2d');
  const W = c.width;
  const H = c.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#16241a';
  ctx.fillRect(0, 0, W, H);
  const mx = (x) => ((x - WORLD.xMin) / (WORLD.xMax - WORLD.xMin)) * W;
  const mz = (z) => ((WORLD.zMax - z) / (WORLD.zMax - WORLD.zMin)) * H;
  // Mountains: darker edges.
  ctx.fillStyle = '#2c3a2e';
  ctx.fillRect(0, 0, W * 0.18, H);
  ctx.fillRect(W * 0.82, 0, W * 0.18, H);
  // River.
  ctx.strokeStyle = '#3f7fc4';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let z = WORLD.zMax; z >= WORLD.zMin; z -= 120) {
    const rx = riverX(z);
    if (z === WORLD.zMax) ctx.moveTo(mx(rx), mz(z));
    else ctx.lineTo(mx(rx), mz(z));
  }
  ctx.stroke();
  // Lake.
  ctx.fillStyle = '#3f7fc4';
  ctx.beginPath();
  ctx.arc(mx(430), mz(-3750), 7, 0, Math.PI * 2);
  ctx.fill();
  // Runways.
  ctx.fillStyle = '#c8c8c8';
  ctx.fillRect(mx(-13), mz(210), 4, 16);
  ctx.fillRect(mx(-13), mz(-3390), 4, 16);
  // Rings.
  RINGS.forEach((r, i) => {
    const done = f.rings[i].done;
    const next = i === f.nextRing;
    ctx.beginPath();
    ctx.arc(mx(r.x), mz(r.z), next ? 6 : 4, 0, Math.PI * 2);
    ctx.strokeStyle = done ? '#2fae5f' : next ? AMBER : '#2f6fd0';
    ctx.lineWidth = next ? 3 : 2;
    ctx.stroke();
  });
  // Plane arrow.
  const px = mx(f.pos.x);
  const pz = mz(f.pos.z);
  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(-f.heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Frame.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
}

export function updateHud(hud, f) {
  hud.ringsEl.textContent = `RINGS ${f.ringsDone} / ${RINGS.length}`;
  hud.scoreEl.textContent = `SCORE ${f.score}`;
  hud.timeEl.textContent = fmtTime(f.time);
  hud.livesEl.textContent = `✈ ${'●'.repeat(Math.max(0, f.lives))}${'○'.repeat(Math.max(0, 3 - f.lives))}`;
  if (f.message && f.messageT > 0) {
    hud.toastEl.textContent = f.message;
    hud.toastEl.style.opacity = '1';
  } else {
    hud.toastEl.style.opacity = '0';
  }
  hud.stallEl.classList.toggle('on', f.stallWarn && f.state === 'flying');
  hud.gearEl.style.opacity =
    f.state === 'flying' && !f.gear && f.pos.y - 1.35 < 120 ? '1' : '0';
  drawGauges(hud, f);
  drawCompass(hud, f);
  drawMinimap(hud, f);
}

// RIDGE RUN — the entry point. Owns the loop, the screens, the sound
// wiring and the ?shot= staging hook. The rules live in flight.js, the
// pictures in render.js and terrain.js, the instruments in hud.js.

import { SoundBank } from './audio.js';
import { Flight } from './flight.js';
import { initHud, updateHud } from './hud.js';
import { attachInput } from './input.js';
import { Renderer } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

const hud = initHud();
const renderer = new Renderer(canvas);
const flight = new Flight();

const game = {
  flight,
  renderer,
  screen: 'title', // title | play | paused | crashed | landed | done
  muted: false,
  time: 0,
  best: 0,
  prevRings: 0,
  audio: new SoundBank(),
  lastStallBeep: 0,

  start() {
    this.audio.ensure();
    this.audio.click();
    if (this.screen === 'title' || this.screen === 'landed' || this.screen === 'done') {
      this.flight.reset();
      this.prevRings = 0;
      this.screen = 'play';
      this.show('hud');
      this.hide('titlescreen');
      this.hide('endscreen');
      this.hide('crashscreen');
    }
  },

  confirm() {
    if (this.screen === 'title' || this.screen === 'landed' || this.screen === 'done') {
      this.start();
    } else if (this.screen === 'crashed') {
      this.retry();
    }
  },

  retry() {
    this.audio.ensure();
    this.audio.click();
    if (this.flight.respawn()) {
      this.prevRings = this.flight.ringsDone;
      this.screen = 'play';
      this.hide('crashscreen');
      this.show('hud');
    } else {
      this.showResults('OUT OF LIVES', 'Three crashes, and the valley wins this time.');
    }
  },

  resetRun() {
    if (this.screen !== 'play' && this.screen !== 'paused') return;
    this.flight.reset();
    this.prevRings = 0;
    this.screen = 'play';
    this.hide('pausescreen');
    this.hide('endscreen');
    this.hide('crashscreen');
    this.show('hud');
  },

  togglePause() {
    if (this.screen === 'play') {
      this.screen = 'paused';
      this.show('pausescreen');
    } else if (this.screen === 'paused') {
      this.screen = 'play';
      this.hide('pausescreen');
    }
  },

  toggleMute() {
    this.muted = !this.muted;
    this.audio.setMuted(this.muted);
  },

  toggleCamera() {
    const next = this.renderer.cameraMode === 'chase' ? 'cockpit' : 'chase';
    this.renderer.setCameraMode(next);
    this.flight.say(next === 'cockpit' ? 'COCKPIT VIEW' : 'CHASE VIEW', 2);
  },

  toggleFlaps() {
    if (this.screen !== 'play') return;
    this.flight.flaps = !this.flight.flaps;
    this.audio.click();
    this.flight.say(this.flight.flaps ? 'FLAPS DOWN' : 'FLAPS UP', 1.5);
  },

  toggleGear() {
    if (this.screen !== 'play') return;
    this.flight.gear = !this.flight.gear;
    this.audio.click();
    this.flight.say(this.flight.gear ? 'GEAR DOWN' : 'GEAR UP — land with it down', 2);
  },

  showResults(title, line) {
    this.screen = 'done';
    const f = this.flight;
    this.best = Math.max(this.best, f.score);
    try {
      const prev = Number(window.localStorage.getItem('ridge-run-best') || 0);
      this.best = Math.max(this.best, prev);
      window.localStorage.setItem('ridge-run-best', String(this.best));
    } catch (e) { /* storage unavailable: best stays in memory */ }
    document.getElementById('endtitle').textContent = title;
    document.getElementById('endtext').innerHTML =
      `${line}<br>Rings <b>${f.ringsDone} / 8</b> &nbsp;•&nbsp; Landing bonus <b>+${f.landingBonus}</b> &nbsp;•&nbsp; Time bonus <b>+${f.timeBonus}</b><br>` +
      `Score <b>${f.score}</b> &nbsp;•&nbsp; Best <b>${this.best}</b>`;
    this.show('endscreen');
    this.hide('hud');
  },

  show(id) {
    document.getElementById(id).classList.remove('hidden');
  },
  hide(id) {
    document.getElementById(id).classList.add('hidden');
  },
};

const input = attachInput(game);

// Buttons.
document.getElementById('startbtn').addEventListener('click', () => game.start());
document.getElementById('resumebtn').addEventListener('click', () => game.togglePause());
document.getElementById('restartbtn').addEventListener('click', () => {
  game.hide('pausescreen');
  game.flight.reset();
  game.screen = 'play';
  game.show('hud');
});
document.getElementById('retrybtn').addEventListener('click', () => game.retry());
document.getElementById('againbtn').addEventListener('click', () => game.start());

try {
  game.best = Number(window.localStorage.getItem('ridge-run-best') || 0);
} catch (e) { /* ignore */ }

// Staged screenshots drive the real sim, then flag readiness. A staged
// play shot also has to move the DOM: the title overlay is real DOM, and
// the HUD only shows once the run has started.
if (shotName) {
  stageShot(shotName, game);
  if (game.screen === 'play') {
    game.hide('titlescreen');
    game.show('hud');
  }
}
window.__ridge = game;
window.__shotReady = false;

let last = performance.now();
let frames = 0;
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  game.time += dt;

  if (game.screen === 'play') {
    const prevState = flight.state;
    flight.update(dt, input);
    game.audio.update(flight.throttle, flight.speed, flight.airborne);
    if (flight.state === 'crashed' && prevState !== 'crashed') {
      game.audio.crash();
      game.screen = 'crashed';
      document.getElementById('crashreason').textContent =
        `${flight.crashReason} — ${flight.lives} ${flight.lives === 1 ? 'life' : 'lives'} left`;
      document.getElementById('retrybtn').textContent =
        flight.lives > 0 ? 'BACK IN THE AIR' : 'SEE RESULTS';
      game.show('crashscreen');
    }
    if (flight.state === 'landed' && prevState !== 'landed') {
      game.audio.thud();
      game.showResults('LANDED AT LAKESIDE', 'Runway B, wheels down, course complete.');
    }
    if (flight.stallWarn && game.time - game.lastStallBeep > 0.6) {
      game.lastStallBeep = game.time;
      game.audio.stallBeep();
    }
    if (flight.ringsDone > game.prevRings) {
      game.prevRings = flight.ringsDone;
      game.audio.ring();
    }
  }

  const cinematic = game.screen === 'title';
  renderer.render(flight, game.time, dt, cinematic);
  updateHud(hud, flight);

  frames += 1;
  if (shotName && frames >= 8 && !window.__shotReady) {
    window.__shotReady = true;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

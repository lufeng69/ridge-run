// RIDGE RUN — seeded RNG and value noise. The same seed always builds the
// same valley, so the screenshots are reproducible and the tests are stable.

// Mulberry32: small, fast, deterministic.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D value noise with smooth interpolation, built from a hashed grid so
// any (x, z) can be sampled without storing a map.
export function makeNoise2(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) base[i] = i;
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const t = base[i];
    base[i] = base[j];
    base[j] = t;
  }
  for (let i = 0; i < 512; i += 1) perm[i] = base[i & 255];

  function fade(t) {
    return t * t * (3 - 2 * t);
  }
  function grad(ix, iz) {
    return perm[(perm[ix & 255] + iz) & 255] / 255;
  }
  function noise(x, z) {
    const ix = Math.floor(x);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fz = z - iz;
    const a = grad(ix, iz);
    const b = grad(ix + 1, iz);
    const c = grad(ix, iz + 1);
    const d = grad(ix + 1, iz + 1);
    const u = fade(fx);
    const v = fade(fz);
    return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
  }
  // Fractal sum: 4 octaves.
  return function fbm(x, z) {
    let sum = 0;
    let amp = 0.55;
    let freq = 1;
    for (let o = 0; o < 4; o += 1) {
      sum += amp * noise(x * freq, z * freq);
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum; // roughly [-1, 1]
  };
}

import { fbm, ridged, smoothstep } from "./noise";

// Procedural landscape of Machu Picchu. Units ~ 10 m, y = 0 is the top of the citadel.
// North is -z: Huayna Picchu rises behind the citadel, Machu Picchu mountain to the south,
// and the Urubamba river loops around the massif far below.

export const VALLEY = -48;
export const RIVER_Y = VALLEY + 0.9;

// Citadel "wedding cake" of terraces: level i is an ellipse that grows and drops per level.
export const CAKE = {
  levels: 12,
  a0: 24, // half length along z of the top level
  b0: 10.5, // half width along x of the top level
  da: 1.3,
  db: 1.4,
  drop: 0.9,
  shiftX: 0.55, // terraces flare towards +x (east) ...
  shiftZ: 0.7, // ... and +z (south, the agricultural sector)
};

export const cakeLevel = (i: number) => ({
  a: CAKE.a0 + CAKE.da * i,
  b: CAKE.b0 + CAKE.db * i,
  cx: CAKE.shiftX * i,
  cz: CAKE.shiftZ * i,
  y: -CAKE.drop * i,
});

const last = cakeLevel(CAKE.levels - 1);
export const PLATEAU = {
  a: last.a + 2.5,
  b: last.b + 2.5,
  cx: last.cx,
  cz: last.cz,
  y: last.y - 1.5,
};

const peak = (
  x: number,
  z: number,
  cx: number,
  cz: number,
  top: number,
  r: number,
  p: number,
  q: number,
) => {
  const d = Math.hypot(x - cx, z - cz);
  if (d >= r) return -Infinity;
  const t = 1 - Math.pow(d / r, p);
  return VALLEY + (top - VALLEY) * Math.pow(t, q);
};

// River path: a loop around the massif, as a radius per angle around RIVER_CENTER.
export const RIVER_CENTER = { x: 0, z: -8 };
export const riverRadius = (theta: number) => {
  // theta = 0 points north (-z). The loop widens towards the south.
  const southness = (1 - Math.cos(theta)) / 2; // 0 north, 1 south
  return 74 + 34 * Math.pow(southness, 2) + 5 * Math.sin(theta * 3.0);
};

export const polar = (x: number, z: number) => {
  const dx = x - RIVER_CENTER.x;
  const dz = z - RIVER_CENTER.z;
  const r = Math.hypot(dx, dz);
  const theta = Math.atan2(dx, -dz);
  return { r, theta };
};

export const heightAt = (x: number, z: number): number => {
  const { r, theta } = polar(x, z);
  const rr = riverRadius(theta);
  const dr = r - rr;

  // Valley floor: a gentle V along the river.
  let h =
    VALLEY -
    1.5 +
    Math.min(9, Math.abs(dr) * 0.42) +
    fbm(x * 0.05, z * 0.05, 2) * 0.8;

  // Plateau under the citadel (flat top, steep flanks).
  const e = Math.hypot(
    (x - PLATEAU.cx) / PLATEAU.b,
    (z - PLATEAU.cz) / PLATEAU.a,
  );
  const flank = smoothstep(1, 1.95, e);
  const plateau =
    PLATEAU.y -
    (PLATEAU.y - VALLEY + 2) * Math.pow(flank, 0.75) +
    fbm(x * 0.12, z * 0.12, 3) * 2.2 * flank;
  h = Math.max(h, plateau);

  // Huayna Picchu (sugarloaf), Uña Picchu and Machu Picchu mountain.
  const hp = peak(x, z, -6, -66, 31, 34, 1.7, 1.25);
  const una = peak(x, z, 17, -52, 4, 22, 1.6, 1.3);
  const mp = peak(x, z, 12, 108, 62, 70, 1.3, 1.25);
  // Saddle linking the plateau with Huayna Picchu.
  const saddle = peak(x * 1.6, z, -4, -38, -19, 22, 2, 1);
  h = Math.max(
    h,
    hp + fbm(x * 0.2, z * 0.2, 3) * 1.8,
    una,
    mp + fbm(x * 0.08, z * 0.08, 3) * 4,
    saddle,
  );

  // Outer ring of Andean peaks beyond the river.
  if (dr > 4) {
    const rise = Math.pow(smoothstep(6, 190, dr), 1.3);
    const crest = 0.45 + 0.8 * ridged(x * 0.011 + 3.1, z * 0.011 - 1.7, 4);
    const ring =
      VALLEY - 1 + rise * crest * 92 + fbm(x * 0.04, z * 0.04, 3) * 5 * rise;
    h = Math.max(h, ring);
  }
  return h;
};

/** True when (x, z) lies on the flat plateau around the citadel (no trees there). */
export const onPlateau = (x: number, z: number, margin = 0) =>
  Math.hypot(
    (x - PLATEAU.cx) / (PLATEAU.b + margin),
    (z - PLATEAU.cz) / (PLATEAU.a + margin),
  ) < 1;

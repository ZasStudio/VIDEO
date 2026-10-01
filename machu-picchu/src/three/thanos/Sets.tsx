import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm, mulberry, smoothstep } from "../noise";
import { V3, canvasTexture, noise3, paintGeo, shadeHex, toy, vertexMat } from "../inca/kit";
import { Flame, FlamePalette, Smoke } from "../oxigeno/Props";
import { Glow, Sparks, additive } from "./FX";

// Sets for the Thanos short. Centred at the origin, ground at y = 0, world units sized for Nubi at
// size 2 (2 wide, ≈ 2 tall); front = +z (the camera usually looks towards −z). `t` = seconds.
// No sky: the scenes paint a CSS gradient behind the canvas (BATTLE_SKY / CASTLE_SKY suggested).
// The sets carry no lights of their own except the castle's torch point lights: add
// <BattleLights /> or <CastleLights /> (or your own) to the scene.

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Merges geometries after making them non-indexed without uvs (vertex-coloured meshes). */
const mergeAll = (geos: THREE.BufferGeometry[]) => {
  const clean = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    if (ng.attributes.uv) ng.deleteAttribute("uv");
    if (ng.attributes.uv1) ng.deleteAttribute("uv1");
    return ng;
  });
  const m = mergeGeometries(clean, false);
  if (!m) throw new Error("mergeGeometries failed");
  return m;
};

/** Paints a geometry one colour and places it. */
const place = (g: THREE.BufferGeometry, color: string | THREE.Color, pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) => {
  paintGeo(g, typeof color === "string" ? color : `#${color.getHexString()}`);
  g.applyMatrix4(
    new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale)),
  );
  return g;
};

const rbox = (w: number, h: number, d: number, r = 0.06) => new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));

/** Blends a colour towards `haze` by k (aerial perspective baked into vertex colours). */
const hazed = (c: string, haze: string, k: number) => `#${new THREE.Color(c).lerp(new THREE.Color(haze), clamp01(k)).getHexString()}`;

const texMatCache = new Map<THREE.Texture, THREE.MeshStandardMaterial>();
/** Material for a canvas texture (emissive map keeps colours readable). Cached per texture. */
const texMat = (tex: THREE.Texture, rough = 0.8, glow = 0.14, transparent = false) => {
  let m = texMatCache.get(tex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: rough,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tex,
      emissiveIntensity: glow,
      transparent,
      depthWrite: !transparent,
    });
    texMatCache.set(tex, m);
  }
  return m;
};

// =======================================================================================
// Battlefield

/** Suggested CSS sky behind the battlefield (dusk), and the haze its far edge fades into. */
export const BATTLE_SKY = "linear-gradient(180deg, #24184F 0%, #4B2E7E 26%, #93508C 50%, #E07A66 72%, #F7AE72 88%, #FFD08E 100%)";
export const BATTLE_HAZE = "#CF8E7C";

/** The flat battle ground: y = 0 for |x| < 26 and −24 < z < 18 (characters stand around z −10..10). */
export const BATTLE_FLAT = { x: 26, zBack: -24, zFront: 18 };
/** Terrain extent: a 320 × 320 square centred on the origin; mesas ring it at r ≈ 115-175. */
export const BATTLE_SIZE = 320;

const CRATERS: [number, number, number, number][] = [
  // x, z, radius, depth (all outside the flat zone)
  [-38, -34, 7, 1.6],
  [33, -40, 9, 2],
  [44, -8, 6, 1.3],
  [-46, 4, 8, 1.6],
  [12, -52, 6, 1.2],
  [-20, -48, 5, 1],
  [58, -60, 10, 2.2],
  [-62, -58, 9, 2],
  [30, 30, 7, 1.4],
  [-34, 32, 6, 1.2],
];

const outsideFlat = (x: number, z: number) => {
  const dx = Math.max(0, Math.abs(x) - BATTLE_FLAT.x);
  const dz = Math.max(0, BATTLE_FLAT.zBack - z, z - BATTLE_FLAT.zFront);
  return Math.hypot(dx, dz);
};

/**
 * Ground height of the Battlefield at (x, z): exactly 0 on the flat zone (BATTLE_FLAT), then
 * dunes, craters and rising hills further out (≈ 2-4 at 40 units, 8-15 at 100+).
 */
export const battleGroundY = (x: number, z: number) => {
  const out = outsideFlat(x, z);
  if (out <= 0) return 0;
  const k = smoothstep(0, 16, out);
  const r = Math.hypot(x, z);
  let h = k * (0.6 + 1.3 * fbm(x * 0.03 + 4.1, z * 0.03 - 2.2) + 0.45 * fbm(x * 0.09, z * 0.09 + 3));
  h += smoothstep(45, 140, r) * (5 + 7 * (0.5 + 0.5 * fbm(x * 0.011 + 7, z * 0.011)));
  for (const [cx, cz, cr, depth] of CRATERS) {
    const d = Math.hypot(x - cx, z - cz) / cr;
    if (d < 1.6) h += depth * (d < 1 ? -(1 - d * d) : 0) + depth * 0.45 * Math.exp(-(((d - 1) / 0.22) ** 2));
  }
  return Math.max(-2.5, h) * k;
};

const DIRT = { a: "#B5764A", b: "#9C6240", c: "#C98E5C", red: "#A9583A", scorch: "#5A3A2E", pale: "#D6A574" };

const terrainGeometry = () => {
  const N = 170;
  const g = new THREE.PlaneGeometry(BATTLE_SIZE, BATTLE_SIZE, N, N);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const C = (h: string) => new THREE.Color(h);
  const a = C(DIRT.a);
  const b = C(DIRT.b);
  const cc = C(DIRT.c);
  const red = C(DIRT.red);
  const scorch = C(DIRT.scorch);
  const pale = C(DIRT.pale);
  const haze = C(BATTLE_HAZE);
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const y = battleGroundY(x, z);
    p.setY(i, y);
    c.copy(a).lerp(b, clamp01(0.5 + 1.5 * fbm(x * 0.06, z * 0.06)));
    c.lerp(cc, clamp01(fbm(x * 0.025 + 9, z * 0.025) * 2.2) * 0.6);
    c.lerp(red, clamp01((fbm(x * 0.04 - 5, z * 0.04 + 1) - 0.15) * 3) * 0.45);
    c.lerp(pale, clamp01((y - 2) / 8) * 0.5);
    for (const [cx, cz, cr] of CRATERS) {
      const d = Math.hypot(x - cx, z - cz) / cr;
      if (d < 1.2) c.lerp(scorch, (1 - smoothstep(0.3, 1.15, d)) * 0.75);
    }
    const r = Math.hypot(x, z * 1.15);
    c.lerp(haze, smoothstep(40, 150, r) * 0.8);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const ng = g.toNonIndexed();
  ng.deleteAttribute("uv");
  ng.computeVertexNormals();
  return ng;
};

/** Detail decal over the flat zone: scorch marks, shallow blast rings, cracks, pebbles. */
const groundDecalTexture = () =>
  canvasTexture("thanos-battle-decal", 1024, 1024, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    const rnd = mulberry(4711);
    // Mottled dirt.
    for (let i = 0; i < 220; i++) {
      const dark = rnd() < 0.55;
      ctx.fillStyle = dark ? `rgba(90,50,30,${0.08 + rnd() * 0.12})` : `rgba(235,185,130,${0.06 + rnd() * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(rnd() * W, rnd() * H, 20 + rnd() * 70, 10 + rnd() * 40, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Scorch marks / shallow blast rings (kept off the very centre).
    const marks: [number, number, number][] = [
      [0.22, 0.3, 70],
      [0.78, 0.22, 90],
      [0.85, 0.62, 60],
      [0.12, 0.7, 80],
      [0.6, 0.85, 55],
      [0.38, 0.12, 45],
      [0.5, 0.42, 40],
    ];
    for (const [fx, fy, r] of marks) {
      const x = fx * W;
      const y = fy * H;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.6);
      g.addColorStop(0, "rgba(40,22,18,0.75)");
      g.addColorStop(0.45, "rgba(60,32,22,0.55)");
      g.addColorStop(0.7, "rgba(120,70,40,0.25)");
      g.addColorStop(0.85, "rgba(225,170,120,0.2)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
      // Splatter spokes.
      ctx.strokeStyle = "rgba(50,28,20,0.35)";
      ctx.lineCap = "round";
      for (let k = 0; k < 9; k++) {
        const a = rnd() * Math.PI * 2;
        ctx.lineWidth = 2 + rnd() * 4;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6);
        ctx.lineTo(x + Math.cos(a) * r * (1.3 + rnd() * 0.8), y + Math.sin(a) * r * (1.3 + rnd() * 0.8));
        ctx.stroke();
      }
    }
    // Dry cracks.
    ctx.strokeStyle = "rgba(60,32,20,0.45)";
    for (let i = 0; i < 26; i++) {
      let x = rnd() * W;
      let y = rnd() * H;
      let a = rnd() * Math.PI * 2;
      ctx.lineWidth = 1.5 + rnd() * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        a += (rnd() - 0.5) * 1.2;
        x += Math.cos(a) * (10 + rnd() * 18);
        y += Math.sin(a) * (10 + rnd() * 18);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Pebbles with a light top.
    for (let i = 0; i < 500; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = 1.5 + rnd() * 3.5;
      ctx.fillStyle = `rgba(80,50,35,${0.35 + rnd() * 0.3})`;
      ctx.beginPath();
      ctx.arc(x, y + 1, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(230,190,150,${0.3 + rnd() * 0.3})`;
      ctx.beginPath();
      ctx.arc(x - 0.5, y - 0.5, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    // Fade the edges out so the decal melts into the terrain colours.
    ctx.globalCompositeOperation = "destination-in";
    const fade = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.5);
    fade.addColorStop(0, "rgba(0,0,0,1)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
  });

const SAND = ["#C49468", "#B3835A", "#D2A476", "#A9784F"];

/** A stretch of broken stone wall: staggered block courses under a jagged broken top. */
const ruinWall = (rnd: () => number, len: number, h: number, thick: number, haze: number) => {
  const geos: THREE.BufferGeometry[] = [];
  const course = 0.62;
  const rows = Math.ceil(h / course);
  const bins = Math.ceil(len) + 1;
  const prof = Array.from({ length: bins }, (_, i) => {
    const edge = Math.min(i, bins - 1 - i);
    return h * (0.25 + 0.75 * rnd()) * Math.min(1, 0.35 + edge * 0.35);
  });
  for (let r = 0; r < rows; r++) {
    let x = -len / 2 + (r % 2 ? 0.45 : 0);
    while (x < len / 2 - 0.2) {
      const w = Math.min(0.85 + rnd() * 0.65, len / 2 - x);
      const top = prof[Math.max(0, Math.min(bins - 1, Math.round(x + w / 2 + len / 2)))];
      if ((r + 1) * course <= top + 0.2 || r === 0) {
        const tone = hazed(shadeHex(SAND[Math.floor(rnd() * SAND.length)], (rnd() - 0.5) * 0.06), BATTLE_HAZE, haze);
        geos.push(place(rbox(w - 0.05, course - 0.05, thick * (0.92 + rnd() * 0.12), 0.07), tone, [x + w / 2, r * course + course / 2, (rnd() - 0.5) * 0.08], [0, (rnd() - 0.5) * 0.04, (rnd() - 0.5) * 0.03]));
      }
      x += w;
    }
  }
  // A few fallen blocks at the foot.
  for (let i = 0; i < 4; i++) {
    const tone = hazed(SAND[Math.floor(rnd() * SAND.length)], BATTLE_HAZE, haze);
    geos.push(place(rbox(0.7 + rnd() * 0.4, 0.5, 0.6, 0.07), tone, [(rnd() - 0.5) * len, 0.24, (rnd() < 0.5 ? -1 : 1) * (thick * 0.6 + 0.4 + rnd() * 0.8)], [rnd() * 0.3, rnd() * 3, rnd() * 0.3]));
  }
  return geos;
};

/** A column of stacked drums; broken ones end in a tilted half drum. */
const ruinPillar = (rnd: () => number, h: number, r: number, broken: boolean, haze: number) => {
  const geos: THREE.BufferGeometry[] = [];
  const tone = () => hazed(shadeHex(SAND[Math.floor(rnd() * SAND.length)], (rnd() - 0.5) * 0.05), BATTLE_HAZE, haze);
  geos.push(place(rbox(r * 2.8, 0.45, r * 2.8, 0.08), tone(), [0, 0.22, 0]));
  geos.push(place(new THREE.CylinderGeometry(r * 1.15, r * 1.25, 0.3, 14), tone(), [0, 0.6, 0]));
  let y = 0.75;
  const drum = 0.95;
  while (y + drum < h) {
    geos.push(place(new THREE.CylinderGeometry(r, r * 1.02, drum - 0.04, 14), tone(), [0, y + drum / 2, 0], [0, rnd() * 3, 0]));
    y += drum;
  }
  if (broken) {
    geos.push(place(new THREE.CylinderGeometry(r * 0.96, r, drum * 0.6, 14, 1, false, 0, Math.PI * 1.3), tone(), [0.04, y + drum * 0.3, 0], [0.18, rnd() * 3, 0.12]));
  } else {
    geos.push(place(new THREE.CylinderGeometry(r * 1.25, r, 0.35, 14), tone(), [0, y + 0.17, 0]));
    geos.push(place(rbox(r * 2.9, 0.42, r * 2.9, 0.08), tone(), [0, y + 0.55, 0]));
  }
  return geos;
};

/** The ruined compound in the distance: a broken tower and a collapsed wing (hazed). */
const ruinBuilding = (haze: number) => {
  const rnd = mulberry(9001);
  const geos: THREE.BufferGeometry[] = [];
  const con = ["#9A93A2", "#8A8494", "#A7A0AC"];
  const dark = hazed("#3C3546", BATTLE_HAZE, haze * 0.8);
  const tone = () => hazed(shadeHex(con[Math.floor(rnd() * con.length)], (rnd() - 0.5) * 0.05), BATTLE_HAZE, haze);
  const parts: { x0: number; x1: number; floors: number; missing: (b: number, f: number) => boolean }[] = [
    { x0: -15, x1: -3, floors: 6, missing: (b, f) => (f >= 4 && b >= 2) || (f === 5 && b === 1) || (f === 2 && b === 1) },
    { x0: -3, x1: 13, floors: 3, missing: (b, f) => (b >= 3 && f >= 1) || (b === 4 && f === 0) || (f === 2 && b === 1) },
  ];
  const FH = 3.6;
  const D = 8;
  for (const part of parts) {
    const bays = Math.round((part.x1 - part.x0) / 3);
    const bw = (part.x1 - part.x0) / bays;
    // Dark interior back wall so the windows read as holes.
    geos.push(place(rbox(part.x1 - part.x0, part.floors * FH * 0.92, 0.3), dark, [(part.x0 + part.x1) / 2, (part.floors * FH * 0.92) / 2, -D / 2 + 0.3]));
    for (let f = 0; f < part.floors; f++) {
      for (let b = 0; b < bays; b++) {
        if (part.missing(b, f)) continue;
        const x = part.x0 + bw * (b + 0.5);
        const y = f * FH;
        // Slab, then the facade around a window.
        geos.push(place(rbox(bw + 0.05, 0.42, D), tone(), [x, y + FH - 0.2, 0], [0, 0, (rnd() - 0.5) * 0.02]));
        geos.push(place(rbox(bw * 0.22, FH - 0.4, 0.5), tone(), [x - bw * 0.39, y + FH / 2 - 0.1, D / 2 - 0.25]));
        geos.push(place(rbox(bw * 0.22, FH - 0.4, 0.5), tone(), [x + bw * 0.39, y + FH / 2 - 0.1, D / 2 - 0.25]));
        geos.push(place(rbox(bw * 0.58, 0.9, 0.5), tone(), [x, y + 0.5, D / 2 - 0.25]));
        if (rnd() < 0.7) geos.push(place(rbox(bw * 0.58, 0.5, 0.5), tone(), [x, y + FH - 0.65, D / 2 - 0.25]));
      }
      // Columns at the bay edges (some taller, snapped).
      for (let b = 0; b <= bays; b++) {
        if (part.missing(Math.min(b, bays - 1), f) && part.missing(Math.max(0, b - 1), f)) continue;
        geos.push(place(rbox(0.6, FH, 0.6), tone(), [part.x0 + bw * b, f * FH + FH / 2, D / 2 - 0.3]));
      }
    }
    // Broken stubs and leaning beams on top.
    for (let b = 0; b <= bays; b += 2) {
      const top = part.floors * FH;
      if (rnd() < 0.6) geos.push(place(rbox(0.5, 1 + rnd() * 2.2, 0.5), tone(), [part.x0 + bw * b, top + 0.6, D / 2 - 0.3], [0, 0, (rnd() - 0.5) * 0.3]));
    }
  }
  // A snapped mast leaning off the tower and rubble heaps at the foot.
  geos.push(place(new THREE.CylinderGeometry(0.16, 0.22, 9, 8), hazed("#6D6575", BATTLE_HAZE, haze), [-8, 6 * FH + 3.2, 0], [0, 0, -0.5]));
  for (let i = 0; i < 26; i++) {
    const s = 0.8 + rnd() * 2.2;
    geos.push(place(new THREE.DodecahedronGeometry(1, 0), tone(), [-16 + rnd() * 30, s * 0.35, D / 2 + 0.5 + rnd() * 4], [rnd() * 3, rnd() * 3, rnd() * 3], [s * 1.3, s * 0.6, s]));
  }
  return mergeAll(geos);
};

/** Mesa / butte with banded strata (vertex coloured, hazed by `haze`). */
const mesaGeometry = (seed: number, haze: number) => {
  const prof: [number, number][] = [
    [1.0, 0],
    [0.97, 0.08],
    [0.8, 0.18],
    [0.66, 0.3],
    [0.6, 0.55],
    [0.57, 0.85],
    [0.58, 0.95],
    [0.5, 1.0],
    [0, 1.0],
  ];
  const g = new THREE.LatheGeometry(
    prof.map(([r, h]) => new THREE.Vector2(r, h)),
    22,
  ).toNonIndexed();
  const p = g.attributes.position;
  const bands = ["#C2693F", "#D98552", "#B25A38", "#E09A60", "#A64E33"];
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + 0.12 * noise3(v.x * 2 + seed, v.y * 2, v.z * 2) * (v.y > 0.02 ? 1 : 0);
    p.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  for (let f = 0; f < p.count; f += 3) {
    const y = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3;
    const band = Math.floor(y * 9 + noise3(seed, y * 3, 1) * 0.8);
    c.set(bands[((band % bands.length) + bands.length) % bands.length]);
    c.lerp(new THREE.Color(BATTLE_HAZE), haze);
    for (let k = 0; k < 3; k++) {
      col[(f + k) * 3] = c.r;
      col[(f + k) * 3 + 1] = c.g;
      col[(f + k) * 3 + 2] = c.b;
    }
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
};

// x, z, base radius, height, x stretch
const MESAS: [number, number, number, number, number][] = [
  [-70, -140, 26, 30, 1.6],
  [10, -165, 30, 24, 2.2],
  [85, -130, 22, 34, 1.3],
  [140, -60, 26, 22, 1.4],
  [-140, -70, 24, 26, 1.5],
  [-120, 60, 22, 18, 1.4],
  [125, 70, 24, 20, 1.6],
  [-30, 150, 26, 20, 2],
  [50, 155, 20, 24, 1.3],
  [-45, -110, 12, 16, 1.2],
  [48, -100, 10, 13, 1.3],
];

/** Scattered rocks, slabs and twisted beams (keeps the central action area nearly clear). */
const rubbleGeometry = () => {
  const rnd = mulberry(2468);
  const geos: THREE.BufferGeometry[] = [];
  const dode = new THREE.DodecahedronGeometry(1, 0);
  const rocks = ["#9A6A48", "#86593C", "#A97B55", "#7A5038", "#B48A64"];
  let placed = 0;
  let tries = 0;
  while (placed < 230 && tries < 4000) {
    tries++;
    const x = (rnd() - 0.5) * 150;
    const z = (rnd() - 0.5) * 150 - 15;
    const core = Math.abs(x) < 13 && z > -11 && z < 11;
    const r = Math.hypot(x, z);
    const big = rnd();
    let s = core ? 0.06 + rnd() * 0.14 : 0.15 + Math.pow(big, 2.5) * (r > 30 ? 2.6 : 1.3);
    if (core && rnd() < 0.5) continue;
    if (!core && r < 18 && rnd() < 0.4) s *= 0.5;
    const y = battleGroundY(x, z);
    const haze = smoothstep(40, 150, Math.hypot(x, z * 1.15)) * 0.8;
    const tone = hazed(shadeHex(rocks[Math.floor(rnd() * rocks.length)], (rnd() - 0.5) * 0.06), BATTLE_HAZE, haze);
    geos.push(place(dode.clone(), tone, [x, y + s * 0.3, z], [rnd() * 3, rnd() * 3, rnd() * 3], [s * 1.3, s * 0.75, s]));
    placed++;
  }
  // Concrete slabs and bent beams strewn around the mid ground.
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 17 + rnd() * 45;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r * 0.8 - 10;
    const y = battleGroundY(x, z);
    const haze = smoothstep(40, 150, Math.hypot(x, z * 1.15)) * 0.8;
    if (rnd() < 0.6) {
      const w = 1 + rnd() * 2.5;
      geos.push(place(rbox(w, 0.28, w * (0.5 + rnd() * 0.5), 0.05), hazed("#9C95A0", BATTLE_HAZE, haze), [x, y + 0.2, z], [(rnd() - 0.5) * 0.7, rnd() * 3, (rnd() - 0.5) * 0.6]));
    } else {
      const L = 2 + rnd() * 3;
      geos.push(place(new THREE.CylinderGeometry(0.08, 0.08, L, 6), hazed("#4E4652", BATTLE_HAZE, haze), [x, y + 0.5, z], [rnd() * 1.2, rnd() * 3, 0.9 + rnd() * 0.6]));
    }
  }
  return mergeAll(geos);
};

/** Walls and pillars of the ruined stone structures round the arena. */
const ruinsGeometry = () => {
  const rnd = mulberry(1357);
  const geos: THREE.BufferGeometry[] = [];
  const walls: [number, number, number, number, number][] = [
    // x, z, length, height, yaw
    [-21, -20, 7, 3.2, 0.25],
    [16, -27, 9, 3.8, -0.15],
    [30, -12, 6, 2.6, 1.2],
    [-31, -4, 7, 3, -1.3],
    [26, 9, 5, 2.2, 1.0],
    [-27, 13, 5, 1.8, -0.8],
    [2, -34, 8, 4.2, 0.05],
    [-12, -38, 6, 3, 0.4],
    [40, -30, 8, 3.5, -0.4],
    [-44, -24, 9, 4, 0.5],
    [6, 26, 6, 2, 0.1],
  ];
  for (const [x, z, len, h, yaw] of walls) {
    const haze = smoothstep(40, 150, Math.hypot(x, z * 1.15)) * 0.8;
    const y = battleGroundY(x, z);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y - 0.05, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(1, 1, 1));
    for (const g of ruinWall(rnd, len, h, 0.8, haze)) geos.push(g.applyMatrix4(m));
  }
  const pillars: [number, number, number, boolean][] = [
    [-15, -27, 5.5, true],
    [9, -31, 6.5, false],
    [21, -21, 4.2, true],
    [-25, -15, 3.4, true],
    [33, 3, 5, false],
    [-34, 6, 4.4, true],
    [-6, -42, 7, false],
    [24, -44, 5, true],
    [-38, -40, 6, false],
  ];
  for (const [x, z, h, broken] of pillars) {
    const haze = smoothstep(40, 150, Math.hypot(x, z * 1.15)) * 0.8;
    const y = battleGroundY(x, z);
    const m = new THREE.Matrix4().makeTranslation(x, y - 0.05, z);
    for (const g of ruinPillar(rnd, h, 0.55, broken, haze)) geos.push(g.applyMatrix4(m));
  }
  // Fallen drums lying around.
  for (const [x, z, a] of [
    [-12, -24, 0.4],
    [13, -24, 1.4],
    [27, -6, 2.2],
    [-29, 9, 0.9],
  ] as V3[]) {
    const tone = SAND[Math.floor(rnd() * SAND.length)];
    geos.push(place(new THREE.CylinderGeometry(0.55, 0.56, 0.9, 14), tone, [x, 0.55, z], [0, a, Math.PI / 2]));
    geos.push(place(new THREE.CylinderGeometry(0.55, 0.56, 0.9, 14), tone, [x + Math.cos(a) * 1.1, 0.55, z - Math.sin(a) * 1.1], [0.3, a, Math.PI / 2]));
  }
  return mergeAll(geos);
};

const SMOKE_COLUMNS: { at: V3; scale: number; seed: number; fire: boolean }[] = [
  { at: [-10, 21.5, -58], scale: 1.3, seed: 1, fire: false },
  { at: [26, 0, -40], scale: 1, seed: 2, fire: true },
  { at: [-36, 0, -28], scale: 0.9, seed: 3, fire: true },
  { at: [52, 0, -92], scale: 1.4, seed: 4, fire: true },
  { at: [-60, 0, -95], scale: 1.2, seed: 5, fire: true },
  { at: [6, 0, -108], scale: 1.5, seed: 6, fire: true },
];

/** Where Nubi lands / stands in the foreground, facing the camera (+z). */
export const FIELD_NUBI: V3 = [-1, 0, 5];
/** Where Thanos stands with the gauntlet raised (≈ 11 units behind Nubi). */
export const FIELD_THANOS: V3 = [1.5, 0, -6];
/** Centre of the small portal Nubi drops out of (radius 2, facing +z), up in the sky over FIELD_NUBI. */
export const FIELD_SKY_PORTAL: V3 = [-1, 9, 5];
/** The rock Nubi trips over on the run (a desert-tinted Rock, size ≈ 0.5). */
export const FIELD_TRIP_ROCK: V3 = [-0.4, 0, 0.8];
/** Centre of the ground crack / explosion (GroundCrack radius ≈ 4). */
export const FIELD_CRACK: V3 = [-0.6, 0, 1.5];
/** Giant portals (radius 12) standing on the ground round the back of the arena, facing +z. */
export const FIELD_GIANT_PORTALS: V3[] = [
  [-26, 11, -24],
  [26, 11, -24],
  [0, 11.5, -36],
];
/** A loose crescent of spots for the line of heroes (facing +z), clear of rubble. */
export const FIELD_HEROES: V3[] = [
  [-7.5, 0, 2],
  [-4.5, 0, 3.4],
  [-1.5, 0, 4],
  [1.5, 0, 4],
  [4.5, 0, 3.4],
  [7.5, 0, 2],
];

/**
 * The big battle location (dusk): a flat, dusty orange-brown arena (y = 0 on BATTLE_FLAT,
 * x −26..26, z −24..18; detail decal with scorch marks, cracks and pebbles) with rubble thinning
 * out towards the centre (only pebbles in |x| < 13, |z| < 11), broken sandstone walls and
 * columns round its edge, craters and dunes beyond (battleGroundY), the ruined compound in the
 * distance (z ≈ −58, a 22-tall broken tower + a collapsed wing), smoke columns rising from fires,
 * glowing embers drifting up, and hazy banded mesas ringing the horizon (r ≈ 115-175) in all
 * directions. Everything fades into BATTLE_HAZE with distance so it sits on BATTLE_SKY.
 * `t` = seconds (smoke, fire, embers). `frozen` 0..1 = time stopped: smoke, flames and embers
 * hold still at the moment `freezeT` (seconds); set freezeT to the time the freeze ends (when you
 * ramp `frozen` back to 0) and motion resumes without a jump. `embers` toggles the ember drift.
 */
export const Battlefield: React.FC<{ t?: number; frozen?: number; freezeT?: number; embers?: boolean }> = ({ t = 0, frozen = 0, freezeT = 0, embers = true }) => {
  const geos = useMemo(
    () => ({
      terrain: terrainGeometry(),
      rubble: rubbleGeometry(),
      ruins: ruinsGeometry(),
      building: ruinBuilding(0.42),
      decal: new THREE.PlaneGeometry(64, 52).rotateX(-Math.PI / 2),
      mesas: mergeAll(
        MESAS.map(([x, z, r, h, sx], i) => {
          const g = mesaGeometry(i * 3.7, 0.5 + 0.25 * smoothstep(110, 175, Math.hypot(x, z)));
          g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, battleGroundY(x, z) - 1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, i * 1.3, 0)), new THREE.Vector3(r * sx, h, r)));
          return g;
        }),
      ),
    }),
    [],
  );
  const decal = useMemo(() => {
    const m = texMat(groundDecalTexture(), 0.95, 0.12, true);
    m.polygonOffset = true;
    m.polygonOffsetFactor = -1;
    m.polygonOffsetUnits = -1;
    return m;
  }, []);
  const fz = clamp01(frozen);
  const clock = t * (1 - fz) + freezeT * fz;
  const fire: FlamePalette = ["#FF5A1F", "#FFB21A", "#FFF4B8"];
  return (
    <group>
      <mesh geometry={geos.terrain} material={vertexMat(0.95, true, 0.13)} receiveShadow />
      <mesh geometry={geos.decal} material={decal} position={[0, 0.005, -3]} renderOrder={0} />
      <mesh geometry={geos.rubble} material={vertexMat(0.9, true, 0.12)} castShadow receiveShadow />
      <mesh geometry={geos.ruins} material={vertexMat(0.85, true, 0.13)} castShadow receiveShadow />
      <group position={[-2, 0, -58]}>
        <mesh geometry={geos.building} material={vertexMat(0.9, true, 0.14)} />
        {/* Fires glowing inside the broken floors. */}
        {(
          [
            [-11, 4.3, 3.2],
            [-6, 11.5, 3.2],
            [5, 1, 4.2],
            [9, 4.6, 3.2],
          ] as V3[]
        ).map((p, i) => (
          <group key={i} position={p}>
            <Flame height={1.6} width={1.3} t={clock + i} seed={i * 2.1} palette={fire} />
            <Glow color="#FF7A2A" size={6} opacity={0.6 + 0.15 * Math.sin(clock * 9 + i)} position={[0, 0.8, 0]} />
          </group>
        ))}
      </group>
      <mesh geometry={geos.mesas} material={vertexMat(0.95, true, 0.22)} />
      {SMOKE_COLUMNS.map((s) => (
        <group key={s.seed} position={s.at} scale={s.scale}>
          {s.fire ? (
            <>
              <Flame height={2.6} width={2.4} t={clock + s.seed} seed={s.seed} palette={fire} />
              <Glow color="#FF7A2A" size={9} opacity={0.55 + 0.1 * Math.sin(clock * 8 + s.seed)} position={[0, 1.2, 0]} />
            </>
          ) : null}
          <group position={[0, 1.5, 0]}>
            <Smoke t={clock + s.seed * 4.3} height={44} r0={1.4} r1={8} count={13} speed={2.4} wobble={1.6} drift={0.22} color="#5E5058" opacity={0.85} seed={s.seed} />
          </group>
        </group>
      ))}
      {embers ? (
        <group position={[0, 0, -8]}>
          <Sparks mode="rise" count={160} seed={77} time={clock} width={0.06} tail={0.18} life={6} speed={1.1} spread={0.8} box={[70, 16, 50]} head="#FFE6A0" tailColor="#FF6A1A" opacity={0.9} />
        </group>
      ) : null}
    </group>
  );
};

/** Dusk lighting for the Battlefield: warm key from the front-left, violet sky fill, rim from behind. */
export const BattleLights: React.FC<{ k?: number }> = ({ k = 1 }) => (
  <>
    <hemisphereLight args={["#FFD9C0", "#5A3A5E", 1.25 * k]} />
    <directionalLight position={[-8, 10, 9]} intensity={2.3 * k} color="#FFC890" />
    <directionalLight position={[9, 6, -10]} intensity={1.1 * k} color="#C9A6FF" />
  </>
);

// =======================================================================================
// Doom castle

/** Suggested CSS background for the castle (it is enclosed; this only shows past the far wall). */
export const CASTLE_SKY = "linear-gradient(180deg, #05070F 0%, #0E1424 60%, #141B2E 100%)";

/** Hall interior: x −11..11, z −18 (back wall, big window) .. 10 (doors), 14 high. */
export const CASTLE = { x: 11, zBack: -18, zFront: 10, h: 14 };
/** The altar stands on a two-step round dais centred here. */
const ALTAR_AT: V3 = [0, 0, -3];
const DAIS_H = 0.4;
/** Top face of the stone altar (where the dead gauntlet lies; see GAUNTLET_LYING in Props). */
export const ALTAR_TOP: V3 = [0, 1.55, -3];
/** Where the castle's owner stands, behind the altar on the dais, facing the camera (+z). */
export const ALTAR_BEHIND: V3 = [0, DAIS_H, -5.1];
/** A spot on the floor in front of the altar (off the dais), facing it. */
export const ALTAR_FRONT: V3 = [0, 0, 1.2];

const STONE_TINTS = { wall: "#454C60", wallDark: "#2E3443", trim: "#5A6276", floor: "#3B4252", altar: "#6C7387" };

const wallStoneTexture = () =>
  canvasTexture(
    "thanos-castle-wall",
    512,
    512,
    (ctx, W, H) => {
      // One tile = 3 × 3 world units: four courses of staggered blocks.
      ctx.fillStyle = "#1B1F29";
      ctx.fillRect(0, 0, W, H);
      const rnd = mulberry(606);
      const rows = 4;
      const rh = H / rows;
      for (let r = 0; r < rows; r++) {
        let x = r % 2 ? -rh * 0.9 : 0;
        while (x < W) {
          const w = rh * (1.4 + rnd() * 0.9);
          const l = 27 + rnd() * 9;
          for (const dx of [0, W, -W]) {
            const x0 = x + dx + 4;
            const y0 = r * rh + 4;
            ctx.fillStyle = `hsl(${218 + rnd() * 8}, ${12 + rnd() * 6}%, ${l * 0.78}%)`;
            ctx.beginPath();
            ctx.roundRect(x0, y0, w - 8, rh - 8, 10);
            ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.07)";
            ctx.fillRect(x0 + 6, y0 + 4, w - 20, 5);
            ctx.fillStyle = "rgba(0,0,0,0.18)";
            ctx.fillRect(x0 + 6, y0 + rh - 18, w - 20, 6);
          }
          x += w;
        }
      }
      // Grime and chips.
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = rnd() < 0.6 ? `rgba(0,0,0,${0.05 + rnd() * 0.1})` : `rgba(160,190,255,${0.03 + rnd() * 0.05})`;
        ctx.beginPath();
        ctx.ellipse(rnd() * W, rnd() * H, 3 + rnd() * 18, 2 + rnd() * 9, rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    { wrapS: true, wrapT: true },
  );

const floorStoneTexture = () =>
  canvasTexture(
    "thanos-castle-floor",
    512,
    512,
    (ctx, W, H) => {
      // One tile = 4 × 4 world units: big flagstones, some split.
      ctx.fillStyle = "#171A22";
      ctx.fillRect(0, 0, W, H);
      const rnd = mulberry(808);
      const cell = W / 2;
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          const split = rnd();
          const rects: [number, number, number, number][] =
            split < 0.35
              ? [
                  [0, 0, 1, 0.5],
                  [0, 0.5, 1, 0.5],
                ]
              : split < 0.6
                ? [
                    [0, 0, 0.5, 1],
                    [0.5, 0, 0.5, 1],
                  ]
                : [[0, 0, 1, 1]];
          for (const [rx, ry, rw, rhh] of rects) {
            const x0 = i * cell + rx * cell + 4;
            const y0 = j * cell + ry * cell + 4;
            ctx.fillStyle = `hsl(${216 + rnd() * 10}, ${10 + rnd() * 5}%, ${17 + rnd() * 7}%)`;
            ctx.beginPath();
            ctx.roundRect(x0, y0, rw * cell - 8, rhh * cell - 8, 12);
            ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.05)";
            ctx.beginPath();
            ctx.roundRect(x0 + 8, y0 + 8, rw * cell - 24, rhh * cell - 24, 10);
            ctx.fill();
          }
        }
      }
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        let x = rnd() * W;
        let y = rnd() * H;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 4; s++) {
          x += (rnd() - 0.5) * 40;
          y += (rnd() - 0.5) * 40;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
    { wrapS: true, wrapT: true },
  );

const carpetTexture = () =>
  canvasTexture("thanos-castle-carpet", 128, 512, (ctx, W, H) => {
    ctx.fillStyle = "#123824";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1C4E33";
    ctx.fillRect(14, 0, W - 28, H);
    ctx.fillStyle = "#C9A23A";
    ctx.fillRect(8, 0, 5, H);
    ctx.fillRect(W - 13, 0, 5, H);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    for (let y = 0; y < H; y += 16) ctx.fillRect(14, y, W - 28, 2);
  });

const bannerTexture = () =>
  canvasTexture("thanos-castle-banner", 256, 768, (ctx, W, H) => {
    // Plain dark green cloth with soft vertical folds and a gold border (no symbols).
    const g = ctx.createLinearGradient(0, 0, W, 0);
    for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, i % 2 ? "#1A4A2C" : "#236238");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const v = ctx.createLinearGradient(0, 0, 0, H);
    v.addColorStop(0, "rgba(0,0,0,0.25)");
    v.addColorStop(0.3, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.2)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#D6AE45";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(18, H - 120);
    ctx.lineTo(W / 2, H - 40);
    ctx.lineTo(W - 18, H - 120);
    ctx.lineTo(W - 18, 0);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(34, 30);
    ctx.lineTo(34, H - 140);
    ctx.lineTo(W / 2, H - 70);
    ctx.lineTo(W - 34, H - 140);
    ctx.lineTo(W - 34, 30);
    ctx.stroke();
  });

/** Stained glass at night: deep blue panes in a diamond lattice; the big one shows the moon. */
const glassTexture = (moon: boolean) =>
  canvasTexture(`thanos-castle-glass|${moon}`, 512, 1024, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#14244F");
    g.addColorStop(0.6, "#2A4C92");
    g.addColorStop(1, "#4A74C4");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const rnd = mulberry(moon ? 31 : 32);
    // Pane tints.
    const s = 64;
    for (let y = -s; y < H + s; y += s) {
      for (let x = -s; x < W + s; x += s) {
        ctx.fillStyle = rnd() < 0.5 ? `rgba(120,170,255,${rnd() * 0.18})` : `rgba(10,20,60,${rnd() * 0.2})`;
        ctx.beginPath();
        ctx.moveTo(x + s / 2, y);
        ctx.lineTo(x + s, y + s / 2);
        ctx.lineTo(x + s / 2, y + s);
        ctx.lineTo(x, y + s / 2);
        ctx.closePath();
        ctx.fill();
      }
    }
    if (moon) {
      const mx = W * 0.62;
      const my = H * 0.3;
      const halo = ctx.createRadialGradient(mx, my, 0, mx, my, 260);
      halo.addColorStop(0, "rgba(220,235,255,0.9)");
      halo.addColorStop(0.25, "rgba(170,205,255,0.5)");
      halo.addColorStop(1, "rgba(120,160,255,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#EEF4FF";
      ctx.beginPath();
      ctx.arc(mx, my, 70, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(170,190,230,0.5)";
      for (const [dx, dy, r] of [
        [-20, -14, 14],
        [22, 18, 10],
        [-6, 30, 8],
      ]) {
        ctx.beginPath();
        ctx.arc(mx + dx, my + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Lead lattice.
    ctx.strokeStyle = "#0A0E1A";
    ctx.lineWidth = 6;
    for (let k = -H; k < W + H; k += s) {
      ctx.beginPath();
      ctx.moveTo(k, 0);
      ctx.lineTo(k + H, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(k + H, 0);
      ctx.lineTo(k, H);
      ctx.stroke();
    }
  });

const fogTexture = () =>
  canvasTexture(
    "thanos-castle-fog",
    512,
    512,
    (ctx, W, H) => {
      ctx.clearRect(0, 0, W, H);
      const rnd = mulberry(4242);
      for (let i = 0; i < 70; i++) {
        const x = rnd() * W;
        const y = rnd() * H;
        const r = 40 + rnd() * 110;
        for (const dx of [-W, 0, W]) {
          for (const dy of [-H, 0, H]) {
            const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
            g.addColorStop(0, `rgba(255,255,255,${0.12 + rnd() * 0.1})`);
            g.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

/** Pointed (gothic) arch outline: width w, springing at height hs, apex at height h. */
const archPath = <P extends THREE.Path>(path: P, cx: number, y0: number, w: number, hs: number, h: number, reverse = false): P => {
  const hw = w / 2;
  // Each side is a circular arc centred on the opposite springing line, passing the apex.
  const apexH = h - hs;
  const R = (hw * hw * 4 + apexH * apexH) / (4 * hw);
  const pts: THREE.Vector2[] = [];
  pts.push(new THREE.Vector2(cx - hw, y0));
  pts.push(new THREE.Vector2(cx + hw, y0));
  const N = 12;
  // Right side: centre (cx + hw - R, y0 + hs), from angle 0 up to the apex.
  const aR = Math.asin(Math.min(1, apexH / R));
  for (let i = 0; i <= N; i++) {
    const a = (aR * i) / N;
    pts.push(new THREE.Vector2(cx + hw - R + Math.cos(a) * R, y0 + hs + Math.sin(a) * R));
  }
  for (let i = N - 1; i >= 0; i--) {
    const a = (aR * i) / N;
    pts.push(new THREE.Vector2(cx - hw + R - Math.cos(a) * R, y0 + hs + Math.sin(a) * R));
  }
  const ordered = reverse ? pts.reverse() : pts;
  path.moveTo(ordered[0].x, ordered[0].y);
  for (let i = 1; i < ordered.length; i++) path.lineTo(ordered[i].x, ordered[i].y);
  path.closePath();
  return path;
};

type Win = { cx: number; y0: number; w: number; hs: number; h: number };

/** Wall slab (x along the wall, y up, thickness towards −z) with pointed-arch window holes. */
const wallGeometry = (len: number, height: number, thick: number, wins: Win[]) => {
  const s = new THREE.Shape();
  s.moveTo(-len / 2, 0);
  s.lineTo(len / 2, 0);
  s.lineTo(len / 2, height);
  s.lineTo(-len / 2, height);
  s.closePath();
  for (const w of wins) s.holes.push(archPath(new THREE.Path(), w.cx, w.y0, w.w, w.hs, w.h, true));
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -thick);
  return g;
};

const archShapeGeometry = (w: Win) => new THREE.ShapeGeometry(archPath(new THREE.Shape(), w.cx, w.y0, w.w, w.hs, w.h), 4);

const SIDE_WINS: Win[] = [-12, -5, 2].map((z) => ({ cx: z, y0: 3.2, w: 2.6, hs: 6.2, h: 8.6 }));
const BACK_WIN: Win = { cx: 0, y0: 2.6, w: 6.4, hs: 7.4, h: 11.8 };
const PILLAR_Z = [-15.5, -8.5, -1.5, 5.5];

/** Window tracery: a central mullion, a transom and a ring at the top (stone colour). */
const tracery = (w: Win) => {
  const geos: THREE.BufferGeometry[] = [];
  const c = STONE_TINTS.trim;
  geos.push(place(rbox(0.16, w.hs - 0.2, 0.22, 0.04), c, [w.cx, w.y0 + (w.hs - 0.2) / 2, 0]));
  if (w.w > 4) {
    for (const dx of [-w.w / 4, w.w / 4]) geos.push(place(rbox(0.12, w.hs - 0.2, 0.2, 0.04), c, [w.cx + dx, w.y0 + (w.hs - 0.2) / 2, 0]));
  }
  geos.push(place(rbox(w.w, 0.14, 0.2, 0.04), c, [w.cx, w.y0 + w.hs * 0.55, 0]));
  const rr = w.w * 0.22;
  geos.push(place(new THREE.TorusGeometry(rr, 0.07, 6, 28), c, [w.cx, w.y0 + w.hs + (w.h - w.hs) * 0.38, 0]));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    geos.push(place(rbox(0.07, rr * 2, 0.16, 0.02), c, [w.cx, w.y0 + w.hs + (w.h - w.hs) * 0.38, 0], [0, 0, a]));
  }
  return geos;
};

/** Moonbeam volume: the window outline swept along `dir` until it reaches the floor. */
const beamGeometry = (corners: THREE.Vector3[], dir: THREE.Vector3) => {
  const n = corners.length;
  const pos: number[] = [];
  const fade: number[] = [];
  const idx: number[] = [];
  const d = dir.clone().normalize();
  corners.forEach((c) => {
    const tHit = c.y / -d.y;
    const f = c.clone().add(d.clone().multiplyScalar(tHit));
    pos.push(c.x, c.y, c.z, f.x, f.y + 0.02, f.z);
    fade.push(0, 1);
  });
  for (let i = 0; i < n; i++) {
    const a = i * 2;
    const b = ((i + 1) % n) * 2;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aFade", new THREE.Float32BufferAttribute(fade, 1));
  g.setIndex(idx);
  return g;
};

const BEAM_VERT = /* glsl */ `
attribute float aFade;
varying float vFade;
void main() {
  vFade = aFade;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;
void main() {
  float a = pow(1.0 - vFade, 1.4) * 0.8 + 0.2 * (1.0 - vFade);
  gl_FragColor = vec4(uColor * a * uOpacity, 1.0);
  #include <colorspace_fragment>
}`;

const beamMaterial = (color: string, opacity: number) =>
  additive(
    new THREE.ShaderMaterial({
      vertexShader: BEAM_VERT,
      fragmentShader: BEAM_FRAG,
      uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity } },
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    }),
  );

const GREEN_FIRE: FlamePalette = ["#13A84A", "#55F27E", "#E4FFD6"];

/** Iron wall torch with a green flame (and its point light), mounted facing +z. */
const Torch: React.FC<{ t: number; seed: number; light: boolean }> = ({ t, seed, light }) => {
  const geos = useMemo(
    () => ({
      arm: new THREE.CylinderGeometry(0.05, 0.05, 0.7, 8).rotateX(Math.PI / 2),
      cup: new THREE.CylinderGeometry(0.22, 0.12, 0.3, 12),
      ring: new THREE.TorusGeometry(0.2, 0.035, 6, 16).rotateX(Math.PI / 2),
      plate: new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12).rotateX(Math.PI / 2),
    }),
    [],
  );
  const iron = toy("#2A2D35", { metal: 0.5, rough: 0.5, glow: 0.08 });
  const f = 0.85 + 0.1 * Math.sin(t * 11 + seed * 2.3) + 0.05 * Math.sin(t * 23 + seed);
  return (
    <group>
      <mesh geometry={geos.plate} material={iron} position={[0, 0, 0.03]} />
      <mesh geometry={geos.arm} material={iron} position={[0, 0, 0.35]} />
      <mesh geometry={geos.cup} material={iron} position={[0, 0.12, 0.7]} />
      <mesh geometry={geos.ring} material={iron} position={[0, 0.27, 0.7]} />
      <group position={[0, 0.25, 0.7]}>
        <Flame height={0.95} width={0.5} t={t} seed={seed} palette={GREEN_FIRE} halo={0} />
        <Glow color="#3DFF6E" size={2.6 * f} opacity={0.55} position={[0, 0.4, 0]} />
        <Glow color="#B8FFC8" size={0.7} opacity={0.6} position={[0, 0.3, 0.05]} />
      </group>
      {light ? <pointLight color="#3CFF6A" intensity={4 * f} distance={8} decay={1.8} position={[0, 0.8, 1.1]} /> : null}
    </group>
  );
};

/** A dark-green banner hanging from a gold rod (≈ 1.7 × 5.2), swaying a little. */
const Banner: React.FC<{ t: number; seed: number }> = ({ t, seed }) => {
  const geos = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.7, 5.2, 8, 16);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      // Swallowtail notch at the bottom and soft folds.
      const u = (x + 0.85) / 1.7;
      const notch = y < -2.0 ? (1 - Math.abs(u - 0.5) * 2) * 0.55 * ((-2.0 - y) / 0.6) : 0;
      p.setY(i, y + Math.max(0, notch));
      p.setZ(i, 0.07 * Math.sin(u * Math.PI * 5) * (0.6 + 0.4 * ((2.6 - y) / 5.2)));
    }
    g.computeVertexNormals();
    g.translate(0, -2.6, 0);
    return {
      cloth: g,
      rod: new THREE.CylinderGeometry(0.06, 0.06, 2.2, 10).rotateZ(Math.PI / 2),
      knob: new THREE.SphereGeometry(0.11, 12, 8),
    };
  }, []);
  const mat = useMemo(() => {
    const m = texMat(bannerTexture(), 0.85, 0.2);
    m.side = THREE.DoubleSide;
    return m;
  }, []);
  const sway = 0.03 * Math.sin(t * 0.9 + seed) + 0.015 * Math.sin(t * 2.1 + seed * 2);
  return (
    <group>
      <mesh geometry={geos.rod} material={toy("#D6AE45", { metal: 0.6, rough: 0.3, glow: 0.22 })} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geos.knob} material={toy("#D6AE45", { metal: 0.6, rough: 0.3, glow: 0.22 })} position={[s * 1.1, 0, 0]} />
      ))}
      <group rotation={[sway, 0, sway * 0.4]}>
        <mesh geometry={geos.cloth} material={mat} position={[0, -0.05, 0]} />
      </group>
    </group>
  );
};

/** Iron brazier on a stone stand with a big green fire (and its point light). */
const Brazier: React.FC<{ t: number; seed: number }> = ({ t, seed }) => {
  const geos = useMemo(
    () => ({
      stand: new THREE.CylinderGeometry(0.18, 0.28, 1.5, 10),
      foot: new THREE.CylinderGeometry(0.42, 0.48, 0.18, 12),
      bowl: new THREE.CylinderGeometry(0.62, 0.32, 0.42, 14, 1, true),
      rim: new THREE.TorusGeometry(0.62, 0.05, 6, 20).rotateX(Math.PI / 2),
      coals: new THREE.CylinderGeometry(0.56, 0.56, 0.06, 14),
    }),
    [],
  );
  const iron = toy("#2A2D35", { metal: 0.5, rough: 0.5, glow: 0.08, side: THREE.DoubleSide });
  const f = 0.85 + 0.1 * Math.sin(t * 9 + seed * 2.3) + 0.05 * Math.sin(t * 21 + seed);
  return (
    <group>
      <mesh geometry={geos.foot} material={toy(STONE_TINTS.trim, { rough: 0.8 })} position={[0, 0.09, 0]} />
      <mesh geometry={geos.stand} material={iron} position={[0, 0.9, 0]} />
      <mesh geometry={geos.bowl} material={iron} position={[0, 1.82, 0]} />
      <mesh geometry={geos.rim} material={iron} position={[0, 2.03, 0]} />
      <mesh geometry={geos.coals} material={toy("#1F7A3A", { glow: 0.9 })} position={[0, 1.95, 0]} />
      <group position={[0, 1.95, 0]}>
        <Flame height={1.7} width={1.05} t={t} seed={seed} palette={GREEN_FIRE} halo={0} />
        <Glow color="#3DFF6E" size={4 * f} opacity={0.6} position={[0, 0.7, 0]} />
      </group>
      <pointLight color="#3CFF6A" intensity={3.5 * f} distance={8} decay={1.8} position={[0, 2.9, 0.3]} />
    </group>
  );
};

/** The stone altar on its dais (top at ALTAR_TOP.y), carved panels and corner colonnettes. */
const altarGeometry = () => {
  const geos: THREE.BufferGeometry[] = [];
  const s = STONE_TINTS.altar;
  const d = shadeHex(s, -0.08);
  const l = shadeHex(s, 0.05);
  geos.push(place(new THREE.CylinderGeometry(3.6, 3.7, 0.2, 40), d, [0, 0.1, 0]));
  geos.push(place(new THREE.CylinderGeometry(2.8, 2.9, 0.2, 40), shadeHex(s, -0.04), [0, 0.3, 0]));
  const y0 = DAIS_H;
  geos.push(place(rbox(2.5, 0.2, 1.6, 0.06), d, [0, y0 + 0.1, 0]));
  geos.push(place(rbox(2.1, 0.7, 1.24, 0.06), s, [0, 0.95, 0]));
  geos.push(place(rbox(2.4, 0.08, 1.5, 0.03), d, [0, 1.34, 0]));
  geos.push(place(rbox(2.62, 0.17, 1.72, 0.05), l, [0, ALTAR_TOP[1] - 0.085, 0]));
  // Corner colonnettes.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      geos.push(place(new THREE.CylinderGeometry(0.11, 0.11, 0.7, 10), l, [sx * 1.08, 0.95, sz * 0.64]));
    }
  }
  // Recessed pointed-arch panels on the front and back.
  for (const sz of [-1, 1]) {
    for (const px of [-0.5, 0.5]) {
      const panel = archShapeGeometry({ cx: 0, y0: 0, w: 0.6, hs: 0.3, h: 0.52 });
      geos.push(place(panel, shadeHex(s, -0.16), [px, 0.68, sz * 0.632], [0, sz > 0 ? 0 : Math.PI, 0]));
    }
  }
  return mergeAll(geos);
};

/**
 * Dark gothic stone hall (night): flagstone floor with a dark-green runner, side walls with three
 * tall pointed windows each and a huge one at the back (stained glass, the moon in it) letting in
 * cold moonbeams, clustered pillars with green-flame torches (real green point lights), plain
 * dark-green banners with gold trim, rib vaults overhead, closed doors at the front, and low
 * fog drifting over the floor. In the middle, on a round two-step dais, the stone altar (top at
 * ALTAR_TOP, flanked by two green braziers) where the dead gauntlet lies. Interior x −11..11,
 * z −18..10, 14 high (CASTLE). `t` = seconds (flames, light flicker, fog drift, banner sway).
 * `fog` 0..1 scales the floor fog; `lights` false drops the point lights (cheaper; the flames
 * still glow); `roof` false hides the vault (for overhead shots).
 */
export const DoomCastle: React.FC<{ t?: number; fog?: number; lights?: boolean; roof?: boolean }> = ({ t = 0, fog = 1, lights = true, roof = true }) => {
  const geos = useMemo(() => {
    const sideLen = CASTLE.zFront - CASTLE.zBack;
    const backWall = wallGeometry(CASTLE.x * 2 + 2, CASTLE.h, 1.2, [BACK_WIN]);
    // Wall-local x runs along +z on the right wall and along −z on the left one.
    const mid = (CASTLE.zFront + CASTLE.zBack) / 2;
    const sideWallR = wallGeometry(sideLen, CASTLE.h, 1.2, SIDE_WINS.map((w) => ({ ...w, cx: w.cx - mid })));
    const sideWallL = wallGeometry(sideLen, CASTLE.h, 1.2, SIDE_WINS.map((w) => ({ ...w, cx: mid - w.cx })));
    const frontWall = (() => {
      const s = new THREE.Shape();
      const L = CASTLE.x * 2 + 2;
      s.moveTo(-L / 2, 0);
      s.lineTo(L / 2, 0);
      s.lineTo(L / 2, CASTLE.h);
      s.lineTo(-L / 2, CASTLE.h);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 1.2, bevelEnabled: false });
      return g;
    })();
    // Pillars with bases and capitals, merged (vertex colours).
    const pil: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) {
      for (const z of PILLAR_Z) {
        const x = sx * (CASTLE.x - 0.55);
        pil.push(place(rbox(1.5, 0.6, 1.5, 0.08), STONE_TINTS.trim, [x, 0.3, z]));
        for (const [dx, dz] of [
          [0, 0],
          [-0.42, 0.42],
          [0.42, 0.42],
          [-0.42, -0.42],
          [0.42, -0.42],
        ]) {
          const r = dx === 0 ? 0.5 : 0.2;
          pil.push(place(new THREE.CylinderGeometry(r, r, 10.4, 12), dx === 0 ? STONE_TINTS.wall : STONE_TINTS.trim, [x + dx * 0.9, 5.8, z + dz * 0.9]));
        }
        pil.push(place(rbox(1.6, 0.5, 1.6, 0.08), STONE_TINTS.trim, [x, 11.2, z]));
      }
    }
    // Rib vaults: pointed arches across the hall at each pillar pair, and a ridge rib.
    const ribs: THREE.BufferGeometry[] = [];
    for (const z of PILLAR_Z) {
      const pts: THREE.Vector3[] = [];
      const hw = CASTLE.x - 0.6;
      const rise = 3.4;
      const R = (hw * hw * 4 + rise * rise) / (4 * hw);
      const a = Math.asin(Math.min(1, rise / R));
      for (let i = 0; i <= 12; i++) pts.push(new THREE.Vector3(-hw + R - Math.cos((a * i) / 12) * R, 11.4 + Math.sin((a * i) / 12) * R, z));
      for (let i = 11; i >= 0; i--) pts.push(new THREE.Vector3(hw - R + Math.cos((a * i) / 12) * R, 11.4 + Math.sin((a * i) / 12) * R, z));
      ribs.push(place(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.22, 6, false), STONE_TINTS.trim, [0, 0, 0]));
    }
    ribs.push(place(rbox(0.4, 0.4, CASTLE.zFront - CASTLE.zBack, 0.1), STONE_TINTS.trim, [0, 14.75, (CASTLE.zFront + CASTLE.zBack) / 2]));
    // Wall cornice along both sides and the back.
    const trim: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) {
      trim.push(place(rbox(0.5, 0.45, CASTLE.zFront - CASTLE.zBack, 0.08), STONE_TINTS.trim, [sx * (CASTLE.x - 0.05), 11.4, (CASTLE.zFront + CASTLE.zBack) / 2]));
      trim.push(place(rbox(0.45, 0.5, CASTLE.zFront - CASTLE.zBack, 0.08), STONE_TINTS.wallDark, [sx * (CASTLE.x - 0.05), 0.25, (CASTLE.zFront + CASTLE.zBack) / 2]));
    }
    trim.push(place(rbox(CASTLE.x * 2, 0.45, 0.5, 0.08), STONE_TINTS.trim, [0, 11.4, CASTLE.zBack + 0.1]));
    // Tracery for every window (in window-local space; placed below).
    const sideTracery = mergeAll(SIDE_WINS.flatMap((w) => tracery({ ...w, cx: 0 })));
    const backTracery = mergeAll(tracery(BACK_WIN));
    // Doors.
    const doors: THREE.BufferGeometry[] = [];
    const dw = 4.4;
    doors.push(place(rbox(dw + 0.8, 6.6, 0.5, 0.1), STONE_TINTS.trim, [0, 3.3, 0]));
    for (const s of [-1, 1]) {
      doors.push(place(rbox(dw / 2 - 0.08, 6, 0.3, 0.06), "#3A2A20", [(s * dw) / 4, 3, 0.25]));
      for (const y of [1.2, 3, 4.8]) doors.push(place(rbox(dw / 2 - 0.2, 0.18, 0.08, 0.03), "#1E2026", [(s * dw) / 4, y, 0.42]));
      doors.push(place(new THREE.TorusGeometry(0.22, 0.05, 6, 16), "#A88A3A", [s * 0.45, 3, 0.45]));
    }
    return {
      backWall,
      sideWallR,
      sideWallL,
      frontWall,
      pillars: mergeAll(pil),
      ribs: mergeAll(ribs),
      trim: mergeAll(trim),
      sideTracery,
      backTracery,
      doors: mergeAll(doors),
      altar: altarGeometry(),
      sideGlass: archShapeGeometry({ ...SIDE_WINS[0], cx: 0 }),
      backGlass: archShapeGeometry(BACK_WIN),
      floor: new THREE.PlaneGeometry(CASTLE.x * 2 + 2, CASTLE.zFront - CASTLE.zBack + 2).rotateX(-Math.PI / 2),
      ceiling: new THREE.PlaneGeometry(CASTLE.x * 2 + 2, CASTLE.zFront - CASTLE.zBack + 2).rotateX(Math.PI / 2),
      carpet: new THREE.PlaneGeometry(2.2, CASTLE.zFront - (ALTAR_AT[2] + 3.4)).rotateX(-Math.PI / 2),
      fog: new THREE.PlaneGeometry(CASTLE.x * 2 + 2, CASTLE.zFront - CASTLE.zBack + 2).rotateX(-Math.PI / 2),
    };
  }, []);
  const mats = useMemo(() => {
    const wallTex = wallStoneTexture().clone();
    wallTex.repeat.set(1 / 3, 1 / 3);
    wallTex.needsUpdate = true;
    const floorTex = floorStoneTexture().clone();
    floorTex.repeat.set((CASTLE.x * 2 + 2) / 4, (CASTLE.zFront - CASTLE.zBack + 2) / 4);
    floorTex.needsUpdate = true;
    const mk = (tex: THREE.Texture, glow: number, rough = 0.85) =>
      new THREE.MeshStandardMaterial({ map: tex, roughness: rough, emissive: new THREE.Color("#ffffff"), emissiveMap: tex, emissiveIntensity: glow });
    const glass = (moon: boolean) => {
      const tex = glassTexture(moon);
      return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide });
    };
    const fogMats = [0.22, 0.15, 0.1].map((o) => {
      const tex = fogTexture().clone();
      tex.repeat.set(2.2, 2.6);
      tex.needsUpdate = true;
      return new THREE.MeshBasicMaterial({ map: tex, color: "#AFC3DE", transparent: true, opacity: o, depthWrite: false, toneMapped: false, fog: false });
    });
    return {
      wall: mk(wallTex, 0.12),
      floor: mk(floorTex, 0.12, 0.6),
      ceiling: new THREE.MeshStandardMaterial({ color: "#1A1E28", roughness: 0.9, emissive: new THREE.Color("#1A1E28"), emissiveIntensity: 0.3 }),
      carpet: texMat(carpetTexture(), 0.9, 0.16),
      sideGlass: glass(false),
      backGlass: glass(true),
      beam: beamMaterial("#9CC2FF", 0.06),
      beamBack: beamMaterial("#A9CBFF", 0.07),
      pool: additive(new THREE.MeshBasicMaterial({ color: "#8FB6FF", transparent: true, opacity: 0.1, toneMapped: false, fog: false })),
      fog: fogMats,
    };
  }, []);
  const beams = useMemo(() => {
    const dirSide = new THREE.Vector3(1, -0.95, 0.35);
    const side = SIDE_WINS.map((w) => {
      const x = -CASTLE.x + 0.2;
      const corners = [
        new THREE.Vector3(x, w.y0 + 0.3, w.cx - w.w / 2 + 0.2),
        new THREE.Vector3(x, w.y0 + 0.3, w.cx + w.w / 2 - 0.2),
        new THREE.Vector3(x, w.y0 + w.hs, w.cx + w.w / 2 - 0.2),
        new THREE.Vector3(x, w.y0 + w.h - 0.6, w.cx),
        new THREE.Vector3(x, w.y0 + w.hs, w.cx - w.w / 2 + 0.2),
      ];
      return beamGeometry(corners, dirSide);
    });
    const z = CASTLE.zBack + 0.3;
    const bw = BACK_WIN;
    const back = beamGeometry(
      [
        new THREE.Vector3(bw.cx - bw.w / 2 + 0.4, bw.y0 + 1.4, z),
        new THREE.Vector3(bw.cx + bw.w / 2 - 0.4, bw.y0 + 1.4, z),
        new THREE.Vector3(bw.cx + bw.w / 2 - 0.4, bw.y0 + bw.hs, z),
        new THREE.Vector3(bw.cx, bw.y0 + bw.h - 1.2, z),
        new THREE.Vector3(bw.cx - bw.w / 2 + 0.4, bw.y0 + bw.hs, z),
      ],
      new THREE.Vector3(0.1, -0.62, 1),
    );
    return { side, back };
  }, []);
  const poolGeo = useMemo(() => new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), []);
  const midZ = (CASTLE.zFront + CASTLE.zBack) / 2;
  const fogK = clamp01(fog);
  mats.fog.forEach((m, i) => {
    const tex = m.map as THREE.Texture;
    tex.offset.set(t * (0.012 + i * 0.006), t * (0.004 - i * 0.003) + i * 0.37);
  });
  return (
    <group>
      {/* Floor, runner, ceiling. */}
      <mesh geometry={geos.floor} material={mats.floor} position={[0, 0, midZ]} receiveShadow />
      <mesh geometry={geos.carpet} material={mats.carpet} position={[0, 0.012, (CASTLE.zFront + ALTAR_AT[2] + 3.4) / 2]} />
      {roof ? (
        <>
          <mesh geometry={geos.ceiling} material={mats.ceiling} position={[0, 15, midZ]} />
          <mesh geometry={geos.ribs} material={vertexMat(0.85, false, 0.12)} />
        </>
      ) : null}
      {/* Walls. */}
      <mesh geometry={geos.backWall} material={mats.wall} position={[0, 0, CASTLE.zBack]} receiveShadow />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * CASTLE.x, 0, midZ]} rotation={[0, (-s * Math.PI) / 2, 0]}>
          <mesh geometry={s > 0 ? geos.sideWallR : geos.sideWallL} material={mats.wall} receiveShadow />
        </group>
      ))}
      <mesh geometry={geos.frontWall} material={mats.wall} position={[0, 0, CASTLE.zFront]} />
      <group position={[0, 0, CASTLE.zFront - 0.3]} rotation={[0, Math.PI, 0]}>
        <mesh geometry={geos.doors} material={vertexMat(0.7, false, 0.14)} />
      </group>
      <mesh geometry={geos.pillars} material={vertexMat(0.85, false, 0.13)} castShadow />
      <mesh geometry={geos.trim} material={vertexMat(0.85, false, 0.12)} />
      {/* Windows: glass, tracery. */}
      <group position={[0, 0, CASTLE.zBack - 0.6]}>
        <mesh geometry={geos.backGlass} material={mats.backGlass} />
        <mesh geometry={geos.backTracery} material={vertexMat(0.8, false, 0.16)} position={[0, 0, 0.05]} />
      </group>
      {[-1, 1].flatMap((s) =>
        SIDE_WINS.map((w) => (
          <group key={`${s}${w.cx}`} position={[s * (CASTLE.x + 0.6), 0, w.cx]} rotation={[0, (-s * Math.PI) / 2, 0]}>
            <mesh geometry={geos.sideGlass} material={mats.sideGlass} />
            <mesh geometry={geos.sideTracery} material={vertexMat(0.8, false, 0.16)} position={[0, 0, 0.05]} />
          </group>
        )),
      )}
      {/* Moonbeams (from the left windows and the big back window) and their pools of light. */}
      {beams.side.map((g, i) => (
        <mesh key={i} geometry={g} material={mats.beam} renderOrder={4} />
      ))}
      <mesh geometry={beams.back} material={mats.beamBack} renderOrder={4} />
      {SIDE_WINS.map((w, i) => (
        <mesh key={i} geometry={poolGeo} material={mats.pool} position={[-3.6, 0.02, w.cx + 2.5]} scale={[3.2, 1, 1.5]} renderOrder={3} />
      ))}
      {/* Banners on the pillars and either side of the big window. */}
      {[-1, 1].flatMap((s) =>
        PILLAR_Z.slice(1, 3).map((z, i) => (
          <group key={`${s}${z}`} position={[s * (CASTLE.x - 1.35), 10.6, z]} rotation={[0, (-s * Math.PI) / 2, 0]}>
            <Banner t={t} seed={i + (s > 0 ? 3 : 0)} />
          </group>
        )),
      )}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 5.6, 11, CASTLE.zBack + 0.25]}>
          <Banner t={t} seed={7 + s} />
        </group>
      ))}
      {/* Torches on the inner faces of the pillars. */}
      {[-1, 1].flatMap((s) =>
        PILLAR_Z.map((z, i) => (
          <group key={`${s}${z}`} position={[s * (CASTLE.x - 1.3), 3.4, z]} rotation={[0, (-s * Math.PI) / 2, 0]}>
            <Torch t={t} seed={i * 1.7 + (s > 0 ? 5 : 0)} light={lights && i < 3} />
          </group>
        )),
      )}
      {/* The altar and its braziers. */}
      <group position={ALTAR_AT}>
        <mesh geometry={geos.altar} material={vertexMat(0.8, false, 0.16)} castShadow receiveShadow />
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 2.55, DAIS_H, -0.4]}>
            <Brazier t={t} seed={s + 3} />
          </group>
        ))}
      </group>
      {/* Low fog drifting over the floor. */}
      {fogK > 0.01
        ? mats.fog.map((m, i) => (
            <mesh key={i} geometry={geos.fog} material={m} position={[0, 0.12 + i * 0.22, midZ]} renderOrder={8 + i} visible={m.opacity * fogK > 0.01} />
          ))
        : null}
      {/* Dust motes drifting in the moonlight. */}
      <group position={[-3, 0.5, -4]}>
        <Sparks mode="rise" count={70} seed={91} time={t} width={0.03} tail={0.02} minLen={0.03} life={9} speed={0.25} spread={0.6} box={[14, 9, 18]} head="#CFE0FF" tailColor="#7FA0E0" opacity={0.7} />
      </group>
    </group>
  );
};

/** Night lighting for the DoomCastle: cold moonlight from the back-left, dim blue fill (torches are in the set). */
export const CastleLights: React.FC<{ k?: number }> = ({ k = 1 }) => (
  <>
    <hemisphereLight args={["#8EA2D6", "#161A22", 0.75 * k]} />
    <directionalLight position={[-8, 12, -9]} intensity={1.5 * k} color="#A9C6FF" />
    <directionalLight position={[3, 5, 10]} intensity={0.45 * k} color="#7F96C8" />
  </>
);


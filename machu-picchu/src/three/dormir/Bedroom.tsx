import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { FONT } from "../../theme";
import { V3, canvasTexture, toy, useFontsReady } from "../inca/kit";
import { Glow, additive } from "../thanos/FX";
import { Vec3, projectToScreen } from "../CameraRig";

// Nubi's bedroom for "¿Y si dormir te pagara?" (agent "bedroom"): a cosy night room with a puffy
// Nubi-size bed against the back wall, a big window above the headboard on the night city (the
// building across the street: every window a sleeper with a green money counter), a coral
// nightstand with a mushroom lamp, the twin-bell alarm clock and Nubi's phone, a framed first sol
// that tilts when the neighbour drills, a sheep poster, curtains and a rug.
// Props: AlarmClock (rings, gets crushed, a spring pops off), PhoneProp / HeldProp, SleepMask and
// HugPillow (children of <Nubi>, model units), DrillDust, and the 2D Zzz overlay.
//
// World units are sized for <Nubi size={2}>; the floor is y = 0, +z points from the back wall
// towards the default camera. There is no front wall. `t` is seconds; everything deterministic.
// Cheap to render: no shadow maps (blob shadows), four lights (BedroomLights), shared materials,
// geometry built once.

// =======================================================================================
// Layout

/** The room: back wall at z = back (window in it), side walls at x0 / x1, floor y = 0. */
export const ROOM = { x0: -3.9, x1: 3.9, back: -2.6, height: 5.6 };
/** The bed: head against the back wall, mattress top at `top`. */
export const BED = { x0: -1.38, x1: 1.38, z0: -2.5, z1: 0.9, top: 0.74 };
/** Where Nubi (size 2) sits in bed: feet sunk in the mattress, back against the pillow. */
export const NUBI_BED: V3 = [0, 0.5, -1.25];
/** Top of Nubi's head in bed (upright, no hop). */
export const NUBI_HEAD_Y = NUBI_BED[1] + 1.98;
/** Nubi's eyes in bed (world, on the face). */
export const NUBI_EYES: V3 = [0, NUBI_BED[1] + 1.1, NUBI_BED[2] + 0.9];
/** The nightstand right of the bed (top surface at `top`). */
export const NIGHTSTAND = { x: 1.98, z: -1.3, w: 0.8, d: 0.74, top: 1.0 };
/** The alarm clock stands on the nightstand's near-left corner, within reach of Nubi's fin. */
export const CLOCK_AT: V3 = [1.85, NIGHTSTAND.top, -1.08];
/** The alarm clock is drawn at this scale (a big cartoon clock next to a size-2 Nubi). */
export const CLOCK_SCALE = 1.2;
export const CLOCK_YAW = -0.32;
/** The phone lies on the nightstand (front right). */
export const PHONE_AT: V3 = [2.12, NIGHTSTAND.top, -0.82];
/** The mushroom lamp (base) and its shade (where the warm light comes from). */
export const LAMP_AT: V3 = [2.08, NIGHTSTAND.top, -1.52];
export const LAMP_LIGHT: V3 = [2.08, NIGHTSTAND.top + 0.62, -1.42];
/** The window above the headboard (an opening in the back wall). */
export const WINDOW = { x0: -1.5, x1: 1.5, y0: 2.3, y1: 4.5 };
/** The framed first sol, left of the window: it tilts when the neighbour drills. */
export const PICTURE_AT: V3 = [-2.3, 1.95, ROOM.back + 0.03];
/** The building across the street (its facade plane). */
export const FACADE = { z: -20, x0: -8, x1: 8, y0: -5.2, y1: 6.0 };
const FACADE_COLS = [-5.1, -3.4, -1.7, 0, 1.7, 3.4, 5.1];
const FACADE_ROWS = [-2.6, -0.2, 2.2, 4.6];
const FW = { w: 1.3, h: 1.3 };
/**
 * Sleepers across the street: for each lit window, the world point just above the sleeper's head
 * (anchor for a MoneyCounter), its column/row and a seed (for its counter's value).
 */
export const FACADE_SLEEPERS: { at: Vec3; col: number; row: number; seed: number }[] = FACADE_ROWS.flatMap((y, row) =>
  FACADE_COLS.map((x, col) => ({ at: [x + 0.1 * FW.w, y + 0.22 * FW.h, FACADE.z + 0.05] as Vec3, col, row, seed: row * 7 + col })),
);

// =======================================================================================
// Helpers

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, x: number) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const once = <T,>(make: () => T) => {
  let v: T | undefined;
  return () => (v ??= make());
};
const rbox = (w: number, h: number, d: number, r: number, seg = 3) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const mixColor = (a: string, b: string, k: number) => new THREE.Color(a).lerp(new THREE.Color(b), clamp01(k));

const basicCache = new Map<string, THREE.MeshBasicMaterial>();
const basic = (color: string, o: { transparent?: boolean; side?: THREE.Side } = {}) => {
  const k = `${color}|${o.transparent ? 1 : 0}|${o.side ?? 0}`;
  let m = basicCache.get(k);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: o.transparent ?? false, side: o.side ?? THREE.FrontSide });
    basicCache.set(k, m);
  }
  return m;
};

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
const texMatCache = new Map<string, THREE.MeshStandardMaterial>();
/** Cached standard material on a canvas texture (an emissive share keeps the colours bright). */
const texMat = (
  key: string,
  w: number,
  h: number,
  draw: Draw,
  o: { glow?: number; rough?: number; repeat?: [number, number]; transparent?: boolean; side?: THREE.Side } = {},
) => {
  let m = texMatCache.get(key);
  if (!m) {
    const tex = canvasTexture(`dormir-${key}`, w, h, draw, { wrapS: !!o.repeat, wrapT: !!o.repeat });
    if (o.repeat) tex.repeat.set(o.repeat[0], o.repeat[1]);
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: o.rough ?? 0.85,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tex,
      emissiveIntensity: o.glow ?? 0.14,
      transparent: o.transparent ?? false,
      side: o.side ?? THREE.FrontSide,
    });
    texMatCache.set(key, m);
  }
  return m;
};
const texBasicCache = new Map<string, THREE.MeshBasicMaterial>();
const texBasic = (key: string, w: number, h: number, draw: Draw, transparent = false) => {
  let m = texBasicCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: canvasTexture(`dormir-${key}`, w, h, draw), toneMapped: false, transparent });
    texBasicCache.set(key, m);
  }
  return m;
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};
const star = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, inner = 0.45) => {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = k % 2 ? r * inner : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
};

/** XY plane from (x0, y0) to (x1, y1) at depth z, uvs in world units / period (seamless tiling). */
const planeXY = (x0: number, x1: number, y0: number, y1: number, period: number) => {
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / period, p.getY(i) / period);
  return g;
};

/** A puffy pillow (w along x, h thin along y, d along z), centred. */
export const pillowGeometry = (w: number, h: number, d: number) => {
  const g = new THREE.SphereGeometry(1, 36, 18);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const sx = Math.sign(x) * Math.pow(Math.abs(x), 0.42);
    const sz = Math.sign(z) * Math.pow(Math.abs(z), 0.42);
    const edge = Math.max(Math.abs(sx), Math.abs(sz));
    const yy = y * (1 - 0.5 * Math.pow(edge, 5)) * (1 - 0.3 * Math.pow(Math.abs(sx * sz), 2));
    p.setXYZ(i, (sx * w) / 2, (yy * h) / 2, (sz * d) / 2);
  }
  g.computeVertexNormals();
  return g;
};

// =======================================================================================
// Textures

const wallpaperDraw: Draw = (ctx, w, h) => {
  ctx.fillStyle = "#7479D2";
  ctx.fillRect(0, 0, w, h);
  // Soft vertical stripes and tiny stars.
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < 4; i++) ctx.fillRect(i * (w / 4), 0, w / 8, h);
  for (let i = 0; i < 6; i++) {
    const x = ((i * 0.37 + 0.11) % 1) * w;
    const y = ((i * 0.61 + 0.23) % 1) * h;
    ctx.fillStyle = i % 2 ? "rgba(255,226,140,0.55)" : "rgba(255,255,255,0.32)";
    star(ctx, x, y, i % 2 ? 9 : 6, 0.42);
    ctx.fill();
  }
};
const floorDraw: Draw = (ctx, w, h) => {
  const n = 4;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = ["#B27B55", "#A8714C", "#B9845D", "#AD7650"][i];
    ctx.fillRect(0, (i * h) / n, w, h / n);
    ctx.fillStyle = "rgba(60,30,20,0.35)";
    ctx.fillRect(0, (i * h) / n, w, 3);
    ctx.fillRect(((i * 0.43 + 0.2) % 1) * w, (i * h) / n, 3, h / n);
  }
};
const duvetDraw: Draw = (ctx, w, h) => {
  ctx.fillStyle = "#5BA8F2";
  ctx.fillRect(0, 0, w, h);
  // Clouds.
  const cloud = (cx: number, cy: number, s: number) => {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(cx - s * 0.9, cy + s * 0.2, s * 0.62, 0, Math.PI * 2);
    ctx.arc(cx, cy - s * 0.15, s * 0.85, 0, Math.PI * 2);
    ctx.arc(cx + s * 0.95, cy + s * 0.2, s * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - s * 0.9, cy + s * 0.1, s * 1.85, s * 0.72);
  };
  cloud(w * 0.27, h * 0.3, w * 0.075);
  cloud(w * 0.75, h * 0.76, w * 0.075);
  ctx.fillStyle = "#FFD84D";
  for (const [x, y, r] of [
    [0.72, 0.22, 0.04],
    [0.2, 0.74, 0.045],
    [0.5, 0.52, 0.03],
    [0.92, 0.5, 0.025],
    [0.06, 0.08, 0.025],
  ]) {
    star(ctx, x * w, y * h, r * w);
    ctx.fill();
  }
  // Stitched squares.
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.setLineDash([]);
};
const hugPillowDraw: Draw = (ctx, w, h) => {
  ctx.fillStyle = "#FF9EC4";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (let j = 0; j < 6; j++)
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.arc(((i + (j % 2) * 0.5) / 12) * w, ((j + 0.5) / 6) * h, 4, 0, Math.PI * 2);
      ctx.fill();
    }
};
const rugDraw: Draw = (ctx, w) => {
  const c = w / 2;
  const rings = ["#3FC1B0", "#F7F4EA", "#FF8FA8", "#F7F4EA", "#3FC1B0"];
  rings.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(c, c, c * (1 - i * 0.17), 0, Math.PI * 2);
    ctx.fill();
  });
};
const curtainDraw: Draw = (ctx, w, h) => {
  ctx.fillStyle = "#9A7BEA";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let i = 0; i < 4; i++) ctx.fillRect((i + 0.25) * (w / 4), 0, w / 10, h);
  ctx.fillStyle = "#FFD84D";
  for (let i = 0; i < 5; i++) {
    star(ctx, w * (0.2 + 0.6 * hash(i + 2)), h * (0.1 + 0.18 * i), 7);
    ctx.fill();
  }
};
const sheepDraw: Draw = (ctx, w, h) => {
  ctx.fillStyle = "#1F2A6B";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#FFF4C8";
  ctx.beginPath();
  ctx.arc(w * 0.78, h * 0.16, w * 0.09, 0, Math.PI * 2);
  ctx.fill();
  // Fence.
  ctx.fillStyle = "#C98B5E";
  ctx.fillRect(w * 0.1, h * 0.72, w * 0.8, h * 0.04);
  for (let i = 0; i < 5; i++) ctx.fillRect(w * (0.14 + i * 0.17), h * 0.64, w * 0.05, h * 0.22);
  // The jumping sheep.
  const sx = w * 0.5;
  const sy = h * 0.45;
  ctx.fillStyle = "#FFFFFF";
  for (const [dx, dy, r] of [
    [-0.12, 0, 0.11],
    [0, -0.04, 0.13],
    [0.12, 0, 0.11],
    [0, 0.06, 0.12],
  ]) {
    ctx.beginPath();
    ctx.arc(sx + dx * w, sy + dy * w, r * w, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#2B2B33";
  ctx.beginPath();
  ctx.ellipse(sx + 0.2 * w, sy - 0.05 * w, 0.075 * w, 0.06 * w, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(sx - 0.12 * w, sy + 0.1 * w, 0.03 * w, 0.1 * w);
  ctx.fillRect(sx + 0.08 * w, sy + 0.1 * w, 0.03 * w, 0.1 * w);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `900 ${Math.round(w * 0.16)}px ${FONT.heavy}`;
  ctx.textAlign = "center";
  ctx.fillText("1, 2, 3…", w * 0.5, h * 0.95);
};
const coinDraw: Draw = (ctx, w, h) => {
  ctx.fillStyle = "#FFF6E2";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#FFC21A";
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.42, w * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#E08A00";
  ctx.lineWidth = w * 0.035;
  ctx.stroke();
  ctx.fillStyle = "#B86A00";
  ctx.font = `900 ${Math.round(w * 0.26)}px ${FONT.heavy}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("S/1", w / 2, h * 0.43);
  ctx.fillStyle = "#3B3B55";
  ctx.font = `800 ${Math.round(w * 0.1)}px ${FONT.heavy}`;
  ctx.fillText("MI PRIMER SOL", w / 2, h * 0.86);
};

// ---- Outside: the building across the street (wall + lit windows with sleepers) and the skyline.
const PX = 80; // canvas pixels per world unit on the facade
const fx = (x: number) => (x - FACADE.x0) * PX;
const fy = (y: number) => (FACADE.y1 - y) * PX;
const SLEEPER_COLORS = ["#FF9EC4", "#7FC8FF", "#FFD45C", "#B79BFF", "#FF9F6E", "#6FE0C8", "#FF7A8A", "#9ED36A"];
const facadeWallDraw: Draw = (ctx, w, h) => {
  ctx.fillStyle = "#D98C6C";
  ctx.fillRect(0, 0, w, h);
  // Brick courses.
  ctx.fillStyle = "rgba(120,50,40,0.12)";
  for (let y = 0; y < h; y += 18) ctx.fillRect(0, y, w, 3);
  // Floor bands and the cornice.
  for (const y of FACADE_ROWS) {
    ctx.fillStyle = "#C27458";
    ctx.fillRect(0, fy(y - 0.8), w, 0.16 * PX);
  }
  ctx.fillStyle = "#8E4E44";
  ctx.fillRect(0, 0, w, 0.3 * PX);
  // Window recesses (the lit glass is drawn by the windows layer).
  for (const y of FACADE_ROWS)
    for (const x of FACADE_COLS) {
      ctx.fillStyle = "#F4E9DA";
      ctx.fillRect(fx(x) - (FW.w / 2 + 0.08) * PX, fy(y) - (FW.h / 2 + 0.08) * PX, (FW.w + 0.16) * PX, (FW.h + 0.16) * PX);
      ctx.fillStyle = "#2A2F55";
      ctx.fillRect(fx(x) - (FW.w / 2) * PX, fy(y) - (FW.h / 2) * PX, FW.w * PX, FW.h * PX);
      // Sill.
      ctx.fillStyle = "#F4E9DA";
      ctx.fillRect(fx(x) - (FW.w / 2 + 0.14) * PX, fy(y) + (FW.h / 2) * PX, (FW.w + 0.28) * PX, 0.1 * PX);
    }
};
const facadeWindowsDraw: Draw = (ctx) => {
  FACADE_ROWS.forEach((y, row) =>
    FACADE_COLS.forEach((x, col) => {
      const seed = row * 7 + col;
      const x0 = fx(x) - (FW.w / 2) * PX;
      const y0 = fy(y) - (FW.h / 2) * PX;
      const W = FW.w * PX;
      const H = FW.h * PX;
      const g = ctx.createLinearGradient(0, y0, 0, y0 + H);
      g.addColorStop(0, hash(seed) > 0.5 ? "#FFE7A6" : "#FFD9B0");
      g.addColorStop(1, "#FFB870");
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, W, H);
      // The bed: headboard on the left, the sleeper's head on the pillow, the duvet.
      const by = y0 + H * 0.78;
      const body = SLEEPER_COLORS[Math.floor(hash(seed + 5) * SLEEPER_COLORS.length)];
      ctx.fillStyle = "#8C5A3C";
      roundRect(ctx, x0 + W * 0.08, by - H * 0.3, W * 0.08, H * 0.42, 4);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      roundRect(ctx, x0 + W * 0.14, by - H * 0.13, W * 0.24, H * 0.12, 6);
      ctx.fill();
      // Sleeper: a little cube with closed eyes, tilted on the pillow.
      ctx.save();
      ctx.translate(x0 + W * 0.33, by - H * 0.2);
      ctx.rotate(-0.25 + 0.2 * hash(seed + 9));
      ctx.fillStyle = body;
      roundRect(ctx, -H * 0.16, -H * 0.16, H * 0.32, H * 0.3, 7);
      ctx.fill();
      ctx.strokeStyle = "#1A1A1A";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * H * 0.065, -H * 0.005, H * 0.035, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
      ctx.restore();
      // Duvet.
      ctx.fillStyle = SLEEPER_COLORS[Math.floor(hash(seed + 11) * SLEEPER_COLORS.length)];
      roundRect(ctx, x0 + W * 0.36, by - H * 0.17, W * 0.58, H * 0.24, 10);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillRect(x0 + W * 0.36, by - H * 0.17, W * 0.08, H * 0.24);
      // Curtains.
      ctx.fillStyle = hash(seed + 3) > 0.5 ? "rgba(120,170,255,0.75)" : "rgba(255,130,170,0.7)";
      ctx.fillRect(x0, y0, W * 0.08, H);
      ctx.fillRect(x0 + W * 0.92, y0, W * 0.08, H);
      // A tiny green counter over the sleeper (no digits: the live ones are drawn in 2D).
      const cx = x0 + W * 0.6;
      const cy = y0 + H * 0.2;
      ctx.fillStyle = "rgba(10,14,20,0.8)";
      roundRect(ctx, cx - W * 0.2, cy - H * 0.075, W * 0.4, H * 0.15, H * 0.075);
      ctx.fill();
      ctx.fillStyle = "#46E58A";
      roundRect(ctx, cx - W * 0.15, cy - H * 0.03, W * 0.3, H * 0.06, H * 0.03);
      ctx.fill();
      // Mullion.
      ctx.fillStyle = "#F4E9DA";
      ctx.fillRect(x0 + W / 2 - 2, y0, 4, H * 0.06);
    }),
  );
};
const skylineDraw: Draw = (ctx, w, h) => {
  let x = 0;
  let k = 0;
  while (x < w) {
    const bw = 60 + 110 * hash(k + 40);
    const bh = h * (0.35 + 0.55 * hash(k + 50));
    ctx.fillStyle = k % 2 ? "#1C2560" : "#232C6E";
    ctx.fillRect(x, h - bh, bw, bh);
    for (let yy = h - bh + 14; yy < h - 8; yy += 26)
      for (let xx = x + 10; xx < x + bw - 12; xx += 20)
        if (hash(xx * 3.1 + yy * 7.7) > 0.62) {
          ctx.fillStyle = hash(xx + yy) > 0.4 ? "#FFD27A" : "#9FC8FF";
          ctx.fillRect(xx, yy, 9, 12);
        }
    x += bw + 6;
    k++;
  }
};

const geos = once(() => {
  const B = BED;
  const headShape = new THREE.Shape();
  const hw = 1.68;
  headShape.moveTo(-hw, 0);
  headShape.lineTo(hw, 0);
  headShape.lineTo(hw, 1.35);
  headShape.quadraticCurveTo(hw, 1.62, hw - 0.27, 1.62);
  // Scalloped (cloud) top.
  const bumps = 5;
  for (let i = 0; i < bumps; i++) {
    const xa = hw - 0.27 - ((2 * (hw - 0.27)) / bumps) * i;
    const xb = hw - 0.27 - ((2 * (hw - 0.27)) / bumps) * (i + 1);
    const lift = i === 2 ? 0.55 : i === 1 || i === 3 ? 0.42 : 0.3;
    headShape.quadraticCurveTo((xa + xb) / 2, 1.62 + lift * 1.15, xb, 1.62);
  }
  headShape.quadraticCurveTo(-hw, 1.62, -hw, 1.35);
  headShape.lineTo(-hw, 0);
  const head = new THREE.ExtrudeGeometry(headShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 10 });

  const starShape = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + Math.PI / 2;
    const r = k % 2 ? 0.45 : 1;
    if (k === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const moonShape = new THREE.Shape();
  moonShape.absarc(0, 0, 1, 0.5 * Math.PI, 1.5 * Math.PI + 0.0001, false);
  moonShape.absarc(-0.38, 0, 0.78, 1.5 * Math.PI, 0.5 * Math.PI, true);

  // Curtains: wavy panels (x across, y down), hung from the rod.
  const curtain = new THREE.PlaneGeometry(0.42, 2.9, 10, 2);
  const cp = curtain.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < cp.count; i++) cp.setZ(i, 0.05 * Math.sin((cp.getX(i) / 0.42) * Math.PI * 4));
  curtain.computeVertexNormals();

  return {
    // Floor and side walls stop at the back wall (nothing of the room shows outside the window).
    floor: planeXY(-6, 6, -6, -ROOM.back, 1.4).rotateX(-Math.PI / 2),
    wallL: planeXY(ROOM.x0, WINDOW.x0, 0, ROOM.height, 1.6),
    wallR: planeXY(WINDOW.x1, ROOM.x1, 0, ROOM.height, 1.6),
    wallBelow: planeXY(WINDOW.x0, WINDOW.x1, 0, WINDOW.y0, 1.6),
    wallAbove: planeXY(WINDOW.x0, WINDOW.x1, WINDOW.y1, ROOM.height, 1.6),
    sideL: planeXY(-6, -ROOM.back, 0, ROOM.height, 1.6),
    sideR: planeXY(ROOM.back, 6, 0, ROOM.height, 1.6),
    skirt: rbox(1, 0.14, 0.05, 0.02, 2),
    frame: rbox(1, 1, 1, 0.03, 2),
    bedBase: rbox(B.x1 - B.x0 + 0.16, 0.34, B.z1 - B.z0 + 0.06, 0.1),
    bedLeg: new THREE.CylinderGeometry(0.07, 0.06, 0.14, 12),
    mattress: rbox(B.x1 - B.x0, 0.3, B.z1 - B.z0 - 0.05, 0.12),
    head,
    star: new THREE.ShapeGeometry(starShape),
    moon: new THREE.ShapeGeometry(moonShape, 16),
    pillow: pillowGeometry(2.4, 0.55, 0.8),
    stand: rbox(NIGHTSTAND.w, NIGHTSTAND.top, NIGHTSTAND.d, 0.08),
    drawer: rbox(NIGHTSTAND.w - 0.14, 0.3, 0.02, 0.01, 2),
    knob: new THREE.SphereGeometry(0.045, 12, 8),
    lampBase: new THREE.CylinderGeometry(0.15, 0.17, 0.06, 20),
    lampStem: new THREE.CylinderGeometry(0.035, 0.035, 0.36, 10),
    lampShade: new THREE.SphereGeometry(0.27, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    lampRim: new THREE.CylinderGeometry(0.27, 0.27, 0.03, 24, 1, true),
    curtain,
    rod: new THREE.CylinderGeometry(0.035, 0.035, 4.0, 10).rotateZ(Math.PI / 2),
    rodEnd: new THREE.SphereGeometry(0.07, 12, 8),
    rug: new THREE.CircleGeometry(1.5, 40),
    poster: new THREE.PlaneGeometry(0.86, 1.15),
    picture: new THREE.PlaneGeometry(0.5, 0.56),
    facade: planeXY(FACADE.x0, FACADE.x1, FACADE.y0, FACADE.y1, 1),
    cornice: rbox(FACADE.x1 - FACADE.x0 + 0.3, 0.3, 0.5, 0.06, 2),
    tank: new THREE.CylinderGeometry(0.55, 0.55, 1.0, 16),
    skyline: new THREE.PlaneGeometry(60, 15),
    disc: new THREE.CircleGeometry(1, 40),
    sill: rbox(WINDOW.x1 - WINDOW.x0 + 0.4, 0.1, 0.36, 0.03, 2),
  };
});

// Fix the facade uvs (planeXY divides by `period` = 1 → world units): map them to 0..1.
const facadeGeo = once(() => {
  const g = geos().facade.clone();
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++)
    uv.setXY(i, (p.getX(i) - FACADE.x0) / (FACADE.x1 - FACADE.x0), (p.getY(i) - FACADE.y0) / (FACADE.y1 - FACADE.y0));
  return g;
});

// =======================================================================================
// Duvet: a draped grid over the mattress that rises over Nubi's lap and falls over the sides.

const duvetGeometry = once(() => {
  const NX = 36;
  const NZ = 26;
  const X0 = BED.x0 - 0.34;
  const X1 = BED.x1 + 0.34;
  const Z0 = NUBI_BED[2] - 0.15;
  const Z1 = BED.z1 + 0.32;
  const g = new THREE.PlaneGeometry(1, 1, NX, NZ);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const top = BED.top + 0.09;
  const mx0 = BED.x0 + 0.03;
  const mx1 = BED.x1 - 0.03;
  const mz1 = BED.z1 - 0.03;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5;
    const w = 0.5 - pos.getY(i);
    let x = X0 + (X1 - X0) * u;
    let z = Z0 + (Z1 - Z0) * w;
    uv.setXY(i, (x - X0) / 1.6, (z - Z0) / 1.6);
    let y = top + 0.014 * Math.sin(x * 6.1 + z * 2.3) + 0.012 * Math.sin(z * 8.7 - x * 3.1);
    // The lap: a soft mound in front of Nubi's body, highest against it.
    const dx = Math.max(0, Math.abs(x) - 0.85);
    const front = NUBI_BED[2] + 0.88;
    const dz = z < front ? 0 : z - front;
    const near = 1 - smooth(0, 0.55, Math.hypot(dx, dz * 0.9));
    y += 0.18 * near + 0.07 * (1 - smooth(0, 1.6, Math.hypot(dx * 0.7, dz * 0.6)));
    // Two little bumps of the stubby legs under the duvet.
    for (const lx of [-0.45, 0.45]) y += 0.07 * (1 - smooth(0, 0.32, Math.hypot(x - lx, z - (front + 0.55))));
    // Drape over the sides and the foot.
    const ex = x < mx0 ? mx0 - x : x > mx1 ? x - mx1 : 0;
    const ez = z > mz1 ? z - mz1 : 0;
    const e = Math.max(ex, ez);
    if (e > 0) {
      y -= Math.min(0.5, e * 1.9);
      if (ex > 0) x = x < mx0 ? mx0 - Math.min(ex, 0.07) - 0.02 * Math.min(1, ex * 4) : mx1 + Math.min(ex, 0.07) + 0.02 * Math.min(1, ex * 4);
      if (ez > 0) z = mz1 + Math.min(ez, 0.07);
    }
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
});

// =======================================================================================
// Sky (vertex colours by time of day), stars, moon, sun.

const SKY_NIGHT = ["#0A1240", "#26357E"];
const SKY_DAWN = ["#3B3E92", "#FF9C72"];
const SKY_DAY = ["#4FA6FF", "#CDEBFF"];
const skyColors = (dawn: number): [THREE.Color, THREE.Color] => {
  const k1 = clamp01(dawn / 0.5);
  const k2 = clamp01((dawn - 0.5) / 0.5);
  const top = mixColor(SKY_NIGHT[0], SKY_DAWN[0], k1).lerp(new THREE.Color(SKY_DAY[0]), k2);
  const bot = mixColor(SKY_NIGHT[1], SKY_DAWN[1], k1).lerp(new THREE.Color(SKY_DAY[1]), k2);
  return [top, bot];
};

const Sky: React.FC<{ dawn: number }> = ({ dawn }) => {
  const data = useMemo(() => {
    const g = new THREE.PlaneGeometry(130, 70, 1, 8);
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
    const starPos = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) {
      starPos[i * 3] = (hash(i + 1) - 0.5) * 70;
      starPos[i * 3 + 1] = 4 + hash(i + 2) * 26;
      starPos[i * 3 + 2] = 0.2;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    return {
      g,
      sg,
      mat: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, fog: false }),
      starMat: new THREE.PointsMaterial({ color: "#FFFFFF", size: 0.32, sizeAttenuation: true, transparent: true, toneMapped: false, fog: false }),
      last: Number.NaN,
    };
  }, []);
  if (data.last !== dawn) {
    data.last = dawn;
    const [top, bot] = skyColors(dawn);
    const p = data.g.attributes.position as THREE.BufferAttribute;
    const c = data.g.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const k = clamp01((p.getY(i) + 35) / 70);
      const col = bot.clone().lerp(top, Math.pow(k, 0.7));
      c.setXYZ(i, col.r, col.g, col.b);
    }
    c.needsUpdate = true;
  }
  data.starMat.opacity = 1 - smooth(0.1, 0.45, dawn);
  return (
    <group position={[0, 14, -44]}>
      <mesh geometry={data.g} material={data.mat} />
      {data.starMat.opacity > 0.01 ? <points geometry={data.sg} material={data.starMat} position={[0, -14, 0]} /> : null}
    </group>
  );
};

const Moon: React.FC<{ dawn: number }> = ({ dawn }) => {
  const g = geos();
  const set = smooth(0.05, 0.45, dawn);
  const pos: V3 = [mix(4.2, 9.5, set), mix(9.6, 0.5, set), -40];
  const k = 1 - smooth(0.35, 0.5, dawn);
  if (k <= 0) return null;
  return (
    <group position={pos}>
      <mesh geometry={g.disc} material={basic("#FFF4CF")} scale={1.7} />
      <mesh geometry={g.disc} material={basic("#F1E2B0")} scale={0.32} position={[0.5, 0.35, 0.01]} />
      <mesh geometry={g.disc} material={basic("#F1E2B0")} scale={0.22} position={[-0.45, -0.5, 0.01]} />
      <Glow color="#FFF0C0" size={9} opacity={0.55 * k} />
    </group>
  );
};

const Sun: React.FC<{ dawn: number }> = ({ dawn }) => {
  const g = geos();
  const rise = smooth(0.3, 1, dawn);
  if (rise <= 0) return null;
  const pos: V3 = [mix(-3.0, -4.5, rise), mix(-1, 11.5, rise), -40];
  const col = mixColor("#FF8A4C", "#FFE27A", rise);
  return (
    <group position={pos}>
      <mesh geometry={g.disc} material={basic(`#${col.getHexString()}`)} scale={2.1} />
      <Glow color="#FFB45E" size={16} opacity={0.75} />
    </group>
  );
};

/** The building across the street: wall (tinted by the time of day), lit windows, roof, skyline. */
const Outside: React.FC<{ dawn: number }> = ({ dawn }) => {
  const g = geos();
  const ready = useFontsReady();
  const wallMat = useMemo(() => {
    const tex = canvasTexture("dormir-facade-wall", (FACADE.x1 - FACADE.x0) * PX, (FACADE.y1 - FACADE.y0) * PX, facadeWallDraw);
    return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  }, []);
  wallMat.color.copy(mixColor("#40457E", "#FFB79A", smooth(0.15, 0.6, dawn)).lerp(new THREE.Color("#FFFFFF"), smooth(0.6, 1, dawn)));
  const skyMat = useMemo(() => {
    const tex = canvasTexture("dormir-skyline", 2048, 512, skylineDraw);
    return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true });
  }, []);
  skyMat.color.copy(mixColor("#FFFFFF", "#C9A6D8", smooth(0.3, 0.8, dawn)));
  const roof = toy("#6E3B3B", { glow: 0.2 });
  return (
    <group>
      <Sky dawn={dawn} />
      <Moon dawn={dawn} />
      <Sun dawn={dawn} />
      <mesh geometry={g.skyline} material={skyMat} position={[0, 4.5, -32]} />
      <mesh geometry={facadeGeo()} material={wallMat} position={[0, 0, FACADE.z]} />
      {ready ? (
        <mesh
          renderOrder={1}
          geometry={facadeGeo()}
          material={texBasic("facade-windows", (FACADE.x1 - FACADE.x0) * PX, (FACADE.y1 - FACADE.y0) * PX, facadeWindowsDraw, true)}
          position={[0, 0, FACADE.z + 0.02]}
        />
      ) : null}
      <mesh geometry={g.cornice} material={roof} position={[0, FACADE.y1, FACADE.z + 0.1]} />
      <group position={[4.6, FACADE.y1 + 0.75, FACADE.z - 1.2]}>
        <mesh geometry={g.tank} material={toy("#7C4A44", { glow: 0.2 })} />
        <mesh geometry={g.frame} material={toy("#5B3433", { glow: 0.2 })} position={[0, -0.6, 0]} scale={[1.2, 0.3, 1.2]} />
      </group>
      <mesh geometry={g.frame} material={toy("#7C4A44", { glow: 0.2 })} position={[-5.3, FACADE.y1 + 0.5, FACADE.z - 0.8]} scale={[0.12, 1.0, 0.12]} />
    </group>
  );
};

// =======================================================================================
// The room

export type BedroomProps = {
  t?: number;
  /** Time of day seen through the window: 0 night, 0.5 sunrise, 1 morning. */
  dawn?: number;
  /** The neighbour's drill: 0..1 rattles the wall decorations. */
  rattle?: number;
  /** Extra tilt of the framed first sol (radians, + = counter-clockwise). */
  frameTilt?: number;
  /** The bed's head pillow (hide it when Nubi carries it). */
  headPillow?: boolean;
};

export const Bedroom: React.FC<BedroomProps> = ({ t = 0, dawn = 0, rattle = 0, frameTilt = 0, headPillow = true }) => {
  const g = geos();
  const ready = useFontsReady();
  const wall = texMat("wallpaper", 256, 256, wallpaperDraw, { repeat: [1, 1], glow: 0.16, rough: 0.9 });
  const white = toy("#F6F2EA", { rough: 0.6, glow: 0.16 });
  const jig = (k: number) => rattle * Math.sin(t * 70 + k * 2.1);
  const W = WINDOW;
  const zb = ROOM.back;
  return (
    <group>
      {/* Floor, rug and walls (one-sided planes facing into the room). */}
      <mesh geometry={g.floor} material={texMat("floor", 256, 256, floorDraw, { repeat: [1, 1], glow: 0.1 })} />
      <mesh geometry={g.rug} material={texMat("rug", 256, 256, rugDraw, { glow: 0.16 })} rotation={[-Math.PI / 2, 0, 0]} position={[-0.2, 0.006, 2.1]} scale={[1.25, 0.9, 1]} />
      <group position={[0, 0, zb]}>
        <mesh geometry={g.wallL} material={wall} />
        <mesh geometry={g.wallR} material={wall} />
        <mesh geometry={g.wallBelow} material={wall} />
        <mesh geometry={g.wallAbove} material={wall} />
      </group>
      <mesh geometry={g.sideL} material={wall} position={[ROOM.x0, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={g.sideR} material={wall} position={[ROOM.x1, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
      <mesh geometry={g.skirt} material={white} position={[0, 0.07, zb + 0.03]} scale={[ROOM.x1 - ROOM.x0, 1, 1]} />

      {/* Window: frame, sill, curtains on a rod. */}
      <group>
        {[
          [(W.x0 + W.x1) / 2, W.y1 + 0.06, W.x1 - W.x0 + 0.24, 0.12],
          [(W.x0 + W.x1) / 2, W.y0 - 0.04, W.x1 - W.x0 + 0.24, 0.1],
        ].map(([x, y, w, h], i) => (
          <mesh key={`h${i}`} geometry={g.frame} material={white} position={[x, y, zb + 0.02]} scale={[w, h, 0.26]} />
        ))}
        {[W.x0 - 0.06, W.x1 + 0.06].map((x, i) => (
          <mesh key={`v${i}`} geometry={g.frame} material={white} position={[x, (W.y0 + W.y1) / 2, zb + 0.02]} scale={[0.12, W.y1 - W.y0 + 0.2, 0.26]} />
        ))}
        <mesh geometry={g.sill} material={white} position={[(W.x0 + W.x1) / 2, W.y0 - 0.1, zb + 0.14]} />
        <mesh geometry={g.rod} material={toy("#C98B5E", { glow: 0.15 })} position={[0, W.y1 + 0.32, zb + 0.22]} />
        {[-2.0, 2.0].map((x) => (
          <mesh key={x} geometry={g.rodEnd} material={toy("#FFD45C", { glow: 0.25 })} position={[x, W.y1 + 0.32, zb + 0.22]} />
        ))}
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            geometry={g.curtain}
            material={texMat("curtain", 128, 512, curtainDraw, { glow: 0.16, side: THREE.DoubleSide })}
            position={[s * (W.x1 + 0.2), W.y1 + 0.3 - 1.45, zb + 0.2]}
            rotation={[0, 0, s * 0.03]}
          />
        ))}
      </group>

      {/* Framed first sol (tilts with the drill) and the sheep poster. */}
      <group position={[PICTURE_AT[0], PICTURE_AT[1] + 0.32, PICTURE_AT[2]]} rotation={[0, 0, frameTilt + 0.05 * jig(1)]}>
        <group position={[0, -0.32, 0]}>
          <mesh geometry={g.frame} material={toy("#E0A040", { glow: 0.2 })} position={[0, 0, 0.01]} scale={[0.62, 0.68, 0.05]} />
          {ready ? <mesh geometry={g.picture} material={texMat("coin", 256, 288, coinDraw, { glow: 0.22 })} position={[0, 0, 0.04]} /> : null}
        </group>
      </group>
      <group position={[2.62, 3.25, zb + 0.02]} rotation={[0, 0, -0.04 + 0.02 * jig(2)]}>
        <mesh geometry={g.frame} material={white} position={[0, 0, 0]} scale={[0.96, 1.25, 0.03]} />
        {ready ? <mesh geometry={g.poster} material={texMat("sheep", 256, 342, sheepDraw, { glow: 0.24 })} position={[0, 0, 0.02]} /> : null}
      </group>

      {/* Bed: legs, base, mattress, scalloped headboard with a moon and stars, pillow, duvet. */}
      <group>
        {[
          [BED.x0 + 0.12, BED.z0 + 0.12],
          [BED.x1 - 0.12, BED.z0 + 0.12],
          [BED.x0 + 0.12, BED.z1 - 0.12],
          [BED.x1 - 0.12, BED.z1 - 0.12],
        ].map(([x, z]) => (
          <mesh key={`${x}-${z}`} geometry={g.bedLeg} material={white} position={[x, 0.07, z]} />
        ))}
        <mesh geometry={g.bedBase} material={toy("#F2A65A", { glow: 0.16 })} position={[0, 0.3, (BED.z0 + BED.z1) / 2]} />
        <mesh geometry={g.mattress} material={white} position={[0, BED.top - 0.15, (BED.z0 + BED.z1) / 2 + 0.02]} />
        <group position={[0, 0.15, zb + 0.06]}>
          <mesh geometry={g.head} material={toy("#FFC24D", { glow: 0.18, rough: 0.5 })} />
          <mesh geometry={g.moon} material={toy("#FFF6D6", { glow: 0.35 })} position={[-1.22, 1.3, 0.2]} scale={0.2} />
          {[
            [1.2, 1.38, 0.13],
            [1.0, 1.05, 0.08],
            [-0.95, 1.0, 0.07],
          ].map(([x, y, s], i) => (
            <mesh key={i} geometry={g.star} material={toy("#FFFFFF", { glow: 0.4 })} position={[x, y, 0.2]} scale={s} />
          ))}
        </group>
        {headPillow ? <mesh geometry={g.pillow} material={toy("#F7F5FF", { rough: 0.75, glow: 0.18 })} position={[0, BED.top + 0.36, zb + 0.42]} rotation={[-1.05, 0, 0]} /> : null}
        <mesh geometry={duvetGeometry()} material={texMat("duvet", 512, 512, duvetDraw, { repeat: [1, 1], glow: 0.16, side: THREE.DoubleSide })} />
      </group>

      {/* Nightstand with the mushroom lamp. */}
      <group position={[NIGHTSTAND.x, 0, NIGHTSTAND.z]}>
        <mesh geometry={g.stand} material={toy("#FF8A73", { glow: 0.16 })} position={[0, NIGHTSTAND.top / 2, 0]} />
        <mesh geometry={g.drawer} material={toy("#F2715A", { glow: 0.12 })} position={[0, NIGHTSTAND.top - 0.3, NIGHTSTAND.d / 2 + 0.005]} />
        <mesh geometry={g.knob} material={white} position={[0, NIGHTSTAND.top - 0.3, NIGHTSTAND.d / 2 + 0.03]} />
      </group>
      <group position={LAMP_AT}>
        <mesh geometry={g.lampBase} material={white} position={[0, 0.03, 0]} />
        <mesh geometry={g.lampStem} material={white} position={[0, 0.24, 0]} />
        <mesh geometry={g.lampShade} material={toy("#FFB84D", { glow: 0.75, rough: 0.5 })} position={[0, 0.4, 0]} scale={[1, 0.85, 1]} />
        <mesh geometry={g.lampRim} material={basic("#FFE9B0", { side: THREE.DoubleSide })} position={[0, 0.41, 0]} />
        <Glow color="#FFC46B" size={1.6} opacity={0.5} position={[0, 0.45, 0.1]} />
      </group>

      <Outside dawn={dawn} />
    </group>
  );
};

/**
 * Night lights: cool hemisphere fill, a soft warm key from the camera side, moonlight (sunlight
 * at dawn) from the window and the warm lamp. `dawn` 0..1 warms and brightens them.
 */
export const BedroomLights: React.FC<{ dawn?: number; lamp?: number; key?: number }> = ({ dawn = 0, lamp = 1, key = 1 }) => {
  const day = smooth(0.3, 1, dawn);
  const sky = mixColor("#B9C3FF", "#FFE9D2", day);
  const rim = mixColor("#9DB4FF", "#FFC27A", smooth(0.2, 0.7, dawn));
  return (
    <>
      <hemisphereLight args={[sky, mixColor("#7A5A70", "#8A6050", day), 1.3 + 0.3 * day]} />
      <directionalLight position={[-3, 5, 9]} intensity={1.9 * key} color="#FFF6EA" />
      <directionalLight position={[0.5, 6, -9]} intensity={0.9 + 0.8 * day} color={rim} />
      <pointLight position={LAMP_LIGHT} intensity={2.3 * lamp} distance={6} decay={1.3} color="#FFB45E" />
    </>
  );
};

// =======================================================================================
// The alarm clock: classic twin bells. Base on the origin, face towards +z.

const clockFaceDraw =
  (cracked: boolean): Draw =>
  (ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = "#FFFDF4";
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#26262E";
    ctx.font = `900 ${Math.round(w * 0.16)}px ${FONT.heavy}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const [n, a] of [
      ["12", 0],
      ["3", 0.25],
      ["6", 0.5],
      ["9", 0.75],
    ] as [string, number][]) {
      const ang = a * Math.PI * 2;
      ctx.fillText(n, c + Math.sin(ang) * c * 0.7, c - Math.cos(ang) * c * 0.7 + 2);
    }
    for (let i = 0; i < 12; i++) {
      if (i % 3 === 0) continue;
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(c + Math.sin(a) * c * 0.72, c - Math.cos(a) * c * 0.72, w * 0.018, 0, Math.PI * 2);
      ctx.fill();
    }
    // Hands at 7:00 (time to get up).
    ctx.strokeStyle = "#26262E";
    ctx.lineCap = "round";
    ctx.lineWidth = w * 0.045;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.sin((7 / 12) * Math.PI * 2) * c * 0.4, c - Math.cos((7 / 12) * Math.PI * 2) * c * 0.4);
    ctx.stroke();
    ctx.lineWidth = w * 0.03;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c, c - c * 0.62);
    ctx.stroke();
    if (cracked) {
      ctx.strokeStyle = "#1C1C22";
      ctx.lineWidth = w * 0.014;
      const cracks = [
        [0.5, 0.5, 0.12, 0.22, 0.05, 0.4],
        [0.5, 0.5, 0.86, 0.3, 0.97, 0.18],
        [0.5, 0.5, 0.7, 0.92, 0.62, 0.99],
        [0.5, 0.5, 0.22, 0.82, 0.1, 0.78],
      ];
      for (const [x0, y0, x1, y1, x2, y2] of cracks) {
        ctx.beginPath();
        ctx.moveTo(x0 * w, y0 * w);
        ctx.lineTo(x1 * w, y1 * w);
        ctx.lineTo(x2 * w, y2 * w);
        ctx.stroke();
      }
    }
  };

const clockGeos = once(() => {
  // The spring that pops out: a helix tube.
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2 * 6;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.07, (i / 120) * 0.34 - 0.17, Math.sin(a) * 0.07));
  }
  const ring = new THREE.TorusGeometry(0.2, 0.012, 6, 20, 1.3);
  ring.rotateZ(-0.65);
  const starShape = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + Math.PI / 2;
    const r = k % 2 ? 0.45 : 1;
    if (k === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return {
    body: new THREE.CylinderGeometry(0.25, 0.25, 0.16, 36).rotateX(Math.PI / 2),
    rim: new THREE.TorusGeometry(0.235, 0.022, 8, 36),
    face: new THREE.CircleGeometry(0.215, 36),
    bell: new THREE.SphereGeometry(0.12, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    bellPin: new THREE.CylinderGeometry(0.015, 0.015, 0.1, 8),
    hammer: new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6),
    hammerHead: new THREE.SphereGeometry(0.03, 10, 8),
    leg: new THREE.SphereGeometry(0.045, 10, 8),
    handle: new THREE.TorusGeometry(0.1, 0.016, 6, 16, Math.PI),
    knob: new THREE.CylinderGeometry(0.025, 0.025, 0.05, 10).rotateX(Math.PI / 2),
    spring: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.012, 5),
    ring,
    star: new THREE.ShapeGeometry(starShape),
    gear: new THREE.CylinderGeometry(0.05, 0.05, 0.015, 8),
  };
});

const ringMats = Array.from({ length: 4 }, () => additive(new THREE.MeshBasicMaterial({ color: "#FFE45C", toneMapped: false })));

/**
 * The alarm clock. `ring` 0..1 shakes it and blurs the bells (with sound waves); `crush` 0..1
 * flattens it (cracked face, bells splayed); `crushAge` (frames since the smash, ≥ 0) launches the
 * popped spring and a bell, and circles dizzy stars over the wreck. `color`: the body.
 */
export const AlarmClock: React.FC<{ t?: number; ring?: number; crush?: number; crushAge?: number; color?: string }> = ({
  t = 0,
  ring = 0,
  crush = 0,
  crushAge = -1,
  color = "#FF3B4E",
}) => {
  const g = clockGeos();
  const ready = useFontsReady();
  const bodyMat = toy(color, { rough: 0.32, glow: 0.2 });
  const goldMat = toy("#FFC21A", { metal: 0.5, rough: 0.3, glow: 0.25 });
  const steel = toy("#D9DEE8", { metal: 0.6, rough: 0.3, glow: 0.15 });
  const dark = toy("#2A2A33", { rough: 0.5 });
  const c = clamp01(crush);
  const jitter = ring * (1 - c);
  const rz = jitter * 0.14 * Math.sin(t * 95);
  const hop = jitter * 0.03 * Math.abs(Math.sin(t * 48));
  const sx = 1 + 0.25 * c;
  const sy = 1 - 0.72 * c;
  const faceKey = c > 0.4 ? "clock-face-cracked" : "clock-face";
  const faceMat = ready ? texMat(faceKey, 256, 256, clockFaceDraw(c > 0.4), { glow: 0.35, rough: 0.5 }) : basic("#FFFDF4");
  const bells = [-1, 1].map((s) => {
    const blur = jitter > 0.05;
    // When crushed, the left bell lies flat on its side next to the wreck; the right one flies off.
    const flatPos: V3 = [s * 0.34, 0.06, 0.08];
    const pos: V3 = [mix(s * 0.15, flatPos[0], c), mix(0.55, flatPos[1], c), mix(0, flatPos[2], c)];
    const rot: V3 = [0, 0, mix(-s * 0.55, -s * 1.9, c)];
    return { s, blur, pos, rot };
  });
  const age = crushAge;
  const flying = age >= 0;
  // The spring: up and to the right, then two bounces on the nightstand (boing).
  const springPos = (() => {
    if (!flying) return null;
    const u = age / 30;
    if (age < 16) {
      const k = age / 16;
      return { p: [0.12 + 0.55 * k, 0.25 + 1.3 * k - 1.2 * k * k, 0.12 + 0.1 * k] as V3, r: age * 0.55, sq: 1 };
    }
    const b = age - 16;
    const bounce = Math.abs(Math.sin(b * 0.32)) * 0.22 * Math.exp(-b * 0.09);
    return { p: [0.67 + 0.1 * Math.min(1, b / 20), 0.08 + bounce, 0.22] as V3, r: 8.8 + 0.06 * Math.min(b, 25), sq: 1 + 0.6 * Math.exp(-b * 0.12) * Math.sin(b * 0.9) * (u < 3 ? 1 : 0) };
  })();
  const stars = flying && age < 50 ? 1 - smooth(36, 50, age) : 0;
  return (
    <group position={[0, hop, 0]} rotation={[0, 0, rz]}>
      <group scale={[sx, sy, 1 + 0.2 * c]}>
        <mesh geometry={g.body} material={bodyMat} position={[0, 0.3, 0]} />
        <mesh geometry={g.rim} material={steel} position={[0, 0.3, 0.08]} />
        <mesh geometry={g.face} material={faceMat} position={[0, 0.3, 0.081]} />
        <mesh geometry={g.knob} material={goldMat} position={[0, 0.3, -0.1]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={g.leg} material={dark} position={[s * 0.15, 0.06, 0]} />
        ))}
        <mesh geometry={g.handle} material={steel} position={[0, 0.56, -0.02]} />
        {/* Hammer between the bells: a blur of swings while ringing. */}
        <group position={[0, 0.5, 0.02]} rotation={[0, 0, jitter * 0.6 * Math.sin(t * 120)]}>
          <mesh geometry={g.hammer} material={steel} position={[0, 0.08, 0]} />
          <mesh geometry={g.hammerHead} material={steel} position={[0, 0.16, 0]} />
        </group>
      </group>
      {bells.map(({ s, blur, pos, rot }) =>
        flying && s === -1 ? null : (
          <group key={s} position={pos} rotation={rot}>
            <mesh geometry={g.bell} material={goldMat} scale={[1, 1 - 0.3 * c, 1]} />
            <mesh geometry={g.bellPin} material={steel} position={[0, -0.04, 0]} />
            {blur
              ? [-1, 1].map((k) => (
                  <mesh key={k} geometry={g.bell} material={goldMat} position={[k * 0.035 * jitter, 0, 0]} scale={[1.04, 1, 1.04]} />
                ))
              : null}
          </group>
        ),
      )}
      {/* Sound waves around the bells while ringing. */}
      {jitter > 0.02
        ? [0, 1, 2, 3].map((i) => {
            const side = i % 2 ? 1 : -1;
            const ph = (t * 7 + i * 0.37) % 1;
            const m = ringMats[i];
            m.opacity = jitter * (1 - ph) * 0.95;
            return (
              <mesh key={i} geometry={g.ring} material={m} position={[side * 0.2, 0.58, 0.02]} scale={[side * (0.9 + ph * 1.5), 0.9 + ph * 1.5, 1]} />
            );
          })
        : null}
      {/* The popped spring, the flying bell and a gear. */}
      {springPos ? (
        <group position={springPos.p} rotation={[0.4, 0, springPos.r]} scale={[1, springPos.sq, 1]}>
          <mesh geometry={g.spring} material={steel} />
        </group>
      ) : null}
      {flying && age < 40 ? (
        <group position={[-0.1 - 0.035 * age, 0.4 + 0.12 * age - 0.0065 * age * age, 0.15 + 0.01 * age]} rotation={[age * 0.3, 0, age * 0.4]}>
          <mesh geometry={g.bell} material={goldMat} />
        </group>
      ) : null}
      {flying && age < 26 ? (
        <mesh geometry={g.gear} material={steel} position={[0.05 + 0.02 * age, 0.3 + 0.09 * age - 0.007 * age * age, 0.25 + 0.012 * age]} rotation={[age * 0.5, age * 0.2, 0]} />
      ) : null}
      {/* Dizzy stars over the wreck. */}
      {stars > 0
        ? [0, 1, 2].map((i) => {
            const a = age * 0.22 + (i / 3) * Math.PI * 2;
            return (
              <mesh
                key={i}
                geometry={g.star}
                material={toy("#FFE45C", { glow: 0.8 })}
                position={[Math.cos(a) * 0.26, 0.32 + 0.04 * Math.sin(a * 2), Math.sin(a) * 0.16 + 0.05]}
                scale={0.055 * stars}
              />
            );
          })
        : null}
    </group>
  );
};

// =======================================================================================
// The phone (world units, screen towards +z). Lying on the nightstand or held at a fin tip.

export type PhoneScreen = "off" | "lock" | "pay" | "paid" | "bank" | "alert";
const phoneDraw =
  (mode: PhoneScreen): Draw =>
  (ctx, w, h) => {
    const bg: Record<PhoneScreen, string> = { off: "#14161F", lock: "#3B4BC8", pay: "#1F9D63", paid: "#20B26E", bank: "#F4F6FB", alert: "#E8394C" };
    ctx.fillStyle = bg[mode];
    ctx.fillRect(0, 0, w, h);
    if (mode === "off") return;
    ctx.fillStyle = mode === "bank" ? "#1F2433" : "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (mode === "lock") {
      ctx.font = `900 ${Math.round(w * 0.3)}px ${FONT.heavy}`;
      ctx.fillText("3:12", w / 2, h * 0.28);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      roundRect(ctx, w * 0.12, h * 0.5, w * 0.76, h * 0.12, 10);
      ctx.fill();
    } else if (mode === "pay" || mode === "paid") {
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.36, w * 0.26, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = w * 0.07;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(w * 0.37, h * 0.36);
      ctx.lineTo(w * 0.47, h * 0.42);
      ctx.lineTo(w * 0.64, h * 0.29);
      ctx.stroke();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `900 ${Math.round(w * 0.2)}px ${FONT.heavy}`;
      ctx.fillText("S/50", w / 2, h * 0.66);
    } else if (mode === "bank") {
      ctx.font = `900 ${Math.round(w * 0.17)}px ${FONT.heavy}`;
      ctx.fillStyle = "#20B26E";
      ctx.fillText("S/1000", w / 2, h * 0.2);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = "#FFE1E5";
        roundRect(ctx, w * 0.08, h * (0.36 + i * 0.19), w * 0.84, h * 0.15, 10);
        ctx.fill();
        ctx.fillStyle = "#E8394C";
        ctx.fillRect(w * 0.14, h * (0.42 + i * 0.19), w * 0.5, h * 0.03);
      }
    } else {
      ctx.font = `900 ${Math.round(w * 0.45)}px ${FONT.heavy}`;
      ctx.fillText("!", w / 2, h * 0.38);
      ctx.font = `900 ${Math.round(w * 0.2)}px ${FONT.heavy}`;
      ctx.fillText("-S/", w / 2, h * 0.7);
    }
  };

const phoneGeos = once(() => ({
  body: rbox(0.34, 0.62, 0.05, 0.06),
  screen: new THREE.PlaneGeometry(0.29, 0.54),
  cam: rbox(0.09, 0.09, 0.02, 0.02, 2),
}));

/** Nubi's phone: mint case, screen towards +z (`screen` picks what it shows, `glow` a halo). */
export const PhoneProp: React.FC<{ screen?: PhoneScreen; glow?: number; glowColor?: string }> = ({ screen = "off", glow = 0, glowColor = "#CFE4FF" }) => {
  const g = phoneGeos();
  const ready = useFontsReady();
  const mat = ready || screen === "off" ? texBasic(`phone-${screen}`, 128, 240, phoneDraw(screen)) : basic("#14161F");
  return (
    <group>
      <mesh geometry={g.body} material={toy("#2E3550", { rough: 0.4, glow: 0.12 })} />
      <mesh geometry={g.screen} material={mat} position={[0, 0, 0.0255]} />
      <mesh geometry={g.cam} material={toy("#14161F")} position={[-0.09, 0.22, -0.03]} />
      {glow > 0 ? <Glow color={glowColor} size={1.1} opacity={0.4 * glow} position={[0, 0, 0.12]} /> : null}
    </group>
  );
};

/**
 * An object (world units, centred) at a <Nubi size={2}>'s fin tip (pass as holdR / holdL), kept
 * upright whatever the fin raise; `turn` turns it (radians from Nubi's front).
 */
export const HeldProp: React.FC<{ raise: number; side?: "R" | "L"; scale?: number; lift?: number; turn?: number; tilt?: number; children: React.ReactNode }> = ({
  raise,
  side = "R",
  scale = 1,
  lift = 0.2,
  turn = 0,
  tilt = 0,
  children,
}) => {
  const s = side === "R" ? 1 : -1;
  return (
    <group rotation={[0, 0, -s * raise * 0.55]}>
      <group rotation={[0, s * 0.12, 0]}>
        <group scale={5 * scale} position={[0, lift * 5 * scale, 0.5]} rotation={[tilt, turn, 0]}>
          {children}
        </group>
      </group>
    </group>
  );
};

// =======================================================================================
// Children of <Nubi> (model units: the body is 10 wide, front face at z = 4.4, eyes at y = 5.5).

const maskDraw: Draw = (ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#B99BFF";
  roundRect(ctx, 4, 4, w - 8, h - 8, h * 0.42);
  ctx.fill();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 6;
  ctx.setLineDash([12, 9]);
  roundRect(ctx, 16, 16, w - 32, h - 32, h * 0.34);
  ctx.stroke();
  ctx.setLineDash([]);
  // Printed closed eyes with lashes, and blush.
  ctx.strokeStyle = "#2B1E4A";
  ctx.lineWidth = h * 0.065;
  ctx.lineCap = "round";
  for (const s of [-1, 1]) {
    const cx = w / 2 + s * w * 0.23;
    const cy = h * 0.42;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.1, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();
    for (const k of [-0.6, 0, 0.6]) {
      const a = Math.PI / 2 + k;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * w * 0.1, cy + Math.sin(a) * w * 0.1);
      ctx.lineTo(cx + Math.cos(a) * w * 0.14, cy + Math.sin(a) * w * 0.14);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,120,170,0.6)";
    ctx.beginPath();
    ctx.ellipse(cx + s * w * 0.06, h * 0.8, w * 0.06, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }
};

const maskGeos = once(() => {
  const plate = new THREE.PlaneGeometry(9.4, 3.3, 12, 1);
  // A slight wrap round the face's rounded edges.
  const p = plate.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setZ(i, -Math.pow(Math.max(0, Math.abs(x) - 4.0) / 0.7, 2) * 0.45);
  }
  plate.computeVertexNormals();
  return { plate, strap: rbox(1, 1, 1, 0.1, 2) };
});

/**
 * The sleep mask, as a child of <Nubi>: `on` 0 = pushed up on the forehead, 1 = over the eyes
 * (pass hideEyes to Nubi then). `snap` adds the elastic overshoot when it snaps down.
 */
export const SleepMask: React.FC<{ on: number; snap?: number }> = ({ on, snap = 0 }) => {
  const g = maskGeos();
  const ready = useFontsReady();
  const y = mix(8.55, 5.55, on) - 0.35 * snap;
  const tilt = mix(-0.32, 0, on);
  const mat = useMemo(() => {
    const tex = canvasTexture("dormir-mask", 512, 180, maskDraw);
    return new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.75, emissive: new THREE.Color("#ffffff"), emissiveMap: tex, emissiveIntensity: 0.2, side: THREE.DoubleSide });
  }, []);
  const strap = toy("#7E5BD6", { glow: 0.16 });
  return (
    <group position={[0, y, 0]}>
      {ready ? <mesh geometry={g.plate} material={mat} position={[0, 0, 4.52 + 0.1 * (1 - on)]} rotation={[tilt, 0, 0]} scale={[1 + 0.04 * snap, 1 - 0.08 * snap, 1]} /> : null}
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={g.strap} material={strap} position={[s * 5.07, 0, 0]} scale={[0.22, 0.75, 8.6]} />
      ))}
      <mesh geometry={g.strap} material={strap} position={[0, 0, -4.47]} scale={[10.2, 0.75, 0.22]} />
    </group>
  );
};

const hugPillowGeo = once(() => pillowGeometry(11.6, 2.2, 3.6).rotateX(Math.PI / 2));
/**
 * Nubi's pink polka-dot pillow, as a child of <Nubi>: hugged against the front (`over` 0) or
 * pulled over the head (`over` 1, squashed down by the fins); in between it swings up past the
 * face. `squash` flattens it (the fins pressing); `shift` slides it sideways (model units, + = screen
 * right), e.g. away from a fin that leaves the hug to smash something.
 */
export const HugPillow: React.FC<{ over?: number; squash?: number; shift?: number }> = ({ over = 0, squash = 0, shift = 0 }) => {
  const mat = texMat("hug-pillow", 256, 128, hugPillowDraw, { glow: 0.2, rough: 0.8 });
  const k = clamp01(over);
  // Front (hug) → up past the face → on top of the head (a quadratic Bézier in y-z).
  const P0 = [2.75, 5.5];
  const C = [12.0, 9.0];
  const P2 = [10.9, 0.2];
  const b = (i: number) => (1 - k) * (1 - k) * P0[i] + 2 * (1 - k) * k * C[i] + k * k * P2[i];
  const y = b(0);
  const z = b(1);
  const rot = -k * Math.PI * 0.5;
  return (
    <group position={[shift, y, z]} rotation={[rot, 0, 0]} scale={[1 + 0.06 * squash, 1, 1 - 0.3 * squash]}>
      <mesh geometry={hugPillowGeo()} material={mat} />
    </group>
  );
};

// =======================================================================================
// Effects

const dustGeo = once(() => new THREE.IcosahedronGeometry(0.035, 0));
/** Plaster dust trickling down the back wall while the drill runs (`age` frames since it began). */
export const DrillDust: React.FC<{ age: number; on: number }> = ({ age, on }) => {
  if (age < 0 || on <= 0) return null;
  const mat = toy("#F2E8DA", { glow: 0.35, flat: true });
  const items: React.ReactNode[] = [];
  for (let i = 0; i < 26; i++) {
    const born = i * 3.3;
    const a = age - born;
    if (a < 0 || a > 34) continue;
    const x = -3.6 + 5.4 * hash(i + 1);
    const y = ROOM.height - 0.1 - 0.0045 * a * a - 0.02 * a;
    if (y < 0) continue;
    items.push(<mesh key={i} geometry={dustGeo()} material={mat} position={[x + 0.05 * Math.sin(a * 0.4 + i), y, ROOM.back + 0.15 + 0.3 * hash(i + 7)]} rotation={[a * 0.3, a * 0.2, 0]} scale={0.8 + hash(i + 3)} />);
  }
  return <group>{items}</group>;
};

// =======================================================================================
// 2D: floating "z" letters over a sleeper (rendered after the Stage, like the counters).

/**
 * Sleepy "z"s rising from a world point (Nubi's head) at camera `cam`. They spawn every `every`
 * frames while `on` > 0 (opacity), drift up-right and fade.
 */
export const Zzz: React.FC<{ g: number; cam: { position: Vec3; target: Vec3; fov?: number; roll?: number }; at: Vec3; on: number; every?: number; size?: number; side?: 1 | -1 }> = ({
  g,
  cam,
  at,
  on,
  every = 16,
  size = 1,
  side = -1,
}) => {
  if (on <= 0.01) return null;
  const p = projectToScreen(cam, at, 1080, 1920);
  if (p.behind) return null;
  const items: React.ReactNode[] = [];
  const life = every * 3;
  // `g` may be negative (frames before a loop seam): spawn slots are continuous across it.
  const first = Math.floor((g - life) / every) + 1;
  for (let n = first; n <= Math.floor(g / every); n++) {
    const a = (g - n * every) / life;
    if (a < 0 || a > 1) continue;
    const k = ((n % 3) + 3) % 3;
    const fs = (34 + 14 * k) * size * (0.7 + 0.5 * a);
    items.push(
      <div
        key={n}
        style={{
          position: "absolute",
          left: p.x + side * (40 + 110 * a + 18 * Math.sin(a * 6 + n)) * size,
          top: p.y - (10 + 230 * a) * size,
          transform: `translate(-50%, -50%) rotate(${side * -12 + 10 * Math.sin(n)}deg)`,
          fontFamily: FONT.heavy,
          fontWeight: 900,
          fontSize: fs,
          color: "#FFFFFF",
          opacity: on * Math.min(1, a * 5) * (1 - smooth(0.6, 1, a)),
          textShadow: "0 0 10px rgba(80,110,255,0.9), 0 4px 0 rgba(40,50,140,0.85)",
        }}
      >
        z
      </div>,
    );
  }
  return <>{items}</>;
};

// =======================================================================================
// Shot kit shared by the bedroom shots (the loop: the last frame of "final" = the first of "gancho").

/** Where the money counter over Nubi's bed is anchored (world, just above its head). */
export const COUNTER_AT: Vec3 = [0, NUBI_HEAD_Y + 0.16, NUBI_BED[2]];

/**
 * Nubi asleep in bed hugging its pillow: eyes shut, leaning back on the head pillow, slow
 * breathing. `d` = frames from the loop seam (hook: g − GANCHO.START; final: g − FINAL.END), so
 * the breath is continuous across the loop.
 */
export const sleepingPose = (d: number) => {
  const br = Math.sin((d / 30) * Math.PI * 2 * 0.42);
  return {
    blink: 1,
    squash: 1 + 0.022 * br,
    pitch: -0.13,
    roll: 0.09,
    yaw: -0.04,
    finL: -0.1 + 0.03 * br,
    finR: -0.1 + 0.03 * br,
    lookY: -0.1,
    hop: 0.05 + 0.05 * br,
  };
};

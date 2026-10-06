import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FONT } from "../../theme";
import { V3, canvasTexture, paintGeo, toy, useFontsReady, vertexMat } from "../inca/kit";
import { NubiPose } from "../Nubi";
import { Glow } from "../thanos/FX";

// "SIESTA S.A.C.": the office of "¿Y si dormir te pagara?", where every desk has been replaced by a
// bed (in Nubi's world sleeping pays S/100 an hour). Rows of beds with puffy duvets, nightstands with
// tiny lamps, blue cubicle dividers behind the headboards, a water cooler, motivational posters and
// the «EMPLEADO DEL MES» frame (a photo of someone asleep). The background colleagues are an
// instanced crowd of sleepers (some in nightcaps) breathing under their duvets; the shots add Nubi,
// its colleague (the lilac Worker of the AI short) and the boss as full characters.
//
// World units are sized for Nubi at size 2; floor y = 0; +z points towards the default camera. A bed
// is BED.w wide (x) and BED.l long (z): its headboard is at z − l/2, its foot at z + l/2, the mattress
// top at BED.mattress. Bed rows at z = 0, −5, −10; columns x = 0, −3.5, −7, −10.5 (left block) and
// 5.7, 9.2, 12.7 (right block), with a corridor between x = 1.35 and 4.35 where the boss stands.
// Nubi's bed is at the corridor end of the front row (NUBI_BED), the Worker's next to it (WORKER_BED).
// Light to render: geometry built once and merged (vertex colours), the crowd instanced, no shadow
// maps, three lights.

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
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
const rbox = (w: number, h: number, d: number, r: number, seg = 2) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));
/** Paints a geometry one colour and moves it into place (parts of merged vertex-coloured meshes). */
const place = (g: THREE.BufferGeometry, color: string, pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) => {
  paintGeo(g, color);
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale)));
  return g;
};
/** Merges geometries (made non-indexed), keeping only the listed attributes. */
const mergeAll = (geos: THREE.BufferGeometry[], keep: string[] = ["position", "normal", "color"]) => {
  const clean = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(ng.attributes)) if (!keep.includes(k)) ng.deleteAttribute(k);
    return ng;
  });
  const m = mergeGeometries(clean, false);
  if (!m) throw new Error("mergeGeometries failed");
  return m;
};
const basic = (() => {
  const cache = new Map<string, THREE.MeshBasicMaterial>();
  return (color: string) => {
    let m = cache.get(color);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      cache.set(color, m);
    }
    return m;
  };
})();

// =======================================================================================
// LAYOUT

export const BED = { w: 2.7, l: 3.5, mattress: 0.72, head: 1.5 };
export const ROOM = { x0: -13, x1: 14.2, zBack: -13.4, height: 6.6 };
const ROWS = [0, -5, -10];
const LEFT_COLS = [0, -3.5, -7, -10.5];
const RIGHT_COLS = [5.7, 9.2, 12.7];
export const CORRIDOR = { x0: 1.35, x1: 4.35 };
export const NUBI_BED: V3 = [0, 0, 0];
export const WORKER_BED: V3 = [-3.5, 0, 0];
/** Where the boss stands, in the corridor beside Nubi's pillow. */
export const BOSS_SPOT: V3 = [2.62, 0, -0.42];
export const NUBI_DUVET = "#FFD45C";
export const WORKER_DUVET = "#7FC0FF";
/** Nubi's bed sensor (on its headboard, corridor side): world position of the LED. */
export const SENSOR_LOCAL: V3 = [1.0, BED.head + 0.02, -BED.l / 2 + 0.12];
export const SENSOR_AT: V3 = [NUBI_BED[0] + SENSOR_LOCAL[0], SENSOR_LOCAL[1] + 0.15, NUBI_BED[2] + SENSOR_LOCAL[2] + 0.12];

const DUVETS = ["#8FC8FF", "#FF9EBB", "#9EE6B8", "#C9B2FF", "#FFB38A", "#7FE0D6", "#FFE07A", "#B8D96A"];
const BODIES = ["#FF8FB8", "#5EC2FF", "#FFB25B", "#7ED9C0", "#F4E06D", "#FF7F7F", "#9C8CFF", "#6FD3FF", "#F7A6E0", "#B5E86A"];
const CAPS = ["#3E5BD8", "#E8473C", "#2FAE7A", "#8E3BD1", "#F29A2E"];

export type BedSpot = {
  i: number;
  x: number;
  z: number;
  duvet: string;
  hero?: "nubi" | "worker";
  /** Background sleeper: body colour, size, seed, nightcap colour (or none). */
  body: string;
  size: number;
  seed: number;
  cap?: string;
};

export const OFFICE_BEDS: BedSpot[] = (() => {
  const out: BedSpot[] = [];
  ROWS.forEach((z, r) =>
    [...LEFT_COLS, ...RIGHT_COLS].forEach((x, c) => {
      const i = out.length;
      const seed = 40 + i * 3;
      const hero = z === NUBI_BED[2] && x === NUBI_BED[0] ? "nubi" : z === WORKER_BED[2] && x === WORKER_BED[0] ? "worker" : undefined;
      out.push({
        i,
        x,
        z,
        hero,
        duvet: hero === "nubi" ? NUBI_DUVET : hero === "worker" ? WORKER_DUVET : DUVETS[(c * 3 + r * 5) % DUVETS.length],
        body: BODIES[(c * 7 + r * 3) % BODIES.length],
        size: 1.85 + 0.3 * hash(seed),
        seed,
        cap: (c + r) % 2 === 0 ? CAPS[(c + 2 * r) % CAPS.length] : undefined,
      });
    }),
  );
  return out;
})();
/** The background colleagues (every bed but Nubi's and the Worker's). */
export const SLEEPERS = OFFICE_BEDS.filter((b) => !b.hero);

// =======================================================================================
// POSE HELPERS

const _m = new THREE.Matrix4();
const _n = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Model → world matrix of a <Nubi> body (everything under its squash group). */
const bodyMatrix = (out: THREE.Matrix4, position: V3, rotationY: number, size: number, pose: NubiPose) => {
  const s = size / 10;
  const sq = Math.max(0.3, pose.squash ?? 1);
  const sx = 1 / Math.sqrt(sq);
  out.compose(_v.set(...position), _q.setFromEuler(_e.set(0, rotationY, 0)), _s.set(s, s, s));
  out.multiply(_n.makeTranslation(0, pose.hop ?? 0, 0));
  out.multiply(_n.makeRotationFromEuler(_e.set(pose.pitch ?? 0, pose.yaw ?? 0, pose.roll ?? 0)));
  out.multiply(_n.makeScale(sx, sq, sx));
  return out;
};

/** World position of a point given in a <Nubi>'s model units (it follows the pose). */
export const bodyPoint = (position: V3, rotationY: number, size: number, pose: NubiPose, local: V3): V3 => {
  const m = bodyMatrix(_m, position, rotationY, size, pose);
  const v = new THREE.Vector3(...local).applyMatrix4(m);
  return [v.x, v.y, v.z];
};

/**
 * Where a character of body width `size` lies in the bed centred at `bed`: `up` 0 = lying back
 * against the pillow, sunk under the duvet up to the eyes (asleep); 1 = sitting up, the duvet in its
 * lap. Returns its <Nubi> position and the pitch to add to its pose.
 */
export const inBed = (bed: V3, up = 0, size = 2): { position: V3; pitch: number } => {
  const k = size / 2;
  return {
    position: [bed[0], lerp(0.17, 0.42, up) - (k - 1) * 0.55, bed[2] + lerp(0.08, -0.22, up) + (k - 1) * 0.3],
    pitch: lerp(-0.5, -0.1, up),
  };
};

/** Anchor of the money counter over a character in bed (world point above its head). */
export const bedHead = (position: V3, size: number, pose: NubiPose, above = 0.5): V3 => {
  const p = bodyPoint(position, 0, size, pose, [0, 9.9, -1.5]);
  return [p[0], p[1] + above, p[2]];
};

/** A background colleague's pose at frame g: asleep, breathing slowly. */
export const sleeperPose = (b: BedSpot, g: number): NubiPose => {
  const br = Math.sin((g / 30) * (1.6 + 0.5 * hash(b.seed + 1)) + hash(b.seed) * 6.28);
  return {
    pitch: inBed([b.x, 0, b.z], 0, b.size).pitch + 0.025 * br,
    squash: 1 + 0.022 * br,
    roll: (hash(b.seed + 2) - 0.5) * 0.16,
    yaw: (hash(b.seed + 3) - 0.5) * 0.3,
    blink: 1,
  };
};
export const sleeperAt = (b: BedSpot): V3 => inBed([b.x, 0, b.z], 0, b.size).position;
/** Anchor of a background colleague's money counter. */
export const sleeperHead = (b: BedSpot, g: number): V3 => bedHead(sleeperAt(b), b.size, sleeperPose(b, g), 0.55 + (b.cap ? 0.25 : 0));

/**
 * Money that climbs in steps: `base` soles at t0, then +`amount` every `every` frames (each step
 * counts up over `count` frames). Returns the value and the frames the steps land on (for the
 * counter's "+S/100" events).
 */
export const climb = (g: number, t0: number, base: number, every: number, amount = 100, count = 8) => {
  const d = g - t0;
  if (d < 0) return base;
  const n = Math.floor(d / every);
  const f = d - n * every;
  return base + amount * (n + smooth(0, count, f));
};
export const climbSteps = (t0: number, every: number, from: number, to: number, amount = 100) => {
  const out: { at: number; text: string; tone: "plus" }[] = [];
  for (let at = t0 + every; at <= to; at += every) if (at >= from) out.push({ at, text: `+S/${amount}`, tone: "plus" });
  return out;
};
/** A background colleague's money (climbing all the time). */
export const sleeperSoles = (b: BedSpot, g: number) => {
  const every = 70 + Math.floor(40 * hash(b.seed + 5));
  return climb(g, -Math.floor(every * hash(b.seed + 6)), 300 + 100 * Math.floor(9 * hash(b.seed + 7)), every);
};
export const sleeperEvery = (b: BedSpot) => 70 + Math.floor(40 * hash(b.seed + 5));

// =======================================================================================
// THE SET: merged static geometry

const C = {
  frame: "#F4F6FB",
  feet: "#AEB8CC",
  mattress: "#FFFFFF",
  head: "#5F7FD6",
  headPad: "#7C99E8",
  pillow: "#FFFFFF",
  cuff: "#FFFFFF",
  night: "#F7E9D5",
  nightTop: "#E6CFAF",
  nightLine: "#C9AE88",
  lampBase: "#3B4258",
  divider: "#A7BBE0",
  dividerTrim: "#F4F7FC",
  pot: "#F2F4F8",
  leaf: "#46B872",
  leaf2: "#5FD08A",
};

/** One bed in its local frame (merged parts, vertex colours). `duvet` adds the static duvet. */
const bedParts = (duvet?: string): THREE.BufferGeometry[] => {
  const { w, l, mattress, head } = BED;
  const parts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(place(rbox(0.16, 0.1, 0.16, 0.03), C.feet, [sx * (w / 2 - 0.15), 0.05, sz * (l / 2 - 0.15)]));
  parts.push(place(rbox(w, 0.34, l, 0.07), C.frame, [0, 0.25, 0]));
  parts.push(place(rbox(w - 0.12, 0.3, l - 0.16, 0.1), C.mattress, [0, mattress - 0.15, 0.02]));
  parts.push(place(rbox(w + 0.1, head, 0.18, 0.08), C.head, [0, head / 2, -l / 2 + 0.02]));
  parts.push(place(rbox(w - 0.34, head * 0.5, 0.06, 0.05), C.headPad, [0, head * 0.62, -l / 2 + 0.13]));
  parts.push(place(rbox(1.75, 0.3, 0.62, 0.14), C.pillow, [0, mattress + 0.26, -l / 2 + 0.42], [0.95, 0, 0]));
  if (duvet) {
    const z0 = DUVET.edge;
    const len = l / 2 + 0.06 - z0;
    parts.push(place(rbox(w + 0.12, 0.6, len, 0.16), duvet, [0, 0.72, z0 + len / 2]));
    parts.push(place(rbox(2.3, 0.5, 1.15, 0.24), duvet, [0, 1.0, z0 + 0.52]));
    parts.push(place(new THREE.CapsuleGeometry(0.15, 2.5, 4, 10), C.cuff, [0, 1.16, z0 + 0.03], [0, 0, Math.PI / 2]));
  }
  // Nightstand on the left of the bed, by the pillow, with the base of its tiny lamp.
  const nx = -(w / 2 + 0.42);
  const nz = -l / 2 + 0.42;
  parts.push(place(rbox(0.64, 0.64, 0.54, 0.06), C.night, [nx, 0.32, nz]));
  parts.push(place(rbox(0.7, 0.05, 0.6, 0.02), C.nightTop, [nx, 0.665, nz]));
  parts.push(place(rbox(0.5, 0.03, 0.02, 0.01), C.nightLine, [nx, 0.42, nz + 0.27]));
  parts.push(place(new THREE.SphereGeometry(0.035, 8, 6), C.nightLine, [nx, 0.52, nz + 0.28]));
  parts.push(place(new THREE.CylinderGeometry(0.08, 0.1, 0.05, 14), C.lampBase, [nx, 0.715, nz]));
  parts.push(place(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 8), C.lampBase, [nx, 0.84, nz]));
  return parts;
};
/** Puffy duvet of a bed: its top edge (white cuff) at z = edge, the lump of the body just below. */
export const DUVET = { edge: 0.42 };
const LAMP_LOCAL: V3 = [-(BED.w / 2 + 0.42), 0.99, -BED.l / 2 + 0.42];

const setGeos = once(() => {
  const parts: THREE.BufferGeometry[] = [];
  const shades: THREE.BufferGeometry[] = [];
  for (const b of OFFICE_BEDS) {
    const T = new THREE.Matrix4().makeTranslation(b.x, 0, b.z);
    for (const p of bedParts(b.hero ? undefined : b.duvet)) parts.push(p.applyMatrix4(T));
    const sh = new THREE.CylinderGeometry(0.085, 0.14, 0.17, 16);
    sh.translate(LAMP_LOCAL[0], LAMP_LOCAL[1], LAMP_LOCAL[2]);
    shades.push(sh.applyMatrix4(T));
  }
  // Cubicle dividers: a fabric panel behind each row of headboards, per block, with end posts.
  for (const z of ROWS) {
    for (const [x0, x1] of [
      [LEFT_COLS[LEFT_COLS.length - 1] - BED.w / 2 - 0.9, LEFT_COLS[0] + BED.w / 2 + 0.05],
      [RIGHT_COLS[0] - BED.w / 2 - 0.9, RIGHT_COLS[RIGHT_COLS.length - 1] + BED.w / 2 + 0.05],
    ]) {
      const cz = z - BED.l / 2 - 0.2;
      parts.push(place(rbox(x1 - x0, 1.78, 0.1, 0.04), C.divider, [(x0 + x1) / 2, 0.89, cz]));
      parts.push(place(rbox(x1 - x0 + 0.06, 0.08, 0.16, 0.03), C.dividerTrim, [(x0 + x1) / 2, 1.8, cz]));
      for (const x of [x0, x1]) parts.push(place(rbox(0.12, 1.86, 0.18, 0.04), C.dividerTrim, [x, 0.93, cz]));
    }
  }
  // Potted plants by the back wall and at the corridor ends.
  for (const [x, z, s] of [
    [-1.6, ROOM.zBack + 0.7, 1.1],
    [7.4, ROOM.zBack + 0.7, 1.0],
    [4.0, -4.6, 0.85],
  ] as [number, number, number][]) {
    parts.push(place(new THREE.CylinderGeometry(0.3 * s, 0.24 * s, 0.6 * s, 16), C.pot, [x, 0.3 * s, z]));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      parts.push(place(new THREE.SphereGeometry(0.34 * s, 10, 8), k % 2 ? C.leaf : C.leaf2, [x + Math.cos(a) * 0.2 * s, (0.95 + 0.25 * (k % 2)) * s, z + Math.sin(a) * 0.2 * s], [0, 0, 0], [0.8, 1.3, 0.8]));
    }
    parts.push(place(new THREE.SphereGeometry(0.3 * s, 10, 8), C.leaf2, [x, 1.45 * s, z], [0, 0, 0], [0.8, 1.2, 0.8]));
  }
  return { set: mergeAll(parts), shades: mergeAll(shades, ["position", "normal"]) };
});

// ---- Textures ------------------------------------------------------------------------------
const HEAVY = `'${FONT.heavy}', sans-serif`;
const TITLE = `'${FONT.title}', '${FONT.fun}', sans-serif`;
type Ctx = CanvasRenderingContext2D;
const label = (ctx: Ctx, s: string, x: number, y: number, size: number, color: string, o: { font?: string; weight?: number; stroke?: string; lw?: number; maxW?: number } = {}) => {
  ctx.save();
  const font = o.font ?? HEAVY;
  const weight = o.weight ?? 900;
  ctx.font = `${weight} ${size}px ${font}`;
  if (o.maxW) {
    const w = ctx.measureText(s).width;
    if (w > o.maxW) ctx.font = `${weight} ${(size * o.maxW) / w}px ${font}`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (o.stroke && o.lw) {
    ctx.lineJoin = "round";
    ctx.lineWidth = o.lw;
    ctx.strokeStyle = o.stroke;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.restore();
};
const moon = (ctx: Ctx, x: number, y: number, r: number, color: string, bg: string) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(x + r * 0.45, y - r * 0.3, r * 0.85, 0, Math.PI * 2);
  ctx.fill();
};
/** Bold "Z" drawn with strokes (no font needed). */
const drawZ = (ctx: Ctx, x: number, y: number, s: number, fill: string, edge: string) => {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.28, y - s * 0.28);
    ctx.lineTo(x + s * 0.28, y - s * 0.28);
    ctx.lineTo(x - s * 0.28, y + s * 0.28);
    ctx.lineTo(x + s * 0.28, y + s * 0.28);
  };
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  path();
  ctx.strokeStyle = edge;
  ctx.lineWidth = s * 0.22;
  ctx.stroke();
  path();
  ctx.strokeStyle = fill;
  ctx.lineWidth = s * 0.11;
  ctx.stroke();
};

const carpetTex = () =>
  canvasTexture(
    "dormir-carpet",
    256,
    256,
    (ctx, w) => {
      const half = w / 2;
      const tones = ["#D3D9E6", "#CBD2E1", "#CED5E3", "#D6DCE8"];
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = tones[i];
        ctx.fillRect((i % 2) * half, Math.floor(i / 2) * half, half, half);
      }
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = `rgba(90,100,130,${0.04 + 0.05 * hash(i)})`;
        ctx.fillRect(hash(i + 1) * w, hash(i + 2) * w, 2, 2);
      }
      ctx.fillStyle = "rgba(120,130,160,0.35)";
      ctx.fillRect(0, 0, w, 2);
      ctx.fillRect(0, half, w, 2);
      ctx.fillRect(0, 0, 2, w);
      ctx.fillRect(half, 0, 2, w);
    },
    { wrapS: true, wrapT: true },
  );

const skyTex = () =>
  canvasTexture("dormir-office-sky", 512, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#6FC3FF");
    g.addColorStop(1, "#D6F0FF");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    for (const [cx, cy, r] of [
      [120, 150, 46],
      [190, 140, 60],
      [260, 160, 42],
      [380, 300, 38],
      [430, 290, 50],
      [480, 310, 34],
    ])
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.arc(cx + (k - 1) * r * 0.7, cy + (k === 1 ? -r * 0.35 : 0), r * (k === 1 ? 1 : 0.75), 0, Math.PI * 2);
        ctx.fill();
      }
    // Far city blocks.
    for (let x = 0, k = 0; x < w; k++) {
      const bw = 40 + 50 * hash(k + 20);
      const bh = h * (0.12 + 0.2 * hash(k + 30));
      ctx.fillStyle = k % 2 ? "#A9C4E6" : "#B9D2EE";
      ctx.fillRect(x, h - bh, bw, bh);
      x += bw + 6;
    }
  });

const posterMoneyTex = () =>
  canvasTexture("dormir-poster-money", 512, 680, (ctx, w, h) => {
    ctx.fillStyle = "#1E2A66";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#FFD45C";
    ctx.lineWidth = 12;
    ctx.strokeRect(22, 22, w - 44, h - 44);
    moon(ctx, w / 2 - 60, 300, 92, "#FFE7A0", "#1E2A66");
    // A coin with "S/".
    ctx.fillStyle = "#FFC83D";
    ctx.beginPath();
    ctx.arc(w / 2 + 80, 330, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#E39A1A";
    ctx.lineWidth = 10;
    ctx.stroke();
    label(ctx, "S/", w / 2 + 80, 334, 70, "#9A5B00", { font: TITLE, weight: 400 });
    drawZ(ctx, 120, 160, 70, "#FFFFFF", "#3A4FB0");
    drawZ(ctx, 175, 110, 46, "#FFFFFF", "#3A4FB0");
    label(ctx, "DUERME MÁS", w / 2, 520, 78, "#FFFFFF", { font: TITLE, weight: 400, maxW: w * 0.84 });
    label(ctx, "GANA MÁS", w / 2, 606, 86, "#FFD45C", { font: TITLE, weight: 400, maxW: w * 0.84 });
  });

const posterDreamTex = () =>
  canvasTexture("dormir-poster-dream", 512, 680, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#FF7EB6");
    g.addColorStop(1, "#8E6BFF");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#FFFFFF";
    for (const [cx, cy, r] of [
      [180, 300, 70],
      [270, 270, 90],
      [360, 305, 66],
    ]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(150, 300, 240, 72);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = "#FFF4B0";
      ctx.beginPath();
      ctx.arc(60 + hash(i + 50) * (w - 120), 60 + hash(i + 60) * 150, 6 + 6 * hash(i + 70), 0, Math.PI * 2);
      ctx.fill();
    }
    label(ctx, "SUEÑA", w / 2, 500, 104, "#FFFFFF", { font: TITLE, weight: 400, stroke: "#5B2A9E", lw: 14 });
    label(ctx, "EN GRANDE", w / 2, 604, 82, "#FFE45C", { font: TITLE, weight: 400, stroke: "#5B2A9E", lw: 12, maxW: w * 0.86 });
  });

const employeeTex = () =>
  canvasTexture("dormir-employee", 512, 640, (ctx, w, h) => {
    ctx.fillStyle = "#FFF7E2";
    ctx.fillRect(0, 0, w, h);
    // Red ribbon with the title.
    ctx.fillStyle = "#E8473C";
    ctx.fillRect(0, 0, w, 150);
    label(ctx, "EMPLEADO", w / 2, 52, 66, "#FFFFFF", { font: TITLE, weight: 400, maxW: w * 0.88 });
    label(ctx, "DEL MES", w / 2, 112, 56, "#FFE45C", { font: TITLE, weight: 400, maxW: w * 0.88 });
    // The photo: someone fast asleep on a pillow.
    const px = 46;
    const py = 176;
    const pw = w - 92;
    const ph = 400;
    const sky = ctx.createLinearGradient(0, py, 0, py + ph);
    sky.addColorStop(0, "#8FC8FF");
    sky.addColorStop(1, "#CFE6FF");
    ctx.fillStyle = sky;
    ctx.fillRect(px, py, pw, ph);
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(px + 30, py + 250, pw - 60, 110, 50);
    ctx.fill();
    ctx.fillStyle = "#FFB25B";
    ctx.beginPath();
    ctx.roundRect(px + 95, py + 120, 230, 190, 34);
    ctx.fill();
    // Closed eyes and a drool-ish smile.
    ctx.strokeStyle = "#1A1A1A";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    for (const ex of [px + 165, px + 255]) {
      ctx.beginPath();
      ctx.arc(ex, py + 205, 24, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    // Nightcap.
    ctx.fillStyle = "#3E5BD8";
    ctx.beginPath();
    ctx.moveTo(px + 105, py + 135);
    ctx.quadraticCurveTo(px + 230, py + 10, px + 330, py + 70);
    ctx.lineTo(px + 315, py + 140);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(px + 335, py + 66, 20, 0, Math.PI * 2);
    ctx.fill();
    drawZ(ctx, px + 360, py + 150, 56, "#FFFFFF", "#3A4FB0");
    drawZ(ctx, px + 380, py + 95, 38, "#FFFFFF", "#3A4FB0");
    // Gold star.
    ctx.fillStyle = "#FFC83D";
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const r = k % 2 ? 22 : 52;
      ctx.lineTo(px + 60 + Math.cos(a) * r, py + 60 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    label(ctx, "Zzz…", w / 2, h - 34, 44, "#3A4FB0", { font: TITLE, weight: 400 });
  });

const logoTex = () =>
  canvasTexture("dormir-logo", 1024, 220, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    moon(ctx, 110, h / 2, 78, "#FFC83D", "#E9EEF8");
    label(ctx, "SIESTA S.A.C.", w / 2 + 70, h / 2 + 8, 150, "#2E4BB8", { font: TITLE, weight: 400, maxW: w * 0.78 });
  });
const zTex = () =>
  canvasTexture("dormir-z", 128, 128, (ctx, w) => {
    ctx.clearRect(0, 0, w, w);
    drawZ(ctx, w / 2, w / 2, w * 0.86, "#FFFFFF", "#2E4BB8");
  });

const texMats = new Map<string, THREE.Material>();
const texMat = (key: string, tex: () => THREE.Texture, o: { basic?: boolean; transparent?: boolean; glow?: number } = {}) => {
  let m = texMats.get(key);
  if (!m) {
    const map = tex();
    m = o.basic
      ? new THREE.MeshBasicMaterial({ map, transparent: o.transparent ?? false, toneMapped: false })
      : new THREE.MeshStandardMaterial({ map, roughness: 0.6, emissive: new THREE.Color("#ffffff"), emissiveMap: map, emissiveIntensity: o.glow ?? 0.25, transparent: o.transparent ?? false, alphaTest: o.transparent ? 0.02 : 0 });
    texMats.set(key, m);
  }
  return m;
};

const roomGeos = once(() => {
  const W = ROOM.x1 - ROOM.x0;
  const cx = (ROOM.x0 + ROOM.x1) / 2;
  const floor = new THREE.PlaneGeometry(W, 34);
  const uv = floor.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * W) / 2.4, (uv.getY(i) * 34) / 2.4);
  floor.rotateX(-Math.PI / 2);
  floor.translate(cx, 0, ROOM.zBack + 17);
  const back = new THREE.PlaneGeometry(W, ROOM.height);
  back.translate(cx, ROOM.height / 2, ROOM.zBack);
  // Windows (left and right of the centre wall), white frames, skirting and a mint rail.
  const trim: THREE.BufferGeometry[] = [
    place(rbox(W, 0.22, 0.08, 0.02), "#B7C1D6", [cx, 0.11, ROOM.zBack + 0.04]),
    place(rbox(W, 0.12, 0.06, 0.02), "#7FD9B4", [cx, 1.25, ROOM.zBack + 0.03]),
  ];
  for (const wx of WINDOWS) {
    const { w, y0, y1 } = WIN;
    trim.push(place(rbox(w + 0.2, 0.14, 0.14, 0.03), "#FFFFFF", [wx, y0, ROOM.zBack + 0.07]));
    trim.push(place(rbox(w + 0.2, 0.14, 0.14, 0.03), "#FFFFFF", [wx, y1, ROOM.zBack + 0.07]));
    for (const k of [-1, -1 / 3, 1 / 3, 1]) trim.push(place(rbox(Math.abs(k) === 1 ? 0.14 : 0.08, y1 - y0, 0.12, 0.03), "#FFFFFF", [wx + (k * w) / 2, (y0 + y1) / 2, ROOM.zBack + 0.07]));
  }
  return {
    floor,
    back,
    trim: mergeAll(trim),
    glass: new THREE.PlaneGeometry(WIN.w, WIN.y1 - WIN.y0),
    poster: new THREE.PlaneGeometry(1.7, 2.26),
    posterFrame: rbox(1.84, 2.4, 0.06, 0.03),
    employee: new THREE.PlaneGeometry(1.9, 2.375),
    employeeFrame: rbox(2.16, 2.64, 0.12, 0.06),
    logo: new THREE.PlaneGeometry(4.6, 0.99),
  };
});
const WINDOWS = [-7.2, 10.6];
const WIN = { w: 4.4, y0: 1.5, y1: 4.9 };
const EMPLOYEE_AT: V3 = [2.85, 3.05, ROOM.zBack + 0.08];
const POSTERS: [V3, "money" | "dream"][] = [
  [[-1.2, 3.0, ROOM.zBack + 0.05], "money"],
  [[6.5, 3.0, ROOM.zBack + 0.05], "dream"],
];

// ---- Water cooler ----------------------------------------------------------------------------
const coolerGeos = once(() => ({
  body: mergeAll([
    place(rbox(0.62, 1.05, 0.56, 0.07), "#F4F6FA", [0, 0.525, 0]),
    place(rbox(0.4, 0.26, 0.06, 0.03), "#3B4258", [0, 0.8, 0.27]),
    place(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 10), "#3D8BFF", [-0.09, 0.84, 0.31], [Math.PI / 2, 0, 0]),
    place(new THREE.CylinderGeometry(0.035, 0.035, 0.08, 10), "#FF4D5E", [0.09, 0.84, 0.31], [Math.PI / 2, 0, 0]),
    place(rbox(0.3, 0.03, 0.12, 0.01), "#9AA4BA", [0, 0.69, 0.29]),
    place(new THREE.CylinderGeometry(0.2, 0.22, 0.08, 18), "#DCE2EE", [0, 1.09, 0]),
    place(new THREE.CylinderGeometry(0.06, 0.05, 0.38, 12), "#FFFFFF", [0.38, 0.75, 0.06]),
  ]),
  bottle: new THREE.CylinderGeometry(0.26, 0.26, 0.66, 22),
  neck: new THREE.CylinderGeometry(0.1, 0.24, 0.14, 18),
  water: new THREE.CylinderGeometry(0.235, 0.235, 0.5, 18),
}));
export const WaterCooler: React.FC = () => {
  const g = coolerGeos();
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: "#9FD8FF", roughness: 0.08, transparent: true, opacity: 0.5, emissive: new THREE.Color("#9FD8FF"), emissiveIntensity: 0.25, depthWrite: false }), []);
  return (
    <group>
      <mesh geometry={g.body} material={vertexMat(0.45, false, 0.16)} />
      <mesh geometry={g.water} material={toy("#4FB2FF", { rough: 0.2, glow: 0.3 })} position={[0, 1.42, 0]} />
      <mesh geometry={g.neck} material={glass} position={[0, 1.2, 0]} />
      <mesh geometry={g.bottle} material={glass} position={[0, 1.6, 0]} />
    </group>
  );
};

/**
 * The office set (no characters, no lights): floor, back wall with windows, the SIESTA S.A.C. logo,
 * posters and the «EMPLEADO DEL MES» frame, every bed (the background duvets included; the two hero
 * beds get <HeroDuvet>), nightstands with tiny lamps (`lamps` glows near the given beds), cubicle
 * dividers, plants and the water cooler.
 */
export const OfficeBedsSet: React.FC<{ lampGlow?: number[] }> = ({ lampGlow = [] }) => {
  const ready = useFontsReady();
  const r = roomGeos();
  const s = setGeos();
  const carpet = useMemo(() => {
    const tex = carpetTex();
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, emissive: new THREE.Color("#ffffff"), emissiveMap: tex, emissiveIntensity: 0.16 });
  }, []);
  return (
    <group>
      <mesh geometry={r.floor} material={carpet} />
      <mesh geometry={r.back} material={toy("#EEF1F8", { rough: 0.9, glow: 0.16 })} />
      <mesh geometry={r.trim} material={vertexMat(0.5, false, 0.18)} />
      {WINDOWS.map((x) => (
        <mesh key={x} geometry={r.glass} material={texMat("dormir-sky", skyTex, { basic: true })} position={[x, (WIN.y0 + WIN.y1) / 2, ROOM.zBack + 0.02]} />
      ))}
      {ready ? (
        <>
          <mesh geometry={r.logo} material={texMat("dormir-logo", logoTex, { transparent: true, glow: 0.3 })} position={[2.4, 5.55, ROOM.zBack + 0.03]} />
          {POSTERS.map(([p, kind]) => (
            <group key={kind} position={p}>
              <mesh geometry={r.posterFrame} material={toy("#FFFFFF", { rough: 0.5, glow: 0.2 })} />
              <mesh geometry={r.poster} material={texMat(`dormir-poster-${kind}`, kind === "money" ? posterMoneyTex : posterDreamTex, { glow: 0.3 })} position={[0, 0, 0.035]} />
            </group>
          ))}
          <group position={EMPLOYEE_AT}>
            <mesh geometry={r.employeeFrame} material={toy("#FFC83D", { metal: 0.45, rough: 0.35, glow: 0.22 })} />
            <mesh geometry={r.employee} material={texMat("dormir-employee", employeeTex, { glow: 0.32 })} position={[0, 0, 0.065]} />
          </group>
        </>
      ) : null}
      <mesh geometry={s.set} material={vertexMat(0.62, false, 0.14)} />
      <mesh geometry={s.shades} material={basic("#FFE3A3")} />
      {lampGlow.map((i) => {
        const b = OFFICE_BEDS[i];
        return b ? <Glow key={i} color="#FFC46B" size={0.75} opacity={0.55} position={[b.x + LAMP_LOCAL[0], LAMP_LOCAL[1], b.z + LAMP_LOCAL[2] + 0.05]} /> : null;
      })}
      <group position={[3.62, 0, -3.15]} rotation={[0, -0.5, 0]}>
        <WaterCooler />
      </group>
    </group>
  );
};

/** Bright daytime office: sky fill, a warm key from the front, a cool rim from the windows. */
export const OfficeBedsLights: React.FC = () => (
  <>
    <hemisphereLight args={["#F7F9FF", "#9AA3BC", 1.3]} />
    <directionalLight position={[4, 9, 10]} intensity={1.5} color="#FFF6E8" />
    <directionalLight position={[-6, 6, -10]} intensity={0.6} color="#D2E4FF" />
  </>
);

// =======================================================================================
// HERO DUVET (Nubi's and the Worker's beds: it follows its sleeper)

const duvetGeos = once(() => ({
  slab: rbox(1, 1, 1, 0.12, 3),
  lump: rbox(1, 1, 1, 0.24, 3),
  mound: rbox(2.3, 1.25, 2.15, 0.55, 4),
  cuff: new THREE.CapsuleGeometry(0.15, 2.5, 4, 12).rotateZ(Math.PI / 2),
}));
/**
 * The duvet of a hero bed (place it at the bed centre). `up` 0..1 follows the sleeper (lying back →
 * sitting up: the top edge slides into the lap); `cover` 0..1 pulls it right over the head into a
 * mound (`squirm` makes the mound wriggle, `jolt` 0..1 jumps it); `breathe` −1..1 swells the lump.
 */
export const HeroDuvet: React.FC<{ color: string; up?: number; cover?: number; squirm?: number; jolt?: number; breathe?: number; t?: number }> = ({
  color,
  up = 0,
  cover = 0,
  squirm = 0,
  jolt = 0,
  breathe = 0,
  t = 0,
}) => {
  const g = duvetGeos();
  const mat = toy(color, { rough: 0.75, glow: 0.14 });
  const { w, l } = BED;
  const foot = l / 2 + 0.06;
  const edge = lerp(lerp(DUVET.edge, 0.86, up), -1.25, cover);
  const len = foot - edge;
  const lumpH = lerp(0.5, 0.32, up) * (1 + 0.06 * breathe);
  const k = smooth(0, 1, cover);
  const wig = squirm * (1 - 0.5 * jolt);
  return (
    <group>
      <mesh geometry={g.slab} material={mat} position={[0, 0.72, edge + len / 2]} scale={[w + 0.12, 0.6, len]} />
      <mesh geometry={g.lump} material={mat} position={[0, 0.75 + lumpH / 2, lerp(DUVET.edge, 0.86, up) + 0.55]} scale={[2.3, lumpH, 1.15]} />
      {k > 0.01 ? (
        <mesh
          geometry={g.mound}
          material={mat}
          position={[0.05 * wig * Math.sin(t * 9), 0.72 + 0.5 * k + 0.35 * jolt + 0.05 * wig * Math.abs(Math.sin(t * 11)), -0.5]}
          rotation={[-0.25 + 0.06 * wig * Math.sin(t * 7), 0.08 * wig * Math.sin(t * 5), 0.07 * wig * Math.sin(t * 8 + 1)]}
          scale={[k * (1 + 0.04 * wig * Math.sin(t * 13)), k * (1 + 0.1 * jolt), k]}
        />
      ) : null}
      <mesh geometry={g.cuff} material={toy(C.cuff, { rough: 0.7, glow: 0.18 })} position={[0, lerp(1.16, 1.04, up) + lerp(0, 0.95, k), edge + 0.03]} />
    </group>
  );
};

// =======================================================================================
// THE SENSOR on Nubi's headboard: red = awake, green = asleep

const sensorGeos = once(() => ({
  box: rbox(0.46, 0.28, 0.2, 0.07, 3),
  face: rbox(0.36, 0.18, 0.02, 0.05, 2),
  led: new THREE.SphereGeometry(0.075, 16, 12),
  stalk: new THREE.CylinderGeometry(0.012, 0.012, 0.2, 6),
  tip: new THREE.SphereGeometry(0.03, 8, 6),
  arc: new THREE.TorusGeometry(1, 0.06, 6, 16, Math.PI * 0.55),
}));
const LED = { awake: "#FF2E45", asleep: "#2EF07A", off: "#59607A" };
/**
 * The sleep sensor (place it at SENSOR_LOCAL on the bed): a little white box with an LED dome and an
 * antenna. `state` lights it; `flash` 0..1 strobes it; `buzz` 0..1 shakes it with vibration arcs.
 */
export const BedSensor: React.FC<{ state: "off" | "awake" | "asleep"; g: number; flash?: number; buzz?: number; pop?: number }> = ({ state, g, flash = 0, buzz = 0, pop = 1 }) => {
  const geo = sensorGeos();
  const strobe = Math.floor(g / 2) % 2 === 0 ? 1 : 0.15;
  const on = state === "off" ? 0 : 1;
  const k = on * lerp(1, strobe, clamp01(flash));
  const color = LED[state];
  const led = basic(k > 0.5 ? color : state === "off" ? LED.off : `#${new THREE.Color(color).multiplyScalar(0.45).getHexString()}`);
  const jx = buzz * 0.03 * Math.sin(g * 2.9);
  const jr = buzz * 0.14 * Math.sin(g * 3.7);
  const arcs = buzz > 0.05 && Math.floor(g / 2) % 2 === 0;
  return (
    <group scale={pop}>
      <group position={[jx, 0, 0]} rotation={[0, 0, jr]}>
        <mesh geometry={geo.box} material={toy("#F6F8FC", { rough: 0.35, glow: 0.2 })} position={[0, 0.14, 0]} />
        <mesh geometry={geo.face} material={basic("#202636")} position={[0, 0.14, 0.1]} />
        <mesh geometry={geo.led} material={led} position={[0, 0.14, 0.12]} scale={[1 + 0.25 * flash * strobe, 1 + 0.25 * flash * strobe, 0.6]} />
        <mesh geometry={geo.stalk} material={toy("#3B4258")} position={[0.17, 0.37, 0]} />
        <mesh geometry={geo.tip} material={basic(on ? color : LED.off)} position={[0.17, 0.48, 0]} />
        <Glow color={color} size={(0.75 + 1.4 * flash * strobe) * on} opacity={(0.65 + 0.35 * flash) * k} position={[0, 0.14, 0.22]} />
        {arcs
          ? [-1, 1].map((s) =>
              [0.32, 0.46].map((r) => (
                <mesh key={`${s}${r}`} geometry={geo.arc} material={basic(LED.awake)} position={[0, 0.14, 0.05]} rotation={[0, 0, s > 0 ? -Math.PI * 0.275 : Math.PI * 0.725]} scale={[r, r, 0.4]} />
              )),
            )
          : null}
      </group>
    </group>
  );
};

// =======================================================================================
// THE BACKGROUND SLEEPERS (instanced)

const crowdGeos = once(() => {
  const body = rbox(10, 7.4, 8.8, 0.6, 3);
  body.translate(0, 6.2, 0);
  const eye = rbox(1.3, 0.28, 0.5, 0.12, 2);
  const cap = new THREE.ConeGeometry(3.4, 6.5, 16, 1);
  cap.translate(0, 3.25, 0);
  const pom = new THREE.SphereGeometry(1.0, 10, 8);
  return { body, eye, cap, pom };
});
const CAPPED = SLEEPERS.filter((b) => b.cap);

/** Every background colleague asleep in its bed (bodies, closed eyes, nightcaps), breathing at frame g. */
export const Sleepers: React.FC<{ g: number }> = ({ g }) => {
  const geo = crowdGeos();
  const n = SLEEPERS.length;
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const eyeRef = useRef<THREE.InstancedMesh>(null);
  const capRef = useRef<THREE.InstancedMesh>(null);
  const pomRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const c = new THREE.Color();
    SLEEPERS.forEach((b, i) => bodyRef.current?.setColorAt(i, c.set(b.body)));
    CAPPED.forEach((b, i) => capRef.current?.setColorAt(i, c.set(b.cap ?? "#FFFFFF")));
    for (const m of [bodyRef.current, capRef.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);
  useLayoutEffect(() => {
    const M = new THREE.Matrix4();
    const A = new THREE.Matrix4();
    const B = new THREE.Matrix4();
    let ci = 0;
    SLEEPERS.forEach((b, i) => {
      const pose = sleeperPose(b, g);
      bodyMatrix(M, sleeperAt(b), 0, b.size, pose);
      bodyRef.current?.setMatrixAt(i, M);
      for (const side of [0, 1]) {
        A.copy(M).multiply(B.makeTranslation(side ? 2.3 : -2.3, 5.35, 4.45));
        eyeRef.current?.setMatrixAt(i * 2 + side, A);
      }
      if (b.cap) {
        const tilt = (hash(b.seed + 9) - 0.5) * 0.9;
        A.copy(M).multiply(B.compose(_v.set(0, 9.4, -1.2), _q.setFromEuler(_e.set(-0.55, 0, tilt)), _s.set(1, 1, 1)));
        capRef.current?.setMatrixAt(ci, A);
        A.multiply(B.makeTranslation(0, 6.6, 0));
        pomRef.current?.setMatrixAt(ci, A);
        ci++;
      }
    });
    for (const m of [bodyRef.current, eyeRef.current, capRef.current, pomRef.current]) if (m) m.instanceMatrix.needsUpdate = true;
  }, [g]);
  return (
    <group>
      <instancedMesh ref={bodyRef} args={[geo.body, toy("#FFFFFF", { rough: 0.42, glow: 0.14 }), n]} frustumCulled={false} />
      <instancedMesh ref={eyeRef} args={[geo.eye, toy("#151515", { rough: 0.5, glow: 0 }), n * 2]} frustumCulled={false} />
      <instancedMesh ref={capRef} args={[geo.cap, toy("#FFFFFF", { rough: 0.7, glow: 0.14 }), CAPPED.length]} frustumCulled={false} />
      <instancedMesh ref={pomRef} args={[geo.pom, toy("#FFFFFF", { rough: 0.8, glow: 0.25 }), CAPPED.length]} frustumCulled={false} />
    </group>
  );
};

// =======================================================================================
// SNORING: rising Z letters and a snot bubble

const zMats = new Map<string, THREE.SpriteMaterial>();
const zMat = (opacity: number, color: string) => {
  const lv = Math.round(clamp01(opacity) * 10);
  const key = `${lv}|${color}`;
  let m = zMats.get(key);
  if (!m) {
    m = new THREE.SpriteMaterial({ map: zTex(), color, transparent: true, depthWrite: false, opacity: lv / 10, toneMapped: false });
    zMats.set(key, m);
  }
  return m;
};
/**
 * Snoring Z letters rising from `at` (world): one every `every` frames from `from` (until `to`),
 * each living `life` frames, drifting towards `dir` (−1 left, 1 right), growing from size·0.55.
 */
export const Zzz: React.FC<{ g: number; at: V3; from: number; to?: number; every?: number; life?: number; size?: number; rise?: number; dir?: number; color?: string; seed?: number }> = ({
  g,
  at,
  from,
  to = Infinity,
  every = 24,
  life = 54,
  size = 0.34,
  rise = 1.1,
  dir = 1,
  color = "#FFFFFF",
  seed = 0,
}) => {
  const out: React.ReactNode[] = [];
  const k0 = Math.max(0, Math.floor((g - life - from) / every));
  for (let k = k0; from + k * every <= Math.min(g, to); k++) {
    const d = g - (from + k * every);
    if (d < 0 || d > life) continue;
    const u = d / life;
    const fade = Math.min(1, d / 5) * (1 - smooth(0.6, 1, u));
    const s = size * (0.55 + 0.7 * u) * (k % 3 === 2 ? 0.8 : 1);
    const x = at[0] + dir * (0.12 + 0.55 * u) + 0.09 * Math.sin(d * 0.16 + k * 2.1 + seed);
    out.push(<sprite key={k} material={zMat(fade, color)} position={[x, at[1] + rise * u, at[2]]} scale={[s, s, 1]} renderOrder={6} />);
  }
  return <group>{out}</group>;
};

const bubbleGeos = once(() => ({ ball: new THREE.SphereGeometry(1, 24, 16), shine: new THREE.SphereGeometry(0.2, 10, 8) }));
/** A snot bubble of radius r (world) at `at`, swelling with each breath. */
export const SnotBubble: React.FC<{ at: V3; r: number }> = ({ at, r }) => {
  const g = bubbleGeos();
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#BDEBFF", roughness: 0.05, transparent: true, opacity: 0.5, emissive: new THREE.Color("#BDEBFF"), emissiveIntensity: 0.35, depthWrite: false }), []);
  if (r < 0.01) return null;
  return (
    <group position={at} scale={r}>
      <mesh geometry={g.ball} material={mat} renderOrder={4} />
      <mesh geometry={g.shine} material={basic("#FFFFFF")} position={[-0.38, 0.42, 0.75]} />
    </group>
  );
};

// =======================================================================================
// NUBI'S PROPS AND FACES

const briefGeos = once(() => ({
  case: rbox(0.46, 0.32, 0.13, 0.045, 3),
  band: rbox(0.47, 0.05, 0.135, 0.02, 2),
  handle: new THREE.TorusGeometry(0.065, 0.02, 8, 14, Math.PI),
  clasp: rbox(0.08, 0.06, 0.03, 0.012, 2),
}));
/** A tiny briefcase (world units): the handle's grip at the origin, the case hanging below it. */
export const Briefcase: React.FC = () => {
  const g = briefGeos();
  return (
    <group>
      <mesh geometry={g.handle} material={toy("#3B2618", { rough: 0.5 })} position={[0, -0.075, 0]} />
      <mesh geometry={g.case} material={toy("#9A6234", { rough: 0.45, glow: 0.14 })} position={[0, -0.24, 0]} />
      <mesh geometry={g.band} material={toy("#6E4223", { rough: 0.5 })} position={[0, -0.16, 0]} />
      <mesh geometry={g.clasp} material={toy("#FFC83D", { metal: 0.5, rough: 0.3, glow: 0.2 })} position={[0, -0.15, 0.072]} />
    </group>
  );
};

/** A hurried trot (legs paddling, bobbing, fins swinging); `ph` advances ~0.9 per frame. */
export const trotPose = (ph: number): NubiPose => ({
  hop: 0.6 * Math.abs(Math.sin(ph)),
  squash: 1 + 0.05 * Math.sin(ph * 2 + 0.6),
  roll: 0.06 * Math.sin(ph),
  pitch: 0.12,
  wiggle: 1,
  wigglePhase: ph * 2,
  finL: 0.15 + 0.4 * Math.sin(ph),
  finR: 0.15 - 0.4 * Math.sin(ph),
});

const eyeGeos = once(() => ({
  open: rbox(1.05, 1.75, 0.5, 0.2, 3),
  bar: rbox(1.25, 0.28, 0.5, 0.12, 2),
  arc: new THREE.TorusGeometry(0.6, 0.17, 8, 20, Math.PI),
}));
const eyeMats = new Map<number, THREE.MeshStandardMaterial>();
const eyeMat = (rough: number) => {
  let m = eyeMats.get(rough);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: "#151515", roughness: rough });
    eyeMats.set(rough, m);
  }
  return m;
};
export type EyeMode = "open" | "closed" | "happy" | "squeeze";
/**
 * Nubi's eyes drawn one by one (children of <Nubi hideEyes>, model units): "open" (scaled by
 * `open*`, looking `lookX/lookY`), "closed" (a line), "happy" (∩ arcs: a smug closed-eye smile) or
 * "squeeze" (> < squeezed shut). `left` is the screen-left eye when Nubi faces the camera.
 */
export const NubiEyes: React.FC<{ left: EyeMode; right: EyeMode; lookX?: number; lookY?: number; openL?: number; openR?: number; rough?: number }> = ({
  left,
  right,
  lookX = 0,
  lookY = 0,
  openL = 1,
  openR = 1,
  rough = 0.32,
}) => {
  const g = eyeGeos();
  const m = eyeMat(rough);
  const eye = (mode: EyeMode, side: number, open: number) => {
    const x = side * 2.3;
    const z = 4.45;
    if (mode === "open") return <mesh key={side} geometry={g.open} material={m} position={[x + lookX * 0.5, 5.5 + lookY * 0.4, z]} scale={[Math.min(1.35, Math.max(0.8, open)), Math.max(0.1, open), 1]} />;
    if (mode === "closed") return <mesh key={side} geometry={g.bar} material={m} position={[x, 5.3, z]} />;
    if (mode === "happy") return <mesh key={side} geometry={g.arc} material={m} position={[x, 5.15, z]} scale={[1, 0.85, 1.5]} />;
    // Squeezed shut: a chevron pointing at the nose ("> <").
    return (
      <group key={side}>
        <mesh geometry={g.bar} material={m} position={[x, 5.72, z]} rotation={[0, 0, side * 0.42]} scale={[0.92, 1, 1]} />
        <mesh geometry={g.bar} material={m} position={[x, 5.28, z]} rotation={[0, 0, -side * 0.42]} scale={[0.92, 1, 1]} />
      </group>
    );
  };
  return (
    <group>
      {eye(left, -1, openL)}
      {eye(right, 1, openR)}
    </group>
  );
};

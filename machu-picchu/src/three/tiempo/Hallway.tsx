import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FONT } from "../../theme";
import { V3, canvasTexture, glowTexture, paintGeo, roundedRectShape, shadeHex, toy, useFontsReady, vertexMat } from "../inca/kit";
import { mulberry } from "../noise";
import { Nubi, NubiPalette, NubiPose } from "../Nubi";
import { Glow, additive, segmentFrame } from "../thanos/FX";
import { Lids, TIMECO_DARK, TIMECO_GOLD, TIMECO_RED } from "./Office";

// TIMECO's night hallway for the "senora" shot of the time short, and its people and FX: the
// old cleaning lady (lavender Nubi, hair bun, round glasses, pale-yellow apron, rosy cheeks), her
// mop, bucket and the water she splashes, the stream of life that flows from Nubi to her, hearts.
//
// World units are sized for Nubi at size 2 (2 wide, ≈ 2 tall); floor y = 0; +z points towards
// the camera. Everything is deterministic and built once (module caches or useMemo); `g` is the
// global frame and `t` time in seconds where a prop animates.
//
// HALL: the back wall (z = HALL.zBack) has three floor-to-ceiling windows on the night city (the
// moon, TIMECO's tower), then a solid section with the vending machine (HALL_VENDING) under the
// red TIMECO neon. The floor is wet, shiny tiles: it is drawn see-through over a mirrored copy of
// the set (<HallReflection>), so the windows, the props and the actors reflect in it; puddles
// (around HALL_LADY) reflect more.

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, x: number) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const frac = (x: number) => x - Math.floor(x);
/** Lazily built value shared by every instance (static geometry, materials). */
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
/** Plane w × h whose uvs are in world units (tiling textures). */
const worldPlane = (w: number, h: number) => {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  return g;
};

// =======================================================================================
// Canvas helpers

const HEAVY = `'${FONT.heavy}', sans-serif`;
type Ctx = CanvasRenderingContext2D;

const label = (ctx: Ctx, s: string, x: number, y: number, size: number, color: string, o: { stroke?: string; lw?: number; glow?: string; blur?: number; maxW?: number } = {}) => {
  ctx.save();
  ctx.font = `900 ${size}px ${HEAVY}`;
  if (o.maxW) {
    const w = ctx.measureText(s).width;
    if (w > o.maxW) ctx.font = `900 ${(size * o.maxW) / w}px ${HEAVY}`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (o.glow) {
    ctx.shadowColor = o.glow;
    ctx.shadowBlur = o.blur ?? 18;
  }
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

const rrect = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 0) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke && lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
};

const glassPath = (ctx: Ctx, cx: number, cy: number, w: number, h: number) => {
  ctx.beginPath();
  ctx.moveTo(cx - w, cy - h);
  ctx.lineTo(cx + w, cy - h);
  ctx.bezierCurveTo(cx + w, cy - h * 0.3, cx + w * 0.12, cy - h * 0.2, cx + w * 0.12, cy);
  ctx.bezierCurveTo(cx + w * 0.12, cy + h * 0.2, cx + w, cy + h * 0.3, cx + w, cy + h);
  ctx.lineTo(cx - w, cy + h);
  ctx.bezierCurveTo(cx - w, cy + h * 0.3, cx - w * 0.12, cy + h * 0.2, cx - w * 0.12, cy);
  ctx.bezierCurveTo(cx - w * 0.12, cy - h * 0.2, cx - w, cy - h * 0.3, cx - w, cy - h);
  ctx.closePath();
};

/** TIMECO's logo: an hourglass (gold sand) inside a red ring, centred at (cx, cy), radius r. */
const drawLogo = (ctx: Ctx, cx: number, cy: number, r: number, o: { ring?: string; frame?: string; glass?: string; sand?: string; glow?: string } = {}) => {
  const frame = o.frame ?? TIMECO_DARK;
  ctx.save();
  if (o.glow) {
    ctx.shadowColor = o.glow;
    ctx.shadowBlur = r * 0.35;
  }
  ctx.lineWidth = r * 0.17;
  ctx.strokeStyle = o.ring ?? TIMECO_RED;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  const w = r * 0.4;
  const h = r * 0.5;
  glassPath(ctx, cx, cy, w, h);
  ctx.fillStyle = o.glass ?? "#FFFFFF";
  ctx.fill();
  ctx.save();
  glassPath(ctx, cx, cy, w, h);
  ctx.clip();
  ctx.fillStyle = o.sand ?? TIMECO_GOLD;
  ctx.beginPath();
  ctx.moveTo(cx - w, cy - h * 0.36);
  ctx.lineTo(cx + w, cy - h * 0.36);
  ctx.lineTo(cx, cy + h * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - w, cy + h);
  ctx.lineTo(cx + w, cy + h);
  ctx.lineTo(cx + w * 0.3, cy + h * 0.5);
  ctx.quadraticCurveTo(cx, cy + h * 0.34, cx - w * 0.3, cy + h * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - r * 0.025, cy - h * 0.05, r * 0.05, h * 0.6);
  ctx.restore();
  glassPath(ctx, cx, cy, w, h);
  ctx.lineWidth = r * 0.075;
  ctx.lineJoin = "round";
  ctx.strokeStyle = frame;
  ctx.stroke();
  rrect(ctx, cx - w * 1.32, cy - h - r * 0.13, w * 2.64, r * 0.14, r * 0.05, frame);
  rrect(ctx, cx - w * 1.32, cy + h - r * 0.01, w * 2.64, r * 0.14, r * 0.05, frame);
  ctx.restore();
};

const texMats = new Map<string, THREE.Material>();
/** Material for a canvas texture, cached per key (`basic` = unlit, for screens and skies). */
const texMat = (key: string, tex: () => THREE.Texture, o: { rough?: number; glow?: number; transparent?: boolean; basic?: boolean } = {}) => {
  let m = texMats.get(key);
  if (!m) {
    const map = tex();
    m = o.basic
      ? new THREE.MeshBasicMaterial({ map, transparent: o.transparent ?? false, alphaTest: o.transparent ? 0.02 : 0, toneMapped: false })
      : new THREE.MeshStandardMaterial({
          map,
          roughness: o.rough ?? 0.6,
          emissive: new THREE.Color("#ffffff"),
          emissiveMap: map,
          emissiveIntensity: o.glow ?? 0.18,
          transparent: o.transparent ?? false,
          alphaTest: o.transparent ? 0.02 : 0,
        });
    texMats.set(key, m);
  }
  return m;
};

// =======================================================================================
// Layout

/** The hallway: floor y = 0 from the back wall (zBack) towards +z; side walls at x0/x1. */
export const HALL = { x0: -10, x1: 10, zBack: -3.6, height: 7.2 };
const HALL_WINDOWS = [-4.4, -1.6, 1.2];
const HALL_WIN = { w: 2.5, y0: 0.62, y1: 6.45 };
/** The night city behind the windows (a plane `VIEW.back` behind the wall). */
const VIEW = { w: 36, h: 13.5, y: 4.6, back: 5 };
/** The vending machine (base centre) against the back wall, right of the windows. */
export const HALL_VENDING: V3 = [4.05, 0, HALL.zBack + 0.5];
/** TIMECO's red neon over the vending machine. */
export const HALL_LOGO: V3 = [4.05, 4.15, HALL.zBack + 0.06];
/** The yellow "PISO MOJADO" sign. */
export const HALL_SIGN: V3 = [-0.35, 0, -1.55];
/** The mop bucket. */
export const HALL_BUCKET: V3 = [2.75, 0, -0.45];
/** Where the old lady mops. */
export const HALL_LADY: V3 = [1.05, 0, 0.55];
/** Night colour behind the canvas. */
export const HALL_BG = "linear-gradient(180deg, #0A1236 0%, #1A2A66 60%, #2A3B7E 100%)";
/** The floor plane (world extent) and the puddles where it is wettest. */
const FLOOR = { w: 26, d: 24, zc: HALL.zBack + 12 };
const PUDDLES: [number, number, number, number][] = [
  [1.3, 0.75, 2.1, 1.3],
  [-0.4, 1.4, 1.6, 0.9],
  [2.6, -0.2, 1.2, 0.8],
  [-2.2, 0.3, 1.1, 0.7],
  [0.6, 2.6, 1.4, 0.8],
];

// =======================================================================================
// Textures

const hallTileTex = () =>
  canvasTexture(
    "senora-hall-tiles",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#5A6488";
      ctx.fillRect(0, 0, W, H);
      const tones = ["#B4BFDD", "#A7B3D4", "#BAC4E0", "#ABB7D8"];
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          const g = ctx.createLinearGradient(i * 128, j * 128, i * 128 + 128, j * 128 + 128);
          g.addColorStop(0, tones[(i + j * 2) % 4]);
          g.addColorStop(1, shadeHex(tones[(i + j * 2) % 4], -0.05));
          ctx.fillStyle = g;
          ctx.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
          // A soft gloss streak on every tile.
          ctx.fillStyle = "rgba(255,255,255,0.16)";
          ctx.fillRect(i * 128 + 14, j * 128 + 12, 60, 8);
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

/** How see-through the floor is (green channel): darker = wetter = more reflection. */
const wetTex = () =>
  canvasTexture("senora-hall-wet", 512, 512, (ctx, W, H) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    const toPx = (x: number, z: number): [number, number] => [((x + FLOOR.w / 2) / FLOOR.w) * W, ((z - (FLOOR.zc - FLOOR.d / 2)) / FLOOR.d) * H];
    for (const [x, z, rx, rz] of PUDDLES) {
      const [cx, cy] = toPx(x, z);
      const sx = (rx / FLOOR.w) * W;
      const sy = (rz / FLOOR.d) * H;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sx, sy);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, "rgb(120,120,120)");
      g.addColorStop(0.7, "rgb(150,150,150)");
      g.addColorStop(1, "rgb(255,255,255)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });

/** The night city through the windows: sky, stars, the moon, two skylines, TIMECO's tower. */
const nightTex = () =>
  canvasTexture("senora-night", 2048, 768, (ctx, W, H) => {
    const toX = (x: number) => ((x + VIEW.w / 2) / VIEW.w) * W;
    const toY = (y: number) => ((VIEW.y + VIEW.h / 2 - y) / VIEW.h) * H;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0B1540");
    g.addColorStop(0.55, "#1D3178");
    g.addColorStop(0.85, "#3A4FA0");
    g.addColorStop(1, "#5A62B0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const rnd = mulberry(77);
    ctx.fillStyle = "#FFFFFF";
    for (let i = 0; i < 220; i++) {
      ctx.globalAlpha = 0.35 + rnd() * 0.65;
      const s = rnd() < 0.15 ? 4 : 2.5;
      ctx.fillRect(rnd() * W, rnd() * H * 0.62, s, s);
    }
    ctx.globalAlpha = 1;
    // The moon, big and soft.
    const mx = toX(1.6);
    const my = toY(6.3);
    const mr = (0.62 / VIEW.h) * H;
    const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 5);
    halo.addColorStop(0, "rgba(225,232,255,0.55)");
    halo.addColorStop(1, "rgba(225,232,255,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#FBF6DF";
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(205,200,172,0.7)";
    ctx.beginPath();
    ctx.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.2, 0, Math.PI * 2);
    ctx.arc(mx + mr * 0.32, my + mr * 0.28, mr * 0.13, 0, Math.PI * 2);
    ctx.arc(mx + mr * 0.1, my - mr * 0.45, mr * 0.09, 0, Math.PI * 2);
    ctx.fill();
    // TIMECO's tower far away, its red ring glowing.
    const tx = toX(-3.3);
    const tTop = toY(6.9);
    const tw = (0.9 / VIEW.w) * W;
    ctx.fillStyle = "#14204E";
    ctx.fillRect(tx - tw / 2, tTop, tw, H - tTop);
    ctx.beginPath();
    ctx.moveTo(tx - tw / 2, tTop);
    ctx.lineTo(tx, tTop - tw * 0.7);
    ctx.lineTo(tx + tw / 2, tTop);
    ctx.fill();
    drawLogo(ctx, tx, toY(6.15), tw * 0.42, { ring: "#FF4646", glow: "#FF2020", glass: "#3A2030", frame: "#FFB0B0" });
    // Two layers of skyline with lit windows (warm and cyan).
    for (const [col, hMin, hMax, seed, lit] of [
      ["#24387A", 1.6, 4.0, 5, 0.3],
      ["#121C46", 0.4, 2.3, 9, 0.4],
    ] as [string, number, number, number, number][]) {
      const r = mulberry(seed);
      let x = -10;
      while (x < W) {
        const bw = 60 + r() * 120;
        const top = toY(hMin + r() * (hMax - hMin));
        ctx.fillStyle = col;
        ctx.fillRect(x, top, bw, H - top);
        for (let yy = top + 14; yy < H - 8; yy += 22) {
          for (let xx = x + 8; xx < x + bw - 8; xx += 16) {
            if (r() < lit) {
              ctx.fillStyle = r() < 0.7 ? "#FFD36B" : "#8FE3FF";
              ctx.fillRect(xx, yy, 7, 11);
            }
          }
        }
        x += bw + 4 + r() * 10;
      }
    }
  });

const vendingTex = () =>
  canvasTexture("senora-vending", 512, 768, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#DDF8FF");
    g.addColorStop(1, "#9FE6FF");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const colors = ["#FF4F7B", "#FFD23F", "#2F6BFF", "#1FB35A", "#FF8A1F", "#7B2FF7", TIMECO_RED];
    const prices = ["2 H", "45 MIN", "1 DÍA", "3 H", "20 MIN", "6 H"];
    const r = mulberry(3);
    for (let row = 0; row < 5; row++) {
      const y = 30 + row * 146;
      ctx.fillStyle = "#6A7FA8";
      ctx.fillRect(16, y + 112, W - 32, 8);
      for (let i = 0; i < 4; i++) {
        const x = 30 + i * 118;
        const c = colors[Math.floor(r() * colors.length)];
        if ((row + i) % 2) {
          rrect(ctx, x + 14, y + 14, 66, 96, 14, c);
          ctx.fillStyle = "rgba(255,255,255,0.45)";
          ctx.fillRect(x + 22, y + 22, 10, 80);
        } else {
          rrect(ctx, x + 8, y + 36, 80, 74, 10, c);
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.fillRect(x + 16, y + 50, 64, 12);
        }
        rrect(ctx, x + 6, y + 124, 86, 20, 6, TIMECO_DARK);
        label(ctx, prices[(row * 4 + i) % prices.length], x + 49, y + 135, 16, "#FFFFFF");
      }
    }
  });

/** "TIMECO" neon: the logo and the word (transparent background). */
const neonTex = () =>
  canvasTexture("senora-neon", 1024, 300, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    drawLogo(ctx, 150, H / 2, 128, { ring: "#FF5050", glow: "#FF2A2A", frame: "#FFD6D6", glass: "#3A1F2A" });
    label(ctx, "TIMECO", 625, H / 2 + 10, 196, "#FFE6E6", { glow: "#FF2A2A", blur: 34, maxW: 720 });
  });

const wetSignTex = () =>
  canvasTexture("senora-wet-sign", 256, 400, (ctx, W) => {
    ctx.fillStyle = "#FFD21F";
    ctx.fillRect(0, 0, W, 400);
    // Warning triangle with a slipping figure.
    ctx.fillStyle = TIMECO_DARK;
    ctx.beginPath();
    ctx.moveTo(W / 2, 22);
    ctx.lineTo(W - 22, 196);
    ctx.lineTo(22, 196);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#FFD21F";
    ctx.beginPath();
    ctx.moveTo(W / 2, 54);
    ctx.lineTo(W - 46, 178);
    ctx.lineTo(46, 178);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = TIMECO_DARK;
    ctx.fillStyle = TIMECO_DARK;
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(W / 2 + 20, 94, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W / 2 + 10, 110);
    ctx.lineTo(W / 2 - 14, 142);
    ctx.moveTo(W / 2 - 14, 142);
    ctx.lineTo(W / 2 + 22, 160);
    ctx.moveTo(W / 2 - 14, 142);
    ctx.lineTo(W / 2 - 46, 166);
    ctx.moveTo(W / 2 + 4, 120);
    ctx.lineTo(W / 2 + 36, 114);
    ctx.moveTo(W / 2 + 4, 120);
    ctx.lineTo(W / 2 - 28, 108);
    ctx.stroke();
    ctx.fillRect(62, 168, W - 124, 7);
    label(ctx, "PISO", W / 2, 250, 84, TIMECO_DARK);
    label(ctx, "MOJADO", W / 2, 330, 70, TIMECO_DARK, { maxW: W - 22 });
  });

/** Soft vertical fade (bright at v = 1) for light shafts and floor reflections. */
const fadeTex = () =>
  canvasTexture("senora-fade", 64, 256, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.5, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const s = ctx.createLinearGradient(0, 0, W, 0);
    s.addColorStop(0, "rgba(0,0,0,1)");
    s.addColorStop(0.15, "rgba(0,0,0,0)");
    s.addColorStop(0.85, "rgba(0,0,0,0)");
    s.addColorStop(1, "rgba(0,0,0,1)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, W, H);
  });

const hallMats = once(() => {
  const tiles = hallTileTex();
  tiles.repeat.set(0.62, 0.62);
  const wet = wetTex();
  wet.repeat.set(1 / FLOOR.w, 1 / FLOOR.d);
  const shaft = additive(new THREE.MeshBasicMaterial({ map: fadeTex(), color: "#8AA4FF", toneMapped: false }));
  shaft.opacity = 0.3;
  const vend = additive(new THREE.MeshBasicMaterial({ map: fadeTex(), color: "#7FEFFF", toneMapped: false }));
  vend.opacity = 0.3;
  const neon = additive(new THREE.MeshBasicMaterial({ map: fadeTex(), color: "#FF4A4A", toneMapped: false }));
  neon.opacity = 0.22;
  return {
    // See-through over the mirrored set below it (the reflection); drawn first of the transparent
    // things and without depth, so glows, shadows and particles above it stay on top.
    floor: new THREE.MeshStandardMaterial({
      map: tiles,
      alphaMap: wet,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      roughness: 0.18,
      metalness: 0.05,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tiles,
      emissiveIntensity: 0.1,
    }),
    glass: new THREE.MeshBasicMaterial({ color: "#BFD4FF", transparent: true, opacity: 0.07, depthWrite: false }),
    shaft,
    vend,
    neon,
  };
});

// =======================================================================================
// Props

/** The vending machine (base centre at the origin, front +z): snacks priced in time, glowing. */
export const VendingMachine: React.FC<{ t?: number }> = ({ t = 0 }) => {
  const ready = useFontsReady();
  const geos = useMemo(
    () => ({
      body: rbox(1.4, 2.55, 0.9, 0.08),
      window: new THREE.PlaneGeometry(0.9, 1.75),
      panel: rbox(0.32, 1.75, 0.05, 0.03),
      header: rbox(1.3, 0.34, 0.06, 0.04),
      tray: rbox(0.9, 0.3, 0.1, 0.04),
      button: rbox(0.08, 0.06, 0.03, 0.01),
      slot: rbox(0.16, 0.22, 0.04, 0.02),
    }),
    [],
  );
  const flick = 0.92 + 0.08 * Math.sin(t * 7.1) * Math.sin(t * 2.3);
  return (
    <group>
      <mesh geometry={geos.body} material={toy("#2C3250", { rough: 0.35, glow: 0.1 })} position={[0, 1.275, 0]} />
      <mesh geometry={geos.window} material={ready ? texMat("vending", vendingTex, { basic: true }) : toy("#BFF2FF", { glow: 1 })} position={[-0.17, 1.42, 0.456]} />
      <mesh geometry={geos.panel} material={toy("#1A1E2E", { rough: 0.4 })} position={[0.5, 1.42, 0.46]} />
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <mesh key={k} geometry={geos.button} material={toy(k === 2 ? "#5BFF8A" : "#8FE9FF", { glow: 0.9 })} position={[0.45 + (k % 2) * 0.1, 1.8 - Math.floor(k / 2) * 0.1, 0.49]} />
      ))}
      <mesh geometry={geos.slot} material={toy(TIMECO_GOLD, { glow: 0.5, metal: 0.4 })} position={[0.5, 1.25, 0.49]} />
      <mesh geometry={geos.tray} material={toy("#0E1120", { rough: 0.5 })} position={[-0.17, 0.32, 0.43]} />
      <mesh geometry={geos.header} material={toy(TIMECO_RED, { glow: 0.6 })} position={[0, 2.38, 0.44]} />
      <Glow color="#9FF3FF" size={2.6} opacity={0.3 * flick} position={[-0.17, 1.42, 0.9]} />
    </group>
  );
};

/** The yellow A-frame "PISO MOJADO" sign (base centre at the origin, front +z, 1.35 tall). */
export const WetFloorSign: React.FC = () => {
  const ready = useFontsReady();
  const geos = useMemo(() => ({ panel: rbox(0.8, 1.3, 0.05, 0.07), face: new THREE.PlaneGeometry(0.7, 1.1), handle: new THREE.TorusGeometry(0.16, 0.04, 8, 16, Math.PI) }), []);
  const yellow = toy("#FFD21F", { rough: 0.45, glow: 0.3 });
  return (
    <group>
      {[1, -1].map((s) => (
        <group key={s} position={[0, 1.3, 0]} rotation={[s * 0.19, s > 0 ? 0 : Math.PI, 0]}>
          <mesh geometry={geos.panel} material={yellow} position={[0, -0.65, 0.03]} />
          {ready ? <mesh geometry={geos.face} material={texMat("wet-sign", wetSignTex, { glow: 0.42 })} position={[0, -0.67, 0.058]} /> : null}
        </group>
      ))}
      <mesh geometry={geos.handle} material={yellow} position={[0, 1.33, 0]} />
    </group>
  );
};

/** The lady's yellow mop bucket on wheels with a wringer (base centre at the origin). */
export const MopBucket: React.FC<{ t?: number }> = ({ t = 0 }) => {
  const geos = useMemo(
    () => ({
      body: rbox(0.78, 0.5, 0.56, 0.1),
      water: new THREE.CircleGeometry(0.3, 24).rotateX(-Math.PI / 2),
      wringer: rbox(0.36, 0.32, 0.5, 0.06),
      lever: new THREE.CylinderGeometry(0.025, 0.025, 0.6, 8),
      wheel: new THREE.CylinderGeometry(0.06, 0.06, 0.05, 14).rotateZ(Math.PI / 2),
      foam: new THREE.SphereGeometry(0.07, 10, 8),
    }),
    [],
  );
  return (
    <group>
      <mesh geometry={geos.body} material={toy("#FFD23F", { rough: 0.4, glow: 0.24 })} position={[0, 0.35, 0]} />
      <mesh geometry={geos.water} material={toy("#7FC0FF", { rough: 0.1, glow: 0.45 })} position={[-0.12, 0.575 + 0.008 * Math.sin(t * 5), 0]} scale={[1.05, 1, 0.75]} />
      {[0, 1, 2, 3, 4].map((k) => (
        <mesh key={k} geometry={geos.foam} material={toy("#FFFFFF", { rough: 0.5, glow: 0.4 })} position={[-0.3 + 0.09 * k, 0.6, -0.12 + 0.07 * Math.sin(k * 2.1)]} scale={0.8 + 0.4 * hash(k)} />
      ))}
      <mesh geometry={geos.wringer} material={toy("#8A93A8", { rough: 0.4, metal: 0.3 })} position={[0.2, 0.72, 0]} />
      <mesh geometry={geos.lever} material={toy("#5C6478", { metal: 0.4 })} position={[0.3, 1.0, 0]} rotation={[0, 0, -0.35]} />
      {[
        [-0.3, -0.2],
        [0.3, -0.2],
        [-0.3, 0.2],
        [0.3, 0.2],
      ].map(([x, z], k) => (
        <mesh key={k} geometry={geos.wheel} material={toy("#22262F", { rough: 0.6 })} position={[x, 0.06, z]} />
      ))}
    </group>
  );
};

const mopGeos = once(() => {
  const strands: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 15; i++) {
    const a = (i / 15) * Math.PI * 2 + 0.2;
    const c = new THREE.CapsuleGeometry(0.05, 0.34, 3, 8);
    c.rotateZ(Math.PI / 2 - 0.22);
    c.translate(0.2, 0.05, 0);
    c.rotateY(a);
    strands.push(paintGeo(c, i % 3 ? "#EEF2FA" : "#D3DCEA"));
  }
  return {
    head: mergeAll(strands),
    clamp: rbox(0.18, 0.12, 0.18, 0.03),
    stick: new THREE.CylinderGeometry(0.035, 0.035, 1, 10).translate(0, 0.5, 0),
  };
});

/** A mop: the head (strands) on the floor at `head`, the stick up to `top` (and a little past it). */
export const Mop: React.FC<{ head: V3; top: V3 }> = ({ head, top }) => {
  const g = mopGeos();
  const base: V3 = [head[0], head[1] + 0.07, head[2]];
  const dir = new THREE.Vector3(top[0] - base[0], top[1] - base[1], top[2] - base[2]).normalize();
  const end: V3 = [top[0] + dir.x * 0.22, top[1] + dir.y * 0.22, top[2] + dir.z * 0.22];
  const { len, q } = segmentFrame(base, end);
  return (
    <group>
      <group position={base} quaternion={q}>
        <mesh geometry={g.stick} material={toy("#4FA3E0", { rough: 0.35, glow: 0.22 })} scale={[1, len, 1]} />
        <mesh geometry={g.clamp} material={toy("#5C6478", { rough: 0.4, metal: 0.3 })} position={[0, 0.02, 0]} />
      </group>
      <mesh geometry={g.head} material={vertexMat(0.35, false, 0.2)} position={[head[0], head[1], head[2]]} />
    </group>
  );
};

// =======================================================================================
// The set

const hallGeos = once(() => {
  const { x0, x1, zBack, height: H } = HALL;
  const s = new THREE.Shape();
  s.moveTo(x0, 0);
  s.lineTo(x1, 0);
  s.lineTo(x1, H);
  s.lineTo(x0, H);
  s.closePath();
  for (const x of HALL_WINDOWS) {
    const p = new THREE.Path();
    p.moveTo(x - HALL_WIN.w / 2, HALL_WIN.y0);
    p.lineTo(x - HALL_WIN.w / 2, HALL_WIN.y1);
    p.lineTo(x + HALL_WIN.w / 2, HALL_WIN.y1);
    p.lineTo(x + HALL_WIN.w / 2, HALL_WIN.y0);
    p.closePath();
    s.holes.push(p);
  }
  const back = new THREE.ShapeGeometry(s);
  back.translate(0, 0, zBack);
  const frames: THREE.BufferGeometry[] = [];
  const FR = "#3A4570";
  const cy = (HALL_WIN.y0 + HALL_WIN.y1) / 2;
  const h = HALL_WIN.y1 - HALL_WIN.y0;
  for (const x of HALL_WINDOWS) {
    frames.push(place(rbox(HALL_WIN.w + 0.22, 0.14, 0.3, 0.04), FR, [x, HALL_WIN.y0 - 0.02, zBack]));
    frames.push(place(rbox(HALL_WIN.w + 0.22, 0.14, 0.3, 0.04), FR, [x, HALL_WIN.y1 + 0.02, zBack]));
    frames.push(place(rbox(0.14, h, 0.3, 0.04), FR, [x - HALL_WIN.w / 2 - 0.04, cy, zBack]));
    frames.push(place(rbox(0.14, h, 0.3, 0.04), FR, [x + HALL_WIN.w / 2 + 0.04, cy, zBack]));
    frames.push(place(rbox(0.08, h, 0.12, 0.03), FR, [x, cy, zBack]));
    for (const y of [2.3, 4.4]) frames.push(place(rbox(HALL_WIN.w, 0.08, 0.12, 0.03), FR, [x, y, zBack]));
    frames.push(place(rbox(HALL_WIN.w + 0.42, 0.08, 0.34, 0.03), "#5A6690", [x, HALL_WIN.y0 - 0.08, zBack + 0.13]));
  }
  // Baseboard with TIMECO's red stripe, and a soft cornice.
  frames.push(place(rbox(x1 - x0, 0.2, 0.08, 0.02), "#20263A", [0, 0.1, zBack + 0.04]));
  frames.push(place(rbox(x1 - x0, 0.09, 0.06, 0.02), TIMECO_RED, [0, 0.42, zBack + 0.03]));
  frames.push(place(rbox(x1 - x0, 0.22, 0.2, 0.05), "#2E3656", [0, H - 0.11, zBack + 0.1]));
  const ceiling = new THREE.PlaneGeometry(x1 - x0 + 6, 24);
  ceiling.rotateX(Math.PI / 2);
  ceiling.translate(0, H, zBack + 12);
  const side = (sgn: number) => {
    const g = new THREE.PlaneGeometry(24, H);
    g.rotateY((-sgn * Math.PI) / 2);
    g.translate(sgn > 0 ? x1 : x0, H / 2, zBack + 12);
    return g;
  };
  const floor = worldPlane(FLOOR.w, FLOOR.d);
  floor.rotateX(-Math.PI / 2);
  floor.translate(0, 0, FLOOR.zc);
  return {
    back,
    frames: mergeAll(frames),
    ceiling,
    wallL: side(-1),
    wallR: side(1),
    floor,
    glass: new THREE.PlaneGeometry(HALL_WIN.w, h),
    view: new THREE.PlaneGeometry(VIEW.w, VIEW.h),
    plane: new THREE.PlaneGeometry(1, 1),
    neon: new THREE.PlaneGeometry(2.5, 0.73),
    neonBox: rbox(2.7, 0.9, 0.08, 0.06),
  };
});

/** The walls, the windows and the night city, the vending machine, the neon, sign and bucket (no floor). */
export const HallSet: React.FC<{ t?: number }> = ({ t = 0 }) => {
  const ready = useFontsReady();
  const geos = hallGeos();
  const m = hallMats();
  const { zBack } = HALL;
  const wallMat = toy("#3D4870", { rough: 0.8, glow: 0.12 });
  const cy = (HALL_WIN.y0 + HALL_WIN.y1) / 2;
  const buzz = 0.9 + 0.1 * Math.sin(t * 13.7) * Math.sin(t * 3.1);
  return (
    <group>
      <mesh geometry={geos.ceiling} material={toy("#242B47", { rough: 0.9 })} />
      <mesh geometry={geos.back} material={wallMat} />
      <mesh geometry={geos.wallL} material={wallMat} />
      <mesh geometry={geos.wallR} material={wallMat} />
      <mesh geometry={geos.frames} material={vertexMat(0.5, false, 0.14)} />
      <mesh geometry={geos.view} material={texMat("senora-night", nightTex, { basic: true })} position={[0, VIEW.y, zBack - VIEW.back]} />
      {HALL_WINDOWS.map((x) => (
        <mesh key={x} geometry={geos.glass} material={m.glass} position={[x, cy, zBack + 0.02]} />
      ))}
      {/* TIMECO's red neon over the vending machine. */}
      <group position={HALL_LOGO}>
        <mesh geometry={geos.neonBox} material={toy("#1B1B24", { rough: 0.5 })} position={[0, 0, -0.02]} />
        {ready ? <mesh geometry={geos.neon} material={texMat("senora-neon", neonTex, { basic: true, transparent: true })} position={[0, 0, 0.04]} /> : null}
      </group>
      <Glow color="#FF3030" size={3.6} opacity={0.26 * buzz} position={[HALL_LOGO[0], HALL_LOGO[1], HALL_LOGO[2] + 0.3]} />
      <group position={HALL_VENDING}>
        <VendingMachine t={t} />
      </group>
      <group position={HALL_SIGN} rotation={[0, 0.18, 0]}>
        <WetFloorSign />
      </group>
      <group position={HALL_BUCKET} rotation={[0, -0.35, 0]}>
        <MopBucket t={t} />
      </group>
    </group>
  );
};

/**
 * The night hallway (no lights: add <HallLights>): the set and its wet floor. Render the actors
 * again inside <HallReflection> so they reflect in the floor too.
 */
export const Hallway: React.FC<{ t?: number }> = ({ t = 0 }) => {
  const geos = hallGeos();
  const m = hallMats();
  const { zBack } = HALL;
  const vend = HALL_VENDING;
  return (
    <group>
      <mesh geometry={geos.floor} material={m.floor} renderOrder={-1} />
      {HALL_WINDOWS.map((x) => (
        // Moonlight through each window onto the wet floor.
        <mesh key={x} geometry={geos.plane} material={m.shaft} position={[x + 0.55, 0.012, zBack + 2.7]} rotation={[-Math.PI / 2, 0, -0.16]} scale={[HALL_WIN.w * 0.95, 4.8, 1]} />
      ))}
      <mesh geometry={geos.plane} material={m.vend} position={[vend[0] - 0.17, 0.014, vend[2] + 1.7]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.2, 2.6, 1]} />
      <mesh geometry={geos.plane} material={m.neon} position={[HALL_LOGO[0], 0.016, zBack + 1.4]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.4, 2.2, 1]} />
      <HallSet t={t} />
    </group>
  );
};

/** The mirror image of the set and of `children` (the actors) under the see-through wet floor. */
export const HallReflection: React.FC<{ t?: number; children?: React.ReactNode }> = ({ t = 0, children }) => (
  <group scale={[1, -1, 1]}>
    <HallSet t={t} />
    {children}
  </group>
);

/** Night lights: blue sky fill, moonlight from the windows (rim), a soft lilac front key, the vending glow. */
export const HallLights: React.FC<{ k?: number }> = ({ k = 1 }) => (
  <>
    <hemisphereLight args={["#B4BEFF", "#2E3358", 1.45 * k]} />
    <directionalLight position={[-2, 7, -9]} intensity={1.8} color="#A6BCFF" />
    <directionalLight position={[3, 5, 10]} intensity={1.55 * k} color="#EEE6FF" />
    <pointLight position={[HALL_VENDING[0] - 0.2, 1.5, HALL_VENDING[2] + 1.3]} intensity={6} distance={7} decay={1.3} color="#8DF2FF" />
  </>
);

// =======================================================================================
// The old cleaning lady

export const LADY_SIZE = 1.7;
export const LADY_LAVENDER = "#B9A3E3";
export const LADY_PALETTE: NubiPalette = { body: LADY_LAVENDER, legs: "#A890D6" };

/** Nubi-shaped body (model units): 10 × 7.4 × 8.8, bottom 2.5, top 9.9, face at z 4.4, eyes at (±2.3, 5.5). */
const NB = { a: 5, b: 4.4, r: 0.6, front: 4.4 };

/** A band hugging the body between y0 and y1, `grow` thicker than the body. */
const bandGeo = (y0: number, y1: number, grow: number) => {
  const outer = roundedRectShape(2 * (NB.a + grow), 2 * (NB.b + grow), NB.r + grow);
  outer.holes.push(roundedRectShape(2 * (NB.a - 0.4), 2 * (NB.b - 0.4), NB.r));
  const g = new THREE.ExtrudeGeometry(outer, { depth: y1 - y0, bevelEnabled: false, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y0, 0);
  return g;
};

/** Where an eye is drawn for this pose (model units), as in Nubi.tsx. */
const eyeShape = (pose: NubiPose) => {
  const eyeScale = pose.eyeScale ?? 1;
  const eyeH = Math.max(0.1, (1 - (pose.blink ?? 0)) * eyeScale);
  return { ex: (pose.lookX ?? 0) * 0.5, ey: 5.5 + (pose.lookY ?? 0) * 0.4, eh: 1.75 * eyeH };
};

/** Top of the lady's bun above her feet (model units → × size / 10). */
export const LADY_BUN_TOP = 14.0;

const ladyGeos = once(() => ({
  cap: rbox(10.3, 1.5, 9.1, 0.72, 3),
  curl: new THREE.SphereGeometry(1, 16, 12),
  bun: new THREE.SphereGeometry(2.15, 24, 18),
  bunBand: new THREE.TorusGeometry(1.62, 0.34, 10, 28),
  pin: new THREE.CylinderGeometry(0.13, 0.13, 5.2, 8),
  pearl: new THREE.SphereGeometry(0.38, 12, 10),
  ring: new THREE.TorusGeometry(1.22, 0.15, 8, 28),
  bridge: new THREE.CylinderGeometry(0.11, 0.11, 1.1, 8).rotateZ(Math.PI / 2),
  arm: rbox(1.0, 0.2, 0.2, 0.07),
  lens: new THREE.CircleGeometry(1.1, 24),
  cheek: new THREE.CircleGeometry(1, 20),
  bib: rbox(6.4, 2.6, 0.24, 0.3),
  pocket: rbox(3.0, 1.0, 0.14, 0.12),
  rag: rbox(0.9, 0.8, 0.3, 0.2),
  strap: rbox(0.5, 5.6, 0.16, 0.08),
  waist: bandGeo(3.0, 3.45, 0.12),
  bow: new THREE.TorusGeometry(0.5, 0.18, 8, 16),
}));

const ladyMats = once(() => ({
  hair: toy("#DCDCE8", { rough: 0.75, glow: 0.2 }),
  hairShade: toy("#C6C6D6", { rough: 0.75, glow: 0.18 }),
  band: toy("#8E6CD0", { rough: 0.5, glow: 0.2 }),
  pin: toy("#6B4A2E", { rough: 0.5 }),
  pearl: toy("#FFF6F0", { rough: 0.25, glow: 0.35 }),
  frame: toy("#5E3F7A", { rough: 0.35, glow: 0.14 }),
  cheek: new THREE.MeshBasicMaterial({ color: "#FF8FB0", transparent: true, opacity: 0.55, depthWrite: false }),
  apron: toy("#FFF0A6", { rough: 0.7, glow: 0.22 }),
  apronDark: toy("#F2D97A", { rough: 0.7, glow: 0.2 }),
  rag: toy("#58B7F0", { rough: 0.8 }),
}));

/**
 * The lady's look (child of her <Nubi>, model units): a soft grey hair cap with curls on the
 * forehead, a big bun with a band and a pearl pin, round glasses that follow the eyes (`glint`
 * 0..1 flashes the lenses), rosy cheeks, a pale-yellow apron (bib, pocket with a rag, straps,
 * waist ties) and sad lids (`sad` 0..1).
 */
export const LadyOutfit: React.FC<{ pose: NubiPose; sad?: number; glint?: number }> = ({ pose, sad = 0.5, glint = 0 }) => {
  const g = ladyGeos();
  const mt = ladyMats();
  const { ex, ey } = eyeShape(pose);
  const lensMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.12, depthWrite: false }), []);
  lensMat.opacity = 0.08 + 0.45 * glint;
  const F = NB.front;
  return (
    <group>
      {/* Hair: a grey cap over the top with curls on the forehead, the bun, its band and pin. */}
      <mesh geometry={g.cap} material={mt.hair} position={[0, 10.15, -0.05]} />
      {[-3.6, -1.2, 1.2, 3.6].map((x, i) => (
        <mesh key={x} geometry={g.curl} material={i % 2 ? mt.hairShade : mt.hair} position={[x, 9.55, F + 0.18]} scale={[1.42, 0.8, 0.42]} />
      ))}
      <mesh geometry={g.bun} material={mt.hair} position={[0, 12.15, -0.6]} scale={[1, 0.86, 1]} />
      <mesh geometry={g.bunBand} material={mt.band} position={[0, 10.95, -0.6]} rotation={[Math.PI / 2, 0, 0]} />
      <group position={[0, 12.3, -0.6]} rotation={[0.25, 0, 1.05]}>
        <mesh geometry={g.pin} material={mt.pin} />
        <mesh geometry={g.pearl} material={mt.pearl} position={[0, 2.6, 0]} />
      </group>
      {/* Round glasses. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={g.ring} material={mt.frame} position={[s * 2.3 + ex, ey + 0.05, F + 0.55]} scale={[0.92, 1.05, 1]} />
          <mesh geometry={g.lens} material={lensMat} position={[s * 2.3 + ex, ey + 0.05, F + 0.56]} scale={[0.92, 1.05, 1]} />
          <mesh geometry={g.arm} material={mt.frame} position={[s * (4.05 + ex * s * 0.4), ey + 0.25, F + 0.45]} />
          <mesh geometry={g.cheek} material={mt.cheek} position={[s * 3.55, 4.05, F + 0.04]} scale={[0.85, 0.5, 1]} />
        </group>
      ))}
      <mesh geometry={g.bridge} material={mt.frame} position={[ex, ey + 0.3, F + 0.55]} />
      {/* Apron. */}
      <mesh geometry={g.bib} material={mt.apron} position={[0, 2.95, F + 0.12]} />
      <mesh geometry={g.pocket} material={mt.apronDark} position={[0, 2.45, F + 0.3]} />
      <mesh geometry={g.rag} material={mt.rag} position={[0.85, 3.05, F + 0.25]} rotation={[0, 0, 0.25]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={g.strap} material={mt.apron} position={[s * 3.9, 7.0, F + 0.08]} />
      ))}
      <mesh geometry={g.waist} material={mt.apron} />
      <mesh geometry={g.bow} material={mt.apron} position={[0.6, 3.25, -4.75]} scale={[1, 0.7, 0.6]} />
      <mesh geometry={g.bow} material={mt.apron} position={[-0.6, 3.25, -4.75]} scale={[1, 0.7, 0.6]} />
      <Lids pose={pose} droop={0.2 + 0.3 * sad} tilt={0.16 + 0.22 * sad} color={shadeHex(LADY_LAVENDER, -0.08)} />
    </group>
  );
};

/** The old cleaning lady: a lavender Nubi (size 1.7), a bit hunched (add pitch in the pose). */
export const Lady: React.FC<{
  pose?: NubiPose;
  position?: V3;
  rotationY?: number;
  sad?: number;
  glint?: number;
  shadowOpacity?: number;
}> = ({ pose = {}, position, rotationY, sad, glint, shadowOpacity = 0.4 }) => (
  <Nubi size={LADY_SIZE} palette={LADY_PALETTE} pose={pose} position={position} rotationY={rotationY} shadowOpacity={shadowOpacity}>
    <LadyOutfit pose={pose} sad={sad} glint={glint} />
  </Nubi>
);

// =======================================================================================
// FX: splashes, the stream of life, hearts

const fxMats = once(() => ({
  drop: toy("#CFEBFF", { rough: 0.1, glow: 0.55 }),
  heartPink: toy("#FF5C8A", { rough: 0.35, glow: 0.42 }),
  heartRed: toy("#FF3B5C", { rough: 0.35, glow: 0.42 }),
  dropGeo: new THREE.SphereGeometry(1, 10, 8),
}));

/**
 * Water flicked off the mop: `count` droplets launched from `origin` in a loop (`rate` launches
 * per frame of each droplet's cycle), arcing out and falling back; `amount` 0..1 thins them out.
 */
export const Splashes: React.FC<{ g: number; origin: V3; amount: number; count?: number; size?: number; reach?: number }> = ({
  g,
  origin,
  amount,
  count = 14,
  size = 0.055,
  reach = 0.9,
}) => {
  const m = fxMats();
  if (amount <= 0.02) return null;
  return (
    <group position={origin}>
      {Array.from({ length: count }).map((_, i) => {
        const life = 13 + 6 * hash(i + 3);
        const k = frac(g / life + hash(i));
        if (hash(i * 7 + Math.floor(g / life + hash(i))) > amount) return null;
        const a = hash(i * 3 + Math.floor(g / life + hash(i)) * 1.7) * Math.PI * 2;
        const v = reach * (0.45 + 0.55 * hash(i + 11));
        const up = 1.1 + 0.9 * hash(i + 5);
        const y = up * k - 1.6 * k * k;
        if (y < -0.02) return null;
        const s = size * (0.6 + 0.6 * hash(i + 2)) * (1 - 0.5 * k);
        return <mesh key={i} geometry={m.dropGeo} material={m.drop} position={[Math.cos(a) * v * k, y + 0.04, Math.sin(a) * v * k * 0.7]} scale={[s, s * 1.25, s]} />;
      })}
    </group>
  );
};

/**
 * A stream of glowing green motes flowing from `from` to `to` along an arc (`lift` up), each one
 * spiralling a little, with bright cores and sparkles. `amount` 0..1 fades it; `t` = seconds.
 */
export const LifeStream: React.FC<{ from: V3; to: V3; t: number; amount: number; count?: number; lift?: number; width?: number; color?: string }> = ({
  from,
  to,
  t,
  amount,
  count = 46,
  lift = 0.7,
  width = 0.16,
  color = "#55FF8C",
}) => {
  const glow = useMemo(() => additive(new THREE.SpriteMaterial({ map: glowTexture(), color, toneMapped: false })), [color]);
  const core = useMemo(() => additive(new THREE.SpriteMaterial({ map: glowTexture(), color: "#F2FFF5", toneMapped: false })), []);
  const gold = useMemo(() => additive(new THREE.SpriteMaterial({ map: glowTexture(), color: "#FFE58A", toneMapped: false })), []);
  if (amount <= 0.01) return null;
  glow.opacity = Math.min(1, amount);
  core.opacity = Math.min(1, amount);
  gold.opacity = Math.min(1, amount) * 0.9;
  const c: V3 = [(from[0] + to[0]) / 2, Math.max(from[1], to[1]) + lift, (from[2] + to[2]) / 2 + 0.25];
  const at = (u: number): V3 => {
    const a = (1 - u) * (1 - u);
    const b = 2 * u * (1 - u);
    const d = u * u;
    return [a * from[0] + b * c[0] + d * to[0], a * from[1] + b * c[1] + d * to[1], a * from[2] + b * c[2] + d * to[2]];
  };
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => {
        const u = frac(t * 0.9 + i / count + hash(i) * 0.05);
        // Only the part of the arc the stream has reached (it grows out of Nubi as it fades in).
        if (u > Math.min(1, amount * 1.6)) return null;
        const p = at(u);
        const env = Math.sin(Math.PI * Math.min(1, u * 1.05));
        const w = width * (0.4 + env);
        const ph = t * 7 + i * 2.4;
        const s = (0.2 + 0.16 * hash(i + 7)) * (0.5 + 0.5 * env) * (0.85 + 0.15 * Math.sin(t * 11 + i));
        const pos: V3 = [p[0] + w * Math.cos(ph) * 0.8, p[1] + w * Math.sin(ph), p[2] + w * Math.sin(ph * 0.7 + i)];
        const mat = i % 5 === 0 ? gold : glow;
        return (
          <group key={i}>
            <sprite material={mat} position={pos} scale={[s * 2.1, s * 2.1, 1]} renderOrder={6} />
            {i % 2 === 0 ? <sprite material={core} position={pos} scale={[s * 0.75, s * 0.75, 1]} renderOrder={7} /> : null}
          </group>
        );
      })}
    </group>
  );
};

const heartGeo = once(() => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.15, -0.35, -0.55, -0.1, -0.55, 0.18);
  s.bezierCurveTo(-0.55, 0.45, -0.25, 0.58, 0, 0.32);
  s.bezierCurveTo(0.25, 0.58, 0.55, 0.45, 0.55, 0.18);
  s.bezierCurveTo(0.55, -0.1, 0.15, -0.35, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.07, bevelSegments: 2, curveSegments: 12 });
  g.translate(0, 0, -0.09);
  return g;
});

/** Little hearts popping out of `position` from frame `at` and floating up, swaying (g = global frame). */
export const Hearts: React.FC<{ g: number; at: number; position: V3; count?: number; spread?: number; size?: number; rise?: number; every?: number }> = ({
  g,
  at,
  position,
  count = 10,
  spread = 1.3,
  size = 0.34,
  rise = 2.2,
  every = 2.6,
}) => {
  const d = g - at;
  if (d < 0) return null;
  const m = fxMats();
  return (
    <group position={position}>
      {Array.from({ length: count }).map((_, i) => {
        const local = d - i * every;
        if (local < 0 || local > 46) return null;
        const k = local / 46;
        const popK = Math.min(1, local / 5);
        const over = 1 + 0.35 * Math.sin(Math.min(1, local / 8) * Math.PI);
        const s = size * (0.7 + 0.55 * hash(i + 3)) * popK * over * (1 - smooth(0.78, 1, k));
        const x = (hash(i) - 0.5) * spread * (0.5 + k) + 0.14 * Math.sin(local * 0.22 + i);
        return (
          <mesh
            key={i}
            geometry={heartGeo()}
            material={i % 3 === 1 ? m.heartRed : m.heartPink}
            position={[x, rise * (1 - (1 - k) * (1 - k)) + 0.1 * hash(i + 4), 0.25 + (hash(i + 9) - 0.3) * 0.5]}
            rotation={[0, 0.4 * Math.sin(local * 0.15 + i), 0.3 * Math.sin(local * 0.2 + i)]}
            scale={s}
          />
        );
      })}
    </group>
  );
};

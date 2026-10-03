import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FONT } from "../../theme";
import { CIVILIAN_COLORS } from "../agua/Street";
import { V3, canvasTexture, glowTexture, paintGeo, roundedRectShape, shadeHex, toy, useFontsReady, vertexMat } from "../inca/kit";
import { mulberry } from "../noise";
import { NUBI_FIN_TIP, Nubi, NubiPalette, NubiPose } from "../Nubi";
import { Glow, additive, segmentFrame } from "../thanos/FX";

// TIMECO's office for the time short ("¿Qué pasaría si el dinero fuera tiempo de vida?"): the huge
// open-plan office (rows of desks with chunky toy monitors, an instanced crowd of typing workers in
// shirts and ties, the giant wall clock with alarm bells, the TIMECO logo, the "EL TIEMPO ES ORO"
// poster, the lit rule "8 H DE TRABAJO = +1 DÍA DE VIDA", the PRODUCTIVIDAD screen, big windows
// whose sky goes from morning to sunset), the same building's night hallway (wet tiles, big
// windows on the night city, the vending machine, the "PISO MOJADO" sign), and the people: the
// exhausted coworker (dusty-blue Nubi with collar, red tie, droopy lids, eye bags, coffee mug) and
// the old cleaning lady (lavender Nubi, hair bun, round glasses, pale-yellow apron, mop, bucket).
//
// World units are sized for Nubi at size 2 (2 wide, ≈ 2 tall, eyes at y ≈ 1.1); floor y = 0; +z
// points towards the default camera. Everything is deterministic and built once (module caches or
// useMemo); `g` is the global frame and `t` time in seconds where a prop animates.
//
// OFFICE (Office + OfficeLights + OfficeCrowd): the back wall is at z = OFFICE.zBack; desk rows at
//   z = 0 (front row: Nubi at OFFICE_NUBI, the coworker at OFFICE_COWORKER), −3.6, −7.2, −10.8,
//   columns x = ±1.5, ±4.5, ±7.5. Workers stand behind their desks (−z side) facing +z; each
//   monitor sits on an outer front corner turned to its worker. Back wall: windows at |x| > 4.8,
//   the clock (OFFICE_CLOCK), the logo above it, the rule lightbox below it (OFFICE_RULE), the
//   poster on the left and the PRODUCTIVIDAD screen on the right (OFFICE_PROD).
// HALL (Hallway + HallLights): back wall with three tall windows at z = HALL.zBack, the vending
//   machine on the right (HALL_VENDING), the wet-floor sign (HALL_SIGN), the bucket (HALL_BUCKET).

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
const frac = (x: number) => x - Math.floor(x);
/** Lazily built value shared by every instance (static geometry). */
const once = <T,>(make: () => T) => {
  let v: T | undefined;
  return () => (v ??= make());
};
const rbox = (w: number, h: number, d: number, r: number, seg = 2) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));
/** Blends two hex colours (k = 0 → a). */
export const mixHex = (a: string, b: string, k: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), clamp01(k)).getHexString()}`;

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
// Brand, fonts, canvas helpers

export const TIMECO_DARK = "#1B1B24";
export const TIMECO_RED = "#FF3B3B";
export const TIMECO_GOLD = "#FFC83D";
const HEAVY = `'${FONT.heavy}', sans-serif`;
const TITLE = `'${FONT.title}', '${FONT.fun}', sans-serif`;

type Ctx = CanvasRenderingContext2D;

const label = (
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  o: { font?: string; weight?: number; stroke?: string; lw?: number; glow?: string; blur?: number; maxW?: number; align?: CanvasTextAlign } = {},
) => {
  ctx.save();
  const font = o.font ?? HEAVY;
  const weight = o.weight ?? 900;
  ctx.font = `${weight} ${size}px ${font}`;
  if (o.maxW) {
    const w = ctx.measureText(s).width;
    if (w > o.maxW) ctx.font = `${weight} ${(size * o.maxW) / w}px ${font}`;
  }
  ctx.textAlign = o.align ?? "center";
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
const texMat = (
  key: string,
  tex: () => THREE.Texture,
  o: { rough?: number; glow?: number; transparent?: boolean; basic?: boolean; side?: THREE.Side; metal?: number } = {},
) => {
  let m = texMats.get(key);
  if (!m) {
    const map = tex();
    m = o.basic
      ? new THREE.MeshBasicMaterial({ map, transparent: o.transparent ?? false, alphaTest: o.transparent ? 0.02 : 0, side: o.side ?? THREE.FrontSide, toneMapped: false })
      : new THREE.MeshStandardMaterial({
          map,
          roughness: o.rough ?? 0.6,
          metalness: o.metal ?? 0,
          emissive: new THREE.Color("#ffffff"),
          emissiveMap: map,
          emissiveIntensity: o.glow ?? 0.18,
          transparent: o.transparent ?? false,
          alphaTest: o.transparent ? 0.02 : 0,
          side: o.side ?? THREE.FrontSide,
        });
    texMats.set(key, m);
  }
  return m;
};

// =======================================================================================
// Textures: office

const carpetTex = () =>
  canvasTexture(
    "tiempo-carpet",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#5F6E88";
      ctx.fillRect(0, 0, W, H);
      const tones = ["#74839E", "#6B7A95", "#71809B", "#68778F"];
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          const x0 = i * 128;
          const y0 = j * 128;
          ctx.fillStyle = tones[(i + j * 2) % 4];
          ctx.fillRect(x0 + 2, y0 + 2, 124, 124);
          ctx.strokeStyle = "rgba(255,255,255,0.06)";
          ctx.lineWidth = 3;
          for (let k = 0; k < 10; k++) {
            ctx.beginPath();
            if ((i + j) % 2) {
              ctx.moveTo(x0 + 8 + k * 12, y0 + 6);
              ctx.lineTo(x0 + 8 + k * 12, y0 + 122);
            } else {
              ctx.moveTo(x0 + 6, y0 + 8 + k * 12);
              ctx.lineTo(x0 + 122, y0 + 8 + k * 12);
            }
            ctx.stroke();
          }
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

/** The view out of the office windows: morning or sunset sky over the city. */
const skyTex = (sunset: boolean) =>
  canvasTexture(`tiempo-sky-${sunset ? "sunset" : "morning"}`, 1024, 512, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    if (sunset) {
      g.addColorStop(0, "#4B3B8E");
      g.addColorStop(0.38, "#C2558A");
      g.addColorStop(0.62, "#FF8A4F");
      g.addColorStop(0.85, "#FFC46B");
      g.addColorStop(1, "#FFE0A0");
    } else {
      g.addColorStop(0, "#5DB5FF");
      g.addColorStop(0.55, "#A8DBFF");
      g.addColorStop(1, "#E6F6FF");
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // The sun.
    const sx = sunset ? W * 0.68 : W * 0.24;
    const sy = sunset ? H * 0.66 : H * 0.2;
    const sr = sunset ? 70 : 42;
    const halo = ctx.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 3.2);
    halo.addColorStop(0, sunset ? "rgba(255,230,160,0.9)" : "rgba(255,255,230,0.9)");
    halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = sunset ? "#FFE9A8" : "#FFFFF0";
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
    // Clouds.
    ctx.fillStyle = sunset ? "rgba(255,170,150,0.55)" : "rgba(255,255,255,0.85)";
    for (const [cx, cy, s] of [
      [180, 120, 1],
      [520, 80, 0.8],
      [820, 150, 1.2],
    ]) {
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(cx + (k - 1.5) * 34 * s, cy + (k % 2) * 8, 40 * s, 22 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Two layers of skyline (the same city in both skies).
    const layers: [string, string, number, number, number][] = sunset
      ? [
          ["#B5627E", "#FFD27A", 120, 300, 21],
          ["#5A2C5E", "#FFC75A", 60, 190, 37],
        ]
      : [
          ["#A9C6E6", "#EAF6FF", 120, 300, 21],
          ["#7C98BE", "#DDEFFF", 60, 190, 37],
        ];
    for (const [col, win, hMin, hMax, seed] of layers) {
      const rnd = mulberry(seed);
      let x = -20;
      while (x < W) {
        const bw = 40 + rnd() * 70;
        const bh = hMin + rnd() * (hMax - hMin);
        ctx.fillStyle = col;
        ctx.fillRect(x, H - bh, bw, bh);
        ctx.fillStyle = win;
        ctx.globalAlpha = 0.5;
        for (let yy = H - bh + 12; yy < H - 8; yy += 18) {
          for (let xx = x + 6; xx < x + bw - 8; xx += 14) if (rnd() < 0.45) ctx.fillRect(xx, yy, 6, 9);
        }
        ctx.globalAlpha = 1;
        x += bw + 4 + rnd() * 10;
      }
    }
  });

const clockFaceTex = () =>
  canvasTexture("tiempo-clock-face", 1024, 1024, (ctx, W) => {
    const c = W / 2;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#E3E8F2";
    ctx.lineWidth = 34;
    ctx.beginPath();
    ctx.arc(c, c, c - 20, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const big = i % 5 === 0;
      const r0 = c * 0.9;
      const r1 = c * (big ? 0.76 : 0.84);
      ctx.strokeStyle = big ? TIMECO_DARK : "#8E97AA";
      ctx.lineWidth = big ? 18 : 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(c + Math.sin(a) * r0, c - Math.cos(a) * r0);
      ctx.lineTo(c + Math.sin(a) * r1, c - Math.cos(a) * r1);
      ctx.stroke();
    }
    for (let h = 1; h <= 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      const r = c * 0.6;
      label(ctx, String(h), c + Math.sin(a) * r, c - Math.cos(a) * r + 6, h % 3 === 0 ? 130 : 96, h === 12 ? TIMECO_RED : TIMECO_DARK);
    }
    drawLogo(ctx, c, c - c * 0.3, c * 0.12);
    label(ctx, "TIMECO", c, c + c * 0.3, 54, TIMECO_DARK);
  });

const ruleTex = (lit: boolean) =>
  canvasTexture(`tiempo-rule-${lit ? "on" : "off"}`, 1024, 256, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    if (!lit) rrect(ctx, 0, 0, W, H, 36, "#232838");
    const a = lit ? "#FFFFFF" : "#4B5369";
    const b = lit ? "#5BFF8A" : "#4B5369";
    label(ctx, "8 H DE TRABAJO =", W / 2, H * 0.3, 96, a, { glow: lit ? "#B8FFD0" : undefined, blur: 16, maxW: W * 0.9 });
    label(ctx, "+1 DÍA DE VIDA", W / 2, H * 0.72, 104, b, { glow: lit ? "#3CFF7A" : undefined, blur: 24, maxW: W * 0.9 });
  });

const prodTex = (state: 0 | 1) =>
  canvasTexture(`tiempo-prod-${state}`, 512, 320, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#131B36");
    g.addColorStop(1, "#1E2950");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    label(ctx, "PRODUCTIVIDAD", W / 2, 46, 46, "#FFFFFF", { maxW: W * 0.88 });
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(30, 80, W - 60, 3);
    if (state === 0) {
      const rnd = mulberry(5);
      for (let i = 0; i < 9; i++) {
        const bh = 40 + rnd() * 120;
        ctx.fillStyle = i % 2 ? "#4F8BFF" : "#7FB0FF";
        ctx.fillRect(48 + i * 47, H - 34 - bh, 32, bh);
      }
    } else {
      label(ctx, "2%", W / 2 - 30, 196, 180, TIMECO_RED, { glow: "#FF5A5A", blur: 22 });
      ctx.fillStyle = TIMECO_RED;
      ctx.beginPath();
      ctx.moveTo(W - 112, 150);
      ctx.lineTo(W - 62, 150);
      ctx.lineTo(W - 62, 205);
      ctx.lineTo(W - 40, 205);
      ctx.lineTo(W - 87, 262);
      ctx.lineTo(W - 134, 205);
      ctx.lineTo(W - 112, 205);
      ctx.closePath();
      ctx.fill();
    }
  });

const posterTex = () =>
  canvasTexture("tiempo-poster", 512, 680, (ctx, W, H) => {
    ctx.fillStyle = TIMECO_DARK;
    ctx.fillRect(0, 0, W, H);
    rrect(ctx, 18, 18, W - 36, H - 36, 18, undefined, TIMECO_GOLD, 12);
    label(ctx, "EL TIEMPO", W / 2, 118, 96, TIMECO_GOLD, { font: TITLE, weight: 400, maxW: W * 0.84 });
    drawLogo(ctx, W / 2, H / 2 + 4, 140, { glass: "#2C2C3A", frame: TIMECO_GOLD });
    label(ctx, "ES ORO", W / 2, H - 150, 116, TIMECO_GOLD, { font: TITLE, weight: 400, maxW: W * 0.84 });
    label(ctx, "TIMECO", W / 2, H - 62, 40, TIMECO_RED);
  });

/** "TIMECO" wordmark with the logo (transparent background); `neon` glows red for the night. */
const wordmarkTex = (neon: boolean) =>
  canvasTexture(`tiempo-wordmark-${neon ? "neon" : "flat"}`, 1024, 300, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    drawLogo(ctx, 150, H / 2, 128, neon ? { ring: "#FF5050", glow: "#FF2A2A", frame: "#FFD6D6", glass: "#3A1F2A" } : {});
    label(ctx, "TIMECO", 625, H / 2 + 10, 196, neon ? "#FFE6E6" : TIMECO_DARK, { glow: neon ? "#FF2A2A" : undefined, blur: 34, maxW: 720 });
  });

const screenTex = () =>
  canvasTexture("tiempo-screen", 256, 176, (ctx, W, H) => {
    ctx.fillStyle = "#1D3C82";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = TIMECO_RED;
    ctx.fillRect(0, 0, W, 26);
    const rnd = mulberry(9);
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 ? "#E8F0FF" : "#B9CCFF";
      ctx.fillRect(16, 40 + i * 18, 60 + rnd() * 160, 9);
    }
  });

const backLogoTex = () =>
  canvasTexture("tiempo-back-logo", 128, 128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);
    drawLogo(ctx, 64, 64, 54, { ring: "#FF6262", glass: "#39404F", frame: "#FFD0D0", glow: "#FF3B3B" });
  });

const enviarTex = () =>
  canvasTexture("tiempo-enviar", 512, 160, (ctx, W, H) => {
    rrect(ctx, 6, 6, W - 12, H - 12, 34, "#FFFFFF", TIMECO_DARK, 10);
    label(ctx, "ENVIAR", W / 2, H / 2 + 5, 110, TIMECO_RED, { maxW: W * 0.84 });
  });

const listoTex = () =>
  canvasTexture("tiempo-listo", 256, 128, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.12);
    rrect(ctx, -112, -48, 224, 96, 14, undefined, "#E8262E", 11);
    label(ctx, "LISTO", 0, 5, 70, "#E8262E");
    ctx.restore();
  });

const paperTex = () =>
  canvasTexture("tiempo-paper", 128, 160, (ctx, W, H) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#B8C2D6";
    for (let i = 0; i < 7; i++) ctx.fillRect(14, 18 + i * 18, i === 0 ? 70 : 100 - (i % 3) * 14, 5);
  });

const mugTex = () =>
  canvasTexture("tiempo-mug", 256, 128, (ctx, W, H) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    drawLogo(ctx, W * 0.25, H / 2, 40);
    drawLogo(ctx, W * 0.75, H / 2, 40);
  });

// =======================================================================================
// Textures: hallway

const hallTileTex = () =>
  canvasTexture(
    "tiempo-hall-tiles",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#4A5373";
      ctx.fillRect(0, 0, W, H);
      const tones = ["#9AA6C6", "#8E9BBD", "#A1ADCB", "#93A0C1"];
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          const g = ctx.createLinearGradient(i * 128, j * 128, i * 128 + 128, j * 128 + 128);
          g.addColorStop(0, tones[(i + j * 2) % 4]);
          g.addColorStop(1, shadeHex(tones[(i + j * 2) % 4], -0.04));
          ctx.fillStyle = g;
          ctx.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

const nightTex = () =>
  canvasTexture("tiempo-night", 1024, 512, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#081233");
    g.addColorStop(0.6, "#172A66");
    g.addColorStop(1, "#2D3F86");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const rnd = mulberry(77);
    ctx.fillStyle = "#FFFFFF";
    for (let i = 0; i < 90; i++) {
      ctx.globalAlpha = 0.4 + rnd() * 0.6;
      const s = rnd() < 0.15 ? 3 : 2;
      ctx.fillRect(rnd() * W, rnd() * H * 0.55, s, s);
    }
    ctx.globalAlpha = 1;
    // The moon.
    const mx = W * 0.3;
    const my = H * 0.2;
    const halo = ctx.createRadialGradient(mx, my, 20, mx, my, 150);
    halo.addColorStop(0, "rgba(220,230,255,0.6)");
    halo.addColorStop(1, "rgba(220,230,255,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#F4F1DD";
    ctx.beginPath();
    ctx.arc(mx, my, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(200,196,170,0.6)";
    ctx.beginPath();
    ctx.arc(mx - 12, my - 8, 9, 0, Math.PI * 2);
    ctx.arc(mx + 14, my + 12, 6, 0, Math.PI * 2);
    ctx.fill();
    // Skyline with lit windows; TIMECO's tower with its red ring.
    for (const [col, hMin, hMax, seed, lit] of [
      ["#1B2A5E", 140, 320, 5, 0.25],
      ["#0F1838", 70, 200, 9, 0.35],
    ] as [string, number, number, number, number][]) {
      const r = mulberry(seed);
      let x = -10;
      while (x < W) {
        const bw = 40 + r() * 80;
        const bh = hMin + r() * (hMax - hMin);
        ctx.fillStyle = col;
        ctx.fillRect(x, H - bh, bw, bh);
        for (let yy = H - bh + 10; yy < H - 6; yy += 16) {
          for (let xx = x + 6; xx < x + bw - 6; xx += 12) {
            if (r() < lit) {
              ctx.fillStyle = r() < 0.7 ? "#FFD36B" : "#8FE3FF";
              ctx.fillRect(xx, yy, 5, 8);
            }
          }
        }
        x += bw + 3 + r() * 8;
      }
    }
    const tx = W * 0.74;
    ctx.fillStyle = "#121C44";
    ctx.fillRect(tx - 34, 60, 68, H - 60);
    ctx.beginPath();
    ctx.moveTo(tx - 34, 60);
    ctx.lineTo(tx, 18);
    ctx.lineTo(tx + 34, 60);
    ctx.fill();
    drawLogo(ctx, tx, 104, 30, { ring: "#FF4040", glow: "#FF2020", glass: "#3A2030", frame: "#FFB0B0" });
  });

const vendingTex = () =>
  canvasTexture("tiempo-vending", 512, 768, (ctx, W, H) => {
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

const wetSignTex = () =>
  canvasTexture("tiempo-wet-sign", 256, 400, (ctx, W, H) => {
    ctx.fillStyle = "#FFD21F";
    ctx.fillRect(0, 0, W, H);
    // Warning triangle with a slipping figure.
    ctx.fillStyle = TIMECO_DARK;
    ctx.beginPath();
    ctx.moveTo(W / 2, 30);
    ctx.lineTo(W - 28, 210);
    ctx.lineTo(28, 210);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#FFD21F";
    ctx.beginPath();
    ctx.moveTo(W / 2, 62);
    ctx.lineTo(W - 52, 192);
    ctx.lineTo(52, 192);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = TIMECO_DARK;
    ctx.fillStyle = TIMECO_DARK;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(W / 2 + 18, 104, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W / 2 + 10, 120);
    ctx.lineTo(W / 2 - 14, 152);
    ctx.moveTo(W / 2 - 14, 152);
    ctx.lineTo(W / 2 + 22, 170);
    ctx.moveTo(W / 2 - 14, 152);
    ctx.lineTo(W / 2 - 44, 176);
    ctx.moveTo(W / 2 + 4, 130);
    ctx.lineTo(W / 2 + 34, 126);
    ctx.moveTo(W / 2 + 4, 130);
    ctx.lineTo(W / 2 - 26, 118);
    ctx.stroke();
    ctx.fillRect(66, 180, W - 132, 6);
    label(ctx, "PISO", W / 2, 262, 74, TIMECO_DARK);
    label(ctx, "MOJADO", W / 2, 336, 64, TIMECO_DARK, { maxW: W - 30 });
  });

const exitTex = () =>
  canvasTexture("tiempo-exit", 256, 96, (ctx, W, H) => {
    rrect(ctx, 0, 0, W, H, 12, "#16C25A");
    label(ctx, "SALIDA", W / 2 + 22, H / 2 + 3, 50, "#FFFFFF");
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(22, H / 2);
    ctx.lineTo(56, H / 2);
    ctx.moveTo(42, H / 2 - 14);
    ctx.lineTo(56, H / 2);
    ctx.lineTo(42, H / 2 + 14);
    ctx.stroke();
  });

/** Soft vertical fade (bright at v = 1) for light shafts and floor reflections. */
const fadeTex = () =>
  canvasTexture("tiempo-fade", 64, 256, (ctx, W, H) => {
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

// =======================================================================================
// Shared geometry: Nubi-shaped bodies and their clothes (model units: body 10 × 7.4 × 8.8,
// bottom at y 2.5, top 9.9, face at z 4.4, eyes at (±2.3, 5.5), fins pivot at (±4.8, 5.0, 0.3)).

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

/** A flat shape extruded `depth` towards +z, its back at z = 0. */
const flat = (pts: [number, number][], depth: number, bevel = 0.06) => {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) s.lineTo(x, y);
  s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1 });
};

/** Nubi's fin (same shape as in Nubi.tsx), its base at the origin, tip towards +x. */
const finGeometry = () => {
  const len = 2.6;
  const g = new RoundedBoxGeometry(len, 2.7, 3.0, 3, 0.4);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getX(i) + len / 2) / len;
    const k = 1 - 0.62 * t;
    p.setY(i, p.getY(i) * k - 0.2 * t);
    p.setZ(i, p.getZ(i) * (1 - 0.5 * t) + 0.3 * t);
    p.setX(i, p.getX(i) + len / 2);
  }
  g.computeVertexNormals();
  return g;
};

/** Mirror image across x = 0 with the triangle winding fixed (for instanced left fins). */
const mirrorX = (g: THREE.BufferGeometry) => {
  const m = g.clone();
  m.scale(-1, 1, 1);
  const idx = m.index;
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const b = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, b);
    }
    idx.needsUpdate = true;
  }
  return m;
};

const SHIRT = { y0: 2.4, y1: 3.95, grow: 0.17 };
const COLLAR_L: [number, number][] = [
  [-0.15, 4.1],
  [-2.0, 4.2],
  [-0.7, 3.2],
];
const TIE_KNOT: [number, number][] = [
  [-0.5, 4.0],
  [0.5, 4.0],
  [0.32, 3.4],
  [-0.32, 3.4],
];
const TIE_BLADE: [number, number][] = [
  [-0.32, 3.45],
  [0.32, 3.45],
  [0.68, 2.6],
  [0, 2.15],
  [-0.68, 2.6],
];

/** White shirt band with collar wings, and the tie (model units), as separate geometries. */
const shirtGeos = once(() => {
  const front = NB.front + SHIRT.grow;
  const band = bandGeo(SHIRT.y0, SHIRT.y1, SHIRT.grow);
  const collarL = flat(COLLAR_L, 0.12, 0.05);
  collarL.translate(0, 0, front + 0.02);
  const collarR = flat(
    COLLAR_L.map(([x, y]) => [-x, y] as [number, number]),
    0.12,
    0.05,
  );
  collarR.translate(0, 0, front + 0.02);
  const knot = flat(TIE_KNOT, 0.22, 0.08);
  knot.translate(0, 0, front + 0.06);
  const blade = flat(TIE_BLADE, 0.14, 0.06);
  blade.translate(0, 0, front + 0.04);
  return { band, collarL, collarR, knot, blade };
});

/** Shirt + collar + tie, as children of a <Nubi> (model units). */
export const ShirtAndTie: React.FC<{ tie?: string; shirt?: string }> = ({ tie = TIMECO_RED, shirt = "#FFFFFF" }) => {
  const g = shirtGeos();
  const white = toy(shirt, { rough: 0.6, glow: 0.2 });
  const tieMat = toy(tie, { rough: 0.45, glow: 0.18 });
  return (
    <group>
      <mesh geometry={g.band} material={white} castShadow />
      <mesh geometry={g.collarL} material={white} />
      <mesh geometry={g.collarR} material={white} />
      <mesh geometry={g.knot} material={tieMat} />
      <mesh geometry={g.blade} material={tieMat} />
    </group>
  );
};

const lidGeo = once(() => rbox(1, 1, 0.22, 0.1, 2));
const bagGeo = once(() => new THREE.TorusGeometry(0.62, 0.15, 8, 18, Math.PI));

/** Where an eye is drawn for this pose (model units): centre x/y offsets, height and width. */
const eyeShape = (pose: NubiPose) => {
  const eyeScale = pose.eyeScale ?? 1;
  const eyeH = Math.max(0.1, (1 - (pose.blink ?? 0)) * eyeScale);
  const eyeW = Math.min(1.35, Math.max(0.8, eyeScale));
  return { ex: (pose.lookX ?? 0) * 0.5, ey: 5.5 + (pose.lookY ?? 0) * 0.4, eh: 1.75 * eyeH, eyeW, blink: pose.blink ?? 0 };
};

/**
 * Eyelids over the top `droop` (0..1) of each eye, the outer corners `tilt` lower (sad), coloured
 * like the body. They follow the eyes (look, blink, wide eyes lift them).
 */
export const Lids: React.FC<{ pose: NubiPose; droop: number; tilt?: number; color: string }> = ({ pose, droop, tilt = 0, color }) => {
  const { ex, ey, eh, eyeW, blink } = eyeShape(pose);
  const d = droop * (1 - blink) * (1 - smooth(1.05, 1.35, pose.eyeScale ?? 1) * 0.7);
  if (d < 0.03) return null;
  const mat = toy(color, { rough: 0.42, glow: 0.14 });
  return (
    <group>
      {[-1, 1].map((side) => {
        const lh = d * eh + 0.18;
        return (
          <mesh
            key={side}
            geometry={lidGeo()}
            material={mat}
            position={[side * 2.3 + ex, ey + eh / 2 - lh / 2 + 0.14, 4.8]}
            rotation={[0, 0, -side * tilt]}
            scale={[1.05 * eyeW + 0.5, lh, 1]}
          />
        );
      })}
    </group>
  );
};

/** Dark bags under the eyes (tired). */
export const EyeBags: React.FC<{ pose: NubiPose; color?: string; amount?: number }> = ({ pose, color = "#2F3566", amount = 1 }) => {
  const { ex, ey, eh } = eyeShape(pose);
  if (amount <= 0.02) return null;
  const mat = toy(color, { rough: 0.6, glow: 0.08 });
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          geometry={bagGeo()}
          material={mat}
          position={[side * 2.3 + ex, ey - Math.max(eh, 0.5) / 2 - 0.2, 4.48]}
          rotation={[0, 0, Math.PI]}
          scale={[1.0 * amount, 0.45 * amount, 0.5]}
        />
      ))}
    </group>
  );
};

// =======================================================================================
// Pose helpers (world positions of fin tips and heads, for props and life counters)

const FIN_PIVOT: V3 = [4.8, 5.0, 0.3];
const _m = new THREE.Matrix4();
const _n = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Model → world matrix of a <Nubi> body (everything under the squash group). */
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

/**
 * World position of a point on a fin (default: the tip, where held objects sit) of a <Nubi> at
 * `position` turned `rotationY`, body width `size`, posed `pose`. side "R" = finR (screen-right
 * when facing the camera), "L" = finL.
 */
export const finTipWorld = (position: V3, rotationY: number, size: number, pose: NubiPose, side: "R" | "L", local: V3 = NUBI_FIN_TIP): V3 => {
  const m = bodyMatrix(_m, position, rotationY, size, pose);
  if (side === "L") m.multiply(_n.makeScale(-1, 1, 1));
  m.multiply(_n.makeTranslation(...FIN_PIVOT));
  m.multiply(_n.makeRotationFromEuler(_e.set(0, -0.12, (side === "R" ? (pose.finR ?? 0) : (pose.finL ?? 0)) * 0.55)));
  const v = new THREE.Vector3(...local).applyMatrix4(m);
  return [v.x, v.y, v.z];
};

/** A world point `above` units over the top of a <Nubi> (its life counter's anchor). */
export const headTop = (position: V3, size: number, pose: NubiPose = {}, above = 0.12): V3 => [
  position[0],
  position[1] + (size / 10) * ((pose.hop ?? 0) + 9.9 * Math.max(0.3, pose.squash ?? 1)) + above,
  position[2],
];

/** Deterministic blinks every few seconds (0..1). */
export const blinkAt = (g: number, seed: number) => {
  const period = 80 + Math.floor(hash(seed) * 70);
  const d = (((g + Math.floor(hash(seed + 1) * period)) % period) + period) % period;
  return d < 5 ? Math.sin((Math.PI * d) / 5) : 0;
};

// =======================================================================================
// OFFICE layout

const DESK = { w: 2.7, d: 1.1, top: 0.5, t: 0.07 };
const MON = { w: 0.94, h: 0.66, d: 0.36, stand: 0.2 };
/** z of a worker behind a desk, relative to the desk centre. */
const STAND = -0.62;
/** Desk columns (in the front row the two middle ones are the double desk). */
const COLS = [-13.5, -10.5, -7.5, -4.5, -1.5, 1.5, 4.5, 7.5, 10.5, 13.5];
const ROWS = [0, -4.2, -8.4];

/** The office: side walls at x0/x1, back wall at zBack, ceiling at `height`, desk tops at deskTop. */
export const OFFICE = { x0: -15.5, x1: 15.5, zBack: -12.2, height: 9, deskTop: DESK.top };
export type Desk = { x: number; z: number; side: 1 | -1; hero?: boolean };
/** Nubi and the coworker share the double desk at the front-row centre: half-width of its stations. */
const PAIR = 1.15;
/**
 * Every desk (centre x/z) and the corner its monitor stands on (−1 left, +1 right). The two front
 * desks in the middle are the double desk of Nubi and the coworker (`hero`).
 */
export const OFFICE_DESKS: Desk[] = ROWS.flatMap((z, r) =>
  (r === 2 ? COLS.slice(0, -1).map((x) => x + 1.5) : COLS).map((x, i) => {
    const side = (i % 2 === 0 ? -1 : 1) as 1 | -1;
    return z === 0 && Math.abs(x) < 2 ? { x: Math.sign(x) * PAIR, z, side: (x < 0 ? -1 : 1) as 1 | -1, hero: true } : { x, z, side };
  }),
);
/** Where Nubi (size 2) and the coworker stand at their double desk in the front row, facing +z. */
export const OFFICE_NUBI: V3 = [-PAIR, 0, STAND];
export const OFFICE_COWORKER: V3 = [PAIR, 0, STAND];
/** Nubi's and the coworker's desk centres. */
export const OFFICE_NUBI_DESK: V3 = [-PAIR, 0, 0];
export const OFFICE_COWORKER_DESK: V3 = [PAIR, 0, 0];
/** The giant wall clock (centre of its face), the rule lightbox and the PRODUCTIVIDAD screen. */
export const OFFICE_CLOCK: V3 = [0, 5.2, OFFICE.zBack + 0.22];
export const CLOCK_R = 1.75;
export const OFFICE_RULE: V3 = [0, 2.55, OFFICE.zBack + 0.12];
export const OFFICE_PROD: V3 = [-4.4, 3.35, OFFICE.zBack + 0.12];
const POSTER_AT: V3 = [3.5, 5.0, OFFICE.zBack + 0.04];
const LOGO_AT: V3 = [0, 7.85, OFFICE.zBack + 0.04];
const WIN = { x: 4.8, y0: 0.75, y1: 7.4 };

const monitorMatrix = (d: Desk) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(d.x + d.side * (d.hero ? 0.82 : 0.98), DESK.top, d.z + 0.2),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -d.side * 2.29),
    new THREE.Vector3(1, 1, 1),
  );

/** All desks merged (vertex colours), their screens and the glowing logos on the monitor backs. */
const deskGeos = once(() => {
  const parts: THREE.BufferGeometry[] = [];
  const screens: THREE.BufferGeometry[] = [];
  const logos: THREE.BufferGeometry[] = [];
  for (const d of OFFICE_DESKS) {
    const T = new THREE.Matrix4().makeTranslation(d.x, 0, d.z);
    // The double desk: each half is 2·PAIR wide and they meet in the middle (no inner side panel).
    const w = d.hero ? 2 * PAIR + 0.02 : DESK.w;
    const cx = d.hero ? -Math.sign(d.x) * 0.01 : 0;
    const local = [
      place(rbox(w, DESK.t, DESK.d, 0.03), "#EEF2F8", [cx, DESK.top - DESK.t / 2, 0]),
      place(rbox(w - 0.04, 0.045, 0.05, 0.015), TIMECO_RED, [cx, DESK.top - 0.05, DESK.d / 2]),
      place(rbox(w - 0.3, DESK.top - 0.16, 0.05, 0.02), "#7D8BA6", [cx, (DESK.top - 0.16) / 2 + 0.05, DESK.d / 2 - 0.12]),
      place(rbox(0.07, DESK.top - DESK.t, DESK.d - 0.08, 0.02), "#C6CFDC", [d.side * (w / 2 - 0.09), (DESK.top - DESK.t) / 2, 0]),
      place(rbox(0.07, DESK.top - DESK.t, DESK.d - 0.08, 0.02), "#C6CFDC", [d.hero ? d.side * (w / 2 - 0.09) : -d.side * (w / 2 - 0.09), (DESK.top - DESK.t) / 2, 0]),
      place(rbox(1.0, 0.045, 0.3, 0.02), "#3A4152", [0, DESK.top + 0.022, -0.1]),
      place(rbox(0.9, 0.02, 0.22, 0.008), "#66708A", [0, DESK.top + 0.05, -0.1]),
      place(rbox(0.44, 0.07, 0.32, 0.01), "#FFFFFF", [d.side * 0.25, DESK.top + 0.035, 0.28], [0, 0.18 * d.side, 0]),
    ];
    for (const g of local) parts.push(g.applyMatrix4(T));
    const M = monitorMatrix(d);
    const mon = [
      place(rbox(0.48, 0.04, 0.34, 0.015), "#2B3140", [0, 0.02, -0.03]),
      place(rbox(0.11, MON.stand, 0.09, 0.03), "#2B3140", [0, 0.04 + MON.stand / 2, -0.07]),
      place(rbox(MON.w, MON.h, MON.d, 0.09), "#2E3546", [0, 0.04 + MON.stand + MON.h / 2, 0]),
    ];
    for (const g of mon) parts.push(g.applyMatrix4(M));
    const scr = new THREE.PlaneGeometry(MON.w - 0.14, MON.h - 0.14);
    scr.translate(0, 0.04 + MON.stand + MON.h / 2, MON.d / 2 + 0.006);
    screens.push(scr.applyMatrix4(M));
    const lg = new THREE.PlaneGeometry(0.3, 0.3);
    lg.rotateY(Math.PI);
    lg.translate(0, 0.04 + MON.stand + MON.h / 2 + 0.04, -MON.d / 2 - 0.006);
    logos.push(lg.applyMatrix4(M));
  }
  return { desks: mergeAll(parts), screens: mergeAll(screens, ["position", "normal", "uv"]), logos: mergeAll(logos, ["position", "normal", "uv"]) };
});

const officeMats = once(() => ({
  carpet: (() => {
    const tex = carpetTex();
    tex.repeat.set(0.5, 0.5);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, emissive: new THREE.Color("#ffffff"), emissiveMap: tex, emissiveIntensity: 0.1 });
  })(),
  screen: new THREE.MeshBasicMaterial({ map: screenTex(), toneMapped: false }),
  backLogo: new THREE.MeshBasicMaterial({ map: backLogoTex(), transparent: true, alphaTest: 0.05, toneMapped: false }),
  glass: new THREE.MeshBasicMaterial({ color: "#DFF3FF", transparent: true, opacity: 0.12, depthWrite: false }),
  ceiling: toy("#E8ECF3", { rough: 0.9, glow: 0.12 }),
  panel: new THREE.MeshBasicMaterial({ color: "#F6FAFF", toneMapped: false }),
}));

// =======================================================================================
// OFFICE set

/** The big round wall clock with alarm bells on top. `hours` 0..24 sets the hands; `ring` 0..1 rings. */
export const WallClock: React.FC<{ hours: number; ring?: number; t?: number; blur?: number }> = ({ hours, ring = 0, t = 0, blur = 0 }) => {
  const geos = useMemo(() => {
    const hand = (w: number, l: number, back: number) => {
      const g = rbox(w, l + back, 0.07, Math.min(w / 2 - 0.01, 0.05));
      g.translate(0, (l - back) / 2, 0);
      return g;
    };
    return {
      back: new THREE.CylinderGeometry(CLOCK_R, CLOCK_R, 0.22, 64).rotateX(Math.PI / 2),
      face: new THREE.CircleGeometry(CLOCK_R - 0.1, 64),
      rim: new THREE.TorusGeometry(CLOCK_R, 0.16, 12, 72),
      accent: new THREE.TorusGeometry(CLOCK_R - 0.15, 0.04, 6, 72),
      hour: hand(0.2, 0.95, 0.18),
      minute: hand(0.13, 1.42, 0.22),
      second: hand(0.05, 1.5, 0.3),
      cap: new THREE.CylinderGeometry(0.13, 0.13, 0.1, 24).rotateX(Math.PI / 2),
      bell: new THREE.SphereGeometry(0.42, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      bellLeg: new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8),
      hammer: new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8),
      knob: new THREE.SphereGeometry(0.1, 12, 8),
      wave: new THREE.TorusGeometry(0.55, 0.035, 4, 16, 1.3),
    };
  }, []);
  const ghosts = useMemo(() => [0.42, 0.24, 0.12].map((o) => new THREE.MeshBasicMaterial({ color: TIMECO_DARK, transparent: true, opacity: o, depthWrite: false })), []);
  const ready = useFontsReady();
  const faceMat = ready ? texMat("clock-face", clockFaceTex, { rough: 0.5, glow: 0.3 }) : toy("#FFFFFF", { glow: 0.3 });
  const dark = toy(TIMECO_DARK, { rough: 0.4, glow: 0.1 });
  const red = toy(TIMECO_RED, { rough: 0.35, glow: 0.22, metal: 0.1 });
  const steel = toy("#C9D2DE", { rough: 0.3, metal: 0.5 });
  const min = frac(hours) * Math.PI * 2;
  const hr = ((hours % 12) / 12) * Math.PI * 2;
  const sec = frac(t / 60) * Math.PI * 2;
  const shakeZ = ring * 0.05 * Math.sin(t * 70);
  const hammer = ring * 0.45 * Math.sin(t * 95);
  const step = blur * 0.22;
  return (
    <group rotation={[0, 0, shakeZ]}>
      <mesh geometry={geos.back} material={dark} position={[0, 0, -0.1]} />
      <mesh geometry={geos.face} material={faceMat} position={[0, 0, 0.02]} />
      <mesh geometry={geos.rim} material={dark} position={[0, 0, 0.04]} />
      <mesh geometry={geos.accent} material={red} position={[0, 0, 0.06]} />
      <mesh geometry={geos.hour} material={dark} position={[0, 0, 0.1]} rotation={[0, 0, -hr]} />
      <mesh geometry={geos.minute} material={dark} position={[0, 0, 0.16]} rotation={[0, 0, -min]} />
      {blur > 0.05
        ? ghosts.map((m, i) => <mesh key={i} geometry={geos.minute} material={m} position={[0, 0, 0.15 - i * 0.005]} rotation={[0, 0, -min + step * (i + 1)]} />)
        : null}
      {blur < 0.5 ? <mesh geometry={geos.second} material={red} position={[0, 0, 0.21]} rotation={[0, 0, -sec]} /> : null}
      <mesh geometry={geos.cap} material={red} position={[0, 0, 0.25]} />
      {/* Alarm bells and the hammer between them. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.95, CLOCK_R + 0.25, -0.05]} rotation={[0, 0, -s * 0.55]}>
          <mesh geometry={geos.bellLeg} material={steel} position={[0, -0.12, 0]} />
          <mesh geometry={geos.bell} material={red} position={[0, 0.06, 0]} />
          <mesh geometry={geos.knob} material={steel} position={[0, 0.5, 0]} scale={0.7} />
          {ring > 0.05
            ? [0, 1].map((k) => (
                <mesh
                  key={k}
                  geometry={geos.wave}
                  material={toy("#FFF3A0", { glow: 0.9 })}
                  position={[s * 0.35, 0.3, 0.1]}
                  rotation={[0, 0, s > 0 ? -0.65 : Math.PI - 0.65]}
                  scale={(0.8 + k * 0.45 + 0.15 * Math.sin(t * 40 + k)) * ring}
                />
              ))
            : null}
        </group>
      ))}
      <group position={[0, CLOCK_R + 0.05, 0]} rotation={[0, 0, hammer]}>
        <mesh geometry={geos.hammer} material={steel} position={[0, 0.27, 0]} />
        <mesh geometry={geos.knob} material={red} position={[0, 0.56, 0]} />
      </group>
    </group>
  );
};

/** The lightbox "8 H DE TRABAJO = +1 DÍA DE VIDA"; `lit` 0..1 switches its neon on. */
export const RuleSign: React.FC<{ lit: number }> = ({ lit }) => {
  const ready = useFontsReady();
  const geos = useMemo(() => ({ box: rbox(5.9, 1.5, 0.2, 0.12), face: new THREE.PlaneGeometry(5.6, 1.4) }), []);
  const litMat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, depthWrite: false }), []);
  if (ready && !litMat.map) {
    litMat.map = ruleTex(true);
    litMat.needsUpdate = true;
  }
  litMat.opacity = clamp01(lit);
  return (
    <group>
      <mesh geometry={geos.box} material={toy("#151924", { rough: 0.4 })} />
      {ready ? <mesh geometry={geos.face} material={texMat("rule-off", () => ruleTex(false), { glow: 0.2 })} position={[0, 0, 0.11]} /> : null}
      {ready && lit > 0.01 ? <mesh geometry={geos.face} material={litMat} position={[0, 0, 0.13]} /> : null}
      <Glow color="#3CFF7A" size={6.5} opacity={0.32 * lit} position={[0, 0, 0.4]} />
    </group>
  );
};

/** The wall screen with the coworker's productivity: state 0 a bar chart, 1 a big red "2%". */
export const ProductivityScreen: React.FC<{ state: 0 | 1; pop?: number }> = ({ state, pop = 0 }) => {
  const ready = useFontsReady();
  const geos = useMemo(() => ({ frame: rbox(2.55, 1.7, 0.16, 0.08), screen: new THREE.PlaneGeometry(2.36, 1.48) }), []);
  return (
    <group scale={1 + 0.08 * pop}>
      <mesh geometry={geos.frame} material={toy(TIMECO_DARK, { rough: 0.35 })} />
      <mesh geometry={geos.screen} material={ready ? texMat(`prod-${state}`, () => prodTex(state), { basic: true }) : toy("#1A2446")} position={[0, 0, 0.09]} />
      {state === 1 ? <Glow color="#FF3B3B" size={3.4} opacity={0.25 + 0.3 * pop} position={[0, 0, 0.3]} /> : null}
    </group>
  );
};

/**
 * The office set (no workers, no lights: add <OfficeCrowd> and <OfficeLights>). `day` 0..1 turns
 * the windows from morning to sunset; `hours` sets the clock; `ring` rings its bells; `rule` lights
 * the rule sign; `prod` switches the productivity screen to "2%" (and `prodPop` pops it).
 */
export const Office: React.FC<{ t?: number; day?: number; hours?: number; ring?: number; clockBlur?: number; rule?: number; prod?: 0 | 1; prodPop?: number }> = ({
  t = 0,
  day = 0,
  hours = 9,
  ring = 0,
  clockBlur = 0,
  rule = 0,
  prod = 0,
  prodPop = 0,
}) => {
  const ready = useFontsReady();
  const { x0, x1, zBack, height: H } = OFFICE;
  const W = x1 - x0;
  const geos = useMemo(() => {
    const winW = x1 - WIN.x;
    const mullions: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      for (let k = 0; k <= 4; k++) {
        const x = s * (WIN.x + (k / 4) * winW);
        mullions.push(place(rbox(0.16, WIN.y1 - WIN.y0, 0.22, 0.04), "#E9EEF6", [x, (WIN.y0 + WIN.y1) / 2, zBack]));
      }
      mullions.push(place(rbox(winW, 0.16, 0.22, 0.04), "#E9EEF6", [s * (WIN.x + winW / 2), WIN.y0, zBack]));
      mullions.push(place(rbox(winW, 0.16, 0.22, 0.04), "#E9EEF6", [s * (WIN.x + winW / 2), WIN.y1, zBack]));
      mullions.push(place(rbox(winW, 0.1, 0.18, 0.03), "#E9EEF6", [s * (WIN.x + winW / 2), (WIN.y0 + WIN.y1) / 2 + 0.6, zBack]));
    }
    // Wall trim: skirting all round, a TIMECO-red stripe on the solid walls.
    const trim: THREE.BufferGeometry[] = [
      place(rbox(2 * WIN.x, 0.22, 0.08, 0.02), "#5C6884", [0, 0.11, zBack + 0.04]),
      place(rbox(2 * WIN.x, 0.14, 0.06, 0.02), TIMECO_RED, [0, 1.35, zBack + 0.03]),
      place(rbox(0.08, 0.22, 30, 0.02), "#5C6884", [x0 + 0.04, 0.11, 1.4]),
      place(rbox(0.08, 0.22, 30, 0.02), "#5C6884", [x1 - 0.04, 0.11, 1.4]),
      place(rbox(0.06, 0.14, 30, 0.02), TIMECO_RED, [x0 + 0.03, 1.35, 1.4]),
      place(rbox(0.06, 0.14, 30, 0.02), TIMECO_RED, [x1 - 0.03, 1.35, 1.4]),
      place(rbox(W, 0.75, 0.3, 0.03), "#9AA7BF", [0, 0.375, zBack + 0.15]),
    ];
    // Ceiling light panels.
    const panels: THREE.BufferGeometry[] = [];
    for (const z of [3, -2.1, -6.3, -10.5]) {
      for (const x of [-6, -2, 2, 6]) {
        const p = new THREE.PlaneGeometry(2.4, 0.55);
        p.rotateX(Math.PI / 2);
        p.translate(x, H - 0.02, z);
        panels.push(p);
      }
    }
    const back = new THREE.PlaneGeometry(2 * WIN.x, H);
    back.translate(0, H / 2, zBack);
    const header = (s: number) => {
      const g = new THREE.PlaneGeometry(winW, H - WIN.y1);
      g.translate(s * (WIN.x + winW / 2), (H + WIN.y1) / 2, zBack);
      return g;
    };
    const sideWall = (s: number) => {
      const g = new THREE.PlaneGeometry(30, H);
      g.rotateY((-s * Math.PI) / 2);
      g.translate(s > 0 ? x1 : x0, H / 2, 1.4);
      return g;
    };
    const glass = new THREE.PlaneGeometry(winW, WIN.y1 - WIN.y0);
    const floor = worldPlane(W + 4, 32);
    floor.rotateX(-Math.PI / 2);
    floor.translate(0, 0, 1.6);
    const ceiling = new THREE.PlaneGeometry(W + 4, 32);
    ceiling.rotateX(Math.PI / 2);
    ceiling.translate(0, H, 1.6);
    return {
      mullions: mergeAll(mullions),
      trim: mergeAll(trim),
      panels: mergeAll(panels, ["position", "normal", "uv"]),
      back,
      headerL: header(-1),
      headerR: header(1),
      wallL: sideWall(-1),
      wallR: sideWall(1),
      glass,
      floor,
      ceiling,
      sky: new THREE.PlaneGeometry(64, 26),
      shaft: new THREE.PlaneGeometry(1, 1),
      poster: new THREE.PlaneGeometry(2.0, 2.66),
      posterFrame: rbox(2.16, 2.82, 0.08, 0.04),
      logo: new THREE.PlaneGeometry(4.6, 1.35),
      plant: new THREE.SphereGeometry(0.5, 14, 10),
      pot: new THREE.CylinderGeometry(0.34, 0.26, 0.7, 18),
    };
  }, [x0, x1, zBack, H, W]);
  const m = officeMats();
  const d = deskGeos();
  const wall = toy("#B9C5D8", { rough: 0.85, glow: 0.12 });
  const wallSide = toy("#AEBBD0", { rough: 0.85, glow: 0.12 });
  const sunsetMat = useMemo(() => new THREE.MeshBasicMaterial({ map: skyTex(true), transparent: true, toneMapped: false, depthWrite: false }), []);
  sunsetMat.opacity = clamp01(day);
  const shaftMat = useMemo(() => additive(new THREE.MeshBasicMaterial({ map: fadeTex(), toneMapped: false })), []);
  shaftMat.color.set(mixHex("#FFF2C8", "#FF9A52", day));
  shaftMat.opacity = 0.1 + 0.28 * smooth(0.2, 1, day);
  // Sun shafts through the back windows lengthen and slant as the sun goes down.
  const shaftLen = lerp(4.5, 15, smooth(0, 1, day));
  const slant = lerp(0.15, 0.55, day);
  return (
    <group>
      <mesh geometry={geos.floor} material={m.carpet} />
      <mesh geometry={geos.ceiling} material={m.ceiling} />
      <mesh geometry={geos.panels} material={m.panel} />
      <mesh geometry={geos.back} material={wall} />
      <mesh geometry={geos.headerL} material={wall} />
      <mesh geometry={geos.headerR} material={wall} />
      <mesh geometry={geos.wallL} material={wallSide} />
      <mesh geometry={geos.wallR} material={wallSide} />
      <mesh geometry={geos.trim} material={vertexMat(0.6, false, 0.14)} />
      <mesh geometry={geos.mullions} material={vertexMat(0.4, false, 0.18)} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geos.glass} material={m.glass} position={[s * (WIN.x + (x1 - WIN.x) / 2), (WIN.y0 + WIN.y1) / 2, zBack + 0.02]} />
      ))}
      {/* The sky behind the windows: morning, cross-fading to sunset. */}
      <mesh geometry={geos.sky} material={texMat("office-sky-morning", () => skyTex(false), { basic: true })} position={[0, 7, zBack - 5]} />
      {day > 0.005 ? <mesh geometry={geos.sky} material={sunsetMat} position={[0, 7, zBack - 4.9]} /> : null}
      {[-1, 1].map((s) =>
        [0, 1, 2, 3].map((k) => {
          const x = s * (WIN.x + 0.65 + k * 1.3);
          const a = slant * 0.9;
          return (
            <mesh
              key={`${s}${k}`}
              geometry={geos.shaft}
              material={shaftMat}
              position={[x - (Math.sin(a) * shaftLen) / 2, 0.015, zBack + 0.3 + (Math.cos(a) * shaftLen) / 2]}
              rotation={[-Math.PI / 2, 0, -a]}
              scale={[1.05, shaftLen, 1]}
            />
          );
        }),
      )}
      {/* Desks, screens, glowing logos on the monitor backs. */}
      <mesh geometry={d.desks} material={vertexMat(0.55, false, 0.14)} />
      <mesh geometry={d.screens} material={m.screen} />
      <mesh geometry={d.logos} material={m.backLogo} />
      {/* The back wall: clock, logo, poster, rule sign, productivity screen. */}
      <group position={OFFICE_CLOCK}>
        <WallClock hours={hours} ring={ring} t={t} blur={clockBlur} />
      </group>
      {ready ? (
        <>
          <mesh geometry={geos.logo} material={texMat("office-wordmark", () => wordmarkTex(false), { transparent: true, glow: 0.25 })} position={LOGO_AT} />
          <group position={POSTER_AT}>
            <mesh geometry={geos.posterFrame} material={toy(TIMECO_GOLD, { metal: 0.4, rough: 0.35, glow: 0.2 })} />
            <mesh geometry={geos.poster} material={texMat("office-poster", posterTex, { glow: 0.3 })} position={[0, 0, 0.05]} />
          </group>
        </>
      ) : null}
      <group position={OFFICE_RULE}>
        <RuleSign lit={rule} />
      </group>
      <group position={OFFICE_PROD}>
        <ProductivityScreen state={prod} pop={prodPop} />
      </group>
      {/* Potted plants in the corners by the windows. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (WIN.x - 0.7), 0, zBack + 0.9]}>
          <mesh geometry={geos.pot} material={toy("#E9EEF6", { rough: 0.5 })} position={[0, 0.35, 0]} />
          <mesh geometry={geos.plant} material={toy("#3FAE6A", { rough: 0.7, glow: 0.16 })} position={[0, 1.05, 0]} scale={[1, 1.3, 1]} />
          <mesh geometry={geos.plant} material={toy("#56C47E", { rough: 0.7, glow: 0.16 })} position={[0.22, 1.45, 0.1]} scale={0.6} />
        </group>
      ))}
    </group>
  );
};

/** Office lights; `day` 0 → 1 goes from cool morning to a warm sunset coming through the windows. */
export const OfficeLights: React.FC<{ day?: number }> = ({ day = 0 }) => (
  <>
    <hemisphereLight args={[mixHex("#EEF4FF", "#FFC08F", day), mixHex("#68728C", "#7A5C66", day), 1.3]} />
    <directionalLight position={[3, 7, 11]} intensity={1.75 - 0.45 * day} color={mixHex("#F4F7FF", "#FFD2B0", day)} />
    <directionalLight position={[-6, 5, -12]} intensity={0.8 + 2.2 * day} color={mixHex("#FFF6E2", "#FF7A3A", day)} />
    <directionalLight position={[8, 4, -4]} intensity={0.45 - 0.2 * day} color="#D4E2FF" />
  </>
);

// =======================================================================================
// Hero props on the front-row desks

/** The coworker's big red "ENVIAR" button (base on the desk top). `press` 0..1 sinks and lights it. */
export const EnviarButton: React.FC<{ press?: number; glow?: number }> = ({ press = 0, glow = 0 }) => {
  const ready = useFontsReady();
  const geos = useMemo(() => {
    const plate = new THREE.PlaneGeometry(0.62, 0.19);
    return {
      base: rbox(0.72, 0.2, 0.5, 0.06),
      ring: new THREE.CylinderGeometry(0.22, 0.24, 0.05, 28),
      dome: new THREE.SphereGeometry(0.19, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      plate,
    };
  }, []);
  const domeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: TIMECO_RED, roughness: 0.25, emissive: new THREE.Color(TIMECO_RED), emissiveIntensity: 0.3 }), []);
  domeMat.emissiveIntensity = 0.3 + 1.6 * glow;
  return (
    <group>
      <mesh geometry={geos.base} material={toy(TIMECO_DARK, { rough: 0.4 })} position={[0, 0.1, 0]} castShadow />
      <mesh geometry={geos.ring} material={toy("#C9D2DE", { metal: 0.5, rough: 0.3 })} position={[0, 0.215, -0.04]} />
      <mesh geometry={geos.dome} material={domeMat} position={[0, 0.235 - 0.07 * press, -0.04]} scale={[1, 0.85, 1]} />
      {ready ? (
        <mesh geometry={geos.plate} material={texMat("enviar", enviarTex, { glow: 0.35 })} position={[0, 0.1, 0.255]} rotation={[-0.15, 0, 0]} />
      ) : null}
      <Glow color="#FF5050" size={1.1} opacity={0.6 * glow} position={[0, 0.3, 0]} />
    </group>
  );
};

/** A coffee mug with the TIMECO logo (world units, base at the origin) and a wisp of steam. */
export const Mug: React.FC<{ t?: number; steam?: number }> = ({ t = 0, steam = 1 }) => {
  const ready = useFontsReady();
  const geos = useMemo(
    () => ({
      body: new THREE.CylinderGeometry(0.11, 0.1, 0.24, 24, 1, true),
      label: new THREE.CylinderGeometry(0.1115, 0.1015, 0.15, 24, 1, true),
      bottom: new THREE.CircleGeometry(0.1, 24).rotateX(-Math.PI / 2),
      coffee: new THREE.CircleGeometry(0.1, 24).rotateX(-Math.PI / 2),
      handle: new THREE.TorusGeometry(0.06, 0.018, 8, 16),
    }),
    [],
  );
  const steamMat = useMemo(() => additive(new THREE.SpriteMaterial({ map: glowTexture(), color: "#FFFFFF", toneMapped: false })), []);
  steamMat.opacity = 0.22 * steam;
  const white = toy("#FFFFFF", { rough: 0.35, glow: 0.2, side: THREE.DoubleSide });
  return (
    <group>
      <mesh geometry={geos.body} material={white} position={[0, 0.12, 0]} castShadow />
      {ready ? <mesh geometry={geos.label} material={texMat("mug-label", mugTex, { glow: 0.25, side: THREE.DoubleSide })} position={[0, 0.12, 0]} /> : null}
      <mesh geometry={geos.bottom} material={white} position={[0, 0.005, 0]} />
      <mesh geometry={geos.coffee} material={toy("#5A3A22", { rough: 0.2 })} position={[0, 0.21, 0]} />
      <mesh geometry={geos.handle} material={white} position={[0.12, 0.13, 0]} />
      {steam > 0.02
        ? [0, 1, 2].map((k) => {
            const u = frac(t * 0.45 + k / 3);
            return <sprite key={k} material={steamMat} position={[0.03 * Math.sin(t * 2 + k * 2), 0.26 + u * 0.45, 0]} scale={0.12 + u * 0.16} />;
          })
        : null}
    </group>
  );
};

/** A rubber stamp (world units), its rubber face at the origin, handle up. */
export const RubberStamp: React.FC = () => {
  const geos = useMemo(
    () => ({
      base: rbox(0.26, 0.07, 0.18, 0.02),
      pad: rbox(0.24, 0.025, 0.16, 0.01),
      neck: new THREE.CylinderGeometry(0.035, 0.05, 0.14, 12),
      knob: new THREE.SphereGeometry(0.075, 16, 10),
    }),
    [],
  );
  return (
    <group>
      <mesh geometry={geos.pad} material={toy("#C81E26", { rough: 0.5 })} position={[0, 0.012, 0]} />
      <mesh geometry={geos.base} material={toy("#7A4A2A", { rough: 0.6 })} position={[0, 0.06, 0]} />
      <mesh geometry={geos.neck} material={toy("#7A4A2A", { rough: 0.6 })} position={[0, 0.16, 0]} />
      <mesh geometry={geos.knob} material={toy(TIMECO_RED, { rough: 0.35, glow: 0.2 })} position={[0, 0.27, 0]} scale={[1, 0.85, 1]} />
    </group>
  );
};

/** A sheet of paper lying on a desk (world units); `stamped` 0..1 prints the red "LISTO" on it. */
export const StampPaper: React.FC<{ stamped?: number; yaw?: number }> = ({ stamped = 0, yaw = 0 }) => {
  const ready = useFontsReady();
  const geo = useMemo(() => new THREE.PlaneGeometry(0.42, 0.52).rotateX(-Math.PI / 2), []);
  const markGeo = useMemo(() => new THREE.PlaneGeometry(0.36, 0.18).rotateX(-Math.PI / 2), []);
  return (
    <group rotation={[0, yaw, 0]}>
      <mesh geometry={geo} material={ready ? texMat("paper", paperTex, { glow: 0.3 }) : toy("#FFFFFF")} position={[0, 0.004, 0]} />
      {ready && stamped > 0.01 ? (
        <mesh geometry={markGeo} material={texMat("listo", listoTex, { transparent: true, glow: 0.4 })} position={[0, 0.008, 0.06]} scale={0.8 + 0.2 * stamped} />
      ) : null}
    </group>
  );
};

// =======================================================================================
// The office crowd (instanced): typing workers in shirts and ties

export type OfficeWorker = { i: number; seed: number; desk: Desk; at: V3; size: number; body: string; tie: string; phase: number; rate: number; look: number };

const TIES = [TIMECO_RED, "#2F4A8A", TIMECO_GOLD, "#2B2F38", "#1FA67A", "#8E3BD1"];

/** Every worker at a desk (all desks but Nubi's and the coworker's). */
export const OFFICE_WORKERS: OfficeWorker[] = (() => {
  const out: OfficeWorker[] = [];
  OFFICE_DESKS.forEach((d, k) => {
    if (d.hero) return;
    const seed = 300 + k;
    const r = mulberry(seed * 13 + 5);
    const body = CIVILIAN_COLORS[(k * 5 + 3) % CIVILIAN_COLORS.length];
    out.push({
      i: out.length,
      seed,
      desk: d,
      at: [d.x, 0, d.z + STAND],
      size: 1.8 + r() * 0.4,
      body,
      tie: TIES[Math.floor(r() * TIES.length)],
      phase: r() * Math.PI * 2,
      rate: 0.8 + r() * 0.45,
      look: d.side * 0.55,
    });
  });
  return out;
})();

/** A stamping worker: index into OFFICE_WORKERS and the frame its stamp hits the paper. */
export type StampHit = { worker: number; at: number };

/**
 * A worker's pose at frame g: typing (fins tapping, little bobs), `ff` 0..1 = fast-forward (the
 * time-lapse: frantic typing, quick glances). With `stampAt` it twists, winds the right fin up and
 * slams its stamp down at that frame.
 */
export const workerPose = (w: OfficeWorker, g: number, ff = 0, stampAt?: number): NubiPose => {
  const t = g / 30;
  const ph = t * 11 * w.rate * (1 + 3.5 * ff) + w.phase;
  let finL = -0.3 - 0.45 * Math.max(0, Math.sin(ph));
  let finR = -0.3 - 0.45 * Math.max(0, Math.sin(ph + Math.PI * 0.9));
  let squash = 1 + 0.015 * Math.sin(ph * 0.5);
  let hop = 0.1 * Math.max(0, Math.sin(ph * 0.5)) * (1 + 2.5 * ff);
  let pitch = 0.07 + 0.04 * ff;
  let yaw = 0.15 * Math.sin(t * 0.7 + w.phase) + ff * 0.25 * Math.sin(t * 9 + w.phase * 2);
  let lookX = w.look;
  let lookY = -0.35;
  if (stampAt !== undefined) {
    const d = g - stampAt;
    const k = smooth(-16, -10, d) * (1 - smooth(10, 18, d));
    if (k > 0) {
      const up = smooth(-12, -4, d) * (1 - smooth(-3, 0, d));
      const hit = d >= 0 ? Math.exp(-d * 0.3) : 0;
      finR = lerp(finR, -0.85 + 2.2 * up - 0.2 * hit, k);
      yaw = lerp(yaw, -0.6, k);
      squash *= 1 - 0.08 * hit + 0.05 * up;
      pitch += 0.14 * hit * k;
      hop += 0.4 * up * k;
      lookX = lerp(lookX, 0.7, k);
      lookY = lerp(lookY, -0.6, k);
      finL = lerp(finL, 0.2 + 0.3 * up, k);
    }
  }
  return { finL, finR, squash, hop, pitch, yaw, lookX, lookY, blink: blinkAt(g, w.seed) };
};

/** Anchor for a worker's life counter. */
export const workerHead = (w: OfficeWorker, g: number, ff = 0, stampAt?: number): V3 => headTop(w.at, w.size, workerPose(w, g, ff, stampAt), 0.1);

/** Where a stamping worker's stamp hits its desk (the paper lies there). */
export const stampSpot = (w: OfficeWorker, at: number): V3 => {
  const tip = finTipWorld(w.at, 0, w.size, workerPose(w, at, 0, at), "R", [2.0, -0.6, 0.6]);
  return [tip[0], DESK.top, tip[2]];
};

const crowdGeos = once(() => {
  const body = rbox(10, 7.4, 8.8, 0.6, 3);
  body.translate(0, 6.2, 0);
  const s = shirtGeos();
  const fin = finGeometry();
  return {
    body: paintGeo(body, "#FFFFFF"),
    eye: paintGeo(rbox(1.05, 1.75, 0.5, 0.2, 2), "#151515"),
    finR: paintGeo(fin, "#FFFFFF"),
    finL: paintGeo(mirrorX(fin), "#FFFFFF"),
    shirt: mergeAll([paintGeo(s.band.clone(), "#FFFFFF"), paintGeo(s.collarL.clone(), "#FFFFFF"), paintGeo(s.collarR.clone(), "#FFFFFF")]),
    tie: mergeAll([paintGeo(s.knot.clone(), "#FFFFFF"), paintGeo(s.blade.clone(), "#FFFFFF")]),
  };
});

/**
 * The office workers, instanced (bodies, eyes, fins, shirts, ties): all of OFFICE_WORKERS typing
 * at frame g (`ff` = fast-forward 0..1); `stamps` make some of them stamp papers; `hide` leaves
 * those workers' desks empty.
 */
export const OfficeCrowd: React.FC<{ g: number; ff?: number; stamps?: StampHit[]; hide?: number[] }> = ({ g, ff = 0, stamps = [], hide = [] }) => {
  const workers = OFFICE_WORKERS;
  const n = workers.length;
  const geo = crowdGeos();
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const eyeRef = useRef<THREE.InstancedMesh>(null);
  const finRRef = useRef<THREE.InstancedMesh>(null);
  const finLRef = useRef<THREE.InstancedMesh>(null);
  const shirtRef = useRef<THREE.InstancedMesh>(null);
  const tieRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const c = new THREE.Color();
    workers.forEach((w, i) => {
      bodyRef.current?.setColorAt(i, c.set(w.body));
      finRRef.current?.setColorAt(i, c.set(w.body));
      finLRef.current?.setColorAt(i, c.set(w.body));
      tieRef.current?.setColorAt(i, c.set(w.tie));
    });
    for (const m of [bodyRef.current, finRRef.current, finLRef.current, tieRef.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true;
  }, [workers]);
  useLayoutEffect(() => {
    const M = new THREE.Matrix4();
    const A = new THREE.Matrix4();
    const B = new THREE.Matrix4();
    const e = new THREE.Euler();
    workers.forEach((w, i) => {
      const hit = stamps.find((s) => s.worker === i);
      const pose = workerPose(w, g, ff, hit?.at);
      bodyMatrix(M, w.at, 0, hide.includes(i) ? 1e-4 : w.size, pose);
      bodyRef.current?.setMatrixAt(i, M);
      shirtRef.current?.setMatrixAt(i, M);
      tieRef.current?.setMatrixAt(i, M);
      const { ex, ey, eh, eyeW } = eyeShape(pose);
      for (const side of [0, 1]) {
        A.copy(M).multiply(B.compose(_v.set((side ? 2.3 : -2.3) + ex, ey, 4.45), _q.identity(), _s.set(eyeW, eh / 1.75, 1)));
        eyeRef.current?.setMatrixAt(i * 2 + side, A);
      }
      A.copy(M).multiply(B.makeTranslation(...FIN_PIVOT)).multiply(B.makeRotationFromEuler(e.set(0, -0.12, (pose.finR ?? 0) * 0.55)));
      finRRef.current?.setMatrixAt(i, A);
      A.copy(M)
        .multiply(B.makeTranslation(-FIN_PIVOT[0], FIN_PIVOT[1], FIN_PIVOT[2]))
        .multiply(B.makeRotationFromEuler(e.set(0, 0.12, -(pose.finL ?? 0) * 0.55)));
      finLRef.current?.setMatrixAt(i, A);
    });
    for (const m of [bodyRef.current, eyeRef.current, finRRef.current, finLRef.current, shirtRef.current, tieRef.current]) if (m) m.instanceMatrix.needsUpdate = true;
  }, [g, ff, stamps, hide, workers]);
  const skin = vertexMat(0.42, false, 0.14);
  return (
    <group>
      <instancedMesh ref={bodyRef} args={[geo.body, skin, n]} frustumCulled={false} />
      <instancedMesh ref={finRRef} args={[geo.finR, skin, n]} frustumCulled={false} />
      <instancedMesh ref={finLRef} args={[geo.finL, skin, n]} frustumCulled={false} />
      <instancedMesh ref={eyeRef} args={[geo.eye, vertexMat(0.32, false, 0), n * 2]} frustumCulled={false} />
      <instancedMesh ref={shirtRef} args={[geo.shirt, vertexMat(0.6, false, 0.2), n]} frustumCulled={false} />
      <instancedMesh ref={tieRef} args={[geo.tie, vertexMat(0.45, false, 0.18), n]} frustumCulled={false} />
    </group>
  );
};

// =======================================================================================
// The coworker

export const COWORKER_SIZE = 2.05;
export const COWORKER_BLUE = "#5B7FD6";
export const COWORKER_PALETTE: NubiPalette = { body: COWORKER_BLUE, legs: "#4C6DC2" };

/** Where the mug sits in the coworker's screen-right fin (holdR content, model units of the fin tip). */
export const MUG_HOLD = { position: [0.2, -1.45, 0.55] as V3, scale: 10 / COWORKER_SIZE };

/**
 * The exhausted coworker: a dusty-blue Nubi in a white shirt collar and a red tie, droopy lids
 * (`droop` 0..1) and dark eye bags. Pass the mug (or anything) in holdR / holdL.
 */
export const Coworker: React.FC<{
  pose?: NubiPose;
  position?: V3;
  rotationY?: number;
  droop?: number;
  holdR?: React.ReactNode;
  holdL?: React.ReactNode;
  shadowOpacity?: number;
}> = ({ pose = {}, position, rotationY, droop = 0.55, holdR, holdL, shadowOpacity = 0.35 }) => (
  <Nubi size={COWORKER_SIZE} palette={COWORKER_PALETTE} pose={pose} position={position} rotationY={rotationY} holdR={holdR} holdL={holdL} shadowOpacity={shadowOpacity}>
    <ShirtAndTie tie={TIMECO_RED} />
    <Lids pose={pose} droop={droop} tilt={0.04} color={shadeHex(COWORKER_BLUE, -0.07)} />
    <EyeBags pose={pose} />
  </Nubi>
);

// =======================================================================================
// HALL: the office's night hallway

/** The hallway: floor y = 0 from the back wall (zBack) towards +z; walls at x0/x1. */
export const HALL = { x0: -9, x1: 9, zBack: -3.6, height: 4.8 };
const HALL_WINDOWS = [-4.1, -1.3, 1.5];
const HALL_WIN = { w: 2.3, y0: 0.7, y1: 3.95 };
/** The vending machine (base centre) against the back wall, on the right. */
export const HALL_VENDING: V3 = [4.15, 0, HALL.zBack + 0.5];
/** The yellow "PISO MOJADO" sign. */
export const HALL_SIGN: V3 = [-2.6, 0, -1.3];
/** The mop bucket. */
export const HALL_BUCKET: V3 = [2.55, 0, -0.35];
/** Where the old lady mops. */
export const HALL_LADY: V3 = [1.05, 0, 0.55];
/** Night sky colour behind the canvas. */
export const HALL_BG = "linear-gradient(180deg, #0A1236 0%, #1A2A66 60%, #2A3B7E 100%)";

const hallMats = once(() => ({
  tiles: (() => {
    const tex = hallTileTex();
    tex.repeat.set(0.62, 0.62);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.16, metalness: 0.05, emissive: new THREE.Color("#ffffff"), emissiveMap: tex, emissiveIntensity: 0.07 });
  })(),
  glass: new THREE.MeshBasicMaterial({ color: "#BFD4FF", transparent: true, opacity: 0.08, depthWrite: false }),
  shaft: (() => {
    const m = additive(new THREE.MeshBasicMaterial({ map: fadeTex(), color: "#7E9BFF", toneMapped: false }));
    m.opacity = 0.32;
    return m;
  })(),
  reflectWin: (() => {
    const m = additive(new THREE.MeshBasicMaterial({ map: fadeTex(), color: "#5E7BD8", toneMapped: false }));
    m.opacity = 0.35;
    return m;
  })(),
  reflectVend: (() => {
    const m = additive(new THREE.MeshBasicMaterial({ map: fadeTex(), color: "#7FEFFF", toneMapped: false }));
    m.opacity = 0.42;
    return m;
  })(),
  lamp: new THREE.MeshBasicMaterial({ color: "#C9D6FF", toneMapped: false }),
}));

/** The vending machine (base centre at the origin, front +z): snacks priced in time, glowing. */
export const VendingMachine: React.FC<{ t?: number }> = ({ t = 0 }) => {
  const ready = useFontsReady();
  const geos = useMemo(
    () => ({
      body: rbox(1.4, 2.55, 0.9, 0.08),
      window: new THREE.PlaneGeometry(0.9, 1.75),
      panel: rbox(0.32, 1.75, 0.05, 0.03),
      header: rbox(1.3, 0.34, 0.06, 0.04),
      headerFace: new THREE.PlaneGeometry(1.15, 0.3),
      tray: rbox(0.9, 0.3, 0.1, 0.04),
      button: rbox(0.08, 0.06, 0.03, 0.01),
      slot: rbox(0.16, 0.22, 0.04, 0.02),
    }),
    [],
  );
  const flick = 0.92 + 0.08 * Math.sin(t * 7.1) * Math.sin(t * 2.3);
  return (
    <group>
      <mesh geometry={geos.body} material={toy("#262B41", { rough: 0.35, glow: 0.08 })} position={[0, 1.275, 0]} castShadow />
      <mesh geometry={geos.window} material={ready ? texMat("vending", vendingTex, { basic: true }) : toy("#BFF2FF", { glow: 1 })} position={[-0.17, 1.42, 0.456]} />
      <mesh geometry={geos.panel} material={toy("#1A1E2E", { rough: 0.4 })} position={[0.5, 1.42, 0.46]} />
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <mesh key={k} geometry={geos.button} material={toy(k === 2 ? "#5BFF8A" : "#8FE9FF", { glow: 0.9 })} position={[0.45 + (k % 2) * 0.1, 1.8 - Math.floor(k / 2) * 0.1, 0.49]} />
      ))}
      <mesh geometry={geos.slot} material={toy(TIMECO_GOLD, { glow: 0.5, metal: 0.4 })} position={[0.5, 1.25, 0.49]} />
      <mesh geometry={geos.tray} material={toy("#0E1120", { rough: 0.5 })} position={[-0.17, 0.32, 0.43]} />
      <mesh geometry={geos.header} material={toy(TIMECO_RED, { glow: 0.5 })} position={[0, 2.38, 0.44]} />
      {ready ? (
        <mesh geometry={geos.headerFace} material={texMat("vending-head", () => wordmarkTex(true), { basic: true, transparent: true })} position={[0, 2.38, 0.48]} />
      ) : null}
      <Glow color="#9FF3FF" size={3.2} opacity={0.32 * flick} position={[-0.17, 1.42, 0.9]} />
    </group>
  );
};

/** The yellow A-frame "PISO MOJADO" sign (base centre at the origin, front +z). */
export const WetFloorSign: React.FC = () => {
  const ready = useFontsReady();
  const geos = useMemo(() => ({ panel: rbox(0.62, 1.0, 0.04, 0.05), face: new THREE.PlaneGeometry(0.54, 0.86), handle: new THREE.TorusGeometry(0.12, 0.03, 8, 16, Math.PI) }), []);
  const yellow = toy("#FFD21F", { rough: 0.45, glow: 0.22 });
  return (
    <group>
      {[1, -1].map((s) => (
        <group key={s} position={[0, 1.0, 0]} rotation={[s * 0.2, s > 0 ? 0 : Math.PI, 0]}>
          <mesh geometry={geos.panel} material={yellow} position={[0, -0.5, 0.02]} castShadow />
          {ready ? <mesh geometry={geos.face} material={texMat("wet-sign", wetSignTex, { glow: 0.3 })} position={[0, -0.52, 0.045]} /> : null}
        </group>
      ))}
      <mesh geometry={geos.handle} material={yellow} position={[0, 1.02, 0]} />
    </group>
  );
};

/** The lady's yellow mop bucket on wheels with a wringer (base centre at the origin). */
export const MopBucket: React.FC = () => {
  const geos = useMemo(
    () => ({
      body: rbox(0.78, 0.5, 0.56, 0.1),
      water: new THREE.PlaneGeometry(0.66, 0.44).rotateX(-Math.PI / 2),
      wringer: rbox(0.36, 0.32, 0.5, 0.06),
      lever: new THREE.CylinderGeometry(0.025, 0.025, 0.6, 8),
      wheel: new THREE.CylinderGeometry(0.06, 0.06, 0.05, 14).rotateZ(Math.PI / 2),
    }),
    [],
  );
  return (
    <group>
      <mesh geometry={geos.body} material={toy("#FFD23F", { rough: 0.4, glow: 0.2 })} position={[0, 0.35, 0]} castShadow />
      <mesh geometry={geos.water} material={toy("#6FA8FF", { rough: 0.1, glow: 0.3 })} position={[0, 0.56, 0]} />
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
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2 + 0.2;
    const c = new THREE.CapsuleGeometry(0.04, 0.3, 3, 8);
    c.rotateZ(Math.PI / 2 - 0.25);
    c.translate(0.18, 0.04, 0);
    c.rotateY(a);
    strands.push(paintGeo(c, i % 3 ? "#E9EEF7" : "#D3DCEA"));
  }
  return {
    head: mergeAll(strands),
    clamp: rbox(0.16, 0.1, 0.16, 0.03),
    stick: new THREE.CylinderGeometry(0.03, 0.03, 1, 10).translate(0, 0.5, 0),
  };
});

/** A mop: the head (strands) on the floor at `head`, the stick up to `top` (and a little past it). */
export const Mop: React.FC<{ head: V3; top: V3 }> = ({ head, top }) => {
  const g = mopGeos();
  const base: V3 = [head[0], head[1] + 0.06, head[2]];
  const dir = new THREE.Vector3(top[0] - base[0], top[1] - base[1], top[2] - base[2]).normalize();
  const end: V3 = [top[0] + dir.x * 0.18, top[1] + dir.y * 0.18, top[2] + dir.z * 0.18];
  const { len, q } = segmentFrame(base, end);
  return (
    <group>
      <group position={base} quaternion={q}>
        <mesh geometry={g.stick} material={toy("#4FA3E0", { rough: 0.35, glow: 0.18 })} scale={[1, len, 1]} castShadow />
        <mesh geometry={g.clamp} material={toy("#5C6478", { rough: 0.4, metal: 0.3 })} position={[0, 0.02, 0]} />
      </group>
      <mesh geometry={g.head} material={vertexMat(0.35, false, 0.14)} position={[head[0], head[1], head[2]]} />
    </group>
  );
};

/** The night hallway (no lights: add <HallLights>). */
export const Hallway: React.FC<{ t?: number }> = ({ t = 0 }) => {
  const ready = useFontsReady();
  const { x0, x1, zBack, height: H } = HALL;
  const geos = useMemo(() => {
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
    for (const x of HALL_WINDOWS) {
      const cy = (HALL_WIN.y0 + HALL_WIN.y1) / 2;
      const h = HALL_WIN.y1 - HALL_WIN.y0;
      frames.push(place(rbox(HALL_WIN.w + 0.2, 0.12, 0.3, 0.04), "#3A4566", [x, HALL_WIN.y0 - 0.02, zBack]));
      frames.push(place(rbox(HALL_WIN.w + 0.2, 0.12, 0.3, 0.04), "#3A4566", [x, HALL_WIN.y1 + 0.02, zBack]));
      frames.push(place(rbox(0.12, h, 0.3, 0.04), "#3A4566", [x - HALL_WIN.w / 2 - 0.04, cy, zBack]));
      frames.push(place(rbox(0.12, h, 0.3, 0.04), "#3A4566", [x + HALL_WIN.w / 2 + 0.04, cy, zBack]));
      frames.push(place(rbox(0.08, h, 0.12, 0.03), "#3A4566", [x, cy, zBack]));
      frames.push(place(rbox(HALL_WIN.w, 0.08, 0.12, 0.03), "#3A4566", [x, cy + 0.55, zBack]));
      frames.push(place(rbox(HALL_WIN.w + 0.4, 0.08, 0.32, 0.03), "#5A6688", [x, HALL_WIN.y0 - 0.08, zBack + 0.12]));
    }
    frames.push(place(rbox(x1 - x0, 0.2, 0.08, 0.02), "#20263A", [0, 0.1, zBack + 0.04]));
    frames.push(place(rbox(x1 - x0, 0.1, 0.06, 0.02), TIMECO_RED, [0, 0.42, zBack + 0.03]));
    const floor = worldPlane(x1 - x0 + 6, 22);
    floor.rotateX(-Math.PI / 2);
    floor.translate(0, 0, zBack + 11);
    const ceiling = new THREE.PlaneGeometry(x1 - x0 + 6, 22);
    ceiling.rotateX(Math.PI / 2);
    ceiling.translate(0, H, zBack + 11);
    const side = (sgn: number) => {
      const g = new THREE.PlaneGeometry(22, H);
      g.rotateY((-sgn * Math.PI) / 2);
      g.translate(sgn > 0 ? x1 : x0, H / 2, zBack + 11);
      return g;
    };
    return {
      back,
      frames: mergeAll(frames),
      floor,
      ceiling,
      wallL: side(-1),
      wallR: side(1),
      glass: new THREE.PlaneGeometry(HALL_WIN.w, HALL_WIN.y1 - HALL_WIN.y0),
      view: new THREE.PlaneGeometry(26, 9),
      plane: new THREE.PlaneGeometry(1, 1),
      lamp: new THREE.CircleGeometry(0.28, 24).rotateX(Math.PI / 2),
      logo: new THREE.PlaneGeometry(2.2, 0.65),
      exit: new THREE.PlaneGeometry(0.8, 0.3),
      exitBox: rbox(0.9, 0.38, 0.1, 0.04),
      bench: rbox(1.8, 0.12, 0.5, 0.05),
      benchLeg: rbox(0.1, 0.42, 0.42, 0.03),
    };
  }, [x0, x1, zBack, H]);
  const m = hallMats();
  const wallMat = toy("#36405E", { rough: 0.8, glow: 0.1 });
  const cy = (HALL_WIN.y0 + HALL_WIN.y1) / 2;
  const vend = HALL_VENDING;
  return (
    <group>
      <mesh geometry={geos.floor} material={m.tiles} />
      <mesh geometry={geos.ceiling} material={toy("#262D45", { rough: 0.9 })} />
      <mesh geometry={geos.back} material={wallMat} />
      <mesh geometry={geos.wallL} material={wallMat} />
      <mesh geometry={geos.wallR} material={wallMat} />
      <mesh geometry={geos.frames} material={vertexMat(0.5, false, 0.12)} />
      <mesh geometry={geos.view} material={texMat("hall-night", nightTex, { basic: true })} position={[0, 3.2, zBack - 4]} />
      {HALL_WINDOWS.map((x) => (
        <group key={x}>
          <mesh geometry={geos.glass} material={m.glass} position={[x, cy, zBack + 0.02]} />
          {/* Moonlight through the window onto the wet floor, and its reflection. */}
          <mesh geometry={geos.plane} material={m.shaft} position={[x + 0.5, 0.012, zBack + 2.6]} rotation={[-Math.PI / 2, 0, -0.18]} scale={[HALL_WIN.w * 0.95, 4.6, 1]} />
          <mesh geometry={geos.plane} material={m.reflectWin} position={[x, 0.014, zBack + 1.1]} rotation={[-Math.PI / 2, 0, 0]} scale={[HALL_WIN.w * 0.8, 1.9, 1]} />
        </group>
      ))}
      {/* Dim ceiling lamps. */}
      {[-4, 0, 4].map((x) => (
        <mesh key={x} geometry={geos.lamp} material={m.lamp} position={[x, H - 0.01, 0.8]} />
      ))}
      {/* TIMECO's neon logo between the windows, the exit sign on the left, a bench. */}
      {ready ? (
        <>
          <mesh geometry={geos.logo} material={texMat("hall-logo", () => wordmarkTex(true), { basic: true, transparent: true })} position={[2.9, 4.25, zBack + 0.05]} />
          <group position={[-6.6, 3.2, zBack + 0.06]}>
            <mesh geometry={geos.exitBox} material={toy("#1A1E2E")} />
            <mesh geometry={geos.exit} material={texMat("hall-exit", exitTex, { basic: true })} position={[0, 0, 0.06]} />
          </group>
        </>
      ) : null}
      <Glow color="#FF3030" size={3.4} opacity={0.22} position={[2.9, 4.25, zBack + 0.3]} />
      <Glow color="#30FF7A" size={1.4} opacity={0.3} position={[-6.6, 3.2, zBack + 0.3]} />
      <group position={[-6.2, 0, zBack + 0.5]}>
        <mesh geometry={geos.bench} material={toy("#4A5578", { rough: 0.5 })} position={[0, 0.48, 0]} />
        {[-0.7, 0.7].map((x) => (
          <mesh key={x} geometry={geos.benchLeg} material={toy("#2A3048")} position={[x, 0.21, 0]} />
        ))}
      </group>
      <group position={vend}>
        <VendingMachine t={t} />
      </group>
      <mesh geometry={geos.plane} material={m.reflectVend} position={[vend[0] - 0.17, 0.016, vend[2] + 1.6]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.1, 2.4, 1]} />
      <group position={HALL_SIGN} rotation={[0, 0.35, 0]}>
        <WetFloorSign />
      </group>
      <group position={HALL_BUCKET} rotation={[0, -0.3, 0]}>
        <MopBucket />
      </group>
    </group>
  );
};

/** Night lights: blue fill, moonlight from the windows (rim), a soft front fill, the vending glow. */
export const HallLights: React.FC<{ k?: number }> = ({ k = 1 }) => (
  <>
    <hemisphereLight args={["#93A3F0", "#262B45", 1.15 * k]} />
    <directionalLight position={[-2, 6, -9]} intensity={1.7} color="#A6BCFF" />
    <directionalLight position={[2, 4.5, 10]} intensity={1.15 * k} color="#CFC8FF" />
    <pointLight position={[HALL_VENDING[0] - 0.2, 1.5, HALL_VENDING[2] + 1.3]} intensity={6} distance={7} decay={1.3} color="#8DF2FF" />
  </>
);

// =======================================================================================
// The old cleaning lady

export const LADY_SIZE = 1.7;
export const LADY_LAVENDER = "#B9A3E3";
export const LADY_PALETTE: NubiPalette = { body: LADY_LAVENDER, legs: "#A38CD2" };

const ladyGeos = once(() => {
  const front = NB.front;
  return {
    cap: rbox(10.5, 1.9, 9.3, 0.8, 3),
    bun: new THREE.SphereGeometry(1.7, 22, 16),
    bunBand: new THREE.TorusGeometry(1.25, 0.28, 8, 24),
    pin: new THREE.CylinderGeometry(0.12, 0.12, 4.2, 8),
    ring: new THREE.TorusGeometry(1.2, 0.13, 8, 28),
    bridge: new THREE.CylinderGeometry(0.1, 0.1, 1.1, 8).rotateZ(Math.PI / 2),
    temple: rbox(0.18, 0.18, 4.2, 0.06),
    arm: rbox(1.75, 0.18, 0.18, 0.06),
    lens: new THREE.CircleGeometry(1.08, 24),
    bib: rbox(6.4, 2.6, 0.24, 0.3),
    pocket: rbox(3.0, 1.0, 0.14, 0.12),
    rag: rbox(0.9, 0.8, 0.3, 0.2),
    strap: rbox(0.5, 5.6, 0.16, 0.08),
    waist: bandGeo(3.0, 3.45, 0.12),
    bow: new THREE.TorusGeometry(0.5, 0.18, 8, 16),
    front,
  };
});

/**
 * The lady's look (child of her <Nubi>, model units): grey hair with a bun and two pins, round
 * glasses that follow the eyes, a pale-yellow apron (bib, pocket with a rag, straps, waist ties),
 * and sad lids (`sad` 0..1).
 */
export const LadyOutfit: React.FC<{ pose: NubiPose; sad?: number; glint?: number }> = ({ pose, sad = 0.5, glint = 0 }) => {
  const g = ladyGeos();
  const { ex, ey } = eyeShape(pose);
  const hair = toy("#CFCFDA", { rough: 0.75, glow: 0.16 });
  const frame = toy("#7B5B8F", { rough: 0.35, glow: 0.12 });
  const apron = toy("#FFF0A6", { rough: 0.7, glow: 0.2 });
  const apronDark = toy("#F2D97A", { rough: 0.7, glow: 0.18 });
  const lensMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.12, depthWrite: false }), []);
  lensMat.opacity = 0.1 + 0.4 * glint;
  const F = g.front;
  return (
    <group>
      {/* Hair: a grey cap over the top, the bun and its pins. */}
      <mesh geometry={g.cap} material={hair} position={[0, 9.75, -0.1]} castShadow />
      <mesh geometry={g.bun} material={hair} position={[0, 11.75, -0.7]} scale={[1, 0.88, 1]} castShadow />
      <mesh geometry={g.bunBand} material={toy("#9C7FD0", { rough: 0.5 })} position={[0, 10.75, -0.7]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={g.pin} material={toy("#6B4A2E", { rough: 0.5 })} position={[0, 12.1, -0.7]} rotation={[0.2, 0, 1.0]} />
      <mesh geometry={g.pin} material={toy("#6B4A2E", { rough: 0.5 })} position={[0, 12.1, -0.7]} rotation={[-0.2, 0, -1.0]} />
      {/* Round glasses. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={g.ring} material={frame} position={[s * 2.3 + ex, ey + 0.05, F + 0.55]} scale={[0.9, 1.05, 1]} />
          <mesh geometry={g.lens} material={lensMat} position={[s * 2.3 + ex, ey + 0.05, F + 0.56]} scale={[0.9, 1.05, 1]} />
          <mesh geometry={g.arm} material={frame} position={[s * (4.25 + ex * s * 0.5), ey + 0.25, F + 0.5]} />
          <mesh geometry={g.temple} material={frame} position={[s * 5.12, ey + 0.25, F - 1.6]} />
        </group>
      ))}
      <mesh geometry={g.bridge} material={frame} position={[ex, ey + 0.3, F + 0.55]} />
      {/* Apron. */}
      <mesh geometry={g.bib} material={apron} position={[0, 2.95, F + 0.12]} castShadow />
      <mesh geometry={g.pocket} material={apronDark} position={[0, 2.45, F + 0.3]} />
      <mesh geometry={g.rag} material={toy("#58B7F0", { rough: 0.8 })} position={[0.85, 3.05, F + 0.25]} rotation={[0, 0, 0.25]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={g.strap} material={apron} position={[s * 3.9, 7.2, F + 0.08]} />
      ))}
      <mesh geometry={g.waist} material={apron} />
      <mesh geometry={g.bow} material={apron} position={[0.6, 3.25, -4.75]} scale={[1, 0.7, 0.6]} />
      <mesh geometry={g.bow} material={apron} position={[-0.6, 3.25, -4.75]} scale={[1, 0.7, 0.6]} />
      <Lids pose={pose} droop={0.28 + 0.3 * sad} tilt={0.18 + 0.2 * sad} color={shadeHex(LADY_LAVENDER, -0.08)} />
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
  holdR?: React.ReactNode;
  holdL?: React.ReactNode;
  shadowOpacity?: number;
}> = ({ pose = {}, position, rotationY, sad, glint, holdR, holdL, shadowOpacity = 0.4 }) => (
  <Nubi size={LADY_SIZE} palette={LADY_PALETTE} pose={pose} position={position} rotationY={rotationY} holdR={holdR} holdL={holdL} shadowOpacity={shadowOpacity}>
    <LadyOutfit pose={pose} sad={sad} glint={glint} />
  </Nubi>
);

/** Height of the top of the lady's bun above her feet (model units → × size / 10). */
export const LADY_BUN_TOP = 13.2;

// =======================================================================================
// FX: the stream of life, hearts

/**
 * A stream of glowing green particles flowing from `from` to `to` along an arc (`lift` up), with
 * a bright core. `amount` 0..1 fades it; `t` = seconds.
 */
export const LifeStream: React.FC<{ from: V3; to: V3; t: number; amount: number; count?: number; lift?: number; color?: string }> = ({
  from,
  to,
  t,
  amount,
  count = 34,
  lift = 0.7,
  color = "#5CFF8A",
}) => {
  const glow = useMemo(() => additive(new THREE.SpriteMaterial({ map: glowTexture(), color, toneMapped: false })), [color]);
  const core = useMemo(() => additive(new THREE.SpriteMaterial({ map: glowTexture(), color: "#EFFFF3", toneMapped: false })), []);
  if (amount <= 0.01) return null;
  glow.opacity = Math.min(1, amount);
  core.opacity = Math.min(1, amount) * 0.9;
  const c: V3 = [(from[0] + to[0]) / 2, Math.max(from[1], to[1]) + lift, (from[2] + to[2]) / 2];
  const at = (u: number): V3 => {
    const a = (1 - u) * (1 - u);
    const b = 2 * u * (1 - u);
    const d = u * u;
    return [a * from[0] + b * c[0] + d * to[0], a * from[1] + b * c[1] + d * to[1], a * from[2] + b * c[2] + d * to[2]];
  };
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => {
        const u = frac(t * 0.8 + i / count + hash(i) * 0.04);
        const p = at(u);
        const w = 0.09 * Math.sin(Math.PI * u);
        const s = (0.16 + 0.12 * hash(i + 7)) * (0.55 + 0.45 * Math.sin(Math.PI * u)) * (0.8 + 0.2 * Math.sin(t * 9 + i));
        const pos: V3 = [p[0] + w * Math.sin(t * 5 + i * 1.7), p[1] + w * Math.cos(t * 6 + i * 2.3), p[2] + w * Math.sin(t * 4 + i)];
        return (
          <group key={i}>
            <sprite material={glow} position={pos} scale={[s * 2.2, s * 2.2, 1]} />
            {i % 3 === 0 ? <sprite material={core} position={pos} scale={[s * 0.8, s * 0.8, 1]} /> : null}
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
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 12 });
  g.translate(0, 0, -0.09);
  return g;
});

/** Little hearts floating up from `position` from frame `at` (g = global frame). */
export const Hearts: React.FC<{ g: number; at: number; position: V3; count?: number; spread?: number; size?: number }> = ({ g, at, position, count = 7, spread = 0.9, size = 0.26 }) => {
  const d = g - at;
  if (d < 0) return null;
  const pink = toy("#FF5C8A", { rough: 0.35, glow: 0.35 });
  const red = toy(TIMECO_RED, { rough: 0.35, glow: 0.35 });
  return (
    <group position={position}>
      {Array.from({ length: count }).map((_, i) => {
        const local = d - i * 3.2;
        if (local < 0 || local > 40) return null;
        const k = local / 40;
        const pop = Math.min(1, local / 6);
        const s = size * (0.7 + 0.5 * hash(i + 3)) * pop * (1 - smooth(0.75, 1, k));
        const x = (hash(i) - 0.5) * spread + 0.12 * Math.sin(local * 0.25 + i);
        return (
          <mesh
            key={i}
            geometry={heartGeo()}
            material={i % 3 === 1 ? red : pink}
            position={[x, k * 1.5, (hash(i + 9) - 0.5) * 0.4]}
            rotation={[0, 0, 0.3 * Math.sin(local * 0.2 + i)]}
            scale={s}
          />
        );
      })}
    </group>
  );
};

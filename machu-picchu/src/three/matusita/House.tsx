import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FONT } from "../../theme";
import { V3, canvasTexture, paintGeo, toy, useFontsReady, vertexMat } from "../inca/kit";
import { mulberry } from "../noise";
import { NubiPose } from "../Nubi";
import { Glow, additive } from "../thanos/FX";
import { Flashlight } from "./Flashlight";

// The inside of the Casa Matusita at night, for the camcorder shots "entrada" and "pasillo", and
// the bits they share: the hall with the rusty front door (the rainy street and its orange lamp
// behind it), the long hallway (sepia photos, the staircase into the dark, the moonlit window at
// the end), Nubi's PRENSA badge and TV microphone, the flashlight held at a fin tip, dust, rain
// and the fake shadows on the hallway wall.
//
// World units are sized for Nubi at size 2 (2 wide, ≈ 2 tall); floor y = 0; +z points towards
// the camera. Walls are one-sided planes facing into the rooms, so a camera can sit outside one.
// Everything is deterministic: `t` is time in seconds (global frame / 30), `g` the global frame.
//
// HALL (entrance hall): x −4.4..4.4, back wall at z = −3 with the front door in the middle
//   (HALL_DOOR, hinge on the left, opens inwards), a fanlight over it, the street behind it; a
//   moonlit window on the right wall, a broken chandelier, a console on the left, a sheeted chair.
// CORRIDOR (the hallway, a separate set): x −2.4..2.4, from z = 9 (towards the hall) to the end
//   wall at z = −16 with a small moonlit window. Left wall: the sepia photos (the scratched one at
//   z ≈ −4). Right side: the staircase rising away from z = −5.5 into a dark stairwell.

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Lazily built value shared by every instance (static geometry, materials). */
const once = <T,>(make: () => T) => {
  let v: T | undefined;
  return () => (v ??= make());
};
const rbox = (w: number, h: number, d: number, r: number, seg = 2) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));
/** Plane w × h whose uvs are in world units (tiling textures). */
const worldPlane = (w: number, h: number) => {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  return g;
};
const tiled = (tex: THREE.Texture, unit: number) => {
  const t = tex.clone();
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / unit, 1 / unit);
  t.needsUpdate = true;
  return t;
};

type Ctx = CanvasRenderingContext2D;
const HEAVY = `'${FONT.heavy}', sans-serif`;

// =======================================================================================
// Canvas textures

const wobblyPath = (ctx: Ctx, x: number, y: number, rad: number, r: () => number, n = 18, amt = 0.4, squash = 0.85) => {
  const k = Array.from({ length: n }, () => 1 - amt / 2 + r() * amt);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = rad * k[i % n];
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr * squash;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
};

const damask = (ctx: Ctx, cx: number, cy: number, s: number) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = "rgba(52,38,20,0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.26, s * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sd * s * 0.42, -s * 0.1, s * 0.15, s * 0.42, sd * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(sd * s * 0.3, s * 0.5, s * 0.1, s * 0.25, -sd * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, -s * 0.84, s * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,226,160,0.10)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.26, s * 0.6, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

/** Faded ochre damask wallpaper (tile = WALLPAPER_UNIT world units). */
const WALLPAPER_UNIT = 2.4;
const wallpaperTex = () =>
  canvasTexture(
    "mat-wallpaper",
    512,
    512,
    (ctx, w, h) => {
      const r = mulberry(31);
      ctx.fillStyle = "#806F4C";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 16; i++) {
        ctx.fillStyle = i % 2 ? "rgba(48,36,20,0.14)" : "rgba(255,236,190,0.05)";
        ctx.fillRect((i * w) / 16, 0, w / 16, h);
      }
      const cell = w / 4;
      for (let row = -1; row <= 4; row++)
        for (let col = -1; col <= 4; col++) damask(ctx, (col + (row & 1) * 0.5) * cell, row * cell, cell * 0.36);
      for (let i = 0; i < 500; i++) {
        ctx.fillStyle = `rgba(30,22,12,${r() * 0.3})`;
        ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
      }
    },
    { wrapS: true, wrapT: true },
  );

/** Damp stains, water runs, peeled patches and grime for one wall (not tiled, transparent). */
const stainTex = (seed: number) =>
  canvasTexture(`mat-stains-${seed}`, 1024, 512, (ctx, w, h) => {
    const r = mulberry(seed);
    let g = ctx.createLinearGradient(0, h, 0, h * 0.72);
    g.addColorStop(0, "rgba(20,14,8,0.65)");
    g.addColorStop(1, "rgba(20,14,8,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
    g = ctx.createLinearGradient(0, 0, 0, h * 0.2);
    g.addColorStop(0, "rgba(20,14,8,0.6)");
    g.addColorStop(1, "rgba(20,14,8,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h * 0.2);
    for (let i = 0; i < 16; i++) {
      const x = r() * w;
      const len = h * (0.15 + r() * 0.6);
      const lw = 4 + r() * 22;
      const lg = ctx.createLinearGradient(0, 0, 0, len);
      lg.addColorStop(0, `rgba(36,24,10,${0.3 + r() * 0.3})`);
      lg.addColorStop(1, "rgba(36,24,10,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(x, 0, lw, len);
    }
    for (let i = 0; i < 7; i++) {
      const x = r() * w;
      const y = h * (0.1 + r() * 0.7);
      const rad = 40 + r() * 120;
      wobblyPath(ctx, x, y, rad, r, 22, 0.45);
      ctx.fillStyle = "rgba(44,30,14,0.3)";
      ctx.fill();
      ctx.strokeStyle = "rgba(34,22,8,0.55)";
      ctx.lineWidth = 4;
      ctx.stroke();
      wobblyPath(ctx, x + rad * 0.1, y + rad * 0.05, rad * 0.62, r, 18, 0.4);
      ctx.strokeStyle = "rgba(34,22,8,0.35)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // Peeled wallpaper: plaster showing through, torn dark edges, a pale curl.
    for (let i = 0; i < 6; i++) {
      const x = r() * w;
      const y = h * (0.12 + r() * 0.6);
      const rad = 26 + r() * 70;
      wobblyPath(ctx, x, y, rad, r, 14, 0.8, 1.3);
      ctx.fillStyle = "#A39A84";
      ctx.fill();
      ctx.strokeStyle = "rgba(30,22,12,0.9)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.strokeStyle = "rgba(225,210,170,0.8)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, rad * 0.95, -0.4 + r(), 0.9 + r());
      ctx.stroke();
      for (let k = 0; k < 12; k++) {
        ctx.fillStyle = `rgba(60,50,36,${r() * 0.4})`;
        ctx.fillRect(x + (r() - 0.5) * rad, y + (r() - 0.5) * rad, 2 + r() * 4, 2 + r() * 4);
      }
    }
    for (let i = 0; i < 1100; i++) {
      const y = h - Math.pow(r(), 2.2) * h * 0.4;
      ctx.fillStyle = `rgba(14,16,8,${r() * 0.55})`;
      ctx.fillRect(r() * w, y, 1 + r() * 3, 1 + r() * 3);
    }
  });

/** Dusty black-and-white floor tiles, 8 × 8 tiles of 0.5 (tile = 4 world units). */
const CHECKER_UNIT = 4;
const checkerTex = () =>
  canvasTexture(
    "mat-checker",
    1024,
    1024,
    (ctx, w) => {
      const r = mulberry(7);
      const n = 8;
      const s = w / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const white = (i + j) % 2 === 0;
          const v = r();
          ctx.fillStyle = white ? `hsl(40, 16%, ${54 + v * 12}%)` : `hsl(30, 8%, ${8 + v * 6}%)`;
          ctx.fillRect(i * s, j * s, s, s);
          if (r() < 0.2) {
            // A cracked tile.
            ctx.strokeStyle = white ? "rgba(40,32,24,0.8)" : "rgba(120,110,96,0.5)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            let x = i * s + r() * s;
            let y = j * s;
            ctx.moveTo(x, y);
            for (let k = 0; k < 5; k++) {
              x += (r() - 0.5) * s * 0.4;
              y += s / 5;
              ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
          if (r() < 0.12) {
            // A chipped corner.
            ctx.fillStyle = "rgba(48,40,30,0.95)";
            ctx.beginPath();
            const cx = i * s + (r() < 0.5 ? 0 : s);
            const cy = j * s + (r() < 0.5 ? 0 : s);
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + (cx > i * s ? -1 : 1) * s * 0.3, cy);
            ctx.lineTo(cx, cy + (cy > j * s ? -1 : 1) * s * 0.25);
            ctx.fill();
          }
        }
      ctx.strokeStyle = "rgba(26,22,16,0.95)";
      ctx.lineWidth = 3;
      for (let i = 0; i <= n; i++) {
        ctx.beginPath();
        ctx.moveTo(i * s, 0);
        ctx.lineTo(i * s, w);
        ctx.moveTo(0, i * s);
        ctx.lineTo(w, i * s);
        ctx.stroke();
      }
      // Dust and grime.
      for (let i = 0; i < 26; i++) {
        const x = r() * w;
        const y = r() * w;
        const rad = 60 + r() * 220;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        const dust = r() < 0.6;
        g.addColorStop(0, dust ? `rgba(150,140,120,${0.12 + r() * 0.16})` : `rgba(18,12,6,${0.2 + r() * 0.25})`);
        g.addColorStop(1, dust ? "rgba(150,140,120,0)" : "rgba(18,12,6,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      for (let i = 0; i < 2500; i++) {
        ctx.fillStyle = r() < 0.5 ? `rgba(20,16,10,${r() * 0.4})` : `rgba(190,180,160,${r() * 0.18})`;
        ctx.fillRect(r() * w, r() * w, 1 + r() * 2, 1 + r() * 2);
      }
    },
    { wrapS: true, wrapT: true },
  );

/** Old floorboards running along the hallway (tile = 2.4 world units). */
const BOARDS_UNIT = 2.4;
const boardsTex = () =>
  canvasTexture(
    "mat-boards",
    512,
    512,
    (ctx, w, h) => {
      const r = mulberry(19);
      const n = 8;
      const s = w / n;
      for (let i = 0; i < n; i++) {
        let y = -r() * h;
        while (y < h) {
          const len = h * (0.45 + r() * 0.7);
          ctx.fillStyle = `hsl(${22 + r() * 8}, ${26 + r() * 12}%, ${15 + r() * 9}%)`;
          ctx.fillRect(i * s, y, s, len);
          for (let k = 0; k < 9; k++) {
            ctx.strokeStyle = `rgba(${r() < 0.5 ? "20,12,6" : "120,90,60"},${0.15 + r() * 0.2})`;
            ctx.lineWidth = 1 + r() * 1.5;
            ctx.beginPath();
            const x0 = i * s + r() * s;
            ctx.moveTo(x0, y);
            ctx.bezierCurveTo(x0 + (r() - 0.5) * 8, y + len * 0.3, x0 + (r() - 0.5) * 8, y + len * 0.6, x0 + (r() - 0.5) * 6, y + len);
            ctx.stroke();
          }
          ctx.fillStyle = "rgba(8,5,3,0.9)";
          ctx.fillRect(i * s, y, s, 3);
          y += len;
        }
        ctx.fillStyle = "rgba(6,4,2,0.95)";
        ctx.fillRect(i * s, 0, 3, h);
      }
      for (let i = 0; i < 18; i++) {
        const x = r() * w;
        const y = r() * h;
        const rad = 40 + r() * 140;
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, `rgba(140,128,108,${0.08 + r() * 0.12})`);
        g.addColorStop(1, "rgba(140,128,108,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
    },
    { wrapS: true, wrapT: true },
  );

/** Dark varnished wood (tile = 1 world unit). */
const woodTex = () =>
  canvasTexture(
    "mat-wood",
    256,
    256,
    (ctx, w, h) => {
      const r = mulberry(5);
      ctx.fillStyle = "#3B281A";
      ctx.fillRect(0, 0, w, h);
      for (let k = 0; k < 60; k++) {
        ctx.strokeStyle = `rgba(${r() < 0.5 ? "16,9,4" : "110,76,46"},${0.12 + r() * 0.2})`;
        ctx.lineWidth = 1 + r() * 2;
        const y0 = r() * h;
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.bezierCurveTo(w * 0.3, y0 + (r() - 0.5) * 10, w * 0.6, y0 + (r() - 0.5) * 10, w, y0);
        ctx.stroke();
      }
    },
    { wrapS: true, wrapT: true },
  );

/** Wainscot panels below the chair rail (tile = WAINSCOT.w × WAINSCOT.h world units). */
const WAINSCOT = { w: 1.2, h: 1.05 };
const wainscotTex = () =>
  canvasTexture(
    "mat-wainscot",
    256,
    224,
    (ctx, w, h) => {
      const r = mulberry(23);
      ctx.fillStyle = "#33231A";
      ctx.fillRect(0, 0, w, h);
      const m = 26;
      ctx.fillStyle = "#2A1C13";
      ctx.fillRect(m, m, w - 2 * m, h - 2 * m);
      ctx.strokeStyle = "rgba(150,110,70,0.35)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(m, h - m);
      ctx.lineTo(m, m);
      ctx.lineTo(w - m, m);
      ctx.stroke();
      ctx.strokeStyle = "rgba(8,4,2,0.8)";
      ctx.beginPath();
      ctx.moveTo(w - m, m);
      ctx.lineTo(w - m, h - m);
      ctx.lineTo(m, h - m);
      ctx.stroke();
      for (let k = 0; k < 40; k++) {
        ctx.strokeStyle = `rgba(${r() < 0.5 ? "12,7,3" : "100,70,40"},${0.1 + r() * 0.2})`;
        ctx.lineWidth = 1;
        const x0 = r() * w;
        ctx.beginPath();
        ctx.moveTo(x0, 0);
        ctx.lineTo(x0 + (r() - 0.5) * 8, h);
        ctx.stroke();
      }
      for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(150,140,120,${r() * 0.15})`;
        ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1);
      }
    },
    { wrapS: true, wrapT: true },
  );

/** Cracked, stained plaster ceiling (tile = 4 world units). */
const ceilingTex = () =>
  canvasTexture(
    "mat-ceiling",
    512,
    512,
    (ctx, w, h) => {
      const r = mulberry(41);
      ctx.fillStyle = "#4C4840";
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 6; i++) {
        wobblyPath(ctx, r() * w, r() * h, 30 + r() * 90, r, 20, 0.5, 1);
        ctx.fillStyle = "rgba(40,28,14,0.25)";
        ctx.fill();
        ctx.strokeStyle = "rgba(34,22,10,0.5)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(14,10,6,0.7)";
      for (let i = 0; i < 9; i++) {
        let x = r() * w;
        let y = r() * h;
        ctx.lineWidth = 1 + r() * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 10; k++) {
          x += (r() - 0.5) * 50;
          y += (r() - 0.5) * 50;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
    { wrapS: true, wrapT: true },
  );

/** The rusty front door (inner face): flaking green paint over rust, embossed panels, rivets. */
const rustTex = () =>
  canvasTexture("mat-door-rust", 256, 480, (ctx, w, h) => {
    const r = mulberry(13);
    ctx.fillStyle = "#4A3022";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      wobblyPath(ctx, r() * w, r() * h, 6 + r() * 30, r, 12, 0.7, 1);
      ctx.fillStyle = r() < 0.55 ? `rgba(150,74,30,${0.3 + r() * 0.4})` : `rgba(58,84,66,${0.5 + r() * 0.4})`;
      ctx.fill();
    }
    for (let i = 0; i < 40; i++) {
      const x = r() * w;
      const lg = ctx.createLinearGradient(0, 0, 0, h);
      lg.addColorStop(0, "rgba(30,16,8,0)");
      lg.addColorStop(0.5, `rgba(30,16,8,${0.3 + r() * 0.3})`);
      lg.addColorStop(1, "rgba(30,16,8,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(x, r() * h * 0.5, 2 + r() * 5, h * (0.2 + r() * 0.5));
    }
    // Embossed panels (2 × 3).
    const m = 20;
    const pw = (w - 3 * m) / 2;
    const ph = (h - 4 * m) / 3;
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 3; j++) {
        const x = m + i * (pw + m);
        const y = m + j * (ph + m);
        ctx.strokeStyle = "rgba(200,140,90,0.35)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, y + ph);
        ctx.lineTo(x, y);
        ctx.lineTo(x + pw, y);
        ctx.stroke();
        ctx.strokeStyle = "rgba(12,6,2,0.8)";
        ctx.beginPath();
        ctx.moveTo(x + pw, y);
        ctx.lineTo(x + pw, y + ph);
        ctx.lineTo(x, y + ph);
        ctx.stroke();
      }
    ctx.fillStyle = "rgba(20,12,6,0.9)";
    for (let k = 0; k < 14; k++) {
      for (const x of [8, w - 8]) {
        ctx.beginPath();
        ctx.arc(x, 12 + (k * (h - 24)) / 13, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

type PhotoKind = 0 | 1 | 2 | 3 | 4;
/** Nubi-shaped sitter on an old photo (canvas units). */
const sitter = (ctx: Ctx, x: number, y: number, s: number, o: { hat?: "top" | "bowler" | "bow"; eyes?: boolean } = {}) => {
  ctx.fillStyle = "#4A3825";
  // Legs, body, fins.
  for (const lx of [-0.42, -0.14, 0.14, 0.42]) ctx.fillRect(x + lx * s - s * 0.09, y - s * 0.26, s * 0.18, s * 0.26);
  ctx.beginPath();
  ctx.roundRect(x - s * 0.5, y - s * 0.98, s, s * 0.76, s * 0.08);
  ctx.fill();
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + sd * s * 0.48, y - s * 0.72);
    ctx.lineTo(x + sd * s * 0.74, y - s * 0.6);
    ctx.lineTo(x + sd * s * 0.72, y - s * 0.5);
    ctx.lineTo(x + sd * s * 0.48, y - s * 0.46);
    ctx.fill();
  }
  if (o.eyes !== false) {
    ctx.fillStyle = "#1E140B";
    for (const sd of [-1, 1]) ctx.fillRect(x + sd * s * 0.23 - s * 0.05, y - s * 0.72, s * 0.1, s * 0.17);
  }
  ctx.fillStyle = "#2A1D12";
  if (o.hat === "top") {
    ctx.fillRect(x - s * 0.3, y - s * 1.0 - s * 0.05, s * 0.6, s * 0.06);
    ctx.fillRect(x - s * 0.2, y - s * 1.0 - s * 0.36, s * 0.4, s * 0.32);
  } else if (o.hat === "bowler") {
    ctx.fillRect(x - s * 0.28, y - s * 1.02, s * 0.56, s * 0.05);
    ctx.beginPath();
    ctx.arc(x, y - s * 1.0, s * 0.18, Math.PI, 0);
    ctx.fill();
  } else if (o.hat === "bow") {
    ctx.beginPath();
    ctx.moveTo(x, y - s * 1.0);
    ctx.lineTo(x - s * 0.18, y - s * 1.12);
    ctx.lineTo(x - s * 0.18, y - s * 0.92);
    ctx.lineTo(x + s * 0.18, y - s * 1.12);
    ctx.lineTo(x + s * 0.18, y - s * 0.92);
    ctx.closePath();
    ctx.fill();
  }
};

/** Sepia photos of Nubi-shaped people (kind 3: the face scratched out). Mat included. */
const photoTex = (kind: PhotoKind) =>
  canvasTexture(`mat-photo-${kind}`, 256, 320, (ctx, w, h) => {
    const r = mulberry(100 + kind);
    ctx.fillStyle = "#D8C9A6";
    ctx.fillRect(0, 0, w, h);
    const m = 22;
    const g = ctx.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h / 2, h * 0.62);
    g.addColorStop(0, "#C7A97A");
    g.addColorStop(0.7, "#9C7C52");
    g.addColorStop(1, "#5E4429");
    ctx.fillStyle = g;
    ctx.fillRect(m, m, w - 2 * m, h - 2 * m);
    // Studio backdrop line, then the sitters.
    ctx.fillStyle = "rgba(70,50,30,0.25)";
    ctx.fillRect(m, h * 0.68, w - 2 * m, h * 0.32 - m);
    const base = h * 0.8;
    if (kind === 0) sitter(ctx, w / 2, base, 120, { hat: "top" });
    if (kind === 1) {
      sitter(ctx, w * 0.33, base, 84, { hat: "bow" });
      sitter(ctx, w * 0.67, base, 92, { hat: "bowler" });
    }
    if (kind === 2) {
      sitter(ctx, w * 0.3, base, 80, { hat: "top" });
      sitter(ctx, w * 0.7, base, 76, { hat: "bow" });
      sitter(ctx, w * 0.5, base, 48);
    }
    if (kind === 3) {
      sitter(ctx, w / 2, base, 130, { eyes: false });
      // Scratched out: frantic pale gouges over the face.
      ctx.strokeStyle = "rgba(240,230,205,0.95)";
      for (let i = 0; i < 26; i++) {
        ctx.lineWidth = 1.5 + r() * 3;
        ctx.beginPath();
        const cx = w / 2 + (r() - 0.5) * 90;
        const cy = base - 130 * 0.68 + (r() - 0.5) * 70;
        const a = -0.9 + r() * 0.5;
        ctx.moveTo(cx - Math.cos(a) * 50, cy - Math.sin(a) * 50);
        ctx.lineTo(cx + Math.cos(a) * 50, cy + Math.sin(a) * 50);
        ctx.stroke();
      }
    }
    if (kind === 4) {
      // The house itself, years ago.
      ctx.fillStyle = "#4A3825";
      ctx.fillRect(w * 0.18, h * 0.32, w * 0.64, h * 0.5);
      ctx.fillStyle = "#2A1D12";
      for (const [x, y] of [
        [0.28, 0.4],
        [0.48, 0.4],
        [0.66, 0.4],
        [0.28, 0.6],
        [0.66, 0.6],
      ])
        ctx.fillRect(w * x, h * y, w * 0.1, h * 0.12);
      ctx.fillRect(w * 0.46, h * 0.62, w * 0.12, h * 0.2);
    }
    // Foxing, a crease, vignette.
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(90,60,30,${r() * 0.35})`;
      ctx.beginPath();
      ctx.arc(r() * w, r() * h, 1 + r() * 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(255,245,220,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h * (0.2 + r() * 0.5));
    ctx.lineTo(w, h * (0.2 + r() * 0.5));
    ctx.stroke();
  });

/** A corner cobweb: dense at the top-left corner, threads fanning out, sagging spirals. */
const cobwebTex = () =>
  canvasTexture("mat-cobweb", 256, 256, (ctx, w) => {
    const r = mulberry(77);
    ctx.clearRect(0, 0, w, w);
    ctx.strokeStyle = "rgba(235,235,235,0.75)";
    const spokes = 9;
    const ang = (i: number) => (i / (spokes - 1)) * (Math.PI / 2);
    for (let i = 0; i < spokes; i++) {
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang(i)) * w * 1.05, Math.sin(ang(i)) * w * 1.05);
      ctx.stroke();
    }
    for (let k = 1; k < 9; k++) {
      const rad = (k / 9) * w * 0.98;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (let i = 0; i < spokes; i++) {
        const a0 = ang(i);
        const x = Math.cos(a0) * rad;
        const y = Math.sin(a0) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else {
          const am = (ang(i - 1) + a0) / 2;
          const sag = rad * (0.88 - r() * 0.05);
          ctx.quadraticCurveTo(Math.cos(am) * sag, Math.sin(am) * sag, x, y);
        }
      }
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(220,220,215,0.25)";
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.18, 0, Math.PI / 2);
    ctx.lineTo(0, 0);
    ctx.fill();
  });

/** Wet asphalt with puddles (tile = 3 world units). */
const asphaltTex = () =>
  canvasTexture(
    "mat-asphalt",
    512,
    512,
    (ctx, w) => {
      const r = mulberry(55);
      ctx.fillStyle = "#16171B";
      ctx.fillRect(0, 0, w, w);
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = r() < 0.5 ? `rgba(0,0,0,${r() * 0.5})` : `rgba(90,90,100,${r() * 0.25})`;
        ctx.fillRect(r() * w, r() * w, 1 + r() * 2, 1 + r() * 2);
      }
      for (let i = 0; i < 7; i++) {
        wobblyPath(ctx, r() * w, r() * w, 30 + r() * 70, r, 16, 0.5, 0.6);
        ctx.fillStyle = "rgba(40,46,60,0.8)";
        ctx.fill();
      }
    },
    { wrapS: true, wrapT: true },
  );

/** The house across the street: dark wall, shutters, one dim warm window. */
const facadeTex = () =>
  canvasTexture("mat-facade", 1024, 512, (ctx, w, h) => {
    const r = mulberry(61);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0B0E18");
    g.addColorStop(1, "#1B1F2B");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) {
      ctx.fillStyle = `rgba(0,0,0,${r() * 0.4})`;
      ctx.fillRect(r() * w, r() * h, 2 + r() * 4, 1 + r() * 3);
    }
    ctx.fillStyle = "#06070C";
    for (const x of [0.12, 0.34, 0.58, 0.8]) {
      ctx.fillRect(w * x, h * 0.18, w * 0.08, h * 0.2);
      ctx.fillRect(w * x, h * 0.55, w * 0.08, h * 0.24);
    }
    ctx.fillStyle = "rgba(255,170,90,0.55)";
    ctx.fillRect(w * 0.585, h * 0.185, w * 0.07, h * 0.19);
    ctx.fillStyle = "#101320";
    ctx.fillRect(0, h * 0.46, w, h * 0.03);
  });

/** What the small hallway window shows: night sky, the moon, a bare branch. */
const moonTex = () =>
  canvasTexture("mat-moon-window", 256, 320, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#1B2A55");
    g.addColorStop(1, "#4A5F93");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const mg = ctx.createRadialGradient(w * 0.62, h * 0.32, 4, w * 0.62, h * 0.32, w * 0.5);
    mg.addColorStop(0, "rgba(230,238,255,0.95)");
    mg.addColorStop(0.18, "rgba(200,215,255,0.6)");
    mg.addColorStop(1, "rgba(120,140,200,0)");
    ctx.fillStyle = mg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#F2F5FF";
    ctx.beginPath();
    ctx.arc(w * 0.62, h * 0.32, w * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#070912";
    ctx.lineCap = "round";
    const branch = (x: number, y: number, a: number, len: number, lw: number, depth: number) => {
      const x2 = x + Math.cos(a) * len;
      const y2 = y + Math.sin(a) * len;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (depth > 0) {
        branch(x2, y2, a - 0.5, len * 0.7, lw * 0.65, depth - 1);
        branch(x2, y2, a + 0.4, len * 0.6, lw * 0.6, depth - 1);
      }
    };
    branch(-10, h * 0.85, -0.55, 90, 12, 4);
  });

/** Soft vertical fade for light shafts (bright at the top). */
const shaftTex = () =>
  canvasTexture("mat-shaft", 64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const s = ctx.createLinearGradient(0, 0, w, 0);
    s.addColorStop(0, "rgba(0,0,0,1)");
    s.addColorStop(0.25, "rgba(0,0,0,0)");
    s.addColorStop(0.75, "rgba(0,0,0,0)");
    s.addColorStop(1, "rgba(0,0,0,1)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, w, h);
  });

/** A window-shaped light pool on the floor (2 × 2 panes, soft edges). */
const poolTex = () =>
  canvasTexture("mat-pool", 256, 256, (ctx, w) => {
    ctx.filter = "blur(10px)";
    ctx.fillStyle = "#FFFFFF";
    const m = 34;
    const gap = 14;
    const s = (w - 2 * m - gap) / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) ctx.fillRect(m + i * (s + gap), m + j * (s + gap), s, s);
  });

/** PRENSA badge card. */
const badgeTex = () =>
  canvasTexture("mat-badge-prensa", 512, 340, (ctx, w, h) => {
    ctx.fillStyle = "#F4F1E8";
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 26);
    ctx.fill();
    ctx.fillStyle = "#D7262E";
    ctx.beginPath();
    ctx.roundRect(0, 0, w, 92, [26, 26, 0, 0]);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `900 54px ${HEAVY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TV · EN VIVO", w / 2, 48);
    ctx.fillStyle = "#14161C";
    ctx.font = `900 112px ${HEAVY}`;
    ctx.fillText("PRENSA", w / 2 + 40, 200);
    // A tiny Nubi photo.
    ctx.fillStyle = "#8EDCA2";
    ctx.fillRect(26, 140, 74, 74);
    ctx.fillStyle = "#151515";
    ctx.fillRect(44, 168, 10, 18);
    ctx.fillRect(72, 168, 10, 18);
    ctx.fillStyle = "#14161C";
    ctx.fillRect(26, 284, w - 52, 10);
    ctx.fillRect(26, 304, w * 0.5, 10);
  });

/** Microphone flag: white "TV" on red. */
const micFlagTex = () =>
  canvasTexture("mat-mic-flag", 128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#D7262E";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `900 64px ${HEAVY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("TV", w / 2, h / 2 + 4);
  });

// Materials (cached).
const surface = (key: string, tex: THREE.Texture, o: { rough?: number; glow?: number; transparent?: boolean; metal?: number; color?: string } = {}) =>
  new THREE.MeshStandardMaterial({
    map: tex,
    color: o.color ?? "#ffffff",
    roughness: o.rough ?? 0.9,
    metalness: o.metal ?? 0,
    emissive: new THREE.Color("#ffffff"),
    emissiveMap: tex,
    emissiveIntensity: o.glow ?? 0.02,
    transparent: o.transparent ?? false,
    depthWrite: !(o.transparent ?? false),
    name: key,
  });

const houseMats = once(() => {
  const wallpaper = surface("wallpaper", tiled(wallpaperTex(), WALLPAPER_UNIT), { glow: 0.025 });
  const stains = [stainTex(301), stainTex(302), stainTex(303)].map((t, i) => surface(`stains${i}`, t, { transparent: true, glow: 0 }));
  const wainscot = (() => {
    const t = wainscotTex().clone();
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / WAINSCOT.w, 1 / WAINSCOT.h);
    t.needsUpdate = true;
    return surface("wainscot", t, { rough: 0.7, glow: 0.02 });
  })();
  const checker = surface("checker", tiled(checkerTex(), CHECKER_UNIT), { rough: 0.62, glow: 0.02 });
  const boards = surface("boards", tiled(boardsTex(), BOARDS_UNIT), { rough: 0.75, glow: 0.02 });
  const ceiling = surface("ceiling", tiled(ceilingTex(), 4), { glow: 0.015 });
  const wood = surface("wood", tiled(woodTex(), 1), { rough: 0.6, glow: 0.03 });
  const rust = new THREE.MeshStandardMaterial({ map: rustTex(), roughness: 0.75, metalness: 0.35, emissive: new THREE.Color("#ffffff"), emissiveMap: rustTex(), emissiveIntensity: 0.03 });
  const iron = toy("#1C1A18", { rough: 0.5, metal: 0.6, glow: 0.02 });
  const brass = toy("#6E5A32", { rough: 0.4, metal: 0.65, glow: 0.04 });
  const cobweb = new THREE.MeshStandardMaterial({ map: cobwebTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, color: "#CFCFCF", roughness: 1, emissive: new THREE.Color("#8090B0"), emissiveMap: cobwebTex(), emissiveIntensity: 0.12 });
  const sheet = toy("#B9B4A8", { rough: 0.95, glow: 0.05 });
  const asphalt = new THREE.MeshStandardMaterial({ map: tiled(asphaltTex(), 3), roughness: 0.18, metalness: 0.5, color: "#9A9AA6" });
  const facade = new THREE.MeshBasicMaterial({ map: facadeTex(), toneMapped: false });
  const moon = new THREE.MeshBasicMaterial({ map: moonTex(), toneMapped: false });
  const glass = new THREE.MeshStandardMaterial({ color: "#3A4458", transparent: true, opacity: 0.35, roughness: 0.2, metalness: 0.3, depthWrite: false });
  const fanGlass = new THREE.MeshBasicMaterial({ color: "#5A3A1C", transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false });
  const shaft = additive(new THREE.MeshBasicMaterial({ map: shaftTex(), color: "#9FB6FF", opacity: 0.16, side: THREE.DoubleSide, toneMapped: false }));
  const pool = additive(new THREE.MeshBasicMaterial({ map: poolTex(), color: "#7E98E8", opacity: 0.32, toneMapped: false }));
  const streetPool = additive(new THREE.MeshBasicMaterial({ map: shaftTex(), color: "#FF9447", opacity: 0.5, toneMapped: false }));
  const photos = ([0, 1, 2, 3, 4] as PhotoKind[]).map((k) => surface(`photo${k}`, photoTex(k), { rough: 0.5, glow: 0.05 }));
  const candle = toy("#D8D0BC", { rough: 0.8, glow: 0.05 });
  const crystal = new THREE.MeshStandardMaterial({ color: "#C8D4E8", roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.75, emissive: new THREE.Color("#5A6680"), emissiveIntensity: 0.25 });
  return { wallpaper, stains, wainscot, checker, boards, ceiling, wood, rust, iron, brass, cobweb, sheet, asphalt, facade, moon, glass, fanGlass, shaft, pool, streetPool, photos, candle, crystal };
});

// =======================================================================================
// Shared pieces

const Wall: React.FC<{ w: number; h: number; position: V3; rotY: number; stain: number }> = ({ w, h, position, rotY, stain }) => {
  const m = houseMats();
  const geo = useMemo(() => worldPlane(w, h), [w, h]);
  const lower = useMemo(() => worldPlane(w, WAINSCOT.h), [w]);
  const flat = useMemo(() => new THREE.PlaneGeometry(w, h), [w, h]);
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh geometry={geo} material={m.wallpaper} position={[0, h / 2, 0]} />
      <mesh geometry={flat} material={m.stains[stain % m.stains.length]} position={[0, h / 2, 0.004]} />
      <mesh geometry={lower} material={m.wainscot} position={[0, WAINSCOT.h / 2, 0.012]} />
      {/* Chair rail, baseboard, crown moulding. */}
      <mesh material={m.wood} position={[0, WAINSCOT.h, 0.04]}>
        <boxGeometry args={[w, 0.07, 0.07]} />
      </mesh>
      <mesh material={m.wood} position={[0, 0.08, 0.03]}>
        <boxGeometry args={[w, 0.16, 0.05]} />
      </mesh>
      <mesh material={m.wood} position={[0, h - 0.09, 0.06]}>
        <boxGeometry args={[w, 0.18, 0.12]} />
      </mesh>
    </group>
  );
};

/** A cobweb in a corner: `size` across, its dense corner at the group origin. */
const Cobweb: React.FC<{ position: V3; rotation: V3; size?: number }> = ({ position, rotation, size = 1.2 }) => {
  const m = houseMats();
  return (
    <mesh material={m.cobweb} position={position} rotation={rotation}>
      <planeGeometry args={[size, size]} />
    </mesh>
  );
};
// Corner cobweb planes are centred, so shift them by half a size so the dense corner sits at the origin.
const CornerWeb: React.FC<{ position: V3; rotation: V3; size?: number }> = ({ position, rotation, size = 1.2 }) => (
  <group position={position} rotation={rotation}>
    <Cobweb position={[size / 2, -size / 2, 0]} rotation={[0, 0, 0]} size={size} />
  </group>
);

/** An old photo in a wooden frame hung on a wall facing +z (frame w × h, `tilt` in the wall plane). */
const Photo: React.FC<{ kind: PhotoKind; w: number; h: number; tilt?: number }> = ({ kind, w, h, tilt = 0 }) => {
  const m = houseMats();
  const frame = useMemo(() => rbox(w, h, 0.06, 0.02), [w, h]);
  return (
    <group rotation={[0, 0, tilt]}>
      <mesh geometry={frame} material={m.wood} position={[0, 0, 0.03]} />
      <mesh material={m.photos[kind]} position={[0, 0, 0.065]}>
        <planeGeometry args={[w - 0.1, h - 0.1]} />
      </mesh>
    </group>
  );
};

// =======================================================================================
// Effects

const DUST_VERT = /* glsl */ `
  attribute vec3 aSeed;
  uniform float uTime;
  uniform vec3 uMin;
  uniform vec3 uSize;
  uniform float uScale;
  uniform float uPt;
  uniform vec3 uB1P; uniform vec3 uB1D; uniform float uB1C; uniform float uB1R; uniform float uB1On;
  uniform vec3 uB2P; uniform vec3 uB2D; uniform float uB2C; uniform float uB2R; uniform float uB2On;
  varying float vB1;
  varying float vB2;
  varying float vTw;
  float cone(vec3 p, vec3 o, vec3 d, float c, float reach) {
    vec3 v = p - o;
    float l = length(v);
    if (l < 0.05) return 0.0;
    float k = dot(v / l, d);
    return smoothstep(c, mix(c, 1.0, 0.4), k) * (1.0 - smoothstep(reach * 0.45, reach, l));
  }
  void main() {
    vec3 q = fract(aSeed + vec3(0.0, -uTime * 0.01 * (0.4 + aSeed.x), 0.0));
    vec3 p = uMin + q * uSize + 0.08 * vec3(sin(uTime * 0.6 + aSeed.y * 40.0), sin(uTime * 0.45 + aSeed.z * 50.0), cos(uTime * 0.5 + aSeed.x * 30.0));
    vB1 = cone(p, uB1P, uB1D, uB1C, uB1R) * uB1On;
    vB2 = cone(p, uB2P, uB2D, uB2C, uB2R) * uB2On;
    vTw = 0.55 + 0.45 * sin(uTime * 2.5 + aSeed.x * 100.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = max(1.0, uPt * (0.5 + aSeed.y) * uScale / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const DUST_FRAG = /* glsl */ `
  uniform vec3 uC1;
  uniform vec3 uC2;
  uniform float uBase;
  varying float vB1;
  varying float vB2;
  varying float vTw;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d);
    vec3 col = (uC1 * vB1 + uC2 * vB2 + vec3(uBase)) * vTw;
    gl_FragColor = vec4(col, a);
  }
`;

/** A cone of light for the dust (origin, unit direction, half-angle, reach, strength). */
export type DustBeam = { from: V3; dir: V3; angle: number; reach: number; on: number };
const NO_BEAM: DustBeam = { from: [0, -50, 0], dir: [0, 1, 0], angle: 0.1, reach: 1, on: 0 };

/** Dust motes floating in a box: faint everywhere, glittering inside the beams. */
export const DustMotes: React.FC<{ t: number; min: V3; max: V3; count?: number; beam?: DustBeam; beam2?: DustBeam; color?: string; color2?: string; base?: number; size?: number }> = ({
  t,
  min,
  max,
  count = 500,
  beam = NO_BEAM,
  beam2 = NO_BEAM,
  color = "#FFE2A8",
  color2 = "#A8C0FF",
  base = 0.04,
  size = 0.022,
}) => {
  const size3 = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const geo = useMemo(() => {
    const r = mulberry(909);
    const g = new THREE.BufferGeometry();
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) seeds[i] = r();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    return g;
  }, [count]);
  const mat = useMemo(
    () =>
      additive(
        new THREE.ShaderMaterial({
          vertexShader: DUST_VERT,
          fragmentShader: DUST_FRAG,
          uniforms: {
            uTime: { value: 0 },
            uMin: { value: new THREE.Vector3() },
            uSize: { value: new THREE.Vector3() },
            uScale: { value: 1 },
            uPt: { value: 0.02 },
            uB1P: { value: new THREE.Vector3() },
            uB1D: { value: new THREE.Vector3(0, 1, 0) },
            uB1C: { value: 0.9 },
            uB1R: { value: 1 },
            uB1On: { value: 0 },
            uB2P: { value: new THREE.Vector3() },
            uB2D: { value: new THREE.Vector3(0, 1, 0) },
            uB2C: { value: 0.9 },
            uB2R: { value: 1 },
            uB2On: { value: 0 },
            uC1: { value: new THREE.Color() },
            uC2: { value: new THREE.Color() },
            uBase: { value: 0 },
          },
        }),
      ),
    [],
  );
  const u = mat.uniforms;
  u.uTime.value = t;
  (u.uMin.value as THREE.Vector3).set(...min);
  (u.uSize.value as THREE.Vector3).set(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  u.uScale.value = (size3.height * dpr) / (2 * Math.tan(((camera.fov ?? 40) * Math.PI) / 360));
  u.uPt.value = size;
  const setBeam = (k: "1" | "2", b: DustBeam) => {
    (u[`uB${k}P`].value as THREE.Vector3).set(...b.from);
    (u[`uB${k}D`].value as THREE.Vector3).set(...b.dir).normalize();
    u[`uB${k}C`].value = Math.cos(b.angle);
    u[`uB${k}R`].value = b.reach;
    u[`uB${k}On`].value = b.on;
  };
  setBeam("1", beam);
  setBeam("2", beam2);
  (u.uC1.value as THREE.Color).set(color);
  (u.uC2.value as THREE.Color).set(color2);
  u.uBase.value = base;
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={6} />;
};

/** Dust and plaster bits falling from the ceiling `age` seconds after a jolt (over `area`). */
export const FallingDust: React.FC<{ age: number; center: V3; area: [number, number]; count?: number; ceiling: number; color?: string }> = ({
  age,
  center,
  area,
  count = 90,
  ceiling,
  color = "#D9CDB4",
}) => {
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, toneMapped: false }), [color]);
  const puff = useMemo(() => additive(new THREE.SpriteMaterial({ color: "#8A8070", transparent: true, depthWrite: false })), []);
  const seeds = useMemo(() => {
    const r = mulberry(4242);
    return Array.from({ length: count }, () => [r(), r(), r(), r()]);
  }, [count]);
  if (age < 0 || age > 2.6) return null;
  mat.opacity = 0.75 * (1 - clamp01((age - 1.4) / 1.2));
  puff.opacity = 0.16 * Math.sin(Math.min(1, age / 2.4) * Math.PI);
  return (
    <group>
      {seeds.map(([a, b, c, d], i) => {
        const delay = d * 0.35;
        const tt = age - delay;
        if (tt < 0) return null;
        const big = i % 9 === 0;
        const fall = (big ? 4.9 : 0.9 + a * 0.8) * tt * tt + 0.15 * tt;
        const y = ceiling - 0.05 - fall;
        if (y < 0.02) return null;
        const s = big ? 0.035 : 0.008 + c * 0.012;
        return (
          <mesh
            key={i}
            geometry={geo}
            material={mat}
            position={[center[0] + (a - 0.5) * area[0] + Math.sin(tt * 3 + i) * 0.04, y, center[2] + (b - 0.5) * area[1]]}
            scale={[s, big ? s : s * 2.5, s]}
          />
        );
      })}
      <sprite material={puff} position={[center[0], ceiling - 0.4 - age * 0.5, center[2]]} scale={[area[0] * 0.9, 1.3, 1]} />
    </group>
  );
};

const RAIN_VERT = /* glsl */ `
  attribute vec3 aSeed;
  uniform float uTime;
  uniform vec3 uMin;
  uniform vec3 uSize;
  uniform vec3 uLamp;
  varying float vA;
  varying float vL;
  void main() {
    float fall = fract(aSeed.y + uTime * (1.6 + aSeed.x * 0.8));
    vec3 c = uMin + vec3(aSeed.x * uSize.x, (1.0 - fall) * uSize.y, aSeed.z * uSize.z);
    c.x += (uMin.y + uSize.y - c.y) * 0.07;
    vec3 p = c + vec3(position.x, position.y, 0.0);
    vA = position.y > 0.0 ? 0.0 : 1.0;
    float d = length(c - uLamp);
    vL = 0.25 + 2.2 / (1.0 + d * d * 0.12);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const RAIN_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vA;
  varying float vL;
  void main() {
    gl_FragColor = vec4(uColor * vL, uOpacity * (0.2 + 0.8 * vA));
  }
`;

/** Rain streaks falling through a box, lit by the street lamp. */
export const Rain: React.FC<{ t: number; min: V3; max: V3; lamp: V3; count?: number; opacity?: number }> = ({ t, min, max, lamp, count = 700, opacity = 0.55 }) => {
  const geo = useMemo(() => {
    const r = mulberry(515);
    const quads: THREE.BufferGeometry[] = [];
    for (let i = 0; i < count; i++) {
      const q = new THREE.PlaneGeometry(0.012, 0.32 + r() * 0.2);
      const seed = [r(), r(), r()];
      const s = new Float32Array(4 * 3);
      for (let k = 0; k < 4; k++) s.set(seed, k * 3);
      q.setAttribute("aSeed", new THREE.BufferAttribute(s, 3));
      q.deleteAttribute("uv");
      q.deleteAttribute("normal");
      quads.push(q);
    }
    const m = mergeGeometries(quads, false)!;
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    return m;
  }, [count]);
  const mat = useMemo(
    () =>
      additive(
        new THREE.ShaderMaterial({
          vertexShader: RAIN_VERT,
          fragmentShader: RAIN_FRAG,
          side: THREE.DoubleSide,
          uniforms: {
            uTime: { value: 0 },
            uMin: { value: new THREE.Vector3() },
            uSize: { value: new THREE.Vector3() },
            uLamp: { value: new THREE.Vector3() },
            uColor: { value: new THREE.Color("#FFB070") },
            uOpacity: { value: 0.5 },
          },
        }),
      ),
    [],
  );
  mat.uniforms.uTime.value = t;
  (mat.uniforms.uMin.value as THREE.Vector3).set(...min);
  (mat.uniforms.uSize.value as THREE.Vector3).set(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  (mat.uniforms.uLamp.value as THREE.Vector3).set(...lamp);
  mat.uniforms.uOpacity.value = opacity;
  return <mesh geometry={geo} material={mat} frustumCulled={false} />;
};

// =======================================================================================
// The flashlight in a fin, the badge, the microphone

const _m4 = new THREE.Matrix4();
const _up = new THREE.Vector3(0, 1, 0);
/**
 * Nubi's flashlight held at a fin tip (`from`, world; get it with finTipWorld) and aimed at the
 * world point `to`. Props are passed to the shared <Flashlight>.
 */
export const HeldTorch: React.FC<{ from: V3; to: V3; on?: number; reach?: number; angle?: number; intensity?: number; beam?: number; color?: string }> = ({ from, to, ...rest }) => {
  const q = useMemo(() => new THREE.Quaternion(), []);
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  if (b.distanceTo(a) < 1e-3) b.z += 1;
  q.setFromRotationMatrix(_m4.lookAt(b, a, _up));
  return (
    <group position={from} quaternion={q}>
      <group position={[0, 0, -0.12]}>
        <Flashlight {...rest} />
      </group>
    </group>
  );
};

/** Unit direction from `from` to `to`. */
export const dirTo = (from: V3, to: V3): V3 => {
  const d: V3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  return [d[0] / l, d[1] / l, d[2] / l];
};

const strapGeo = once(() => new THREE.BoxGeometry(1, 1, 1));
/** A strap segment between two points on Nubi's front face (model units, z = face + 0.08). */
const Strap: React.FC<{ a: [number, number]; b: [number, number]; z: number; mat: THREE.Material; w?: number }> = ({ a, b, z, mat, w = 0.42 }) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  return <mesh geometry={strapGeo()} material={mat} position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, z]} rotation={[0, 0, Math.atan2(dy, dx)]} scale={[len + w * 0.3, w, 0.1]} />;
};

/**
 * The reporter's credential, as a <Nubi> child (model units): a red lanyard over the top of the
 * body, down the front outside the eyes, to a laminated "PRENSA" card under them. `swing` tilts the
 * card a little (it swings on its clip when Nubi hops).
 */
export const PressBadge: React.FC<{ swing?: number }> = ({ swing = 0 }) => {
  const ready = useFontsReady();
  const mats = useMemo(() => {
    if (!ready) return null;
    const card = new THREE.MeshStandardMaterial({ map: badgeTex(), roughness: 0.35, emissive: new THREE.Color("#ffffff"), emissiveMap: badgeTex(), emissiveIntensity: 0.12 });
    const sleeve = new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false });
    return { card, sleeve };
  }, [ready]);
  const strap = toy("#C8282E", { rough: 0.7, glow: 0.12 });
  const clip = toy("#B8BCC4", { rough: 0.3, metal: 0.7, glow: 0.05 });
  const F = 4.4 + 0.06;
  return (
    <group>
      {/* Lanyard: over the top of the body, down the front outside the eyes, in to the clip. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Strap a={[s * 3.75, 9.9]} b={[s * 3.55, 5.3]} z={F} mat={strap} />
          <Strap a={[s * 3.55, 5.3]} b={[s * 0.75, 4.35]} z={F} mat={strap} />
          <mesh geometry={strapGeo()} material={strap} position={[s * 3.75, 9.95, 0]} scale={[0.42, 0.1, 8.9]} />
        </group>
      ))}
      <mesh material={clip} position={[0, 4.3, F + 0.05]}>
        <boxGeometry args={[0.7, 0.45, 0.16]} />
      </mesh>
      {mats ? (
        <group position={[0, 4.15, F + 0.1]} rotation={[0, 0, swing]}>
          <mesh material={mats.card} position={[0, -0.95, 0]}>
            <planeGeometry args={[2.9, 1.93]} />
          </mesh>
          <mesh material={mats.sleeve} position={[0, -0.95, 0.04]}>
            <boxGeometry args={[3.1, 2.12, 0.06]} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
};

/** An old TV hand microphone with a red "TV" flag, along +y from its grip (model units). */
export const TVMic: React.FC = () => {
  const ready = useFontsReady();
  const flag = useMemo(() => (ready ? new THREE.MeshStandardMaterial({ map: micFlagTex(), roughness: 0.5, emissive: new THREE.Color("#ffffff"), emissiveMap: micFlagTex(), emissiveIntensity: 0.18 }) : null), [ready]);
  const body = toy("#202228", { rough: 0.35, metal: 0.5, glow: 0.04 });
  const grille = toy("#55585F", { rough: 0.55, metal: 0.6, glow: 0.05 });
  return (
    <group>
      <mesh material={body} position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.2, 0.15, 2.4, 14]} />
      </mesh>
      <mesh material={grille} position={[0, 2.55, 0]}>
        <sphereGeometry args={[0.52, 18, 14]} />
      </mesh>
      <mesh material={body} position={[0, 2.12, 0]}>
        <cylinderGeometry args={[0.36, 0.22, 0.3, 14]} />
      </mesh>
      {flag ? (
        <mesh material={flag} position={[0, 1.55, 0]}>
          <boxGeometry args={[0.95, 0.85, 0.95]} />
        </mesh>
      ) : null}
    </group>
  );
};

// =======================================================================================
// The entrance hall

/** The hall: x0..x1, back wall (with the front door) at zBack, ceiling at `height`. */
export const HALL = { x0: -4.4, x1: 4.4, zBack: -3, zFront: 10, height: 5.2 };
/** The doorway in the back wall (x0..x1, top of the door h; a semicircular fanlight above). */
export const HALL_DOOR = { x0: -0.9, x1: 0.9, h: 3.3 };
const FAN_R = (HALL_DOOR.x1 - HALL_DOOR.x0) / 2;
const DOOR_W = HALL_DOOR.x1 - HALL_DOOR.x0 - 0.06;
/** The door's hinge (left jamb); the door opens inwards (towards +z) with a negative angle. */
export const HALL_HINGE: V3 = [HALL_DOOR.x0 + 0.03, 0, HALL.zBack - 0.08];
/** Door angle when it stands wide open. */
export const HALL_DOOR_OPEN = -1.35;
const HANDLE_LOCAL: V3 = [DOOR_W - 0.2, 1.05, 0.07];
/** World position of the inner door handle for a door angle. */
export const hallHandle = (angle: number): V3 => {
  const [x, y, z] = HANDLE_LOCAL;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [HALL_HINGE[0] + x * c + z * s, y, HALL_HINGE[2] - x * s + z * c];
};
/** Nubi waiting on the sidewalk outside the door, and its TV-host spot inside. */
export const HALL_OUTSIDE: V3 = [0.12, -0.12, -4.7];
export const HALL_HOST: V3 = [0.45, 0, -0.55];
/** The orange street lamp's bulb (outside, seen through the doorway and the fanlight). */
export const STREET_LAMP: V3 = [1.25, 3.85, -9.2];
/** The moonlit window on the right wall (centre). */
const HALL_WINDOW = { z: 2.6, y: 2.5, w: 1.3, h: 2.4 };
const CHANDELIER: V3 = [-0.35, HALL.height, 1.4];

const hallGeos = once(() => {
  const { x0, x1, height, zFront, zBack } = HALL;
  const back = new THREE.Shape();
  back.moveTo(x0, -0.05);
  back.lineTo(x1, -0.05);
  back.lineTo(x1, height);
  back.lineTo(x0, height);
  back.closePath();
  const hole = new THREE.Path();
  hole.moveTo(HALL_DOOR.x0, 0);
  hole.lineTo(HALL_DOOR.x0, HALL_DOOR.h);
  hole.absarc(0, HALL_DOOR.h, FAN_R, Math.PI, 0, true);
  hole.lineTo(HALL_DOOR.x1, 0);
  hole.closePath();
  back.holes.push(hole);
  const backGeo = new THREE.ShapeGeometry(back, 24);
  // Right wall with the window hole (shape in (−z, y) as seen from inside).
  const len = zFront - zBack;
  const right = new THREE.Shape();
  right.moveTo(-len / 2, 0);
  right.lineTo(len / 2, 0);
  right.lineTo(len / 2, height);
  right.lineTo(-len / 2, height);
  right.closePath();
  const wc = HALL_WINDOW.z - (zBack + zFront) / 2;
  const wh = new THREE.Path();
  // In the right wall's local frame (rotY = −π/2) local +x points to world −z.
  wh.moveTo(-wc - HALL_WINDOW.w / 2, HALL_WINDOW.y - HALL_WINDOW.h / 2);
  wh.lineTo(-wc + HALL_WINDOW.w / 2, HALL_WINDOW.y - HALL_WINDOW.h / 2);
  wh.lineTo(-wc + HALL_WINDOW.w / 2, HALL_WINDOW.y + HALL_WINDOW.h / 2);
  wh.lineTo(-wc - HALL_WINDOW.w / 2, HALL_WINDOW.y + HALL_WINDOW.h / 2);
  wh.closePath();
  right.holes.push(wh);
  const rightGeo = new THREE.ShapeGeometry(right);
  const door = rbox(DOOR_W, HALL_DOOR.h - 0.03, 0.07, 0.015);
  const floor = worldPlane(x1 - x0, zFront - zBack + 0.4);
  const ceiling = worldPlane(x1 - x0, zFront - zBack);
  const outside = worldPlane(30, 24);
  const sidewalk = new THREE.BoxGeometry(30, 0.2, 3.2);
  const arm = new THREE.TorusGeometry(0.55, 0.04, 6, 16, Math.PI / 2);
  const fanBar = new THREE.BoxGeometry(0.035, FAN_R, 0.05);
  const fanRing = new THREE.TorusGeometry(FAN_R * 0.42, 0.025, 6, 20, Math.PI);
  const fanFrame = new THREE.TorusGeometry(FAN_R, 0.06, 8, 32, Math.PI);
  const fanGlass = new THREE.CircleGeometry(FAN_R, 32, 0, Math.PI);
  return { backGeo, rightGeo, door, floor, ceiling, outside, sidewalk, arm, fanBar, fanRing, fanFrame, fanGlass };
});

/** The broken chandelier: askew, an arm hanging down, crystals missing. Origin at the ceiling hook. */
const Chandelier: React.FC<{ swing: number; t: number }> = ({ swing, t }) => {
  const m = houseMats();
  const arms = [0, 1, 2, 3, 4, 5];
  return (
    <group rotation={[0.12 + swing * 0.5, 0, 0.1 + swing]}>
      <mesh material={m.iron} position={[0, -0.32, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.64, 6]} />
      </mesh>
      <group position={[0, -0.75, 0]}>
        <mesh material={m.brass} scale={[1, 1.5, 1]}>
          <sphereGeometry args={[0.13, 14, 10]} />
        </mesh>
        <mesh material={m.brass} position={[0, -0.22, 0]}>
          <coneGeometry args={[0.07, 0.2, 10]} />
        </mesh>
        <mesh material={m.brass} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.42, 0.018, 6, 28]} />
        </mesh>
        {arms.map((i) => {
          const a = (i / arms.length) * Math.PI * 2 + 0.3;
          const broken = i === 2;
          return (
            <group key={i} rotation={[0, a, 0]}>
              <group rotation={[0, 0, broken ? -1.2 : 0]}>
                <mesh material={m.brass} position={[0.24, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.014, 0.014, 0.48, 6]} />
                </mesh>
                <mesh material={m.brass} position={[0.48, 0.06, 0]}>
                  <cylinderGeometry args={[0.05, 0.03, 0.06, 10]} />
                </mesh>
                {i !== 4 ? (
                  <mesh material={m.candle} position={[0.48, 0.14 + (i % 2) * 0.03, 0]}>
                    <cylinderGeometry args={[0.022, 0.022, 0.14 + (i % 3) * 0.05, 8]} />
                  </mesh>
                ) : null}
                {i % 2 === 0 ? (
                  <mesh material={m.crystal} position={[0.4, -0.16 + 0.01 * Math.sin(t * 2 + i), 0]} scale={[0.03, 0.06, 0.03]}>
                    <octahedronGeometry args={[1, 0]} />
                  </mesh>
                ) : null}
              </group>
            </group>
          );
        })}
      </group>
      <Cobweb position={[0.2, -0.6, 0.05]} rotation={[0, 0.4, 0.6]} size={0.7} />
    </group>
  );
};

/**
 * The entrance hall (no lights: add <HallLights>). `door` = door angle (0 shut, HALL_DOOR_OPEN wide
 * open), `handle` = lever turn (rad), `swing` = chandelier swing (rad), `t` = seconds.
 */
export const EntranceHall: React.FC<{ t: number; door: number; handle?: number; swing?: number }> = ({ t, door, handle = 0, swing = 0 }) => {
  const geo = hallGeos();
  const m = houseMats();
  const { x0, x1, zBack, zFront, height } = HALL;
  const len = zFront - zBack;
  const midZ = (zBack + zFront) / 2;
  const open = clamp01(-door / 1.1);
  return (
    <group>
      {/* Floor (dusty checkerboard) and a stone threshold. */}
      <mesh geometry={geo.floor} material={m.checker} rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0, midZ + 0.2]} />
      <mesh material={m.wood} position={[0, 0.025, zBack - 0.1]}>
        <boxGeometry args={[HALL_DOOR.x1 - HALL_DOOR.x0 + 0.2, 0.05, 0.42]} />
      </mesh>
      {/* Back wall with the doorway, its stains, wainscot and mouldings (split around the door). */}
      <mesh geometry={geo.backGeo} material={m.wallpaper} position={[0, 0, zBack]} />
      <mesh material={m.stains[0]} position={[(x0 + x1) / 2, height / 2, zBack + 0.004]}>
        <planeGeometry args={[x1 - x0, height]} />
      </mesh>
      {[
        [x0, HALL_DOOR.x0 - 0.12],
        [HALL_DOOR.x1 + 0.12, x1],
      ].map(([a, b]) => (
        <group key={a}>
          <mesh material={m.wainscot} position={[(a + b) / 2, WAINSCOT.h / 2, zBack + 0.012]}>
            <planeGeometry args={[b - a, WAINSCOT.h]} />
          </mesh>
          <mesh material={m.wood} position={[(a + b) / 2, WAINSCOT.h, zBack + 0.04]}>
            <boxGeometry args={[b - a, 0.07, 0.07]} />
          </mesh>
          <mesh material={m.wood} position={[(a + b) / 2, 0.08, zBack + 0.03]}>
            <boxGeometry args={[b - a, 0.16, 0.05]} />
          </mesh>
        </group>
      ))}
      <mesh material={m.wood} position={[0, height - 0.09, zBack + 0.06]}>
        <boxGeometry args={[x1 - x0, 0.18, 0.12]} />
      </mesh>
      {/* Door frame (jambs, transom bar) and the fanlight's iron sunburst. */}
      {[HALL_DOOR.x0 - 0.06, HALL_DOOR.x1 + 0.06].map((x) => (
        <mesh key={x} material={m.wood} position={[x, HALL_DOOR.h / 2, zBack - 0.12]}>
          <boxGeometry args={[0.14, HALL_DOOR.h, 0.42]} />
        </mesh>
      ))}
      <mesh material={m.wood} position={[0, HALL_DOOR.h + 0.02, zBack - 0.12]}>
        <boxGeometry args={[HALL_DOOR.x1 - HALL_DOOR.x0 + 0.26, 0.1, 0.42]} />
      </mesh>
      <group position={[0, HALL_DOOR.h + 0.05, zBack - 0.1]}>
        <mesh geometry={geo.fanFrame} material={m.wood} />
        <mesh geometry={geo.fanRing} material={m.iron} />
        {[0.35, 0.95, 1.57, 2.19, 2.79].map((a) => (
          <mesh key={a} geometry={geo.fanBar} material={m.iron} position={[(Math.cos(a) * FAN_R) / 2, (Math.sin(a) * FAN_R) / 2, 0]} rotation={[0, 0, a - Math.PI / 2]} />
        ))}
        <mesh geometry={geo.fanGlass} material={m.fanGlass} position={[0, 0, -0.03]} />
      </group>
      <CornerWeb position={[HALL_DOOR.x0 + 0.02, HALL_DOOR.h - 0.02, zBack + 0.1]} rotation={[0, 0, 0]} size={0.55} />
      {/* The rusty door on its hinge. */}
      <group position={HALL_HINGE} rotation={[0, door, 0]}>
        <mesh geometry={geo.door} material={m.rust} position={[DOOR_W / 2, (HALL_DOOR.h - 0.03) / 2, 0]} />
        {[0.07, -0.07].map((z) => (
          <group key={z} position={[HANDLE_LOCAL[0], HANDLE_LOCAL[1], z]}>
            <mesh material={m.brass} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.05, 12]} />
            </mesh>
            <mesh material={m.brass} position={[-0.09 * Math.cos(handle), -0.09 * Math.sin(handle), z > 0 ? 0.04 : -0.04]} rotation={[0, 0, handle]}>
              <boxGeometry args={[0.2, 0.04, 0.04]} />
            </mesh>
          </group>
        ))}
        <mesh material={m.iron} position={[0.62, 2.45, 0.05]}>
          <boxGeometry args={[0.36, 0.06, 0.02]} />
        </mesh>
      </group>
      {/* Side walls (the right one with the moonlit window), ceiling. */}
      <Wall w={len} h={height} position={[x0, 0, midZ]} rotY={Math.PI / 2} stain={1} />
      <group position={[x1, 0, midZ]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh geometry={geo.rightGeo} material={m.wallpaper} />
        <mesh material={m.wainscot} position={[0, WAINSCOT.h / 2, 0.012]}>
          <planeGeometry args={[len, WAINSCOT.h]} />
        </mesh>
        <mesh material={m.wood} position={[0, 0.08, 0.03]}>
          <boxGeometry args={[len, 0.16, 0.05]} />
        </mesh>
      </group>
      <group position={[x1 + 0.02, HALL_WINDOW.y, HALL_WINDOW.z]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh material={m.moon} position={[0, 0, -0.6]}>
          <planeGeometry args={[HALL_WINDOW.w * 1.6, HALL_WINDOW.h * 1.4]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={m.wood} position={[(s * HALL_WINDOW.w) / 2, 0, 0]}>
            <boxGeometry args={[0.1, HALL_WINDOW.h + 0.1, 0.16]} />
          </mesh>
        ))}
        {[-1, 0, 1].map((s) => (
          <mesh key={s} material={m.wood} position={[0, (s * HALL_WINDOW.h) / 2, 0]}>
            <boxGeometry args={[HALL_WINDOW.w + 0.1, 0.08, 0.16]} />
          </mesh>
        ))}
        <mesh material={m.wood} position={[0, 0, 0]}>
          <boxGeometry args={[0.05, HALL_WINDOW.h, 0.1]} />
        </mesh>
      </group>
      {/* Moonlight from the window: a shaft and a pool on the tiles. */}
      <mesh material={m.shaft} position={[x1 - 1.3, 1.35, HALL_WINDOW.z]} rotation={[0, Math.PI / 2, 0.75]} scale={[HALL_WINDOW.w, 3.2, 1]}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh material={m.pool} position={[x1 - 2.4, 0.01, HALL_WINDOW.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.2, HALL_WINDOW.w * 1.1, 1]}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh geometry={geo.ceiling} material={m.ceiling} rotation={[Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, height, midZ]} />
      <CornerWeb position={[x0, height, zBack]} rotation={[0, 0, 0]} size={1.5} />
      <CornerWeb position={[x1, height, zBack]} rotation={[0, Math.PI, 0]} size={1.3} />
      <CornerWeb position={[x0, height - 0.1, zBack + 4]} rotation={[0, Math.PI / 2, 0]} size={1.1} />
      <group position={CHANDELIER}>
        <Chandelier swing={swing} t={t} />
      </group>
      {/* A console with a cracked vase of dead branches (left), a sheet-covered armchair (right). */}
      <group position={[x0 + 0.32, 0, 0.6]}>
        <mesh material={m.wood} position={[0, 0.92, 0]}>
          <boxGeometry args={[0.5, 0.06, 1.5]} />
        </mesh>
        {[-0.62, 0.62].map((z) => (
          <mesh key={z} material={m.wood} position={[0.12, 0.45, z]}>
            <boxGeometry args={[0.06, 0.9, 0.06]} />
          </mesh>
        ))}
        <mesh material={m.brass} position={[0.02, 1.15, 0.25]}>
          <cylinderGeometry args={[0.07, 0.11, 0.42, 12]} />
        </mesh>
        {[-0.5, 0.1, 0.6].map((a, i) => (
          <mesh key={i} material={m.wood} position={[0.02 + Math.sin(a) * 0.15, 1.6, 0.25 + Math.cos(a) * 0.05]} rotation={[0.2 * i - 0.2, 0, a * 0.6]}>
            <cylinderGeometry args={[0.008, 0.014, 0.75, 4]} />
          </mesh>
        ))}
      </group>
      <group position={[x1 - 1.0, 0, -0.9]} rotation={[0, -0.5, 0]}>
        <mesh material={m.sheet} position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.55, 0.68, 1.1, 14, 1]} />
        </mesh>
        <mesh material={m.sheet} position={[0, 1.15, -0.32]} scale={[1, 1, 0.45]}>
          <sphereGeometry args={[0.58, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh material={m.sheet} position={[0, 1.12, -0.32]} scale={[1.08, 0.9, 0.5]}>
          <cylinderGeometry args={[0.55, 0.55, 0.5, 14, 1]} />
        </mesh>
      </group>
      {/* Outside: sidewalk, wet street, the house across the street, the lamp post, rain. */}
      <mesh geometry={geo.sidewalk} material={m.asphalt} position={[0, -0.22, zBack - 1.9]} />
      <mesh geometry={geo.outside} material={m.asphalt} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, zBack - 14]} />
      <mesh material={m.facade} position={[0, 4, zBack - 14]}>
        <planeGeometry args={[30, 12]} />
      </mesh>
      <group position={[STREET_LAMP[0] + 0.55, -0.12, STREET_LAMP[2]]}>
        <mesh material={m.iron} position={[0, 1.9, 0]}>
          <cylinderGeometry args={[0.06, 0.09, 3.8, 8]} />
        </mesh>
        <mesh geometry={geo.arm} material={m.iron} position={[-0.55, 3.8, 0]} />
        <mesh material={m.iron} position={[-0.55, STREET_LAMP[1] + 0.29, 0]}>
          <coneGeometry args={[0.2, 0.18, 8]} />
        </mesh>
      </group>
      <mesh position={STREET_LAMP}>
        <sphereGeometry args={[0.1, 12, 8]} />
        <meshBasicMaterial color="#FFD9A0" toneMapped={false} />
      </mesh>
      <Glow color="#FF9A3C" size={2.6} opacity={0.75} position={STREET_LAMP} />
      <Glow color="#FFB46A" size={0.9} opacity={0.9} position={STREET_LAMP} />
      <Rain t={t} min={[-3.2, -0.3, zBack - 9]} max={[3.2, 6, zBack - 0.6]} lamp={STREET_LAMP} />
      {/* The orange spill through the open door onto the tiles. */}
      <mesh material={m.streetPool} position={[0.15, 0.012, zBack + 1.5]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.9 * open, 3.2 * open, 1]}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  );
};

/** Lights of the hall. `street` 0..1: the street lamp's light coming through the open door. */
export const HallLights: React.FC<{ street: number; moon?: number }> = ({ street, moon = 1 }) => {
  const target = useMemo(() => new THREE.Object3D(), []);
  const moonTarget = useMemo(() => new THREE.Object3D(), []);
  return (
    <>
      <hemisphereLight args={["#5D6E9E", "#120F0C", 0.32]} />
      <pointLight position={[STREET_LAMP[0], STREET_LAMP[1] - 0.15, STREET_LAMP[2]]} intensity={36} distance={22} decay={1.5} color="#FF9A3C" />
      <spotLight position={[0.3, 3.4, HALL.zBack - 4.5]} target={target} angle={0.5} penumbra={0.7} intensity={70 * street} distance={18} decay={1.3} color="#FF9447" />
      <primitive object={target} position={[0.1, 0, HALL.zBack + 3.6]} />
      <spotLight position={[HALL.x1 + 1.6, 4.4, HALL_WINDOW.z]} target={moonTarget} angle={0.55} penumbra={0.8} intensity={34 * moon} distance={16} decay={1.2} color="#8EA8FF" />
      <primitive object={moonTarget} position={[0.5, 0, HALL_WINDOW.z - 1.0]} />
      <directionalLight position={[2, 6, -8]} intensity={0.35 * moon} color="#7F95D8" />
    </>
  );
};

// =======================================================================================
// The corridor

/** The hallway: side walls at x0/x1, from zNear to the end wall at zEnd, ceiling at `height`. */
export const CORRIDOR = { x0: -2.4, x1: 2.4, zNear: 9, zEnd: -16, height: 4.6 };
const STAIRS = { x0: 1.0, x1: 2.4, z0: -5.5, steps: 15, rise: 0.3, run: 0.45 };
const STAIRS_TOP_Z = STAIRS.z0 - STAIRS.steps * STAIRS.run;
/** A point high up the staircase, where it disappears into the dark stairwell. */
export const CORRIDOR_STAIRS_TOP: V3 = [(STAIRS.x0 + STAIRS.x1) / 2, 4.0, STAIRS_TOP_Z + 1.4];
/** The foot of the staircase (its first step). */
export const CORRIDOR_STAIRS_FOOT: V3 = [(STAIRS.x0 + STAIRS.x1) / 2, 0.3, STAIRS.z0];
/** The small moonlit window in the end wall (centre). */
export const CORRIDOR_WINDOW = { x: -0.55, y: 2.3, w: 1.0, h: 1.4 };
export const CORRIDOR_WINDOW_C: V3 = [CORRIDOR_WINDOW.x, CORRIDOR_WINDOW.y, CORRIDOR.zEnd];
/** Photos on the left wall: z, y (centre), w, h, kind, tilt. Kind 3 is the scratched-out face. */
const PHOTOS: [number, number, number, number, PhotoKind, number][] = [
  [5.2, 2.3, 0.7, 0.9, 0, 0.03],
  [3.0, 2.6, 0.9, 0.7, 1, -0.05],
  [1.0, 2.2, 0.6, 0.8, 2, 0],
  [-1.4, 2.55, 0.8, 0.62, 4, 0.02],
  [-3.9, 2.95, 0.72, 0.92, 3, 0.1],
  [-6.6, 2.4, 0.8, 0.62, 1, -0.03],
  [-8.6, 2.6, 0.6, 0.8, 0, 0.05],
  [-10.4, 2.3, 0.9, 0.7, 2, -0.02],
];
/** The scratched-out portrait (centre, world). */
export const CORRIDOR_SCRATCHED: V3 = [CORRIDOR.x0 + 0.06, 2.95, -3.9];

const corridorGeos = once(() => {
  const { x0, x1, zNear, zEnd, height } = CORRIDOR;
  const len = zNear - zEnd;
  // End wall with the window hole.
  const end = new THREE.Shape();
  end.moveTo(x0, -0.05);
  end.lineTo(x1, -0.05);
  end.lineTo(x1, height);
  end.lineTo(x0, height);
  end.closePath();
  const W = CORRIDOR_WINDOW;
  const wh = new THREE.Path();
  wh.moveTo(W.x - W.w / 2, W.y - W.h / 2);
  wh.lineTo(W.x + W.w / 2, W.y - W.h / 2);
  wh.lineTo(W.x + W.w / 2, W.y + W.h / 2);
  wh.lineTo(W.x - W.w / 2, W.y + W.h / 2);
  wh.closePath();
  end.holes.push(wh);
  const endGeo = new THREE.ShapeGeometry(end);
  // Ceiling with the stairwell opening (shape in world x/z; rotated to face down).
  const ceil = new THREE.Shape();
  ceil.moveTo(x0, zEnd);
  ceil.lineTo(x1, zEnd);
  ceil.lineTo(x1, zNear);
  ceil.lineTo(x0, zNear);
  ceil.closePath();
  const sw = new THREE.Path();
  sw.moveTo(STAIRS.x0, STAIRS_TOP_Z);
  sw.lineTo(STAIRS.x0, -7.2);
  sw.lineTo(x1, -7.2);
  sw.lineTo(x1, STAIRS_TOP_Z);
  sw.closePath();
  ceil.holes.push(sw);
  const ceilGeo = new THREE.ShapeGeometry(ceil);
  const uv = ceilGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i));
  // The staircase: treads, risers, nosings and the panelled side facing the corridor (vertex colours).
  const parts: THREE.BufferGeometry[] = [];
  const { x0: sx0, x1: sx1, z0, steps, rise, run } = STAIRS;
  const sw2 = sx1 - sx0;
  for (let i = 0; i < steps; i++) {
    const zf = z0 - i * run;
    const top = (i + 1) * rise;
    const worn = i % 4 === 1 ? -0.03 : 0;
    const riser = paintGeo(new THREE.PlaneGeometry(sw2, rise), i % 2 ? "#2E1F15" : "#33231A");
    riser.translate((sx0 + sx1) / 2, top - rise / 2, zf);
    const tread = paintGeo(new THREE.PlaneGeometry(sw2, run), "#4A3324");
    tread.rotateX(-Math.PI / 2);
    tread.translate((sx0 + sx1) / 2, top + worn, zf - run / 2);
    const nosing = paintGeo(new THREE.BoxGeometry(sw2, 0.05, 0.07), "#5C412D");
    nosing.translate((sx0 + sx1) / 2, top - 0.02, zf + 0.015);
    const side = paintGeo(new THREE.PlaneGeometry(run, top), "#24180F");
    side.rotateY(-Math.PI / 2);
    side.translate(sx0, top / 2, zf - run / 2);
    parts.push(riser, tread, nosing, side);
  }
  const stairs = mergeGeometries(
    parts.map((p) => {
      const g = p.index ? p.toNonIndexed() : p;
      g.deleteAttribute("uv");
      return g;
    }),
    false,
  )!;
  const window = new THREE.BoxGeometry(1, 1, 1);
  return { endGeo, ceilGeo, stairs, window, len };
});

/** Banister along the corridor side of the stairs: newel post, balusters (some missing), handrail. */
const Banister: React.FC = () => {
  const m = houseMats();
  const { x0, z0, steps, rise, run } = STAIRS;
  const x = x0 + 0.05;
  const railLen = Math.hypot(steps * run, steps * rise);
  const slope = Math.atan2(rise, run);
  return (
    <group>
      <mesh material={m.wood} position={[x, 0.65, z0 + 0.12]}>
        <boxGeometry args={[0.16, 1.3, 0.16]} />
      </mesh>
      <mesh material={m.wood} position={[x, 1.36, z0 + 0.12]}>
        <sphereGeometry args={[0.1, 10, 8]} />
      </mesh>
      {Array.from({ length: steps }, (_, i) => i)
        .filter((i) => i !== 4 && i !== 9 && i !== 10)
        .map((i) => {
          const top = (i + 1) * rise;
          const broken = i === 6;
          return (
            <mesh key={i} material={m.wood} position={[x, top + (broken ? 0.3 : 0.45), z0 - i * run - run / 2]} rotation={[broken ? 0.4 : 0, 0, 0]}>
              <cylinderGeometry args={[0.022, 0.026, broken ? 0.55 : 0.9, 6]} />
            </mesh>
          );
        })}
      <mesh material={m.wood} position={[x, 1.25 + (steps * rise) / 2, z0 - (steps * run) / 2]} rotation={[slope, 0, 0]}>
        <boxGeometry args={[0.09, 0.07, railLen]} />
      </mesh>
    </group>
  );
};

/** The hallway (no lights: add <CorridorLights>). */
export const Corridor: React.FC = () => {
  const geo = corridorGeos();
  const m = houseMats();
  const { x0, x1, zNear, zEnd, height } = CORRIDOR;
  const len = geo.len;
  const midZ = (zNear + zEnd) / 2;
  const W = CORRIDOR_WINDOW;
  const stairMat = vertexMat(0.75, false, 0.03);
  return (
    <group>
      <mesh material={m.boards} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, midZ]}>
        <primitive object={worldPlaneCached(x1 - x0, len)} attach="geometry" />
      </mesh>
      <Wall w={len} h={height} position={[x0, 0, midZ]} rotY={Math.PI / 2} stain={0} />
      <Wall w={len} h={height} position={[x1, 0, midZ]} rotY={-Math.PI / 2} stain={2} />
      <mesh geometry={geo.endGeo} material={m.wallpaper} position={[0, 0, zEnd]} />
      <mesh material={m.stains[1]} position={[0, height / 2, zEnd + 0.004]}>
        <planeGeometry args={[x1 - x0, height]} />
      </mesh>
      <mesh material={m.wainscot} position={[0, WAINSCOT.h / 2, zEnd + 0.012]}>
        <planeGeometry args={[x1 - x0, WAINSCOT.h]} />
      </mesh>
      <mesh geometry={geo.ceilGeo} material={m.ceiling} rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]} />
      {/* The window at the end: moonlit sky behind, frame and cross bars, a web in its corner. */}
      <group position={[W.x, W.y, zEnd]}>
        <mesh material={m.moon} position={[0, 0.1, -0.7]}>
          <planeGeometry args={[W.w * 1.9, W.h * 1.7]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={`v${s}`} geometry={geo.window} material={m.wood} position={[(s * W.w) / 2, 0, 0]} scale={[0.1, W.h + 0.1, 0.2]} />
        ))}
        {[-1, 1].map((s) => (
          <mesh key={`h${s}`} geometry={geo.window} material={m.wood} position={[0, (s * W.h) / 2, 0]} scale={[W.w + 0.1, 0.1, 0.2]} />
        ))}
        <mesh geometry={geo.window} material={m.wood} scale={[0.05, W.h, 0.08]} />
        <mesh geometry={geo.window} material={m.wood} scale={[W.w, 0.05, 0.08]} />
        <mesh geometry={geo.window} material={m.wood} position={[0, -W.h / 2 - 0.06, 0.12]} scale={[W.w + 0.3, 0.06, 0.24]} />
        <CornerWeb position={[-W.w / 2 + 0.05, W.h / 2 - 0.05, 0.12]} rotation={[0, 0, 0]} size={0.45} />
      </group>
      <Glow color="#9DB6FF" size={2.4} opacity={0.35} position={[W.x, W.y, zEnd + 0.3]} />
      {/* Moonlight: a slanted shaft from the window and the pool of panes on the boards. */}
      <mesh material={m.shaft} position={[W.x, 1.45, zEnd + 1.9]} rotation={[-0.95, 0, 0]} scale={[W.w * 1.05, 4.3, 1]}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh material={m.pool} position={[W.x, 0.012, zEnd + 3.6]} rotation={[-Math.PI / 2, 0, 0]} scale={[W.w * 1.5, 2.6, 1]}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      {/* The staircase into the dark, its banister. */}
      <mesh geometry={geo.stairs} material={stairMat} />
      <Banister />
      {/* A closed door further down on the left. */}
      <group position={[x0 + 0.03, 0, -12.6]} rotation={[0, Math.PI / 2, 0]}>
        <mesh material={m.wood} position={[0, 1.35, 0.02]}>
          <boxGeometry args={[1.2, 2.7, 0.06]} />
        </mesh>
        <mesh material={m.brass} position={[0.42, 1.05, 0.08]}>
          <sphereGeometry args={[0.05, 10, 8]} />
        </mesh>
      </group>
      {/* The photos. */}
      {PHOTOS.map(([z, y, w, h, kind, tilt], i) => (
        <group key={i} position={[x0 + 0.02, y, z]} rotation={[0, Math.PI / 2, 0]}>
          <Photo kind={kind} w={w} h={h} tilt={tilt} />
        </group>
      ))}
      <CornerWeb position={[x0, height, -6]} rotation={[0, Math.PI / 2, 0]} size={1.2} />
      <CornerWeb position={[x1, height, 2]} rotation={[0, -Math.PI / 2, -Math.PI / 2]} size={1.0} />
      <CornerWeb position={[x0, height, zEnd]} rotation={[0, 0, 0]} size={1.0} />
    </group>
  );
};

const planeCache = new Map<string, THREE.BufferGeometry>();
const worldPlaneCached = (w: number, h: number) => {
  const k = `${w}x${h}`;
  let g = planeCache.get(k);
  if (!g) {
    g = worldPlane(w, h);
    planeCache.set(k, g);
  }
  return g;
};

/** Lights of the hallway: cold moonlight from the end window and a faint cold fill. */
export const CorridorLights: React.FC<{ k?: number }> = ({ k = 1 }) => {
  const target = useMemo(() => new THREE.Object3D(), []);
  return (
    <>
      <hemisphereLight args={["#56679A", "#100E0C", 0.3 * k]} />
      <spotLight position={[CORRIDOR_WINDOW.x, 4.2, CORRIDOR.zEnd - 2.5]} target={target} angle={0.42} penumbra={0.7} intensity={46 * k} distance={22} decay={1.15} color="#8FA9FF" />
      <primitive object={target} position={[CORRIDOR_WINDOW.x + 0.2, 0, CORRIDOR.zEnd + 4.5]} />
      <pointLight position={[CORRIDOR_WINDOW.x, CORRIDOR_WINDOW.y, CORRIDOR.zEnd + 0.8]} intensity={5 * k} distance={9} decay={1.2} color="#8FA9FF" />
      <directionalLight position={[-0.5, 3, -20]} intensity={0.45 * k} color="#7F96E0" />
    </>
  );
};

// =======================================================================================
// Fake shadows on a wall (x = wallX, facing +x): figures projected from a point light

/** The leg layout of <Nubi> (same as Nubi.tsx): [x, z, heading] in model units. */
const NUBI_LEGS: [number, number, number][] = [
  [-1.3, 1.6, 0],
  [1.3, 1.6, 0],
  [-2.4, 1.2, -0.72],
  [2.4, 1.2, 0.72],
  [-2.6, -0.9, -1.72],
  [2.6, -0.9, 1.72],
  [-1.5, -2.2, -2.75],
  [1.5, -2.2, 2.75],
];

export type ShadowFigure =
  | { kind: "nubi"; position: V3; rotationY: number; size: number; pose: NubiPose; torch?: [V3, V3] }
  | {
      kind: "stranger";
      /** Where it would stand (its feet). */
      position: V3;
      /** Overall height (world units). */
      height: number;
      /** Lean of the whole figure towards +side (rad), bend of its top part, reach of the near arm 0..1. */
      lean: number;
      bend: number;
      reach: number;
      /** −1: the figure leans/reaches towards the light-left (towards +z on the wall), 1 the other way. */
      side: number;
      breathe?: number;
    };

const _v = new THREE.Vector3();
const nubiParts = (f: Extract<ShadowFigure, { kind: "nubi" }>) => {
  const { position, rotationY, size, pose } = f;
  const s = size / 10;
  const sq = Math.max(0.3, pose.squash ?? 1);
  const sx = 1 / Math.sqrt(sq);
  const body = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotationY, 0)), new THREE.Vector3(s, s, s));
  body.multiply(new THREE.Matrix4().makeTranslation(0, pose.hop ?? 0, 0));
  body.multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(pose.pitch ?? 0, pose.yaw ?? 0, pose.roll ?? 0)));
  body.multiply(new THREE.Matrix4().makeScale(sx, sq, sx));
  const apply = (m: THREE.Matrix4, pts: V3[]) => pts.map((p) => _v.set(...p).applyMatrix4(m).toArray() as V3);
  const parts: V3[][] = [];
  // Body: a chamfered box.
  const bodyPts: V3[] = [];
  const r = 0.7;
  for (const x of [-5, 5])
    for (const y of [2.5, 9.9])
      for (const z of [-4.4, 4.4]) {
        bodyPts.push([x - Math.sign(x) * r, y, z], [x, y - Math.sign(y - 6) * r, z], [x, y, z - Math.sign(z) * r]);
      }
  parts.push(apply(body, bodyPts));
  // Legs.
  const wig = pose.wiggle ?? 0;
  const ph = pose.wigglePhase ?? 0;
  NUBI_LEGS.forEach(([x, z, a], k) => {
    const lift = wig * Math.max(0, Math.sin(ph - k * 0.9)) * 0.45;
    const m = body.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0)), new THREE.Vector3(1, 1, 1)));
    m.multiply(new THREE.Matrix4().makeRotationX(-lift));
    const pts: V3[] = [];
    for (const lx of [-0.97, 0.97]) for (const ly of [0, 2.6]) for (const lz of [0, 3.9]) pts.push([lx, ly, lz]);
    parts.push(apply(m, pts));
  });
  // Fins.
  for (const side of [1, -1]) {
    const raise = side === 1 ? (pose.finR ?? 0) : (pose.finL ?? 0);
    const m = body.clone();
    if (side === -1) m.multiply(new THREE.Matrix4().makeScale(-1, 1, 1));
    m.multiply(new THREE.Matrix4().makeTranslation(4.8, 5.0, 0.3));
    m.multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, -0.12, raise * 0.55)));
    const pts: V3[] = [];
    for (const y of [-1, 1]) for (const z of [-1, 1]) pts.push([0, y * 1.35, z * 1.5], [2.6, y * 0.51 - 0.2, z * 0.75 + 0.3]);
    parts.push(apply(m, pts));
  }
  return parts;
};

/** The tall stranger, as convex parts in world space (it faces the light). */
const strangerParts = (f: Extract<ShadowFigure, { kind: "stranger" }>, light: V3) => {
  const { position, height, lean, bend, reach, side, breathe = 0 } = f;
  const k = height / 3.4;
  const d = new THREE.Vector3(position[0] - light[0], 0, position[2] - light[2]).normalize();
  // Horizontal axis across the figure as the light sees it; `side` picks which way it leans.
  const across = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(-side);
  const toLight = d.clone().multiplyScalar(-1);
  const rot = (p: [number, number], a: number, o: [number, number] = [0, 0]): [number, number] => {
    const x = p[0] - o[0];
    const y = p[1] - o[1];
    return [o[0] + x * Math.cos(a) - y * Math.sin(a), o[1] + x * Math.sin(a) + y * Math.cos(a)];
  };
  const parts: V3[][] = [];
  const toWorld = (pts: [number, number][], depth = 0.12) =>
    pts.flatMap(([x, y]) => {
      const [lx, ly] = rot([x * k, y * k * (1 + breathe)], lean);
      return [-depth, depth].map((dz) => {
        const p = new THREE.Vector3(...position).addScaledVector(across, lx).addScaledVector(toLight, dz);
        p.y += ly;
        return p.toArray() as V3;
      });
    });
  // Spindly legs.
  for (const [x, foot] of [
    [-0.36, -0.5],
    [-0.12, -0.16],
    [0.12, 0.16],
    [0.36, 0.5],
  ] as [number, number][]) {
    parts.push(toWorld([[x - 0.06, 1.25], [x + 0.06, 1.25], [foot + 0.05, 0], [foot - 0.05, 0]]));
  }
  // Lower body.
  parts.push(toWorld([[-0.5, 1.15], [0.5, 1.15], [0.52, 2.3], [-0.52, 2.3]], 0.35));
  // Upper body (bends at the waist) and its arms.
  const waist: [number, number] = [0, 2.25];
  const up = (p: [number, number]) => rot(p, bend, waist);
  parts.push(toWorld([up([-0.5, 2.2]), up([0.5, 2.2]), up([0.42, 3.4]), up([-0.42, 3.4])], 0.35));
  for (const s of [-1, 1]) {
    const shoulder = up([s * 0.48, 3.05]);
    // The far arm (s = 1) hangs; the near arm (s = −1) rises and reaches across.
    const a = s === 1 ? -Math.PI / 2 + 0.16 + bend : -Math.PI / 2 - 0.16 + bend - reach * 1.25;
    const L = 1.75;
    const tip: [number, number] = [shoulder[0] + Math.cos(a) * L, shoulder[1] + Math.sin(a) * L];
    const n: [number, number] = [-Math.sin(a), Math.cos(a)];
    parts.push(toWorld([[shoulder[0] + n[0] * 0.1, shoulder[1] + n[1] * 0.1], [shoulder[0] - n[0] * 0.1, shoulder[1] - n[1] * 0.1], [tip[0] - n[0] * 0.03, tip[1] - n[1] * 0.03], [tip[0] + n[0] * 0.03, tip[1] + n[1] * 0.03]], 0.08));
    // Three long fingers.
    for (const fa of [-0.35, 0, 0.35]) {
      const b = a + fa * (0.6 + reach * 0.6);
      const ft: [number, number] = [tip[0] + Math.cos(b) * 0.42, tip[1] + Math.sin(b) * 0.42];
      parts.push(toWorld([[tip[0] + n[0] * 0.025, tip[1] + n[1] * 0.025], [tip[0] - n[0] * 0.025, tip[1] - n[1] * 0.025], [ft[0], ft[1]], [ft[0] + 0.005, ft[1] + 0.005]], 0.04));
    }
  }
  return parts;
};

type P2 = [number, number];
const hull = (pts: P2[]) => {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: P2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: P2[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
};

/** Where the ray from `light` through `p` meets the wall plane x = wallX (null if it doesn't). */
export const projectOnWall = (light: V3, p: V3, wallX: number): V3 | null => {
  const dx = p[0] - light[0];
  if (Math.abs(dx) < 1e-4) return null;
  const t = (wallX - light[0]) / dx;
  if (t < 1) return null;
  return [wallX, light[1] + (p[1] - light[1]) * t, light[2] + (p[2] - light[2]) * t];
};

/**
 * Flat, soft shadows painted on the wall x = wallX (facing +x) between z = z0 (near end) and z1
 * (far end), up to `height`: each figure is projected from the point `light` (as if a dim lamp
 * behind the camera cast them). `fill` lists spots where another light (the flashlight) washes
 * the shadow out. Redrawn every frame.
 */
export const WallShadows: React.FC<{
  wallX: number;
  z0: number;
  z1: number;
  height: number;
  light: V3;
  figures: ShadowFigure[];
  opacity?: number;
  blur?: number;
  fill?: { at: V3; radius: number; strength: number }[];
}> = ({ wallX, z0, z1, height, light, figures, opacity = 0.8, blur = 0.05, fill = [] }) => {
  const W = 1024;
  const ppu = W / (z0 - z1);
  const H = Math.round(height * ppu);
  const res = useMemo(() => {
    const sharp = document.createElement("canvas");
    sharp.width = W;
    sharp.height = H;
    const soft = document.createElement("canvas");
    soft.width = W;
    soft.height = H;
    const tex = new THREE.CanvasTexture(soft);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: "#000000", toneMapped: false });
    return { sharp, soft, tex, mat };
  }, [H]);
  const toPx = (p: V3): P2 => [(z0 - p[2]) * ppu, (height - p[1]) * ppu];
  const sc = res.sharp.getContext("2d")!;
  sc.clearRect(0, 0, W, H);
  sc.fillStyle = "#000";
  sc.strokeStyle = "#000";
  sc.lineJoin = "round";
  sc.lineCap = "round";
  const drawPart = (pts: V3[]) => {
    const proj = pts.map((p) => projectOnWall(light, p, wallX)).filter((p): p is V3 => p !== null);
    if (proj.length < 3) return;
    const h = hull(proj.map(toPx));
    sc.beginPath();
    h.forEach(([x, y], i) => (i ? sc.lineTo(x, y) : sc.moveTo(x, y)));
    sc.closePath();
    sc.fill();
    sc.lineWidth = 0.04 * ppu;
    sc.stroke();
  };
  for (const f of figures) {
    if (f.kind === "nubi") {
      nubiParts(f).forEach(drawPart);
      if (f.torch) {
        const a = projectOnWall(light, f.torch[0], wallX);
        const b = projectOnWall(light, f.torch[1], wallX);
        if (a && b) {
          const k = (a[0] - light[0]) / (f.torch[0][0] - light[0]);
          sc.lineWidth = 0.11 * Math.abs(k) * ppu;
          sc.beginPath();
          sc.moveTo(...toPx(a));
          sc.lineTo(...toPx(b));
          sc.stroke();
        }
      }
    } else strangerParts(f, light).forEach(drawPart);
  }
  const ctx = res.soft.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  ctx.filter = `blur(${Math.max(0, blur * ppu)}px)`;
  ctx.drawImage(res.sharp, 0, 0);
  ctx.filter = "none";
  // The flashlight washes the shadow out where it hits the wall.
  ctx.globalCompositeOperation = "destination-out";
  for (const f of fill) {
    if (f.strength <= 0) continue;
    const [x, y] = toPx(f.at);
    const r = f.radius * ppu;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${Math.min(1, f.strength)})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  ctx.globalCompositeOperation = "source-over";
  res.tex.needsUpdate = true;
  res.mat.opacity = opacity;
  return (
    <mesh material={res.mat} position={[wallX + 0.09, height / 2, (z0 + z1) / 2]} rotation={[0, Math.PI / 2, 0]} renderOrder={3}>
      <planeGeometry args={[z0 - z1, height]} />
    </mesh>
  );
};

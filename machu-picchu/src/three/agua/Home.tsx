import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { PottedPlant } from "../dino/Props";
import { NUBI_BODY } from "../inca/Costumes";
import { V3, canvasTexture, glowTexture, planarUV, toy } from "../inca/kit";
import { NUBI_FIN_TIP } from "../Nubi";
import { additive } from "../thanos/FX";

// Nubi's home for the water short: a small, cosy studio apartment in daylight (kitchenette with a
// sink under a window, a bed with a nightstand, a rug, posters, shelves and a deep windowsill
// with the potted plant), the chunky toy faucet, the glass of water, the watering can, the moth
// and Nubi's pyjamas and nightcap.
//
// World units are sized for Nubi at size 2 (2 wide, 2 tall); the floor is y = 0 and +z points out
// of the back wall towards the default camera. `t` is time in seconds (frame / fps); everything
// is deterministic. Costume pieces (Pajamas, NightCap) are children of <Nubi> in model units.
//
// Room (see STUDIO): 9 wide (x −4.5..4.5), 6.5 deep (z −3..3.5), walls 4.2 high. The walls are
// one-sided planes facing into the room, so a camera can sit outside a wall and look in.
//   back wall (z = −3):  kitchenette on the left (counter x −4.5..−1.4, sink under a window,
//                        faucet at the right end of the basin), shelf + clock in the middle,
//                        bed on the right (head against the wall) with the nightstand beside it
//   right wall (x = 4.5): window with a deep sill (window seat) where the plant stands
//   left wall: poster;  front wall (z = 3.5): door;  rug in the middle of the floor.

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
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

const rbox = (w: number, h: number, d: number, r: number, seg = 3) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));

/** Plane w × h whose uvs are in world units (textures tile by their own repeat). */
const worldPlane = (w: number, h: number) => {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  return g;
};

const texMatCache = new Map<string, THREE.MeshStandardMaterial>();
/** Material for a canvas texture (an emissive share keeps the colours bright). Cached per key. */
const texMat = (key: string, tex: THREE.Texture, o: { rough?: number; glow?: number; transparent?: boolean; side?: THREE.Side; metal?: number } = {}) => {
  let m = texMatCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: o.rough ?? 0.7,
      metalness: o.metal ?? 0,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tex,
      emissiveIntensity: o.glow ?? 0.16,
      transparent: o.transparent ?? false,
      side: o.side ?? THREE.FrontSide,
    });
    texMatCache.set(key, m);
  }
  return m;
};

const withRepeat = (tex: THREE.Texture, rx: number, ry: number) => {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  return tex;
};

// =======================================================================================
// Layout

/** The room: x −4.5..4.5, z −3 (back wall) .. 3.5 (front wall), walls 4.2 high, floor y = 0. */
export const STUDIO = { x0: -4.5, x1: 4.5, zBack: -3, zFront: 3.5, height: 4.2 };
/** Kitchen counter along the back wall (top surface at y = top). */
export const STUDIO_COUNTER = { x0: -4.5, x1: -1.4, z0: -3, z1: -1.95, top: 0.86 };
/** The sink basin (centre x/z, inner size w × d, `floor` = y of its bottom). */
export const STUDIO_BASIN = { x: -2.68, z: -2.46, w: 1.0, d: 0.62, floor: 0.56 };
const KITCHEN_WINDOW = { x: -2.62, y: 2.0, w: 1.4, h: 1.3 };
/** The faucet stands on the counter at the right end of the basin; its spout points to −x. */
export const STUDIO_FAUCET: V3 = [-1.84, STUDIO_COUNTER.top, -2.46];
const FAUCET_YAW = -Math.PI / 2;
/** The set draws the faucet at this scale (a chunky toy faucet next to a size-2 Nubi). */
export const FAUCET_SCALE = 1.35;
// Faucet-local key points (base on y = 0, spout towards +z).
const F_OUT: V3 = [0, 0.157, 0.47];
const F_HUB_Y = 0.33;
const F_ROT = (p: V3): V3 => [STUDIO_FAUCET[0] - p[2] * FAUCET_SCALE, STUDIO_FAUCET[1] + p[1] * FAUCET_SCALE, STUDIO_FAUCET[2] + p[0] * FAUCET_SCALE];
/** World position of the faucet's cross handle (its hub). */
export const STUDIO_FAUCET_KNOB: V3 = F_ROT([0, F_HUB_Y, 0]);
/** World position of the spout's outlet (the water falls from here onto STUDIO_BASIN.floor). */
export const STUDIO_FAUCET_OUTLET: V3 = F_ROT(F_OUT);

const FIN_PIVOT = new THREE.Vector3(4.8, 5.0, 0.3);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
/**
 * Fin tip of a Nubi standing at the origin (side 1 = finR / screen-right fin, −1 = finL) raised by
 * `raise`, the body turned by `yaw`, at size `size`. World offset from Nubi's feet.
 */
export const studioFinTip = (raise: number, side: 1 | -1, yaw = 0, size = 2): V3 => {
  const v = new THREE.Vector3(...NUBI_FIN_TIP).applyEuler(new THREE.Euler(0, -0.12, raise * 0.55)).add(FIN_PIVOT);
  v.x *= side;
  v.multiplyScalar(size / 10).applyAxisAngle(Y_AXIS, yaw);
  return [v.x, v.y, v.z];
};

/** Nubi at the sink: turned a little towards the basin, the screen-left fin (finL) on the knob. */
export const STUDIO_SINK_YAW = -0.35;
export const STUDIO_SINK_RAISE = 1.6;
const SINK_GRIP: V3 = [STUDIO_FAUCET_KNOB[0] + 0.15, STUDIO_FAUCET_KNOB[1], STUDIO_FAUCET_KNOB[2] + 0.16];
const sinkTip = studioFinTip(STUDIO_SINK_RAISE, -1, STUDIO_SINK_YAW);
/** Where Nubi (size 2) stands at the sink: with yaw STUDIO_SINK_YAW and finL = STUDIO_SINK_RAISE its fin tip is on the knob. */
export const STUDIO_SINK: V3 = [SINK_GRIP[0] - sinkTip[0], 0, SINK_GRIP[2] - sinkTip[2]];
/**
 * Where the water bottle stands on the counter: the back-right corner, behind the faucet (clear
 * of the fin on the knob). Nubi at STUDIO_SINK reaches it with finL ≈ 1 turned to yaw ≈ −0.7.
 */
export const STUDIO_COUNTER_BOTTLE: V3 = [-1.6, STUDIO_COUNTER.top, -2.74];

const BED = { x0: 1.0, x1: 3.8, z0: -3, z1: 0.0, top: 0.73 };
/** Where Nubi sits in bed (its legs sunk in the mattress, under the quilt when `blanket` = 1). */
export const STUDIO_BED: V3 = [2.4, BED.top - 0.2, -1.3];
/** Top of the mattress (y). */
export const STUDIO_MATTRESS_TOP = BED.top;
/** Floor spot just left of the bed where Nubi lands when it falls out. */
export const STUDIO_BED_FLOOR: V3 = [0.0, 0, -1.1];
const NIGHTSTAND: V3 = [4.15, 0, -2.72];

const PLANT_WINDOW = { z: 1.1, y: 1.5, w: 1.5, h: 1.6 };
const SILL = { x0: 3.86, top: 0.55, z0: 0.15, z1: 2.05 };
/** The potted plant on the deep sill of the right-wall window (pot base) and its scale. */
export const STUDIO_PLANT: V3 = [4.16, SILL.top, 1.1];
export const STUDIO_PLANT_SCALE = 0.8;
/** Where Nubi stands to water the plant (facing the camera, the can in finR over the plant). */
export const STUDIO_PLANT_NUBI: V3 = [2.25, 0, 1.15];
/** An open spot in the middle of the room, on the rug. */
export const STUDIO_MIDDLE: V3 = [0.3, 0, 0.4];

// =======================================================================================
// Textures

const floorTex = () =>
  canvasTexture(
    "agua-floor",
    512,
    512,
    (ctx, W) => {
      const tones = ["#E7AE6E", "#DCA060", "#EDB97E", "#D69759"];
      for (let r = 0; r < 4; r++) {
        const y = r * 128;
        const off = [0, 128, 64, 192][r];
        for (let k = -1; k < 3; k++) {
          const x0 = off + k * 256;
          ctx.fillStyle = tones[(r + k + 4) % 4];
          ctx.fillRect(x0, y, 256, 128);
          ctx.strokeStyle = "rgba(160,95,40,0.18)";
          ctx.lineWidth = 3;
          for (let g = 0; g < 4; g++) {
            const gy = y + 22 + g * 27 + ((k * 7 + r * 3) % 9);
            ctx.beginPath();
            ctx.moveTo(x0 + 10, gy);
            ctx.bezierCurveTo(x0 + 80, gy - 6, x0 + 170, gy + 7, x0 + 246, gy);
            ctx.stroke();
          }
          ctx.fillStyle = "#B9773C";
          ctx.fillRect(x0, y, 4, 128);
        }
        ctx.fillStyle = "#B9773C";
        ctx.fillRect(0, y, W, 4);
      }
    },
    { wrapS: true, wrapT: true },
  );

const wallTex = () =>
  canvasTexture(
    "agua-wall",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#FFEBD8";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#FFE1C6";
      for (let i = 0; i < 4; i++) ctx.fillRect(i * 64 + 18, 0, 28, H);
      ctx.fillStyle = "#FFB79C";
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.arc(i * 64 + 32 + (j % 2) * 32 - 16, j * 64 + 32, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

const wainscotTex = () =>
  canvasTexture(
    "agua-wainscot",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#F6A68C";
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = "#E48C72";
        ctx.fillRect(i * 64, 0, 5, H);
        ctx.fillStyle = "#FDBBA4";
        ctx.fillRect(i * 64 + 5, 0, 4, H);
      }
    },
    { wrapS: true, wrapT: true },
  );

const tilesTex = () =>
  canvasTexture(
    "agua-tiles",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#D6E6EE";
      ctx.fillRect(0, 0, W, H);
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = (i + j) % 2 ? "#FFFFFF" : "#BFE6FF";
          ctx.beginPath();
          ctx.roundRect(i * 64 + 3, j * 64 + 3, 58, 58, 8);
          ctx.fill();
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

const quiltTex = () =>
  canvasTexture(
    "agua-quilt",
    512,
    512,
    (ctx) => {
      const cols = ["#FFD36E", "#FF9F8A", "#B9A4F2", "#FFFFFF", "#8FD3FF", "#FFC2D6"];
      for (let j = 0; j < 4; j++) {
        for (let i = 0; i < 4; i++) {
          const c = cols[(i * 2 + j * 3) % cols.length];
          ctx.fillStyle = c;
          ctx.fillRect(i * 128, j * 128, 128, 128);
          ctx.strokeStyle = "rgba(255,255,255,0.85)";
          ctx.setLineDash([10, 8]);
          ctx.lineWidth = 4;
          ctx.strokeRect(i * 128 + 10, j * 128 + 10, 108, 108);
          ctx.setLineDash([]);
          // A little motif in some patches: a star or a heart.
          const cx = i * 128 + 64;
          const cy = j * 128 + 64;
          if ((i + j) % 3 === 0) {
            ctx.fillStyle = c === "#FFFFFF" ? "#FFD36E" : "rgba(255,255,255,0.9)";
            ctx.beginPath();
            for (let k = 0; k < 10; k++) {
              const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
              const r = k % 2 ? 11 : 26;
              ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();
          } else if ((i + j) % 3 === 1) {
            ctx.fillStyle = c === "#FFFFFF" ? "#FF9F8A" : "rgba(255,255,255,0.75)";
            ctx.beginPath();
            ctx.arc(cx, cy, 9, 0, Math.PI * 2);
            ctx.arc(cx - 26, cy - 26, 6, 0, Math.PI * 2);
            ctx.arc(cx + 26, cy + 24, 6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.strokeStyle = "rgba(120,80,60,0.25)";
      ctx.lineWidth = 3;
      for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 128, 0);
        ctx.lineTo(i * 128, 512);
        ctx.moveTo(0, i * 128);
        ctx.lineTo(512, i * 128);
        ctx.stroke();
      }
    },
    { wrapS: true, wrapT: true },
  );

const skyTex = () =>
  canvasTexture("agua-window-view", 512, 512, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#5FB8FF");
    g.addColorStop(0.6, "#A8DCFF");
    g.addColorStop(1, "#E4F6FF");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const cloud = (x: number, y: number, s: number) => {
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(x, y, 26 * s, 0, Math.PI * 2);
      ctx.arc(x + 30 * s, y - 14 * s, 32 * s, 0, Math.PI * 2);
      ctx.arc(x + 66 * s, y, 24 * s, 0, Math.PI * 2);
      ctx.rect(x, y, 66 * s, 24 * s);
      ctx.fill();
    };
    cloud(70, 110, 1.1);
    cloud(320, 70, 0.8);
    cloud(260, 210, 0.6);
    // Hills, round trees and a little house.
    ctx.fillStyle = "#8FD475";
    ctx.beginPath();
    ctx.moveTo(0, 390);
    ctx.bezierCurveTo(140, 330, 260, 360, 512, 340);
    ctx.lineTo(512, 512);
    ctx.lineTo(0, 512);
    ctx.fill();
    ctx.fillStyle = "#6CC15C";
    ctx.beginPath();
    ctx.moveTo(0, 440);
    ctx.bezierCurveTo(160, 400, 330, 430, 512, 400);
    ctx.lineTo(512, 512);
    ctx.lineTo(0, 512);
    ctx.fill();
    for (const [x, y, r] of [
      [80, 380, 34],
      [130, 395, 26],
      [420, 360, 38],
      [470, 380, 28],
    ]) {
      ctx.fillStyle = "#8A5A33";
      ctx.fillRect(x - 5, y, 10, 40);
      ctx.fillStyle = "#3FAE55";
      ctx.beginPath();
      ctx.arc(x, y - r * 0.4, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#FFF4E2";
    ctx.fillRect(250, 330, 70, 50);
    ctx.fillStyle = "#FF7A6B";
    ctx.beginPath();
    ctx.moveTo(240, 332);
    ctx.lineTo(285, 296);
    ctx.lineTo(330, 332);
    ctx.fill();
    ctx.fillStyle = "#7EC8F2";
    ctx.fillRect(266, 344, 16, 16);
    ctx.fillRect(292, 344, 16, 16);
  });

const rugTex = () =>
  canvasTexture("agua-rug", 512, 512, (ctx, W) => {
    const c = W / 2;
    const rings = ["#B9A4F2", "#FFF4E2", "#FF9F8A", "#FFF4E2", "#FFD36E", "#FFF4E2", "#B9A4F2"];
    rings.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(c, c, c - 4 - i * 34, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = "#FF9F8A";
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * 150, c + Math.sin(a) * 150, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  });

const posterWaveTex = () =>
  canvasTexture("agua-poster-wave", 256, 320, (ctx, W, H) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#FFF1DC";
    ctx.fillRect(14, 14, W - 28, H - 28);
    ctx.fillStyle = "#FF8A5B";
    ctx.beginPath();
    ctx.arc(180, 92, 34, 0, Math.PI * 2);
    ctx.fill();
    const wave = (y: number, col: string) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(14, H - 14);
      ctx.lineTo(14, y);
      for (let i = 0; i < 4; i++) {
        const x = 14 + i * 57;
        ctx.quadraticCurveTo(x + 28, y - 34, x + 57, y);
      }
      ctx.lineTo(W - 14, H - 14);
      ctx.fill();
    };
    wave(190, "#7EC8F2");
    wave(230, "#3D8BE0");
    wave(270, "#2266C4");
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(70, 180, 22, Math.PI, Math.PI * 1.9);
    ctx.stroke();
  });

const posterCloudTex = () =>
  canvasTexture("agua-poster-cloud", 256, 320, (ctx, W, H) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#CFEFFF";
    ctx.fillRect(14, 14, W - 28, H - 28);
    ["#FF7A6B", "#FFD36E", "#8EDCA2", "#7EC8F2"].forEach((c, i) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.arc(128, 230, 92 - i * 16, Math.PI, 0);
      ctx.stroke();
    });
    ctx.fillStyle = "#FFFFFF";
    for (const [x, y, r] of [
      [52, 232, 24],
      [78, 220, 28],
      [100, 236, 20],
      [160, 236, 20],
      [184, 220, 28],
      [208, 232, 24],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });

const clockTex = () =>
  canvasTexture("agua-clock", 256, 256, (ctx, W) => {
    const c = W / 2;
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2B2B44";
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const r = k % 3 === 0 ? 13 : 7;
      ctx.beginPath();
      ctx.arc(c + Math.sin(a) * 96, c - Math.cos(a) * 96, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineCap = "round";
    ctx.strokeStyle = "#2B2B44";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.sin(-0.55) * 52, c - Math.cos(-0.55) * 52);
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + Math.sin(0.5) * 78, c - Math.cos(0.5) * 78);
    ctx.stroke();
    ctx.fillStyle = "#FF5A4E";
    ctx.beginPath();
    ctx.arc(c, c, 12, 0, Math.PI * 2);
    ctx.fill();
  });

const ginghamTex = () =>
  canvasTexture(
    "agua-gingham",
    128,
    128,
    (ctx, W, H) => {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,90,78,0.45)";
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(i * 32, 0, 16, H);
        ctx.fillRect(0, i * 32, W, 16);
      }
    },
    { wrapS: true, wrapT: true },
  );

const pajamaTex = () =>
  canvasTexture(
    "agua-pajama",
    512,
    160,
    (ctx, W, H) => {
      ctx.fillStyle = "#A9DCFF";
      ctx.fillRect(0, 0, W, H);
      const cloud = (x: number, y: number, s: number) => {
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(x, y, 13 * s, 0, Math.PI * 2);
        ctx.arc(x + 15 * s, y - 8 * s, 16 * s, 0, Math.PI * 2);
        ctx.arc(x + 32 * s, y, 12 * s, 0, Math.PI * 2);
        ctx.rect(x, y, 32 * s, 12 * s);
        ctx.fill();
      };
      const star = (x: number, y: number, r: number) => {
        ctx.fillStyle = "#FFD84A";
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
          const rr = k % 2 ? r * 0.45 : r;
          ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
      };
      cloud(30, 50, 1.2);
      cloud(290, 110, 1.1);
      cloud(400, 40, 0.9);
      star(190, 50, 17);
      star(130, 118, 12);
      star(470, 118, 15);
      star(350, 72, 9);
      ctx.fillStyle = "#FFFFFF";
      for (const [x, y] of [
        [240, 128],
        [96, 92],
        [450, 74],
        [10, 130],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    { wrapS: true, wrapT: true },
  );

const capTex = () =>
  canvasTexture(
    "agua-nightcap",
    16,
    256,
    (ctx, W, H) => {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? "#FFFFFF" : "#3D5BD9";
        ctx.fillRect(0, (i * H) / 8, W, H / 8);
      }
    },
    { wrapS: true },
  );

const streamTex = () =>
  canvasTexture(
    "agua-stream",
    64,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#7FD2FF";
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 9; i++) {
        const x = (i * 23) % W;
        const y = (i * 71) % H;
        ctx.fillStyle = i % 3 ? "rgba(255,255,255,0.75)" : "rgba(40,140,230,0.5)";
        ctx.beginPath();
        ctx.ellipse(x, y, 3 + (i % 3), 26 + (i % 4) * 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(x, y + H, 3 + (i % 3), 26 + (i % 4) * 9, 0, 0, Math.PI * 2);
        ctx.ellipse(x, y - H, 3 + (i % 3), 26 + (i % 4) * 9, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    { wrapS: true, wrapT: true },
  );

const mothWingTex = () =>
  canvasTexture("agua-moth-wing", 128, 128, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, "#D9CBE6");
    g.addColorStop(1, "#BBA6D3");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#8E78B0";
    ctx.beginPath();
    ctx.arc(W * 0.62, H * 0.55, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFF4E2";
    ctx.beginPath();
    ctx.arc(W * 0.62, H * 0.55, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(W * 0.1, H * 0.5, W * 0.85, -0.5, 0.5);
    ctx.stroke();
  });

// =======================================================================================
// Small shared bits

/** Four-point sparkle star (flat, facing +z), unit size. */
let starGeo: THREE.ShapeGeometry | null = null;
const getStarGeo = () => {
  if (!starGeo) {
    const s = new THREE.Shape();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 2;
      const r = k % 2 ? 0.22 : 1;
      if (k === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    starGeo = new THREE.ShapeGeometry(s);
  }
  return starGeo;
};
const sparkleMats = new Map<string, THREE.MeshBasicMaterial>();
const sparkleMat = (color: string) => {
  let m = sparkleMats.get(color);
  if (!m) {
    m = additive(new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, toneMapped: false }));
    sparkleMats.set(color, m);
  }
  return m;
};

/** Soft additive glow (camera-facing). */
const GlowBall: React.FC<{ color: string; size: number; opacity: number; position?: V3 }> = ({ color, size, opacity, position }) => {
  const mat = useMemo(() => additive(new THREE.SpriteMaterial({ map: glowTexture(), color, toneMapped: false })), [color]);
  if (opacity <= 0.004 || size <= 0) return null;
  mat.opacity = Math.min(1, opacity);
  return <sprite material={mat} position={position} scale={[size, size, 1]} renderOrder={6} />;
};

/** Teardrop (round bottom, pointed top), height 1, centred on its round part at y = 0. */
const dropGeometry = () => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 20; i++) {
    const th = (i / 20) * Math.PI;
    const y = -Math.cos(th);
    const r = Math.sin(th) * (1 - 0.62 * Math.pow((y + 1) / 2, 1.4));
    pts.push(new THREE.Vector2(Math.max(0, r) * 0.42, y * 0.5));
  }
  return new THREE.LatheGeometry(pts, 20);
};

const waterMat = () => toy("#43B8FF", { rough: 0.06, glow: 0.42, metal: 0.05 });
const dustCols = ["#E2D6C0", "#D3C4A6", "#ECE2D0"];

// =======================================================================================
// Faucet

export type FaucetState = {
  /** 0..1: the cross handle turned (up to half a turn). */
  handle?: number;
  /** 0..1: water stream (0 none, 0.2 a trickle, 1 a full glossy gush with a splash). */
  flow?: number;
  /** 0..1: progress of a cough: a jolt, a puff of dust out of the spout, one sad drop that falls and splats. */
  sputter?: number;
  /** 0..1: wobble (it is being shaken). */
  shake?: number;
};

/**
 * Chunky toy faucet (glossy silver, blue cross handle). Faucet space: base on y = 0, column at
 * the origin, the spout reaching towards +z with its outlet at F_OUT = (0, 0.157, 0.47);
 * `floor` = y (faucet space) of the surface under the outlet (stream length, where drops land).
 */
export const Faucet: React.FC<FaucetState & { t?: number; floor?: number }> = ({ handle = 0, flow = 0, sputter = 0, shake = 0, t = 0, floor = -0.3 }) => {
  const geos = useMemo(() => {
    const spout = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.25, -0.01),
      new THREE.Vector3(0, 0.31, 0.12),
      new THREE.Vector3(0, 0.305, 0.31),
      new THREE.Vector3(0, 0.255, 0.43),
      new THREE.Vector3(0, 0.205, 0.47),
    ]);
    return {
      base: new THREE.CylinderGeometry(0.115, 0.14, 0.05, 32),
      col: new THREE.CylinderGeometry(0.07, 0.082, 0.26, 28),
      collar: new THREE.TorusGeometry(0.076, 0.02, 10, 28),
      spout: new THREE.TubeGeometry(spout, 36, 0.043, 16, false),
      elbow: new THREE.SphereGeometry(0.074, 22, 16),
      aer: new THREE.CylinderGeometry(0.052, 0.048, 0.055, 22),
      hole: new THREE.CircleGeometry(0.033, 20),
      hub: new THREE.SphereGeometry(0.058, 20, 14),
      spoke: new THREE.CylinderGeometry(0.022, 0.022, 0.34, 12),
      ball: new THREE.SphereGeometry(0.046, 16, 12),
      cap: new THREE.CylinderGeometry(0.046, 0.046, 0.026, 20),
      puff: new THREE.IcosahedronGeometry(1, 1),
      drop: dropGeometry(),
      stream: new THREE.CylinderGeometry(1, 1, 1, 20, 6, true),
      disc: new THREE.CircleGeometry(1, 24),
      ring: new THREE.TorusGeometry(1, 0.18, 8, 28),
      bead: new THREE.SphereGeometry(1, 10, 8),
    };
  }, []);
  const mats = useMemo(() => {
    const tex = streamTex().clone();
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1.6);
    tex.needsUpdate = true;
    return {
      stream: new THREE.MeshStandardMaterial({
        color: "#9EE0FF",
        map: tex,
        emissive: new THREE.Color("#2E9BEF"),
        emissiveIntensity: 0.55,
        roughness: 0.05,
        metalness: 0.05,
        transparent: true,
        opacity: 0.92,
      }),
      puff: new THREE.MeshStandardMaterial({ color: dustCols[0], emissive: new THREE.Color(dustCols[0]), emissiveIntensity: 0.35, roughness: 1, transparent: true, depthWrite: false }),
      foam: new THREE.MeshStandardMaterial({ color: "#FFFFFF", emissive: new THREE.Color("#DFF4FF"), emissiveIntensity: 0.5, roughness: 0.3, transparent: true, depthWrite: false }),
      spot: new THREE.MeshStandardMaterial({ color: "#6CC8FF", emissive: new THREE.Color("#3FA9F5"), emissiveIntensity: 0.4, roughness: 0.1, transparent: true, depthWrite: false }),
    };
  }, []);
  const chrome = toy("#DCE6EF", { metal: 0.35, rough: 0.14, glow: 0.3 });
  const chromeDark = toy("#9FB0BF", { metal: 0.4, rough: 0.2, glow: 0.2 });
  const blue = toy("#2F8CFF", { rough: 0.22, glow: 0.3 });
  const dark = toy("#2A3442", { rough: 0.6, glow: 0.05 });
  const water = waterMat();

  const s = clamp01(sputter);
  // Cough: a hiccup jolt early in the sputter, plus the shake wobble.
  const hic = s > 0.02 && s < 0.32 ? Math.sin(((s - 0.02) / 0.3) * Math.PI) : 0;
  const wob = clamp01(shake) + hic * 0.35;
  const rx = wob * 0.13 * Math.sin(t * 47) + hic * 0.06;
  const rz = wob * 0.11 * Math.sin(t * 39 + 1.3);
  const bulge = 1 + 0.35 * hic;
  const outY = F_OUT[1];
  const L = Math.max(0.05, outY - floor);
  const f = clamp01(flow);
  const streamR = 0.012 + 0.034 * f;
  mats.stream.map!.offset.y = t * 2.6;

  // Dust puff from the spout.
  const puffs: React.ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const p = (s - 0.07 - i * 0.018) / 0.5;
    if (p <= 0 || p >= 1) continue;
    const a = hash(i * 3.1) * Math.PI * 2;
    const spread = 0.12 + 0.14 * hash(i + 4);
    const d = easeOut(p);
    const x = Math.cos(a) * spread * d;
    const z = F_OUT[2] + 0.05 * d + Math.sin(a) * spread * d * 0.8;
    const y = outY - 0.03 - (0.1 + 0.12 * hash(i + 9)) * d + 0.06 * p * p;
    const sc = 0.03 + (0.06 + 0.04 * hash(i + 2)) * d;
    puffs.push(<mesh key={`p${i}`} geometry={geos.puff} material={mats.puff} position={[x, y, z]} scale={sc} rotation={[i, i * 2, 0]} />);
  }
  mats.puff.opacity = 0.95;
  const specks: React.ReactNode[] = [];
  for (let i = 0; i < 7; i++) {
    const p = (s - 0.1 - i * 0.02) / 0.45;
    if (p <= 0 || p >= 1) continue;
    const a = hash(i * 5.7 + 1) * Math.PI * 2;
    specks.push(
      <mesh
        key={`s${i}`}
        geometry={geos.bead}
        material={toy("#A8916C", { rough: 1, glow: 0.2 })}
        position={[Math.cos(a) * 0.08 * p, outY - 0.02 - 0.5 * p * p * L * 1.6, F_OUT[2] + Math.sin(a) * 0.08 * p]}
        scale={0.011}
      />,
    );
  }
  // Puff opacity fades per puff via scale only (shared material): fade the whole puff at the end.
  mats.puff.opacity = 0.95 * (1 - smooth(0.45, 0.62, s));

  // One sad drop: grows at the outlet, falls, splats.
  let drop: React.ReactNode = null;
  let splat: React.ReactNode = null;
  if (s > 0.3 && s < 0.84) {
    const grow = smooth(0.3, 0.55, s);
    const hang = smooth(0.48, 0.62, s);
    const fall = clamp01((s - 0.62) / 0.2);
    const y = fall > 0 ? outY - 0.04 - (outY - 0.04 - floor - 0.02) * fall * fall : outY - 0.012 - 0.028 * grow - 0.02 * hang;
    const sc = 0.07 * grow;
    drop = <mesh geometry={geos.drop} material={water} position={[0, y, F_OUT[2]]} scale={[sc, sc * (1 + 0.35 * hang + 0.3 * fall), sc]} />;
  }
  if (s >= 0.82) {
    const p = clamp01((s - 0.82) / 0.18);
    mats.spot.opacity = 0.85 - 0.3 * p;
    splat = (
      <group position={[0, floor + 0.004, F_OUT[2]]}>
        <mesh geometry={geos.disc} material={mats.spot} rotation={[-Math.PI / 2, 0, 0]} scale={0.02 + 0.045 * easeOut(p * 2)} />
        {[0, 1, 2, 3].map((k) => {
          const a = k * 1.7 + 0.4;
          const q = clamp01(p * 1.6);
          if (q >= 1) return null;
          return <mesh key={k} geometry={geos.bead} material={water} position={[Math.cos(a) * 0.07 * q, 0.06 * 4 * q * (1 - q), Math.sin(a) * 0.07 * q]} scale={0.009 * (1 - q * 0.5)} />;
        })}
      </group>
    );
  }

  // Stream, splash crown and glints.
  let stream: React.ReactNode = null;
  if (f > 0.01) {
    const beads: React.ReactNode[] = [];
    const n = 12;
    for (let i = 0; i < n; i++) {
      const ph = frac(t * 2.3 + hash(i * 1.3));
      const a = (i / n) * Math.PI * 2 + hash(i) * 0.5;
      const r = streamR + (0.05 + 0.16 * hash(i + 7)) * ph * (0.4 + f);
      const up = (0.05 + 0.12 * hash(i + 3)) * 4 * ph * (1 - ph) * f;
      beads.push(
        <mesh key={i} geometry={geos.bead} material={water} position={[Math.cos(a) * r, floor + 0.01 + up, F_OUT[2] + Math.sin(a) * r]} scale={(0.01 + 0.012 * f) * (1 - ph * 0.6)} />,
      );
    }
    const glints: React.ReactNode[] = [];
    if (f > 0.5) {
      for (let i = 0; i < 6; i++) {
        const ph = frac(t * 1.4 + i / 6);
        const k = Math.sin(ph * Math.PI) * smooth(0.5, 0.9, f);
        const a = i * 2.3 + t * 3;
        glints.push(
          <mesh
            key={i}
            geometry={getStarGeo()}
            material={sparkleMat("#FFFFFF")}
            position={[Math.cos(a) * streamR * 1.6, outY - L * ph, F_OUT[2] + Math.sin(a) * streamR * 1.6]}
            scale={0.035 * k}
            rotation={[0, 0, t * 4 + i]}
          />,
        );
      }
    }
    mats.foam.opacity = 0.75 * smooth(0.05, 0.3, f);
    stream = (
      <group>
        <mesh geometry={geos.stream} material={mats.stream} position={[0, outY - L / 2, F_OUT[2]]} scale={[streamR, L, streamR]} />
        <mesh geometry={geos.ring} material={mats.foam} position={[0, floor + 0.012, F_OUT[2]]} rotation={[Math.PI / 2, 0, 0]} scale={[streamR * 1.9 + 0.012 * Math.sin(t * 20), streamR * 1.9, streamR * 1.2]} />
        {beads}
        {glints}
      </group>
    );
  }

  return (
    <group>
      <group rotation={[rx, 0, rz]}>
        <mesh geometry={geos.base} material={chrome} position={[0, 0.025, 0]} />
        <mesh geometry={geos.col} material={chrome} position={[0, 0.05 + 0.13, 0]} scale={[1, 1 + 0.08 * hic, 1]} />
        <mesh geometry={geos.collar} material={chromeDark} position={[0, 0.07, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={geos.elbow} material={chrome} position={[0, 0.28, 0]} />
        <mesh geometry={geos.spout} material={chrome} />
        <group position={[0, 0.185, F_OUT[2]]} scale={[bulge, 1, bulge]}>
          <mesh geometry={geos.aer} material={chromeDark} />
          <mesh geometry={geos.hole} material={dark} position={[0, -0.029, 0]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
        {/* Cross handle on top of the column. */}
        <group position={[0, F_HUB_Y, 0]} rotation={[0, -clamp01(handle) * Math.PI * 0.9, 0]}>
          <mesh geometry={geos.hub} material={chrome} />
          <mesh geometry={geos.spoke} material={chrome} rotation={[0, 0, Math.PI / 2]} />
          <mesh geometry={geos.spoke} material={chrome} rotation={[Math.PI / 2, 0, 0]} />
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} geometry={geos.ball} material={blue} position={[Math.cos((k * Math.PI) / 2) * 0.17, 0, Math.sin((k * Math.PI) / 2) * 0.17]} />
          ))}
          <mesh geometry={geos.cap} material={blue} position={[0, 0.055, 0]} />
        </group>
      </group>
      {puffs}
      {specks}
      {drop}
      {splat}
      {stream}
    </group>
  );
};

// =======================================================================================
// Glass of water

/** Glass in a fin (inside <Upright raise={finR}>): standing upright at the tip, a little forward; a bit oversized (≈ 0.65 tall) so it reads on a phone. */
export const GLASS_HOLD = { position: [0.3, -1.6, 1.5] as V3, rotation: [0, 0, 0] as V3, scale: 9 };
/** Same for the screen-left fin (inside <Upright raise={finL} side="L">). */
export const GLASS_HOLD_L = { position: [-0.3, -1.6, 1.5] as V3, rotation: [0, 0, 0] as V3, scale: 9 };

const GLASS = { h: 0.36, r0: 0.098, r1: 0.125, base: 0.045, pivot: 0.15 };

/**
 * Glass tumbler, base on y = 0, 0.36 tall. `fill` 0..1 water level; `tilt` (radians, about z;
 * positive tips the rim towards −x, i.e. towards Nubi's face when held in finR) turns the glass
 * round its middle while the water surface stays level; `vanish` 0..1: the water evaporates in a
 * flash of sparkles and steam, leaving the glass empty.
 */
export const WaterGlass: React.FC<{ fill?: number; vanish?: number; t?: number; tilt?: number }> = ({ fill = 0.8, vanish = 0, t = 0, tilt = 0 }) => {
  const geos = useMemo(() => {
    const prof: [number, number][] = [
      [0, 0],
      [GLASS.r0 - 0.008, 0],
      [GLASS.r0, 0.008],
      [GLASS.r1, GLASS.h - 0.004],
      [GLASS.r1 - 0.004, GLASS.h + 0.002],
      [GLASS.r1 - 0.011, GLASS.h - 0.004],
      [GLASS.r0 - 0.01, GLASS.base + 0.004],
      [GLASS.r0 - 0.016, GLASS.base],
      [0, GLASS.base],
    ];
    const glass = new THREE.LatheGeometry(
      prof.map(([r, y]) => new THREE.Vector2(r, y)),
      40,
    );
    const water = new THREE.CylinderGeometry(1, 1, 1, 36, 1, false);
    const pos = water.attributes.position as THREE.BufferAttribute;
    const orig = Float32Array.from(pos.array as Float32Array);
    return {
      glass,
      water,
      orig,
      rim: new THREE.TorusGeometry(GLASS.r1 - 0.004, 0.005, 6, 40),
      streak: new THREE.PlaneGeometry(0.018, 0.22),
      puff: new THREE.IcosahedronGeometry(1, 1),
    };
  }, []);
  const mats = useMemo(
    () => ({
      glass: new THREE.MeshStandardMaterial({
        color: "#EAF8FF",
        emissive: new THREE.Color("#CDEFFF"),
        emissiveIntensity: 0.3,
        roughness: 0.04,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      rim: new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.7, depthWrite: false }),
      streak: new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }),
      water: new THREE.MeshStandardMaterial({
        color: "#47BBFF",
        emissive: new THREE.Color("#1F93E8"),
        emissiveIntensity: 0.42,
        roughness: 0.06,
        transparent: true,
        opacity: 0.88,
      }),
      steam: new THREE.MeshStandardMaterial({ color: "#FFFFFF", emissive: new THREE.Color("#E8F8FF"), emissiveIntensity: 0.6, roughness: 1, transparent: true, depthWrite: false }),
    }),
    [],
  );
  const v = clamp01(vanish);
  const level = clamp01(fill) * (1 - smooth(0, 0.55, v));
  // Water surface: level in the glass frame, kept horizontal in the holder's frame.
  const h = GLASS.base + (GLASS.h - 0.035 - GLASS.base) * level;
  const tan = Math.tan(Math.max(-1.3, Math.min(1.3, tilt)));
  const showWater = level > 0.01 && Math.abs(tilt) < 1.6;
  if (showWater) {
    const pos = geos.water.attributes.position as THREE.BufferAttribute;
    const o = geos.orig;
    for (let i = 0; i < pos.count; i++) {
      const ox = o[i * 3];
      const oy = o[i * 3 + 1];
      const oz = o[i * 3 + 2];
      const len = Math.hypot(ox, oz);
      let y: number;
      if (oy > 0) y = Math.max(GLASS.base + 0.002, Math.min(GLASS.h - 0.006, h - ox * (GLASS.r1 - 0.012) * tan));
      else y = GLASS.base + 0.002;
      const r = GLASS.r0 - 0.012 + (GLASS.r1 - GLASS.r0) * ((y - GLASS.base) / (GLASS.h - GLASS.base));
      const k = len > 1e-6 ? r : 0;
      pos.setXYZ(i, ox * k, y, oz * k);
    }
    pos.needsUpdate = true;
    geos.water.computeVertexNormals();
    geos.water.computeBoundingSphere();
    mats.water.opacity = 0.88 - 0.4 * smooth(0.1, 0.55, v);
    mats.water.emissiveIntensity = 0.42 + 0.8 * Math.sin(Math.PI * smooth(0, 0.5, v));
  }
  // Sparkles, steam and a flash while vanishing (in the holder's frame, rising straight up).
  const fx: React.ReactNode[] = [];
  if (v > 0 && v < 1) {
    for (let i = 0; i < 16; i++) {
      const p = clamp01((v - hash(i * 2.3) * 0.3) / 0.65);
      if (p <= 0 || p >= 1) continue;
      const a = hash(i * 7.1) * Math.PI * 2;
      const r0 = 0.03 + 0.06 * hash(i + 11);
      const k = Math.sin(p * Math.PI) * (0.65 + 0.35 * Math.sin(t * 22 + i * 1.7));
      fx.push(
        <mesh
          key={`k${i}`}
          geometry={getStarGeo()}
          material={sparkleMat(i % 3 ? "#BFF0FF" : "#FFFFFF")}
          position={[Math.cos(a) * (r0 + 0.12 * p), GLASS.pivot + 0.02 + 0.5 * p * (0.6 + 0.6 * hash(i + 5)), Math.sin(a) * (r0 + 0.08 * p) + 0.04]}
          scale={(0.025 + 0.03 * hash(i + 3)) * k}
          rotation={[0, 0, t * 3 + i]}
        />,
      );
    }
    for (let i = 0; i < 6; i++) {
      const p = clamp01((v - 0.04 - i * 0.05) / 0.75);
      if (p <= 0 || p >= 1) continue;
      fx.push(
        <mesh
          key={`s${i}`}
          geometry={geos.puff}
          material={mats.steam}
          position={[(hash(i + 1) - 0.5) * 0.12 + 0.05 * Math.sin(p * 5 + i), GLASS.pivot + 0.12 + 0.42 * p, (hash(i + 2) - 0.5) * 0.08]}
          scale={0.035 + 0.06 * p}
        />,
      );
    }
    mats.steam.opacity = 0.7 * (1 - smooth(0.55, 1, v));
  }
  return (
    <group>
      <group position={[0, GLASS.pivot, 0]} rotation={[0, 0, tilt]}>
        <group position={[0, -GLASS.pivot, 0]}>
          {showWater ? <mesh geometry={geos.water} material={mats.water} renderOrder={1} /> : null}
          <mesh geometry={geos.glass} material={mats.glass} renderOrder={2} />
          <mesh geometry={geos.rim} material={mats.rim} position={[0, GLASS.h - 0.001, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={3} />
          <mesh geometry={geos.streak} material={mats.streak} position={[-0.06, 0.2, 0.1]} rotation={[0, -0.5, 0.08]} renderOrder={3} />
          <mesh geometry={geos.streak} material={mats.streak} position={[-0.03, 0.19, 0.113]} rotation={[0, -0.25, 0.08]} scale={[0.5, 0.7, 1]} renderOrder={3} />
        </group>
      </group>
      <GlowBall color="#7FDBFF" size={0.42 * Math.sin(Math.PI * smooth(0, 0.6, v))} opacity={0.55 * Math.sin(Math.PI * smooth(0, 0.6, v))} position={[0, GLASS.pivot + 0.05, 0.05]} />
      {fx}
    </group>
  );
};

// =======================================================================================
// Watering can

/** Can in a fin (inside <Upright raise={finR}>): gripped at its side, the rose ≈ 0.25 above the fin tip. */
export const CAN_HOLD = { position: [0.45, -0.75, 1.05] as V3, rotation: [0, 0, 0] as V3, scale: 5 };
/** Same for the screen-left fin (spout pointing to screen-left, i.e. away from Nubi). */
export const CAN_HOLD_L = { position: [-0.45, -0.75, 1.05] as V3, rotation: [0, Math.PI, 0] as V3, scale: 5 };

const CAN = { r: 0.16, h: 0.27, pivot: [0, 0.36, 0] as V3, rose: [0.5, 0.36, 0] as V3 };

/** World-ish (can root) position of the rose and pouring direction for a tilt. */
const canRose = (tilt: number) => {
  const a = -clamp01(tilt) * 0.95;
  const [px, py] = CAN.pivot;
  const dx = CAN.rose[0] - px;
  const dy = CAN.rose[1] - py;
  const x = px + dx * Math.cos(a) - dy * Math.sin(a);
  const y = py + dx * Math.sin(a) + dy * Math.cos(a);
  const spout = 0.75 + a; // spout direction angle above the horizontal
  return { x, y, dir: [Math.cos(spout), Math.sin(spout)] as [number, number] };
};

/**
 * Toy watering can (sunny yellow, coral rose and handle), base on y = 0, body at the origin, spout
 * reaching to +x (rose at ≈ (0.5, 0.36)). `tilt` 0..1 tips it forward round its top handle until
 * the rose points down; `dust` 0..1: dry dust pours out of the rose instead of water.
 */
export const WateringCan: React.FC<{ tilt?: number; dust?: number; t?: number }> = ({ tilt = 0, dust = 0, t = 0 }) => {
  const geos = useMemo(() => {
    const body = new THREE.LatheGeometry(
      (
        [
          [0, 0],
          [CAN.r - 0.02, 0],
          [CAN.r, 0.02],
          [CAN.r + 0.005, CAN.h * 0.6],
          [CAN.r - 0.01, CAN.h - 0.02],
          [CAN.r - 0.05, CAN.h + 0.005],
          [0.085, CAN.h + 0.012],
          [0, CAN.h + 0.012],
        ] as [number, number][]
      ).map(([r, y]) => new THREE.Vector2(r, y)),
      36,
    );
    const spoutLen = Math.hypot(0.5 - 0.1, 0.36 - 0.07);
    return {
      body,
      band: new THREE.TorusGeometry(CAN.r + 0.004, 0.014, 8, 40),
      rim: new THREE.TorusGeometry(0.075, 0.017, 10, 30),
      hole: new THREE.CircleGeometry(0.07, 24),
      handle: new THREE.TorusGeometry(0.135, 0.022, 10, 26, Math.PI),
      spout: new THREE.CylinderGeometry(0.02, 0.036, spoutLen, 14),
      spoutLen,
      rose: new THREE.CylinderGeometry(0.06, 0.028, 0.06, 20),
      face: new THREE.CircleGeometry(0.058, 20),
      dot: new THREE.CircleGeometry(0.0075, 8),
      puff: new THREE.IcosahedronGeometry(1, 1),
    };
  }, []);
  const mats = useMemo(
    () => ({
      puff: new THREE.MeshStandardMaterial({ color: dustCols[1], emissive: new THREE.Color(dustCols[1]), emissiveIntensity: 0.35, roughness: 1, transparent: true, depthWrite: false }),
    }),
    [],
  );
  const yellow = toy("#FFC93C", { rough: 0.35, glow: 0.2 });
  const coral = toy("#FF6B5B", { rough: 0.35, glow: 0.2 });
  const dark = toy("#3A2E2A", { rough: 0.8, glow: 0.05 });
  const a = -clamp01(tilt) * 0.95;
  const spoutAng = Math.atan2(0.36 - 0.07, 0.5 - 0.1);
  const dots: V3[] = [];
  for (let k = 0; k < 7; k++) {
    const ang = (k / 6) * Math.PI * 2;
    dots.push(k === 6 ? [0, 0, 0] : [Math.cos(ang) * 0.032, Math.sin(ang) * 0.032, 0]);
  }
  // Dust out of the rose (in the can's root frame, falling straight down).
  const d = clamp01(dust);
  const fx: React.ReactNode[] = [];
  if (d > 0.01) {
    const rose = canRose(tilt);
    for (let i = 0; i < 14; i++) {
      const ph = frac(t * 1.5 + i / 14 + hash(i) * 0.1);
      const sp = 0.25 + 0.2 * hash(i + 3);
      const x = rose.x + rose.dir[0] * (0.03 + sp * ph) + (hash(i + 7) - 0.5) * 0.12 * ph;
      const y = rose.y + rose.dir[1] * (0.03 + sp * ph) - 0.55 * ph * ph;
      const z = (hash(i + 5) - 0.5) * 0.16 * ph;
      fx.push(<mesh key={i} geometry={geos.puff} material={mats.puff} position={[x, y, z]} scale={(0.022 + 0.06 * ph) * (0.6 + 0.6 * hash(i + 1)) * (0.5 + 0.5 * d)} rotation={[i, ph * 3, 0]} />);
    }
    mats.puff.opacity = 0.9 * d;
  }
  return (
    <group>
      <group position={CAN.pivot} rotation={[0, 0, a]}>
        <group position={[-CAN.pivot[0], -CAN.pivot[1], -CAN.pivot[2]]}>
          <mesh geometry={geos.body} material={yellow} />
          <mesh geometry={geos.band} material={coral} position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={geos.band} material={coral} position={[0, CAN.h * 0.72, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.99, 0.99, 1]} />
          <mesh geometry={geos.rim} material={coral} position={[-0.04, CAN.h + 0.014, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={geos.hole} material={dark} position={[-0.04, CAN.h + 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]} />
          {/* Top handle arching from the back over the opening. */}
          <mesh geometry={geos.handle} material={coral} position={[-0.02, CAN.h - 0.02, 0]} />
          {/* Spout from the low front up to the rose. */}
          <mesh geometry={geos.spout} material={yellow} position={[0.3, 0.215, 0]} rotation={[0, 0, spoutAng - Math.PI / 2]} />
          <group position={[0.5, 0.36, 0]} rotation={[0, 0, spoutAng - Math.PI / 2]}>
            <mesh geometry={geos.rose} material={coral} position={[0, 0.02, 0]} />
            <mesh geometry={geos.face} material={toy("#FFE7A0", { rough: 0.5, glow: 0.2 })} position={[0, 0.051, 0]} rotation={[-Math.PI / 2, 0, 0]} />
            {dots.map((p, k) => (
              <mesh key={k} geometry={geos.dot} material={dark} position={[p[0], 0.0525, p[1]]} rotation={[-Math.PI / 2, 0, 0]} />
            ))}
          </group>
        </group>
      </group>
      {fx}
    </group>
  );
};

/** A point of the can (can units, at rest) after tipping it by `tilt` (still in the can's own frame). */
export const canPoint = (local: V3, tilt: number): V3 => {
  const a = -clamp01(tilt) * 0.95;
  const [px, py] = CAN.pivot;
  const dx = local[0] - px;
  const dy = local[1] - py;
  return [px + dx * Math.cos(a) - dy * Math.sin(a), py + dx * Math.sin(a) + dy * Math.cos(a), local[2]];
};

/** Where the moth leaves the can (can space, at rest): the top opening. */
export const CAN_OPENING: V3 = [-0.04, CAN.h + 0.02, 0];

// =======================================================================================
// Moth

/**
 * A cute little moth (≈ 0.42 across the wings): fuzzy cream body, big shiny eyes, feathery
 * antennae, lilac wings with eye spots. Faces +z. `fly` 0..1: 0 = resting, wings swept back;
 * 1 = flapping fast (with a little bob). Move it along its path from the shot.
 */
export const Moth: React.FC<{ fly?: number; t?: number }> = ({ fly = 1, t = 0 }) => {
  const geos = useMemo(() => {
    const up = new THREE.Shape();
    up.moveTo(0, 0.02);
    up.quadraticCurveTo(0.06, 0.1, 0.17, 0.1);
    up.quadraticCurveTo(0.235, 0.09, 0.215, 0.035);
    up.quadraticCurveTo(0.19, -0.025, 0.1, -0.03);
    up.quadraticCurveTo(0.04, -0.03, 0, -0.01);
    const lo = new THREE.Shape();
    lo.moveTo(0, -0.005);
    lo.quadraticCurveTo(0.09, -0.02, 0.13, -0.06);
    lo.quadraticCurveTo(0.14, -0.12, 0.08, -0.12);
    lo.quadraticCurveTo(0.03, -0.1, 0, -0.04);
    const rot = new THREE.Matrix4().makeRotationX(Math.PI / 2);
    const upper = planarUV(new THREE.ShapeGeometry(up, 10)).applyMatrix4(rot);
    const lower = planarUV(new THREE.ShapeGeometry(lo, 10)).applyMatrix4(rot);
    return {
      upper,
      lower,
      body: new THREE.CapsuleGeometry(0.036, 0.085, 6, 14),
      head: new THREE.SphereGeometry(0.04, 18, 14),
      fluff: new THREE.IcosahedronGeometry(0.05, 1),
      eye: new THREE.SphereGeometry(0.019, 14, 10),
      shine: new THREE.SphereGeometry(0.006, 8, 6),
      ant: new THREE.CylinderGeometry(0.0035, 0.0035, 0.08, 6),
      feather: new THREE.SphereGeometry(1, 10, 8),
    };
  }, []);
  const wingMat = texMat("moth-wing", mothWingTex(), { rough: 0.8, glow: 0.22, side: THREE.DoubleSide });
  const fuzz = toy("#EADDC6", { rough: 0.95, glow: 0.22 });
  const fuzzDark = toy("#CDB99A", { rough: 0.95, glow: 0.18 });
  const eye = toy("#151515", { rough: 0.25, glow: 0 });
  const white = toy("#FFFFFF", { glow: 0.6 });
  const f = clamp01(fly);
  const beat = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 7);
  const flap = (1 - f) * 0.12 + f * (-0.35 + 1.25 * beat);
  const sweep = (1 - f) * 0.75;
  const bob = f * 0.012 * Math.sin(t * Math.PI * 2 * 7 + 1);
  const Wing: React.FC<{ side: 1 | -1 }> = ({ side }) => (
    <group scale={[side, 1, 1]}>
      <group position={[0.018, 0.005, 0.0]} rotation={[0, -sweep, flap]}>
        <mesh geometry={geos.upper} material={wingMat} />
      </group>
      <group position={[0.015, 0.0, -0.02]} rotation={[0, -sweep * 1.2, flap * 0.8]}>
        <mesh geometry={geos.lower} material={wingMat} />
      </group>
    </group>
  );
  return (
    <group position={[0, bob, 0]}>
      <mesh geometry={geos.body} material={fuzzDark} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.03]} />
      <mesh geometry={geos.fluff} material={fuzz} position={[0, 0.006, 0.03]} />
      <mesh geometry={geos.head} material={fuzz} position={[0, 0.01, 0.075]} />
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <mesh geometry={geos.eye} material={eye} position={[sd * 0.022, 0.018, 0.105]} />
          <mesh geometry={geos.shine} material={white} position={[sd * 0.022 - 0.006, 0.026, 0.121]} />
          <group position={[sd * 0.016, 0.045, 0.09]} rotation={[0.7, 0, -sd * 0.55]}>
            <mesh geometry={geos.ant} material={fuzzDark} position={[0, 0.04, 0]} />
            <mesh geometry={geos.feather} material={fuzz} position={[0, 0.07, 0]} scale={[0.012, 0.03, 0.006]} />
          </group>
        </group>
      ))}
      <Wing side={1} />
      <Wing side={-1} />
    </group>
  );
};

// =======================================================================================
// Pyjamas and nightcap (children of <Nubi>, model units)

type RingPt = { x: number; z: number; nx: number; nz: number };
const bodyRing = (seg: number): RingPt[] => {
  const { a, b, r } = NUBI_BODY;
  const pts: RingPt[] = [];
  const line = (x0: number, z0: number, x1: number, z1: number, nx: number, nz: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const k = i / n;
      pts.push({ x: x0 + (x1 - x0) * k, z: z0 + (z1 - z0) * k, nx, nz });
    }
  };
  const arc = (cx: number, cz: number, a0: number, a1: number) => {
    for (let i = 0; i < seg; i++) {
      const th = a0 + (a1 - a0) * (i / seg);
      pts.push({ x: cx + r * Math.cos(th), z: cz + r * Math.sin(th), nx: Math.cos(th), nz: Math.sin(th) });
    }
  };
  line(0, b, a - r, b, 0, 1, 6);
  arc(a - r, b - r, Math.PI / 2, 0);
  line(a, b - r, a, -(b - r), 1, 0, 10);
  arc(a - r, -(b - r), 0, -Math.PI / 2);
  line(a - r, -b, -(a - r), -b, 0, -1, 12);
  arc(-(a - r), -(b - r), -Math.PI / 2, -Math.PI);
  line(-a, -(b - r), -a, b - r, -1, 0, 10);
  arc(-(a - r), b - r, -Math.PI, -Math.PI * 1.5);
  line(-(a - r), b, 0, b, 0, 1, 6);
  pts.push({ x: 0, z: b, nx: 0, nz: 1 });
  return pts;
};

/** Band round the body from y0 to y1, `t` thick (bulging by `bulge`), with uvs (u round, v up). */
const bandGeometry = (y0: number, y1: number, t: number, bulge = 0, rows = 4) => {
  const path = bodyRing(8);
  const N = path.length;
  const lens = [0];
  for (let i = 1; i < N; i++) lens.push(lens[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z));
  const total = lens[N - 1];
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    const th = t + bulge * Math.sin(Math.PI * v);
    for (let i = 0; i < N; i++) {
      const p = path[i];
      pos.push(p.x + p.nx * th, y0 + (y1 - y0) * v, p.z + p.nz * th);
      uv.push(lens[i] / total, v);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < N - 1; i++) {
      const A = j * N + i;
      idx.push(A, A + 1, A + N + 1, A, A + N + 1, A + N);
    }
  }
  const cap = (y: number, up: boolean) => {
    const base = pos.length / 3;
    for (let i = 0; i < N; i++) {
      const p = path[i];
      pos.push(p.x + p.nx * t, y, p.z + p.nz * t, p.x - p.nx * 0.3, y, p.z - p.nz * 0.3);
      uv.push(lens[i] / total, up ? 1 : 0, lens[i] / total, up ? 1 : 0);
    }
    for (let i = 0; i < N - 1; i++) {
      const o = base + i * 2;
      if (up) idx.push(o, o + 2, o + 3, o, o + 3, o + 1);
      else idx.push(o, o + 3, o + 2, o, o + 1, o + 3);
    }
  };
  cap(y1, true);
  cap(y0, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

/**
 * Pyjama top: a light-blue band with little clouds and stars round the lower body (y 2.2 → 4.05,
 * below the eyes even when they open wide), white piping at the top and the hem, three white
 * buttons down the front and a pocket on the screen-right. Child of <Nubi>, no transform.
 */
export const Pajamas: React.FC = () => {
  const geos = useMemo(
    () => ({
      band: bandGeometry(2.2, 3.95, 0.24, 0.06, 5),
      pipeTop: bandGeometry(3.95, 4.12, 0.3, 0, 1),
      hem: bandGeometry(2.08, 2.26, 0.3, 0, 1),
      button: new THREE.CylinderGeometry(0.26, 0.26, 0.14, 18),
      pocket: rbox(1.5, 1.15, 0.12, 0.12),
    }),
    [],
  );
  const tex = useMemo(() => {
    const t = pajamaTex().clone();
    t.wrapS = THREE.RepeatWrapping;
    t.repeat.set(5, 1);
    t.needsUpdate = true;
    return t;
  }, []);
  const mat = texMat("pajama-band", tex, { rough: 0.8, glow: 0.18 });
  const white = toy("#FFFFFF", { rough: 0.6, glow: 0.2 });
  const front = NUBI_BODY.front;
  return (
    <group>
      <mesh geometry={geos.band} material={mat} />
      <mesh geometry={geos.pipeTop} material={white} />
      <mesh geometry={geos.hem} material={white} />
      {[2.55, 3.15, 3.72].map((y) => (
        <mesh key={y} geometry={geos.button} material={white} position={[0, y, front + 0.3]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
      <mesh geometry={geos.pocket} material={toy("#7FC6F5", { rough: 0.75, glow: 0.18 })} position={[3.05, 3.0, front + 0.27]} />
      <mesh geometry={rboxCache.pocketLip} material={white} position={[3.05, 3.55, front + 0.33]} />
    </group>
  );
};
const rboxCache = { pocketLip: rbox(1.56, 0.18, 0.1, 0.05) };

const CAP = { L: 7.4, R0: 3.25, R1: 0.42, rings: 30, radial: 26 };

/**
 * Striped nightcap (navy and white) with a fluffy white brim and a yellow pompom, sitting a
 * little off-centre on top of the body and curling over towards +x (screen-right). `flop`
 * −1..1: 0 = a lazy droop, 1 = flopped right down, −1 = flipped nearly upright (e.g. a jolt).
 * Child of <Nubi>, no transform.
 */
export const NightCap: React.FC<{ flop?: number }> = ({ flop = 0 }) => {
  const data = useMemo(() => {
    const { rings, radial } = CAP;
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array((rings + 1) * (radial + 1) * 3);
    const uv = new Float32Array((rings + 1) * (radial + 1) * 2);
    const idx: number[] = [];
    for (let i = 0; i <= rings; i++) {
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        uv[k * 2] = j / radial;
        uv[k * 2 + 1] = i / rings;
      }
    }
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < radial; j++) {
        const A = i * (radial + 1) + j;
        const B = A + radial + 1;
        idx.push(A, B, A + 1, A + 1, B, B + 1);
      }
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    const pom = new THREE.IcosahedronGeometry(1, 3);
    const pp = pom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) {
      const v = new THREE.Vector3(pp.getX(i), pp.getY(i), pp.getZ(i)).normalize();
      const n = 1 + 0.09 * Math.sin(v.x * 9.1 + v.y * 4.3) * Math.sin(v.z * 8.7 - v.y * 6.1) + 0.05 * Math.sin(v.y * 17 + v.x * 13);
      pp.setXYZ(i, v.x * n, v.y * n, v.z * n);
    }
    pom.computeVertexNormals();
    const brim = new THREE.TorusGeometry(CAP.R0 + 0.15, 0.62, 14, 40);
    const bp = brim.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i);
      const y = bp.getY(i);
      const z = bp.getZ(i);
      const a = Math.atan2(y, x);
      const k = 1 + 0.05 * Math.sin(a * 14) * Math.sign(z + 0.001);
      bp.setXYZ(i, x * k, y * k, z);
    }
    brim.computeVertexNormals();
    return { g, pom, brim, last: { flop: Number.NaN, tip: new THREE.Vector3(), tan: new THREE.Vector3() } };
  }, []);
  const fl = Math.max(-1, Math.min(1.2, flop));
  if (data.last.flop !== fl) {
    data.last.flop = fl;
    const { rings, radial, L, R0, R1 } = CAP;
    const total = 1.3 + 0.95 * fl;
    const pos = data.g.attributes.position as THREE.BufferAttribute;
    let cx = 0;
    let cy = 0;
    const ds = L / rings;
    for (let i = 0; i <= rings; i++) {
      const s = i / rings;
      const ang = total * Math.pow(s, 1.8);
      const r = R0 + (R1 - R0) * Math.pow(s, 0.85);
      const ux = Math.cos(ang);
      const uy = -Math.sin(ang);
      for (let j = 0; j <= radial; j++) {
        const ph = (j / radial) * Math.PI * 2;
        const k = i * (radial + 1) + j;
        pos.setXYZ(k, cx + r * Math.cos(ph) * ux, cy + r * Math.cos(ph) * uy, r * Math.sin(ph));
      }
      if (i === rings) {
        data.last.tip.set(cx, cy, 0);
        data.last.tan.set(Math.sin(ang), Math.cos(ang), 0);
      }
      cx += Math.sin(ang) * ds;
      cy += Math.cos(ang) * ds;
    }
    pos.needsUpdate = true;
    data.g.computeVertexNormals();
    data.g.computeBoundingSphere();
  }
  const tex = capTex();
  const mat = texMat("nightcap", tex, { rough: 0.75, glow: 0.18, side: THREE.DoubleSide });
  const tip = data.last.tip;
  const tan = data.last.tan;
  return (
    <group position={[0.5, 9.55, -0.45]} rotation={[-0.16, 0, -0.1]}>
      <mesh geometry={data.g} material={mat} />
      <mesh geometry={data.brim} material={toy("#FFFFFF", { rough: 0.95, glow: 0.22 })} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.15, 0]} />
      <mesh geometry={data.pom} material={toy("#FFD84A", { rough: 0.95, glow: 0.25 })} position={[tip.x + tan.x * 0.55, tip.y + tan.y * 0.55, 0]} scale={1.0} />
    </group>
  );
};

// =======================================================================================
// Studio set

const WALL_TEX_SIZE = 1.3;
/** Floor and ceiling run on past the (one-sided) front wall, for cameras standing outside it. */
const FRONT_APRON = 8;

/** One-sided wall plane (w × h, origin at its bottom-left in local x/y) with rectangular holes. */
const wallGeometry = (w: number, h: number, holes: { x: number; y: number; w: number; h: number }[]) => {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(w, 0);
  s.lineTo(w, h);
  s.lineTo(0, h);
  s.closePath();
  for (const o of holes) {
    const p = new THREE.Path();
    p.moveTo(o.x - o.w / 2, o.y - o.h / 2);
    p.lineTo(o.x - o.w / 2, o.y + o.h / 2);
    p.lineTo(o.x + o.w / 2, o.y + o.h / 2);
    p.lineTo(o.x + o.w / 2, o.y - o.h / 2);
    p.closePath();
    s.holes.push(p);
  }
  return new THREE.ShapeGeometry(s);
};

/** Window in a wall (local: centre at the origin, wall plane z = 0, room towards +z). */
const WindowFrame: React.FC<{ w: number; h: number; sill?: number; curtains?: boolean }> = ({ w, h, sill = 0.2, curtains = false }) => {
  const geos = useMemo(
    () => ({
      top: rbox(w + 0.22, 0.11, 0.16, 0.04),
      side: rbox(0.11, h + 0.22, 0.16, 0.04),
      revealH: new THREE.PlaneGeometry(w, 0.55),
      revealV: new THREE.PlaneGeometry(0.55, h),
      munV: rbox(0.055, h, 0.06, 0.02),
      munH: rbox(w, 0.055, 0.06, 0.02),
      glass: new THREE.PlaneGeometry(w, h),
      streak: new THREE.PlaneGeometry(0.08, h * 0.7),
      view: new THREE.PlaneGeometry(w + 2.8, h + 2.2),
      sill: rbox(w + 0.36, 0.07, sill, 0.03),
      valance: rbox(w + 0.5, 0.3, 0.06, 0.03),
      curtain: rbox(0.3, h * 0.85, 0.06, 0.03),
      tie: new THREE.TorusGeometry(0.17, 0.025, 6, 20),
    }),
    [w, h, sill],
  );
  const glassMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#DFF3FF", transparent: true, opacity: 0.16, depthWrite: false }),
    [],
  );
  const streakMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.32, depthWrite: false }), []);
  const white = toy("#FFFFFF", { rough: 0.45, glow: 0.18 });
  const reveal = toy("#F8E6D2", { rough: 0.8, glow: 0.12, side: THREE.DoubleSide });
  const gingham = useMemo(() => {
    const t = ginghamTex().clone();
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 1);
    t.needsUpdate = true;
    return t;
  }, []);
  const ging = texMat(`gingham-${w}`, gingham, { rough: 0.8, glow: 0.2 });
  return (
    <group>
      <mesh geometry={geos.view} material={texMat("window-view", skyTex(), { rough: 1, glow: 0.85 })} position={[0, 0.2, -0.75]} />
      <mesh geometry={geos.revealH} material={reveal} position={[0, h / 2, -0.27]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={geos.revealH} material={reveal} position={[0, -h / 2, -0.27]} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh geometry={geos.revealV} material={reveal} position={[-w / 2, 0, -0.27]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={geos.revealV} material={reveal} position={[w / 2, 0, -0.27]} rotation={[0, -Math.PI / 2, 0]} />
      <mesh geometry={geos.munV} material={white} position={[0, 0, -0.08]} />
      <mesh geometry={geos.munH} material={white} position={[0, 0, -0.08]} />
      <mesh geometry={geos.glass} material={glassMat} position={[0, 0, -0.1]} />
      <mesh geometry={geos.streak} material={streakMat} position={[-w * 0.22, 0.05, -0.09]} rotation={[0, 0, -0.5]} />
      <mesh geometry={geos.streak} material={streakMat} position={[w * 0.27, -0.1, -0.09]} rotation={[0, 0, -0.5]} scale={[0.5, 0.6, 1]} />
      <mesh geometry={geos.top} material={white} position={[0, h / 2 + 0.055, 0.03]} />
      <mesh geometry={geos.top} material={white} position={[0, -h / 2 - 0.055, 0.03]} />
      <mesh geometry={geos.side} material={white} position={[-w / 2 - 0.055, 0, 0.03]} />
      <mesh geometry={geos.side} material={white} position={[w / 2 + 0.055, 0, 0.03]} />
      {sill > 0 ? <mesh geometry={geos.sill} material={white} position={[0, -h / 2 - 0.09, sill / 2 - 0.04]} /> : null}
      {curtains ? (
        <group>
          <mesh geometry={geos.valance} material={ging} position={[0, h / 2 + 0.12, 0.14]} />
          {[-1, 1].map((sd) => (
            <group key={sd}>
              <mesh geometry={geos.curtain} material={ging} position={[sd * (w / 2 + 0.1), h * 0.04, 0.12]} />
              <mesh geometry={geos.tie} material={toy("#FF5A4E", { glow: 0.2 })} position={[sd * (w / 2 + 0.1), -h * 0.15, 0.13]} rotation={[Math.PI / 2, 0, 0]} scale={[0.9, 0.9, 0.5]} />
            </group>
          ))}
        </group>
      ) : null}
    </group>
  );
};

/** The quilt over the bed: a draped grid that bulges over a sleeper at STUDIO_BED (cover 0..1). */
const Quilt: React.FC<{ cover: number }> = ({ cover }) => {
  const NX = 34;
  const NZ = 26;
  const X0 = BED.x0 - 0.32;
  const X1 = BED.x1 + 0.32;
  const Z0 = -2.15;
  const Z1 = BED.z1 + 0.3;
  const data = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1, NX, NZ);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (X1 - X0) * 0.9, uv.getY(i) * (Z1 - Z0) * 0.9);
    return { g, last: Number.NaN };
  }, [X0, X1, Z0, Z1]);
  const c = clamp01(cover);
  if (data.last !== c) {
    data.last = c;
    const pos = data.g.attributes.position as THREE.BufferAttribute;
    const top = BED.top + 0.07;
    const mx0 = BED.x0 + 0.04;
    const mx1 = BED.x1 - 0.04;
    const mz1 = BED.z1 - 0.02;
    for (let i = 0; i < pos.count; i++) {
      // PlaneGeometry spans −0.5..0.5 in x and y (y = +0.5 is the first row).
      const u = pos.getX(i) + 0.5;
      const w = 0.5 - pos.getY(i);
      let x = X0 + (X1 - X0) * u;
      let z = Z0 + (Z1 - Z0) * w;
      let y = top + 0.012 * Math.sin(x * 7.1 + z * 3.3) + 0.01 * Math.sin(z * 9.7 - x * 2.1);
      // Bulge over the sleeper.
      const qx = Math.max(0, Math.abs(x - STUDIO_BED[0]) - 0.95);
      const qz = Math.max(0, Math.abs(z - STUDIO_BED[2]) - 0.85);
      y += c * 0.5 * (1 - smooth(0, 0.45, Math.hypot(qx, qz)));
      // Drape down over the sides and the foot.
      const dx = x < mx0 ? mx0 - x : x > mx1 ? x - mx1 : 0;
      const dz = z > mz1 ? z - mz1 : 0;
      const dd = Math.max(dx, dz);
      if (dd > 0) {
        y -= Math.min(0.42, dd * 1.6);
        if (dx > 0) x = x < mx0 ? mx0 - Math.min(dx, 0.06) - 0.02 * Math.min(1, dx * 4) : mx1 + Math.min(dx, 0.06) + 0.02 * Math.min(1, dx * 4);
        if (dz > 0) z = mz1 + Math.min(dz, 0.06);
      }
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
    data.g.computeVertexNormals();
    data.g.computeBoundingSphere();
  }
  const mat = texMat("quilt", withRepeat(quiltTex(), 1, 1), { rough: 0.85, glow: 0.17, side: THREE.DoubleSide });
  return <mesh geometry={data.g} material={mat} />;
};

export type StudioProps = {
  t?: number;
  /** Faucet state (handle, flow, sputter, shake). */
  faucet?: FaucetState;
  /** Water in the basin, 0..1 (defaults to following `faucet.flow`). */
  pool?: number;
  /** The plant on the windowsill wilts, 0..1. */
  wilt?: number;
  /** Hide the plant (when the shot places its own). */
  plant?: boolean;
  /** Quilt bulging over a sleeper at STUDIO_BED, 0..1. */
  blanket?: number;
  /** Bedside lamp glow, 0..1. */
  lamp?: number;
};

/**
 * Nubi's studio (see the layout at the top of this file and the STUDIO_* spots). No lights:
 * add <StudioLights />.
 */
export const Studio: React.FC<StudioProps> = ({ t = 0, faucet = {}, pool, wilt = 0, plant = true, blanket = 0, lamp = 0.25 }) => {
  const { x0, x1, zBack, zFront, height: H } = STUDIO;
  const W = x1 - x0;
  const D = zFront - zBack;
  const geos = useMemo(() => {
    const basin = STUDIO_BASIN;
    const topShape = new THREE.Shape();
    const C = STUDIO_COUNTER;
    // Counter top in shape space (x, −z), with the basin hole.
    topShape.moveTo(C.x0, -C.z1 + 0.04);
    topShape.lineTo(C.x1 + 0.03, -C.z1 + 0.04);
    topShape.lineTo(C.x1 + 0.03, -C.z0);
    topShape.lineTo(C.x0, -C.z0);
    topShape.closePath();
    const hole = new THREE.Path();
    const hx = basin.w / 2;
    const hz = basin.d / 2;
    hole.moveTo(basin.x - hx, -(basin.z - hz));
    hole.lineTo(basin.x - hx, -(basin.z + hz));
    hole.lineTo(basin.x + hx, -(basin.z + hz));
    hole.lineTo(basin.x + hx, -(basin.z - hz));
    hole.closePath();
    topShape.holes.push(hole);
    const counterTop = new THREE.ExtrudeGeometry(topShape, { depth: 0.07, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
    counterTop.rotateX(-Math.PI / 2);
    return {
      floor: worldPlane(W, D + FRONT_APRON),
      ceiling: new THREE.PlaneGeometry(W, D + FRONT_APRON),
      back: wallGeometry(W, H, [{ x: KITCHEN_WINDOW.x - x0, y: KITCHEN_WINDOW.y, w: KITCHEN_WINDOW.w, h: KITCHEN_WINDOW.h }]),
      left: wallGeometry(D, H, []),
      right: wallGeometry(D, H, [{ x: PLANT_WINDOW.z - zBack, y: PLANT_WINDOW.y, w: PLANT_WINDOW.w, h: PLANT_WINDOW.h }]),
      front: wallGeometry(W, H, []),
      wainBack: worldPlane(W, 0.95),
      wainSide: worldPlane(D, 0.95),
      rail: rbox(1, 0.07, 0.07, 0.03),
      skirt: rbox(1, 0.13, 0.045, 0.02),
      cabL: rbox(basin.x - basin.w / 2 - 0.02 - C.x0, C.top - 0.1, C.z1 - C.z0 - 0.04, 0.05),
      cabR: rbox(C.x1 - (basin.x + basin.w / 2 + 0.02), C.top - 0.1, C.z1 - C.z0 - 0.04, 0.05),
      cabM: rbox(basin.w + 0.06, basin.floor - 0.12, C.z1 - C.z0 - 0.04, 0.05),
      apron: rbox(basin.w + 0.1, C.top - basin.floor + 0.02, 0.08, 0.03),
      kick: new THREE.BoxGeometry(C.x1 - C.x0 - 0.04, 0.1, C.z1 - C.z0 - 0.12),
      door: rbox(0.72, 0.62, 0.04, 0.05),
      knob: new THREE.SphereGeometry(0.035, 12, 10),
      counterTop,
      basin: new THREE.BoxGeometry(basin.w, C.top - basin.floor, basin.d),
      drain: new THREE.CircleGeometry(0.05, 20),
      drainRing: new THREE.TorusGeometry(0.05, 0.01, 6, 20),
      pool: rbox(basin.w - 0.02, 1, basin.d - 0.02, 0.06, 2),
      tiles: worldPlane(C.x1 - C.x0, 0.38),
      shelf: rbox(0.95, 0.05, 0.28, 0.02),
      bracket: rbox(0.04, 0.16, 0.2, 0.015),
      jar: new THREE.CylinderGeometry(0.075, 0.075, 0.18, 18),
      lid: new THREE.CylinderGeometry(0.08, 0.08, 0.04, 18),
      mug: new THREE.CylinderGeometry(0.06, 0.055, 0.12, 18),
      mugHandle: new THREE.TorusGeometry(0.035, 0.012, 6, 14),
      hob: rbox(0.72, 0.035, 0.55, 0.02),
      burner: new THREE.TorusGeometry(0.11, 0.022, 8, 24),
      kettle: new THREE.SphereGeometry(0.16, 22, 16),
      kettleLid: new THREE.SphereGeometry(0.05, 12, 8),
      kettleSpout: new THREE.CylinderGeometry(0.018, 0.03, 0.18, 10),
      kettleHandle: new THREE.TorusGeometry(0.1, 0.018, 8, 18, Math.PI),
      // Bed.
      bedBase: rbox(BED.x1 - BED.x0, 0.34, BED.z1 - BED.z0, 0.08),
      bedLeg: new THREE.CylinderGeometry(0.05, 0.04, 0.13, 10),
      mattress: rbox(BED.x1 - BED.x0 - 0.08, 0.27, BED.z1 - BED.z0 - 0.14, 0.1),
      headboard: rbox(BED.x1 - BED.x0 + 0.12, 1.5, 0.14, 0.07),
      headDot: new THREE.CircleGeometry(0.16, 24),
      pillow: rbox(1.25, 0.22, 0.55, 0.11),
      sheetFold: rbox(BED.x1 - BED.x0 - 0.02, 0.06, 0.16, 0.03),
      // Nightstand, lamp, alarm clock.
      stand: rbox(0.52, 0.68, 0.48, 0.05),
      drawerLine: new THREE.BoxGeometry(0.46, 0.012, 0.01),
      lampBase: new THREE.CylinderGeometry(0.08, 0.1, 0.05, 18),
      lampStem: new THREE.CylinderGeometry(0.018, 0.018, 0.26, 8),
      lampShade: new THREE.SphereGeometry(0.17, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      clockBody: new THREE.CylinderGeometry(0.105, 0.105, 0.075, 24),
      clockFace: new THREE.CircleGeometry(0.088, 24),
      bell: new THREE.SphereGeometry(0.05, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      clockFoot: new THREE.SphereGeometry(0.02, 8, 6),
      // Plant window seat.
      seat: rbox(0.6, SILL.top - 0.1, SILL.z1 - SILL.z0 - 0.06, 0.06),
      sill: rbox(0.68, 0.1, SILL.z1 - SILL.z0, 0.04),
      cushion: rbox(0.45, 0.07, 0.5, 0.035),
      // Decor.
      poster: new THREE.PlaneGeometry(1.0, 1.25),
      posterFrame: rbox(1.08, 1.33, 0.03, 0.02),
      wallClock: new THREE.CylinderGeometry(0.33, 0.33, 0.06, 32),
      wallClockFace: new THREE.CircleGeometry(0.28, 32),
      book: rbox(0.07, 0.3, 0.22, 0.01),
      rug: new THREE.CircleGeometry(1.7, 48),
      cactusPot: new THREE.CylinderGeometry(0.07, 0.055, 0.1, 14),
      cactus: new THREE.CapsuleGeometry(0.045, 0.1, 4, 10),
      beanbag: new THREE.SphereGeometry(0.55, 22, 14),
    };
  }, [W, D, H, x0, zBack]);

  const wallMat = texMat("wall", withRepeat(wallTex(), 1 / WALL_TEX_SIZE, 1 / WALL_TEX_SIZE), { rough: 0.9, glow: 0.16 });
  const wainMat = texMat("wainscot", withRepeat(wainscotTex(), 1 / 1.0, 1 / 0.95), { rough: 0.7, glow: 0.15 });
  const floorMat = texMat("floor", withRepeat(floorTex(), 0.5, 0.5), { rough: 0.55, glow: 0.12 });
  const tileMat = texMat("tiles", withRepeat(tilesTex(), 1 / 0.5, 1 / 0.5), { rough: 0.3, glow: 0.14 });
  const white = toy("#FFFFFF", { rough: 0.45, glow: 0.16 });
  const butter = toy("#FFD36E", { rough: 0.45, glow: 0.16 });
  const sky = toy("#7EC8F2", { rough: 0.45, glow: 0.16 });
  const lilac = toy("#B9A4F2", { rough: 0.5, glow: 0.16 });
  const coral = toy("#FF8A6E", { rough: 0.45, glow: 0.18 });
  const ceramic = toy("#F4F8FB", { rough: 0.22, glow: 0.12, side: THREE.BackSide });
  const chrome = toy("#C9D4DE", { metal: 0.4, rough: 0.2, glow: 0.2 });
  const dark = toy("#2A3442", { rough: 0.6, glow: 0.05 });
  const lampMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#FFB38A", emissive: new THREE.Color("#FFB070"), roughness: 0.5, side: THREE.DoubleSide }), []);
  lampMat.emissiveIntensity = 0.2 + 0.9 * clamp01(lamp);

  const C = STUDIO_COUNTER;
  const B = STUDIO_BASIN;
  const flow = clamp01(faucet.flow ?? 0);
  const poolLevel = clamp01(pool ?? flow) * 0.14;
  const faucetFloor = B.floor + poolLevel - STUDIO_FAUCET[1];

  const railRun = (len: number, at: V3, rotY: number, mesh: THREE.BufferGeometry, mat: THREE.Material, key: string) => (
    <mesh key={key} geometry={mesh} material={mat} position={at} rotation={[0, rotY, 0]} scale={[len, 1, 1]} />
  );

  return (
    <group>
      {/* Floor, ceiling and walls (one-sided, facing in). */}
      <mesh geometry={geos.floor} material={floorMat} rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0, (zBack + zFront + FRONT_APRON) / 2]} />
      <mesh geometry={geos.ceiling} material={toy("#FFF3E4", { rough: 0.9, glow: 0.75 })} rotation={[Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, H, (zBack + zFront + FRONT_APRON) / 2]} />
      <mesh geometry={geos.back} material={wallMat} position={[x0, 0, zBack]} />
      <mesh geometry={geos.left} material={wallMat} position={[x0, 0, zFront]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={geos.right} material={wallMat} position={[x1, 0, zBack]} rotation={[0, -Math.PI / 2, 0]} />
      <mesh geometry={geos.front} material={wallMat} position={[x1, 0, zFront]} rotation={[0, Math.PI, 0]} />
      {/* Wainscot below the chair rail, rail and skirting. */}
      <mesh geometry={geos.wainBack} material={wainMat} position={[(x0 + x1) / 2, 0.475, zBack + 0.01]} />
      <mesh geometry={geos.wainSide} material={wainMat} position={[x0 + 0.01, 0.475, (zBack + zFront) / 2]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={geos.wainSide} material={wainMat} position={[x1 - 0.01, 0.475, (zBack + zFront) / 2]} rotation={[0, -Math.PI / 2, 0]} />
      <mesh geometry={geos.wainBack} material={wainMat} position={[(x0 + x1) / 2, 0.475, zFront - 0.01]} rotation={[0, Math.PI, 0]} />
      {railRun(W, [(x0 + x1) / 2, 0.97, zBack + 0.03], 0, geos.rail, white, "r0")}
      {railRun(D, [x0 + 0.03, 0.97, (zBack + zFront) / 2], Math.PI / 2, geos.rail, white, "r1")}
      {railRun(D, [x1 - 0.03, 0.97, (zBack + zFront) / 2], Math.PI / 2, geos.rail, white, "r2")}
      {railRun(W, [(x0 + x1) / 2, 0.065, zBack + 0.03], 0, geos.skirt, white, "s0")}
      {railRun(D, [x0 + 0.03, 0.065, (zBack + zFront) / 2], Math.PI / 2, geos.skirt, white, "s1")}
      {railRun(D, [x1 - 0.03, 0.065, (zBack + zFront) / 2], Math.PI / 2, geos.skirt, white, "s2")}

      {/* Kitchenette: cabinets, counter top with the basin, tiles, faucet, window, shelf, hob and kettle. */}
      <mesh geometry={geos.cabL} material={butter} position={[(C.x0 + B.x - B.w / 2 - 0.02) / 2, 0.1 + (C.top - 0.1) / 2 - 0.03, (C.z0 + C.z1) / 2 - 0.02]} />
      <mesh geometry={geos.cabR} material={butter} position={[(C.x1 + B.x + B.w / 2 + 0.02) / 2, 0.1 + (C.top - 0.1) / 2 - 0.03, (C.z0 + C.z1) / 2 - 0.02]} />
      <mesh geometry={geos.cabM} material={butter} position={[B.x, 0.1 + (B.floor - 0.12) / 2 - 0.01, (C.z0 + C.z1) / 2 - 0.02]} />
      <mesh geometry={geos.apron} material={butter} position={[B.x, (C.top + B.floor) / 2 - 0.04, C.z1 - 0.06]} />
      <mesh geometry={geos.kick} material={toy("#E0A93A", { glow: 0.12 })} position={[(C.x0 + C.x1) / 2, 0.05, (C.z0 + C.z1) / 2 - 0.06]} />
      {[-4.05, -3.3, -2.68, -1.82].map((x, i) => (
        <group key={x} position={[x, 0.5, C.z1 - 0.005]}>
          <mesh geometry={geos.door} material={toy("#FFE29A", { rough: 0.45, glow: 0.16 })} scale={[i === 3 ? 0.55 : 1, 1, 1]} />
          <mesh geometry={geos.knob} material={coral} position={[i % 2 ? -0.25 : 0.25, 0.2, 0.04]} />
        </group>
      ))}
      <mesh geometry={geos.counterTop} material={white} position={[0, C.top - 0.09, 0]} />
      <mesh geometry={geos.basin} material={ceramic} position={[B.x, (C.top + B.floor) / 2, B.z]} />
      <mesh geometry={geos.drain} material={dark} position={[B.x - 0.05, B.floor + 0.003, B.z]} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh geometry={geos.drainRing} material={chrome} position={[B.x - 0.05, B.floor + 0.006, B.z]} rotation={[-Math.PI / 2, 0, 0]} />
      {poolLevel > 0.004 ? (
        <mesh geometry={geos.pool} material={waterMat()} position={[B.x, B.floor + poolLevel / 2, B.z]} scale={[1, poolLevel, 1]} />
      ) : null}
      <mesh geometry={geos.tiles} material={tileMat} position={[(C.x0 + C.x1) / 2, C.top + 0.19, zBack + 0.015]} />
      <group position={STUDIO_FAUCET} rotation={[0, FAUCET_YAW, 0]} scale={FAUCET_SCALE}>
        <Faucet {...faucet} t={t} floor={faucetFloor / FAUCET_SCALE} />
      </group>
      <group position={[KITCHEN_WINDOW.x, KITCHEN_WINDOW.y, zBack]}>
        <WindowFrame w={KITCHEN_WINDOW.w} h={KITCHEN_WINDOW.h} sill={0.16} curtains />
      </group>
      <group position={[-3.95, 1.92, zBack + 0.15]}>
        <mesh geometry={geos.shelf} material={white} />
        <mesh geometry={geos.bracket} material={white} position={[-0.38, -0.1, -0.03]} />
        <mesh geometry={geos.bracket} material={white} position={[0.38, -0.1, -0.03]} />
        {[
          [-0.3, "#FF8A6E"],
          [-0.1, "#7EC8F2"],
          [0.1, "#B9A4F2"],
        ].map(([x, c]) => (
          <group key={x as number} position={[x as number, 0.115, 0]}>
            <mesh geometry={geos.jar} material={toy("#F2FAFF", { rough: 0.2, glow: 0.2 })} />
            <mesh geometry={geos.lid} material={toy(c as string, { glow: 0.2 })} position={[0, 0.1, 0]} />
          </group>
        ))}
        <group position={[0.31, 0.085, 0.02]}>
          <mesh geometry={geos.mug} material={coral} />
          <mesh geometry={geos.mugHandle} material={coral} position={[0.065, 0, 0]} />
        </group>
      </group>
      <group position={[-3.95, C.top, -2.45]}>
        <mesh geometry={geos.hob} material={white} position={[0, 0.018, 0]} />
        <mesh geometry={geos.burner} material={dark} position={[-0.17, 0.04, 0.1]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={geos.burner} material={dark} position={[0.17, 0.04, -0.1]} rotation={[Math.PI / 2, 0, 0]} />
        <group position={[-0.17, 0.05, 0.1]}>
          <mesh geometry={geos.kettle} material={coral} position={[0, 0.11, 0]} scale={[1, 0.8, 1]} />
          <mesh geometry={geos.kettleLid} material={white} position={[0, 0.235, 0]} />
          <mesh geometry={geos.kettleSpout} material={coral} position={[0.17, 0.15, 0]} rotation={[0, 0, -0.9]} />
          <mesh geometry={geos.kettleHandle} material={dark} position={[0, 0.22, 0]} rotation={[0, Math.PI / 2, 0]} />
        </group>
      </group>

      {/* Middle of the back wall: a shelf with books and a cactus, the wall clock above. */}
      <group position={[0.1, 2.32, zBack + 0.15]}>
        <mesh geometry={geos.shelf} material={white} scale={[1.7, 1, 1]} />
        <mesh geometry={geos.bracket} material={white} position={[-0.6, -0.1, -0.03]} />
        <mesh geometry={geos.bracket} material={white} position={[0.6, -0.1, -0.03]} />
        {["#FF8A6E", "#FFD36E", "#7EC8F2", "#B9A4F2", "#8EDCA2"].map((c, i) => (
          <mesh key={c} geometry={geos.book} material={toy(c, { glow: 0.18 })} position={[-0.7 + i * 0.085, 0.175, 0]} rotation={[0, 0, i === 4 ? -0.25 : 0]} scale={[1, 0.85 + 0.12 * ((i * 3) % 3), 1]} />
        ))}
        <group position={[0.45, 0.025, 0]}>
          <mesh geometry={geos.cactusPot} material={coral} position={[0, 0.05, 0]} />
          <mesh geometry={geos.cactus} material={toy("#4CC26A", { glow: 0.18 })} position={[0, 0.17, 0]} />
        </group>
      </group>
      <group position={[0.1, 3.15, zBack + 0.035]}>
        <mesh geometry={geos.wallClock} material={toy("#FF8A6E", { glow: 0.2 })} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={geos.wallClockFace} material={texMat("clock", clockTex(), { rough: 0.5, glow: 0.3 })} position={[0, 0, 0.032]} />
      </group>

      {/* Bed against the back wall, quilt, pillow, posters. */}
      <group>
        {[
          [BED.x0 + 0.12, BED.z0 + 0.15],
          [BED.x1 - 0.12, BED.z0 + 0.15],
          [BED.x0 + 0.12, BED.z1 - 0.12],
          [BED.x1 - 0.12, BED.z1 - 0.12],
        ].map(([x, z]) => (
          <mesh key={`${x}-${z}`} geometry={geos.bedLeg} material={white} position={[x, 0.065, z]} />
        ))}
        <mesh geometry={geos.bedBase} material={sky} position={[(BED.x0 + BED.x1) / 2, 0.3, (BED.z0 + BED.z1) / 2]} />
        <mesh geometry={geos.mattress} material={white} position={[(BED.x0 + BED.x1) / 2, BED.top - 0.135, (BED.z0 + BED.z1) / 2 + 0.03]} />
        <mesh geometry={geos.headboard} material={sky} position={[(BED.x0 + BED.x1) / 2, 0.75, BED.z0 + 0.08]} />
        {[-0.7, 0, 0.7].map((dx) => (
          <mesh key={dx} geometry={geos.headDot} material={white} position={[(BED.x0 + BED.x1) / 2 + dx, 1.2, BED.z0 + 0.152]} scale={dx === 0 ? 1.15 : 0.8} />
        ))}
        <mesh geometry={geos.pillow} material={toy("#F3F8FF", { rough: 0.7, glow: 0.18 })} position={[(BED.x0 + BED.x1) / 2, BED.top + 0.1, -2.55]} rotation={[0.25, 0.04, 0.02]} />
        <mesh geometry={geos.sheetFold} material={white} position={[(BED.x0 + BED.x1) / 2, BED.top + 0.07, -2.13]} />
        <Quilt cover={blanket} />
      </group>
      <group position={[2.7, 2.45, zBack + 0.02]}>
        <mesh geometry={geos.posterFrame} material={white} />
        <mesh geometry={geos.poster} material={texMat("poster-wave", posterWaveTex(), { rough: 0.7, glow: 0.2 })} position={[0, 0, 0.02]} />
      </group>
      <group position={[x0 + 0.02, 2.15, 0.7]} rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={geos.posterFrame} material={white} />
        <mesh geometry={geos.poster} material={texMat("poster-cloud", posterCloudTex(), { rough: 0.7, glow: 0.2 })} position={[0, 0, 0.02]} />
      </group>

      {/* Nightstand with the lamp and the alarm clock. */}
      <group position={NIGHTSTAND}>
        <mesh geometry={geos.stand} material={lilac} position={[0, 0.34, 0]} />
        <mesh geometry={geos.drawerLine} material={toy("#9A84D8", { glow: 0.1 })} position={[0, 0.42, 0.242]} />
        <mesh geometry={geos.knob} material={white} position={[0, 0.52, 0.25]} />
        <group position={[0.08, 0.68, -0.08]}>
          <mesh geometry={geos.lampBase} material={white} position={[0, 0.025, 0]} />
          <mesh geometry={geos.lampStem} material={white} position={[0, 0.16, 0]} />
          <mesh geometry={geos.lampShade} material={lampMat} position={[0, 0.25, 0]} scale={[1, 0.85, 1]} />
        </group>
        <group position={[-0.1, 0.68, 0.1]} rotation={[0, -0.35, 0]}>
          <mesh geometry={geos.clockBody} material={toy("#FF5A4E", { rough: 0.35, glow: 0.2 })} position={[0, 0.125, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={geos.clockFace} material={texMat("alarm", clockTex(), { rough: 0.5, glow: 0.3 })} position={[0, 0.125, 0.039]} />
          <mesh geometry={geos.bell} material={toy("#FFC21A", { metal: 0.5, rough: 0.3, glow: 0.25 })} position={[-0.07, 0.215, 0]} rotation={[0, 0, 0.5]} />
          <mesh geometry={geos.bell} material={toy("#FFC21A", { metal: 0.5, rough: 0.3, glow: 0.25 })} position={[0.07, 0.215, 0]} rotation={[0, 0, -0.5]} />
          <mesh geometry={geos.clockFoot} material={dark} position={[-0.06, 0.02, 0]} />
          <mesh geometry={geos.clockFoot} material={dark} position={[0.06, 0.02, 0]} />
        </group>
      </group>

      {/* Right wall: window with a deep sill (window seat) and the potted plant. */}
      <group position={[x1, PLANT_WINDOW.y, PLANT_WINDOW.z]} rotation={[0, -Math.PI / 2, 0]}>
        <WindowFrame w={PLANT_WINDOW.w} h={PLANT_WINDOW.h} sill={0} />
      </group>
      <mesh geometry={geos.seat} material={sky} position={[x1 - 0.32, (SILL.top - 0.1) / 2, (SILL.z0 + SILL.z1) / 2]} />
      <mesh geometry={geos.sill} material={white} position={[x1 - 0.32, SILL.top - 0.05, (SILL.z0 + SILL.z1) / 2]} />
      <mesh geometry={geos.cushion} material={coral} position={[x1 - 0.3, SILL.top + 0.03, SILL.z1 - 0.36]} rotation={[0, 0.15, 0]} />
      {plant ? (
        <group position={STUDIO_PLANT} scale={STUDIO_PLANT_SCALE} rotation={[0, -0.4, 0]}>
          <PottedPlant wilt={wilt} />
        </group>
      ) : null}

      {/* Rug and a beanbag. */}
      <mesh geometry={geos.rug} material={texMat("rug", rugTex(), { rough: 0.95, glow: 0.14 })} rotation={[-Math.PI / 2, 0, 0]} position={[STUDIO_MIDDLE[0] + 0.2, 0.006, STUDIO_MIDDLE[2] + 0.1]} />
      <mesh geometry={geos.beanbag} material={lilac} position={[-3.6, 0.3, 2.3]} scale={[1, 0.6, 1]} />
    </group>
  );
};

/** Daylight for the studio: warm sun from the front-right, cool fill from the left. */
export const StudioLights: React.FC<{ intensity?: number }> = ({ intensity = 1 }) => (
  <>
    <hemisphereLight args={["#FFF4E6", "#A4836A", 1.3 * intensity]} />
    <directionalLight position={[5, 8, 7]} intensity={2.2 * intensity} color="#FFF2DE" />
    <directionalLight position={[-7, 4, 3]} intensity={0.8 * intensity} color="#D2E8FF" />
    <directionalLight position={[1, 3, -6]} intensity={0.35 * intensity} color="#FFE0BE" />
  </>
);

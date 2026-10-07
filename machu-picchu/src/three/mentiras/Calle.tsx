import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Lids } from "../dormir/Street";
import { CHICO_BLUE, Chico } from "../ia/Rooms";
import { V3, canvasTexture, glowTexture, paintGeo, shadeHex, toy, useFontsReady, vertexMat } from "../inca/kit";
import { mulberry } from "../noise";
import { NubiPose } from "../Nubi";
import { Glow, additive } from "../thanos/FX";

// The street of "¿Y si tus mentiras salieran sobre tu cabeza?" (agent "calle"): a sunny city
// sidewalk in the morning. LEFT: a café (cream wall, a big window on a warm interior, a red-and-white
// striped awning over the terrace, the CAFÉ sign) with its terrace: a small round table with coffee
// cups, two chairs and an A-frame menu board. RIGHT, next door: a violet sneaker shop with a big
// glass shop window: a pedestal with a pair of glowing gold sneakers under a spotlight, sparkles and
// the price card «S/ 799»; shelves of sneakers on the back wall. A lamppost, planters, neighbouring
// buildings, the road and, across it, another row of buildings (seen from inside the shop window).
//
// Props for the shots: Nubi's big baseball cap (its "anti-tag shield") that bulges and rips open
// when a truth tag rises through it (torn flaps, shreds, a burst of light), the friend (Chico, the
// light-blue Nubi with a backwards cap, here with a yellow hoodie hood, heart eyes, lids and a sweat
// drop), the 100-soles banknote, dust puffs, floating hearts.
//
// World units are sized for a <Nubi size={2}> (2 wide, ≈ 2 tall); ground y = 0; +z points to the
// camera (the street); the shop fronts sit on z = CALLE.facadeZ. Light: three lights, no shadow
// maps (blob shadows). Static geometry is built once (module caches); everything is deterministic.

const TITLE = "'Luckiest Guy', 'Lilita One', sans-serif";
const FUN = "'Lilita One', 'Luckiest Guy', sans-serif";
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const once = <T,>(make: () => T) => {
  let v: T | undefined;
  return () => (v ??= make());
};
const rbox = (w: number, h: number, d: number, r: number, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) * 0.49));

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

const place = (g: THREE.BufferGeometry, color: string, pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) => {
  paintGeo(g, color);
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale)));
  return g;
};

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
const texMatCache = new Map<string, THREE.MeshStandardMaterial>();
/** Cached material for a canvas texture (an emissive share keeps it bright). */
const texMat = (key: string, w: number, h: number, draw: Draw, o: { glow?: number; rough?: number; transparent?: boolean; side?: THREE.Side } = {}) => {
  let m = texMatCache.get(key);
  if (!m) {
    const tex = canvasTexture(`calle-${key}`, w, h, draw);
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: o.rough ?? 0.7,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tex,
      emissiveIntensity: o.glow ?? 0.18,
      transparent: o.transparent ?? false,
      alphaTest: o.transparent ? 0.4 : 0,
      side: o.side ?? THREE.FrontSide,
    });
    texMatCache.set(key, m);
  }
  return m;
};

const fitFont = (ctx: CanvasRenderingContext2D, text: string, size: number, maxW: number, family = TITLE) => {
  let s = size;
  ctx.font = `${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > 16) {
    s -= 4;
    ctx.font = `${s}px ${family}`;
  }
  return s;
};

// =======================================================================================
// Layout, sky and light

const FZ = -2;
/**
 * The street. facadeZ: the shop fronts' plane. CAFE: its window (x0..x1, y0..y1) and door; the
 * terrace table (centre of its base), its height, the two chairs and their seat height. SHOP: its
 * window, the display floor height (`sill`), the interior back wall and ceiling, the pedestal
 * (centre of its base, on the display floor) and its height. curbZ: the sidewalk's edge.
 */
export const CALLE = {
  facadeZ: FZ,
  curbZ: 3.6,
  cafe: { x0: -8.6, x1: -0.35, h: 6.2, win: { x0: -4.6, x1: -1.0, y0: 0.75, y1: 2.85 }, door: { x0: -6.6, x1: -5.4, h: 2.55 } },
  table: [-2.25, 0, -0.35] as V3,
  tableH: 1.02,
  chairL: [-3.12, 0, -0.55] as V3,
  chairR: [-1.38, 0, -0.6] as V3,
  seat: 0.5,
  shop: { x0: 0.3, x1: 9.0, h: 6.6, win: { x0: 1.2, x1: 6.5, y0: 0.5, y1: 3.3 }, door: { x0: 7.15, x1: 8.35, h: 2.7 }, backZ: -10.5, ceil: 3.75 },
  sill: 0.5,
  pedestal: [4.85, 0.5, -3.35] as V3,
  pedestalH: 0.42,
  /** Glass of the shop window (z of its plane). */
  glassZ: FZ - 0.12,
};

/** Sunny morning sky for the CSS background behind the canvas. */
export const CALLE_SKY = "linear-gradient(180deg, #5FBDFF 0%, #93D4FF 36%, #CFEEFF 66%, #FFF0CF 100%)";

/** Bright, warm morning light (three lights, no shadows). `k` scales it. */
export const CalleLights: React.FC<{ k?: number }> = ({ k = 1 }) => (
  <>
    <hemisphereLight args={["#EEF7FF", "#D7A97C", 1.3 * k]} />
    <directionalLight position={[-6, 10, 9]} intensity={2.2 * k} color="#FFEACB" />
    <directionalLight position={[8, 4, 6]} intensity={0.7 * k} color="#CFE4FF" />
  </>
);

// =======================================================================================
// Textures

const pavementMat = once(() => {
  const tex = canvasTexture(
    "calle-pavement",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#CDB79C";
      ctx.fillRect(0, 0, W, H);
      const rnd = mulberry(11);
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = (i + j) % 2 ? "#F1E2CC" : "#E8D6BC";
          ctx.beginPath();
          ctx.roundRect(i * 128 + 4, j * 128 + 4, 120, 120, 10);
          ctx.fill();
          for (let k = 0; k < 10; k++) {
            ctx.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.22)" : "rgba(150,100,60,0.08)";
            ctx.fillRect(i * 128 + 10 + rnd() * 100, j * 128 + 10 + rnd() * 100, 3 + rnd() * 5, 3 + rnd() * 5);
          }
        }
      }
    },
    { wrapS: true, wrapT: true },
  ).clone();
  tex.repeat.set(60 / 1.5, 12 / 1.5);
  tex.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: new THREE.Color("#ffffff"), emissiveMap: tex, emissiveIntensity: 0.12 });
});

const stripeTex = (a: string, b: string, scallop: boolean) =>
  canvasTexture(`calle-awning|${a}|${b}|${scallop}`, 256, scallop ? 96 : 64, (ctx, W, H) => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? b : a;
      ctx.fillRect((i * W) / n, 0, W / n + 1, H);
    }
    if (scallop) {
      ctx.globalCompositeOperation = "destination-out";
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.arc(((i + 0.5) * W) / n, H + 8, W / n / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }
  });

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

/** CAFÉ sign: chocolate board, cream letters, a steaming cup. */
const drawCafeSign: Draw = (ctx, W, H) => {
  ctx.fillStyle = "#FFF6E6";
  roundRect(ctx, 0, 0, W, H, 60);
  ctx.fill();
  ctx.fillStyle = "#6B3A22";
  roundRect(ctx, 12, 12, W - 24, H - 24, 50);
  ctx.fill();
  // Cup.
  const cx = 150;
  const cy = H / 2 + 22;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.moveTo(cx - 70, cy - 50);
  ctx.lineTo(cx + 70, cy - 50);
  ctx.quadraticCurveTo(cx + 66, cy + 50, cx, cy + 52);
  ctx.quadraticCurveTo(cx - 66, cy + 50, cx - 70, cy - 50);
  ctx.fill();
  ctx.lineWidth = 16;
  ctx.strokeStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cx + 78, cy - 12, 26, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.strokeStyle = "#FFD9A8";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  for (const k of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + k * 34, cy - 70);
    ctx.bezierCurveTo(cx + k * 34 - 18, cy - 92, cx + k * 34 + 18, cy - 108, cx + k * 34, cy - 130);
    ctx.stroke();
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitFont(ctx, "CAFÉ", 190, W - 360);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillText("CAFÉ", (W + 260) / 2 + 6, H / 2 + 20);
  ctx.fillStyle = "#FFE7B0";
  ctx.fillText("CAFÉ", (W + 260) / 2, H / 2 + 14);
};

/** ZAPATILLAS sign: midnight board, neon pink letters with a cyan outline glow and a sneaker. */
const drawShopSign: Draw = (ctx, W, H) => {
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, 0, 0, W, H, 60);
  ctx.fill();
  ctx.fillStyle = "#24164F";
  roundRect(ctx, 12, 12, W - 24, H - 24, 50);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitFont(ctx, "ZAPATILLAS", 170, W - 120);
  ctx.shadowColor = "#4FF3FF";
  ctx.shadowBlur = 30;
  ctx.fillStyle = "#4FF3FF";
  ctx.fillText("ZAPATILLAS", W / 2 + 5, H / 2 + 18);
  ctx.shadowColor = "#FF4FA3";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#FF6FB5";
  ctx.fillText("ZAPATILLAS", W / 2, H / 2 + 12);
  ctx.shadowBlur = 0;
};

/** The A-frame menu board. */
const drawMenu: Draw = (ctx, W, H) => {
  ctx.fillStyle = "#A8693A";
  roundRect(ctx, 0, 0, W, H, 30);
  ctx.fill();
  ctx.fillStyle = "#24332C";
  roundRect(ctx, 22, 22, W - 44, H - 44, 18);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#FFD86B";
  ctx.font = `92px ${FUN}`;
  ctx.fillText("MENÚ", W / 2, 110);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `58px ${FUN}`;
  const rows: [string, string][] = [
    ["CAFÉ", "S/6"],
    ["JUGO", "S/8"],
    ["TORTA", "S/9"],
  ];
  rows.forEach(([a, b], i) => {
    ctx.textAlign = "left";
    ctx.fillText(a, 60, 230 + i * 92);
    ctx.textAlign = "right";
    ctx.fillStyle = "#9BE7FF";
    ctx.fillText(b, W - 60, 230 + i * 92);
    ctx.fillStyle = "#FFFFFF";
  });
  ctx.textAlign = "center";
  ctx.fillStyle = "#FF9EC7";
  ctx.font = `50px ${FUN}`;
  ctx.fillText("♥ WIFI GRATIS", W / 2, H - 78);
};

/** The warm café interior seen through its window: wall, shelves of cups, a counter, lamps. */
const drawCafeInside: Draw = (ctx, W, H) => {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#F6C487");
  g.addColorStop(1, "#E9A866");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const rnd = mulberry(4);
  for (const y of [120, 205]) {
    ctx.fillStyle = "#8C5530";
    ctx.fillRect(40, y, W - 80, 10);
    for (let x = 60; x < W - 70; x += 46) {
      ctx.fillStyle = ["#FFFFFF", "#FF8A80", "#80D8FF", "#FFE082"][Math.floor(rnd() * 4)];
      roundRect(ctx, x, y - 34, 30, 34, 6);
      ctx.fill();
    }
  }
  // Counter with an espresso machine.
  ctx.fillStyle = "#7A4428";
  ctx.fillRect(0, H - 120, W, 120);
  ctx.fillStyle = "#9A5C36";
  ctx.fillRect(0, H - 130, W, 16);
  ctx.fillStyle = "#C9D3DC";
  roundRect(ctx, W * 0.62, H - 230, 130, 100, 14);
  ctx.fill();
  ctx.fillStyle = "#FF5A5A";
  ctx.fillRect(W * 0.62 + 20, H - 210, 90, 18);
  // Pendant lamps.
  for (const x of [W * 0.2, W * 0.5, W * 0.8]) {
    ctx.strokeStyle = "#3B2A20";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 46);
    ctx.stroke();
    const lg = ctx.createRadialGradient(x, 70, 4, x, 70, 60);
    lg.addColorStop(0, "rgba(255,250,210,0.9)");
    lg.addColorStop(1, "rgba(255,250,210,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(x - 60, 10, 120, 120);
    ctx.fillStyle = "#2F2A26";
    ctx.beginPath();
    ctx.moveTo(x - 30, 70);
    ctx.lineTo(x + 30, 70);
    ctx.lineTo(x + 14, 44);
    ctx.lineTo(x - 14, 44);
    ctx.fill();
  }
};

/** The sneaker shop's back wall: lit shelves full of colourful sneakers. */
const drawShopWall: Draw = (ctx, W, H) => {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#FFFFFF");
  g.addColorStop(1, "#E8E1FF");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const rnd = mulberry(9);
  const cols = ["#FF4FA3", "#4FC3F7", "#FFD23F", "#7CE38B", "#B388FF", "#FF7A45", "#222A44"];
  for (const y of [110, 230, 350]) {
    ctx.fillStyle = "#BBAEEB";
    ctx.fillRect(30, y, W - 60, 12);
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillRect(30, y - 70, W - 60, 4);
    for (let x = 60; x < W - 110; x += 96) {
      const c = cols[Math.floor(rnd() * cols.length)];
      ctx.fillStyle = "#FFFFFF";
      roundRect(ctx, x, y - 14, 74, 14, 6);
      ctx.fill();
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(x + 4, y - 14);
      ctx.lineTo(x + 70, y - 14);
      ctx.quadraticCurveTo(x + 66, y - 34, x + 40, y - 38);
      ctx.lineTo(x + 26, y - 58);
      ctx.lineTo(x + 6, y - 58);
      ctx.closePath();
      ctx.fill();
    }
  }
};

/** The price card on the pedestal: «S/ 799» in red on white, a gold rim. */
const drawPrice: Draw = (ctx, W, H) => {
  ctx.fillStyle = "#FFC21A";
  roundRect(ctx, 0, 0, W, H, 36);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, 14, 14, W - 28, H - 28, 26);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitFont(ctx, "S/ 799", 190, W - 70);
  ctx.fillStyle = "rgba(0,0,0,0.16)";
  ctx.fillText("S/ 799", W / 2 + 6, H / 2 + 20);
  ctx.fillStyle = "#E3262B";
  ctx.fillText("S/ 799", W / 2, H / 2 + 14);
};

/** A 100-soles banknote: blue-green, «100» in the corners, a medallion, «CIEN SOLES». */
const drawBill: Draw = (ctx, W, H) => {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#38C2A8");
  g.addColorStop(1, "#1D8C93");
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, W, H, 18);
  ctx.fill();
  ctx.strokeStyle = "#E6FFF7";
  ctx.lineWidth = 10;
  roundRect(ctx, 16, 16, W - 32, H - 32, 12);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let k = 0; k < 6; k++) {
    ctx.beginPath();
    ctx.ellipse(W * 0.62, H / 2, 40 + k * 22, 26 + k * 12, 0, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.stroke();
  }
  ctx.fillStyle = "#E9FFF8";
  ctx.beginPath();
  ctx.arc(W * 0.62, H / 2, 62, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1D8C93";
  ctx.beginPath();
  ctx.arc(W * 0.62, H / 2 - 12, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(W * 0.62, H / 2 + 34, 36, 24, 0, Math.PI, 0);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `110px ${TITLE}`;
  ctx.fillText("100", W * 0.22, H * 0.36);
  ctx.font = `54px ${TITLE}`;
  ctx.fillText("100", W * 0.9, H * 0.78);
  ctx.font = `34px ${FUN}`;
  ctx.fillText("CIEN SOLES", W * 0.22, H * 0.74);
};

/** Window glass: a faint blue tint with two diagonal reflections. */
const glassMat = once(() => {
  const tex = canvasTexture("calle-glass", 256, 256, (ctx, W, H) => {
    ctx.fillStyle = "rgba(205,236,255,0.13)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    for (const [x, w] of [
      [40, 46],
      [104, 16],
      [180, 30],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + w, 0);
      ctx.lineTo(x + w - 90, H);
      ctx.lineTo(x - 90, H);
      ctx.fill();
    }
  });
  return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
});

/** Vertical gradient for the spotlight cone (bright at the lamp, fading down). */
const coneMat = once(() => {
  const tex = canvasTexture("calle-cone", 8, 128, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(255,255,255,0.75)");
    g.addColorStop(0.7, "rgba(255,255,255,0.25)");
    g.addColorStop(1, "rgba(255,255,255,0.05)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  });
  return additive(new THREE.MeshBasicMaterial({ map: tex, color: "#FFF1C4", side: THREE.DoubleSide, toneMapped: false, fog: false }));
});

/** Four-point sparkle star (additive sprite). */
const sparkleMat = once(() => {
  const tex = canvasTexture("calle-sparkle", 128, 128, (ctx, W) => {
    const c = W / 2;
    const gl = ctx.createRadialGradient(c, c, 0, c, c, c);
    gl.addColorStop(0, "rgba(255,255,255,1)");
    gl.addColorStop(0.25, "rgba(255,255,255,0.35)");
    gl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gl;
    ctx.fillRect(0, 0, W, W);
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.moveTo(c, 2);
    ctx.quadraticCurveTo(c + 6, c - 6, W - 2, c);
    ctx.quadraticCurveTo(c + 6, c + 6, c, W - 2);
    ctx.quadraticCurveTo(c - 6, c + 6, 2, c);
    ctx.quadraticCurveTo(c - 6, c - 6, c, 2);
    ctx.fill();
  });
  return additive(new THREE.SpriteMaterial({ map: tex, color: "#FFF6C8", toneMapped: false, fog: false }));
});

// =======================================================================================
// The static street (one vertex-coloured mesh)

const CAFE_WALL = "#FFF0D8";
const CAFE_TRIM = "#C8643B";
const SHOP_WALL = "#7B5CF0";
const SHOP_TRIM = "#FF4FA3";
const CREAM = "#FFF8EC";

const streetGeometry = once(() => {
  const geos: THREE.BufferGeometry[] = [];
  const D = 0.3;
  const zc = FZ - D / 2;
  const slab = (x0: number, x1: number, y0: number, y1: number, color: string, depth = D) => {
    if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
    geos.push(place(rbox(x1 - x0, y1 - y0, depth, 0.04), color, [(x0 + x1) / 2, (y0 + y1) / 2, FZ - depth / 2]));
  };
  // ---- The café: wall around its window and door, base trim, cornice, upper windows.
  const C = CALLE.cafe;
  const w = C.win;
  slab(C.x0, C.door.x0, 0, C.h, CAFE_WALL);
  slab(C.door.x1, w.x0, 0, C.h, CAFE_WALL);
  slab(C.door.x0, C.door.x1, C.door.h, C.h, CAFE_WALL);
  slab(w.x1, C.x1, 0, C.h, CAFE_WALL);
  slab(w.x0, w.x1, 0, w.y0, CAFE_WALL);
  slab(w.x0, w.x1, w.y1, C.h, CAFE_WALL);
  geos.push(place(rbox(C.x1 - C.x0 + 0.04, 0.4, D + 0.1, 0.05), CAFE_TRIM, [(C.x0 + C.x1) / 2, 0.2, zc]));
  geos.push(place(rbox(C.x1 - C.x0 + 0.3, 0.32, D + 0.34, 0.08), CREAM, [(C.x0 + C.x1) / 2, C.h, zc]));
  // Window frame (white) with a sill and a mullion.
  geos.push(place(rbox(w.x1 - w.x0 + 0.3, 0.14, D + 0.3, 0.05), "#FFFFFF", [(w.x0 + w.x1) / 2, w.y0 - 0.03, zc + 0.08]));
  geos.push(place(rbox(w.x1 - w.x0 + 0.24, 0.16, D + 0.1, 0.05), "#FFFFFF", [(w.x0 + w.x1) / 2, w.y1 + 0.05, zc]));
  for (const x of [w.x0, w.x1, (w.x0 + w.x1) / 2]) geos.push(place(rbox(0.12, w.y1 - w.y0, D + 0.08, 0.04), "#FFFFFF", [x, (w.y0 + w.y1) / 2, zc]));
  // Interior box behind the window (floor and side walls; the back is a painted plane).
  geos.push(place(new THREE.BoxGeometry(w.x1 - w.x0, 0.05, 1.5), "#B97A4B", [(w.x0 + w.x1) / 2, w.y0 - 0.1, FZ - D - 0.75]));
  for (const x of [w.x0 + 0.03, w.x1 - 0.03]) geos.push(place(new THREE.BoxGeometry(0.06, w.y1 - w.y0 + 0.3, 1.5), "#E9A866", [x, (w.y0 + w.y1) / 2, FZ - D - 0.75]));
  geos.push(place(new THREE.BoxGeometry(w.x1 - w.x0, 0.06, 1.5), "#F2D2A8", [(w.x0 + w.x1) / 2, w.y1 + 0.05, FZ - D - 0.75]));
  // Door: mint green with a round window and a brass knob.
  const dx = (C.door.x0 + C.door.x1) / 2;
  geos.push(place(rbox(C.door.x1 - C.door.x0, C.door.h, 0.1, 0.05), "#37B89A", [dx, C.door.h / 2, FZ - 0.18]));
  geos.push(place(rbox(C.door.x1 - C.door.x0 + 0.22, 0.14, D + 0.06, 0.04), "#FFFFFF", [dx, C.door.h + 0.06, zc]));
  geos.push(place(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 20), "#BDE9FF", [dx, 1.75, FZ - 0.12], [Math.PI / 2, 0, 0]));
  geos.push(place(new THREE.SphereGeometry(0.06, 10, 8), "#FFD23F", [dx + 0.38, 1.15, FZ - 0.1]));
  // Upper floor: windows with flower boxes.
  for (const x of [C.x0 + 1.1, (C.x0 + C.x1) / 2 - 0.4, C.x1 - 1.3]) {
    geos.push(place(rbox(1.1, 1.3, 0.14, 0.08), "#FFFFFF", [x, 4.95, FZ + 0.06]));
    geos.push(place(rbox(0.86, 1.06, 0.1, 0.05), "#A6DDFF", [x, 4.95, FZ + 0.1]));
    geos.push(place(rbox(0.07, 1.0, 0.04, 0.02), "#FFFFFF", [x, 4.95, FZ + 0.16]));
    geos.push(place(rbox(1.0, 0.26, 0.3, 0.05), CAFE_TRIM, [x, 4.22, FZ + 0.2]));
    for (let f = 0; f < 4; f++) {
      geos.push(place(new THREE.IcosahedronGeometry(0.12, 0), ["#FF4F7B", "#FFFFFF", "#FF8A3D", "#B57BFF"][f], [x - 0.33 + f * 0.22, 4.43, FZ + 0.24]));
      geos.push(place(new THREE.IcosahedronGeometry(0.1, 0), "#2FAE4E", [x - 0.22 + f * 0.22, 4.38, FZ + 0.18]));
    }
  }

  // ---- The sneaker shop: wall around the big window and the door, pink trims, cornice.
  const S = CALLE.shop;
  const sw = S.win;
  slab(S.x0, sw.x0, 0, S.h, SHOP_WALL);
  slab(sw.x1, S.door.x0, 0, S.h, SHOP_WALL);
  slab(S.door.x0, S.door.x1, S.door.h, S.h, SHOP_WALL);
  slab(S.door.x1, S.x1, 0, S.h, SHOP_WALL);
  slab(sw.x0, sw.x1, 0, sw.y0, SHOP_WALL);
  slab(sw.x0, sw.x1, sw.y1, S.h, SHOP_WALL);
  geos.push(place(rbox(S.x1 - S.x0 + 0.04, 0.36, D + 0.1, 0.05), shadeHex(SHOP_WALL, -0.18), [(S.x0 + S.x1) / 2, 0.18, zc]));
  geos.push(place(rbox(S.x1 - S.x0 + 0.3, 0.32, D + 0.34, 0.08), "#FFFFFF", [(S.x0 + S.x1) / 2, S.h, zc]));
  // Window frame: hot-pink trim all around.
  geos.push(place(rbox(sw.x1 - sw.x0 + 0.36, 0.18, D + 0.18, 0.06), SHOP_TRIM, [(sw.x0 + sw.x1) / 2, sw.y1 + 0.08, zc]));
  geos.push(place(rbox(sw.x1 - sw.x0 + 0.36, 0.16, D + 0.36, 0.06), SHOP_TRIM, [(sw.x0 + sw.x1) / 2, sw.y0 - 0.06, zc + 0.08]));
  for (const x of [sw.x0, sw.x1]) geos.push(place(rbox(0.18, sw.y1 - sw.y0, D + 0.18, 0.06), SHOP_TRIM, [x, (sw.y0 + sw.y1) / 2, zc]));
  // Shop interior: display floor (raised to the sill), side walls, ceiling, a dark floor edge.
  const ix = (sw.x0 + sw.x1) / 2;
  const iw = sw.x1 - sw.x0;
  const depth = FZ - D - S.backZ;
  const izc = (FZ - D + S.backZ) / 2;
  geos.push(place(new THREE.BoxGeometry(iw, CALLE.sill, depth), "#EDE7FF", [ix, CALLE.sill / 2, izc]));
  geos.push(place(new THREE.BoxGeometry(iw, 0.03, 0.12), "#D7CCFF", [ix, CALLE.sill + 0.01, FZ - D - 0.06]));
  for (const x of [sw.x0 - 0.05, sw.x1 + 0.05]) geos.push(place(new THREE.BoxGeometry(0.1, S.ceil, depth), "#D9CFFF", [x, S.ceil / 2, izc]));
  geos.push(place(new THREE.BoxGeometry(iw + 0.2, 0.1, depth), "#F7F4FF", [ix, S.ceil, izc]));
  // Ceiling light strips.
  for (let z = FZ - 1.0; z > S.backZ + 0.5; z -= 1.6) geos.push(place(rbox(iw - 1.2, 0.05, 0.16, 0.02), "#FFFFFF", [ix, S.ceil - 0.06, z]));
  // Shop door: dark glass in a pink frame, a long chrome handle.
  const sdx = (S.door.x0 + S.door.x1) / 2;
  geos.push(place(rbox(S.door.x1 - S.door.x0, S.door.h, 0.08, 0.04), "#2A2350", [sdx, S.door.h / 2, FZ - 0.2]));
  geos.push(place(rbox(S.door.x1 - S.door.x0 + 0.24, 0.16, D + 0.1, 0.05), SHOP_TRIM, [sdx, S.door.h + 0.07, zc]));
  for (const x of [S.door.x0, S.door.x1]) geos.push(place(rbox(0.12, S.door.h, D + 0.1, 0.04), SHOP_TRIM, [x, S.door.h / 2, zc]));
  geos.push(place(rbox(0.06, 0.9, 0.06, 0.03), "#E6E9F0", [S.door.x0 + 0.2, 1.3, FZ - 0.1]));
  // Upper floor windows.
  for (const x of [S.x0 + 1.4, (S.x0 + S.x1) / 2, S.x1 - 1.4]) {
    geos.push(place(rbox(1.2, 1.3, 0.14, 0.08), "#FFFFFF", [x, 5.2, FZ + 0.06]));
    geos.push(place(rbox(0.96, 1.06, 0.1, 0.05), "#BFE6FF", [x, 5.2, FZ + 0.1]));
    geos.push(place(rbox(1.3, 0.14, 0.28, 0.05), "#FFFFFF", [x, 4.5, FZ + 0.12]));
  }

  // ---- Neighbours left and right (plain blocks with windows).
  for (const [x0, x1, h, c] of [
    [-16, C.x0, 7.6, "#9ED9C4"],
    [S.x1, 17, 7.2, "#FFB0C8"],
  ] as [number, number, number, string][]) {
    geos.push(place(rbox(x1 - x0 - 0.06, h, 3, 0.15), c, [(x0 + x1) / 2, h / 2, FZ - 1.5]));
    for (let y = 1.6; y < h - 1; y += 2.1) {
      for (let x = x0 + 0.9; x < x1 - 0.5; x += 1.7) {
        geos.push(place(rbox(1.0, 1.25, 0.12, 0.06), "#FFFFFF", [x, y, FZ + 0.04]));
        geos.push(place(rbox(0.78, 1.02, 0.1, 0.04), shadeHex(c, -0.22), [x, y, FZ + 0.08]));
      }
    }
  }

  // ---- Lamppost by the curb between the shops, planters.
  const lx = 9.9;
  const lz = CALLE.curbZ - 0.55;
  geos.push(place(new THREE.CylinderGeometry(0.07, 0.11, 4.2, 12), "#2B3A55", [lx, 2.1, lz]));
  geos.push(place(new THREE.CylinderGeometry(0.17, 0.23, 0.3, 14), "#2B3A55", [lx, 0.15, lz]));
  geos.push(place(new THREE.SphereGeometry(0.3, 16, 12), "#FFF4C2", [lx, 4.42, lz]));
  geos.push(place(new THREE.CylinderGeometry(0.34, 0.18, 0.15, 14), "#2B3A55", [lx, 4.76, lz]));
  for (const [x, z] of [
    [-0.02, FZ + 0.45],
    [-8.0, FZ + 0.5],
    [9.35, FZ + 0.5],
  ]) {
    geos.push(place(rbox(0.7, 0.62, 0.7, 0.1), "#E07A4F", [x, 0.31, z]));
    geos.push(place(new THREE.IcosahedronGeometry(0.5, 1), "#3DBA5A", [x, 0.95, z]));
    geos.push(place(new THREE.IcosahedronGeometry(0.34, 1), "#55CC6E", [x + 0.2, 1.25, z + 0.12]));
    for (let f = 0; f < 5; f++) geos.push(place(new THREE.IcosahedronGeometry(0.08, 0), ["#FF4F7B", "#FFD23F", "#FFFFFF", "#FF8A3D", "#B57BFF"][f], [x - 0.3 + f * 0.15, 1.15 + 0.12 * Math.sin(f * 2.1), z + 0.38]));
  }

  // ---- Curb, road (with dashes), the far sidewalk and the buildings across the street.
  const roadZ0 = CALLE.curbZ;
  const roadZ1 = 14.5;
  geos.push(place(new THREE.BoxGeometry(70, 0.14, 0.3), "#E4E1DA", [0, 0.07, roadZ0 + 0.15]));
  geos.push(place(new THREE.BoxGeometry(70, 0.02, roadZ1 - roadZ0), "#5D6672", [0, -0.005, (roadZ0 + roadZ1) / 2]));
  for (let x = -30; x < 30; x += 2.8) geos.push(place(new THREE.BoxGeometry(1.4, 0.02, 0.16), "#FFFFFF", [x, 0.012, (roadZ0 + roadZ1) / 2]));
  geos.push(place(new THREE.BoxGeometry(70, 0.14, 0.3), "#E4E1DA", [0, 0.07, roadZ1 - 0.15]));
  geos.push(place(new THREE.BoxGeometry(70, 0.03, 3.2), "#E8D6BC", [0, 0.0, roadZ1 + 1.6]));
  const far = roadZ1 + 3.2;
  for (const [x0, x1, h, c] of [
    [-14, -6.5, 8.2, "#FFCF70"],
    [-6.5, -0.5, 6.6, "#FF9F8A"],
    [-0.5, 5.5, 7.8, "#8FD3FF"],
    [5.5, 12, 6.8, "#C9B3FF"],
    [12, 18, 7.6, "#A8E6A1"],
  ] as [number, number, number, string][]) {
    geos.push(place(rbox(x1 - x0 - 0.06, h, 3, 0.15), c, [(x0 + x1) / 2, h / 2, far + 1.5]));
    for (let y = 1.7; y < h - 1; y += 2.0) {
      for (let x = x0 + 0.9; x < x1 - 0.5; x += 1.6) {
        geos.push(place(rbox(0.95, 1.2, 0.12, 0.06), "#FFFFFF", [x, y, far - 0.04]));
        geos.push(place(rbox(0.74, 0.98, 0.1, 0.04), shadeHex(c, -0.25), [x, y, far - 0.08]));
      }
    }
  }
  return mergeAll(geos);
});

const Awning: React.FC<{ x0: number; x1: number; y: number; depth: number; colors: [string, string]; slope?: number }> = ({ x0, x1, y, depth, colors, slope = 0.34 }) => {
  const w = x1 - x0;
  return (
    <group position={[(x0 + x1) / 2, y, FZ + 0.02]} rotation={[slope, 0, 0]}>
      <mesh position={[0, 0, depth / 2]}>
        <boxGeometry args={[w, 0.05, depth]} />
        <primitive object={awningMat(colors, false)} attach="material" />
      </mesh>
      <mesh position={[0, -0.18, depth]} rotation={[-slope, 0, 0]}>
        <planeGeometry args={[w, 0.38]} />
        <primitive object={awningMat(colors, true)} attach="material" />
      </mesh>
    </group>
  );
};

const awningMats = new Map<string, THREE.MeshStandardMaterial>();
const awningMat = (colors: [string, string], scallop: boolean) => {
  const key = `${colors.join()}|${scallop}`;
  let m = awningMats.get(key);
  if (!m) {
    const tex = stripeTex(colors[0], colors[1], scallop).clone();
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    tex.needsUpdate = true;
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.6,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tex,
      emissiveIntensity: 0.22,
      transparent: scallop,
      alphaTest: scallop ? 0.5 : 0,
      side: THREE.DoubleSide,
    });
    awningMats.set(key, m);
  }
  return m;
};

const GROUND_SIZE: [number, number] = [60, 12];

/**
 * The whole static street: sidewalk, the café (window on its warm interior, door, awning, CAFÉ
 * sign), the sneaker shop (the big window with its glass, the lit interior and shelves, the
 * ZAPATILLAS sign), neighbours, lamppost, planters, road and the buildings across the street.
 * The terrace furniture and the shop's display are separate components.
 */
export const CalleStreet: React.FC = () => {
  const ready = useFontsReady();
  const S = CALLE.shop;
  const sw = S.win;
  const cw = CALLE.cafe.win;
  return (
    <group>
      <mesh position={[0, 0, (FZ - 6 + CALLE.curbZ) / 2]} rotation={[-Math.PI / 2, 0, 0]} material={pavementMat()}>
        <planeGeometry args={[GROUND_SIZE[0], CALLE.curbZ - FZ + 6]} />
      </mesh>
      <mesh geometry={streetGeometry()} material={vertexMat(0.55, false, 0.17)} />
      <Awning x0={cw.x0 - 0.35} x1={cw.x1 + 0.45} y={3.2} depth={1.45} colors={["#FFF6EA", "#E8423F"]} />
      <Awning x0={CALLE.cafe.door.x0 - 0.2} x1={CALLE.cafe.door.x1 + 0.2} y={2.95} depth={0.7} colors={["#FFF6EA", "#E8423F"]} slope={0.45} />
      {/* Interiors (painted back walls). */}
      <mesh position={[(cw.x0 + cw.x1) / 2, (cw.y0 + cw.y1) / 2 + 0.1, FZ - 0.3 - 1.48]} material={texMat("cafe-inside", 512, 340, drawCafeInside, { glow: 0.3 })}>
        <planeGeometry args={[cw.x1 - cw.x0, cw.y1 - cw.y0 + 0.4]} />
      </mesh>
      <mesh position={[(sw.x0 + sw.x1) / 2, (CALLE.sill + S.ceil) / 2, S.backZ + 0.02]} material={texMat("shop-wall", 1024, 512, drawShopWall, { glow: 0.45 })}>
        <planeGeometry args={[sw.x1 - sw.x0, S.ceil - CALLE.sill]} />
      </mesh>
      {/* Glass of both windows. */}
      <mesh position={[(sw.x0 + sw.x1) / 2, (sw.y0 + sw.y1) / 2, CALLE.glassZ]} material={glassMat()} renderOrder={6}>
        <planeGeometry args={[sw.x1 - sw.x0, sw.y1 - sw.y0]} />
      </mesh>
      <mesh position={[(cw.x0 + cw.x1) / 2, (cw.y0 + cw.y1) / 2, FZ - 0.12]} material={glassMat()} renderOrder={6}>
        <planeGeometry args={[cw.x1 - cw.x0, cw.y1 - cw.y0]} />
      </mesh>
      {ready ? (
        <>
          <mesh position={[(cw.x0 + cw.x1) / 2 + 0.05, 4.05, FZ + 0.06]} material={texMat("cafe-sign", 1024, 300, drawCafeSign, { glow: 0.3, rough: 0.5 })}>
            <planeGeometry args={[3.2, 0.94]} />
          </mesh>
          <mesh position={[(sw.x0 + sw.x1) / 2, 4.05, FZ + 0.06]} material={texMat("shop-sign", 1024, 256, drawShopSign, { glow: 0.55, rough: 0.5 })}>
            <planeGeometry args={[4.6, 1.15]} />
          </mesh>
        </>
      ) : null}
    </group>
  );
};

// =======================================================================================
// The café terrace

const tableGeometry = once(() => {
  const H = CALLE.tableH;
  return mergeAll([
    place(new THREE.CylinderGeometry(0.34, 0.38, 0.05, 24), "#3B3F4A", [0, 0.025, 0]),
    place(new THREE.CylinderGeometry(0.045, 0.045, H - 0.05, 10), "#3B3F4A", [0, H / 2, 0]),
    place(new THREE.CylinderGeometry(0.58, 0.58, 0.06, 32), "#FFFFFF", [0, H - 0.03, 0]),
    place(new THREE.CylinderGeometry(0.6, 0.6, 0.03, 32), "#E8423F", [0, H - 0.07, 0]),
  ]);
});

const cupGeo = (x: number, y: number, z: number, color = "#FFFFFF", coffee = true) => [
  place(new THREE.CylinderGeometry(0.15, 0.13, 0.022, 18), color, [x, y + 0.011, z]),
  place(new THREE.CylinderGeometry(0.085, 0.065, 0.12, 16), color, [x, y + 0.08, z]),
  place(new THREE.TorusGeometry(0.035, 0.012, 6, 12), color, [x + 0.095, y + 0.085, z], [0, 0, 0]),
  ...(coffee ? [place(new THREE.CylinderGeometry(0.075, 0.075, 0.01, 16), "#5A3420", [x, y + 0.135, z])] : []),
];

const cupsGeometry = once(() => {
  const H = CALLE.tableH;
  // The friend's empty cups (stacked: he has been waiting a while) and Nubi's full cup.
  const g: THREE.BufferGeometry[] = [];
  g.push(...cupGeo(-0.32, H, 0.12, "#FFFFFF", false));
  g.push(...cupGeo(-0.32, H + 0.14, 0.12, "#FFF3D6", false));
  g.push(...cupGeo(-0.32, H + 0.28, 0.12, "#FFFFFF", false));
  g.push(...cupGeo(-0.05, H, 0.3, "#FFFFFF", false));
  g.push(...cupGeo(0.28, H, 0.1, "#FFE082", true));
  // Sugar bowl and a little vase with a flower.
  g.push(place(new THREE.SphereGeometry(0.07, 12, 8), "#FFFFFF", [0.02, H + 0.06, -0.24], [0, 0, 0], [1, 0.8, 1]));
  g.push(place(new THREE.CylinderGeometry(0.04, 0.05, 0.16, 10), "#7FD3FF", [0.18, H + 0.08, -0.3]));
  g.push(place(new THREE.IcosahedronGeometry(0.07, 0), "#FF4F7B", [0.18, H + 0.22, -0.3]));
  return mergeAll(g);
});

/** The round terrace table with its cups (origin = the centre of its base). */
export const CafeTable: React.FC<{ cups?: boolean }> = ({ cups = true }) => (
  <group>
    <mesh geometry={tableGeometry()} material={vertexMat(0.45, false, 0.16)} />
    {cups ? <mesh geometry={cupsGeometry()} material={vertexMat(0.35, false, 0.18)} /> : null}
  </group>
);

const chairGeometry = once(() => {
  const s = CALLE.seat;
  const g: THREE.BufferGeometry[] = [];
  for (const [x, z] of [
    [-0.3, -0.3],
    [0.3, -0.3],
    [-0.3, 0.3],
    [0.3, 0.3],
  ]) g.push(place(new THREE.CylinderGeometry(0.03, 0.03, s, 8), "#2F6F5E", [x, s / 2, z]));
  g.push(place(rbox(0.8, 0.07, 0.8, 0.03), "#3FA389", [0, s, 0]));
  // Backrest on the chair's −z side: two posts and slats.
  for (const x of [-0.34, 0.34]) g.push(place(new THREE.CylinderGeometry(0.03, 0.03, 0.85, 8), "#2F6F5E", [x, s + 0.42, -0.36]));
  for (const y of [0.42, 0.62, 0.8]) g.push(place(rbox(0.74, 0.1, 0.05, 0.02), "#3FA389", [0, s + y, -0.36]));
  return mergeAll(g);
});

/** A bistro chair (origin = floor centre; its back on the −z side, the sitter facing +z). */
export const CafeChair: React.FC = () => <mesh geometry={chairGeometry()} material={vertexMat(0.5, false, 0.16)} />;

/** The A-frame menu board (origin = its base, facing +z). */
export const MenuBoard: React.FC = () => {
  const ready = useFontsReady();
  const frame = useMemo(
    () =>
      mergeAll([
        place(rbox(0.82, 1.18, 0.05, 0.03), "#A8693A", [0, 0.6, 0.12], [-0.2, 0, 0]),
        place(rbox(0.82, 1.18, 0.05, 0.03), "#A8693A", [0, 0.6, -0.12], [0.2, 0, 0]),
      ]),
    [],
  );
  return (
    <group>
      <mesh geometry={frame} material={vertexMat(0.6, false, 0.15)} />
      {ready ? (
        <mesh position={[0, 0.62, 0.155]} rotation={[-0.2, 0, 0]} material={texMat("menu", 420, 600, drawMenu, { glow: 0.28 })}>
          <planeGeometry args={[0.72, 1.04]} />
        </mesh>
      ) : null}
    </group>
  );
};

// =======================================================================================
// The shop display: pedestal, sneakers, price card, spotlight, glow, sparkles

const SNEAKER_GOLD = "#FFC93C";
const sneakerGeometry = once(() => {
  const g: THREE.BufferGeometry[] = [];
  g.push(place(rbox(0.56, 0.075, 0.21, 0.03), "#FFFFFF", [0, 0.038, 0]));
  g.push(place(rbox(0.54, 0.028, 0.214, 0.012), "#FF4FA3", [0, 0.085, 0]));
  g.push(place(rbox(0.38, 0.16, 0.19, 0.065), SNEAKER_GOLD, [-0.06, 0.17, 0]));
  g.push(place(new THREE.SphereGeometry(1, 16, 10), SNEAKER_GOLD, [0.15, 0.115, 0], [0, 0, 0], [0.13, 0.075, 0.095]));
  g.push(place(rbox(0.13, 0.09, 0.18, 0.04), "#FFFFFF", [-0.19, 0.27, 0]));
  g.push(place(rbox(0.11, 0.06, 0.11, 0.03), "#FFFFFF", [0.03, 0.255, 0], [0, 0, -0.5]));
  for (let k = 0; k < 3; k++) g.push(place(rbox(0.025, 0.014, 0.14, 0.006), "#FF4FA3", [0.08 - k * 0.06, 0.24 + k * 0.014, 0]));
  for (const s of [-1, 1]) g.push(place(rbox(0.24, 0.045, 0.012, 0.006), "#FF4FA3", [-0.03, 0.165, s * 0.098], [0, 0, 0.32]));
  return mergeAll(g);
});

const pedestalGeometry = once(() => {
  const h = CALLE.pedestalH;
  return mergeAll([
    place(new THREE.CylinderGeometry(0.5, 0.54, 0.06, 32), "#FFC21A", [0, 0.03, 0]),
    place(new THREE.CylinderGeometry(0.46, 0.46, h - 0.1, 32), "#FFFFFF", [0, h / 2, 0]),
    place(new THREE.CylinderGeometry(0.52, 0.5, 0.06, 32), "#FFC21A", [0, h - 0.03, 0]),
    // Lamp fixture on the display ceiling.
    place(new THREE.CylinderGeometry(0.1, 0.16, 0.2, 16), "#2A2350", [0, CALLE.shop.ceil - CALLE.sill - 0.12, 0]),
  ]);
});

/**
 * The display on the shop's window floor (origin = the pedestal's base): the white-and-gold
 * pedestal, the pair of gold sneakers glowing under a spotlight cone, a halo, twinkling sparkles
 * and the «S/ 799» card leaning on the pedestal. `glow` 0..1+ boosts the halo (the heavenly
 * moment); `t` in seconds drives the twinkle.
 */
export const SneakerDisplay: React.FC<{ t: number; glow?: number }> = ({ t, glow = 1 }) => {
  const ready = useFontsReady();
  const h = CALLE.pedestalH;
  const spin = 0.12 * Math.sin(t * 0.9);
  const coneH = CALLE.shop.ceil - CALLE.sill - h - 0.22;
  const sparkles = [
    [-0.45, 0.42, 0.12, 0],
    [0.5, 0.3, 0.05, 1.7],
    [0.2, 0.7, -0.1, 3.1],
    [-0.25, 0.85, 0.15, 4.4],
    [0.62, 0.68, 0.2, 2.3],
    [-0.62, 0.18, 0.2, 5.2],
  ];
  return (
    <group>
      <mesh geometry={pedestalGeometry()} material={vertexMat(0.35, false, 0.25)} />
      <group position={[0, h, 0]} rotation={[0, spin, 0]} scale={1.25}>
        <mesh geometry={sneakerGeometry()} material={vertexMat(0.32, false, 0.42)} position={[0.02, 0, 0.13]} rotation={[0, 0.25, 0]} />
        <mesh geometry={sneakerGeometry()} material={vertexMat(0.32, false, 0.42)} position={[-0.02, 0, -0.14]} rotation={[0, 0.05, 0]} />
      </group>
      <mesh position={[0, h + coneH / 2 + 0.05, 0]} material={coneMat()} renderOrder={4}>
        <cylinderGeometry args={[0.1, 0.62, coneH, 24, 1, true]} />
      </mesh>
      <Glow color="#FFE7A0" size={1.7 + 0.5 * glow} opacity={0.38 + 0.3 * glow} position={[0, h + 0.3, 0]} />
      {sparkles.map(([x, y, z, ph], i) => {
        const k = Math.max(0, Math.sin(t * 3.2 + ph));
        if (k < 0.05) return null;
        return <sprite key={i} material={sparkleMat()} position={[x, h + y, z + 0.3]} scale={[0.32 * k * (0.7 + 0.3 * glow), 0.32 * k * (0.7 + 0.3 * glow), 1]} renderOrder={7} />;
      })}
      {ready ? (
        <mesh position={[0.05, h * 0.55, 0.5]} rotation={[-0.22, 0, 0]} material={texMat("price", 512, 290, drawPrice, { glow: 0.4, rough: 0.5 })}>
          <planeGeometry args={[0.82, 0.46]} />
        </mesh>
      ) : null}
    </group>
  );
};

/** Breath fog on the glass where the friend's face presses (world units, on the glass plane). */
export const BreathFog: React.FC<{ position: V3; amount: number }> = ({ position, amount }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: glowTexture(), color: "#FFFFFF", transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), []);
  if (amount <= 0.02) return null;
  mat.opacity = 0.55 * clamp01(amount);
  return (
    <mesh position={position} material={mat} scale={[0.9 + 0.25 * amount, 0.55 + 0.15 * amount, 1]} renderOrder={7}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
};

// =======================================================================================
// Nubi's cap: the anti-tag shield (model units, child of <Nubi>)

const CAP_BLUE = "#2E48D0";
const CAP_BRIM = "#1E2F98";
/** Crown dome (an ellipsoid cut at its equator): centre height, radii, and the top's petals. */
const CAP = { y: 6.7, z: -0.2, rx: 5.6, ry: 5.0, rz: 5.3, theta0: 0.62, petals: 7 };
/** Model-unit height of the top of the closed cap (its button), for the truth tag's anchor. */
export const CAP_TOP = CAP.y + CAP.ry + 0.4;
/** Model-unit height of the torn hole's rim (the tag rises out of it). */
export const CAP_HOLE = CAP.y + CAP.ry * Math.cos(CAP.theta0);

const capGeos = once(() => {
  const { rx, ry, rz, theta0, petals } = CAP;
  const band = new THREE.SphereGeometry(1, 40, 8, 0, Math.PI * 2, theta0, Math.PI / 2 - theta0);
  band.scale(rx, ry, rz);
  const rnd = mulberry(77);
  const leaves = Array.from({ length: petals }, (_, i) => {
    const dp = (Math.PI * 2) / petals;
    const ps = i * dp;
    const pm = ps + dp / 2;
    const g = new THREE.SphereGeometry(1, 6, 6, ps, dp, 0, theta0);
    // Ragged tear: jitter the vertices near the pole a little (the tips of the flaps).
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < p.count; k++) {
      const y = p.getY(k);
      if (y > Math.cos(theta0 * 0.55)) {
        const j = 1 + (rnd() - 0.5) * 0.18;
        p.setXYZ(k, p.getX(k) * j, y, p.getZ(k) * j);
      }
    }
    g.scale(rx, ry, rz);
    const hinge = new THREE.Vector3(-rx * Math.sin(theta0) * Math.cos(pm), ry * Math.cos(theta0), rz * Math.sin(theta0) * Math.sin(pm));
    g.translate(-hinge.x, -hinge.y, -hinge.z);
    g.computeVertexNormals();
    const axis = new THREE.Vector3(rx * Math.sin(pm), 0, rz * Math.cos(pm)).normalize();
    return { g, hinge: [hinge.x, hinge.y, hinge.z] as V3, axis, wobble: 0.8 + 0.4 * rnd() };
  });
  const brim = new THREE.CylinderGeometry(1, 1, 0.45, 32, 2, false, -Math.PI / 2, Math.PI);
  brim.scale(4.6, 1, 3.6);
  // A curved bill: the sides and the front edge bend down.
  const bp = brim.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < bp.count; k++) {
    const x = bp.getX(k) / 4.6;
    const z = bp.getZ(k) / 3.6;
    bp.setY(k, bp.getY(k) - 1.1 * x * x - 0.35 * z * z);
  }
  brim.computeVertexNormals();
  return {
    band,
    leaves,
    brim,
    button: new THREE.SphereGeometry(0.62, 12, 8),
    shred: new THREE.PlaneGeometry(1.3, 0.8),
    patch: new THREE.CircleGeometry(1.25, 24),
  };
});

const qTmp = new THREE.Quaternion();
const eTmp = new THREE.Euler();
const petalRotation = (axis: THREE.Vector3, a: number): V3 => {
  qTmp.setFromAxisAngle(axis, a);
  eTmp.setFromQuaternion(qTmp);
  return [eTmp.x, eTmp.y, eTmp.z];
};

/**
 * Nubi's big baseball cap pulled right down to its eyes (model units; pass as a child of <Nubi>).
 * `bulge` 0..1 swells the crown (the tag pushing from inside); `rip` 0..1(+) peels the top open into
 * torn flaps (1 = fully open; the deuda shot keeps it torn); `ripAge` = frames since the rip (shreds
 * and the burst of light); `pull` 0..1 yanks the cap down over the eyes; `tap` 0..1 a little dip.
 */
export const NubiCap: React.FC<{ bulge?: number; rip?: number; ripAge?: number; pull?: number; tap?: number; wobble?: number }> = ({
  bulge = 0,
  rip = 0,
  ripAge = -1,
  pull = 0,
  tap = 0,
  wobble = 0,
}) => {
  const G = capGeos();
  const crown = toy(CAP_BLUE, { rough: 0.7, glow: 0.14, side: THREE.DoubleSide });
  const brimMat = toy(CAP_BRIM, { rough: 0.7, glow: 0.12 });
  const white = toy("#FFFFFF", { rough: 0.5, glow: 0.16 });
  const yellow = toy("#FFD23F", { rough: 0.45, glow: 0.25 });
  const hingeY = CAP.ry * Math.cos(CAP.theta0);
  const b = bulge * (1 + 0.12 * Math.sin(wobble * 2.6));
  const open = 2.15 * rip;
  const showButton = rip < 0.05;
  // Shreds of fabric and the button flying out of the hole, then falling (model units).
  const shreds =
    ripAge >= 0 && ripAge < 26
      ? Array.from({ length: 8 }, (_, i) => {
          const ang = (i / 8) * Math.PI * 2 + 0.4;
          const sp = 0.55 + 0.35 * ((i * 37) % 5) / 5;
          const a = ripAge;
          const x = Math.cos(ang) * sp * a;
          const z = Math.sin(ang) * sp * a * 0.8;
          const y = 1.5 + (1.05 + 0.25 * (i % 3)) * a - 0.075 * a * a;
          const s = clamp01((26 - a) / 10);
          return { x, y, z, s, r: a * (0.35 + 0.08 * i), i };
        })
      : [];
  return (
    <group position={[0, CAP.y - 1.15 * pull - 0.35 * tap, CAP.z]} scale={[1 + 0.05 * b, 1 - 0.07 * pull, 1 + 0.05 * b]}>
      <mesh geometry={G.band} material={crown} />
      {/* A round white logo on the front panel, a yellow dot in it. */}
      <group position={[0, 2.0, CAP.rz * 0.915]} rotation={[-0.4, 0, 0]}>
        <mesh geometry={G.patch} material={white} position={[0, 0, 0.05]} />
        <mesh geometry={G.patch} material={yellow} position={[0, 0, 0.1]} scale={0.5} />
      </group>
      {/* The top: petals that swell, then peel open like torn flaps. */}
      <group position={[0, hingeY, 0]} scale={[1 + 0.16 * b, 1 + 0.75 * b, 1 + 0.16 * b]}>
        <group position={[0, -hingeY, 0]}>
          {G.leaves.map((l, i) => (
            <mesh
              key={i}
              geometry={l.g}
              material={crown}
              position={l.hinge}
              rotation={petalRotation(l.axis, open * l.wobble * (1 + 0.06 * Math.sin(wobble * 3 + i)))}
            />
          ))}
        </group>
      </group>
      {showButton ? <mesh geometry={G.button} material={white} position={[0, CAP.ry * (1 + 0.75 * b) - 0.05, 0]} /> : null}
      <mesh geometry={G.brim} material={brimMat} position={[0, 0.05, CAP.rz - 0.6]} rotation={[0.08, 0, 0]} />
      {shreds.map((s) => (
        <mesh key={s.i} geometry={G.shred} material={s.i === 3 ? white : crown} position={[s.x, CAP.ry + s.y, s.z]} rotation={[s.r, s.r * 0.7, s.r * 0.4]} scale={s.s} />
      ))}
      {ripAge >= 0 && ripAge < 16 ? (
        <>
          <Glow color="#FFF3B0" size={(14 + 1.4 * ripAge) * (1 - ripAge / 18)} opacity={1 - ripAge / 16} position={[0, CAP.ry + 1.2, 0]} />
          <Glow color="#FFFFFF" size={8 * (1 - ripAge / 16)} opacity={1} position={[0, CAP.ry + 0.8, 0]} />
        </>
      ) : null}
    </group>
  );
};

// =======================================================================================
// The friend (Chico) with a hoodie hood, heart eyes, lids and a sweat drop

const HOOD = "#FFC233";
const heartShape = once(() => {
  const s = new THREE.Shape();
  const k = 1;
  s.moveTo(0, -0.95 * k);
  s.bezierCurveTo(-0.35, -0.6, -1.05, -0.2, -1.05, 0.3);
  s.bezierCurveTo(-1.05, 0.85, -0.45, 1.05, 0, 0.6);
  s.bezierCurveTo(0.45, 1.05, 1.05, 0.85, 1.05, 0.3);
  s.bezierCurveTo(1.05, -0.2, 0.35, -0.6, 0, -0.95);
  return s;
});
const heartGeo = once(() => {
  const g = new THREE.ExtrudeGeometry(heartShape(), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2, curveSegments: 10 });
  g.center();
  return g;
});
const hoodGeo = once(() => new THREE.SphereGeometry(1, 24, 14));
const dropGeo = once(() => {
  const g = mergeAll([place(new THREE.SphereGeometry(0.5, 12, 10), "#7FD6FF", [0, 0, 0]), place(new THREE.ConeGeometry(0.43, 0.8, 12), "#7FD6FF", [0, 0.55, 0])]);
  return g;
});

/** A heart (world units, centred, facing +z): for floating hearts. */
export const Heart: React.FC<{ color?: string; position?: V3; scale?: number; rotationZ?: number }> = ({ color = "#FF3D7F", position, scale = 1, rotationZ = 0 }) => (
  <mesh geometry={heartGeo()} material={toy(color, { rough: 0.4, glow: 0.4 })} position={position} scale={scale} rotation={[0, 0, rotationZ]} />
);

/**
 * The friend: Chico (light-blue Nubi, backwards cap) in a yellow hoodie (its hood behind his head).
 * `hearts` 0..1 covers his eyes with beating hearts (`beat` in frames); `droop`/`tilt` lids
 * (unimpressed, nervous); `hood` 0..1 stretches the hood backwards (someone pulls it); `sweat`
 * 0..1 a sweat drop sliding down; `squish` 0..1 flattens him against a window.
 */
export const Amigo: React.FC<{
  pose?: NubiPose;
  position?: V3;
  rotationY?: number;
  shadow?: boolean;
  hearts?: number;
  beat?: number;
  droop?: number;
  tilt?: number;
  hood?: number;
  sweat?: number;
  squish?: number;
  holdR?: React.ReactNode;
  holdL?: React.ReactNode;
}> = ({ pose = {}, position = [0, 0, 0], rotationY = 0, shadow = true, hearts = 0, beat = 0, droop = 0, tilt = 0, hood = 0, sweat = 0, squish = 0, holdR, holdL }) => {
  const ex = (pose.lookX ?? 0) * 0.5;
  const ey = 5.5 + (pose.lookY ?? 0) * 0.4;
  const hb = hearts * (1 + 0.16 * Math.max(0, Math.sin(beat * 0.45)) ** 3);
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={[1 + 0.06 * squish, 1 - 0.02 * squish, 1 - 0.2 * squish]}>
      <Chico pose={pose} shadow={shadow} holdR={holdR} holdL={holdL} eyeRough={0.6}>
        <mesh geometry={hoodGeo()} material={toy(HOOD, { rough: 0.75, glow: 0.14 })} position={[0, 7.0, -4.6 - 1.3 * hood]} scale={[4.3, 2.55, 1.45 * (1 + 1.4 * hood)]} />
        <mesh geometry={hoodGeo()} material={toy("#E09A1A", { rough: 0.8, glow: 0.1 })} position={[0, 6.6, -5.55 - 2.6 * hood]} scale={[2.6, 1.5, 0.6]} />
        {hearts > 0.02
          ? [-1, 1].map((side) => <mesh key={side} geometry={heartGeo()} material={toy("#FF2D6F", { rough: 0.35, glow: 0.5 })} position={[side * 2.3 + ex, ey, 4.85]} scale={1.35 * hb} />)
          : null}
        {droop > 0.02 && hearts < 0.5 ? <Lids pose={pose} droop={droop} tilt={tilt} color={CHICO_BLUE} /> : null}
        {sweat > 0.02 && sweat < 1 ? <mesh geometry={dropGeo()} material={toy("#8FDFFF", { rough: 0.15, glow: 0.35 })} position={[4.9, 9.2 - 3.2 * sweat, 3.0]} scale={1.1 * Math.min(1, sweat * 6)} /> : null}
      </Chico>
    </group>
  );
};

// =======================================================================================
// The banknote, dust puffs, floating hearts

/** A 100-soles banknote (world units, centred, facing +z, both sides printed). */
export const Banknote: React.FC = () => {
  const ready = useFontsReady();
  if (!ready) return null;
  return (
    <mesh material={texMat("bill", 512, 256, drawBill, { glow: 0.3, rough: 0.6, side: THREE.DoubleSide })}>
      <planeGeometry args={[0.62, 0.31]} />
    </mesh>
  );
};

/**
 * The banknote at a <Nubi size={2}>'s fin tip (pass as holdR / holdL), kept upright and facing
 * the Nubi's front turned by `turn`.
 */
export const HeldBill: React.FC<{ raise: number; side?: "R" | "L"; turn?: number; scale?: number }> = ({ raise, side = "R", turn = 0, scale = 1 }) => (
  <group rotation={[0, side === "R" ? 0.12 : -0.12, -raise * 0.55]}>
    <group scale={5 * scale} position={[0.6, 0.6, 0.6]} rotation={[0, turn, side === "R" ? 0.25 : -0.25]}>
      <Banknote />
    </group>
  </group>
);

const puffMat = once(() => new THREE.MeshStandardMaterial({ color: "#F4EBDD", roughness: 1, emissive: new THREE.Color("#F4EBDD"), emissiveIntensity: 0.35, transparent: true, depthWrite: false }));
const puffMats: THREE.MeshStandardMaterial[] = [];
const puffMatN = (i: number) => {
  while (puffMats.length <= i) puffMats.push(puffMat().clone());
  return puffMats[i];
};

/**
 * Dust puffs kicked up behind running feet (world units, at `at` on the ground): `g` frames, on
 * while `on` > 0; `dir` = the running direction (unit x/z).
 */
export const DustPuffs: React.FC<{ g: number; at: V3; on: number; dir?: [number, number]; every?: number }> = ({ g, at, on, dir = [1, 0], every = 3 }) => {
  if (on <= 0.01) return null;
  const life = 14;
  const n = Math.ceil(life / every);
  const base = Math.floor(g / every);
  return (
    <group position={at}>
      {Array.from({ length: n + 1 }, (_, i) => {
        const spawn = (base - i) * every;
        const age = g - spawn;
        if (age < 0 || age >= life) return null;
        const k = age / life;
        const seed = (base - i) * 13.7;
        const side = Math.sin(seed) * 0.35;
        const m = puffMatN(i);
        m.opacity = on * 0.85 * (1 - k);
        const r = (0.16 + 0.22 * k) * (0.8 + 0.3 * Math.abs(Math.sin(seed * 1.7)));
        return (
          <mesh
            key={spawn}
            material={m}
            position={[-dir[0] * (0.25 + 0.9 * k) + dir[1] * side, 0.12 + 0.35 * k, -dir[1] * (0.25 + 0.9 * k) - dir[0] * side * 0.6]}
            scale={r}
            renderOrder={3}
          >
            <sphereGeometry args={[1, 12, 8]} />
          </mesh>
        );
      })}
    </group>
  );
};

/** Hearts looping up from `at` (world units) while `on` > 0 (`g` in frames). */
export const HeartStream: React.FC<{ g: number; at: V3; on: number; every?: number; life?: number; size?: number }> = ({ g, at, on, every = 7, life = 34, size = 0.2 }) => {
  if (on <= 0.01) return null;
  const n = Math.ceil(life / every);
  const base = Math.floor(g / every);
  return (
    <group position={at}>
      {Array.from({ length: n + 1 }, (_, i) => {
        const id = base - i;
        const age = g - id * every;
        if (age < 0 || age >= life) return null;
        const k = age / life;
        const side = ((id % 3) - 1) * 0.32 + 0.08 * Math.sin(age * 0.25 + id);
        const grow = Math.min(1, age / 5);
        return (
          <Heart
            key={id}
            color={id % 3 === 1 ? "#FF9EC7" : "#FF3D7F"}
            position={[side, 0.15 + 1.1 * k, 0.1 * (id % 2)]}
            rotationZ={0.25 * Math.sin(age * 0.2 + id)}
            scale={size * grow * (1 - k * k) * on}
          />
        );
      })}
    </group>
  );
};

import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Upright } from "../../inca/outfit";
import { V3, canvasTexture, paintGeo, shadeHex, toy, useFontsReady, vertexMat } from "../inca/kit";
import { mulberry } from "../noise";
import { Nubi, NubiPalette, NubiPose } from "../Nubi";
import { Glow, additive } from "../thanos/FX";

// The upscale shopping avenue of the time short ("¿Qué pasaría si el dinero fuera tiempo de
// vida?"), its shop windows (the giant phone, the car showroom), the rich man, the hilltop
// mansion for sale and TIMECO's billboard.
// World units sized for Nubi at size 2 (2 wide, ≈ 2 tall), ground y = 0, front = +z.
// The avenue runs along x: shop fronts at z = 0 facing +z, the sidewalk z 0..6.2, the road
// beyond (y = -0.16). `t` is time in seconds. Static geometry is built once and cached.

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Lazily built value shared by every instance (static geometry). */
const once = <T,>(make: () => T) => {
  let v: T | undefined;
  return () => (v ??= make());
};
const rbox = (w: number, h: number, d: number, r: number, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) * 0.49));

const mergeAll = (geos: THREE.BufferGeometry[]) => {
  const clean = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    if (ng.attributes.uv) ng.deleteAttribute("uv");
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

const TITLE = "'Luckiest Guy', 'Lilita One', sans-serif";
const HEAVY = "Montserrat, sans-serif";

/** TIMECO's brand colours. */
export const TIMECO_COLORS = { charcoal: "#1B1B24", red: "#FF3B3B", sand: "#FFC83D" };

const texMatCache = new Map<THREE.Texture, THREE.MeshStandardMaterial>();
/** Lit material for a canvas texture (an emissive share keeps it bright). Cached per texture. */
const texMat = (tex: THREE.Texture, glow = 0.3) => {
  let m = texMatCache.get(tex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: new THREE.Color("#ffffff"), emissiveMap: tex, emissiveIntensity: glow, transparent: true });
    texMatCache.set(tex, m);
  }
  return m;
};
const screenCache = new Map<THREE.Texture, THREE.MeshBasicMaterial>();
/** Self-lit material for screens and backlit signs. */
const screenMat = (tex: THREE.Texture) => {
  let m = screenCache.get(tex);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true });
    screenCache.set(tex, m);
  }
  return m;
};

const fitFont = (ctx: CanvasRenderingContext2D, text: string, font: (s: number) => string, size: number, maxW: number) => {
  let s = size;
  ctx.font = font(s);
  while (ctx.measureText(text).width > maxW && s > 12) {
    s -= 3;
    ctx.font = font(s);
  }
  return s;
};

/** A shop sign: rounded panel with a border, a text line and a soft drop shadow. */
const signTexture = (text: string, bg: string, fg: string, border: string) =>
  canvasTexture(`ave-sign|${text}|${bg}|${fg}|${border}`, 1024, 220, (ctx, W, H) => {
    ctx.fillStyle = border;
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 46);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(14, 14, W - 28, H - 28, 34);
    ctx.fill();
    fitFont(ctx, text, (s) => `${s}px ${TITLE}`, 150, W - 120);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillText(text, W / 2 + 5, H / 2 + 16);
    ctx.fillStyle = fg;
    ctx.fillText(text, W / 2, H / 2 + 10);
  });

/** Draws TIMECO's logo (an hourglass inside a ring) centred at (cx, cy) with radius r. */
export const drawTimecoLogo = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sand = 0.6) => {
  const { charcoal, red, sand: gold } = TIMECO_COLORS;
  ctx.save();
  ctx.fillStyle = charcoal;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = r * 0.17;
  ctx.strokeStyle = red;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.88, 0, Math.PI * 2);
  ctx.stroke();
  // Hourglass: two glass bulbs, the sand running from top to bottom.
  const w = r * 0.42;
  const h = r * 0.56;
  ctx.lineWidth = r * 0.07;
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - w, cy - h);
  ctx.lineTo(cx + w, cy - h);
  ctx.lineTo(cx + w * 0.12, cy);
  ctx.lineTo(cx + w, cy + h);
  ctx.lineTo(cx - w, cy + h);
  ctx.lineTo(cx - w * 0.12, cy);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = gold;
  const top = 1 - sand;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.8 * top, cy - h * 0.15 - h * 0.7 * top);
  ctx.lineTo(cx + w * 0.8 * top, cy - h * 0.15 - h * 0.7 * top);
  ctx.lineTo(cx, cy - h * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.85, cy + h * 0.9);
  ctx.lineTo(cx + w * 0.85, cy + h * 0.9);
  ctx.lineTo(cx, cy + h * 0.9 - h * 0.75 * sand);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - r * 0.02, cy, r * 0.04, h * 0.8);
  // Caps.
  ctx.fillStyle = red;
  ctx.fillRect(cx - w * 1.25, cy - h - r * 0.1, w * 2.5, r * 0.12);
  ctx.fillRect(cx - w * 1.25, cy + h - r * 0.02, w * 2.5, r * 0.12);
  ctx.restore();
};

// =======================================================================================
// Lights and skies

/** Bright late-afternoon sky behind the avenue (CSS). */
export const AVENUE_SKY = "linear-gradient(180deg, #4DA8F2 0%, #8CCBF5 38%, #CFEAF7 70%, #FFF1DC 100%)";
/** Dusk sky for the question shot (CSS). */
export const DUSK_SKY = "linear-gradient(180deg, #2B1E5C 0%, #6A3A8C 30%, #C9587A 58%, #FF9A5C 82%, #FFC98A 100%)";
/** Sunny sky over the mansion's hill (CSS). */
export const ESTATE_SKY = "linear-gradient(180deg, #3D9BF0 0%, #7EC4F7 40%, #C4E7FA 75%, #F2FAFF 100%)";

/** Daylight rig for the avenue and the estate. */
export const AvenueLights: React.FC<{ k?: number }> = ({ k = 1 }) => (
  <>
    <hemisphereLight args={["#FFF4E0", "#8C7A9A", 1.35 * k]} />
    <directionalLight position={[-8, 14, 12]} intensity={2.3 * k} color="#FFE6C4" />
    <directionalLight position={[10, 6, 8]} intensity={0.7 * k} color="#BFD8FF" />
  </>
);

/** Dusk rig: low orange sun from the side, purple fill, the billboard's red spill. */
export const DuskLights: React.FC<{ billboard?: V3 }> = ({ billboard }) => (
  <>
    <hemisphereLight args={["#B98CE0", "#4A2E52", 1.05]} />
    <directionalLight position={[-14, 5, 10]} intensity={1.7} color="#FFA060" />
    <directionalLight position={[8, 7, 12]} intensity={0.55} color="#9FB0FF" />
    {billboard ? <pointLight position={[billboard[0], billboard[1] - 1.5, billboard[2] + 3]} intensity={26} distance={16} decay={1.6} color="#FF5A4A" /> : null}
  </>
);

// =======================================================================================
// Layout

export type ShopKind = "phone" | "cars" | "watch" | "jewel" | "fashion" | "perfume" | "timeco";
type ShopSpec = { x0: number; x1: number; h: number; wall: string; name: string; kind: ShopKind; sign: [string, string, string]; door?: number };

/** Height of the shop windows' opening (the sign sits just above). */
const STORE_TOP = 2.75;
const SHOWROOM_TOP = 3.3;
const DEPTH = 6;
/** How far the window rooms go back behind the facade (the showroom is deeper). */
const ROOM = 3.6;
const SHOW_ROOM = 4.4;
const roomOf = (kind: ShopKind) => (kind === "cars" ? SHOW_ROOM : ROOM);

export const AVENUE = {
  /** Sidewalk outer edge (curb) and the line people walk on. */
  curbZ: 6.2,
  walkZ: 3.2,
  roadY: -0.16,
  storeTop: STORE_TOP,
  showroomTop: SHOWROOM_TOP,
};

const SHOPS: ShopSpec[] = [
  { x0: -25, x1: -18.6, h: 8.6, wall: "#F7C8D8", name: "MODA", kind: "fashion", sign: ["#2B2238", "#FFD86B", "#FFD86B"] },
  { x0: -18.6, x1: -11.8, h: 7.6, wall: "#BFE3F2", name: "RELOJES", kind: "watch", sign: ["#203A5C", "#FFFFFF", "#FFC83D"] },
  { x0: -11.8, x1: -5.6, h: 9.2, wall: "#FFE0B8", name: "JOYAS", kind: "jewel", sign: ["#6B2E8C", "#FFFFFF", "#FFC83D"] },
  { x0: -5.6, x1: -0.8, h: 8.0, wall: "#D7CCFF", name: "CELU+", kind: "phone", sign: ["#1E64FF", "#FFFFFF", "#FFFFFF"] },
  { x0: -0.8, x1: 7.4, h: 7.4, wall: "#F4F1EA", name: "AUTOLUX", kind: "cars", sign: ["#C8102E", "#FFFFFF", "#FFC83D"] },
  { x0: 7.4, x1: 13.2, h: 8.8, wall: "#FFD0C2", name: "PERFUMES", kind: "perfume", sign: ["#B03A6A", "#FFFFFF", "#FFC83D"] },
  { x0: 13.2, x1: 19, h: 7.8, wall: "#C9F0E4", name: "BOUTIQUE", kind: "fashion", sign: ["#1F6B5C", "#FFFFFF", "#FFC83D"] },
  { x0: 19, x1: 29.4, h: 10.5, wall: "#2A2A36", name: "TIMECO", kind: "timeco", sign: [TIMECO_COLORS.charcoal, TIMECO_COLORS.red, TIMECO_COLORS.red] },
  { x0: 29.4, x1: 36, h: 8.2, wall: "#FFE8A8", name: "RELOJES", kind: "watch", sign: ["#203A5C", "#FFFFFF", "#FFC83D"] },
];

const shop = (kind: ShopKind) => SHOPS.find((s) => s.kind === kind) ?? SHOPS[0];
const PHONE_SHOP = shop("phone");
const CAR_SHOP = shop("cars");
const TIMECO_SHOP = shop("timeco");

/** The giant phone on its pedestal (base centre, on the floor of the phone shop's window). */
export const PHONE_SPOT: V3 = [(PHONE_SHOP.x0 + PHONE_SHOP.x1) / 2, 0, -1.25];
/** Centre of the turntable in the car showroom. */
export const CAR_SPOT: V3 = [CAR_SHOP.x0 + 3.24, 0, -1.25];
/** Where the rich man stands in the showroom (left of the car, a step deeper). */
export const RICH_SPOT: V3 = [CAR_SHOP.x0 + 1.89, 0, -2.85];
/** The showroom's price banner (centre). */
export const PRICE_SPOT: V3 = [CAR_SHOP.x0 + 3.24, 2.62, -0.3];
/** TIMECO's billboard (centre of its face) on the TIMECO building. */
export const BILLBOARD = { center: [(TIMECO_SHOP.x0 + TIMECO_SHOP.x1) / 2, 4.5, 0.32] as V3, w: 5.2, h: 5.2 * (625 / 1536) };
/** Middle of the TIMECO building's front (for the question shot). */
export const TIMECO_X = (TIMECO_SHOP.x0 + TIMECO_SHOP.x1) / 2;

// =======================================================================================
// Textures

const tileTexture = () =>
  canvasTexture(
    "ave-tiles",
    512,
    512,
    (ctx, W, H) => {
      ctx.fillStyle = "#E9E1D4";
      ctx.fillRect(0, 0, W, H);
      const rnd = mulberry(5);
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 4; x++) {
          const l = 0.9 + rnd() * 0.08;
          ctx.fillStyle = `rgb(${Math.round(240 * l)},${Math.round(232 * l)},${Math.round(219 * l)})`;
          ctx.fillRect(x * 128 + 4, y * 128 + 4, 120, 120);
        }
      ctx.fillStyle = "rgba(160,140,120,0.5)";
      for (let i = 0; i <= 4; i++) {
        ctx.fillRect(i * 128 - 2, 0, 4, H);
        ctx.fillRect(0, i * 128 - 2, W, 4);
      }
    },
    { wrapS: true, wrapT: true },
  );

const asphaltTexture = () =>
  canvasTexture(
    "ave-asphalt",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#545A68";
      ctx.fillRect(0, 0, W, H);
      const rnd = mulberry(9);
      for (let i = 0; i < 500; i++) {
        ctx.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)";
        ctx.fillRect(rnd() * W, rnd() * H, 3, 3);
      }
    },
    { wrapS: true, wrapT: true },
  );

/** The phone's screen: an hourglass and the price "1 MES". */
const phoneScreenTexture = () =>
  canvasTexture("ave-phone-screen", 360, 720, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#3A7BFF");
    g.addColorStop(0.55, "#7B4DFF");
    g.addColorStop(1, "#FF5FB0");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(W * (0.15 + i * 0.16), H * (0.2 + (i % 3) * 0.12), 30 + i * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 34px ${HEAVY}`;
    ctx.fillText("PRECIO", W / 2, H * 0.36);
    // The price on a white pill.
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(W * 0.07, H * 0.41, W * 0.86, H * 0.25, 40);
    ctx.fill();
    ctx.fillStyle = "#FF3B3B";
    fitFont(ctx, "1 MES", (s) => `${s}px ${TITLE}`, 150, W * 0.78);
    ctx.fillText("1 MES", W / 2, H * 0.545);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `800 30px ${HEAVY}`;
    ctx.fillText("DE TU VIDA", W / 2, H * 0.72);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.roundRect(W * 0.36, H * 0.93, W * 0.28, 12, 6);
    ctx.fill();
  });

/** The showroom's price banner: "5 AÑOS". */
const carPriceTexture = () =>
  canvasTexture("ave-car-price", 1024, 400, (ctx, W, H) => {
    ctx.fillStyle = "#FFC83D";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 60);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(18, 18, W - 36, H - 36, 46);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1B1B24";
    ctx.font = `900 54px ${HEAVY}`;
    ctx.fillText("PRECIO", W / 2, 78);
    ctx.fillStyle = "#E3242B";
    fitFont(ctx, "5 AÑOS", (s) => `${s}px ${TITLE}`, 250, W - 120);
    ctx.fillText("5 AÑOS", W / 2, H * 0.62);
  });

const soldTexture = () =>
  canvasTexture("ave-sold", 512, 160, (ctx, W, H) => {
    ctx.strokeStyle = "#E3242B";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.roundRect(10, 10, W - 20, H - 20, 26);
    ctx.stroke();
    ctx.fillStyle = "#E3242B";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitFont(ctx, "VENDIDO", (s) => `${s}px ${TITLE}`, 110, W - 70);
    ctx.fillText("VENDIDO", W / 2, H / 2 + 8);
  });

/** "SE VENDE / 40 AÑOS", the estate's giant sign. */
const forSaleTexture = () =>
  canvasTexture("ave-for-sale", 1024, 640, (ctx, W, H) => {
    ctx.fillStyle = "#1B1B24";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 50);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(20, 20, W - 40, H - 40, 36);
    ctx.fill();
    ctx.fillStyle = "#E3242B";
    ctx.beginPath();
    ctx.roundRect(20, 20, W - 40, H * 0.36, [36, 36, 0, 0]);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#FFFFFF";
    fitFont(ctx, "SE VENDE", (s) => `${s}px ${TITLE}`, 170, W - 140);
    ctx.fillText("SE VENDE", W / 2, 20 + H * 0.18 + 10);
    ctx.fillStyle = "#1B1B24";
    fitFont(ctx, "40 AÑOS", (s) => `${s}px ${TITLE}`, 290, W - 110);
    ctx.fillText("40 AÑOS", W / 2, H * 0.7);
  });

/** TIMECO's billboard: logo, wordmark and slogan, backlit. */
const billboardTexture = () =>
  canvasTexture("ave-timeco-board", 1536, 625, (ctx, W, H) => {
    const { charcoal, red, sand } = TIMECO_COLORS;
    ctx.fillStyle = charcoal;
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * 0.55, H * 0.4, 40, W * 0.55, H * 0.4, W * 0.7);
    g.addColorStop(0, "rgba(255,59,59,0.22)");
    g.addColorStop(1, "rgba(255,59,59,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = red;
    ctx.lineWidth = 16;
    ctx.strokeRect(14, 14, W - 28, H - 28);
    drawTimecoLogo(ctx, 250, H * 0.42, 175, 0.62);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#FFFFFF";
    fitFont(ctx, "TIMECO", (s) => `${s}px ${TITLE}`, 300, W - 520);
    ctx.fillText("TIMECO", 470, H * 0.43);
    ctx.fillStyle = red;
    ctx.fillRect(470, H * 0.66, W - 540, 8);
    ctx.textAlign = "center";
    ctx.fillStyle = sand;
    fitFont(ctx, "TU TIEMPO, NUESTRO NEGOCIO", (s) => `900 ${s}px ${HEAVY}`, 92, W - 100);
    ctx.fillText("TU TIEMPO, NUESTRO NEGOCIO", W / 2, H * 0.82);
  });

const clockFaceTexture = () =>
  canvasTexture("ave-clock", 256, 256, (ctx, W) => {
    ctx.fillStyle = "#FFFDF4";
    ctx.beginPath();
    ctx.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2B2238";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(W / 2 + Math.sin(a) * W * 0.4, W / 2 - Math.cos(a) * W * 0.4, i % 3 ? 6 : 11, 0, Math.PI * 2);
      ctx.fill();
    }
  });

// =======================================================================================
// Facades (one merged vertex-coloured mesh for every building)

const facadeGeometry = () => {
  const geos: THREE.BufferGeometry[] = [];
  SHOPS.forEach((s, i) => {
    const W = s.x1 - s.x0 - 0.08;
    const cx = (s.x0 + s.x1) / 2;
    const top = s.kind === "cars" ? SHOWROOM_TOP : s.kind === "timeco" ? 3.0 : STORE_TOP;
    const wall = s.wall;
    const dark = shadeHex(wall, -0.08);
    const trim = s.kind === "timeco" ? "#FF3B3B" : "#FFFFFF";
    const pier = s.kind === "cars" ? 0.3 : 0.6;
    // Upper body sits on top of the store opening.
    geos.push(place(rbox(W, s.h - top, DEPTH, 0.12), wall, [cx, top + (s.h - top) / 2, -DEPTH / 2]));
    // Piers at both sides and the room's back wall.
    for (const side of [-1, 1]) geos.push(place(rbox(pier, top, DEPTH, 0.08), wall, [cx + side * (W / 2 - pier / 2), top / 2, -DEPTH / 2]));
    const room = roomOf(s.kind);
    geos.push(place(rbox(W - 2 * pier, top, 0.3, 0.05), s.kind === "timeco" ? "#3A2030" : shadeHex(wall, 0.06), [cx, top / 2, -room]));
    // Window floor (a raised plinth) and its gold sill.
    const plinth = s.kind === "cars" ? 0.12 : 0.4;
    geos.push(place(rbox(W - 2 * pier + 0.05, plinth, room, 0.04), shadeHex(wall, -0.14), [cx, plinth / 2, -room / 2]));
    geos.push(place(rbox(W - 2 * pier + 0.1, 0.07, 0.16, 0.03), "#E8B030", [cx, plinth, -0.05]));
    // Frame around the opening.
    geos.push(place(rbox(W - 2 * pier + 0.2, 0.12, 0.14, 0.04), trim, [cx, top - 0.02, 0.05]));
    for (const side of [-1, 1]) geos.push(place(rbox(0.12, top, 0.14, 0.04), trim, [cx + side * (W / 2 - pier), top / 2, 0.05]));
    // Cornice and a band under the upper floors.
    geos.push(place(rbox(W + 0.3, 0.36, 0.5, 0.1), trim, [cx, s.h, 0.0]));
    geos.push(place(rbox(W + 0.1, 0.16, 0.24, 0.05), dark, [cx, top + 1.05, 0.04]));
    // Calm upper floors: tall windows a shade darker than the wall.
    if (s.kind !== "timeco") {
      const bays = Math.max(2, Math.round(W / 2.2));
      for (let b = 0; b < bays; b++) {
        const x = cx - W / 2 + (W / bays) * (b + 0.5);
        for (let y = top + 1.9; y + 1.3 < s.h - 0.4; y += 2.3) {
          geos.push(place(rbox(0.95, 1.5, 0.1, 0.06), shadeHex(wall, -0.05), [x, y + 0.6, 0.02]));
          geos.push(place(rbox(0.75, 1.3, 0.08, 0.05), i % 2 ? "#B9D3E8" : "#C4D9EC", [x, y + 0.6, 0.06]));
        }
      }
    } else {
      // TIMECO: dark glass bands with red lines.
      for (let y = top + 0.9; y < s.h - 0.5; y += 1.25) geos.push(place(rbox(W - 0.4, 0.06, 0.06, 0.02), "#FF3B3B", [cx, y, 0.04]));
    }
  });
  return mergeAll(geos);
};
const facadeGeo = once(facadeGeometry);

/** Ground: tiled sidewalk, curb, road with its centre line, the shop rooms' floors. */
const groundGeos = once(() => ({
  walk: new THREE.PlaneGeometry(80, AVENUE.curbZ).rotateX(-Math.PI / 2).translate(5, 0, AVENUE.curbZ / 2),
  curb: rbox(80, 0.3, 0.32, 0.06).translate(5, -0.06, AVENUE.curbZ + 0.1),
  road: new THREE.PlaneGeometry(80, 40).rotateX(-Math.PI / 2).translate(5, AVENUE.roadY, AVENUE.curbZ + 20),
  dash: (() => {
    const geos: THREE.BufferGeometry[] = [];
    for (let x = -36; x < 46; x += 4) geos.push(place(new THREE.PlaneGeometry(2, 0.22).rotateX(-Math.PI / 2), "#FFFFFF", [x, AVENUE.roadY + 0.01, AVENUE.curbZ + 9]));
    return mergeAll(geos);
  })(),
}));

const repeatedCache = new Map<string, THREE.Texture>();
const repeated = (key: string, tex: THREE.Texture, rx: number, ry: number) => {
  let c = repeatedCache.get(key);
  if (!c) {
    c = tex.clone();
    c.repeat.set(rx, ry);
    c.needsUpdate = true;
    repeatedCache.set(key, c);
  }
  return c;
};

// =======================================================================================
// Street furniture

const lampGeos = once(() => ({
  pole: mergeAll([
    place(new THREE.CylinderGeometry(0.07, 0.1, 3.6, 10), "#1E1E26", [0, 1.8, 0]),
    place(new THREE.CylinderGeometry(0.22, 0.26, 0.3, 12), "#1E1E26", [0, 0.15, 0]),
    place(new THREE.TorusGeometry(0.12, 0.035, 6, 14).rotateX(Math.PI / 2), "#E8B030", [0, 0.9, 0]),
    place(new THREE.CylinderGeometry(0.16, 0.1, 0.18, 12), "#E8B030", [0, 3.6, 0]),
  ]),
  globe: new THREE.SphereGeometry(0.3, 18, 12),
}));

const StreetLamp: React.FC<{ position: V3; lit: number }> = ({ position, lit }) => {
  const g = lampGeos();
  return (
    <group position={position}>
      <mesh geometry={g.pole} material={vertexMat(0.4, false, 0.1, 0.3)} castShadow />
      <mesh geometry={g.globe} material={toy(lit > 0.5 ? "#FFE9B0" : "#FFFFFF", { rough: 0.2, glow: 0.3 + lit * 1.6 })} position={[0, 3.95, 0]} />
      {lit > 0.05 ? <Glow color="#FFC870" size={2.2} opacity={0.55 * lit} position={[0, 3.95, 0]} /> : null}
    </group>
  );
};

const planterGeos = once(() => ({
  pot: mergeAll([
    place(rbox(0.9, 0.7, 0.9, 0.12), "#2B2B35", [0, 0.35, 0]),
    place(rbox(0.98, 0.1, 0.98, 0.04), "#E8B030", [0, 0.68, 0]),
  ]),
  ball: new THREE.IcosahedronGeometry(0.62, 2),
  trunk: new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8),
}));

const Topiary: React.FC<{ position: V3 }> = ({ position }) => {
  const g = planterGeos();
  return (
    <group position={position}>
      <mesh geometry={g.pot} material={vertexMat(0.45, false, 0.12)} castShadow />
      <mesh geometry={g.trunk} material={toy("#7A5230")} position={[0, 1.05, 0]} />
      <mesh geometry={g.ball} material={toy("#3DBF55", { rough: 0.8, flat: true, glow: 0.12 })} position={[0, 1.75, 0]} castShadow />
    </group>
  );
};

// =======================================================================================
// Window contents

const phoneGeos = once(() => ({
  pedestal: mergeAll([
    place(new THREE.CylinderGeometry(0.62, 0.7, 0.75, 32), "#FFFFFF", [0, 0.375, 0]),
    place(new THREE.TorusGeometry(0.64, 0.05, 8, 32).rotateX(Math.PI / 2), "#E8B030", [0, 0.72, 0]),
    place(new THREE.TorusGeometry(0.7, 0.05, 8, 32).rotateX(Math.PI / 2), "#E8B030", [0, 0.04, 0]),
  ]),
  body: rbox(1.05, 2.0, 0.16, 0.16, 4),
  screen: new THREE.PlaneGeometry(0.93, 1.86),
  cam: new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12).rotateX(Math.PI / 2),
  shelf: rbox(0.9, 0.06, 0.4, 0.02),
  mini: rbox(0.2, 0.38, 0.04, 0.04),
}));

/** The giant glowing phone on its pedestal (base centre at the origin, facing +z). */
export const GiantPhone: React.FC<{ t?: number; glow?: number }> = ({ t = 0, glow = 1 }) => {
  const ready = useFontsReady();
  const g = phoneGeos();
  const bob = 0.05 * Math.sin(t * 2.2);
  return (
    <group>
      <mesh geometry={g.pedestal} material={vertexMat(0.3, false, 0.16)} castShadow />
      <group position={[0, 1.85 + bob, 0]} rotation={[0, 0.18 * Math.sin(t * 0.9), 0.04]}>
        <mesh geometry={g.body} material={toy("#24242E", { rough: 0.25, metal: 0.2, glow: 0.05 })} castShadow />
        {ready ? <mesh geometry={g.screen} material={screenMat(phoneScreenTexture())} position={[0, 0, 0.085]} /> : null}
        <mesh geometry={g.cam} material={toy("#111111")} position={[0.3, 0.85, -0.09]} />
      </group>
      <Glow color="#7B8CFF" size={3.2} opacity={0.45 * glow} position={[0, 1.8, -0.4]} />
      {/* Shelves of normal-sized phones on the side walls. */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.75, 0, -1.5]}>
          {[1.0, 1.65].map((y) => (
            <group key={y} position={[0, y, 0]}>
              <mesh geometry={g.shelf} material={toy("#FFFFFF", { rough: 0.3 })} />
              {[-0.28, 0, 0.28].map((x, k) => (
                <mesh key={x} geometry={g.mini} material={toy(["#FF5FB0", "#2F6BFF", "#24242E"][k], { rough: 0.3, glow: 0.2 })} position={[x, 0.22, 0]} rotation={[-0.15, 0, 0]} />
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
};

const carGeos = once(() => ({
  body: rbox(2.5, 0.5, 1.22, 0.22, 3),
  hood: rbox(0.9, 0.12, 1.1, 0.05),
  cabin: rbox(1.3, 0.5, 1.08, 0.2, 3),
  roof: rbox(1.12, 0.1, 1.0, 0.05),
  wheel: new THREE.CylinderGeometry(0.27, 0.27, 0.22, 20).rotateX(Math.PI / 2),
  hub: new THREE.CylinderGeometry(0.13, 0.13, 0.24, 14).rotateX(Math.PI / 2),
  lamp: new THREE.SphereGeometry(0.1, 12, 8),
  bumper: rbox(0.12, 0.14, 1.18, 0.05),
  stripe: new THREE.PlaneGeometry(1.6, 0.06),
  table: new THREE.CylinderGeometry(1.45, 1.52, 0.2, 48),
  tableRing: new THREE.TorusGeometry(1.48, 0.05, 8, 64).rotateX(Math.PI / 2),
}));

/** The shiny red toy car (length along x, front +x), standing on y = 0. */
export const ToyCar: React.FC<{ color?: string }> = ({ color = "#E3242B" }) => {
  const g = carGeos();
  const paint = toy(color, { rough: 0.2, metal: 0.15, glow: 0.18 });
  const glass = toy("#2D3F66", { rough: 0.08, metal: 0.4, glow: 0.12 });
  const chrome = toy("#E6ECF2", { rough: 0.15, metal: 0.6, glow: 0.2 });
  return (
    <group>
      <mesh geometry={g.body} material={paint} position={[0, 0.5, 0]} castShadow />
      <mesh geometry={g.cabin} material={glass} position={[-0.15, 0.92, 0]} castShadow />
      <mesh geometry={g.roof} material={paint} position={[-0.15, 1.18, 0]} />
      {/* Window pillars. */}
      {[-0.72, 0.42].map((x) => (
        <mesh key={x} geometry={g.bumper} material={paint} position={[x, 0.93, 0]} scale={[0.9, 3.0, 0.98]} />
      ))}
      {[
        [0.82, 0.6],
        [-0.82, 0.6],
        [0.82, -0.6],
        [-0.82, -0.6],
      ].map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0.27, z]}>
          <mesh geometry={g.wheel} material={toy("#1C1C22", { rough: 0.7 })} castShadow />
          <mesh geometry={g.hub} material={chrome} />
        </group>
      ))}
      {[-0.4, 0.4].map((z) => (
        <group key={z}>
          <mesh geometry={g.lamp} material={toy("#FFF6C8", { glow: 1.2 })} position={[1.24, 0.55, z]} scale={[0.6, 1, 1.4]} />
          <mesh geometry={g.lamp} material={toy("#FF3030", { glow: 0.9 })} position={[-1.24, 0.58, z]} scale={[0.5, 0.8, 1.6]} />
        </group>
      ))}
      <mesh geometry={g.bumper} material={chrome} position={[1.27, 0.33, 0]} />
      <mesh geometry={g.bumper} material={chrome} position={[-1.27, 0.33, 0]} />
      {/* Cartoon highlights on the paint. */}
      {[0.62, -0.62].map((z) => (
        <mesh key={z} geometry={g.stripe} material={toy("#FFFFFF", { glow: 0.6 })} position={[0.1, 0.66, z * 1.003]} rotation={[0, z > 0 ? 0 : Math.PI, 0]} />
      ))}
    </group>
  );
};

/** The showroom's turntable with the car on it (`spin` radians). */
export const CarTurntable: React.FC<{ spin: number }> = ({ spin }) => {
  const g = carGeos();
  return (
    <group>
      <mesh geometry={g.table} material={toy("#F2F4F8", { rough: 0.2, metal: 0.2, glow: 0.2 })} position={[0, 0.1, 0]} receiveShadow />
      <mesh geometry={g.tableRing} material={toy("#FFC83D", { glow: 0.9 })} position={[0, 0.2, 0]} />
      <group position={[0, 0.2, 0]} rotation={[0, spin, 0]}>
        <ToyCar />
      </group>
    </group>
  );
};

const interiorGeos = once(() => ({
  clockRim: new THREE.CylinderGeometry(0.42, 0.42, 0.1, 32).rotateX(Math.PI / 2),
  clockFace: new THREE.CircleGeometry(0.36, 32),
  hand: rbox(0.05, 0.3, 0.02, 0.02),
  diamond: new THREE.OctahedronGeometry(0.42, 0),
  stand: mergeAll([place(rbox(0.7, 0.9, 0.7, 0.08), "#FFFFFF", [0, 0.45, 0]), place(rbox(0.76, 0.06, 0.76, 0.03), "#E8B030", [0, 0.9, 0])]),
  bag: rbox(0.62, 0.48, 0.28, 0.1),
  handle: new THREE.TorusGeometry(0.2, 0.035, 6, 16, Math.PI),
  bottle: new THREE.CylinderGeometry(0.17, 0.2, 0.42, 16),
  cap: new THREE.SphereGeometry(0.12, 12, 8),
  spot: new THREE.CircleGeometry(0.22, 18).rotateX(Math.PI / 2),
}));

/** What sits in each window (shop space: x across the window, z back from the facade). */
const ShopInterior: React.FC<{ spec: ShopSpec; t: number; dusk: number }> = ({ spec, t, dusk }) => {
  const g = interiorGeos();
  const ready = useFontsReady();
  const cx = (spec.x0 + spec.x1) / 2;
  const floorY = 0.4;
  const lightTone = toy("#FFF4D6", { glow: 0.9 + dusk });
  const ceiling = (n: number, w: number, y: number) =>
    Array.from({ length: n }, (_, i) => <mesh key={`l${i}`} geometry={g.spot} material={lightTone} position={[cx - w / 2 + (w / n) * (i + 0.5), y - 0.01, -1.3]} rotation={[Math.PI, 0, 0]} />);
  if (spec.kind === "watch") {
    return (
      <group>
        {[-1.6, 0, 1.6].map((dx, i) => (
          <group key={dx} position={[cx + dx, 1.7 + (i === 1 ? 0.25 : 0), -ROOM + 0.2]}>
            <mesh geometry={g.clockRim} material={toy("#FFC83D", { metal: 0.5, rough: 0.25, glow: 0.3 })} />
            {ready ? <mesh geometry={g.clockFace} material={texMat(clockFaceTexture(), 0.5)} position={[0, 0, 0.06]} /> : null}
            <mesh geometry={g.hand} material={toy("#2B2238")} position={[0, 0, 0.08]} rotation={[0, 0, -t * 0.8 - i]} scale={[1, 0.9, 1]} />
            <mesh geometry={g.hand} material={toy("#E3242B")} position={[0, 0, 0.09]} rotation={[0, 0, -t * 6 - i * 2]} scale={[0.6, 1.1, 1]} />
          </group>
        ))}
        {ceiling(3, 4, STORE_TOP)}
      </group>
    );
  }
  if (spec.kind === "jewel") {
    return (
      <group>
        {[-1.3, 1.3].map((dx, i) => (
          <group key={dx} position={[cx + dx, floorY, -1.5]}>
            <mesh geometry={g.stand} material={vertexMat(0.3, false, 0.15)} />
            <mesh geometry={g.diamond} material={toy(i ? "#7FE7FF" : "#FF7FD0", { rough: 0.05, metal: 0.3, glow: 0.55, flat: true })} position={[0, 1.4, 0]} rotation={[0, t * 0.9 + i, 0]} scale={[0.75, 1, 0.75]} />
            <Glow color={i ? "#9FF3FF" : "#FF9FE0"} size={1.4} opacity={0.5} position={[0, 1.4, 0]} />
          </group>
        ))}
        {ceiling(2, 3.6, STORE_TOP)}
      </group>
    );
  }
  if (spec.kind === "fashion") {
    return (
      <group>
        {[-1.6, 0, 1.6].map((dx, i) => (
          <group key={dx} position={[cx + dx, floorY, -1.6]}>
            <mesh geometry={g.stand} material={vertexMat(0.3, false, 0.15)} scale={[1, 0.8 + (i % 2) * 0.3, 1]} />
            <group position={[0, 0.95 + (i % 2) * 0.27, 0]}>
              <mesh geometry={g.bag} material={toy(["#FF5F8F", "#FFC83D", "#5EC2FF"][i], { rough: 0.4, glow: 0.2 })} position={[0, 0.24, 0]} />
              <mesh geometry={g.handle} material={toy("#E8B030", { metal: 0.5, rough: 0.3 })} position={[0, 0.48, 0]} />
            </group>
          </group>
        ))}
        {ceiling(3, 4, STORE_TOP)}
      </group>
    );
  }
  if (spec.kind === "perfume") {
    return (
      <group>
        {[-1.4, -0.7, 0, 0.7, 1.4].map((dx, i) => (
          <group key={dx} position={[cx + dx, floorY + 0.21 + (i % 2) * 0.3, -1.5]}>
            <mesh geometry={g.bottle} material={toy(["#FF8FD0", "#B78CFF", "#FFC83D", "#7FE7FF", "#FF7F6B"][i], { rough: 0.1, metal: 0.2, glow: 0.4 })} />
            <mesh geometry={g.cap} material={toy("#E8B030", { metal: 0.5, rough: 0.3 })} position={[0, 0.3, 0]} />
          </group>
        ))}
        {ceiling(3, 4, STORE_TOP)}
      </group>
    );
  }
  if (spec.kind === "timeco") {
    return (
      <group>
        <Glow color="#FF3B3B" size={5} opacity={0.35 + 0.25 * dusk} position={[cx, 1.6, -ROOM + 0.6]} />
        {ready ? (
          <mesh position={[cx, 1.55, -ROOM + 0.17]}>
            <planeGeometry args={[2.2, 2.2]} />
            <primitive object={screenMat(logoTexture())} attach="material" />
          </mesh>
        ) : null}
      </group>
    );
  }
  return null;
};

const logoTexture = () =>
  canvasTexture("ave-timeco-logo", 512, 512, (ctx, W) => {
    ctx.clearRect(0, 0, W, W);
    drawTimecoLogo(ctx, W / 2, W / 2, W * 0.46, 0.6);
  });

/** The showroom: glossy floor, back wall stripe, ceiling lights, the turntable and the price banner. */
const Showroom: React.FC<{ t: number; spin: number; sold: number }> = ({ spin, sold }) => {
  const ready = useFontsReady();
  const s = CAR_SHOP;
  const cx = (s.x0 + s.x1) / 2;
  const W = s.x1 - s.x0 - 0.9;
  return (
    <group>
      <mesh position={[cx, 0.125, -SHOW_ROOM / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, SHOW_ROOM]} />
        <meshStandardMaterial color="#DCE3EC" roughness={0.12} metalness={0.1} emissive="#DCE3EC" emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[cx, 2.0, -SHOW_ROOM + 0.16]}>
        <planeGeometry args={[W, 0.25]} />
        <meshBasicMaterial color="#E3242B" toneMapped={false} />
      </mesh>
      {[-3, -1, 1, 3].map((dx) => (
        <group key={dx} position={[cx + dx, SHOWROOM_TOP - 0.02, -1.6]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.22, 18]} />
            <meshBasicMaterial color="#FFF6DA" toneMapped={false} />
          </mesh>
        </group>
      ))}
      <group position={CAR_SPOT}>
        <group position={[0, 0.12, 0]}>
          <CarTurntable spin={spin} />
        </group>
        <Glow color="#FFE9A8" size={4.2} opacity={0.3} position={[0, 1.1, -0.8]} />
      </group>
      {/* The price banner hangs from the ceiling just behind the glass. */}
      <group position={PRICE_SPOT}>
        {[-0.75, 0.75].map((dx) => (
          <mesh key={dx} position={[dx, (SHOWROOM_TOP - PRICE_SPOT[1]) / 2 + 0.25, 0]}>
            <cylinderGeometry args={[0.015, 0.015, SHOWROOM_TOP - PRICE_SPOT[1], 6]} />
            <meshBasicMaterial color="#C9CED6" />
          </mesh>
        ))}
        {ready ? (
          <mesh>
            <planeGeometry args={[1.9, 0.74]} />
            <primitive object={texMat(carPriceTexture(), 0.55)} attach="material" />
          </mesh>
        ) : null}
        {ready && sold > 0.01 ? (
          <mesh position={[0.05, -0.04, 0.03]} rotation={[0, 0, 0.18]} scale={(1.6 - 0.6 * sold) * 1}>
            <planeGeometry args={[1.5, 0.47]} />
            <meshBasicMaterial map={soldTexture()} transparent opacity={clamp01(sold * 1.4)} toneMapped={false} />
          </mesh>
        ) : null}
      </group>
    </group>
  );
};

/** Diagonal glints on the shop glass (cartoon reflections). */
const glintMat = once(() => additive(new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.16, toneMapped: false, side: THREE.DoubleSide })));
const Glints: React.FC<{ x0: number; x1: number; top: number }> = ({ x0, x1, top }) => {
  const m = glintMat();
  const w = x1 - x0;
  return (
    <group>
      {[0.22, 0.3, 0.7].map((k, i) => (
        <mesh key={k} material={m} position={[x0 + w * k, top / 2 + 0.2, 0.06]} rotation={[0, 0, 0.6]}>
          <planeGeometry args={[i === 1 ? 0.12 : 0.32, top * 1.15]} />
        </mesh>
      ))}
    </group>
  );
};

// =======================================================================================
// The avenue

/**
 * The shopping avenue along x (shop fronts at z = 0, facing +z). `dusk` 0..1 switches the lamps
 * and the windows on; `spin` turns the showroom's turntable; `sold` 0..1 stamps "VENDIDO" on
 * the car's price; `phoneGlow` pumps the giant phone's halo; `billboard` shows TIMECO's board.
 */
export const Avenue: React.FC<{ t?: number; dusk?: number; spin?: number; sold?: number; billboard?: boolean; xRange?: [number, number] }> = ({
  t = 0,
  dusk = 0,
  spin = 0,
  sold = 0,
  billboard = true,
  xRange = [-40, 50],
}) => {
  const ready = useFontsReady();
  const ground = groundGeos();
  const tiles = useMemo(() => repeated("walk", tileTexture(), 40, 3.1), []);
  const asphalt = useMemo(() => repeated("road", asphaltTexture(), 20, 10), []);
  const facade = facadeGeo();
  const visible = (x0: number, x1: number) => x1 > xRange[0] && x0 < xRange[1];
  return (
    <group>
      <mesh geometry={ground.walk} receiveShadow>
        <meshStandardMaterial map={tiles} roughness={0.7} emissive="#FFFFFF" emissiveMap={tiles} emissiveIntensity={0.1} />
      </mesh>
      <mesh geometry={ground.curb} material={toy("#CFC6B8", { rough: 0.7 })} />
      <mesh geometry={ground.road}>
        <meshStandardMaterial map={asphalt} roughness={0.85} emissive="#FFFFFF" emissiveMap={asphalt} emissiveIntensity={0.08} />
      </mesh>
      <mesh geometry={ground.dash} material={vertexMat(0.6, false, 0.3)} />
      <mesh geometry={facade} material={vertexMat(0.55, false, 0.15 + 0.05 * dusk)} castShadow receiveShadow />
      {SHOPS.map((s, i) => {
        if (!visible(s.x0, s.x1)) return null;
        const cx = (s.x0 + s.x1) / 2;
        const top = s.kind === "cars" ? SHOWROOM_TOP : s.kind === "timeco" ? 3.0 : STORE_TOP;
        const W = s.x1 - s.x0;
        const signW = s.kind === "cars" ? 4.4 : s.kind === "timeco" ? 4.2 : Math.min(3.6, W - 1.6);
        return (
          <group key={i}>
            <ShopInterior spec={s} t={t} dusk={dusk} />
            {s.kind === "phone" ? (
              <group position={[PHONE_SPOT[0], 0.4, PHONE_SPOT[2]]}>
                <GiantPhone t={t} glow={1 + dusk} />
              </group>
            ) : null}
            {s.kind === "cars" ? <Showroom t={t} spin={spin} sold={sold} /> : null}
            <Glints x0={s.x0 + 0.6} x1={s.x1 - 0.6} top={top} />
            {ready && s.kind !== "timeco" ? (
              <mesh position={[cx, top + 0.5, 0.1]}>
                <planeGeometry args={[signW, signW * (220 / 1024)]} />
                <primitive object={texMat(signTexture(s.name, s.sign[0], s.sign[1], s.sign[2]), 0.35 + 0.4 * dusk)} attach="material" />
              </mesh>
            ) : null}
            {/* Warm window light at dusk. */}
            {dusk > 0.05 && s.kind !== "timeco" ? <Glow color="#FFD08A" size={W * 0.7} opacity={0.22 * dusk} position={[cx, top * 0.55, -0.8]} /> : null}
          </group>
        );
      })}
      {billboard ? <TimecoBillboard t={t} dusk={dusk} /> : null}
      {[-18.6, -11.8, 7.4, 13.2, 19, 29.4].map((x) => (
        <Topiary key={x} position={[x, 0, 0.75]} />
      ))}
      {[-15.2, 16.1, 26.5, 33].map((x) => (
        <StreetLamp key={x} position={[x, 0, AVENUE.curbZ - 0.55]} lit={dusk} />
      ))}
    </group>
  );
};

/** TIMECO's big backlit billboard on the TIMECO building (with its ring of bulbs). */
export const TimecoBillboard: React.FC<{ t?: number; dusk?: number }> = ({ t = 0, dusk = 0 }) => {
  const ready = useFontsReady();
  const { center, w, h } = BILLBOARD;
  const flick = 0.92 + 0.08 * Math.sin(t * 7.3) * Math.sin(t * 2.1);
  return (
    <group position={center}>
      <mesh position={[0, 0, -0.18]}>
        <boxGeometry args={[w + 0.36, h + 0.36, 0.3]} />
        <meshStandardMaterial color="#111118" roughness={0.4} metalness={0.3} />
      </mesh>
      {ready ? (
        <mesh>
          <planeGeometry args={[w, h]} />
          <primitive object={screenMat(billboardTexture())} attach="material" />
        </mesh>
      ) : null}
      {/* Marquee bulbs around the frame. */}
      {Array.from({ length: 28 }, (_, i) => {
        const per = 2 * (w + h);
        let d = (i / 28) * per;
        let x: number;
        let y: number;
        if (d < w) [x, y] = [-w / 2 + d, h / 2 + 0.12];
        else if ((d -= w) < h) [x, y] = [w / 2 + 0.12, h / 2 - d];
        else if ((d -= h) < w) [x, y] = [w / 2 - d, -h / 2 - 0.12];
        else [x, y] = [-w / 2 - 0.12, -h / 2 + (d - w)];
        const on = (Math.floor(t * 6) + i) % 3 !== 0;
        return (
          <mesh key={i} position={[x, y, 0.05]}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <meshBasicMaterial color={on ? "#FFE08A" : "#8A6A30"} toneMapped={false} />
          </mesh>
        );
      })}
      <Glow color="#FF4A3A" size={w * 1.25} opacity={(0.18 + 0.3 * dusk) * flick} position={[0, 0, 0.4]} />
    </group>
  );
};

// =======================================================================================
// The rich man

export const RICH_SIZE = 2.2;
/** Golden vinyl body, darker gold fins and legs. */
export const RICH_PALETTE: NubiPalette = { body: "#F7BE2B", fins: "#EBA51A", legs: "#D98F12" };
const BODY_FRONT = 4.4;

const richGeos = once(() => {
  // A parabola across the front of the body, below the eyes, for the chain.
  const links: { p: V3; r: number }[] = [];
  const N = 15;
  for (let i = 0; i < N; i++) {
    const x = -4.7 + (9.4 * i) / (N - 1);
    const y = 2.85 + (x / 4.7) ** 2 * 3.9;
    const dx = 9.4 / (N - 1);
    const slope = (2 * x * 3.9) / 4.7 ** 2;
    links.push({ p: [x, y, BODY_FRONT + 0.32], r: Math.atan2(slope * dx, dx) });
  }
  return {
    links,
    link: new THREE.TorusGeometry(0.38, 0.14, 8, 14),
    medal: new THREE.CylinderGeometry(1.15, 1.15, 0.3, 28).rotateX(Math.PI / 2),
    medalRim: new THREE.TorusGeometry(1.15, 0.12, 8, 28),
    glass: new THREE.CylinderGeometry(1.32, 1.32, 0.18, 26).rotateX(Math.PI / 2),
    rim: new THREE.TorusGeometry(1.36, 0.16, 8, 28),
    bridge: new THREE.CylinderGeometry(0.11, 0.11, 2.0, 8).rotateZ(Math.PI / 2),
    arm: rbox(1.6, 0.22, 0.22, 0.08),
    brim: new THREE.CylinderGeometry(4.5, 4.5, 0.38, 36),
    crown: new THREE.CylinderGeometry(3.05, 2.85, 4.4, 32),
    band: new THREE.CylinderGeometry(2.92, 2.9, 0.85, 32),
    cane: new THREE.CylinderGeometry(0.2, 0.17, 5.4, 10),
    knob: new THREE.SphereGeometry(0.5, 16, 12),
    tip: new THREE.CylinderGeometry(0.22, 0.22, 0.4, 10),
    hourglass: new THREE.ConeGeometry(0.45, 0.65, 4),
  };
});

const RichGear: React.FC = () => {
  const g = richGeos();
  const goldM = toy("#FFD34A", { metal: 0.55, rough: 0.2, glow: 0.35 });
  const black = toy("#18181F", { rough: 0.35, glow: 0.06 });
  const lens = toy("#151824", { rough: 0.08, metal: 0.5, glow: 0.05 });
  return (
    <group>
      {/* Top hat, tilted a touch for swagger. */}
      <group position={[0.3, 9.95, -0.3]} rotation={[-0.06, 0, -0.12]}>
        <mesh geometry={g.brim} material={black} position={[0, 0.19, 0]} castShadow />
        <mesh geometry={g.crown} material={black} position={[0, 2.5, 0]} castShadow />
        <mesh geometry={g.band} material={toy("#C8102E", { rough: 0.45, glow: 0.18 })} position={[0, 0.85, 0]} />
      </group>
      {/* Round dark sunglasses with gold rims. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 2.3, 5.65, BODY_FRONT + 0.32]}>
          <mesh geometry={g.glass} material={lens} />
          <mesh geometry={g.rim} material={goldM} />
          <mesh geometry={g.arm} material={goldM} position={[s * 1.75, 0.35, -0.3]} rotation={[0, s * 0.35, 0]} />
        </group>
      ))}
      <mesh geometry={g.bridge} material={goldM} position={[0, 6.05, BODY_FRONT + 0.34]} scale={[0.8, 1, 1]} />
      {/* Thick gold chain with an hourglass medallion. */}
      {g.links.map((l, i) => (
        <mesh key={i} geometry={g.link} material={goldM} position={l.p} rotation={[i % 2 ? Math.PI / 2 : 0, 0, l.r]} />
      ))}
      <group position={[0, 2.3, BODY_FRONT + 0.48]}>
        <mesh geometry={g.medal} material={goldM} />
        <mesh geometry={g.medalRim} material={toy("#E89A10", { metal: 0.5, rough: 0.25, glow: 0.25 })} />
        <mesh geometry={g.hourglass} material={black} position={[0, 0.3, 0.2]} rotation={[Math.PI, 0, 0]} scale={[1, 1, 0.4]} />
        <mesh geometry={g.hourglass} material={black} position={[0, -0.3, 0.2]} scale={[1, 1, 0.4]} />
      </group>
    </group>
  );
};

/** The black cane with a gold knob, held upright at a fin tip (its tip near the ground). */
const Cane: React.FC<{ raise: number }> = ({ raise }) => {
  const g = richGeos();
  return (
    <Upright raise={raise} side="L">
      <group position={[0.2, 0, 0.6]}>
        <mesh geometry={g.knob} material={toy("#FFD34A", { metal: 0.55, rough: 0.2, glow: 0.35 })} position={[0, 0.55, 0]} />
        <mesh geometry={g.cane} material={toy("#18181F", { rough: 0.3, glow: 0.06 })} position={[0, -2.4, 0]} />
        <mesh geometry={g.tip} material={toy("#FFD34A", { metal: 0.55, rough: 0.2, glow: 0.35 })} position={[0, -5.1, 0]} />
      </group>
    </Upright>
  );
};

/**
 * The rich man: a golden Nubi-shaped toy (size 2.2) in a black top hat, round dark sunglasses
 * and a thick gold chain, leaning on a cane (screen-left fin). Smug and relaxed: the pose comes
 * from the shot (see richIdle).
 */
export const RichMan: React.FC<{ position?: V3; rotationY?: number; pose?: NubiPose; cane?: boolean; holdR?: React.ReactNode }> = ({
  position,
  rotationY = 0,
  pose = {},
  cane = true,
  holdR,
}) => (
  <Nubi size={RICH_SIZE} position={position} rotationY={rotationY} pose={pose} palette={RICH_PALETTE} holdL={cane ? <Cane raise={pose.finL ?? 0} /> : undefined} holdR={holdR}>
    <RichGear />
  </Nubi>
);

/** The rich man's relaxed idle: leaning back a little, a slow smug sway. */
export const richIdle = (t: number): NubiPose => ({
  pitch: -0.07 + 0.015 * Math.sin(t * 1.7),
  roll: 0.035 * Math.sin(t * 1.1),
  squash: 1 + 0.02 * Math.sin(t * 2.1),
  finL: 0.05,
  finR: -0.1,
  yaw: 0.06 * Math.sin(t * 0.7),
});

// =======================================================================================
// Effects

const CONFETTI_COLORS = ["#FFC83D", "#FF3B3B", "#FFFFFF", "#4FE3FF", "#FF5FD2", "#7CF03C"];
const confettiGeo = once(() => new THREE.PlaneGeometry(0.16, 0.09));
const confettiMat = once(() => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }));

/** A burst of confetti flying up from `position` and fluttering down (`age` = seconds since the burst). */
export const ConfettiBurst: React.FC<{ age: number; position: V3; count?: number; seed?: number; power?: number }> = ({ age, position, count = 70, seed = 4, power = 1 }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const parts = useMemo(() => {
    const rnd = mulberry(seed);
    return Array.from({ length: count }, () => {
      const a = rnd() * Math.PI * 2;
      const up = 0.55 + rnd() * 0.45;
      const sp = (2.2 + rnd() * 2.6) * power;
      return {
        v: [Math.cos(a) * sp * (1 - up * 0.6), sp * up * 1.4, Math.sin(a) * sp * (1 - up * 0.6) * 0.6] as V3,
        spin: [rnd() * 10 - 5, rnd() * 10 - 5, rnd() * 10 - 5] as V3,
        phase: rnd() * 6,
        color: CONFETTI_COLORS[Math.floor(rnd() * CONFETTI_COLORS.length)],
      };
    });
  }, [count, seed, power]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const c = new THREE.Color();
    parts.forEach((p, i) => m.setColorAt(i, c.set(p.color)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [parts]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const t = Math.max(0, age);
    const k = 2.2;
    const drag = (1 - Math.exp(-k * t)) / k;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const pos = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const fade = 1 - clamp01((t - 1.8) / 0.6);
    parts.forEach((p, i) => {
      const gTerm = 2.6;
      pos.set(
        p.v[0] * drag + 0.15 * Math.sin(t * 5 + p.phase) * t,
        p.v[1] * drag - gTerm * (t - drag) / k * 1.0,
        p.v[2] * drag,
      );
      e.set(p.spin[0] * t + p.phase, p.spin[1] * t, p.spin[2] * t);
      q.setFromEuler(e);
      const s = (age < 0 ? 0 : 1) * fade * Math.min(1, t * 12);
      sc.set(s, s, s);
      m4.compose(pos, q, sc);
      m.setMatrixAt(i, m4);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [parts, age]);
  if (age < 0 || age > 2.6) return null;
  return (
    <group position={position}>
      <instancedMesh ref={ref} args={[confettiGeo(), confettiMat(), count]} frustumCulled={false} />
    </group>
  );
};

const starGeo = once(() => {
  const s = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = i % 2 ? 0.28 : 1;
    if (i === 0) s.moveTo(Math.sin(a) * r, Math.cos(a) * r);
    else s.lineTo(Math.sin(a) * r, Math.cos(a) * r);
  }
  s.closePath();
  return new THREE.ShapeGeometry(s);
});
const starMat = once(() => new THREE.MeshBasicMaterial({ color: "#FFF3B0", toneMapped: false, transparent: true, side: THREE.DoubleSide }));

/** Twinkling four-point sparkles around a point (`age` = seconds since they started). */
export const Sparkles: React.FC<{ age: number; position: V3; radius?: number; count?: number; seed?: number; size?: number; life?: number }> = ({
  age,
  position,
  radius = 1.4,
  count = 9,
  seed = 2,
  size = 0.22,
  life = 1.2,
}) => {
  const pts = useMemo(() => {
    const rnd = mulberry(seed);
    return Array.from({ length: count }, () => ({ a: rnd() * Math.PI * 2, r: 0.35 + rnd() * 0.65, y: rnd() - 0.4, delay: rnd() * 0.45, s: 0.6 + rnd() * 0.7 }));
  }, [count, seed]);
  if (age < 0 || age > life + 0.5) return null;
  return (
    <group position={position}>
      {pts.map((p, i) => {
        const k = (age - p.delay) / (life * 0.6);
        if (k < 0 || k > 1) return null;
        const s = size * p.s * Math.sin(k * Math.PI);
        return (
          <mesh key={i} geometry={starGeo()} material={starMat()} position={[Math.cos(p.a) * radius * p.r, p.y * radius + k * 0.3, Math.sin(p.a) * radius * p.r * 0.4 + 0.3]} rotation={[0, 0, k * 1.5]} scale={[s, s, s]} />
        );
      })}
    </group>
  );
};

const dropGeo = once(() => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI;
    pts.push(new THREE.Vector2(Math.sin(a) * Math.pow(Math.sin(a / 2), 1.1), Math.cos(a) * 1.25));
  }
  return new THREE.LatheGeometry(pts, 18);
});
const dropMat = once(() => new THREE.MeshStandardMaterial({ color: "#8FE0FF", roughness: 0.06, metalness: 0.1, emissive: new THREE.Color("#5FCBFF"), emissiveIntensity: 0.5 }));

/**
 * The anime "worried" sweat drop on the side of Nubi's head (a child of <Nubi>, model units).
 * `k` 0..1 grows it in; it slides down slowly with `slide` 0..1.
 */
export const WorryDrop: React.FC<{ k: number; slide?: number; side?: 1 | -1 }> = ({ k, slide = 0, side = 1 }) => {
  if (k <= 0.01) return null;
  const s = 0.95 * k;
  return (
    <mesh geometry={dropGeo()} material={dropMat()} position={[side * 4.3, 8.9 - 1.6 * slide, 4.75]} rotation={[0, 0, side * 0.12]} scale={[s, s, s * 0.6]} />
  );
};

// =======================================================================================
// The estate on the hill (casa)

/** The estate: gate at z = 0, the hill and the mansion beyond (−z). */
export const ESTATE = {
  gateHalf: 1.9,
  /** Nubi's spot just outside the gate. */
  nubi: [-1.1, 0, 1.4] as V3,
  /** Centre of the "SE VENDE" panel. */
  sign: [3.9, 3.1, -1.4] as V3,
  signW: 4.4,
  hill: [0, 0, -30] as V3,
  hillTop: 4.5,
  mansion: [0, 4.5, -33] as V3,
};

const lawnTexture = () =>
  canvasTexture(
    "ave-lawn",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#59C25A";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#4DB04F";
      for (let i = 0; i < 4; i++) ctx.fillRect(i * 64, 0, 32, H);
    },
    { wrapS: true, wrapT: true },
  );

const estateGeos = once(() => {
  const E = ESTATE;
  // Hill: a lathe with a flat top and a soft shoulder.
  const prof: THREE.Vector2[] = [];
  const R0 = 34;
  const R1 = 17;
  for (let i = 0; i <= 24; i++) {
    const k = i / 24;
    const r = lerp(R0, R1, k);
    const y = E.hillTop * (0.5 - 0.5 * Math.cos(Math.PI * Math.pow(k, 0.85)));
    prof.push(new THREE.Vector2(r, y));
  }
  prof.push(new THREE.Vector2(0.01, E.hillTop));
  const hill = new THREE.LatheGeometry(prof.reverse(), 64);

  // The mansion (vertex coloured, origin at the front centre of its plinth).
  const white = "#FFF9F0";
  const cream = "#F3E6CF";
  const roof = "#3F5E9C";
  const goldC = "#E8B030";
  const glassC = "#5C8FD6";
  const m: THREE.BufferGeometry[] = [];
  m.push(place(rbox(19, 0.6, 9.5, 0.1), cream, [0, 0.3, -4.2]));
  m.push(place(rbox(13, 6.2, 7, 0.15), white, [0, 3.7, -4.5]));
  for (const s of [-1, 1]) {
    m.push(place(rbox(5.4, 4.6, 6.2, 0.15), white, [s * 9.0, 2.9, -4.6]));
    m.push(place(new THREE.ConeGeometry(4.3, 2.0, 4, 1).rotateY(Math.PI / 4), roof, [s * 9.0, 6.2, -4.6], [0, 0, 0], [0.9, 1, 1.05]));
    m.push(place(rbox(5.7, 0.3, 6.5, 0.1), cream, [s * 9.0, 5.25, -4.6]));
  }
  m.push(place(new THREE.ConeGeometry(7.6, 3.0, 4, 1).rotateY(Math.PI / 4), roof, [0, 8.3, -4.5], [0, 0, 0], [1.25, 1, 0.68]));
  m.push(place(rbox(13.4, 0.36, 7.4, 0.1), cream, [0, 6.85, -4.5]));
  // Portico: columns, entablature, pediment.
  for (let i = 0; i < 6; i++) {
    const x = -4.2 + i * 1.68;
    m.push(place(new THREE.CylinderGeometry(0.32, 0.36, 5.6, 16), white, [x, 3.4, 0.4]));
    m.push(place(rbox(0.86, 0.26, 0.86, 0.05), cream, [x, 0.73, 0.4]));
    m.push(place(rbox(0.86, 0.26, 0.86, 0.05), cream, [x, 6.17, 0.4]));
  }
  m.push(place(rbox(9.6, 0.6, 2.2, 0.08), white, [0, 6.55, -0.2]));
  m.push(place(rbox(9.6, 0.12, 0.12, 0.04), goldC, [0, 6.3, 0.92]));
  const ped = new THREE.Shape();
  ped.moveTo(-4.9, 0);
  ped.lineTo(4.9, 0);
  ped.lineTo(0, 2.1);
  ped.closePath();
  m.push(place(new THREE.ExtrudeGeometry(ped, { depth: 2.0, bevelEnabled: false }), white, [0, 6.85, -1.1]));
  m.push(place(new THREE.CircleGeometry(0.55, 20), goldC, [0, 7.65, 0.92]));
  // Door and windows.
  m.push(place(rbox(1.9, 3.1, 0.2, 0.1), "#8A4B2A", [0, 2.15, -0.95]));
  m.push(place(rbox(2.2, 3.35, 0.14, 0.1), goldC, [0, 2.2, -1.02]));
  for (const row of [2.3, 5.0])
    for (const x of [-5.4, -2.8, 2.8, 5.4]) {
      if (row < 3 && Math.abs(x) < 3) continue;
      m.push(place(rbox(1.3, 1.9, 0.16, 0.08), white, [x, row, -0.95]));
      m.push(place(rbox(1.0, 1.6, 0.14, 0.06), glassC, [x, row, -0.88]));
    }
  for (const s of [-1, 1])
    for (const x of [7.6, 10.4]) {
      m.push(place(rbox(1.2, 1.7, 0.16, 0.08), white, [s * x, 2.6, -1.45]));
      m.push(place(rbox(0.92, 1.4, 0.14, 0.06), glassC, [s * x, 2.6, -1.38]));
    }
  // Balcony over the door.
  m.push(place(rbox(3.4, 0.2, 1.0, 0.06), white, [0, 4.0, -0.5]));
  for (let i = 0; i < 9; i++) m.push(place(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 6), goldC, [-1.6 + i * 0.4, 4.4, -0.05]));
  m.push(place(rbox(3.4, 0.08, 0.1, 0.03), goldC, [0, 4.72, -0.05]));
  // Front steps.
  for (let i = 0; i < 4; i++) m.push(place(rbox(7.0 - i * 0.6, 0.2, 0.7, 0.04), cream, [0, 0.1 + i * 0.2, 2.6 - i * 0.55]));
  const mansion = mergeAll(m);

  // Pool deck, water and a flamingo float (on the plateau in front of the mansion).
  const deck = mergeAll([place(rbox(11.5, 0.2, 5.4, 0.1), "#FFFFFF", [0, 0.1, 0])]);
  const water = rbox(10.2, 0.1, 4.1, 0.05);

  // Gate: stone pillars with gold balls, iron bars with gold tips, hedges on both sides.
  const gate: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    gate.push(place(rbox(0.95, 3.5, 0.95, 0.08), "#F3E6CF", [s * (E.gateHalf + 0.47), 1.75, 0]));
    gate.push(place(rbox(1.15, 0.25, 1.15, 0.05), "#FFFFFF", [s * (E.gateHalf + 0.47), 3.6, 0]));
    gate.push(place(new THREE.SphereGeometry(0.42, 18, 12), goldC, [s * (E.gateHalf + 0.47), 4.08, 0]));
  }
  const bars = 13;
  for (let i = 0; i < bars; i++) {
    const x = -E.gateHalf + 0.15 + ((2 * E.gateHalf - 0.3) * i) / (bars - 1);
    const h = 2.6 + 0.55 * Math.cos((x / E.gateHalf) * (Math.PI / 2));
    gate.push(place(new THREE.CylinderGeometry(0.045, 0.045, h, 6), "#1E1E26", [x, h / 2, 0]));
    gate.push(place(new THREE.ConeGeometry(0.1, 0.26, 6), goldC, [x, h + 0.12, 0]));
  }
  for (const y of [0.5, 1.6]) gate.push(place(rbox(2 * E.gateHalf, 0.09, 0.09, 0.03), "#1E1E26", [0, y, 0]));
  gate.push(place(new THREE.TorusGeometry(0.42, 0.06, 6, 20), goldC, [-0.5, 1.05, 0.02]));
  gate.push(place(new THREE.TorusGeometry(0.42, 0.06, 6, 20), goldC, [0.5, 1.05, 0.02]));
  for (const s of [-1, 1]) gate.push(place(rbox(26, 1.6, 1.1, 0.4), "#2F9C48", [s * (E.gateHalf + 0.95 + 13), 0.8, -0.1]));
  return { hill, mansion, deck, water, gate: mergeAll(gate) };
});

const palmGeos = once(() => {
  const trunk: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) trunk.push(place(new THREE.CylinderGeometry(0.2 - i * 0.01, 0.24 - i * 0.01, 0.62, 10), i % 2 ? "#B98B5A" : "#A87B4C", [0.035 * i * i * 0.5, 0.31 + i * 0.58, 0]));
  const fronds: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = new THREE.SphereGeometry(1, 10, 6);
    leaf.scale(1.55, 0.13, 0.38);
    leaf.translate(1.35, 0, 0);
    leaf.rotateZ(-0.42 - (i % 2) * 0.18);
    leaf.rotateY(a);
    fronds.push(paintGeo(leaf, i % 2 ? "#2FAE4E" : "#3DC45B"));
  }
  const top = mergeAll(fronds);
  top.translate(0.035 * 32 * 0.5 + 0.05, 5.3, 0);
  return { body: mergeAll([...trunk, top]) };
});

const Palm: React.FC<{ position: V3; scale?: number; yaw?: number }> = ({ position, scale = 1, yaw = 0 }) => (
  <mesh geometry={palmGeos().body} material={vertexMat(0.6, false, 0.14)} position={position} scale={scale} rotation={[0, yaw, 0]} castShadow />
);

/** Pink flamingo float for the pool. */
const Flamingo: React.FC<{ t: number }> = ({ t }) => (
  <group position={[2.2, 0.15 + 0.04 * Math.sin(t * 2), 0.4]} rotation={[0, 0.6 + 0.1 * Math.sin(t * 0.8), 0]}>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.55, 0.22, 10, 22]} />
      <meshStandardMaterial color="#FF8FC4" roughness={0.3} emissive="#FF8FC4" emissiveIntensity={0.25} />
    </mesh>
    <mesh position={[0.55, 0.5, 0]} rotation={[0, 0, -0.2]}>
      <cylinderGeometry args={[0.1, 0.13, 0.95, 10]} />
      <meshStandardMaterial color="#FF8FC4" roughness={0.3} emissive="#FF8FC4" emissiveIntensity={0.25} />
    </mesh>
    <mesh position={[0.68, 1.0, 0]}>
      <sphereGeometry args={[0.18, 12, 10]} />
      <meshStandardMaterial color="#FF8FC4" roughness={0.3} emissive="#FF8FC4" emissiveIntensity={0.25} />
    </mesh>
  </group>
);

/**
 * The mansion for sale on its hill: lawn, gate and hedges at z = 0, the "SE VENDE / 40 AÑOS"
 * panel just inside the gate, the hill with the white mansion (columns, pool, palm trees).
 */
export const MansionEstate: React.FC<{ t?: number; signPop?: number }> = ({ t = 0, signPop = 1 }) => {
  const ready = useFontsReady();
  const g = estateGeos();
  const E = ESTATE;
  const lawn = useMemo(() => repeated("lawn", lawnTexture(), 30, 30), []);
  const signS = 0.6 + 0.4 * signPop;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -40]} receiveShadow>
        <planeGeometry args={[220, 120]} />
        <meshStandardMaterial map={lawn} roughness={0.9} emissive="#FFFFFF" emissiveMap={lawn} emissiveIntensity={0.1} />
      </mesh>
      {/* Pavement outside the gate. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 8]}>
        <planeGeometry args={[220, 15]} />
        <meshStandardMaterial color="#E4DCCD" roughness={0.8} emissive="#E4DCCD" emissiveIntensity={0.1} />
      </mesh>
      {/* Path from the gate up the hill. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -7]}>
        <planeGeometry args={[3.2, 14]} />
        <meshStandardMaterial color="#F2E3C6" roughness={0.8} emissive="#F2E3C6" emissiveIntensity={0.12} />
      </mesh>
      <mesh geometry={g.hill} material={toy("#55BE57", { rough: 0.9, glow: 0.1 })} position={E.hill} receiveShadow />
      <group position={[E.hill[0], E.hillTop, E.hill[2]]}>
        <mesh geometry={g.mansion} material={vertexMat(0.5, false, 0.16)} position={[0, 0, -3.2]} castShadow receiveShadow />
        <group position={[0, 0, 4.2]}>
          <mesh geometry={g.deck} material={vertexMat(0.4, false, 0.2)} />
          <mesh geometry={g.water} position={[0, 0.17, 0]}>
            <meshStandardMaterial color="#39D0F0" roughness={0.05} metalness={0.1} emissive="#39D0F0" emissiveIntensity={0.45} />
          </mesh>
          <Flamingo t={t} />
        </group>
        {[
          [-8.5, 5.2],
          [8.5, 5.2],
          [-12.5, 1.5],
          [12.5, 1.5],
          [-14.5, -5],
          [14.5, -5],
        ].map(([x, z], i) => (
          <Palm key={i} position={[x, 0, z]} scale={1.25} yaw={i * 1.3} />
        ))}
      </group>
      {[
        [-6.5, -4],
        [6.8, -6.5],
        [-10, -10],
        [10.5, -12],
      ].map(([x, z], i) => (
        <Palm key={`p${i}`} position={[x, 0, z]} scale={1.1} yaw={i * 2.1} />
      ))}
      <mesh geometry={g.gate} material={vertexMat(0.4, false, 0.14, 0.15)} castShadow />
      {/* The "SE VENDE" panel on two posts. */}
      <group position={[E.sign[0], 0, E.sign[2]]} rotation={[0, -0.12, 0]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * E.signW * 0.36, (E.sign[1] - 0.6) / 2, -0.06]}>
            <boxGeometry args={[0.18, E.sign[1] - 0.6, 0.18]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.5} />
          </mesh>
        ))}
        <group position={[0, E.sign[1], 0]} scale={[signS, signS, 1]}>
          <mesh position={[0, 0, -0.06]}>
            <boxGeometry args={[E.signW + 0.12, E.signW * 0.625 + 0.12, 0.1]} />
            <meshStandardMaterial color="#1B1B24" roughness={0.5} />
          </mesh>
          {ready ? (
            <mesh>
              <planeGeometry args={[E.signW, E.signW * 0.625]} />
              <primitive object={texMat(forSaleTexture(), 0.55)} attach="material" />
            </mesh>
          ) : null}
        </group>
      </group>
      {/* Distant hills. */}
      {[
        [-60, -95, 34],
        [-15, -110, 40],
        [40, -100, 36],
        [85, -90, 30],
      ].map(([x, z, r], i) => (
        <mesh key={i} position={[x, -r * 0.62, z]} scale={[1.4, 1, 1]}>
          <sphereGeometry args={[r, 32, 16]} />
          <meshStandardMaterial color={i % 2 ? "#8FD39A" : "#7FC98C"} roughness={1} emissive={i % 2 ? "#8FD39A" : "#7FC98C"} emissiveIntensity={0.18} />
        </mesh>
      ))}
    </group>
  );
};

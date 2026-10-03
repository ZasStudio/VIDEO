import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BlobShadow } from "../BlobShadow";
import { Nubi, NubiPalette, NubiPose } from "../Nubi";
import { V3, canvasTexture, paintGeo, shadeHex, toy, useFontsReady, vertexMat } from "../inca/kit";
import { mulberry } from "../noise";
import { Glow } from "../thanos/FX";

// The sunny market street of the time short ("¿Qué pasaría si el dinero fuera tiempo de vida?"):
// a row of colourful toy shop fronts (every sign priced in time), bunting, lamps and planters on
// a warm tiled sidewalk; the juice kiosk (awning, fruit pyramid, blender, "JUGOS" menu priced in
// hours, a contactless payment terminal on a stand) and the pizzeria counter (glowing dome oven,
// a big pizza, a huge gooey slice, the "3 DÍAS" price flag); the two vendors; the banknote that
// crumbles into golden sand.
// World units sized for Nubi at size 2 (2 wide, ≈ 2 tall). Ground y = 0. The set faces +z (the
// cameras look towards −z): the shop fronts stand at z = MARKET.facadeZ. `t` is time in seconds.
// Everything is deterministic and builds its geometry once.

const TITLE = "'Luckiest Guy', 'Lilita One', sans-serif";
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (e0: number, e1: number, x: number) => {
  const k = clamp01((x - e0) / (e1 - e0));
  return k * k * (3 - 2 * k);
};
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
/** Lazily built value shared by every instance (static geometry). */
const once = <T,>(make: () => T) => {
  let v: T | undefined;
  return () => (v ??= make());
};
const rbox = (w: number, h: number, d: number, r: number, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) * 0.49));

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

const place = (g: THREE.BufferGeometry, color: string, pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) => {
  paintGeo(g, color);
  g.applyMatrix4(
    new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale)),
  );
  return g;
};

const texMatCache = new Map<THREE.Texture, THREE.MeshStandardMaterial>();
/** Material for a canvas texture (emissive map keeps colours bright). Cached per texture. */
const texMat = (tex: THREE.Texture, rough = 0.6, glow = 0.16, transparent = false, side: THREE.Side = THREE.FrontSide) => {
  let m = texMatCache.get(tex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: rough,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tex,
      emissiveIntensity: glow,
      transparent,
      alphaTest: transparent ? 0.5 : 0,
      side,
    });
    texMatCache.set(tex, m);
  }
  return m;
};

// =======================================================================================
// Layout

/**
 * The market street. Shop fronts at z = facadeZ (x −22..22); the sidewalk runs to the camera.
 * introNubi: Nubi's spot in the intro (facing +z, the camera). juice / pizza: floor centre of
 * the juice kiosk and the pizzeria counter (both open to +z).
 */
export const MARKET = {
  facadeZ: -6,
  introNubi: [0, 0, 1.2] as V3,
  juice: [-10, 0, -2.2] as V3,
  pizza: [10, 0, -2.2] as V3,
};

/** Sunny sky for the CSS background behind the canvas. */
export const MARKET_SKY = "linear-gradient(180deg, #4FB4FF 0%, #7FCBFF 35%, #BDE6FF 70%, #FFF1D6 100%)";

/** Bright, warm midday light. `k` scales it. */
export const MarketLights: React.FC<{ k?: number }> = ({ k = 1 }) => (
  <>
    <hemisphereLight args={["#E6F4FF", "#C99A6A", 1.25 * k]} />
    <directionalLight position={[-6, 12, 9]} intensity={2.3 * k} color="#FFF0D4" />
    <directionalLight position={[8, 4, 6]} intensity={0.75 * k} color="#BFE3FF" />
    <directionalLight position={[0, 6, -10]} intensity={0.6 * k} color="#FFD9A8" />
  </>
);

// =======================================================================================
// Textures

const pavementTexture = () =>
  canvasTexture(
    "tiempo-pavement",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#D9B994";
      ctx.fillRect(0, 0, W, H);
      const rnd = mulberry(4);
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = (i + j) % 2 ? "#F6E4C6" : "#EFD6B0";
          ctx.beginPath();
          ctx.roundRect(i * 128 + 4, j * 128 + 4, 120, 120, 14);
          ctx.fill();
          for (let k = 0; k < 14; k++) {
            ctx.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.18)" : "rgba(160,110,60,0.08)";
            ctx.fillRect(i * 128 + 10 + rnd() * 100, j * 128 + 10 + rnd() * 100, 3 + rnd() * 5, 3 + rnd() * 5);
          }
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

const stripeTexture = (a: string, b: string, scallop: boolean) =>
  canvasTexture(`tiempo-awning|${a}|${b}|${scallop}`, 256, scallop ? 96 : 64, (ctx, W, H) => {
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

/** A tiny hourglass glyph (the time currency). */
const drawHourglass = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) => {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.12;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - s * 0.36, y - s * 0.5);
  ctx.lineTo(x + s * 0.36, y - s * 0.5);
  ctx.moveTo(x - s * 0.36, y + s * 0.5);
  ctx.lineTo(x + s * 0.36, y + s * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - s * 0.28, y - s * 0.42);
  ctx.lineTo(x + s * 0.28, y - s * 0.42);
  ctx.lineTo(x, y);
  ctx.lineTo(x + s * 0.28, y + s * 0.42);
  ctx.lineTo(x - s * 0.28, y + s * 0.42);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const fitFont = (ctx: CanvasRenderingContext2D, text: string, size: number, maxW: number, min = 30) => {
  let s = size;
  ctx.font = `${s}px ${TITLE}`;
  while (ctx.measureText(text).width > maxW && s > min) {
    s -= 4;
    ctx.font = `${s}px ${TITLE}`;
  }
  return s;
};

/** Shop sign: coloured board, white border, the name and its price in time (a yellow pill). */
const signTexture = (name: string, price: string, bg: string) =>
  canvasTexture(`tiempo-sign|${name}|${price}|${bg}`, 768, 192, (ctx, W, H) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 44);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(12, 12, W - 24, H - 24, 34);
    ctx.fill();
    const pillW = price ? 220 : 0;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitFont(ctx, name, 116, W - pillW - 90);
    const cx = (40 + W - pillW - 30) / 2;
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillText(name, cx + 5, H / 2 + 14);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(name, cx, H / 2 + 9);
    if (price) {
      const px = W - pillW - 16;
      ctx.fillStyle = "#FFD23F";
      ctx.beginPath();
      ctx.roundRect(px, 46, pillW - 14, H - 92, 50);
      ctx.fill();
      drawHourglass(ctx, px + 42, H / 2, 46, "#2B1A0A");
      ctx.fillStyle = "#2B1A0A";
      fitFont(ctx, price, 70, pillW - 90);
      ctx.fillText(price, px + 42 + (pillW - 70) / 2, H / 2 + 6);
    }
  });

/** The juice menu: a chalkboard in a wooden frame, prices in hours. */
const menuTexture = () =>
  canvasTexture("tiempo-juice-menu", 640, 400, (ctx, W, H) => {
    ctx.fillStyle = "#B8793F";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 36);
    ctx.fill();
    ctx.fillStyle = "#1F4A3A";
    ctx.beginPath();
    ctx.roundRect(18, 18, W - 36, H - 36, 24);
    ctx.fill();
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.font = `92px ${TITLE}`;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillText("JUGOS", W / 2 + 4, 86);
    ctx.fillStyle = "#FFD23F";
    ctx.fillText("JUGOS", W / 2, 80);
    const rows: [string, string, string][] = [
      ["NARANJA", "6 H", "#FF9A1F"],
      ["FRESA", "6 H", "#FF3E5E"],
      ["AGUA", "2 H", "#5EC2FF"],
    ];
    rows.forEach(([name, price, c], i) => {
      const y = 170 + i * 74;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(66, y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = "left";
      ctx.font = `56px ${TITLE}`;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(name, 100, y + 4);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let d = 360; d < 470; d += 18) ctx.fillRect(d, y + 14, 7, 7);
      ctx.textAlign = "right";
      ctx.fillStyle = "#FFD23F";
      ctx.fillText(price, W - 40, y + 4);
    });
  });

/** Big text on a band (counter fronts). */
const bandTexture = (text: string, bg: string, fg: string, stripe: string) =>
  canvasTexture(`tiempo-band|${text}|${bg}|${fg}|${stripe}`, 1024, 256, (ctx, W, H) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = stripe;
    ctx.fillRect(0, 0, W, 22);
    ctx.fillRect(0, H - 22, W, 22);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitFont(ctx, text, 150, W - 120);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillText(text, W / 2 + 6, H / 2 + 16);
    ctx.fillStyle = fg;
    ctx.fillText(text, W / 2, H / 2 + 10);
  });

const noteTexture = () =>
  canvasTexture("tiempo-banknote", 512, 232, (ctx, W, H) => {
    ctx.fillStyle = "#CFE8B4";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#5E8F4A";
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, W - 24, H - 24);
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, W - 52, H - 52);
    // Guilloche waves.
    ctx.strokeStyle = "rgba(94,143,74,0.35)";
    ctx.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      for (let x = 30; x <= W - 30; x += 6) {
        const y = 60 + k * 22 + Math.sin(x * 0.05 + k) * 8;
        if (x === 30) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // The portrait oval.
    ctx.fillStyle = "#E7F3D8";
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2, 62, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5E8F4A";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = "#6F9E5A";
    ctx.beginPath();
    ctx.arc(W / 2, H / 2 - 16, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(W / 2, H / 2 + 52, 46, 34, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#3F6E30";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `64px ${TITLE}`;
    ctx.fillText("100", 92, 66);
    ctx.fillText("100", W - 92, H - 58);
    ctx.font = `86px ${TITLE}`;
    ctx.fillText("$", W - 92, 74);
    ctx.fillText("$", 92, H - 62);
  });

type ScreenState = "idle" | "tap" | "paid";
/** The payment terminal's screen: contactless prompt, the beep, the charge. */
const screenTexture = (state: ScreenState) =>
  canvasTexture(`tiempo-pos|${state}`, 256, 224, (ctx, W, H) => {
    ctx.fillStyle = state === "tap" ? "#2EE06A" : state === "paid" ? "#FFF4F2" : "#14254A";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (state === "paid") {
      ctx.fillStyle = "#E8222E";
      ctx.font = `112px ${TITLE}`;
      ctx.fillText("−6 H", W / 2, H / 2 - 4);
      ctx.fillStyle = "#7A1A1A";
      ctx.font = `30px ${TITLE}`;
      ctx.fillText("DE TU VIDA", W / 2, H - 30);
      return;
    }
    // Contactless waves.
    const fg = state === "tap" ? "#FFFFFF" : "#7FE0FF";
    ctx.strokeStyle = fg;
    ctx.lineCap = "round";
    ctx.lineWidth = 12;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(W / 2 - 50, H / 2 - 18, 22 + i * 24, -0.75, 0.75);
      ctx.stroke();
    }
    ctx.fillStyle = fg;
    ctx.font = `34px ${TITLE}`;
    ctx.fillText(state === "tap" ? "¡BIP!" : "ACERQUE", W / 2, H - 34);
  });

/** The price flag stuck in the pizza. */
const flagTexture = (text: string) =>
  canvasTexture(`tiempo-flag|${text}`, 512, 256, (ctx, W, H) => {
    ctx.fillStyle = "#E8222E";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 28);
    ctx.fill();
    ctx.fillStyle = "#FFD23F";
    ctx.beginPath();
    ctx.roundRect(14, 14, W - 28, H - 28, 20);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitFont(ctx, text, 150, W - 60);
    ctx.fillStyle = "rgba(120,0,0,0.25)";
    ctx.fillText(text, W / 2 + 6, H / 2 + 18);
    ctx.fillStyle = "#D0101E";
    ctx.fillText(text, W / 2, H / 2 + 12);
  });

const pizzaTopTexture = () =>
  canvasTexture("tiempo-pizza-top", 512, 512, (ctx, W, H) => {
    const cx = W / 2;
    const cy = H / 2;
    ctx.fillStyle = "#E9A24E";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#D9442B";
    ctx.beginPath();
    ctx.arc(cx, cy, 244, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFD45A";
    ctx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      const r = 222 + 10 * Math.sin(a * 9) + 5 * Math.sin(a * 23);
      if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.fill();
    const rnd = mulberry(55);
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 200;
      ctx.fillStyle = rnd() < 0.5 ? "rgba(236,150,44,0.5)" : "rgba(255,244,170,0.75)";
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 14 + rnd() * 18, 8 + rnd() * 10, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Pepperoni in a ring and in the middle (every slice gets some).
    for (let k = 0; k < 16; k++) {
      const a = (k / 8) * Math.PI + (k % 2) * 0.35;
      const r = k % 2 ? 150 : 82;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      ctx.fillStyle = "#B8261E";
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,120,90,0.45)";
      ctx.beginPath();
      ctx.arc(x - 8, y - 8, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "#23A04A";
    for (let k = 0; k < 7; k++) {
      const a = k * 0.9 + 0.4;
      const r = 50 + ((k * 37) % 150);
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 16, 8, a, 0, Math.PI * 2);
      ctx.fill();
    }
  });

// =======================================================================================
// The street: ground, shop fronts, bunting, lamps, planters

type ShopSpec = { name: string; price: string; bg: string; awning: [string, string] };
type BuildingSpec = { x0: number; x1: number; h: number; color: string; shop?: ShopSpec };

const BUILDINGS: BuildingSpec[] = [
  { x0: -23, x1: -18.6, h: 9.5, color: "#A887FF", shop: { name: "RELOJES", price: "1 AÑO", bg: "#5B3FB0", awning: ["#FFFFFF", "#7B5CFF"] } },
  { x0: -18.6, x1: -14.6, h: 8, color: "#FFD54A", shop: { name: "FRUTAS", price: "2 H", bg: "#2FAE4E", awning: ["#FFFFFF", "#2FAE4E"] } },
  { x0: -14.6, x1: -7.6, h: 10.5, color: "#FF8FB8", shop: { name: "FLORES", price: "3 H", bg: "#E8457A", awning: ["#FFFFFF", "#FF4F7B"] } },
  { x0: -7.6, x1: -4.3, h: 8.8, color: "#5EC2FF", shop: { name: "CAFÉ", price: "1 H", bg: "#8A4B2A", awning: ["#FFF3D6", "#C46A2E"] } },
  { x0: -4.3, x1: -1.0, h: 11.5, color: "#FF9A3D", shop: { name: "PAN", price: "30 MIN", bg: "#9A5B2C", awning: ["#FFF3D6", "#E0892F"] } },
  { x0: -1.0, x1: 1.0, h: 9.6, color: "#7FB2FF" },
  { x0: 1.0, x1: 4.3, h: 9, color: "#4FD1B0", shop: { name: "HELADOS", price: "4 H", bg: "#FF5FA2", awning: ["#FFFFFF", "#FF7EB6"] } },
  { x0: 4.3, x1: 7.4, h: 10.5, color: "#FFC93C", shop: { name: "JUGUETES", price: "1 DÍA", bg: "#E3262B", awning: ["#FFFFFF", "#E3262B"] } },
  { x0: 7.4, x1: 13.6, h: 10, color: "#FF6F61", shop: { name: "ZAPATOS", price: "2 DÍAS", bg: "#2B2F58", awning: ["#FFFFFF", "#2F6BFF"] } },
  { x0: 13.6, x1: 18.4, h: 8.5, color: "#7FB2FF", shop: { name: "LIBROS", price: "5 H", bg: "#E0892F", awning: ["#FFFFFF", "#FF8A1F"] } },
  { x0: 18.4, x1: 23, h: 11, color: "#A887FF", shop: { name: "CINE", price: "2 H", bg: "#2B2F58", awning: ["#FFFFFF", "#7B5CFF"] } },
];

const DEPTH = 4;
const FLOOR = 2.1;
const SHOP_TOP = 3.3;

/** All shop-front bodies, windows, cornices and doors (one vertex-coloured mesh). */
const facadeGeometry = once(() => {
  const geos: THREE.BufferGeometry[] = [];
  const z = MARKET.facadeZ;
  BUILDINGS.forEach((b, bi) => {
    const rnd = mulberry(bi * 31 + 5);
    const W = b.x1 - b.x0 - 0.12;
    const cx = (b.x0 + b.x1) / 2;
    geos.push(place(rbox(W, b.h, DEPTH, 0.22), b.color, [cx, b.h / 2, z - DEPTH / 2]));
    geos.push(place(rbox(W + 0.3, 0.42, DEPTH + 0.3, 0.12), "#FFF6E6", [cx, b.h - 0.1, z - DEPTH / 2]));
    geos.push(place(rbox(W + 0.12, 0.5, DEPTH + 0.12, 0.08), shadeHex(b.color, -0.16), [cx, 0.25, z - DEPTH / 2]));
    if (!b.shop) {
      geos.push(place(rbox(1.0, 2.25, 0.12, 0.06), shadeHex(b.color, -0.25), [cx, 1.13, z + 0.06]));
      geos.push(place(new THREE.SphereGeometry(0.07, 10, 8), "#FFD23F", [cx + 0.32, 1.1, z + 0.15]));
      geos.push(place(rbox(1.3, 0.16, 0.5, 0.05), "#FFF6E6", [cx, 2.35, z + 0.2]));
    }
    // Shop front: a big window and a door under the sign band.
    if (b.shop) geos.push(place(rbox(W * 0.56 + 0.2, 2.15, 0.12, 0.08), "#FFF6E6", [cx - W * 0.14, 1.45, z + 0.04]));
    if (b.shop) {
      geos.push(place(rbox(W * 0.56, 1.95, 0.12, 0.06), "#9EDCFF", [cx - W * 0.14, 1.45, z + 0.08]));
      geos.push(place(rbox(0.06, 1.9, 0.06, 0.02), "#FFF6E6", [cx - W * 0.14, 1.45, z + 0.16]));
      geos.push(place(rbox(1.0, 2.25, 0.12, 0.06), shadeHex(b.shop.bg, 0.05), [cx + W * 0.33, 1.13, z + 0.06]));
      geos.push(place(new THREE.SphereGeometry(0.07, 10, 8), "#FFD23F", [cx + W * 0.33 + 0.32, 1.1, z + 0.15]));
      // Goods in the window: a row of coloured blobs on a shelf.
      geos.push(place(rbox(W * 0.5, 0.08, 0.3, 0.03), "#FFFFFF", [cx - W * 0.14, 0.95, z + 0.0]));
    }
    for (let k = 0; k < (b.shop ? 5 : 0); k++) {
      const c = ["#FF4F7B", "#FFD23F", "#2F6BFF", "#FF8A1F", "#1FB35A"][(k + bi) % 5];
      geos.push(place(new THREE.SphereGeometry(0.16, 12, 8), c, [cx - W * 0.14 - W * 0.2 + k * W * 0.1, 1.13, z - 0.02]));
    }
    // Upper floors: windows with sills and some flower boxes.
    const bays = Math.max(2, Math.round(W / 1.6));
    for (let y = SHOP_TOP + 1.25; y + 0.8 < b.h - 0.6; y += FLOOR) {
      for (let k = 0; k < bays; k++) {
        const x = b.x0 + 0.06 + (W / bays) * (k + 0.5);
        geos.push(place(rbox(1.04, 1.32, 0.14, 0.08), "#FFFFFF", [x, y, z + 0.05]));
        geos.push(place(rbox(0.8, 1.08, 0.1, 0.05), rnd() < 0.2 ? "#FFE7A0" : rnd() < 0.5 ? "#A6E0FF" : "#86CBF5", [x, y, z + 0.1]));
        geos.push(place(rbox(0.07, 1.02, 0.04, 0.02), "#FFFFFF", [x, y, z + 0.16]));
        geos.push(place(rbox(1.22, 0.14, 0.28, 0.05), "#FFFFFF", [x, y - 0.73, z + 0.1]));
        if (rnd() < 0.4) {
          geos.push(place(rbox(0.95, 0.24, 0.3, 0.05), "#9A5B2C", [x, y - 0.56, z + 0.3]));
          for (let f = 0; f < 3; f++) {
            const c = ["#FF4F7B", "#FFD23F", "#FF8A3D", "#B57BFF"][(f + k + bi) % 4];
            geos.push(place(new THREE.IcosahedronGeometry(0.13, 0), c, [x - 0.3 + f * 0.3, y - 0.36, z + 0.32]));
            geos.push(place(new THREE.IcosahedronGeometry(0.1, 0), "#2FAE4E", [x - 0.15 + f * 0.3, y - 0.4, z + 0.26]));
          }
        }
      }
    }
  });
  return mergeAll(geos);
});

/** Street furniture: lamps, planters with round trees, benches, flower pots (one mesh). */
const furnitureGeometry = once(() => {
  const geos: THREE.BufferGeometry[] = [];
  const z = MARKET.facadeZ;
  for (const x of [-16.6, -3.3, 3.3, 15.8]) {
    // Lamp post.
    geos.push(place(new THREE.CylinderGeometry(0.09, 0.13, 4.2, 12), "#2B3A55", [x, 2.1, z + 1.6]));
    geos.push(place(new THREE.CylinderGeometry(0.2, 0.26, 0.3, 14), "#2B3A55", [x, 0.15, z + 1.6]));
    geos.push(place(new THREE.SphereGeometry(0.32, 16, 12), "#FFF4C2", [x, 4.45, z + 1.6]));
    geos.push(place(new THREE.CylinderGeometry(0.36, 0.2, 0.16, 14), "#2B3A55", [x, 4.78, z + 1.6]));
  }
  for (const [x, seed] of [
    [-13.0, 1],
    [-6.3, 2],
    [6.0, 3],
    [20.4, 4],
  ]) {
    const rnd = mulberry(seed * 13);
    geos.push(place(rbox(1.1, 0.7, 1.1, 0.12), "#E07A4F", [x, 0.35, z + 0.9]));
    geos.push(place(new THREE.CylinderGeometry(0.1, 0.13, 1.4, 8), "#7A4B2A", [x, 1.3, z + 0.9]));
    for (let k = 0; k < 4; k++) {
      const r = 0.55 + rnd() * 0.25;
      geos.push(place(new THREE.IcosahedronGeometry(1, 1), k % 2 ? "#2FAE4E" : "#4CC75E", [x + (rnd() - 0.5) * 0.7, 2.15 + rnd() * 0.5, z + 0.9 + (rnd() - 0.5) * 0.5], [k, k * 2, 0], [r, r * 0.9, r]));
    }
  }
  // Flower pots along the shop fronts.
  const rnd = mulberry(77);
  for (let x = -21; x < 22; x += 2.7) {
    const px = x + rnd() * 0.6;
    if (Math.abs(px - MARKET.juice[0]) < 2.2 || Math.abs(px - MARKET.pizza[0]) < 2.8) continue;
    geos.push(place(new THREE.CylinderGeometry(0.26, 0.2, 0.42, 14), ["#E07A4F", "#2F6BFF", "#FFD23F"][Math.floor(rnd() * 3)], [px, 0.21, z + 0.45]));
    for (let k = 0; k < 4; k++) {
      geos.push(place(new THREE.IcosahedronGeometry(0.16, 0), k % 2 ? "#2FAE4E" : ["#FF4F7B", "#FFD23F", "#B57BFF"][k % 3], [px + (k - 1.5) * 0.12, 0.52 + (k % 2) * 0.08, z + 0.45 + ((k * 7) % 3) * 0.05]));
    }
  }
  return mergeAll(geos);
});

/** Bunting: strings of triangular flags hanging along the shop fronts (one mesh). */
const buntingGeometry = once(() => {
  const geos: THREE.BufferGeometry[] = [];
  const cols = ["#FF4F7B", "#FFD23F", "#2F6BFF", "#1FB35A", "#FF8A1F", "#B57BFF"];
  const z = MARKET.facadeZ + 1.3;
  const tri = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([-0.17, 0, 0, 0.17, 0, 0, 0, -0.34, 0.0, 0.17, 0, 0, -0.17, 0, 0, 0, -0.34, 0.0], 3));
    g.computeVertexNormals();
    return g;
  };
  const spans: [number, number][] = [
    [-22, -16.6],
    [-16.6, -3.3],
    [-3.3, 3.3],
    [3.3, 15.8],
    [15.8, 22],
  ];
  spans.forEach(([a, b], si) => {
    const n = Math.round((b - a) / 0.42);
    const y0 = 4.6;
    const sag = 0.55;
    let prev: THREE.Vector3 | null = null;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = lerp(a, b, u);
      const y = y0 - sag * 4 * u * (1 - u);
      const p = new THREE.Vector3(x, y, z);
      if (prev) {
        const d = p.clone().sub(prev);
        const len = d.length();
        const seg = new THREE.CylinderGeometry(0.015, 0.015, len, 4).rotateZ(Math.atan2(d.y, d.x) - Math.PI / 2);
        geos.push(place(seg, "#FFFFFF", [(p.x + prev.x) / 2, (p.y + prev.y) / 2, z]));
      }
      if (i > 0 && i < n) geos.push(place(tri(), cols[(i + si * 2) % cols.length], [x, y, z]));
      prev = p;
    }
  });
  return mergeAll(geos);
});

const ShopSigns: React.FC = () => {
  const ready = useFontsReady();
  const z = MARKET.facadeZ;
  return (
    <group>
      {BUILDINGS.map((b, i) => {
        if (!b.shop) return null;
        const W = b.x1 - b.x0 - 0.12;
        const cx = (b.x0 + b.x1) / 2;
        const aw = W * 0.62;
        return (
          <group key={i}>
            {ready ? (
              <mesh position={[cx, 3.0, z + 0.12]}>
                <planeGeometry args={[Math.min(3.6, W * 0.8), Math.min(3.6, W * 0.8) / 4]} />
                <primitive object={texMat(signTexture(b.shop.name, b.shop.price, b.shop.bg), 0.5, 0.3)} attach="material" />
              </mesh>
            ) : null}
            <group position={[cx - W * 0.14, 2.62, z + 0.05]} rotation={[0.45, 0, 0]}>
              <mesh position={[0, 0, 0.55]}>
                <boxGeometry args={[aw, 0.05, 1.1]} />
                <primitive object={texMat(stripeTexture(b.shop.awning[0], b.shop.awning[1], false), 0.6, 0.2)} attach="material" />
              </mesh>
              <mesh position={[0, -0.15, 1.1]} rotation={[-0.45, 0, 0]}>
                <planeGeometry args={[aw, 0.32]} />
                <primitive object={texMat(stripeTexture(b.shop.awning[0], b.shop.awning[1], true), 0.6, 0.2, true, THREE.DoubleSide)} attach="material" />
              </mesh>
            </group>
          </group>
        );
      })}
    </group>
  );
};

/**
 * The market street: a warm tiled sidewalk, the row of shop fronts (each sign priced in time),
 * bunting along the fronts, lamps, round trees in planters and flower pots. Lamp globes glow.
 */
export const MarketStreet: React.FC<{ t?: number }> = ({ t = 0 }) => {
  const ground = useMemo(() => {
    const tex = pavementTexture().clone();
    tex.repeat.set(70 / 1.6, 30 / 1.6);
    tex.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, emissive: new THREE.Color("#ffffff"), emissiveMap: tex, emissiveIntensity: 0.12 });
  }, []);
  const sway = Math.sin(t * 1.3) * 0.02;
  return (
    <group>
      <mesh position={[0, 0, 4]} rotation={[-Math.PI / 2, 0, 0]} material={ground}>
        <planeGeometry args={[70, 30]} />
      </mesh>
      <mesh geometry={facadeGeometry()} material={vertexMat(0.5, false, 0.16)} />
      <mesh geometry={furnitureGeometry()} material={vertexMat(0.55, false, 0.15)} />
      <group rotation={[sway, 0, 0]} position={[0, 0, 0]}>
        <mesh geometry={buntingGeometry()} material={vertexMat(0.6, false, 0.22)} />
      </group>
      <ShopSigns />
      {/* Back rows of taller buildings for depth. */}
      <BackRow />
    </group>
  );
};

const backRowGeometry = once(() => {
  const geos: THREE.BufferGeometry[] = [];
  const rnd = mulberry(9);
  const cols = ["#BFD8FF", "#FFD6E8", "#FFE8B0", "#C8F0E0", "#E2D4FF"];
  for (let x = -30; x < 30; ) {
    const w = 4 + rnd() * 3;
    const h = 13 + rnd() * 8;
    const c = cols[Math.floor(rnd() * cols.length)];
    geos.push(place(rbox(w - 0.3, h, 3, 0.3), c, [x + w / 2, h / 2, MARKET.facadeZ - 9]));
    for (let y = 2; y < h - 1.5; y += 2.2) {
      for (let k = 0; k < Math.floor(w / 1.6); k++) {
        geos.push(place(rbox(0.8, 1.1, 0.1, 0.05), shadeHex(c, -0.18), [x + 0.9 + k * 1.6, y, MARKET.facadeZ - 7.45]));
      }
    }
    x += w;
  }
  return mergeAll(geos);
});

const BackRow: React.FC = () => <mesh geometry={backRowGeometry()} material={vertexMat(0.7, false, 0.3)} />;

// =======================================================================================
// Characters: the juice vendor and the pizza chef

/** The juice vendor: an orange Nubi-shaped toy with a blue cap and a white apron. */
export const VENDOR_PALETTE: NubiPalette = { body: "#FF9A3D", fins: "#FFAA55", legs: "#E07F2A" };
/** The pizza chef: a blue Nubi-shaped toy with a tall white hat, a white apron and a red scarf. */
export const CHEF_PALETTE: NubiPalette = { body: "#4E7BEA", fins: "#5F8BF2", legs: "#3F67CC" };
export const VENDOR_SIZE = 2.1;

const gearGeos = once(() => ({
  capCrown: new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  capBill: rbox(5.4, 0.32, 3.1, 0.15),
  button: new THREE.SphereGeometry(0.5, 12, 8),
  apron: rbox(8.6, 2.6, 0.4, 0.18),
  bib: rbox(1.2, 5.0, 0.36, 0.16),
  pocket: rbox(3.2, 1.2, 0.3, 0.14),
  hatBand: new THREE.CylinderGeometry(3.7, 3.7, 1.8, 28),
  puff: new THREE.SphereGeometry(1, 18, 12),
  scarf: rbox(10.6, 1.0, 9.4, 0.48),
  knot: new THREE.ConeGeometry(1.1, 2.0, 4).rotateX(Math.PI).rotateY(Math.PI / 4),
}));

const VendorGear: React.FC<{ chef?: boolean }> = ({ chef = false }) => {
  const g = gearGeos();
  const white = toy("#FFFFFF", { rough: 0.6, glow: 0.2 });
  const cap = toy("#2F6BFF", { rough: 0.5, glow: 0.16 });
  return (
    <group>
      {/* Apron: a panel low on the front with two straps up the sides of the face. */}
      <mesh geometry={g.apron} material={white} position={[0, 3.55, 4.55]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={g.bib} material={white} position={[s * 4.25, 6.6, 4.5]} />
      ))}
      <mesh geometry={g.pocket} material={toy(chef ? "#E3262B" : "#1FB35A", { rough: 0.55, glow: 0.18 })} position={[-1.8, 3.3, 4.8]} />
      {chef ? (
        <group>
          <mesh geometry={g.hatBand} material={white} position={[0, 10.75, -0.2]} />
          {[
            [0, 13.0, -0.2, 2.6],
            [-1.9, 12.3, -0.2, 2.0],
            [1.9, 12.3, -0.2, 2.0],
            [0, 12.3, 1.7, 2.0],
            [0, 12.3, -2.0, 2.0],
          ].map(([x, y, z, r], i) => (
            <mesh key={i} geometry={g.puff} material={white} position={[x, y, z]} scale={r} />
          ))}
          <mesh geometry={g.scarf} material={toy("#E3262B", { rough: 0.65, glow: 0.18 })} position={[0, 2.9, 0]} />
          <mesh geometry={g.knot} material={toy("#E3262B", { rough: 0.65, glow: 0.18 })} position={[2.6, 2.0, 4.7]} rotation={[0.2, 0, 0.2]} />
        </group>
      ) : (
        <group>
          <mesh geometry={g.capCrown} material={cap} position={[0, 9.55, -0.1]} scale={[4.7, 2.1, 4.4]} />
          <mesh geometry={g.capBill} material={cap} position={[0, 9.75, 4.75]} rotation={[0.12, 0, 0]} />
          <mesh geometry={g.button} material={white} position={[0, 11.65, -0.1]} />
        </group>
      )}
    </group>
  );
};

/**
 * A vendor (the juice man, or the pizza chef with `chef`): a Nubi-shaped toy in its own colours
 * with its gear. `holdR` / `holdL` are held at the fin tips (model units).
 */
export const Vendor: React.FC<{
  chef?: boolean;
  position?: V3;
  rotationY?: number;
  pose?: NubiPose;
  holdR?: React.ReactNode;
  holdL?: React.ReactNode;
  shadow?: boolean;
}> = ({ chef = false, position = [0, 0, 0], rotationY = 0, pose = {}, holdR, holdL, shadow = true }) => (
  <Nubi size={VENDOR_SIZE} position={position} rotationY={rotationY} pose={pose} palette={chef ? CHEF_PALETTE : VENDOR_PALETTE} holdR={holdR} holdL={holdL} shadow={shadow}>
    <VendorGear chef={chef} />
  </Nubi>
);

// =======================================================================================
// The juice kiosk

/** Kiosk size: counter width / depth / height, the vendor's platform height (hidden). */
export const KIOSK = { w: 2.7, d: 0.95, h: 1.0, platform: 0.32 };
/** Where the vendor stands (kiosk space, on his platform). */
export const KIOSK_VENDOR: V3 = [0.45, KIOSK.platform, -0.75];
/** The payment terminal stand (kiosk space): its base, and its yaw (faces the customer). */
export const KIOSK_TERMINAL: V3 = [-1.72, 0, 0.82];
export const KIOSK_TERMINAL_YAW = 0.55;
/** Top of the terminal head (kiosk space), where a fin taps. */
export const TERMINAL_TOP_Y = 1.18;

const fruitGeometry = once(() => {
  const geos: THREE.BufferGeometry[] = [];
  const r = 0.11;
  // Orange pyramid (4 × 3 base, 3 × 2, 2 × 1).
  const layers: [number, number][] = [
    [4, 3],
    [3, 2],
    [2, 1],
  ];
  layers.forEach(([nx, nz], li) => {
    for (let i = 0; i < nx; i++) {
      for (let k = 0; k < nz; k++) {
        const x = (i - (nx - 1) / 2) * r * 2;
        const z = (k - (nz - 1) / 2) * r * 2;
        geos.push(place(new THREE.SphereGeometry(r, 14, 10), "#FF9A1F", [x, r + li * r * 1.55, z]));
        geos.push(place(new THREE.SphereGeometry(0.025, 6, 4), "#2FAE4E", [x, r * 2 + li * r * 1.55, z]));
      }
    }
  });
  // Strawberries and limes in a tray next to it.
  geos.push(place(rbox(0.62, 0.08, 0.42, 0.03), "#C98B4E", [0.72, 0.04, 0]));
  for (let i = 0; i < 6; i++) {
    const x = 0.52 + (i % 3) * 0.2;
    const z = -0.1 + Math.floor(i / 3) * 0.2;
    if (i % 2) geos.push(place(new THREE.SphereGeometry(0.085, 12, 8), "#7ED957", [x, 0.15, z]));
    else {
      geos.push(place(new THREE.ConeGeometry(0.09, 0.17, 10).rotateX(Math.PI), "#FF3E5E", [x, 0.17, z]));
      geos.push(place(new THREE.ConeGeometry(0.07, 0.05, 6), "#2FAE4E", [x, 0.27, z]));
    }
  }
  return mergeAll(geos);
});

/** Display cups on the counter (orange, strawberry, water). */
const cupRowGeometry = once(() => {
  const geos: THREE.BufferGeometry[] = [];
  ["#FF9A1F", "#FF3E5E", "#7FD3FF"].forEach((c, i) => {
    const x = i * 0.24;
    geos.push(place(new THREE.CylinderGeometry(0.085, 0.065, 0.26, 16), c, [x, 0.13, 0]));
    geos.push(place(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 16), "#FFFFFF", [x, 0.27, 0]));
    geos.push(place(new THREE.CylinderGeometry(0.014, 0.014, 0.3, 6), "#FF4F7B", [x + 0.03, 0.38, 0], [0, 0, -0.25]));
  });
  return mergeAll(geos);
});

const blenderGeometry = once(() => {
  const geos: THREE.BufferGeometry[] = [];
  geos.push(place(rbox(0.3, 0.22, 0.3, 0.06), "#2B2F38", [0, 0.11, 0]));
  geos.push(place(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 12).rotateX(Math.PI / 2), "#FF4F7B", [0, 0.11, 0.155]));
  geos.push(place(new THREE.CylinderGeometry(0.15, 0.11, 0.42, 18), "#FFB347", [0, 0.43, 0]));
  geos.push(place(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 18), "#2B2F38", [0, 0.66, 0]));
  geos.push(place(rbox(0.05, 0.22, 0.08, 0.02), "#2B2F38", [0.17, 0.45, 0]));
  return mergeAll(geos);
});

/**
 * The juice kiosk (origin: floor centre, open to +z): a white counter with an orange band and
 * the "JUGOS" menu on its front, an orange pyramid with strawberries and limes, display cups,
 * a blender, a striped awning on four poles, and the contactless terminal on its stand at the
 * left front corner (KIOSK_TERMINAL). `screen` picks the terminal screen, `beep` 0..1 flashes it.
 */
export const JuiceKiosk: React.FC<{ t?: number; screen?: ScreenState; beep?: number; blend?: number }> = ({ t = 0, screen = "idle", beep = 0, blend = 0 }) => {
  const ready = useFontsReady();
  const g = useMemo(
    () => ({
      body: rbox(KIOSK.w, KIOSK.h, KIOSK.d, 0.08),
      top: rbox(KIOSK.w + 0.16, 0.08, KIOSK.d + 0.16, 0.03),
      back: rbox(KIOSK.w + 0.2, 3.1, 0.12, 0.05),
      pole: new THREE.CylinderGeometry(0.05, 0.05, 2.9, 10),
      roof: rbox(KIOSK.w + 0.5, 0.06, 2.0, 0.03),
    }),
    [],
  );
  const W = KIOSK.w;
  const wob = Math.sin(t * 40) * 0.012 * blend;
  return (
    <group>
      <group position={[0, 0, 0]}>
        <BlobShadow radius={1.9} opacity={0.28} stretch={0.5} />
      </group>
      {/* Back panel and posts. */}
      <mesh geometry={g.back} material={toy("#FFF3D6", { rough: 0.6, glow: 0.16 })} position={[0, 1.55, -1.45]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={g.pole} material={toy("#FFFFFF", { rough: 0.4 })} position={[s * (W / 2 + 0.12), 1.45, 0.62]} />
          <mesh geometry={g.pole} material={toy("#FFFFFF", { rough: 0.4 })} position={[s * (W / 2 + 0.12), 1.45, -1.4]} />
        </group>
      ))}
      {/* Counter. */}
      <mesh geometry={g.body} material={toy("#FFFFFF", { rough: 0.5, glow: 0.18 })} position={[0, KIOSK.h / 2, 0]} />
      <mesh geometry={g.top} material={toy("#E9B872", { rough: 0.6, glow: 0.15 })} position={[0, KIOSK.h + 0.04, 0]} />
      <mesh position={[0, KIOSK.h - 0.1, KIOSK.d / 2 + 0.006]}>
        <planeGeometry args={[W, 0.16]} />
        <primitive object={toy("#FF8A1F", { rough: 0.5, glow: 0.2 })} attach="material" />
      </mesh>
      {ready ? (
        <mesh position={[0.42, 0.47, KIOSK.d / 2 + 0.012]}>
          <planeGeometry args={[1.62, 1.01]} />
          <primitive object={texMat(menuTexture(), 0.6, 0.28)} attach="material" />
        </mesh>
      ) : null}
      {/* Stripes on the counter's left front. */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.95 + i * 0.22, 0.47, KIOSK.d / 2 + 0.008]}>
          <planeGeometry args={[0.1, 0.72]} />
          <primitive object={toy(["#FF4F7B", "#FFD23F", "#1FB35A"][i], { rough: 0.5, glow: 0.2 })} attach="material" />
        </mesh>
      ))}
      {/* On the counter. */}
      <mesh geometry={fruitGeometry()} material={vertexMat(0.45, false, 0.2)} position={[-0.9, KIOSK.h + 0.08, -0.05]} />
      <mesh geometry={cupRowGeometry()} material={vertexMat(0.35, false, 0.22)} position={[0.25, KIOSK.h + 0.08, 0.12]} />
      <group position={[1.05, KIOSK.h + 0.08, -0.1]} rotation={[wob, 0, wob]}>
        <mesh geometry={blenderGeometry()} material={vertexMat(0.3, false, 0.22)} />
      </group>
      {/* Awning: a striped roof sloping to the front, a scalloped valance. */}
      <group position={[0, 2.95, -0.4]} rotation={[0.2, 0, 0]}>
        <mesh geometry={g.roof}>
          <primitive object={texMat(stripeTexture("#FFFFFF", "#FF8A1F", false), 0.6, 0.2)} attach="material" />
        </mesh>
        <mesh position={[0, -0.17, 1.0]} rotation={[-0.2, 0, 0]}>
          <planeGeometry args={[W + 0.5, 0.36]} />
          <primitive object={texMat(stripeTexture("#FFFFFF", "#FF8A1F", true), 0.6, 0.2, true, THREE.DoubleSide)} attach="material" />
        </mesh>
      </group>
      <group position={KIOSK_TERMINAL} rotation={[0, KIOSK_TERMINAL_YAW, 0]}>
        <PayTerminal screen={screen} beep={beep} />
      </group>
    </group>
  );
};

/**
 * The contactless payment terminal on a stand (origin: the stand's base; the screen faces +z,
 * tilted up). Its top is at TERMINAL_TOP_Y. `beep` 0..1 flashes a green glow.
 */
export const PayTerminal: React.FC<{ screen?: ScreenState; beep?: number }> = ({ screen = "idle", beep = 0 }) => {
  const ready = useFontsReady();
  const g = useMemo(
    () => ({
      pole: new THREE.CylinderGeometry(0.035, 0.035, 0.95, 10),
      base: new THREE.CylinderGeometry(0.22, 0.26, 0.05, 20),
      head: rbox(0.36, 0.5, 0.09, 0.05),
      key: rbox(0.06, 0.04, 0.02, 0.01),
    }),
    [],
  );
  return (
    <group>
      <BlobShadow radius={0.3} opacity={0.3} />
      <mesh geometry={g.base} material={toy("#2B3A55", { rough: 0.4 })} position={[0, 0.025, 0]} />
      <mesh geometry={g.pole} material={toy("#C9D2DC", { rough: 0.3, metal: 0.5 })} position={[0, 0.5, 0]} />
      <group position={[0, 1.0, 0]} rotation={[-0.55, 0, 0]}>
        <mesh geometry={g.head} material={toy("#2B2F38", { rough: 0.35, glow: 0.1 })} position={[0, 0.12, 0]} />
        {ready ? (
          <mesh position={[0, 0.22, 0.047]}>
            <planeGeometry args={[0.3, 0.26]} />
            <primitive object={texMat(screenTexture(screen), 0.3, screen === "idle" ? 0.7 : 0.9)} attach="material" />
          </mesh>
        ) : null}
        {Array.from({ length: 9 }).map((_, i) => (
          <mesh key={i} geometry={g.key} material={toy(i === 8 ? "#2EE06A" : "#C9D2DC", { rough: 0.4, glow: 0.2 })} position={[-0.08 + (i % 3) * 0.08, 0.02 - Math.floor(i / 3) * 0.05, 0.05]} />
        ))}
        {beep > 0.01 ? <Glow color="#7CFF9E" size={0.9 * (0.6 + 0.4 * beep)} opacity={beep} position={[0, 0.22, 0.12]} /> : null}
      </group>
    </group>
  );
};

/**
 * A take-away juice cup (origin: the bottom centre; ≈ 0.42 tall with the straw): clear cup,
 * orange juice at `fill` 0..1, a dome lid and a striped bendy straw.
 */
export const JuiceCup: React.FC<{ fill?: number; t?: number }> = ({ fill = 0.9, t = 0 }) => {
  const g = useMemo(
    () => ({
      cup: new THREE.CylinderGeometry(0.11, 0.085, 0.3, 20, 1, true),
      juice: new THREE.CylinderGeometry(0.1, 0.08, 1, 20),
      bottom: new THREE.CircleGeometry(0.085, 20).rotateX(-Math.PI / 2),
      lid: new THREE.SphereGeometry(0.115, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2.6),
      straw: new THREE.CylinderGeometry(0.014, 0.014, 0.34, 8),
      tip: new THREE.CylinderGeometry(0.014, 0.014, 0.1, 8),
      sleeve: new THREE.CylinderGeometry(0.106, 0.092, 0.12, 20, 1, true),
      slice: new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16, 1, false, 0, Math.PI),
    }),
    [],
  );
  const glass = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#E8F6FF", roughness: 0.1, transparent: true, opacity: 0.45, side: THREE.DoubleSide, emissive: new THREE.Color("#E8F6FF"), emissiveIntensity: 0.2, depthWrite: false }),
    [],
  );
  const f = clamp01(fill);
  const h = 0.28 * f;
  const slosh = Math.sin(t * 9) * 0.01;
  return (
    <group>
      {h > 0.004 ? <mesh geometry={g.juice} material={toy("#FF9A1F", { rough: 0.25, glow: 0.3 })} position={[0, 0.01 + h / 2, 0]} scale={[1, h, 1]} rotation={[slosh, 0, 0]} /> : null}
      <mesh geometry={g.bottom} material={glass} position={[0, 0.002, 0]} />
      <mesh geometry={g.cup} material={glass} position={[0, 0.15, 0]} />
      <mesh geometry={g.sleeve} material={toy("#1FB35A", { rough: 0.5, glow: 0.2, side: THREE.DoubleSide })} position={[0, 0.13, 0]} />
      <mesh geometry={g.lid} material={glass} position={[0, 0.29, 0]} />
      <mesh geometry={g.slice} material={toy("#FFB21A", { rough: 0.4, glow: 0.25 })} position={[0.1, 0.28, 0]} rotation={[Math.PI / 2, 0, 0.3]} />
      <mesh geometry={g.straw} material={toy("#FF4F7B", { rough: 0.35, glow: 0.2 })} position={[-0.02, 0.4, 0]} rotation={[0, 0, 0.12]} />
      <mesh geometry={g.tip} material={toy("#FF4F7B", { rough: 0.35, glow: 0.2 })} position={[-0.075, 0.6, 0]} rotation={[0, 0, 0.9]} />
    </group>
  );
};

// =======================================================================================
// The pizzeria

/** Pizzeria counter size and the chef's spot (counter space, on a hidden platform). */
export const PIZZERIA = { w: 3.0, d: 1.0, h: 1.0, platform: 0.3 };
export const PIZZERIA_CHEF: V3 = [0.55, PIZZERIA.platform, -0.85];
/** Where the big pizza sits on the counter (counter space, its centre on the board). */
export const PIZZERIA_PIZZA: V3 = [-0.45, PIZZERIA.h + 0.07, 0.05];
export const PIZZA_R = 0.62;

/**
 * The pizzeria counter (origin: floor centre, open to +z): a red counter with a "PIZZERÍA"
 * band, a wooden board, a brick dome oven behind (its mouth glows and flickers with `t`, `fire`
 * 0..1) with a chimney, a back wall with a shelf of jars and a green-white-red awning. The big
 * pizza is drawn separately (<BigPizza> at PIZZERIA_PIZZA).
 */
export const Pizzeria: React.FC<{ t?: number; fire?: number }> = ({ t = 0, fire = 1 }) => {
  const ready = useFontsReady();
  const g = useMemo(
    () => ({
      body: rbox(PIZZERIA.w, PIZZERIA.h, PIZZERIA.d, 0.08),
      top: rbox(PIZZERIA.w + 0.16, 0.08, PIZZERIA.d + 0.16, 0.03),
      board: new THREE.CylinderGeometry(PIZZA_R + 0.12, PIZZA_R + 0.12, 0.05, 40),
      handle: rbox(0.5, 0.05, 0.16, 0.02),
      base: rbox(1.9, 0.9, 1.6, 0.1),
      dome: new THREE.SphereGeometry(1.0, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      mouth: new THREE.CircleGeometry(0.42, 28, 0, Math.PI),
      mouthIn: new THREE.CircleGeometry(0.34, 28, 0, Math.PI),
      arch: new THREE.TorusGeometry(0.44, 0.07, 8, 28, Math.PI),
      chimney: new THREE.CylinderGeometry(0.14, 0.17, 1.0, 14),
      wall: rbox(PIZZERIA.w + 1.6, 3.2, 0.14, 0.05),
      shelf: rbox(1.4, 0.06, 0.3, 0.02),
      jar: new THREE.CylinderGeometry(0.09, 0.09, 0.24, 12),
      roof: rbox(PIZZERIA.w + 1.9, 0.06, 2.4, 0.03),
    }),
    [],
  );
  const flick = 0.82 + 0.1 * Math.sin(t * 11.3) + 0.08 * Math.sin(t * 23.7 + 1.3);
  const brick = toy("#C8643A", { rough: 0.8, glow: 0.14 });
  return (
    <group>
      <BlobShadow radius={2.0} opacity={0.26} stretch={0.5} />
      {/* Back wall with a shelf and jars. */}
      <mesh geometry={g.wall} material={toy("#FFF3D6", { rough: 0.6, glow: 0.16 })} position={[0, 1.6, -2.45]} />
      <mesh geometry={g.shelf} material={toy("#B8793F", { rough: 0.6 })} position={[-1.3, 2.05, -2.3]} />
      {["#FF4F7B", "#FFD23F", "#1FB35A", "#E3262B", "#FF8A1F"].map((c, i) => (
        <mesh key={i} geometry={g.jar} material={toy(c, { rough: 0.4, glow: 0.2 })} position={[-1.85 + i * 0.27, 2.2, -2.3]} />
      ))}
      {/* The dome oven behind, right. */}
      <group position={[0.95, 0, -1.6]}>
        <mesh geometry={g.base} material={toy("#9A5B2C", { rough: 0.7 })} position={[0, 0.45, 0]} />
        <mesh geometry={g.dome} material={brick} position={[0, 0.9, 0]} scale={[0.95, 1.0, 0.8]} />
        <mesh geometry={g.chimney} material={toy("#7A4B2A", { rough: 0.6 })} position={[0.3, 2.1, -0.25]} />
        <group position={[0, 0.95, 0.8]}>
          <mesh geometry={g.arch} material={toy("#E9B872", { rough: 0.6 })} />
          <mesh geometry={g.mouth} material={toy("#3A1408", { rough: 0.9, glow: 0 })} position={[0, 0, -0.01]} />
          <mesh geometry={g.mouthIn} position={[0, 0, 0.005]}>
            <meshBasicMaterial color={new THREE.Color("#FF8A1F").multiplyScalar(0.6 + 0.6 * fire * flick)} toneMapped={false} />
          </mesh>
          <Glow color="#FF9A3C" size={1.6 * fire} opacity={0.85 * fire * flick} position={[0, 0.15, 0.1]} />
        </group>
      </group>
      {/* Counter. */}
      <mesh geometry={g.body} material={toy("#E3262B", { rough: 0.5, glow: 0.18 })} position={[0, PIZZERIA.h / 2, 0]} />
      <mesh geometry={g.top} material={toy("#F4F1EA", { rough: 0.35, glow: 0.18 })} position={[0, PIZZERIA.h + 0.04, 0]} />
      {ready ? (
        <mesh position={[0, 0.5, PIZZERIA.d / 2 + 0.01]}>
          <planeGeometry args={[PIZZERIA.w - 0.2, (PIZZERIA.w - 0.2) / 4]} />
          <primitive object={texMat(bandTexture("PIZZERÍA", "#FFFFFF", "#E3262B", "#1FA35B"), 0.5, 0.25)} attach="material" />
        </mesh>
      ) : null}
      <mesh geometry={g.board} material={toy("#C98B4E", { rough: 0.7 })} position={[PIZZERIA_PIZZA[0], PIZZERIA.h + 0.105, PIZZERIA_PIZZA[2]]} />
      <mesh geometry={g.handle} material={toy("#C98B4E", { rough: 0.7 })} position={[PIZZERIA_PIZZA[0] - PIZZA_R - 0.35, PIZZERIA.h + 0.105, PIZZERIA_PIZZA[2]]} />
      {/* Awning: green, white and red. */}
      <group position={[0, 3.25, -1.1]} rotation={[0.16, 0, 0]}>
        <mesh geometry={g.roof}>
          <primitive object={texMat(stripeTexture("#1FA35B", "#FFFFFF", false), 0.6, 0.2)} attach="material" />
        </mesh>
        <mesh position={[0, -0.17, 1.2]} rotation={[-0.16, 0, 0]}>
          <planeGeometry args={[PIZZERIA.w + 1.9, 0.36]} />
          <primitive object={texMat(stripeTexture("#E3262B", "#FFFFFF", true), 0.6, 0.2, true, THREE.DoubleSide)} attach="material" />
        </mesh>
      </group>
    </group>
  );
};

/** Slice wedge angle (radians). */
const SLICE_ANGLE = Math.PI / 3;

/** Bends a flat slice geometry (tip at the origin, crust at radius R along +z): the tip droops. */
const droopSlice = (geo: THREE.BufferGeometry, R: number, droop: number) => {
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getZ(i));
    const k = 1 - Math.min(1, r / R);
    p.setY(i, p.getY(i) - droop * k * k);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
};

/** A flat wedge of the pizza: tip at the origin, crust arc at radius R towards +z, top at y ≈ 0. */
const wedgeGeos = (R: number, droop: number) => {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  const a0 = Math.PI / 2 - SLICE_ANGLE / 2;
  shape.absarc(0, 0, R, a0, a0 + SLICE_ANGLE, false);
  shape.lineTo(0, 0);
  const dough = new THREE.ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 16 });
  // Shape is in x/y: lay it flat (y → −z... use +z so the crust is at +z), top face at y = 0.
  dough.rotateX(Math.PI / 2);
  // Pointing −y before the turn so it points +z after (uv: that part of the whole pizza).
  const top = new THREE.CircleGeometry(R * 0.93, 24, -Math.PI / 2 - SLICE_ANGLE / 2, SLICE_ANGLE);
  top.rotateX(-Math.PI / 2);
  top.translate(0, 0.012, 0);
  const crust = new THREE.TorusGeometry(R * 0.96, 0.055, 10, 18, SLICE_ANGLE);
  crust.rotateZ(a0);
  crust.rotateX(Math.PI / 2);
  crust.translate(0, -0.02, 0);
  [dough, top, crust].forEach((gg) => droopSlice(gg, R, droop));
  return { dough, top, crust };
};

/**
 * The big pizza on its board (origin: its centre on the board): sauce, cheese, pepperoni and
 * basil, with one wedge missing (on the +z side: the slice the chef holds) unless `whole`.
 */
export const BigPizza: React.FC<{ whole?: boolean }> = ({ whole = false }) => {
  const R = PIZZA_R;
  const g = useMemo(() => {
    // The gap is centred on +z (the customer side). Cylinder theta runs from +z towards +x;
    // a circle laid flat (rotateX −90°) at angle φ points the same way when φ = theta − 90°.
    const th0 = whole ? 0 : SLICE_ANGLE / 2;
    const len = whole ? Math.PI * 2 : Math.PI * 2 - SLICE_ANGLE;
    return {
      base: new THREE.CylinderGeometry(R, R, 0.07, 48, 1, false, th0, len),
      top: new THREE.CircleGeometry(R * 0.93, 48, th0 - Math.PI / 2, len).rotateX(-Math.PI / 2),
      crust: new THREE.TorusGeometry(R * 0.96, 0.055, 10, 48, len).rotateZ(th0 - Math.PI / 2).rotateX(-Math.PI / 2),
    };
  }, [R, whole]);
  return (
    <group>
      <mesh geometry={g.base} material={toy("#EFB45E", { rough: 0.7, glow: 0.16, side: THREE.DoubleSide })} position={[0, -0.03, 0]} />
      <mesh geometry={g.top} position={[0, 0.008, 0]}>
        <primitive object={texMat(pizzaTopTexture(), 0.55, 0.22)} attach="material" />
      </mesh>
      <mesh geometry={g.crust} material={toy("#DE9A4C", { rough: 0.7, glow: 0.16 })} position={[0, 0.0, 0]} />
    </group>
  );
};

/**
 * The huge gooey slice (origin: the middle of its crust; the tip points +z and droops),
 * `R` long, with cheese drips that stretch and wobble with `t`. `goo` 0..1 scales the drips.
 */
export const PizzaSlice: React.FC<{ R?: number; droop?: number; t?: number; goo?: number }> = ({ R = 0.95, droop = 0.16, t = 0, goo = 1 }) => {
  const g = useMemo(() => wedgeGeos(R, droop), [R, droop]);
  const drip = useMemo(() => new THREE.CapsuleGeometry(0.03, 1, 4, 8), []);
  // Drips hang from the two cut edges and the tip (slice space before the flip).
  const drips = useMemo(() => {
    const a0 = Math.PI / 2 - SLICE_ANGLE / 2;
    const out: { x: number; z: number; y: number; len: number; ph: number }[] = [];
    [0.25, 0.55, 0.8].forEach((u, i) => {
      for (const side of [0, 1]) {
        const a = side ? a0 + SLICE_ANGLE : a0;
        const r = u * R * 0.95;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const k = 1 - Math.min(1, r / R);
        out.push({ x, z, y: -droop * k * k - 0.04, len: 0.1 + 0.12 * hash(i * 2 + side), ph: hash(i * 5 + side * 3) * 6 });
      }
    });
    out.push({ x: 0, z: 0.03, y: -droop - 0.05, len: 0.2, ph: 1.3 });
    return out;
  }, [R, droop]);
  return (
    // Flip so the crust is at the origin side and the tip points to +z.
    <group rotation={[0, Math.PI, 0]} position={[0, 0, R * 0.96]}>
      <mesh geometry={g.dough} material={toy("#EFB45E", { rough: 0.7, glow: 0.16 })} position={[0, 0.0, 0]} />
      <mesh geometry={g.top} position={[0, 0.0, 0]}>
        <primitive object={texMat(pizzaTopTexture(), 0.55, 0.22)} attach="material" />
      </mesh>
      <mesh geometry={g.crust} material={toy("#DE9A4C", { rough: 0.7, glow: 0.16 })} />
      {drips.map((d, i) => {
        const len = Math.max(0.02, (d.len + 0.05 * Math.sin(t * 3.1 + d.ph)) * goo);
        return <mesh key={i} geometry={drip} material={toy("#FFD45A", { rough: 0.3, glow: 0.3 })} position={[d.x, d.y - len / 2, d.z]} scale={[1, len, 1]} />;
      })}
    </group>
  );
};

/**
 * The price flag on a toothpick (origin: the pick's foot): pops up with `pop` 0..1+ (overshoot
 * ok) and flutters with `t`. The flag reads from +z.
 */
export const PriceFlag: React.FC<{ text?: string; pop?: number; t?: number; size?: number }> = ({ text = "3 DÍAS", pop = 1, t = 0, size = 1 }) => {
  const ready = useFontsReady();
  const pick = useMemo(() => new THREE.CylinderGeometry(0.018, 0.012, 1, 8), []);
  const flag = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.84, 0.42, 12, 1);
    return g;
  }, []);
  const p = flag.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const u = (p.getX(i) + 0.42) / 0.84;
    p.setZ(i, Math.sin(u * 3.2 - t * 9) * 0.035 * u);
  }
  p.needsUpdate = true;
  if (pop <= 0.001) return null;
  const s = Math.max(0, pop) * size;
  return (
    <group scale={[s, s, s]}>
      <mesh geometry={pick} material={toy("#E9C48E", { rough: 0.6 })} position={[0, 0.45, 0]} scale={[1, 0.9, 1]} />
      {ready ? (
        <mesh geometry={flag} position={[0.43, 0.68, 0]}>
          <primitive object={texMat(flagTexture(text), 0.5, 0.35, false, THREE.DoubleSide)} attach="material" />
        </mesh>
      ) : null}
    </group>
  );
};

// =======================================================================================
// The banknote that crumbles into golden sand

const NOTE = { w: 0.66, h: 0.3, nx: 8, ny: 4 };
const GRAINS = 150;

const noteTiles = once(() => {
  const tiles: { geo: THREE.PlaneGeometry; x: number; y: number; delay: number }[] = [];
  const tw = NOTE.w / NOTE.nx;
  const th = NOTE.h / NOTE.ny;
  for (let j = 0; j < NOTE.ny; j++) {
    for (let i = 0; i < NOTE.nx; i++) {
      const geo = new THREE.PlaneGeometry(tw * 1.02, th * 1.02);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (i + uv.getX(k)) / NOTE.nx, (j + uv.getY(k)) / NOTE.ny);
      const x = -NOTE.w / 2 + tw * (i + 0.5);
      const y = -NOTE.h / 2 + th * (j + 0.5);
      // Crumbles from the right edge to the left, a little ragged.
      tiles.push({ geo, x, y, delay: 0.55 * (1 - i / (NOTE.nx - 1)) + 0.25 * hash(i * 7 + j * 13) });
    }
  }
  return tiles;
});

/**
 * A paper banknote that flutters down and crumbles into golden sand. `d` = frames since the
 * crumble starts (negative: still falling whole). `pos` / `rot` place the note (world); the
 * grains fall from where each piece was, under gravity, and fade within ≈ 16 frames.
 */
export const Banknote: React.FC<{ d: number; pos: V3; rot: V3; crumble?: number }> = ({ d, pos, rot, crumble = 10 }) => {
  const ready = useFontsReady();
  const tiles = noteTiles();
  const mats = useMemo(() => {
    const tex = noteTexture();
    return {
      paper: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide, emissive: new THREE.Color("#ffffff"), emissiveMap: tex, emissiveIntensity: 0.25, transparent: true }),
      grain: new THREE.MeshStandardMaterial({ color: "#FFC83D", roughness: 0.35, metalness: 0.3, emissive: new THREE.Color("#FFB21A"), emissiveIntensity: 0.55, transparent: true }),
    };
  }, []);
  const grainGeo = useMemo(() => new THREE.OctahedronGeometry(0.022, 0), []);
  const k = d / crumble;
  // The paper turns golden as it starts to crumble.
  const gold = clamp01(k * 1.6 + 0.2);
  mats.paper.color.set("#FFFFFF").lerp(new THREE.Color("#FFD36A"), gold);
  mats.grain.opacity = 1 - smooth(crumble * 1.2, crumble * 1.9, d);
  const m = useMemo(() => new THREE.Matrix4(), []);
  m.compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1, 1, 1));
  const grains: React.ReactNode[] = [];
  if (d > 0) {
    for (let i = 0; i < GRAINS; i++) {
      const tile = tiles[i % tiles.length];
      const born = tile.delay * crumble;
      const age = (d - born) / 30;
      if (age <= 0) continue;
      const jx = (hash(i * 3.1) - 0.5) * (NOTE.w / NOTE.nx);
      const jy = (hash(i * 5.7) - 0.5) * (NOTE.h / NOTE.ny);
      const v = new THREE.Vector3(tile.x + jx, tile.y + jy, 0).applyMatrix4(m);
      const vx = (hash(i * 1.3) - 0.5) * 0.9;
      const vz = (hash(i * 2.9) - 0.5) * 0.6;
      const vy = 0.2 + hash(i * 4.4) * 0.5;
      const y = Math.max(0.02, v.y + vy * age - 4.9 * age * age);
      const s = 0.7 + hash(i * 8.8) * 0.9;
      grains.push(<mesh key={i} geometry={grainGeo} material={mats.grain} position={[v.x + vx * age, y, v.z + vz * age]} scale={s} rotation={[i, i * 2, d * 0.3]} />);
    }
  }
  return (
    <group>
      {ready ? (
        <group position={pos} rotation={rot}>
          {tiles.map((tile, i) => {
            const tk = clamp01((d - tile.delay * crumble) / 4);
            if (tk >= 1) return null;
            const s = 1 - tk;
            return <mesh key={i} geometry={tile.geo} material={mats.paper} position={[tile.x, tile.y - tk * 0.03, 0]} scale={[s, s, 1]} />;
          })}
        </group>
      ) : null}
      {grains}
    </group>
  );
};

/** Golden sand sparkle glints (cheap glows) where the note crumbled. */
export const SandGlints: React.FC<{ d: number; pos: V3 }> = ({ d, pos }) => {
  if (d < 0 || d > 20) return null;
  const k = Math.sin((d / 20) * Math.PI);
  return <Glow color="#FFD36A" size={0.9 * k} opacity={0.7 * k} position={pos} />;
};

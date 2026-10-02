import React, { useMemo } from "react";
import * as THREE from "three";
import { FONT } from "../../theme";
import { box, merge } from "../geo";
import { NUBI_BODY } from "../inca/Costumes";
import { V3, canvasTexture, glowTexture, gold, noise3, toy, useFontsReady, useRounded, vertexMat } from "../inca/kit";
import { Nubi, NubiPalette, NubiPose } from "../Nubi";
import { Glow, additive, segmentFrame } from "../thanos/FX";

// Shops of the water short: the empty supermarket (with the potato in its jewellery case behind
// lasers), the dark alley of the shady seller, his safe, his outfit, the coins and the portrait.
//
// World units are sized for Nubi at size 2 (2 wide, ≈ 2 tall, eyes at y ≈ 1.1); ground at
// y = 0; the "front" of every prop is +z. `t` is the scene clock in seconds. Everything is
// deterministic and built once (geometry / textures cached at module level or in useMemo).
//
// SUPERMARKET (Supermarket + SuperLights)
//   An aisle running from z = +6 (entrance) to z = −16 between shelves whose inner faces are at
//   x = ±1.75 (aisle 3.5 wide); ceiling at y = 4.3 with fluorescent fixtures at SUPER_LIGHTS_Z;
//   the produce corner at the end (back wall z = −21.5, "VERDURAS"), where the JewelryCase
//   stands at SUPER_CASE under a spotlight. A tipped cart lies at SUPER_CART; a tumbleweed
//   crosses the aisle at z = SUPER_TUMBLE_Z when `tumble` runs 0 → 1. Leftovers: a dented can
//   (SUPER_CAN, right shelf) and a lonely lemon (SUPER_LEMON, left shelf).
// ALLEY (Alley + AlleyLights)
//   The mouth is at z = +0.4 (street facades on both sides, sidewalk and street towards +z);
//   brick walls at x = ±2.9 run to the back wall at z = −13. The crate counter stands across
//   the alley at ALLEY_COUNTER (top surface at y = ALLEY_TABLE_TOP); suggested spots:
//   ALLEY_SELLER (behind it, screen right), ALLEY_NUBI (screen left), ALLEY_SAFE.

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export type Hold = { position: V3; rotation: V3; scale: number };

const TITLE = `'${FONT.title}', '${FONT.fun}', sans-serif`;
const FUN = `'${FONT.fun}', sans-serif`;
const HEAVY = `'${FONT.heavy}', sans-serif`;

const geoCache: { [k: string]: THREE.BufferGeometry } = {};
const once = <G extends THREE.BufferGeometry>(key: string, make: () => G) => (geoCache[key] ??= make()) as G;

const texMats = new Map<string, THREE.MeshStandardMaterial>();
/** Textured toy material (cached per key): the map also feeds the emissive so colours stay bright. */
const texMat = (key: string, tex: () => THREE.Texture, o: { rough?: number; glow?: number; metal?: number; transparent?: boolean; side?: THREE.Side; color?: string } = {}) => {
  let m = texMats.get(key);
  if (!m) {
    const map = tex();
    m = new THREE.MeshStandardMaterial({
      map,
      color: o.color ?? "#FFFFFF",
      roughness: o.rough ?? 0.6,
      metalness: o.metal ?? 0,
      emissive: new THREE.Color(o.color ?? "#FFFFFF"),
      emissiveMap: map,
      emissiveIntensity: o.glow ?? 0.18,
      transparent: o.transparent ?? false,
      alphaTest: o.transparent ? 0.03 : 0,
      side: o.side ?? THREE.FrontSide,
    });
    texMats.set(key, m);
  }
  return m;
};

/** Scales a geometry's UVs (for tiling a RepeatWrapping texture over a big plane). */
const uvScale = <G extends THREE.BufferGeometry>(g: G, su: number, sv: number) => {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return g;
};

const text = (ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, fill: string, stroke?: string, lw = 0) => {
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (stroke && lw > 0) {
    ctx.lineJoin = "round";
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
};

const rrect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 0) => {
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

/** Water-drop path centred at (x, y) (tip up), `s` = half width. */
const dropPath = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.5);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 0.5, x + s, y, x + s, y + s * 0.4);
  ctx.arc(x, y + s * 0.4, s, 0, Math.PI, false);
  ctx.bezierCurveTo(x - s, y, x - s * 0.7, y - s * 0.5, x, y - s * 1.5);
  ctx.closePath();
};

/** 4-point twinkle star (additive sprites). */
const starTexture = () =>
  canvasTexture("agua-shop-star", 128, 128, (ctx, w) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.5);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = "#FFFFFF";
    for (const [sx, sy] of [
      [1, 0.12],
      [0.12, 1],
    ]) {
      ctx.beginPath();
      ctx.ellipse(c, c, c * sx, c * sy, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });

const Twinkle: React.FC<{ position: V3; size: number; opacity: number; color?: string; spin?: number }> = ({ position, size, opacity, color = "#FFFFFF", spin = 0 }) => {
  const mat = useMemo(() => additive(new THREE.SpriteMaterial({ map: starTexture(), color, toneMapped: false })), [color]);
  if (opacity <= 0.01 || size <= 0.001) return null;
  mat.opacity = Math.min(1, opacity);
  mat.rotation = spin;
  return <sprite material={mat} position={position} scale={[size, size, 1]} renderOrder={6} />;
};

// =======================================================================================
// Signs (canvas textures)

const agotadoTex = () =>
  canvasTexture("agua-agotado", 512, 200, (ctx, W, H) => {
    rrect(ctx, 6, 6, W - 12, H - 12, 34, "#E8323A");
    rrect(ctx, 22, 22, W - 44, H - 44, 24, undefined, "#FFFFFF", 9);
    text(ctx, "AGOTADO", W / 2, H / 2 + 8, `112px ${TITLE}`, "#FFFFFF", "#9E1018", 10);
  });

const PRICES = ["S/ 2.50", "S/ 4.90", "S/ 1.20", "S/ 9.99", "S/ 3.50", "S/ 0.80"];
const priceTex = (i: number) =>
  canvasTexture(`agua-price-${i}`, 256, 120, (ctx, W, H) => {
    rrect(ctx, 4, 4, W - 8, H - 8, 14, "#FFD23F");
    ctx.fillStyle = "#E8323A";
    ctx.fillRect(4, 4, W - 8, 22);
    text(ctx, PRICES[i % PRICES.length], W / 2, H / 2 + 14, `800 64px ${HEAVY}`, "#1B1B2A");
  });

const aisleSignTex = () =>
  canvasTexture("agua-aisle-sign", 1024, 512, (ctx, W, H) => {
    rrect(ctx, 8, 8, W - 16, H - 16, 60, "#1E6BFF");
    rrect(ctx, 30, 30, W - 60, H - 60, 44, undefined, "#FFFFFF", 12);
    text(ctx, "PASILLO 7", W / 2, 118, `86px ${FUN}`, "#BFE0FF");
    ctx.fillStyle = "#FFFFFF";
    dropPath(ctx, 250, 300, 62);
    ctx.fill();
    text(ctx, "AGUA", W / 2 + 90, 310, `210px ${TITLE}`, "#FFFFFF", "#0B3C9E", 16);
    // Red "AGOTADO" band slapped across it.
    ctx.save();
    ctx.translate(W / 2, H / 2 + 40);
    ctx.rotate(-0.2);
    rrect(ctx, -440, -62, 880, 124, 18, "#E8323A", "#FFFFFF", 8);
    text(ctx, "AGOTADO", 0, 8, `112px ${TITLE}`, "#FFFFFF", "#8E0E16", 10);
    ctx.restore();
  });

const verdurasTex = () =>
  canvasTexture("agua-verduras", 1024, 256, (ctx, W, H) => {
    rrect(ctx, 6, 6, W - 12, H - 12, 50, "#FFF6DC");
    rrect(ctx, 22, 22, W - 44, H - 44, 38, undefined, "#2E9E4F", 10);
    text(ctx, "VERDURAS", W / 2, H / 2 + 10, `150px ${TITLE}`, "#2E9E4F", "#FFFFFF", 6);
  });

const plaqueTex = () =>
  canvasTexture("agua-plaque", 512, 160, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#FFE08A");
    g.addColorStop(0.5, "#F2B705");
    g.addColorStop(1, "#C98A00");
    rrect(ctx, 4, 4, W - 8, H - 8, 30, undefined);
    ctx.fillStyle = g;
    ctx.fill();
    rrect(ctx, 18, 18, W - 36, H - 36, 22, undefined, "#8A5A00", 6);
    text(ctx, "PAPA", W / 2, H / 2 + 8, `104px ${TITLE}`, "#5A3A00");
  });

const tagTex = () =>
  canvasTexture("agua-potato-tag", 256, 150, (ctx, W, H) => {
    rrect(ctx, 4, 4, W - 8, H - 8, 18, "#FFFFFF", "#C8C8C8", 4);
    ctx.fillStyle = "#555";
    ctx.beginPath();
    ctx.arc(30, H / 2, 10, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, "S/ 999", W / 2 + 16, H / 2 + 6, `800 62px ${HEAVY}`, "#D11F2A");
  });

const canTex = () =>
  canvasTexture("agua-can-label", 512, 200, (ctx, W, H) => {
    ctx.fillStyle = "#E8323A";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, H * 0.3, W, H * 0.4);
    text(ctx, "SOPA", W * 0.25, H / 2 + 4, `64px ${TITLE}`, "#E8323A");
    text(ctx, "SOPA", W * 0.75, H / 2 + 4, `64px ${TITLE}`, "#E8323A");
  });

const floorTex = () =>
  canvasTexture(
    "agua-super-floor",
    256,
    256,
    (ctx, W) => {
      const s = W / 2;
      for (let j = 0; j < 2; j++)
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = (i + j) % 2 ? "#F4EEDF" : "#BFE6DA";
          ctx.fillRect(i * s, j * s, s, s);
          ctx.strokeStyle = "rgba(90,110,120,0.35)";
          ctx.lineWidth = 3;
          ctx.strokeRect(i * s + 1.5, j * s + 1.5, s - 3, s - 3);
        }
    },
    { wrapS: true, wrapT: true },
  );

// =======================================================================================
// Supermarket

const SHELF = { inner: 1.75, depth: 0.95, h: 2.9, z0: 6, mod: 2.75, n: 8, boards: [0.22, 0.8, 1.38, 1.96, 2.54] };
/** Top surfaces of the shelf boards (y), bottom to top. */
export const SUPER_BOARDS = SHELF.boards.map((y) => y + 0.025);
/** Inner faces of the shelves (x = ±SUPER_AISLE_HALF). */
export const SUPER_AISLE_HALF = SHELF.inner;
export const SUPER_CEILING = 4.3;
/** Fluorescent fixtures (x = 0, y ≈ 4.2). */
export const SUPER_LIGHTS_Z = [4.5, -0.5, -5.5, -10.5, -15.5];
/** The jewellery case (base centre of its pedestal; glass box y 1.06..1.84; potato at y ≈ 1.3). */
export const SUPER_CASE: V3 = [0, 0, -18.6];
/** Tipped-over cart and its heading. */
export const SUPER_CART: V3 = [1.0, 0, 2.6];
export const SUPER_CART_YAW = 0.55;
/** The tumbleweed crosses the aisle (x +2 → −2.2) at this z when `tumble` runs 0 → 1. */
export const SUPER_TUMBLE_Z = -2.2;
/** Leftovers: a dented can on the right shelf, a lonely lemon on the left one. */
export const SUPER_CAN: V3 = [1.98, SUPER_BOARDS[2], -4.0];
export const SUPER_LEMON: V3 = [-1.98, SUPER_BOARDS[3], -8.6];
/** CSS background (only shows through gaps; the set is closed). */
export const SUPER_BG = "linear-gradient(180deg, #CFE7F0 0%, #9CC9D8 100%)";

const STRIPS = ["#FF8A1F", "#FFC21A", "#FF5A8A"];
const HEADERS = ["#E8323A", "#1E6BFF", "#20B26B", "#FFB000"];

const shelvingGeo = () =>
  once("super-shelving", () => {
    const parts: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const xc = s * (SHELF.inner + SHELF.depth / 2);
      for (let m = 0; m < SHELF.n; m++) {
        const zc = SHELF.z0 - m * SHELF.mod - SHELF.mod / 2;
        parts.push(box(0.06, SHELF.h, SHELF.mod, "#C3CFE0", [s * (SHELF.inner + SHELF.depth - 0.03), SHELF.h / 2, zc]));
        parts.push(box(SHELF.depth, 0.2, SHELF.mod, "#56627A", [xc, 0.1, zc]));
        for (const y of SHELF.boards) {
          parts.push(box(SHELF.depth - 0.04, 0.05, SHELF.mod - 0.06, "#F3F6FA", [xc + s * 0.02, y, zc]));
          parts.push(box(0.03, 0.1, SHELF.mod - 0.06, STRIPS[(m + (s > 0 ? 1 : 0)) % 3], [s * (SHELF.inner + 0.015), y - 0.02, zc]));
        }
        parts.push(box(SHELF.depth + 0.04, 0.36, SHELF.mod, HEADERS[(m + (s > 0 ? 2 : 0)) % 4], [xc, SHELF.h + 0.18, zc]));
      }
      for (let m = 0; m <= SHELF.n; m++) {
        parts.push(box(SHELF.depth + 0.02, SHELF.h + 0.36, 0.08, "#8E9BB3", [xc, (SHELF.h + 0.36) / 2, SHELF.z0 - m * SHELF.mod]));
      }
      // Walls behind the shelves, with a white stripe, up to the ceiling.
      parts.push(box(0.1, SUPER_CEILING, 31, "#7FCFC4", [s * 2.85, SUPER_CEILING / 2, -6.5]));
      parts.push(box(0.12, 0.22, 31, "#FFFFFF", [s * 2.82, 3.7, -6.5]));
      // Empty produce bins in the back corner.
      parts.push(box(1.0, 0.75, 1.1, "#B9824A", [s * 2.1, 0.375, -20.6]));
      parts.push(box(0.86, 0.04, 0.96, "#4A3322", [s * 2.1, 0.74, -20.6]));
      parts.push(box(1.04, 0.12, 1.14, "#2E9E4F", [s * 2.1, 0.7, -20.6]));
    }
    parts.push(box(5.8, 0.08, 31, "#B9C3D0", [0, SUPER_CEILING + 0.04, -6.5]));
    // Front wall with the (bright) glass doors behind the entrance.
    parts.push(box(5.8, SUPER_CEILING, 0.1, "#7FCFC4", [0, SUPER_CEILING / 2, 9.05]));
    parts.push(box(2.4, 2.5, 0.06, "#DDF6FF", [0, 1.25, 8.98]));
    parts.push(box(0.06, 2.5, 0.08, "#8E9BB3", [0, 1.25, 8.95]));
    parts.push(box(2.6, 0.12, 0.1, "#8E9BB3", [0, 2.52, 8.95]));
    parts.push(box(5.8, SUPER_CEILING, 0.1, "#79C987", [0, SUPER_CEILING / 2, -21.55]));
    parts.push(box(5.8, 0.3, 0.12, "#2E9E4F", [0, 0.15, -21.48]));
    return merge(parts);
  });

/** Light level 0..1 of the flickering fluorescent tubes (`seed` per fixture). */
export const superFlick = (t: number, flicker = 1, seed = 0) => {
  const step = Math.floor(t * 14 + seed * 3.7);
  const burst = Math.sin(t * 1.7 + seed * 2.1) > 0.25 ? 1 : 0;
  const off = burst && hash(step + seed * 31) < 0.5 ? 1 : 0;
  return clamp01(1 - flicker * (off * 0.75 + 0.06 * (0.5 + 0.5 * Math.sin(t * 47 + seed))));
};
/** How strongly each fixture flickers (the second one is the bad one). */
const FIX_FLICK = [0.45, 1, 0.3, 0.7, 0.2];

const tubeMats = () => SUPER_LIGHTS_Z.map(() => new THREE.MeshStandardMaterial({ color: "#F4FBFF", emissive: new THREE.Color("#EAF6FF"), emissiveIntensity: 1.6, toneMapped: false }));

/** Fluorescent lights of the supermarket plus the warm spot on the jewellery case. */
export const SuperLights: React.FC<{ t?: number; flicker?: number; k?: number }> = ({ t = 0, flicker = 1, k = 1 }) => {
  const avg = SUPER_LIGHTS_Z.reduce((a, _z, i) => a + superFlick(t, flicker * FIX_FLICK[i], i), 0) / SUPER_LIGHTS_Z.length;
  return (
    <>
      <hemisphereLight args={["#EEF7FF", "#6F7E9C", (0.75 + 0.55 * avg) * k]} />
      <directionalLight position={[2.5, 9, 9]} intensity={(0.8 + 0.9 * avg) * k} color="#F6FBFF" />
      {SUPER_LIGHTS_Z.map((z, i) => (
        <pointLight key={z} position={[0, 2.9, z]} intensity={5 * superFlick(t, flicker * FIX_FLICK[i], i) * k} distance={8} decay={1.4} color="#EEF8FF" />
      ))}
      <pointLight position={[SUPER_CASE[0], 3.3, SUPER_CASE[2] + 0.6]} intensity={9 * k} distance={6} decay={1.3} color="#FFE2A8" />
    </>
  );
};

/** Wire shopping cart, upright: wheels on the ground, handle at −x, ≈ 0.95 long × 0.55 wide × 1 tall. */
export const ShoppingCart: React.FC = () => {
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const wire = "#C9D2DE";
    const L = 0.95;
    const W = 0.55;
    const y0 = 0.45;
    const y1 = 0.98;
    // Basket edges and wires (thin boxes).
    for (const y of [y0, (y0 + y1) / 2, y1]) {
      parts.push(box(L, 0.025, 0.025, wire, [0, y, W / 2]));
      parts.push(box(L, 0.025, 0.025, wire, [0, y, -W / 2]));
      parts.push(box(0.025, 0.025, W, wire, [L / 2, y, 0]));
      parts.push(box(0.025, 0.025, W, wire, [-L / 2, y, 0]));
    }
    for (let i = 0; i <= 8; i++) {
      const x = -L / 2 + (i / 8) * L;
      parts.push(box(0.02, y1 - y0, 0.02, wire, [x, (y0 + y1) / 2, W / 2]));
      parts.push(box(0.02, y1 - y0, 0.02, wire, [x, (y0 + y1) / 2, -W / 2]));
    }
    for (let i = 0; i <= 5; i++) {
      const z = -W / 2 + (i / 5) * W;
      parts.push(box(0.02, y1 - y0, 0.02, wire, [L / 2, (y0 + y1) / 2, z]));
      parts.push(box(0.02, y1 - y0, 0.02, wire, [-L / 2, (y0 + y1) / 2, z]));
      parts.push(box(L, 0.02, 0.02, wire, [0, y0, z]));
    }
    // Chassis and legs.
    parts.push(box(L * 0.9, 0.04, 0.04, "#8E9BB3", [0.02, 0.12, W / 2 - 0.05]));
    parts.push(box(L * 0.9, 0.04, 0.04, "#8E9BB3", [0.02, 0.12, -W / 2 + 0.05]));
    for (const x of [-L / 2 + 0.06, L / 2 - 0.08])
      for (const z of [W / 2 - 0.05, -W / 2 + 0.05]) parts.push(box(0.035, y0 - 0.1, 0.035, "#8E9BB3", [x, (y0 + 0.1) / 2 + 0.03, z]));
    // Handle with a red grip.
    parts.push(box(0.04, 0.2, 0.04, wire, [-L / 2 - 0.06, y1 + 0.06, W / 2 - 0.04]));
    parts.push(box(0.04, 0.2, 0.04, wire, [-L / 2 - 0.06, y1 + 0.06, -W / 2 + 0.04]));
    parts.push(box(0.07, 0.07, W + 0.04, "#E8323A", [-L / 2 - 0.1, y1 + 0.16, 0]));
    // Wheels.
    for (const x of [-L / 2 + 0.06, L / 2 - 0.08])
      for (const z of [W / 2 - 0.05, -W / 2 + 0.05]) {
        const w = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 14);
        w.rotateX(Math.PI / 2);
        w.translate(x, 0.06, z);
        parts.push(w);
        const c = new THREE.Color("#222630");
        const n = w.attributes.position.count;
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
        w.setAttribute("color", new THREE.BufferAttribute(arr, 3));
      }
    return merge(parts);
  }, []);
  return <mesh geometry={geo} material={vertexMat(0.35, false, 0.14, 0.3)} castShadow />;
};

/** A ball of dry twigs, radius ≈ 0.32 (origin at its centre). */
export const Tumbleweed: React.FC = () => {
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    let s = 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 22; i++) {
      const r = 0.18 + rnd() * 0.14;
      const g = new THREE.TorusGeometry(r, 0.011 + rnd() * 0.006, 4, 22, Math.PI * (1.2 + rnd() * 0.8));
      g.rotateX(rnd() * Math.PI * 2);
      g.rotateY(rnd() * Math.PI * 2);
      g.rotateZ(rnd() * Math.PI * 2);
      const c = new THREE.Color(i % 3 ? "#B88A52" : "#8E6435");
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) arr.set([c.r, c.g, c.b], k * 3);
      g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
      parts.push(g);
    }
    return merge(parts);
  }, []);
  return <mesh geometry={geo} material={vertexMat(0.9, false, 0.16)} castShadow />;
};

/** A dented tin can of soup (≈ 0.22 tall, origin at the bottom centre, label to +z). */
export const DentedCan: React.FC = () => {
  const ready = useFontsReady();
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.075, 0.075, 0.22, 28, 6, true);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      // A dent on the front-right, deepest at mid height.
      const a = Math.atan2(x, z) - 0.6;
      const k = Math.max(0, Math.cos(a * 2.2)) * Math.max(0, 1 - Math.abs(y + 0.01) / 0.09);
      const r = 1 - 0.32 * k * k;
      p.setX(i, x * r);
      p.setZ(i, z * r);
    }
    g.computeVertexNormals();
    g.translate(0, 0.11, 0);
    return g;
  }, []);
  const lid = useMemo(() => new THREE.CylinderGeometry(0.077, 0.077, 0.014, 28), []);
  const steel = toy("#C9D2DE", { metal: 0.6, rough: 0.3 });
  return (
    <group>
      <mesh geometry={geo} material={ready ? texMat("can", canTex, { rough: 0.35 }) : steel} castShadow />
      <mesh geometry={lid} material={steel} position={[0, 0.007, 0]} />
      <mesh geometry={lid} material={steel} position={[0, 0.215, 0]} rotation={[0.12, 0, 0.05]} />
    </group>
  );
};

/** A lonely lemon (≈ 0.2 long along x, origin at the bottom). */
export const Lemon: React.FC = () => {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.075, 24, 16);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / 0.075;
      // Pointy ends along x.
      const tip = Math.pow(Math.abs(x), 6) * 0.35;
      p.setX(i, p.getX(i) * (1.25 + tip));
      p.setY(i, p.getY(i) * (1 - tip * 0.6));
      p.setZ(i, p.getZ(i) * (1 - tip * 0.6));
    }
    g.computeVertexNormals();
    g.translate(0, 0.072, 0);
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={geo} material={toy("#FFE13A", { rough: 0.45, glow: 0.22 })} castShadow />
      <mesh material={toy("#3FB94F", { rough: 0.5 })} position={[0.07, 0.14, 0.02]} rotation={[0.3, 0.4, -0.7]} scale={[0.06, 0.012, 0.03]}>
        <sphereGeometry args={[1, 10, 6]} />
      </mesh>
    </group>
  );
};

type Sign = { side: 1 | -1; board: number; z: number; tilt: number };
const AGOTADOS: Sign[] = [
  { side: 1, board: 2, z: 4.3, tilt: 0.06 },
  { side: -1, board: 1, z: 2.0, tilt: -0.05 },
  { side: 1, board: 3, z: -1.2, tilt: -0.05 },
  { side: -1, board: 2, z: -3.2, tilt: 0.07 },
  { side: 1, board: 1, z: -6.4, tilt: 0.05 },
  { side: -1, board: 3, z: -7.6, tilt: -0.06 },
  { side: 1, board: 2, z: -10.4, tilt: 0.03 },
  { side: -1, board: 1, z: -12.2, tilt: -0.04 },
  { side: 1, board: 3, z: -14.3, tilt: 0.05 },
];
const TAGS: [1 | -1, number, number][] = [
  [1, 0, 5.2],
  [-1, 2, 4.6],
  [1, 3, 2.3],
  [-1, 4, 0.6],
  [1, 1, 0.2],
  [-1, 0, -1.5],
  [1, 4, -2.9],
  [-1, 3, -4.9],
  [1, 0, -5.6],
  [-1, 1, -9.3],
  [1, 3, -8.4],
  [-1, 4, -11.0],
  [1, 1, -12.6],
  [-1, 2, -14.6],
];

/**
 * The empty supermarket: aisle, shelves, signs, leftovers, tipped cart, fluorescent fixtures,
 * the produce corner and (unless `showCase` is false) the JewelryCase at SUPER_CASE.
 * `flicker` 0..1 = how much the tubes flicker (match it in SuperLights); `lasers` drives the
 * case's lasers; `tumble` 0..1 rolls the tumbleweed across (undefined = no tumbleweed).
 */
export const Supermarket: React.FC<{ t?: number; flicker?: number; lasers?: number; tumble?: number; showCase?: boolean; sparkle?: number }> = ({
  t = 0,
  flicker = 1,
  lasers = 1,
  tumble,
  showCase = true,
  sparkle = 1,
}) => {
  const ready = useFontsReady();
  const floor = useMemo(() => uvScale(new THREE.PlaneGeometry(5.7, 30.7), 5.7 / 1.1, 30.7 / 1.1), []);
  const floorMat = useMemo(() => {
    const map = floorTex();
    return new THREE.MeshStandardMaterial({ map, roughness: 0.18, metalness: 0.05, emissive: new THREE.Color("#FFFFFF"), emissiveMap: map, emissiveIntensity: 0.12 });
  }, []);
  const mats = useMemo(tubeMats, []);
  const housing = useRounded(0.46, 0.08, 2.3, 0.03);
  const tube = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.05, 0.05, 2.1, 12);
    g.rotateX(Math.PI / 2);
    return g;
  }, []);
  const signGeo = useMemo(() => new THREE.PlaneGeometry(0.6, 0.235), []);
  const tagGeo = useMemo(() => new THREE.PlaneGeometry(0.2, 0.094), []);
  const chain = useMemo(() => new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6), []);
  const levels = SUPER_LIGHTS_Z.map((_z, i) => superFlick(t, flicker * FIX_FLICK[i], i));
  mats.forEach((m, i) => (m.emissiveIntensity = 0.25 + 1.5 * levels[i]));
  const tw = tumble === undefined ? null : clamp01(tumble);
  const twX = tw === null ? 0 : 2.1 - 4.4 * tw;
  return (
    <group>
      <mesh geometry={shelvingGeo()} material={vertexMat(0.5, false, 0.12, 0.1)} receiveShadow />
      <mesh geometry={floor} material={floorMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -6.2]} receiveShadow />
      {/* Fluorescent fixtures. */}
      {SUPER_LIGHTS_Z.map((z, i) => (
        <group key={z} position={[0, SUPER_CEILING - 0.08, z]}>
          <mesh geometry={housing} material={toy("#F2F5F8", { rough: 0.5 })} />
          <mesh geometry={tube} material={mats[i]} position={[0, -0.07, 0]} />
          <Glow color="#DDF1FF" size={1.0} opacity={0.22 * levels[i]} position={[0, -0.12, 0]} />
        </group>
      ))}
      {/* Hanging aisle sign: PASILLO 7 · AGUA · AGOTADO. */}
      {ready ? (
        <group position={[0, 3.45, -3.0]}>
          {[-0.62, 0.62].map((x) => (
            <mesh key={x} geometry={chain} material={toy("#8E9BB3", { metal: 0.5 })} position={[x, 0.62, 0]} />
          ))}
          <mesh material={texMat("aisle", aisleSignTex, { glow: 0.3 })}>
            <planeGeometry args={[1.7, 0.85]} />
          </mesh>
          <mesh material={texMat("aisle", aisleSignTex, { glow: 0.3 })} rotation={[0, Math.PI, 0]} position={[0, 0, -0.01]}>
            <planeGeometry args={[1.7, 0.85]} />
          </mesh>
        </group>
      ) : null}
      {/* AGOTADO cards standing on the empty boards; price tags on the strips. */}
      {ready
        ? AGOTADOS.map((a, i) => (
            <mesh
              key={i}
              geometry={signGeo}
              material={texMat("agotado", agotadoTex, { glow: 0.28 })}
              position={[a.side * (SHELF.inner + 0.14), SUPER_BOARDS[a.board] + 0.13, a.z]}
              rotation={[0, -a.side * Math.PI * 0.5 + a.side * 0.25, a.tilt]}
            />
          ))
        : null}
      {ready
        ? TAGS.map(([s, b, z], i) => (
            <mesh
              key={i}
              geometry={tagGeo}
              material={texMat(`price-${i % PRICES.length}`, () => priceTex(i % PRICES.length), { glow: 0.25 })}
              position={[s * (SHELF.inner - 0.004), SHELF.boards[b] - 0.02, z]}
              rotation={[0, -s * Math.PI * 0.5, 0]}
            />
          ))
        : null}
      {ready ? (
        <mesh material={texMat("verduras", verdurasTex, { glow: 0.25 })} position={[0, 3.25, -21.48]}>
          <planeGeometry args={[2.8, 0.7]} />
        </mesh>
      ) : null}
      {/* Leftovers. */}
      <group position={SUPER_CAN} rotation={[0, -Math.PI / 2 + 0.3, 0]}>
        <DentedCan />
      </group>
      <group position={SUPER_LEMON} rotation={[0, 0.5, 0]}>
        <Lemon />
      </group>
      {/* Tipped-over cart: on its side, wheels towards the camera. */}
      <group position={SUPER_CART} rotation={[0, SUPER_CART_YAW, 0]}>
        <group position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ShoppingCart />
        </group>
      </group>
      {tw !== null ? (
        <group position={[twX, 0.33 + Math.abs(Math.sin(tw * Math.PI * 4)) * 0.28, SUPER_TUMBLE_Z]} rotation={[0.3, 0, -twX / 0.33]}>
          <Tumbleweed />
        </group>
      ) : null}
      {showCase ? (
        <group position={SUPER_CASE}>
          <JewelryCase lasers={lasers} t={t} sparkle={sparkle} />
        </group>
      ) : null}
    </group>
  );
};

// =======================================================================================
// The potato and its jewellery case

const potatoGeo = () =>
  once("potato", () => {
    const g = new THREE.SphereGeometry(1, 48, 32);
    const p = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(p.count * 3);
    const base = new THREE.Color("#B9824A");
    const dark = new THREE.Color("#7A4E26");
    const light = new THREE.Color("#DCA868");
    const eyes = (
      [
        [0.6, 0.5, 0.62],
        [-0.5, 0.35, 0.8],
        [0.1, 0.92, 0.38],
        [-0.85, -0.1, 0.5],
        [0.85, -0.25, 0.45],
        [0.25, -0.35, 0.9],
        [-0.3, 0.8, -0.5],
      ] as V3[]
    ).map((e) => new THREE.Vector3(...e).normalize());
    const n = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      n.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      let r = 1 + 0.1 * noise3(n.x * 1.5, n.y * 1.5, n.z * 1.5) + 0.035 * noise3(n.x * 4 + 3, n.y * 4, n.z * 4);
      let dk = 0;
      for (const e of eyes) {
        const d = n.distanceTo(e);
        if (d < 0.16) {
          const k = 1 - d / 0.16;
          r -= 0.05 * k * k;
          dk = Math.max(dk, k);
        }
      }
      p.setXYZ(i, n.x * r * 0.52, n.y * r * 0.33 + 0.05 * n.x * n.x, n.z * r * 0.38);
      const spot = clamp01(noise3(n.x * 5 + 7, n.y * 5, n.z * 5) * 1.4);
      c.copy(base)
        .lerp(light, clamp01(0.5 + 0.6 * n.y) * 0.4)
        .lerp(dark, Math.min(1, spot * 0.45 + dk * 0.75));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    g.translate(0, 0.34, 0);
    return g;
  });

/**
 * The precious potato on a tufted red velvet cushion, with a tiny price tag ("S/ 999") and
 * twinkling sparkles (`sparkle` 0..1). Origin at the bottom centre of the cushion; ≈ 0.58 wide,
 * ≈ 0.42 tall at scale 1.
 */
export const Potato: React.FC<{ t?: number; sparkle?: number }> = ({ t = 0, sparkle = 1 }) => {
  const ready = useFontsReady();
  const cushion = useRounded(0.58, 0.11, 0.48, 0.05);
  const tuft = useMemo(() => new THREE.SphereGeometry(0.018, 10, 8), []);
  const velvet = toy("#C8173F", { rough: 0.85, glow: 0.2 });
  const tags = useMemo(() => new THREE.PlaneGeometry(0.11, 0.065), []);
  const sp = clamp01(sparkle);
  return (
    <group>
      <mesh geometry={cushion} material={velvet} position={[0, 0.055, 0]} scale={[1, 1, 1]} castShadow />
      {[
        [-0.17, -0.13],
        [0.17, -0.13],
        [-0.17, 0.13],
        [0.17, 0.13],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={tuft} material={gold()} position={[x * 1.55, 0.06, z * 1.65]} />
      ))}
      <mesh geometry={potatoGeo()} material={vertexMat(0.62, false, 0.16)} position={[0, 0.085, 0]} rotation={[0, -0.25, 0.05]} scale={0.44} castShadow />
      {/* Tiny price tag on a string. */}
      <mesh material={toy("#EDEDED")} position={[0.215, 0.15, 0.13]} rotation={[0, 0, -0.9]} scale={[0.004, 0.11, 0.004]}>
        <cylinderGeometry args={[1, 1, 1, 5]} />
      </mesh>
      {ready ? <mesh geometry={tags} material={texMat("potato-tag", tagTex, { glow: 0.3, side: THREE.DoubleSide })} position={[0.27, 0.1, 0.16]} rotation={[-0.15, -0.3, -0.25]} /> : null}
      {sp > 0
        ? [0, 1, 2, 3, 4].map((i) => {
            const ph = t * 3.1 + i * 1.7;
            const k = Math.pow(0.5 + 0.5 * Math.sin(ph), 3);
            const a = i * 1.26 + 0.4;
            return (
              <Twinkle
                key={i}
                position={[Math.cos(a) * 0.27, 0.25 + 0.12 * Math.sin(i * 2.1), Math.sin(a) * 0.14 + 0.1]}
                size={0.16 * k * sp}
                opacity={sp * (0.4 + 0.6 * k)}
                color={i % 2 ? "#FFF6C8" : "#FFFFFF"}
                spin={t * 0.8 + i}
              />
            );
          })
        : null}
      <Glow color="#FFE7A0" size={0.75} opacity={0.3 * sp} position={[0, 0.25, 0]} />
    </group>
  );
};

const coneTex = () =>
  canvasTexture("agua-cone", 8, 128, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.2, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  });

/** Glowing red security laser between two points (core + soft glow). */
const LaserBeam: React.FC<{ from: V3; to: V3; mats: { core: THREE.Material; glow: THREE.Material } }> = ({ from, to, mats }) => {
  const { len, q } = segmentFrame(from, to);
  return (
    <group position={from} quaternion={q}>
      <mesh material={mats.core} position={[0, len / 2, 0]} scale={[0.008, len, 0.008]} renderOrder={6}>
        <cylinderGeometry args={[1, 1, 1, 6]} />
      </mesh>
      <mesh material={mats.glow} position={[0, len / 2, 0]} scale={[0.035, len, 0.035]} renderOrder={7}>
        <cylinderGeometry args={[1, 1, 1, 8]} />
      </mesh>
    </group>
  );
};

/** Laser posts at x = ±JEWEL.post, z = JEWEL.laserZ; beams [left height, right height]. */
const JEWEL = { post: 0.86, laserZ: 0.8, glassY0: 1.06, glassY1: 1.84, glassW: 0.84 };
const BEAMS: [number, number][] = [
  [0.3, 1.72],
  [1.72, 0.3],
  [0.66, 1.4],
  [1.4, 0.66],
  [1.02, 1.02],
];

/**
 * A glass display case on a red velvet pedestal under a spotlight, holding the Potato; red
 * security lasers criss-cross in front of it (`lasers` 0..1 = beam brightness; blink it from
 * the shot). Origin at the base centre; glass box y 1.06..1.84, potato top ≈ 1.45; the laser
 * posts stand at x = ±0.86, z = +0.8. Includes its own warm point light and floor pool.
 */
export const JewelryCase: React.FC<{ lasers?: number; t?: number; sparkle?: number; spot?: number }> = ({ lasers = 1, t = 0, sparkle = 1, spot = 1 }) => {
  const ready = useFontsReady();
  const plinth = useRounded(1.06, 0.12, 1.06, 0.04);
  const pedestal = useRounded(0.9, 0.86, 0.9, 0.06);
  const slab = useRounded(1.02, 0.08, 1.02, 0.03);
  const edgeV = useRounded(0.045, JEWEL.glassY1 - JEWEL.glassY0, 0.045, 0.015);
  const edgeH = useRounded(JEWEL.glassW + 0.04, 0.045, 0.045, 0.015);
  const post = useMemo(() => new THREE.CylinderGeometry(0.035, 0.045, 1.95, 12), []);
  const glass = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#D8F6FF",
        roughness: 0.04,
        metalness: 0.1,
        transparent: true,
        opacity: 0.16,
        emissive: new THREE.Color("#BFEFFF"),
        emissiveIntensity: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const shine = useMemo(() => additive(new THREE.MeshBasicMaterial({ color: "#FFFFFF", opacity: 0.35, toneMapped: false })), []);
  const beam = useMemo(
    () => ({
      core: additive(new THREE.MeshBasicMaterial({ color: "#FFD6D6", toneMapped: false })),
      glow: additive(new THREE.MeshBasicMaterial({ color: "#FF1E3C", toneMapped: false })),
    }),
    [],
  );
  const cone = useMemo(() => additive(new THREE.MeshBasicMaterial({ map: coneTex(), color: "#FFE9B8", side: THREE.DoubleSide, toneMapped: false })), []);
  const pool = useMemo(() => additive(new THREE.MeshBasicMaterial({ map: glowTexture(), color: "#FFD98A", toneMapped: false })), []);
  const L = clamp01(lasers) * (0.88 + 0.12 * Math.sin(t * 31));
  beam.core.opacity = L;
  beam.glow.opacity = 0.5 * L;
  cone.opacity = 0.22 * spot;
  pool.opacity = 0.5 * spot;
  const gw = JEWEL.glassW;
  const gh = JEWEL.glassY1 - JEWEL.glassY0;
  const gy = (JEWEL.glassY0 + JEWEL.glassY1) / 2;
  const velvet = toy("#8E1238", { rough: 0.9, glow: 0.16 });
  return (
    <group>
      <mesh geometry={plinth} material={gold()} position={[0, 0.06, 0]} castShadow />
      <mesh geometry={pedestal} material={velvet} position={[0, 0.55, 0]} castShadow />
      <mesh geometry={slab} material={gold()} position={[0, 1.02, 0]} castShadow />
      {ready ? (
        <mesh material={texMat("plaque", plaqueTex, { metal: 0.3, rough: 0.35, glow: 0.3 })} position={[0, 0.72, 0.452]}>
          <planeGeometry args={[0.5, 0.156]} />
        </mesh>
      ) : null}
      <group position={[0, JEWEL.glassY0, 0]}>
        <Potato t={t} sparkle={sparkle} />
      </group>
      {/* Glass box with gold edges. */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} geometry={edgeV} material={gold()} position={[(sx * gw) / 2, gy, (sz * gw) / 2]} />),
      )}
      {[JEWEL.glassY0 + 0.02, JEWEL.glassY1].map((y) =>
        [0, 1, 2, 3].map((k) => (
          <mesh key={`${y}${k}`} geometry={edgeH} material={gold()} position={k < 2 ? [0, y, ((k ? 1 : -1) * gw) / 2] : [((k === 3 ? 1 : -1) * gw) / 2, y, 0]} rotation={[0, k < 2 ? 0 : Math.PI / 2, 0]} />
        )),
      )}
      <mesh material={glass} position={[0, gy, 0]} renderOrder={3}>
        <boxGeometry args={[gw, gh, gw]} />
      </mesh>
      {/* Glints on the front pane. */}
      {[
        [-0.22, 0.09, 0.05],
        [-0.08, 0.035, 0.0],
        [0.26, 0.05, -0.1],
      ].map(([x, w, dy], i) => (
        <mesh key={i} material={shine} position={[x, gy + dy, gw / 2 + 0.004]} rotation={[0, 0, -0.55]} renderOrder={4}>
          <planeGeometry args={[w, gh * 0.9]} />
        </mesh>
      ))}
      {/* Spotlight beam from the ceiling and the pool of light on the floor. */}
      <mesh material={cone} position={[0, 1.9 + 1.2, 0]} renderOrder={2}>
        <cylinderGeometry args={[0.14, 0.78, 2.4, 32, 1, true]} />
      </mesh>
      <mesh material={pool} position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[2.6, 2.6]} />
      </mesh>
      <pointLight position={[0, 2.3, 0.7]} intensity={2.2 * spot} distance={3} decay={1.2} color="#FFE6B8" />
      {/* Laser posts and beams. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * JEWEL.post, 0, JEWEL.laserZ]}>
          <mesh geometry={post} material={toy("#2A2D38", { metal: 0.5, rough: 0.3 })} position={[0, 0.975, 0]} castShadow />
          <mesh material={toy("#2A2D38", { metal: 0.5 })} position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.12, 0.14, 0.04, 18]} />
          </mesh>
          {BEAMS.map(([a, b], i) => (
            <group key={i} position={[0, s < 0 ? a : b, 0]}>
              <mesh material={toy("#FF2A44", { glow: 0.3 + 1.2 * L })} position={[-s * 0.03, 0, 0]}>
                <sphereGeometry args={[0.026, 10, 8]} />
              </mesh>
              <Glow color="#FF2A44" size={0.22} opacity={0.8 * L} position={[-s * 0.04, 0, 0]} />
            </group>
          ))}
        </group>
      ))}
      {L > 0.01
        ? BEAMS.map(([a, b], i) => <LaserBeam key={i} from={[-JEWEL.post + 0.04, a, JEWEL.laserZ]} to={[JEWEL.post - 0.04, b, JEWEL.laserZ]} mats={beam} />)
        : null}
    </group>
  );
};

// =======================================================================================
// Alley

export const ALLEY = { half: 2.9, back: -13, wallH: 8, mouth: 0.4 };
/** Crate counter across the alley (base centre) and the y of its top surface (the cloth). */
export const ALLEY_COUNTER: V3 = [-0.1, 0, -3.0];
export const ALLEY_TABLE_TOP = 0.77;
/** Suggested spots: the seller behind the counter (screen right, facing −x / the camera), Nubi on the left, the safe behind. */
export const ALLEY_SELLER: V3 = [1.55, 0, -3.3];
export const ALLEY_NUBI: V3 = [-1.55, 0, -2.9];
export const ALLEY_SAFE: V3 = [0.25, 0, -4.95];
/** The hanging bulb over the counter. */
export const ALLEY_BULB: V3 = [-0.1, 2.35, -3.0];
/** Dusk sky behind the alley (CSS). */
export const ALLEY_BG = "linear-gradient(180deg, #170C2E 0%, #2E1A52 45%, #5A2F6E 75%, #8C4A6E 100%)";

const brickTex = () =>
  canvasTexture(
    "agua-bricks",
    512,
    512,
    (ctx, W, H) => {
      ctx.fillStyle = "#4E3C46";
      ctx.fillRect(0, 0, W, H);
      const rows = 10;
      const cols = 4;
      const bh = H / rows;
      const bw = W / cols;
      const cs = ["#9A4A42", "#A8584C", "#86413B", "#B0624F", "#93463F"];
      for (let j = 0; j < rows; j++) {
        for (let i = -1; i <= cols; i++) {
          const x = i * bw + (j % 2 ? bw / 2 : 0);
          const h = hash(i * 13 + j * 7);
          ctx.fillStyle = cs[Math.floor(h * cs.length)];
          ctx.beginPath();
          ctx.roundRect(x + 4, j * bh + 4, bw - 8, bh - 8, 6);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.08)";
          ctx.fillRect(x + 8, j * bh + 7, bw - 16, 5);
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

const asphaltTex = () =>
  canvasTexture(
    "agua-asphalt",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#4A4356";
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = hash(i * 3.1) > 0.5 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.12)";
        ctx.fillRect(hash(i) * W, hash(i * 1.7) * H, 3, 3);
      }
      ctx.strokeStyle = "rgba(20,14,28,0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(30, 40);
      ctx.lineTo(80, 70);
      ctx.lineTo(95, 120);
      ctx.lineTo(150, 140);
      ctx.moveTo(95, 120);
      ctx.lineTo(70, 170);
      ctx.stroke();
    },
    { wrapS: true, wrapT: true },
  );

const slabTex = () =>
  canvasTexture(
    "agua-sidewalk",
    128,
    128,
    (ctx, W, H) => {
      ctx.fillStyle = "#9A94A8";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#6E6880";
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, W - 4, H - 4);
    },
    { wrapS: true, wrapT: true },
  );

const crateTex = () =>
  canvasTexture("agua-crate", 256, 256, (ctx, W, H) => {
    ctx.fillStyle = "#6E4526";
    ctx.fillRect(0, 0, W, H);
    for (let j = 0; j < 4; j++) {
      ctx.fillStyle = j % 2 ? "#C08A52" : "#B57E48";
      ctx.fillRect(26, 20 + j * 55, W - 52, 48);
    }
    ctx.fillStyle = "#9C6A3A";
    ctx.fillRect(0, 0, W, 22);
    ctx.fillRect(0, H - 22, W, 22);
    ctx.fillRect(0, 0, 24, H);
    ctx.fillRect(W - 24, 0, 24, H);
    ctx.fillStyle = "#3A2A1E";
    for (const [x, y] of [
      [12, 12],
      [W - 12, 12],
      [12, H - 12],
      [W - 12, H - 12],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

const neonTex = () =>
  canvasTexture("agua-neon", 1024, 360, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.shadowColor = "#FF4FD8";
    ctx.shadowBlur = 34;
    ctx.lineWidth = 14;
    ctx.strokeStyle = "#FF8AE8";
    ctx.beginPath();
    ctx.roundRect(40, 40, W - 80, H - 80, 60);
    ctx.stroke();
    ctx.font = `170px ${FUN}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 12;
    ctx.strokeStyle = "#FF66E0";
    ctx.strokeText("OFERTAS", W / 2, H / 2 + 10);
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#FFE3F8";
    ctx.fillText("OFERTAS", W / 2, H / 2 + 10);
  });

const wantedTex = () =>
  canvasTexture("agua-wanted", 320, 420, (ctx, W, H) => {
    ctx.fillStyle = "#F3E3BF";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#8A6A3A";
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, W - 20, H - 20);
    text(ctx, "SE BUSCA", W / 2, 66, `62px ${TITLE}`, "#5A3A1A");
    ctx.fillStyle = "#2F8BFF";
    dropPath(ctx, W / 2, 210, 62);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(W / 2 - 22, 232, 10, 18, -0.4, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, "AGUA", W / 2, 330, `64px ${TITLE}`, "#1E5FCC");
    text(ctx, "RECOMPENSA", W / 2, 382, `800 30px ${HEAVY}`, "#5A3A1A");
  });

/** Neon flicker 0..1 (mostly on, with stutters). */
export const neonFlick = (t: number) => {
  const step = Math.floor(t * 12);
  const burst = Math.sin(t * 0.9 + 1) > 0.55 ? 1 : 0;
  return burst && hash(step * 1.3) < 0.55 ? 0.15 : 1;
};
/** The bare bulb's gentle flicker 0.75..1. */
export const bulbFlick = (t: number) => 0.88 + 0.08 * Math.sin(t * 9.3) + 0.04 * Math.sin(t * 23.1) - (hash(Math.floor(t * 10)) < 0.08 ? 0.3 : 0);

/** A wooden crate, `w × h × d`, origin at the bottom centre. */
export const Crate: React.FC<{ w?: number; h?: number; d?: number }> = ({ w = 0.7, h = 0.7, d = 0.7 }) => {
  const ready = useFontsReady();
  return (
    <mesh position={[0, h / 2, 0]} material={ready ? texMat("crate", crateTex, { rough: 0.8, glow: 0.12 }) : toy("#B57E48")} castShadow receiveShadow>
      <boxGeometry args={[w, h, d]} />
    </mesh>
  );
};

/** A lumpy black trash bag tied at the top (≈ 0.75 tall at scale 1, origin at the bottom). */
export const TrashBag: React.FC<{ seed?: number }> = ({ seed = 0 }) => {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.4, 26, 18);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const r = 1 + 0.12 * noise3(x * 4 + seed * 3, y * 4, z * 4);
      const yy = y < -0.2 ? -0.2 - (y + 0.2) * 0.25 : y;
      p.setXYZ(i, x * r, yy * r * 1.05, z * r);
    }
    g.computeVertexNormals();
    g.translate(0, 0.26, 0);
    return g;
  }, [seed]);
  const m = toy("#2B2F40", { rough: 0.22, glow: 0.1 });
  return (
    <group>
      <mesh geometry={geo} material={m} castShadow />
      <mesh material={m} position={[0, 0.7, 0]}>
        <coneGeometry args={[0.07, 0.16, 10]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={m} position={[s * 0.07, 0.8, 0]} rotation={[0, 0, -s * 0.7]} scale={[0.07, 0.03, 0.04]}>
          <sphereGeometry args={[1, 10, 6]} />
        </mesh>
      ))}
    </group>
  );
};

const pipe = () => toy("#6F8F86", { metal: 0.45, rough: 0.35, glow: 0.1 });

/**
 * The seller's dark alley: brick walls, pipes, an AC unit, crates and trash bags, a flickering
 * pink neon "OFERTAS" sign, a bare bulb over the crate counter (cloth on top), the street
 * facades with a "SE BUSCA AGUA" poster at the mouth, sidewalk and street towards +z.
 */
export const Alley: React.FC<{ t?: number }> = ({ t = 0 }) => {
  const ready = useFontsReady();
  const A = ALLEY;
  const len = A.mouth - A.back;
  const geos = useMemo(
    () => ({
      wall: uvScale(new THREE.PlaneGeometry(len, A.wallH), len / 2.6, A.wallH / 2.6),
      facade: uvScale(new THREE.PlaneGeometry(10, A.wallH), 10 / 2.6, A.wallH / 2.6),
      back: uvScale(new THREE.PlaneGeometry(A.half * 2, A.wallH), (A.half * 2) / 2.6, A.wallH / 2.6),
      floor: uvScale(new THREE.PlaneGeometry(A.half * 2, len), (A.half * 2) / 2.4, len / 2.4),
      walk: uvScale(new THREE.PlaneGeometry(26, 3.2), 26 / 1.2, 3.2 / 1.2),
      street: uvScale(new THREE.PlaneGeometry(26, 16), 26 / 3, 16 / 3),
    }),
    [len, A.wallH, A.half],
  );
  const brick = ready ? texMat("brick", brickTex, { rough: 0.85, glow: 0.1 }) : toy("#9A4A42");
  const facadeMat = useMemo(() => {
    const map = brickTex();
    return new THREE.MeshStandardMaterial({ map, color: "#C9B2E8", roughness: 0.85, emissive: new THREE.Color("#C9B2E8"), emissiveMap: map, emissiveIntensity: 0.1 });
  }, []);
  const asphalt = texMat("asphalt", asphaltTex, { rough: 0.9, glow: 0.08 });
  const walk = texMat("walk", slabTex, { rough: 0.85, glow: 0.1 });
  const neonMat = useMemo(() => additive(new THREE.MeshBasicMaterial({ map: neonTex(), toneMapped: false, side: THREE.DoubleSide })), []);
  const bulbMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#FFE9B0", emissive: new THREE.Color("#FFD27A"), emissiveIntensity: 2, toneMapped: false }), []);
  const nf = neonFlick(t);
  const bf = bulbFlick(t);
  neonMat.opacity = 0.25 + 0.75 * nf;
  bulbMat.emissiveIntensity = 0.6 + 1.8 * bf;
  const z0 = A.mouth;
  const zc = (A.mouth + A.back) / 2;
  return (
    <group>
      {/* Walls (facing into the alley), the back wall and the street facades. */}
      <mesh geometry={geos.wall} material={brick} position={[-A.half, A.wallH / 2, zc]} rotation={[0, Math.PI / 2, 0]} receiveShadow />
      <mesh geometry={geos.wall} material={brick} position={[A.half, A.wallH / 2, zc]} rotation={[0, -Math.PI / 2, 0]} receiveShadow />
      <mesh geometry={geos.back} material={brick} position={[0, A.wallH / 2, A.back]} receiveShadow />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={geos.facade} material={facadeMat} position={[s * (A.half + 5), A.wallH / 2, z0]} />
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} material={toy("#3B2E4E", { rough: 0.7 })} position={[s * (A.half + 0.12), A.wallH / 2, z0 + 0.12]}>
          <boxGeometry args={[0.28, A.wallH, 0.28]} />
        </mesh>
      ))}
      {/* Ground: alley asphalt, sidewalk with a curb, street. */}
      <mesh geometry={geos.floor} material={asphalt} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, zc]} receiveShadow />
      <mesh geometry={geos.walk} material={walk} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, z0 + 1.6]} receiveShadow />
      <mesh material={toy("#B9B3C6", { rough: 0.8 })} position={[0, 0.05, z0 + 3.2]}>
        <boxGeometry args={[26, 0.12, 0.2]} />
      </mesh>
      <mesh geometry={geos.street} material={asphalt} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, z0 + 11.2]} />
      {/* Back door with a little blue lamp. */}
      <mesh material={toy("#2B2238", { rough: 0.6 })} position={[0.6, 1.1, A.back + 0.06]}>
        <boxGeometry args={[1.1, 2.2, 0.1]} />
      </mesh>
      <mesh material={toy("#9FC4FF", { glow: 1.2 })} position={[0.6, 2.5, A.back + 0.15]}>
        <sphereGeometry args={[0.08, 12, 8]} />
      </mesh>
      <Glow color="#7FA8FF" size={1.2} opacity={0.6} position={[0.6, 2.5, A.back + 0.25]} />
      {/* Pipes along the right wall, a drain pipe on the left, the AC unit. */}
      <mesh material={pipe()} position={[A.half - 0.12, A.wallH / 2, -1.0]}>
        <cylinderGeometry args={[0.07, 0.07, A.wallH, 12]} />
      </mesh>
      <mesh material={pipe()} position={[A.half - 0.12, 2.9, -5.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 8.8, 12]} />
      </mesh>
      <mesh material={pipe()} position={[A.half - 0.1, 2.9, -1.0]}>
        <sphereGeometry args={[0.1, 12, 8]} />
      </mesh>
      <mesh material={pipe()} position={[A.half - 0.22, 4.6, -7.6]}>
        <cylinderGeometry args={[0.12, 0.12, 9.2, 14]} />
      </mesh>
      <mesh material={pipe()} position={[-A.half + 0.1, A.wallH / 2, -8.2]}>
        <cylinderGeometry args={[0.06, 0.06, A.wallH, 10]} />
      </mesh>
      <group position={[-A.half + 0.3, 3.6, -2.2]}>
        <mesh material={toy("#C9CED6", { rough: 0.5 })}>
          <boxGeometry args={[0.5, 0.6, 0.8]} />
        </mesh>
        <mesh material={toy("#3A3F4A", { rough: 0.5 })} position={[0.26, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22, 0.22, 0.04, 20]} />
        </mesh>
      </group>
      {/* Crates and trash bags along the walls. */}
      <group position={[-A.half + 0.45, 0, -6.4]} rotation={[0, 0.1, 0]}>
        <Crate />
        <group position={[0.05, 0.7, 0.02]} rotation={[0, -0.25, 0]}>
          <Crate w={0.6} h={0.6} d={0.6} />
        </group>
      </group>
      <group position={[-A.half + 0.5, 0, -5.4]} rotation={[0, -0.2, 0]}>
        <Crate w={0.6} h={0.55} d={0.6} />
      </group>
      <group position={[A.half - 0.5, 0, -8.6]} rotation={[0, 0.3, 0]}>
        <Crate w={0.75} h={0.75} d={0.75} />
      </group>
      <group position={[A.half - 0.55, 0, -6.9]}>
        <TrashBag seed={1} />
      </group>
      <group position={[A.half - 0.45, 0, -7.6]} scale={0.8} rotation={[0, 1, 0]}>
        <TrashBag seed={2} />
      </group>
      <group position={[-A.half + 0.5, 0, -1.1]} scale={0.9}>
        <TrashBag seed={3} />
      </group>
      <group position={[A.half - 0.5, 0, -1.9]} scale={0.75} rotation={[0, 2, 0]}>
        <TrashBag seed={4} />
      </group>
      {/* Neon blade sign sticking out of the left wall. */}
      <group position={[-A.half + 1.0, 3.3, -5.0]}>
        <mesh material={toy("#8E9BB3", { metal: 0.5 })} position={[-0.95, 0, 0]}>
          <boxGeometry args={[0.2, 0.06, 0.06]} />
        </mesh>
        <mesh material={toy("#1C1428", { rough: 0.5 })}>
          <boxGeometry args={[1.7, 0.62, 0.08]} />
        </mesh>
        {ready ? (
          <>
            <mesh material={neonMat} position={[0, 0, 0.05]} renderOrder={5}>
              <planeGeometry args={[1.7, 0.6]} />
            </mesh>
            <mesh material={neonMat} position={[0, 0, -0.05]} rotation={[0, Math.PI, 0]} renderOrder={5}>
              <planeGeometry args={[1.7, 0.6]} />
            </mesh>
          </>
        ) : null}
        <Glow color="#FF4FD8" size={2.4} opacity={0.35 * nf} position={[0, 0, 0.2]} />
      </group>
      {/* "SE BUSCA AGUA" poster at the mouth, a closed shutter on the left facade. */}
      {ready ? (
        <mesh material={texMat("wanted", wantedTex, { glow: 0.2 })} position={[A.half + 1.3, 1.65, z0 + 0.01]} rotation={[0, 0, 0.04]}>
          <planeGeometry args={[0.72, 0.95]} />
        </mesh>
      ) : null}
      <mesh material={toy("#8A8FA3", { metal: 0.4, rough: 0.4 })} position={[-A.half - 2.2, 1.2, z0 + 0.05]}>
        <boxGeometry args={[2.4, 2.4, 0.06]} />
      </mesh>
      {[0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1].map((y) => (
        <mesh key={y} material={toy("#6B7086", { metal: 0.4 })} position={[-A.half - 2.2, y, z0 + 0.09]}>
          <boxGeometry args={[2.36, 0.04, 0.03]} />
        </mesh>
      ))}
      {/* The counter: a crate with a purple cloth. */}
      <group position={ALLEY_COUNTER}>
        <Crate w={1.0} h={0.72} d={0.7} />
        <mesh material={toy("#5B2C83", { rough: 0.85, glow: 0.16 })} position={[0, 0.745, 0]} castShadow>
          <boxGeometry args={[1.12, 0.05, 0.82]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={toy("#5B2C83", { rough: 0.85, glow: 0.16 })} position={[s * 0.56, 0.62, 0]}>
            <boxGeometry args={[0.03, 0.26, 0.82]} />
          </mesh>
        ))}
      </group>
      {/* The bare bulb hanging over the counter. */}
      <group position={ALLEY_BULB}>
        <mesh material={toy("#1A1A22")} position={[0, 2.8, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 5.4, 5]} />
        </mesh>
        <mesh material={toy("#2F5D4A", { metal: 0.4, rough: 0.4, side: THREE.DoubleSide })} position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.1, 0.36, 0.26, 24, 1, true]} />
        </mesh>
        <mesh material={bulbMat}>
          <sphereGeometry args={[0.09, 14, 10]} />
        </mesh>
        <Glow color="#FFD27A" size={1.3} opacity={0.55 * bf} />
      </group>
    </group>
  );
};

/** Lights of the alley: dim purple fill, the warm bulb, the pink neon, cool street light. `k` scales the fill. */
export const AlleyLights: React.FC<{ t?: number; k?: number }> = ({ t = 0, k = 1 }) => {
  const bf = bulbFlick(t);
  const nf = neonFlick(t);
  return (
    <>
      <hemisphereLight args={["#9C8AD8", "#2A1F3A", 0.8 * k]} />
      <directionalLight position={[4, 9, 14]} intensity={0.9 * k} color="#C2CCFF" />
      <pointLight position={[ALLEY_BULB[0], ALLEY_BULB[1] - 0.2, ALLEY_BULB[2]]} intensity={11 * bf} distance={7} decay={1.3} color="#FFC77A" />
      <pointLight position={[-1.6, 3.0, -4.6]} intensity={5 * nf} distance={6} decay={1.4} color="#FF4FD8" />
      <pointLight position={[0.6, 2.6, ALLEY.back + 1.2]} intensity={3} distance={7} decay={1.4} color="#7FA8FF" />
    </>
  );
};

// =======================================================================================
// Safe

/** Safe body size (world units, without the feet). */
export const SAFE = { w: 1.1, h: 1.3, d: 0.95, feet: 0.07 };
/**
 * Where the bottle stands inside (safe space): <group position={SAFE_BOTTLE.position}
 * scale={SAFE_BOTTLE.scale}><WaterBottle /></group> as a child of <Safe>.
 */
export const SAFE_BOTTLE: Hold = { position: [0, SAFE.feet + 0.13, 0.05], rotation: [0, 0, 0], scale: 0.86 };

const dialTex = () =>
  canvasTexture("agua-dial", 256, 256, (ctx, W) => {
    const c = W / 2;
    const g = ctx.createRadialGradient(c, c * 0.8, 10, c, c, c);
    g.addColorStop(0, "#F2F5FA");
    g.addColorStop(1, "#A9B4C6");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1B2030";
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const l = i % 5 === 0 ? 26 : 14;
      ctx.lineWidth = i % 5 === 0 ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * (c - 8), c + Math.sin(a) * (c - 8));
      ctx.lineTo(c + Math.cos(a) * (c - 8 - l), c + Math.sin(a) * (c - 8 - l));
      ctx.stroke();
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      text(ctx, String(i * 10), c + Math.cos(a) * (c - 56), c + Math.sin(a) * (c - 56), `800 26px ${HEAVY}`, "#1B2030");
    }
  });

/** Fan of light streaks (additive). */
const godRaysTex = () =>
  canvasTexture("agua-godrays", 256, 256, (ctx, w) => {
    const c = w / 2;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const spread = i % 3 ? 0.05 : 0.09;
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.4, "rgba(255,255,255,0.35)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, c, a - spread, a + spread);
      ctx.closePath();
      ctx.fill();
    }
  });

/** Gradient along v (bright at v = 0) with soft side edges, for the light shaft. */
const shaftTex = () =>
  canvasTexture("agua-shaft", 64, 128, (ctx, W, H) => {
    for (let x = 0; x < W; x++) {
      const e = Math.sin((x / (W - 1)) * Math.PI);
      const g = ctx.createLinearGradient(0, H, 0, 0);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * e})`);
      g.addColorStop(0.6, `rgba(255,255,255,${0.25 * e})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 1, H);
    }
  });

/** Frustum of light from the safe's opening (4 sides, v = 0 at the opening). */
const shaftGeo = (near: [number, number, number, number], far: [number, number, number, number], z0: number, z1: number) => {
  const [nx0, nx1, ny0, ny1] = near;
  const [fx0, fx1, fy0, fy1] = far;
  const pos: number[] = [];
  const uv: number[] = [];
  const quad = (a: V3, b: V3, c: V3, d: V3) => {
    // a, b at the opening; d, c far.
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  };
  quad([nx0, ny1, z0], [nx1, ny1, z0], [fx1, fy1, z1], [fx0, fy1, z1]);
  quad([nx0, ny0, z0], [nx1, ny0, z0], [fx1, fy0, z1], [fx0, fy0, z1]);
  quad([nx0, ny0, z0], [nx0, ny1, z0], [fx0, fy1, z1], [fx0, fy0, z1]);
  quad([nx1, ny0, z0], [nx1, ny1, z0], [fx1, fy1, z1], [fx1, fy0, z1]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
};

/**
 * A chunky steel safe (1.1 wide, ≈ 1.37 tall, 0.95 deep; origin at the base centre, door to +z)
 * with a combination dial, a three-spoke handle wheel, rivets and bolts. `open` 0..1 swings the
 * door out (hinge on the screen-right side by default, `hinge` = −1 for the left); the dial and
 * the wheel spin while it unlocks (open 0..0.25). Light spills out of the opening (`glow`,
 * default = open): a shaft of light, god rays, a warm glow and a point light. Children are drawn
 * inside (see SAFE_BOTTLE).
 */
export const Safe: React.FC<{ open?: number; t?: number; glow?: number; hinge?: 1 | -1; children?: React.ReactNode }> = ({ open = 0, t = 0, glow, hinge = 1, children }) => {
  const { w, h, d, feet } = SAFE;
  const wall = 0.11;
  const geos = useMemo(
    () => ({
      back: new THREE.BoxGeometry(w, h, wall),
      side: new THREE.BoxGeometry(wall, h, d),
      lid: new THREE.BoxGeometry(w, wall, d),
      door: new THREE.BoxGeometry(w - 0.04, h - 0.04, 0.15),
      rim: new THREE.BoxGeometry(w + 0.04, 0.06, 0.06),
      rimV: new THREE.BoxGeometry(0.06, h + 0.04, 0.06),
      foot: new THREE.BoxGeometry(0.16, feet, 0.16),
      rivet: new THREE.SphereGeometry(0.022, 8, 6),
      hingeC: new THREE.CylinderGeometry(0.045, 0.045, 0.22, 12),
      bolt: new THREE.CylinderGeometry(0.035, 0.035, 0.14, 10),
      spoke: new THREE.CylinderGeometry(0.018, 0.018, 0.2, 8),
      ball: new THREE.SphereGeometry(0.038, 10, 8),
      shaft: shaftGeo([-0.42, 0.42, feet + 0.13, feet + h - 0.12], [-1.25, 1.25, -0.2, 2.2], d / 2, d / 2 + 2.3),
    }),
    [w, h, d, feet],
  );
  const steel = toy("#5A6B86", { metal: 0.55, rough: 0.3, glow: 0.14 });
  const steelDark = toy("#384257", { metal: 0.55, rough: 0.35, glow: 0.12 });
  const inside = toy("#202536", { rough: 0.7, glow: 0.05 });
  const fx = useMemo(
    () => ({
      rays: additive(new THREE.SpriteMaterial({ map: godRaysTex(), color: "#FFF2C0", toneMapped: false })),
      shaft: additive(new THREE.MeshBasicMaterial({ map: shaftTex(), color: "#FFF0C4", side: THREE.DoubleSide, toneMapped: false })),
      dial: new THREE.MeshStandardMaterial({ map: dialTex(), roughness: 0.3, metalness: 0.3, emissive: new THREE.Color("#FFFFFF"), emissiveMap: dialTex(), emissiveIntensity: 0.15 }),
    }),
    [],
  );
  const o = clamp01(open);
  const unlock = clamp01(o / 0.25);
  const swing = clamp01((o - 0.2) / 0.8);
  const ease = swing * swing * (3 - 2 * swing);
  const ang = hinge * ease * 1.95;
  const g = clamp01(glow ?? o) * clamp01(swing * 2.5);
  fx.rays.opacity = 0.5 * g;
  fx.rays.rotation = t * 0.3;
  fx.shaft.opacity = 0.38 * g;
  const yc = feet + h / 2;
  const dw = w - 0.04;
  const rivets: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const v = -0.5 + i / 4;
    rivets.push([v * (dw - 0.12), (h - 0.16) / 2], [v * (dw - 0.12), -(h - 0.16) / 2], [(dw - 0.12) / 2, v * (h - 0.16)], [-(dw - 0.12) / 2, v * (h - 0.16)]);
  }
  return (
    <group>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => <mesh key={`${sx}${sz}`} geometry={geos.foot} material={steelDark} position={[sx * (w / 2 - 0.12), feet / 2, sz * (d / 2 - 0.12)]} />),
      )}
      {/* Hollow body. */}
      <mesh geometry={geos.back} material={steel} position={[0, yc, -d / 2 + wall / 2]} castShadow />
      <mesh geometry={geos.side} material={steel} position={[-w / 2 + wall / 2, yc, 0]} castShadow />
      <mesh geometry={geos.side} material={steel} position={[w / 2 - wall / 2, yc, 0]} castShadow />
      <mesh geometry={geos.lid} material={steel} position={[0, feet + h - wall / 2, 0]} castShadow />
      <mesh geometry={geos.lid} material={steel} position={[0, feet + wall / 2, 0]} />
      <mesh material={inside} position={[0, yc, -d / 2 + wall + 0.005]}>
        <planeGeometry args={[w - 2 * wall, h - 2 * wall]} />
      </mesh>
      {/* Front rim. */}
      {[-1, 1].map((s) => (
        <mesh key={`h${s}`} geometry={geos.rim} material={steelDark} position={[0, yc + s * (h / 2 - 0.01), d / 2 - 0.02]} />
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`v${s}`} geometry={geos.rimV} material={steelDark} position={[s * (w / 2 - 0.01), yc, d / 2 - 0.02]} />
      ))}
      {/* Hinges on the hinge side. */}
      {[-0.35, 0.35].map((dy) => (
        <mesh key={dy} geometry={geos.hingeC} material={steelDark} position={[hinge * (w / 2 + 0.02), yc + dy * h, d / 2 + 0.04]} />
      ))}
      {/* The door, pivoting on the hinge edge. */}
      <group position={[hinge * (w / 2), yc, d / 2 + 0.075]} rotation={[0, ang, 0]}>
        <group position={[-hinge * (dw / 2 + 0.01), 0, 0]}>
          <mesh geometry={geos.door} material={steel} castShadow />
          <mesh material={inside} position={[0, 0, -0.077]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[dw - 0.1, h - 0.14]} />
          </mesh>
          {rivets.map(([x, y], i) => (
            <mesh key={i} geometry={geos.rivet} material={steelDark} position={[x, y, 0.075]} />
          ))}
          {/* Combination dial. */}
          <group position={[0, 0.17, 0.075]}>
            <mesh material={steelDark} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.015]}>
              <cylinderGeometry args={[0.2, 0.21, 0.03, 32]} />
            </mesh>
            <mesh material={fx.dial} position={[0, 0, 0.034]} rotation={[0, 0, unlock * Math.PI * 3 + 0.3]}>
              <circleGeometry args={[0.17, 40]} />
            </mesh>
            <mesh material={steelDark} position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.055, 0.06, 0.05, 20]} />
            </mesh>
            <mesh material={toy("#E8323A", { glow: 0.3 })} position={[0, 0.205, 0.03]}>
              <coneGeometry args={[0.025, 0.04, 3]} />
            </mesh>
          </group>
          {/* Handle wheel. */}
          <group position={[0, -0.27, 0.11]} rotation={[0, 0, unlock * Math.PI * 0.6]}>
            <mesh material={steelDark} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.08, 16]} />
            </mesh>
            {[0, 1, 2].map((i) => {
              const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
              return (
                <group key={i} rotation={[0, 0, a]}>
                  <mesh geometry={geos.spoke} material={toy("#C9D2DE", { metal: 0.7, rough: 0.25 })} position={[0, 0.1, 0.01]} />
                  <mesh geometry={geos.ball} material={toy("#C9D2DE", { metal: 0.7, rough: 0.25 })} position={[0, 0.2, 0.01]} />
                </group>
              );
            })}
          </group>
          {/* Brass plate. */}
          <mesh material={gold()} position={[0, 0.48, 0.08]}>
            <boxGeometry args={[0.36, 0.08, 0.012]} />
          </mesh>
          {/* Locking bolts on the free edge. */}
          {[-0.35, 0, 0.35].map((dy) => (
            <mesh key={dy} geometry={geos.bolt} material={toy("#C9D2DE", { metal: 0.7, rough: 0.25 })} position={[-hinge * (dw / 2 + 0.04 - 0.05 * unlock), dy * h, 0]} rotation={[0, 0, Math.PI / 2]} />
          ))}
        </group>
      </group>
      {/* Inside: whatever it holds, and the light spilling out. */}
      {children}
      {g > 0.01 ? (
        <>
          <mesh geometry={geos.shaft} material={fx.shaft} renderOrder={6} />
          <sprite material={fx.rays} position={[0, yc, d / 2 + 0.1]} scale={[3.2 * g, 3.2 * g, 1]} renderOrder={6} />
          <Glow color="#FFE9A8" size={2.0 * g} opacity={0.45 * g} position={[0, yc, d / 2]} />
          <Glow color="#FFFFFF" size={0.7 * g} opacity={0.35 * g} position={[0, yc, d / 2 - 0.1]} />
          <pointLight position={[0, yc, d / 2 + 0.4]} intensity={6 * g} distance={5} decay={1.3} color="#FFE6B0" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const ph = (t * 0.35 + hash(i) ) % 1;
            return (
              <Twinkle
                key={i}
                position={[(hash(i * 3) - 0.5) * 1.4, yc + (hash(i * 5) - 0.4) * 1.2 + ph * 0.5, d / 2 + 0.3 + ph * 1.6]}
                size={0.14 * g * Math.sin(ph * Math.PI)}
                opacity={g}
                color="#FFF6C8"
                spin={t + i}
              />
            );
          })}
        </>
      ) : null}
    </group>
  );
};

// =======================================================================================
// The seller's outfit

// Sleeve geometry round Nubi's rounded body (as in the oxygen short's lab coat), with an
// optional opening at the front (|x| < gap on the front face).
type RingPt = { x: number; z: number; nx: number; nz: number };

const ringPath = (seg: number, gap: number): RingPt[] => {
  const { a, b, r } = NUBI_BODY;
  const pts: RingPt[] = [{ x: gap, z: b, nx: 0, nz: 1 }];
  const corner = (cx: number, cz: number, a0: number, a1: number) => {
    for (let i = 0; i <= seg; i++) {
      const t = a0 + (a1 - a0) * (i / seg);
      pts.push({ x: cx + r * Math.cos(t), z: cz + r * Math.sin(t), nx: Math.cos(t), nz: Math.sin(t) });
    }
  };
  corner(a - r, b - r, Math.PI / 2, 0);
  corner(a - r, -(b - r), 0, -Math.PI / 2);
  corner(-(a - r), -(b - r), -Math.PI / 2, -Math.PI);
  corner(-(a - r), b - r, -Math.PI, -Math.PI * 1.5);
  pts.push({ x: -gap, z: b, nx: 0, nz: 1 });
  return pts;
};

type Sleeve = { y0: number; y1: number; t0: number; t1: number; bulge?: number; rows?: number; gap?: number };

const sleeveT = (s: Sleeve, y: number) => {
  const v = clamp01((y - s.y0) / (s.y1 - s.y0));
  return s.t0 + (s.t1 - s.t0) * v + (s.bulge ?? 0) * Math.sin(Math.PI * v);
};

const sleeveGeometry = (s: Sleeve) => {
  const rows = s.rows ?? 5;
  const bulge = s.bulge ?? 0;
  const path = ringPath(8, s.gap ?? 0);
  const N = path.length;
  const H = s.y1 - s.y0;
  const pos: number[] = [];
  const nrm: number[] = [];
  const idx: number[] = [];
  const tAt = (v: number) => s.t0 + (s.t1 - s.t0) * v + bulge * Math.sin(Math.PI * v);
  const slope = (v: number) => (s.t1 - s.t0 + bulge * Math.PI * Math.cos(Math.PI * v)) / H;
  const n = new THREE.Vector3();
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    const t = tAt(v);
    const k = slope(v);
    for (const p of path) {
      pos.push(p.x + p.nx * t, s.y0 + H * v, p.z + p.nz * t);
      n.set(p.nx, -k, p.nz).normalize();
      nrm.push(n.x, n.y, n.z);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < N - 1; i++) {
      const A = j * N + i;
      idx.push(A, A + 1, A + N + 1, A, A + N + 1, A + N);
    }
  }
  const cap = (y: number, tOut: number, up: boolean) => {
    const base = pos.length / 3;
    for (const p of path) {
      pos.push(p.x + p.nx * tOut, y, p.z + p.nz * tOut, p.x - p.nx * 0.4, y, p.z - p.nz * 0.4);
      nrm.push(0, up ? 1 : -1, 0, 0, up ? 1 : -1, 0);
    }
    for (let i = 0; i < N - 1; i++) {
      const o = base + i * 2;
      if (up) idx.push(o, o + 2, o + 3, o, o + 3, o + 1);
      else idx.push(o, o + 3, o + 2, o, o + 1, o + 3);
    }
  };
  cap(s.y1, tAt(1), true);
  cap(s.y0, tAt(0), false);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
};

const extrude = (shape: THREE.Shape, depth: number, bevel = 0.06) =>
  new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 16 });

export const COAT = "#D9B67C";
const COAT_SHADE = "#B8925A";
const HAT = "#4A3E36";
/** The seller: a dark grey-purple Nubi (fins in the coat's sleeves) at size 2.2. */
export const SELLER_SIZE = 2.2;
export const SELLER_PALETTE: NubiPalette = { body: "#5C5072", fins: "#C9A46C", legs: "#4A405C" };

const SKIRT: Sleeve = { y0: 0.85, y1: 4.75, t0: 0.95, t1: 0.22, bulge: 0.12, rows: 8 };
const BELT = { y0: 2.55, y1: 3.05 };
const coatT = (y: number) => sleeveT(SKIRT, y) + (y > BELT.y0 && y < BELT.y1 ? 0.09 : 0);

/** Tear stream path down the coat front (model units), side ±1. */
const tearCurve = (s: number) =>
  new THREE.CatmullRomCurve3(
    [4.72, 4.4, 3.9, 3.3, 2.8, 2.3, 1.7, 1.15, 0.9].map((y, i) => new THREE.Vector3(s * (2.3 + 0.12 * Math.sin(i * 1.7)), y, NUBI_BODY.front + coatT(y) + 0.1)),
  );

/**
 * The shady seller's outfit (child of <Nubi hideEyes palette={SELLER_PALETTE}>, model units):
 * a long beige trench coat (flared skirt down to y 0.85 with the leg tips poking out, belt
 * with a buckle, double-breasted buttons, pocket flaps), the collar turned up round the lower
 * face (open at the front, |x| < 3.3), a fedora tilted forward, and dark sunglasses over the
 * eyes (lenses at x ±2.3, y ≈ 5.45, glints). `tears` 0..1: streams run from under the glasses
 * down the coat (0..0.4 they reach the hem, drops fall), above 0.5 he sobs: fountains of tears
 * arc out sideways. `t` = seconds (the tears flow).
 */
export const SellerOutfit: React.FC<{ tears?: number; t?: number }> = ({ tears = 0, t = 0 }) => {
  const F = NUBI_BODY.front;
  const geos = useMemo(() => {
    const lens = new THREE.Shape();
    lens.moveTo(-0.95, 0.55);
    lens.lineTo(0.95, 0.62);
    lens.quadraticCurveTo(1.0, -0.2, 0.75, -0.55);
    lens.quadraticCurveTo(0.0, -0.85, -0.75, -0.55);
    lens.quadraticCurveTo(-1.0, -0.2, -0.95, 0.55);
    const lensGeo = extrude(lens, 0.12, 0.07);
    const crown = new THREE.LatheGeometry(
      (
        [
          [0, 2.05],
          [0.9, 2.18],
          [2.2, 2.42],
          [3.0, 2.3],
          [3.35, 1.7],
          [3.55, 0.6],
          [3.62, 0],
        ] as [number, number][]
      ).map(([r, y]) => new THREE.Vector2(r, y)),
      40,
    );
    const brimShape = new THREE.Shape();
    brimShape.absellipse(0, 0, 5.3, 4.8, 0, Math.PI * 2, false, 0);
    const hole = new THREE.Path();
    hole.absellipse(0, 0, 3.4, 3.0, 0, Math.PI * 2, true, 0);
    brimShape.holes.push(hole);
    const brim = extrude(brimShape, 0.18, 0.1);
    brim.rotateX(-Math.PI / 2);
    // Snap brim: down at the front, curled up at the sides and back.
    const p = brim.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const r = Math.hypot(x / 5.3, z / 4.8);
      const out = Math.max(0, r - 0.6) / 0.4;
      const front = z > 0 ? -z / 4.8 : 0;
      const side = Math.abs(x) / 5.3;
      p.setY(i, p.getY(i) + out * out * (0.8 * side + 0.4 * Math.max(0, -z / 4.8)) + front * out * 0.6);
    }
    brim.computeVertexNormals();
    return {
      skirt: sleeveGeometry(SKIRT),
      belt: sleeveGeometry({ y0: BELT.y0, y1: BELT.y1, t0: sleeveT(SKIRT, BELT.y0) + 0.09, t1: sleeveT(SKIRT, BELT.y1) + 0.09, rows: 2 }),
      collar: sleeveGeometry({ y0: 4.45, y1: 7.35, t0: 0.32, t1: 0.85, bulge: 0.1, rows: 6, gap: 3.3 }),
      lens: lensGeo,
      crown,
      band: new THREE.CylinderGeometry(3.6, 3.63, 0.62, 40, 1, true),
      brim,
      button: new THREE.CylinderGeometry(0.26, 0.26, 0.14, 18),
      drop: new THREE.SphereGeometry(1, 12, 10),
      streamL: new THREE.TubeGeometry(tearCurve(-1), 48, 0.13, 8, false),
      streamR: new THREE.TubeGeometry(tearCurve(1), 48, 0.13, 8, false),
      curveL: tearCurve(-1),
      curveR: tearCurve(1),
    };
  }, []);
  const coat = toy(COAT, { rough: 0.7, glow: 0.14, side: THREE.DoubleSide });
  const shade = toy(COAT_SHADE, { rough: 0.7, glow: 0.12, side: THREE.DoubleSide });
  const hat = toy(HAT, { rough: 0.6, glow: 0.12, side: THREE.DoubleSide });
  const lensMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#171320", roughness: 0.12, metalness: 0.35, emissive: new THREE.Color("#3B2A6E"), emissiveIntensity: 0.28 }),
    [],
  );
  const glint = useMemo(() => additive(new THREE.MeshBasicMaterial({ color: "#FFFFFF", opacity: 0.8, toneMapped: false })), []);
  const water = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#5CC8FF", roughness: 0.12, emissive: new THREE.Color("#2FA8FF"), emissiveIntensity: 0.45, transparent: true, opacity: 0.92 }),
    [],
  );
  const frame = toy("#111018", { rough: 0.25, metal: 0.3 });
  const tr = clamp01(tears);
  const reveal = clamp01(tr / 0.4);
  const segs = Math.round(reveal * 48);
  geos.streamL.setDrawRange(0, segs * 8 * 6);
  geos.streamR.setDrawRange(0, segs * 8 * 6);
  const sob = clamp01((tr - 0.5) / 0.5);
  const drops: React.ReactNode[] = [];
  if (tr > 0.01) {
    for (const s of [-1, 1]) {
      const curve = s < 0 ? geos.curveL : geos.curveR;
      // Blobs running down the stream.
      for (let i = 0; i < 3; i++) {
        const u = ((t * 0.9 + i / 3) % 1) * reveal;
        const q = curve.getPointAt(u);
        drops.push(<mesh key={`r${s}${i}`} geometry={geos.drop} material={water} position={[q.x, q.y, q.z + 0.04]} scale={0.19} />);
      }
      // Drips off the hem.
      if (reveal >= 1) {
        const end = curve.getPointAt(1);
        for (let i = 0; i < 2; i++) {
          const ph = (t * 1.4 + i * 0.5 + (s > 0 ? 0.25 : 0)) % 1;
          drops.push(<mesh key={`d${s}${i}`} geometry={geos.drop} material={water} position={[end.x, end.y - 0.15 - 5 * ph * ph, end.z + 0.1 + ph * 0.3]} scale={[0.15, 0.2, 0.15]} />);
        }
      }
      // Sobbing: fountains arcing out sideways from under the glasses.
      if (sob > 0) {
        for (let i = 0; i < 10; i++) {
          const u = (t * 1.7 + i / 10) % 1;
          const T = 0.85 * u;
          const x = s * (3.2 + 6.2 * sob * T);
          const y = 4.9 + 5.0 * sob * T - 0.5 * 13 * T * T;
          const z = F + 0.6 + 2.6 * sob * T;
          const sc = (0.3 - 0.12 * u) * Math.min(1, sob * 2);
          drops.push(<mesh key={`f${s}${i}`} geometry={geos.drop} material={water} position={[x, y, z]} scale={sc} />);
        }
      }
    }
  }
  return (
    <group>
      {/* Trench coat. */}
      <mesh geometry={geos.skirt} material={coat} castShadow />
      <mesh geometry={geos.belt} material={shade} />
      <mesh geometry={geos.collar} material={coat} castShadow />
      <group position={[0, 2.8, F + coatT(2.8) + 0.06]}>
        <mesh material={toy("#8A6A2A", { metal: 0.5, rough: 0.3 })}>
          <boxGeometry args={[0.95, 0.66, 0.1]} />
        </mesh>
        <mesh material={shade} position={[0, 0, 0.04]}>
          <boxGeometry args={[0.6, 0.36, 0.08]} />
        </mesh>
      </group>
      <mesh material={shade} position={[1.2, 2.55, F + coatT(2.55) + 0.06]} rotation={[0, 0, -0.35]}>
        <boxGeometry args={[0.36, 0.95, 0.08]} />
      </mesh>
      {[-1.15, 1.15].map((x) =>
        [1.8, 3.65].map((y) => (
          <mesh key={`${x}${y}`} geometry={geos.button} material={toy("#5A3A22", { rough: 0.4 })} position={[x, y, F + coatT(y) + 0.04]} rotation={[Math.PI / 2 - 0.15, 0, 0]} />
        )),
      )}
      {[-1, 1].map((s) => (
        <mesh key={s} material={shade} position={[s * 3.5, 1.75, F + coatT(1.75) + 0.05]} rotation={[-0.2, 0, s * 0.18]}>
          <boxGeometry args={[1.6, 0.35, 0.1]} />
        </mesh>
      ))}
      {/* Sunglasses: brow bar, two lenses, bridge, temples, glints. */}
      <mesh material={frame} position={[0, 6.05, F + 0.2]}>
        <boxGeometry args={[5.4, 0.3, 0.26]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 2.3, 5.45, F + 0.12]}>
          <mesh geometry={geos.lens} material={lensMat} />
          <mesh material={glint} position={[-0.38, 0.12, 0.2]} rotation={[0, 0, -0.75]} renderOrder={4}>
            <planeGeometry args={[0.16, 0.9]} />
          </mesh>
          <mesh material={glint} position={[-0.08, 0.05, 0.2]} rotation={[0, 0, -0.75]} renderOrder={4}>
            <planeGeometry args={[0.07, 0.7]} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`t${s}`} material={frame} position={[s * 5.08, 5.95, 2.6]}>
          <boxGeometry args={[0.16, 0.2, 3.8]} />
        </mesh>
      ))}
      {/* Fedora, tilted forward. */}
      <group position={[0, 9.75, -0.15]} rotation={[0.12, 0, -0.06]}>
        <mesh geometry={geos.crown} material={hat} position={[0, 0.25, 0]} scale={[1, 1.3, 0.9]} castShadow />
        <mesh geometry={geos.band} material={toy("#1E1820", { rough: 0.5 })} position={[0, 0.6, 0]} scale={[1.01, 1, 0.91]} />
        <mesh geometry={geos.brim} material={hat} position={[0, 0.2, 0]} castShadow />
      </group>
      {/* Tears. */}
      {segs > 0 ? (
        <>
          <mesh geometry={geos.streamL} material={water} />
          <mesh geometry={geos.streamR} material={water} />
        </>
      ) : null}
      {drops}
    </group>
  );
};

/** The seller: <Nubi> in his palette, eyes hidden behind the sunglasses, wearing SellerOutfit. */
export const Seller: React.FC<{
  pose?: NubiPose;
  tears?: number;
  t?: number;
  position?: V3;
  rotationY?: number;
  size?: number;
  holdR?: React.ReactNode;
  holdL?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ pose, tears = 0, t = 0, position, rotationY, size = SELLER_SIZE, holdR, holdL, children }) => (
  <Nubi size={size} position={position} rotationY={rotationY} pose={pose} palette={SELLER_PALETTE} hideEyes holdR={holdR} holdL={holdL}>
    <SellerOutfit tears={tears} t={t} />
    {children}
  </Nubi>
);

// =======================================================================================
// Coins, the portrait, a pencil

/** A "sol" coin, lying flat (axis = y), origin at the bottom centre. */
export const COIN = { r: 0.15, h: 0.04 };

const coinTex = () =>
  canvasTexture("agua-coin", 256, 256, (ctx, W) => {
    const c = W / 2;
    const g = ctx.createRadialGradient(c * 0.8, c * 0.7, 10, c, c, c);
    g.addColorStop(0, "#FFF2A8");
    g.addColorStop(0.55, "#F7C531");
    g.addColorStop(1, "#C98A00");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#A86A00";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(c, c, c - 20, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ctx.fillStyle = "#B87A00";
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * (c - 10), c + Math.sin(a) * (c - 10), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    text(ctx, "S/1", c, c + 8, `110px ${TITLE}`, "#FFE680", "#A86A00", 10);
  });

export const Coin: React.FC = () => {
  const ready = useFontsReady();
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(COIN.r, COIN.r, COIN.h, 40);
    // Turn the cap UVs so "S/1" reads upright from the front (+z) when the coin lies flat.
    g.rotateY(Math.PI / 2);
    g.translate(0, COIN.h / 2, 0);
    return g;
  }, []);
  const edge = toy("#D99A0A", { metal: 0.6, rough: 0.28, glow: 0.22 });
  const face = ready ? texMat("coin", coinTex, { metal: 0.45, rough: 0.3, glow: 0.25 }) : gold();
  return <mesh geometry={geo} material={[edge, face, face]} castShadow />;
};

/** The portrait sheet: 0.6 × 0.78 at scale 1, centred at the origin, facing +z, slightly curled. */
export const PAPER = { w: 0.6, h: 0.78 };

const sketchTex = () =>
  canvasTexture("agua-sketch", 384, 512, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(60,60,80,0.55)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    const cx = W / 2;
    // A quick sketch of the seller: hat, square face, sunglasses, collar.
    ctx.beginPath();
    ctx.moveTo(cx - 140, 170);
    ctx.quadraticCurveTo(cx, 140, cx + 140, 170);
    ctx.moveTo(cx - 80, 160);
    ctx.quadraticCurveTo(cx - 70, 70, cx, 80);
    ctx.quadraticCurveTo(cx + 70, 70, cx + 80, 160);
    ctx.rect(cx - 110, 180, 220, 210);
    ctx.moveTo(cx - 95, 250);
    ctx.lineTo(cx - 10, 250);
    ctx.lineTo(cx - 20, 295);
    ctx.lineTo(cx - 85, 295);
    ctx.closePath();
    ctx.moveTo(cx + 95, 250);
    ctx.lineTo(cx + 10, 250);
    ctx.lineTo(cx + 20, 295);
    ctx.lineTo(cx + 85, 295);
    ctx.closePath();
    ctx.moveTo(cx - 150, 470);
    ctx.lineTo(cx - 110, 330);
    ctx.moveTo(cx + 150, 470);
    ctx.lineTo(cx + 110, 330);
    ctx.stroke();
    ctx.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 100 + i * 22, 400);
      ctx.lineTo(cx - 80 + i * 22, 440);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(60,60,80,0.3)";
    ctx.strokeRect(14, 14, W - 28, H - 28);
  });

/**
 * A sheet of drawing paper (0.6 × 0.78, centred, facing +z, a little curl). `sketch` 0..1
 * fades in a faint pencil sketch of the seller on the front (the real drawing is a 2D overlay).
 */
export const PortraitPaper: React.FC<{ sketch?: number }> = ({ sketch = 1 }) => {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(PAPER.w, PAPER.h, 12, 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / (PAPER.w / 2);
      const v = p.getY(i) / (PAPER.h / 2);
      p.setZ(i, -0.03 * u * u + 0.012 * Math.max(0, v) * u);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const paper = toy("#FFFDF4", { rough: 0.85, glow: 0.22 });
  const back = toy("#F1EEE2", { rough: 0.85, glow: 0.18 });
  const sk = useMemo(() => new THREE.MeshBasicMaterial({ map: sketchTex(), transparent: true, depthWrite: false }), []);
  sk.opacity = clamp01(sketch);
  return (
    <group>
      <mesh geometry={geo} material={paper} castShadow />
      <mesh geometry={geo} material={back} rotation={[0, Math.PI, 0]} position={[0, 0, -0.002]} />
      {sketch > 0.01 ? <mesh geometry={geo} material={sk} position={[0, 0, 0.003]} renderOrder={2} /> : null}
    </group>
  );
};

/**
 * In a fin, shown to the front (child of <Upright raise={finR}> in holdR; mirror x for holdL):
 * the sheet stands up beside the fin tip, ≈ 0.6 × 0.78 world units for Nubi at size 2.
 */
export const PAPER_HOLD: Hold = { position: [0.8, 1.9, 1.2], rotation: [-0.08, -0.1, 0.06], scale: 5 };
export const PAPER_HOLD_L: Hold = { position: [-0.8, 1.9, 1.2], rotation: [-0.08, 0.1, -0.06], scale: 5 };
/** Pressed against the front of the body (a <Nubi> child, model units), drawing facing out: the hug. */
export const PAPER_HUG: Hold = { position: [0, 4.0, NUBI_BODY.front + 1.3], rotation: [-0.12, 0, 0.08], scale: 5.4 };
/** Lying on the counter (world units, add ALLEY_COUNTER and ALLEY_TABLE_TOP). */
export const PAPER_FLAT: Hold = { position: [0, 0.006, 0], rotation: [-Math.PI / 2, 0, 0.2], scale: 1 };

/** A yellow pencil, 0.42 long along y with the point down (origin at the middle). */
export const Pencil: React.FC = () => (
  <group>
    <mesh material={toy("#FFC21A", { rough: 0.45, glow: 0.2 })}>
      <cylinderGeometry args={[0.022, 0.022, 0.3, 6]} />
    </mesh>
    <mesh material={toy("#C9D2DE", { metal: 0.6, rough: 0.3 })} position={[0, 0.17, 0]}>
      <cylinderGeometry args={[0.024, 0.024, 0.04, 12]} />
    </mesh>
    <mesh material={toy("#FF7FA8", { rough: 0.6 })} position={[0, 0.205, 0]}>
      <cylinderGeometry args={[0.022, 0.022, 0.035, 12]} />
    </mesh>
    <mesh material={toy("#F2D2A0", { rough: 0.7 })} position={[0, -0.18, 0]} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[0.022, 0.06, 6]} />
    </mesh>
    <mesh material={toy("#2A2A33")} position={[0, -0.215, 0]} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[0.008, 0.02, 6]} />
    </mesh>
  </group>
);

/** In the right fin (inside <Upright>), point down and forward, ready to scribble. */
export const PENCIL_HOLD: Hold = { position: [0.2, 0.6, 1.3], rotation: [0.5, 0, 0.5], scale: 5 };

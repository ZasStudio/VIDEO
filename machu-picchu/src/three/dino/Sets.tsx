import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm, mulberry, smoothstep } from "../noise";
import { V3, canvasTexture, noise3, paintGeo, shadeHex, toy, useFontsReady, useRounded, vertexMat } from "../inca/kit";
import { Halo, Smoke } from "../oxigeno/Props";
import { drawPizzaSlice } from "./Props";

// Sets for the dinosaur short. Each is centred at the origin with the ground at y = 0, in world
// units sized for Nubi at size ≈ 2 (2 wide, 2 tall). `t` is time in seconds (frame / fps).
// Scale reference: the giant T-Rex is ≈ 7 tall (3.5 × Nubi), a Brachiosaurus ≈ 14.

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const TITLE = "'Luckiest Guy', 'Lilita One', sans-serif";

const texMatCache = new Map<THREE.Texture, THREE.MeshStandardMaterial>();
/** Material for a canvas texture (emissive map keeps colours bright). Cached per texture. */
const texMat = (tex: THREE.Texture, rough = 0.6, glow = 0.14, transparent = false) => {
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
    });
    texMatCache.set(tex, m);
  }
  return m;
};

/** A texture with its own repeat (a clone of a cached canvas texture). */
const repeated = (tex: THREE.Texture, rx: number, ry: number) => {
  const c = tex.clone();
  c.repeat.set(rx, ry);
  c.needsUpdate = true;
  return c;
};

/** Merges geometries after making them non-indexed without uvs (vertex-coloured meshes). */
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
  g.applyMatrix4(
    new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale)),
  );
  return g;
};

const box = (w: number, h: number, d: number, r = 0.06) => new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w / 2, h / 2, d / 2));

// =======================================================================================
// City textures

const asphaltTexture = () =>
  canvasTexture(
    "dino-asphalt",
    512,
    512,
    (ctx, W, H) => {
      // One tile = the 7.2-wide road × 8 units of length.
      ctx.fillStyle = "#4A505E";
      ctx.fillRect(0, 0, W, H);
      const rnd = mulberry(12);
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.08)";
        ctx.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 3, 2 + rnd() * 3);
      }
      // Centre line: two yellow dashes per tile; white edge lines near the curbs.
      ctx.fillStyle = "#FFD23F";
      for (const y of [0.1, 0.6]) ctx.fillRect(W / 2 - 7, y * H, 14, 0.28 * H);
      ctx.fillStyle = "#EEF1F5";
      ctx.fillRect(18, 0, 9, H);
      ctx.fillRect(W - 27, 0, 9, H);
    },
    { wrapS: true, wrapT: true },
  );

const pavementTexture = () =>
  canvasTexture(
    "dino-pavement",
    256,
    256,
    (ctx, W, H) => {
      ctx.fillStyle = "#AEB4C0";
      ctx.fillRect(0, 0, W, H);
      for (let j = 0; j < 2; j++) {
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = (i + j) % 2 ? "#D6DAE2" : "#CBD0DA";
          ctx.beginPath();
          ctx.roundRect(i * 128 + 4, j * 128 + 4, 120, 120, 12);
          ctx.fill();
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

const stripeTexture = (a: string, b: string, scallop: boolean) =>
  canvasTexture(`dino-awning|${a}|${b}|${scallop}`, 256, scallop ? 96 : 64, (ctx, W, H) => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? b : a;
      ctx.fillRect((i * W) / n, 0, W / n + 1, H);
    }
    if (scallop) {
      // Cut round scallops out of the bottom edge (alpha-tested).
      ctx.globalCompositeOperation = "destination-out";
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.arc(((i + 0.5) * W) / n + W / n / 2, H + 6, W / n / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }
  });

type SignIcon = "pizza" | "cross" | "cone" | "star" | "film" | "bone" | "bread";

const drawIcon = (ctx: CanvasRenderingContext2D, icon: SignIcon, x: number, y: number, s: number, fg: string) => {
  ctx.save();
  if (icon === "pizza") drawPizzaSlice(ctx, x, y, s);
  if (icon === "cross") {
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(x - s * 0.45, y - s * 0.45, s * 0.9, s * 0.9, s * 0.18);
    ctx.fill();
    ctx.fillStyle = "#1FB35A";
    ctx.fillRect(x - s * 0.13, y - s * 0.36, s * 0.26, s * 0.72);
    ctx.fillRect(x - s * 0.36, y - s * 0.13, s * 0.72, s * 0.26);
  }
  if (icon === "cone") {
    ctx.fillStyle = "#E9B169";
    ctx.beginPath();
    ctx.moveTo(x - s * 0.22, y);
    ctx.lineTo(x + s * 0.22, y);
    ctx.lineTo(x, y + s * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#FFB3D1";
    ctx.beginPath();
    ctx.arc(x, y - s * 0.08, s * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(x - s * 0.08, y - s * 0.16, s * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  if (icon === "star" || icon === "film") {
    ctx.fillStyle = icon === "star" ? "#FFD23F" : fg;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? s * 0.2 : s * 0.46;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
  if (icon === "bone" || icon === "bread") {
    ctx.fillStyle = icon === "bone" ? "#FFFFFF" : "#E9A55A";
    if (icon === "bone") {
      ctx.fillRect(x - s * 0.3, y - s * 0.08, s * 0.6, s * 0.16);
      for (const dx of [-0.3, 0.3]) {
        for (const dy of [-0.1, 0.1]) {
          ctx.beginPath();
          ctx.arc(x + dx * s, y + dy * s, s * 0.12, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      ctx.beginPath();
      ctx.ellipse(x, y, s * 0.42, s * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#B9722F";
      ctx.lineWidth = s * 0.05;
      for (const dx of [-0.16, 0, 0.16]) {
        ctx.beginPath();
        ctx.moveTo(x + dx * s - s * 0.05, y - s * 0.14);
        ctx.lineTo(x + dx * s + s * 0.05, y + s * 0.14);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
};

/** Shop sign board: coloured rounded panel, white border, text and an optional icon. */
const signTexture = (text: string, bg: string, icon?: SignIcon) =>
  canvasTexture(`dino-shop|${text}|${bg}|${icon ?? ""}`, 768, 192, (ctx, W, H) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 40);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(12, 12, W - 24, H - 24, 30);
    ctx.fill();
    const left = icon ? 150 : 40;
    if (icon) drawIcon(ctx, icon, 92, H / 2 + 4, 120, "#FFFFFF");
    let size = 118;
    ctx.font = `${size}px ${TITLE}`;
    while (ctx.measureText(text).width > W - left - 50 && size > 40) {
      size -= 4;
      ctx.font = `${size}px ${TITLE}`;
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cx = (left + W - 30) / 2;
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillText(text, cx + 5, H / 2 + 14);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(text, cx, H / 2 + 9);
  });

// =======================================================================================
// City buildings

/** Street layout: road half-width, sidewalk outer edge, curb height, building fronts, depth. */
export const STREET = { road: 3.6, walk: 6.4, curb: 0.16, front: 6.6, depth: 6, z0: 12, z1: -36 };

type Shop = { name: string; color: string; icon?: SignIcon; awning?: [string, string] };
type Roof = "tank" | "ac" | "antenna" | "dish" | "garden";
type BuildingSpec = { side: 1 | -1; z0: number; z1: number; h: number; color: string; shop?: Shop; roof?: Roof };

const BUILDINGS: BuildingSpec[] = [
  { side: 1, z0: 10, z1: 4.6, h: 9, color: "#FF6F61", shop: { name: "CAFÉ", color: "#8A4B2A", icon: "star", awning: ["#FFFFFF", "#E8383D"] }, roof: "tank" },
  { side: 1, z0: 4.6, z1: -1.6, h: 13, color: "#4FB3FF", shop: { name: "PIZZERIA", color: "#E3262B", icon: "pizza", awning: ["#FFFFFF", "#1FA35B"] }, roof: "ac" },
  { side: 1, z0: -1.6, z1: -6.8, h: 8, color: "#FFD23F", shop: { name: "HELADOS", color: "#FF5FA2", icon: "cone", awning: ["#FFFFFF", "#FF7EB6"] }, roof: "garden" },
  { side: 1, z0: -6.8, z1: -13.2, h: 15, color: "#A98BFF", shop: { name: "CINE", color: "#2B2F58", icon: "film" }, roof: "antenna" },
  { side: 1, z0: -13.2, z1: -18.8, h: 10, color: "#2EC4B6", roof: "dish" },
  { side: 1, z0: -18.8, z1: -25.2, h: 12.5, color: "#FF9F43", roof: "tank" },
  { side: 1, z0: -25.2, z1: -32.4, h: 9.5, color: "#FF7EB6", roof: "ac" },
  { side: -1, z0: 10, z1: 5, h: 11, color: "#26C2A8", shop: { name: "FARMACIA", color: "#1B8F4F", icon: "cross" }, roof: "ac" },
  { side: -1, z0: 5, z1: -0.6, h: 8, color: "#FF8A3D", shop: { name: "PANADERÍA", color: "#9A5B2C", icon: "bread", awning: ["#FFF3D6", "#E0892F"] }, roof: "garden" },
  { side: -1, z0: -0.6, z1: -7.2, h: 14, color: "#5B8CFF", shop: { name: "DINO TOURS", color: "#FF8A1F", icon: "bone", awning: ["#FFFFFF", "#2F6BFF"] }, roof: "antenna" },
  { side: -1, z0: -7.2, z1: -12.4, h: 9, color: "#FF5A5F", shop: { name: "MUSEO", color: "#6B3FA0", icon: "bone" }, roof: "tank" },
  { side: -1, z0: -12.4, z1: -19.4, h: 12, color: "#FFC93C", roof: "dish" },
  { side: -1, z0: -19.4, z1: -25.6, h: 10, color: "#8E7CFF", roof: "ac" },
  { side: -1, z0: -25.6, z1: -32.4, h: 13, color: "#FF7F6B", roof: "garden" },
];

const FLOOR = 2.15;

/** Windows of one facade (frames, panes, sills and a few flower boxes), vertex coloured. */
const windowsGeometry = (W: number, H: number, fromY: number, seed: number) => {
  const rnd = mulberry(seed);
  const geos: THREE.BufferGeometry[] = [];
  const bays = Math.max(2, Math.round(W / 1.75));
  for (let y = fromY; y + 0.75 < H - 0.7; y += FLOOR) {
    for (let b = 0; b < bays; b++) {
      const x = -W / 2 + (W / bays) * (b + 0.5);
      const lit = rnd() < 0.2;
      geos.push(place(box(1.04, 1.32, 0.14, 0.08), "#FFFFFF", [x, y, 0.05]));
      geos.push(place(box(0.8, 1.08, 0.1, 0.05), lit ? "#FFE7A0" : rnd() < 0.5 ? "#A6E0FF" : "#86CBF5", [x, y, 0.1]));
      geos.push(place(box(0.07, 1.02, 0.04, 0.02), "#FFFFFF", [x, y, 0.16]));
      geos.push(place(box(1.22, 0.14, 0.28, 0.05), "#FFFFFF", [x, y - 0.73, 0.1]));
      if (rnd() < 0.22) {
        geos.push(place(box(0.95, 0.24, 0.3, 0.05), "#9A5B2C", [x, y - 0.56, 0.3]));
        for (let k = 0; k < 3; k++) {
          const c = ["#FF4F7B", "#FFD23F", "#FF8A3D"][(k + b) % 3];
          geos.push(place(new THREE.IcosahedronGeometry(0.12, 0), c, [x - 0.3 + k * 0.3, y - 0.36, 0.32]));
          geos.push(place(new THREE.IcosahedronGeometry(0.1, 0), "#2FAE4E", [x - 0.15 + k * 0.3, y - 0.4, 0.26]));
        }
      }
    }
  }
  return mergeAll(geos);
};

/** Where a building's roof furniture stands (building space, on the roof). */
const roofSpot = (W: number, D: number, seed: number): [number, number] => {
  const rnd = mulberry(seed);
  return [(rnd() - 0.5) * W * 0.3, -D / 2 + (rnd() - 0.5) * 1.2];
};

/** Roof furniture, vertex coloured, standing on y = 0 (the roof). */
const roofGeometry = (kind: Roof, W: number, D: number, seed: number) => {
  const rnd = mulberry(seed + 1);
  const geos: THREE.BufferGeometry[] = [];
  const [x0, z0] = roofSpot(W, D, seed);
  if (kind === "tank") {
    for (const [dx, dz] of [
      [-0.5, -0.5],
      [0.5, -0.5],
      [-0.5, 0.5],
      [0.5, 0.5],
    ]) {
      geos.push(place(box(0.14, 1.0, 0.14, 0.03), "#5A4034", [x0 + dx, 0.5, z0 + dz]));
    }
    geos.push(place(new THREE.CylinderGeometry(0.78, 0.78, 1.4, 16), "#A8703E", [x0, 1.7, z0]));
    geos.push(place(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 16), "#6B4A2E", [x0, 1.35, z0]));
    geos.push(place(new THREE.CylinderGeometry(0.8, 0.8, 0.1, 16), "#6B4A2E", [x0, 2.05, z0]));
    geos.push(place(new THREE.ConeGeometry(0.88, 0.7, 16), "#6B4A2E", [x0, 2.75, z0]));
  }
  if (kind === "ac") {
    for (let i = 0; i < 2; i++) {
      const x = x0 + (i - 0.5) * 1.6;
      geos.push(place(box(1.1, 0.8, 0.9, 0.1), "#D7DCE4", [x, 0.4, z0]));
      geos.push(place(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), "#5B6270", [x, 0.82, z0]));
    }
  }
  if (kind === "antenna") {
    geos.push(place(new THREE.CylinderGeometry(0.09, 0.12, 3.0, 8), "#9AA3AD", [x0, 1.5, z0]));
    for (const [y, w] of [
      [1.6, 1.2],
      [2.2, 0.9],
      [2.7, 0.6],
    ]) {
      geos.push(place(box(w, 0.1, 0.1, 0.03), "#9AA3AD", [x0, y, z0]));
    }
  }
  if (kind === "dish") {
    geos.push(place(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8), "#9AA3AD", [x0, 0.45, z0]));
    geos.push(place(new THREE.SphereGeometry(0.75, 20, 8, 0, Math.PI * 2, 0, 1.0), "#F4F7FA", [x0, 1.25, z0 + 0.1], [1.0, 0, 0], [1, 0.4, 1]));
    geos.push(place(new THREE.SphereGeometry(0.1, 10, 8), "#E8383D", [x0, 1.1, z0 + 0.5]));
  }
  if (kind === "garden") {
    for (let i = 0; i < 4; i++) {
      const r = 0.45 + rnd() * 0.3;
      const c = i % 2 ? "#2FAE4E" : "#44C25B";
      geos.push(place(new THREE.IcosahedronGeometry(1, 1), c, [x0 + (i - 1.5) * 1.1, r * 0.8, z0 + (rnd() - 0.5) * 1.5], [i, i, 0], [r, r * 0.85, r]));
    }
    geos.push(place(box(W * 0.6, 0.3, 0.5, 0.08), "#9A5B2C", [0, 0.15, -0.6]));
  }
  return mergeAll(geos);
};

const Building: React.FC<{ spec: BuildingSpec; index: number; t: number }> = ({ spec, index, t }) => {
  const ready = useFontsReady();
  const W = Math.abs(spec.z0 - spec.z1) - 0.25;
  const D = STREET.depth;
  const H = spec.h;
  const shop = spec.shop;
  const geos = useMemo(
    () => ({
      windows: windowsGeometry(W, H, shop ? 4.45 : 2.3, index * 31 + 7),
      roof: spec.roof ? roofGeometry(spec.roof, W, D, index * 17 + 3) : null,
      knob: new THREE.SphereGeometry(0.07, 10, 8),
      beacon: new THREE.SphereGeometry(0.12, 12, 8),
    }),
    [W, H, D, shop, spec.roof, index],
  );
  const body = useRounded(W, H, D, 0.22, 2);
  const cornice = useRounded(W + 0.3, 0.42, D + 0.3, 0.12, 2);
  const plinth = useRounded(W + 0.14, 0.55, D + 0.14, 0.08, 2);
  const shopWin = useRounded(W * 0.5, 1.75, 0.12, 0.06, 2);
  const shopFrame = useRounded(W * 0.5 + 0.2, 1.95, 0.1, 0.08, 2);
  const door = useRounded(0.95, 2.05, 0.1, 0.06, 2);
  const board = useRounded(3.9, 1.05, 0.14, 0.1, 2);
  const awning = useRounded(W * 0.56, 0.06, 1.15, 0.03, 1);
  const cream = toy("#FFF6E6", { rough: 0.5, glow: 0.14 });
  const blink = Math.sin(t * 4 + index) > 0 ? 1 : 0.25;
  return (
    <group position={[spec.side * STREET.front, STREET.curb, (spec.z0 + spec.z1) / 2]} rotation={[0, (-spec.side * Math.PI) / 2, 0]}>
      <mesh geometry={body} material={toy(spec.color, { rough: 0.55, glow: 0.15 })} position={[0, H / 2, -D / 2]} castShadow receiveShadow />
      <mesh geometry={plinth} material={toy(shadeHex(spec.color, -0.16), { rough: 0.6 })} position={[0, 0.27, -D / 2]} />
      <mesh geometry={cornice} material={cream} position={[0, H - 0.1, -D / 2]} castShadow />
      <mesh geometry={geos.windows} material={vertexMat(0.4, false, 0.2)} />
      {geos.roof ? <mesh geometry={geos.roof} material={vertexMat(0.6, true, 0.14)} position={[0, H + 0.1, 0]} castShadow /> : null}
      {spec.roof === "antenna" ? (
        <group position={[roofSpot(W, D, index * 17 + 3)[0], H + 3.2, roofSpot(W, D, index * 17 + 3)[1]]}>
          <mesh geometry={geos.beacon} material={toy("#FF3030", { glow: 0.3 + 0.9 * blink })} />
        </group>
      ) : null}
      {shop ? (
        <group>
          <mesh geometry={shopFrame} material={cream} position={[-W * 0.16, 1.28, 0.05]} />
          <mesh geometry={shopWin} material={toy("#8FD8FF", { rough: 0.15, glow: 0.35 })} position={[-W * 0.16, 1.28, 0.1]} />
          <mesh geometry={door} material={toy(shadeHex(shop.color, 0.05), { rough: 0.5 })} position={[W * 0.3, 1.03, 0.06]} />
          <mesh geometry={geos.knob} material={toy("#FFD23F", { metal: 0.5, rough: 0.3 })} position={[W * 0.3 + 0.3, 1.0, 0.14]} />
          <mesh geometry={board} material={toy(shop.color, { rough: 0.5 })} position={[0, 3.45, 0.1]} />
          {ready ? (
            <mesh position={[0, 3.45, 0.18]}>
              <planeGeometry args={[3.8, 0.95]} />
              <primitive object={texMat(signTexture(shop.name, shop.color, shop.icon), 0.5, 0.3)} attach="material" />
            </mesh>
          ) : null}
          {shop.awning ? (
            <group position={[-W * 0.16, 2.72, 0.05]} rotation={[0.42, 0, 0]}>
              <mesh geometry={awning} position={[0, 0, 0.58]}>
                <primitive object={texMat(stripeTexture(shop.awning[0], shop.awning[1], false), 0.6, 0.18)} attach="material" />
              </mesh>
              <mesh position={[0, -0.16, 1.15]} rotation={[-0.42, 0, 0]}>
                <planeGeometry args={[W * 0.56, 0.34]} />
                <primitive object={texMat(stripeTexture(shop.awning[0], shop.awning[1], true), 0.6, 0.18, true)} attach="material" />
              </mesh>
            </group>
          ) : null}
        </group>
      ) : null}
    </group>
  );
};

// =======================================================================================
// Street furniture

export type LightColor = "red" | "yellow" | "green";
const LIGHTS: [LightColor, string, number][] = [
  ["red", "#FF2A2A", 0.52],
  ["yellow", "#FFC21A", 0],
  ["green", "#2EE06A", -0.52],
];

/** Traffic light on a pole with a short arm over the road; the head hangs at x = -1.5, facing +z. */
const TrafficLight: React.FC<{ light: LightColor }> = ({ light }) => {
  const geos = useMemo(
    () => ({
      pole: new THREE.CylinderGeometry(0.1, 0.12, 5.2, 14),
      arm: new THREE.CylinderGeometry(0.07, 0.08, 1.6, 12).rotateZ(Math.PI / 2),
      lamp: new THREE.CircleGeometry(0.2, 24),
      visor: new THREE.CylinderGeometry(0.25, 0.25, 0.28, 20, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2),
      base: new THREE.CylinderGeometry(0.28, 0.32, 0.18, 18),
    }),
    [],
  );
  const head = useRounded(0.66, 1.66, 0.5, 0.14, 3);
  const walk = useRounded(0.4, 0.55, 0.3, 0.08, 2);
  const pole = toy("#3C4250", { rough: 0.45, metal: 0.3 });
  const bodyMat = toy("#FFC21A", { rough: 0.4, glow: 0.16 });
  return (
    <group>
      <mesh geometry={geos.base} material={pole} position={[0, 0.09, 0]} />
      <mesh geometry={geos.pole} material={pole} position={[0, 2.6, 0]} castShadow />
      <mesh geometry={geos.arm} material={pole} position={[-0.75, 5.0, 0]} />
      <mesh geometry={walk} material={toy("#2B2F38", { rough: 0.5 })} position={[0, 2.6, 0.22]} />
      <mesh geometry={geos.lamp} material={toy(light === "green" ? "#FFFFFF" : "#FF5A3A", { glow: 0.8 })} position={[0, 2.62, 0.38]} scale={0.6} />
      <group position={[-1.5, 4.25, 0.05]}>
        <mesh geometry={head} material={bodyMat} castShadow />
        {LIGHTS.map(([name, color, y]) => {
          const on = name === light;
          return (
            <group key={name} position={[0, y, 0.26]}>
              <mesh geometry={geos.lamp} material={on ? toy(color, { glow: 1.2 }) : toy(shadeHex(color, -0.32, -0.3), { rough: 0.4, glow: 0.1 })} />
              <mesh geometry={geos.visor} material={toy("#2B2F38", { rough: 0.5, side: THREE.DoubleSide })} position={[0, 0.02, 0.14]} />
              {on ? <Halo color={color} size={1.5} opacity={0.75} position={[0, 0, 0.08]} /> : null}
            </group>
          );
        })}
      </group>
    </group>
  );
};

/** Street lamp; the arm reaches towards +x (turn it with the group). */
const StreetLamp: React.FC = () => {
  const geos = useMemo(
    () => ({
      pole: new THREE.CylinderGeometry(0.07, 0.1, 5.0, 12),
      arm: new THREE.TorusGeometry(0.55, 0.055, 8, 16, Math.PI / 2),
      hood: new THREE.SphereGeometry(0.34, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      bulb: new THREE.SphereGeometry(0.2, 16, 10),
      base: new THREE.CylinderGeometry(0.2, 0.26, 0.4, 14),
    }),
    [],
  );
  const metal = toy("#2F4858", { rough: 0.45, metal: 0.3, glow: 0.12 });
  return (
    <group>
      <mesh geometry={geos.base} material={metal} position={[0, 0.2, 0]} />
      <mesh geometry={geos.pole} material={metal} position={[0, 2.5, 0]} castShadow />
      <mesh geometry={geos.arm} material={metal} position={[0.55, 5.0, 0]} rotation={[0, 0, Math.PI / 2]} />
      <group position={[1.1, 5.45, 0]}>
        <mesh geometry={geos.hood} material={metal} scale={[1, 0.6, 1]} />
        <mesh geometry={geos.bulb} material={toy("#FFF3C0", { glow: 0.9 })} position={[0, -0.05, 0]} />
      </group>
    </group>
  );
};

/** Round toy tree in a stone planter (≈ 3.4 tall). */
const StreetTree: React.FC<{ seed?: number }> = ({ seed = 0 }) => {
  const geos = useMemo(
    () => ({
      trunk: new THREE.CylinderGeometry(0.1, 0.15, 1.9, 10),
      blob: new THREE.IcosahedronGeometry(1, 1),
    }),
    [],
  );
  const planter = useRounded(1.0, 0.45, 1.0, 0.1, 2);
  const soil = useRounded(0.86, 0.06, 0.86, 0.03, 1);
  const greens = ["#3FBF55", "#2FA84A", "#56CF62"];
  return (
    <group>
      <mesh geometry={planter} material={toy("#C3C8D2", { rough: 0.8 })} position={[0, 0.22, 0]} castShadow />
      <mesh geometry={soil} material={toy("#6B4A2E", { rough: 1 })} position={[0, 0.44, 0]} />
      <mesh geometry={geos.trunk} material={toy("#8A5A33", { rough: 0.7 })} position={[0, 1.35, 0]} />
      {(
        [
          [0, 2.6, 0, 0.95],
          [-0.55, 2.3, 0.2, 0.7],
          [0.55, 2.35, -0.1, 0.72],
          [0.1, 3.15, -0.1, 0.62],
        ] as [number, number, number, number][]
      ).map(([x, y, z, r], i) => (
        <mesh key={i} geometry={geos.blob} material={toy(greens[(i + seed) % 3], { rough: 0.8, flat: true, glow: 0.16 })} position={[x, y, z]} scale={r} rotation={[i + seed, i * 2, 0]} castShadow />
      ))}
    </group>
  );
};

const Hydrant: React.FC = () => {
  const geos = useMemo(
    () => ({
      body: new THREE.CylinderGeometry(0.17, 0.2, 0.62, 16),
      cap: new THREE.SphereGeometry(0.18, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      nozzle: new THREE.CylinderGeometry(0.08, 0.08, 0.5, 12).rotateZ(Math.PI / 2),
      ring: new THREE.CylinderGeometry(0.23, 0.23, 0.08, 16),
    }),
    [],
  );
  const red = toy("#E8383D", { rough: 0.35, glow: 0.18 });
  return (
    <group>
      <mesh geometry={geos.ring} material={red} position={[0, 0.04, 0]} />
      <mesh geometry={geos.body} material={red} position={[0, 0.35, 0]} castShadow />
      <mesh geometry={geos.ring} material={red} position={[0, 0.64, 0]} scale={[0.9, 1, 0.9]} />
      <mesh geometry={geos.cap} material={red} position={[0, 0.66, 0]} />
      <mesh geometry={geos.nozzle} material={toy("#FFD23F", { rough: 0.4 })} position={[0, 0.42, 0]} />
    </group>
  );
};

/**
 * Toy city car driving towards +x (2.4 long, 1.3 wide): rounded body, cream cabin with blue
 * windows, big wheels; `taxi` adds a checker stripe and a "TAXI" roof sign.
 */
const CityCar: React.FC<{ color: string; taxi?: boolean }> = ({ color, taxi = false }) => {
  const ready = useFontsReady();
  const body = useRounded(2.4, 0.7, 1.3, 0.28, 4);
  const cabin = useRounded(1.35, 0.62, 1.14, 0.18, 4);
  const winSide = useRounded(0.46, 0.34, 0.04, 0.08, 2);
  const winFront = useRounded(0.04, 0.34, 0.86, 0.08, 2);
  const bumper = useRounded(0.14, 0.2, 1.2, 0.07, 2);
  const roofSign = useRounded(0.3, 0.26, 0.74, 0.08, 2);
  const stripe = useRounded(2.1, 0.12, 1.34, 0.04, 1);
  const geos = useMemo(
    () => ({
      wheel: new THREE.CylinderGeometry(0.32, 0.32, 0.26, 24).rotateX(Math.PI / 2),
      hub: new THREE.CylinderGeometry(0.15, 0.15, 0.28, 18).rotateX(Math.PI / 2),
      light: new THREE.SphereGeometry(0.12, 16, 10),
    }),
    [],
  );
  const paint = toy(color, { rough: 0.3, glow: 0.16 });
  const glass = toy("#6CCBFF", { rough: 0.15, glow: 0.3 });
  const chrome = toy("#D9E1EA", { metal: 0.7, rough: 0.25, glow: 0.12 });
  const signTex = useMemo(
    () =>
      canvasTexture("dino-taxi-sign", 256, 96, (ctx, W, H) => {
        ctx.fillStyle = "#FFF6D0";
        ctx.fillRect(0, 0, W, H);
        ctx.font = `76px ${TITLE}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#1A1A1A";
        ctx.fillText("TAXI", W / 2, H / 2 + 6);
      }),
    [],
  );
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`} position={[sx * 0.78, 0.32, sz * 0.56]}>
            <mesh geometry={geos.wheel} material={toy("#262A33", { rough: 0.6 })} castShadow />
            <mesh geometry={geos.hub} material={toy("#FFFFFF", { rough: 0.35 })} />
          </group>
        )),
      )}
      <mesh geometry={body} material={paint} position={[0, 0.72, 0]} castShadow />
      <mesh geometry={cabin} material={toy(taxi ? color : "#FFF3DC", { rough: 0.35, glow: 0.14 })} position={[-0.15, 1.3, 0]} castShadow />
      {[-1, 1].flatMap((s) => [-0.44, 0.12].map((x) => <mesh key={`${s}${x}`} geometry={winSide} material={glass} position={[x, 1.33, s * 0.575]} />))}
      <mesh geometry={winFront} material={glass} position={[0.53, 1.33, 0]} />
      <mesh geometry={winFront} material={glass} position={[-0.83, 1.33, 0]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={geos.light} material={toy("#FFF3A0", { rough: 0.2, glow: 0.7 })} position={[1.17, 0.8, s * 0.4]} scale={[0.6, 1, 1]} />
          <mesh geometry={geos.light} material={toy("#FF2020", { rough: 0.2, glow: 0.5 })} position={[-1.19, 0.82, s * 0.44]} scale={[0.5, 0.7, 0.7]} />
        </group>
      ))}
      <mesh geometry={bumper} material={chrome} position={[1.22, 0.5, 0]} />
      <mesh geometry={bumper} material={chrome} position={[-1.22, 0.5, 0]} />
      {taxi ? (
        <group>
          <mesh geometry={stripe} material={toy("#1A1A1A", { rough: 0.4 })} position={[0, 0.78, 0]} />
          <mesh geometry={roofSign} material={toy("#FFF6D0", { glow: 0.3 })} position={[-0.15, 1.74, 0]} />
          {ready
            ? [-1, 1].map((s) => (
                <mesh key={s} position={[-0.15 + s * 0.155, 1.74, 0]} rotation={[0, (s * Math.PI) / 2, 0]}>
                  <planeGeometry args={[0.66, 0.21]} />
                  <primitive object={texMat(signTex, 0.4, 0.4)} attach="material" />
                </mesh>
              ))
            : null}
        </group>
      ) : null}
    </group>
  );
};

// =======================================================================================
// Giant wall

const concreteTexture = () =>
  canvasTexture(
    "dino-concrete",
    256,
    256,
    (ctx, W, H) => {
      // One tile = a 4 × 4 concrete panel with its joints and a few stains.
      ctx.fillStyle = "#B7BBC2";
      ctx.fillRect(0, 0, W, H);
      const rnd = mulberry(77);
      for (let i = 0; i < 26; i++) {
        ctx.fillStyle = rnd() < 0.5 ? "rgba(90,96,108,0.08)" : "rgba(255,255,255,0.08)";
        ctx.beginPath();
        ctx.ellipse(rnd() * W, rnd() * H, 10 + rnd() * 30, 6 + rnd() * 18, rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#8C919B";
      ctx.fillRect(0, 0, W, 5);
      ctx.fillRect(0, 0, 5, H);
      ctx.fillStyle = "#6F7580";
      for (const [x, y] of [
        [W * 0.25, H * 0.3],
        [W * 0.75, H * 0.3],
        [W * 0.25, H * 0.75],
        [W * 0.75, H * 0.75],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    { wrapS: true, wrapT: true },
  );

const hazardTexture = () =>
  canvasTexture(
    "dino-hazard",
    256,
    128,
    (ctx, W, H) => {
      ctx.fillStyle = "#FFD21A";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#1A1A1A";
      for (let i = -2; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 128, H);
        ctx.lineTo(i * 128 + 64, H);
        ctx.lineTo(i * 128 + 64 + H, 0);
        ctx.lineTo(i * 128 + H, 0);
        ctx.closePath();
        ctx.fill();
      }
    },
    { wrapS: true, wrapT: true },
  );

const zonaDinoTexture = () =>
  canvasTexture("dino-zona-sign", 1024, 300, (ctx, W, H) => {
    ctx.fillStyle = "#1A1A1A";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 40);
    ctx.fill();
    ctx.fillStyle = "#FFD21A";
    ctx.beginPath();
    ctx.roundRect(16, 16, W - 32, H - 32, 30);
    ctx.fill();
    // Warning triangle with "!".
    ctx.fillStyle = "#1A1A1A";
    ctx.beginPath();
    ctx.moveTo(150, 46);
    ctx.lineTo(250, 230);
    ctx.lineTo(50, 230);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#FFD21A";
    ctx.beginPath();
    ctx.moveTo(150, 92);
    ctx.lineTo(214, 210);
    ctx.lineTo(86, 210);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#1A1A1A";
    ctx.font = `120px ${TITLE}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("!", 150, 172);
    let size = 190;
    ctx.font = `${size}px ${TITLE}`;
    while (ctx.measureText("ZONA DINO").width > W - 330 && size > 60) {
      size -= 6;
      ctx.font = `${size}px ${TITLE}`;
    }
    ctx.fillText("ZONA DINO", 610, H / 2 + 18);
  });

const scratchTexture = () =>
  canvasTexture("dino-claw-scratch", 256, 512, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      const x = 50 + i * 70;
      ctx.strokeStyle = "rgba(60,62,70,0.9)";
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.moveTo(x, 40 + i * 12);
      ctx.quadraticCurveTo(x + 30, H / 2, x - 10, H - 50 + i * 10);
      ctx.stroke();
      ctx.strokeStyle = "rgba(230,232,236,0.8)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x + 8, 50 + i * 12);
      ctx.quadraticCurveTo(x + 38, H / 2, x - 2, H - 60 + i * 10);
      ctx.stroke();
    }
  });

/** Barbed-wire coil along x (length L), radius r, turns every `pitch`. */
const coilGeometry = (L: number, r: number, pitch: number) => {
  const pts: THREE.Vector3[] = [];
  const turns = L / pitch;
  const n = Math.round(turns * 10);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(-L / 2 + (i / n) * L, Math.sin(a) * r, Math.cos(a) * r));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, 0.035, 4, false);
};

export const GIANT_WALL = { width: 34, depth: 1.6, height: 16 };

/**
 * Giant concrete barrier wall ("muro gigante") facing +z: 34 wide, `height` tall (default 16,
 * 8 × Nubi, twice the giant T-Rex; pass ≈ 6 for a gag where the T-Rex's head peeks over), 1.6
 * thick with buttresses in front. Concrete panels, yellow-and-black hazard bands at the top
 * and bottom, a big yellow "ZONA DINO" warning panel at mid height, giant claw scratches,
 * barbed wire and blinking amber beacons along the top (`t` seconds). Origin at the middle of
 * its base; CityStreet stands one across the far end of the street (GIANT_WALL_Z).
 */
export const GiantWall: React.FC<{ height?: number; t?: number }> = ({ height = GIANT_WALL.height, t = 0 }) => {
  const ready = useFontsReady();
  const { width: W, depth: D } = GIANT_WALL;
  const H = height;
  const mats = useMemo(() => {
    const conc = concreteTexture();
    const haz = hazardTexture();
    return {
      wall: texMat(repeated(conc, W / 4, H / 4), 0.85, 0.12),
      buttress: texMat(repeated(conc, 0.4, H / 4), 0.85, 0.12),
      hazTop: texMat(repeated(haz, W / 2.4, 1), 0.5, 0.18),
      hazLow: texMat(repeated(haz, W / 1.8, 1), 0.5, 0.18),
    };
  }, [W, H]);
  const geos = useMemo(
    () => ({
      coil: coilGeometry(W - 0.6, 0.34, 0.42),
      beacon: new THREE.SphereGeometry(0.34, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      post: new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6),
    }),
    [W],
  );
  const body = useRounded(W, H, D, 0.12, 2);
  const cap = useRounded(W + 0.6, 0.7, D + 0.6, 0.18, 2);
  const foot = useRounded(W + 0.8, 0.8, D + 1.4, 0.15, 2);
  const buttress = useRounded(1.3, H - 0.8, 0.9, 0.15, 2);
  const hazTop = useRounded(W + 0.04, 1.2, D + 0.06, 0.05, 1);
  const hazLow = useRounded(W + 0.04, 0.8, D + 0.06, 0.05, 1);
  const panel = useRounded(13.4, 3.9, 0.2, 0.2, 2);
  const beaconBase = useRounded(0.6, 0.3, 0.6, 0.08, 1);
  const panelY = H * 0.56;
  return (
    <group>
      <mesh geometry={foot} material={toy("#8E939C", { rough: 0.9 })} position={[0, 0.4, 0.1]} receiveShadow />
      <mesh geometry={body} material={mats.wall} position={[0, H / 2, 0]} castShadow receiveShadow />
      <mesh geometry={hazLow} material={mats.hazLow} position={[0, 1.35, 0]} />
      <mesh geometry={hazTop} material={mats.hazTop} position={[0, H - 1.1, 0]} />
      <mesh geometry={cap} material={toy("#C9CDD4", { rough: 0.85 })} position={[0, H + 0.3, 0]} castShadow />
      {[-12.5, -4.2, 4.2, 12.5].map((x) => (
        <mesh key={x} geometry={buttress} material={mats.buttress} position={[x, (H - 0.8) / 2 + 0.4, D / 2 + 0.4]} castShadow />
      ))}
      {/* ZONA DINO warning panel. */}
      <mesh geometry={panel} material={toy("#1A1A1A", { rough: 0.5 })} position={[0, panelY, D / 2 + 0.95]} />
      {ready ? (
        <mesh position={[0, panelY, D / 2 + 1.06]}>
          <planeGeometry args={[13.2, 3.87]} />
          <primitive object={texMat(zonaDinoTexture(), 0.5, 0.3)} attach="material" />
        </mesh>
      ) : null}
      {/* Claw scratches. */}
      {[
        [-8.6, H * 0.36, 1],
        [8.3, H * 0.78, 0.8],
      ].map(([x, y, s], i) => (
        <mesh key={i} position={[x, y, D / 2 + 0.01]} rotation={[0, 0, 0.25 - i * 0.5]} scale={s}>
          <planeGeometry args={[2.6, 5.2]} />
          <primitive object={texMat(scratchTexture(), 0.8, 0.1, true)} attach="material" />
        </mesh>
      ))}
      {/* Barbed wire and beacons on top. */}
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} geometry={geos.post} material={toy("#5B6270", { metal: 0.4 })} position={[-W / 2 + 1 + (i * (W - 2)) / 8, H + 1.1, 0]} />
      ))}
      <mesh geometry={geos.coil} material={toy("#8E96A3", { metal: 0.6, rough: 0.35 })} position={[0, H + 1.05, 0]} />
      {[-13, -4.5, 4.5, 13].map((x, i) => {
        const on = Math.sin(t * 6 + i * 1.7) > 0 ? 1 : 0;
        return (
          <group key={x} position={[x, H + 0.65, D / 2 - 0.1]}>
            <mesh geometry={beaconBase} material={toy("#3C4250", { rough: 0.5 })} position={[0, 0.15, 0]} />
            <mesh geometry={geos.beacon} material={toy("#FFA21A", { rough: 0.2, glow: 0.3 + 1.1 * on })} position={[0, 0.3, 0]} />
            <Halo color="#FFB02E" size={2.4} opacity={0.7 * on} position={[0, 0.45, 0.2]} />
          </group>
        );
      })}
    </group>
  );
};

// =======================================================================================
// City street

/** Street lamps and trees along the sidewalks: [side, z]. */
const LAMPS: [number, number][] = [
  [-1, 9.5],
  [-1, -3],
  [-1, -15.5],
  [-1, -28],
  [1, 10.5],
  [1, -1],
  [1, -13.5],
  [1, -26],
];
const TREES: [number, number][] = [
  [-1, 2.5],
  [-1, -9.5],
  [-1, -21.5],
  [1, -6.5],
  [1, -19.5],
  [1, -30.5],
];

/** Where the GiantWall stands across the street in CityStreet (z of its base centre). */
export const GIANT_WALL_Z = -31;

/**
 * Cartoon city street running along z (away from a camera at +z): a 7.2-wide road (x ±3.6)
 * with a dashed yellow centre line and a zebra crossing at z ≈ 2.7..5.7, raised sidewalks
 * (top at y 0.16) out to x ±6.4, and colourful toy buildings (8–15 tall) on both sides from
 * z = +10 to -32 with shops (café, pizzería, helados, cine, farmacia, panadería, DINO TOURS,
 * museo), a traffic light at the far right corner of the crossing (`light`, or cycling with `t`:
 * green 4.5 s, yellow 1.2 s, red 3.3 s), street lamps, trees, a hydrant, a coral car driving
 * away in the right lane and a yellow taxi coming in the left one. `wall` (default true) closes the far end with the
 * GiantWall at z = GIANT_WALL_Z. The road is wide enough for the ≈ 7-tall T-Rex to walk down it.
 * Nubi's spot: [0, 0, 4] (on the crossing).
 */
export const CityStreet: React.FC<{ t?: number; wall?: boolean; wallHeight?: number; light?: LightColor }> = ({
  t = 0,
  wall = true,
  wallHeight,
  light,
}) => {
  const L = STREET.z0 - STREET.z1;
  const zc = (STREET.z0 + STREET.z1) / 2;
  const walkW = STREET.walk - STREET.road;
  const mats = useMemo(
    () => ({
      road: texMat(repeated(asphaltTexture(), 1, L / 8), 0.85, 0.1),
      walk: texMat(repeated(pavementTexture(), walkW / 1.2, L / 1.2), 0.8, 0.12),
    }),
    [L, walkW],
  );
  const road = useRounded(STREET.road * 2, 0.1, L, 0.02, 1);
  const walk = useRounded(walkW, STREET.curb, L, 0.03, 1);
  const curb = useRounded(0.28, STREET.curb + 0.02, L, 0.05, 1);
  const stripe = useRounded(0.62, 0.03, 2.9, 0.02, 1);
  const cycle = ((t % 9) + 9) % 9;
  const phase: LightColor = light ?? (cycle < 4.5 ? "green" : cycle < 5.7 ? "yellow" : "red");
  return (
    <group>
      <mesh position={[0, -0.03, zc - 10]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[90, L + 60]} />
        <primitive object={toy("#7E8594", { rough: 0.95 })} attach="material" />
      </mesh>
      <mesh geometry={road} material={mats.road} position={[0, -0.045, zc]} receiveShadow />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={walk} material={mats.walk} position={[s * (STREET.road + walkW / 2), STREET.curb / 2, zc]} receiveShadow />
          <mesh geometry={curb} material={toy("#E3E6EC", { rough: 0.7 })} position={[s * (STREET.road + 0.1), STREET.curb / 2 + 0.01, zc]} />
        </group>
      ))}
      {/* Zebra crossing. */}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} geometry={stripe} material={toy("#F4F6FA", { rough: 0.6, glow: 0.18 })} position={[-3.1 + i * 1.03, 0.015, 4.2]} receiveShadow />
      ))}
      {BUILDINGS.map((b, i) => (
        <Building key={i} spec={b} index={i} t={t} />
      ))}
      <group position={[4.3, STREET.curb, 1.3]}>
        <TrafficLight light={phase} />
      </group>
      {LAMPS.map(([sx, z]) => (
        <group key={`${sx}${z}`} position={[sx * 5.85, STREET.curb, z]} rotation={[0, sx > 0 ? Math.PI : 0, 0]}>
          <StreetLamp />
        </group>
      ))}
      {TREES.map(([sx, z], i) => (
        <group key={`${sx}${z}`} position={[sx * 5.25, STREET.curb, z]}>
          <StreetTree seed={i} />
        </group>
      ))}
      <group position={[-4.25, STREET.curb, 8.6]}>
        <Hydrant />
      </group>
      <group position={[1.85, 0, -9]} rotation={[0, Math.PI / 2, 0]} scale={1.25}>
        <CityCar color="#FF5A5F" />
      </group>
      <group position={[-1.85, 0, -18.5]} rotation={[0, -Math.PI / 2, 0]} scale={1.25}>
        <CityCar color="#FFC21A" taxi />
      </group>
      {wall ? (
        <group position={[0, 0, GIANT_WALL_Z]}>
          <GiantWall height={wallHeight} t={t} />
        </group>
      ) : null}
    </group>
  );
};

// =======================================================================================
// Prehistoric valley

const M4 = () => new THREE.Matrix4();
const T = (x: number, y: number, z: number) => M4().makeTranslation(x, y, z);
const S = (x: number, y = x, z = x) => M4().makeScale(x, y, z);
const RX = (a: number) => M4().makeRotationX(a);
const RY = (a: number) => M4().makeRotationY(a);
const RZ = (a: number) => M4().makeRotationZ(a);
const chain = (...ms: THREE.Matrix4[]) => ms.reduce((acc, m) => acc.multiply(m), M4());
const put = (base: THREE.BufferGeometry, color: string, m: THREE.Matrix4) => paintGeo(base.clone(), color).applyMatrix4(m);

const POND = { x: -7, z: -8.5, rx: 6.5, rz: 3.4 };
const RIVER: [number, number][] = [
  [-7, -11],
  [-3.5, -19],
  [-7.5, -29],
  [-4.5, -41],
  [-10, -55],
  [-7, -70],
  [-13, -88],
];
const riverWidth = (z: number) => 1.5 + clamp01(-z / 90) * 1.8;
const riverDist = (x: number, z: number) => {
  let best = Infinity;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [x0, z0] = RIVER[i];
    const [x1, z1] = RIVER[i + 1];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const k = clamp01(((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz));
    best = Math.min(best, Math.hypot(x - x0 - dx * k, z - z0 - dz * k));
  }
  return best;
};

/**
 * Ground height of the PrehistoricValley at (x, z). The valley floor is flat (y = 0) for
 * |x| < 12 down to z ≈ -75, except the pond (centre [-7, -8.5]) and the river bed winding back
 * from it along x ≈ -3.5..-10; hills rise at the sides and a ridge behind the volcanoes.
 */
export const valleyGroundY = (x: number, z: number) => {
  const ax = Math.abs(x);
  const side = Math.pow(smoothstep(13, 44, ax), 1.4) * (10 + 6 * fbm(x * 0.05, z * 0.05));
  const back = smoothstep(-78, -140, z) * (15 + 10 * fbm(x * 0.04 + 3, z * 0.04));
  const bumps = 0.4 * fbm(x * 0.15, z * 0.15) * smoothstep(9, 16, ax);
  const pd = Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz);
  const pond = 0.75 * (1 - smoothstep(0.55, 1.2, pd));
  const rw = riverWidth(z);
  const river = z < -9 ? 0.65 * (1 - smoothstep(rw * 0.55, rw * 1.25, riverDist(x, z))) : 0;
  return side + back + bumps - Math.max(pond, river);
};

const terrainGeometry = () => {
  const g = new THREE.PlaneGeometry(180, 180, 130, 130);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -58);
  const p = g.attributes.position;
  const C = (h: string) => new THREE.Color(h);
  const grassA = C("#5DBE4C");
  const grassB = C("#3E9E3E");
  const grassC = C("#8FCF52");
  const dirt = C("#A57A45");
  const sand = C("#D9C27E");
  const rock = C("#8A7F72");
  const haze = C("#8CC7B0");
  const c = new THREE.Color();
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const y = valleyGroundY(x, z);
    p.setY(i, y);
    c.copy(grassA).lerp(grassB, clamp01(0.5 + 1.6 * fbm(x * 0.08, z * 0.08)));
    c.lerp(grassC, clamp01(fbm(x * 0.03 + 7, z * 0.03) * 2) * 0.55);
    c.lerp(dirt, clamp01((fbm(x * 0.12 + 3, z * 0.12) - 0.28) * 3) * 0.55 * (1 - smoothstep(12, 20, Math.abs(x))));
    const pd = Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz);
    const wet = Math.max(1 - smoothstep(1.0, 1.35, pd), z < -9 ? 1 - smoothstep(riverWidth(z) * 0.9, riverWidth(z) * 1.6, riverDist(x, z)) : 0);
    c.lerp(sand, wet * 0.85);
    c.lerp(rock, clamp01((y - 7) / 9) * 0.65);
    c.lerp(haze, clamp01((-z - 45) / 95) * 0.5);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  return ng;
};

/** Water: the pond ellipse plus a ribbon along the river. */
const waterGeometry = () => {
  const pond = new THREE.CircleGeometry(1, 48);
  pond.rotateX(-Math.PI / 2);
  pond.scale(POND.rx * 1.08, 1, POND.rz * 1.1);
  pond.translate(POND.x, -0.14, POND.z);
  const curve = new THREE.CatmullRomCurve3(RIVER.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const n = 90;
  const pos: number[] = [];
  const idx: number[] = [];
  const pt = new THREE.Vector3();
  const tan = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    curve.getPointAt(u, pt);
    curve.getTangentAt(u, tan);
    const w = riverWidth(pt.z) * 0.95;
    const nx = -tan.z;
    const nz = tan.x;
    const l = Math.hypot(nx, nz) || 1;
    pos.push(pt.x + (nx / l) * w, -0.14, pt.z + (nz / l) * w, pt.x - (nx / l) * w, -0.14, pt.z - (nz / l) * w);
    if (i < n) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const river = new THREE.BufferGeometry();
  river.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  river.setIndex(idx);
  river.computeVertexNormals();
  const merged = mergeGeometries([pond.toNonIndexed(), river.toNonIndexed()].map((g) => {
    if (g.attributes.uv) g.deleteAttribute("uv");
    return g;
  }));
  if (!merged) throw new Error("water merge failed");
  return merged;
};

const GREENS = ["#3DBF55", "#2FA84A", "#52CC62", "#46B84F"];

/** A frond: two flattened segments from `m` along +z, rising by `pitch` and drooping by `droop`. */
const frond = (geos: THREE.BufferGeometry[], blob: THREE.BufferGeometry, m: THREE.Matrix4, len: number, w: number, pitch: number, droop: number, color: string) => {
  const m0 = chain(m, RX(-pitch));
  geos.push(put(blob, color, chain(m0, T(0, 0, len * 0.5), S(w, w * 0.22, len * 0.52))));
  const m1 = chain(m0, T(0, 0, len * 0.95), RX(droop));
  geos.push(put(blob, color, chain(m1, T(0, 0, len * 0.42), S(w * 0.8, w * 0.18, len * 0.46))));
};

type Spot = [number, number, number];

const FERNS: Spot[] = [
  [-3.2, 6.5, 1.1], [3.4, 7.2, 1.2], [-5.5, 3.2, 1.0], [5.8, 2.6, 1.3], [-8.4, 7.8, 1.4], [8.2, 6.8, 1.5], [-2.6, 1.2, 0.8], [2.9, -0.6, 0.9],
  [-12.5, 1.5, 1.4], [12.8, 0.4, 1.5], [-11, -5.5, 1.2], [-1.8, -6.5, 1.0], [-13.5, -10, 1.3], [0.6, -12.5, 1.1], [-9.6, -14.4, 1.2],
  [11.5, -8.5, 1.3], [7.8, -15, 1.1], [-2.2, -22, 1.2], [-11.5, -25, 1.3], [2.5, -31, 1.1], [-14, -36, 1.4], [20, -12, 1.6], [-19, -6, 1.5],
  [6.8, 10.5, 1.3], [-6.5, 11, 1.4], [14.5, -26, 1.2], [-1.5, -48, 1.3], [9, -55, 1.4],
  [-5.2, 10.5, 1.6], [4.8, 11, 1.7], [-2.4, 12.2, 1.2], [2.3, 12.6, 1.1], [-8.8, 12.5, 1.7], [8.9, 12.8, 1.8],
  [-1.9, 7.6, 0.9], [2.4, 8.2, 1.0], [-4.4, 8.4, 1.3], [5.4, 7.9, 1.4],
];
/** Little flower clusters dotting the valley floor: [x, z]. */
const FLOWERS: [number, number][] = [
  [-1.2, 5.6], [1.4, 6.3], [-3.6, 5.1], [3.9, 5.6], [-0.4, 7.9], [0.9, 9.4], [-2.8, 9.1], [4.1, 9.3], [-6.2, 6.4], [6.7, 6.1],
  [-4.8, 1.2], [4.6, 0.4], [-1.1, -3.2], [2.1, -4.4], [8.4, -6.2], [-9.4, -2.1], [5.7, -12.4], [-2.6, -15.8], [11.2, -21], [-8.3, -23.5],
  [7.5, -28], [-12.4, -31], [13.4, -44], [-4.2, -52], [15.6, -33], [3.4, -36.5],
];
const CYCADS: Spot[] = [
  [-6.8, 4.8, 1.1], [7.4, 4.2, 1.2], [-15, -2, 1.3], [15.5, -4.5, 1.4], [-4.2, -15.5, 1.0], [4.5, -9, 1.0], [-15.5, -18, 1.3], [12.5, -18.5, 1.2],
  [-1, -34, 1.1], [18.5, -35, 1.4], [-17.5, -44, 1.4],
];
const PALMS: Spot[] = [
  [-10.5, 3.5, 1.1], [10.8, 2.2, 1.2], [-17, -7, 1.3], [18.5, -9, 1.35], [-14.5, -21, 1.2], [21, -22, 1.4], [-22, -30, 1.5], [3, -24, 1.0],
  [-18, -52, 1.4], [24, -48, 1.5], [-6, -62, 1.3], [12, -70, 1.5], [-26, -12, 1.6], [26, 4, 1.7],
];

const plantsGeometry = () => {
  const rnd = mulberry(8080);
  const geos: THREE.BufferGeometry[] = [];
  const blob = new THREE.IcosahedronGeometry(1, 1);
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
  for (const [x, z, s] of FERNS) {
    const y = valleyGroundY(x, z);
    const n = 9;
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * Math.PI * 2 + rnd() * 0.5;
      const m = chain(T(x, y + 0.05, z), S(s), RY(yaw));
      frond(geos, blob, m, 0.55 + rnd() * 0.2, 0.13, 0.75 + rnd() * 0.35, 0.7 + rnd() * 0.3, GREENS[Math.floor(rnd() * 4)]);
    }
    geos.push(put(blob, "#2A8F45", chain(T(x, y + 0.08 * s, z), S(0.18 * s, 0.12 * s, 0.18 * s))));
  }
  for (const [x, z, s] of CYCADS) {
    const y = valleyGroundY(x, z);
    const h = (0.8 + rnd() * 0.6) * s;
    const bands = 6;
    for (let k = 0; k < bands; k++) {
      const r = (0.34 - k * 0.018) * s;
      geos.push(put(cyl, k % 2 ? "#8A5A33" : "#A8703E", chain(T(x, y + (h * (k + 0.5)) / bands, z), S(r, h / bands, r))));
    }
    const n = 11;
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * Math.PI * 2 + rnd() * 0.3;
      const m = chain(T(x, y + h, z), S(s), RY(yaw));
      frond(geos, blob, m, 0.75 + rnd() * 0.25, 0.14, 0.95 + rnd() * 0.3, 0.35, GREENS[i % 4]);
    }
    geos.push(put(blob, "#E0A33A", chain(T(x, y + h + 0.1 * s, z), S(0.16 * s, 0.2 * s, 0.16 * s))));
  }
  for (const [x, z, s0] of PALMS) {
    const s = s0 * 1.25;
    const y = valleyGroundY(x, z);
    const H = (5 + rnd() * 2.5) * s;
    const segs = 9;
    const lean = (rnd() - 0.5) * 0.5 + (x > 0 ? -0.12 : 0.12);
    let m = chain(T(x, y, z), RY(rnd() * 6));
    for (let k = 0; k < segs; k++) {
      const r = (0.3 - k * 0.014) * s;
      const h = H / segs;
      geos.push(put(cyl, k % 2 ? "#8A5A33" : "#9C6A3C", chain(m, T(0, h / 2, 0), S(r, h * 1.04, r))));
      geos.push(put(cyl, "#6E4526", chain(m, T(0, h * 0.95, 0), S(r * 1.12, h * 0.12, r * 1.12))));
      m = chain(m, T(0, h, 0), RZ(lean / segs));
    }
    const n = 9;
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * Math.PI * 2 + rnd() * 0.3;
      frond(geos, blob, chain(m, S(s), RY(yaw)), 1.35 + rnd() * 0.3, 0.26, 0.45 + rnd() * 0.25, 0.85 + rnd() * 0.25, GREENS[i % 4]);
    }
    geos.push(put(blob, "#2A8F45", chain(m, S(0.34 * s))));
  }
  const petal = new THREE.IcosahedronGeometry(1, 0);
  const tints = ["#FF6FA8", "#FFD23F", "#FFFFFF", "#FF8A3D", "#C77DFF"];
  FLOWERS.forEach(([x, z], i) => {
    const y = valleyGroundY(x, z);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + i;
      const fx = x + Math.cos(a) * 0.28;
      const fz = z + Math.sin(a) * 0.28;
      geos.push(put(cyl, "#2FA84A", chain(T(fx, y + 0.16, fz), S(0.025, 0.32, 0.025))));
      geos.push(put(petal, tints[(i + k) % tints.length], chain(T(fx, y + 0.34, fz), RY(a), S(0.13, 0.08, 0.13))));
      geos.push(put(petal, "#FFE45C", chain(T(fx, y + 0.39, fz), S(0.05))));
    }
  });
  return mergeAll(geos);
};

const rocksGeometry = () => {
  const rnd = mulberry(4242);
  const geos: THREE.BufferGeometry[] = [];
  const dode = new THREE.DodecahedronGeometry(1, 0);
  const tones = ["#9A9288", "#8A8278", "#A89F92", "#7E776E"];
  const spots: [number, number, number][] = [
    [-4.5, 8.5, 0.5], [4.8, 9, 0.6], [-9.5, 0.5, 0.8], [9.4, -2.5, 0.9], [-2.6, -8.2, 0.45], [-12.2, -9.6, 0.6], [-1.8, -10.5, 0.5],
    [6, -20, 1.2], [-9, -20, 0.8], [16, -14, 1.6], [-17, -15, 1.8], [2, -40, 1.1], [-13, -48, 1.5], [22, -30, 2.2], [-24, -26, 2.4],
    [0.5, 5.2, 0.35], [-6.2, -4.9, 0.35], [-10.6, -6.3, 0.4], [-3.2, -12.6, 0.35], [14, 8, 1.0], [-15, 9, 1.1],
    [3.3, 9.6, 0.45], [-3.7, 11.6, 0.5], [6.6, 13.2, 0.7],
  ];
  for (const [x, z, s] of spots) {
    const y = valleyGroundY(x, z);
    geos.push(put(dode, shadeHex(tones[Math.floor(rnd() * 4)], (rnd() - 0.5) * 0.06), chain(T(x, y + s * 0.3, z), RY(rnd() * 6), RX(rnd() * 0.6), S(s * 1.25, s * 0.8, s))));
  }
  return mergeAll(geos);
};

const VOLCANO: [number, number][] = [
  [27, -1],
  [24, 3],
  [19, 8.5],
  [14, 14.5],
  [10, 20],
  [7.2, 24.5],
  [5.6, 27.2],
  [5.0, 28.4],
  [4.2, 28.7],
  [3.3, 27.4],
  [0, 26.9],
];
const VOLCANO_TOP = 28.4;
const LAVA_ANGLES = [0.35, 1.3, -0.55];

const volcanoGeometry = (seed: number) => {
  const g = new THREE.LatheGeometry(
    VOLCANO.map(([r, h]) => new THREE.Vector2(r, h)),
    20,
  ).toNonIndexed();
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const base = new THREE.Color("#4E8C47");
  const rockA = new THREE.Color("#7A5E54");
  const rockB = new THREE.Color("#5A433D");
  const top = new THREE.Color("#3A2C2A");
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = Math.hypot(v.x, v.z);
    const k = 1 + 0.1 * noise3(v.x * 0.15 + seed, v.y * 0.15, v.z * 0.15) * clamp01(v.y / 6);
    p.setXYZ(i, v.x * k, v.y, v.z * k);
    const h = v.y / VOLCANO_TOP;
    c.copy(rockA).lerp(rockB, clamp01(0.5 + noise3(v.x * 0.3, v.y * 0.3 + seed, v.z * 0.3)));
    c.lerp(base, clamp01(1 - h * 3.2));
    c.lerp(top, clamp01((h - 0.78) * 4));
    if (r < 3.6 && v.y > 26) c.set("#FF6A1A");
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
};

/** Glowing lava streams running down the volcano's flank from the crater lip. */
const lavaGeometry = () => {
  const geos: THREE.BufferGeometry[] = [];
  const rOf = (y: number) => {
    for (let i = 0; i < 7; i++) {
      const [r0, h0] = VOLCANO[i];
      const [r1, h1] = VOLCANO[i + 1];
      if (y <= h1 && y >= h0) return r0 + ((r1 - r0) * (y - h0)) / (h1 - h0);
    }
    return VOLCANO[0][0];
  };
  LAVA_ANGLES.forEach((a0, j) => {
    const pts: THREE.Vector3[] = [];
    const bottom = 12 + j * 4;
    for (let y = VOLCANO_TOP - 0.4; y > bottom; y -= 1.6) {
      const a = a0 + 0.08 * Math.sin(y * 0.5 + j);
      const r = rOf(y) + 0.25;
      pts.push(new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.55 - j * 0.08, 6, false);
    geos.push(tube);
  });
  const merged = mergeGeometries(geos);
  if (!merged) throw new Error("lava merge failed");
  return merged;
};

const Volcano: React.FC<{ t: number; seed: number }> = ({ t, seed }) => {
  const geos = useMemo(
    () => ({
      cone: volcanoGeometry(seed),
      lava: lavaGeometry(),
      pool: new THREE.CircleGeometry(3.5, 20).rotateX(-Math.PI / 2),
    }),
    [seed],
  );
  const glow = 0.85 + 0.15 * Math.sin(t * 3 + seed);
  return (
    <group>
      <mesh geometry={geos.cone} material={vertexMat(0.95, true, 0.12)} castShadow receiveShadow />
      <mesh geometry={geos.lava} material={toy("#FF7A1A", { glow: 0.9 + 0.3 * glow })} />
      <mesh geometry={geos.pool} material={toy("#FFB02E", { glow: 1.2 })} position={[0, 27.3, 0]} />
      <Halo color="#FF7A2A" size={22} opacity={0.45 * glow} position={[0, VOLCANO_TOP + 2, 0]} />
      <group position={[0, VOLCANO_TOP - 0.5, 0]}>
        <Smoke t={t + seed * 3.1} height={40} r0={2.6} r1={9} count={11} speed={2.4} wobble={1.6} drift={0.28} color="#8E8884" opacity={0.9} seed={seed} />
      </group>
    </group>
  );
};

const LILY: [number, number, number][] = [
  [-9.2, -7.6, 0.55],
  [-5.2, -9.8, 0.45],
  [-8.1, -10.2, 0.5],
  [-4.4, -7.4, 0.4],
  [-10.6, -9.1, 0.4],
];

/** Where a Brachiosaurus (≈ 14 tall) can stand in the background meadow (flat, y = 0). */
export const BRACHIO_SPOT: V3 = [10, 0, -38];
/** Nubi's spot in the foreground of the valley (flat, y = 0), clear of plants. */
export const VALLEY_NUBI: V3 = [0, 0, 3];

/**
 * Lush prehistoric valley, ≈ 180 × 180: a flat grassy floor (y = 0 for |x| < 12, see
 * valleyGroundY) with dirt patches, a pond with lily pads at [-7, -8.5] feeding a river that
 * winds back to the distance, ferns, cycads, tall palms and rocks framing both sides, hills rising
 * at the sides, and two volcanoes in the distance ([-16, 0, -100], 28 tall, and [24, 0, -112])
 * with glowing lava streams and big smoke plumes (`t` seconds). The meadow at BRACHIO_SPOT is
 * kept clear for a Brachiosaurus; Nubi stands at VALLEY_NUBI. No sky: use a CSS gradient.
 */
export const PrehistoricValley: React.FC<{ t?: number }> = ({ t = 0 }) => {
  const geos = useMemo(
    () => ({
      terrain: terrainGeometry(),
      water: waterGeometry(),
      plants: plantsGeometry(),
      rocks: rocksGeometry(),
      pad: new THREE.CircleGeometry(1, 20, 0.3, Math.PI * 2 - 0.6).rotateX(-Math.PI / 2),
      ring: new THREE.RingGeometry(0.92, 1, 40).rotateX(-Math.PI / 2),
      flower: new THREE.IcosahedronGeometry(0.16, 0),
    }),
    [],
  );
  const water = toy("#3BB7FF", { rough: 0.15, glow: 0.35 });
  return (
    <group>
      <mesh geometry={geos.terrain} material={vertexMat(0.95, true, 0.12)} receiveShadow />
      <mesh geometry={geos.water} material={water} receiveShadow />
      {/* Ripples spreading on the pond. */}
      {[0, 1, 2].map((i) => {
        const k = (((t * 0.35 + i / 3) % 1) + 1) % 1;
        return (
          <mesh key={i} geometry={geos.ring} position={[POND.x + 1.5 - i * 1.4, -0.12, POND.z + 0.4 - i * 0.5]} scale={0.4 + k * 1.6}>
            <meshBasicMaterial color="#DDF5FF" transparent opacity={0.7 * (1 - k)} depthWrite={false} />
          </mesh>
        );
      })}
      {LILY.map(([x, z, r], i) => (
        <group key={i} position={[x, -0.11, z]} rotation={[0, i * 1.7, 0]}>
          <mesh geometry={geos.pad} material={toy("#2FAE4E", { rough: 0.5 })} scale={r} />
          {i % 2 === 0 ? <mesh geometry={geos.flower} material={toy("#FF8FC8", { flat: true, glow: 0.25 })} position={[0.1, 0.08, 0.1]} /> : null}
        </group>
      ))}
      <mesh geometry={geos.rocks} material={vertexMat(0.9, true, 0.1)} castShadow receiveShadow />
      <mesh geometry={geos.plants} material={vertexMat(0.7, true, 0.16)} castShadow />
      <group position={[-16, 0, -100]}>
        <Volcano t={t} seed={1} />
      </group>
      <group position={[24, 2, -112]} scale={0.75}>
        <Volcano t={t} seed={2} />
      </group>
    </group>
  );
};

// =======================================================================================
// Space backdrop

const starfieldTexture = () =>
  canvasTexture("dino-starfield", 2048, 1024, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#050819");
    g.addColorStop(0.5, "#0B1336");
    g.addColorStop(1, "#050819");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const nebulae: [string, number, number, number][] = [
      ["rgba(140,70,255,0.26)", 0.18, 0.42, 420],
      ["rgba(255,80,170,0.18)", 0.36, 0.58, 300],
      ["rgba(40,200,255,0.16)", 0.62, 0.36, 360],
      ["rgba(90,120,255,0.2)", 0.84, 0.6, 440],
      ["rgba(255,120,200,0.12)", 0.95, 0.4, 260],
    ];
    for (const [c, fx, fy, r] of nebulae) {
      for (const dx of [-W, 0, W]) {
        const rg = ctx.createRadialGradient(fx * W + dx, fy * H, 0, fx * W + dx, fy * H, r);
        rg.addColorStop(0, c);
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);
      }
    }
    const rnd = mulberry(2024);
    const tints = ["#FFFFFF", "#CFE3FF", "#FFF3C8", "#FFFFFF", "#E6D8FF"];
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * W;
      const y = H * (0.06 + 0.88 * rnd());
      const big = rnd() < 0.08;
      const r = big ? 1.5 + rnd() * 1.4 : 0.6 + rnd() * 0.9;
      ctx.globalAlpha = 0.45 + rnd() * 0.55;
      ctx.fillStyle = tints[Math.floor(rnd() * tints.length)];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 50; i++) {
      const x = rnd() * W;
      const y = H * (0.1 + 0.8 * rnd());
      const rg = ctx.createRadialGradient(x, y, 0, x, y, 9);
      rg.addColorStop(0, "rgba(255,255,255,0.95)");
      rg.addColorStop(0.3, "rgba(200,225,255,0.45)");
      rg.addColorStop(1, "rgba(200,225,255,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(x - 10, y - 10, 20, 20);
    }
  });

const sparkleTexture = () =>
  canvasTexture("dino-sparkle", 128, 128, (ctx, W) => {
    const c = W / 2;
    const rg = ctx.createRadialGradient(c, c, 0, c, c, c);
    rg.addColorStop(0, "rgba(255,255,255,1)");
    rg.addColorStop(0.18, "rgba(255,255,255,0.55)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, W);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    for (const [w, h] of [
      [5, c * 0.95],
      [c * 0.95, 5],
    ]) {
      ctx.beginPath();
      ctx.moveTo(c, c - h);
      ctx.quadraticCurveTo(c + w, c, c, c + h);
      ctx.quadraticCurveTo(c - w, c, c, c - h);
      ctx.fill();
    }
  });

/**
 * Starry space backdrop for the Earth / asteroid shot: an inside-out sphere (`radius` 400,
 * centred on the origin, unlit, drawn first) with a deep-blue starfield and soft purple,
 * pink and cyan nebulae, 40 bigger sparkling stars that twinkle with `t` (seconds) and, with
 * `sun`, a warm sun glow up and to the left behind the scene. Keep the camera near the origin
 * (well inside the sphere). A plain CSS background (e.g. radial-gradient(#1B2660, #050819))
 * behind a transparent canvas also works if the sphere is not wanted.
 */
export const SpaceBackdrop: React.FC<{ t?: number; radius?: number; sun?: boolean }> = ({ t = 0, radius = 400, sun = true }) => {
  const geo = useMemo(() => new THREE.SphereGeometry(radius, 48, 24), [radius]);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: starfieldTexture(),
        side: THREE.BackSide,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    [],
  );
  const sparkles = useMemo(() => {
    const rnd = mulberry(77);
    return Array.from({ length: 40 }).map(() => {
      const d = new THREE.Vector3(rnd() - 0.5, (rnd() - 0.5) * 0.9, rnd() - 0.5).normalize();
      return {
        pos: d.multiplyScalar(radius * 0.93),
        size: radius * (0.012 + rnd() * 0.02),
        speed: 1.5 + rnd() * 2.5,
        phase: rnd() * 6.28,
        mat: new THREE.SpriteMaterial({
          map: sparkleTexture(),
          color: rnd() < 0.5 ? "#FFFFFF" : rnd() < 0.5 ? "#BFE0FF" : "#FFE9B8",
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          toneMapped: false,
          fog: false,
        }),
      };
    });
  }, [radius]);
  return (
    <group>
      <mesh geometry={geo} material={mat} renderOrder={-10} />
      {sparkles.map((s, i) => {
        const k = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
        s.mat.opacity = 0.35 + 0.65 * k;
        return <sprite key={i} material={s.mat} position={s.pos} scale={[s.size * (0.7 + 0.5 * k), s.size * (0.7 + 0.5 * k), 1]} renderOrder={-9} />;
      })}
      {sun ? (
        <group position={[-radius * 0.62, radius * 0.3, -radius * 0.6]}>
          <Halo color="#FFD27A" size={radius * 0.5} opacity={0.55} />
          <Halo color="#FFFFFF" size={radius * 0.16} opacity={1} />
        </group>
      ) : null}
    </group>
  );
};

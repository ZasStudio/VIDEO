import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { V3, canvasTexture, glowTexture, paintGeo, toy, useFontsReady, vertexMat } from "../inca/kit";
import { mulberry } from "../noise";
import { additive } from "../thanos/FX";

// TIMECO's side of "¿Qué pasaría si el dinero fuera tiempo de vida?": the ZONA PREMIUM plaza at
// night (marble floor, golden lampposts, a fountain of liquid gold, luxury storefronts), the dark
// city around it whose buildings are plugged into glowing glass pipes that carry golden "time"
// to TIMECO's headquarters (a gigantic dark-glass hourglass tower with a golden sand core, red
// lights, the wordmark, a façade screen and a gigantic door at its base), the security drone and
// its scan beam, the light and fog that spill out of the open door and a few small effects.
// World units sized for Nubi at size 2 (2 wide, ≈ 2 tall), ground at y = 0. `t` is seconds.
// Everything is deterministic (seeded) and builds its geometry once.
//
// Layout (top view, +z towards the plaza's far end):
//   the plaza        x −13..13, z −40..36 (storefront rows along both sides and across the end)
//   the esplanade    x −60..60, z GATE.front..−40 (red guide lines to the door)
//   the tower        centred at TOWER_AT, its door facing +z, the gatehouse front at GATE.front
//   the city         all around, its buildings piped into the tower's upper bulb

// =======================================================================================
// Palette and small helpers

export const TIMECO_COLORS = { charcoal: "#1B1B24", red: "#FF3B3B", gold: "#FFC83D" };
const CHAR = "#1B1B24";
const CHAR2 = "#262531";
const RED = "#FF3B3B";
const SAND = "#FFC83D";
const GOLDM = "#D9A63A";
const MARBLE = "#E9E3D6";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (e0: number, e1: number, x: number) => {
  const k = clamp01((x - e0) / (e1 - e0));
  return k * k * (3 - 2 * k);
};
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const frac = (v: number) => v - Math.floor(v);
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
/** Merges geometries that keep their uvs (textured meshes). */
const mergeUV = (geos: THREE.BufferGeometry[]) => {
  const clean = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const m = mergeGeometries(clean, false);
  if (!m) throw new Error("mergeGeometries failed");
  return m;
};
const xform = (g: THREE.BufferGeometry, pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) =>
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale)));
const place = (g: THREE.BufferGeometry, color: string, pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) => xform(paintGeo(g, color), pos, rot, scale);

const basicCache = new Map<string, THREE.MeshBasicMaterial>();
/** Unlit flat colour (neon, lamps). Cached: never mutate. */
const basic = (color: string) => {
  let m = basicCache.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    basicCache.set(color, m);
  }
  return m;
};

/** Additive glow sprite (camera-facing, no fog). */
export const Halo: React.FC<{ color: string; size: number; opacity?: number; position?: V3 }> = ({ color, size, opacity = 1, position }) => {
  const mat = useMemo(() => additive(new THREE.SpriteMaterial({ map: glowTexture(), color, toneMapped: false, fog: false })), [color]);
  if (opacity <= 0.004 || size <= 0) return null;
  mat.opacity = Math.min(1, opacity);
  return <sprite material={mat} position={position} scale={[size, size, 1]} renderOrder={6} />;
};

// ---------------------------------------------------------------------------------------
// Glowing points (time particles, sand grains, stars): additive round sprites sized in world
// units. Each user fills position / size / alpha in a layout effect.

const POINT_VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
uniform float uHalfH;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * projectionMatrix[1][1] * uHalfH / max(0.05, -mv.z), 0.0, 220.0);
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * mv;
}`;
const POINT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uCore;
uniform float uOpacity;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float glow = pow(1.0 - d, 1.8);
  float core = smoothstep(0.5, 0.0, d);
  vec3 col = uColor * glow + uCore * core * 0.9;
  gl_FragColor = vec4(col * vAlpha * uOpacity, 1.0);
}`;

const usePoints = (count: number, color: string, core: string) => {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(count), 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(count), 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    return g;
  }, [count]);
  const mat = useMemo(
    () =>
      additive(
        new THREE.ShaderMaterial({
          vertexShader: POINT_VERT,
          fragmentShader: POINT_FRAG,
          uniforms: {
            uHalfH: { value: 960 },
            uColor: { value: new THREE.Color(color) },
            uCore: { value: new THREE.Color(core) },
            uOpacity: { value: 1 },
          },
        }),
      ),
    [color, core],
  );
  const gl = useThree((s) => s.gl);
  const buf = useMemo(() => new THREE.Vector2(), []);
  const commit = () => {
    gl.getDrawingBufferSize(buf);
    mat.uniforms.uHalfH.value = buf.y / 2;
    for (const k of ["position", "aSize", "aAlpha"]) (geo.attributes[k] as THREE.BufferAttribute).needsUpdate = true;
  };
  return {
    geo,
    mat,
    pos: geo.attributes.position.array as Float32Array,
    size: geo.attributes.aSize.array as Float32Array,
    alpha: geo.attributes.aAlpha.array as Float32Array,
    commit,
  };
};

// =======================================================================================
// Layout

/** Centre of the tower's base. Its door faces +z (towards the plaza). */
export const TOWER_AT: V3 = [0, 0, -150];
/** The hourglass: plates (top and bottom), glass bulbs, waist, posts. Heights above the ground. */
export const HG = { plateR: 37, plateH: 6, bulbR: 31, waistR: 4, waistY: 75, top: 150, postR: 34.5 };
/** The gatehouse at the tower's base and its gigantic door (front face at z = front). */
export const GATE = { w: 30, h: 38, depth: 28, front: TOWER_AT[2] + 38, doorW: 14, doorH: 24 };
/** The premium plaza (marble) and its storefront rows. */
export const PLAZA = { x: 13, z0: -40, z1: 36 };
/** Alarma: where Nubi ends its happy walk on the plaza (camera looking +z). */
export const PLAZA_NUBI: V3 = [0.4, 0, 2];
/** The glowing ZONA PREMIUM threshold across the plaza (Nubi crosses it as the alarm starts). */
export const PREMIUM_LINE_Z = 3.6;
/** The "ZONA PREMIUM" monument sign beside the walk. */
export const SIGN_AT: V3 = [-3.9, 0, 9.5];
/** The fountain of liquid gold. */
export const FOUNTAIN_AT: V3 = [4.6, 0, 18];
/** Torre: Nubi at the plaza's edge, facing the tower. */
export const EDGE_NUBI: V3 = [0, 0, -34];
/** Dron / puerta: Nubi in front of the gigantic door. */
export const DOOR_NUBI: V3 = [0, 0, GATE.front + 20];

/** Radius of the tower's glass bulbs at height y: conical, rounding into the plates. */
export const bulbRadius = (y: number) => {
  const span = HG.waistY - HG.plateH;
  const s = clamp01(Math.abs(y - HG.waistY) / span);
  const f = 0.5 * s + 0.5 * Math.pow(Math.sin((s * Math.PI) / 2), 1.5);
  return HG.waistR + (HG.bulbR - HG.waistR) * f;
};

// =======================================================================================
// Sky, fog and lights

/** CSS night sky behind the canvas: ink above, TIMECO's red glow at the horizon (0 = top, 1 = bottom). */
export const timecoSky = (horizon = 0.6) => {
  const h = Math.max(0.05, Math.min(0.98, horizon)) * 100;
  return `linear-gradient(180deg, #04040A 0%, #080915 ${(h * 0.45).toFixed(1)}%, #120F25 ${(h * 0.78).toFixed(1)}%, #2A1228 ${(h * 0.94).toFixed(1)}%, #451626 ${h.toFixed(1)}%, #1A0F18 ${Math.min(100, h + 8).toFixed(1)}%, #0E0B12 100%)`;
};
export const TIMECO_SKY = timecoSky(0.6);
/** Fog colour that melts the far city into the horizon glow. */
export const TIMECO_HAZE = "#24122A";

/** Scene fog (child of the canvas). */
export const TimecoFog: React.FC<{ near?: number; far?: number; color?: string }> = ({ near = 60, far = 420, color = TIMECO_HAZE }) => {
  const scene = useThree((s) => s.scene);
  const fog = useMemo(() => new THREE.Fog(color, 10, 100), [color]);
  useLayoutEffect(() => {
    fog.near = near;
    fog.far = far;
    scene.fog = fog;
  });
  useLayoutEffect(
    () => () => {
      if (scene.fog === fog) scene.fog = null;
    },
    [scene, fog],
  );
  return null;
};

/** Night light: cool moonlight, a dim sky fill, TIMECO's red from the tower (−z), warm gold from the plaza (+z). */
export const TimecoLights: React.FC<{ k?: number; red?: number; warm?: number }> = ({ k = 1, red = 1, warm = 1 }) => (
  <>
    <hemisphereLight args={["#5A63A8", "#1C0F16", 1.15 * k]} />
    <directionalLight position={[-18, 30, 14]} intensity={1.0 * k} color="#AFC0FF" />
    <directionalLight position={[6, 14, -60]} intensity={1.1 * red * k} color="#FF4646" />
    <directionalLight position={[12, 9, 40]} intensity={0.75 * warm * k} color="#FFC977" />
  </>
);

// =======================================================================================
// Canvas drawings: TIMECO's logo, neon text, marble, windows

const setSpacing = (ctx: CanvasRenderingContext2D, px: number) => {
  (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
};

/** TIMECO's logo (an hourglass inside a ring) centred at (cx, cy), outer radius r. */
export const drawTimecoLogo = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  o: { ring?: string; glass?: string; sand?: string; bg?: string | null; glow?: number } = {},
) => {
  const { ring = RED, glass = "#F6EEDB", sand = SAND, bg = CHAR, glow = 0 } = o;
  ctx.save();
  if (bg) {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowColor = ring;
  ctx.shadowBlur = r * 0.3 * glow;
  ctx.lineWidth = r * 0.15;
  ctx.strokeStyle = ring;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.83, 0, Math.PI * 2);
  ctx.stroke();
  if (glow) ctx.stroke();
  ctx.shadowColor = sand;
  ctx.shadowBlur = r * 0.15 * glow;
  const w = r * 0.4;
  const h = r * 0.5;
  const neck = r * 0.045;
  ctx.fillStyle = sand;
  ctx.fillRect(cx - w * 1.2, cy - h - r * 0.1, w * 2.4, r * 0.1);
  ctx.fillRect(cx - w * 1.2, cy + h, w * 2.4, r * 0.1);
  ctx.lineWidth = r * 0.06;
  ctx.lineJoin = "round";
  ctx.strokeStyle = glass;
  ctx.beginPath();
  ctx.moveTo(cx - w, cy - h);
  ctx.lineTo(cx + w, cy - h);
  ctx.lineTo(cx + neck, cy);
  ctx.lineTo(cx + w, cy + h);
  ctx.lineTo(cx - w, cy + h);
  ctx.lineTo(cx - neck, cy);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = sand;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.62, cy - h * 0.42);
  ctx.lineTo(cx + w * 0.62, cy - h * 0.42);
  ctx.lineTo(cx, cy - h * 0.02);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - r * 0.014, cy - h * 0.04, r * 0.028, h * 0.7);
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.86, cy + h * 0.94);
  ctx.lineTo(cx + w * 0.86, cy + h * 0.94);
  ctx.lineTo(cx, cy + h * 0.46);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

/** Glowing neon text: a coloured glow, then a hot core. */
const neonText = (ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, blur: number, core = "#FFFFFF") => {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.fillText(s, x, y);
  ctx.shadowBlur = blur * 0.25;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = core;
  ctx.fillText(s, x, y);
  ctx.restore();
};

const logoTexture = () =>
  canvasTexture("tc-logo", 512, 512, (ctx, W) => {
    ctx.clearRect(0, 0, W, W);
    drawTimecoLogo(ctx, W / 2, W / 2, W * 0.48, { glow: 1 });
  });

const marbleTexture = () =>
  canvasTexture(
    "tc-marble",
    512,
    512,
    (ctx, W, H) => {
      const rnd = mulberry(31);
      const tiles = 2;
      const s = W / tiles;
      for (let i = 0; i < tiles; i++) {
        for (let j = 0; j < tiles; j++) {
          const dark = (i + j) % 2 === 0;
          ctx.fillStyle = dark ? "#16141B" : "#2A2630";
          ctx.fillRect(i * s, j * s, s, s);
          // Veins.
          for (let v = 0; v < 7; v++) {
            ctx.strokeStyle = dark ? `rgba(240,225,200,${0.05 + rnd() * 0.08})` : `rgba(255,236,200,${0.06 + rnd() * 0.1})`;
            ctx.lineWidth = 0.6 + rnd() * 1.8;
            ctx.beginPath();
            let x = i * s + rnd() * s;
            let y = j * s;
            ctx.moveTo(x, y);
            for (let k = 0; k < 6; k++) {
              x += (rnd() - 0.5) * s * 0.35;
              y += s / 6;
              ctx.lineTo(Math.max(i * s, Math.min((i + 1) * s, x)), y);
            }
            ctx.stroke();
          }
        }
      }
      // Gold inlay between the tiles and a small diamond at each corner.
      ctx.fillStyle = "#C9993A";
      for (let k = 0; k <= tiles; k++) {
        ctx.fillRect(k * s - 3, 0, 6, H);
        ctx.fillRect(0, k * s - 3, W, 6);
      }
      for (let i = 0; i <= tiles; i++) {
        for (let j = 0; j <= tiles; j++) {
          ctx.beginPath();
          ctx.moveTo(i * s, j * s - 14);
          ctx.lineTo(i * s + 14, j * s);
          ctx.lineTo(i * s, j * s + 14);
          ctx.lineTo(i * s - 14, j * s);
          ctx.closePath();
          ctx.fill();
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

const stoneTexture = () =>
  canvasTexture(
    "tc-esplanade",
    256,
    256,
    (ctx, W, H) => {
      const rnd = mulberry(8);
      ctx.fillStyle = "#17161E";
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          ctx.fillStyle = `rgba(${40 + rnd() * 14},${38 + rnd() * 10},${50 + rnd() * 12},1)`;
          ctx.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

/** City windows: 8 columns × 8 floors per repeat (16 × 24 world units), some lit. */
const cityWindowTexture = () =>
  canvasTexture(
    "tc-city-windows",
    512,
    512,
    (ctx, W, H) => {
      const rnd = mulberry(77);
      ctx.fillStyle = "#13121A";
      ctx.fillRect(0, 0, W, H);
      const cw = W / 8;
      const rh = H / 8;
      for (let r = 0; r < 8; r++) {
        ctx.fillStyle = "#1B1A24";
        ctx.fillRect(0, r * rh + rh * 0.86, W, rh * 0.08);
        for (let c = 0; c < 8; c++) {
          const x = c * cw + cw * 0.2;
          const y = r * rh + rh * 0.2;
          const w = cw * 0.6;
          const h = rh * 0.52;
          const lit = rnd();
          if (lit < 0.36) {
            const tone = rnd();
            ctx.fillStyle = tone < 0.55 ? "#FFC870" : tone < 0.82 ? "#FFE7B8" : tone < 0.93 ? "#9EC2FF" : "#FF4A4A";
            ctx.globalAlpha = 0.55 + rnd() * 0.45;
          } else {
            ctx.fillStyle = "#22212D";
            ctx.globalAlpha = 1;
          }
          ctx.fillRect(x, y, w, h);
          ctx.globalAlpha = 1;
        }
      }
    },
    { wrapS: true, wrapT: true },
  );

/** The tower's dark glass: semi-transparent panes (the sand glows through), opaque mullions, a few lit floors. */
const towerGlassTexture = () =>
  canvasTexture(
    "tc-tower-glass",
    256,
    512,
    (ctx, W, H) => {
      const rnd = mulberry(5);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(26,24,40,0.5)";
      ctx.fillRect(0, 0, W, H);
      const cols = 4;
      const rows = 8;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = rnd();
          if (v < 0.1) {
            ctx.fillStyle = v < 0.05 ? "rgba(255,70,60,0.9)" : "rgba(255,196,96,0.85)";
            ctx.fillRect(c * (W / cols) + 6, r * (H / rows) + 8, W / cols - 12, H / rows - 16);
          }
        }
      }
      ctx.fillStyle = "rgba(12,11,18,1)";
      for (let c = 0; c <= cols; c++) ctx.fillRect(c * (W / cols) - 3, 0, 6, H);
      for (let r = 0; r <= rows; r++) ctx.fillRect(0, r * (H / rows) - 4, W, 8);
      // A thin red pinstripe on every other floor line.
      ctx.fillStyle = "rgba(255,59,59,0.55)";
      for (let r = 0; r <= rows; r += 2) ctx.fillRect(0, r * (H / rows) - 1, W, 2);
    },
    { wrapS: true, wrapT: true },
  );

// =======================================================================================
// The city: buildings all around, piped into the tower

type Bldg = { x: number; z: number; w: number; d: number; h: number };

const inPlazaZone = (x: number, z: number, r: number) => Math.abs(x) < PLAZA.x + 9 + r && z > PLAZA.z0 - 6 - r && z < PLAZA.z1 + 8 + r;
const inEsplanade = (x: number, z: number, r: number) => Math.abs(x) < 46 + r && z < PLAZA.z0 + r && z > TOWER_AT[2] - 10;
const nearTower = (x: number, z: number, r: number) => Math.hypot(x - TOWER_AT[0], z - TOWER_AT[2]) < 52 + r;

const CITY = once(() => {
  const rnd = mulberry(4242);
  const list: Bldg[] = [];
  const fits = (x: number, z: number, r: number) => {
    if (inPlazaZone(x, z, r) || inEsplanade(x, z, r) || nearTower(x, z, r)) return false;
    for (const b of list) if (Math.hypot(b.x - x, b.z - z) < r + Math.max(b.w, b.d) * 0.62) return false;
    return true;
  };
  // A ring of tall buildings around the tower (the ones piped into it).
  for (let i = 0; i < 900 && list.length < 120; i++) {
    const a = rnd() * Math.PI * 2;
    const rad = 58 + Math.pow(rnd(), 1.3) * 190;
    const x = TOWER_AT[0] + Math.sin(a) * rad;
    const z = TOWER_AT[2] + Math.cos(a) * rad;
    const w = 9 + rnd() * 11;
    const d = 9 + rnd() * 11;
    const near = 1 - clamp01((rad - 58) / 190);
    const h = 16 + rnd() * 26 + near * 34;
    if (!fits(x, z, Math.max(w, d) * 0.62)) continue;
    list.push({ x, z, w, d, h });
  }
  // The blocks behind and beside the plaza (the backdrop of the alarm shot).
  for (let i = 0; i < 900 && list.length < 230; i++) {
    const x = (rnd() - 0.5) * 300;
    const z = -40 + rnd() * 270;
    const w = 8 + rnd() * 12;
    const d = 8 + rnd() * 12;
    const h = 14 + rnd() * 40 + (Math.abs(x) < 40 && z > 50 && z < 110 ? 18 : 0);
    if (!fits(x, z, Math.max(w, d) * 0.62)) continue;
    list.push({ x, z, w, d, h });
  }
  return list;
});

const buildCityGeometry = (list: Bldg[]) => {
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const U = 1 / 16;
  const Vs = 1 / 24;
  const quad = (p: V3[], n: V3, uvs: [number, number][]) => {
    for (const k of [0, 1, 2, 0, 2, 3]) {
      pos.push(...p[k]);
      nor.push(...n);
      uv.push(...uvs[k]);
    }
  };
  list.forEach((b, i) => {
    const x0 = b.x - b.w / 2;
    const x1 = b.x + b.w / 2;
    const z0 = b.z - b.d / 2;
    const z1 = b.z + b.d / 2;
    const h = b.h;
    const wall = (p: V3[], n: V3, len: number, seed: number) => {
      const ou = Math.floor(hash(i * 3.1 + seed) * 8) / 8;
      const ov = Math.floor(hash(i * 7.7 + seed) * 8) / 8;
      quad(p, n, [
        [ou, ov],
        [ou + len * U, ov],
        [ou + len * U, ov + h * Vs],
        [ou, ov + h * Vs],
      ]);
    };
    wall([[x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1]], [0, 0, 1], b.w, 1);
    wall([[x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0]], [0, 0, -1], b.w, 2);
    wall([[x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1]], [1, 0, 0], b.d, 3);
    wall([[x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0]], [-1, 0, 0], b.d, 4);
    const r: [number, number] = [0.004, 0.004];
    quad([[x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0]], [0, 1, 0], [r, r, r, r]);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
};

type PipeSpec = { samples: Float32Array; n: number; len: number; count: number; seed: number };

const PIPE_SAMPLES = 160;
/** Glass pipes from the roofs of the buildings around the tower to its upper bulb. */
const PIPES = once(() => {
  const rnd = mulberry(99);
  const list = CITY();
  const picks = list
    .map((b, i) => ({ b, i, rad: Math.hypot(b.x - TOWER_AT[0], b.z - TOWER_AT[2]), ang: Math.atan2(b.x - TOWER_AT[0], b.z - TOWER_AT[2]) }))
    .filter((p) => p.rad < 175 && Math.abs(p.ang) < 2.3)
    .sort((a, b) => a.rad - b.rad)
    .slice(0, 34);
  const curves: THREE.CatmullRomCurve3[] = [];
  const specs: PipeSpec[] = [];
  const roofs: V3[] = [];
  const ends: { p: V3; n: V3 }[] = [];
  picks.forEach((p, k) => {
    const { b } = p;
    const ye = 90 + rnd() * 40;
    const th = p.ang + (rnd() - 0.5) * 0.25;
    const R = bulbRadius(ye) + 0.4;
    const n: V3 = [Math.sin(th), 0, Math.cos(th)];
    const end: V3 = [TOWER_AT[0] + n[0] * R, ye, TOWER_AT[2] + n[2] * R];
    const roof: V3 = [b.x + (rnd() - 0.5) * b.w * 0.4, b.h, b.z + (rnd() - 0.5) * b.d * 0.4];
    const P0 = new THREE.Vector3(roof[0], roof[1] + 1.2, roof[2]);
    const P1 = new THREE.Vector3(roof[0], roof[1] + 7 + rnd() * 8, roof[2]);
    const mid = new THREE.Vector3().lerpVectors(P0, new THREE.Vector3(...end), 0.5);
    mid.y = Math.max(P1.y, ye * 0.8) + 6 + rnd() * 10;
    const P3 = new THREE.Vector3(end[0] + n[0] * 9, ye + 2, end[2] + n[2] * 9);
    const curve = new THREE.CatmullRomCurve3([P0, P1, mid, P3, new THREE.Vector3(...end)], false, "centripetal");
    curves.push(curve);
    const pts = curve.getSpacedPoints(PIPE_SAMPLES - 1);
    const samples = new Float32Array(PIPE_SAMPLES * 3);
    pts.forEach((v, i) => samples.set([v.x, v.y, v.z], i * 3));
    const len = curve.getLength();
    specs.push({ samples, n: PIPE_SAMPLES, len, count: Math.max(8, Math.round(len / 4.2)), seed: k });
    roofs.push(roof);
    ends.push({ p: end, n });
  });
  const glass = mergeUV(curves.map((c) => new THREE.TubeGeometry(c, 80, 1.05, 8, false)));
  const core = mergeUV(curves.map((c) => new THREE.TubeGeometry(c, 80, 0.34, 5, false)));
  // A pump with a red light on each roof, a gold collar where each pipe enters the tower.
  const parts: THREE.BufferGeometry[] = [];
  roofs.forEach((r) => {
    parts.push(place(rbox(3.2, 2.2, 3.2, 0.3), CHAR2, [r[0], r[1] + 1.1, r[2]]));
    parts.push(place(new THREE.CylinderGeometry(1.5, 1.5, 0.8, 12), GOLDM, [r[0], r[1] + 2.5, r[2]]));
  });
  ends.forEach(({ p, n }) => {
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(n[0] * 0.9, 0.15, n[2] * 0.9).normalize());
    const e = new THREE.Euler().setFromQuaternion(q);
    parts.push(place(new THREE.CylinderGeometry(1.7, 2.2, 2.2, 12), GOLDM, [p[0] + n[0] * 0.8, p[1] + 0.2, p[2] + n[2] * 0.8], [e.x, e.y, e.z]));
  });
  return { specs, glass, core, fittings: mergeAll(parts), roofs };
});

/** The time particles flowing through every pipe towards the tower. */
const PipeFlow: React.FC<{ t: number; speed?: number; amount?: number }> = ({ t, speed = 1, amount = 1 }) => {
  const { specs } = PIPES();
  const total = useMemo(() => specs.reduce((s, p) => s + p.count, 0), [specs]);
  const P = usePoints(total, "#FFB41F", "#FFF4C8");
  useLayoutEffect(() => {
    let o = 0;
    for (const s of specs) {
      const v = (18 * speed) / s.len;
      for (let i = 0; i < s.count; i++) {
        const u = frac(i / s.count + t * v + hash(s.seed) * 0.37 + 0.04 * Math.sin(i * 7.1));
        const f = u * (s.n - 1);
        const a = Math.floor(f);
        const b = Math.min(s.n - 1, a + 1);
        const k = f - a;
        for (let c = 0; c < 3; c++) P.pos[o * 3 + c] = lerp(s.samples[a * 3 + c], s.samples[b * 3 + c], k);
        P.size[o] = 1.25 + 0.5 * hash(i * 1.7 + s.seed);
        P.alpha[o] = amount * (0.65 + 0.35 * Math.sin(t * 6 + i * 2.3)) * smooth(0, 0.04, u) * (1 - smooth(0.96, 1, u));
        o++;
      }
    }
    P.commit();
  });
  return <points geometry={P.geo} material={P.mat} frustumCulled={false} renderOrder={4} />;
};

/** A dim starfield far away (no fog). */
const STARS = once(() => {
  const rnd = mulberry(3);
  const out: { p: V3; s: number; ph: number }[] = [];
  for (let i = 0; i < 380; i++) {
    const a = rnd() * Math.PI * 2;
    const e = 0.08 + Math.pow(rnd(), 0.8) * 1.3;
    const R = 1100;
    out.push({ p: [Math.cos(e) * Math.sin(a) * R, Math.sin(e) * R, Math.cos(e) * Math.cos(a) * R], s: 2 + rnd() * 3.5, ph: rnd() * 6 });
  }
  return out;
});
const Stars: React.FC<{ t: number }> = ({ t }) => {
  const stars = STARS();
  const P = usePoints(stars.length, "#9FB4FF", "#FFFFFF");
  useLayoutEffect(() => {
    stars.forEach((s, i) => {
      P.pos.set(s.p, i * 3);
      P.size[i] = s.s;
      P.alpha[i] = 0.35 + 0.25 * Math.sin(t * 1.3 + s.ph);
    });
    P.commit();
  });
  return <points geometry={P.geo} material={P.mat} frustumCulled={false} />;
};

/**
 * The night city around the plaza and the tower: dark blocks with lit windows (a few with red
 * aviation lights), the ground, the stars, and the glowing glass pipes that carry golden time
 * from the roofs into the tower (`flow` scales the particles' speed, `pipes` hides them).
 */
export const TimeCity: React.FC<{ t?: number; pipes?: boolean; flow?: number }> = ({ t = 0, pipes = true, flow = 1 }) => {
  const geos = useMemo(() => {
    const list = CITY();
    const city = buildCityGeometry(list);
    const lights: THREE.BufferGeometry[] = [];
    list.forEach((b, i) => {
      if (b.h > 40 && hash(i * 5.3) < 0.6) lights.push(xform(new THREE.SphereGeometry(0.55, 8, 6), [b.x, b.h + 0.6, b.z]));
    });
    return { city, lights: lights.length ? mergeUV(lights) : null, ground: new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2) };
  }, []);
  const mats = useMemo(() => {
    const tex = cityWindowTexture();
    return {
      city: new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color("#FFFFFF"), emissiveIntensity: 0.95, roughness: 0.85, metalness: 0.1 }),
      ground: new THREE.MeshStandardMaterial({ color: "#121119", roughness: 0.9 }),
      glass: new THREE.MeshStandardMaterial({
        color: "#FFE2A0",
        emissive: new THREE.Color("#FFAE1A"),
        emissiveIntensity: 0.32,
        roughness: 0.15,
        metalness: 0.1,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
      core: additive(new THREE.MeshBasicMaterial({ color: "#FF9C12", transparent: true, opacity: 0.45, toneMapped: false })),
    };
  }, []);
  const blink = 0.5 + 0.5 * Math.sin(t * 3.2);
  const P = pipes ? PIPES() : null;
  return (
    <group>
      <mesh geometry={geos.ground} material={mats.ground} position={[0, -0.04, -60]} />
      <mesh geometry={geos.city} material={mats.city} />
      {geos.lights ? <mesh geometry={geos.lights} material={basic(blink > 0.5 ? "#FF3B3B" : "#5A1418")} /> : null}
      <Stars t={t} />
      {P ? (
        <>
          <mesh geometry={P.fittings} material={vertexMat(0.5, false, 0.2, 0.4)} />
          <mesh geometry={P.core} material={mats.core} renderOrder={3} />
          <mesh geometry={P.glass} material={mats.glass} renderOrder={5} />
          <PipeFlow t={t} speed={flow} />
        </>
      ) : null}
    </group>
  );
};

// =======================================================================================
// The premium plaza

const SHOPS = [
  { name: "AURUM", tag: "40 AÑOS", item: "watch" },
  { name: "BIJOU", tag: "12 AÑOS", item: "ring" },
  { name: "ÉLITE", tag: "25 AÑOS", item: "hourglass" },
  { name: "LUXE", tag: "8 AÑOS", item: "bag" },
  { name: "PRESTIGE", tag: "60 AÑOS", item: "hourglass" },
  { name: "ORO", tag: "∞ AÑOS", item: "ring" },
] as const;

const drawItem = (ctx: CanvasRenderingContext2D, item: string, x: number, y: number, s: number) => {
  ctx.save();
  ctx.fillStyle = "#FFD36A";
  ctx.strokeStyle = "#FFE9A8";
  ctx.lineWidth = s * 0.08;
  ctx.shadowColor = "#FFB22A";
  ctx.shadowBlur = s * 0.5;
  if (item === "watch") {
    ctx.fillRect(x - s * 0.18, y - s * 0.9, s * 0.36, s * 1.8);
    ctx.beginPath();
    ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2A1A0A";
    ctx.beginPath();
    ctx.arc(x, y, s * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FFD36A";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - s * 0.28);
    ctx.moveTo(x, y);
    ctx.lineTo(x + s * 0.2, y);
    ctx.stroke();
  } else if (item === "ring") {
    ctx.beginPath();
    ctx.arc(x, y + s * 0.15, s * 0.42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#CFF4FF";
    ctx.beginPath();
    ctx.moveTo(x - s * 0.22, y - s * 0.3);
    ctx.lineTo(x + s * 0.22, y - s * 0.3);
    ctx.lineTo(x, y - s * 0.02);
    ctx.closePath();
    ctx.fill();
  } else if (item === "bag") {
    ctx.fillRect(x - s * 0.55, y - s * 0.3, s * 1.1, s * 0.8);
    ctx.beginPath();
    ctx.arc(x, y - s * 0.3, s * 0.3, Math.PI, 0);
    ctx.stroke();
  } else {
    drawTimecoLogo(ctx, x, y, s * 0.75, { bg: null, ring: "rgba(0,0,0,0)" });
  }
  ctx.restore();
};

const shopWindowTexture = (k: number) =>
  canvasTexture(`tc-shop-${k}`, 512, 384, (ctx, W, H) => {
    const shop = SHOPS[k % SHOPS.length];
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#FFE2A6");
    g.addColorStop(0.35, "#E89A3C");
    g.addColorStop(1, "#4A230C");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Spotlights, a shelf and three pedestals.
    for (let i = 0; i < 3; i++) {
      const x = W * (0.2 + i * 0.3);
      const sg = ctx.createRadialGradient(x, 0, 0, x, 0, H * 0.9);
      sg.addColorStop(0, "rgba(255,250,230,0.7)");
      sg.addColorStop(1, "rgba(255,250,230,0)");
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#2B160A";
      ctx.fillRect(x - 38, H * 0.66, 76, H * 0.34);
      ctx.fillStyle = "#C9993A";
      ctx.fillRect(x - 42, H * 0.64, 84, 8);
      drawItem(ctx, i === 1 ? shop.item : SHOPS[(k + i + 2) % SHOPS.length].item, x, H * 0.48, 56);
    }
    // Price tag in years.
    ctx.save();
    ctx.translate(W * 0.68, H * 0.2);
    ctx.rotate(-0.12);
    ctx.fillStyle = "#FFF6E0";
    ctx.fillRect(-92, -28, 184, 56);
    ctx.fillStyle = "#B8141E";
    ctx.font = "900 34px Montserrat";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(shop.tag, 0, 2);
    ctx.restore();
    // Glass sheen.
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(W * 0.05, 0);
    ctx.lineTo(W * 0.2, 0);
    ctx.lineTo(W * 0.05, H);
    ctx.lineTo(-W * 0.1, H);
    ctx.closePath();
    ctx.fill();
  });

const shopSignTexture = (k: number) =>
  canvasTexture(`tc-sign-${k}`, 512, 80, (ctx, W, H) => {
    const shop = SHOPS[k % SHOPS.length];
    ctx.fillStyle = "#111016";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#C9993A";
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, W - 12, H - 12);
    setSpacing(ctx, 12);
    neonText(ctx, shop.name, W / 2 + 6, H / 2 + 3, "900 46px Montserrat", "#FFC83D", 14, "#FFF4C8");
  });

const premiumSignTexture = () =>
  canvasTexture("tc-zona-premium", 1024, 512, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#24202C");
    g.addColorStop(1, "#0F0E14");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#E2B04A";
    ctx.lineWidth = 10;
    ctx.strokeRect(18, 18, W - 36, H - 36);
    ctx.lineWidth = 3;
    ctx.strokeRect(38, 38, W - 76, H - 76);
    // Crown.
    ctx.save();
    ctx.translate(W / 2, 118);
    ctx.fillStyle = "#FFC83D";
    ctx.shadowColor = "#FFB01A";
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.moveTo(-70, 40);
    ctx.lineTo(-80, -26);
    ctx.lineTo(-38, 6);
    ctx.lineTo(0, -44);
    ctx.lineTo(38, 6);
    ctx.lineTo(80, -26);
    ctx.lineTo(70, 40);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    setSpacing(ctx, 26);
    neonText(ctx, "ZONA", W / 2 + 13, 222, "900 74px Montserrat", "#FFC83D", 18, "#FFF2C0");
    setSpacing(ctx, 10);
    neonText(ctx, "PREMIUM", W / 2 + 5, 338, "900 150px Montserrat", "#FFC83D", 30, "#FFF6D8");
    setSpacing(ctx, 6);
    ctx.fillStyle = "#FF5A5A";
    ctx.font = "800 36px Montserrat";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("· CORTESÍA DE TIMECO ·", W / 2 + 3, 442);
  });

/** A row of luxury storefronts along +x in local space, facades facing +z; `count` shops of SHOP_W. */
const SHOP_W = 7.4;
type ShopRow = { pos: V3; rotY: number; count: number; first: number };
const SHOP_ROWS: ShopRow[] = [
  // Left side (x = −13, facing +x), right side (x = 13, facing −x), the far end (z = 36, facing −z).
  { pos: [-PLAZA.x, 0, PLAZA.z1 - 1], rotY: Math.PI / 2, count: 10, first: 0 },
  { pos: [PLAZA.x, 0, PLAZA.z0 + 1], rotY: -Math.PI / 2, count: 10, first: 3 },
  { pos: [PLAZA.x + 1, 0, PLAZA.z1], rotY: Math.PI, count: 4, first: 2 },
];

const shopFrame = (row: ShopRow, i: number) => {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...row.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, row.rotY, 0)), new THREE.Vector3(1, 1, 1));
  return new THREE.Matrix4().multiplyMatrices(m, new THREE.Matrix4().makeTranslation(SHOP_W * (i + 0.5), 0, 0));
};

const STOREFRONTS = once(() => {
  const body: THREE.BufferGeometry[] = [];
  const windows: THREE.BufferGeometry[][] = SHOPS.map(() => []);
  const signs: THREE.BufferGeometry[][] = SHOPS.map(() => []);
  const upper: THREE.BufferGeometry[] = [];
  SHOP_ROWS.forEach((row) => {
    for (let i = 0; i < row.count; i++) {
      const k = (row.first + i) % SHOPS.length;
      const M = shopFrame(row, i);
      const H = 15 + ((i * 7 + row.first) % 3) * 3;
      const add = (g: THREE.BufferGeometry, color: string, pos: V3, rot: V3 = [0, 0, 0]) => body.push(place(g, color, pos, rot).applyMatrix4(M));
      add(rbox(SHOP_W, H, 6, 0.1), i % 2 ? "#1D1B25" : "#22202B", [0, H / 2, -3]);
      for (const s of [-1, 1]) add(rbox(0.55, 6.8, 0.5, 0.08), GOLDM, [s * (SHOP_W / 2 - 0.3), 3.4, 0.2]);
      add(rbox(SHOP_W, 0.35, 0.8, 0.08), GOLDM, [0, 6.9, 0.3]);
      add(rbox(SHOP_W, 0.25, 0.6, 0.06), GOLDM, [0, H - 0.2, 0.2]);
      add(rbox(6.3, 1.0, 0.3, 0.06), "#0E0D12", [0, 5.75, 0.25]);
      add(rbox(6.6, 0.12, 1.7, 0.04), i % 2 ? "#6E1420" : "#121018", [0, 4.75, 0.95], [0.38, 0, 0]);
      add(rbox(6.7, 0.1, 0.1, 0.03), GOLDM, [0, 4.45, 1.75]);
      add(rbox(6.0, 0.3, 0.5, 0.05), "#141219", [0, 0.15, 0.25]);
      windows[k].push(new THREE.PlaneGeometry(5.6, 4.0).translate(0, 2.4, 0.06).applyMatrix4(M));
      signs[k].push(new THREE.PlaneGeometry(6.0, 0.86).translate(0, 5.75, 0.42).applyMatrix4(M));
      // Upper floors: a few warm windows.
      for (let f = 0; f < 2; f++) {
        for (let c = -1; c <= 1; c++) {
          if (hash(i * 13 + f * 5 + c + row.first * 31) < 0.45) continue;
          upper.push(new THREE.PlaneGeometry(1.4, 1.9).translate(c * 2.2, 8.6 + f * 3.2, 0.03).applyMatrix4(M));
        }
      }
    }
  });
  return {
    body: mergeAll(body),
    windows: windows.map((w) => (w.length ? mergeUV(w) : null)),
    signs: signs.map((w) => (w.length ? mergeUV(w) : null)),
    upper: upper.length ? mergeUV(upper) : null,
  };
});

const LAMPS: V3[] = [-34, -22, -10, 2, 14, 26].flatMap((z) => [
  [-6.6, 0, z] as V3,
  [6.6, 0, z] as V3,
]);
const LAMP_GLOBES: V3[] = LAMPS.flatMap((p) => [
  [p[0] - 0.62, 4.62, p[2]] as V3,
  [p[0] + 0.62, 4.62, p[2]] as V3,
]);

const LAMP_GEO = once(() => {
  const parts: THREE.BufferGeometry[] = [];
  const globes: THREE.BufferGeometry[] = [];
  for (const p of LAMPS) {
    const [x, , z] = p;
    parts.push(place(rbox(0.7, 0.5, 0.7, 0.1), "#7A5A1C", [x, 0.25, z]));
    parts.push(place(new THREE.CylinderGeometry(0.11, 0.16, 4.4, 10), GOLDM, [x, 2.6, z]));
    for (const y of [0.7, 1.6, 3.6]) parts.push(place(new THREE.TorusGeometry(0.17, 0.05, 6, 14), GOLDM, [x, y, z], [Math.PI / 2, 0, 0]));
    parts.push(place(rbox(1.5, 0.1, 0.1, 0.03), GOLDM, [x, 4.95, z]));
    for (const s of [-1, 1]) {
      parts.push(place(new THREE.ConeGeometry(0.22, 0.2, 10), GOLDM, [x + s * 0.62, 4.95, z]));
      globes.push(xform(new THREE.SphereGeometry(0.27, 14, 10), [x + s * 0.62, 4.62, z]));
    }
    parts.push(place(new THREE.SphereGeometry(0.13, 8, 6), GOLDM, [x, 5.15, z]));
  }
  return { metal: mergeAll(parts), globes: mergeUV(globes) };
});

const FOUNTAIN_GEO = once(() => {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(place(new THREE.CylinderGeometry(3.4, 3.65, 0.8, 48), MARBLE, [0, 0.4, 0]));
  parts.push(place(new THREE.TorusGeometry(3.42, 0.13, 8, 64), GOLDM, [0, 0.8, 0], [Math.PI / 2, 0, 0]));
  parts.push(place(new THREE.CylinderGeometry(0.3, 0.5, 2.0, 16), GOLDM, [0, 1.0, 0]));
  parts.push(place(new THREE.CylinderGeometry(0.2, 0.28, 1.2, 14), GOLDM, [0, 2.5, 0]));
  const bowl = (r: number) => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * (Math.PI / 2);
      pts.push(new THREE.Vector2(0.15 + Math.sin(a) * r, -Math.cos(a) * r * 0.32));
    }
    return new THREE.LatheGeometry(pts, 32);
  };
  parts.push(place(bowl(1.55), GOLDM, [0, 2.05, 0]));
  parts.push(place(bowl(0.9), GOLDM, [0, 3.1, 0]));
  // A golden hourglass on top.
  parts.push(place(new THREE.ConeGeometry(0.22, 0.32, 12), "#FFD36A", [0, 3.32, 0], [Math.PI, 0, 0]));
  parts.push(place(new THREE.ConeGeometry(0.22, 0.32, 12), "#FFD36A", [0, 3.62, 0]));
  parts.push(place(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 12), GOLDM, [0, 3.8, 0]));
  return {
    body: mergeAll(parts),
    water: new THREE.CircleGeometry(3.2, 48).rotateX(-Math.PI / 2).translate(0, 0.66, 0),
    pools: mergeUV([new THREE.CircleGeometry(1.5, 32).rotateX(-Math.PI / 2).translate(0, 2.03, 0), new THREE.CircleGeometry(0.85, 24).rotateX(-Math.PI / 2).translate(0, 3.08, 0)]),
    sheets: mergeUV([new THREE.CylinderGeometry(1.62, 1.95, 1.4, 40, 1, true).translate(0, 1.36, 0), new THREE.CylinderGeometry(0.95, 1.2, 1.0, 32, 1, true).translate(0, 2.58, 0)]),
  };
});

const waterStreakTexture = () =>
  canvasTexture(
    "tc-water-streaks",
    128,
    256,
    (ctx, W, H) => {
      const rnd = mulberry(17);
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < 70; i++) {
        const x = rnd() * W;
        const y = rnd() * H;
        const l = 20 + rnd() * 70;
        const g = ctx.createLinearGradient(0, y, 0, y + l);
        g.addColorStop(0, "rgba(255,240,190,0)");
        g.addColorStop(0.5, `rgba(255,${200 + rnd() * 55},140,${0.5 + rnd() * 0.5})`);
        g.addColorStop(1, "rgba(255,240,190,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x, y, 2 + rnd() * 3, l);
        ctx.fillRect(x, y - H, 2 + rnd() * 3, l);
      }
    },
    { wrapS: true, wrapT: true },
  );

/** The fountain of liquid gold (origin at the basin's centre on the floor). */
export const GoldFountain: React.FC<{ t?: number }> = ({ t = 0 }) => {
  const G = FOUNTAIN_GEO();
  const mats = useMemo(() => {
    const tex = waterStreakTexture().clone();
    tex.repeat.set(5, 1);
    tex.needsUpdate = true;
    return {
      water: new THREE.MeshStandardMaterial({ color: "#FFB52E", emissive: new THREE.Color("#FF9A10"), emissiveIntensity: 0.75, roughness: 0.12, metalness: 0.3 }),
      sheet: additive(new THREE.MeshBasicMaterial({ map: tex, color: "#FFD27A", transparent: true, opacity: 0.85, side: THREE.DoubleSide, toneMapped: false })),
      tex,
    };
  }, []);
  mats.tex.offset.y = t * 0.9;
  return (
    <group>
      <mesh geometry={G.body} material={vertexMat(0.3, false, 0.16, 0.35)} />
      <mesh geometry={G.water} material={mats.water} />
      <mesh geometry={G.pools} material={mats.water} />
      <mesh geometry={G.sheets} material={mats.sheet} renderOrder={4} />
      <Halo color="#FFB52E" size={7} opacity={0.35 + 0.05 * Math.sin(t * 3)} position={[0, 1.4, 0]} />
    </group>
  );
};

/** The "ZONA PREMIUM" monument sign (origin on the floor, face to +z; both faces printed). */
export const PremiumSign: React.FC = () => {
  const ready = useFontsReady();
  const geos = useMemo(
    () => ({
      body: mergeAll([
        place(rbox(3.8, 0.4, 0.9, 0.08), "#6A4C16", [0, 0.2, 0]),
        place(rbox(0.5, 0.9, 0.5, 0.06), GOLDM, [-1.3, 0.85, 0]),
        place(rbox(0.5, 0.9, 0.5, 0.06), GOLDM, [1.3, 0.85, 0]),
        place(rbox(3.7, 1.95, 0.32, 0.08), "#15131B", [0, 2.2, 0]),
        place(rbox(3.86, 0.14, 0.4, 0.04), GOLDM, [0, 3.22, 0]),
        place(rbox(3.86, 0.14, 0.4, 0.04), GOLDM, [0, 1.18, 0]),
      ]),
      face: new THREE.PlaneGeometry(3.5, 1.75),
    }),
    [],
  );
  const mat = useMemo(() => (ready ? new THREE.MeshBasicMaterial({ map: premiumSignTexture(), toneMapped: false }) : basic("#15131B")), [ready]);
  return (
    <group>
      <mesh geometry={geos.body} material={vertexMat(0.35, false, 0.14, 0.35)} />
      <mesh geometry={geos.face} material={mat} position={[0, 2.2, 0.17]} />
      <mesh geometry={geos.face} material={mat} position={[0, 2.2, -0.17]} rotation={[0, Math.PI, 0]} />
      <Halo color="#FFC24A" size={4.2} opacity={0.28} position={[0, 2.2, 0.6]} />
    </group>
  );
};

/**
 * The ZONA PREMIUM plaza at night: polished black-and-gold marble, storefront rows, double
 * golden lampposts, the gold fountain, the monument sign and the glowing threshold line
 * (`line` 0..1 its glow; it flares red with `alarm` 0..1).
 */
export const PremiumPlaza: React.FC<{ t?: number; line?: number; alarm?: number; sign?: boolean }> = ({ t = 0, line = 0.6, alarm = 0, sign = true }) => {
  const ready = useFontsReady();
  const S = STOREFRONTS();
  const L = LAMP_GEO();
  const geos = useMemo(
    () => ({
      floor: new THREE.PlaneGeometry(PLAZA.x * 2, PLAZA.z1 - PLAZA.z0).rotateX(-Math.PI / 2).translate(0, 0.01, (PLAZA.z0 + PLAZA.z1) / 2),
      curbs: mergeAll([
        place(rbox(0.5, 0.18, PLAZA.z1 - PLAZA.z0, 0.05), GOLDM, [-PLAZA.x + 0.25, 0.09, (PLAZA.z0 + PLAZA.z1) / 2]),
        place(rbox(0.5, 0.18, PLAZA.z1 - PLAZA.z0, 0.05), GOLDM, [PLAZA.x - 0.25, 0.09, (PLAZA.z0 + PLAZA.z1) / 2]),
        place(rbox(PLAZA.x * 2, 0.18, 0.5, 0.05), GOLDM, [0, 0.09, PLAZA.z0 + 0.25]),
      ]),
      pool: new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2),
      line: new THREE.PlaneGeometry(PLAZA.x * 2 - 1, 0.16).rotateX(-Math.PI / 2),
    }),
    [],
  );
  const mats = useMemo(() => {
    const tex = marbleTexture().clone();
    tex.repeat.set((PLAZA.x * 2) / 5.2, (PLAZA.z1 - PLAZA.z0) / 5.2);
    tex.needsUpdate = true;
    return {
      floor: new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color("#FFFFFF"), emissiveIntensity: 0.22, roughness: 0.16, metalness: 0.35 }),
      pool: additive(new THREE.MeshBasicMaterial({ map: glowTexture(), color: "#FFB548", transparent: true, opacity: 0.4, toneMapped: false })),
      line: additive(new THREE.MeshBasicMaterial({ color: "#FFC83D", transparent: true, opacity: 1, toneMapped: false })),
      upper: new THREE.MeshBasicMaterial({ color: "#C99A5A", toneMapped: false }),
    };
  }, []);
  const lineCol = new THREE.Color("#FFC83D").lerp(new THREE.Color("#FF2A2A"), clamp01(alarm));
  mats.line.color.copy(lineCol);
  mats.line.opacity = clamp01(line) * (0.75 + 0.25 * Math.sin(t * 9) * clamp01(alarm));
  return (
    <group>
      <mesh geometry={geos.floor} material={mats.floor} />
      <mesh geometry={geos.curbs} material={vertexMat(0.3, false, 0.15, 0.4)} />
      <mesh geometry={S.body} material={vertexMat(0.5, false, 0.12, 0.2)} />
      {S.upper ? <mesh geometry={S.upper} material={mats.upper} /> : null}
      {ready
        ? SHOPS.map((_, k) => (
            <React.Fragment key={k}>
              {S.windows[k] ? <mesh geometry={S.windows[k]!} material={shopMat(k, "window")} /> : null}
              {S.signs[k] ? <mesh geometry={S.signs[k]!} material={shopMat(k, "sign")} /> : null}
            </React.Fragment>
          ))
        : null}
      <mesh geometry={L.metal} material={vertexMat(0.28, false, 0.2, 0.55)} />
      <mesh geometry={L.globes} material={basic("#FFEBC0")} />
      {LAMP_GLOBES.map((p, i) => (
        <Halo key={i} color="#FFC060" size={2.6} opacity={0.55} position={p} />
      ))}
      {LAMPS.map((p, i) => (
        <mesh key={i} geometry={geos.pool} material={mats.pool} position={[p[0], 0.03, p[2]]} scale={[3.2, 1, 3.2]} renderOrder={2} />
      ))}
      <group position={FOUNTAIN_AT}>
        <GoldFountain t={t} />
      </group>
      {sign ? (
        <group position={SIGN_AT} rotation={[0, -0.32, 0]}>
          <PremiumSign />
        </group>
      ) : null}
      {line > 0.01 ? (
        <>
          <mesh geometry={geos.line} material={mats.line} position={[0, 0.03, PREMIUM_LINE_Z]} renderOrder={3} />
          <mesh geometry={geos.line} material={mats.line} position={[0, 0.03, PREMIUM_LINE_Z + 0.5]} scale={[1, 1, 0.4]} renderOrder={3} />
        </>
      ) : null}
    </group>
  );
};

const shopMats = new Map<string, THREE.MeshBasicMaterial>();
const shopMat = (k: number, kind: "window" | "sign") => {
  const key = `${kind}-${k}`;
  let m = shopMats.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: kind === "window" ? shopWindowTexture(k) : shopSignTexture(k), toneMapped: false });
    shopMats.set(key, m);
  }
  return m;
};

// =======================================================================================
// The tower

const TOWER_GEO = once(() => {
  const H0 = HG.plateH;
  const H1 = HG.top - HG.plateH;
  // Glass bulbs.
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 72; i++) {
    const y = H0 + ((H1 - H0) * i) / 72;
    prof.push(new THREE.Vector2(bulbRadius(y), y));
  }
  const glass = new THREE.LatheGeometry(prof, 96);
  // Sand: the upper mass (from the neck to the level, with a funnel), the falling stream and the pile.
  const level = 100;
  const up: THREE.Vector2[] = [new THREE.Vector2(0.01, HG.waistY + 1)];
  for (let i = 0; i <= 16; i++) {
    const y = HG.waistY + 1 + ((level - HG.waistY - 1) * i) / 16;
    up.push(new THREE.Vector2(bulbRadius(y) * 0.93, y));
  }
  up.push(new THREE.Vector2(bulbRadius(level) * 0.55, level - 2));
  up.push(new THREE.Vector2(0.01, level - 8));
  const low: THREE.Vector2[] = [new THREE.Vector2(0.01, H0 + 0.3)];
  for (let i = 0; i <= 8; i++) {
    const y = H0 + 0.3 + (14 * i) / 8;
    low.push(new THREE.Vector2(bulbRadius(y) * 0.93, y));
  }
  low.push(new THREE.Vector2(bulbRadius(H0 + 14.3) * 0.5, 26));
  low.push(new THREE.Vector2(0.01, 36));
  const sand = mergeUV([new THREE.LatheGeometry(up, 48), new THREE.LatheGeometry(low, 48)]);
  // Metal: plates, posts, collar, spire.
  const metal: THREE.BufferGeometry[] = [];
  metal.push(place(new THREE.CylinderGeometry(HG.plateR, HG.plateR + 0.6, HG.plateH, 96), CHAR2, [0, HG.plateH / 2, 0]));
  metal.push(place(new THREE.CylinderGeometry(HG.plateR + 0.6, HG.plateR, HG.plateH, 96), CHAR2, [0, HG.top - HG.plateH / 2, 0]));
  metal.push(place(new THREE.CylinderGeometry(HG.plateR - 3, HG.plateR - 1, 2.5, 64), "#15141B", [0, HG.top + 1.25, 0]));
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const x = Math.sin(a) * HG.postR;
    const z = Math.cos(a) * HG.postR;
    metal.push(place(new THREE.CylinderGeometry(1.7, 1.7, H1 - H0, 16), CHAR2, [x, (H0 + H1) / 2, z]));
    for (const y of [H0 + 3, H1 - 3, HG.waistY]) metal.push(place(new THREE.CylinderGeometry(2.4, 2.4, 1.6, 16), GOLDM, [x, y, z]));
  }
  metal.push(place(new THREE.TorusGeometry(HG.waistR + 0.9, 1.3, 12, 48), GOLDM, [0, HG.waistY, 0], [Math.PI / 2, 0, 0]));
  metal.push(place(new THREE.CylinderGeometry(0.4, 2.2, 22, 12), CHAR2, [0, HG.top + 13, 0]));
  // Red neon: plate edges, the posts' outer strips, the waist.
  const neon: THREE.BufferGeometry[] = [];
  for (const y of [0.8, HG.plateH - 0.6, HG.top - HG.plateH + 0.6, HG.top - 0.8]) {
    neon.push(xform(new THREE.TorusGeometry(HG.plateR + 0.45, 0.32, 6, 160), [0, y, 0], [Math.PI / 2, 0, 0]));
  }
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    neon.push(xform(new THREE.BoxGeometry(0.55, H1 - H0 - 2, 0.55), [Math.sin(a) * (HG.postR + 1.75), (H0 + H1) / 2, Math.cos(a) * (HG.postR + 1.75)], [0, a, 0]));
  }
  for (const dy of [-2.1, 2.1]) neon.push(xform(new THREE.TorusGeometry(HG.waistR + 1.4, 0.22, 6, 48), [0, HG.waistY + dy, 0], [Math.PI / 2, 0, 0]));
  // Aviation lights on the top plate (two groups that blink in turn).
  const avA: THREE.BufferGeometry[] = [];
  const avB: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    (k % 2 ? avA : avB).push(xform(new THREE.SphereGeometry(0.8, 10, 8), [Math.sin(a) * (HG.plateR - 1.5), HG.top + 0.9, Math.cos(a) * (HG.plateR - 1.5)]));
  }
  // The façade screen: a curved panel on the lower bulb's front (y 40..60).
  const screen = (() => {
    const g = new THREE.BufferGeometry();
    const pos: number[] = [];
    const uv: number[] = [];
    const NA = 18;
    const NY = 6;
    const a0 = -0.62;
    const a1 = 0.62;
    const y0 = 40;
    const y1 = 61;
    const vert = (i: number, j: number) => {
      const a = a0 + ((a1 - a0) * i) / NA;
      const y = y0 + ((y1 - y0) * j) / NY;
      const r = bulbRadius(y) + 0.9;
      pos.push(Math.sin(a) * r, y, Math.cos(a) * r);
      uv.push(i / NA, j / NY);
    };
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NA; i++) vert(i, j);
    const idx: number[] = [];
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NA; i++) {
        const a = j * (NA + 1) + i;
        const b = a + 1;
        const c = a + NA + 1;
        const d = c + 1;
        idx.push(a, b, d, a, d, c);
      }
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  })();
  // The wordmark band on the top plate's front.
  const word = new THREE.CylinderGeometry(HG.plateR + 0.75, HG.plateR + 0.75, 4.8, 64, 1, true, -0.66, 1.32).translate(0, HG.top - HG.plateH / 2, 0);
  const stream = new THREE.CylinderGeometry(0.85, 0.85, HG.waistY - 35, 12, 1, true).translate(0, (HG.waistY + 35) / 2, 0);
  return {
    glass,
    sand,
    metal: mergeAll(metal),
    neon: mergeUV(neon),
    avA: mergeUV(avA),
    avB: mergeUV(avB),
    screen,
    word,
    stream,
    frame: mergeAll([place(new THREE.TorusGeometry(10.6, 0.7, 10, 64), "#15141B", [0, 0, -0.3]), place(new THREE.CylinderGeometry(10.9, 10.9, 1.2, 48), "#15141B", [0, 0, -0.9], [Math.PI / 2, 0, 0])]),
    logo: new THREE.CircleGeometry(10, 64),
    logoRing: new THREE.TorusGeometry(10.3, 0.45, 8, 96),
  };
});

const wordmarkTexture = () =>
  canvasTexture("tc-wordmark", 2048, 220, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    setSpacing(ctx, 70);
    neonText(ctx, "TIMECO", W / 2 + 35, H / 2 + 8, "900 188px Montserrat", "#FF3B3B", 40, "#FFE0DA");
  });

const screenTexture = () =>
  canvasTexture("tc-screen", 512, 256, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#FF5A50");
    g.addColorStop(1, "#C8141E");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
    ctx.strokeStyle = "#1B1B24";
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, W - 14, H - 14);
    ctx.strokeStyle = "rgba(255,220,210,0.6)";
    ctx.lineWidth = 3;
    ctx.strokeRect(22, 22, W - 44, H - 44);
  });

const glassMat = once(() => {
  const tex = towerGlassTexture().clone();
  tex.repeat.set(24, 11);
  tex.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: new THREE.Color("#FFFFFF"),
    emissiveIntensity: 0.9,
    transparent: true,
    roughness: 0.18,
    metalness: 0.35,
    depthWrite: false,
    side: THREE.FrontSide,
  });
});

/** Falling grains through the neck of the tower (tower space). */
const SandFall: React.FC<{ t: number }> = ({ t }) => {
  const N = 90;
  const P = usePoints(N, "#FFB52A", "#FFF6CF");
  useLayoutEffect(() => {
    const top = HG.waistY + 2;
    const bottom = 35;
    for (let i = 0; i < N; i++) {
      const u = frac(i / N + t * 0.55 + 0.1 * Math.sin(i * 3.7));
      const y = top - (top - bottom) * u * u;
      P.pos[i * 3] = Math.sin(i * 2.1) * 0.7 * u;
      P.pos[i * 3 + 1] = y;
      P.pos[i * 3 + 2] = Math.cos(i * 1.3) * 0.7 * u;
      P.size[i] = 1.1 + 0.8 * hash(i);
      P.alpha[i] = 0.9;
    }
    P.commit();
  });
  return <points geometry={P.geo} material={P.mat} frustumCulled={false} renderOrder={4} />;
};

/**
 * TIMECO's headquarters: a gigantic dark-glass hourglass (plates, four posts with red neon, a
 * golden sand core falling through the waist), the logo on the upper bulb, the wordmark on the
 * top plate, aviation lights, the façade screen (`screen` 0..1: off → glowing red), the
 * gatehouse with the gigantic door (`door` 0..1 open, `doorGlow` 0..1 its inner light) and the
 * esplanade with red guide lines. `t` seconds.
 */
export const TimecoTower: React.FC<{ t?: number; screen?: number; door?: number; doorGlow?: number; esplanade?: boolean }> = ({
  t = 0,
  screen = 0,
  door = 0,
  doorGlow,
  esplanade = true,
}) => {
  const ready = useFontsReady();
  const G = TOWER_GEO();
  const mats = useMemo(
    () => ({
      sand: new THREE.MeshStandardMaterial({ color: "#FFB733", emissive: new THREE.Color("#FF9E14"), emissiveIntensity: 0.95, roughness: 0.85, side: THREE.DoubleSide }),
      stream: new THREE.MeshBasicMaterial({ color: "#FFE39A", toneMapped: false }),
      avOn: basic("#FF3B3B"),
      avOff: basic("#4A1216"),
      screen: new THREE.MeshBasicMaterial({ map: screenTexture(), color: "#FFFFFF", toneMapped: false, side: THREE.DoubleSide }),
    }),
    [],
  );
  const wordMat = useMemo(() => (ready ? new THREE.MeshBasicMaterial({ map: wordmarkTexture(), transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }) : null), [ready]);
  const logoMat = useMemo(() => new THREE.MeshBasicMaterial({ map: logoTexture(), toneMapped: false }), []);
  const on = clamp01(screen);
  const flick = on > 0 && on < 1 ? 0.75 + 0.25 * Math.sin(t * 40) : 1;
  mats.screen.color.setRGB(lerp(0.22, 1.15, on) * flick, lerp(0.05, 0.95, on) * flick * 0.85, lerp(0.07, 0.9, on) * flick * 0.85);
  const blink = Math.sin(t * 2.6) > 0;
  const logoY = 113;
  const logoZ = bulbRadius(logoY) + 3.2;
  return (
    <group position={TOWER_AT}>
      <mesh geometry={G.sand} material={mats.sand} />
      <mesh geometry={G.stream} material={mats.stream} />
      <SandFall t={t} />
      <Halo color="#FFB02A" size={34} opacity={0.55} position={[0, HG.waistY, 0]} />
      <Halo color="#FF9A1A" size={60} opacity={0.3} position={[0, 32, 0]} />
      <mesh geometry={G.metal} material={vertexMat(0.35, false, 0.12, 0.45)} />
      <mesh geometry={G.neon} material={basic(RED)} />
      <mesh geometry={G.avA} material={blink ? mats.avOn : mats.avOff} />
      <mesh geometry={G.avB} material={blink ? mats.avOff : mats.avOn} />
      <mesh geometry={G.glass} material={glassMat()} renderOrder={2} />
      <mesh geometry={G.screen} material={mats.screen} />
      {on > 0.02 ? <Halo color="#FF2A2A" size={70} opacity={0.45 * on} position={[0, 50, bulbRadius(50) + 6]} /> : null}
      {wordMat ? <mesh geometry={G.word} material={wordMat} renderOrder={3} /> : null}
      <group position={[0, logoY, logoZ]} rotation={[-0.1, 0, 0]}>
        <mesh geometry={G.frame} material={vertexMat(0.4, false, 0.1, 0.4)} />
        <mesh geometry={G.logo} material={logoMat} position={[0, 0, 0.02]} />
        <mesh geometry={G.logoRing} material={basic(RED)} position={[0, 0, 0.1]} />
        <Halo color="#FF3B3B" size={34} opacity={0.32} position={[0, 0, 1]} />
      </group>
      {/* The spire's beacon. */}
      <mesh position={[0, HG.top + 25, 0]} material={blink ? mats.avOn : mats.avOff}>
        <sphereGeometry args={[1.1, 12, 8]} />
      </mesh>
      {blink ? <Halo color="#FF3030" size={14} opacity={0.8} position={[0, HG.top + 25, 0]} /> : null}
      <Gatehouse t={t} door={door} doorGlow={doorGlow ?? Math.min(1, door * 4)} />
      {esplanade ? <Esplanade t={t} /> : null}
    </group>
  );
};

// ---------------------------------------------------------------------------------------
// The gatehouse and the gigantic door (tower space: the front face at z = GATE.front − TOWER_AT.z)

const GATE_Z = GATE.front - TOWER_AT[2];

const doorTexture = (side: -1 | 1) =>
  canvasTexture(`tc-door-${side}`, 256, 880, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, "#1E1D26");
    g.addColorStop(1, "#16151C");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#2A2833";
    for (let i = 0; i < 6; i++) ctx.fillRect(14, 20 + i * 145, W - 28, 120);
    ctx.fillStyle = "#B88A30";
    ctx.fillRect(side < 0 ? W - 10 : 0, 0, 10, H);
    for (let i = 0; i <= 6; i++) ctx.fillRect(0, 10 + i * 145, W, 6);
    // Half of a big logo across the seam.
    const cx = side < 0 ? W : 0;
    drawTimecoLogo(ctx, cx, H * 0.42, W * 0.8, { glow: 0.8, bg: "#141319" });
  });

const GATE_GEO = once(() => {
  const { w, h, depth, doorW, doorH } = GATE;
  const z = GATE_Z;
  const body: THREE.BufferGeometry[] = [];
  const sideW = (w - doorW) / 2;
  for (const s of [-1, 1]) body.push(place(rbox(sideW, h, depth, 0.4), "#201F29", [s * (doorW / 2 + sideW / 2), h / 2, z - depth / 2]));
  body.push(place(rbox(doorW + 0.2, h - doorH, depth, 0.4), "#201F29", [0, doorH + (h - doorH) / 2, z - depth / 2]));
  // Stepped portal frame (gold) and a dark recess.
  for (const s of [-1, 1]) body.push(place(rbox(1.0, doorH + 1.2, 1.4, 0.15), GOLDM, [s * (doorW / 2 + 0.5), (doorH + 1.2) / 2, z + 0.3]));
  body.push(place(rbox(doorW + 2.0, 1.0, 1.4, 0.15), GOLDM, [0, doorH + 0.7, z + 0.3]));
  for (const s of [-1, 1]) body.push(place(rbox(1.6, doorH + 3.2, 0.8, 0.15), "#2B2935", [s * (doorW / 2 + 1.8), (doorH + 3.2) / 2, z + 0.1]));
  body.push(place(rbox(doorW + 5.2, 1.6, 0.8, 0.15), "#2B2935", [0, doorH + 2.4, z + 0.1]));
  // The top cornice.
  body.push(place(rbox(w + 1.2, 1.2, depth + 1.2, 0.3), "#17161D", [0, h + 0.6, z - depth / 2]));
  // Threshold steps.
  for (let k = 0; k < 3; k++) body.push(place(rbox(doorW + 10 - k * 2.5, 0.35, 2.2, 0.08), k % 2 ? "#26242F" : "#1C1B23", [0, 0.17 + k * 0.35, z + 3.2 - k * 1.2]));
  const neon: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    neon.push(xform(new THREE.BoxGeometry(0.5, h, 0.5), [s * (w / 2 + 0.05), h / 2, z + 0.1]));
    neon.push(xform(new THREE.BoxGeometry(0.35, doorH + 4, 0.35), [s * (doorW / 2 + 2.75), (doorH + 4) / 2, z + 0.55]));
  }
  neon.push(xform(new THREE.BoxGeometry(w + 0.6, 0.5, 0.5), [0, h + 1.3, z + 0.5]));
  neon.push(xform(new THREE.BoxGeometry(doorW + 5.5, 0.35, 0.35), [0, doorH + 3.35, z + 0.55]));
  // The lit corridor behind the door: floor, ceiling, walls (inner faces) and the back wall.
  const L = 26;
  const inner = mergeUV([
    new THREE.PlaneGeometry(doorW, L).rotateX(-Math.PI / 2).translate(0, 0.02, z - L / 2 - 0.6),
    new THREE.PlaneGeometry(doorW, L).rotateX(Math.PI / 2).translate(0, doorH, z - L / 2 - 0.6),
    new THREE.PlaneGeometry(L, doorH).rotateY(Math.PI / 2).translate(-doorW / 2, doorH / 2, z - L / 2 - 0.6),
    new THREE.PlaneGeometry(L, doorH).rotateY(-Math.PI / 2).translate(doorW / 2, doorH / 2, z - L / 2 - 0.6),
  ]);
  const back = new THREE.PlaneGeometry(doorW, doorH).translate(0, doorH / 2, z - L - 0.6);
  return { body: mergeAll(body), neon: mergeUV(neon), inner, back, panel: new THREE.BoxGeometry(doorW / 2, doorH, 1.2) };
});

const corridorTexture = () =>
  canvasTexture("tc-corridor", 64, 256, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#FFF6DE");
    g.addColorStop(0.5, "#FFD98A");
    g.addColorStop(1, "#7A4A18");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    for (let y = 0; y < H; y += 32) ctx.fillRect(0, y, W, 6);
  });

const Gatehouse: React.FC<{ t: number; door: number; doorGlow: number }> = ({ t, door, doorGlow }) => {
  const G = GATE_GEO();
  const mats = useMemo(() => {
    const mk = (side: -1 | 1) => {
      const front = new THREE.MeshStandardMaterial({ map: doorTexture(side), roughness: 0.45, metalness: 0.4, emissiveMap: doorTexture(side), emissive: new THREE.Color("#FFFFFF"), emissiveIntensity: 0.35 });
      const plain = toy("#1A1920", { rough: 0.5, metal: 0.4, glow: 0.08 });
      return [plain, plain, plain, plain, front, plain];
    };
    return {
      left: mk(-1),
      right: mk(1),
      inner: new THREE.MeshBasicMaterial({ map: corridorTexture(), toneMapped: false, side: THREE.DoubleSide }),
      back: new THREE.MeshBasicMaterial({ color: "#FFFFFF", toneMapped: false }),
      seam: additive(new THREE.MeshBasicMaterial({ color: "#FFD68A", transparent: true, toneMapped: false })),
    };
  }, []);
  const open = clamp01(door);
  const a = 1.38 * (1 - Math.pow(1 - open, 2.2));
  const glow = clamp01(doorGlow);
  const k = 0.25 + 0.75 * glow;
  mats.inner.color.setRGB(k, k, k);
  mats.back.color.setRGB(k * 1.1, k * 1.05, k * 0.95);
  mats.seam.opacity = 0.9 * (1 - smooth(0.2, 0.6, open));
  const z = GATE_Z;
  const logoY = GATE.doorH + (GATE.h - GATE.doorH) / 2 + 0.6;
  return (
    <group>
      <mesh geometry={G.body} material={vertexMat(0.5, false, 0.12, 0.3)} />
      <mesh geometry={G.neon} material={basic(RED)} />
      <mesh geometry={G.inner} material={mats.inner} />
      <mesh geometry={G.back} material={mats.back} />
      <group position={[-GATE.doorW / 2, 0, z - 0.7]} rotation={[0, a, 0]}>
        <mesh geometry={G.panel} material={mats.left} position={[GATE.doorW / 4, GATE.doorH / 2, 0]} />
      </group>
      <group position={[GATE.doorW / 2, 0, z - 0.7]} rotation={[0, -a, 0]}>
        <mesh geometry={G.panel} material={mats.right} position={[-GATE.doorW / 4, GATE.doorH / 2, 0]} />
      </group>
      {open < 0.6 ? (
        <mesh material={mats.seam} position={[0, GATE.doorH / 2, z + 0.02]} renderOrder={4}>
          <planeGeometry args={[0.22 + open * 3, GATE.doorH]} />
        </mesh>
      ) : null}
      {open < 0.6 ? <Halo color="#FFC060" size={10} opacity={0.4 * (1 - open)} position={[0, 1.5, z + 0.5]} /> : null}
      <group position={[0, logoY, z + 0.75]}>
        <mesh material={vertexMat(0.4, false, 0.1, 0.4)}>
          <cylinderGeometry args={[5.4, 5.4, 0.6, 48]} />
        </mesh>
        <mesh position={[0, 0, 0.32]} rotation={[0, 0, 0]}>
          <circleGeometry args={[5, 48]} />
          <meshBasicMaterial map={logoTexture()} toneMapped={false} />
        </mesh>
        <Halo color="#FF3B3B" size={16} opacity={0.35 + 0.1 * Math.sin(t * 2)} position={[0, 0, 1]} />
      </group>
      {glow > 0.01 ? <Halo color="#FFE2A0" size={46} opacity={0.55 * glow * open} position={[0, GATE.doorH * 0.45, z - 2]} /> : null}
    </group>
  );
};

const ESPLANADE_GEO = once(() => {
  const len = PLAZA.z0 - GATE.front;
  const zMid = (PLAZA.z0 + GATE.front) / 2 - TOWER_AT[2];
  const parts: THREE.BufferGeometry[] = [];
  const neon: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    neon.push(xform(new THREE.BoxGeometry(0.3, 0.06, len), [s * 9, 0.03, zMid]));
    for (let z = GATE.front + 6; z < PLAZA.z0 - 2; z += 9) {
      parts.push(place(new THREE.CylinderGeometry(0.3, 0.38, 1.1, 10), CHAR2, [s * 11, 0.55, z - TOWER_AT[2]]));
      neon.push(xform(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 10), [s * 11, 1.0, z - TOWER_AT[2]]));
    }
  }
  for (let z = GATE.front + 10; z < PLAZA.z0 - 4; z += 12) neon.push(xform(new THREE.BoxGeometry(18, 0.06, 0.25), [0, 0.03, z - TOWER_AT[2]]));
  return {
    floor: new THREE.PlaneGeometry(130, len + 2).rotateX(-Math.PI / 2).translate(0, 0.005, zMid),
    posts: mergeAll(parts),
    neon: mergeUV(neon),
  };
});

const Esplanade: React.FC<{ t: number }> = ({ t }) => {
  const E = ESPLANADE_GEO();
  const mat = useMemo(() => {
    const tex = stoneTexture().clone();
    tex.repeat.set(130 / 8, (PLAZA.z0 - GATE.front) / 8);
    tex.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.2, metalness: 0.4, emissiveMap: tex, emissive: new THREE.Color("#FFFFFF"), emissiveIntensity: 0.12 });
  }, []);
  const pulse = 0.75 + 0.25 * Math.sin(t * 2.4);
  return (
    <group>
      <mesh geometry={E.floor} material={mat} />
      <mesh geometry={E.posts} material={vertexMat(0.4, false, 0.1, 0.3)} />
      <mesh geometry={E.neon} material={basic(pulse > 0.75 ? "#FF3B3B" : "#E8302F")} />
    </group>
  );
};

// ---------------------------------------------------------------------------------------
// Light and fog spilling out of the open door (world space)

const BEAM_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const BEAM_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
varying vec2 vUv;
void main() {
  float along = vUv.y;
  float across = vUv.x;
  float fade = pow(1.0 - along, 1.7);
  float edge = smoothstep(0.0, 0.18, across) * smoothstep(1.0, 0.82, across);
  float rays = 0.72 + 0.28 * sin(across * 37.0 + uTime * 0.7) * sin(across * 13.0 - uTime * 0.4);
  float a = fade * edge * rays * uOpacity;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

/** A truncated pyramid of light: near rectangle (w0 × h0) at z = 0, far one (w1 × h1) at z = len; bottoms on y = 0. */
const lightVolumeGeometry = (w0: number, h0: number, w1: number, h1: number, len: number) => {
  const pos: number[] = [];
  const uv: number[] = [];
  const quad = (a: V3, b: V3, c: V3, d: V3, ua: number, ub: number) => {
    // a,b at the near end (along 0), c,d at the far end (along 1).
    for (const [p, u, v] of [
      [a, ua, 0],
      [b, ub, 0],
      [c, ub, 1],
      [a, ua, 0],
      [c, ub, 1],
      [d, ua, 1],
    ] as [V3, number, number][]) {
      pos.push(...p);
      uv.push(u, v);
    }
  };
  const n = (x: number, y: number): V3 => [x, y, 0];
  const f = (x: number, y: number): V3 => [x, y, len];
  quad(n(-w0 / 2, h0), n(w0 / 2, h0), f(w1 / 2, h1), f(-w1 / 2, h1), 0, 1); // top
  quad(n(-w0 / 2, 0), n(-w0 / 2, h0), f(-w1 / 2, h1), f(-w1 / 2, 0), 0, 1); // left
  quad(n(w0 / 2, 0), n(w0 / 2, h0), f(w1 / 2, h1), f(w1 / 2, 0), 0, 1); // right
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
};

/** A trapezoid on the floor: w0 wide at z = 0, w1 wide at z = len (same uvs as the volume). */
const floorQuad = (w0: number, w1: number, len: number) => {
  const g = new THREE.BufferGeometry();
  const y = 0.04;
  g.setAttribute("position", new THREE.Float32BufferAttribute([-w0 / 2, y, 0, w0 / 2, y, 0, w1 / 2, y, len, -w0 / 2, y, 0, w1 / 2, y, len, -w1 / 2, y, len], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  return g;
};

const FOG_PUFFS = 26;
/**
 * The light that spills out of the open door: a volume of warm rays fanning towards +z, a pool
 * of light on the floor and fog rolling out along the ground. `open` 0..1 (the gap), `t` seconds.
 */
export const DoorSpill: React.FC<{ open: number; t: number; fog?: number }> = ({ open, t, fog = 1 }) => {
  const geos = useMemo(
    () => ({
      volume: lightVolumeGeometry(GATE.doorW, GATE.doorH, 30, 34, 46),
      pool: floorQuad(GATE.doorW, 34, 52),
    }),
    [],
  );
  const mats = useMemo(() => {
    const mk = (color: string) =>
      additive(
        new THREE.ShaderMaterial({
          vertexShader: BEAM_VERT,
          fragmentShader: BEAM_FRAG,
          side: THREE.DoubleSide,
          uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uTime: { value: 0 } },
        }),
      );
    const puffs = Array.from({ length: FOG_PUFFS }, () => new THREE.SpriteMaterial({ map: glowTexture(), color: "#FFE9C8", transparent: true, depthWrite: false, fog: false }));
    return { volume: mk("#FFD9A0"), pool: mk("#FFE7B8"), puffs };
  }, []);
  const k = smooth(0, 0.45, open);
  mats.volume.uniforms.uOpacity.value = 0.42 * k;
  mats.volume.uniforms.uTime.value = t;
  mats.pool.uniforms.uOpacity.value = 0.9 * k;
  mats.pool.uniforms.uTime.value = t;
  const fk = clamp01(fog) * smooth(0.05, 0.6, open);
  return (
    <group position={[TOWER_AT[0], 0, GATE.front + 0.2]}>
      {k > 0.005 ? (
        <>
          <mesh geometry={geos.pool} material={mats.pool} renderOrder={3} />
          <mesh geometry={geos.volume} material={mats.volume} renderOrder={7} />
        </>
      ) : null}
      {fk > 0.005
        ? mats.puffs.map((m, i) => {
            const p = frac(i / FOG_PUFFS + t * 0.07 + hash(i) * 0.3);
            const reach = p * 30 * (0.3 + 0.7 * fk);
            const side = (hash(i * 3.3) - 0.5) * (GATE.doorW * 0.8 + reach * 1.1);
            const s = 5 + 14 * p + 4 * hash(i * 1.9);
            m.opacity = fk * 0.3 * Math.sin(Math.PI * Math.min(1, p * 1.15)) * (0.6 + 0.4 * hash(i * 7.7));
            return <sprite key={i} material={m} position={[side, 0.6 + s * 0.16, 1 + reach]} scale={[s * 1.4, s * 0.55, 1]} renderOrder={8} />;
          })
        : null}
    </group>
  );
};

// =======================================================================================
// The security drone

/** The drone's eye in its own space (front = +z). The drone is ≈ 0.6 wide. */
export const DRONE_EYE: V3 = [0, 0.01, 0.31];

const DRONE_GEO = once(() => {
  const white: THREE.BufferGeometry[] = [];
  const dark: THREE.BufferGeometry[] = [];
  white.push(new THREE.SphereGeometry(0.3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2));
  dark.push(new THREE.SphereGeometry(0.295, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2));
  dark.push(xform(new THREE.TorusGeometry(0.302, 0.032, 8, 48), [0, 0, 0], [Math.PI / 2, 0, 0]));
  // The eye housing.
  dark.push(xform(new THREE.CylinderGeometry(0.14, 0.15, 0.12, 24), [0, 0.01, 0.255], [Math.PI / 2, 0, 0]));
  // Rotor arms with hubs.
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const dx = Math.sin(a);
    const dz = Math.cos(a);
    dark.push(xform(new THREE.BoxGeometry(0.3, 0.04, 0.05), [dx * 0.38, 0.12, dz * 0.38], [0, a - Math.PI / 2, 0]));
    dark.push(xform(new THREE.CylinderGeometry(0.045, 0.05, 0.07, 10), [dx * 0.52, 0.17, dz * 0.52]));
  }
  // Antenna.
  dark.push(xform(new THREE.CylinderGeometry(0.008, 0.012, 0.16, 6), [0, 0.36, -0.05]));
  dark.push(xform(new THREE.CylinderGeometry(0.1, 0.13, 0.05, 20), [0, -0.3, 0]));
  return {
    white: mergeUV(white),
    dark: mergeUV(dark),
    lens: new THREE.SphereGeometry(0.095, 20, 14),
    glint: new THREE.SphereGeometry(0.022, 8, 6),
    disc: new THREE.CircleGeometry(0.15, 28).rotateX(-Math.PI / 2),
    blade: new THREE.BoxGeometry(0.3, 0.006, 0.035),
    badge: new THREE.CircleGeometry(0.1, 28),
    tip: new THREE.SphereGeometry(0.024, 8, 6),
    redRing: new THREE.TorusGeometry(0.305, 0.008, 6, 48).rotateX(Math.PI / 2),
  };
});

/**
 * TIMECO's security drone: a floating white/charcoal sphere (≈ 0.6 wide) with one red camera eye
 * (front = +z), the hourglass logo on both sides, four rotor arms and an antenna. `eye` 0..1+
 * pulses the eye, `t` seconds spins the rotors.
 */
export const TimecoDrone: React.FC<{ t?: number; eye?: number }> = ({ t = 0, eye = 0.6 }) => {
  const G = DRONE_GEO();
  const mats = useMemo(
    () => ({
      white: toy("#F3F3F6", { rough: 0.22, glow: 0.2, metal: 0.05 }),
      dark: toy(CHAR, { rough: 0.35, glow: 0.12, metal: 0.4 }),
      disc: new THREE.MeshBasicMaterial({ color: "#E8ECFF", transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
      badge: new THREE.MeshBasicMaterial({ map: logoTexture(), toneMapped: false }),
      lens: new THREE.MeshBasicMaterial({ color: "#FF2A2A", toneMapped: false }),
    }),
    [],
  );
  const e = Math.max(0, eye);
  mats.lens.color.setRGB(0.55 + 0.6 * Math.min(1.2, e), 0.08 + 0.25 * Math.max(0, e - 0.8), 0.08 + 0.2 * Math.max(0, e - 0.8));
  return (
    <group>
      <mesh geometry={G.white} material={mats.white} />
      <mesh geometry={G.dark} material={mats.dark} />
      <mesh geometry={G.redRing} material={basic(RED)} position={[0, -0.06, 0]} />
      <mesh geometry={G.lens} material={mats.lens} position={[0, 0.01, 0.29]} />
      <mesh geometry={G.glint} material={basic("#FFFFFF")} position={[0.035, 0.05, 0.37]} />
      <Halo color="#FF2020" size={0.55 + 0.75 * e} opacity={0.5 + 0.4 * Math.min(1, e)} position={[0, 0.01, 0.36]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={G.badge} material={mats.badge} position={[s * 0.293, 0.05, 0]} rotation={[0, (s * Math.PI) / 2, 0]} scale={[0.95, 0.95, 1]} />
      ))}
      {[0, 1, 2, 3].map((k) => {
        const a = Math.PI / 4 + (k * Math.PI) / 2;
        const x = Math.sin(a) * 0.52;
        const z = Math.cos(a) * 0.52;
        const spin = t * 47 + k * 1.3;
        return (
          <group key={k} position={[x, 0.215, z]}>
            <mesh geometry={G.disc} material={mats.disc} />
            <mesh geometry={G.blade} material={mats.dark} rotation={[0, spin, 0]} />
          </group>
        );
      })}
      <mesh geometry={G.tip} material={Math.sin(t * 8) > 0 ? basic("#FF3B3B") : basic("#5A1418")} position={[0, 0.45, -0.05]} />
    </group>
  );
};

// ---------------------------------------------------------------------------------------
// The scan beam

const SCAN_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float edge = pow(abs(vUv.x - 0.5) * 2.0, 6.0);
  float a = (0.35 + 0.65 * vUv.y) * (0.25 + 0.75 * edge) * uOpacity;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

/** A 4-sided pyramid with its apex at the origin opening along +z to a 1 × 1 base at z = 1 (uv.y = along). */
const PYRAMID = once(() => {
  const pos: number[] = [];
  const uv: number[] = [];
  const c: V3[] = [
    [-0.5, -0.5, 1],
    [0.5, -0.5, 1],
    [0.5, 0.5, 1],
    [-0.5, 0.5, 1],
  ];
  for (let i = 0; i < 4; i++) {
    const a = c[i];
    const b = c[(i + 1) % 4];
    pos.push(0, 0, 0, ...a, ...b);
    uv.push(0.5, 0, 0, 1, 1, 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  return g;
});

/** Position, rotation and scale that map the unit pyramid from `from` to a w × h window centred at `to` (horizontal x). */
const pyramidFrame = (from: V3, to: V3, w: number, h: number) => {
  const Z = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const len = Math.max(1e-3, Z.length());
  Z.normalize();
  const X = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), Z);
  if (X.lengthSq() < 1e-6) X.set(1, 0, 0);
  X.normalize();
  const Y = new THREE.Vector3().crossVectors(Z, X).normalize();
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  return { position: from, quaternion: q, scale: [w, h, len] as V3 };
};

/**
 * The drone's red scan: a faint pyramid from the eye (`from`) over the target window (w × h,
 * centred at `to`) and a bright scan fan whose line sits at `sweep` (−1 bottom .. 1 top) of the
 * window. `amount` 0..1.
 */
export const ScanBeam: React.FC<{ from: V3; to: V3; w: number; h: number; sweep: number; amount: number }> = ({ from, to, w, h, sweep, amount }) => {
  const mats = useMemo(() => {
    const mk = () =>
      additive(
        new THREE.ShaderMaterial({
          vertexShader: BEAM_VERT,
          fragmentShader: SCAN_FRAG,
          side: THREE.DoubleSide,
          uniforms: { uColor: { value: new THREE.Color("#FF2A2A") }, uOpacity: { value: 0 } },
        }),
      );
    return { cone: mk(), fan: mk() };
  }, []);
  if (amount <= 0.01) return null;
  mats.cone.uniforms.uOpacity.value = 0.3 * amount;
  mats.fan.uniforms.uOpacity.value = 1.1 * amount;
  const cone = pyramidFrame(from, to, w, h);
  const line: V3 = [to[0], to[1] + (sweep * h) / 2, to[2]];
  const fan = pyramidFrame(from, line, w, h * 0.035);
  return (
    <>
      <mesh geometry={PYRAMID()} material={mats.cone} position={cone.position} quaternion={cone.quaternion} scale={cone.scale} renderOrder={7} />
      <mesh geometry={PYRAMID()} material={mats.fan} position={fan.position} quaternion={fan.quaternion} scale={fan.scale} renderOrder={7} />
    </>
  );
};

/** The scan line wrapping a character's body at height y (a thin glowing red slab). */
export const ScanRing: React.FC<{ position: V3; width?: number; depth?: number; amount: number }> = ({ position, width = 2.25, depth = 2.0, amount }) => {
  const mat = useMemo(() => additive(new THREE.MeshBasicMaterial({ color: "#FF3030", transparent: true, toneMapped: false })), []);
  if (amount <= 0.01) return null;
  mat.opacity = amount;
  return (
    <group position={position}>
      <mesh material={mat} renderOrder={8}>
        <boxGeometry args={[width, 0.045, depth]} />
      </mesh>
      <Halo color="#FF2A2A" size={width * 1.4} opacity={0.35 * amount} />
    </group>
  );
};

// =======================================================================================
// Small effects

/** A burst of air puffs flying out of a point (`at` = frame it bursts), with speed streaks. */
export const AirBurst: React.FC<{ frame: number; at: number; position: V3; radius?: number; color?: string }> = ({ frame, at, position, radius = 1.8, color = "#E8F7FF" }) => {
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const mats = useMemo(
    () => ({
      puff: new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, depthWrite: false, emissive: new THREE.Color(color), emissiveIntensity: 0.55 }),
      streak: additive(new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, toneMapped: false })),
    }),
    [color],
  );
  const d = frame - at;
  if (d < 0 || d > 22) return null;
  const k = d / 22;
  mats.puff.opacity = 0.85 * (1 - k * k);
  mats.streak.opacity = 0.9 * (1 - smooth(0, 0.5, k));
  const N = 14;
  return (
    <group position={position}>
      {Array.from({ length: N }).map((_, i) => {
        const a = (i / N) * Math.PI * 2 + hash(i) * 0.5;
        const e = (hash(i * 3.1) - 0.3) * 1.1;
        const r = radius * (0.3 + (1 - Math.pow(1 - k, 3)) * (0.8 + hash(i + 4) * 0.5));
        const s = radius * 0.2 * (1 - 0.6 * k) * (0.7 + hash(i + 9) * 0.6);
        return <mesh key={i} geometry={geo} material={mats.puff} position={[Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r * 0.7, Math.sin(a) * Math.cos(e) * r]} scale={s} />;
      })}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        const r = radius * (0.6 + 1.4 * k);
        return (
          <mesh key={`s${i}`} material={mats.streak} position={[Math.cos(a) * r, 0.1 + 0.3 * Math.sin(i * 2.1), Math.sin(a) * r]} rotation={[0, -a, 0]} renderOrder={6}>
            <boxGeometry args={[0.7 * (1 - k * 0.5), 0.035, 0.035]} />
          </mesh>
        );
      })}
    </group>
  );
};

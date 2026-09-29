import { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender } from "remotion";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { fontsLoaded } from "../../fonts";
import { noise2 } from "../noise";

// Shared helpers for the Inca props: toy materials, rounded boxes, cached canvas textures,
// a font gate for canvas text, periodic noise and small geometry utilities.

export type V3 = [number, number, number];

export const useRounded = (w: number, h: number, d: number, r: number, segments = 4) =>
  useMemo(() => new RoundedBoxGeometry(w, h, d, segments, r), [w, h, d, r, segments]);

export type ToyOpts = {
  rough?: number;
  metal?: number;
  /** Emissive share of the base colour: keeps flat colours bright, like the other props. */
  glow?: number;
  flat?: boolean;
  side?: THREE.Side;
};

const matCache = new Map<string, THREE.MeshStandardMaterial>();
/**
 * Shared toy material: flat saturated colour with a little emissive. Cached (memoized) per
 * colour + options and shared between instances, so never mutate the result.
 */
export const toy = (color: string, o: ToyOpts = {}) => {
  const key = `${color}|${o.rough ?? 0.55}|${o.metal ?? 0}|${o.glow ?? 0.14}|${o.flat ? 1 : 0}|${o.side ?? 0}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.rough ?? 0.55,
      metalness: o.metal ?? 0,
      emissive: new THREE.Color(color),
      emissiveIntensity: o.glow ?? 0.14,
      flatShading: o.flat ?? false,
      side: o.side ?? THREE.FrontSide,
    });
    matCache.set(key, m);
  }
  return m;
};

/** Gold used across the set (matches IntiSun). */
export const GOLD = "#FFC21A";
export const gold = () => toy(GOLD, { metal: 0.6, rough: 0.28, glow: 0.26 });
export const goldDark = () => toy("#E08A00", { metal: 0.6, rough: 0.3, glow: 0.2 });

/**
 * Vertex-coloured toy material: per-vertex colours carry the palette and, like `toy`, a share
 * of each vertex colour is added as emissive so the colours stay bright.
 */
const vcCache = new Map<string, THREE.MeshStandardMaterial>();
export const vertexMat = (rough = 0.8, flat = false, glow = 0.12, metal = 0) => {
  const key = `${rough}|${flat}|${glow}|${metal}`;
  let m = vcCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: rough,
      metalness: metal,
      flatShading: flat,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: glow,
    });
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n#ifdef USE_COLOR\n\ttotalEmissiveRadiance *= vColor.rgb;\n#endif",
      );
    };
    m.customProgramCacheKey = () => "inca-vertex-emissive";
    vcCache.set(key, m);
  }
  return m;
};

export const shadeHex = (color: string, dl: number, ds = 0) => {
  const c = new THREE.Color(color);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.max(0, Math.min(1, hsl.s + ds)), Math.max(0, Math.min(1, hsl.l + dl)));
  return `#${c.getHexString()}`;
};

const texCache = new Map<string, THREE.CanvasTexture>();
/** Canvas texture drawn once per key and cached (sRGB, mipmapped). */
export const canvasTexture = (
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  o: { wrapS?: boolean; wrapT?: boolean } = {},
) => {
  const hit = texCache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(w));
  canvas.height = Math.max(2, Math.round(h));
  const ctx = canvas.getContext("2d")!;
  draw(ctx, canvas.width, canvas.height);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (o.wrapS) t.wrapS = THREE.RepeatWrapping;
  if (o.wrapT) t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
};

/** Soft round glow (white centre fading out), for additive halos. */
export const glowTexture = () =>
  canvasTexture("glow-radial", 128, 128, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.35, "rgba(255,255,255,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });

// Canvas text needs the bundled fonts. `fontsLoaded` (src/fonts.ts) resolves once they are in
// document.fonts; until then this hook holds the render (delayRender) and returns false.
let fontsReady = false;
fontsLoaded.then(
  () => {
    fontsReady = true;
  },
  () => {
    fontsReady = true;
  },
);

export const useFontsReady = () => {
  const [ready, setReady] = useState(fontsReady);
  const [handle] = useState(() => (fontsReady ? null : delayRender("Inca props: fonts for canvas textures")));
  useEffect(() => {
    if (handle === null) return;
    let alive = true;
    let released = false;
    const done = () => {
      fontsReady = true;
      if (alive) setReady(true);
      if (!released) {
        released = true;
        continueRender(handle);
      }
    };
    fontsLoaded.then(done, done);
    return () => {
      alive = false;
    };
  }, [handle]);
  return ready;
};

/**
 * 2D noise that repeats every `period` units along x (samples noise on a circle), so scrolling
 * scenery can wrap seamlessly. Roughly [-1, 1].
 */
export const loopNoise = (x: number, z: number, period: number, freq: number, seed = 0) => {
  const a = (x / period) * Math.PI * 2;
  const R = (period * freq) / (Math.PI * 2);
  return noise2(Math.cos(a) * R + z * freq + seed * 17.3, Math.sin(a) * R - z * freq * 0.7 + seed * 5.1);
};

/** Three 2D slices combined into a cheap 3D noise, roughly [-1, 1]. */
export const noise3 = (x: number, y: number, z: number) =>
  (noise2(x + 3.1, y - 7.7) + noise2(y + 11.3, z + 1.9) + noise2(z - 5.2, x + 13.7)) / 1.6;

/** Positive modulo. */
export const wrap = (v: number, m: number) => ((v % m) + m) % m;

/** Rounded rectangle outline centred at the origin. */
export const roundedRectShape = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
};

/** Remaps a flat geometry's UVs to 0..1 over its x/y bounding box. */
export const planarUV = (g: THREE.BufferGeometry) => {
  g.computeBoundingBox();
  const b = g.boundingBox!;
  const p = g.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) - b.min.x) / (b.max.x - b.min.x);
    uv[i * 2 + 1] = (p.getY(i) - b.min.y) / (b.max.y - b.min.y);
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
};

/** Paints one flat colour into a geometry's vertex colours. */
export const paintGeo = (g: THREE.BufferGeometry, color: string) => {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
};

/** Quaternion that turns +y into `dir`. */
export const alignY = (dir: THREE.Vector3) =>
  new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

/** Euler (XYZ) that turns +y into `dir`, for JSX rotation props. */
export const eulerY = (x: number, y: number, z: number): V3 => {
  const e = new THREE.Euler().setFromQuaternion(alignY(new THREE.Vector3(x, y, z)));
  return [e.x, e.y, e.z];
};

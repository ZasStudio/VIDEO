import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { fbm, mulberry, smoothstep } from "../noise";
import { roof } from "../geo";
import { V3, canvasTexture, paintGeo, shadeHex, toy, vertexMat } from "../inca/kit";
import { Glow, additive } from "../thanos/FX";

// Outdoor sets for the water short ("¿Y si toda el agua desapareciera?"). World units sized for
// Nubi at size 2 (2 wide, ≈ 2 tall); front = +z; `t` = seconds. No sky: the shots paint a CSS
// gradient behind the canvas (coastSky / FARM_SKY) and every set adds a scene fog of its haze colour
// (SceneFog) so far geometry melts into that sky. Lights: <CoastLights /> and <FarmLights />.
//
//   • Coast {water, t, rush}: a bay. Sea level y = 0; the beach town sits on the shore (z ≈ 34 + 14
//     at x = 0, y ≈ 3), the pier runs out from it at x = −18, the lighthouse stands on the right
//     headland (LIGHTHOUSE_AT). `water` 1 → 0 lowers the sea to nothing (coastLevel); the boats
//     float, drop and end up lying tilted on the seabed; at 0 the seabed is a cracked desert.
//     The seabed plain around the playa is flat at COAST_FLAT_Y (−12): SHIP_SPOT, SHIP_NUBI and
//     PLAYA_WALK live there.
//   • GiantShip {tilt, creak, t}: a 72-long liner (keel origin, bow +x), heeling towards +z.
//   • Farmland {wilt, t}: four crop plots (corn, wheat, lettuce, sunflowers) around a cross of
//     irrigation channels, barn + silo, water tower, windmill; wilt 0 → 1 withers everything.

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Merges geometries (non-indexed; drops every attribute but position/normal/color and `keep`). */
const mergeAll = (geos: THREE.BufferGeometry[], keep: string[] = []) => {
  const clean = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    for (const key of Object.keys(ng.attributes)) {
      if (key !== "position" && key !== "normal" && key !== "color" && keep.indexOf(key) < 0) ng.deleteAttribute(key);
    }
    if (!ng.attributes.normal) ng.computeVertexNormals();
    return ng;
  });
  const m = mergeGeometries(clean, false);
  if (!m) throw new Error("mergeGeometries failed");
  return m;
};

/** Paints a geometry one colour and places it. */
const place = (g: THREE.BufferGeometry, color: string, pos: V3, rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]) => {
  paintGeo(g, color);
  g.applyMatrix4(
    new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale)),
  );
  return g;
};

const rbox = (w: number, h: number, d: number, r = 0.08) => new RoundedBoxGeometry(w, h, d, 2, Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));
const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);

/** A cylinder between two points (posts, braces, ropes). */
const rod = (a: V3, b: V3, r: number, color: string, seg = 6) => {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  const g = cyl(r, r, len, seg);
  paintGeo(g, color);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new THREE.Vector3(1, 1, 1)));
  return g;
};

/** Cone with alternating coloured wedges (beach umbrellas). */
const stripedCone = (r: number, h: number, seg: number, c1: string, c2: string) => {
  const g = new THREE.ConeGeometry(r, h, seg, 1).toNonIndexed();
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const A = new THREE.Color(c1);
  const B = new THREE.Color(c2);
  for (let f = 0; f < p.count; f += 3) {
    const cx = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3;
    const cz = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3;
    const s = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * seg);
    const c = s % 2 ? A : B;
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (f + k) * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
};

// =======================================================================================
// Shared ground material: dry mud cracks, wet sand and grass that browns.

/** Dry mud plates (tileable): R = crack lines, G = darkening towards the plate edges. */
const crackTexture = () =>
  canvasTexture(
    "agua-cracks",
    512,
    512,
    (ctx, W, H) => {
      const img = ctx.createImageData(W, H);
      const rnd = mulberry(8123);
      const layer = (N: number) => {
        const pts = new Float32Array(N * N * 2);
        for (let j = 0; j < N; j++)
          for (let i = 0; i < N; i++) {
            pts[(j * N + i) * 2] = (i + 0.12 + 0.76 * rnd()) / N;
            pts[(j * N + i) * 2 + 1] = (j + 0.12 + 0.76 * rnd()) / N;
          }
        return (u: number, v: number) => {
          const ci = Math.floor(u * N);
          const cj = Math.floor(v * N);
          let f1 = 9;
          let f2 = 9;
          for (let dj = -1; dj <= 1; dj++)
            for (let di = -1; di <= 1; di++) {
              const ii = ci + di;
              const jj = cj + dj;
              const wi = ((ii % N) + N) % N;
              const wj = ((jj % N) + N) % N;
              const px = pts[(wj * N + wi) * 2] + Math.floor(ii / N);
              const py = pts[(wj * N + wi) * 2 + 1] + Math.floor(jj / N);
              const d = Math.hypot(u - px, v - py) * N;
              if (d < f1) {
                f2 = f1;
                f1 = d;
              } else if (d < f2) f2 = d;
            }
          return f2 - f1;
        };
      };
      const big = layer(6);
      const small = layer(15);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const u = (x + 0.5) / W;
          const v = (y + 0.5) / H;
          const e1 = big(u, v);
          const e2 = small(u, v);
          const c1 = 1 - smoothstep(0.03, 0.075, e1);
          const c2 = (1 - smoothstep(0.025, 0.06, e2)) * 0.5;
          const edge = 1 - smoothstep(0.0, 0.5, e1);
          const k = (y * W + x) * 4;
          img.data[k] = Math.round(Math.max(c1, c2) * 255);
          img.data[k + 1] = Math.round(edge * 255);
          img.data[k + 2] = 0;
          img.data[k + 3] = 255;
        }
      ctx.putImageData(img, 0, 0);
    },
    { wrapS: true, wrapT: true },
  );

type GroundUniforms = {
  uWet: { value: number };
  uDry: { value: number };
  uWilt: { value: number };
  uCrack: { value: THREE.Texture };
  uCrackScale: { value: number };
  uGlow: { value: number };
};

/**
 * Vertex-coloured ground. `sea`: the dry/wet effects apply below sea level only (else on every
 * vertex with aGrass = 0). Geometries need an `aGrass` attribute (1 = grass that browns with uWilt).
 */
const makeGround = (sea: boolean, crackScale: number, glow = 0.15, pale = 0.025) => {
  const uniforms: GroundUniforms = {
    uWet: { value: 0 },
    uDry: { value: 0 },
    uWilt: { value: 0 },
    uCrack: { value: crackTexture() },
    uCrackScale: { value: crackScale },
    uGlow: { value: glow },
  };
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aGrass;\nvarying vec3 vGW;\nvarying float vGrass;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvGW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvGrass = aGrass;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vGW;\nvarying float vGrass;\nuniform float uWet;\nuniform float uDry;\nuniform float uWilt;\nuniform sampler2D uCrack;\nuniform float uCrackScale;\nuniform float uGlow;",
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
{
  float seaK = ${sea ? "1.0 - smoothstep(-0.7, 0.25, vGW.y)" : "1.0 - vGrass"};
  float lum = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.76, 0.42) * (0.62 + 0.55 * lum), vGrass * uWilt);
  vec4 ck = texture2D(uCrack, vGW.xz * uCrackScale);
  float dk = seaK * uDry;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.07, 1.02, 0.92) + vec3(${pale.toFixed(3)}, ${(pale * 0.85).toFixed(3)}, ${(pale * 0.6).toFixed(3)}), dk);
  diffuseColor.rgb *= 1.0 - 0.22 * ck.g * dk;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.42, 0.3, 0.22), ck.r * dk);
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.66, 0.7, 0.7), seaK * uWet);
}`,
      )
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance = diffuseColor.rgb * uGlow;");
  };
  material.customProgramCacheKey = () => `agua-ground-${sea ? 1 : 0}-${pale}`;
  return { material, uniforms };
};

const setGrass = (g: THREE.BufferGeometry, fn: (i: number) => number) => {
  const n = g.attributes.position.count;
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = fn(i);
  g.setAttribute("aGrass", new THREE.BufferAttribute(a, 1));
  return g;
};

/** Scene fog in the set's haze colour (keeps far geometry on the CSS sky). Child of the canvas. */
export const SceneFog: React.FC<{ color: string; near: number; far: number }> = ({ color, near, far }) => {
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

// =======================================================================================
// Coast: terrain

/** Hot summer sky; the haze band sits at `horizon` (0 = top of the frame, 1 = bottom). */
export const COAST_HAZE = "#F4E2BC";
export const coastSky = (horizon = 0.55) => {
  const h = Math.max(0.05, Math.min(0.98, horizon)) * 100;
  return `linear-gradient(180deg, #2A7FDB 0%, #4FA3EC ${(h * 0.45).toFixed(1)}%, #9CCFF0 ${(h * 0.8).toFixed(1)}%, #E6EDDD ${(h * 0.95).toFixed(1)}%, ${COAST_HAZE} ${h.toFixed(1)}%, #F1D9A8 100%)`;
};

/** Terrain grid: COAST_GRID.size square centred on (0, cz); 2 units per cell. */
export const COAST_GRID = { size: 440, cz: -70, segs: 220 };
/** The flat seabed plain where Nubi walks and the giant ship lies. */
export const COAST_FLAT_Y = -12;
const FLAT = { x: 4, z: -44, r0: 40, r1: 66 };
const HEADLANDS = [
  { x: 84, z: -14, rx: 21, rz: 46, h: 13 },
  { x: -90, z: -6, rx: 23, rz: 40, h: 9 },
];

/** z of the waterline (sea level) at x: a curved bay between two headlands. */
export const coastShoreZ = (x: number) => 34 - 22 * Math.min(1, (x / 80) ** 2);

/**
 * Ground height of the Coast at (x, z). Land (z > shore): beach rising to the town promenade at
 * y ≈ 3 (14 units inland). Sea: a shelf down to −7 within 22 units, then a plain (−12 on the flat
 * zone around FLAT) sloping on to −24 at the horizon, with dunes; two headlands with cliffs.
 */
export const coastBedY = (x: number, z: number) => {
  const d = coastShoreZ(x) - z;
  let y: number;
  if (d <= 0) {
    const k = -d;
    y = Math.min(1.5, k * 0.13) + 1.5 * smoothstep(12, 14, k) + 0.8 * smoothstep(40, 100, k) + 0.3 * fbm(x * 0.05, z * 0.05) * smoothstep(14, 24, k);
  } else {
    y = -Math.min(d, 22) * 0.32 - Math.max(0, d - 22) * 0.1 - Math.max(0, d - 130) * 0.05;
    y = Math.max(y, -24);
    const k = smoothstep(3, 20, d);
    const amp = 1 + smoothstep(90, 200, d);
    y += k * amp * (1.3 * fbm(x * 0.03 + 2.1, z * 0.03 - 1.3) + 0.3 * Math.sin(x * 0.19 + z * 0.05 + 3 * fbm(x * 0.05, z * 0.05)));
    // The playa plain.
    const fk = smoothstep(FLAT.r1, FLAT.r0, Math.hypot(x - FLAT.x, (z - FLAT.z) * 0.9));
    y = lerp(y, COAST_FLAT_Y + 0.18 * fbm(x * 0.08, z * 0.08), fk);
  }
  for (const hd of HEADLANDS) {
    const e = Math.hypot((x - hd.x) / hd.rx, (z - hd.z) / hd.rz);
    if (e < 1.3) {
      const top = hd.h + 1.6 * fbm(x * 0.07, z * 0.07);
      y = Math.max(y, lerp(y, top, smoothstep(1.25, 0.82, e)));
    }
  }
  return y;
};

export const COAST_BED_MIN = -25.5;
/** Height of the sea surface for `water` (1 = sea level 0, 0 = below the deepest seabed). */
export const coastLevel = (water: number) => lerp(COAST_BED_MIN, 0, clamp01(water));

const SAND = { beach: "#F6DFA4", wetBeach: "#E9CB8C", pave: "#EDE2CF", grass: "#88CC6A", bed: "#EACB91", crest: "#F4DCA8", trough: "#DDB67C", ochre: "#E2B27C", rock: "#B7A188", cliff: "#C29A74" };

const coastTerrain = () => {
  const { size, cz, segs } = COAST_GRID;
  const g = new THREE.PlaneGeometry(size, size, segs, segs);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, cz);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const grass = new Float32Array(p.count);
  const c = new THREE.Color();
  const C = (h: string) => new THREE.Color(h);
  const S = {
    beach: C(SAND.beach),
    wetBeach: C(SAND.wetBeach),
    pave: C(SAND.pave),
    grass: C(SAND.grass),
    bed: C(SAND.bed),
    crest: C(SAND.crest),
    trough: C(SAND.trough),
    ochre: C(SAND.ochre),
    rock: C(SAND.rock),
    cliff: C(SAND.cliff),
  };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const y = coastBedY(x, z);
    p.setY(i, y);
    const d = coastShoreZ(x) - z;
    let gr = 0;
    if (y > 0.05 && d < 0) {
      const k = -d;
      c.copy(S.wetBeach).lerp(S.beach, smoothstep(0.5, 4, k));
      c.lerp(S.pave, smoothstep(12.5, 13.5, k));
      if (k > 34) {
        c.lerp(S.grass, smoothstep(34, 40, k));
        gr = smoothstep(34, 40, k);
      }
    } else {
      const n = fbm(x * 0.05 + 7, z * 0.05);
      c.copy(S.bed).lerp(S.crest, clamp01(n * 2.2)).lerp(S.trough, clamp01(-n * 2.2));
      c.lerp(S.ochre, clamp01((fbm(x * 0.02 - 3, z * 0.02 + 5) - 0.1) * 2.5) * 0.6);
      c.lerp(S.wetBeach, smoothstep(-1.5, 0, y) * 0.4);
    }
    for (const hd of HEADLANDS) {
      const e = Math.hypot((x - hd.x) / hd.rx, (z - hd.z) / hd.rz);
      if (e < 1.3) {
        const top = smoothstep(0.95, 0.8, e);
        const cliff = smoothstep(1.28, 1.05, e) * (1 - top);
        c.lerp(S.cliff, cliff);
        c.lerp(S.grass, top);
        gr = Math.max(gr, top);
      }
    }
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
    grass[i] = gr;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aGrass", new THREE.BufferAttribute(grass, 1));
  g.deleteAttribute("uv");
  g.computeVertexNormals();
  return g;
};

// =======================================================================================
// Coast: water

const waterGeometry = () => {
  const { size, cz, segs } = COAST_GRID;
  const g = new THREE.PlaneGeometry(size, size, segs, segs);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, cz);
  const p = g.attributes.position;
  const bed = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) bed[i] = coastBedY(p.getX(i), p.getZ(i));
  g.setAttribute("aBed", new THREE.BufferAttribute(bed, 1));
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  return g;
};

const WATER_VS = /* glsl */ `
attribute float aBed;
uniform float uLevel;
uniform float uTime;
varying float vDepth;
varying vec3 vW;
#include <fog_pars_vertex>
void main() {
  vec3 p = position;
  float depth = uLevel - aBed;
  float amp = smoothstep(0.0, 2.5, depth);
  float w = sin(p.x * 0.17 + uTime * 1.7) * 0.5 + sin(p.z * 0.21 - uTime * 2.1 + p.x * 0.07) * 0.5;
  p.y = uLevel + w * 0.32 * amp;
  vDepth = depth;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vW = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const WATER_FS = /* glsl */ `
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform float uTime;
uniform float uRush;
varying float vDepth;
varying vec3 vW;
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  if (vDepth < 0.0) discard;
  float k = smoothstep(0.0, 8.0, vDepth);
  vec3 col = mix(uShallow, uDeep, k);
  // Toon wave lines drifting with the swell.
  float n = vnoise(vW.xz * 0.07 + vec2(uTime * 0.22, uTime * 0.09)) + 0.5 * vnoise(vW.xz * 0.19 - uTime * 0.3);
  float band = smoothstep(0.86, 0.95, fract(n * 2.2 + vW.z * 0.015 + uTime * 0.12));
  col = mix(col, mix(col, uFoam, 0.6), band * (0.55 + 0.45 * k));
  // Streaks racing out to sea while it drains.
  float s = vnoise(vec2(vW.x * 0.12, (vW.z + uTime * 70.0) * 0.035));
  col = mix(col, uFoam, smoothstep(0.7, 0.88, s) * uRush * 0.75);
  // Foam along the waterline and a second line just off it.
  float edge = 0.32 + 0.12 * sin(vW.x * 0.55 + uTime * 3.0) + 0.08 * sin(vW.z * 0.5 - uTime * 2.0);
  float foam = 1.0 - smoothstep(edge, edge + 0.22, vDepth);
  float edge2 = 1.15 + 0.3 * sin(vW.x * 0.27 - uTime * 2.3);
  foam = max(foam, (1.0 - smoothstep(0.0, 0.14, abs(vDepth - edge2))) * 0.75);
  col = mix(col, uFoam, foam);
  // Sun glints.
  float sp = hash(floor(vW.xz * 1.3) + floor(uTime * 5.0));
  col += vec3(step(0.996, sp)) * 0.7 * k;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
  #include <colorspace_fragment>
}`;

const makeWaterMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uLevel: { value: 0 },
        uTime: { value: 0 },
        uRush: { value: 0 },
        uDeep: { value: new THREE.Color("#1F78D6") },
        uShallow: { value: new THREE.Color("#41D3D8") },
        uFoam: { value: new THREE.Color("#FFFFFF") },
      },
    ]),
    vertexShader: WATER_VS,
    fragmentShader: WATER_FS,
    fog: true,
  });

// =======================================================================================
// Coast: boats

export type BoatKind = "fish" | "sail" | "row";
export type BoatSpec = { kind: BoatKind; x: number; z: number; yaw: number; hull: string; trim: string; roll: number; pitch: number; seed: number };

/** The bay's boats (keel position; when stranded they lie at coastBedY with `roll`/`pitch`). */
export const COAST_BOATS: BoatSpec[] = [
  { kind: "fish", x: -4, z: -20, yaw: 0.35, hull: "#E8443A", trim: "#FFFFFF", roll: 0.45, pitch: 0.05, seed: 1 },
  { kind: "sail", x: 10, z: -26, yaw: -1.25, hull: "#FFFFFF", trim: "#2F7BEA", roll: -0.55, pitch: 0.04, seed: 2 },
  { kind: "row", x: 6, z: -31.5, yaw: 2.3, hull: "#2CB7B0", trim: "#FFD23F", roll: 0.32, pitch: -0.05, seed: 3 },
  { kind: "fish", x: -30, z: 2, yaw: -0.3, hull: "#2F7BEA", trim: "#FFD23F", roll: -0.4, pitch: 0.03, seed: 4 },
  { kind: "fish", x: 30, z: -8, yaw: 2.7, hull: "#F7B32B", trim: "#E8443A", roll: 0.42, pitch: -0.04, seed: 5 },
  { kind: "sail", x: -44, z: -40, yaw: 1.2, hull: "#FFFFFF", trim: "#E8443A", roll: 0.5, pitch: 0.02, seed: 6 },
  { kind: "row", x: -12, z: 18, yaw: 0.4, hull: "#FF8A5C", trim: "#FFFFFF", roll: -0.3, pitch: 0.04, seed: 7 },
  { kind: "row", x: -24, z: 22, yaw: -0.6, hull: "#7FD36B", trim: "#FFFFFF", roll: 0.35, pitch: 0, seed: 8 },
  { kind: "fish", x: 46, z: -46, yaw: -2.2, hull: "#9B6BE0", trim: "#FFFFFF", roll: -0.44, pitch: 0.04, seed: 9 },
];

const BOAT_DIM: Record<BoatKind, { len: number; beam: number; h: number; wl: number }> = {
  fish: { len: 8, beam: 3, h: 2.1, wl: 1.0 },
  sail: { len: 7, beam: 2.5, h: 1.6, wl: 0.75 },
  row: { len: 4.2, beam: 1.7, h: 0.95, wl: 0.45 },
};

/** Half-width factor of a hull at u (0 stern … 1 bow) and yn (0 keel … 1 deck). */
const hullShape = (u: number, yn: number, bow = 0.32, stern = 0.12) => {
  let w = 1;
  if (u > 1 - bow) {
    const b = (u - (1 - bow)) / bow;
    w *= Math.sqrt(Math.max(0, 1 - b * b * 0.97));
  }
  if (u < stern) w *= 0.86 + (0.14 * u) / stern;
  w *= 0.42 + 0.58 * Math.pow(clamp01(yn), 0.55);
  return w;
};

/** Hull from a deformed rounded box (keel at y = 0, bow +x); `paint(yn, top)` colours it. */
const hullGeo = (len: number, beam: number, h: number, paint: (yn: number, top: boolean) => string, bow = 0.32, sheer = 0.3, segs = 6) => {
  const g = new RoundedBoxGeometry(len, h, beam, segs, Math.min(h, beam) * 0.24);
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const u = x / len + 0.5;
    const yn = y / h + 0.5;
    const w = hullShape(u, yn, bow);
    p.setXYZ(i, x, y + h / 2 + Math.pow(u, 2.5) * h * sheer * yn, z * Math.max(0.03, w));
    c.set(paint(yn, n.getY(i) > 0.75 && yn > 0.9));
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.deleteAttribute("uv");
  g.computeVertexNormals();
  return g;
};

const WOOD = "#C99A68";
const WOOD_DARK = "#8A5E3C";

const extrudeTri = (pts: [number, number][], depth: number, color: string) => {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  paintGeo(g, color);
  return g;
};

const boatGeometry = (b: BoatSpec) => {
  const D = BOAT_DIM[b.kind];
  const geos: THREE.BufferGeometry[] = [];
  if (b.kind === "fish") {
    geos.push(hullGeo(D.len, D.beam, D.h, (yn, top) => (top ? WOOD : yn < 0.3 ? "#B8322A" : yn < 0.4 ? "#FFFFFF" : yn > 0.84 ? b.trim : b.hull)));
    geos.push(place(rbox(2.4, 1.9, 2.1, 0.25), "#FFFFFF", [-1.3, D.h + 0.95, 0]));
    geos.push(place(rbox(2.9, 0.28, 2.5, 0.12), b.trim === "#FFFFFF" ? "#2F7BEA" : b.trim, [-1.3, D.h + 2.0, 0]));
    geos.push(place(rbox(0.12, 0.7, 1.7, 0.05), "#26456E", [-0.07, D.h + 1.2, 0]));
    for (const s of [-1, 1]) geos.push(place(rbox(1.6, 0.6, 0.1, 0.04), "#26456E", [-1.3, D.h + 1.25, s * 1.07]));
    geos.push(rod([1.4, D.h, 0], [1.4, D.h + 4.2, 0], 0.09, "#F4F4F4"));
    geos.push(rod([1.4, D.h + 3.2, 0], [3.4, D.h + 1.4, 0], 0.06, "#F4F4F4"));
    geos.push(place(new THREE.DodecahedronGeometry(0.7, 0), "#3F9E5A", [-3.0, D.h + 0.35, 0], [0, 0.4, 0], [1.2, 0.5, 1]));
    geos.push(place(new THREE.TorusGeometry(0.42, 0.13, 6, 14), "#FF6A2B", [-1.3, D.h + 1.0, 1.14]));
  } else if (b.kind === "sail") {
    geos.push(hullGeo(D.len, D.beam, D.h, (yn, top) => (top ? "#EFE3CF" : yn < 0.32 ? b.trim : yn < 0.4 ? "#FFFFFF" : yn > 0.82 ? b.trim : b.hull), 0.38, 0.35));
    geos.push(place(rbox(2.4, 0.8, 1.5, 0.25), "#FFFFFF", [-0.6, D.h + 0.35, 0]));
    geos.push(rod([0.6, D.h, 0], [0.6, D.h + 8.6, 0], 0.09, "#E8E8E8"));
    geos.push(rod([0.6, D.h + 1.0, 0], [-2.8, D.h + 1.0, 0], 0.07, "#E8E8E8"));
    geos.push(
      extrudeTri(
        [
          [0.45, D.h + 1.1],
          [0.45, D.h + 8.3],
          [-2.7, D.h + 1.1],
        ],
        0.05,
        "#FFFFFF",
      ),
    );
    geos.push(
      extrudeTri(
        [
          [0.75, D.h + 0.4],
          [0.75, D.h + 7.6],
          [3.3, D.h + 0.4],
        ],
        0.05,
        "#FFF3D2",
      ),
    );
    geos.push(place(rbox(2.9, 0.4, 0.06, 0.02), b.trim, [-0.9, D.h + 1.6, 0.04]));
  } else {
    geos.push(hullGeo(D.len, D.beam, D.h, (yn, top) => (top ? "#B98A5C" : yn > 0.8 ? b.trim : b.hull), 0.36, 0.4, 4));
    for (const x of [-0.8, 0.6]) geos.push(place(rbox(0.5, 0.1, D.beam * 0.8, 0.03), WOOD, [x, D.h + 0.02, 0]));
    geos.push(rod([-1.6, D.h + 0.1, -0.7], [1.6, D.h + 0.15, 0.55], 0.05, WOOD_DARK));
    geos.push(place(rbox(0.7, 0.04, 0.25, 0.02), WOOD_DARK, [1.8, D.h + 0.15, 0.6], [0, 0.4, 0]));
  }
  return mergeAll(geos);
};

const Boat: React.FC<{ spec: BoatSpec; level: number; t: number }> = ({ spec, level, t }) => {
  const geo = useMemo(() => boatGeometry(spec), [spec]);
  const D = BOAT_DIM[spec.kind];
  const bed = coastBedY(spec.x, spec.z);
  const floatY = level - D.wl + 0.12 * Math.sin(t * 1.8 + spec.seed * 2.1);
  const restY = bed - 0.25 + D.beam * 0.5 * Math.sin(Math.abs(spec.roll)) * 0.55;
  const gk = smoothstep(restY + 0.6, restY - 1.4, floatY);
  const y = Math.max(restY, floatY);
  const roll = lerp(0.05 * Math.sin(t * 1.3 + spec.seed), spec.roll, gk);
  const pitch = lerp(0.03 * Math.sin(t * 1.1 + spec.seed * 3), spec.pitch, gk);
  return (
    <group position={[spec.x, y, spec.z]} rotation={[0, spec.yaw, 0]}>
      <group rotation={[roll, 0, pitch]}>
        <mesh geometry={geo} material={vertexMat(0.45, false, 0.16)} />
      </group>
    </group>
  );
};

/** Where a boat of COAST_BOATS lies at water 0 (its keel position on the seabed). */
export const boatRest = (b: BoatSpec): V3 => [b.x, coastBedY(b.x, b.z), b.z];

// =======================================================================================
// Coast: town, pier, lighthouse

export const PIER = { x: -18, z0: 40, z1: -2, deckY: 2.4, width: 3.4 };
/** Top of the lighthouse lantern (world). */
export const LIGHTHOUSE_AT: V3 = [80, coastBedY(80, -42), -42];

const townGeometry = () => {
  const rnd = mulberry(5150);
  const geos: THREE.BufferGeometry[] = [];
  const walls = ["#FFB3C1", "#FFE08A", "#A8E6CF", "#9AD0FF", "#FFC8A2", "#FFFFFF", "#D7C1FF", "#FF9E9E"];
  const facing = (x: number) => {
    const dz = -44 * x / 6400;
    return Math.atan2(-(Math.abs(x) < 80 ? dz : 0), 1);
  };
  // Two rows of houses along the promenade.
  for (const row of [0, 1]) {
    let x = -66 + rnd() * 3;
    while (x < 66) {
      const w = 5 + rnd() * 2.5;
      const cx = x + w / 2;
      if (row === 0 && Math.abs(cx - PIER.x) < 4.5) {
        x += 7;
        continue;
      }
      const k = row === 0 ? 18.5 : 27.5;
      const z = coastShoreZ(cx) + k + rnd() * 1.2;
      const y = coastBedY(cx, z) - 0.1;
      const h = 3.6 + rnd() * (row === 0 ? 3 : 5);
      const d = 5 + rnd() * 1.5;
      const a = facing(cx);
      const wall = walls[Math.floor(rnd() * walls.length)];
      const m = new THREE.Matrix4().compose(new THREE.Vector3(cx, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0)), new THREE.Vector3(1, 1, 1));
      const parts: THREE.BufferGeometry[] = [];
      parts.push(place(rbox(w, h, d, 0.18), wall, [0, h / 2, 0]));
      parts.push(roof(w + 0.6, 1.6 + rnd() * 0.8, d + 0.6, rnd() < 0.7 ? "#E0703F" : "#4F8FD9", wall, [0, h, 0], Math.PI / 2));
      const floors = Math.max(1, Math.floor(h / 2.4));
      for (let f = 0; f < floors; f++)
        for (let i = 0; i < 2; i++) parts.push(place(rbox(0.9, 1.0, 0.12, 0.05), "#2D5C8F", [(i - 0.5) * w * 0.5, 1.3 + f * 2.3, -d / 2 - 0.02]));
      parts.push(place(rbox(1.0, 1.7, 0.12, 0.05), "#8A5E3C", [w * 0.05, 0.85, -d / 2 - 0.03]));
      if (rnd() < 0.5) parts.push(place(rbox(w * 0.9, 0.12, 1.4, 0.04), rnd() < 0.5 ? "#FF5A5A" : "#33B5FF", [0, 2.3, -d / 2 - 0.6], [0.25, 0, 0]));
      for (const g of parts) geos.push(g.applyMatrix4(m));
      x += w + 0.4 + rnd() * 1.5;
    }
  }
  // Palms along the promenade.
  for (let i = 0; i < 12; i++) {
    const x = -60 + i * 11 + rnd() * 2;
    if (Math.abs(x - PIER.x) < 3) continue;
    const z = coastShoreZ(x) + 14.5;
    const y = coastBedY(x, z);
    const lean = (rnd() - 0.5) * 0.5;
    const top: V3 = [x + lean * 4, y + 6.5, z - 0.6];
    for (let s = 0; s < 5; s++) {
      const a = s / 5;
      const b = (s + 1) / 5;
      geos.push(rod([x + lean * 4 * a * a, y + 6.5 * a, z - 0.6 * a], [x + lean * 4 * b * b, y + 6.5 * b, z - 0.6 * b], 0.28 - s * 0.03, s % 2 ? "#B98552" : "#A87443", 7));
    }
    for (let f = 0; f < 7; f++) {
      const az = (f / 7) * Math.PI * 2 + rnd() * 0.4;
      const fr = rbox(3.2, 0.1, 0.8, 0.04);
      fr.translate(1.6, 0, 0);
      geos.push(place(fr, f % 2 ? "#2FAE4E" : "#45C35E", top, [0, az, -0.45 - rnd() * 0.25]));
    }
    geos.push(place(new THREE.IcosahedronGeometry(0.32, 0), "#7A4B2A", [top[0] + 0.3, top[1] - 0.35, top[2]]));
  }
  // Umbrellas, towels and a lifeguard tower on the beach.
  const brights = ["#FF4D6D", "#FFD23F", "#2F9BEA", "#3FD07A", "#FF8A3D"];
  for (let i = 0; i < 9; i++) {
    const x = -56 + i * 12.5 + rnd() * 3;
    if (Math.abs(x - PIER.x) < 4) continue;
    const z = coastShoreZ(x) + 6 + rnd() * 3;
    const y = coastBedY(x, z);
    const c = brights[i % brights.length];
    geos.push(rod([x, y, z], [x, y + 2.6, z], 0.06, "#F4F4F4"));
    const cone = stripedCone(1.5, 0.6, 8, c, "#FFFFFF");
    cone.translate(x, y + 2.75, z);
    geos.push(cone);
    geos.push(place(rbox(1.0, 0.06, 2.0, 0.02), brights[(i + 2) % brights.length], [x + 1.2, y + 0.05, z - 0.4], [0, 0.3, 0]));
  }
  {
    const x = 18;
    const z = coastShoreZ(x) + 7;
    const y = coastBedY(x, z);
    for (const [dx, dz] of [
      [-0.8, -0.8],
      [0.8, -0.8],
      [-0.8, 0.8],
      [0.8, 0.8],
    ])
      geos.push(rod([x + dx * 1.3, y, z + dz * 1.3], [x + dx, y + 3.2, z + dz], 0.09, "#FFFFFF"));
    geos.push(place(rbox(2.4, 1.6, 2.4, 0.15), "#FF4D4D", [x, y + 4.0, z]));
    geos.push(roof(3.0, 0.9, 3.0, "#FFFFFF", "#FF4D4D", [x, y + 4.8, z], 0));
  }
  return mergeAll(geos);
};

const pierGeometry = () => {
  const geos: THREE.BufferGeometry[] = [];
  const { x, z0, z1, deckY, width } = PIER;
  const len = z0 - z1;
  const n = Math.floor(len / 0.62);
  for (let i = 0; i < n; i++) {
    const z = z0 - (i + 0.5) * (len / n);
    geos.push(place(rbox(width, 0.22, len / n - 0.07, 0.04), i % 3 === 0 ? "#B58658" : i % 3 === 1 ? "#C39466" : "#AD7E52", [x, deckY - 0.11, z]));
  }
  // T-head platform.
  geos.push(place(rbox(9, 0.24, 4.2, 0.06), "#B58658", [x, deckY - 0.12, z1 - 1.4]));
  // Posts (to the seabed) with X braces where they are tall.
  for (let z = z0 - 1; z >= z1 - 3; z -= 4) {
    const xs = z < z1 ? [-4, -1.5, 1.5, 4] : [-1.5, 1.5];
    for (const dx of xs) {
      const b = coastBedY(x + dx, z) - 0.6;
      geos.push(rod([x + dx, b, z], [x + dx, deckY - 0.2, z], 0.24, "#7A5538", 8));
      geos.push(rod([x + dx, Math.max(b, -0.4), z], [x + dx, Math.max(b, -0.4) + 0.5, z], 0.27, "#5E7F4A", 8));
    }
    const b = coastBedY(x, z);
    if (deckY - b > 3) {
      for (let y = deckY - 0.6; y > b + 1.2; y -= 3.2) {
        const y2 = Math.max(b + 0.6, y - 3);
        geos.push(rod([x - 1.5, y, z], [x + 1.5, y2, z], 0.1, "#8A6242"));
        geos.push(rod([x + 1.5, y, z], [x - 1.5, y2, z], 0.1, "#8A6242"));
      }
    }
  }
  // Railings.
  for (let z = z0 - 0.5; z > z1; z -= 2) for (const s of [-1, 1]) geos.push(rod([x + s * (width / 2 - 0.1), deckY, z], [x + s * (width / 2 - 0.1), deckY + 1.0, z], 0.06, "#FFFFFF"));
  for (const s of [-1, 1]) geos.push(place(rbox(0.12, 0.12, len, 0.04), "#FFFFFF", [x + s * (width / 2 - 0.1), deckY + 1.0, (z0 + z1) / 2]));
  // Lamp and bench on the head.
  geos.push(rod([x + 3.6, deckY, z1 - 2.6], [x + 3.6, deckY + 3.2, z1 - 2.6], 0.08, "#2D3A4A"));
  geos.push(place(new THREE.SphereGeometry(0.32, 10, 8), "#FFF1A8", [x + 3.6, deckY + 3.4, z1 - 2.6]));
  geos.push(place(rbox(2.2, 0.15, 0.6, 0.04), "#2F7BEA", [x - 2.5, deckY + 0.55, z1 - 2.8]));
  for (const dx of [-1, 1]) geos.push(place(rbox(0.12, 0.55, 0.5, 0.03), "#2D3A4A", [x - 2.5 + dx * 0.9, deckY + 0.27, z1 - 2.8]));
  return mergeAll(geos);
};

const lighthouseGeometry = () => {
  const geos: THREE.BufferGeometry[] = [];
  const [x, y, z] = LIGHTHOUSE_AT;
  const H = 15;
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const a = i / bands;
    const b = (i + 1) / bands;
    const g = cyl(2.5 - 0.9 * b, 2.5 - 0.9 * a, H / bands, 20);
    geos.push(place(g, i % 2 ? "#FFFFFF" : "#E5483B", [x, y + (a + b) * H * 0.5, z]));
  }
  geos.push(place(cyl(2.3, 2.3, 0.45, 20), "#2D3A4A", [x, y + H + 0.2, z]));
  geos.push(place(new THREE.TorusGeometry(2.2, 0.08, 6, 24), "#2D3A4A", [x, y + H + 1.1, z], [Math.PI / 2, 0, 0]));
  geos.push(place(cyl(1.35, 1.35, 2.0, 16), "#FFE77A", [x, y + H + 1.4, z]));
  geos.push(place(new THREE.SphereGeometry(1.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), "#E5483B", [x, y + H + 2.4, z]));
  geos.push(place(new THREE.SphereGeometry(0.3, 8, 6), "#E5483B", [x, y + H + 4.1, z]));
  // Keeper's house.
  geos.push(place(rbox(6, 3.4, 4.5, 0.2), "#FFFFFF", [x - 5.5, y + 1.7, z + 3]));
  geos.push(roof(6.6, 1.8, 5.1, "#E5483B", "#FFFFFF", [x - 5.5, y + 3.4, z + 3], Math.PI / 2));
  geos.push(place(rbox(0.9, 1.0, 0.12, 0.05), "#2D5C8F", [x - 7, y + 1.9, z + 0.73]));
  geos.push(place(rbox(0.9, 1.0, 0.12, 0.05), "#2D5C8F", [x - 4, y + 1.9, z + 0.73]));
  return mergeAll(geos);
};

// =======================================================================================
// Coast: seabed props (rocks, shells, starfish, coral, seaweed, fish bones, anchor, chest)

/** Keel centre of the stranded liner on the seabed (it heels towards +z, over SHIP_NUBI). */
export const SHIP_SPOT: V3 = [8, COAST_FLAT_Y, -60];
/** Nubi's spot at the foot of the overhang (deck rail ≈ 6 up, 10 behind; superstructure ≈ 17-28 up, 5 behind). */
export const SHIP_NUBI: V3 = [1, COAST_FLAT_Y, -37];
/** Nubi's walk on the seabed in the playa shot (left to right past the boats, to SHIP_NUBI). */
export const PLAYA_WALK = { from: [-5.2, COAST_FLAT_Y, -34.2] as V3, to: SHIP_NUBI };
/** Playa shot-A camera: just under the ship's rail, looking back towards the old shore. */
export const PLAYA_CAM: V3 = [3.2, COAST_FLAT_Y + 3.0, -47.2];
/** Playa wide camera (bow quarter): sees the bow, the anchor chain and tiny Nubi under the ship. */
export const PLAYA_WIDE: V3 = [62, COAST_FLAT_Y + 2.4, -25];

/** Spots of the seabed props near the playa walk (for camera framing). */
export const SEABED_PROPS = {
  anchor: [-6, COAST_FLAT_Y, -24] as V3,
  chest: [-9, COAST_FLAT_Y, -30] as V3,
  fish: [
    [2.5, COAST_FLAT_Y, -22.5],
    [-4, COAST_FLAT_Y, -41],
    [-16, COAST_FLAT_Y, -18],
  ] as V3[],
};

const BONE = "#F6F1E4";

const fishSkeleton = (pos: V3, yaw: number, s: number) => {
  const geos: THREE.BufferGeometry[] = [];
  geos.push(rod([-1, 0.12, 0], [0.9, 0.12, 0], 0.06, BONE));
  for (let i = 0; i < 6; i++) {
    const x = -0.6 + i * 0.26;
    const l = 0.55 * Math.sin(((i + 1) / 7) * Math.PI) + 0.15;
    for (const sd of [-1, 1]) geos.push(rod([x, 0.12, 0], [x - 0.12, 0.1, sd * l], 0.035, BONE, 4));
  }
  geos.push(place(new THREE.ConeGeometry(0.42, 0.9, 6), BONE, [1.25, 0.2, 0], [0, 0, -Math.PI / 2], [1, 1, 0.7]));
  geos.push(place(new THREE.SphereGeometry(0.11, 8, 6), "#2A2A2A", [1.3, 0.34, 0.2]));
  geos.push(extrudeTri([
    [-1, 0],
    [-1.6, 0.5],
    [-1.6, -0.5],
  ], 0.06, BONE).rotateX(Math.PI / 2).translate(0, 0.1, 0));
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(s, s, s));
  return geos.map((g) => g.applyMatrix4(m));
};

const starfish = (pos: V3, yaw: number, s: number, color: string) => {
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.2 : 0.55;
    if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2);
  return place(g, color, [pos[0], pos[1] + 0.06, pos[2]], [0, yaw, 0], [s, s, s]);
};

const shell = (pos: V3, yaw: number, s: number, color: string) => {
  const g = new THREE.CylinderGeometry(0.03, 0.5, 0.16, 9, 1, false, -Math.PI * 0.45, Math.PI * 0.9);
  return place(g, color, [pos[0], pos[1] + 0.08, pos[2]], [0, yaw, 0], [s, s, s]);
};

const coral = (rnd: () => number, pos: V3, s: number, color: string) => {
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    const tip: V3 = [pos[0] + Math.cos(a) * 0.5 * s, pos[1] + (0.7 + rnd() * 0.7) * s, pos[2] + Math.sin(a) * 0.5 * s];
    geos.push(rod([pos[0], pos[1], pos[2]], tip, 0.1 * s, color, 6));
    geos.push(place(new THREE.SphereGeometry(0.15 * s, 8, 6), shadeHex(color, 0.08), tip));
  }
  return geos;
};

const seaweed = (rnd: () => number, pos: V3, s: number) => {
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const a = rnd() * Math.PI * 2;
    const g = rbox(1.6 * s, 0.05, 0.28 * s, 0.02);
    g.translate(0.8 * s, 0, 0);
    geos.push(place(g, i % 2 ? "#6E7A3A" : "#5B6B34", [pos[0], pos[1] + 0.06 + i * 0.02, pos[2]], [0, a, 0.08]));
  }
  return geos;
};

const anchorGeo = (pos: V3, yaw: number, s: number) => {
  const geos: THREE.BufferGeometry[] = [];
  const IRON = "#4E5966";
  geos.push(rod([0, 0.3, -2], [0, 0.3, 1.6], 0.22, IRON, 8));
  geos.push(rod([-1.6, 0.35, 1.5], [1.6, 0.35, 1.5], 0.16, IRON, 8));
  geos.push(place(new THREE.TorusGeometry(0.42, 0.11, 8, 16), IRON, [0, 0.3, 2.05], [Math.PI / 2, 0, 0]));
  geos.push(place(new THREE.TorusGeometry(1.5, 0.2, 8, 20, Math.PI), IRON, [0, 0.3, -1.95], [Math.PI / 2, 0, 0]));
  for (const sd of [-1, 1]) geos.push(place(new THREE.ConeGeometry(0.42, 0.9, 4), IRON, [sd * 1.55, 0.3, -1.6], [Math.PI / 2, 0, -sd * 0.3]));
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, yaw, 0.18)), new THREE.Vector3(s, s, s));
  return geos.map((g) => g.applyMatrix4(m));
};

const chestGeo = (pos: V3, yaw: number) => {
  const geos: THREE.BufferGeometry[] = [];
  const GOLDC = "#FFC21A";
  geos.push(place(rbox(2.0, 1.1, 1.3, 0.1), "#9A5B2F", [0, 0.45, 0]));
  for (const x of [-0.75, 0.75]) geos.push(place(rbox(0.16, 1.14, 1.34, 0.04), GOLDC, [x, 0.45, 0]));
  // Lid ajar (hinged at the back), coins inside and spilled.
  const lid = new THREE.CylinderGeometry(0.65, 0.65, 2.0, 12, 1, false, 0, Math.PI);
  lid.rotateZ(Math.PI / 2);
  lid.rotateX(-Math.PI / 2);
  geos.push(place(lid, "#8A4F28", [0, 1.0, -0.65], [-0.55, 0, 0]));
  geos.push(place(rbox(1.7, 0.25, 1.0, 0.1), GOLDC, [0, 1.0, 0.0]));
  geos.push(place(rbox(0.3, 0.3, 0.1, 0.03), GOLDC, [0, 0.75, 0.68]));
  const rnd = mulberry(77);
  for (let i = 0; i < 9; i++) geos.push(place(cyl(0.16, 0.16, 0.05, 10), GOLDC, [(rnd() - 0.5) * 2.4, 0.03, 0.9 + rnd() * 1.2], [rnd() * 0.3, 0, rnd() * 0.3]));
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.05, yaw, -0.08)), new THREE.Vector3(1, 1, 1));
  return geos.map((g) => g.applyMatrix4(m));
};

const seabedPropsGeometry = () => {
  const rnd = mulberry(9090);
  const geos: THREE.BufferGeometry[] = [];
  const at = (x: number, z: number): V3 => [x, coastBedY(x, z), z];
  // Keep Nubi's walk and the playa sight lines (PLAYA_CAM and PLAYA_WIDE to SHIP_NUBI) clear.
  const seg = (x: number, z: number, a: V3, b: V3) => {
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const k = clamp01(((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz));
    return Math.hypot(x - a[0] - dx * k, z - a[2] - dz * k);
  };
  const clear = (x: number, z: number) =>
    (Math.abs(x + (z + 14) * 0.15) < 4.5 && z < -12 && z > -50) || seg(x, z, PLAYA_WIDE, SHIP_NUBI) < 5.5 || seg(x, z, PLAYA_CAM, SHIP_NUBI) < 4;
  const rocks = ["#B7A188", "#A08B74", "#C9B396", "#8F7C69"];
  for (let i = 0; i < 260; i++) {
    const near = i < 120;
    const x = near ? (rnd() - 0.5) * 80 : (rnd() - 0.5) * 300;
    const z = near ? -60 + rnd() * 70 : -230 + rnd() * 240;
    if (coastBedY(x, z) > -1.2 || clear(x, z)) continue;
    if (Math.hypot(x - 8, z + 58) < 40 && Math.abs(z + 58) < 10) continue;
    const s = 0.4 + rnd() * (near ? 1.4 : 3.5);
    geos.push(place(new THREE.DodecahedronGeometry(1, 0), rocks[Math.floor(rnd() * rocks.length)], at(x, z), [rnd() * 3, rnd() * 3, rnd() * 3], [s * 1.2, s * 0.65, s]));
  }
  const shellCols = ["#FFC4D6", "#FFE8C2", "#FFB59E", "#F7D7FF", "#FFFFFF"];
  for (let i = 0; i < 70; i++) {
    const x = (rnd() - 0.5) * 50;
    const z = -48 + rnd() * 44;
    if (coastBedY(x, z) > -1 || seg(x, z, PLAYA_WIDE, SHIP_NUBI) < 3) continue;
    const c = shellCols[Math.floor(rnd() * shellCols.length)];
    if (i % 5 === 0) geos.push(starfish(at(x, z), rnd() * 6, 0.9 + rnd() * 0.6, i % 2 ? "#FF7A3D" : "#FF5C8A"));
    else if (i % 5 === 1) geos.push(place(new THREE.ConeGeometry(0.22, 0.75, 7), c, [x, coastBedY(x, z) + 0.2, z], [Math.PI / 2, rnd() * 6, 0.3]));
    else geos.push(shell(at(x, z), rnd() * 6, 0.8 + rnd() * 0.7, c));
  }
  const coralCols = ["#FF7F8E", "#FF9F5A", "#C987FF", "#FF6FB5"];
  for (let i = 0; i < 26; i++) {
    const x = (rnd() - 0.5) * 70;
    const z = -55 + rnd() * 50;
    if (coastBedY(x, z) > -2 || clear(x, z)) continue;
    geos.push(...coral(rnd, at(x, z), 0.8 + rnd() * 0.9, coralCols[i % coralCols.length]));
  }
  for (let i = 0; i < 30; i++) {
    const x = (rnd() - 0.5) * 70;
    const z = -55 + rnd() * 52;
    if (coastBedY(x, z) > -1.5 || clear(x, z)) continue;
    geos.push(...seaweed(rnd, at(x, z), 0.9 + rnd() * 0.8));
  }
  SEABED_PROPS.fish.forEach((p, i) => geos.push(...fishSkeleton(at(p[0], p[2]), i * 2.1 + 0.4, 1.1 + i * 0.25)));
  geos.push(...anchorGeo(at(SEABED_PROPS.anchor[0], SEABED_PROPS.anchor[2]), 0.7, 1));
  geos.push(...chestGeo(at(SEABED_PROPS.chest[0], SEABED_PROPS.chest[2]), 0.5));
  return mergeAll(geos);
};

// =======================================================================================
// Heat shimmer

const SHIMMER_FS = /* glsl */ `
uniform float uTime;
uniform float uAmount;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float y = vUv.y;
  float x = vUv.x;
  float w = sin(x * 34.0 + uTime * 3.0 + sin(y * 23.0 - uTime * 4.0) * 1.6);
  float bands = smoothstep(0.55, 1.0, sin(y * 46.0 + w * 1.3 - uTime * 7.0));
  float fade = smoothstep(0.0, 0.3, y) * smoothstep(1.0, 0.5, y) * smoothstep(0.0, 0.15, x) * smoothstep(1.0, 0.85, x);
  gl_FragColor = vec4(uColor, bands * fade * uAmount * 0.32);
  #include <colorspace_fragment>
}`;

/**
 * Heat shimmer: an upright plane (`width` × `height`, base at y = 0, facing +z) of wavy light
 * streaks rising with `t`. Additive; place it between the camera and the hot ground, facing the
 * camera. `amount` 0..1.
 */
export const HeatShimmer: React.FC<{ t: number; amount?: number; width?: number; height?: number; position?: V3; rotationY?: number }> = ({
  t,
  amount = 1,
  width = 60,
  height = 8,
  position = [0, 0, 0],
  rotationY = 0,
}) => {
  const mat = useMemo(
    () =>
      additive(
        new THREE.ShaderMaterial({
          uniforms: { uTime: { value: 0 }, uAmount: { value: 1 }, uColor: { value: new THREE.Color("#FFF2CF") } },
          vertexShader: "varying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
          fragmentShader: SHIMMER_FS,
        }),
      ),
    [],
  );
  if (amount <= 0.01) return null;
  mat.uniforms.uTime.value = t;
  mat.uniforms.uAmount.value = amount;
  return (
    <mesh position={[position[0], position[1] + height / 2, position[2]]} rotation={[0, rotationY, 0]} material={mat} renderOrder={6}>
      <planeGeometry args={[width, height]} />
    </mesh>
  );
};

// =======================================================================================
// Coast

/** Sun high and hot: warm key from above, sky-blue fill, sand bounce. */
export const CoastLights: React.FC<{ k?: number }> = ({ k = 1 }) => (
  <>
    <hemisphereLight args={["#DDF0FF", "#D2A96E", 1.35 * k]} />
    <directionalLight position={[-25, 80, 40]} intensity={2.5 * k} color="#FFF0D2" />
    <directionalLight position={[30, 20, -60]} intensity={0.55 * k} color="#FFD7A0" />
  </>
);

/**
 * The bay. `water` 1 = full sea (sea level 0) … 0 = gone: the sea surface (toon waves, foam lines
 * along the waterline) sinks to coastLevel(water), the newly exposed seabed is dark and wet, and
 * near 0 it dries into a pale cracked desert. `rush` 0..1 adds foam streaks racing out to sea
 * (use while it drains). Boats float on the surface and settle tilted onto the seabed (boats =
 * false hides them). `fog` = [near, far] of the haze (scene fog in COAST_HAZE): ≈ [80, 520] for the
 * aerial view, [50, 300] down on the seabed.
 */
export const Coast: React.FC<{ water?: number; t?: number; rush?: number; fog?: [number, number]; boats?: boolean }> = ({
  water = 1,
  t = 0,
  rush = 0,
  fog = [80, 520],
  boats = true,
}) => {
  const geos = useMemo(
    () => ({
      terrain: coastTerrain(),
      water: waterGeometry(),
      town: townGeometry(),
      pier: pierGeometry(),
      lighthouse: lighthouseGeometry(),
      props: seabedPropsGeometry(),
    }),
    [],
  );
  const ground = useMemo(() => makeGround(true, 0.05), []);
  const waterMat = useMemo(() => makeWaterMaterial(), []);
  const w = clamp01(water);
  const level = coastLevel(w);
  ground.uniforms.uWet.value = smoothstep(0, 0.3, w);
  ground.uniforms.uDry.value = smoothstep(0.3, 0, w);
  waterMat.uniforms.uLevel.value = level;
  waterMat.uniforms.uTime.value = t;
  waterMat.uniforms.uRush.value = rush;
  const lamp: V3 = [LIGHTHOUSE_AT[0], LIGHTHOUSE_AT[1] + 16.4, LIGHTHOUSE_AT[2]];
  return (
    <group>
      <SceneFog color={COAST_HAZE} near={fog[0]} far={fog[1]} />
      <mesh geometry={geos.terrain} material={ground.material} />
      {w > 0.001 ? <mesh geometry={geos.water} material={waterMat} /> : null}
      <mesh geometry={geos.props} material={vertexMat(0.6, false, 0.15)} />
      <mesh geometry={geos.town} material={vertexMat(0.55, false, 0.16)} />
      <mesh geometry={geos.pier} material={vertexMat(0.7, false, 0.14)} />
      <mesh geometry={geos.lighthouse} material={vertexMat(0.4, false, 0.16)} />
      <Glow color="#FFE68A" size={7} opacity={0.75} position={lamp} />
      {boats ? COAST_BOATS.map((b) => <Boat key={b.seed} spec={b} level={level} t={t} />) : null}
    </group>
  );
};

// =======================================================================================
// Giant ship

/** Liner dimensions (model units = world units): keel origin, bow towards +x, heels towards +z. */
export const SHIP = { length: 72, beam: 14, hull: 13, top: 31, maxHeel: 0.52 };

const halfBeam = (x: number, y: number) => (SHIP.beam / 2) * hullShape(x / SHIP.length + 0.5, y / SHIP.hull, 0.3);

/** Ship-frame point → world (ship at `pos`, heeled by `heel` around the keel line). */
const shipToWorld = (pos: V3, heel: number, p: V3): V3 => {
  const c = Math.cos(heel);
  const s = Math.sin(heel);
  return [pos[0] + p[0], pos[1] + p[1] * c - p[2] * s, pos[2] + p[1] * s + p[2] * c];
};

const shipGeometry = () => {
  const rnd = mulberry(4242);
  const geos: THREE.BufferGeometry[] = [];
  const { length: L, beam: B, hull: H } = SHIP;
  const NAVY = "#1E3A6B";
  const WHITE = "#FFFFFF";
  geos.push(
    hullGeo(L, B, H, (yn, top) => (top ? "#C9A57C" : yn < 0.3 ? "#C9402F" : yn < 0.34 ? "#FFFFFF" : yn > 0.93 ? "#FFFFFF" : NAVY), 0.3, 0.12, 10),
  );
  // Portholes and rust streaks on both flanks.
  for (const side of [-1, 1]) {
    for (let row = 0; row < 2; row++) {
      const y = H * (0.6 + row * 0.16);
      for (let i = 0; i < 18; i++) {
        const x = -L / 2 + 8 + i * 3.1 + row * 1.5;
        if (x > L / 2 - 9) continue;
        const z = side * (halfBeam(x, y) + 0.04);
        geos.push(place(cyl(0.5, 0.5, 0.18, 14), "#F2F2F2", [x, y, z], [Math.PI / 2, 0, 0]));
        geos.push(place(cyl(0.34, 0.34, 0.2, 14), "#9FD8FF", [x, y, z + side * 0.03], [Math.PI / 2, 0, 0]));
        if (rnd() < 0.45) {
          const len = 1.2 + rnd() * 3.2;
          geos.push(place(rbox(0.22 + rnd() * 0.15, len, 0.06, 0.03), rnd() < 0.5 ? "#B8652E" : "#9C5226", [x + (rnd() - 0.5) * 0.2, y - 0.55 - len / 2, side * (halfBeam(x, y - len / 2) + 0.05)]));
        }
      }
    }
    // Long rust runs from the deck edge.
    for (let i = 0; i < 9; i++) {
      const x = -L / 2 + 6 + rnd() * (L - 14);
      const len = 2 + rnd() * 4;
      geos.push(place(rbox(0.3, len, 0.06, 0.03), "#A9592A", [x, H * 0.9 - len / 2, side * (halfBeam(x, H * 0.85) + 0.06)]));
    }
    // Hawse pipe ring at the bow.
    geos.push(place(new THREE.TorusGeometry(0.6, 0.18, 8, 14), "#2A2F38", [L / 2 - 8, H * 0.8, side * (halfBeam(L / 2 - 8, H * 0.8) + 0.05)], [0, 0, 0]));
    // Rails along the deck edge.
    for (let x = -L / 2 + 3; x < L / 2 - 4; x += 2.5) {
      const z = side * (halfBeam(x, H) - 0.25);
      geos.push(rod([x, H + 0.05, z], [x, H + 1.1, z], 0.06, WHITE, 5));
    }
    for (let x = -L / 2 + 3; x < L / 2 - 6.5; x += 5) {
      geos.push(rod([x, H + 1.1, side * (halfBeam(x, H) - 0.25)], [x + 5, H + 1.1, side * (halfBeam(x + 5, H) - 0.25)], 0.07, WHITE, 5));
    }
  }
  // Superstructure: four white tiers with window bands, lifeboats, funnel, masts.
  const tiers = [
    { x0: -26, x1: 12, b: B * 0.86, h: 2.8 },
    { x0: -24, x1: 10, b: B * 0.8, h: 2.6 },
    { x0: -20, x1: 8, b: B * 0.74, h: 2.6 },
    { x0: -2, x1: 9, b: B * 0.86, h: 2.4 },
  ];
  let y0 = H;
  for (const tier of tiers) {
    const cx = (tier.x0 + tier.x1) / 2;
    const len = tier.x1 - tier.x0;
    geos.push(place(rbox(len, tier.h, tier.b, 0.35), WHITE, [cx, y0 + tier.h / 2, 0]));
    for (const side of [-1, 1]) geos.push(place(rbox(len - 1.5, 0.75, 0.08, 0.03), "#2B5C93", [cx, y0 + tier.h * 0.58, side * (tier.b / 2 + 0.02)]));
    geos.push(place(rbox(0.08, 0.9, tier.b - 1.2, 0.03), "#2B5C93", [tier.x1 + 0.02, y0 + tier.h * 0.58, 0]));
    y0 += tier.h;
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const x = -22 + i * 6.5;
      const z = side * (B * 0.43 + 0.5);
      geos.push(place(new THREE.CapsuleGeometry(0.6, 3.2, 4, 10), "#FF7A1A", [x, H + 3.4, z], [0, 0, Math.PI / 2]));
      geos.push(place(rbox(3.4, 0.3, 1.0, 0.1), "#FFFFFF", [x, H + 3.95, z]));
    }
  }
  const ftop = H + 2.8 + 2.6 + 2.6;
  geos.push(place(cyl(2.0, 2.3, 6, 18), "#E23B2E", [-13, ftop + 3, 0], [0, 0, 0.12], [1.5, 1, 1]));
  geos.push(place(cyl(2.02, 2.05, 1.4, 18), "#1E1E24", [-12.65, ftop + 6.2, 0], [0, 0, 0.12], [1.5, 1, 1]));
  geos.push(place(cyl(2.15, 2.2, 0.6, 18), "#FFFFFF", [-13.1, ftop + 2.2, 0], [0, 0, 0.12], [1.5, 1, 1]));
  geos.push(rod([3, ftop + 2.4, 0], [3, ftop + 7, 0], 0.18, WHITE));
  geos.push(place(rbox(2.6, 0.3, 0.5, 0.1), "#E8E8E8", [3, ftop + 6.2, 0]));
  geos.push(rod([L / 2 - 6, H, 0], [L / 2 - 6, H + 7, 0], 0.2, "#F2F2F2"));
  // Containers on the foredeck (some slid to the low side).
  const boxCols = ["#E8443A", "#2F7BEA", "#F7B32B", "#2CB37A", "#9B6BE0", "#FF7A1A"];
  let k = 0;
  for (let x = 15; x < 28; x += 6.4)
    for (const z of [-3, 0, 3])
      for (let lvl = 0; lvl < (z === 0 ? 2 : 1); lvl++) {
        const c = boxCols[k++ % boxCols.length];
        geos.push(place(rbox(6, 2.5, 2.5, 0.12), c, [x, H + 1.25 + lvl * 2.5, z + 0.6]));
      }
  return mergeAll(geos);
};

/** Soft round shadow texture (shared). */
const blobTexture = () =>
  canvasTexture("agua-blob", 128, 128, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.5, "rgba(0,0,0,0.7)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });

/**
 * A huge liner stranded on the seabed (place the group at its keel centre on the ground: SHIP_SPOT
 * on the Coast). `tilt` 0 = upright … 1 = heeled SHIP.maxHeel (≈ 30°) over towards +z, where its
 * flank, deck rail and superstructure overhang the ground (≈ 7 / 17-28 above it at SHIP_NUBI).
 * `creak` 0..1 = a slow creaking sway with little shudders; `sand` 0..1 = sand trickling off the
 * low rail in thin streams (`t` seconds). Its anchor chain hangs from the bow to an anchor on the
 * ground; a big soft shadow lies under the overhang; two containers have slid off onto the sand.
 * Hull: dark navy with portholes and rust streaks, red bottom, white decks, red funnel.
 * `float` > 0 lifts the hull off the ground by that many units (afloat, no chain/sand/shadow).
 */
export const GiantShip: React.FC<{ tilt?: number; creak?: number; t?: number; sand?: number; position?: V3; float?: number }> = ({
  tilt = 1,
  creak = 0,
  t = 0,
  sand = 1,
  position = [0, 0, 0],
  float = 0,
}) => {
  const geo = useMemo(() => shipGeometry(), []);
  const linkGeo = useMemo(() => new THREE.TorusGeometry(0.36, 0.11, 6, 12), []);
  const grainGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 0), []);
  const chainRef = useRef<THREE.InstancedMesh>(null);
  const sandRef = useRef<THREE.InstancedMesh>(null);
  const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.32, color: "#3A2A1A" }), []);
  const sway = creak * (0.012 * Math.sin(t * 0.9) + 0.004 * Math.sin(t * 6.3) * Math.max(0, Math.sin(t * 0.45)));
  const heel = clamp01(tilt) * SHIP.maxHeel + sway;
  const pos: V3 = [position[0], position[1] - 1.6 * clamp01(tilt) + float, position[2]];
  const grounded = float <= 0.01;
  const LINKS = 46;
  const STREAMS = 5;
  const GRAINS = 16;
  const streams = useMemo(() => {
    const out: { x: number; seed: number }[] = [];
    for (let i = 0; i < STREAMS; i++) out.push({ x: -25 + i * 11.3 + (i % 2) * 2.1, seed: i * 0.37 });
    return out;
  }, []);
  const sandK = clamp01(sand) * smoothstep(0.35, 0.85, tilt);
  // Hawse (bow, +z side) and the anchor on the ground in front of it.
  const hx = SHIP.length / 2 - 8;
  const hawse = shipToWorld(pos, heel, [hx, SHIP.hull * 0.8, halfBeam(hx, SHIP.hull * 0.8) + 0.3]);
  const groundY = position[1];
  const anchorAt: V3 = [hawse[0] + 3, groundY, hawse[2] + 5];
  const sources = streams.map((s) => shipToWorld(pos, heel, [s.x, SHIP.hull + 0.2, halfBeam(s.x, SHIP.hull) - 0.1]));

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const chain = chainRef.current;
    if (chain) {
      // Hanging curve from the hawse down to the anchor ring, lying on the ground where it reaches it.
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++) {
        const s = i / 40;
        const x = lerp(hawse[0], anchorAt[0], s);
        const z = lerp(hawse[2], anchorAt[2], s);
        const y = Math.max(groundY + 0.15, lerp(hawse[1], anchorAt[1], s) - 9 * s * (1 - s) - (hawse[1] - groundY) * 0.35 * Math.sin(s * Math.PI));
        pts.push(new THREE.Vector3(x, y, z));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const len = curve.getLength();
      const n = Math.min(LINKS, Math.floor(len / 0.62));
      for (let i = 0; i < LINKS; i++) {
        if (!grounded || i >= n) {
          m.makeScale(0, 0, 0);
        } else {
          const u = i / Math.max(1, n - 1);
          const p = curve.getPointAt(u);
          const tan = curve.getTangentAt(u);
          q.setFromUnitVectors(up, tan);
          const twist = new THREE.Quaternion().setFromAxisAngle(tan, (i % 2) * Math.PI * 0.5);
          q.premultiply(twist);
          // Torus lies in its xy plane: turn it so the link's long axis follows the chain.
          const toLink = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
          q.multiply(toLink);
          sc.set(0.75, 1.25, 1);
          m.compose(p, q, sc);
        }
        chain.setMatrixAt(i, m);
      }
      chain.instanceMatrix.needsUpdate = true;
    }
    const grains = sandRef.current;
    if (grains) {
      let k = 0;
      for (let si = 0; si < STREAMS; si++) {
        const src = sources[si];
        const drop = Math.max(0.5, src[1] - groundY);
        for (let g = 0; g < GRAINS; g++) {
          const ph = (((t * 0.55 + g / GRAINS + streams[si].seed) % 1) + 1) % 1;
          const on = grounded && sandK > 0.02;
          v.set(src[0] + Math.sin(g * 7.1 + si) * 0.25 * ph, src[1] - drop * ph * ph, src[2] + 0.4 * ph + Math.cos(g * 3.3) * 0.2 * ph);
          const s = on ? (0.1 + (0.08 * ((g * 37) % 5)) / 5) * sandK * (1 + ph * 0.8) : 0;
          sc.set(s, s * 1.6, s);
          m.compose(v, q.identity(), sc);
          grains.setMatrixAt(k++, m);
        }
      }
      grains.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <group position={pos} rotation={[heel, 0, 0]}>
        <mesh geometry={geo} material={vertexMat(0.5, false, 0.15)} />
      </group>
      {grounded ? (
        <>
          <mesh material={shadowMat} position={[position[0], groundY + 0.06, position[2] + 9 + 6 * clamp01(tilt)]} rotation={[-Math.PI / 2, 0, 0]} scale={[SHIP.length * 1.15, 26, 1]} renderOrder={1}>
            <planeGeometry args={[1, 1]} />
          </mesh>
          <instancedMesh ref={chainRef} args={[linkGeo, toy("#3B4350", { metal: 0.3, rough: 0.5, glow: 0.08 }), LINKS]} frustumCulled={false} />
          <group position={anchorAt} rotation={[0, 0.6, 0]}>
            <AnchorMesh />
          </group>
          <instancedMesh ref={sandRef} args={[grainGeo, toy("#E9C98E", { glow: 0.2, flat: true }), STREAMS * GRAINS]} frustumCulled={false} />
          {sandK > 0.02
            ? sources.map((src, i) => {
                const drop = Math.max(0.5, src[1] - groundY);
                return (
                  <group key={i}>
                    <mesh position={[src[0], src[1] - drop / 2, src[2] + 0.2]} material={sandStreamMat(sandK)}>
                      <cylinderGeometry args={[0.04, 0.16, drop, 6, 1, true]} />
                    </mesh>
                    <mesh position={[src[0], groundY, src[2] + 0.4]} material={toy("#E4C188", { glow: 0.18 })} scale={[1, 0.4 * sandK, 1]}>
                      <coneGeometry args={[1.1, 1, 12]} />
                    </mesh>
                  </group>
                );
              })
            : null}
          {/* Two containers that slid off the deck. */}
          <mesh geometry={containerGeo()} material={toy("#2F7BEA", { rough: 0.5 })} position={[position[0] + 22, groundY + 1.0, position[2] + 17]} rotation={[0.1, 0.5, 0.25]} />
          <mesh geometry={containerGeo()} material={toy("#F7B32B", { rough: 0.5 })} position={[position[0] + 30, groundY + 1.1, position[2] + 13]} rotation={[0, -0.3, 1.45]} />
        </>
      ) : null}
    </group>
  );
};

let containerCache: THREE.BufferGeometry | null = null;
const containerGeo = () => (containerCache ??= new RoundedBoxGeometry(6, 2.5, 2.5, 2, 0.12));

const streamMats = new Map<number, THREE.MeshStandardMaterial>();
const sandStreamMat = (amount: number) => {
  const key = Math.round(clamp01(amount) * 20);
  let m = streamMats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: "#F0D6A0", emissive: new THREE.Color("#F0D6A0"), emissiveIntensity: 0.35, transparent: true, opacity: 0.5 * (key / 20), depthWrite: false, side: THREE.DoubleSide });
    streamMats.set(key, m);
  }
  return m;
};

let anchorCache: THREE.BufferGeometry | null = null;
const AnchorMesh: React.FC = () => {
  const geo = (anchorCache ??= mergeAll(anchorGeo([0, 0, 0], 0, 1.3)));
  return <mesh geometry={geo} material={vertexMat(0.5, false, 0.12, 0.3)} />;
};

// =======================================================================================
// Farmland

export const FARM_HAZE = "#E9EEDB";
/** Suggested sky for the fields (drone shots look down; horizon near the top third). */
export const FARM_SKY = "linear-gradient(180deg, #3B8FE0 0%, #78BDF0 22%, #C9E6F2 36%, #E9EEDB 44%, #E9EEDB 100%)";
/** Plots (x/z ranges), channel half width and the farm buildings. */
export const FARM = { plot: 34, gap: 2, channel: 1.3, road: 44, barn: [-54, 0, -10] as V3, silo: [-54, 0, 4] as V3, tower: [53, 0, -22] as V3, windmill: [54, 0, 24] as V3 };

const CROP_VS_HEAD = /* glsl */ `
attribute vec3 aBase;
attribute float aRand;
attribute float aH;
uniform float uWilt;
uniform float uTime;
uniform float uDroop;
uniform float uShrink;
uniform vec3 uDry1;
uniform vec3 uDry2;
`;

const CROP_VS_BODY = /* glsl */ `
#include <begin_vertex>
{
  float wk = clamp(uWilt * 1.45 - aRand * 0.45, 0.0, 1.0);
  vec3 rel = transformed - aBase;
  float hk = clamp(rel.y / aH, 0.0, 1.2);
  float ang = aRand * 6.2831;
  vec2 dir = vec2(cos(ang), sin(ang));
  float bend = wk * uDroop * pow(hk, 1.4);
  float c = cos(bend);
  float s = sin(bend);
  float hor = dot(rel.xz, dir);
  float ny = rel.y * c - hor * s;
  float nh = rel.y * s + hor * c;
  rel.xz += dir * (nh - hor);
  rel.y = ny * (1.0 - 0.22 * wk);
  rel *= 1.0 - uShrink * wk;
  rel.xz += vec2(dir.y, -dir.x) * sin(uTime * 2.3 + aRand * 20.0 + aBase.x * 0.3) * 0.07 * hk * (1.0 - wk);
  transformed = aBase + rel;
#ifdef USE_COLOR
  float l = dot(vColor.rgb, vec3(0.3, 0.55, 0.15));
  vec3 dry = mix(uDry1 * (0.8 + 0.4 * l), uDry2 * (0.85 + 0.35 * l), smoothstep(0.5, 1.0, wk));
  vColor.rgb = mix(vColor.rgb, dry, smoothstep(0.08, 0.6, wk));
#endif
}
`;

const makeCropMaterial = (droop: number, shrink: number) => {
  const uniforms = {
    uWilt: { value: 0 },
    uTime: { value: 0 },
    uDroop: { value: droop },
    uShrink: { value: shrink },
    uDry1: { value: new THREE.Color("#F2D35A") },
    uDry2: { value: new THREE.Color("#C29A5C") },
  };
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.15 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\n" + CROP_VS_HEAD).replace("#include <begin_vertex>", CROP_VS_BODY);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      "#include <emissivemap_fragment>\n#ifdef USE_COLOR\n\ttotalEmissiveRadiance *= vColor.rgb;\n#endif",
    );
  };
  material.customProgramCacheKey = () => "agua-crop";
  return { material, uniforms };
};

/** Tags a plant's parts with its base, random and height (for the wilt shader). */
const plantGeo = (parts: THREE.BufferGeometry[], base: V3, r: number, h: number) => {
  const g = mergeAll(parts);
  const n = g.attributes.position.count;
  const b = new Float32Array(n * 3);
  const rr = new Float32Array(n);
  const hh = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    b[i * 3] = base[0];
    b[i * 3 + 1] = base[1];
    b[i * 3 + 2] = base[2];
    rr[i] = r;
    hh[i] = h;
  }
  g.setAttribute("aBase", new THREE.BufferAttribute(b, 3));
  g.setAttribute("aRand", new THREE.BufferAttribute(rr, 1));
  g.setAttribute("aH", new THREE.BufferAttribute(hh, 1));
  return g;
};

/** A leaf ribbon: length along +x, arching down, at `pos` turned by `yaw`, tilted up by `lift`. */
const leaf = (len: number, wid: number, color: string, pos: V3, yaw: number, lift: number, arch = 0.35) => {
  const g = new THREE.PlaneGeometry(len, wid, 4, 1);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / len + 0.5;
    p.setX(i, u * len);
    p.setZ(i, p.getZ(i) * Math.sin(Math.min(1, u * 1.2) * Math.PI) * 1.1);
    p.setY(i, -arch * len * u * u);
  }
  g.computeVertexNormals();
  return place(g, color, pos, [0, yaw, lift]);
};

const cornPlant = (rnd: () => number, x: number, z: number) => {
  const H = 2.8 + rnd() * 0.6;
  const parts: THREE.BufferGeometry[] = [];
  parts.push(place(cyl(0.07, 0.12, H, 5), "#5DBB46", [x, H / 2, z]));
  for (let i = 0; i < 5; i++) {
    const y = H * (0.25 + i * 0.14);
    parts.push(leaf(1.5 - i * 0.12, 0.26, i % 2 ? "#4FAE3E" : "#6CCB52", [x, y, z], rnd() * 6.28, 0.7, 0.3));
  }
  const cy = H * 0.55;
  parts.push(place(new THREE.CapsuleGeometry(0.13, 0.45, 2, 6), "#FFD54A", [x + 0.18, cy, z], [0, 0, -0.45]));
  parts.push(place(new THREE.ConeGeometry(0.16, 0.6, 5), "#7CCB55", [x + 0.12, cy - 0.15, z], [0, 0, -0.45 + Math.PI]));
  for (let i = 0; i < 3; i++) parts.push(place(new THREE.ConeGeometry(0.04, 0.5, 3), "#E8C77A", [x, H + 0.15, z], [0.4 * Math.cos(i * 2.1), 0, 0.4 * Math.sin(i * 2.1)]));
  return plantGeo(parts, [x, 0, z], rnd(), H);
};

const wheatTuft = (rnd: () => number, x: number, z: number) => {
  const H = 1.1 + rnd() * 0.35;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rnd();
    const tl = 0.12 + rnd() * 0.12;
    const top: V3 = [x + Math.cos(a) * tl * H, H * (0.85 + rnd() * 0.2), z + Math.sin(a) * tl * H];
    parts.push(rod([x, 0, z], top, 0.03, "#7FC453", 3));
    parts.push(place(new THREE.CapsuleGeometry(0.06, 0.28, 2, 4), "#BFD86A", [top[0], top[1] + 0.16, top[2]], [Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2]));
  }
  return plantGeo(parts, [x, 0, z], rnd(), H);
};

const lettuce = (rnd: () => number, x: number, z: number) => {
  const parts: THREE.BufferGeometry[] = [];
  const s = 0.55 + rnd() * 0.15;
  parts.push(place(new THREE.IcosahedronGeometry(s, 1), "#B5EE7A", [x, s * 0.7, z], [0, rnd() * 3, 0], [1, 0.8, 1]));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd() * 0.5;
    parts.push(place(new THREE.SphereGeometry(s * 0.7, 7, 5), i % 2 ? "#5DBF4B" : "#74D05A", [x + Math.cos(a) * s * 0.7, s * 0.35, z + Math.sin(a) * s * 0.7], [0.5 * Math.sin(a), a, 0.5 * Math.cos(a)], [1, 0.45, 0.8]));
  }
  return plantGeo(parts, [x, 0, z], rnd(), s * 1.3);
};

const sunflower = (rnd: () => number, x: number, z: number) => {
  const H = 3.0 + rnd() * 0.6;
  const parts: THREE.BufferGeometry[] = [];
  parts.push(place(cyl(0.08, 0.13, H, 6), "#5AAE3E", [x, H / 2, z]));
  for (let i = 0; i < 2; i++) parts.push(place(new THREE.SphereGeometry(0.42, 7, 5), "#4FA63B", [x + (i ? -0.45 : 0.45), H * (0.4 + i * 0.18), z], [0, 0, i ? 0.5 : -0.5], [1, 0.18, 0.7]));
  const head = new THREE.Group();
  void head;
  const hy = H + 0.1;
  const tiltX = -0.35;
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, hy, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + tiltX, 0, 0)), new THREE.Vector3(1, 1, 1));
  const disc = place(cyl(0.45, 0.45, 0.18, 14), "#6B3F1F", [0, 0, 0]);
  parts.push(disc.applyMatrix4(m));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const pet = place(new THREE.SphereGeometry(0.3, 6, 4), i % 2 ? "#FFC928" : "#FFD84D", [Math.cos(a) * 0.66, 0.02, Math.sin(a) * 0.66], [0, -a, 0], [1, 0.25, 0.42]);
    parts.push(pet.applyMatrix4(m));
  }
  return plantGeo(parts, [x, 0, z], rnd(), H);
};

const treeGeo = (rnd: () => number, x: number, z: number) => {
  const H = 4 + rnd() * 2;
  const parts: THREE.BufferGeometry[] = [];
  parts.push(place(cyl(0.25, 0.4, H * 0.55, 7), "#8A5A36", [x, H * 0.27, z]));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + rnd();
    const r = 1.4 + rnd() * 0.6;
    parts.push(place(new THREE.IcosahedronGeometry(r, 1), i % 2 ? "#4CB050" : "#5FC25C", [x + Math.cos(a) * 0.8, H * 0.62 + rnd() * 1.2, z + Math.sin(a) * 0.8]));
  }
  return plantGeo(parts, [x, 0, z], rnd(), H);
};

const farmGroundY = (x: number, z: number) => {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  let y = 0;
  if (ax < FARM.road && az < FARM.road) {
    if (az < FARM.channel && ax < FARM.road - 1) y = -0.65;
    if (ax < FARM.channel && az < FARM.road - 1) y = -0.65;
  }
  const r = Math.max(ax, az);
  y += smoothstep(62, 150, r) * (6 + 10 * (0.5 + 0.5 * fbm(x * 0.012 + 3, z * 0.012 - 2)));
  y += smoothstep(50, 70, r) * 0.8 * fbm(x * 0.05, z * 0.05);
  return y;
};

const SOIL = { a: "#9A6A44", b: "#86593A", road: "#DCC08E", grass: "#7CC860", grass2: "#6DBA55" };

const farmGround = (size: number, segs: number, inner: boolean) => {
  const g = new THREE.PlaneGeometry(size, size, segs, segs);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const grass = new Float32Array(p.count);
  const c = new THREE.Color();
  const soilA = new THREE.Color(SOIL.a);
  const soilB = new THREE.Color(SOIL.b);
  const road = new THREE.Color(SOIL.road);
  const gA = new THREE.Color(SOIL.grass);
  const gB = new THREE.Color(SOIL.grass2);
  const mud = new THREE.Color("#6E4A30");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const ax = Math.abs(x);
    const az = Math.abs(z);
    let y = farmGroundY(x, z);
    if (!inner && ax < 60 && az < 60) y -= 0.3;
    p.setY(i, y);
    let gr = 0;
    const inPlots = ax < FARM.plot + FARM.gap && az < FARM.plot + FARM.gap;
    if (inPlots) {
      // Furrows: rows along z on the x < 0 / x > 0 corn & sunflower plots, along x on the others.
      const alongZ = (x < 0 && z < 0) || (x > 0 && z > 0);
      const v = alongZ ? x : z;
      c.copy(soilA).lerp(soilB, 0.5 + 0.5 * Math.sin(v * 2.0));
      if (az < FARM.channel + 0.4 || ax < FARM.channel + 0.4) c.copy(mud);
    } else if (ax < FARM.road && az < FARM.road) {
      c.copy(road);
      if (az < FARM.channel + 0.4 || ax < FARM.channel + 0.4) c.copy(mud);
    } else {
      c.copy(gA).lerp(gB, clamp01(0.5 + fbm(x * 0.06, z * 0.06)));
      gr = 1;
    }
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
    grass[i] = gr;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aGrass", new THREE.BufferAttribute(grass, 1));
  g.deleteAttribute("uv");
  g.computeVertexNormals();
  return g;
};

const cropsGeometry = () => {
  const rnd = mulberry(3131);
  const P = FARM.plot;
  const G = FARM.gap;
  const corn: THREE.BufferGeometry[] = [];
  const wheat: THREE.BufferGeometry[] = [];
  const lett: THREE.BufferGeometry[] = [];
  const sun: THREE.BufferGeometry[] = [];
  // Corn: x < 0, z < 0 (rows along z). Sunflowers: x > 0, z > 0 (rows along z).
  for (let x = -P - G + 2; x < -G - 1; x += 3.2) for (let z = -P - G + 1.5; z < -G - 1; z += 2.3) corn.push(cornPlant(rnd, x + (rnd() - 0.5) * 0.3, z));
  for (let x = G + 2; x < P + G - 1; x += 3.4) for (let z = G + 1.6; z < P + G - 1; z += 2.6) sun.push(sunflower(rnd, x + (rnd() - 0.5) * 0.3, z));
  // Wheat: x > 0, z < 0 (rows along x). Lettuce: x < 0, z > 0 (rows along x).
  for (let z = -P - G + 1.5; z < -G - 0.8; z += 1.7) for (let x = G + 1.2; x < P + G - 0.8; x += 1.35) wheat.push(wheatTuft(rnd, x, z + (rnd() - 0.5) * 0.3));
  for (let z = G + 1.8; z < P + G - 1; z += 2.6) for (let x = -P - G + 1.8; x < -G - 1; x += 2.2) lett.push(lettuce(rnd, x, z));
  const trees: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + rnd() * 0.15;
    const r = 52 + rnd() * 18;
    const x = Math.cos(a) * r * 1.05;
    const z = Math.sin(a) * r;
    if (Math.hypot(x - FARM.barn[0], z - FARM.barn[2]) < 14 || Math.hypot(x - FARM.tower[0], z - FARM.tower[2]) < 9 || Math.hypot(x - FARM.windmill[0], z - FARM.windmill[2]) < 9) continue;
    if (Math.hypot(x - FARM.silo[0], z - FARM.silo[2]) < 8) continue;
    trees.push(treeGeo(rnd, x, z));
  }
  const keep = ["aBase", "aRand", "aH"];
  return { corn: mergeAll(corn, keep), wheat: mergeAll(wheat, keep), lettuce: mergeAll(lett, keep), sun: mergeAll(sun, keep), trees: mergeAll(trees, keep) };
};

const farmBuildings = () => {
  const geos: THREE.BufferGeometry[] = [];
  // Barn (gambrel roof), facing +x towards the fields.
  {
    const [bx, , bz] = FARM.barn;
    const W = 9;
    const D = 13;
    const Hh = 6.5;
    geos.push(place(rbox(W, Hh, D, 0.2), "#D2483A", [bx, Hh / 2, bz]));
    const s = new THREE.Shape();
    const pts: [number, number][] = [
      [-W / 2 - 0.5, Hh - 0.2],
      [-W / 2 + 0.6, Hh + 2.6],
      [0, Hh + 4.4],
      [W / 2 - 0.6, Hh + 2.6],
      [W / 2 + 0.5, Hh - 0.2],
    ];
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    s.closePath();
    const r = new THREE.ExtrudeGeometry(s, { depth: D + 0.8, bevelEnabled: false }).toNonIndexed();
    r.computeVertexNormals();
    const p = r.attributes.position;
    const n = r.attributes.normal;
    const col = new Float32Array(p.count * 3);
    const roofC = new THREE.Color("#5B4A48");
    const gable = new THREE.Color("#C43E31");
    for (let i = 0; i < p.count; i++) {
      const c = Math.abs(n.getZ(i)) > 0.9 ? gable : roofC;
      col.set([c.r, c.g, c.b], i * 3);
    }
    r.setAttribute("color", new THREE.BufferAttribute(col, 3));
    r.translate(0, 0, -(D + 0.8) / 2);
    r.rotateY(Math.PI / 2);
    r.translate(bx, 0, bz);
    geos.push(r);
    // Doors with the white X, trim, loft door (on the +x face).
    const fx = bx + W / 2 + 0.06;
    geos.push(place(rbox(0.12, 4.2, 4.6, 0.05), "#FFFFFF", [fx, 2.1, bz]));
    geos.push(place(rbox(0.14, 3.8, 4.2, 0.05), "#B83A2E", [fx + 0.02, 2.1, bz]));
    geos.push(place(rbox(0.16, 0.3, 5.4, 0.05), "#FFFFFF", [fx + 0.04, 2.1, bz], [0.72, 0, 0]));
    geos.push(place(rbox(0.16, 0.3, 5.4, 0.05), "#FFFFFF", [fx + 0.04, 2.1, bz], [-0.72, 0, 0]));
    geos.push(place(rbox(0.14, 1.6, 1.6, 0.05), "#FFFFFF", [fx, Hh + 1.6, bz]));
    geos.push(place(rbox(0.16, 1.3, 1.3, 0.05), "#7A2A22", [fx + 0.02, Hh + 1.6, bz]));
    // Hay bales.
    for (let i = 0; i < 4; i++) geos.push(place(cyl(0.9, 0.9, 1.2, 14), "#F2CF6B", [bx + 7 + (i % 2) * 2.1, 0.9, bz - 8 + Math.floor(i / 2) * 2.4], [Math.PI / 2, 0, 0]));
  }
  // Silo.
  {
    const [sx, , sz] = FARM.silo;
    geos.push(place(cyl(2.6, 2.6, 12, 18), "#C9D3DC", [sx, 6, sz]));
    for (let i = 1; i < 4; i++) geos.push(place(cyl(2.65, 2.65, 0.25, 18), "#9AA7B4", [sx, i * 3, sz]));
    geos.push(place(new THREE.SphereGeometry(2.6, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), "#A9B4BE", [sx, 12, sz]));
  }
  // Water tower.
  {
    const [tx, , tz] = FARM.tower;
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      geos.push(rod([tx + dx * 3.2, 0, tz + dz * 3.2], [tx + dx * 2.2, 10, tz + dz * 2.2], 0.22, "#8E9AA6", 8));
    }
    for (const y of [3.5, 7]) {
      const k = 3.2 - y * 0.1;
      geos.push(rod([tx - k, y, tz - k], [tx + k, y, tz - k], 0.1, "#8E9AA6", 5));
      geos.push(rod([tx - k, y, tz + k], [tx + k, y, tz + k], 0.1, "#8E9AA6", 5));
      geos.push(rod([tx - k, y, tz - k], [tx - k, y, tz + k], 0.1, "#8E9AA6", 5));
      geos.push(rod([tx + k, y, tz - k], [tx + k, y, tz + k], 0.1, "#8E9AA6", 5));
    }
    geos.push(place(cyl(3.6, 3.6, 5, 20), "#7FB7E6", [tx, 12.5, tz]));
    geos.push(place(cyl(3.65, 3.65, 0.8, 20), "#FFFFFF", [tx, 12.5, tz]));
    geos.push(place(new THREE.ConeGeometry(4.0, 2.2, 20), "#4F7FB8", [tx, 16.1, tz]));
  }
  // Windmill tower (the rotor is separate).
  {
    const [wx, , wz] = FARM.windmill;
    for (const [dx, dz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      geos.push(rod([wx + dx * 2.4, 0, wz + dz * 2.4], [wx + dx * 0.45, 15, wz + dz * 0.45], 0.13, "#E9E3D6", 6));
    }
    for (let y = 3; y < 15; y += 3) {
      const k = 2.4 - (y / 15) * 1.95;
      for (const [a, b] of [
        [
          [-k, -k],
          [k, -k],
        ],
        [
          [k, -k],
          [k, k],
        ],
        [
          [k, k],
          [-k, k],
        ],
        [
          [-k, k],
          [-k, -k],
        ],
      ] as [number, number][][])
        geos.push(rod([wx + a[0], y, wz + a[1]], [wx + b[0], y, wz + b[1]], 0.07, "#E9E3D6", 4));
    }
    geos.push(place(rbox(1.6, 0.6, 1.6, 0.1), "#C94A3A", [wx, 15.2, wz]));
    geos.push(place(rbox(0.3, 0.3, 4.2, 0.08), "#C94A3A", [wx, 15.5, wz - 2.1]));
    geos.push(extrudeTri([
      [0, 0],
      [0, 2.2],
      [2.4, 0.4],
    ], 0.08, "#E9E3D6").rotateY(Math.PI / 2).translate(wx, 14.9, wz - 3.4));
  }
  return mergeAll(geos);
};

const rotorGeometry = () => {
  const geos: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const b = rbox(0.55, 2.4, 0.06, 0.03);
    b.translate(0, 1.75, 0);
    geos.push(place(b, i % 2 ? "#F4F1EA" : "#E54B3C", [0, 0, 0], [0.25, 0, a]));
  }
  geos.push(place(new THREE.TorusGeometry(2.9, 0.06, 4, 28), "#E9E3D6", [0, 0, 0]));
  geos.push(place(cyl(0.35, 0.35, 0.6, 10), "#C94A3A", [0, 0, 0], [Math.PI / 2, 0, 0]));
  return mergeAll(geos);
};

const CHANNEL_FS = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
#include <fog_pars_fragment>
void main() {
  float s = smoothstep(0.75, 0.95, sin(vUv.x * 160.0 - uTime * 9.0 + sin(vUv.y * 6.0) * 2.0));
  float edge = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
  vec3 col = mix(uColor * 1.15 + 0.08, uColor, edge);
  col = mix(col, vec3(1.0), s * 0.45 * edge);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
  #include <colorspace_fragment>
}`;

const CHANNEL_VS = /* glsl */ `
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

/** Fair-weather light whose sun swings across the sky with `sun` 0 (morning) … 1 (evening). */
export const FarmLights: React.FC<{ sun?: number; k?: number }> = ({ sun = 0.35, k = 1 }) => {
  const a = lerp(-1.2, 1.2, clamp01(sun));
  const warm = new THREE.Color("#FFF2D6").lerp(new THREE.Color("#FFC27A"), Math.abs(a) / 1.6);
  return (
    <>
      <hemisphereLight args={["#E2F2FF", "#8A7A50", 1.3 * k]} />
      <directionalLight position={[Math.sin(a) * 80, 70 * Math.cos(a * 0.8), 35]} intensity={2.4 * k} color={warm} />
    </>
  );
};

/**
 * The fields, ≈ 88 × 88 of farm (y = 0) inside a ring of trees and green hills (FARM_HAZE fog):
 * corn (x < 0, z < 0), wheat (x > 0, z < 0), lettuce (x < 0, z > 0) and sunflowers (x > 0, z > 0)
 * around a cross of irrigation channels (along x at z = 0 and along z at x = 0), a red barn with
 * hay bales and a silo (west, FARM.barn), a water tower (FARM.tower) and a windmill (FARM.windmill).
 * `wilt` 0 → 1: crops droop, shrink and turn yellow then brown (staggered plant by plant), the trees
 * brown, the grass turns to straw, the channels drain (gone by ≈ 0.85) and the soil cracks.
 * Time-lapse: cloud shadows race across (`t` seconds, `clouds` speed scale) and the windmill spins.
 */
export const Farmland: React.FC<{ wilt?: number; t?: number; clouds?: number; fog?: [number, number] }> = ({ wilt = 0, t = 0, clouds = 1, fog = [90, 420] }) => {
  const geos = useMemo(
    () => ({
      inner: farmGround(124, 124, true),
      outer: setGrass(farmGround(520, 104, false), () => 1),
      crops: cropsGeometry(),
      buildings: farmBuildings(),
      rotor: rotorGeometry(),
      cloud: (() => {
        const rnd = mulberry(66);
        const parts: THREE.BufferGeometry[] = [];
        for (let i = 0; i < 7; i++) parts.push(place(new THREE.IcosahedronGeometry(3 + rnd() * 2.5, 1), "#FFFFFF", [(i - 3) * 3.4, rnd() * 1.6, (rnd() - 0.5) * 4]));
        return mergeAll(parts);
      })(),
    }),
    [],
  );
  const ground = useMemo(() => makeGround(false, 0.08, 0.15, 0.3), []);
  const outerGround = useMemo(() => makeGround(false, 0.08, 0.15, 0.3), []);
  const mats = useMemo(
    () => ({
      corn: makeCropMaterial(1.25, 0.05),
      wheat: makeCropMaterial(1.0, 0.1),
      lettuce: makeCropMaterial(0.35, 0.3),
      sun: makeCropMaterial(1.5, 0.05),
      trees: makeCropMaterial(0.12, 0.18),
    }),
    [],
  );
  const channel = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uColor: { value: new THREE.Color("#3FB2F5") } }]),
        vertexShader: CHANNEL_VS,
        fragmentShader: CHANNEL_FS,
        fog: true,
      }),
    [],
  );
  const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.22, color: "#1E2A3A" }), []);
  const w = clamp01(wilt);
  ground.uniforms.uDry.value = smoothstep(0.35, 1, w);
  ground.uniforms.uWilt.value = w;
  outerGround.uniforms.uWilt.value = smoothstep(0.1, 1, w);
  const keys = ["corn", "wheat", "lettuce", "sun", "trees"] as const;
  for (const k of keys) {
    mats[k].uniforms.uWilt.value = k === "trees" ? smoothstep(0.15, 1, w) : w;
    mats[k].uniforms.uTime.value = t;
  }
  channel.uniforms.uTime.value = t;
  const wet = 1 - smoothstep(0.2, 0.85, w);
  const span = 2 * FARM.road - 2;
  const cloudX = (i: number) => {
    const v = ((((t * 9 * clouds + i * 61) % 300) + 300) % 300) - 150;
    return v;
  };
  return (
    <group>
      <SceneFog color={FARM_HAZE} near={fog[0]} far={fog[1]} />
      <mesh geometry={geos.outer} material={outerGround.material} />
      <mesh geometry={geos.inner} material={ground.material} />
      <mesh geometry={geos.crops.corn} material={mats.corn.material} />
      <mesh geometry={geos.crops.wheat} material={mats.wheat.material} />
      <mesh geometry={geos.crops.lettuce} material={mats.lettuce.material} />
      <mesh geometry={geos.crops.sun} material={mats.sun.material} />
      <mesh geometry={geos.crops.trees} material={mats.trees.material} />
      <mesh geometry={geos.buildings} material={vertexMat(0.55, false, 0.15)} />
      <group position={[FARM.windmill[0], 15.5, FARM.windmill[2] + 0.6]} rotation={[0, 0, t * 3.2 * (1 - 0.6 * w)]}>
        <mesh geometry={geos.rotor} material={vertexMat(0.5, false, 0.15)} />
      </group>
      {wet > 0.01
        ? [0, 1].map((i) => (
            <mesh key={i} material={channel} position={[0, -0.62 + 0.42 * wet, 0]} rotation={[-Math.PI / 2, 0, i * (Math.PI / 2)]} scale={[1, 0.25 + 0.75 * wet, 1]}>
              <planeGeometry args={[span, FARM.channel * 2 - 0.2]} />
            </mesh>
          ))
        : null}
      {[0, 1, 2, 3, 4].map((i) => {
        const x = cloudX(i);
        const z = -70 + i * 34 + 8 * Math.sin(i * 2.3);
        return (
          <group key={i}>
            <mesh material={shadowMat} position={[x - 6, 0.12, z + 4]} rotation={[-Math.PI / 2, 0, 0.3 * i]} scale={[36, 22, 1]} renderOrder={1}>
              <planeGeometry args={[1, 1]} />
            </mesh>
            <mesh geometry={geos.cloud} material={toy("#FFFFFF", { glow: 0.45, rough: 0.9 })} position={[x, 62 + (i % 2) * 6, z]} scale={[1.3, 0.8, 1]} />
          </group>
        );
      })}
    </group>
  );
};

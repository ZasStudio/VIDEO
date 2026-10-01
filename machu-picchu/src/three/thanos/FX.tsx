import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mulberry } from "../noise";
import { V3, canvasTexture, glowTexture } from "../inca/kit";

// Energy effects for the Thanos short. World units sized for Nubi at size 2 (2 wide, ≈ 2 tall),
// ground at y = 0, front = +z. Everything is a pure function of its props (no Math.random, no
// per-frame geometry): shapes are built once per seed and animated through uniforms/transforms.
//
// Glows use `additive` blending: they add light over whatever is behind them, including the CSS
// sky behind the transparent canvas, and leave the canvas alpha alone.
//
// Time conventions:
//   • `t` on looping effects (bolts, beams, rings, debris drift) is the scene clock in seconds.
//   • `t` on one-shot effects (StoneBlast, ShockRing, SparkBurst) is seconds SINCE it fired.
//   • GroundCrack / FrozenDebris are progress-driven (`crack`, `burst`, `frozen` 0..1), so the
//     scene sets their pace by how fast it ramps them.

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

/** Makes a material add its colour (× alpha) to the image without touching the canvas alpha. */
export const additive = <M extends THREE.Material>(m: M): M => {
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.SrcAlphaFactor;
  m.blendDst = THREE.OneFactor;
  m.blendSrcAlpha = THREE.ZeroFactor;
  m.blendDstAlpha = THREE.OneFactor;
  m.transparent = true;
  m.depthWrite = false;
  return m;
};

const Yv = new THREE.Vector3(0, 1, 0);

/** Placement that maps the unit segment (0,0,0)-(0,1,0) onto from → to. */
export const segmentFrame = (from: V3, to: V3) => {
  const d = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const len = Math.max(1e-4, d.length());
  const q = new THREE.Quaternion().setFromUnitVectors(Yv, d.multiplyScalar(1 / len));
  return { len, q };
};

// =======================================================================================
// Glow sprite

/** Soft additive glow ball (camera-facing). `size` = diameter of the visible glow. */
export const Glow: React.FC<{ color: string; size: number; opacity?: number; position?: V3 }> = ({ color, size, opacity = 1, position }) => {
  const mat = useMemo(() => additive(new THREE.SpriteMaterial({ map: glowTexture(), color, toneMapped: false, fog: false })), [color]);
  if (opacity <= 0.004 || size <= 0) return null;
  mat.opacity = Math.min(1, opacity);
  return <sprite material={mat} position={position} scale={[size, size, 1]} renderOrder={5} />;
};

// =======================================================================================
// Glow strips: camera-facing ribbons along polylines (bolts, beams). The ribbon is widened in
// view space, so it always faces the camera; `aSide` runs -1..1 across it and the fragment
// shader draws a white-hot core inside a coloured glow.

const STRIP_VERT = /* glsl */ `
attribute vec3 aPrev;
attribute vec3 aNext;
attribute float aSide;
attribute float aAlong;
attribute float aWidth;
uniform float uWidth;
uniform float uOwnScale;
uniform float uTime;
uniform float uPulse;
uniform float uPulseFreq;
uniform float uPulseSpeed;
uniform float uLen;
varying float vSide;
varying float vAlong;
void main() {
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  vec4 a = modelViewMatrix * vec4(aPrev, 1.0);
  vec4 b = modelViewMatrix * vec4(aNext, 1.0);
  vec3 dir = b.xyz - a.xyz;
  float dl = length(dir);
  dir = dl > 1e-6 ? dir / dl : vec3(0.0, 1.0, 0.0);
  vec3 off = cross(dir, normalize(-p.xyz));
  float ol = length(off);
  off = ol > 1e-6 ? off / ol : vec3(1.0, 0.0, 0.0);
  float worldScale = length(modelMatrix[0].xyz) / uOwnScale;
  float pulse = 1.0 + uPulse * sin(aAlong * uLen * uPulseFreq - uTime * uPulseSpeed);
  p.xyz += off * aSide * 0.5 * uWidth * aWidth * pulse * worldScale;
  vSide = aSide;
  vAlong = aAlong;
  gl_Position = projectionMatrix * p;
}`;

const STRIP_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uCore;
uniform float uOpacity;
uniform float uCoreWidth;
uniform float uGlow;
uniform float uReveal;
uniform float uFrom;
varying float vSide;
varying float vAlong;
void main() {
  if (vAlong > uReveal || vAlong < uFrom) discard;
  float d = abs(vSide);
  float core = 1.0 - smoothstep(uCoreWidth * 0.45, uCoreWidth, d);
  float glow = pow(1.0 - d, 3.0) * uGlow;
  vec3 col = uColor * glow + uCore * core;
  gl_FragColor = vec4(col * uOpacity, 1.0);
  #include <colorspace_fragment>
}`;

export type StripOpts = {
  color: string;
  core?: string;
  coreWidth?: number;
  glow?: number;
  width: number;
  opacity?: number;
  pulse?: number;
  pulseFreq?: number;
  pulseSpeed?: number;
};

/** Additive glow-strip material (one per effect instance; its uniforms are set per frame). */
export const makeStripMaterial = (o: StripOpts) =>
  additive(
    new THREE.ShaderMaterial({
      vertexShader: STRIP_VERT,
      fragmentShader: STRIP_FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(o.color) },
        uCore: { value: new THREE.Color(o.core ?? "#FFFFFF") },
        uCoreWidth: { value: o.coreWidth ?? 0.22 },
        uGlow: { value: o.glow ?? 0.9 },
        uOpacity: { value: o.opacity ?? 1 },
        uWidth: { value: o.width },
        uOwnScale: { value: 1 },
        uTime: { value: 0 },
        uPulse: { value: o.pulse ?? 0 },
        uPulseFreq: { value: o.pulseFreq ?? 6 },
        uPulseSpeed: { value: o.pulseSpeed ?? 40 },
        uLen: { value: 1 },
        uReveal: { value: 1.01 },
        uFrom: { value: -0.01 },
      },
      toneMapped: false,
      fog: false,
      side: THREE.DoubleSide,
    }),
  );

export type StripMaterial = ReturnType<typeof makeStripMaterial>;

/** A polyline for a strip: points, optional per-point width factors and the `along` range it covers. */
export type StripPath = { pts: THREE.Vector3[]; w?: number[]; a0?: number; a1?: number };

/** Builds the ribbon geometry for a set of polylines (two vertices per point). */
export const stripGeometry = (paths: StripPath[]) => {
  const pos: number[] = [];
  const prev: number[] = [];
  const next: number[] = [];
  const side: number[] = [];
  const along: number[] = [];
  const wid: number[] = [];
  const idx: number[] = [];
  let base = 0;
  for (const path of paths) {
    const { pts } = path;
    const n = pts.length;
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = cum[n - 1] || 1;
    const a0 = path.a0 ?? 0;
    const a1 = path.a1 ?? 1;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      for (const s of [-1, 1]) {
        pos.push(p.x, p.y, p.z);
        prev.push(a.x, a.y, a.z);
        next.push(b.x, b.y, b.z);
        side.push(s);
        along.push(a0 + (a1 - a0) * (cum[i] / total));
        wid.push(path.w ? path.w[i] : 1);
      }
      if (i < n - 1) {
        const k = base + i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    base += n * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aPrev", new THREE.Float32BufferAttribute(prev, 3));
  g.setAttribute("aNext", new THREE.Float32BufferAttribute(next, 3));
  g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute("aAlong", new THREE.Float32BufferAttribute(along, 1));
  g.setAttribute("aWidth", new THREE.Float32BufferAttribute(wid, 1));
  g.setIndex(idx);
  return g;
};

/** Jagged polyline from a to b by midpoint displacement (`amp` relative to |b - a|). */
export const jaggedPath = (rnd: () => number, a: THREE.Vector3, b: THREE.Vector3, levels: number, amp: number) => {
  let pts = [a.clone(), b.clone()];
  let k = amp * a.distanceTo(b);
  for (let l = 0; l < levels; l++) {
    const out: THREE.Vector3[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i];
      const q = pts[i + 1];
      const dir = q.clone().sub(p).normalize();
      const r = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5);
      r.sub(dir.clone().multiplyScalar(r.dot(dir))).normalize().multiplyScalar(k * (0.5 + rnd() * 0.5) * (rnd() < 0.5 ? -1 : 1));
      out.push(p.clone().add(q).multiplyScalar(0.5).add(r), q);
    }
    pts = out;
    k *= 0.5;
  }
  return pts;
};

let unitLineGeo: THREE.BufferGeometry | null = null;
/** Straight unit strip (0,0,0)-(0,1,0) with 48 points (beams; the pulse needs the points). */
const getUnitLine = () =>
  (unitLineGeo ??= stripGeometry([{ pts: Array.from({ length: 48 }, (_, i) => new THREE.Vector3(0, i / 47, 0)) }]));

// =======================================================================================
// Lightning

const BOLT_VARIANTS = 6;

/** One lightning shape on the unit segment (0,0,0)-(0,1,0): a jagged trunk plus forks. */
const boltPaths = (seed: number, jag: number, forks: number): StripPath[] => {
  const rnd = mulberry(seed);
  const trunk = jaggedPath(rnd, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 4, 0.17 * jag);
  const n = trunk.length;
  const paths: StripPath[] = [
    {
      pts: trunk,
      w: trunk.map((_, i) => {
        const u = i / (n - 1);
        return 0.6 + 0.4 * Math.min(1, u * 8, (1 - u) * 8) * (0.85 + 0.3 * rnd());
      }),
    },
  ];
  for (let f = 0; f < forks; f++) {
    const i0 = Math.floor(n * (0.12 + 0.7 * rnd()));
    const start = trunk[i0];
    const dir = trunk[Math.min(n - 1, i0 + 1)].clone().sub(start).normalize();
    const side = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5);
    side.sub(dir.clone().multiplyScalar(side.dot(dir))).normalize();
    const ang = 0.5 + rnd() * 0.5;
    const fdir = dir.clone().multiplyScalar(Math.cos(ang)).add(side.multiplyScalar(Math.sin(ang)));
    const len = 0.1 + rnd() * 0.2;
    const pts = jaggedPath(rnd, start, start.clone().add(fdir.multiplyScalar(len)), 3, 0.22);
    const u0 = i0 / (n - 1);
    paths.push({ pts, w: pts.map((_, i) => 0.55 * (1 - i / (pts.length - 1)) + 0.04), a0: u0, a1: u0 + len });
  }
  return paths;
};

/**
 * Jagged lightning bolt from `from` to `to` (world points): a white-hot core inside a coloured
 * glow, with a few forks. The shape re-rolls ≈ 18 times a second (from a set of 6 per seed) and
 * the brightness flickers. `width` = glow width in world units (the core is ≈ a quarter of it;
 * 0.3 for a hammer strike, 0.08 for small arcs), `amount` 0..1 fades it, `reveal` 0..1 grows it
 * out from `from` (a strike shooting out), `seed` picks the shapes, `jag` scales the zigzag,
 * `flares` puts glows on both ends. Default colour: electric light blue.
 */
export const LightningBolt: React.FC<{
  from: V3;
  to: V3;
  t?: number;
  seed?: number;
  width?: number;
  color?: string;
  core?: string;
  amount?: number;
  reveal?: number;
  forks?: number;
  jag?: number;
  flares?: boolean;
}> = ({ from, to, t = 0, seed = 0, width = 0.3, color = "#6CC8FF", core = "#FFFFFF", amount = 1, reveal = 1, forks = 3, jag = 1, flares = true }) => {
  const geos = useMemo(() => Array.from({ length: BOLT_VARIANTS }, (_, k) => stripGeometry(boltPaths(seed * 977 + k * 131 + 7, jag, forks))), [seed, jag, forks]);
  const mat = useMemo(() => makeStripMaterial({ color, core, width, coreWidth: 0.24, glow: 0.85 }), [color, core, width]);
  const k = clamp01(amount);
  if (k <= 0.004) return null;
  const step = Math.floor(t * 18 + seed * 3.7);
  const variant = Math.floor(hash(step + seed * 0.37) * BOLT_VARIANTS) % BOLT_VARIANTS;
  const h = hash(step * 1.31 + 0.5 + seed);
  const flick = h < 0.1 ? 0.45 : 0.8 + 0.3 * h;
  const { len, q } = segmentFrame(from, to);
  const u = mat.uniforms;
  u.uOwnScale.value = len;
  u.uOpacity.value = k * flick;
  u.uReveal.value = reveal >= 1 ? 2 : clamp01(reveal);
  return (
    <group>
      <group position={from} quaternion={q}>
        <mesh geometry={geos[variant]} material={mat} scale={len} frustumCulled={false} renderOrder={6} />
      </group>
      {flares ? (
        <>
          <Glow color={color} size={width * 5} opacity={0.55 * k * flick} position={from} />
          {reveal >= 1 ? <Glow color={color} size={width * 6} opacity={0.7 * k * flick} position={to} /> : null}
        </>
      ) : null}
    </group>
  );
};

// =======================================================================================
// Sparks: streak particles computed in the vertex shader from a seed and a clock, drawn as
// camera-facing streaks from their position a moment ago (tail) to now (head).

export type SparkMode = "fly" | "orbit" | "burst" | "rise";

const SPARK_POS: Record<SparkMode, string> = {
  // Thrown off a spinning unit ring (in the xy plane) tangentially, then falling (−y).
  fly: /* glsl */ `
  float life = uLife * (0.55 + 0.9 * fract(aSeed.w * 7.13));
  float age = mod(uTime + aSeed.y * 13.7 + aSeed.x * 5.3, life);
  float spawn = uTime - age;
  float th = aSeed.x * 6.2831853 + uSpin * spawn;
  vec2 rad = vec2(cos(th), sin(th));
  vec2 tng = vec2(-rad.y, rad.x) * sign(uSpin);
  float v = uSpeed * (0.45 + 0.9 * aSeed.y);
  vec2 dir = normalize(tng + rad * uSpread * (aSeed.z - 0.3));
  float zz = (aSeed.w - 0.5) * 0.08;
  float ta = max(0.0, age - uTail);
  vec2 ph = rad * uOpen + dir * v * age;
  ph.y -= 0.5 * uGravity * age * age;
  vec2 pt = rad * uOpen + dir * v * ta;
  pt.y -= 0.5 * uGravity * ta * ta;
  head = vec3(ph, zz);
  tail = vec3(pt, zz);
  fade = (1.0 - age / life) * step(aSeed.x, uArc);
  `,
  // Short arcs whizzing round a unit ring.
  orbit: /* glsl */ `
  float w = uSpin * (0.7 + 0.6 * aSeed.y);
  float th = aSeed.x * 6.2831853 + w * uTime;
  // Position in the ring's own spinning frame (the drawn arc lives there).
  float rel = fract((th - uSpin * uTime) / 6.2831853);
  float r = uOpen * (1.0 + (aSeed.z - 0.5) * uSpread);
  float arcLen = uTail * (0.5 + aSeed.w);
  float zz = (aSeed.w - 0.5) * 0.05;
  head = vec3(r * cos(th), r * sin(th), zz);
  float th2 = th - arcLen * sign(uSpin);
  tail = vec3(r * cos(th2), r * sin(th2), zz);
  fade = (0.6 + 0.4 * sin(uTime * (7.0 + aSeed.w * 9.0) + aSeed.x * 40.0)) * step(rel, uArc);
  `,
  // Everything thrown out of the origin at once (uTime = seconds since the burst), upwards-biased.
  burst: /* glsl */ `
  float life = uLife * (0.45 + 0.8 * aSeed.w);
  float age = uTime - aSeed.w * 0.06;
  float a = aSeed.x * 6.2831853;
  float yy = mix(uSpread, 1.0, aSeed.y);
  float rr = sqrt(max(0.0, 1.0 - yy * yy));
  vec3 dir = vec3(cos(a) * rr, yy, sin(a) * rr);
  float v = uSpeed * (0.35 + 0.9 * aSeed.z);
  float ag = clamp(age, 0.0, life);
  float ta = max(0.0, ag - uTail);
  head = dir * v * ag;
  head.y -= 0.5 * uGravity * ag * ag;
  tail = dir * v * ta;
  tail.y -= 0.5 * uGravity * ta * ta;
  fade = age < 0.0 ? 0.0 : 1.0 - ag / life;
  `,
  // Rising motes in a box (uBox = size; base at y = 0), swaying.
  rise: /* glsl */ `
  float life = uLife * (0.6 + 0.8 * aSeed.w);
  float age = mod(uTime + aSeed.y * 17.0, life);
  vec3 base = vec3((aSeed.x - 0.5) * uBox.x, 0.0, (aSeed.z - 0.5) * uBox.z);
  float sw = uSpread;
  float ta = max(0.0, age - uTail);
  head = base + vec3(sin(age * 2.3 + aSeed.x * 20.0) * sw, uSpeed * age * (0.6 + 0.8 * aSeed.z), cos(age * 1.9 + aSeed.z * 20.0) * sw);
  tail = base + vec3(sin(ta * 2.3 + aSeed.x * 20.0) * sw, uSpeed * ta * (0.6 + 0.8 * aSeed.z), cos(ta * 1.9 + aSeed.z * 20.0) * sw);
  fade = sin(3.14159 * age / life) * step(head.y, uBox.y);
  `,
};

const sparkVert = (mode: SparkMode) => /* glsl */ `
attribute vec4 aSeed;
attribute vec2 aCorner;
uniform float uTime;
uniform float uWidth;
uniform float uTail;
uniform float uLife;
uniform float uSpeed;
uniform float uGravity;
uniform float uSpread;
uniform float uSpin;
uniform float uOpen;
uniform float uArc;
uniform float uMinLen;
uniform vec3 uBox;
varying float vFade;
varying float vSide;
varying float vEnd;
void main() {
  vec3 head;
  vec3 tail;
  float fade;
  ${SPARK_POS[mode]}
  vec3 d = head - tail;
  float dl = length(d);
  if (dl < uMinLen) tail = head - (dl > 1e-5 ? d / dl : vec3(0.0, 1.0, 0.0)) * uMinLen;
  vec4 hv = modelViewMatrix * vec4(head, 1.0);
  vec4 tv = modelViewMatrix * vec4(tail, 1.0);
  vec4 pv = mix(tv, hv, aCorner.x);
  vec3 dir = hv.xyz - tv.xyz;
  float l = length(dir);
  dir = l > 1e-6 ? dir / l : vec3(0.0, 1.0, 0.0);
  vec3 off = cross(dir, normalize(-pv.xyz));
  float ol = length(off);
  off = ol > 1e-6 ? off / ol : vec3(1.0, 0.0, 0.0);
  float ws = length(modelMatrix[0].xyz);
  float w = uWidth * ws * (0.85 + 0.3 * aSeed.y) * mix(0.35, 1.0, aCorner.x);
  // Round the head a little past its point so short streaks read as dots.
  pv.xyz += dir * aCorner.x * w * 0.5;
  pv.xyz += off * aCorner.y * 0.5 * w;
  vFade = max(0.0, fade);
  vSide = aCorner.y;
  vEnd = aCorner.x;
  gl_Position = projectionMatrix * pv;
}`;

const SPARK_FRAG = /* glsl */ `
uniform vec3 uHead;
uniform vec3 uTailC;
uniform float uOpacity;
varying float vFade;
varying float vSide;
varying float vEnd;
void main() {
  float across = 1.0 - abs(vSide);
  float a = across * across * (3.0 - 2.0 * across);
  vec3 col = mix(uTailC, uHead, vEnd * vEnd);
  float k = vFade * a * (0.25 + 0.75 * vEnd) * uOpacity;
  if (k < 0.002) discard;
  gl_FragColor = vec4(col * k, 1.0);
  #include <colorspace_fragment>
}`;

const sparkGeoCache = new Map<string, THREE.BufferGeometry>();
/** `count` streak quads with per-particle random seeds (cached per count + seed). */
const sparkGeometry = (count: number, seed: number) => {
  const key = `${count}|${seed}`;
  const hit = sparkGeoCache.get(key);
  if (hit) return hit;
  const rnd = mulberry(seed * 7919 + 17);
  const n = count * 4;
  const seeds = new Float32Array(n * 4);
  const corner = new Float32Array(n * 2);
  const idx: number[] = [];
  for (let i = 0; i < count; i++) {
    const s = [rnd(), rnd(), rnd(), rnd()];
    for (let c = 0; c < 4; c++) {
      const v = i * 4 + c;
      seeds.set(s, v * 4);
      corner[v * 2] = c < 2 ? 0 : 1;
      corner[v * 2 + 1] = c % 2 ? 1 : -1;
    }
    const b = i * 4;
    idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 4));
  g.setAttribute("aCorner", new THREE.Float32BufferAttribute(corner, 2));
  g.setIndex(idx);
  sparkGeoCache.set(key, g);
  return g;
};

export type SparkParams = {
  mode: SparkMode;
  count: number;
  seed?: number;
  /** Clock: the scene time (fly, orbit, rise) or the seconds since the burst (burst). */
  time: number;
  width: number;
  tail?: number;
  life?: number;
  speed?: number;
  gravity?: number;
  spread?: number;
  spin?: number;
  open?: number;
  arc?: number;
  minLen?: number;
  box?: V3;
  head?: string;
  tailColor?: string;
  opacity?: number;
};

/**
 * Low-level spark field (one draw call): see SparkMode. Units are the parent group's (a portal
 * draws them in unit-radius space inside a group scaled by its radius).
 */
export const Sparks: React.FC<SparkParams> = (p) => {
  const geo = sparkGeometry(p.count, p.seed ?? 0);
  const mat = useMemo(
    () =>
      additive(
        new THREE.ShaderMaterial({
          vertexShader: sparkVert(p.mode),
          fragmentShader: SPARK_FRAG,
          uniforms: {
            uTime: { value: 0 },
            uWidth: { value: 0.05 },
            uTail: { value: 0.05 },
            uLife: { value: 1 },
            uSpeed: { value: 1 },
            uGravity: { value: 0 },
            uSpread: { value: 0 },
            uSpin: { value: 1 },
            uOpen: { value: 1 },
            uArc: { value: 1 },
            uMinLen: { value: 0 },
            uBox: { value: new THREE.Vector3(1, 1, 1) },
            uHead: { value: new THREE.Color("#FFFFFF") },
            uTailC: { value: new THREE.Color("#FF8A1F") },
            uOpacity: { value: 1 },
          },
          toneMapped: false,
          fog: false,
          side: THREE.DoubleSide,
        }),
      ),
    [p.mode],
  );
  const u = mat.uniforms;
  u.uTime.value = p.time;
  u.uWidth.value = p.width;
  u.uTail.value = p.tail ?? 0.05;
  u.uLife.value = p.life ?? 1;
  u.uSpeed.value = p.speed ?? 1;
  u.uGravity.value = p.gravity ?? 0;
  u.uSpread.value = p.spread ?? 0;
  u.uSpin.value = p.spin ?? 1;
  u.uOpen.value = p.open ?? 1;
  u.uArc.value = p.arc ?? 1;
  u.uMinLen.value = p.minLen ?? 0;
  (u.uBox.value as THREE.Vector3).set(...(p.box ?? [1, 1, 1]));
  (u.uHead.value as THREE.Color).set(p.head ?? "#FFF4C0");
  (u.uTailC.value as THREE.Color).set(p.tailColor ?? "#FF7A1A");
  u.uOpacity.value = p.opacity ?? 1;
  if ((p.opacity ?? 1) <= 0.003) return null;
  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={7} />;
};

/**
 * Burst of hot sparks thrown out of a point (an impact: the hammer smashing into the gauntlet).
 * `t` = seconds since the hit (nothing before 0, gone after ≈ `life`); `size` ≈ how far they
 * fly (world units); `up` 0..1 biases them upwards.
 */
export const SparkBurst: React.FC<{ t: number; position?: V3; size?: number; count?: number; seed?: number; color?: string; hot?: string; life?: number; up?: number }> = ({
  t,
  position,
  size = 1.5,
  count = 70,
  seed = 1,
  color = "#FF8A1F",
  hot = "#FFF6C8",
  life = 0.8,
  up = 0.2,
}) => {
  if (t < 0 || t > life * 1.4) return null;
  return (
    <group position={position}>
      <Sparks
        mode="burst"
        count={count}
        seed={seed}
        time={t}
        width={0.035 * size}
        tail={0.07}
        life={life}
        speed={size * 3.2}
        gravity={size * 4}
        spread={-1 + up * 1.3}
        head={hot}
        tailColor={color}
      />
      <Glow color={color} size={size * 2.2 * (1 - easeOut(t / 0.35))} opacity={1 - t / 0.35} />
      <Glow color={hot} size={size * 1.1 * (1 - easeOut(t / 0.2))} opacity={1 - t / 0.2} />
    </group>
  );
};

// =======================================================================================
// Rings: expanding shock rings and soft bands, drawn by a shader on a unit ring.

const RING_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const RING_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uCore;
uniform float uOpacity;
uniform float uR;
uniform float uW;
uniform float uTime;
uniform float uWobble;
varying vec2 vP;
void main() {
  float r = length(vP);
  float th = atan(vP.y, vP.x);
  float wob = 1.0 + uWobble * (0.55 * sin(th * 9.0 + uTime * 6.0) + 0.45 * sin(th * 23.0 - uTime * 9.0));
  float d = (r - uR) / (uW * wob);
  float glow = exp(-d * d * 1.6);
  float core = exp(-d * d * 14.0);
  vec3 col = uColor * glow + uCore * core * 0.9;
  float k = uOpacity * (glow + core);
  if (k < 0.002) discard;
  gl_FragColor = vec4(col * uOpacity, 1.0);
  #include <colorspace_fragment>
}`;

/** Glowing ring band material: band centred on radius uR (unit ring geometry), half-width uW. */
export const makeRingMaterial = (color: string, core = "#FFFFFF") =>
  additive(
    new THREE.ShaderMaterial({
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uCore: { value: new THREE.Color(core) },
        uOpacity: { value: 1 },
        uR: { value: 1 },
        uW: { value: 0.05 },
        uTime: { value: 0 },
        uWobble: { value: 0 },
      },
      toneMapped: false,
      fog: false,
      side: THREE.DoubleSide,
    }),
  );

let unitRingGeo: THREE.RingGeometry | null = null;
/** Ring covering radii 0..1.3 (the band shader draws inside it). */
export const getUnitRing = () => (unitRingGeo ??= new THREE.RingGeometry(0.02, 1.3, 128, 8));

/**
 * Expanding shock ring: a bright band growing from 0 to `radius` over `duration` seconds and
 * fading. `t` = seconds since it fired. `flat` lays it on the ground (xz plane, at the group's
 * origin), otherwise it faces +z. `width` = band thickness relative to the radius.
 */
export const ShockRing: React.FC<{ t: number; radius?: number; duration?: number; color?: string; core?: string; width?: number; flat?: boolean; position?: V3 }> = ({
  t,
  radius = 4,
  duration = 0.7,
  color = "#B45CFF",
  core = "#FFFFFF",
  width = 0.06,
  flat = true,
  position,
}) => {
  const mat = useMemo(() => makeRingMaterial(color, core), [color, core]);
  const p = t / duration;
  if (p < 0 || p >= 1) return null;
  const r = Math.max(0.02, easeOut(p));
  const u = mat.uniforms;
  u.uR.value = 1 / 1.3;
  u.uW.value = (width * (1 + p)) / 1.3 / r;
  u.uOpacity.value = Math.pow(1 - p, 1.6);
  u.uTime.value = t;
  u.uWobble.value = 0.15;
  return (
    <group position={position} rotation={flat ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
      <mesh geometry={getUnitRing()} material={mat} scale={radius * r * 1.3} renderOrder={6} />
    </group>
  );
};

// =======================================================================================
// Repulsor beam

/**
 * Light-blue repulsor beam from `from` (the emitter) to `to` (the hit): a pulsing white core in a
 * cyan glow, a soft outer haze, rings travelling down the beam, a bright muzzle and a flaring
 * impact. `width` = beam glow width (world units), `amount` 0..1 fades it, `reveal` 0..1 shoots
 * it out from `from`. `t` = scene clock (seconds).
 */
export const RepulsorBeam: React.FC<{ from: V3; to: V3; t?: number; width?: number; amount?: number; reveal?: number; color?: string }> = ({
  from,
  to,
  t = 0,
  width = 0.4,
  amount = 1,
  reveal = 1,
  color = "#58D2FF",
}) => {
  const mats = useMemo(
    () => ({
      beam: makeStripMaterial({ color, core: "#FFFFFF", width, coreWidth: 0.34, glow: 1, pulse: 0.16, pulseFreq: 5, pulseSpeed: 36 }),
      haze: makeStripMaterial({ color, core: "#000000", width: width * 2.8, coreWidth: 0.01, glow: 0.4, pulse: 0.1, pulseFreq: 2, pulseSpeed: 14 }),
      ring: makeRingMaterial(color, "#FFFFFF"),
    }),
    [color, width],
  );
  const k = clamp01(amount);
  if (k <= 0.004) return null;
  const { len, q } = segmentFrame(from, to);
  const rv = clamp01(reveal);
  const flick = 0.92 + 0.08 * Math.sin(t * 53) * Math.sin(t * 31);
  for (const m of [mats.beam, mats.haze]) {
    m.uniforms.uOwnScale.value = len;
    m.uniforms.uTime.value = t;
    m.uniforms.uLen.value = len;
    m.uniforms.uReveal.value = rv >= 1 ? 2 : rv;
    m.uniforms.uOpacity.value = k * flick;
  }
  const ru = mats.ring.uniforms;
  ru.uR.value = 0.7;
  ru.uW.value = 0.08;
  ru.uOpacity.value = 0.8 * k;
  return (
    <group>
      <group position={from} quaternion={q}>
        <mesh geometry={getUnitLine()} material={mats.haze} scale={len} frustumCulled={false} renderOrder={5} />
        <mesh geometry={getUnitLine()} material={mats.beam} scale={len} frustumCulled={false} renderOrder={6} />
        {/* Rings sliding down the beam (they face along it). */}
        {[0, 1, 2].map((i) => {
          const f = (((t * 1.6 + i / 3) % 1) + 1) % 1;
          if (f > rv) return null;
          const fade = Math.min(1, f * 6, (1 - f) * 4);
          return (
            <mesh key={i} geometry={getUnitRing()} material={mats.ring} position={[0, f * len, 0]} rotation={[Math.PI / 2, 0, 0]} scale={width * (0.9 + 0.5 * f)} visible={fade > 0.02} />
          );
        })}
      </group>
      <Glow color={color} size={width * 4.5} opacity={0.9 * k} position={from} />
      <Glow color="#FFFFFF" size={width * 1.8} opacity={0.9 * k} position={from} />
      {rv >= 1 ? (
        <>
          <Glow color={color} size={width * (6 + 0.8 * Math.sin(t * 40))} opacity={0.85 * k} position={to} />
          <Glow color="#FFFFFF" size={width * 2.4} opacity={k} position={to} />
        </>
      ) : null}
    </group>
  );
};

// =======================================================================================
// Stone blast

/**
 * The stones' energy blast. With `to`: a beam shoots from `from` to `to` (≈ 0.12 s), thick and
 * flaring at first, with two energy threads twisting round it, shock rings pulsing out of the
 * source (facing along the beam) and a burst where it hits. Without `to`: a nova at `from` — a
 * flash, an expanding ring facing the camera (+z) and a ring along the ground. `t` = seconds
 * since it fired; `amount` 0..1 fades it out; `width` = beam glow width (world units);
 * `radius` = nova / ring size. Default colour: stone purple.
 */
export const StoneBlast: React.FC<{ t: number; from: V3; to?: V3; color?: string; core?: string; width?: number; amount?: number; radius?: number; seed?: number }> = ({
  t,
  from,
  to,
  color = "#B04CFF",
  core = "#FFE8FF",
  width = 0.7,
  amount = 1,
  radius = 3,
  seed = 1,
}) => {
  const mats = useMemo(
    () => ({
      beam: makeStripMaterial({ color, core, width, coreWidth: 0.3, glow: 1, pulse: 0.22, pulseFreq: 3, pulseSpeed: 30 }),
      haze: makeStripMaterial({ color, core: "#000000", width: width * 3, coreWidth: 0.01, glow: 0.35 }),
      threadA: makeStripMaterial({ color: "#FF5FD2", core: "#FFFFFF", width: width * 0.22, coreWidth: 0.3 }),
      threadB: makeStripMaterial({ color: "#6F7BFF", core: "#FFFFFF", width: width * 0.22, coreWidth: 0.3 }),
    }),
    [color, core, width],
  );
  // Helical thread on the unit segment (radius in units of the beam length is set by scale).
  const helix = useMemo(
    () =>
      stripGeometry([
        {
          pts: Array.from({ length: 160 }, (_, i) => {
            const u = i / 159;
            const a = u * Math.PI * 2 * 9;
            return new THREE.Vector3(Math.cos(a), u, Math.sin(a));
          }),
        },
      ]),
    [],
  );
  const k = clamp01(amount);
  if (t < 0 || k <= 0.004) return null;
  const flash = Math.exp(-t / 0.12);
  const pulses = [0, 1, 2].map((i) => {
    const age = (t + i * 0.35) % 1.05;
    return { age, alive: t >= i * 0.35 || t > 1.05 };
  });
  if (!to) {
    // Nova.
    return (
      <group position={from}>
        <Glow color={color} size={radius * (1.2 + 2 * easeOut(t / 0.4)) * (0.6 + flash)} opacity={k * (0.5 + 0.5 * flash)} />
        <Glow color="#FFFFFF" size={radius * 0.9 * flash + 0.4} opacity={k * flash} />
        <ShockRing t={t} radius={radius * 1.6} duration={0.65} color={color} core={core} width={0.07} flat={false} />
        <ShockRing t={t - 0.12} radius={radius * 1.2} duration={0.6} color="#FF5FD2" core={core} width={0.05} flat={false} />
        <ShockRing t={t} radius={radius * 2.4} duration={0.9} color={color} core={core} width={0.05} flat position={[0, -from[1] + 0.05, 0]} />
        <SparkBurst t={t} size={radius * 0.7} count={60} seed={seed} color={color} hot="#FFFFFF" life={0.7} up={0.5} />
      </group>
    );
  }
  const { len, q } = segmentFrame(from, to);
  const reveal = clamp01(t / 0.12);
  const flare = 1 + 1.4 * flash;
  for (const m of [mats.beam, mats.haze, mats.threadA, mats.threadB]) {
    m.uniforms.uOwnScale.value = len;
    m.uniforms.uTime.value = t;
    m.uniforms.uLen.value = len;
    m.uniforms.uReveal.value = reveal >= 1 ? 2 : reveal;
    m.uniforms.uOpacity.value = k;
  }
  mats.beam.uniforms.uWidth.value = width * flare;
  mats.haze.uniforms.uWidth.value = width * 3 * flare;
  const tr = width * 0.32;
  return (
    <group>
      <group position={from} quaternion={q}>
        <mesh geometry={getUnitLine()} material={mats.haze} scale={len} frustumCulled={false} renderOrder={5} />
        <mesh geometry={getUnitLine()} material={mats.beam} scale={len} frustumCulled={false} renderOrder={6} />
        <group rotation={[0, t * 9, 0]}>
          <mesh geometry={helix} material={mats.threadA} scale={[tr, len, tr]} frustumCulled={false} renderOrder={6} />
        </group>
        <group rotation={[0, -t * 7 + 1.6, 0]}>
          <mesh geometry={helix} material={mats.threadB} scale={[tr * 1.25, len, tr * 1.25]} frustumCulled={false} renderOrder={6} />
        </group>
        {/* Shock rings pulsing out of the source, facing along the beam. */}
        {pulses.map((p, i) =>
          p.alive ? (
            <group key={i} position={[0, p.age * 0.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <ShockRing t={p.age} radius={width * 3.2} duration={1.05} color={color} core={core} width={0.12} flat={false} />
            </group>
          ) : null,
        )}
      </group>
      <Glow color={color} size={width * 5 * flare} opacity={k} position={from} />
      <Glow color="#FFFFFF" size={width * 2 * flare} opacity={k} position={from} />
      {reveal >= 1 ? (
        <group position={to}>
          <Glow color={color} size={width * (7 + Math.sin(t * 37) * 0.8) * flare} opacity={k} />
          <Glow color="#FFFFFF" size={width * 2.6} opacity={k} />
          <SparkBurst t={(t - 0.12) % 0.9} size={width * 2.2} count={40} seed={seed + 3} color={color} hot="#FFFFFF" life={0.75} up={0.3} />
        </group>
      ) : null}
    </group>
  );
};

// =======================================================================================
// Magic circle

const ORANGE = "#FF9A1F";

/** Abstract rune glyph (strokes only, no letters) in a cell of size s centred at the origin. */
const drawRune = (ctx: CanvasRenderingContext2D, kind: number, s: number) => {
  const h = s / 2;
  ctx.beginPath();
  switch (kind % 8) {
    case 0:
      ctx.moveTo(-h * 0.6, h);
      ctx.lineTo(0, -h);
      ctx.lineTo(h * 0.6, h);
      ctx.moveTo(-h * 0.3, h * 0.2);
      ctx.lineTo(h * 0.3, h * 0.2);
      break;
    case 1:
      ctx.moveTo(0, -h);
      ctx.lineTo(0, h);
      ctx.moveTo(-h * 0.6, -h * 0.4);
      ctx.lineTo(0, 0);
      ctx.lineTo(h * 0.6, -h * 0.4);
      break;
    case 2:
      ctx.arc(0, 0, h * 0.55, 0, Math.PI * 2);
      ctx.moveTo(0, -h);
      ctx.lineTo(0, h);
      break;
    case 3:
      ctx.moveTo(-h * 0.6, -h);
      ctx.lineTo(h * 0.6, -h * 0.2);
      ctx.lineTo(-h * 0.6, h * 0.4);
      ctx.lineTo(h * 0.6, h);
      break;
    case 4:
      ctx.moveTo(-h * 0.6, h);
      ctx.lineTo(-h * 0.6, -h);
      ctx.lineTo(h * 0.6, -h);
      ctx.moveTo(-h * 0.6, 0);
      ctx.lineTo(h * 0.3, 0);
      break;
    case 5:
      ctx.moveTo(0, -h);
      ctx.lineTo(h * 0.7, 0);
      ctx.lineTo(0, h);
      ctx.lineTo(-h * 0.7, 0);
      ctx.closePath();
      break;
    case 6:
      ctx.moveTo(-h * 0.6, -h);
      ctx.lineTo(0, -h * 0.2);
      ctx.lineTo(h * 0.6, -h);
      ctx.moveTo(0, -h * 0.2);
      ctx.lineTo(0, h);
      ctx.moveTo(-h * 0.4, h * 0.5);
      ctx.lineTo(h * 0.4, h * 0.5);
      break;
    default:
      ctx.moveTo(-h * 0.6, -h * 0.7);
      ctx.lineTo(h * 0.6, h * 0.7);
      ctx.moveTo(h * 0.6, -h * 0.7);
      ctx.lineTo(-h * 0.6, h * 0.7);
      ctx.moveTo(0, -h);
      ctx.lineTo(0, -h * 0.75);
      break;
  }
  ctx.stroke();
};

/** Outer mandala ring: double circle, rune band, ticks and little orbs (white on black). */
const magicOuterTexture = () =>
  canvasTexture("thanos-magic-outer", 1024, 1024, (ctx, W) => {
    const c = W / 2;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, W);
    ctx.strokeStyle = "#FFFFFF";
    ctx.fillStyle = "#FFFFFF";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const ring = (r: number, w: number) => {
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
    };
    ring(496, 10);
    ring(470, 4);
    ring(388, 8);
    ring(366, 3);
    // Ticks round the outside.
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const r0 = 474;
      const r1 = i % 5 === 0 ? 492 : 484;
      ctx.lineWidth = i % 5 === 0 ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
      ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
      ctx.stroke();
    }
    // Rune band.
    const n = 28;
    ctx.lineWidth = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ctx.save();
      ctx.translate(c + Math.cos(a) * 428, c + Math.sin(a) * 428);
      ctx.rotate(a + Math.PI / 2);
      drawRune(ctx, i * 3 + (i % 3), 48);
      ctx.restore();
    }
    // Orbs where the inner square's corners touch.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * 377, c + Math.sin(a) * 377, 13, 0, Math.PI * 2);
      ctx.fill();
    }
  });

/** Inner mandala: two interlaced squares (an 8-point star), circles and spokes. */
const magicInnerTexture = () =>
  canvasTexture("thanos-magic-inner", 1024, 1024, (ctx, W) => {
    const c = W / 2;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, W);
    ctx.strokeStyle = "#FFFFFF";
    ctx.fillStyle = "#FFFFFF";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const R = 470;
    for (const rot of [0, Math.PI / 4]) {
      ctx.lineWidth = 9;
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) {
        const a = rot + (i / 4) * Math.PI * 2;
        const x = c + Math.cos(a) * R;
        const y = c + Math.sin(a) * R;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.lineWidth = 6;
    for (const r of [330, 300, 150, 120]) {
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Spokes and small runes between the circles.
    ctx.lineWidth = 4;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * 150, c + Math.sin(a) * 150);
      ctx.lineTo(c + Math.cos(a) * 300, c + Math.sin(a) * 300);
      ctx.stroke();
    }
    ctx.lineWidth = 5;
    for (let i = 0; i < 16; i++) {
      const a = ((i + 0.5) / 16) * Math.PI * 2;
      ctx.save();
      ctx.translate(c + Math.cos(a) * 225, c + Math.sin(a) * 225);
      ctx.rotate(a + Math.PI / 2);
      drawRune(ctx, i * 5 + 1, 34);
      ctx.restore();
    }
    // Centre: a small triangle star.
    ctx.lineWidth = 7;
    for (const rot of [-Math.PI / 2, Math.PI / 2]) {
      ctx.beginPath();
      for (let i = 0; i <= 3; i++) {
        const a = rot + (i / 3) * Math.PI * 2;
        const x = c + Math.cos(a) * 100;
        const y = c + Math.sin(a) * 100;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(c, c, 22, 0, Math.PI * 2);
    ctx.fill();
  });

/**
 * Orange spell circle (a rotating mandala) facing +z in the xy plane, centred on the origin:
 * an outer ring of rune glyphs and ticks, an inner 8-point star of interlaced squares with spokes,
 * sparks whizzing round the rim and a few thrown off. `radius` (world units, default 1), `open`
 * 0..1 spins it up from nothing (layers pop in one after the other), `t` = scene clock.
 * Hold it in front of a fin, or lay it on the ground with rotation [-π/2, 0, 0].
 */
export const MagicCircle: React.FC<{ t?: number; radius?: number; open?: number; color?: string; sparks?: boolean }> = ({ t = 0, radius = 1, open = 1, color = ORANGE, sparks = true }) => {
  const mats = useMemo(() => {
    const mk = (tex: THREE.Texture) => additive(new THREE.MeshBasicMaterial({ map: tex, color, toneMapped: false, fog: false, side: THREE.DoubleSide }));
    return { outer: mk(magicOuterTexture()), inner: mk(magicInnerTexture()), glowRing: makeRingMaterial(color, "#FFE2A8") };
  }, [color]);
  const o = clamp01(open);
  if (o <= 0.004) return null;
  const s1 = easeOut(o / 0.6);
  const s2 = easeOut((o - 0.2) / 0.6);
  const flick = 0.9 + 0.1 * Math.sin(t * 19) * Math.sin(t * 7.3);
  mats.outer.opacity = Math.min(1, o * 2) * flick;
  mats.inner.opacity = clamp01((o - 0.2) * 2) * flick;
  const gr = mats.glowRing.uniforms;
  gr.uR.value = 0.77;
  gr.uW.value = 0.035;
  gr.uOpacity.value = 0.9 * o;
  gr.uTime.value = t;
  gr.uWobble.value = 0.2;
  return (
    <group scale={radius}>
      <Glow color={color} size={2.6 * s1} opacity={0.35 * o} />
      {s1 > 0.01 ? (
        <>
          <mesh material={mats.glowRing} geometry={getUnitRing()} scale={s1} rotation={[0, 0, t * 0.6]} renderOrder={6} />
          <mesh material={mats.outer} rotation={[0, 0, t * 0.55]} scale={s1} renderOrder={6}>
            <planeGeometry args={[2, 2]} />
          </mesh>
        </>
      ) : null}
      {s2 > 0.01 ? (
        <mesh material={mats.inner} rotation={[0, 0, -t * 0.9]} scale={s2 * 0.7} renderOrder={6}>
          <planeGeometry args={[2, 2]} />
        </mesh>
      ) : null}
      {sparks ? (
        <>
          <Sparks mode="orbit" count={90} seed={5} time={t} width={0.022} tail={0.35} spin={3.2} spread={0.06} open={s1} arc={1} head="#FFF0C0" tailColor={color} opacity={o} />
          <Sparks mode="fly" count={40} seed={6} time={t} width={0.02} tail={0.06} life={0.5} speed={1.1} gravity={2.2} spread={0.5} spin={3.2} open={s1} head="#FFF0C0" tailColor={color} opacity={o} />
        </>
      ) : null}
    </group>
  );
};

// =======================================================================================
// Frozen debris

/** Instanced material whose emissive follows the per-instance colour (keeps rocks bright). */
const instMatCache = new Map<string, THREE.MeshStandardMaterial>();
const instMat = (rough: number, glow: number, flat: boolean) => {
  const key = `${rough}|${glow}|${flat}`;
  let m = instMatCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: rough, flatShading: flat, emissive: new THREE.Color("#ffffff"), emissiveIntensity: glow });
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n#ifdef USE_COLOR\n\ttotalEmissiveRadiance *= vColor.rgb;\n#endif",
      );
    };
    m.customProgramCacheKey = () => "thanos-inst-emissive";
    instMatCache.set(key, m);
  }
  return m;
};

type Piece = { x: number; y: number; z: number; s: number; vx: number; vz: number; rx: number; ry: number; spin: number; delay: number; phase: number; kind: 0 | 1 | 2; color: THREE.Color };

const ROCK_TONES = ["#8A5A3C", "#6E4A35", "#A0704A", "#5C4033", "#7B6250", "#94806C"];
const DUST_TONE = "#C9A07A";
const SPARK_TONES = ["#FFB02E", "#FF7A1A", "#FFE07A"];

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();

/**
 * Battle debris hanging in mid-air: rocks, dust puffs and glowing sparks spread through a box
 * `area` = [width x, height y, depth z] centred on the origin in x/z (y from 0.4 up to the
 * height). While `frozen` = 1 they hang with a tiny drift (time almost stopped, `t` = scene
 * clock). Ramp `frozen` from 1 to 0 to let time run again: every piece accelerates down and
 * lands on the ground at `ground` (rocks rest there, dust thins away, sparks wink out), each
 * with a small delay, so ramp it over ≈ 0.8-1.2 s (linearly). `count` pieces (≈ 45% rocks,
 * 25% dust, 30% sparks), `size` scales the rocks (default 1: 0.08-0.45 across).
 */
export const FrozenDebris: React.FC<{ t?: number; frozen?: number; area?: V3; count?: number; seed?: number; ground?: number; size?: number }> = ({
  t = 0,
  frozen = 1,
  area = [20, 7, 14],
  count = 80,
  seed = 1,
  ground = 0,
  size = 1,
}) => {
  const pieces = useMemo(() => {
    const rnd = mulberry(seed * 4099 + 11);
    const out: Piece[] = [];
    for (let i = 0; i < count; i++) {
      const r = rnd();
      const kind: 0 | 1 | 2 = r < 0.45 ? 0 : r < 0.7 ? 1 : 2;
      const s = kind === 0 ? 0.04 + Math.pow(rnd(), 2.2) * 0.2 : kind === 1 ? 0.18 + rnd() * 0.35 : 0.025 + rnd() * 0.03;
      const tone = kind === 0 ? ROCK_TONES[Math.floor(rnd() * ROCK_TONES.length)] : kind === 1 ? DUST_TONE : SPARK_TONES[Math.floor(rnd() * 3)];
      out.push({
        x: (rnd() - 0.5) * area[0],
        y: 0.4 + Math.pow(rnd(), 0.8) * (area[1] - 0.4),
        z: (rnd() - 0.5) * area[2],
        s,
        vx: (rnd() - 0.5) * 2,
        vz: (rnd() - 0.5) * 1.4,
        rx: rnd() * 6,
        ry: rnd() * 6,
        spin: (rnd() - 0.5) * 2,
        delay: rnd() * 0.3,
        phase: rnd() * 10,
        kind,
        color: new THREE.Color(tone),
      });
    }
    return out;
  }, [count, seed, area]);
  const geos = useMemo(
    () => ({
      rock: new THREE.DodecahedronGeometry(1, 0),
      dust: new THREE.IcosahedronGeometry(1, 1),
      spark: new THREE.OctahedronGeometry(1, 0),
    }),
    [],
  );
  const mats = useMemo(
    () => ({
      dust: new THREE.MeshStandardMaterial({ color: DUST_TONE, roughness: 1, flatShading: true, transparent: true, depthWrite: false, emissive: new THREE.Color(DUST_TONE), emissiveIntensity: 0.35 }),
      spark: additive(new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false, fog: false })),
    }),
    [],
  );
  const counts = useMemo(() => [0, 1, 2].map((k) => pieces.filter((p) => p.kind === k).length), [pieces]);
  const refs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)];
  const fall = clamp01(1 - frozen);
  const hold = clamp01(frozen);
  mats.dust.opacity = 0.5 * (1 - easeOut(fall * 1.3));
  useLayoutEffect(() => {
    const idx = [0, 0, 0];
    for (const p of pieces) {
      const mesh = refs[p.kind].current;
      if (!mesh) continue;
      const q = clamp01((fall - p.delay) / (1 - p.delay));
      // Frozen: a slow drift along the piece's own velocity plus a tiny bob.
      const drift = 0.025 * (t + p.phase);
      let x = p.x + p.vx * drift;
      let z = p.z + p.vz * drift;
      let y = p.y + 0.03 * Math.sin(t * 0.7 + p.phase) * hold;
      const rest = ground + (p.kind === 0 ? p.s * size * 0.6 : 0);
      x += p.vx * 0.8 * q;
      z += p.vz * 0.8 * q;
      y = y + (rest - y) * q * q;
      let s = p.kind === 0 ? p.s * size : p.s;
      if (p.kind === 1) s *= 1 + 0.6 * q;
      if (p.kind === 2) s *= (1 - q) * (0.75 + 0.25 * Math.sin(t * 9 + p.phase * 3));
      const rot = p.spin * (0.15 * t + 4 * q);
      tmpE.set(p.rx + rot, p.ry + rot * 0.7, rot * 0.4);
      tmpQ.setFromEuler(tmpE);
      tmpP.set(x, y, z);
      if (p.kind === 0) tmpS.set(s * 1.25, s * 0.85, s);
      else tmpS.set(s, s, s);
      tmpM.compose(tmpP, tmpQ, tmpS);
      const i = idx[p.kind]++;
      mesh.setMatrixAt(i, tmpM);
      mesh.setColorAt(i, p.color);
    }
    for (const r of refs) {
      const m = r.current;
      if (!m) continue;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  });
  return (
    <group>
      <instancedMesh ref={refs[0]} args={[geos.rock, instMat(0.9, 0.16, true), counts[0]]} frustumCulled={false} castShadow />
      {mats.dust.opacity > 0.01 ? <instancedMesh ref={refs[1]} args={[geos.dust, mats.dust, counts[1]]} frustumCulled={false} /> : null}
      <instancedMesh ref={refs[2]} args={[geos.spark, mats.spark, counts[2]]} frustumCulled={false} renderOrder={6} />
    </group>
  );
};

// =======================================================================================
// Ground crack and burst

type Cell = { geo: THREE.BufferGeometry; c: THREE.Vector3; r: number; dir: THREE.Vector3; up: number; out: number; spin: V3; tilt: number };

/** Flat ribbons along ground polylines (xz plane), with a per-vertex distance from the centre. */
const groundStrip = (paths: { pts: THREE.Vector2[]; w: number[] }[], width: number) => {
  const pos: number[] = [];
  const side: number[] = [];
  const dist: number[] = [];
  const idx: number[] = [];
  let base = 0;
  for (const { pts, w } of paths) {
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      const tx = b.x - a.x;
      const ty = b.y - a.y;
      const l = Math.hypot(tx, ty) || 1;
      const nx = -ty / l;
      const ny = tx / l;
      for (const s of [-1, 1]) {
        const hw = (width * w[i] * s) / 2;
        pos.push(pts[i].x + nx * hw, 0, pts[i].y + ny * hw);
        side.push(s);
        dist.push(pts[i].length());
      }
      if (i < n - 1) {
        const k = base + i * 2;
        idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    base += n * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute("aDist", new THREE.Float32BufferAttribute(dist, 1));
  g.setIndex(idx);
  return g;
};

const CRACK_VERT = /* glsl */ `
attribute float aSide;
attribute float aDist;
varying float vSide;
varying float vDist;
void main() {
  vSide = aSide;
  vDist = aDist;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const CRACK_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uCore;
uniform float uReach;
uniform float uOpacity;
uniform float uTime;
uniform float uDark;
uniform vec3 uDarkColor;
varying float vSide;
varying float vDist;
void main() {
  if (vDist > uReach) discard;
  float d = abs(vSide);
  float front = smoothstep(uReach - 0.12, uReach, vDist);
  if (uDark > 0.5) {
    if (d > 0.42) discard;
    gl_FragColor = vec4(uDarkColor, 1.0);
    #include <colorspace_fragment>
    return;
  }
  float core = 1.0 - smoothstep(0.1, 0.2, d);
  float glow = pow(1.0 - d, 2.5);
  float pulse = 0.8 + 0.2 * sin(uTime * 9.0 - vDist * 12.0);
  vec3 col = (uColor * glow * 0.9 + uCore * core) * pulse + uCore * front * glow;
  gl_FragColor = vec4(col * uOpacity, 1.0);
  #include <colorspace_fragment>
}`;

const crackMaterial = (dark: boolean, color: string) => {
  const m = new THREE.ShaderMaterial({
    vertexShader: CRACK_VERT,
    fragmentShader: CRACK_FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uCore: { value: new THREE.Color("#FFF0FF") },
      uReach: { value: 0 },
      uOpacity: { value: 1 },
      uTime: { value: 0 },
      uDark: { value: dark ? 1 : 0 },
      uDarkColor: { value: new THREE.Color("#1A0D12") },
    },
    toneMapped: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  if (dark) {
    m.transparent = true;
    m.depthWrite = false;
    return m;
  }
  return additive(m);
};

/** Crack network on the unit disc: jagged rays with forks and two broken rings (xz plane). */
const crackNetwork = (seed: number) => {
  const rnd = mulberry(seed * 313 + 5);
  const nRays = 7 + Math.floor(rnd() * 2);
  const angles: number[] = [];
  for (let k = 0; k < nRays; k++) angles.push(((k + 0.15 + rnd() * 0.7) / nRays) * Math.PI * 2);
  const rays: THREE.Vector2[][] = angles.map((a) => {
    const pts: THREE.Vector2[] = [];
    const steps = 11;
    let wobble = 0;
    for (let i = 0; i <= steps; i++) {
      const r = 0.04 + (0.96 * i) / steps;
      wobble += (rnd() - 0.5) * 0.22;
      wobble *= 0.8;
      const aa = a + wobble * (0.35 / Math.max(0.25, r));
      pts.push(new THREE.Vector2(Math.cos(aa) * r, Math.sin(aa) * r));
    }
    return pts;
  });
  const paths: { pts: THREE.Vector2[]; w: number[] }[] = rays.map((pts) => ({ pts, w: pts.map((_, i) => 1.15 - (0.8 * i) / (pts.length - 1)) }));
  // Forks off each ray.
  rays.forEach((ray) => {
    const nf = 1 + Math.floor(rnd() * 2);
    for (let f = 0; f < nf; f++) {
      const i0 = 3 + Math.floor(rnd() * 6);
      const p0 = ray[i0];
      const base = Math.atan2(p0.y, p0.x) + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.4);
      const len = 0.15 + rnd() * 0.25;
      const pts = [p0.clone()];
      let a = base;
      for (let i = 1; i <= 5; i++) {
        a += (rnd() - 0.5) * 0.6;
        const prev = pts[pts.length - 1];
        pts.push(new THREE.Vector2(prev.x + Math.cos(a) * (len / 5), prev.y + Math.sin(a) * (len / 5)));
      }
      paths.push({ pts, w: pts.map((_, i) => 0.65 * (1 - i / 6) + 0.1) });
    }
  });
  // Broken rings joining neighbouring rays (they outline the chunks that blow out).
  for (const ringR of [0.42, 0.74]) {
    rays.forEach((ray, k) => {
      if (rnd() < 0.25) return;
      const next = rays[(k + 1) % rays.length];
      const i = Math.round(((ringR - 0.04) / 0.96) * 11);
      const a0 = Math.atan2(ray[i].y, ray[i].x);
      let a1 = Math.atan2(next[i].y, next[i].x);
      if (a1 < a0) a1 += Math.PI * 2;
      const pts: THREE.Vector2[] = [];
      for (let s = 0; s <= 6; s++) {
        const a = a0 + ((a1 - a0) * s) / 6;
        const r = ringR * (1 + (s > 0 && s < 6 ? (rnd() - 0.5) * 0.08 : 0));
        pts.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
      }
      paths.push({ pts, w: pts.map(() => 0.55) });
    });
  }
  return { rays, angles, paths };
};

/** Ground slabs between the rays (two rings of chunks), each centred on its own centroid. */
const crackCells = (rays: THREE.Vector2[][], seed: number): Cell[] => {
  const rnd = mulberry(seed * 977 + 3);
  const cells: Cell[] = [];
  const bands: [number, number][] = [
    [0.06, 0.42],
    [0.42, 0.74],
  ];
  const at = (ray: THREE.Vector2[], r: number) => {
    const f = ((r - 0.04) / 0.96) * 11;
    const i = Math.max(0, Math.min(10, Math.floor(f)));
    return ray[i].clone().lerp(ray[i + 1], f - i);
  };
  rays.forEach((ray, k) => {
    const next = rays[(k + 1) % rays.length];
    bands.forEach(([r0, r1], b) => {
      const pts: THREE.Vector2[] = [];
      const steps = 4;
      for (let s = 0; s <= steps; s++) pts.push(at(ray, r0 + ((r1 - r0) * s) / steps));
      for (let s = 0; s <= steps; s++) pts.push(at(next, r1 - ((r1 - r0) * s) / steps));
      const c = pts.reduce((acc, p) => acc.add(p), new THREE.Vector2()).multiplyScalar(1 / pts.length);
      // Shrink a touch so the slabs show gaps (the cracks) between them.
      const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2((p.x - c.x) * 0.9, -(p.y - c.y) * 0.9)));
      const depth = 0.1 + rnd() * 0.06;
      const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1, curveSegments: 1 });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, -depth - 0.015, 0);
      const r = c.length();
      cells.push({
        geo,
        c: new THREE.Vector3(c.x, 0, c.y),
        r,
        dir: new THREE.Vector3(c.x, 0, c.y).normalize(),
        up: (b === 0 ? 2.4 : 1.7) * (0.8 + rnd() * 0.5),
        out: (b === 0 ? 0.7 : 1.1) * (0.7 + rnd() * 0.6),
        spin: [(rnd() - 0.5) * 6, (rnd() - 0.5) * 4, (rnd() - 0.5) * 6],
        tilt: 0.25 + rnd() * 0.3,
      });
    });
  });
  return cells;
};

const craterTexture = () =>
  canvasTexture("thanos-crater", 256, 256, (ctx, W) => {
    const g = ctx.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
    g.addColorStop(0, "rgba(20,8,16,1)");
    g.addColorStop(0.5, "rgba(40,18,22,0.95)");
    g.addColorStop(0.78, "rgba(70,36,28,0.6)");
    g.addColorStop(1, "rgba(70,36,28,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, W);
  });

/**
 * The ground splitting open under the stones' power, on the ground plane (y = 0) around the
 * origin. `crack` 0..1 spreads glowing jagged cracks out from the centre to `radius` (forks and
 * two broken rings appear as they pass); `burst` 0..1 then blows it up: the slabs between the
 * cracks heave up (0..0.15) and fly outwards spinning (lands ≈ 0.9), with a flash, an energy
 * column, a shock ring, dust and sparks, leaving a dark crater. Ramp `burst` over ≈ 1.2 s.
 * `t` = scene clock (glow pulse), `color` = crack glow (default stone purple), `ground` = slab
 * top colour (default: the Battlefield dirt).
 */
export const GroundCrack: React.FC<{ crack?: number; burst?: number; radius?: number; seed?: number; t?: number; color?: string; ground?: string }> = ({
  crack = 1,
  burst = 0,
  radius = 4,
  seed = 1,
  t = 0,
  color = "#B04CFF",
  ground = "#A26E46",
}) => {
  const data = useMemo(() => {
    const net = crackNetwork(seed);
    return {
      dark: groundStrip(net.paths, 0.05),
      glow: groundStrip(net.paths, 0.13),
      cells: crackCells(net.rays, seed),
    };
  }, [seed]);
  const mats = useMemo(
    () => ({
      dark: crackMaterial(true, color),
      glow: crackMaterial(false, color),
      top: new THREE.MeshStandardMaterial({ color: ground, roughness: 0.95, flatShading: true, emissive: new THREE.Color(ground), emissiveIntensity: 0.14 }),
      side: new THREE.MeshStandardMaterial({ color: "#5A3828", roughness: 1, flatShading: true, emissive: new THREE.Color("#5A3828"), emissiveIntensity: 0.12 }),
      crater: new THREE.MeshBasicMaterial({ map: craterTexture(), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      column: makeStripMaterial({ color, core: "#FFFFFF", width: 1, coreWidth: 0.3, glow: 1 }),
      dust: new THREE.MeshStandardMaterial({ color: "#B08A68", roughness: 1, flatShading: true, transparent: true, depthWrite: false, emissive: new THREE.Color("#B08A68"), emissiveIntensity: 0.3 }),
    }),
    [color, ground],
  );
  const puff = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const c = clamp01(crack);
  const b = clamp01(burst);
  if (c <= 0.001 && b <= 0.001) return null;
  const reach = c * 1.08;
  const glowK = b > 0 ? 1 - clamp01((b - 0.25) / 0.5) : 1;
  for (const m of [mats.dark, mats.glow]) {
    m.uniforms.uReach.value = reach;
    m.uniforms.uTime.value = t;
  }
  mats.glow.uniforms.uOpacity.value = (0.85 + 0.15 * Math.sin(t * 13)) * glowK * (1 + 1.5 * clamp01(b / 0.12) * (b < 0.2 ? 1 : 0));
  mats.dark.uniforms.uOpacity.value = 1;
  const heave = clamp01(b / 0.15);
  const fly = clamp01((b - 0.12) / 0.88);
  const tau = fly * 1.5;
  const flash = b > 0 ? Math.exp(-Math.abs(b - 0.14) / 0.06) : 0;
  mats.dust.opacity = 0.7 * clamp01(b / 0.1) * (1 - clamp01((b - 0.35) / 0.65));
  const colU = mats.column.uniforms;
  const colK = b > 0.1 ? Math.max(0, 1 - (b - 0.1) / 0.45) : 0;
  colU.uOwnScale.value = radius * 2.2;
  colU.uOpacity.value = colK;
  colU.uWidth.value = radius * 0.55 * (0.4 + colK);
  return (
    <group>
      {/* Cracks (hidden once the slabs have flown). */}
      {b < 0.4 ? (
        <group scale={radius} position={[0, 0.012, 0]}>
          <mesh geometry={data.dark} material={mats.dark} renderOrder={2} />
          <mesh geometry={data.glow} material={mats.glow} renderOrder={6} />
        </group>
      ) : null}
      {b > 0.001 ? (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={radius * 1.75 * Math.min(1, b * 6)} material={mats.crater} renderOrder={1}>
            <circleGeometry args={[1, 48]} />
          </mesh>
          {data.cells.map((cell, i) => {
            const lift = 0.06 * heave * radius;
            const out = cell.out * tau * radius;
            const yFly = (cell.up * tau - 1.25 * tau * tau) * radius;
            const y = Math.max(0.02 * radius, lift + yFly);
            const tilt = cell.tilt * heave + 0;
            const rot: V3 = [cell.spin[0] * tau, cell.spin[1] * tau, cell.spin[2] * tau];
            const tangentAxis = new THREE.Vector3(-cell.dir.z, 0, cell.dir.x);
            const qTilt = new THREE.Quaternion().setFromAxisAngle(tangentAxis, -tilt);
            const qSpin = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot));
            const qq = qTilt.multiply(qSpin);
            return (
              <group key={i} position={[(cell.c.x + cell.dir.x * out / radius) * radius, y, (cell.c.z + cell.dir.z * out / radius) * radius]} quaternion={qq}>
                <mesh geometry={cell.geo} material={[mats.top, mats.side]} scale={radius} castShadow />
              </group>
            );
          })}
          {/* Energy column and flash. */}
          {colK > 0.01 ? (
            <mesh geometry={getUnitLine()} material={mats.column} scale={radius * 2.2} frustumCulled={false} renderOrder={6} />
          ) : null}
          <Glow color={color} size={radius * 4 * (0.5 + flash)} opacity={Math.min(1, flash * 1.2 + colK * 0.4)} position={[0, radius * 0.3, 0]} />
          <Glow color="#FFFFFF" size={radius * 2 * flash} opacity={flash} position={[0, radius * 0.25, 0]} />
          <ShockRing t={b * 1.2 - 0.12} radius={radius * 2.6} duration={0.7} color={color} width={0.05} position={[0, 0.06, 0]} />
          {/* Dust ring rolling outwards. */}
          {mats.dust.opacity > 0.01
            ? Array.from({ length: 14 }).map((_, i) => {
                const a = (i / 14) * Math.PI * 2 + hash(i + seed) * 0.4;
                const r = radius * (0.5 + 1.3 * easeOut(b * 1.6)) * (0.85 + 0.3 * hash(i * 3.1));
                const s = radius * (0.25 + 0.35 * easeOut(b * 2)) * (0.7 + 0.6 * hash(i * 7.7));
                return <mesh key={i} geometry={puff} material={mats.dust} position={[Math.cos(a) * r, s * 0.6 + b * radius * 0.3, Math.sin(a) * r]} scale={s} rotation={[i, i * 2, 0]} />;
              })
            : null}
          <group position={[0, 0.1, 0]}>
            <SparkBurst t={b * 1.4 - 0.15} size={radius * 0.9} count={90} seed={seed + 11} color={color} hot="#FFFFFF" life={0.9} up={0.65} />
          </group>
        </>
      ) : null}
    </group>
  );
};


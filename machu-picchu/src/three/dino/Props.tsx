import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry } from "../noise";
import { V3, canvasTexture, gold, noise3, paintGeo, planarUV, shadeHex, toy, useFontsReady, useRounded, vertexMat } from "../inca/kit";
import { Flame, Halo, Smoke } from "../oxigeno/Props";

// Props for the dinosaur short. Everything is in WORLD units sized for Nubi at size 2 (Nubi is
// then 2 wide and ≈ 2 tall: body top at y = 1.98, eyes at y ≈ 1.1), ground at y = 0, front = +z.
// If Nubi is drawn at another size s, wrap a prop in <group scale={s / 2}>. Held props go in
// Nubi's fin-tip space (model units: 1 world unit at size 2 = 5 model units), see *_HOLD_R.
// `t` is time in seconds (frame / fps).

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const basicCache = new Map<string, THREE.MeshBasicMaterial>();
/** Unlit flat colour (glows, glints). Cached; never mutate. */
const basic = (color: string, opacity = 1) => {
  const key = `${color}|${opacity}`;
  let m = basicCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      color,
      toneMapped: false,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
    });
    basicCache.set(key, m);
  }
  return m;
};

const texMatCache = new Map<THREE.Texture, THREE.MeshStandardMaterial>();
/** Printed material for a canvas texture (emissive map keeps it bright). Cached per texture. */
const printMat = (tex: THREE.Texture, rough = 0.55, glow = 0.18) => {
  let m = texMatCache.get(tex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: rough,
      transparent: true,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tex,
      emissiveIntensity: glow,
    });
    texMatCache.set(tex, m);
  }
  return m;
};

/** Sets a per-instance toy-style material's colour (base + matching emissive). */
const tint = (m: THREE.MeshStandardMaterial, color: THREE.Color) => {
  m.color.copy(color);
  m.emissive.copy(color);
};

const lerpColors = (stops: string[], k: number) => {
  const cols = stops.map((s) => new THREE.Color(s));
  const x = clamp01(k) * (cols.length - 1);
  const i = Math.min(cols.length - 2, Math.floor(x));
  return cols[i].clone().lerp(cols[i + 1], x - i);
};

const TITLE = "'Luckiest Guy', 'Lilita One', sans-serif";

/**
 * Cartoon pizza slice for canvas logos: tip pointing down at (cx, cy + s/2), crust along the
 * top; `s` is the slice height in pixels.
 */
export const drawPizzaSlice = (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) => {
  const top = cy - s * 0.42;
  const tip = cy + s * 0.5;
  const hw = s * 0.44;
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineWidth = s * 0.05;
  ctx.strokeStyle = "#7A3A12";
  ctx.fillStyle = "#FFD23F";
  ctx.beginPath();
  ctx.moveTo(cx - hw, top);
  ctx.lineTo(cx + hw, top);
  ctx.lineTo(cx, tip);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Melty drips.
  ctx.fillStyle = "#FFD23F";
  for (const [dx, len] of [
    [-0.18, 0.2],
    [0.14, 0.14],
  ]) {
    ctx.beginPath();
    ctx.ellipse(cx + dx * s, top + s * (0.42 + len), s * 0.045, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#E0322B";
  for (const [dx, dy, r] of [
    [-0.17, 0.2, 0.085],
    [0.15, 0.17, 0.08],
    [0.0, 0.48, 0.075],
  ]) {
    ctx.beginPath();
    ctx.arc(cx + dx * s, top + dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#D9832E";
  ctx.strokeStyle = "#7A3A12";
  ctx.beginPath();
  ctx.roundRect(cx - hw - s * 0.07, top - s * 0.16, (hw + s * 0.07) * 2, s * 0.2, s * 0.1);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};

// =======================================================================================
// Asteroid

const CRATERS = (
  [
    [0.4, 0.6, 0.7, 0.42],
    [-0.7, 0.2, 0.5, 0.34],
    [0.2, -0.8, 0.3, 0.38],
    [-0.3, -0.2, -0.9, 0.46],
    [0.9, -0.1, -0.3, 0.3],
    [-0.5, 0.8, -0.3, 0.28],
  ] as [number, number, number, number][]
).map(([x, y, z, r]) => ({ d: new THREE.Vector3(x, y, z).normalize(), r }));

/** Lumpy radius of the unit rock along a unit direction (noise plus a few craters). */
const rockRadius = (d: THREE.Vector3) => {
  let r = 1 + 0.2 * noise3(d.x * 1.3 + 2.1, d.y * 1.3, d.z * 1.3 - 1.7) + 0.07 * noise3(d.x * 3.4, d.y * 3.4 + 5, d.z * 3.4);
  for (const c of CRATERS) {
    const a = Math.acos(Math.max(-1, Math.min(1, d.dot(c.d))));
    if (a < c.r) r -= 0.14 * (1 - (a / c.r) ** 2);
    else if (a < c.r * 1.45) r += 0.05 * (1 - (a - c.r) / (c.r * 0.45));
  }
  return r;
};

let rockGeo: THREE.BufferGeometry | null = null;
/** Low-poly rock (radius ≈ 1), one flat colour per face. */
const getRockGeo = () => {
  if (rockGeo) return rockGeo;
  const g = new THREE.IcosahedronGeometry(1, 4);
  const p = g.attributes.position;
  const d = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    d.fromBufferAttribute(p, i).normalize();
    const r = rockRadius(d);
    p.setXYZ(i, d.x * r, d.y * r, d.z * r);
  }
  const pal = ["#4E443C", "#5E5249", "#3E3630", "#6B5E52", "#574B42"].map((c) => new THREE.Color(c));
  const col = new Float32Array(p.count * 3);
  for (let f = 0; f < p.count; f += 3) {
    const cx = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3;
    const cy = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3;
    const cz = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3;
    const n = noise3(cx * 2.4, cy * 2.4, cz * 2.4);
    const c = pal[Math.max(0, Math.min(pal.length - 1, Math.floor((n + 0.7) * 3.2)))];
    for (let k = 0; k < 3; k++) {
      col[(f + k) * 3] = c.r;
      col[(f + k) * 3 + 1] = c.g;
      col[(f + k) * 3 + 2] = c.b;
    }
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  rockGeo = g;
  return g;
};

let crackGeo: THREE.BufferGeometry | null = null;
/** Glowing cracks: thin tubes wandering over the rock's surface. */
const getCrackGeo = () => {
  if (crackGeo) return crackGeo;
  const rnd = mulberry(606);
  const geos: THREE.BufferGeometry[] = [];
  const rv = () => new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5);
  for (let c = 0; c < 10; c++) {
    let dir = rv().normalize();
    let head = rv().cross(dir).normalize();
    const pts: THREE.Vector3[] = [];
    const steps = 5 + Math.floor(rnd() * 3);
    for (let s = 0; s < steps; s++) {
      pts.push(dir.clone().multiplyScalar(rockRadius(dir) + 0.012));
      head.applyAxisAngle(dir, (rnd() - 0.5) * 1.3);
      const axis = new THREE.Vector3().crossVectors(dir, head).normalize();
      dir = dir.clone().applyAxisAngle(axis, 0.19 + rnd() * 0.08).normalize();
      head = new THREE.Vector3().crossVectors(axis, dir).normalize();
    }
    geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps * 6, 0.034, 5, false));
  }
  const merged = mergeGeometries(geos);
  if (!merged) throw new Error("crack merge failed");
  crackGeo = merged;
  return merged;
};

let trailGeo: THREE.LatheGeometry | null = null;
/** Comet teardrop along +y: rounded base at y = 0, widest (r = 0.5) at y ≈ 0.21, tip at y = 1. */
const getTrailGeo = () => {
  if (trailGeo) return trailGeo;
  const pts: THREE.Vector2[] = [];
  const N = 32;
  const peak = Math.pow(0.208, 0.42) * Math.pow(0.792, 1.6);
  for (let i = 0; i <= N; i++) {
    const h = i / N;
    const r = i === 0 || i === N ? 0 : (0.5 * Math.pow(h, 0.42) * Math.pow(1 - h, 1.6)) / peak;
    pts.push(new THREE.Vector2(r, h));
  }
  trailGeo = new THREE.LatheGeometry(pts, 28);
  return trailGeo;
};

/** Trail layers: colour, opacity, width and length (× rock radius), render order. */
const TRAIL: [string, number, number, number, number][] = [
  ["#FFF6D0", 1, 1.35, 1.9, 0],
  ["#FFE45C", 1, 1.85, 3.0, 0],
  ["#FF9A1A", 0.82, 2.4, 4.3, 2],
  ["#FF4A1A", 0.55, 2.95, 5.7, 3],
];
const TONGUES = 7;

/**
 * Asteroid: a lumpy dark low-poly rock with glowing lava cracks and a big flaming trail (layered
 * fire, flickering flame tongues and a sooty smoke trail) streaming behind it along its local
 * -z, so it flies towards +z. `size` = rock diameter (default 1.2); the fire is ≈ 3 × size long
 * and the smoke runs ≈ 6 × size further. To fly along a direction `dir`, point local +z at it:
 * <group quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)}>.
 * Towards the camera (+z) the fire shows as a blazing ring round the rock. `fire` 0..1 (0 = a cold
 * rock with dull cracks), `t` seconds (flicker, smoke, slow tumble).
 */
export const Asteroid: React.FC<{ size?: number; fire?: number; t?: number }> = ({ size = 1.2, fire = 1, t = 0 }) => {
  const k = clamp01(fire);
  const crackMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), []);
  crackMat.color.copy(lerpColors(["#5A2412", "#C8481A", "#FFB02E"], 0.25 + 0.75 * k));
  const layerMats = useMemo(
    () =>
      TRAIL.map(
        ([c, o]) =>
          new THREE.MeshBasicMaterial({
            color: c,
            transparent: o < 1,
            opacity: o,
            depthWrite: o >= 1,
            toneMapped: false,
          }),
      ),
    [],
  );
  const f = (i: number) => 1 + 0.08 * Math.sin(t * 14 + i * 1.9) + 0.05 * Math.sin(t * 23 + i * 0.7);
  const len = 0.3 + 0.7 * k;
  const wid = 0.6 + 0.4 * k;
  return (
    <group scale={size / 2}>
      <group rotation={[t * 0.5, t * 0.8, t * 0.2]} scale={[1.12, 0.92, 1]}>
        <mesh geometry={getRockGeo()} material={vertexMat(0.95, true, 0.1)} castShadow />
        <mesh geometry={getCrackGeo()} material={crackMat} />
      </group>
      {k > 0.01 ? (
        // Trail frame: +y points backwards (-z).
        <group rotation={[-Math.PI / 2, 0, 0]}>
          {TRAIL.map(([, , w, l, order], i) => (
            <mesh
              key={i}
              geometry={getTrailGeo()}
              material={layerMats[i]}
              position={[0, -0.55, 0]}
              rotation={[0.05 * Math.sin(t * 5 + i), 0, 0.05 * Math.sin(t * 6.3 + i * 2)]}
              scale={[w * wid, l * len * f(i), w * wid]}
              renderOrder={order}
            />
          ))}
          {Array.from({ length: TONGUES }).map((_, i) => {
            const a = (i / TONGUES) * Math.PI * 2 + 0.4;
            const h = (1.6 + 0.9 * ((i * 5) % 3) * 0.5) * len;
            return (
              <group key={i} position={[Math.cos(a) * 0.72, 0.1, Math.sin(a) * 0.72]} rotation={[Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35]}>
                <Flame height={h} width={0.55 * wid} amount={k} t={t} seed={i * 3.3} halo={0} />
              </group>
            );
          })}
          <group position={[0, 2.4, 0]}>
            <Smoke t={t} amount={k} height={12} r0={0.4} r1={1.5} count={14} speed={7} wobble={0.35} drift={0} color="#6A6460" opacity={0.85} seed={3} />
          </group>
        </group>
      ) : null}
      <Halo color="#FF8A2A" size={5.5 * (0.5 + 0.5 * k)} opacity={0.5 * k} />
    </group>
  );
};

// =======================================================================================
// Telescope

const TELE = { pivotY: 1.45, back: -0.86, front: 1.08 };

/**
 * Eyepiece position in telescope space for a given tilt: stand Nubi (size 2, facing +x with
 * rotationY = π/2) with its face there, e.g. Nubi at [eyepiece.x - 0.95, 0, 0].
 */
export const telescopeEyepiece = (tilt = 0.55): V3 => [Math.cos(tilt) * TELE.back, TELE.pivotY + Math.sin(tilt) * TELE.back, 0];

/**
 * Cute brass telescope on a wooden tripod, about Nubi's height (pivot at y 1.45, front lens at
 * y ≈ 2.0 with the default tilt). The tube points towards +x (screen-right) and is raised by
 * `tilt` radians (0 = level, default 0.55); the eyepiece is at the -x end, ≈ Nubi's eye height:
 * see telescopeEyepiece(tilt). Turn the whole group round y to aim it elsewhere.
 */
export const Telescope: React.FC<{ tilt?: number }> = ({ tilt = 0.55 }) => {
  const geos = useMemo(() => {
    const X = (g: THREE.BufferGeometry) => g.rotateZ(-Math.PI / 2);
    const ringX = (g: THREE.BufferGeometry) => g.rotateY(Math.PI / 2);
    return {
      main: X(new THREE.CylinderGeometry(0.155, 0.13, 1.1, 32)),
      dew: X(new THREE.CylinderGeometry(0.205, 0.19, 0.36, 32, 1, true)),
      dewBack: ringX(new THREE.CircleGeometry(0.2, 32)),
      lens: ringX(new THREE.CircleGeometry(0.17, 32)),
      glint: ringX(new THREE.CircleGeometry(0.05, 12)),
      ring: ringX(new THREE.TorusGeometry(0.2, 0.032, 8, 32)),
      ringS: ringX(new THREE.TorusGeometry(0.145, 0.03, 8, 28)),
      draw1: X(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 24)),
      draw2: X(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 20)),
      cup: X(new THREE.CylinderGeometry(0.082, 0.07, 0.08, 20)),
      finder: X(new THREE.CylinderGeometry(0.05, 0.045, 0.38, 14)),
      knob: new THREE.CylinderGeometry(0.045, 0.045, 0.06, 12).rotateX(Math.PI / 2),
      leg: new THREE.CylinderGeometry(0.032, 0.048, 1, 10),
      foot: new THREE.SphereGeometry(0.06, 12, 8),
      hub: new THREE.CylinderGeometry(0.13, 0.16, 0.16, 20),
      tray: new THREE.CylinderGeometry(0.36, 0.36, 0.035, 28),
      axle: new THREE.CylinderGeometry(0.06, 0.06, 0.52, 14).rotateX(Math.PI / 2),
    };
  }, []);
  const arm = useRounded(0.1, 0.34, 0.05, 0.02, 1);
  const base = useRounded(0.14, 0.06, 0.48, 0.02, 1);
  const bracket = useRounded(0.04, 0.12, 0.04, 0.012, 1);
  const brass = toy("#E0A93F", { metal: 0.55, rough: 0.3, glow: 0.2 });
  const brassDark = toy("#B97F22", { metal: 0.55, rough: 0.32, glow: 0.16 });
  const navy = toy("#2F52C4", { rough: 0.35, glow: 0.18, side: THREE.DoubleSide });
  const chrome = toy("#DCE3EA", { metal: 0.7, rough: 0.25, glow: 0.12 });
  const dark = toy("#2B2F38", { rough: 0.5 });
  const wood = toy("#A86A36", { rough: 0.6 });
  const legs = useMemo(
    () =>
      [Math.PI, Math.PI * (5 / 3), Math.PI * (1 / 3)].map((a) => {
        const top = new THREE.Vector3(Math.sin(a) * 0.08, 1.16, Math.cos(a) * 0.08);
        const foot = new THREE.Vector3(Math.sin(a) * 0.72, 0.05, Math.cos(a) * 0.72);
        const dir = top.clone().sub(foot);
        return {
          mid: foot.clone().add(top).multiplyScalar(0.5),
          len: dir.length(),
          q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
          foot,
        };
      }),
    [],
  );
  return (
    <group>
      {legs.map((l, i) => (
        <group key={i}>
          <mesh geometry={geos.leg} material={wood} position={l.mid} quaternion={l.q} scale={[1, l.len, 1]} castShadow />
          <mesh geometry={geos.foot} material={brassDark} position={l.foot} />
        </group>
      ))}
      <mesh geometry={geos.tray} material={toy("#8A5328", { rough: 0.6 })} position={[0, 0.5, 0]} />
      <mesh geometry={geos.hub} material={brassDark} position={[0, 1.2, 0]} castShadow />
      {/* Fork mount. */}
      <mesh geometry={base} material={brass} position={[0, 1.3, 0]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={arm} material={brass} position={[0, 1.44, s * 0.22]} />
      ))}
      <mesh geometry={geos.axle} material={brassDark} position={[0, TELE.pivotY, 0]} />
      {/* The tube, raised by `tilt` round the fork's axle. */}
      <group position={[0, TELE.pivotY, 0]} rotation={[0, 0, tilt]}>
        <mesh geometry={geos.main} material={brass} position={[0.2, 0, 0]} castShadow />
        <mesh geometry={geos.ringS} material={brassDark} position={[-0.32, 0, 0]} />
        <mesh geometry={geos.ringS} material={dark} position={[0, 0, 0]} scale={[1.08, 1.08, 1.08]} />
        <mesh geometry={geos.dew} material={navy} position={[0.9, 0, 0]} castShadow />
        <mesh geometry={geos.dewBack} material={dark} position={[0.74, 0, 0]} />
        <mesh geometry={geos.ring} material={brass} position={[0.73, 0, 0]} />
        <mesh geometry={geos.ring} material={brass} position={[1.07, 0, 0]} />
        <mesh geometry={geos.lens} material={toy("#7FDBFF", { rough: 0.08, glow: 0.5 })} position={[0.98, 0, 0]} />
        <mesh geometry={geos.glint} material={basic("#FFFFFF")} position={[0.985, 0.07, 0.06]} />
        <mesh geometry={geos.draw1} material={chrome} position={[-0.5, 0, 0]} />
        <mesh geometry={geos.draw2} material={brass} position={[-0.72, 0, 0]} />
        <mesh geometry={geos.cup} material={dark} position={[-0.83, 0, 0]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={geos.knob} material={brassDark} position={[-0.46, -0.1, s * 0.12]} />
        ))}
        {/* Finder scope on top. */}
        <mesh geometry={geos.finder} material={brass} position={[0.25, 0.27, 0]} />
        <mesh geometry={bracket} material={brassDark} position={[0.12, 0.2, 0]} />
        <mesh geometry={bracket} material={brassDark} position={[0.38, 0.2, 0]} />
      </group>
    </group>
  );
};

// =======================================================================================
// Pizza box

/** Box size at scale 1 (world units). */
export const PIZZA_BOX = { w: 1.2, h: 0.16, d: 1.2 };
/** Where a raptor's jaws grab the closed box (box space, scale 1): the middle of the front edge. */
export const PIZZA_GRIP: V3 = [0, 0.09, 0.62];

const pizzaTopTexture = () =>
  canvasTexture("dino-pizza-top", 512, 512, (ctx, W, H) => {
    const cx = W / 2;
    const cy = H / 2;
    ctx.fillStyle = "#D9442B";
    ctx.beginPath();
    ctx.arc(cx, cy, 250, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFCF4A";
    ctx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      const r = 222 + 10 * Math.sin(a * 9) + 5 * Math.sin(a * 23);
      if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.fill();
    const rnd = mulberry(55);
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * 190;
      ctx.fillStyle = rnd() < 0.5 ? "rgba(226,150,44,0.55)" : "rgba(255,236,150,0.7)";
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 14 + rnd() * 16, 8 + rnd() * 10, rnd() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(160,96,30,0.6)";
    ctx.lineWidth = 7;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 236, cy + Math.sin(a) * 236);
      ctx.stroke();
    }
  });

const lidTexture = () =>
  canvasTexture("dino-pizza-lid", 512, 512, (ctx, W, H) => {
    ctx.fillStyle = "#E6BA7C";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(150,96,40,0.35)";
    ctx.lineWidth = 6;
    ctx.strokeRect(16, 16, W - 32, H - 32);
    const cx = W / 2;
    const cy = 238;
    ctx.fillStyle = "#E3262B";
    ctx.beginPath();
    ctx.arc(cx, cy, 200, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, 178, 0, Math.PI * 2);
    ctx.stroke();
    drawPizzaSlice(ctx, cx, cy - 34, 190);
    ctx.font = `92px ${TITLE}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("PIZZA", cx, cy + 118);
    ctx.font = `54px ${TITLE}`;
    ctx.fillStyle = "#B8141B";
    ctx.fillText("¡CALIENTE!", cx, 478);
  });

const PEPPERONI: [number, number][] = [
  [0.0, 0.0],
  [0.24, 0.1],
  [-0.2, 0.2],
  [-0.08, -0.26],
  [0.2, -0.2],
  [-0.3, -0.06],
  [0.06, 0.32],
  [0.33, -0.02],
];

/**
 * Pizza box: 1.2 × 1.2 (x, z), 0.16 tall at scale 1, kraft cardboard with a red "PIZZA" logo on
 * the lid, hinged at the back edge. `open` 0..1 swings the lid up and back (1 ≈ 112°) showing
 * a pepperoni pizza inside. Origin at the middle of the bottom; the lid logo reads from the front
 * (+z). Placements: PIZZA_HOLD_R (balanced like a waiter's tray on the raised right fin),
 * PIZZA_FRONT (held upright against the belly, logo to the camera) and PIZZA_GRIP (where a
 * raptor's jaws take it; scale ≈ 0.7 for a turkey-sized raptor).
 */
export const PizzaBox: React.FC<{ open?: number }> = ({ open = 0 }) => {
  const ready = useFontsReady();
  const { w: W, h: H, d: D } = PIZZA_BOX;
  const T = 0.025;
  const bottom = useRounded(W, T, D, 0.01, 1);
  const wallX = useRounded(W, H, T, 0.01, 1);
  const wallZ = useRounded(T, H, D, 0.01, 1);
  const lid = useRounded(W + 0.014, T, D + 0.014, 0.01, 1);
  const flap = useRounded(W + 0.014, H * 0.85, T, 0.01, 1);
  const geos = useMemo(
    () => ({
      base: new THREE.CylinderGeometry(0.5, 0.5, 0.04, 48),
      crust: new THREE.TorusGeometry(0.47, 0.055, 10, 48),
      top: new THREE.CircleGeometry(0.46, 48),
      pep: new THREE.CylinderGeometry(0.072, 0.072, 0.018, 20),
      leaf: new THREE.SphereGeometry(1, 10, 6),
    }),
    [],
  );
  const kraft = toy("#E3B87C", { rough: 0.85, glow: 0.14 });
  const kraftIn = toy("#F1D3A2", { rough: 0.85, glow: 0.14 });
  const a = clamp01(open) * 1.95;
  return (
    <group>
      <mesh geometry={bottom} material={kraftIn} position={[0, T / 2, 0]} castShadow receiveShadow />
      <mesh geometry={wallX} material={kraft} position={[0, H / 2, D / 2 - T / 2]} castShadow />
      <mesh geometry={wallX} material={kraft} position={[0, H / 2, -D / 2 + T / 2]} castShadow />
      <mesh geometry={wallZ} material={kraft} position={[W / 2 - T / 2, H / 2, 0]} castShadow />
      <mesh geometry={wallZ} material={kraft} position={[-W / 2 + T / 2, H / 2, 0]} castShadow />
      {/* The pizza. */}
      <group position={[0, T, 0]}>
        <mesh geometry={geos.base} material={toy("#EFB45E", { rough: 0.7 })} position={[0, 0.02, 0]} />
        <mesh geometry={geos.crust} material={toy("#DE9A4C", { rough: 0.7 })} position={[0, 0.045, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={geos.top} material={printMat(pizzaTopTexture(), 0.6, 0.2)} position={[0, 0.043, 0]} rotation={[-Math.PI / 2, 0, 0]} />
        {PEPPERONI.map(([x, z], i) => (
          <mesh key={i} geometry={geos.pep} material={toy("#C7372B", { rough: 0.5 })} position={[x, 0.05, z]} />
        ))}
        {[
          [0.12, -0.05],
          [-0.18, 0.02],
          [0.0, 0.18],
          [-0.02, -0.14],
        ].map(([x, z], i) => (
          <mesh key={i} geometry={geos.leaf} material={toy("#23A04A", { rough: 0.5 })} position={[x, 0.058, z]} rotation={[0, i * 1.3, 0]} scale={[0.05, 0.012, 0.03]} />
        ))}
      </group>
      {/* Lid, hinged at the back top edge. */}
      <group position={[0, H, -D / 2]} rotation={[-a, 0, 0]}>
        <mesh geometry={lid} material={kraft} position={[0, T / 2, D / 2]} castShadow />
        <mesh geometry={flap} material={kraft} position={[0, T - (H * 0.85) / 2, D + T / 2]} />
        {ready ? (
          <mesh position={[0, T + 0.003, D / 2]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[W * 0.94, D * 0.94]} />
            <primitive object={printMat(lidTexture(), 0.8, 0.16)} attach="material" />
          </mesh>
        ) : null}
      </group>
    </group>
  );
};

/**
 * Pizza box balanced flat on the raised screen-right fin like a waiter's tray (fin-tip space,
 * model units; use with pose finR ≈ 0.9): <Nubi pose={{ finR: 0.9 }} holdR={<group
 * {...PIZZA_HOLD_R}><PizzaBox /></group>} />. The counter-rotation keeps the box level.
 */
export const PIZZA_HOLD_R = { position: [1.35, 0.4, 0.2] as V3, rotation: [0, 0.25, -0.5] as V3, scale: 5 };
/**
 * Pizza box held upright against Nubi's belly with the logo facing the camera (Nubi-local,
 * size 2; it spans y ≈ 0.09..0.91, just below the eyes, resting on the front legs): <group {...PIZZA_FRONT}><PizzaBox /></group>
 * next to <Nubi pose={PIZZA_FRONT_POSE}>.
 */
export const PIZZA_FRONT = { position: [0, 0.5, 1.13] as V3, rotation: [Math.PI / 2 - 0.12, 0, 0] as V3, scale: 0.68 };
export const PIZZA_FRONT_POSE = { finL: -0.3, finR: -0.3 };

// =======================================================================================
// Road sign

type Pt = [number, number];

const diamondPath = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rad: number) => {
  const pts: Pt[] = [
    [cx, cy - r],
    [cx + r, cy],
    [cx, cy + r],
    [cx - r, cy],
  ];
  ctx.beginPath();
  ctx.moveTo((pts[3][0] + pts[0][0]) / 2, (pts[3][1] + pts[0][1]) / 2);
  for (let i = 0; i < 4; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % 4];
    ctx.arcTo(p[0], p[1], q[0], q[1], rad);
  }
  ctx.closePath();
};

/** T-Rex silhouette facing right, drawn in a 100 × 100 box (tail at the left, jaws open). */
const drawTRex = (ctx: CanvasRenderingContext2D, color: string, hole: string) => {
  ctx.fillStyle = color;
  const poly = (pts: Pt[]) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fill();
  };
  // Tail.
  ctx.beginPath();
  ctx.moveTo(44, 35);
  ctx.quadraticCurveTo(20, 40, 2, 61);
  ctx.lineTo(5, 64);
  ctx.quadraticCurveTo(26, 57, 47, 59);
  ctx.closePath();
  ctx.fill();
  // Far leg (a little behind).
  poly([
    [36, 58],
    [45, 60],
    [41, 85],
    [34, 86],
  ]);
  ctx.beginPath();
  ctx.roundRect(29, 83, 17, 6, 3);
  ctx.fill();
  // Body and neck.
  ctx.beginPath();
  ctx.ellipse(52, 47, 21, 14, -0.38, 0, Math.PI * 2);
  ctx.fill();
  poly([
    [57, 35],
    [69, 20],
    [81, 28],
    [70, 49],
  ]);
  // Head and the open lower jaw.
  ctx.beginPath();
  ctx.roundRect(65, 11, 31, 16, 6);
  ctx.fill();
  ctx.save();
  ctx.translate(71, 28);
  ctx.rotate(0.3);
  ctx.beginPath();
  ctx.roundRect(0, 0, 22, 7, 3.5);
  ctx.fill();
  ctx.restore();
  poly([
    [66, 22],
    [74, 27],
    [72, 34],
    [65, 30],
  ]);
  // Teeth hanging into the mouth.
  for (const x of [79, 85, 91]) {
    poly([
      [x - 2.2, 26],
      [x + 2.2, 26],
      [x, 30.5],
    ]);
  }
  // Tiny arm.
  poly([
    [63, 47],
    [74, 53],
    [73, 58],
    [70, 57.5],
    [62, 53],
  ]);
  // Near leg: thigh, shin, foot.
  ctx.beginPath();
  ctx.ellipse(51, 56, 11, 14, 0.35, 0, Math.PI * 2);
  ctx.fill();
  poly([
    [46, 61],
    [57, 64],
    [58, 86],
    [51, 87],
  ]);
  ctx.beginPath();
  ctx.roundRect(48, 84, 21, 6.5, 3.2);
  ctx.fill();
  // Eye.
  ctx.fillStyle = hole;
  ctx.beginPath();
  ctx.arc(85, 17, 2.4, 0, Math.PI * 2);
  ctx.fill();
};

const signFaceTexture = () =>
  canvasTexture("dino-sign-trex", 512, 512, (ctx, W) => {
    const c = W / 2;
    ctx.fillStyle = "#1A1A1A";
    diamondPath(ctx, c, c, 254, 34);
    ctx.fill();
    ctx.fillStyle = "#FFD21A";
    diamondPath(ctx, c, c, 230, 28);
    ctx.fill();
    ctx.strokeStyle = "#1A1A1A";
    ctx.lineWidth = 7;
    diamondPath(ctx, c, c, 212, 24);
    ctx.stroke();
    const s = 248;
    ctx.save();
    ctx.translate(c - s / 2, c - s / 2 + 6);
    ctx.scale(s / 100, s / 100);
    drawTRex(ctx, "#1A1A1A", "#FFD21A");
    ctx.restore();
  });

/** Splits a caption into one or two lines of similar length. */
const splitLines = (text: string) => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [text];
  let best = 1;
  let bestLen = Infinity;
  for (let i = 1; i < words.length; i++) {
    const m = Math.max(words.slice(0, i).join(" ").length, words.slice(i).join(" ").length);
    if (m < bestLen) {
      bestLen = m;
      best = i;
    }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
};

const plateTexture = (text: string) =>
  canvasTexture(`dino-sign-plate|${text}`, 1024, 420, (ctx, W, H) => {
    ctx.fillStyle = "#1A1A1A";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 48);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(16, 16, W - 32, H - 32, 36);
    ctx.fill();
    const lines = splitLines(text.toUpperCase());
    let size = lines.length > 1 ? 150 : 190;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const widest = () => Math.max(...lines.map((l) => ctx.measureText(l).width));
    ctx.font = `${size}px ${TITLE}`;
    while (widest() > W - 110 && size > 40) {
      size -= 6;
      ctx.font = `${size}px ${TITLE}`;
    }
    ctx.fillStyle = "#1A1A1A";
    const lh = size * 1.02;
    lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * lh + size * 0.1));
  });

/** Rounded diamond outline (half-diagonal r, corner radius rad) centred at the origin. */
const diamondShape = (r: number, rad: number) => {
  const s = new THREE.Shape();
  const pts: Pt[] = [
    [0, r],
    [r, 0],
    [0, -r],
    [-r, 0],
  ];
  const k = rad / (r * Math.SQRT2);
  const lerpPt = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  for (let i = 0; i < 4; i++) {
    const prev = pts[(i + 3) % 4];
    const p = pts[i];
    const next = pts[(i + 1) % 4];
    const a = lerpPt(p, prev, k);
    const b = lerpPt(p, next, k);
    if (i === 0) s.moveTo(a[0], a[1]);
    else s.lineTo(a[0], a[1]);
    s.quadraticCurveTo(p[0], p[1], b[0], b[1]);
  }
  s.closePath();
  return s;
};

const SIGN = { diamond: 0.75, dy: 2.85, plateY: 1.68, plateW: 1.62, plateH: 0.68, post: 3.42 };

/**
 * Yellow diamond warning sign with a black T-Rex silhouette on a grey post, and a white plate
 * below it with `text` (default "NO ALIMENTAR AL T-REX", wrapped to two lines and fitted). Faces
 * +z; 3.6 tall (≈ 1.8 × Nubi at size 2), diamond 1.5 across centred at y 2.85, plate 1.62 × 0.68
 * at y 1.68. Origin at the foot of the post.
 */
export const RoadSign: React.FC<{ text?: string }> = ({ text = "NO ALIMENTAR AL T-REX" }) => {
  const ready = useFontsReady();
  const geos = useMemo(() => {
    const shape = diamondShape(SIGN.diamond, 0.16);
    const plate = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 8 });
    const face = planarUV(new THREE.ShapeGeometry(shape, 8));
    return {
      plate,
      face,
      post: new THREE.CylinderGeometry(0.055, 0.06, SIGN.post, 14),
      cap: new THREE.SphereGeometry(0.07, 14, 10),
    };
  }, []);
  const footing = useRounded(0.36, 0.12, 0.36, 0.04, 2);
  const back = useRounded(SIGN.plateW, SIGN.plateH, 0.035, 0.05, 2);
  const clamp = useRounded(0.22, 0.09, 0.08, 0.02, 1);
  const metal = toy("#A7B0BA", { metal: 0.6, rough: 0.35, glow: 0.12 });
  return (
    <group>
      <mesh geometry={footing} material={toy("#B9BDC4", { rough: 0.9 })} position={[0, 0.06, -0.08]} receiveShadow />
      <mesh geometry={geos.post} material={metal} position={[0, SIGN.post / 2, -0.08]} castShadow />
      <mesh geometry={geos.cap} material={metal} position={[0, SIGN.post, -0.08]} />
      {[SIGN.dy - 0.3, SIGN.dy + 0.3, SIGN.plateY].map((y) => (
        <mesh key={y} geometry={clamp} material={toy("#4A505C", { rough: 0.5 })} position={[0, y, -0.04]} />
      ))}
      {/* Diamond: grey plate with the printed face in front. */}
      <group position={[0, SIGN.dy, 0]}>
        <mesh geometry={geos.plate} material={metal} castShadow />
        <mesh geometry={geos.face} material={printMat(signFaceTexture(), 0.45, 0.2)} position={[0, 0, 0.05]} />
      </group>
      {/* Text plate. */}
      <group position={[0, SIGN.plateY, 0.02]}>
        <mesh geometry={back} material={metal} castShadow />
        {ready ? (
          <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={[SIGN.plateW - 0.02, SIGN.plateH - 0.02]} />
            <primitive object={printMat(plateTexture(text), 0.45, 0.2)} attach="material" />
          </mesh>
        ) : null}
      </group>
    </group>
  );
};

// =======================================================================================
// Potted plant

const lathe = (p: [number, number][], seg = 36) =>
  new THREE.LatheGeometry(
    p.map(([r, h]) => new THREE.Vector2(r, h)),
    seg,
  );

const PLANT = {
  leaf: ["#3CC55A", "#8DB23A", "#B08A3A", "#7A5A2E"],
  leafDark: ["#23A048", "#7A9A30", "#96722E", "#664826"],
  stem: ["#2E9E48", "#7E9A34", "#8A6A34"],
  petal: ["#FFFFFF", "#F1E6C6", "#C9A874"],
  heart: ["#FFC21A", "#D89A2A", "#7A4E22"],
};
const SOIL_Y = 0.38;

type PlantMats = Record<keyof typeof PLANT, THREE.MeshStandardMaterial>;

/** A leaf from its base at the origin along +z, in two halves; the tip curls down by `curl`. */
const Leaf: React.FC<{ geo: THREE.BufferGeometry; mat: THREE.Material; len: number; curl: number; shrink: number }> = ({ geo, mat, len, curl, shrink }) => (
  <group>
    <mesh geometry={geo} material={mat} position={[0, 0, len * 0.27]} scale={[len * 0.27 * shrink, len * 0.07, len * 0.3]} castShadow />
    <group position={[0, 0, len * 0.5]} rotation={[curl, 0, 0]}>
      <mesh geometry={geo} material={mat} position={[0, 0, len * 0.25]} scale={[len * 0.24 * shrink, len * 0.06, len * 0.28]} />
    </group>
  </group>
);

/**
 * Cute potted plant: terracotta pot (0.6 across, rim at y 0.4) with a rosette of leaves and a
 * daisy on a stem, ≈ 1.0 tall. `wilt` 0..1: the stem arcs over towards +x, the flower nods, the
 * leaves curl down and shrivel, everything fades from green to olive to brown and at the end two
 * dry leaves and a petal lie on the floor.
 */
export const PottedPlant: React.FC<{ wilt?: number }> = ({ wilt = 0 }) => {
  const w = clamp01(wilt);
  const geos = useMemo(
    () => ({
      pot: lathe([
        [0, 0],
        [0.19, 0],
        [0.215, 0.04],
        [0.27, 0.34],
      ]),
      rim: new THREE.CylinderGeometry(0.305, 0.29, 0.09, 36),
      soil: new THREE.CylinderGeometry(0.265, 0.265, 0.03, 32),
      blob: new THREE.SphereGeometry(1, 16, 10),
      stem: new THREE.CylinderGeometry(0.022, 0.028, 1, 8),
    }),
    [],
  );
  const mats = useMemo(() => {
    const m = {} as PlantMats;
    (Object.keys(PLANT) as (keyof typeof PLANT)[]).forEach((k) => {
      m[k] = new THREE.MeshStandardMaterial({ roughness: 0.55, emissive: new THREE.Color("#000000"), emissiveIntensity: 0.16 });
    });
    return m;
  }, []);
  (Object.keys(PLANT) as (keyof typeof PLANT)[]).forEach((k) => tint(mats[k], lerpColors(PLANT[k], w)));
  const bend = 0.05 + 0.42 * w;
  const seg = 0.14;
  const fall = clamp01((w - 0.6) / 0.3);
  const leafDown = -0.35 + 1.2 * w;
  return (
    <group>
      <mesh geometry={geos.pot} material={toy("#E0703F", { rough: 0.6, side: THREE.DoubleSide })} castShadow />
      <mesh geometry={geos.rim} material={toy("#EE8753", { rough: 0.55 })} position={[0, 0.355, 0]} castShadow />
      <mesh geometry={geos.soil} material={toy("#5A3A22", { rough: 1 })} position={[0, SOIL_Y - 0.01, 0]} />
      {/* Rosette. */}
      {Array.from({ length: 6 }).map((_, i) => (
        <group key={i} position={[0, SOIL_Y, 0]} rotation={[0, (i / 6) * Math.PI * 2 + 0.3, 0]}>
          <group position={[0, 0, 0.04]} rotation={[-0.72 + 0.62 * w, 0, 0]}>
            <Leaf geo={geos.blob} mat={i % 2 ? mats.leaf : mats.leafDark} len={0.36} curl={leafDown} shrink={1 - 0.35 * w} />
          </group>
        </group>
      ))}
      {/* Stem in four segments that bend over towards +x, with a pair of leaves and a daisy. */}
      <group position={[0, SOIL_Y, 0]}>
        <group rotation={[0, 0, -bend]}>
          <mesh geometry={geos.stem} material={mats.stem} position={[0, seg / 2, 0]} scale={[1, seg, 1]} />
          <group position={[0, seg, 0]} rotation={[0.04 * Math.sin(w * 3), 0, -bend]}>
            <mesh geometry={geos.stem} material={mats.stem} position={[0, seg / 2, 0]} scale={[1, seg, 1]} />
            {[-1, 1].map((s) => (
              <group key={s} position={[0, seg * 0.7, 0]} rotation={[0, s * (Math.PI / 2), 0]}>
                <group rotation={[-0.5 + 0.9 * w, 0, 0]}>
                  <Leaf geo={geos.blob} mat={mats.leaf} len={0.24} curl={leafDown * 0.8} shrink={1 - 0.35 * w} />
                </group>
              </group>
            ))}
            <group position={[0, seg, 0]} rotation={[0, 0, -bend]}>
              <mesh geometry={geos.stem} material={mats.stem} position={[0, seg / 2, 0]} scale={[1, seg, 1]} />
              <group position={[0, seg, 0]} rotation={[0, 0, -bend]}>
                <mesh geometry={geos.stem} material={mats.stem} position={[0, seg / 2, 0]} scale={[1, seg, 1]} />
                {/* Daisy facing the camera and a little up; it nods with the stem. */}
                <group position={[0, seg, 0]} rotation={[Math.PI / 2 - 0.55, 0, 0]}>
                  <mesh geometry={geos.blob} material={mats.heart} position={[0, 0.012, 0]} scale={[0.062, 0.03, 0.062]} />
                  {Array.from({ length: 11 }).map((_, i) => (
                    <group key={i} rotation={[0, (i / 11) * Math.PI * 2, 0]}>
                      <group position={[0, 0, 0.05]} rotation={[0.1 + 0.9 * w, 0, 0]}>
                        <mesh geometry={geos.blob} material={mats.petal} position={[0, 0, 0.055]} scale={[0.03 * (1 - 0.3 * w), 0.01, 0.062]} />
                      </group>
                    </group>
                  ))}
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>
      {/* Fallen bits. */}
      {fall > 0.01 ? (
        <group>
          <group position={[0.45, 0.012, 0.22]} rotation={[0, 0.7, 0]} scale={fall}>
            <mesh geometry={geos.blob} material={mats.leafDark} scale={[0.07, 0.012, 0.12]} />
          </group>
          <group position={[-0.38, 0.012, 0.3]} rotation={[0, -0.4, 0]} scale={fall}>
            <mesh geometry={geos.blob} material={mats.leaf} scale={[0.06, 0.012, 0.1]} />
          </group>
          <group position={[0.2, 0.01, 0.42]} rotation={[0, 1.2, 0]} scale={fall}>
            <mesh geometry={geos.blob} material={mats.petal} scale={[0.028, 0.008, 0.055]} />
          </group>
        </group>
      ) : null}
    </group>
  );
};

// =======================================================================================
// Caveman club

const CLUB_PROFILE: [number, number][] = [
  [0, -0.13],
  [0.045, -0.125],
  [0.052, -0.09],
  [0.05, 0.1],
  [0.058, 0.3],
  [0.08, 0.5],
  [0.115, 0.66],
  [0.155, 0.8],
  [0.17, 0.9],
  [0.155, 0.99],
  [0.1, 1.045],
  [0, 1.06],
];
const CLUB_KNOTS: V3[] = [
  [0.15, 0.78, 0.05],
  [-0.13, 0.88, 0.07],
  [0.03, 0.95, -0.14],
  [-0.1, 0.7, -0.1],
  [0.12, 0.93, -0.07],
  [-0.04, 0.62, 0.1],
];

/**
 * Caveman's wooden club: a knobbly head on a tapering handle with a leather-wrapped grip,
 * 1.2 long along +y; the origin is the grip (the handle end sticks 0.13 below it). In a fin:
 * <Nubi pose={{ finR: 0.5 }} holdR={<group {...CLUB_HOLD_R}><Club /></group>} />.
 */
export const Club: React.FC = () => {
  const geos = useMemo(
    () => ({
      body: lathe(CLUB_PROFILE, 18),
      knot: new THREE.SphereGeometry(0.065, 12, 8),
      wrap: new THREE.TorusGeometry(0.058, 0.02, 8, 18),
    }),
    [],
  );
  return (
    <group>
      <mesh geometry={geos.body} material={toy("#B06E33", { rough: 0.65, glow: 0.16 })} castShadow />
      {CLUB_KNOTS.map((p, i) => (
        <mesh key={i} geometry={geos.knot} material={toy("#8A5226", { rough: 0.7 })} position={p} scale={[1, 0.8, 1]} />
      ))}
      {[-0.07, -0.02, 0.03, 0.08].map((y) => (
        <mesh key={y} geometry={geos.wrap} material={toy("#6B3E1E", { rough: 0.8 })} position={[0, y, 0]} rotation={[Math.PI / 2, 0.15, 0]} />
      ))}
    </group>
  );
};

/**
 * Club in <Nubi holdR> (fin-tip space, model units): ×5 (≈ 6 model units, towering over the
 * head), gripped in front of the fin tip, head up and leaning outwards. Mirror position x and
 * rotation z for CLUB_HOLD_L.
 */
export const CLUB_HOLD_R = { position: [0.3, -0.1, 0.75] as V3, rotation: [0.15, 0, -0.32] as V3, scale: 5 };
export const CLUB_HOLD_L = { position: [-0.3, -0.1, 0.75] as V3, rotation: [0.15, 0, 0.32] as V3, scale: 5 };

// =======================================================================================
// Bones and the bone throne

/** A cartoon bone along x, `len` between the knob centres (any units; used by costumes too). */
export const Bone: React.FC<{ len?: number; radius?: number; color?: string }> = ({ len = 3.9, radius = 0.26, color = "#F6ECD4" }) => {
  const geos = useMemo(
    () => ({
      shaft: new THREE.CylinderGeometry(1, 1, 1, 14),
      knob: new THREE.SphereGeometry(1, 18, 12),
    }),
    [],
  );
  const mat = toy(color, { rough: 0.55, glow: 0.2 });
  return (
    <group>
      <mesh geometry={geos.shaft} material={mat} rotation={[0, 0, Math.PI / 2]} scale={[radius, len, radius]} castShadow />
      {[-1, 1].flatMap((s) =>
        [-1, 1].map((k) => (
          <mesh key={`${s}${k}`} geometry={geos.knob} material={mat} position={[(s * len) / 2, k * radius * 1.05, 0]} scale={radius * 1.62} castShadow />
        )),
      )}
    </group>
  );
};

const BONE = "#F2E6C8";
const BONE_SHADE = "#D9C69A";
const SOCKET = "#3A2A20";

/** Merges geometries after making them non-indexed without uvs (for vertex-coloured meshes). */
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

/** Rounded stone block with a flat vertex colour, placed and turned. */
const stoneBlock = (w: number, h: number, d: number, color: string, pos: V3, rot: V3 = [0, 0, 0]) => {
  const g = new RoundedBoxGeometry(w, h, d, 1, Math.min(0.12, w / 2, h / 2, d / 2));
  paintGeo(g, color);
  g.applyMatrix4(
    new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1, 1, 1)),
  );
  return g;
};

const STONES = ["#8A84A0", "#7C7690", "#96909F", "#847D95"];

/** The throne's stonework (dais, seat, armrests, back wall), one vertex-coloured mesh. */
const throneStones = () => {
  const rnd = mulberry(3131);
  const tone = () => shadeHex(STONES[Math.floor(rnd() * STONES.length)], (rnd() - 0.5) * 0.06);
  const jitter = (k: number): V3 => [(rnd() - 0.5) * k, (rnd() - 0.5) * k, (rnd() - 0.5) * k];
  const geos: THREE.BufferGeometry[] = [
    stoneBlock(4.6, 0.32, 3.9, "#716B84", [0, 0.16, 0.15]),
    stoneBlock(3.6, 0.18, 0.62, "#817B93", [0, 0.09, 2.35]),
    stoneBlock(3.3, 0.36, 2.7, tone(), [0, 0.5, 0.12], jitter(0.02)),
    stoneBlock(3.1, 0.3, 2.55, tone(), [0.03, 0.83, 0.14], jitter(0.02)),
  ];
  // Armrests: two stacked blocks a side.
  for (const s of [-1, 1]) {
    geos.push(stoneBlock(0.7, 0.62, 2.3, tone(), [s * 1.98, 0.63, 0.08], jitter(0.03)));
    geos.push(stoneBlock(0.64, 0.56, 2.2, tone(), [s * 1.96, 1.2, 0.06], jitter(0.04)));
  }
  // Back wall: courses of blocks, staggered, with a big capstone.
  const courses = [0.72, 0.66, 0.7, 0.64];
  let y = 0.32;
  courses.forEach((h, row) => {
    const n = row % 2 ? 3 : 2;
    const widths = n === 2 ? [1.7, 1.7] : [1.1, 1.2, 1.1];
    let x = -1.7;
    widths.forEach((w) => {
      geos.push(stoneBlock(w - 0.05, h - 0.04, 0.66, tone(), [x + w / 2, y + h / 2, -1.36], jitter(0.035)));
      x += w;
    });
    y += h;
  });
  geos.push(stoneBlock(3.8, 0.5, 0.86, "#9A94A8", [0, y + 0.22, -1.36], [0, 0, 0.02]));
  return mergeAll(geos);
};

/** Tapered, curved tube (a rib or horn): radius r0 at the start shrinking to r1 at the end. */
const taperTube = (pts: THREE.Vector3[], r0: number, r1: number, seg = 24, radial = 8) => {
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const p = g.attributes.position;
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    curve.getPointAt(u, c);
    const r = r0 + (r1 - r0) * u;
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c);
      p.setXYZ(k, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return g;
};

const frillShape = () => {
  const s = new THREE.Shape();
  const N = 64;
  for (let i = 0; i <= N; i++) {
    const a = -0.28 + ((Math.PI + 0.56) * i) / N;
    const r = 1.25 + 0.06 * Math.cos(a * 11);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * 0.92;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  for (const sx of [-1, 1]) {
    const h = new THREE.Path();
    h.absellipse(sx * 0.5, 0.56, 0.24, 0.17, 0, Math.PI * 2, false, 0);
    s.holes.push(h);
  }
  return s;
};

/** Triceratops skull facing +z: bony frill with holes and knobs, three horns, beak. ≈ 2.6 wide. */
const TriceratopsSkull: React.FC = () => {
  const geos = useMemo(
    () => ({
      frill: new THREE.ExtrudeGeometry(frillShape(), {
        depth: 0.16,
        bevelEnabled: true,
        bevelThickness: 0.07,
        bevelSize: 0.07,
        bevelSegments: 2,
        curveSegments: 12,
      }),
      knob: new THREE.ConeGeometry(0.12, 0.26, 10),
      horn: new THREE.ConeGeometry(0.13, 1.15, 16),
      nose: new THREE.ConeGeometry(0.1, 0.42, 14),
      beak: new THREE.ConeGeometry(0.22, 0.45, 14),
      ball: new THREE.SphereGeometry(1, 18, 12),
    }),
    [],
  );
  const head = useRounded(1.05, 0.86, 1.15, 0.3, 3);
  const snout = useRounded(0.66, 0.62, 0.75, 0.22, 3);
  const bone = toy(BONE, { rough: 0.55, glow: 0.2 });
  const shade = toy(BONE_SHADE, { rough: 0.6, glow: 0.16 });
  const dark = toy(SOCKET, { rough: 0.8 });
  return (
    <group>
      <group position={[0, 0.42, -0.42]} rotation={[-0.38, 0, 0]}>
        <mesh geometry={geos.frill} material={shade} position={[0, 0, -0.08]} castShadow />
        {Array.from({ length: 11 }).map((_, i) => {
          const a = -0.2 + ((Math.PI + 0.4) * i) / 10;
          return (
            <mesh
              key={i}
              geometry={geos.knob}
              material={bone}
              position={[Math.cos(a) * 1.33, Math.sin(a) * 1.33 * 0.92, 0.02]}
              rotation={[0, 0, a - Math.PI / 2]}
            />
          );
        })}
      </group>
      <mesh geometry={head} material={bone} position={[0, 0, 0.2]} castShadow />
      <mesh geometry={snout} material={bone} position={[0, -0.16, 0.9]} castShadow />
      <mesh geometry={geos.beak} material={shade} position={[0, -0.34, 1.3]} rotation={[Math.PI / 2 + 0.5, 0, 0]} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh geometry={geos.ball} material={dark} position={[s * 0.34, 0.14, 0.72]} scale={[0.2, 0.22, 0.12]} />
          <mesh geometry={geos.horn} material={bone} position={[s * 0.3, 0.52, 0.62]} rotation={[1.0, 0, -s * 0.18]} castShadow />
          <mesh geometry={geos.knob} material={shade} position={[s * 0.56, -0.28, 0.3]} rotation={[0, 0, s * 2.4]} scale={1.4} />
        </group>
      ))}
      <mesh geometry={geos.nose} material={bone} position={[0, 0.2, 1.12]} rotation={[0.55, 0, 0]} />
      <mesh geometry={geos.ball} material={dark} position={[0, -0.08, 1.27]} scale={[0.14, 0.09, 0.06]} />
    </group>
  );
};

/** Where Nubi (size 2) stands on the bone throne's cushion (throne space): <Nubi position={...}>. */
export const BONE_THRONE_SEAT: V3 = [0, 1.23, 0.15];

/**
 * Bone throne: a stone dais (4.6 × 3.9) and stepped stone seat with a tufted red cushion
 * (Nubi stands on it at BONE_THRONE_SEAT), stone armrests topped with femur bones, a stacked
 * stone back wall flanked by curved rib bones, and a big Triceratops skull on top (≈ 6.2 tall
 * in all, ≈ 3 × Nubi). Faces +z; origin at the middle of the dais' bottom.
 */
export const BoneThrone: React.FC = () => {
  const geos = useMemo(() => {
    const ribs: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const yb = 0.9 + k * 0.72;
        const zb = -1.25 - k * 0.05;
        const L = 2.5 - k * 0.3;
        ribs.push(
          taperTube(
            [
              new THREE.Vector3(s * 1.72, yb, zb),
              new THREE.Vector3(s * (2.45 - k * 0.05), yb + L * 0.35, zb + 0.15),
              new THREE.Vector3(s * (2.35 - k * 0.1), yb + L * 0.75, zb + 0.3),
              new THREE.Vector3(s * (1.95 - k * 0.12), yb + L, zb + 0.38),
            ],
            0.13 - k * 0.012,
            0.045,
          ),
        );
      }
    }
    const merged = mergeGeometries(ribs);
    if (!merged) throw new Error("rib merge failed");
    return {
      stones: throneStones(),
      ribs: merged,
      button: new THREE.SphereGeometry(0.06, 12, 8),
      tassel: new THREE.ConeGeometry(0.07, 0.22, 10),
    };
  }, []);
  const cushion = useRounded(2.9, 0.28, 2.36, 0.13, 4);
  const piping = useRounded(2.96, 0.06, 2.42, 0.03, 2);
  return (
    <group>
      <mesh geometry={geos.stones} material={vertexMat(0.9, true, 0.1)} castShadow receiveShadow />
      <mesh geometry={geos.ribs} material={toy(BONE, { rough: 0.55, glow: 0.2 })} castShadow />
      {/* Cushion. */}
      <mesh geometry={cushion} material={toy("#D7263D", { rough: 0.75, glow: 0.18 })} position={[0, 0.98 + 0.14, 0.15]} castShadow receiveShadow />
      <mesh geometry={piping} material={gold()} position={[0, 0.99, 0.15]} />
      {[-0.85, 0, 0.85].flatMap((x) =>
        [-0.45, 0.55].map((z) => <mesh key={`${x}${z}`} geometry={geos.button} material={gold()} position={[x, 1.245, 0.15 + z]} scale={[1, 0.5, 1]} />),
      )}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} geometry={geos.tassel} material={gold()} position={[sx * 1.42, 0.92, 0.15 + sz * 1.14]} rotation={[Math.PI, 0, 0]} />
        )),
      )}
      {/* Femurs on the armrests, a couple of bones on the dais. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 1.96, 1.58, 0.1]} rotation={[0, Math.PI / 2, 0]}>
          <Bone len={1.9} radius={0.12} color={BONE} />
        </group>
      ))}
      <group position={[-1.75, 0.4, 1.55]} rotation={[0, 0.5, 0]}>
        <Bone len={0.9} radius={0.07} color={BONE} />
      </group>
      <group position={[1.8, 0.4, 1.45]} rotation={[0, -0.9, 0]}>
        <Bone len={0.75} radius={0.06} color={BONE} />
      </group>
      {/* Skull on top of the back wall. */}
      <group position={[0, 3.55, -1.2]} rotation={[0.12, 0, 0]} scale={1.15}>
        <TriceratopsSkull />
      </group>
    </group>
  );
};

// =======================================================================================
// Earth

type LonLat = [number, number];
/** Simplified coastlines as [lon, lat] polygons (degrees). Water polygons carve inland seas. */
const LAND: LonLat[][] = [
  // North America
  [[-168,65.6],[-162,70],[-156,71.3],[-140,69.8],[-128,70.2],[-115,68.5],[-95,68.5],[-88,68.8],[-82,66.5],[-85,64],[-94,61],[-92.7,57],[-85,55.2],[-80,52],[-79,55],[-77,60],[-78,62.5],[-72,62],[-65,60],[-61,56],[-56,52],[-59,48],[-65,47],[-60,46],[-66,44],[-70,42],[-74,40.5],[-76,38],[-76,35],[-81,31.5],[-80,27],[-80.5,25.2],[-82,26.5],[-83,29.5],[-86,30.3],[-89.5,30],[-94,29.5],[-97.3,27.5],[-97.5,24],[-97.5,21.5],[-96,19],[-94,18.2],[-91,18.8],[-90.5,21],[-87,21.5],[-87.5,18],[-88.5,15.8],[-84,15.8],[-83.3,12],[-83.8,11],[-82,9],[-79.5,9.3],[-77.5,8.5],[-78,7],[-80.5,7.3],[-83,8.2],[-85.7,10],[-87.5,12.5],[-91.5,14],[-94,16],[-96.5,15.7],[-101,17.5],[-105.5,20],[-105.5,23],[-109,25.5],[-112.5,29.5],[-114.8,31.8],[-114,30],[-112,27],[-110,23],[-112,24.8],[-114.5,28],[-116,30.5],[-117.2,32.7],[-120.5,34.5],[-122.5,37.5],[-124,40],[-124.3,43],[-124,46.5],[-124.7,48.4],[-123,49],[-127,50.5],[-130,54],[-133,57.5],[-137,59],[-141,60],[-147,61],[-151,59.5],[-154,57.5],[-158,56.5],[-162,55.2],[-164.5,54.5],[-160,58.3],[-162,60],[-165.5,61.5],[-164.8,63.5],[-161,64.5],[-166,65]],
  // Canadian Arctic islands, Greenland, Iceland, Cuba, Hispaniola
  [[-122,76],[-120,72],[-95,72],[-80,73],[-75,80],[-90,82],[-110,78]],
  [[-73,78],[-66,81],[-45,82.5],[-25,83],[-18,80],[-19,76],[-22,72],[-24,70],[-32,68],[-38,65.5],[-42,61],[-45,60],[-48,61],[-51,64],[-53,67],[-55,71],[-58,75],[-68,76.5]],
  [[-24,64.8],[-22.5,66.4],[-16,66.5],[-13.5,65.2],[-18,63.4],[-22.5,63.8]],
  [[-85,21.8],[-82,23.1],[-77.5,21.8],[-74.2,20.2],[-77.5,19.9],[-81,21.6]],
  [[-74.4,19.8],[-72,19.9],[-68.4,18.6],[-71.5,17.6],[-74.4,18.3]],
  // South America
  [[-77.5,8.5],[-75.5,10.8],[-72,12],[-71,11.5],[-68,10.6],[-64,10.7],[-61,10.7],[-58,7],[-54,5.8],[-51.5,4.3],[-50,1.5],[-49,-0.5],[-45,-1.5],[-41,-2.9],[-38,-4],[-35.2,-5.5],[-34.8,-7.5],[-35.5,-9.5],[-37.5,-12.5],[-39,-15],[-39,-17.8],[-40.3,-20.5],[-42,-22.9],[-44.5,-23.3],[-47,-24.6],[-48.6,-26.5],[-48.8,-28.5],[-50.3,-30.5],[-52,-32.5],[-53.5,-34],[-55,-34.8],[-57.5,-35.3],[-57,-37],[-58,-38.5],[-62,-39],[-62.5,-40.5],[-65,-41],[-64.5,-42.5],[-65.5,-45],[-67.5,-46.5],[-66,-48],[-68.5,-50.3],[-69,-52.2],[-68.5,-54.8],[-71,-54],[-74,-51],[-75.5,-47],[-74,-43],[-73.5,-39],[-73.5,-37],[-71.6,-33],[-71.4,-28],[-70.5,-23],[-70.2,-18.5],[-72,-17],[-76,-14],[-77,-12],[-79,-8],[-81.2,-5.5],[-80.3,-3],[-80.5,-1],[-80,1],[-78.5,2],[-77.5,4],[-77.4,6.8]],
  // Africa, Madagascar
  [[-17.1,21],[-16,24],[-13.5,27],[-10,29.5],[-9.7,32],[-6.8,34],[-5.9,35.8],[-2,35.2],[2,36.6],[10,37.2],[11,35.5],[10.5,34],[11.5,33],[15,32.2],[19.8,30.9],[20.5,32.5],[23,32.6],[25,31.7],[29,30.8],[32,31.2],[34.2,31.3],[34,29],[34.6,28],[37,24],[38.5,18],[40.5,15],[43.2,12.7],[44,10.5],[46,10.7],[51.2,11.8],[51,10.4],[49.5,6.5],[47.8,4],[45,1.5],[42,-1],[40.2,-3],[39.3,-6],[39.5,-9],[40.5,-11],[40.5,-15],[37,-17.5],[35.2,-21],[35.5,-24],[32.8,-26],[32.5,-28.8],[31,-30],[28,-33],[25.5,-34],[22.5,-34],[20,-34.8],[18.3,-34],[18,-32],[17,-29],[15.5,-27],[14.5,-23],[13.2,-20],[11.7,-17],[12,-13.5],[13.5,-11.5],[13.2,-8.5],[12.2,-6],[12,-5],[10,-2.5],[9.3,0],[9.6,2.5],[9.8,4],[8.5,4.5],[6.5,4.3],[4.5,6.3],[2,6.3],[-1,5],[-4,5.2],[-7.5,4.3],[-9.5,5.5],[-11.5,7],[-13.3,8.5],[-15,11],[-16.8,12.5],[-17.2,14.7],[-16.5,16.5],[-16.2,19]],
  [[49.3,-12],[50.5,-15.5],[49.7,-17],[48.7,-20.5],[47.5,-24.8],[45.2,-25.5],[43.6,-23],[43.3,-21],[44.4,-18],[44,-16.8],[46.5,-15.5],[48,-13.5]],
  // Eurasia
  [[-9.5,37],[-8.8,42],[-9,43.2],[-7,43.7],[-2,43.4],[-1.5,44.5],[-1.2,46],[-2.5,47.3],[-4.5,48],[-4.7,48.5],[-1.5,48.7],[-1,49.4],[1.5,50.2],[2.5,51.1],[4,51.5],[5,53.2],[7,53.6],[8.6,53.9],[8.4,55.5],[8.2,57],[10.5,57.7],[11,58.8],[8,58],[5.5,58.9],[5,61.5],[7,63],[10,64.5],[13,66.5],[15.5,68.4],[19,70],[23,70.8],[28,71],[31,70],[33.5,69.3],[36,69],[40.5,67.8],[44,68.5],[46,68],[53,68.8],[58,68.8],[60.5,69.8],[65,69.5],[68.5,68],[69,70.5],[72.5,72.8],[78,72.3],[80,73.5],[87,74],[97,76],[104,77.7],[112,76.5],[114,73.5],[120,73],[126,73.5],[130,71],[140,72.5],[150,71.5],[160,70.3],[167,69.7],[172,70],[179.5,68.9],[179.5,65],[174,64.5],[177,62.3],[170,60],[165,60.2],[163.5,59.5],[162,57.8],[163,56],[160.5,53],[158,51.5],[156.5,51],[156,53],[155.5,56.5],[156.6,57.8],[152,59.2],[148,59.3],[143,59.3],[140,57],[137.5,54],[140.5,51],[140,48.5],[138,45],[135,43],[132,42.5],[129.5,41],[129.4,37],[129.2,35.2],[126.5,34.5],[126.2,37.5],[125,39.5],[121.5,40],[121,39],[118,39],[119.5,37.2],[122.5,37],[120,35],[120.5,33],[121.8,31],[121.5,28.5],[119.5,25.8],[117,23.5],[114,22.3],[110.5,21],[108,21.5],[106.5,20],[105.8,19],[107,16.5],[109,12.5],[109,11.5],[106.8,10.3],[105,8.6],[104.8,10.3],[103,10.8],[100.8,12.6],[99.3,10.2],[99.8,9],[100.3,6.8],[102.3,6.2],[103.4,4],[103.9,1.5],[103.4,1.3],[101.3,2.9],[100.4,5],[98.3,8],[98.5,10.5],[98,13],[97.7,16.5],[95.3,15.8],[94.3,18.6],[92.3,20.7],[91.8,22.5],[90,21.9],[88,21.8],[86.8,20.5],[85,19.3],[82.2,16.7],[80.3,15.5],[80.2,13],[79.8,10.3],[78.2,8.9],[77.5,8.1],[76.5,8.9],[75.3,11.8],[74.4,14.7],[73.2,17.5],[72.8,20.4],[70.5,20.8],[69,22.4],[68.4,23.5],[66.8,25],[62,25.2],[57.3,25.8],[56.8,27.1],[54,26.7],[51.5,27.9],[50.2,30],[48.5,30],[48,29.3],[48.9,27.5],[50.2,26.3],[50.8,24.8],[52,24],[54.5,24.2],[56,26],[56.4,24.8],[57.8,23.7],[59.8,22.5],[58.5,20.5],[57.7,19],[55.4,17.7],[52.2,16],[49,14.2],[45,12.8],[43.3,12.8],[42.8,15.5],[41.2,19],[39,21.8],[38.2,24],[36.5,26],[35,28],[34.8,29.5],[34.3,31.3],[35,33],[35.9,35.4],[36.2,36.6],[34.5,36.8],[32.5,36.1],[30.5,36.3],[28.2,36.7],[27.2,37.5],[26.3,38.5],[26.7,40.1],[26,40.8],[24,40.7],[22.9,39.3],[24,38],[23.1,36.5],[22,37],[21.1,37.8],[20,39.7],[19.4,41.8],[18.5,42.5],[16.2,43.5],[15.2,44.3],[13.7,45.2],[12.3,45.3],[12.3,44.3],[13.8,43],[15,41.9],[16.1,41.4],[18.5,40.2],[17.1,39.1],[16.5,38.3],[15.7,37.9],[15.8,39.4],[14.5,40.6],[12.5,41.6],[11,42.4],[10.3,43.6],[8.9,44.4],[7.6,43.8],[6.5,43.1],[4.8,43.4],[3.2,43.2],[3.1,41.9],[0.9,41],[0,39.5],[-0.7,37.6],[-2.1,36.7],[-4.5,36.6],[-5.6,36],[-6.3,36.8],[-7.4,37.2],[-8.9,37]],
  // European and Asian islands
  [[12.4,38.1],[15.6,38.3],[15.1,36.7],[12.7,37.6]],
  [[8.2,41],[9.8,41],[9.6,39.2],[8.5,38.9]],
  [[-5.7,50],[1.4,51.1],[1.7,52.7],[0.3,53.3],[-0.3,54.5],[-1.6,55.6],[-2,57.6],[-3.8,58.6],[-5,58.6],[-6.2,57.2],[-5.6,55.5],[-4.8,54.8],[-3.1,54],[-4.6,53.3],[-4.3,52.3],[-5.2,51.7],[-3,51.2]],
  [[-10.2,51.6],[-6.2,52.2],[-6,53.9],[-6.2,55.2],[-8,55.2],[-10,54.2],[-9.5,53]],
  [[79.8,9.8],[81.9,7.5],[81.4,6.2],[80.1,6],[79.7,8]],
  [[120.1,23],[121.9,25.1],[121.6,23.5],[120.8,21.9]],
  [[140,41.5],[141.3,41.4],[143.3,42],[145.6,43.3],[145.3,44.3],[142,45.5],[141.5,44.3],[140.5,43.2]],
  [[129.8,33.1],[131,31.3],[131.6,32.5],[134.7,33.8],[135.8,33.5],[137,34.6],[139,34.9],[140.9,35.7],[140.6,36.9],[141,38.3],[141.6,40.4],[141.3,41.3],[140.2,41.2],[139.9,40.1],[139.7,38.5],[138.5,37.9],[136.8,37.2],[136,35.9],[133.1,35.6],[131,34.5],[130.9,33.9]],
  [[120.6,18.5],[122.3,18.3],[122.2,16],[121.6,14.2],[124,12.6],[125.6,12],[126.3,9],[125.4,6],[123.9,6.9],[122,7.2],[123.8,9.9],[121.9,10.7],[120.6,14.3],[119.8,16.3]],
  [[109,1.5],[109.7,2],[111.3,2.6],[113,3.2],[115.5,5.3],[117.2,6.9],[119.1,5.3],[117.9,4.2],[118.4,0.8],[117.4,0],[116.5,-2.3],[116,-3.8],[114.5,-3.5],[112.3,-3.3],[110.2,-2.9],[109.5,-0.9]],
  [[95.3,5.6],[97.5,5.2],[100.4,2.2],[103.8,-1],[106,-3.1],[105.9,-5.8],[104.5,-5.9],[102.3,-4],[101,-2.2],[98.6,1.7],[95.9,3.7]],
  [[105.2,-6.8],[106.5,-6],[108.3,-6.3],[110.4,-6.9],[112.6,-6.9],[114.5,-7.7],[114.4,-8.7],[111,-8.2],[108,-7.8],[106.4,-7.4]],
  [[119.5,-5.5],[120.4,-5.5],[121,-2],[123.3,-1],[124.9,1.5],[123.8,0.9],[120.2,0.5],[119.4,-1],[119.6,-3.4]],
  [[131,-1],[134,-0.9],[137.5,-1.6],[141,-2.6],[144.5,-3.8],[147.5,-6.2],[147.9,-8],[150.8,-10.4],[147.3,-10.1],[146,-8.3],[143.6,-9.2],[142.5,-9.3],[141,-9.1],[139,-8.1],[138,-7.5],[138.4,-6.3],[137.8,-5.2],[135.2,-4.4],[132.8,-4.1],[132,-2.9]],
  // Australia, Tasmania, New Zealand
  [[113.4,-22],[114,-26],[115,-31],[115.1,-33.6],[117.9,-35.1],[121.5,-33.8],[123.6,-33.9],[126,-32.3],[129,-31.7],[131.2,-31.5],[134.2,-32.8],[135.8,-34.8],[137.8,-33.2],[138.2,-34.6],[139.7,-36.4],[140.9,-38],[143.5,-38.8],[146.3,-39.1],[148.2,-37.8],[150,-37.4],[150.8,-34.8],[152.5,-32.2],[153.1,-30],[153.6,-28.2],[153,-25.5],[151.5,-24],[150.8,-22.5],[149.3,-21.4],[148.7,-20.3],[146.4,-18.9],[145.9,-16.9],[145.3,-15],[143.8,-14.2],[143.5,-12.8],[142.5,-10.7],[141.6,-12.8],[141.5,-15.5],[140.8,-17.4],[139.3,-17.4],[137.4,-15.8],[135.5,-14.9],[136.9,-12.3],[136,-11.9],[132.6,-11.5],[131.9,-11.3],[130.1,-12.9],[129.4,-14.9],[127.8,-14.3],[126,-14.3],[124.5,-15.6],[123.3,-16.9],[122.2,-18.2],[121.3,-19.5],[119.3,-20],[117.4,-20.7],[115.5,-21.5]],
  [[144.6,-40.7],[148.3,-40.9],[148,-43.2],[146.9,-43.6],[145.2,-42.3]],
  [[172.7,-34.4],[174.4,-35.6],[175.9,-37.5],[178.5,-37.7],[177.9,-39.2],[176.9,-39.6],[175.3,-41.6],[174.6,-41.3],[174.9,-39.9],[173.8,-39.2],[174.6,-37.3],[173.1,-35.3]],
  [[172.7,-40.5],[174.3,-41.3],[173.4,-42.8],[172.7,-43.8],[171.2,-44.4],[170.5,-45.9],[169.3,-46.6],[166.5,-46],[166.9,-45.2],[168.3,-44],[170.6,-42.8],[172.1,-41.3]],
];
const WATER: LonLat[][] = [
  [[27.5,42],[28.8,44.3],[30.8,46.5],[33.5,46],[35.3,45.3],[38,47],[39.7,47],[38.3,44.4],[41.6,41.6],[39.5,41],[35.5,42],[33.3,42],[29.2,41.2]],
  [[47,45],[49.3,46.6],[53,47],[53.5,45.3],[51.4,44.9],[52.8,42],[54,41],[54,38.5],[53,37],[50.3,37.2],[49,38.4],[49.5,40.3],[48.6,41.8]],
  [[10.5,54.4],[13.5,54.6],[18.5,54.8],[21.3,55.2],[21.1,57],[23.8,57.3],[24.4,59.2],[28,59.6],[25,60.3],[22.5,60.2],[21.4,61.5],[21.6,63.2],[24.6,64.9],[25.4,65.4],[22.3,65.9],[19.9,63.6],[17.4,62.4],[17.3,60.7],[18.9,59.8],[18.3,59],[16.5,57],[14.7,56],[12.8,55.4]],
];
/** Hot deserts: [lon0, lat0, lon1, lat1]. */
const DESERTS: [number, number, number, number][] = [
  [-17, 15, 33, 31],
  [35, 14, 58, 31],
  [50, 25, 70, 34],
  [74, 37, 112, 46],
  [118, -31, 142, -20],
  [-117, 24, -103, 37],
  [-72, -30, -67, -17],
  [12, -28, 25, -18],
  [-71, -50, -64, -39],
];
/** Rainforests. */
const JUNGLES: [number, number, number, number][] = [
  [-75, -12, -48, 4],
  [10, -5, 30, 5],
  [95, -8, 150, 8],
];

type Poly = { pts: LonLat[]; box: [number, number, number, number] };
const toPolys = (list: LonLat[][]): Poly[] =>
  list.map((pts) => ({
    pts,
    box: [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))],
  }));
const LAND_P = toPolys(LAND);
const WATER_P = toPolys(WATER);

const inPoly = (poly: Poly, lon: number, lat: number) => {
  const [x0, y0, x1, y1] = poly.box;
  if (lon < x0 || lon > x1 || lat < y0 || lat > y1) return false;
  let inside = false;
  const p = poly.pts;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inBox = (b: [number, number, number, number], lon: number, lat: number) => lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3];

type Surface = "ocean" | "land" | "ice";
/** What covers the Earth at a point; coastlines get a little noise so they look hand-made. */
const surfaceAt = (lon: number, lat: number): Surface => {
  const n = noise3(lon * 0.06, lat * 0.06, 3.3);
  if (lat < -66 + 3 * n || lat > 79 + 3 * n) return "ice";
  const lo = lon + 1.6 * noise3(lat * 0.2, lon * 0.2, 1.1);
  const la = lat + 1.6 * noise3(lon * 0.2, 5.2, lat * 0.2);
  if (WATER_P.some((p) => inPoly(p, lo, la))) return "ocean";
  if (!LAND_P.some((p) => inPoly(p, lo, la))) return "ocean";
  // Greenland's ice sheet.
  if (inPoly(LAND_P[2], lo, la) && la > 62) return "ice";
  return "land";
};

/** Longitude that faces +z when spin = 0 (the Americas). */
const EARTH_LON0 = -75;
const toLonLat = (x: number, y: number, z: number): LonLat => {
  const l = Math.hypot(x, y, z);
  let lon = (Math.atan2(x, z) * 180) / Math.PI + EARTH_LON0;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return [lon, (Math.asin(y / l) * 180) / Math.PI];
};
const fromLonLat = (lon: number, lat: number, r = 1) => {
  const a = ((lon - EARTH_LON0) * Math.PI) / 180;
  const b = (lat * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(b) * Math.sin(a) * r, Math.sin(b) * r, Math.cos(b) * Math.cos(a) * r);
};

let earthGeo: THREE.BufferGeometry | null = null;
const getEarthGeo = () => {
  if (earthGeo) return earthGeo;
  const g = new THREE.IcosahedronGeometry(1, 20);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const C = (h: string) => new THREE.Color(h);
  const ocean = [C("#1C5FDB"), C("#2470F0")];
  const shallow = C("#34AEFF");
  const green = [C("#4CC25A"), C("#38A94C")];
  const jungle = C("#27904A");
  const desert = [C("#EBC96E"), C("#DDB256")];
  const tundra = C("#8DB86A");
  const ice = [C("#F4F9FF"), C("#DCEBFA")];
  const v = new THREE.Vector3();
  for (let f = 0; f < p.count; f += 3) {
    const kinds: Surface[] = [];
    for (let k = 0; k < 3; k++) {
      v.fromBufferAttribute(p, f + k).normalize();
      const [lon, lat] = toLonLat(v.x, v.y, v.z);
      const s = surfaceAt(lon, lat);
      kinds.push(s);
      const r = s === "land" ? 1.022 : s === "ice" ? 1.026 : 1;
      p.setXYZ(f + k, v.x * r, v.y * r, v.z * r);
    }
    const cx = (p.getX(f) + p.getX(f + 1) + p.getX(f + 2)) / 3;
    const cy = (p.getY(f) + p.getY(f + 1) + p.getY(f + 2)) / 3;
    const cz = (p.getZ(f) + p.getZ(f + 1) + p.getZ(f + 2)) / 3;
    const [lon, lat] = toLonLat(cx, cy, cz);
    const s = surfaceAt(lon, lat);
    const n = noise3(cx * 6, cy * 6, cz * 6);
    let c: THREE.Color;
    if (s === "ice") c = ice[n > 0.1 ? 1 : 0];
    else if (s === "land") {
      if (DESERTS.some((b) => inBox(b, lon + 3 * n, lat + 2 * n))) c = desert[n > 0 ? 1 : 0];
      else if (JUNGLES.some((b) => inBox(b, lon + 3 * n, lat + 2 * n))) c = jungle;
      else if (Math.abs(lat) > 58 + 4 * n) c = tundra;
      else c = green[n > 0.05 ? 1 : 0];
    } else c = kinds.some((k) => k !== "ocean") ? shallow : ocean[n > 0 ? 1 : 0];
    for (let k = 0; k < 3; k++) {
      col[(f + k) * 3] = c.r;
      col[(f + k) * 3 + 1] = c.g;
      col[(f + k) * 3 + 2] = c.b;
    }
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  earthGeo = g;
  return g;
};

/** Cloud clusters over the globe: [lon, lat, size, puffs]. */
const EARTH_CLOUDS: [number, number, number, number][] = [
  [-100, 45, 1, 4],
  [-60, -8, 0.8, 3],
  [-30, 30, 1.1, 4],
  [-140, 15, 0.9, 3],
  [-85, -40, 1, 4],
  [10, 55, 0.9, 3],
  [60, -25, 1, 4],
  [120, 35, 0.9, 3],
  [160, -10, 1, 4],
  [-5, -55, 1.2, 4],
  [95, 5, 0.8, 3],
  [-170, 50, 1, 3],
];

/**
 * Low-poly Earth, radius 1 at scale 1 (scale it up for the space shot, e.g. scale 6), axis tilted
 * 23°: blue oceans with light shallows round the coasts, green / jungle / sand / tundra
 * continents raised a touch above the sea, white ice caps, a dozen puffy low-poly clouds
 * drifting slightly faster than the ground, and a soft blue halo. With `spin` = 0 the Americas
 * face +z (the camera); `spin` (radians) turns it eastwards (e.g. t * 0.15).
 */
export const EarthGlobe: React.FC<{ spin?: number; clouds?: boolean; halo?: boolean }> = ({ spin = 0, clouds = true, halo = true }) => {
  const cloudGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const puffs = useMemo(() => {
    const rnd = mulberry(909);
    return EARTH_CLOUDS.flatMap(([lon, lat, s, n]) => {
      const up = fromLonLat(lon, lat).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
      return Array.from({ length: n }).map((_, i) => {
        const off = new THREE.Vector3((i - (n - 1) / 2) * 0.075 * s, 0, (rnd() - 0.5) * 0.06 * s).applyQuaternion(q);
        const r = (0.05 + rnd() * 0.03) * s * (i === 1 || i === 2 ? 1.25 : 1);
        return { pos: up.clone().multiplyScalar(1.1).add(off), q, r };
      });
    });
  }, []);
  return (
    <group rotation={[0, 0, 0.41]}>
      <group rotation={[0, spin, 0]}>
        <mesh geometry={getEarthGeo()} material={vertexMat(0.75, true, 0.16)} />
      </group>
      {clouds ? (
        <group rotation={[0, spin * 1.15 + 0.2, 0]}>
          {puffs.map((pf, i) => (
            <mesh key={i} geometry={cloudGeo} material={toy("#FFFFFF", { rough: 0.9, flat: true, glow: 0.4 })} position={pf.pos} quaternion={pf.q} scale={[pf.r * 1.3, pf.r * 0.6, pf.r]} />
          ))}
        </group>
      ) : null}
      {halo ? <Halo color="#62C4FF" size={2.9} opacity={0.6} /> : null}
    </group>
  );
};

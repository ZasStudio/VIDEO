import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { FONT } from "../../theme";
import { Vec3 } from "../CameraRig";
import { pillowGeometry } from "../dormir/Bedroom";
import { V3, canvasTexture, toy, useFontsReady } from "../inca/kit";
import { NUBI_FIN_TIP, NubiPose } from "../Nubi";
import { Glow, additive, segmentFrame } from "../thanos/FX";

// Nubi's bedroom for "¿Y si tus mentiras salieran sobre tu cabeza?" (agent "casa"): late morning,
// sunny. Lilac walls, a big window on a blue sky (sunbeams with dust motes), a yellow arched
// headboard, a coral-pink duvet that is an animated height field (it covers Nubi lying back up to
// the chin, or its lap when it sits up, and its pedalling legs push bumps through it), a nightstand,
// a yellow rug, an orange beanbag, a plant and posters (one of them a pizza: foreshadowing).
// Props: the phone (ringing / held at the ear), the EMPTY pizza box (crumbs and one sad crust), the
// string of melted cheese stuck on a fin, the golden halo ping.
//
// World units are sized for <Nubi size={2}>; the floor is y = 0, +z points from the back wall to the
// default camera, no front wall. Cheap to render: no shadow maps, four lights, cached materials,
// geometry built once (the duvet and the cheese string are updated in place every frame).

// =======================================================================================
// Layout

export const ROOM = { x0: -4.4, x1: 4.4, back: -2.6, height: 5.8 };
/** The bed: headboard against the back wall, mattress top at `top`. */
export const BED = { x0: -1.4, x1: 1.4, z0: -2.55, z1: 1.0, top: 0.74 };
/** Nightstand right of the bed (top surface at `top`). */
export const NIGHTSTAND = { x: 2.02, z: -1.45, w: 0.82, d: 0.74, top: 1.0 };
/** The window above the headboard (an opening in the back wall). */
export const WINDOW = { x0: -1.55, x1: 1.55, y0: 2.45, y1: 4.65 };
/** Nubi (size 2) sitting up in bed, its back against the pillow (feet sunk in the mattress). */
export const NUBI_SIT: V3 = [0, 0.5, -1.25];
/** Nubi lying back in bed (pivot at its feet, body pitched back by LIE_PITCH): head on the pillow. */
export const NUBI_LIE: V3 = [0, 1.05, -0.25];
export const LIE_PITCH = -1.0;
/** The phone lying on the nightstand, screen up. */
export const PHONE_STAND: V3 = [NIGHTSTAND.x - 0.06, NIGHTSTAND.top + 0.03, NIGHTSTAND.z + 0.16];
/** The round rug in front of the bed, where Nubi stands in "giro". */
export const RUG: V3 = [0.25, 0, 2.7];
export const NUBI_RUG: V3 = [-1.05, 0, 2.3];
/** Chico stands right of Nubi (a little closer to the camera), holding the pizza box. */
export const CHICO_RUG: V3 = [0.7, 0, 3.3];

/** Model units of a <Nubi size={2}> per world unit. */
export const M = 5;
/** Nubi model-unit landmarks: the top of the head, the eyes and where a mouth would be. */
export const HEAD_TOP: Vec3 = [0, 9.9, 0];
export const EYES: Vec3 = [0, 5.5, 4.45];
export const MOUTH: Vec3 = [0, 3.85, 4.45];

/** Nubi's pivot and pitch between sitting up (lie 0) and lying back on the pillow (lie 1). */
export const bedPlacement = (lie: number): { position: V3; pitch: number } => ({
  position: [mix(NUBI_SIT[0], NUBI_LIE[0], lie), mix(NUBI_SIT[1], NUBI_LIE[1], lie), mix(NUBI_SIT[2], NUBI_LIE[2], lie)],
  pitch: LIE_PITCH * lie,
});

// =======================================================================================
// Helpers

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, x: number) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function mix(a: number, b: number, k: number) {
  return a + (b - a) * k;
}
const once = <T,>(make: () => T) => {
  let v: T | undefined;
  return () => (v ??= make());
};
const rbox = (w: number, h: number, d: number, r: number, seg = 3) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
const texMatCache = new Map<string, THREE.MeshStandardMaterial>();
/** Cached standard material on a canvas texture (an emissive share keeps the colours bright). */
const texMat = (key: string, w: number, h: number, draw: Draw, o: { glow?: number; rough?: number; repeat?: boolean; side?: THREE.Side; transparent?: boolean } = {}) => {
  let m = texMatCache.get(key);
  if (!m) {
    const tex = canvasTexture(`casa-${key}`, w, h, draw, { wrapS: !!o.repeat, wrapT: !!o.repeat });
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: o.rough ?? 0.85,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tex,
      emissiveIntensity: o.glow ?? 0.15,
      side: o.side ?? THREE.FrontSide,
      transparent: o.transparent ?? false,
    });
    texMatCache.set(key, m);
  }
  return m;
};
const basicCache = new Map<string, THREE.MeshBasicMaterial>();
const texBasic = (key: string, w: number, h: number, draw: Draw) => {
  let m = basicCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: canvasTexture(`casa-${key}`, w, h, draw), toneMapped: false });
    basicCache.set(key, m);
  }
  return m;
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};
const star = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, inner = 0.45) => {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = k % 2 ? r * inner : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
};
const cloud = (ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) => {
  ctx.beginPath();
  ctx.arc(cx - s * 0.9, cy + s * 0.2, s * 0.62, 0, Math.PI * 2);
  ctx.arc(cx, cy - s * 0.15, s * 0.85, 0, Math.PI * 2);
  ctx.arc(cx + s * 0.95, cy + s * 0.2, s * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - s * 0.9, cy + s * 0.1, s * 1.85, s * 0.72);
};

/** XY plane from (x0, y0) to (x1, y1), uvs in world units / period (seamless tiling). */
const planeXY = (x0: number, x1: number, y0: number, y1: number, period: number) => {
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / period, p.getY(i) / period);
  return g;
};

// =======================================================================================
// Where things are on a Nubi (model units → world), for anchors and cameras.

const _v = new THREE.Vector3();
const _e = new THREE.Euler();
/** World position of a point given in a Nubi's model units (body 10 wide, feet at y 0, front +z). */
export const nubiPoint = (position: Vec3, pose: NubiPose, local: Vec3, rotationY = 0, size = 2): Vec3 => {
  const sq = Math.max(0.3, pose.squash ?? 1);
  const sx = 1 / Math.sqrt(sq);
  _v.set(local[0] * sx, local[1] * sq, local[2] * sx);
  _v.applyEuler(_e.set(pose.pitch ?? 0, pose.yaw ?? 0, pose.roll ?? 0));
  _v.y += pose.hop ?? 0;
  _v.multiplyScalar(size / 10);
  _v.applyEuler(_e.set(0, rotationY, 0));
  return [_v.x + position[0], _v.y + position[1], _v.z + position[2]];
};

/** Body-frame (model units) position of a fin tip for a given raise (R = screen-right / +x fin). */
export const finTip = (raise: number, side: "R" | "L" = "R"): Vec3 => {
  const a = raise * 0.55;
  const [tx, ty, tz] = NUBI_FIN_TIP;
  const s = side === "R" ? 1 : -1;
  // Rz(a) then Ry(-0.12), mirrored in x for the left fin.
  const rx = tx * Math.cos(a) - ty * Math.sin(a);
  const ry = tx * Math.sin(a) + ty * Math.cos(a);
  const c = Math.cos(-0.12);
  const sn = Math.sin(-0.12);
  const x = rx * c + tz * sn;
  const z = -rx * sn + tz * c;
  return [s * (4.8 + x), 5.0 + ry, 0.3 + z];
};

/**
 * Children of a fin tip (pass as holdR / holdL), turned back to the body's axes so they stay
 * upright whatever the raise; `offset` (model units, body axes) shifts them from the tip.
 */
export const OnFin: React.FC<{ raise: number; side?: "R" | "L"; offset?: Vec3; children: React.ReactNode }> = ({ raise, side = "R", offset = [0, 0, 0], children }) => {
  const s = side === "R" ? 1 : -1;
  return (
    <group rotation={[0, 0, -s * raise * 0.55]}>
      <group rotation={[0, s * 0.12, 0]}>
        <group position={offset}>{children}</group>
      </group>
    </group>
  );
};

// =======================================================================================
// Textures

const wallpaperDraw: Draw = (ctx, w, h) => {
  ctx.fillStyle = "#C3B3FF";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.10)";
  for (let i = 0; i < 4; i++) ctx.fillRect(i * (w / 4), 0, w / 8, h);
  for (let i = 0; i < 6; i++) {
    const x = ((i * 0.37 + 0.11) % 1) * w;
    const y = ((i * 0.61 + 0.23) % 1) * h;
    ctx.fillStyle = i % 2 ? "rgba(255,240,170,0.7)" : "rgba(255,255,255,0.55)";
    if (i % 2) {
      star(ctx, x, y, 8, 0.45);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};
const floorDraw: Draw = (ctx, w, h) => {
  const n = 4;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = ["#E9BD8C", "#E1B07E", "#EFC696", "#E4B583"][i];
    ctx.fillRect(0, (i * h) / n, w, h / n);
    ctx.fillStyle = "rgba(120,70,30,0.3)";
    ctx.fillRect(0, (i * h) / n, w, 3);
    ctx.fillRect(((i * 0.43 + 0.2) % 1) * w, (i * h) / n, 3, h / n);
  }
};
const duvetDraw: Draw = (ctx, w, h) => {
  ctx.fillStyle = "#FF8FA6";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  cloud(ctx, w * 0.27, h * 0.3, w * 0.07);
  cloud(ctx, w * 0.76, h * 0.77, w * 0.07);
  // Little suns and stars.
  for (const [x, y, r] of [
    [0.74, 0.24, 0.045],
    [0.2, 0.74, 0.05],
  ]) {
    ctx.fillStyle = "#FFD84D";
    ctx.beginPath();
    ctx.arc(x * w, y * h, r * w, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FFD84D";
    ctx.lineWidth = w * 0.012;
    ctx.lineCap = "round";
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x * w + Math.cos(a) * r * w * 1.35, y * h + Math.sin(a) * r * w * 1.35);
      ctx.lineTo(x * w + Math.cos(a) * r * w * 1.8, y * h + Math.sin(a) * r * w * 1.8);
      ctx.stroke();
    }
  }
  ctx.fillStyle = "#FFF2A6";
  for (const [x, y, r] of [
    [0.5, 0.52, 0.028],
    [0.92, 0.5, 0.024],
    [0.06, 0.08, 0.024],
    [0.45, 0.93, 0.022],
  ]) {
    star(ctx, x * w, y * h, r * w);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.setLineDash([]);
};
const rugDraw: Draw = (ctx, w) => {
  const c = w / 2;
  ["#FFC93D", "#FFFFFF", "#FF7F6E", "#FFFFFF", "#FFC93D"].forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(c, c, c * (1 - i * 0.17), 0, Math.PI * 2);
    ctx.fill();
  });
};
const curtainDraw: Draw = (ctx, w, h) => {
  ctx.fillStyle = "#FF8B73";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  for (let i = 0; i < 4; i++) ctx.fillRect((i + 0.25) * (w / 4), 0, w / 10, h);
  ctx.fillStyle = "#FFF3C2";
  for (let j = 0; j < 7; j++)
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(w * (0.28 + 0.44 * i), h * (0.08 + 0.13 * j) + (i ? 18 : 0), 6, 0, Math.PI * 2);
      ctx.fill();
    }
};
/** The sunny view through the window: blue sky, clouds, the sun, trees and rooftops. */
const viewDraw: Draw = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#3E9BFF");
  g.addColorStop(0.65, "#9FD6FF");
  g.addColorStop(1, "#D9F1FF");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Sun and rays.
  const sx = w * 0.3;
  const sy = h * 0.2;
  const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, h * 0.4);
  rg.addColorStop(0, "rgba(255,250,210,1)");
  rg.addColorStop(0.25, "rgba(255,236,150,0.75)");
  rg.addColorStop(1, "rgba(255,236,150,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#FFF6C8";
  ctx.beginPath();
  ctx.arc(sx, sy, h * 0.075, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  for (const [x, y, s] of [
    [0.62, 0.22, 0.05],
    [0.86, 0.36, 0.04],
    [0.1, 0.42, 0.035],
    [0.46, 0.4, 0.03],
  ])
    cloud(ctx, x * w, y * h, s * w);
  // Rooftops and trees along the bottom.
  const roofs: [number, number, number, string][] = [
    [0.02, 0.16, 0.7, "#FF8A65"],
    [0.2, 0.14, 0.66, "#FFB74D"],
    [0.55, 0.18, 0.69, "#F06292"],
    [0.78, 0.15, 0.64, "#FF8A65"],
  ];
  for (const [x, bw, top, col] of roofs) {
    ctx.fillStyle = "#FFF4E2";
    ctx.fillRect(x * w, (top + 0.06) * h, bw * w, h);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x * w - 8, (top + 0.07) * h);
    ctx.lineTo((x + bw / 2) * w, top * h - 10);
    ctx.lineTo((x + bw) * w + 8, (top + 0.07) * h);
    ctx.fill();
    ctx.fillStyle = "#7FC8FF";
    for (let k = 0; k < 3; k++) ctx.fillRect((x + 0.025 + k * bw * 0.32) * w, (top + 0.12) * h, bw * 0.18 * w, 0.07 * h);
  }
  for (let i = 0; i < 9; i++) {
    const x = (i / 8) * w;
    const r = h * (0.1 + 0.05 * hash(i + 3));
    ctx.fillStyle = i % 2 ? "#4CC26A" : "#3BAA5C";
    ctx.beginPath();
    ctx.arc(x, h * 0.9, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.7, h * 0.86, r * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
};
const posterPizza: Draw = (ctx, W, H) => {
  ctx.fillStyle = "#FF5A4E";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, 8);
  ctx.fillRect(0, H - 8, W, 8);
  // A slice: crust, cheese, pepperoni.
  ctx.save();
  ctx.translate(W / 2, H * 0.47);
  ctx.fillStyle = "#E89A3C";
  ctx.beginPath();
  ctx.moveTo(-58, -50);
  ctx.quadraticCurveTo(0, -78, 58, -50);
  ctx.lineTo(0, 70);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#FFD23F";
  ctx.beginPath();
  ctx.moveTo(-50, -40);
  ctx.quadraticCurveTo(0, -62, 50, -40);
  ctx.lineTo(0, 62);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#D93A2B";
  for (const [x, y] of [
    [-18, -24],
    [16, -18],
    [0, 12],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `900 40px ${FONT.heavy}`;
  ctx.textAlign = "center";
  ctx.fillText("PIZZA", W / 2, H * 0.92);
};
const posterRainbow: Draw = (ctx, W, H) => {
  ctx.fillStyle = "#E9F7FF";
  ctx.fillRect(0, 0, W, H);
  const cols = ["#FF6B8B", "#FFB04A", "#FFE15A", "#6EDB8F", "#6EC1FF", "#B98CFF"];
  ctx.lineWidth = 11;
  cols.forEach((c, i) => {
    ctx.strokeStyle = c;
    ctx.beginPath();
    ctx.arc(W / 2, H * 0.62, 70 - i * 11, Math.PI, 0);
    ctx.stroke();
  });
  ctx.fillStyle = "#FFFFFF";
  for (const x of [W * 0.2, W * 0.8]) {
    ctx.beginPath();
    ctx.arc(x, H * 0.64, 16, 0, Math.PI * 2);
    ctx.arc(x + 14, H * 0.64, 12, 0, Math.PI * 2);
    ctx.fill();
  }
};
const posterGame: Draw = (ctx, W, H) => {
  ctx.fillStyle = "#4FC3F7";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#3A3F58";
  roundRect(ctx, 22, H * 0.4, W - 44, 64, 30);
  ctx.fill();
  ctx.fillStyle = "#FF5A79";
  ctx.beginPath();
  ctx.arc(W - 52, H * 0.4 + 26, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFD23F";
  ctx.beginPath();
  ctx.arc(W - 34, H * 0.4 + 40, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(40, H * 0.4 + 27, 30, 10);
  ctx.fillRect(50, H * 0.4 + 17, 10, 30);
  ctx.font = `900 34px ${FONT.heavy}`;
  ctx.textAlign = "center";
  ctx.fillText("GG!", W / 2, H * 0.25);
};
const beamDraw: Draw = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.18, "rgba(255,255,255,1)");
  g.addColorStop(0.6, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

// =======================================================================================
// Geometry (built once)

const geos = once(() => {
  const B = BED;
  // Arched headboard.
  const hw = 1.62;
  const head = new THREE.Shape();
  head.moveTo(-hw, 0);
  head.lineTo(hw, 0);
  head.lineTo(hw, 1.25);
  head.absarc(0, 1.25, hw, 0, Math.PI, false);
  head.lineTo(-hw, 0);
  const headGeo = new THREE.ExtrudeGeometry(head, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 24 });
  headGeo.scale(1, 0.62, 1);
  const curtain = new THREE.PlaneGeometry(0.5, 2.9, 10, 2);
  const cp = curtain.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < cp.count; i++) cp.setZ(i, 0.06 * Math.sin((cp.getX(i) / 0.5) * Math.PI * 4));
  curtain.computeVertexNormals();
  // Beanbag: a squashed blob with a dent where you sit.
  const bean = new THREE.SphereGeometry(0.8, 28, 18);
  const bp = bean.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i);
    const y = bp.getY(i);
    const z = bp.getZ(i);
    const r = Math.hypot(x, z);
    const dent = y > 0 ? 0.32 * Math.exp(-((r / 0.45) ** 2)) : 0;
    bp.setXYZ(i, x * 1.08, Math.max(-0.5, y * 0.66 - dent), z);
  }
  bean.computeVertexNormals();
  bean.translate(0, 0.5, 0);
  const beam = new THREE.CylinderGeometry(0.32, 0.6, 1, 14, 1, true);
  beam.translate(0, 0.5, 0);
  return {
    floor: planeXY(-12, 12, -24, -ROOM.back, 1.4).rotateX(-Math.PI / 2),
    wallL: planeXY(ROOM.x0, WINDOW.x0, 0, ROOM.height, 1.6),
    wallR: planeXY(WINDOW.x1, ROOM.x1, 0, ROOM.height, 1.6),
    wallBelow: planeXY(WINDOW.x0, WINDOW.x1, 0, WINDOW.y0, 1.6),
    wallAbove: planeXY(WINDOW.x0, WINDOW.x1, WINDOW.y1, ROOM.height, 1.6),
    side: planeXY(-9, -ROOM.back, 0, ROOM.height, 1.6),
    sideR: planeXY(ROOM.back, 9, 0, ROOM.height, 1.6),
    skirt: rbox(1, 0.14, 0.05, 0.02, 2),
    frame: rbox(1, 1, 1, 0.03, 2),
    bedBase: rbox(B.x1 - B.x0 + 0.16, 0.34, B.z1 - B.z0 + 0.06, 0.1),
    bedLeg: new THREE.CylinderGeometry(0.07, 0.06, 0.14, 12),
    mattress: rbox(B.x1 - B.x0, 0.3, B.z1 - B.z0 - 0.05, 0.12),
    head: headGeo,
    pillow: pillowGeometry(2.35, 0.6, 0.85),
    stand: rbox(NIGHTSTAND.w, NIGHTSTAND.top, NIGHTSTAND.d, 0.08),
    drawer: rbox(NIGHTSTAND.w - 0.14, 0.3, 0.02, 0.01, 2),
    knob: new THREE.SphereGeometry(0.045, 12, 8),
    lampBase: new THREE.CylinderGeometry(0.13, 0.15, 0.05, 20),
    lampStem: new THREE.CylinderGeometry(0.03, 0.03, 0.34, 10),
    lampShade: new THREE.CylinderGeometry(0.13, 0.24, 0.26, 24, 1, true),
    curtain,
    rod: new THREE.CylinderGeometry(0.035, 0.035, 4.0, 10).rotateZ(Math.PI / 2),
    rodEnd: new THREE.SphereGeometry(0.07, 12, 8),
    rug: new THREE.CircleGeometry(1.5, 48),
    poster: new THREE.PlaneGeometry(1, 1),
    view: new THREE.PlaneGeometry(26, 13),
    sill: rbox(WINDOW.x1 - WINDOW.x0 + 0.4, 0.1, 0.36, 0.03, 2),
    bean,
    pot: new THREE.CylinderGeometry(0.24, 0.18, 0.42, 20),
    leaf: new THREE.SphereGeometry(0.3, 14, 10),
    beam,
  };
});

// =======================================================================================
// The duvet: a height field over the mattress, draped over the sides and the foot. It covers
// Nubi lying back up to the chin (lie 1) or its lap when it sits up (lie 0); the pedalling legs
// push two bumps through it (`pedal` amplitude, `phase` radians), `bob` lifts it with the body.

const DUVET = { NX: 44, NZ: 40, X0: BED.x0 - 0.34, X1: BED.x1 + 0.34, Z1: BED.z1 + 0.34, edgeSit: NUBI_SIT[2] - 0.15, edgeLie: -0.5 };

export type DuvetProps = { lie: number; pedal?: number; phase?: number; bob?: number };

const duvetY = (x: number, z: number, lie: number, pedal: number, phase: number, bob: number) => {
  const top = BED.top + 0.09;
  const wr = 0.014 * Math.sin(x * 6.1 + z * 2.3) + 0.012 * Math.sin(z * 8.7 - x * 3.1);
  // Sitting: a soft mound over the lap, highest against the body; two stubby leg bumps.
  const front = NUBI_SIT[2] + 0.88;
  const dx = Math.max(0, Math.abs(x) - 0.85);
  const dz = z < front ? 0 : z - front;
  let sit = top + 0.18 * (1 - smooth(0, 0.55, Math.hypot(dx, dz * 0.9))) + 0.07 * (1 - smooth(0, 1.6, Math.hypot(dx * 0.7, dz * 0.6)));
  // Lying: a big mound over the reclined body, up to the chin, higher over the legs (they stick
  // up and forwards from the bottom of the body), falling towards the foot.
  const prof = 1 - smooth(1.08, 1.62, Math.abs(x));
  const rise = 0.22 * smooth(-0.5, -0.12, z);
  const fall = smooth(0.12, 1.1, z);
  let lyingY = top + (mix(2.3 + rise, top, fall) - top) * prof;
  lyingY += bob * (1 - smooth(-0.3, 0.7, z)) * prof;
  // The legs: two bumps that pedal (up/down and to and fro, alternating).
  for (const side of [-1, 1]) {
    const ph = phase + (side > 0 ? Math.PI : 0);
    const up = Math.max(0, Math.sin(ph));
    const lx = side * 0.4;
    const lzLie = 0.42 + 0.16 * Math.cos(ph) * pedal;
    const lzSit = front + 0.55 + 0.1 * Math.cos(ph) * pedal;
    const kLie = 1 - smooth(0, 0.42, Math.hypot(x - lx, (z - lzLie) * 0.85));
    const kSit = 1 - smooth(0, 0.32, Math.hypot(x - lx, z - lzSit));
    lyingY += kLie * prof * (0.1 + pedal * (0.1 + 0.34 * up));
    sit += kSit * (0.07 + pedal * (0.03 + 0.14 * up));
  }
  return mix(sit, lyingY, lie) + wr;
};

/** Top of the duvet at (x, z) without the legs' pedalling (to lay a prop on it). */
export const duvetHeight = (x: number, z: number, lie: number) => duvetY(x, z, lie, 0, 0, 0);

export const Duvet: React.FC<DuvetProps> = ({ lie, pedal = 0, phase = 0, bob = 0 }) => {
  const g = useMemo(() => new THREE.PlaneGeometry(1, 1, DUVET.NX, DUVET.NZ), []);
  const mat = texMat("duvet", 512, 512, duvetDraw, { repeat: true, glow: 0.16, side: THREE.DoubleSide });
  const pos = g.attributes.position as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const { X0, X1, Z1 } = DUVET;
  const Z0 = mix(DUVET.edgeSit, DUVET.edgeLie, lie);
  const mx0 = BED.x0 + 0.03;
  const mx1 = BED.x1 - 0.03;
  const mz1 = BED.z1 - 0.03;
  const cols = DUVET.NX + 1;
  for (let i = 0; i < pos.count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const u = col / DUVET.NX;
    const w = row / DUVET.NZ;
    let x = X0 + (X1 - X0) * u;
    let z = Z0 + (Z1 - Z0) * w;
    uv.setXY(i, (x - X0) / 1.6, (z - DUVET.edgeSit) / 1.6);
    let y = duvetY(x, z, lie, pedal, phase, bob);
    // The hem at the top edge rolls down a little (the duvet has thickness).
    if (row === 0) y -= 0.1;
    // Drape over the sides and the foot.
    const ex = x < mx0 ? mx0 - x : x > mx1 ? x - mx1 : 0;
    const ez = z > mz1 ? z - mz1 : 0;
    const e = Math.max(ex, ez);
    if (e > 0) {
      const base = BED.top + 0.09 + (y - BED.top - 0.09) * (1 - smooth(0, 0.12, e));
      y = base - Math.min(0.5, e * 1.9);
      if (ex > 0) x = x < mx0 ? mx0 - Math.min(ex, 0.07) - 0.02 * Math.min(1, ex * 4) : mx1 + Math.min(ex, 0.07) + 0.02 * Math.min(1, ex * 4);
      if (ez > 0) z = mz1 + Math.min(ez, 0.07);
    }
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  uv.needsUpdate = true;
  g.computeVertexNormals();
  return <mesh geometry={g} material={mat} />;
};

// =======================================================================================
// The room

/** Sunbeams from the window towards the floor, with dust motes drifting in them. */
const Sunbeams: React.FC<{ t: number; on: number }> = ({ t, on }) => {
  const g = geos();
  const mat = useMemo(
    () =>
      additive(
        new THREE.MeshBasicMaterial({ map: canvasTexture("casa-beam", 16, 128, beamDraw), color: "#FFE3A0", toneMapped: false, side: THREE.DoubleSide, opacity: 0.1 }),
      ),
    [],
  );
  mat.opacity = 0.1 * on;
  const beams = useMemo(
    () =>
      [
        [-0.9, 4.1, -2.9, -0.2, 0.0, 1.9],
        [0.15, 4.2, -2.9, 1.1, 0.0, 2.1],
        [1.0, 3.9, -2.9, 2.1, 0.0, 1.6],
      ].map(([x0, y0, z0, x1, y1, z1]) => ({ from: [x0, y0, z0] as V3, ...segmentFrame([x0, y0, z0], [x1, y1, z1]) })),
    [],
  );
  const motes = useMemo(() => {
    const n = 46;
    const base = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const k = hash(i + 1);
      base[i * 3] = -1.2 + 3.0 * hash(i + 11);
      base[i * 3 + 1] = 0.6 + 3.2 * k;
      base[i * 3 + 2] = -2.2 + 3.6 * (1 - k) + 0.6 * hash(i + 21);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
    const m = additive(new THREE.PointsMaterial({ color: "#FFF4D0", size: 0.035, sizeAttenuation: true, toneMapped: false, opacity: 0.8 }));
    return { base, geo, m, n };
  }, []);
  const p = motes.geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < motes.n; i++) {
    p.setXYZ(
      i,
      motes.base[i * 3] + 0.12 * Math.sin(t * 0.4 + i * 1.7),
      motes.base[i * 3 + 1] + 0.1 * Math.sin(t * 0.33 + i * 2.3),
      motes.base[i * 3 + 2] + 0.08 * Math.cos(t * 0.37 + i),
    );
  }
  p.needsUpdate = true;
  motes.m.opacity = 0.75 * on;
  if (on <= 0.01) return null;
  return (
    <group>
      {beams.map((b, i) => (
        <mesh key={i} geometry={g.beam} material={mat} position={b.from} quaternion={b.q} scale={[1, b.len, 1]} renderOrder={4} />
      ))}
      <points geometry={motes.geo} material={motes.m} renderOrder={5} />
    </group>
  );
};

export type CasaRoomProps = {
  t?: number;
  /** The sunbeams (0 hides them, e.g. when a camera looks straight through them). */
  beams?: number;
};

/** Nubi's sunny bedroom (without the duvet: render <Duvet> for it). */
export const CasaRoom: React.FC<CasaRoomProps> = ({ t = 0, beams = 1 }) => {
  const g = geos();
  const ready = useFontsReady();
  const wall = texMat("wallpaper", 256, 256, wallpaperDraw, { repeat: true, glow: 0.18, rough: 0.9 });
  const white = toy("#FFFFFF", { rough: 0.6, glow: 0.16 });
  const W = WINDOW;
  const zb = ROOM.back;
  const viewMat = texBasic("view", 1024, 512, viewDraw);
  return (
    <group>
      {/* Floor, rug, walls (one-sided planes facing into the room). */}
      <mesh geometry={g.floor} material={texMat("floor", 256, 256, floorDraw, { repeat: true, glow: 0.12 })} />
      <mesh geometry={g.rug} material={texMat("rug", 256, 256, rugDraw, { glow: 0.16 })} rotation={[-Math.PI / 2, 0, 0]} position={[RUG[0], 0.006, RUG[2]]} scale={[1.35, 1.0, 1]} />
      <group position={[0, 0, zb]}>
        <mesh geometry={g.wallL} material={wall} />
        <mesh geometry={g.wallR} material={wall} />
        <mesh geometry={g.wallBelow} material={wall} />
        <mesh geometry={g.wallAbove} material={wall} />
      </group>
      <mesh geometry={g.side} material={wall} position={[ROOM.x0, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={g.sideR} material={wall} position={[ROOM.x1, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
      <mesh geometry={g.skirt} material={white} position={[0, 0.07, zb + 0.03]} scale={[ROOM.x1 - ROOM.x0, 1, 1]} />

      {/* The view, the window frame, the sill and the coral curtains. */}
      <mesh geometry={g.view} material={viewMat} position={[-1.5, 3.2, -11]} />
      <Glow color="#FFF2B0" size={7} opacity={0.75} position={[-3.6, 6.4, -10.8]} />
      {[
        [(W.x0 + W.x1) / 2, W.y1 + 0.06, W.x1 - W.x0 + 0.24, 0.12],
        [(W.x0 + W.x1) / 2, W.y0 - 0.04, W.x1 - W.x0 + 0.24, 0.1],
        [(W.x0 + W.x1) / 2, (W.y0 + W.y1) / 2, W.x1 - W.x0, 0.06],
      ].map(([x, y, w, h], i) => (
        <mesh key={`h${i}`} geometry={g.frame} material={white} position={[x, y, zb + 0.02]} scale={[w, h, 0.22]} />
      ))}
      {[W.x0 - 0.06, (W.x0 + W.x1) / 2, W.x1 + 0.06].map((x, i) => (
        <mesh key={`v${i}`} geometry={g.frame} material={white} position={[x, (W.y0 + W.y1) / 2, zb + 0.02]} scale={[i === 1 ? 0.06 : 0.12, W.y1 - W.y0 + 0.2, 0.22]} />
      ))}
      <mesh geometry={g.sill} material={white} position={[(W.x0 + W.x1) / 2, W.y0 - 0.1, zb + 0.14]} />
      <mesh geometry={g.rod} material={toy("#FFC93D", { glow: 0.2 })} position={[0, W.y1 + 0.34, zb + 0.24]} />
      {[-2.0, 2.0].map((x) => (
        <mesh key={x} geometry={g.rodEnd} material={toy("#FF7F6E", { glow: 0.25 })} position={[x, W.y1 + 0.34, zb + 0.24]} />
      ))}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          geometry={g.curtain}
          material={texMat("curtain", 128, 512, curtainDraw, { glow: 0.18, side: THREE.DoubleSide })}
          position={[s * (W.x1 + 0.3), W.y1 + 0.32 - 1.45, zb + 0.22]}
          rotation={[0, 0, s * 0.03]}
        />
      ))}
      {/* Plant on the sill. */}
      <group position={[-1.05, W.y0 - 0.05, zb + 0.16]} scale={0.55}>
        <mesh geometry={g.pot} material={toy("#E9784F", { glow: 0.16 })} position={[0, 0.21, 0]} />
        {[0, 1, 2, 3, 4, 5].map((k) => {
          const a = (k / 6) * Math.PI * 2 + 0.3;
          return (
            <mesh key={k} geometry={g.leaf} material={toy(k % 2 ? "#45C46E" : "#38B060", { glow: 0.16 })} position={[Math.cos(a) * 0.22, 0.62 + 0.12 * (k % 3), Math.sin(a) * 0.16]} rotation={[0.4 * Math.sin(a), a, 0.6 * Math.cos(a)]} scale={[0.55, 1.1, 0.22]} />
          );
        })}
      </group>

      {/* Posters: the pizza (left of the window), the rainbow (over the nightstand), the game (left wall). */}
      {ready ? (
        <>
          <mesh geometry={g.poster} material={texMat("poster-pizza", 160, 210, posterPizza, { glow: 0.22 })} position={[-2.75, 2.75, zb + 0.02]} rotation={[0, 0, 0.05]} scale={[0.86, 1.13, 1]} />
          <mesh geometry={g.poster} material={texMat("poster-rainbow", 160, 210, posterRainbow, { glow: 0.22 })} position={[2.75, 2.9, zb + 0.02]} rotation={[0, 0, -0.04]} scale={[0.8, 1.05, 1]} />
          <mesh geometry={g.poster} material={texMat("poster-game", 160, 210, posterGame, { glow: 0.22 })} position={[ROOM.x0 + 0.02, 2.5, 0.2]} rotation={[0, Math.PI / 2, 0.03]} scale={[0.8, 1.05, 1]} />
        </>
      ) : null}

      {/* The bed: legs, base, mattress, arched headboard, pillow (the duvet is separate). */}
      {[
        [BED.x0 + 0.12, BED.z0 + 0.12],
        [BED.x1 - 0.12, BED.z0 + 0.12],
        [BED.x0 + 0.12, BED.z1 - 0.12],
        [BED.x1 - 0.12, BED.z1 - 0.12],
      ].map(([x, z]) => (
        <mesh key={`${x}-${z}`} geometry={g.bedLeg} material={white} position={[x, 0.07, z]} />
      ))}
      <mesh geometry={g.bedBase} material={toy("#F2B880", { glow: 0.16 })} position={[0, 0.3, (BED.z0 + BED.z1) / 2]} />
      <mesh geometry={g.mattress} material={white} position={[0, BED.top - 0.15, (BED.z0 + BED.z1) / 2 + 0.02]} />
      <mesh geometry={g.head} material={toy("#FFC94D", { glow: 0.18, rough: 0.5 })} position={[0, 0.15, zb + 0.06]} />
      <mesh geometry={g.pillow} material={toy("#FFFFFF", { rough: 0.75, glow: 0.18 })} position={[0, BED.top + 0.38, zb + 0.44]} rotation={[-1.05, 0, 0]} />

      {/* Nightstand with a little lamp (off: it's daytime). */}
      <group position={[NIGHTSTAND.x, 0, NIGHTSTAND.z]}>
        <mesh geometry={g.stand} material={white} position={[0, NIGHTSTAND.top / 2, 0]} />
        <mesh geometry={g.drawer} material={toy("#FF8A73", { glow: 0.16 })} position={[0, NIGHTSTAND.top - 0.3, NIGHTSTAND.d / 2 + 0.005]} />
        <mesh geometry={g.knob} material={toy("#FFC93D", { glow: 0.2 })} position={[0, NIGHTSTAND.top - 0.3, NIGHTSTAND.d / 2 + 0.03]} />
        <group position={[0.18, NIGHTSTAND.top, -0.16]}>
          <mesh geometry={g.lampBase} material={toy("#4FC3F7", { glow: 0.16 })} position={[0, 0.025, 0]} />
          <mesh geometry={g.lampStem} material={white} position={[0, 0.22, 0]} />
          <mesh geometry={g.lampShade} material={toy("#4FC3F7", { glow: 0.2, side: THREE.DoubleSide })} position={[0, 0.47, 0]} />
        </group>
      </group>

      {/* The beanbag in the front-left corner. */}
      <mesh geometry={g.bean} material={toy("#FF8A3D", { glow: 0.16, rough: 0.7 })} position={[-2.75, 0, 1.4]} rotation={[0, 0.5, 0]} />

      <Sunbeams t={t} on={beams} />
    </group>
  );
};

/**
 * Late-morning lights (four, no shadows): a warm sky fill, a soft key from the camera side, the
 * sun through the window (a warm rim on the characters) and a warm bounce over the bed.
 */
export const CasaLights: React.FC<{ keyLight?: number; keyFrom?: V3; sun?: number }> = ({ keyLight = 1, keyFrom = [-4, 7, 9], sun = 1 }) => (
  <>
    <hemisphereLight args={["#FFF4E6", "#C9A07C", 1.35]} />
    <directionalLight position={keyFrom} intensity={1.65 * keyLight} color="#FFF4E4" />
    <directionalLight position={[-2, 7, -10]} intensity={1.5 * sun} color="#FFD27A" />
    <pointLight position={[0.4, 3.3, -1.0]} intensity={1.1} distance={6} decay={1.4} color="#FFE2A8" />
  </>
);

// =======================================================================================
// The phone (world units, screen towards +z, centred).

export type CasaPhoneScreen = "off" | "call" | "talk";
const phoneDraw =
  (mode: CasaPhoneScreen): Draw =>
  (ctx, w, h) => {
    if (mode === "off") {
      ctx.fillStyle = "#151824";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.2);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, h * 0.12);
      ctx.lineTo(0, h * 0.34);
      ctx.fill();
      return;
    }
    const talk = mode === "talk";
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, talk ? "#46EBA0" : "#2E3A8C");
    g.addColorStop(1, talk ? "#3CC8FF" : "#4FC3F7");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // The caller: the friend (a light-blue cube with an orange cap).
    const cx = w / 2;
    const cy = h * 0.33;
    ctx.fillStyle = talk ? "#FFFFFF" : "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6EC1FF";
    roundRect(ctx, cx - w * 0.2, cy - w * 0.16, w * 0.4, w * 0.36, w * 0.06);
    ctx.fill();
    ctx.fillStyle = "#FF7043";
    roundRect(ctx, cx - w * 0.17, cy - w * 0.25, w * 0.34, w * 0.12, w * 0.05);
    ctx.fill();
    ctx.fillStyle = "#151515";
    ctx.fillRect(cx - w * 0.1, cy - w * 0.02, w * 0.045, w * 0.09);
    ctx.fillRect(cx + w * 0.055, cy - w * 0.02, w * 0.045, w * 0.09);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `900 ${Math.round(w * 0.16)}px ${FONT.heavy}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("AMIGO", cx, h * 0.6);
    if (talk) {
      // In call: the timer and a big red hang-up button.
      ctx.font = `800 ${Math.round(w * 0.13)}px ${FONT.heavy}`;
      ctx.fillText("0:47", cx, h * 0.69);
      ctx.fillStyle = "#FF4757";
      ctx.beginPath();
      ctx.arc(cx, h * 0.85, w * 0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      roundRect(ctx, cx - w * 0.08, h * 0.85 - w * 0.025, w * 0.16, w * 0.05, w * 0.025);
      ctx.fill();
      return;
    }
    // Answer / decline.
    ctx.fillStyle = "#2ED573";
    ctx.beginPath();
    ctx.arc(w * 0.3, h * 0.84, w * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FF4757";
    ctx.beginPath();
    ctx.arc(w * 0.7, h * 0.84, w * 0.11, 0, Math.PI * 2);
    ctx.fill();
  };

const phoneGeos = once(() => ({
  body: rbox(0.36, 0.66, 0.05, 0.06),
  screen: new THREE.PlaneGeometry(0.31, 0.58),
  cam: rbox(0.1, 0.1, 0.02, 0.02, 2),
}));

/** Nubi's phone: coral case, screen towards +z. `screen` "call" lights it up with the incoming call. */
export const CasaPhone: React.FC<{ screen?: CasaPhoneScreen; glow?: number }> = ({ screen = "off", glow = 0 }) => {
  const g = phoneGeos();
  const ready = useFontsReady();
  const mat = ready || screen === "off" ? texBasic(`phone-${screen}`, 128, 240, phoneDraw(screen)) : texBasic("phone-off", 128, 240, phoneDraw("off"));
  return (
    <group>
      <mesh geometry={g.body} material={toy("#FF5E6C", { rough: 0.4, glow: 0.18 })} />
      <mesh geometry={g.screen} material={mat} position={[0, 0, 0.0255]} />
      <mesh geometry={g.cam} material={toy("#1A1C26")} position={[-0.09, 0.23, -0.03]} />
      {glow > 0 ? <Glow color="#9FFFE0" size={0.85} opacity={0.5 * glow} position={[0, 0, 0.08]} /> : null}
    </group>
  );
};

/** Where the phone sits at Nubi's "ear" (body frame, model units): beside the head, a bit forward. */
export const EAR_AT: Vec3 = [6.25, 7.3, 2.1];
/**
 * The phone held by the fin (pass as holdR with the same raise). `ear` 1: big, upright against the
 * side of the head at EAR_AT, its lit in-call screen turned half towards the camera (soft glow);
 * `ear` 0: just held at the fin tip (e.g. grabbed off the nightstand).
 */
export const EarPhone: React.FC<{ raise: number; screen?: CasaPhoneScreen; ear?: number }> = ({ raise, screen = "talk", ear = 1 }) => {
  const tip = finTip(raise);
  const hold: Vec3 = [0.6, 1.0, 0.9];
  const off: Vec3 = [mix(hold[0], EAR_AT[0] - tip[0], ear), mix(hold[1], EAR_AT[1] - tip[1], ear), mix(hold[2], EAR_AT[2] - tip[2], ear)];
  return (
    <OnFin raise={raise} offset={off}>
      <group scale={M * 1.5} rotation={[0, mix(-0.3, -0.72, ear), 0.2 * ear]}>
        <CasaPhone screen={screen} glow={0.75} />
      </group>
    </OnFin>
  );
};

// =======================================================================================
// The EMPTY pizza box (world units: base 1.0 x 1.0 centred on the origin, hinge at −z, the lid
// opened back by `open` radians). Inside: grease stains, crumbs and one sad crust.

const boxInsideDraw: Draw = (ctx, w, h) => {
  ctx.fillStyle = "#EFCB93";
  ctx.fillRect(0, 0, w, h);
  // Grease stains where the pizza was.
  for (const [x, y, r, a] of [
    [0.5, 0.52, 0.36, 0.22],
    [0.38, 0.4, 0.12, 0.25],
    [0.64, 0.6, 0.1, 0.22],
    [0.56, 0.32, 0.07, 0.3],
    [0.33, 0.66, 0.08, 0.28],
  ]) {
    ctx.fillStyle = `rgba(190,120,40,${a})`;
    ctx.beginPath();
    ctx.arc(x * w, y * h, r * w, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(170,100,40,0.35)";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(160,95,35,0.4)";
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.52, w * 0.38, 0, Math.PI * 2);
  ctx.stroke();
  // Crumbs.
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = i % 3 === 0 ? "#D9652B" : i % 3 === 1 ? "#B8702E" : "#FFD25A";
    ctx.beginPath();
    ctx.arc((0.22 + 0.56 * hash(i + 3)) * w, (0.22 + 0.56 * hash(i + 41)) * h, 3 + 4 * hash(i + 77), 0, Math.PI * 2);
    ctx.fill();
  }
};
const boxLidDraw: Draw = (ctx, w, h) => {
  ctx.fillStyle = "#F2D3A2";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(170,110,50,0.35)";
  ctx.lineWidth = 6;
  ctx.strokeRect(12, 12, w - 24, h - 24);
  ctx.fillStyle = "rgba(190,120,40,0.25)";
  ctx.beginPath();
  ctx.arc(w * 0.62, h * 0.7, w * 0.1, 0, Math.PI * 2);
  ctx.fill();
};
const boxTopDraw: Draw = (ctx, w, h) => {
  ctx.fillStyle = "#E3A75E";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#FF4D3D";
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `900 ${Math.round(w * 0.13)}px ${FONT.heavy}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("PIZZA", w / 2, h / 2);
};

const boxGeos = once(() => {
  const crumb = new THREE.IcosahedronGeometry(0.018, 0);
  return {
    floor: new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2),
    bottom: rbox(1.0, 0.03, 1.0, 0.01, 2),
    wallX: rbox(0.03, 0.11, 1.0, 0.01, 2),
    wallZ: rbox(1.0, 0.11, 0.03, 0.01, 2),
    lid: rbox(1.0, 0.025, 1.0, 0.01, 2),
    lidIn: new THREE.PlaneGeometry(0.94, 0.94),
    crust: new THREE.TorusGeometry(0.24, 0.06, 10, 20, 1.6),
    crumb,
  };
});

export const PizzaBox: React.FC<{ open?: number }> = ({ open = 1.95 }) => {
  const g = boxGeos();
  const ready = useFontsReady();
  const card = toy("#E3A75E", { rough: 0.9, glow: 0.16 });
  const inside = texMat("box-inside", 256, 256, boxInsideDraw, { glow: 0.2, rough: 0.9 });
  return (
    <group>
      <mesh geometry={g.bottom} material={card} position={[0, 0.015, 0]} />
      <mesh geometry={g.floor} material={inside} position={[0, 0.032, 0]} />
      {[-1, 1].map((s) => (
        <mesh key={`x${s}`} geometry={g.wallX} material={card} position={[s * 0.485, 0.07, 0]} />
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`z${s}`} geometry={g.wallZ} material={card} position={[0, 0.07, s * 0.485]} />
      ))}
      {/* The sad crust and a few crumbs. */}
      <mesh geometry={g.crust} material={toy("#C47A2C", { rough: 0.8, glow: 0.2 })} position={[0.08, 0.075, 0.1]} rotation={[-Math.PI / 2, 0, 0.6]} />
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} geometry={g.crumb} material={toy(i % 2 ? "#C9782F" : "#E8A050", { glow: 0.2, flat: true })} position={[-0.32 + 0.64 * hash(i + 5), 0.045, -0.32 + 0.64 * hash(i + 15)]} rotation={[i, i * 2, 0]} />
      ))}
      {/* Lid hinged at the back edge. */}
      <group position={[0, 0.12, -0.5]} rotation={[-open, 0, 0]}>
        <mesh geometry={g.lid} material={card} position={[0, 0, 0.5]} />
        {ready ? (
          <>
            <mesh geometry={g.lidIn} material={texMat("box-lid", 256, 256, boxLidDraw, { glow: 0.2 })} position={[0, -0.014, 0.5]} rotation={[Math.PI / 2, 0, 0]} />
            <mesh geometry={g.lidIn} material={texMat("box-top", 256, 256, boxTopDraw, { glow: 0.2 })} position={[0, 0.014, 0.5]} rotation={[-Math.PI / 2, 0, 0]} />
          </>
        ) : null}
      </group>
    </group>
  );
};

// =======================================================================================
// The string of melted cheese stuck on a fin (model units, as a child of a fin via OnFin): a
// gooey blob on the tip and a long string that sways (`sway` −1..1) with a drip at the end.

const ROPE = { N: 16, R: 7 };
export const CheeseString: React.FC<{ t: number; sway?: number; len?: number }> = ({ t, sway = 0, len = 2.9 }) => {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = (ROPE.N + 1) * ROPE.R;
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < ROPE.N; i++)
      for (let j = 0; j < ROPE.R; j++) {
        const a = i * ROPE.R + j;
        const b = i * ROPE.R + ((j + 1) % ROPE.R);
        const c = (i + 1) * ROPE.R + j;
        const d = (i + 1) * ROPE.R + ((j + 1) % ROPE.R);
        idx.push(a, c, b, b, c, d);
      }
    g.setIndex(idx);
    return g;
  }, []);
  const blob = useMemo(() => new THREE.SphereGeometry(1, 16, 12), []);
  const mat = toy("#FFC22E", { rough: 0.25, glow: 0.3 });
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i <= ROPE.N; i++) {
    const u = i / ROPE.N;
    // Hangs down, swinging (more at the end), with a gooey taper and a drip.
    const swing = (sway * 0.9 + 0.25 * Math.sin(t * 5.2)) * u * u;
    const cx = swing * len * 0.45 + 0.2 * Math.sin(u * 5 + t * 2) * u;
    const cy = -u * len;
    const cz = 0.15 * Math.sin(u * 4 + t * 1.5) * u;
    const r = 0.32 * (1 - 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.15))) + (u > 0.85 ? 0.28 * smooth(0.85, 1, u) * (1 - smooth(0.97, 1, u)) : 0);
    for (let j = 0; j < ROPE.R; j++) {
      const a = (j / ROPE.R) * Math.PI * 2;
      p.setXYZ(i * ROPE.R + j, cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r);
    }
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
  const endSwing = sway * 0.9 + 0.25 * Math.sin(t * 5.2);
  return (
    <group>
      <mesh geometry={blob} material={mat} scale={[1.05, 0.55, 0.9]} />
      <mesh geometry={blob} material={mat} position={[0.5, -0.25, 0.3]} scale={[0.5, 0.35, 0.45]} />
      <mesh geometry={geo} material={mat} />
      <mesh geometry={blob} material={mat} position={[endSwing * len * 0.45, -len - 0.15, 0]} scale={[0.32, 0.42, 0.32]} />
    </group>
  );
};

// =======================================================================================
// The golden halo ping over Nubi's head ("la solución"): world units, centred above the head.

const haloGeo = once(() => new THREE.TorusGeometry(0.42, 0.055, 10, 40).rotateX(Math.PI / 2));
export const Halo: React.FC<{ k: number; spin?: number }> = ({ k, spin = 0 }) => {
  if (k <= 0.01) return null;
  return (
    <group scale={[k, k, k]} rotation={[0.25, spin, 0]}>
      <mesh geometry={haloGeo()} material={toy("#FFD84D", { glow: 0.9, rough: 0.3, metal: 0.2 })} />
      <Glow color="#FFE680" size={1.6} opacity={0.6 * k} />
    </group>
  );
};

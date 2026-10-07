import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { V3, canvasTexture, shadeHex, toy, useFontsReady } from "../inca/kit";
import { Nubi, NubiPose } from "../Nubi";
import { Glow } from "../thanos/FX";
import { EyeBags, Lids, mixHex } from "../tiempo/Office";
import { CoffeeCorner, Desk, Lanyard, Monitor, NightClock, Plant, WORKER_LILAC, WORKER_PALETTE } from "../ia/Work";

// The office at 6 pm of "¿Y si tus mentiras salieran sobre tu cabeza?" (shot "jefe"). It reuses the
// AI short's office props (desks, monitors, the coffee corner, plants, the wall clock; the boss and
// the workers come from three/ia/Work) and adds what the gag needs: the back wall with the EXIT door
// (an open doorway onto a bright golden hallway: freedom) and its green «SALIDA» sign, the wall clock
// at 6:00, a projector screen that switches on at «1 / 68», golden sunset patches on the walls and
// floor (the big windows are on the front wall, behind the wide camera; FrontWindows draws them for
// the reverse close-up), three swivel chairs facing the door, backpacks and the boss's closed laptop.
//
// World units are sized for a <Nubi size={2}>; floor y = 0; the back wall (with the door) at
// OFI.zBack faces +z, towards the wide camera. No shadow maps, four lights, geometry built once.

const once = <T,>(make: () => T) => {
  let v: T | undefined;
  return () => (v ??= make());
};
const rbox = (w: number, h: number, d: number, r: number, seg = 2) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const basicCache = new Map<string, THREE.MeshBasicMaterial>();
const basic = (color: string, opacity = 1) => {
  const k = `${color}|${opacity}`;
  let m = basicCache.get(k);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 });
    basicCache.set(k, m);
  }
  return m;
};

// =======================================================================================
// LAYOUT

export const OFI = { zBack: -4.6, x0: -7, x1: 8, height: 6.5, zFront: 9.5 };
/** The exit doorway in the back wall (centre x, width, height). */
export const DOOR = { x: 0.6, w: 1.85, h: 2.8 };
/** Where the boss stands, blocking the doorway. */
export const BOSS_DOOR: V3 = [DOOR.x, 0, OFI.zBack + 0.3];
export const EXIT_SIGN_AT: V3 = [DOOR.x, DOOR.h + 0.42, OFI.zBack + 0.12];
export const OFI_CLOCK_AT: V3 = [-1.55, 2.95, OFI.zBack + 0.08];
export const SCREEN = { x: 3.55, y: 2.0, w: 2.4, h: 1.5 };
/** The three swivel chairs (facing the door) the workers walk back to: [x, z]. */
export const CHAIR_SPOTS: [number, number][] = [
  [-3.3, 2.0],
  [-1.6, 2.55],
  [3.15, 2.05],
];
/** Heading (rotationY) of someone at (x, z) facing the exit door. */
export const faceDoor = (x: number, z: number) => Math.atan2(DOOR.x - x, BOSS_DOOR[2] - z);
export const CHAIR_SEAT = 0.46;
/** Background colour behind the office canvas. */
export const OFI_BG = "#F2C9A0";

// =======================================================================================
// TEXTURES

const exitTex = () =>
  canvasTexture("mentiras-exit-sign", 512, 176, (ctx, w, h) => {
    ctx.fillStyle = "#0FA44A";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#E9FFF0";
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 84px Montserrat";
    ctx.textBaseline = "middle";
    ctx.fillText("SALIDA", 132, h / 2 + 4);
    // Running man (pictogram) on the left, an arrow on the right.
    const man = (x: number, y: number) => {
      ctx.beginPath();
      ctx.arc(x + 14, y - 44, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineCap = "round";
      ctx.lineWidth = 15;
      ctx.strokeStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.moveTo(x + 6, y - 26);
      ctx.lineTo(x - 4, y + 10);
      ctx.moveTo(x - 4, y + 10);
      ctx.lineTo(x + 22, y + 26);
      ctx.lineTo(x + 18, y + 48);
      ctx.moveTo(x - 4, y + 10);
      ctx.lineTo(x - 22, y + 30);
      ctx.lineTo(x - 40, y + 30);
      ctx.moveTo(x + 4, y - 18);
      ctx.lineTo(x + 30, y - 4);
      ctx.moveTo(x + 4, y - 18);
      ctx.lineTo(x - 22, y - 10);
      ctx.stroke();
    };
    man(78, h / 2 + 6);
    ctx.beginPath();
    ctx.moveTo(w - 56, h / 2 - 26);
    ctx.lineTo(w - 24, h / 2);
    ctx.lineTo(w - 56, h / 2 + 26);
    ctx.closePath();
    ctx.fill();
  });

const slideTex = () =>
  canvasTexture("mentiras-slide-1-68", 640, 400, (ctx, w, h) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#2E5BD8";
    ctx.fillRect(0, 0, w, 86);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 44px Montserrat";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText("REUNIÓN RAPIDITA", w / 2, 46);
    // A clip-art chart and bullets...
    ctx.fillStyle = "#C9D3EA";
    for (let i = 0; i < 4; i++) ctx.fillRect(56, 128 + i * 44, 250 - 30 * i, 18);
    const bars = [70, 110, 90, 150];
    bars.forEach((b, i) => {
      ctx.fillStyle = i === 3 ? "#E2262E" : "#7FA2F0";
      ctx.fillRect(380 + i * 52, 320 - b, 36, b);
    });
    // ...and the page counter, big.
    ctx.fillStyle = "#E2262E";
    ctx.font = "900 92px Montserrat";
    ctx.fillText("1 / 68", w / 2, h - 52);
  });

const sunsetTex = () =>
  canvasTexture("mentiras-office-sunset", 1024, 512, (ctx, w, h) => {
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#5A4BB0");
    gr.addColorStop(0.35, "#F07A6A");
    gr.addColorStop(0.62, "#FFB45A");
    gr.addColorStop(1, "#FFE39A");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
    const sx = w * 0.56;
    const sy = h * 0.66;
    const halo = ctx.createRadialGradient(sx, sy, 10, sx, sy, 260);
    halo.addColorStop(0, "rgba(255,255,225,1)");
    halo.addColorStop(0.25, "rgba(255,236,160,0.75)");
    halo.addColorStop(1, "rgba(255,190,110,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#FFF6D6";
    ctx.beginPath();
    ctx.arc(sx, sy, 58, 0, Math.PI * 2);
    ctx.fill();
    // Wisps of cloud.
    ctx.fillStyle = "rgba(255,200,170,0.55)";
    for (let i = 0; i < 6; i++) {
      const x = hash(i + 40) * w;
      const y = h * (0.15 + 0.3 * hash(i + 41));
      ctx.beginPath();
      ctx.ellipse(x, y, 90 + 60 * hash(i + 42), 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // City silhouettes.
    let x = -8;
    let k = 0;
    while (x < w) {
      const bw = 50 + 70 * hash(k + 70);
      const bh = h * (0.16 + 0.3 * hash(k + 80));
      ctx.fillStyle = k % 3 === 0 ? "#9A4A78" : "#B4547A";
      ctx.fillRect(x, h - bh, bw, bh);
      x += bw + 4;
      k++;
    }
  });

const carpetTex = () => {
  const t = canvasTexture(
    "mentiras-office-carpet",
    256,
    256,
    (ctx, w, h) => {
      const n = 4;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          ctx.fillStyle = (i + j) % 2 ? "#8A93AE" : "#848DA8";
          ctx.fillRect((i * w) / n, (j * h) / n, w / n, h / n);
        }
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      for (let k = 0; k < 400; k++) ctx.fillRect(hash(k) * w, hash(k + 1) * h, 2, 2);
    },
    { wrapS: true, wrapT: true },
  );
  t.repeat.set(7, 7);
  return t;
};

// =======================================================================================
// PROPS

const chairGeos = once(() => ({
  seat: rbox(1.3, 0.16, 1.2, 0.07),
  back: rbox(1.25, 1.1, 0.14, 0.12),
  post: new THREE.CylinderGeometry(0.06, 0.06, 1, 10),
  arm: rbox(0.12, 0.08, 0.9, 0.03),
  leg: rbox(0.6, 0.06, 0.1, 0.03),
  wheel: new THREE.SphereGeometry(0.06, 8, 6),
}));
/** A swivel office chair: the sitter at the origin facing +z (seat top at CHAIR_SEAT). */
export const OfficeChair: React.FC<{ color?: string }> = ({ color = "#2F3A56" }) => {
  const c = chairGeos();
  const fabric = toy(color, { rough: 0.75, glow: 0.12 });
  const metal = toy("#3A3F4A", { rough: 0.4, metal: 0.3 });
  return (
    <group>
      <mesh geometry={c.seat} material={fabric} position={[0, CHAIR_SEAT - 0.08, 0]} />
      <mesh geometry={c.back} material={fabric} position={[0, CHAIR_SEAT + 0.75, -0.62]} rotation={[-0.1, 0, 0]} />
      <mesh geometry={c.post} material={metal} position={[0, (CHAIR_SEAT - 0.16) / 2 + 0.04, 0]} scale={[1, CHAIR_SEAT - 0.16, 1]} />
      <mesh geometry={c.post} material={metal} position={[0, CHAIR_SEAT + 0.25, -0.6]} scale={[0.8, 0.5, 0.8]} />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <mesh geometry={c.leg} material={metal} position={[0.3, 0.1, 0]} />
            <mesh geometry={c.wheel} material={toy("#1E2128")} position={[0.58, 0.06, 0]} />
          </group>
        );
      })}
    </group>
  );
};

const packGeos = once(() => ({
  body: rbox(6.4, 5.6, 2.6, 1.0, 3),
  pocket: rbox(4.4, 2.4, 1.0, 0.5, 3),
  flap: rbox(6.5, 1.6, 2.8, 0.7, 3),
  strap: rbox(0.9, 0.3, 9.4, 0.12, 2),
  zip: rbox(3.6, 0.18, 0.2, 0.08, 2),
}));
/** A backpack on a Nubi's back (model units, child of the <Nubi>), straps over the top of the head. */
export const Backpack: React.FC<{ color: string; trim?: string; bounce?: number }> = ({ color, trim = "#2B2B33", bounce = 0 }) => {
  const g = packGeos();
  const m = toy(color, { rough: 0.6, glow: 0.16 });
  const t = toy(trim, { rough: 0.6, glow: 0.1 });
  return (
    <group position={[0, 0.25 * bounce, 0]}>
      <group position={[0, 5.9, -5.55]} rotation={[0.06 + 0.05 * bounce, 0, 0]}>
        <mesh geometry={g.body} material={m} />
        <mesh geometry={g.flap} material={m} position={[0, 2.35, 0.1]} />
        <mesh geometry={g.pocket} material={m} position={[0, -1.1, -1.55]} />
        <mesh geometry={g.zip} material={t} position={[0, -0.2, -2.1]} />
      </group>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={g.strap} material={t} position={[s * 2.6, 10.0, -0.6]} />
      ))}
    </group>
  );
};

const laptopGeos = once(() => ({
  shell: rbox(0.95, 0.66, 0.07, 0.04),
  logo: new THREE.CircleGeometry(0.07, 18),
  sticker: rbox(0.2, 0.12, 0.01, 0.02),
}));
/** A closed silver laptop standing upright, its lid facing +z (world units, centred). */
export const ClosedLaptop: React.FC = () => {
  const g = laptopGeos();
  return (
    <group>
      <mesh geometry={g.shell} material={toy("#C9CED8", { metal: 0.5, rough: 0.3, glow: 0.15 })} />
      <mesh geometry={g.logo} material={basic("#FFFFFF")} position={[0, 0.03, 0.037]} />
      <mesh geometry={g.sticker} material={toy("#E2262E", { glow: 0.3 })} position={[0.28, -0.2, 0.038]} rotation={[0, 0, 0.2]} />
    </group>
  );
};

/**
 * The AI short's lilac worker (lanyard, lids, dark circles) with a backpack on: the Worker of
 * three/ia/Work, rebuilt here because that one takes no children.
 */
export const PackedWorker: React.FC<{ pose?: NubiPose; position?: V3; rotationY?: number; droop?: number; bags?: number; pack: string; bounce?: number }> = ({
  pose = {},
  position,
  rotationY,
  droop = 0.2,
  bags = 0.6,
  pack,
  bounce = 0,
}) => (
  <Nubi size={2} palette={WORKER_PALETTE} pose={pose} position={position} rotationY={rotationY} shadowOpacity={0.25}>
    <Lanyard />
    <Lids pose={pose} droop={droop} tilt={0.06} color={shadeHex(WORKER_LILAC, -0.06)} />
    <EyeBags pose={pose} color="#4B3C7E" amount={bags} />
    <Backpack color={pack} bounce={bounce} />
  </Nubi>
);

// =======================================================================================
// THE ROOM

const roomGeos = once(() => {
  const W = OFI.x1 - OFI.x0;
  const leftW = DOOR.x - DOOR.w / 2 - OFI.x0;
  const rightW = OFI.x1 - (DOOR.x + DOOR.w / 2);
  return {
    left: new THREE.PlaneGeometry(leftW, OFI.height),
    right: new THREE.PlaneGeometry(rightW, OFI.height),
    top: new THREE.PlaneGeometry(DOOR.w, OFI.height - DOOR.h),
    leftW,
    rightW,
    floor: new THREE.PlaneGeometry(W, OFI.zFront - OFI.zBack + 2),
    base: rbox(W, 0.14, 0.05, 0.02),
    jamb: rbox(0.16, DOOR.h + 0.16, 0.3, 0.04),
    header: rbox(DOOR.w + 0.32, 0.16, 0.3, 0.04),
    hall: new THREE.PlaneGeometry(4.5, 3.4),
    hallFloor: new THREE.PlaneGeometry(4.5, 2.4),
    leaf: rbox(DOOR.w - 0.1, DOOR.h - 0.06, 0.07, 0.03),
    bar: rbox(1, 1, 1, 0.02),
    sign: rbox(1.28, 0.44, 0.12, 0.04),
    signFace: new THREE.PlaneGeometry(1.2, 0.39),
    screen: new THREE.PlaneGeometry(SCREEN.w, SCREEN.h),
    roller: new THREE.CylinderGeometry(0.07, 0.07, SCREEN.w + 0.3, 14).rotateZ(Math.PI / 2),
    patch: new THREE.PlaneGeometry(1, 1),
    cabinet: rbox(0.9, 1.3, 0.7, 0.04),
    drawer: rbox(0.8, 0.36, 0.04, 0.02),
    board: rbox(1.7, 1.05, 0.05, 0.03),
    note: new THREE.PlaneGeometry(0.2, 0.2),
  };
});

/** A golden sunlight patch (additive parallelogram) on a wall or the floor. */
const SunPatch: React.FC<{ position: V3; rotation?: V3; w: number; h: number; skew?: number; opacity: number }> = ({ position, rotation = [0, 0, 0], w, h, skew = 0, opacity }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#FFC46E", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  mat.opacity = opacity;
  const g = roomGeos();
  if (opacity <= 0.005) return null;
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={g.patch} material={mat} scale={[w, h, 1]} rotation={[0, 0, skew]} />
    </group>
  );
};

/**
 * The office seen from the wide camera: back wall with the exit doorway (bright golden hallway), the
 * «SALIDA» sign, the wall clock at 6:00, the projector screen (`slide` 0..1 switches it on to «1 /
 * 68»), sunset patches (`sun` 0..1), desks with monitors, plants, the coffee corner, a filing cabinet,
 * a cork board, the carpet and the three swivel chairs facing the door.
 */
export const OficinaSet: React.FC<{ g: number; sun?: number; slide?: number }> = ({ g, sun = 1, slide = 0 }) => {
  const r = roomGeos();
  const ready = useFontsReady();
  const wallMat = toy(mixHex("#E9E2EE", "#F7D8BC", sun), { rough: 0.9, glow: 0.12 });
  const carpetMat = useMemo(() => new THREE.MeshStandardMaterial({ map: carpetTex(), roughness: 0.95, emissive: new THREE.Color("#ffffff"), emissiveMap: carpetTex(), emissiveIntensity: 0.1 }), []);
  const signMat = useMemo(() => (ready ? new THREE.MeshBasicMaterial({ map: exitTex(), toneMapped: false }) : basic("#0FA44A")), [ready]);
  const slideMat = useMemo(() => (ready ? new THREE.MeshBasicMaterial({ map: slideTex(), toneMapped: false }) : basic("#FFFFFF")), [ready]);
  const screenOff = toy("#E6E8EE", { rough: 0.8, glow: 0.15 });
  const z = OFI.zBack;
  const frame = toy("#F4F5F9", { rough: 0.5, glow: 0.2 });
  const doorX0 = DOOR.x - DOOR.w / 2;
  const doorX1 = DOOR.x + DOOR.w / 2;
  // 6:00 on the wall clock (its seconds count from 11:58:00): 18:00 + the seconds of the shot.
  const clockSeconds = 21720 + ((g % 1800) / 30) * 1;
  const flick = slide > 0 && slide < 1 ? (Math.sin(g * 2.7) > 0 ? 1 : 0.4) : 1;
  return (
    <group>
      {/* Back wall in three pieces around the doorway, a skirting board. */}
      <mesh geometry={r.left} material={wallMat} position={[OFI.x0 + r.leftW / 2, OFI.height / 2, z]} />
      <mesh geometry={r.right} material={wallMat} position={[doorX1 + r.rightW / 2, OFI.height / 2, z]} />
      <mesh geometry={r.top} material={wallMat} position={[DOOR.x, DOOR.h + (OFI.height - DOOR.h) / 2, z]} />
      <mesh geometry={r.base} material={toy("#B9A6B4", { rough: 0.6 })} position={[(OFI.x0 + OFI.x1) / 2, 0.07, z + 0.03]} />
      <mesh geometry={r.floor} material={carpetMat} rotation={[-Math.PI / 2, 0, 0]} position={[(OFI.x0 + OFI.x1) / 2, 0, (OFI.zBack + OFI.zFront) / 2]} />
      {/* The doorway: frame, the door leaf swung open into the hallway, the bright hallway. */}
      {[doorX0 - 0.08, doorX1 + 0.08].map((x) => (
        <mesh key={x} geometry={r.jamb} material={frame} position={[x, DOOR.h / 2, z]} />
      ))}
      <mesh geometry={r.header} material={frame} position={[DOOR.x, DOOR.h + 0.08, z]} />
      <group position={[doorX1 - 0.04, 0, z - 0.12]} rotation={[0, -1.3, 0]}>
        <mesh geometry={r.leaf} material={toy("#C98B55", { rough: 0.55, glow: 0.14 })} position={[-(DOOR.w - 0.1) / 2, DOOR.h / 2, 0]} />
        <mesh geometry={r.bar} material={toy("#D9DDE5", { metal: 0.6, rough: 0.3 })} position={[-(DOOR.w - 0.1) + 0.2, 1.05, 0.06]} scale={[0.28, 0.05, 0.05]} />
      </group>
      <mesh geometry={r.hall} material={basic(mixHex("#FFE6B0", "#FFD08A", sun))} position={[DOOR.x, 1.7, z - 2.3]} />
      <mesh geometry={r.hallFloor} material={toy("#E9CFA0", { rough: 0.8, glow: 0.5 })} rotation={[-Math.PI / 2, 0, 0]} position={[DOOR.x, 0.002, z - 1.15]} />
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={r.hall} material={toy("#F6E2C2", { rough: 0.9, glow: 0.45 })} position={[DOOR.x + s * 1.6, 1.7, z - 1.15]} rotation={[0, -s * Math.PI / 2, 0]} scale={[0.52, 1, 1]} />
      ))}
      <Glow color="#FFE2A0" size={3.2} opacity={0.5} position={[DOOR.x, 1.4, z - 0.9]} />
      {/* «SALIDA» sign over the door. */}
      <group position={EXIT_SIGN_AT}>
        <mesh geometry={r.sign} material={toy("#E9ECF2", { rough: 0.4, glow: 0.2 })} />
        <mesh geometry={r.signFace} material={signMat} position={[0, 0, 0.062]} />
        <Glow color="#3DFF8A" size={1.9} opacity={0.4} position={[0, 0, 0.2]} />
      </group>
      {/* Wall clock at 6:00. */}
      <group position={OFI_CLOCK_AT}>
        <NightClock seconds={clockSeconds} radius={0.5} />
      </group>
      {/* Projector screen (right of the door): off, then «1 / 68». */}
      <group position={[SCREEN.x, SCREEN.y, z + 0.06]}>
        <mesh geometry={r.roller} material={toy("#3A3F4A", { rough: 0.4 })} position={[0, SCREEN.h / 2 + 0.08, 0.04]} />
        <mesh geometry={r.screen} material={slide > 0 ? slideMat : screenOff} />
        {slide > 0 ? <Glow color="#DCE8FF" size={3.2} opacity={0.3 * slide * flick} position={[0, 0, 0.3]} /> : null}
      </group>
      {/* Sunset patches on the back wall and the floor (the windows are behind the camera). */}
      <SunPatch position={[-3.6, 2.0, z + 0.02]} w={1.6} h={1.9} skew={0.18} opacity={0.32 * sun} />
      <SunPatch position={[-5.4, 2.0, z + 0.02]} w={1.3} h={1.9} skew={0.18} opacity={0.28 * sun} />
      <SunPatch position={[5.9, 1.8, z + 0.02]} w={1.4} h={1.8} skew={0.18} opacity={0.3 * sun} />
      <SunPatch position={[-2.4, 0.01, 0.4]} rotation={[-Math.PI / 2, 0, 0]} w={2.2} h={3.4} skew={0.35} opacity={0.22 * sun} />
      <SunPatch position={[3.6, 0.01, -0.6]} rotation={[-Math.PI / 2, 0, 0]} w={2.0} h={3.0} skew={0.35} opacity={0.2 * sun} />
      {/* Filing cabinet, cork board, water corner and plants. */}
      <group position={[-0.95, 0, z + 0.4]}>
        <mesh geometry={r.cabinet} material={toy("#9AA5B8", { rough: 0.5, glow: 0.12 })} position={[0, 0.65, 0]} />
        {[0.3, 0.7, 1.1].map((y) => (
          <mesh key={y} geometry={r.drawer} material={toy("#B4BED0", { rough: 0.5 })} position={[0, y, 0.36]} />
        ))}
        <group position={[0.05, 1.3, 0]} scale={0.9}>
          <Plant />
        </group>
      </group>
      <group position={[-3.6, 2.35, z + 0.03]}>
        <mesh geometry={r.board} material={toy("#C08A55", { rough: 0.9 })} />
        {["#FFE45C", "#FF8FB1", "#7FE0A8", "#8FC7FF", "#FFE45C", "#FF8FB1"].map((c, i) => (
          <mesh key={i} geometry={r.note} material={toy(c, { glow: 0.25 })} position={[-0.6 + 0.24 * i, 0.18 * Math.sin(i * 2.1), 0.03]} rotation={[0, 0, (hash(i) - 0.5) * 0.4]} />
        ))}
      </group>
      <group position={[5.9, 0, z + 0.45]}>
        <CoffeeCorner t={g / 30} />
      </group>
      <group position={[2.0, 0, z + 0.35]}>
        <Plant />
      </group>
      {/* Desks along the sides, monitors facing the room's centre line. */}
      {(
        [
          [-4.2, -1.6, 0.5],
          [-4.4, 1.6, 0.5],
          [5.3, -1.4, -0.5],
          [5.5, 1.8, -0.5],
        ] as V3[]
      ).map(([x, zz, ry], i) => (
        <group key={i} position={[x, 0, zz]} rotation={[0, ry + (x < 0 ? Math.PI / 2 : -Math.PI / 2), 0]}>
          <Desk w={2.2} d={1.1} top={0.5} color="#F4F4F6" panel="#7F8AA6" drawers={false} />
          <group position={[0, 0.5, -0.25]}>
            <Monitor screen={i % 2 ? "#3A4256" : "#DDE7FF"} glow={i % 2 ? 0 : 0.6} />
          </group>
        </group>
      ))}
      {/* The swivel chairs, facing the door. */}
      {CHAIR_SPOTS.map(([x, zz], i) => (
        <group key={i} position={[x, 0, zz]} rotation={[0, faceDoor(x, zz), 0]}>
          <OfficeChair color={["#2F3A56", "#3B4F7A", "#2F3A56"][i]} />
        </group>
      ))}
    </group>
  );
};

const frontGeos = once(() => ({
  wall: new THREE.PlaneGeometry(OFI.x1 - OFI.x0, OFI.height),
  sky: new THREE.PlaneGeometry(9.0, 2.7),
  bar: rbox(1, 1, 1, 0.03),
}));
/** The front wall with its big sunset windows (only for the reverse angle). `dusk` 0..1 dims the sky. */
export const FrontWindows: React.FC<{ dusk?: number }> = ({ dusk = 0 }) => {
  const f = frontGeos();
  const sky = useMemo(() => new THREE.MeshBasicMaterial({ map: sunsetTex(), toneMapped: false }), []);
  sky.color.set(mixHex("#FFFFFF", "#7A5E8C", dusk));
  const frame = toy("#F4F5F9", { rough: 0.5, glow: 0.2 });
  const z = OFI.zFront;
  const y = 2.1;
  return (
    <group position={[0, 0, z]} rotation={[0, Math.PI, 0]}>
      <mesh geometry={f.wall} material={toy("#F2D4BE", { rough: 0.9, glow: 0.12 })} position={[-(OFI.x0 + OFI.x1) / 2, OFI.height / 2, -0.01]} />
      <mesh geometry={f.sky} material={sky} position={[-1, y, 0]} />
      {[y + 1.35, y - 1.35].map((yy, i) => (
        <mesh key={i} geometry={f.bar} material={frame} position={[-1, yy, 0.04]} scale={[9.2, 0.1, 0.1]} />
      ))}
      {[-4.5, -1.5, 1.5, 4.5].map((x, i) => (
        <mesh key={i} geometry={f.bar} material={frame} position={[-1 + x, y, 0.04]} scale={[0.1, 2.7, 0.1]} />
      ))}
      <Glow color="#FFC46E" size={6} opacity={0.45 * (1 - dusk)} position={[-0.5, y - 0.2, 0.4]} />
    </group>
  );
};

/**
 * The office lights (4): warm hemisphere, the low golden sun from the front windows, a cool fill
 * from the back and the hallway's glow in the doorway. `sun` 0..1 the golden hour; `dim` 0..1 the
 * dramatic dimming on the "dun dun duuun".
 */
export const OficinaLights: React.FC<{ sun?: number; dim?: number }> = ({ sun = 1, dim = 0 }) => (
  <>
    <hemisphereLight args={[mixHex("#F4F1FF", "#FFE2C2", sun), mixHex("#7A84A0", "#8A6A68", sun), 1.25 * (1 - 0.45 * dim)]} />
    <directionalLight position={[-3, 5, 12]} intensity={(1.3 + 0.6 * sun) * (1 - 0.6 * dim)} color={mixHex(mixHex("#FFFFFF", "#FFC27A", sun), "#C77AD8", dim)} />
    <directionalLight position={[2, 5, -8]} intensity={0.6 + 0.3 * dim} color={mixHex("#B9C6FF", "#6E5BD8", dim)} />
    <pointLight position={[DOOR.x, 1.8, OFI.zBack - 0.6]} intensity={1.8} distance={6} decay={1.4} color="#FFE2A8" />
  </>
);

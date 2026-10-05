import React, { useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { V3, canvasTexture, toy } from "../inca/kit";
import { Nubi, NubiPose } from "../Nubi";
import { Glow } from "../thanos/FX";

// Sets and characters of the "¿Qué pasaría si la IA no existiera?" short (agent "rooms"):
//   • the BOY ("chico"): a light-blue Nubi with a small backwards cap; shy, fidgety.
//   • the GIRL ("chica"): a pink Nubi with a yellow bow.
//   • the boy's room: desk against the right wall (laptop, lamp, pen cup, cactus, and in the
//     "almuerzo" gag a big served plate), a swivel stool, a bed against the back wall with a
//     nightstand lamp, posters and a window on the night city. Warm, bright, cute.
//   • the girl's room: pastel pink walls with polka hearts, fairy lights over a bed with heart
//     pillows, a bear and a bunny plush.
// Phones and the laptop are rounded boxes with glowing screens (a faint chat layout, no text:
// readable screen content is drawn by the 2D layer).
//
// World units are sized for a <Nubi size={2}> (2 wide, ≈ 2 tall); the floor is y = 0. Walls are
// one-sided planes facing into the room, so a camera can stand outside a wall (the boy's right
// wall, behind the desk) and look in. There is no front wall (+z). Everything is deterministic.

/** Model units per world unit inside a <Nubi size={2}> (for objects passed as children / holds). */
export const M = 5;

const rbox = (w: number, h: number, d: number, r: number, seg = 3) =>
  new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));

/** Plane w × h whose uvs are in world units (textures tile by their own repeat). */
const worldPlane = (w: number, h: number) => {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  return g;
};

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
const texMatCache = new Map<string, THREE.MeshStandardMaterial>();
/** Cached material for a canvas texture (a small emissive share keeps it bright). */
const texMat = (key: string, w: number, h: number, draw: Draw, o: { glow?: number; rough?: number; repeat?: number; transparent?: boolean } = {}) => {
  let m = texMatCache.get(key);
  if (!m) {
    const tex = canvasTexture(`ia-${key}`, w, h, draw, { wrapS: !!o.repeat, wrapT: !!o.repeat });
    if (o.repeat) tex.repeat.set(o.repeat, o.repeat);
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: o.rough ?? 0.85,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tex,
      emissiveIntensity: o.glow ?? 0.12,
      transparent: o.transparent ?? false,
    });
    texMatCache.set(key, m);
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

const heartPath = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.35);
  ctx.closePath();
};

// =======================================================================================
// Characters

export const CHICO_BLUE = "#6EC1FF";
export const CHICA_PINK = "#FF9EC7";
const CAP = "#FF7043";
const BOW = "#FFD43B";

/** Small cap worn backwards (model units, on top of a Nubi's head; the brim points to −z). */
const BackwardsCap: React.FC = () => {
  const geos = useMemo(
    () => ({
      dome: new THREE.SphereGeometry(3.3, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      band: new THREE.CylinderGeometry(3.32, 3.32, 0.55, 28, 1, true),
      brim: rbox(4.4, 0.32, 3.0, 0.15),
      button: new THREE.SphereGeometry(0.45, 12, 8),
    }),
    [],
  );
  const red = toy(CAP, { rough: 0.6, glow: 0.16 });
  return (
    <group position={[0.4, 9.75, -0.4]} rotation={[-0.08, 0.25, 0.1]}>
      <mesh geometry={geos.dome} material={red} scale={[1, 0.62, 1]} />
      <mesh geometry={geos.band} material={toy("#FFFFFF", { glow: 0.12 })} position={[0, 0.2, 0]} />
      <mesh geometry={geos.brim} material={toy("#E0532F", { rough: 0.6, glow: 0.14 })} position={[0, 0.1, -4.2]} rotation={[-0.12, 0, 0]} />
      <mesh geometry={geos.button} material={toy("#FFFFFF", { glow: 0.12 })} position={[0, 2.05, 0]} />
    </group>
  );
};

/** Yellow bow on the top-right corner of a Nubi's head (model units). */
const Bow: React.FC = () => {
  const geos = useMemo(
    () => ({
      lobe: new THREE.SphereGeometry(1.6, 20, 14),
      knot: new THREE.SphereGeometry(0.8, 16, 12),
      tail: rbox(0.8, 1.9, 0.35, 0.15),
    }),
    [],
  );
  const y = toy(BOW, { rough: 0.45, glow: 0.18 });
  return (
    <group position={[2.6, 10.3, 1.6]} rotation={[0.15, 0, -0.28]}>
      <mesh geometry={geos.lobe} material={y} position={[-1.6, 0, 0]} rotation={[0, 0, -0.35]} scale={[1.25, 0.8, 0.55]} />
      <mesh geometry={geos.lobe} material={y} position={[1.6, 0, 0]} rotation={[0, 0, 0.35]} scale={[1.25, 0.8, 0.55]} />
      <mesh geometry={geos.knot} material={toy("#FFC21A", { rough: 0.45, glow: 0.18 })} scale={[1, 1, 0.8]} />
      <mesh geometry={geos.tail} material={y} position={[-0.6, -1.2, 0.1]} rotation={[0, 0, -0.35]} />
      <mesh geometry={geos.tail} material={y} position={[0.6, -1.2, 0.1]} rotation={[0, 0, 0.35]} />
    </group>
  );
};

/**
 * Fin raises for typing (keyboard or phone): quick alternating taps, tips down. `k` 0..1 fades
 * the tapping out; `speed` in taps per frame-ish.
 */
export const typingFins = (g: number, k = 1, base = -0.22, speed = 1) => {
  const tap = (ph: number) => Math.max(0, Math.sin(g * 0.95 * speed + ph)) ** 2;
  return {
    l: base + 0.32 * k * tap(0),
    r: base + 0.32 * k * tap(Math.PI * 0.9 + Math.sin(g * 0.13)),
  };
};

type CharProps = {
  pose?: NubiPose;
  position?: V3;
  rotationY?: number;
  shadow?: boolean;
  holdR?: React.ReactNode;
  holdL?: React.ReactNode;
  /** Extra objects in model units attached to the body (a phone held in front...). */
  children?: React.ReactNode;
  /** Eye highlight roughness (raise when a strong light sits near the camera). */
  eyeRough?: number;
};

/** The boy: a light-blue Nubi with a small backwards cap. */
export const Chico: React.FC<CharProps> = ({ pose, position, rotationY, shadow = true, holdR, holdL, children, eyeRough = 0.6 }) => (
  <Nubi size={2} pose={pose} position={position} rotationY={rotationY} shadow={shadow} holdR={holdR} holdL={holdL} palette={{ body: CHICO_BLUE, eyeRough }}>
    <BackwardsCap />
    {children}
  </Nubi>
);

/** The girl: a pink Nubi with a yellow bow. */
export const Chica: React.FC<CharProps> = ({ pose, position, rotationY, shadow = true, holdR, holdL, children, eyeRough = 0.6 }) => (
  <Nubi size={2} pose={pose} position={position} rotationY={rotationY} shadow={shadow} holdR={holdR} holdL={holdL} palette={{ body: CHICA_PINK, eyeRough }}>
    <Bow />
    {children}
  </Nubi>
);

// =======================================================================================
// Phone and laptop

const SCREEN_LIGHT = new THREE.Color("#F4F8FF");
const SCREEN_OFF = new THREE.Color("#1A2030");

/** Faint chat layout (bubbles, no text) for the phone / laptop screens. */
const chatTex = (key: string, w: number, h: number, accent: string) =>
  canvasTexture(`ia-chat-${key}`, w, h, (ctx, W, H) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#FFFFFF");
    g.addColorStop(1, "#E3EEFF");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, W, H * 0.09);
    const rows = 6;
    for (let i = 0; i < rows; i++) {
      const mine = i % 2 === 1;
      const bw = W * (0.38 + 0.25 * ((i * 37) % 7) / 7);
      const bh = H * 0.075;
      const y = H * 0.14 + i * H * 0.13;
      ctx.fillStyle = mine ? accent : "#D5DCEA";
      roundRect(ctx, mine ? W - bw - W * 0.06 : W * 0.06, y, bw, bh, bh / 2);
      ctx.fill();
    }
    ctx.fillStyle = "#D5DCEA";
    roundRect(ctx, W * 0.06, H * 0.9, W * 0.88, H * 0.06, H * 0.03);
    ctx.fill();
  });

/**
 * A phone (world units: 0.46 × 0.86), screen towards +z, centred. `on` lights the screen (0..1+:
 * above 1 it glows brighter), `glow` adds a soft halo in front of it.
 */
export const Phone: React.FC<{ on?: number; caseColor?: string; glow?: number; accent?: string }> = ({ on = 1, caseColor = "#3D4A6B", glow = 0, accent = "#5AA8FF" }) => {
  const geos = useMemo(
    () => ({
      body: rbox(0.46, 0.86, 0.06, 0.06),
      screen: new THREE.PlaneGeometry(0.4, 0.78),
      cam: rbox(0.13, 0.13, 0.03, 0.03),
    }),
    [],
  );
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: chatTex(`phone-${accent}`, 128, 256, accent), toneMapped: false }), [accent]);
  mat.color.copy(SCREEN_OFF).lerp(SCREEN_LIGHT, Math.min(1, on));
  return (
    <group>
      <mesh geometry={geos.body} material={toy(caseColor, { rough: 0.4, glow: 0.12 })} />
      <mesh geometry={geos.screen} material={mat} position={[0, 0, 0.0305]} />
      <mesh geometry={geos.cam} material={toy("#22252E", { glow: 0.05 })} position={[-0.12, 0.31, -0.035]} />
      {glow > 0 ? <Glow color="#CFE4FF" size={1.2} opacity={0.35 * glow} position={[0, 0, 0.12]} /> : null}
    </group>
  );
};

/**
 * A phone at a <Nubi size={2}>'s fin tip (pass as holdR / holdL): it stays upright whatever the
 * fin raise, its screen turned by `turn` (radians from +z, the Nubi's front).
 */
export const HeldPhone: React.FC<{ raise: number; turn?: number; tilt?: number; on?: number; caseColor?: string; glow?: number; side?: "R" | "L"; scale?: number }> = ({ raise, turn = 0, tilt = 0, on = 1, caseColor, glow, side = "R", scale = 1 }) => (
  <group rotation={[0, side === "R" ? 0.12 : -0.12, -raise * 0.55]}>
    <group scale={M * scale} position={[0, 0.25 * M * scale, 0.1 * M]} rotation={[tilt, turn, 0]}>
      <Phone on={on} caseColor={caseColor} glow={glow} />
    </group>
  </group>
);

export const LAPTOP = { w: 1.04, d: 0.7, lidH: 0.66 };

/**
 * The laptop (world units), centred on its base, screen facing +z (towards the user). `open` 0
 * (closed) .. 1 (open, leaning back); `glow` the screen brightness (> 1 for an extra halo).
 */
export const Laptop: React.FC<{ open?: number; glow?: number; color?: string }> = ({ open = 1, glow = 1, color = "#C9D3E3" }) => {
  const { w, d, lidH } = LAPTOP;
  const geos = useMemo(
    () => ({
      base: rbox(w, 0.05, d, 0.025),
      lid: rbox(w, lidH, 0.035, 0.025),
      screen: new THREE.PlaneGeometry(w - 0.1, lidH - 0.1),
      keys: new THREE.PlaneGeometry(w - 0.14, d * 0.45),
      pad: new THREE.PlaneGeometry(0.3, 0.16),
      logo: new THREE.CircleGeometry(0.07, 24),
    }),
    [w, d, lidH],
  );
  const screen = useMemo(() => new THREE.MeshBasicMaterial({ map: chatTex("laptop", 256, 160, "#7C5CFF"), toneMapped: false }), []);
  screen.color.copy(SCREEN_OFF).lerp(SCREEN_LIGHT, Math.min(1, glow));
  const keys = texMat("keys", 256, 96, (ctx, W, H) => {
    ctx.fillStyle = "#AEB8CA";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#3B4254";
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 13; c++) {
        roundRect(ctx, 4 + c * 19.3 + (r % 2) * 5, 4 + r * 23, 15, 18, 3);
        ctx.fill();
      }
    }
  });
  const rot = THREE.MathUtils.lerp(Math.PI / 2 - 0.03, -0.24, open);
  const shell = toy(color, { rough: 0.35, metal: 0.2, glow: 0.12 });
  return (
    <group>
      <mesh geometry={geos.base} material={shell} position={[0, 0.025, 0]} />
      <mesh geometry={geos.keys} material={keys} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.051, -d * 0.12]} />
      <mesh geometry={geos.pad} material={toy("#B5BFD0", { glow: 0.1 })} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.051, d * 0.3]} />
      <group position={[0, 0.05, -d / 2 + 0.02]} rotation={[rot, 0, 0]}>
        <mesh geometry={geos.lid} material={shell} position={[0, lidH / 2, 0]} />
        <mesh geometry={geos.screen} material={screen} position={[0, lidH / 2, 0.0185]} />
        <mesh geometry={geos.logo} material={toy("#FFFFFF", { glow: 0.6 })} position={[0, lidH / 2, -0.019]} rotation={[0, Math.PI, 0]} />
        {glow > 1.05 ? <Glow color="#BFD8FF" size={1.0 + 0.6 * (glow - 1)} opacity={0.3 * Math.min(1, glow - 1)} position={[0, lidH / 2, 0.08]} /> : null}
      </group>
    </group>
  );
};

// =======================================================================================
// The served plate (the "almuerzo" gag): rice, chicken, salad, steaming

const steamTex = () =>
  canvasTexture("ia-steam", 64, 160, (ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineCap = "round";
    ctx.shadowColor = "rgba(255,255,255,1)";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 9;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const y = H - 12 - (i / 40) * (H - 24);
      const x = W / 2 + Math.sin((i / 40) * Math.PI * 2.2) * W * 0.22;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });

export const Plate: React.FC<{ t?: number; steam?: number }> = ({ t = 0, steam = 1 }) => {
  const geos = useMemo(() => {
    const prof = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.3, 0),
      new THREE.Vector2(0.33, 0.012),
      new THREE.Vector2(0.4, 0.045),
      new THREE.Vector2(0.48, 0.07),
      new THREE.Vector2(0.49, 0.08),
      new THREE.Vector2(0.47, 0.082),
      new THREE.Vector2(0.39, 0.06),
      new THREE.Vector2(0.32, 0.03),
      new THREE.Vector2(0, 0.03),
    ];
    return {
      plate: new THREE.LatheGeometry(prof, 40),
      rim: new THREE.TorusGeometry(0.455, 0.008, 6, 48),
      mat: rbox(1.25, 0.012, 0.95, 0.005),
      rice: new THREE.SphereGeometry(0.17, 20, 14),
      grain: new THREE.SphereGeometry(0.03, 8, 6),
      leg: new THREE.CapsuleGeometry(0.075, 0.13, 6, 14),
      bone: new THREE.CylinderGeometry(0.022, 0.022, 0.12, 8),
      knob: new THREE.SphereGeometry(0.03, 10, 8),
      leaf: new THREE.SphereGeometry(0.075, 12, 8),
      tomato: new THREE.SphereGeometry(0.045, 14, 10),
      cuke: new THREE.CylinderGeometry(0.045, 0.045, 0.015, 16),
      fork: rbox(0.035, 0.012, 0.42, 0.005),
      steam: new THREE.PlaneGeometry(1, 1),
    };
  }, []);
  const steamMats = useMemo(
    () => [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ map: steamTex(), transparent: true, depthWrite: false, toneMapped: false })),
    [],
  );
  const white = toy("#FFFFFF", { rough: 0.25, glow: 0.12 });
  const rice = toy("#FFFBEE", { rough: 0.8, glow: 0.2 });
  const chicken = toy("#D9822B", { rough: 0.45, glow: 0.16 });
  const leaves = [toy("#62C24A", { rough: 0.6, glow: 0.14 }), toy("#9BDD55", { rough: 0.6, glow: 0.14 })];
  const tomato = toy("#FF4A3D", { rough: 0.3, glow: 0.16 });
  const LEAVES: [number, number, number, number][] = [
    [0.2, -0.12, 0, 0],
    [0.27, -0.02, 1, 0.6],
    [0.15, -0.22, 1, 1.3],
    [0.25, -0.2, 0, 2.2],
    [0.08, -0.25, 0, 2.9],
  ];
  return (
    <group>
      <mesh geometry={geos.mat} material={toy("#FF8A65", { rough: 0.9, glow: 0.12 })} position={[0, 0.006, 0]} />
      <mesh geometry={geos.plate} material={white} position={[0, 0.012, 0]} />
      <mesh geometry={geos.rim} material={toy("#4FA3FF", { glow: 0.2 })} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.088, 0]} />
      {/* Rice dome with a few grains. */}
      <mesh geometry={geos.rice} material={rice} position={[-0.15, 0.06, -0.06]} scale={[1.15, 0.62, 1]} />
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <mesh key={k} geometry={geos.grain} material={rice} position={[-0.15 + 0.12 * Math.cos(k * 1.1), 0.12 + 0.02 * Math.sin(k), -0.06 + 0.1 * Math.sin(k * 1.1)]} scale={[1, 0.6, 1.6]} rotation={[0, k, 0]} />
      ))}
      {/* Two golden drumsticks. */}
      {[
        [0.06, 0.12, 0.6],
        [0.2, 0.17, 1.1],
      ].map(([x, z, a], k) => (
        <group key={k} position={[x, 0.1, z]} rotation={[0, a, Math.PI / 2 - 0.15]}>
          <mesh geometry={geos.leg} material={chicken} scale={[1, 1, 1.1]} />
          <mesh geometry={geos.bone} material={white} position={[0, -0.17, 0]} />
          <mesh geometry={geos.knob} material={white} position={[0.015, -0.24, 0]} />
          <mesh geometry={geos.knob} material={white} position={[-0.015, -0.24, 0]} />
        </group>
      ))}
      {/* Salad: leaves, cherry tomatoes, cucumber. */}
      {LEAVES.map(([x, z, c, a], k) => (
        <mesh key={k} geometry={geos.leaf} material={leaves[c]} position={[x, 0.075, z]} rotation={[0.3, a, 0.2]} scale={[1.3, 0.45, 1]} />
      ))}
      <mesh geometry={geos.tomato} material={tomato} position={[0.18, 0.12, -0.14]} />
      <mesh geometry={geos.tomato} material={tomato} position={[0.29, 0.1, -0.1]} />
      <mesh geometry={geos.cuke} material={toy("#C9F08A", { glow: 0.16 })} position={[0.1, 0.11, -0.18]} rotation={[0.25, 0, 0.1]} />
      <mesh geometry={geos.fork} material={toy("#D9DEE8", { metal: 0.6, rough: 0.3, glow: 0.12 })} position={[0.55, 0.014, 0.02]} />
      {/* Steam wisps rising and fading in a loop. */}
      {steam > 0
        ? steamMats.map((m, k) => {
            const u = (t * 0.45 + k / 3) % 1;
            m.opacity = steam * 0.55 * Math.sin(Math.PI * u);
            return <mesh key={k} geometry={geos.steam} material={m} position={[-0.15 + k * 0.15, 0.3 + u * 0.35, -0.02 + 0.05 * k]} scale={[0.22, 0.5, 1]} rotation={[0, 0.5, 0]} />;
          })
        : null}
    </group>
  );
};

// =======================================================================================
// Room pieces

const Poster: React.FC<{ k: string; draw: Draw; position: V3; w?: number; h?: number; rotationY?: number; tilt?: number }> = ({ k, draw, position, w = 0.8, h = 1.05, rotationY = 0, tilt = 0 }) => {
  const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  return (
    <mesh geometry={geo} material={texMat(`poster-${k}`, 160, 210, draw, { glow: 0.2 })} position={position} rotation={[0, rotationY, tilt]} scale={[w, h, 1]} />
  );
};

const posterRocket: Draw = (ctx, W, H) => {
  ctx.fillStyle = "#2B3A8C";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#FFE680";
  for (let i = 0; i < 14; i++) ctx.fillRect((i * 53) % W, (i * 97) % H, 4, 4);
  ctx.fillStyle = "#FF5A4E";
  ctx.beginPath();
  ctx.ellipse(W / 2, H * 0.48, 26, 62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(W / 2, H * 0.42, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFB238";
  ctx.beginPath();
  ctx.moveTo(W / 2 - 18, H * 0.74);
  ctx.lineTo(W / 2, H * 0.92);
  ctx.lineTo(W / 2 + 18, H * 0.74);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, 6);
  ctx.fillRect(0, H - 6, W, 6);
};
const posterGame: Draw = (ctx, W, H) => {
  ctx.fillStyle = "#FFD23F";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#3A3F58";
  roundRect(ctx, 22, H * 0.38, W - 44, 64, 30);
  ctx.fill();
  ctx.fillStyle = "#FF5A79";
  ctx.beginPath();
  ctx.arc(W - 52, H * 0.38 + 26, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4FC3F7";
  ctx.beginPath();
  ctx.arc(W - 34, H * 0.38 + 40, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(40, H * 0.38 + 27, 30, 10);
  ctx.fillRect(50, H * 0.38 + 17, 10, 30);
  ctx.fillStyle = "#3A3F58";
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("GG!", W / 2, H * 0.24);
};
const posterDino: Draw = (ctx, W, H) => {
  ctx.fillStyle = "#7EE0B5";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#2E8B57";
  ctx.beginPath();
  ctx.ellipse(W * 0.5, H * 0.62, 46, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(W * 0.72, H * 0.42, 18, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(W * 0.62, H * 0.42, 14, 50);
  ctx.fillRect(W * 0.35, H * 0.7, 12, 32);
  ctx.fillRect(W * 0.58, H * 0.7, 12, 32);
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(W * 0.75, H * 0.4, 4, 0, Math.PI * 2);
  ctx.fill();
};
const posterHeart: Draw = (ctx, W, H) => {
  ctx.fillStyle = "#FFF0F6";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#FF5C93";
  heartPath(ctx, W / 2, H * 0.28, 90);
  ctx.fill();
  ctx.fillStyle = "#B784F5";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("LOVE", W / 2, H * 0.86);
};
const posterRainbow: Draw = (ctx, W, H) => {
  ctx.fillStyle = "#E9F7FF";
  ctx.fillRect(0, 0, W, H);
  const cols = ["#FF6B8B", "#FFB04A", "#FFE15A", "#6EDB8F", "#6EC1FF", "#B98CFF"];
  ctx.lineWidth = 11;
  cols.forEach((c, i) => {
    ctx.strokeStyle = c;
    ctx.beginPath();
    ctx.arc(W / 2, H * 0.68, 70 - i * 11, Math.PI, 0);
    ctx.stroke();
  });
  ctx.fillStyle = "#FFFFFF";
  for (const x of [W * 0.2, W * 0.8]) {
    ctx.beginPath();
    ctx.arc(x, H * 0.7, 16, 0, Math.PI * 2);
    ctx.arc(x + 14, H * 0.7, 12, 0, Math.PI * 2);
    ctx.fill();
  }
};

/** Night city through a window (texture). */
const nightDraw: Draw = (ctx, W, H) => {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1D2A6E");
  g.addColorStop(0.7, "#5A43A0");
  g.addColorStop(1, "#C76BB0");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#FFFFFF";
  for (let i = 0; i < 26; i++) ctx.fillRect((i * 71) % W, (i * 43) % (H * 0.45), 2, 2);
  ctx.fillStyle = "#FFF4C2";
  ctx.beginPath();
  ctx.arc(W * 0.78, H * 0.2, 18, 0, Math.PI * 2);
  ctx.fill();
  const blds: [number, number, number][] = [
    [0, 70, 0.55],
    [62, 50, 0.4],
    [104, 60, 0.62],
    [158, 44, 0.35],
    [196, 64, 0.5],
    [254, 50, 0.6],
    [300, 60, 0.42],
  ];
  blds.forEach(([x, w, hh], k) => {
    const top = H * (1 - hh);
    ctx.fillStyle = k % 2 ? "#2A2160" : "#221A52";
    ctx.fillRect(x, top, w, H - top);
    for (let yy = top + 8; yy < H - 6; yy += 14) {
      for (let xx = x + 6; xx < x + w - 8; xx += 12) {
        const on = (Math.floor(xx * 7 + yy * 13 + k * 5) % 5) < 3;
        if (!on) continue;
        ctx.fillStyle = (xx + yy) % 3 === 0 ? "#FFD27A" : "#FFE9A8";
        ctx.fillRect(xx, yy, 6, 7);
      }
    }
  });
};

const NightWindow: React.FC<{ position: V3; w: number; h: number; rotationY?: number }> = ({ position, w, h, rotationY = 0 }) => {
  const geos = useMemo(
    () => ({
      glass: new THREE.PlaneGeometry(w, h),
      side: rbox(0.1, h + 0.1, 0.1, 0.03),
      top: rbox(w + 0.2, 0.1, 0.1, 0.03),
      sill: rbox(w + 0.4, 0.08, 0.22, 0.03),
      mull: rbox(0.05, h, 0.06, 0.02),
      curtain: rbox(0.42, h + 0.55, 0.08, 0.04, 2),
    }),
    [w, h],
  );
  const frame = toy("#FFFFFF", { glow: 0.12, rough: 0.5 });
  const curtain = toy("#FFB74D", { glow: 0.14, rough: 0.9 });
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh geometry={geos.glass} material={texMat("night", 360, 260, nightDraw, { glow: 0.85, rough: 0.3 })} />
      <mesh geometry={geos.side} material={frame} position={[-w / 2, 0, 0.04]} />
      <mesh geometry={geos.side} material={frame} position={[w / 2, 0, 0.04]} />
      <mesh geometry={geos.mull} material={frame} position={[0, 0, 0.03]} />
      <mesh geometry={geos.top} material={frame} position={[0, h / 2, 0.04]} />
      <mesh geometry={geos.sill} material={frame} position={[0, -h / 2 - 0.02, 0.1]} />
      <mesh geometry={geos.curtain} material={curtain} position={[-w / 2 - 0.12, 0.1, 0.12]} rotation={[0, 0, 0.03]} />
      <mesh geometry={geos.curtain} material={curtain} position={[w / 2 + 0.12, 0.1, 0.12]} rotation={[0, 0, -0.03]} />
    </group>
  );
};

/** A strand of fairy lights hanging between a and b (warm bulbs, a soft twinkle). */
const FairyLights: React.FC<{ a: V3; b: V3; n: number; sag: number; t: number; colors?: string[] }> = ({ a, b, n, sag, t, colors = ["#FFE08A", "#FF9EC7", "#9FE3FF", "#FFD27A"] }) => {
  const { wire, pts } = useMemo(() => {
    const at = (u: number) =>
      new THREE.Vector3(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - sag * 4 * u * (1 - u) - 0.06 * Math.sin(u * Math.PI * 6) ** 2, a[2] + (b[2] - a[2]) * u);
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 25 }, (_, i) => at(i / 24)));
    return {
      wire: new THREE.TubeGeometry(curve, 80, 0.008, 4, false),
      pts: Array.from({ length: n }, (_, i) => at((i + 0.5) / n)),
    };
  }, [a, b, n, sag]);
  const bulb = useMemo(() => new THREE.SphereGeometry(0.045, 10, 8), []);
  return (
    <group>
      <mesh geometry={wire} material={toy("#4E5A3E", { glow: 0.05 })} />
      {pts.map((p, i) => {
        const c = colors[i % colors.length];
        const tw = 0.75 + 0.25 * Math.sin(t * 3 + i * 1.7);
        return (
          <group key={i} position={[p.x, p.y - 0.05, p.z + 0.02]}>
            <mesh geometry={bulb} material={toy(c, { glow: 1.1 })} />
            <Glow color={c} size={0.32} opacity={0.5 * tw} />
          </group>
        );
      })}
    </group>
  );
};

/** Desk / nightstand lamp (warm). Base at the origin. */
const Lamp: React.FC<{ on?: number; color?: string; rotationY?: number }> = ({ on = 1, color = "#4FC3F7", rotationY = 0 }) => {
  const geos = useMemo(
    () => ({
      base: new THREE.CylinderGeometry(0.16, 0.19, 0.06, 24),
      stem: new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8),
      shade: new THREE.CylinderGeometry(0.1, 0.24, 0.26, 24, 1, true),
      bulb: new THREE.SphereGeometry(0.075, 12, 8),
    }),
    [],
  );
  const shade = useMemo(() => {
    const m = toy(color, { glow: 0.3, rough: 0.6 }).clone();
    m.side = THREE.DoubleSide;
    return m;
  }, [color]);
  return (
    <group rotation={[0, rotationY, 0]}>
      <mesh geometry={geos.base} material={toy(color, { glow: 0.16 })} position={[0, 0.03, 0]} />
      <mesh geometry={geos.stem} material={toy("#FFFFFF", { glow: 0.12 })} position={[0, 0.33, 0]} />
      <mesh geometry={geos.shade} material={shade} position={[0, 0.66, 0]} />
      <mesh geometry={geos.bulb} material={toy("#FFF3C4", { glow: 1.4 * on })} position={[0, 0.58, 0]} />
      {on > 0 ? <Glow color="#FFD58A" size={1.1} opacity={0.45 * on} position={[0, 0.55, 0]} /> : null}
    </group>
  );
};

/** Simple bed between x0..x1 / z0..z1 (headboard on the −z side): frame, mattress, quilt, pillow. */
const Bed: React.FC<{ x0: number; x1: number; z0: number; z1: number; top: number; frame: string; quilt: string; pillow: string; headboard?: boolean }> = ({ x0, x1, z0, z1, top, frame, quilt, pillow, headboard = true }) => {
  const W = x1 - x0;
  const D = z1 - z0;
  const geos = useMemo(
    () => ({
      base: rbox(W, 0.3, D, 0.06),
      mattress: rbox(W - 0.08, 0.24, D - 0.08, 0.1),
      quilt: rbox(W - 0.02, 0.07, D * 0.62, 0.035),
      fold: rbox(W - 0.02, 0.09, 0.16, 0.045),
      pillow: rbox(0.85, 0.2, 0.42, 0.1),
      head: rbox(W, 1.1, 0.12, 0.06),
    }),
    [W, D],
  );
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  return (
    <group>
      <mesh geometry={geos.base} material={toy(frame, { glow: 0.1 })} position={[cx, 0.2, cz]} />
      <mesh geometry={geos.mattress} material={toy("#FFFFFF", { glow: 0.1 })} position={[cx, top - 0.12, cz]} />
      <mesh geometry={geos.quilt} material={toy(quilt, { glow: 0.14, rough: 0.9 })} position={[cx, top + 0.01, z1 - D * 0.31]} />
      <mesh geometry={geos.fold} material={toy("#FFFFFF", { glow: 0.12, rough: 0.9 })} position={[cx, top + 0.03, z1 - D * 0.62]} />
      <mesh geometry={geos.pillow} material={toy(pillow, { glow: 0.14 })} position={[x0 + 0.65, top + 0.08, z0 + 0.35]} rotation={[0.25, 0.1, 0]} />
      {headboard ? <mesh geometry={geos.head} material={toy(frame, { glow: 0.1 })} position={[cx, 0.6, z0 + 0.06]} /> : null}
    </group>
  );
};

const Rug: React.FC<{ position: V3; r: number; color: string; ring: string }> = ({ position, r, color, ring }) => {
  const geos = useMemo(() => ({ disc: new THREE.CircleGeometry(r, 40), ring: new THREE.RingGeometry(r * 0.62, r * 0.74, 40) }), [r]);
  return (
    <group position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh geometry={geos.disc} material={toy(color, { glow: 0.12, rough: 1 })} position={[0, 0, 0.004]} />
      <mesh geometry={geos.ring} material={toy(ring, { glow: 0.12, rough: 1 })} position={[0, 0, 0.008]} />
    </group>
  );
};

/** Walls (back, left, right), floor; one-sided planes facing in. */
const Shell: React.FC<{ x0: number; x1: number; z0: number; z1: number; h: number; wall: THREE.Material; floor: THREE.Material; trim: string }> = ({ x0, x1, z0, z1, h, wall, floor, trim }) => {
  const W = x1 - x0;
  const D = z1 - z0;
  const geos = useMemo(
    () => ({
      floor: worldPlane(W + 6, D + 10),
      back: worldPlane(W, h),
      side: worldPlane(D, h),
      skirt: rbox(1, 0.14, 0.05, 0.02),
    }),
    [W, D, h],
  );
  const sk = toy(trim, { glow: 0.12 });
  return (
    <group>
      <mesh geometry={geos.floor} material={floor} rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, 0, (z0 + z1) / 2 + 3]} />
      <mesh geometry={geos.back} material={wall} position={[(x0 + x1) / 2, h / 2, z0]} />
      <mesh geometry={geos.side} material={wall} position={[x0, h / 2, (z0 + z1) / 2]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={geos.side} material={wall} position={[x1, h / 2, (z0 + z1) / 2]} rotation={[0, -Math.PI / 2, 0]} />
      <mesh geometry={geos.skirt} material={sk} position={[(x0 + x1) / 2, 0.07, z0 + 0.03]} scale={[W, 1, 1]} />
      <mesh geometry={geos.skirt} material={sk} position={[x0 + 0.03, 0.07, (z0 + z1) / 2]} rotation={[0, Math.PI / 2, 0]} scale={[D, 1, 1]} />
    </group>
  );
};

// =======================================================================================
// The boy's room

/**
 * Layout of the boy's room. The desk stands against the right wall (x1); the boy sits on the
 * stool facing it (+x, rotationY π/2). The bed is against the back wall on the left; he sits on
 * its edge facing +z for the "giro" shot. The camera may stand outside the right wall (x > x1).
 */
export const BOY = {
  x0: -4.6,
  x1: 3.6,
  z0: -3.0,
  z1: 3.0,
  h: 7,
  desk: { x0: 2.4, x1: 3.55, z0: -1.75, z1: 1.3, top: 1.25 },
  /** Stool base, and where a <Chico> sits on it (Nubi's feet), turned by `face` (rotationY:
   *  towards the laptop, a little towards +z so side cameras see his face and the screen). */
  stool: [1.38, 0, -0.85] as V3,
  sit: [1.38, 0.55, -0.85] as V3,
  face: Math.PI / 2 - 0.4,
  /** Laptop base centre on the desk (its screen faces the stool, turned 0.4 towards +z). */
  laptop: [2.98, 1.25, -0.2] as V3,
  /** The served plate (on the desk, beside the laptop, towards +z). */
  plate: [2.92, 1.25, 0.6] as V3,
  lamp: [3.2, 1.25, -1.4] as V3,
  window: { x: 0.35, y: 2.5, w: 1.8, h: 1.45 },
  bed: { x0: -4.55, x1: -1.95, z0: -3.0, z1: -1.2, top: 0.66 },
  /** Where he sits on the bed edge (facing +z). */
  bedSit: [-3.15, 0.66, -2.05] as V3,
  nightstand: [-1.5, 0, -2.6] as V3,
};

const boyWall = () =>
  texMat(
    "boy-wall",
    128,
    128,
    (ctx, W, H) => {
      ctx.fillStyle = "#BFE6FF";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#CDEBFF";
      ctx.fillRect(0, 0, W / 2, H);
      ctx.fillStyle = "#FFFFFF";
      for (const [x, y] of [
        [32, 30],
        [96, 94],
      ]) {
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const r = k % 2 ? 3 : 7;
          const a = (k * Math.PI) / 5 - Math.PI / 2;
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
      }
    },
    { glow: 0.16, rough: 0.95, repeat: 1 / 1.1 },
  );

const woodFloor = (key: string, tones: string[]) =>
  texMat(
    key,
    256,
    256,
    (ctx, W) => {
      for (let r = 0; r < 4; r++) {
        for (let k = -1; k < 3; k++) {
          const off = [0, 64, 32, 96][r];
          ctx.fillStyle = tones[(r + k + 4) % tones.length];
          ctx.fillRect(off + k * 128, r * 64, 128, 64);
          ctx.fillStyle = "rgba(90,50,20,0.35)";
          ctx.fillRect(off + k * 128, r * 64, 3, 64);
        }
        ctx.fillStyle = "rgba(90,50,20,0.35)";
        ctx.fillRect(0, r * 64, W, 3);
      }
    },
    { glow: 0.1, rough: 0.6, repeat: 1 / 2 },
  );

/** Swivel stool (base at the origin) with a low backrest on its −z side. */
const Stool: React.FC<{ yaw?: number }> = ({ yaw = 0 }) => {
  const geos = useMemo(
    () => ({
      seat: new THREE.CylinderGeometry(0.62, 0.6, 0.14, 32),
      col: new THREE.CylinderGeometry(0.06, 0.06, 0.36, 10),
      arm: rbox(0.08, 0.06, 0.62, 0.03),
      wheel: new THREE.SphereGeometry(0.05, 10, 8),
      back: rbox(1.1, 0.55, 0.12, 0.06),
    }),
    [],
  );
  const dark = toy("#4A5068", { glow: 0.08 });
  return (
    <group>
      {[0, 1, 2, 3, 4].map((k) => (
        <group key={k} rotation={[0, (k * Math.PI * 2) / 5, 0]}>
          <mesh geometry={geos.arm} material={dark} position={[0, 0.08, 0.28]} />
          <mesh geometry={geos.wheel} material={dark} position={[0, 0.05, 0.56]} />
        </group>
      ))}
      <mesh geometry={geos.col} material={toy("#C9D3E3", { metal: 0.4, rough: 0.3 })} position={[0, 0.28, 0]} />
      <group rotation={[0, yaw, 0]}>
        <mesh geometry={geos.seat} material={toy("#FF8A65", { glow: 0.14 })} position={[0, 0.48, 0]} />
        <mesh geometry={geos.back} material={toy("#FF8A65", { glow: 0.14 })} position={[0, 0.8, -0.62]} rotation={[-0.12, 0, 0]} />
      </group>
    </group>
  );
};

const Desk: React.FC = () => {
  const D = BOY.desk;
  const W = D.x1 - D.x0;
  const L = D.z1 - D.z0;
  const geos = useMemo(
    () => ({
      top: rbox(W, 0.08, L, 0.03),
      leg: rbox(0.08, D.top - 0.08, 0.08, 0.03),
      drawers: rbox(W - 0.1, D.top - 0.15, 0.6, 0.04),
      knob: new THREE.SphereGeometry(0.035, 8, 6),
      cup: new THREE.CylinderGeometry(0.08, 0.07, 0.2, 16),
      pen: new THREE.CylinderGeometry(0.012, 0.012, 0.26, 6),
      pot: new THREE.CylinderGeometry(0.09, 0.07, 0.13, 16),
      cactus: new THREE.CapsuleGeometry(0.055, 0.12, 4, 10),
      note: new THREE.PlaneGeometry(0.22, 0.22),
    }),
    [W, L, D.top],
  );
  const cx = (D.x0 + D.x1) / 2;
  const top = toy("#FFF7EC", { glow: 0.12, rough: 0.5 });
  const legs = toy("#FFB74D", { glow: 0.14 });
  return (
    <group>
      <mesh geometry={geos.top} material={top} position={[cx, D.top - 0.04, (D.z0 + D.z1) / 2]} />
      <mesh geometry={geos.leg} material={legs} position={[D.x0 + 0.08, (D.top - 0.08) / 2, D.z1 - 0.08]} />
      <mesh geometry={geos.leg} material={legs} position={[D.x1 - 0.08, (D.top - 0.08) / 2, D.z1 - 0.08]} />
      <mesh geometry={geos.drawers} material={legs} position={[cx, (D.top - 0.15) / 2 + 0.02, D.z0 + 0.34]} />
      {[0.3, 0.75].map((y) => (
        <mesh key={y} geometry={geos.knob} material={top} position={[D.x0 + 0.02, y, D.z0 + 0.34]} />
      ))}
      {/* Pen cup and a tiny cactus at the far end; sticky notes on the wall. */}
      <group position={[3.15, D.top, -0.95]}>
        <mesh geometry={geos.cup} material={toy("#7C5CFF", { glow: 0.16 })} position={[0, 0.1, 0]} />
        {[
          ["#FF5A79", 0.2],
          ["#FFD23F", -0.15],
          ["#4FC3F7", 0.05],
        ].map(([c, a], k) => (
          <mesh key={k} geometry={geos.pen} material={toy(c as string, { glow: 0.16 })} position={[0.02 * k - 0.02, 0.24, 0.02 * (k - 1)]} rotation={[a as number, 0, (a as number) * 0.7]} />
        ))}
      </group>
      <group position={[3.25, D.top, 0.05]}>
        <mesh geometry={geos.pot} material={toy("#FF8A65", { glow: 0.14 })} position={[0, 0.065, 0]} />
        <mesh geometry={geos.cactus} material={toy("#58C27D", { glow: 0.14 })} position={[0, 0.22, 0]} />
      </group>
      {[
        [-0.9, 1.9, "#FFE66B", 0.08],
        [-0.55, 2.05, "#9BE7FF", -0.1],
        [0.5, 1.95, "#FFB3D1", 0.05],
      ].map(([z, y, c, r], k) => (
        <mesh key={k} geometry={geos.note} material={toy(c as string, { glow: 0.2, rough: 0.9 })} position={[BOY.x1 - 0.01, y as number, z as number]} rotation={[0, -Math.PI / 2, r as number]} />
      ))}
    </group>
  );
};

export type BoyRoomProps = {
  t?: number;
  /** Laptop: open 0..1, screen glow (0..2), turn (radians, extra yaw towards +z/the camera). */
  laptopOpen?: number;
  laptopGlow?: number;
  laptopTurn?: number;
  /** Hide the laptop (shots that don't need it). */
  laptop?: boolean;
  /** The served plate on the desk (the "almuerzo" gag) and its steam. */
  plate?: boolean;
  steam?: number;
  /** Stool swivel (radians, 0 = facing the desk). */
  stoolYaw?: number;
  /** Nightstand lamp brightness. */
  lamp?: number;
};

export const BoyRoom: React.FC<BoyRoomProps> = ({ t = 0, laptopOpen = 1, laptopGlow = 1, laptopTurn = 0, laptop = true, plate = false, steam = 1, stoolYaw = 0, lamp = 1 }) => {
  const B = BOY;
  const geos = useMemo(
    () => ({
      stand: rbox(0.7, 0.62, 0.6, 0.05),
      shelf: rbox(1.6, 0.07, 0.3, 0.03),
      book: rbox(0.09, 0.32, 0.24, 0.02),
      ball: new THREE.SphereGeometry(0.16, 20, 14),
    }),
    [],
  );
  const BOOKS = ["#FF5A79", "#4FC3F7", "#FFD23F", "#7C5CFF", "#58C27D", "#FF8A65"];
  return (
    <group>
      <Shell x0={B.x0} x1={B.x1} z0={B.z0} z1={B.z1} h={B.h} wall={boyWall()} floor={woodFloor("boy-floor", ["#E3B07B", "#D9A36C", "#EAB985", "#DDA874"])} trim="#FFFFFF" />
      <NightWindow position={[B.window.x, B.window.y, B.z0 + 0.02]} w={B.window.w} h={B.window.h} />
      {/* Posters: over the bed (back wall), beside the window, and on the left wall. */}
      <Poster k="rocket" draw={posterRocket} position={[-3.75, 2.15, B.z0 + 0.02]} tilt={0.04} />
      <Poster k="game" draw={posterGame} position={[-2.65, 2.3, B.z0 + 0.02]} tilt={-0.05} w={0.75} h={0.95} />
      <Poster k="dino" draw={posterDino} position={[2.1, 2.55, B.z0 + 0.02]} tilt={0.03} w={0.72} h={0.9} />
      <Poster k="rocket" draw={posterRocket} position={[B.x0 + 0.02, 2.4, 0.4]} rotationY={Math.PI / 2} w={0.7} h={0.9} />
      {/* Shelf with books and a ball above the desk (right wall, only seen from inside). */}
      <group position={[B.x1 - 0.16, 2.6, -0.7]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh geometry={geos.shelf} material={toy("#FFFFFF", { glow: 0.12 })} />
        {BOOKS.map((c, k) => (
          <mesh key={k} geometry={geos.book} material={toy(c, { glow: 0.16 })} position={[-0.65 + k * 0.1, 0.19, 0]} rotation={[0, 0, k === 5 ? -0.3 : 0]} />
        ))}
        <mesh geometry={geos.ball} material={toy("#FF7043", { glow: 0.16 })} position={[0.45, 0.2, 0]} />
      </group>
      <FairyLights a={[B.x0 + 0.2, 3.9, B.z0 + 0.05]} b={[B.window.x - 1.15, 3.9, B.z0 + 0.05]} n={11} sag={0.22} t={t} />

      <Bed x0={B.bed.x0} x1={B.bed.x1} z0={B.bed.z0} z1={B.bed.z1} top={B.bed.top} frame="#8FB3E8" quilt="#5C7CFA" pillow="#FFE680" />
      <mesh geometry={geos.stand} material={toy("#FFFFFF", { glow: 0.12 })} position={[B.nightstand[0], 0.31, B.nightstand[2]]} />
      <group position={[B.nightstand[0], 0.62, B.nightstand[2]]} scale={0.8}>
        <Lamp on={lamp} color="#FF8A65" />
      </group>
      <Rug position={[0.2, 0.004, 0.3]} r={1.5} color="#FFD23F" ring="#FF8A65" />

      <Desk />
      <group position={[B.lamp[0], B.lamp[1], B.lamp[2]]}>
        <Lamp color="#4FC3F7" />
      </group>
      {laptop ? (
        <group position={B.laptop} rotation={[0, -Math.PI / 2 + 0.4 + laptopTurn, 0]}>
          <Laptop open={laptopOpen} glow={laptopGlow} />
        </group>
      ) : null}
      {plate ? (
        <group position={B.plate} rotation={[0, -0.6, 0]}>
          <Plate t={t} steam={steam} />
        </group>
      ) : null}
      <group position={B.stool} rotation={[0, B.face, 0]}>
        <Stool yaw={stoolYaw} />
      </group>
    </group>
  );
};

/**
 * Lights of the boy's room (4, no shadows): a bright warm hemisphere, a key from the front-right,
 * the warm lamp (desk or nightstand, `lampAt`) and a cool screen glow at `screenAt`.
 */
export const BoyLights: React.FC<{ warm?: number; screen?: number; screenAt?: V3; lampAt?: V3; keyFrom?: V3 }> = ({ warm = 1, screen = 0, screenAt = BOY.laptop, lampAt = [BOY.lamp[0] - 0.3, BOY.lamp[1] + 0.7, BOY.lamp[2] + 0.3], keyFrom = [7, 8, 7] }) => (
  <>
    <hemisphereLight args={["#FFF3E6", "#B08A70", 1.35]} />
    <directionalLight position={keyFrom} intensity={1.55} color="#FFF0DC" />
    <pointLight position={lampAt} intensity={2.2 * warm} distance={7} decay={1.3} color="#FFB868" />
    <pointLight position={[screenAt[0] - 0.4, screenAt[1] + 0.5, screenAt[2]]} intensity={1.6 * screen} distance={3.5} decay={1.5} color="#A9CBFF" />
  </>
);

// =======================================================================================
// The girl's room

export const GIRL = {
  x0: -3.6,
  x1: 3.6,
  z0: -2.6,
  z1: 3,
  h: 6,
  bed: { x0: -2.0, x1: 2.0, z0: -2.6, z1: -0.2, top: 0.66 },
  /** Where she sits on the bed (facing +z). */
  sit: [0.1, 0.66, -1.0] as V3,
};

const girlWall = () =>
  texMat(
    "girl-wall",
    128,
    128,
    (ctx, W, H) => {
      ctx.fillStyle = "#FFD6EA";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#FFFFFF";
      heartPath(ctx, W * 0.25, H * 0.18, 18);
      ctx.fill();
      heartPath(ctx, W * 0.75, H * 0.66, 18);
      ctx.fill();
      ctx.fillStyle = "#F5C2E0";
      ctx.beginPath();
      ctx.arc(W * 0.75, H * 0.2, 5, 0, Math.PI * 2);
      ctx.arc(W * 0.25, H * 0.72, 5, 0, Math.PI * 2);
      ctx.fill();
    },
    { glow: 0.16, rough: 0.95, repeat: 1 / 0.9 },
  );

/** Teddy bear plush (sitting; base at the origin, faces +z). */
const Bear: React.FC<{ color?: string }> = ({ color = "#C8915A" }) => {
  const geos = useMemo(() => ({ s: new THREE.SphereGeometry(1, 18, 12) }), []);
  const fur = toy(color, { rough: 0.95, glow: 0.14 });
  const light = toy("#F2D2A9", { rough: 0.95, glow: 0.14 });
  const black = toy("#1A1A1A", { rough: 0.3, glow: 0 });
  const s = geos.s;
  return (
    <group>
      <mesh geometry={s} material={fur} position={[0, 0.22, 0]} scale={[0.24, 0.24, 0.2]} />
      <mesh geometry={s} material={light} position={[0, 0.2, 0.15]} scale={[0.13, 0.14, 0.06]} />
      <mesh geometry={s} material={fur} position={[0, 0.56, 0.02]} scale={0.19} />
      <mesh geometry={s} material={fur} position={[-0.15, 0.71, 0]} scale={0.07} />
      <mesh geometry={s} material={fur} position={[0.15, 0.71, 0]} scale={0.07} />
      <mesh geometry={s} material={light} position={[0, 0.52, 0.18]} scale={[0.08, 0.06, 0.05]} />
      <mesh geometry={s} material={black} position={[0, 0.55, 0.225]} scale={0.022} />
      <mesh geometry={s} material={black} position={[-0.07, 0.61, 0.17]} scale={0.022} />
      <mesh geometry={s} material={black} position={[0.07, 0.61, 0.17]} scale={0.022} />
      <mesh geometry={s} material={fur} position={[-0.1, 0.06, 0.16]} scale={[0.08, 0.07, 0.11]} />
      <mesh geometry={s} material={fur} position={[0.1, 0.06, 0.16]} scale={[0.08, 0.07, 0.11]} />
      <mesh geometry={s} material={fur} position={[-0.22, 0.3, 0.06]} scale={[0.07, 0.11, 0.07]} rotation={[0, 0, 0.5]} />
      <mesh geometry={s} material={fur} position={[0.22, 0.3, 0.06]} scale={[0.07, 0.11, 0.07]} rotation={[0, 0, -0.5]} />
    </group>
  );
};

/** Bunny plush (base at the origin, faces +z). */
const Bunny: React.FC = () => {
  const geos = useMemo(() => ({ s: new THREE.SphereGeometry(1, 18, 12) }), []);
  const fur = toy("#FFFFFF", { rough: 0.95, glow: 0.12 });
  const pink = toy("#FFB3D1", { rough: 0.95, glow: 0.14 });
  const black = toy("#1A1A1A", { rough: 0.3, glow: 0 });
  const s = geos.s;
  return (
    <group>
      <mesh geometry={s} material={fur} position={[0, 0.2, 0]} scale={[0.21, 0.22, 0.19]} />
      <mesh geometry={s} material={fur} position={[0, 0.5, 0.02]} scale={0.17} />
      <mesh geometry={s} material={fur} position={[-0.07, 0.8, 0]} scale={[0.05, 0.17, 0.04]} rotation={[0, 0, 0.15]} />
      <mesh geometry={s} material={fur} position={[0.08, 0.78, 0]} scale={[0.05, 0.16, 0.04]} rotation={[0, 0, -0.35]} />
      <mesh geometry={s} material={pink} position={[-0.07, 0.8, 0.025]} scale={[0.025, 0.12, 0.02]} rotation={[0, 0, 0.15]} />
      <mesh geometry={s} material={pink} position={[0.08, 0.78, 0.025]} scale={[0.025, 0.11, 0.02]} rotation={[0, 0, -0.35]} />
      <mesh geometry={s} material={pink} position={[0, 0.47, 0.165]} scale={0.025} />
      <mesh geometry={s} material={black} position={[-0.06, 0.53, 0.15]} scale={0.02} />
      <mesh geometry={s} material={black} position={[0.06, 0.53, 0.15]} scale={0.02} />
    </group>
  );
};

/** Heart-shaped cushion (extruded), standing, facing +z. */
const HeartPillow: React.FC<{ color: string; size?: number }> = ({ color, size = 0.5 }) => {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    const k = 1;
    s.moveTo(0, -0.5 * k);
    s.bezierCurveTo(0.15, -0.3, 0.5, -0.1, 0.5, 0.18);
    s.bezierCurveTo(0.5, 0.42, 0.2, 0.5, 0, 0.3);
    s.bezierCurveTo(-0.2, 0.5, -0.5, 0.42, -0.5, 0.18);
    s.bezierCurveTo(-0.5, -0.1, -0.15, -0.3, 0, -0.5);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 4, curveSegments: 16 });
    g.translate(0, 0, -0.06);
    return g;
  }, []);
  return <mesh geometry={geo} material={toy(color, { glow: 0.16, rough: 0.8 })} scale={size} />;
};

export const GirlRoom: React.FC<{ t?: number }> = ({ t = 0 }) => {
  const G = GIRL;
  const geos = useMemo(
    () => ({
      shelf: rbox(1.3, 0.07, 0.28, 0.03),
      star: (() => {
        const s = new THREE.Shape();
        for (let k = 0; k < 10; k++) {
          const r = k % 2 ? 0.4 : 1;
          const a = (k * Math.PI) / 5 + Math.PI / 2;
          if (k === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        return new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 2 });
      })(),
      jar: new THREE.CylinderGeometry(0.1, 0.1, 0.22, 16),
      vase: new THREE.SphereGeometry(0.12, 16, 12),
      flower: new THREE.SphereGeometry(0.06, 10, 8),
    }),
    [],
  );
  return (
    <group>
      <Shell x0={G.x0} x1={G.x1} z0={G.z0} z1={G.z1} h={G.h} wall={girlWall()} floor={woodFloor("girl-floor", ["#F3D2B3", "#EBC6A4", "#F7DCC0", "#EFCDAE"])} trim="#FFFFFF" />
      <Bed x0={G.bed.x0} x1={G.bed.x1} z0={G.bed.z0} z1={G.bed.z1} top={G.bed.top} frame="#FFFFFF" quilt="#C9A7F5" pillow="#FFFFFF" />
      {/* Heart pillows behind her, plushies at her sides. */}
      <group position={[-0.85, G.bed.top + 0.38, G.bed.z0 + 0.3]} rotation={[-0.15, 0.15, 0.12]}>
        <HeartPillow color="#FF6FA5" size={0.62} />
      </group>
      <group position={[1.0, G.bed.top + 0.34, G.bed.z0 + 0.3]} rotation={[-0.15, -0.2, -0.1]}>
        <HeartPillow color="#FFFFFF" size={0.55} />
      </group>
      <group position={[-1.45, G.bed.top, -0.85]} rotation={[0, 0.35, 0]}>
        <Bear />
      </group>
      <group position={[1.55, G.bed.top, -0.9]} rotation={[0, -0.35, 0]}>
        <Bunny />
      </group>
      {/* Fairy lights in swags over the bed, a star and posters. */}
      <FairyLights a={[-2.6, 3.05, G.z0 + 0.05]} b={[0.05, 3.05, G.z0 + 0.05]} n={10} sag={0.32} t={t} colors={["#FFE08A", "#FFFFFF", "#FFC2DD"]} />
      <FairyLights a={[0.05, 3.05, G.z0 + 0.05]} b={[2.7, 3.05, G.z0 + 0.05]} n={10} sag={0.32} t={t + 1} colors={["#FFFFFF", "#FFE08A", "#FFC2DD"]} />
      <mesh geometry={geos.star} material={toy("#FFD43B", { glow: 0.4 })} position={[0.05, 3.25, G.z0 + 0.1]} scale={0.22} />
      <Poster k="heart" draw={posterHeart} position={[-2.6, 2.1, G.z0 + 0.02]} tilt={0.05} w={0.7} h={0.9} />
      <Poster k="rainbow" draw={posterRainbow} position={[2.6, 2.05, G.z0 + 0.02]} tilt={-0.04} w={0.75} h={0.95} />
      {/* A little shelf with a jar of stars and flowers. */}
      <group position={[2.5, 1.2, G.z0 + 0.16]}>
        <mesh geometry={geos.shelf} material={toy("#FFFFFF", { glow: 0.12 })} />
        <mesh geometry={geos.jar} material={toy("#B9F3E4", { glow: 0.3, rough: 0.2 })} position={[-0.35, 0.15, 0]} />
        <mesh geometry={geos.vase} material={toy("#FF9EC7", { glow: 0.16 })} position={[0.3, 0.15, 0]} />
        {[-0.06, 0.05, 0.12].map((x, k) => (
          <mesh key={k} geometry={geos.flower} material={toy(["#FFD43B", "#FF6FA5", "#B98CFF"][k], { glow: 0.2 })} position={[0.3 + x, 0.36 + 0.04 * (k % 2), 0]} />
        ))}
      </group>
      <Rug position={[0.1, 0.004, 1.0]} r={1.6} color="#FFFFFF" ring="#FFB3D1" />
    </group>
  );
};

/** Lights of the girl's room (4, no shadows): pastel hemisphere, key, the fairy-light wash and
 *  a cool phone glow at `phoneAt`. */
export const GirlLights: React.FC<{ phone?: number; phoneAt?: V3 }> = ({ phone = 1, phoneAt = [0.9, 1.9, 0.2] }) => (
  <>
    <hemisphereLight args={["#FFF0F6", "#C79AA8", 1.35]} />
    <directionalLight position={[-4, 7, 8]} intensity={1.5} color="#FFF2E8" />
    <pointLight position={[0, 3.0, GIRL.z0 + 1.2]} intensity={2.0} distance={6} decay={1.3} color="#FFC48A" />
    <pointLight position={phoneAt} intensity={1.4 * phone} distance={3} decay={1.5} color="#B8D4FF" />
  </>
);

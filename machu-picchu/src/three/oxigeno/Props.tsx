import React, { useMemo } from "react";
import * as THREE from "three";
import { V3, canvasTexture, glowTexture, toy, useFontsReady, useRounded, wrap } from "../inca/kit";

// Props for the "no oxygen for 5 seconds" short. Everything is in WORLD units sized for Nubi at
// size 2 (Nubi is then 2 wide and ≈ 2 tall: body top at y = 1.98), ground at y = 0, front = +z.
// If Nubi is drawn at another size s, wrap a prop in <group scale={s / 2}> to keep proportions.
// Held props go in Nubi's fin-tip space (model units, 1 world unit at size 2 = 5 model units):
// see MATCH_HOLD_R.
//
// Animation only comes from props. `t` is time in seconds (frame / fps) and drives flicker,
// smoke, steam and puffs; `flame` / `smoke` / `steam` / `exhaust` are 0..1 amounts.

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// =======================================================================================
// Shared effects: Flame, Smoke (rising puffs / wisps), Halo.

export type FlamePalette = [outer: string, mid: string, core: string];
export const FIRE: FlamePalette = ["#FF5A1F", "#FFB21A", "#FFF4B8"];
/** Gas flame: orange tips over a blue body with a pale core. */
export const GAS: FlamePalette = ["#FF9A3C", "#2F6BFF", "#BDEBFF"];
/** Rocket exhaust: hot yellow-white core. */
export const JET: FlamePalette = ["#FF4A1A", "#FFC21A", "#FFFFFF"];

let flameGeo: THREE.LatheGeometry | null = null;
/** Teardrop, 1 tall and 1 wide at its widest (h ≈ 0.28), base at y = 0, pointed tip at y = 1. */
const getFlameGeo = () => {
  if (flameGeo) return flameGeo;
  const pts: THREE.Vector2[] = [];
  const N = 18;
  for (let i = 0; i <= N; i++) {
    const h = i / N;
    const r = i === 0 || i === N ? 0 : ((Math.pow(h, 0.5) * Math.pow(1 - h, 1.25)) / 0.345) * 0.5;
    pts.push(new THREE.Vector2(r, h));
  }
  flameGeo = new THREE.LatheGeometry(pts, 18);
  return flameGeo;
};

const basicCache = new Map<string, THREE.MeshBasicMaterial>();
/** Unlit flat colour (flames, glass glints). Cached; never mutate. */
const basic = (color: string) => {
  let m = basicCache.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    basicCache.set(color, m);
  }
  return m;
};

/** Additive glow sprite; `opacity` 0..1. */
export const Halo: React.FC<{ color: string; size: number; opacity: number; position?: V3 }> = ({
  color,
  size,
  opacity,
  position = [0, 0, 0],
}) => {
  const mat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        toneMapped: false,
      }),
    [color],
  );
  if (opacity <= 0.005) return null;
  mat.opacity = Math.min(1, opacity);
  return <sprite material={mat} position={position} scale={[size, size, 1]} />;
};

/**
 * Cartoon flame: three nested teardrops (outer, mid, core) with a soft additive halo. The base
 * sits at the origin and it grows along +y. `amount` 0..1 scales it (0 = out), `t` (seconds)
 * drives the flicker; `seed` de-syncs several flames. Inner layers are pushed towards +z so
 * they read from the front (the camera side).
 */
export const Flame: React.FC<{
  height: number;
  width?: number;
  amount?: number;
  t?: number;
  seed?: number;
  palette?: FlamePalette;
  halo?: number;
  lean?: number;
}> = ({ height, width = height * 0.55, amount = 1, t = 0, seed = 0, palette = FIRE, halo = 1, lean = 0 }) => {
  const k = clamp01(amount);
  if (k <= 0.01) return null;
  const geo = getFlameGeo();
  const f = 1 + 0.1 * Math.sin(t * 11 + seed * 1.7) + 0.06 * Math.sin(t * 23 + seed * 3.1);
  const sway = 0.07 * Math.sin(t * 7 + seed) + 0.04 * Math.sin(t * 17 + seed * 2.3);
  const h = height * (0.35 + 0.65 * k) * f;
  const w = width * (0.5 + 0.5 * k) * (1 + 0.04 * Math.sin(t * 13 + seed));
  const layers: [number, number, number][] = [
    [1, 1, 0],
    [0.7, 0.66, 0.12],
    [0.42, 0.36, 0.22],
  ];
  return (
    <group rotation={[0, 0, sway + lean]}>
      {layers.map(([sw, sh, dz], i) => (
        <mesh
          key={i}
          geometry={geo}
          material={basic(palette[i])}
          position={[0, 0, dz * w]}
          rotation={[0, 0, -sway * i * 0.35]}
          scale={[w * sw, h * sh, w * sw]}
        />
      ))}
      {halo > 0 ? <Halo color={palette[1]} size={Math.max(h, w) * 2.4 * halo} opacity={0.55 * k} position={[0, h * 0.38, 0]} /> : null}
    </group>
  );
};

let puffGeo: THREE.IcosahedronGeometry | null = null;
const getPuffGeo = () => (puffGeo ??= new THREE.IcosahedronGeometry(1, 1));

/**
 * Rising smoke: `count` low-poly puffs that climb from the origin to `height` along +y, growing
 * from r0 to r1 and fading out, wobbling sideways and drifting towards +x with `drift`. A dense,
 * small setting (count 22, r0 0.012, r1 0.05) makes a thin wisp. `t` (seconds) scrolls it;
 * `amount` 0..1 fades it. Rotate the group to point it elsewhere (exhaust, rocket trail).
 */
export const Smoke: React.FC<{
  t?: number;
  amount?: number;
  height?: number;
  r0?: number;
  r1?: number;
  count?: number;
  speed?: number;
  wobble?: number;
  drift?: number;
  color?: string;
  opacity?: number;
  seed?: number;
  flat?: boolean;
}> = ({
  t = 0,
  amount = 1,
  height = 1,
  r0 = 0.05,
  r1 = 0.2,
  count = 10,
  speed = 0.5,
  wobble = 0.1,
  drift = 0,
  color = "#B9B4AE",
  opacity = 0.85,
  seed = 0,
  flat = true,
}) => {
  const mats = useMemo(
    () =>
      Array.from(
        { length: count },
        () =>
          new THREE.MeshStandardMaterial({
            color,
            roughness: 1,
            flatShading: flat,
            transparent: true,
            depthWrite: false,
            emissive: new THREE.Color(color),
            emissiveIntensity: 0.35,
          }),
      ),
    [count, color, flat],
  );
  const k = clamp01(amount);
  if (k <= 0.01) return null;
  const geo = getPuffGeo();
  return (
    <group>
      {mats.map((m, i) => {
        const p = wrap(i / count + (t * speed) / height, 1);
        const y = p * height;
        const wob = Math.sin(p * 7 + t * 2.2 + seed * 1.3 + i * 0.4) * wobble * (0.3 + p);
        const x = wob + drift * p * p * height;
        const z = Math.cos(p * 5 + t * 1.7 + seed) * wobble * 0.4 * p;
        const r = r0 + (r1 - r0) * p;
        m.opacity = k * opacity * Math.min(1, p * 8) * (1 - p) * (1 - p * 0.3);
        return <mesh key={i} geometry={geo} material={m} position={[x, y, z]} scale={r} rotation={[i, i * 2.1, 0]} />;
      })}
    </group>
  );
};

// =======================================================================================
// Canvas text

const TITLE = "'Luckiest Guy', 'Lilita One', sans-serif";
const FUN = "'Lilita One', 'Luckiest Guy', sans-serif";

/** Draws "O₂" (the 2 as a real subscript) centred at x, y with a given cap height. */
export const drawO2 = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill: string, font = FUN) => {
  ctx.textBaseline = "alphabetic";
  ctx.font = `${size}px ${font}`;
  const wo = ctx.measureText("O").width;
  ctx.font = `${size * 0.55}px ${font}`;
  const w2 = ctx.measureText("2").width;
  const left = x - (wo + w2 * 0.95) / 2;
  const base = y + size * 0.36;
  ctx.fillStyle = fill;
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = "left";
  ctx.fillText("O", left, base);
  ctx.font = `${size * 0.55}px ${font}`;
  ctx.fillText("2", left + wo - w2 * 0.02, base + size * 0.16);
};

const buttonLabel = () =>
  canvasTexture("oxi-button-label", 1024, 320, (ctx, W, H) => {
    ctx.fillStyle = "#1A1A1A";
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 60);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(18, 18, W - 36, H - 36, 46);
    ctx.fill();
    ctx.font = `210px ${TITLE}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillText("OXÍGENO", W / 2 + 6, H / 2 + 26);
    ctx.fillStyle = "#E3141B";
    ctx.fillText("OXÍGENO", W / 2, H / 2 + 18);
  });

const hazardTexture = () =>
  canvasTexture(
    "oxi-hazard",
    256,
    256,
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

const texMatCache = new Map<THREE.Texture, THREE.MeshStandardMaterial>();
const texMat = (tex: THREE.Texture, rough = 0.5, glow = 0.16) => {
  let m = texMatCache.get(tex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: rough,
      emissive: new THREE.Color("#ffffff"),
      emissiveMap: tex,
      emissiveIntensity: glow,
    });
    texMatCache.set(tex, m);
  }
  return m;
};

// =======================================================================================
// Big red button

/**
 * The big red button: glossy red dome on a chrome collar, on a yellow-and-black hazard striped
 * pedestal with a white "OXÍGENO" plate on the front. 1.45 wide, 1.87 tall at rest (≈ Nubi's
 * height at size 2); stand it next to Nubi, e.g. Nubi at x = -1.3 and the button at x = +0.4.
 * The press surface (dome top) is at y ≈ 1.87, so Nubi's fin (y ≈ 1.0 at size 2) reaches it
 * with a hop or finR ≈ 1; for a fin-height button use scale 0.75. `press` 0..1 pushes the dome
 * down (and squashes it), `glow` ≥ 0 lights it up (dome emissive + red halo).
 */
export const BigRedButton: React.FC<{ press?: number; glow?: number }> = ({ press = 0, glow = 0 }) => {
  const ready = useFontsReady();
  const geos = useMemo(
    () => ({
      dome: new THREE.SphereGeometry(0.44, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      skirt: new THREE.CylinderGeometry(0.44, 0.44, 0.14, 40),
      collar: new THREE.CylinderGeometry(0.54, 0.58, 0.12, 40),
      collarRing: new THREE.TorusGeometry(0.55, 0.035, 10, 48),
      spec: new THREE.SphereGeometry(0.1, 16, 10),
      bolt: new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12),
    }),
    [],
  );
  const domeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#F0141E",
        roughness: 0.16,
        metalness: 0.05,
        emissive: new THREE.Color("#FF1A1A"),
      }),
    [],
  );
  domeMat.emissiveIntensity = 0.22 + Math.max(0, glow) * 0.75;
  const plinth = useRounded(1.45, 0.1, 1.15, 0.04, 2);
  const body = useRounded(1.3, 1.25, 1.0, 0.07, 3);
  const top = useRounded(1.45, 0.16, 1.15, 0.06, 3);
  const plate = useRounded(1.12, 0.37, 0.05, 0.02, 2);
  const p = clamp01(press);
  const dy = -0.12 * p;
  const sq = 1 - 0.28 * p;
  const chrome = toy("#D9E1EA", { metal: 0.75, rough: 0.22, glow: 0.12 });
  const dark = toy("#262A33", { rough: 0.45, glow: 0.06 });
  const hazard = useMemo(() => {
    const tex = hazardTexture();
    return texMat(tex, 0.5, 0.16);
  }, []);
  return (
    <group>
      <mesh geometry={plinth} material={dark} position={[0, 0.05, 0]} castShadow />
      <mesh geometry={body} material={hazard} position={[0, 0.1 + 0.625, 0]} castShadow />
      <mesh geometry={top} material={dark} position={[0, 1.35 + 0.08, 0]} castShadow />
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} geometry={geos.bolt} material={chrome} position={[sx * 0.6, 1.525, sz * 0.46]} />
        )),
      )}
      <mesh geometry={geos.collar} material={chrome} position={[0, 1.57, 0]} />
      <mesh geometry={geos.collarRing} material={chrome} position={[0, 1.63, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <group position={[0, 1.6 + dy, 0]} scale={[1 + 0.04 * p, sq, 1 + 0.04 * p]}>
        <mesh geometry={geos.skirt} material={domeMat} position={[0, 0.02, 0]} />
        <mesh geometry={geos.dome} material={domeMat} position={[0, 0.08, 0]} scale={[1, 0.64, 1]} castShadow />
        {/* Glossy highlight. */}
        <mesh geometry={geos.spec} material={basic("#FFE4E4")} position={[-0.16, 0.3, 0.2]} scale={[1.3, 0.45, 0.8]} rotation={[0.5, 0, 0.5]} />
      </group>
      <Halo color="#FF2A2A" size={2.2} opacity={0.5 * Math.max(0, glow)} position={[0, 1.75 + dy, 0.2]} />
      {/* Label plate. */}
      <mesh geometry={plate} material={dark} position={[0, 0.86, 0.515]} />
      {ready ? (
        <mesh position={[0, 0.86, 0.542]}>
          <planeGeometry args={[1.08, 0.335]} />
          <meshBasicMaterial map={buttonLabel()} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
};

// =======================================================================================
// Candle, campfire, stove, mug, match

/**
 * Chunky wax candle (0.42 tall, on a 0.06 blue dish) with wax drips and a wick; total ≈ 0.72
 * with the flame. `flame` 0..1 (0 = out), `t` seconds for the flicker, `smoke` 0..1 shows a
 * thin grey wisp rising from the wick (use it when the flame goes out).
 */
export const Candle: React.FC<{ flame?: number; t?: number; smoke?: number }> = ({ flame = 1, t = 0, smoke = 0 }) => {
  const geos = useMemo(
    () => ({
      body: new THREE.CylinderGeometry(0.13, 0.135, 0.42, 28),
      top: new THREE.CylinderGeometry(0.115, 0.13, 0.03, 28),
      drip: new THREE.CapsuleGeometry(0.03, 0.08, 4, 10),
      wick: new THREE.CylinderGeometry(0.012, 0.012, 0.07, 8),
      dish: new THREE.CylinderGeometry(0.24, 0.2, 0.06, 32),
      rim: new THREE.TorusGeometry(0.235, 0.022, 8, 36),
    }),
    [],
  );
  const wax = toy("#FFF1D6", { rough: 0.5, glow: 0.2 });
  return (
    <group>
      <mesh geometry={geos.dish} material={toy("#3A7BFF", { rough: 0.4 })} position={[0, 0.03, 0]} castShadow />
      <mesh geometry={geos.rim} material={toy("#3A7BFF", { rough: 0.4 })} position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={geos.body} material={wax} position={[0, 0.27, 0]} castShadow />
      <mesh geometry={geos.top} material={toy("#FFE7B8", { rough: 0.5, glow: 0.2 })} position={[0, 0.485, 0]} />
      {[
        [0.3, 0.1],
        [1.4, 0.05],
        [2.6, 0.13],
        [4.2, 0.07],
        [5.3, 0.11],
      ].map(([a, l], i) => (
        <mesh key={i} geometry={geos.drip} material={wax} position={[Math.sin(a) * 0.128, 0.43 - l, Math.cos(a) * 0.128]} scale={[1, 1 + l * 4, 0.8]} />
      ))}
      <mesh geometry={geos.wick} material={toy("#2A2320")} position={[0, 0.52, 0]} />
      <group position={[0, 0.535, 0]}>
        <Flame height={0.26} width={0.13} amount={flame} t={t} seed={1} />
        <Smoke t={t} amount={smoke} height={0.7} r0={0.012} r1={0.05} count={24} speed={0.28} wobble={0.05} drift={0.08} color="#9C9793" opacity={0.7} flat={false} />
      </group>
    </group>
  );
};

const LOGS: [number, number, number][] = [
  // [yaw, tilt, colour index]
  [0.3, 0.55, 0],
  [1.9, 0.55, 1],
  [3.5, 0.55, 0],
  [5.0, 0.55, 1],
];

/**
 * Campfire: nine grey stones in a ring (1.4 across), four logs leaning together over glowing
 * embers and a big flame (≈ 1 tall). `flame` 0..1 (0 = out: embers go dark), `t` seconds,
 * `smoke` 0..1 puffs of grey smoke from the logs.
 */
export const Campfire: React.FC<{ flame?: number; t?: number; smoke?: number }> = ({ flame = 1, t = 0, smoke = 0 }) => {
  const geos = useMemo(
    () => ({
      stone: new THREE.DodecahedronGeometry(0.17, 0),
      log: new THREE.CylinderGeometry(0.075, 0.085, 0.8, 12),
      end: new THREE.CylinderGeometry(0.066, 0.066, 0.01, 12),
      ember: new THREE.IcosahedronGeometry(0.12, 0),
    }),
    [],
  );
  const k = clamp01(flame);
  const emberMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#3A2A24", roughness: 0.8, flatShading: true, emissive: new THREE.Color("#FF5A1A") }),
    [],
  );
  emberMat.emissiveIntensity = 0.1 + 1.3 * k * (0.85 + 0.15 * Math.sin(t * 9));
  const logMats = [toy("#9A5B2E", { rough: 0.8 }), toy("#7E4622", { rough: 0.8 })];
  return (
    <group>
      {Array.from({ length: 9 }).map((_, i) => {
        const a = (i / 9) * Math.PI * 2 + 0.2;
        const s = 0.9 + 0.25 * Math.sin(i * 2.7);
        return (
          <mesh
            key={i}
            geometry={geos.stone}
            material={toy(i % 3 === 0 ? "#8E949C" : i % 3 === 1 ? "#A6ACB3" : "#7D838B", { rough: 0.9, flat: true })}
            position={[Math.cos(a) * 0.56, 0.1 * s, Math.sin(a) * 0.5]}
            rotation={[i, i * 1.3, 0]}
            scale={[s * 1.15, s * 0.85, s]}
            castShadow
          />
        );
      })}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} geometry={geos.ember} material={emberMat} position={[Math.cos(i * 1.3) * 0.12, 0.05, Math.sin(i * 1.3) * 0.1]} scale={0.8 + (i % 2) * 0.3} rotation={[i, i, 0]} />
      ))}
      {LOGS.map(([yaw, tilt, c], i) => (
        <group key={i} rotation={[0, yaw, 0]}>
          <group position={[0, 0.02, 0.26]} rotation={[-tilt, 0, 0]}>
            <mesh geometry={geos.log} material={logMats[c]} position={[0, 0.34, 0]} castShadow />
            <mesh geometry={geos.end} material={toy("#F0C98A", { rough: 0.7 })} position={[0, -0.056, 0]} />
          </group>
        </group>
      ))}
      <group position={[0, 0.12, 0.05]}>
        <Flame height={1.0} width={0.55} amount={k} t={t} seed={2} halo={1.1} />
        <group position={[-0.16, 0, 0.1]}>
          <Flame height={0.55} width={0.3} amount={k} t={t} seed={5} lean={0.25} halo={0} />
        </group>
        <group position={[0.17, 0, 0.08]}>
          <Flame height={0.62} width={0.3} amount={k} t={t} seed={8} lean={-0.22} halo={0} />
        </group>
      </group>
      <group position={[0, 0.5, 0]}>
        <Smoke t={t} amount={smoke} height={2.0} r0={0.08} r1={0.34} count={12} speed={0.45} wobble={0.15} drift={0.15} color="#A7A29D" opacity={0.8} />
      </group>
    </group>
  );
};

/**
 * Camping stove: a red gas base with a knob, three chrome pot supports and a ring of 12 blue gas
 * flames with orange tips under a teal enamel pot with a lid. 0.8 wide, ≈ 1.05 tall.
 * `flame` 0..1 (0 = off), `t` seconds.
 */
export const Stove: React.FC<{ flame?: number; t?: number }> = ({ flame = 1, t = 0 }) => {
  const geos = useMemo(
    () => ({
      base: new THREE.CylinderGeometry(0.36, 0.4, 0.24, 36),
      band: new THREE.CylinderGeometry(0.405, 0.405, 0.05, 36),
      top: new THREE.CylinderGeometry(0.3, 0.36, 0.05, 36),
      burner: new THREE.CylinderGeometry(0.13, 0.15, 0.07, 24),
      knob: new THREE.CylinderGeometry(0.07, 0.07, 0.07, 18),
      knobBar: new THREE.BoxGeometry(0.03, 0.1, 0.03),
      support: new THREE.BoxGeometry(0.04, 0.3, 0.18),
      pot: new THREE.CylinderGeometry(0.33, 0.3, 0.3, 36),
      potRim: new THREE.TorusGeometry(0.33, 0.025, 8, 40),
      lid: new THREE.SphereGeometry(0.34, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      lidKnob: new THREE.SphereGeometry(0.06, 16, 10),
      handle: new THREE.TorusGeometry(0.07, 0.025, 8, 16, Math.PI),
    }),
    [],
  );
  const chrome = toy("#D9E1EA", { metal: 0.75, rough: 0.22, glow: 0.12 });
  const enamel = toy("#17B3A6", { rough: 0.35, glow: 0.16 });
  const k = clamp01(flame);
  const N = 12;
  return (
    <group>
      <mesh geometry={geos.base} material={toy("#E8383D", { rough: 0.4 })} position={[0, 0.12, 0]} castShadow />
      <mesh geometry={geos.band} material={toy("#FFFFFF", { rough: 0.5, glow: 0.1 })} position={[0, 0.13, 0]} />
      <mesh geometry={geos.top} material={toy("#2B2F38", { rough: 0.45 })} position={[0, 0.265, 0]} />
      <mesh geometry={geos.burner} material={toy("#4A505C", { rough: 0.4, metal: 0.3 })} position={[0, 0.32, 0]} />
      <group position={[0.2, 0.13, 0.33]} rotation={[Math.PI / 2 - 0.3, 0, 0]}>
        <mesh geometry={geos.knob} material={toy("#FFC21A", { rough: 0.4 })} />
        <mesh geometry={geos.knobBar} material={toy("#2B2F38")} position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0.6 - k * 1.2]} />
      </group>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
        return <mesh key={i} geometry={geos.support} material={chrome} position={[Math.sin(a) * 0.25, 0.42, Math.cos(a) * 0.25]} rotation={[0, a, 0]} />;
      })}
      {Array.from({ length: N }).map((_, i) => {
        const a = (i / N) * Math.PI * 2;
        return (
          <group key={i} position={[Math.sin(a) * 0.12, 0.35, Math.cos(a) * 0.12]} rotation={[Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45]}>
            <Flame height={0.2} width={0.085} amount={k} t={t} seed={i * 2.3} palette={GAS} halo={0} />
          </group>
        );
      })}
      <Halo color="#5AA8FF" size={0.9} opacity={0.5 * k} position={[0, 0.42, 0.15]} />
      <group position={[0, 0.57, 0]}>
        <mesh geometry={geos.pot} material={enamel} position={[0, 0.15, 0]} castShadow />
        <mesh geometry={geos.potRim} material={enamel} position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={geos.lid} material={toy("#1FC9BA", { rough: 0.3, glow: 0.18 })} position={[0, 0.3, 0]} scale={[1, 0.3, 1]} />
        <mesh geometry={geos.lidKnob} material={toy("#2B2F38", { rough: 0.4 })} position={[0, 0.42, 0]} />
        {[-1, 1].map((s) => (
          <mesh key={s} geometry={geos.handle} material={toy("#2B2F38", { rough: 0.4 })} position={[s * 0.34, 0.22, 0]} rotation={[0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2]} />
        ))}
      </group>
    </group>
  );
};

/**
 * Coffee mug (0.36 tall, coral with a cream rim and handle on the screen-right) full of coffee,
 * with three steam curls rising ≈ 0.6 above it. `steam` 0..1, `t` seconds.
 */
export const CoffeeMug: React.FC<{ steam?: number; t?: number }> = ({ steam = 1, t = 0 }) => {
  const geos = useMemo(
    () => ({
      body: new THREE.CylinderGeometry(0.17, 0.15, 0.34, 32, 1, true),
      bottom: new THREE.CylinderGeometry(0.15, 0.15, 0.02, 32),
      rim: new THREE.TorusGeometry(0.165, 0.02, 10, 40),
      coffee: new THREE.CircleGeometry(0.155, 32),
      handle: new THREE.TorusGeometry(0.085, 0.032, 10, 20, Math.PI * 1.25),
      band: new THREE.CylinderGeometry(0.168, 0.164, 0.05, 32, 1, true),
    }),
    [],
  );
  const coral = toy("#FF6B5E", { rough: 0.35, glow: 0.16, side: THREE.DoubleSide });
  return (
    <group>
      <mesh geometry={geos.bottom} material={coral} position={[0, 0.01, 0]} />
      <mesh geometry={geos.body} material={coral} position={[0, 0.17, 0]} castShadow />
      <mesh geometry={geos.band} material={toy("#FFF1D6", { rough: 0.4, side: THREE.DoubleSide })} position={[0, 0.12, 0]} />
      <mesh geometry={geos.rim} material={toy("#FFF1D6", { rough: 0.4 })} position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={geos.coffee} material={toy("#5A3218", { rough: 0.25 })} position={[0, 0.3, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      <mesh geometry={geos.handle} material={coral} position={[0.19, 0.18, 0]} rotation={[0, 0, -Math.PI * 0.62]} />
      {[-0.06, 0.03, 0.1].map((x, i) => (
        <group key={i} position={[x, 0.33, (i - 1) * 0.03]}>
          <Smoke t={t + i * 0.9} amount={steam} height={0.6} r0={0.025} r1={0.055} count={16} speed={0.3} wobble={0.05} drift={0.02 * (i - 1)} color="#FFFFFF" opacity={0.75} seed={i * 2} flat={false} />
        </group>
      ))}
    </group>
  );
};

/**
 * Wooden match, standing along +y: grip (origin) 0.12 above the bottom of the stick, red head at
 * y ≈ 0.38, flame on top. `flame` 0..1, `t` seconds, `smoke` 0..1 wisp when blown out.
 * In a fin: <Nubi holdR={<group {...MATCH_HOLD_R}><Match flame={1} t={t} /></group>}>.
 */
export const Match: React.FC<{ flame?: number; t?: number; smoke?: number }> = ({ flame = 1, t = 0, smoke = 0 }) => {
  const geos = useMemo(
    () => ({
      stick: new THREE.BoxGeometry(0.045, 0.46, 0.045),
      head: new THREE.SphereGeometry(0.042, 16, 12),
    }),
    [],
  );
  const k = clamp01(flame);
  return (
    <group>
      <mesh geometry={geos.stick} material={toy("#F2CE8A", { rough: 0.7 })} position={[0, 0.11, 0]} castShadow />
      <mesh geometry={geos.head} material={toy(k > 0.01 || smoke < 0.01 ? "#E5262B" : "#3A2A26", { rough: 0.5 })} position={[0, 0.36, 0]} scale={[1.05, 1.35, 1.05]} />
      <group position={[0, 0.34, 0]}>
        <Flame height={0.24} width={0.11} amount={k} t={t} seed={3} />
        <group position={[0, 0.06, 0]}>
          <Smoke t={t} amount={smoke} height={0.6} r0={0.01} r1={0.045} count={22} speed={0.26} wobble={0.05} drift={0.06} color="#9C9793" opacity={0.7} flat={false} />
        </group>
      </group>
    </group>
  );
};

/**
 * Match in <Nubi holdR> (fin-tip space, model units): scaled ×7 (world units at size 2 → model
 * units are ×5), standing up in front of the fin tip, head tilted a little outwards. Scale 7 (a bit
 * oversized, cartoon-style: ≈ 0.64 world tall at Nubi size 2) so it reads on a phone. Mirror position x
 * and rotation z for MATCH_HOLD_L.
 */
export const MATCH_HOLD_R = { position: [0.25, 0.1, 0.85] as V3, rotation: [0.1, 0, -0.35] as V3, scale: 7 };
export const MATCH_HOLD_L = { position: [-0.25, 0.1, 0.85] as V3, rotation: [0.1, 0, 0.35] as V3, scale: 7 };

// =======================================================================================
// Vehicles

/** Round porthole: chrome ring and blue glass with a glint, facing +z. */
const Porthole: React.FC<{ r: number; position: V3; rotation?: V3 }> = ({ r, position, rotation = [0, 0, 0] }) => {
  const geos = useMemo(
    () => ({
      ring: new THREE.TorusGeometry(1, 0.2, 10, 32),
      glass: new THREE.CircleGeometry(1, 32),
      glint: new THREE.CircleGeometry(0.28, 16),
    }),
    [],
  );
  return (
    <group position={position} rotation={rotation} scale={r}>
      <mesh geometry={geos.glass} material={toy("#5BC8FF", { rough: 0.15, glow: 0.3 })} />
      <mesh geometry={geos.ring} material={toy("#F4F7FA", { rough: 0.3, metal: 0.3, glow: 0.14 })} />
      <mesh geometry={geos.glint} material={basic("#E8FAFF")} position={[-0.35, 0.35, 0.02]} scale={[1, 0.7, 1]} />
    </group>
  );
};

/**
 * Cartoon propeller plane, flying towards +x (nose at x = +1.5, tail at -1.5; 3.3 wingspan
 * along z; 1.1 fuselage diameter). Yellow fuselage, red wings and tail, big round side windows,
 * an open cockpit where Nubi can sit (see PLANE_SEAT) and a windscreen.
 * `prop` = propeller angle (radians, e.g. frame * 1.3), `exhaust` 0..1 puffs of smoke and a
 * little flame from the two exhaust pipes behind the cowling, `t` seconds.
 */
export const ToyPlane: React.FC<{ prop?: number; exhaust?: number; t?: number }> = ({ prop = 0, exhaust = 0, t = 0 }) => {
  const geos = useMemo(() => {
    const prof: [number, number][] = [
      [0, 0],
      [0.14, 0.02],
      [0.2, 0.2],
      [0.34, 0.75],
      [0.5, 1.45],
      [0.55, 2.0],
      [0.54, 2.45],
      [0.48, 2.78],
      [0.34, 2.95],
      [0, 3.0],
    ];
    const body = new THREE.LatheGeometry(
      prof.map(([r, h]) => new THREE.Vector2(r, h)),
      40,
    );
    body.rotateZ(-Math.PI / 2);
    body.translate(-1.5, 0, 0);
    const fin = new THREE.Shape();
    fin.moveTo(-0.35, 0);
    fin.lineTo(0.25, 0);
    fin.quadraticCurveTo(0.05, 0.25, -0.05, 0.62);
    fin.quadraticCurveTo(-0.2, 0.72, -0.35, 0.6);
    fin.closePath();
    const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 12 });
    finGeo.translate(0, 0, -0.04);
    return {
      body,
      fin: finGeo,
      cowl: new THREE.CylinderGeometry(0.5, 0.52, 0.2, 40),
      spinner: new THREE.ConeGeometry(0.2, 0.34, 24),
      blade: new THREE.CapsuleGeometry(0.07, 0.62, 4, 10),
      rim: new THREE.TorusGeometry(0.52, 0.07, 12, 40),
      tub: new THREE.CylinderGeometry(0.53, 0.53, 0.36, 40, 1, true),
      pipe: new THREE.CylinderGeometry(0.05, 0.06, 0.28, 12),
      strut: new THREE.CylinderGeometry(0.035, 0.035, 0.42, 8),
      wheel: new THREE.CylinderGeometry(0.15, 0.15, 0.1, 24),
      hub: new THREE.CylinderGeometry(0.06, 0.06, 0.11, 16),
      screen: new THREE.SphereGeometry(0.34, 24, 12, -Math.PI / 2, Math.PI, 0, Math.PI / 2),
    };
  }, []);
  const wing = useRounded(0.8, 0.1, 3.3, 0.05, 3);
  const stab = useRounded(0.45, 0.07, 1.3, 0.035, 3);
  const yellow = toy("#FFD23F", { rough: 0.35, glow: 0.16 });
  const red = toy("#FF4B4B", { rough: 0.35, glow: 0.16 });
  const white = toy("#FFFFFF", { rough: 0.35, glow: 0.12 });
  const dark = toy("#262A33", { rough: 0.5 });
  const glass = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#BDEBFF", roughness: 0.1, transparent: true, opacity: 0.55, emissive: new THREE.Color("#BDEBFF"), emissiveIntensity: 0.2, side: THREE.DoubleSide }),
    [],
  );
  const k = clamp01(exhaust);
  return (
    <group>
      <mesh geometry={geos.body} material={yellow} castShadow />
      {/* Red cheat line along the fuselage. */}
      <mesh geometry={geos.cowl} material={red} position={[1.38, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
      <mesh geometry={geos.spinner} material={white} position={[1.62, 0, 0]} rotation={[0, 0, -Math.PI / 2]} />
      <group position={[1.56, 0, 0]} rotation={[prop, 0, 0]}>
        {[0, Math.PI].map((a) => (
          <mesh key={a} geometry={geos.blade} material={toy("#3A3F4A", { rough: 0.4 })} rotation={[a, 0, 0]} position={[0, Math.cos(a) * 0.42, 0]} scale={[0.6, 1, 1.5]} />
        ))}
      </group>
      {/* Wings, tail. */}
      <mesh geometry={wing} material={red} position={[0.35, -0.22, 0]} castShadow />
      <mesh geometry={stab} material={red} position={[-1.2, 0.06, 0]} />
      <mesh geometry={geos.fin} material={red} position={[-1.12, 0.1, 0]} />
      {/* Cockpit rim and windscreen. */}
      <mesh geometry={geos.tub} material={toy("#FFD23F", { rough: 0.35, glow: 0.16, side: THREE.DoubleSide })} position={[0.02, 0.28, 0]} />
      <mesh geometry={geos.rim} material={red} position={[0.02, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]} />
      <mesh geometry={geos.screen} material={glass} position={[0.6, 0.44, 0]} scale={[0.7, 0.8, 1.0]} />
      {/* Side windows. */}
      {[-1, 1].flatMap((s) =>
        [-0.55, -0.95].map((x, i) => (
          <Porthole key={`${s}${x}`} r={0.14 - i * 0.02} position={[x, 0.08, s * (0.51 - i * 0.05)]} rotation={[0, s > 0 ? 0 : Math.PI, 0]} />
        )),
      )}
      {/* Landing gear. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0.55, -0.45, s * 0.42]}>
          <mesh geometry={geos.strut} material={dark} position={[0, -0.02, 0]} rotation={[s * 0.25, 0, 0]} />
          <mesh geometry={geos.wheel} material={dark} position={[0, -0.24, s * 0.06]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh geometry={geos.hub} material={white} position={[0, -0.24, s * 0.06]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      ))}
      {/* Exhaust pipes pointing back; puffs trail towards -x. */}
      {[-1, 1].map((s) => (
        <group key={s} position={[1.08, -0.12, s * 0.5]}>
          <mesh geometry={geos.pipe} material={toy("#C9D1DA", { metal: 0.6, rough: 0.3 })} rotation={[0, 0, Math.PI / 2 + 0.25]} />
          <group position={[-0.14, -0.03, 0]} rotation={[0, 0, Math.PI / 2 + 0.2]}>
            <Flame height={0.22} width={0.12} amount={k} t={t} seed={s * 3} halo={0.6} />
            <Smoke t={t + (s > 0 ? 0.37 : 0)} amount={k} height={2.2} r0={0.1} r1={0.34} count={9} speed={2.2} wobble={0.06} drift={0} color="#F2F0EE" opacity={1} seed={s} />
          </group>
        </group>
      ))}
    </group>
  );
};

/**
 * Where Nubi sits in the ToyPlane's open cockpit (plane space, plane at scale 1): pass as
 * <Nubi position={PLANE_SEAT.position} size={PLANE_SEAT.size}> inside the plane's group. The
 * lower body sinks into the fuselage; eyes and fins stay above the cockpit rim. For a plane
 * drawn at scale S, multiply both by S (or nest Nubi inside the scaled group).
 */
export const PLANE_SEAT = { position: [0.02, 0.17, 0] as V3, size: 0.84 };

/**
 * Cartoon car driving towards +x: rounded coral body (2.1 long, 1.2 wide), cream cabin with blue
 * windows, big wheels with white hubcaps, round headlights and an exhaust pipe at the back.
 * `exhaust` 0..1 puffs of smoke towards -x, `t` seconds, `roll` wheel angle (radians).
 */
export const ToyCar: React.FC<{ exhaust?: number; t?: number; roll?: number }> = ({ exhaust = 0, t = 0, roll = 0 }) => {
  const body = useRounded(2.1, 0.62, 1.2, 0.26, 4);
  const cabin = useRounded(1.15, 0.56, 1.04, 0.16, 4);
  const winSide = useRounded(0.36, 0.3, 0.04, 0.08, 2);
  const winFront = useRounded(0.04, 0.3, 0.72, 0.08, 2);
  const bumper = useRounded(0.14, 0.18, 1.1, 0.07, 2);
  const geos = useMemo(
    () => ({
      wheel: new THREE.CylinderGeometry(0.28, 0.28, 0.24, 28),
      hub: new THREE.CylinderGeometry(0.13, 0.13, 0.25, 20),
      nut: new THREE.CylinderGeometry(0.05, 0.05, 0.26, 10),
      light: new THREE.SphereGeometry(0.11, 20, 14),
      tail: new THREE.SphereGeometry(0.07, 16, 10),
      pipe: new THREE.CylinderGeometry(0.055, 0.055, 0.26, 12),
      arch: new THREE.CylinderGeometry(0.34, 0.34, 1.24, 28, 1, false, -Math.PI / 2, Math.PI),
    }),
    [],
  );
  const coral = toy("#FF5A5F", { rough: 0.3, glow: 0.16 });
  const cream = toy("#FFF3DC", { rough: 0.35, glow: 0.14 });
  const glass = toy("#6CCBFF", { rough: 0.15, glow: 0.3 });
  const dark = toy("#262A33", { rough: 0.55 });
  const chrome = toy("#D9E1EA", { metal: 0.7, rough: 0.25, glow: 0.12 });
  const k = clamp01(exhaust);
  const bounce = k * 0.015 * Math.sin(t * 30);
  return (
    <group>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <group key={`${sx}${sz}`} position={[sx * 0.66, 0.28, sz * 0.5]} rotation={[Math.PI / 2, 0, 0]}>
            <group rotation={[0, -roll, 0]}>
              <mesh geometry={geos.wheel} material={dark} castShadow />
              <mesh geometry={geos.hub} material={toy("#FFFFFF", { rough: 0.35 })} />
              <mesh geometry={geos.nut} material={toy("#FFC21A", { rough: 0.35 })} position={[0.07, 0, 0]} />
            </group>
          </group>
        )),
      )}
      <group position={[0, bounce, 0]}>
        <mesh geometry={body} material={coral} position={[0, 0.62, 0]} castShadow />
        <mesh geometry={cabin} material={cream} position={[-0.12, 1.12, 0]} castShadow />
        {[-1, 1].flatMap((s) =>
          [-0.36, 0.1].map((x) => <mesh key={`${s}${x}`} geometry={winSide} material={glass} position={[x, 1.15, s * 0.515]} />),
        )}
        <mesh geometry={winFront} material={glass} position={[0.45, 1.15, 0]} />
        <mesh geometry={winFront} material={glass} position={[-0.69, 1.15, 0]} />
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh geometry={geos.light} material={toy("#FFF3A0", { rough: 0.2, glow: 0.6 })} position={[1.02, 0.7, s * 0.36]} scale={[0.6, 1, 1]} />
            <mesh geometry={geos.tail} material={toy("#FF2020", { rough: 0.2, glow: 0.5 })} position={[-1.04, 0.72, s * 0.4]} scale={[0.6, 1, 1]} />
          </group>
        ))}
        <mesh geometry={bumper} material={chrome} position={[1.07, 0.44, 0]} />
        <mesh geometry={bumper} material={chrome} position={[-1.07, 0.44, 0]} />
        <group position={[-1.12, 0.36, -0.32]}>
          <mesh geometry={geos.pipe} material={chrome} rotation={[0, 0, Math.PI / 2]} />
          <group position={[-0.12, 0, 0]} rotation={[0, 0, Math.PI / 2 - 0.15]}>
            <Smoke t={t} amount={k} height={1.6} r0={0.1} r1={0.34} count={8} speed={1.2} wobble={0.06} drift={0.05} color="#D9D6D3" opacity={1} seed={4} />
          </group>
        </group>
      </group>
    </group>
  );
};

const ROCKET_BODY: [number, number][] = [
  [0.3, 0],
  [0.38, 0.12],
  [0.45, 0.5],
  [0.48, 0.95],
  [0.47, 1.35],
  [0.44, 1.6],
];
const ROCKET_NOSE: [number, number][] = [
  [0.44, 1.6],
  [0.42, 1.78],
  [0.35, 2.05],
  [0.24, 2.3],
  [0.1, 2.5],
  [0.0, 2.56],
];

/**
 * Classic cartoon rocket standing on its nozzle (bottom of the nozzle at y = -0.12, nose tip at
 * y = 2.56; 0.96 wide, 1.9 across the fins): white body with a red nose, red band and three red
 * fins, two round windows facing +z. `flame` 0..1 lights the engine (big flame down to
 * y ≈ -1.9) and leaves a smoke trail below it; `t` seconds. Stand it on a pad at y = 0.12 or
 * move it up to lift off.
 */
export const Rocket: React.FC<{ flame?: number; t?: number }> = ({ flame = 0, t = 0 }) => {
  const geos = useMemo(() => {
    const lathe = (p: [number, number][]) =>
      new THREE.LatheGeometry(
        p.map(([r, h]) => new THREE.Vector2(r, h)),
        40,
      );
    const fin = new THREE.Shape();
    fin.moveTo(0, 0.95);
    fin.quadraticCurveTo(0.35, 0.55, 0.52, 0.1);
    fin.lineTo(0.55, -0.2);
    fin.quadraticCurveTo(0.35, -0.05, 0, 0.05);
    fin.closePath();
    const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.07, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 12 });
    finGeo.translate(0.36, 0, -0.035);
    return {
      body: lathe(ROCKET_BODY),
      nose: lathe(ROCKET_NOSE),
      band: new THREE.CylinderGeometry(0.485, 0.49, 0.14, 40),
      nozzle: new THREE.CylinderGeometry(0.22, 0.3, 0.2, 28, 1, true),
      nozzleIn: new THREE.CircleGeometry(0.22, 28),
      fin: finGeo,
      tip: new THREE.SphereGeometry(0.06, 16, 10),
    };
  }, []);
  const white = toy("#F6F8FB", { rough: 0.35, glow: 0.14, side: THREE.DoubleSide });
  const red = toy("#FF3B3B", { rough: 0.35, glow: 0.16, side: THREE.DoubleSide });
  const k = clamp01(flame);
  const shake = k * 0.012 * Math.sin(t * 47);
  return (
    <group>
      <group position={[shake, 0, 0]}>
        <mesh geometry={geos.body} material={white} castShadow />
        <mesh geometry={geos.nose} material={red} castShadow />
        <mesh geometry={geos.tip} material={toy("#FFC21A", { rough: 0.3 })} position={[0, 2.55, 0]} />
        <mesh geometry={geos.band} material={red} position={[0, 0.34, 0]} />
        <mesh geometry={geos.nozzle} material={toy("#5A606C", { rough: 0.4, metal: 0.4, side: THREE.DoubleSide })} position={[0, -0.02, 0]} />
        <mesh geometry={geos.nozzleIn} material={toy("#2B2F38")} position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} />
        {[Math.PI, Math.PI / 3, -Math.PI / 3].map((a) => (
          <group key={a} rotation={[0, a - Math.PI / 2, 0]}>
            <mesh geometry={geos.fin} material={red} castShadow />
          </group>
        ))}
        <Porthole r={0.2} position={[0, 1.22, 0.47]} rotation={[-0.03, 0, 0]} />
        <Porthole r={0.12} position={[0, 0.78, 0.48]} rotation={[0.02, 0, 0]} />
      </group>
      <group position={[0, -0.1, 0]} rotation={[0, 0, Math.PI]}>
        <Flame height={1.8} width={0.75} amount={k} t={t} seed={4} palette={JET} halo={1.2} />
        <group position={[0, 1.2, -0.3]}>
          <Smoke t={t} amount={k} height={3.2} r0={0.3} r1={0.8} count={12} speed={3} wobble={0.25} drift={0} color="#EDEAE6" opacity={0.9} seed={2} />
        </group>
      </group>
    </group>
  );
};

// =======================================================================================
// Oxygen tank

const tankLabel = () =>
  canvasTexture("oxi-tank-label", 512, 512, (ctx, W, H) => {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0B6F6A";
    ctx.fillRect(0, 0, W, 26);
    ctx.fillRect(0, H - 26, W, 26);
    drawO2(ctx, W / 2 + 4, H / 2 + 4, 310, "rgba(0,0,0,0.15)");
    drawO2(ctx, W / 2, H / 2, 310, "#0B6F6A");
  });

/**
 * Oxygen cylinder ("bombona"): chunky teal cylinder 0.66 across with a rounded shoulder, a dark
 * foot ring, a chrome valve with a red handwheel and a pressure gauge on top (1.8 tall ≈ 0.9 of
 * Nubi's height at size 2) and a white "O₂" label facing +z (`label`, default true).
 * Placement: see TANK_BESIDE, TANK_HUG (side hug) and TANK_FRONT.
 */
export const OxygenTank: React.FC<{ label?: boolean }> = ({ label = true }) => {
  const ready = useFontsReady();
  const geos = useMemo(() => {
    const prof: [number, number][] = [
      [0, 0.05],
      [0.3, 0.05],
      [0.33, 0.12],
      [0.33, 1.25],
      [0.31, 1.38],
      [0.25, 1.48],
      [0.15, 1.54],
      [0.1, 1.555],
      [0, 1.56],
    ];
    return {
      body: new THREE.LatheGeometry(
        prof.map(([r, h]) => new THREE.Vector2(r, h)),
        40,
      ),
      foot: new THREE.CylinderGeometry(0.31, 0.33, 0.1, 40),
      label: new THREE.CylinderGeometry(0.338, 0.338, 0.62, 40, 1, true, -1.15, 2.3),
      neck: new THREE.CylinderGeometry(0.09, 0.11, 0.1, 20),
      valve: new THREE.CylinderGeometry(0.1, 0.1, 0.18, 20),
      stem: new THREE.CylinderGeometry(0.03, 0.03, 0.08, 10),
      wheel: new THREE.TorusGeometry(0.13, 0.035, 10, 28),
      spoke: new THREE.BoxGeometry(0.24, 0.03, 0.03),
      gauge: new THREE.CylinderGeometry(0.1, 0.1, 0.06, 24),
      gaugeFace: new THREE.CircleGeometry(0.082, 24),
      needle: new THREE.BoxGeometry(0.012, 0.07, 0.01),
      outlet: new THREE.CylinderGeometry(0.035, 0.035, 0.1, 10),
    };
  }, []);
  const teal = toy("#1BBFB5", { rough: 0.3, glow: 0.16 });
  const chrome = toy("#D9E1EA", { metal: 0.75, rough: 0.22, glow: 0.12 });
  return (
    <group>
      <mesh geometry={geos.body} material={teal} castShadow />
      <mesh geometry={geos.foot} material={toy("#2B2F38", { rough: 0.5 })} position={[0, 0.05, 0]} />
      {label ? (
        <mesh geometry={geos.label} material={ready ? texMat(tankLabel(), 0.45, 0.2) : toy("#FFFFFF")} position={[0, 0.78, 0]} />
      ) : null}
      <mesh geometry={geos.neck} material={chrome} position={[0, 1.6, 0]} />
      <mesh geometry={geos.valve} material={chrome} position={[0, 1.72, 0]} />
      <mesh geometry={geos.stem} material={chrome} position={[0, 1.84, 0]} />
      <group position={[0, 1.88, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={geos.wheel} material={toy("#E8383D", { rough: 0.4 })} />
        <mesh geometry={geos.spoke} material={toy("#E8383D", { rough: 0.4 })} />
        <mesh geometry={geos.spoke} material={toy("#E8383D", { rough: 0.4 })} rotation={[0, 0, Math.PI / 2]} />
      </group>
      <mesh geometry={geos.outlet} material={chrome} position={[-0.13, 1.7, 0]} rotation={[0, 0, Math.PI / 2]} />
      <group position={[0.02, 1.72, 0.13]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={geos.gauge} material={chrome} />
        <mesh geometry={geos.gaugeFace} material={toy("#FFFFFF", { glow: 0.3 })} position={[0, -0.031, 0]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={geos.needle} material={toy("#E8383D")} position={[0.012, -0.034, -0.02]} rotation={[Math.PI / 2, 0, -0.6]} />
      </group>
    </group>
  );
};

/** Tank standing beside Nubi (Nubi-local, size 2, same ground): to the screen-right, a bit forward. */
export const TANK_BESIDE = { position: [1.45, 0, 0.2] as V3 };

/**
 * Tank held in front of Nubi (Nubi-local, Nubi at size 2; for size s scale by s / 2): standing
 * against the front face, centred between the eyes; its 0.66 width fits the gap between the eye
 * bars, so both eyes stay visible beside it with a frontal camera (keep the camera within ~15°
 * of Nubi's front, or the tank drifts over an eye). Fins stay at the sides, drooping a little.
 */
export const TANK_FRONT = {
  position: [0, 0, 1.05] as V3,
  pose: { finL: -0.25, finR: -0.25, squash: 0.96 },
};

/**
 * Nubi hugging the tank (Nubi at size 2; for size s scale positions by s / 2). Nubi's fins only
 * swing up and down in the body's side plane (they cannot fold forward), so the hug that reads
 * is a side hug: the tank stands snug against Nubi's right side just behind the right fin, and
 * the pair is turned by `yaw` so that side faces the camera: the fin then lies across the
 * tank's front like an arm, Nubi leans onto it (roll) and both eyes stay fully visible.
 *   <group rotation={[0, TANK_HUG.yaw, 0]}>
 *     <Nubi size={2} pose={TANK_HUG.pose} />
 *     <group position={TANK_HUG.position} rotation={TANK_HUG.rotation}><OxygenTank /></group>
 *   </group>
 * `rotation` turns the "O₂" label back towards the camera. For the left side mirror x, yaw,
 * the tank's rotation and roll, and swap finR/finL.
 */
export const TANK_HUG = {
  yaw: -0.5,
  position: [1.44, 0, -0.56] as V3,
  rotation: [0, 0.55, 0] as V3,
  pose: { roll: -0.06, finR: 0.05, finL: 0.4, squash: 0.97 },
};

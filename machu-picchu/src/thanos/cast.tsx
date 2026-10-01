import React from "react";
import * as THREE from "three";
import { Upright } from "../inca/outfit";
import { Vec3 } from "../three/CameraRig";
import { Nubi, NubiPose } from "../three/Nubi";
import {
  CAST,
  CapOutfit,
  DoomArmor,
  FalconOutfit,
  GrootLook,
  IronOutfit,
  PantherSuit,
  SpiderSuit,
  StarLordOutfit,
  StrangeOutfit,
  ThanosArmor,
  ThorOutfit,
  WitchOutfit,
  nubiFinTip,
} from "../three/thanos/Costumes";
import { HAMMER_HOLD, InfinityGauntlet, Mjolnir, ROCK_HOLD, Rock, SHIELD_HOLD_L, StarShield, gauntletHold } from "../three/thanos/Props";

// The cast of the Thanos short: Nubi in its costumes, the heroes and the villains (all of them
// Nubi-shaped toys in other colours), the props they hold, and helpers to find where a fin tip
// (and what it holds) is in the world.

export type Look = "plain" | "thor" | "cap" | "iron" | "strange";
export type HeroKind = "spider" | "panther" | "witch" | "groot" | "starlord" | "falcon";
export type GauntletState = { stones?: number; power?: number; broken?: number; snap?: number; relax?: number; dead?: number; t?: number };

/** Thanos looms over the size-2 heroes. */
export const THANOS_SIZE = 4;

type Placed = { at: Vec3; rotationY?: number; size?: number; pose?: NubiPose; t?: number; holdR?: React.ReactNode; holdL?: React.ReactNode };

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * World position of something at `local` (model units, upright fin-tip space: the character's own
 * axes) from the tip of a fin raised by `raise` (side 1 = finR, -1 = finL).
 */
export const finTipWorld = (at: Vec3, rotY: number, size: number, raise: number, side: 1 | -1 = 1, local: Vec3 = [0, 0, 0]): Vec3 => {
  const tip = nubiFinTip(raise, side);
  const v = new THREE.Vector3(tip[0] + local[0] * side, tip[1] + local[1], tip[2] + local[2]).multiplyScalar(size / 10).applyAxisAngle(Y_AXIS, rotY);
  return [v.x + at[0], v.y + at[1], v.z + at[2]];
};

/** Thanos's gauntlet is drawn at this fraction of GAUNTLET_HOLD (a hand about Nubi's size). */
export const THANOS_GAUNTLET_SCALE = 0.72;

/** Centre of the gauntlet worn on the right fin (GAUNTLET_HOLD at `k`: the hand stands ≈ 2.4·k above the tip). */
export const gauntletWorld = (at: Vec3, rotY: number, size: number, raise: number, k = THANOS_GAUNTLET_SCALE): Vec3 =>
  finTipWorld(at, rotY, size, raise, 1, [1.0 * k, 0.7 * k + 2.4 * k, 0.6 * k]);

/** Things held at a fin tip, kept upright whatever the fin raise. */
export const Held = {
  hammer: ({ raise, crackle = 0, t = 0, spin = 0 }: { raise: number; crackle?: number; t?: number; spin?: number }) => (
    <Upright raise={raise}>
      <group rotation={[0, 0, spin]}>
        <group {...HAMMER_HOLD}>
          <Mjolnir crackle={crackle} t={t} strapSwing={Math.sin(t * 5) * 0.4} />
        </group>
      </group>
    </Upright>
  ),
  shieldL: ({ raise }: { raise: number }) => (
    <Upright raise={raise} side="L">
      <group {...SHIELD_HOLD_L}>
        <StarShield />
      </group>
    </Upright>
  ),
  rock: ({ raise }: { raise: number }) => (
    <Upright raise={raise}>
      <group {...ROCK_HOLD}>
        <Rock />
      </group>
    </Upright>
  ),
  gauntlet: ({ raise, state, k = 1 }: { raise: number; state: GauntletState; k?: number }) => {
    const h = gauntletHold(raise);
    const s = typeof h.scale === "number" ? h.scale * k : h.scale;
    return (
      <group position={h.position.map((v) => v * k) as Vec3} rotation={h.rotation} scale={s}>
        <InfinityGauntlet {...state} />
      </group>
    );
  },
};

/** Nubi (mint green) in one of its costumes. */
export const NubiAs: React.FC<Placed & { look: Look; wind?: number; charge?: number }> = ({ at, look, size = 2, pose = {}, rotationY = 0, t = 0, wind = 0.35, charge = 0, holdR, holdL }) => (
  <group position={at} rotation={[0, rotationY, 0]}>
    <Nubi size={size} pose={pose} hideEyes={look === "iron"} holdR={holdR} holdL={holdL} shadowOpacity={0.4}>
      {look === "thor" ? <ThorOutfit t={t} wind={wind} /> : null}
      {look === "cap" ? <CapOutfit /> : null}
      {look === "iron" ? <IronOutfit charge={charge} pose={pose} /> : null}
      {look === "strange" ? <StrangeOutfit t={t} wind={wind} glow={0.4 + charge * 0.6} /> : null}
    </Nubi>
  </group>
);

/** One of the heroes who no longer vanish (Nubis of other colours in their suits). */
export const Hero: React.FC<Placed & { kind: HeroKind; power?: number }> = ({ at, kind, size = 2, pose = {}, rotationY = 0, t = 0, power = 0, holdR, holdL }) => {
  const suit: Record<HeroKind, React.ReactNode> = {
    spider: <SpiderSuit pose={pose} />,
    panther: <PantherSuit pose={pose} />,
    witch: <WitchOutfit t={t} wind={0.35} hex={power} finL={pose.finL} finR={pose.finR} />,
    groot: <GrootLook t={t} />,
    starlord: <StarLordOutfit pose={pose} />,
    falcon: <FalconOutfit open={0.1 + power * 0.9} flap={power * Math.sin(t * 14)} />,
  };
  const masked = kind === "spider" || kind === "panther" || kind === "starlord";
  return (
    <group position={at} rotation={[0, rotationY, 0]}>
      <Nubi size={kind === "groot" ? size * 1.15 : size} pose={pose} palette={CAST[kind]} hideEyes={masked} holdR={holdR} holdL={holdL} shadowOpacity={0.4}>
        {suit[kind]}
      </Nubi>
    </group>
  );
};

/** Thanos: a big purple Nubi in gold armour, the gauntlet on his right fin. */
export const Thanos: React.FC<Placed & { gauntlet?: GauntletState; brow?: number }> = ({ at, size = THANOS_SIZE, pose = {}, rotationY = 0, gauntlet, brow = 0.6, holdL }) => (
  <group position={at} rotation={[0, rotationY, 0]}>
    <Nubi
      size={size}
      pose={pose}
      palette={CAST.thanos}
      holdR={gauntlet ? Held.gauntlet({ raise: pose.finR ?? 0, state: gauntlet, k: THANOS_GAUNTLET_SCALE }) : undefined}
      holdL={holdL}
      shadowOpacity={0.45}
    >
      <ThanosArmor brow={brow} />
    </Nubi>
  </group>
);

/** The masked villain of the post-credits scene. */
export const Doom: React.FC<Placed & { eyeGlow?: number }> = ({ at, size = 2.6, pose = {}, rotationY = 0, t = 0, eyeGlow = 0, holdR }) => (
  <group position={at} rotation={[0, rotationY, 0]}>
    <Nubi size={size} pose={pose} palette={CAST.doom} hideEyes holdR={holdR} shadowOpacity={0.5}>
      <DoomArmor t={t} wind={0.15} eyeGlow={eyeGlow} pose={pose} />
    </Nubi>
  </group>
);

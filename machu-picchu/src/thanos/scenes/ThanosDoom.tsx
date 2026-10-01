import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, ramp } from "../../anim";
import { Stage } from "../../scenes/common";
import { speech } from "../../talk";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { GAUNTLET_LYING, InfinityGauntlet } from "../../three/thanos/Props";
import { ALTAR_TOP, CASTLE_SKY, CastleLights, DoomCastle } from "../../three/thanos/Sets";
import { aim } from "../camera";
import { Doom, Held, finTipWorld } from "../cast";
import { DOOM } from "../beats";
import { SPEAKER, THANOS } from "../timeline";

// Post-credits. A dark castle: a metal hand picks the dead gauntlet up from a stone altar. A
// figure in a green hooded cloak, its back to us: "Thanos quería controlar el universo… Yo pienso
// mejorarlo." It turns a little, its eyes light up green and the gauntlet switches back on.
// Off screen, Nubi: "Eh… creo que ahora sí tenemos un problema."

const DOOM_SIZE = 2.5;
/** In front of the altar, a little to the right, facing it (its back to the camera). */
const DOOM_AT: Vec3 = [1.35, 0, ALTAR_TOP[2] + 0.9];
const DOOM_ROT = Math.PI;

export const ThanosDoom: React.FC = () => {
  const frame = useCurrentFrame();
  const S = THANOS.SCENES.doom;
  const g = frame + S.from;
  const t = g / 30;
  const { GRAB, TURN, GLOW, LIGHT, BLACK } = DOOM;
  const closeUp = g < GRAB + 22;

  // The metal fin reaches over the altar; the gauntlet is snatched up; later it is raised.
  const reach = ramp(g, S.from, GRAB, [0, 1], EASE_IN_OUT);
  const held = g >= GRAB;
  const lift = ramp(g, GRAB, GRAB + 14, [0, 1], EASE_OUT);
  const turn = ramp(g, TURN, TURN + 18, [0, 1], EASE_IN_OUT);
  const eyes = ramp(g, GLOW, GLOW + 10, [0, 1], EASE_OUT);
  const lit = ramp(g, LIGHT, LIGHT + 14, [0, 1], EASE_OUT);
  const { lvl, acc } = speech(SPEAKER.doom, g, 0.6);
  const finR = held ? 0.25 + lift * 0.45 + lit * 0.45 : reach * 0.25;
  const pose = {
    finR,
    finL: -0.1,
    squash: 1 - 0.03 * lvl + 0.04 * acc,
    hop: acc * 0.25,
    yaw: -turn * 0.9,
    eyeScale: 0.9,
    lookX: turn * 0.4,
  };
  const state = { stones: lit, power: lit * 0.85, dead: 1 - lit, broken: 1, relax: held ? 0.4 * (1 - lit) : 1, t };
  const holdR = held ? Held.gauntlet({ raise: finR, state, k: 0.85 }) : null;

  // Cameras: close on the altar for the grab; behind the figure; a slow push on the turn.
  // (A from the altar's left so the figure stays at the edge; B well back; C from its right side,
  // where its half turn shows the mask.)
  const camA = aim([ALTAR_TOP[0] - 3.4, ALTAR_TOP[1] + 2.2, ALTAR_TOP[2] + 5.0], 42, [ALTAR_TOP[0] + 0.2, ALTAR_TOP[1], ALTAR_TOP[2]], 470, 1000);
  const camB = aim([DOOM_AT[0] + 1.2, 2.3, DOOM_AT[2] + 11.5], 46, [DOOM_AT[0], 0, DOOM_AT[2]], 560, 1290);
  const push = ramp(g, TURN - 10, BLACK, [0, 1], EASE_IN_OUT);
  const head: Vec3 = [DOOM_AT[0], 2.0, DOOM_AT[2]];
  const camC = aim(lerp3([DOOM_AT[0] + 7.0, 2.5, DOOM_AT[2] + 2.6], [DOOM_AT[0] + 4.4, 2.4, DOOM_AT[2] + 1.0], push), 44, head, 540, 760);
  const cam = closeUp ? camA : g < TURN - 10 ? camB : camC;
  const fade = ramp(g, BLACK - 4, BLACK + 4);
  const tip = finTipWorld(DOOM_AT, DOOM_ROT, DOOM_SIZE, finR);

  return (
    <AbsoluteFill style={{ background: CASTLE_SKY }}>
      <Stage cam={cam} near={0.05}>
        <CastleLights />
        <DoomCastle t={t} />
        {!held ? (
          <group position={ALTAR_TOP}>
            <group {...GAUNTLET_LYING}>
              <InfinityGauntlet {...state} />
            </group>
          </group>
        ) : null}
        <Doom at={DOOM_AT} rotationY={DOOM_ROT} size={DOOM_SIZE} pose={pose} eyeGlow={eyes} t={t} holdR={holdR} />
        <pointLight position={[tip[0], tip[1] + 1, tip[2] + 1]} color="#5CFF8A" intensity={lit * 25} distance={9} />
      </Stage>
      <AbsoluteFill style={{ background: "#000", opacity: fade }} />
    </AbsoluteFill>
  );
};

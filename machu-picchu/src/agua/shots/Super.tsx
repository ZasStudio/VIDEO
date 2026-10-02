import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, clamp01, pop, ramp, windowIn } from "../../anim";
import { SweatDrops } from "../../inca/effects";
import { Shake, Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import { JewelryCase, SUPER_BG, SUPER_CASE, SuperLights, Supermarket } from "../../three/agua/Shops";
import { PROBLEMA } from "../beats";
import { SHOTS } from "../shots";
import { aguaTalk } from "../talk";

// "…y conseguir comida sería cada vez más difícil. ¡Ahora la papa viene con seguridad!"
// A: Nubi trudges down the empty aisle under flickering tubes (AGOTADO everywhere, a tumbleweed
//    rolls by), slumping on "difícil". B: over its shoulder, the spotlit case at the end of the
//    aisle; Nubi perks up. C: Nubi's view through the red lasers: the potato on its cushion.
// D: Nubi beside the case, to the camera, thrilled; the lasers blink on "seguridad".

const FPS = 30;
const CASE = SUPER_CASE;
/** Height of the potato in the case (its middle), world units. */
const JEWEL_POTATO_Y = 1.3;
const walkPose = (g: number, speed: number): NubiPose => {
  const ph = g * 0.42;
  return {
    hop: Math.abs(Math.sin(ph)) * 0.55 * speed,
    squash: 1 + 0.05 * Math.sin(ph * 2 + 0.6) * speed,
    roll: Math.sin(ph) * 0.05 * speed,
    wiggle: 0.85 * speed,
    wigglePhase: g * 0.55,
  };
};

export const SuperShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.super.from;
  const { DIFICIL, PAPA, SEGURIDAD, END } = PROBLEMA;
  const START = SHOTS.super.from;
  const A1 = DIFICIL + 24;
  const B1 = PAPA - 3;
  const C1 = SEGURIDAD - 4;
  const t = g / FPS;
  const flicker = 0.85;

  let cam: { position: Vec3; target: Vec3; fov: number };
  let nubiAt: Vec3;
  let nubiYaw: number;
  let pose: NubiPose;
  let lasers = 1;
  let tumble: number | undefined;
  let shakeAt = -100;

  if (g < A1) {
    // A: walking towards the camera down the aisle (towards the back of the shop, −z).
    const u = ramp(g, START, A1, [0, 1], (x) => x);
    const z = 3 - 7.2 * u + 0.6 * Math.max(0, u - 0.75);
    const slump = windowIn(g, DIFICIL - 2, A1 + 10, 6);
    const speed = 1 - 0.55 * slump;
    nubiAt = [0.05 * Math.sin(g * 0.05), 0, z];
    const look = Math.sin((g - START) * 0.085);
    nubiYaw = Math.PI + look * 0.35 * (1 - slump);
    const w = walkPose(g, speed);
    pose = aguaTalk(g, {
      ...w,
      lookX: look * 0.9 * (1 - slump),
      lookY: -0.2 * slump,
      eyeScale: 1 - 0.22 * slump,
      pitch: 0.16 * slump,
      squash: (w.squash ?? 1) * (1 - 0.08 * slump),
      finL: -0.35 * slump,
      finR: -0.35 * slump,
      blink: slump > 0.5 ? 0.35 : 0,
    });
    tumble = ramp(g, START + 22, START + 62, [0, 1], (x) => x);
    const camPos: Vec3 = [0.35, 2.05, z - 9.6];
    cam = aim(camPos, 40, [nubiAt[0], 0, z], 540, 1190);
  } else if (g < B1) {
    // B: over the shoulder: the case glowing at the end of the aisle; Nubi perks up and hops on.
    const u = ramp(g, A1, B1, [0, 1], EASE_IN_OUT);
    const z = CASE[2] + 3.4 - 0.8 * u;
    nubiAt = [-0.9, 0, z];
    nubiYaw = Math.PI + 0.08;
    const perk = pop(g, A1 + 4);
    pose = aguaTalk(g, {
      ...walkPose(g, 0.6 * u),
      hop: perk * 0.4 * Math.max(0, 1 - (g - A1 - 4) / 14) + walkPose(g, 0.6 * u).hop!,
      finL: 0.5 * perk,
      finR: 0.5 * perk,
      squash: 1 + 0.06 * Math.sin(g * 0.5),
    });
    const p0: Vec3 = [1.4, 1.95, CASE[2] + 10.2];
    const p1: Vec3 = [1.2, 1.85, CASE[2] + 8.9];
    cam = aim(lerp3(p0, p1, u), 40, [CASE[0], 1.25, CASE[2]], 650, 880);
  } else if (g < C1) {
    // C: Nubi's view through the lasers and the glass: the potato.
    const u = ramp(g, B1, C1, [0, 1], (x) => x);
    nubiAt = [0, 0, CASE[2] + 3.4];
    nubiYaw = Math.PI;
    pose = {};
    const p0: Vec3 = [0.16, 1.32, CASE[2] + 2.2];
    const p1: Vec3 = [0.1, 1.3, CASE[2] + 1.65];
    cam = aim(lerp3(p0, p1, u), 36, [CASE[0], JEWEL_POTATO_Y, CASE[2]], 540, 800);
  } else {
    // D: beside the case, to the camera: "¡…viene con seguridad!" The lasers blink.
    const k = g - C1;
    nubiAt = [-1.25, 0, CASE[2] + 2.0];
    const turn = ramp(g, C1 + 2, C1 + 10, [0, 1], EASE_IN_OUT);
    nubiYaw = 0.75 * (1 - turn) + 0.22 * turn;
    const jump = pop(g, SEGURIDAD + 2, { damping: 9 });
    const hopK = Math.max(0, Math.sin(clamp01((g - SEGURIDAD - 2) / 16) * Math.PI));
    pose = aguaTalk(g, {
      hop: hopK * 2.2,
      squash: 1 + 0.12 * hopK - 0.1 * windowIn(g, SEGURIDAD - 1, SEGURIDAD + 3, 1),
      eyeScale: 1.15 + 0.2 * jump,
      finL: 0.35 + 0.65 * jump + 0.15 * Math.sin(g * 0.9) * jump,
      finR: 0.2 + 0.85 * jump + 0.15 * Math.sin(g * 0.9 + 1) * jump,
      lookX: 0.6 * (1 - turn) + 0.2 * Math.sin(k * 0.3) * jump,
      lookY: 0.15,
      wiggle: 0.6 * jump,
      wigglePhase: g * 0.8,
    });
    // Blink: on/off every 3 frames for a moment, then steady.
    const b = g - SEGURIDAD;
    lasers = b >= 0 && b < 21 ? (Math.floor(b / 3) % 2 === 0 ? 1 : 0.1) : 1;
    shakeAt = SEGURIDAD;
    const z0 = CASE[2] + 12.6;
    const camPos = lerp3([0.5, 2.0, z0], [0.4, 1.9, z0 - 1.2], ramp(g, C1, END, [0, 1], (x) => x));
    cam = aim(camPos, 40, [-0.6, 0, CASE[2] + 1.3], 540, 1215);
  }

  // A red alarm wash while the lasers blink.
  const alarm = g >= C1 ? windowIn(g, SEGURIDAD, SEGURIDAD + 22, 2) * (lasers > 0.5 ? 1 : 0.35) : 0;
  const showSweat = g < A1;

  return (
    <AbsoluteFill style={{ background: SUPER_BG }}>
      <Shake frame={g} impacts={[{ at: shakeAt, amp: 14, dur: 12 }]}>
        <Stage cam={cam} near={0.05}>
          <SuperLights t={t} flicker={flicker} />
          <Supermarket t={t} flicker={flicker} tumble={tumble} showCase={false} />
          <group position={CASE}>
            <JewelryCase lasers={lasers} t={t} />
          </group>
          {g < B1 || g >= C1 ? (
            <Nubi size={2} position={nubiAt} rotationY={nubiYaw} pose={pose} shadowOpacity={0.4} />
          ) : null}
          {showSweat ? <SweatDrops frame={g} from={DIFICIL + 2} to={DIFICIL + 22} position={[nubiAt[0], 1.85, nubiAt[2] - 0.3]} spread={0.75} /> : null}
        </Stage>
      </Shake>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 50%, rgba(255,40,60,0) 35%, rgba(255,20,50,0.55) 100%)", opacity: alarm }} />
    </AbsoluteFill>
  );
};

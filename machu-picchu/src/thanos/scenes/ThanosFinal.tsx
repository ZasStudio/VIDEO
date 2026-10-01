import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, ramp, windowIn } from "../../anim";
import { Confetti } from "../../overlay/Graphics";
import { PizzaApp } from "../../overlay/thanos/ThanosUI";
import { Stage } from "../../scenes/common";
import { Vec3, lerp3, projectToScreen } from "../../three/CameraRig";
import { Twinkles } from "../../three/Effects3D";
import { GAUNTLET_LYING, InfinityGauntlet } from "../../three/thanos/Props";
import { BATTLE_SKY, Battlefield } from "../../three/thanos/Sets";
import { aim } from "../camera";
import { Held, Hero, NubiAs, THANOS_SIZE, Thanos, gauntletWorld } from "../cast";
import { FINAL } from "../beats";
import { thanosTalk } from "../talk";
import { THANOS, THANOS_HEIGHT, THANOS_WIDTH } from "../timeline";
import { FieldLights } from "../world";
import { TEAM } from "./ThanosHeroes";

// "Al final, Thanos pierde… y yo me quedo con el guantelete." Thanos lies flat on his back under
// circling stars, the heroes celebrate; Nubi picks up the switched-off gauntlet and holds it up.
// "Espera… ¿esto sirve para pedir pizza?" — a hologram pizza app pops out of it.

/** Thanos on his back (lifted so the tipped-over body rests on the ground). */
const THANOS_DOWN: Vec3 = [2.6, 1.7, -6.5];
const GAUNTLET_ON_GROUND: Vec3 = [1.0, 0, 2.2];
const NUBI_FROM: Vec3 = [-2.4, 0, 2.6];
const NUBI_TO: Vec3 = [-0.4, 0, 2.4];
/** The gauntlet is drawn big on little Nubi (it's Thanos's size). */
const ON_NUBI = 1.3;

export const ThanosFinal: React.FC = () => {
  const frame = useCurrentFrame();
  const S = THANOS.SCENES.final;
  const g = frame + S.from;
  const t = g / 30;
  const { END, PIERDE, TAKE, GUANTELETE, ESPERA, APP } = FINAL;

  const walk = ramp(g, S.from + 6, TAKE - 8, [0, 1], EASE_IN_OUT);
  const walking = walk > 0 && walk < 1;
  const at = lerp3(NUBI_FROM, NUBI_TO, walk);
  const held = g >= TAKE;
  const proud = windowIn(g, GUANTELETE - 6, ESPERA - 4, 6);
  const curious = windowIn(g, ESPERA - 2, END + 20, 6);
  const finR = held ? 0.5 + proud * 0.9 + curious * 0.2 : ramp(g, TAKE - 10, TAKE, [0, -0.2]);
  const pose = thanosTalk(g, {
    hop: walking ? Math.abs(Math.sin(g * 0.4)) * 0.9 : proud * Math.abs(Math.sin((g - GUANTELETE) * 0.35)) * 1.0,
    wiggle: walking ? 1 : 0,
    wigglePhase: g * 0.8,
    finR,
    finL: curious * (0.6 + 0.25 * Math.sin(g * 0.6)),
    eyeScale: 1.1 + proud * 0.2 + curious * 0.25,
    lookX: curious * 0.65,
    lookY: curious * 0.35 + proud * 0.2,
    pitch: g >= TAKE - 10 && g < TAKE + 4 ? 0.25 : 0,
  });
  const state = { stones: curious * 0.3 * Math.abs(Math.sin(g * 0.5)), dead: 1, broken: 1, relax: held ? 0.2 : 1, t };
  const holdR = held ? Held.gauntlet({ raise: finR, state, k: ON_NUBI }) : null;

  const cam = aim([0.6, 1.7 - ramp(g, S.from, END, [0, 0.2]), 12 - ramp(g, S.from, END, [0, 1.6])], 48, NUBI_TO, 480, 1260);
  const G = gauntletWorld(at, 0, 2, finR, ON_NUBI);
  const gs = projectToScreen(cam, G, THANOS_WIDTH, THANOS_HEIGHT);

  return (
    <AbsoluteFill style={{ background: BATTLE_SKY }}>
      <Stage cam={cam} near={0.1}>
        <FieldLights />
        <Battlefield t={t} />
        {/* Thanos flat on his back, dazed, stars circling. */}
        <Thanos at={THANOS_DOWN} rotationY={-0.5} size={THANOS_SIZE} pose={{ pitch: -1.42, eyeScale: 0.5, blink: 0.5, finR: -0.4, finL: -0.4 }} brow={-0.8} t={t} />
        <Twinkles frame={g} at={S.from} position={[THANOS_DOWN[0], 3.2, THANOS_DOWN[2] + 2.5]} radius={1.6} count={10} color="#FFE27A" />
        {TEAM.map((h, i) => {
          const pos: Vec3 = [h.at[0] * 1.25, 0, h.at[2] - 2.5];
          const party = windowIn(g, S.from + i * 3, END + 20, 5);
          return (
            <Hero
              key={h.kind}
              kind={h.kind}
              at={[pos[0], Math.abs(Math.sin(g * 0.32 + i * 1.3)) * 1.1 * party, pos[2]]}
              rotationY={-pos[0] * 0.08}
              pose={{ finL: 1.0 + 0.3 * Math.sin(g * 0.5 + i), finR: 1.1 + 0.3 * Math.cos(g * 0.5 + i), eyeScale: 1.15, squash: 1 + 0.05 * Math.sin(g * 0.6 + i) }}
              power={h.kind === "witch" ? 0.6 : 0}
              t={t}
            />
          );
        })}
        {!held ? (
          <group position={GAUNTLET_ON_GROUND}>
            <group position={GAUNTLET_LYING.position.map((v) => v * 0.9) as Vec3} rotation={GAUNTLET_LYING.rotation} scale={1.45}>
              <InfinityGauntlet {...state} />
            </group>
          </group>
        ) : null}
        <NubiAs look="plain" at={at} rotationY={walking ? 0.9 : 0.1} pose={pose} t={t} holdR={holdR} />
      </Stage>
      <Confetti frame={g} at={PIERDE} count={110} />
      <PizzaApp frame={g} at={APP} out={END + 10} x={500} y={560} beamFrom={{ x: gs.x, y: gs.y - 40 }} />
    </AbsoluteFill>
  );
};

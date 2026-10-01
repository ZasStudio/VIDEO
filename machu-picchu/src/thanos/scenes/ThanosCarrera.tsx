import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, ramp, windowIn } from "../../anim";
import { ImpactText, SlowMoBars } from "../../overlay/thanos/ThanosUI";
import { Shake, Stage } from "../../scenes/common";
import { Vec3 } from "../../three/CameraRig";
import { DustPuff } from "../../three/Effects3D";
import { FrozenDebris } from "../../three/thanos/FX";
import { Rock } from "../../three/thanos/Props";
import { BATTLE_SKY, Battlefield, FIELD_NUBI, FIELD_TRIP_ROCK } from "../../three/thanos/Sets";
import { SweatDrops } from "../../inca/effects";
import { aim } from "../camera";
import { NubiAs, THANOS_SIZE, Thanos } from "../cast";
import { CARRERA } from "../beats";
import { thanosTalk } from "../talk";
import { THANOS } from "../timeline";
import { FieldLights, THANOS_AT } from "../world";

// "Thanos está por chasquear los dedos… y yo tengo que evitarlo. Fácil, ¿no?" — Nubi runs at
// Thanos in slow motion (first seen past the raised gauntlet, then head-on), trips over a rock
// and face-plants right in front of the lens: "No. No es fácil."

/** Over Thanos's shoulder, past the gauntlet, until here; then head-on. */
const CUT = 246;
/** Where Nubi's centre is when its front legs hit the rock. */
const TRIP_Z = FIELD_TRIP_ROCK[2] + 1.3;

export const ThanosCarrera: React.FC = () => {
  const frame = useCurrentFrame();
  const S = THANOS.SCENES.carrera;
  const g = frame + S.from;
  const t = g / 30;
  const { END, RUN, FACIL, TRIP, FALL, NO } = CARRERA;
  const slow = g < TRIP;

  // Slow-motion run: big lazy bounces, legs paddling, fins pumping.
  const run = ramp(g, RUN, TRIP, [0, 1], (x) => x);
  const z = FIELD_NUBI[2] - run * (FIELD_NUBI[2] - TRIP_Z);
  const phase = (g - RUN) * 0.16;
  const bounce = Math.abs(Math.sin(phase));
  // The trip: pitched forward over the rock, a short flight, then flat on its face.
  const tripK = ramp(g, TRIP, FALL, [0, 1], EASE_IN);
  const flat = g >= FALL;
  const fz = TRIP_Z - tripK * 1.8;
  const fy = !slow && !flat ? Math.sin(tripK * Math.PI) * 0.8 : 0;
  const lift = windowIn(g, NO + 26, NO + 64, 8);
  const confident = windowIn(g, FACIL - 4, TRIP, 4);
  const pose = slow
    ? thanosTalk(g, {
        hop: bounce * 2.6,
        squash: 1 + 0.12 * Math.cos(phase * 2),
        wiggle: 1,
        wigglePhase: phase * 2,
        finL: 0.4 + 0.5 * Math.sin(phase * 2),
        finR: 0.4 - 0.5 * Math.sin(phase * 2) + confident * 0.9,
        eyeScale: 1.1 + confident * 0.15,
        pitch: 0.12,
        lookX: confident * 0.5,
        lookY: confident * 0.2,
      })
    : thanosTalk(
        g,
        {
          pitch: (flat ? 1.45 : tripK * 1.45) - lift * 0.5,
          eyeScale: flat ? 1.0 - lift * 0.15 : 1.4,
          finL: flat ? -0.3 + lift * 0.6 : 1.2,
          finR: flat ? -0.3 : 1.2,
          squash: flat ? 1 - 0.25 * Math.exp(-(g - FALL) / 4) : 1,
          lookY: -0.3,
        },
        0.4,
      );
  const nubiAt: Vec3 = [FIELD_NUBI[0], slow ? 0 : fy, slow ? z : fz];

  // Cameras: past the raised gauntlet, then head-on in front of Nubi, then low by its face.
  // (B and C stand off to the side so they never end up inside Thanos.)
  const camA = aim([6.2, 2.2, -12.5], 46, [FIELD_NUBI[0], 0, z], 560, 1240);
  const camB = aim([FIELD_NUBI[0] + 6.5, 1.5, z - 6.5], 46, [FIELD_NUBI[0], 0, z], 520, 1250);
  const camC = aim([FIELD_NUBI[0] + 6.5, 1.6, fz - 2.5], 46, [FIELD_NUBI[0], 0, fz - 0.6], 540, 1150);
  const cam = g < CUT ? camA : g < FALL ? camB : camC;

  return (
    <AbsoluteFill style={{ background: BATTLE_SKY }}>
      <Shake frame={g} impacts={[{ at: FALL, amp: 22, dur: 12 }]}>
        <Stage cam={cam} near={0.1}>
          <FieldLights />
          <Battlefield t={t} frozen={1} />
          <group position={[-0.6, 0, -1]}>
            <FrozenDebris t={t} frozen={1} area={[18, 7, 16]} count={70} seed={3} />
          </group>
          <Thanos at={THANOS_AT} size={THANOS_SIZE} pose={{ finR: 1.35, eyeScale: 0.9 }} brow={0.9} gauntlet={{ stones: 1, power: 0.6, t }} t={t} />
          <group position={FIELD_TRIP_ROCK}>
            <Rock size={0.5} tint="#F0C9A0" seed={2} />
          </group>
          <NubiAs look="plain" at={nubiAt} rotationY={Math.PI} pose={pose} t={t} />
          <DustPuff frame={g} at={FALL} position={[FIELD_NUBI[0], 0, fz]} radius={1.6} />
          <SweatDrops frame={g} from={NO + 8} to={END} position={[FIELD_NUBI[0], 1.0, fz]} spread={0.7} />
        </Stage>
      </Shake>
      <SlowMoBars frame={g} from={RUN} to={TRIP} />
      <ImpactText frame={g} at={FALL} out={FALL + 24} text="¡PUM!" x={520} y={600} color="#FFD60A" rotate={-8} />
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, ramp, windowIn } from "../../anim";
import { Flash } from "../../overlay/Graphics";
import { ImpactText, StonesHUD } from "../../overlay/thanos/ThanosUI";
import { Shake, Stage } from "../../scenes/common";
import { Vec3 } from "../../three/CameraRig";
import { GroundCrack, StoneBlast } from "../../three/thanos/FX";
import { BATTLE_SKY, Battlefield } from "../../three/thanos/Sets";
import { SweatDrops } from "../../inca/effects";
import { aim } from "../camera";
import { Hero, NubiAs, THANOS_SIZE, Thanos, gauntletWorld } from "../cast";
import { PIEDRAS } from "../beats";
import { thanosTalk } from "../talk";
import { THANOS } from "../timeline";
import { FieldLights, THANOS_AT } from "../world";
import { NUBI_TEAM, TEAM } from "./ThanosHeroes";

// Thanos, furious, lights the stones one by one: "Pero cuidado: Thanos todavía tiene las
// piedras." He slams the gauntlet into the ground; cracks race out under the heroes. "Si no
// puede borrar a la mitad del universo… ¡intentará conquistar todo el universo!" The ground
// bursts and Nubi is launched — first person, tumbling through the sky.

/** The cracks open round here, under the team. */
const CRACK_AT: Vec3 = [NUBI_TEAM[0], 0, NUBI_TEAM[2] - 1.2];

export const ThanosPiedras: React.FC = () => {
  const frame = useCurrentFrame();
  const S = THANOS.SCENES.piedras;
  const g = frame + S.from;
  const t = g / 30;
  const { END, FURY, POWER, BLAST, BURST, LAUNCH, POV } = PIEDRAS;
  const pov = g >= POV;

  // Thanos raises the gauntlet, the stones light up, then the slam.
  const raise = ramp(g, FURY, POWER + 10, [0, 1], EASE_OUT);
  const slam = ramp(g, BLAST - 6, BLAST, [0, 1], EASE_IN);
  const reRaise = ramp(g, BLAST + 20, BLAST + 40, [0, 1.3], EASE_IN_OUT);
  const finR = 0.7 + raise * 0.9 - slam * 1.9 + reRaise;
  const stones = ramp(g, POWER, POWER + 36, [0, 1], (x) => x);
  const power = ramp(g, POWER + 10, BLAST, [0, 1], (x) => x) * (1 - 0.4 * ramp(g, BLAST, BLAST + 20)) + windowIn(g, BURST - 20, BURST + 10, 6) * 0.6;
  const thanosPose = {
    finR,
    eyeScale: 0.62,
    lookY: -0.15,
    squash: 1 - slam * 0.08 * (1 - ramp(g, BLAST, BLAST + 8)),
    pitch: slam * 0.12 * (1 - ramp(g, BLAST + 4, BLAST + 20)),
  };
  const G = gauntletWorld(THANOS_AT, 0, THANOS_SIZE, finR);

  // The cracks run out under the team; then the burst; Nubi is launched.
  const crack = ramp(g, BLAST + 2, BURST, [0, 1], EASE_OUT);
  const burst = ramp(g, BURST, BURST + 36, [0, 1], (x) => x);
  const launch = ramp(g, LAUNCH, POV + 2, [0, 1], EASE_OUT);
  const scared = windowIn(g, BLAST + 6, END + 20, 6);
  const nubiPose = thanosTalk(g, {
    eyeScale: 1.1 + scared * 0.35,
    finL: scared * 0.9 + launch * 0.4,
    finR: scared * 0.9 + launch * 0.4,
    hop: windowIn(g, BLAST + 2, BURST, 3) * Math.abs(Math.sin(g * 0.9)) * 0.5,
    roll: scared * Math.sin(g * 2.1) * 0.04 + launch * 3.2,
    pitch: launch * 1.5,
  });
  const nubiAt: Vec3 = [NUBI_TEAM[0] - launch * 2, launch * 9 + Math.sin(launch * Math.PI) * 3, NUBI_TEAM[2] + launch * 4];

  // Cameras: low on Thanos powering up; wide over the team as the cracks run; first person.
  // From above the heroes' heads, on Thanos's gauntlet side.
  const camA = aim([5.5, 5.4, 3.5], 44, [0.4, 3.2, -5], 540, 820);
  const wideU = ramp(g, BLAST, BURST, [0, 1], (x) => x);
  const camB = aim([4.6 - wideU * 1.2, 6.0 - wideU * 1.4, NUBI_TEAM[2] + 11.5 - wideU * 1.5], 50, CRACK_AT, 520, 1150);
  const tumble = ramp(g, POV, END, [0, 1], EASE_OUT);
  const povCam = {
    position: [NUBI_TEAM[0] - 2 - tumble * 2, 9 + tumble * 16, NUBI_TEAM[2] + 4 + tumble * 6] as Vec3,
    target: [Math.sin(g * 0.21) * 4, 0, -2 + Math.cos(g * 0.17) * 3] as Vec3,
    fov: 62,
    roll: (g - POV) * 0.11,
  };
  const cam = pov ? povCam : g < BLAST - 8 ? camA : camB;

  return (
    <AbsoluteFill style={{ background: BATTLE_SKY }}>
      <Shake frame={g} impacts={[{ at: BLAST, amp: 34, dur: 22 }, { at: BURST, amp: 40, dur: 26 }]}>
        <Stage cam={cam} near={0.1}>
          <FieldLights tint={power} tintAt={[G[0], G[1] + 1, G[2] + 2]} />
          <Battlefield t={t} />
          <Thanos at={THANOS_AT} size={THANOS_SIZE} pose={thanosPose} brow={1} gauntlet={{ stones, power, broken: 1, t }} t={t} />
          {g >= BLAST - 1 && g < BLAST + 40 ? <StoneBlast t={(g - BLAST) / 30} from={[G[0], 0.3, G[2] + 1]} radius={4} /> : null}
          <group position={CRACK_AT}>
            <GroundCrack crack={crack} burst={burst} radius={5} seed={5} t={t} />
          </group>
          {TEAM.map((h, i) => {
            const heave = Math.sin(Math.min(1, burst * 1.6) * Math.PI) * (1.2 + (i % 3) * 0.6);
            return (
              <Hero
                key={h.kind}
                kind={h.kind}
                at={[h.at[0], heave, h.at[2]]}
                rotationY={h.rot}
                pose={{ finL: 0.3 + scared * 0.7, finR: 0.3 + scared * 0.7, eyeScale: 1 + scared * 0.3, roll: burst * Math.sin(i + g * 0.3) * 0.4, blink: (g + i * 17) % 83 < 3 ? 1 : 0 }}
                t={t}
              />
            );
          })}
          {!pov ? <NubiAs look="plain" at={nubiAt} pose={nubiPose} t={t} /> : null}
          <SweatDrops frame={g} from={BLAST + 10} to={BURST} position={[NUBI_TEAM[0], 2.0, NUBI_TEAM[2]]} spread={0.8} />
        </Stage>
      </Shake>
      <StonesHUD frame={g} at={POWER - 10} out={BLAST + 6} x={500} y={420} />
      <Flash frame={g} at={BLAST} dur={8} peak={0.7} color="#D9B3FF" />
      <Flash frame={g} at={BURST} dur={8} peak={0.8} />
      <ImpactText frame={g} at={BURST + 2} out={BURST + 26} text="¡BOOM!" x={540} y={560} color="#FF8A3D" rotate={-6} />
    </AbsoluteFill>
  );
};

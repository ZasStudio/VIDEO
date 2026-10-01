import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, ramp, windowIn } from "../../anim";
import { Burst, Flash } from "../../overlay/Graphics";
import { ImpactText } from "../../overlay/thanos/ThanosUI";
import { Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { DustPuff, Twinkles } from "../../three/Effects3D";
import { ARMY_COLORS, ArmyCrowd } from "../../three/thanos/Costumes";
import { LightningBolt, MagicCircle, RepulsorBeam } from "../../three/thanos/FX";
import { Portal } from "../../three/thanos/Props";
import { BATTLE_SKY, Battlefield } from "../../three/thanos/Sets";
import { aim } from "../camera";
import { Hero, NubiAs, THANOS_SIZE, Thanos } from "../cast";
import { PORTALES } from "../beats";
import { thanosTalk } from "../talk";
import { THANOS } from "../timeline";
import { FieldLights, THANOS_AT } from "../world";
import { TEAM } from "./ThanosHeroes";

// Nubi tumbles down at the edge of the field… giant portals open all round (the music's climax)
// and armies pour out: "Entonces ocurre la batalla más grande de la historia: todos juntos
// contra Thanos, sin perder a nadie." Everybody charges; the heroes pile onto Thanos.

const NUBI_AT: Vec3 = [-0.6, 0, 7.5];
/** Giant portals round the far side of the field (facing +z), each with its army. */
const PORTALS: { at: Vec3; r: number; colors: string[]; inner: [string, string] }[] = [
  { at: [-10, 8.5, -20], r: 7, colors: ARMY_COLORS.wakanda, inner: ["#7B5CFF", "#2B1B5A"] },
  { at: [10, 9, -22], r: 7.5, colors: ARMY_COLORS.asgard, inner: ["#9FD8FF", "#C9A86A"] },
  { at: [0, 13, -34], r: 10, colors: ARMY_COLORS.heroes, inner: ["#FFC27A", "#6B8F3A"] },
  { at: [-19, 6, -10], r: 5.5, colors: ARMY_COLORS.heroes, inner: ["#FF9AD2", "#5A3A7A"] },
  { at: [19, 6, -11], r: 5.5, colors: ARMY_COLORS.asgard, inner: ["#B8FFE0", "#3A6B5A"] },
];

export const ThanosPortales: React.FC = () => {
  const frame = useCurrentFrame();
  const S = THANOS.SCENES.portales;
  const g = frame + S.from;
  const t = g / 30;
  const { END, OPEN, BATALLA, TODOS, THANOS: TH, NADIE, PILE } = PORTALES;

  // Nubi drops in from the sky, bounces, sits up and stares.
  const fall = ramp(g, S.from, S.from + 14, [0, 1], EASE_IN);
  const landed = g >= S.from + 14;
  const dl = g - (S.from + 14);
  const awe = windowIn(g, OPEN - 4, END + 20, 6);
  const nubiPose = thanosTalk(g, {
    squash: landed ? 1 - 0.3 * Math.exp(-dl / 4) * Math.cos(dl * 0.8) : 1.1,
    roll: landed ? 0 : (1 - fall) * 2.4,
    eyeScale: 1.1 + awe * 0.45,
    lookY: awe * 0.7,
    lookX: Math.sin(g * 0.04) * 0.4 * awe,
    finL: awe * 0.5,
    finR: awe * 0.5,
  });
  // Nubi charges with everybody else (out of the low camera's way).
  const run = ramp(g, TODOS, PILE, [0, 1], EASE_IN_OUT);
  const nubiAt: Vec3 = [NUBI_AT[0] - run * 1.5, landed ? 0 : (1 - fall) * 12, NUBI_AT[2] - run * 5.5];

  const open = ramp(g, OPEN - 4, OPEN + 16, [0, 1], EASE_OUT);
  const pour = ramp(g, OPEN + 6, END, [0, 1], (x) => x);
  const charge = ramp(g, TODOS, PILE, [0, 1], EASE_IN_OUT);
  const pile = ramp(g, PILE - 12, PILE, [0, 1], EASE_IN);
  const hitThanos = windowIn(g, TH - 4, PILE, 4);

  // Cameras: behind Nubi as the portals open; an aerial sweep; low with the charge; wide.
  const camA = aim([0.4, 1.7, 15.5], 56, NUBI_AT, 470, 1320);
  const sweep = ramp(g, BATALLA, TODOS, [0, 1], EASE_IN_OUT);
  const camB = { position: lerp3([-14, 16, 14], [8, 12, 13], sweep), target: [0, 0, -8] as Vec3, fov: 56 };
  const camC = { position: lerp3([3.2, 1.4, 9.5], [2.6, 1.6, 5.0], charge), target: [THANOS_AT[0], 3.0, THANOS_AT[2]] as Vec3, fov: 54 };
  const camD = { position: [0.4, 2.6, 13] as Vec3, target: [THANOS_AT[0], 2.8, THANOS_AT[2] + 1] as Vec3, fov: 54 };
  const cam = g < BATALLA ? camA : g < TODOS ? camB : g < NADIE - 6 ? camC : camD;

  // The heroes charge at Thanos, then jump onto him.
  const heroAt = (i: number): Vec3 => {
    const h = TEAM[i];
    const c = lerp3(h.at, [THANOS_AT[0] + (h.at[0] > 0 ? 2.6 : -2.6), 0, THANOS_AT[2] + 2.6], charge * 0.85);
    const top: Vec3 = [THANOS_AT[0] + (i - 2.5) * 0.5, 4.8 + (i % 3) * 0.7, THANOS_AT[2] + 0.4];
    const p = lerp3(c, top, pile);
    return [p[0], p[1] + Math.sin(pile * Math.PI) * 3, p[2]];
  };

  return (
    <AbsoluteFill style={{ background: BATTLE_SKY }}>
      <Shake frame={g} impacts={[{ at: S.from + 14, amp: 10, dur: 8 }, { at: OPEN, amp: 26, dur: 20 }, { at: PILE, amp: 34, dur: 20 }]}>
        <Stage cam={cam} near={0.1} far={2500}>
          <FieldLights flash={windowIn(g, OPEN - 2, OPEN + 10, 3) * 0.8} />
          <Battlefield t={t} />
          {PORTALS.map((p, i) => (
            <group key={i} position={p.at}>
              <Portal radius={p.r} open={ramp(g, OPEN - 4 + i * 3, OPEN + 16 + i * 3, [0, 1], EASE_OUT)} t={t + i} inner={p.inner} />
            </group>
          ))}
          {PORTALS.map((p, i) => {
            // Each army streams out of its portal and marches on Thanos.
            const from: Vec3 = [p.at[0], 0, p.at[2] + 1];
            const to: Vec3 = [THANOS_AT[0] + p.at[0] * 0.3, 0, THANOS_AT[2] - 2 + (p.at[2] + 20) * 0.1];
            const c = lerp3(from, to, Math.min(1, pour * 1.3));
            return open > 0.4 ? (
              <ArmyCrowd
                key={i}
                t={t}
                count={i === 2 ? 70 : 45}
                area={[c[0] - 4, c[2] - 3, c[0] + 4, c[2] + 3]}
                colors={p.colors}
                march={1}
                size={0.9}
                seed={i * 7 + 1}
                facing={Math.atan2(THANOS_AT[0] - c[0], THANOS_AT[2] - c[2])}
                reveal={ramp(g, OPEN + 6 + i * 3, OPEN + 50 + i * 3)}
              />
            ) : null;
          })}
          <Thanos
            at={THANOS_AT}
            size={THANOS_SIZE}
            pose={{ finR: 1.2 + hitThanos * 0.3 * Math.sin(g * 0.9), finL: hitThanos * 0.8, eyeScale: 0.7 + hitThanos * 0.6, roll: hitThanos * Math.sin(g * 1.3) * 0.06, squash: 1 - pile * 0.2 }}
            brow={hitThanos > 0.5 ? -0.6 : 1}
            gauntlet={{ stones: 0.6, power: 0.3, broken: 1, t }}
            t={t}
          />
          {TEAM.map((h, i) => (
            <Hero
              key={h.kind}
              kind={h.kind}
              at={heroAt(i)}
              rotationY={charge > 0 ? Math.atan2(THANOS_AT[0] - h.at[0], THANOS_AT[2] - h.at[2]) * 0.7 : h.rot}
              pose={{ hop: charge > 0 && charge < 1 ? Math.abs(Math.sin(g * 0.5 + i)) * 1.5 : 0, finL: 0.9, finR: 1.1, wiggle: charge > 0 ? 1 : 0, wigglePhase: g * 1.1, eyeScale: 1.1 }}
              power={windowIn(g, TODOS, PILE, 4)}
              t={t}
            />
          ))}
          <NubiAs look="plain" at={nubiAt} rotationY={g < BATALLA || g >= TODOS ? Math.PI : 0} pose={run > 0 && run < 1 ? { ...nubiPose, hop: Math.abs(Math.sin(g * 0.5)) * 1.4, wiggle: 1, wigglePhase: g * 1.1 } : nubiPose} t={t} />
          {/* Everybody's powers converge on Thanos. */}
          {g >= TH - 6 && g < PILE ? (
            <>
              <LightningBolt from={[THANOS_AT[0] - 3, 30, THANOS_AT[2] + 4]} to={[THANOS_AT[0], 4.4, THANOS_AT[2]]} t={t} seed={23} width={0.8} />
              <RepulsorBeam from={[-9, 3, 2]} to={[THANOS_AT[0] - 1, 2.6, THANOS_AT[2]]} t={t} />
              <RepulsorBeam from={[10, 4, 1]} to={[THANOS_AT[0] + 1, 3, THANOS_AT[2]]} t={t + 0.3} color="#FF5A7A" />
            </>
          ) : null}
          {g >= TODOS && g < PILE ? (
            <group position={[THANOS_AT[0], 0.1, THANOS_AT[2]]} rotation={[-Math.PI / 2, 0, 0]}>
              <MagicCircle t={t} radius={4.2} open={charge} />
            </group>
          ) : null}
          <DustPuff frame={g} at={PILE} position={[THANOS_AT[0], 0, THANOS_AT[2]]} radius={5} count={16} />
          <Twinkles frame={g} at={PILE + 4} position={[THANOS_AT[0], 5, THANOS_AT[2]]} radius={3} count={18} color="#FFE27A" />
        </Stage>
      </Shake>
      <Flash frame={g} at={OPEN} dur={10} peak={0.7} color="#FFC48A" />
      <Burst frame={g} at={OPEN + 1} x={540} y={700} color="#FF9A3D" size={900} />
      <Flash frame={g} at={PILE} dur={10} peak={0.85} />
      <ImpactText frame={g} at={PILE + 2} out={END + 4} text="¡ZAS!" x={540} y={600} color="#4FE3FF" rotate={-8} />
    </AbsoluteFill>
  );
};

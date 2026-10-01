import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_IN_OUT, ramp, windowIn } from "../../anim";
import { Confetti } from "../../overlay/Graphics";
import { CrossedList, TeamComplete } from "../../overlay/thanos/ThanosUI";
import { Shake, Stage } from "../../scenes/common";
import { Vec3 } from "../../three/CameraRig";
import { DustPuff } from "../../three/Effects3D";
import { BATTLE_SKY, Battlefield } from "../../three/thanos/Sets";
import { aim } from "../camera";
import { Hero, HeroKind, NubiAs, THANOS_SIZE, Thanos } from "../cast";
import { HEROES } from "../beats";
import { thanosTalk } from "../talk";
import { THANOS } from "../timeline";
import { FieldLights, THANOS_AT } from "../world";

// "Como nadie desaparece, todos los héroes siguen aquí. No hay cinco años tristes, no hay viaje
// en el tiempo… ¡y el equipo está completo!" The heroes who used to vanish land one after another
// round Nubi (still the thunder god); the sad years and the time travel get crossed out; the team
// strikes a pose while the camera swings round them.

export const NUBI_TEAM: Vec3 = [0, 0, 1.6];
/** The team in a V behind Nubi, in landing order. */
export const TEAM: { kind: HeroKind; at: Vec3; rot: number }[] = [
  { kind: "spider", at: [-1.75, 0, 0.3], rot: 0.25 },
  { kind: "panther", at: [1.75, 0, 0.3], rot: -0.25 },
  { kind: "witch", at: [-3.3, 0, -1.8], rot: 0.35 },
  { kind: "groot", at: [3.3, 0, -2.0], rot: -0.35 },
  { kind: "starlord", at: [-1.0, 0, -3.8], rot: 0.15 },
  { kind: "falcon", at: [1.1, 0, -4.0], rot: -0.15 },
];

export const ThanosHeroes: React.FC = () => {
  const frame = useCurrentFrame();
  const S = THANOS.SCENES.heroes;
  const g = frame + S.from;
  const t = g / 30;
  const { END, LANDS, TRISTES, TIEMPO, EQUIPO, COMPLETO } = HEROES;
  const strike = windowIn(g, EQUIPO - 4, END + 20, 5);

  // A slow push-in, then a low hero swing round the team on "¡y el equipo está completo!".
  const orbit = ramp(g, EQUIPO - 10, END, [0, 1], EASE_IN_OUT);
  const a = -0.16 + orbit * 0.32;
  // From a little above, so the back rows show over the front one.
  const R = 13.4 - ramp(g, S.from, EQUIPO, [0, 0.9], (x) => x);
  const cam = aim([NUBI_TEAM[0] + Math.sin(a) * R, 5.2 - orbit * 0.8, NUBI_TEAM[2] + Math.cos(a) * R], 50, NUBI_TEAM, 540, 1290);

  const nubi = thanosTalk(g, {
    finL: 0.3 + strike * 0.9,
    finR: 0.5 + strike * 1.0,
    hop: strike * Math.abs(Math.sin((g - EQUIPO) * 0.3)) * 1.2,
    lookX: Math.sin(g * 0.05) * 0.4 * (1 - strike),
    eyeScale: 1.1 + windowIn(g, LANDS[0] - 2, LANDS[5] + 10, 6) * 0.2,
  });

  return (
    <AbsoluteFill style={{ background: BATTLE_SKY }}>
      <Shake frame={g} impacts={LANDS.map((at) => ({ at, amp: 9, dur: 8 }))}>
        <Stage cam={cam} near={0.1}>
          <FieldLights />
          <Battlefield t={t} />
          <Thanos at={THANOS_AT} size={THANOS_SIZE} pose={{ finR: 0.7, eyeScale: 0.8, lookY: -0.2 }} brow={1} gauntlet={{ stones: 0.3, broken: 1, t }} t={t} />
          {TEAM.map((h, i) => {
            const land = LANDS[i];
            if (g < land - 12) return null;
            const k = ramp(g, land - 12, land, [0, 1], EASE_IN);
            const dl = g - land;
            const y = (1 - k) * 9;
            const squash = g >= land ? 1 - 0.35 * Math.exp(-dl / 4) * Math.cos(dl * 0.7) : 1.15;
            const pz = windowIn(g, EQUIPO - 4 + i * 2, END + 20, 5);
            return (
              <React.Fragment key={h.kind}>
                <Hero
                  kind={h.kind}
                  at={[h.at[0], y, h.at[2]]}
                  rotationY={h.rot}
                  pose={{
                    squash,
                    finL: g < land ? 1.2 : 0.2 + pz * 0.9,
                    finR: g < land ? 1.2 : 0.2 + pz * 1.1,
                    hop: pz * Math.abs(Math.sin((g - EQUIPO) * 0.3 + i)) * 0.9,
                    eyeScale: 1.05,
                    lookX: -Math.sign(h.at[0]) * 0.3,
                    blink: (g + i * 17) % 83 < 3 ? 1 : 0,
                  }}
                  power={h.kind === "falcon" ? 1 - ramp(g, land, land + 20) * 0.6 : h.kind === "witch" ? pz : 0}
                  t={t}
                />
                <DustPuff frame={g} at={land} position={[h.at[0], 0, h.at[2]]} radius={1.3} />
              </React.Fragment>
            );
          })}
          <NubiAs look="thor" at={NUBI_TEAM} pose={nubi} t={t} wind={0.4} />
        </Stage>
      </Shake>
      <CrossedList
        frame={g}
        items={[
          { at: TRISTES - 22, crossAt: TRISTES + 6 },
          { at: TIEMPO - 20, crossAt: TIEMPO + 6 },
        ]}
        out={EQUIPO - 6}
        x={500}
        y={520}
      />
      <TeamComplete frame={g} at={EQUIPO - 4} x={500} y={470} />
      <Confetti frame={g} at={COMPLETO + 8} count={90} />
    </AbsoluteFill>
  );
};

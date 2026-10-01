import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_OUT, ramp, windowIn } from "../../anim";
import { ImpactText, PowerChips } from "../../overlay/thanos/ThanosUI";
import { Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3, projectToScreen } from "../../three/CameraRig";
import { LightningBolt, MagicCircle, RepulsorBeam } from "../../three/thanos/FX";
import { Rock, StarShield } from "../../three/thanos/Props";
import { BATTLE_SKY, Battlefield } from "../../three/thanos/Sets";
import { Poof } from "../../inca/effects";
import { aim } from "../camera";
import { Held, Hero, Look, NubiAs, THANOS_SIZE, Thanos, finTipWorld } from "../cast";
import { TRAJES } from "../beats";
import { thanosTalk } from "../talk";
import { THANOS, THANOS_HEIGHT, THANOS_WIDTH } from "../timeline";
import { FieldLights, THANOS_AT } from "../world";
import { NUBI_TEAM, TEAM } from "./ThanosHeroes";

// "Uno con escudo, uno con martillo, uno con rayos, uno con magia…" — a costume change on every
// "uno": the star shield flies out and back, lightning on the hammer, a repulsor beam, magic
// circles. "¡Y yo, que traje una piedra!" Plain Nubi proudly holds up… a rock, then lobs it at
// Thanos: TOC.

/** Where the rock hits Thanos's helmet. */
const HELMET: Vec3 = [THANOS_AT[0], 4.3, THANOS_AT[2] + 1.2];

export const ThanosTrajes: React.FC = () => {
  const frame = useCurrentFrame();
  const S = THANOS.SCENES.trajes;
  const g = frame + S.from;
  const t = g / 30;
  const { END, UNO, ITEM, PLAIN, PIEDRA, TOSS, BONK } = TRAJES;

  const swaps: [number, Look][] = [
    [S.from, "thor"],
    [UNO[0] - 4, "cap"],
    [UNO[1] - 4, "thor"],
    [UNO[2] - 4, "iron"],
    [UNO[3] - 4, "strange"],
    [PLAIN - 4, "plain"],
  ];
  let look: Look = "thor";
  for (const [f, l] of swaps) if (g >= f) look = l;

  // How much each item's action is on (escudo, martillo, rayos, magia).
  const act = (i: number) => windowIn(g, ITEM[i] - 6, (i < 3 ? UNO[i + 1] : PLAIN) - 6, 4);
  const proud = windowIn(g, PIEDRA - 6, TOSS, 5);
  const toss = ramp(g, TOSS - 6, TOSS, [0, 1], EASE_IN);
  const finR =
    look === "cap" ? 0.6 : look === "thor" ? 0.4 + 1.0 * act(1) : look === "iron" ? 0.7 + 0.5 * act(2) : look === "strange" ? 0.9 : 0.5 + proud * 0.9 - toss * 0.6;
  const finL = look === "cap" ? 0.4 + act(0) * 0.7 : look === "strange" ? 0.9 : 0.25;
  const pose = thanosTalk(g, {
    finR,
    finL,
    eyeScale: 1.1 + proud * 0.25,
    hop: proud * Math.abs(Math.sin((g - PIEDRA) * 0.35)) * 0.8,
    squash: 1 + proud * 0.04,
    lookX: look === "iron" ? 0.5 * act(2) : 0,
    lookY: proud * 0.25,
  });

  // Camera: medium on Nubi with the team behind, easing in; the rock flies over the heroes to
  // Thanos's helmet in the background.
  const u = ramp(g, S.from, TOSS, [0, 1], (x) => x);
  const cam = aim([0.3, 2.4 - u * 0.4, NUBI_TEAM[2] + 11.4 - u * 1.4], 48, NUBI_TEAM, 540, 1260);
  const helmet = projectToScreen(cam, HELMET, THANOS_WIDTH, THANOS_HEIGHT);

  // Held things and effects.
  const tipR = finTipWorld(NUBI_TEAM, 0, 2, finR);
  const shieldOut = look === "cap" ? ramp(g, ITEM[0], ITEM[0] + 26, [0, 1], (x) => x) : 0;
  const flying = shieldOut > 0 && shieldOut < 1;
  const sk = Math.sin(shieldOut * Math.PI);
  const holdR = look === "thor" ? Held.hammer({ raise: finR, crackle: act(1), t }) : look === "plain" && g < TOSS ? Held.rock({ raise: finR }) : null;
  const holdL = look === "cap" && !flying ? Held.shieldL({ raise: finL }) : null;
  const rockFly = ramp(g, TOSS, BONK, [0, 1], (x) => x);
  const rockPos = lerp3([tipR[0], tipR[1] + 0.3, tipR[2]], HELMET, rockFly);
  const rockArc: Vec3 = [rockPos[0], rockPos[1] + Math.sin(rockFly * Math.PI) * 3, rockPos[2]];
  const bonked = g >= BONK;
  const bounce = ramp(g, BONK, BONK + 20, [0, 1], EASE_OUT);
  const rockAt: Vec3 = bonked ? [HELMET[0] + bounce * 1.8, HELMET[1] + Math.sin(bounce * Math.PI) * 1.5 - bounce * 4, HELMET[2] + bounce * 1.6] : rockArc;

  return (
    <AbsoluteFill style={{ background: BATTLE_SKY }}>
      <Shake frame={g} impacts={[{ at: ITEM[1], amp: 14, dur: 10 }, { at: ITEM[2], amp: 8, dur: 8 }, { at: BONK, amp: 12, dur: 8 }]}>
        <Stage cam={cam} near={0.1}>
          <FieldLights flash={windowIn(g, ITEM[1] - 1, ITEM[1] + 6, 2)} />
          <Battlefield t={t} />
          <Thanos
            at={THANOS_AT}
            size={THANOS_SIZE}
            pose={{
              finR: 0.7,
              eyeScale: bonked ? 0.7 : 0.85,
              lookY: bonked ? 0.4 : -0.1,
              roll: bonked ? 0.08 * Math.exp(-(g - BONK) / 6) * Math.sin((g - BONK) * 1.4) : 0,
              squash: bonked ? 1 - 0.06 * Math.exp(-(g - BONK) / 4) : 1,
            }}
            brow={bonked ? 1 : 0.8}
            gauntlet={{ stones: 0.3, broken: 1, t }}
            t={t}
          />
          {TEAM.map((h, i) => {
            const stare = windowIn(g, PIEDRA - 4, END + 20, 6);
            return (
              <Hero
                key={h.kind}
                kind={h.kind}
                at={h.at}
                rotationY={h.rot - Math.sign(h.at[0]) * stare * 0.45}
                pose={{ finL: 0.2, finR: 0.25, eyeScale: 1 + stare * 0.25, lookX: -Math.sign(h.at[0]) * 0.4, blink: (g + i * 17) % 83 < 3 ? 1 : 0 }}
                t={t}
              />
            );
          })}
          <NubiAs look={look} at={NUBI_TEAM} pose={pose} t={t} wind={0.4} charge={look === "iron" ? act(2) : 0} holdR={holdR} holdL={holdL} />
          {swaps.slice(1).map(([f]) => (
            <Poof key={f} frame={g} at={f - 6} position={NUBI_TEAM} radius={1.8} />
          ))}
          {/* The shield, thrown out to the right and back. */}
          {flying ? (
            <group position={[NUBI_TEAM[0] + sk * 4.0, 1.4 + sk * 0.8, NUBI_TEAM[2] - sk * 1.2]} rotation={[Math.PI / 2 - 0.3, 0, g * 0.9]} scale={1.1}>
              <StarShield />
            </group>
          ) : null}
          {look === "thor" && g >= ITEM[1] - 1 && g < ITEM[1] + 12 ? (
            <LightningBolt from={[NUBI_TEAM[0] + 2, 24, NUBI_TEAM[2] - 5]} to={finTipWorld(NUBI_TEAM, 0, 2, finR, 1, [0, 1.5, 0])} t={t} seed={11} width={0.5} amount={1 - ramp(g, ITEM[1] + 5, ITEM[1] + 12)} reveal={ramp(g, ITEM[1] - 1, ITEM[1] + 2)} />
          ) : null}
          {look === "iron" && g >= ITEM[2] - 2 && g < UNO[3] - 6 ? (
            <RepulsorBeam from={tipR} to={[tipR[0] + 8, tipR[1] + 5, tipR[2] - 7]} t={t} reveal={ramp(g, ITEM[2] - 2, ITEM[2] + 3)} amount={1 - ramp(g, UNO[3] - 12, UNO[3] - 6)} />
          ) : null}
          {look === "strange" ? (
            <>
              <group position={finTipWorld(NUBI_TEAM, 0, 2, 0.9, 1, [0.6, 0, 1.2])}>
                <MagicCircle t={t} radius={0.75} open={act(3)} />
              </group>
              <group position={finTipWorld(NUBI_TEAM, 0, 2, 0.9, -1, [0.6, 0, 1.2])}>
                <MagicCircle t={t + 0.5} radius={0.75} open={act(3)} />
              </group>
            </>
          ) : null}
          {g >= TOSS && bounce < 1 ? (
            <group position={rockAt} rotation={[g * 0.4, g * 0.3, 0]}>
              <Rock size={0.5} />
            </group>
          ) : null}
        </Stage>
      </Shake>
      <PowerChips frame={g} times={[ITEM[0], ITEM[1], ITEM[2], ITEM[3], PIEDRA]} out={TOSS + 4} x={500} y={430} layout="grid" />
      <ImpactText frame={g} at={BONK} out={BONK + 24} text="¡TOC!" x={Math.min(620, Math.max(440, helmet.x))} y={Math.max(380, helmet.y - 140)} color="#FFD60A" rotate={10} size={100} />
    </AbsoluteFill>
  );
};

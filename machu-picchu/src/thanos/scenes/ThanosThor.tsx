import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, ramp, windowIn } from "../../anim";
import { Burst, Flash } from "../../overlay/Graphics";
import { ImpactText, NoSignal } from "../../overlay/thanos/ThanosUI";
import { Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3, projectToScreen } from "../../three/CameraRig";
import { LightningBolt, SparkBurst } from "../../three/thanos/FX";
import { Mjolnir } from "../../three/thanos/Props";
import { BATTLE_SKY, Battlefield } from "../../three/thanos/Sets";
import { aim } from "../camera";
import { Held, NubiAs, THANOS_SIZE, Thanos, finTipWorld, gauntletWorld } from "../cast";
import { THOR } from "../beats";
import { thanosTalk } from "../talk";
import { THANOS, THANOS_HEIGHT, THANOS_WIDTH } from "../timeline";
import { FieldLights, THANOS_AT } from "../world";

// Poof: Nubi as the thunder god. Lightning strikes the raised hammer: "¡Esta vez voy directo al
// guantelete!" — the throw, then first person riding the hammer straight into the gauntlet.
// KRAK: a chunk breaks off. Thanos snaps… *click*. Nothing. "¡Se quedó sin señal cósmica!"

const NUBI_AT: Vec3 = [-1.5, 0, 3.0];
const NUBI_ROT = 0.2;

export const ThanosThor: React.FC = () => {
  const frame = useCurrentFrame();
  const S = THANOS.SCENES.thor;
  const g = frame + S.from;
  const t = g / 30;
  const { END, BOLT, GUANTELETE, THROW, POV, HIT, SNAP, L06 } = THOR;
  const pov = g >= POV && g < HIT;
  const hit = g >= HIT;

  // ---- Nubi the thunder god: hammer up for the bolt, a wind-up wobble, the throw, then laughs ----
  const charge = windowIn(g, BOLT - 2, THROW, 6);
  const windup = ramp(g, GUANTELETE - 10, THROW - 2, [0, 1], EASE_IN);
  const thrown = g >= THROW;
  const laugh = windowIn(g, L06 - 4, END + 20, 6);
  const finR = thrown ? 0.25 + 0.9 * (1 - ramp(g, THROW, THROW + 10)) : 1.35 - windup * 0.35;
  const pose = thanosTalk(g, {
    finR,
    finL: 0.3 + laugh * 0.7 * Math.abs(Math.sin(g * 0.5)),
    hop: laugh * Math.abs(Math.sin((g - L06) * 0.45)) * 1.6 + charge * 0.4,
    eyeScale: 1.15 + charge * 0.2,
    lookX: 0.35,
    lookY: 0.35,
    yaw: windup * 0.35 * Math.sin(windup * 9),
    squash: laugh > 0.5 ? 1 + 0.06 * Math.sin(g * 0.9) : 1,
  });
  const hammer = !thrown ? Held.hammer({ raise: finR, crackle: charge, t, spin: windup * windup * 1.2 * Math.sin(windup * 14) }) : null;

  // ---- Thanos: frozen until the hit; then he looks at the cracked gauntlet and snaps ----
  const glare = ramp(g, HIT + 8, HIT + 22);
  const snap = ramp(g, SNAP - 3, SNAP + 2, [0, 1], EASE_IN);
  const search = windowIn(g, L06 + 4, END + 20, 8);
  const thanosFinR = 1.35 + glare * 0.1 + search * (0.4 + 0.12 * Math.sin(g * 0.7));
  const thanosPose = {
    finR: thanosFinR,
    eyeScale: hit ? 0.85 + windowIn(g, SNAP + 6, SNAP + 30, 4) * 0.45 : 0.9,
    lookX: hit ? 0.55 - search * 0.3 : -0.1,
    lookY: hit ? 0.5 + search * 0.3 : 0,
    roll: search * Math.sin(g * 0.7) * 0.05,
  };
  const gauntlet = {
    stones: hit ? (g < SNAP ? 1 - 0.5 * Math.abs(Math.sin(g * 0.8)) : 0.3 * Math.abs(Math.sin(g * 0.3))) : 1,
    power: hit ? 0 : 0.6,
    broken: hit ? 1 : 0,
    snap,
    t,
  };
  const G = gauntletWorld(THANOS_AT, 0, THANOS_SIZE, thanosFinR);

  // ---- Cameras ----
  const camA = aim([2.6, 1.05, 12.2], 50, NUBI_AT, 420, 1250);
  // First person riding the hammer from Nubi's fin to just short of the gauntlet.
  const start = finTipWorld(NUBI_AT, NUBI_ROT, 2, 1.35, 1, [0, 1.5, 0]);
  const fly = ramp(g, POV, HIT, [0, 1], EASE_IN);
  const camPos = lerp3(start, [G[0] - 0.3, G[1] + 0.2, G[2] + 1.15], fly);
  const povCam = { position: camPos, target: G, fov: 64, roll: fly * 0.5 };
  // Thanos's face and the cracked gauntlet together, from the front right.
  const camB = aim([3.6, 2.9, 4.6], 46, [(G[0] + THANOS_AT[0]) / 2, 3.1, -4.6], 540, 760);
  const camC = aim([1.0, 1.3, 13.6], 50, NUBI_AT, 360, 1250);
  const cam = pov ? povCam : !hit ? camA : g < L06 - 6 ? camB : camC;
  const gScreen = projectToScreen(cam, G, THANOS_WIDTH, THANOS_HEIGHT);

  // The hammer just ahead of the lens during the ride, head first.
  const fwd = [G[0] - camPos[0], G[1] - camPos[1], G[2] - camPos[2]];
  const fl = Math.hypot(fwd[0], fwd[1], fwd[2]) || 1;
  const ahead: Vec3 = [camPos[0] + (fwd[0] / fl) * 1.25, camPos[1] + (fwd[1] / fl) * 1.25 - 0.38, camPos[2] + (fwd[2] / fl) * 1.25];
  const yawTo = Math.atan2(fwd[0], fwd[2]);
  const pitchTo = Math.asin(fwd[1] / fl);

  return (
    <AbsoluteFill style={{ background: BATTLE_SKY }}>
      <Shake frame={g} impacts={[{ at: BOLT, amp: 18, dur: 12 }, { at: HIT, amp: 30, dur: 16 }, { at: SNAP, amp: 4, dur: 6 }]}>
        <Stage cam={cam} near={0.05}>
          <FieldLights flash={windowIn(g, BOLT - 1, BOLT + 8, 2) + windowIn(g, HIT, HIT + 6, 2)} />
          <Battlefield t={t} frozen={hit ? 0 : 1} freezeT={HIT / 30} />
          <Thanos at={THANOS_AT} size={THANOS_SIZE} pose={thanosPose} brow={hit ? 1 : 0.9} gauntlet={gauntlet} t={t} />
          <NubiAs look="thor" at={NUBI_AT} rotationY={NUBI_ROT} pose={pose} t={t} wind={0.55} holdR={hammer} />
          {g >= BOLT - 1 && g < BOLT + 14 ? (
            <LightningBolt from={[NUBI_AT[0] + 3, 26, NUBI_AT[2] - 6]} to={start} t={t} seed={7} width={0.6} amount={1 - ramp(g, BOLT + 6, BOLT + 14)} reveal={ramp(g, BOLT - 1, BOLT + 2)} />
          ) : null}
          {pov ? (
            <group position={ahead} rotation={[0, yawTo, 0]}>
              <group rotation={[Math.PI / 2 - pitchTo, 0, 0]}>
                <group rotation={[0, (g - POV) * 0.35, 0]} scale={0.7}>
                  <Mjolnir crackle={1} t={t} />
                </group>
              </group>
            </group>
          ) : null}
          {g >= HIT ? <SparkBurst t={(g - HIT) / 30} position={G} size={2.2} seed={4} /> : null}
        </Stage>
      </Shake>
      {pov ? <Speedlines frame={g} /> : null}
      <Flash frame={g} at={BOLT} dur={6} peak={0.7} />
      <Flash frame={g} at={HIT} dur={8} peak={0.9} />
      <Burst frame={g} at={HIT + 1} x={gScreen.x} y={gScreen.y} color="#FFD60A" size={720} />
      <ImpactText frame={g} at={HIT + 2} out={HIT + 26} text="¡KRAK!" x={520} y={560} color="#FFD60A" rotate={-6} />
      <ImpactText frame={g} at={SNAP + 1} out={SNAP + 22} text="¡CLIC!" x={520} y={380} color="#FFFFFF" rotate={8} size={100} />
      <NoSignal frame={g} at={L06 + 6} out={END + 10} x={500} y={420} />
    </AbsoluteFill>
  );
};

/** Radial speed streaks for the hammer ride. */
const Speedlines: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <svg width={1080} height={1920} viewBox="0 0 1080 1920">
      {Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2 + (i % 3) * 0.07;
        const r0 = 420 + ((frame * 37 + i * 91) % 260);
        const r1 = r0 + 260;
        return (
          <line
            key={i}
            x1={540 + Math.cos(a) * r0}
            y1={900 + Math.sin(a) * r0 * 1.6}
            x2={540 + Math.cos(a) * r1}
            y2={900 + Math.sin(a) * r1 * 1.6}
            stroke="#FFFFFF"
            strokeOpacity={0.5}
            strokeWidth={6}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  </AbsoluteFill>
);

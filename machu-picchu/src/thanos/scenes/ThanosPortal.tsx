import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN, EASE_IN_OUT, ramp, windowIn } from "../../anim";
import { Burst, Flash } from "../../overlay/Graphics";
import { TimeFrozenHUD } from "../../overlay/thanos/ThanosUI";
import { TitleCanvas, TitleSlam } from "../../overlay/TitleOverlay";
import { Shake, Stage } from "../../scenes/common";
import { Vec3, projectToScreen } from "../../three/CameraRig";
import { DustPuff } from "../../three/Effects3D";
import { LOOKS } from "../../three/Text3D";
import { FrozenDebris } from "../../three/thanos/FX";
import { Portal } from "../../three/thanos/Props";
import { BATTLE_SKY, Battlefield, FIELD_NUBI, FIELD_SKY_PORTAL } from "../../three/thanos/Sets";
import { aim } from "../camera";
import { Hero, NubiAs, THANOS_SIZE, Thanos, gauntletWorld } from "../cast";
import { PORTAL } from "../beats";
import { thanosTalk } from "../talk";
import { THANOS, THANOS_HEIGHT, THANOS_WIDTH } from "../timeline";
import { FieldLights, THANOS_AT } from "../world";

// "¡Alto, alto, alto…! Este es el segundo más importante de todo el universo." First person, we
// dive through a portal in the sky; then Nubi drops out of it into a battle frozen in time —
// rocks and dust hang in the air, heroes mid-jump, Thanos with the gauntlet raised to snap — and
// the camera drifts round it all, bullet-time style.

const THANOS_RAISE = 1.35;

export const ThanosPortal: React.FC = () => {
  const frame = useCurrentFrame();
  const S = THANOS.SCENES.portal;
  const g = frame + S.from;
  const t = g / 30;
  const { END, POV_END, LAND, ALTO, ESTE, IMPORTANTE, UNIVERSO } = PORTAL;
  const pov = g < POV_END;

  // ---- First person: diving down through a flat portal ring, the frozen battle far below ----
  const dive = ramp(g, S.from, POV_END, [0, 1], EASE_IN);
  const povPos: Vec3 = [-0.6 - dive * 0.3, 40 - dive * 24, 13 - dive * 4];
  const povCam = { position: povPos, target: [0.2, 0, -1] as Vec3, fov: 62, roll: dive * 0.3 };
  // The ring sits on the dive path, a little below the start.
  const ringAt: Vec3 = [-0.78, 27, 10.6];

  // ---- Third person: a slow bullet-time drift round Nubi, Thanos and the gauntlet behind ----
  const drift = ramp(g, POV_END, END, [0, 1], EASE_IN_OUT);
  const a = -0.12 + drift * 0.17;
  const R = 17.5 - ramp(g, IMPORTANTE - 10, UNIVERSO + 10, [0, 1.0], EASE_IN_OUT);
  const camPos: Vec3 = [FIELD_NUBI[0] + Math.sin(a) * R, 1.4 + drift * 0.2, FIELD_NUBI[2] - 5.5 + Math.cos(a) * R];
  const cam = aim(camPos, 50, FIELD_NUBI, 470, 1250);

  // Nubi drops out of the small portal, lands, and holds both fins up: "¡alto, alto, alto!".
  const drop = ramp(g, POV_END, LAND, [0, 1], EASE_IN);
  const landed = g >= LAND;
  const dl = g - LAND;
  const nubiAt: Vec3 = [FIELD_NUBI[0], landed ? 0 : (1 - drop) * (FIELD_SKY_PORTAL[1] - 1.2), FIELD_NUBI[2]];
  const stop = Math.max(...ALTO.map((f) => windowIn(g, f - 3, f + 8, 3)));
  const awe = windowIn(g, ESTE - 4, END + 10, 8);
  const up = landed ? Math.max(stop, 1 - ramp(g, LAND, LAND + 8)) : 1;
  const pose = thanosTalk(g, {
    squash: landed ? 1 - 0.32 * Math.exp(-dl / 4) * Math.cos(dl * 0.7) : 1.12,
    finL: up * 1.0 + awe * 0.25,
    finR: up * 1.0 + awe * 0.25,
    eyeScale: 1.15 + stop * 0.2 + windowIn(g, UNIVERSO - 4, END + 10, 4) * 0.2,
    lookY: 0.4 * awe,
    lookX: 0.3 * awe,
  });
  const G = gauntletWorld(THANOS_AT, 0, THANOS_SIZE, THANOS_RAISE);
  const gs = projectToScreen(cam, G, THANOS_WIDTH, THANOS_HEIGHT);

  return (
    <AbsoluteFill style={{ background: BATTLE_SKY }}>
      <Shake frame={g} impacts={[{ at: LAND, amp: 14, dur: 10 }]}>
        <Stage cam={pov ? povCam : cam} near={0.1}>
          <FieldLights />
          <Battlefield t={t} frozen={1} />
          <group position={[-0.6, 0, -1]}>
            <FrozenDebris t={t} frozen={1} area={[18, 7, 16]} count={70} seed={3} />
          </group>
          {pov ? (
            <group position={ringAt} rotation={[-Math.PI / 2, 0, 0]}>
              <Portal radius={3.6} open={1} t={t} inner={false} />
            </group>
          ) : (
            <group position={FIELD_SKY_PORTAL}>
              <Portal radius={2} open={1 - ramp(g, LAND + 6, LAND + 26)} t={t} />
            </group>
          )}
          <Thanos at={THANOS_AT} size={THANOS_SIZE} pose={{ finR: THANOS_RAISE, eyeScale: 0.9, lookX: -0.1 }} brow={0.9} gauntlet={{ stones: 1, power: 0.6, t }} t={t} />
          {/* Heroes frozen mid-jump round the arena. */}
          <Hero kind="spider" at={[-4.4, 2.8, -3]} rotationY={0.6} pose={{ finL: 1.1, finR: 0.5, pitch: 0.3, roll: 0.25, eyeScale: 1.2 }} t={t} />
          <Hero kind="panther" at={[3.6, 1.5, -2.2]} rotationY={-0.7} pose={{ finL: 0.8, finR: 1.2, pitch: -0.2, eyeScale: 1.1 }} t={t} />
          <Hero kind="witch" at={[-3.6, 0, -9]} rotationY={0.4} pose={{ finL: 1.1, finR: 1.1 }} t={t} power={1} />
          <Hero kind="groot" at={[3.8, 0, -10.5]} rotationY={-0.4} pose={{ finL: 0.6, finR: 1.0 }} t={t} />
          <NubiAs look="plain" at={nubiAt} rotationY={0.1} pose={pose} t={t} />
          <DustPuff frame={g} at={LAND} position={FIELD_NUBI} radius={1.4} />
        </Stage>
      </Shake>
      {!pov ? <TimeFrozenHUD frame={g} at={IMPORTANTE - 14} out={END + 10} x={500} y={300} /> : null}
      <TitleCanvas>
        <TitleSlam
          frame={g}
          at={-16}
          out={ESTE + 10}
          exit="up"
          lines={[
            { text: "¿Y SI THANOS", size: 0.34, look: LOOKS.white, y: 4.0, delay: 0 },
            { text: "NUNCA", size: 0.58, look: LOOKS.red, y: 3.35, delay: 3 },
            { text: "CHASQUEABA", size: 0.42, look: LOOKS.gold, y: 2.7, delay: 6 },
            { text: "LOS DEDOS?", size: 0.4, look: LOOKS.white, y: 2.15, delay: 9 },
          ]}
        />
      </TitleCanvas>
      <Burst frame={g} at={0} x={540} y={360} color="#FF4B3E" size={640} />
      <Burst frame={g} at={UNIVERSO} x={gs.x} y={gs.y} color="#FFD60A" size={520} />
      <Flash frame={g} at={POV_END} dur={5} peak={0.5} />
    </AbsoluteFill>
  );
};

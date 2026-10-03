import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_OUT, ramp, windowIn } from "../../anim";
import { LifeCounter } from "../../overlay/tiempo/TiempoUI";
import { Shake, Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { Vec3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import { DOOR_NUBI, DRONE_EYE, ScanBeam, ScanRing, TIMECO_SKY, TimeCity, TimecoDrone, TimecoFog, TimecoLights, TimecoTower } from "../../three/tiempo/Timeco";
import { FINAL } from "../beats";
import { NUBI_EVENTS, nubiDraining, nubiHolding, nubiSeconds } from "../clock";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { TIEMPO } from "../timeline";

// "Queja detectada. Le dejamos diez segundos… por cortesía." (FINAL.START → DOOR), in front of
// TIMECO's closed gigantic door. The security drone drops into frame in front of Nubi on DRONE
// and hovers; on SCAN its red beam sweeps over Nubi (the 2D "QUEJA DETECTADA" stamp sits around
// y 330); it bobs and its eye pulses while it talks (L14). On MULTA ("diez") Nubi's counter
// crashes to 00:00:10: its eyes go huge, it hops back; a small punch-in and a shake.
// Two-shot cheated to camera: the drone on the left turned right, Nubi on the right turned left.

const NUBI_AT: Vec3 = [DOOR_NUBI[0] + 0.85, 0, DOOR_NUBI[2]];
const NUBI_ROT = -0.6;
const HOVER: Vec3 = [DOOR_NUBI[0] - 1.35, 2.75, DOOR_NUBI[2] + 1.0];
const DRONE_ROT = 0.85;

/** 0..1 while one of TIMECO's words is being spoken (the drone's eye pulses with them). */
const L14_WORDS = Array.from({ length: 8 }, (_, i) => [TIEMPO.wordAt("L14", i), TIEMPO.wordEnd("L14", i)] as const);
const talking = (g: number) => L14_WORDS.reduce((m, [a, b]) => Math.max(m, windowIn(g, a, b + 2, 2)), 0);

export const DronShot: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + SHOTS.dron.from;
  const t = g / 30;
  const { DRONE, SCAN, MULTA, DOOR } = FINAL;

  // ---- The drone: drops in fast, a little bounce, then hovers and bobs; a polite bow at the end.
  const drop = ramp(g, DRONE, DRONE + 8, [0, 1], (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2));
  const talk = talking(g);
  const bob = 0.07 * Math.sin(t * 4.2) + 0.03 * talk * Math.sin(g * 0.9);
  const bow = windowIn(g, TIEMPO.wordAt("L14", 6) - 2, DOOR, 6);
  const dronePos: Vec3 = [HOVER[0], HOVER[1] + 6.5 * (1 - drop) + bob, HOVER[2]];
  const droneTilt = 0.25 * (1 - drop) - 0.08 + 0.32 * bow + 0.03 * Math.sin(t * 3.1);
  const eye = 0.55 + 0.6 * talk * (0.6 + 0.4 * Math.sin(g * 1.1)) + 0.5 * windowIn(g, MULTA - 2, MULTA + 10, 3);
  const c = Math.cos(DRONE_ROT);
  const s = Math.sin(DRONE_ROT);
  const eyeWorld: Vec3 = [dronePos[0] + DRONE_EYE[2] * s, dronePos[1] + DRONE_EYE[1] - DRONE_EYE[2] * Math.sin(droneTilt) * 0.5, dronePos[2] + DRONE_EYE[2] * c];

  // ---- The scan: sweeps Nubi top → bottom → top until the fine lands.
  const scanK = windowIn(g, SCAN, MULTA + 4, 4);
  const sweep = Math.cos(((g - SCAN) / 22) * Math.PI);
  const lineY = 1.0 + 0.95 * sweep;

  // ---- Nubi: frozen under the scan, nervous glances at its counter, the jolt on MULTA.
  const fine = ramp(g, MULTA, MULTA + 6, [0, 1], EASE_OUT);
  const hopBack = windowIn(g, MULTA, MULTA + 12, 2);
  const back = ramp(g, MULTA, MULTA + 10, [0, 0.75], EASE_OUT);
  const glance = windowIn(g, TIEMPO.wordAt("L14", 2), MULTA, 4);
  const pose: NubiPose = {
    eyeScale: 1.15 + 0.15 * scanK + 0.5 * fine,
    lookX: -0.75 * (1 - glance) * (1 - fine * 0.4),
    lookY: 0.35 + 0.45 * glance + 0.25 * fine,
    finL: 0.15 + 0.6 * hopBack + 0.35 * fine,
    finR: 0.15 + 0.6 * hopBack + 0.35 * fine,
    squash: 0.96 - 0.06 * scanK * Math.abs(Math.sin(g * 0.4)) + 0.08 * hopBack,
    hop: 2.4 * hopBack + 0.2 * Math.abs(Math.sin(g * 1.9)) * fine,
    pitch: -0.12 * hopBack,
    roll: 0.03 * Math.sin(g * 2.3) * (scanK * 0.5 + fine),
    wiggle: 0.5 * hopBack,
    wigglePhase: g * 0.8,
    blink: g > DRONE + 10 && g < DRONE + 13 ? 1 : 0,
  };
  const at: Vec3 = [NUBI_AT[0] + back * 0.55, 0, NUBI_AT[2] - back * 0.55];

  // ---- Camera: a two-shot looking at the closed door; a punch-in on MULTA.
  const punch = ramp(g, MULTA, MULTA + 5, [0, 1], EASE_OUT) * (1 - 0.35 * ramp(g, MULTA + 5, DOOR, [0, 1], (x) => x));
  const pos: Vec3 = [DOOR_NUBI[0] + 0.1, 1.55, DOOR_NUBI[2] + 10.2];
  const cam = aim(pos, 40 - 5 * punch, [DOOR_NUBI[0] + 0.15, 0, DOOR_NUBI[2]], 540, 1262 + 40 * punch);

  const head: Vec3 = [at[0], 2.2 + (pose.hop ?? 0) * 0.2, at[2]];
  const ctr = counterAt(cam, head, { min: 1.0, max: 1.3 });
  return (
    <AbsoluteFill style={{ background: TIMECO_SKY }}>
      <Shake
        frame={g}
        impacts={[
          { at: DRONE + 7, amp: 7, dur: 10 },
          { at: MULTA, amp: 16, dur: 14 },
        ]}
      >
        <Stage cam={cam} far={2600}>
          <TimecoLights red={1.4} />
          <TimecoFog near={70} far={900} />
          <directionalLight position={[DOOR_NUBI[0] + 3, 5, DOOR_NUBI[2] + 14]} intensity={1.4} color="#FFE2B8" />
          <pointLight position={[HOVER[0] - 0.6, HOVER[1] + 1.4, HOVER[2] - 1.6]} intensity={1.2 + 3.5 * scanK} distance={7} decay={1.5} color="#FF2A2A" />
          <TimeCity t={t} />
          <TimecoTower t={t} />
          <Nubi size={2} position={at} rotationY={NUBI_ROT} pose={pose} shadowOpacity={0.5} />
          <group position={dronePos} rotation={[droneTilt, DRONE_ROT, 0.08 * Math.sin(t * 2.3)]} scale={1.3}>
            <TimecoDrone t={t} eye={eye} />
          </group>
          <ScanBeam from={eyeWorld} to={[at[0], 1.0, at[2]]} w={2.6} h={2.3} sweep={sweep} amount={scanK} />
          <ScanRing position={[at[0], lineY, at[2]]} amount={scanK * 0.9} />
        </Stage>
        {!ctr.behind ? (
          <LifeCounter frame={g} seconds={nubiSeconds(g)} events={NUBI_EVENTS} draining={nubiDraining(g)} frozen={nubiHolding(g)} x={ctr.x} y={ctr.y} scale={ctr.scale} />
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};

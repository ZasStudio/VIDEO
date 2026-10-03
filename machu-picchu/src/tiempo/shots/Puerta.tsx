import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, ramp, windowIn } from "../../anim";
import { LifeCounter } from "../../overlay/tiempo/TiempoUI";
import { Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import { DOOR_NUBI, DoorSpill, GATE, Halo, TIMECO_SKY, TimeCity, TimecoFog, TimecoLights, TimecoTower } from "../../three/tiempo/Timeco";
import { FINAL } from "../beats";
import { NUBI_EVENTS, nubiDraining, nubiHolding, nubiSeconds } from "../clock";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { tiempoTalk } from "../talk";
import { TIEMPO } from "../timeline";

// The question (FINAL.DOOR → BLACK): "Si tuvieras solo un año de vida… ¿lo gastarías en ser
// feliz… o en trabajar para conseguir más?"
//   A  DOOR → the pause after "…vida…"  wide from behind Nubi: TIMECO's gigantic door slowly
//      opens, light and fog spill out, Nubi a small silhouette with its red counter ticking.
//   B  → BLACK  medium close-up from the front: Nubi turns to the camera, the door's light
//      behind it (rim light), and asks calmly; its red counter "00:00:0X" ticks. The comment
//      card sits in y 230-700 from L15 + 60, so the counter stays below it (panel top ≥ 720).
//      In the last frames Nubi starts turning towards the open door.

/** The cut: in the pause after "…de vida…" (A covers the first half of the question). */
const CUT = TIEMPO.wordEnd("L15", 6) + 4;
const DOOR_Z = GATE.front;

/** The door's opening 0..1 (slow, heavy). */
export const puertaOpen = (g: number) => ramp(g, FINAL.DOOR + 2, FINAL.DOOR + 84, [0, 1], (x) => 0.5 - 0.5 * Math.cos(Math.PI * x));

export const PuertaShot: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + SHOTS.puerta.from;
  const t = g / 30;
  const { DOOR, FELIZ, TRABAJAR, BLACK } = FINAL;
  const open = puertaOpen(g);
  const N = DOOR_NUBI;

  let cam: Cam;
  let rotY: number;
  let pose: NubiPose;
  let anchorY: number;
  let counterMin: number;
  if (g < CUT) {
    // ---- A: the door opens; Nubi stands still in front of it (back to us), a small shiver.
    rotY = Math.PI;
    pose = tiempoTalk(g, { squash: 0.98 + 0.01 * Math.sin(g * 0.2), roll: 0.015 * Math.sin(g * 2.1), lookY: 0.5, finL: -0.05, finR: -0.05, eyeScale: 1.2 }, 0.5);
    const u = ramp(g, DOOR, CUT, [0, 1], (x) => x);
    const pos: Vec3 = [N[0] + 0.9, 2.1 + 0.6 * u, N[2] + 21 - 2.5 * u];
    cam = aim(pos, 48, [N[0], 0, N[2]], 540, 1262);
    anchorY = 2.2;
    counterMin = 0.9;
  } else {
    // ---- B: turn to the camera, ask; at the end, turn back towards the light.
    const turnIn = ramp(g, CUT, CUT + 16, [0, 1], EASE_OUT);
    const turnOut = ramp(g, BLACK - 22, BLACK + 6, [0, 1], EASE_IN_OUT);
    rotY = Math.PI * 0.72 * (1 - turnIn) + 0.06 + Math.PI * 0.7 * turnOut;
    const happy = windowIn(g, FELIZ - 2, FELIZ + 22, 5);
    const work = ramp(g, TRABAJAR - 2, TRABAJAR + 10);
    const base: NubiPose = {
      squash: 1 + 0.012 * Math.sin(g * 0.13) - 0.03 * work,
      eyeScale: 0.95 + 0.1 * happy - 0.08 * work,
      lookY: 0.05 + 0.15 * happy - 0.12 * work,
      lookX: -0.25 * (1 - turnIn) - 0.5 * turnOut,
      finL: 0.08 + 0.35 * happy - 0.25 * work,
      finR: 0.08 + 0.35 * happy - 0.25 * work,
      pitch: 0.04 * work,
    };
    pose = tiempoTalk(g, base, 0.7);
    const push = ramp(g, CUT, BLACK, [0, 0.7], (x) => x);
    const pos: Vec3 = [N[0] + 0.55, 1.5, N[2] + 9.7 - push];
    cam = aim(pos, 40, [N[0], 0, N[2]], 540, 1500);
    anchorY = 2.12;
    counterMin = 1.0;
  }
  const head: Vec3 = [N[0], anchorY + (pose.hop ?? 0) * 0.2, N[2]];
  const ctr = counterAt(cam, head, { min: counterMin, max: 1.3 });
  const rim = 0.4 + 2.6 * open;
  return (
    <AbsoluteFill style={{ background: TIMECO_SKY }}>
      <Stage cam={cam} far={2600}>
        <TimecoLights red={1.2} k={0.9} />
        <TimecoFog near={70} far={900} />
        {/* The door's light from behind (rim) and a soft cool fill from the front. */}
        <directionalLight position={[N[0], 7, DOOR_Z - 8]} intensity={rim} color="#FFE6B8" />
        <pointLight position={[N[0], 1.6, N[2] - 3]} intensity={6 * open} distance={9} decay={1.4} color="#FFD79A" />
        <directionalLight position={[N[0] + 2, 3, N[2] + 12]} intensity={g < CUT ? 0.35 : 1.0} color="#B9C8FF" />
        <TimeCity t={t} />
        <TimecoTower t={t} door={open} doorGlow={Math.min(1, 0.25 + open * 2)} />
        <DoorSpill open={open} t={t} />
        <Nubi size={2} position={N} rotationY={rotY} pose={pose} shadowOpacity={0.55} />
        <Halo color="#FFE2A8" size={g < CUT ? 5 : 3.4} opacity={0.35 * open} position={[N[0], 1.2, N[2] - 1.4]} />
      </Stage>
      {!ctr.behind ? (
        <LifeCounter frame={g} seconds={nubiSeconds(g)} events={NUBI_EVENTS} draining={nubiDraining(g)} frozen={nubiHolding(g)} x={ctr.x} y={ctr.y} scale={ctr.scale} />
      ) : null}
    </AbsoluteFill>
  );
};

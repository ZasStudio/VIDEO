import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { EASE_IN, EASE_IN_OUT, EASE_OUT, ramp } from "../../anim";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import { flicker } from "../../three/matusita/Flashlight";
import { Doppelganger, HeldTorch, ROOM, ROOM_DOOR, ROOM_SIT, ROOM_THRESHOLD, Room, RoomLights, sitAt, yawTo } from "../../three/matusita/Room";
import { SUSTO } from "../beats";
import { SHOTS } from "../shots";
import { matusitaTalk } from "../talk";

// "Puerta" (SUSTO.START → SUSTO.END), still the camcorder footage of the legend (a 2D VHS layer is
// drawn on top, so the camera has a subtle handheld wobble). L08: "Dicen que salió dos horas
// después, gritando que había visto algo que no debía estar ahí."
//   A  START → DOOR + 20  inside Nubi's room, looking at its door: at DOOR it bursts open and Nubi
//      stands in the doorway with its flashlight, panting, the pitch-dark hallway behind it.
//   B  → OFF  over Nubi's shoulder from the doorway: the other Nubi sits in the chair facing its
//      camera (back to us), lit by the ring light and the monitor (whose feed shows its face). Nothing
//      moves. At TURN it slowly swivels round to stare at us, eyes too wide, never blinking.
//   C  OFF  it switches its flashlight off, the room's lights die with it: black (a 2D glitch cut
//      sits on top).

const CUT_B = SUSTO.DOOR + 20;
/** The door flung open against the wall (radians). */
const DOOR_FLUNG = 2.72;
/** A: the camera inside the room (outside the one-sided front wall), the chair out of frame. */
const CAM_A: Vec3 = [-3.3, 1.7, 6.8];
/** B: the camera in the hallway, looking over Nubi (in the doorway) at the chair. */
const CAM_B: Vec3 = [-3.6, 3.0, -7.1];
/** Where Nubi stands in B: in the hallway behind the door, looking in at the chair. Only its
 *  shoulder shows, in the bottom-left corner (the other one dominates the frame). */
const PEEK: Vec3 = [ROOM_DOOR.x + 0.6, 0, ROOM.zBack - 2.3];
/** Its back is in the dark hallway: a shadowed tone, so it reads as a near-silhouette. */
const SHADOWED = { body: "#2F5239" };
const PEEK_YAW = yawTo(ROOM_SIT, PEEK);

/** Handheld camcorder wobble (small, slow, deterministic). */
const wobble = (cam: Cam, g: number, amp = 1): Cam => ({
  ...cam,
  position: [
    cam.position[0] + amp * (0.018 * Math.sin(g * 0.11) + 0.008 * Math.sin(g * 0.31 + 1)),
    cam.position[1] + amp * (0.014 * Math.sin(g * 0.13 + 2) + 0.006 * Math.sin(g * 0.37)),
    cam.position[2],
  ],
  target: [cam.target[0] + amp * 0.03 * Math.sin(g * 0.07 + 0.5), cam.target[1] + amp * 0.025 * Math.sin(g * 0.09 + 1.3), cam.target[2]],
  roll: (cam.roll ?? 0) + amp * 0.008 * Math.sin(g * 0.06 + 0.7),
});

export const PuertaShot: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + SHOTS.puerta.from;
  const t = g / 30;
  const { DOOR, L08, TURN, OFF } = SUSTO;
  /** At the click everything goes black: its face, the room's lights (a 2D glitch cut sits on top). */
  const black = g >= OFF;
  const rimTarget = useMemo(() => new THREE.Object3D(), []);

  if (g < CUT_B) {
    // ---- A: the door bursts open; Nubi in the doorway, panting.
    // Flung open against the wall, a small bounce back.
    const fling = ramp(g, DOOR, DOOR + 5, [0, 1], EASE_IN);
    const bounce = g >= DOOR + 5 ? 0.3 * Math.exp(-(g - DOOR - 5) / 5) * Math.abs(Math.sin((g - DOOR - 5) * 0.55)) : 0;
    const door = DOOR_FLUNG * fling - bounce;
    const pant = Math.sin((g - DOOR) * 0.55);
    const pantK = ramp(g, DOOR, DOOR + 30, [1, 0.6]);
    const base: NubiPose = {
      squash: 1 + 0.045 * pant * pantK,
      eyeScale: 1.35,
      lookX: 0.3 * Math.sin((g - DOOR) * 0.12),
      lookY: -0.05,
      finR: 0.55 - 0.3 * ramp(g, DOOR, DOOR + 10),
      finL: 0.35,
      pitch: -0.04 + 0.03 * pant,
      hop: g >= DOOR ? 1.2 * (1 - ramp(g, DOOR, DOOR + 6)) : 0,
    };
    const pose = g >= L08 ? matusitaTalk(g, base, 0.7) : base;
    const cam = wobble(aim(CAM_A, 40, [ROOM_THRESHOLD[0], 0, ROOM_THRESHOLD[2]], 540, 1240), g);
    const tremble = 0.05 * Math.sin(g * 1.7);
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <Shake frame={g} impacts={[{ at: DOOR, amp: 22, dur: 12 }]}>
          <Stage cam={cam} near={0.05}>
            <RoomLights lights={0.9} />
            <Room t={t} door={door} rec={1} />
            {g >= DOOR - 1 ? (
              <Nubi
                size={2}
                position={ROOM_THRESHOLD}
                rotationY={Math.atan2(CAM_A[0] - ROOM_THRESHOLD[0], CAM_A[2] - ROOM_THRESHOLD[2]) + 0.25}
                pose={pose}
                shadowOpacity={0.4}
                holdL={<HeldTorch raise={pose.finL ?? 0} side="L" pitch={0.05 + tremble} turn={-0.15} on={flicker(g, 5, 0.6)} intensity={45} beam={0.2} />}
              />
            ) : null}
          </Stage>
        </Shake>
      </AbsoluteFill>
    );
  }

  // ---- B / C: over Nubi's shoulder, the other Nubi in the chair.
  const turnK = ramp(g, TURN, TURN + 66, [0, 1], EASE_IN_OUT);
  const stareYaw = yawTo(CAM_B);
  const turn = stareYaw * turnK;
  // As it turns it brings its flashlight up under its chin: its own uplight becomes the key on
  // its face (campfire-story light, like the hook). At OFF it clicks it off.
  const chin = ramp(g, TURN, TURN + 15, [0, 1], EASE_IN_OUT);
  const push = ramp(g, CUT_B, OFF, [0, 1], (x) => x);
  const close = ramp(g, TURN + 40, OFF, [0, 1], EASE_IN_OUT);
  const face: Vec3 = [sitAt(turn)[0], ROOM_SIT[1] + 1.15, sitAt(turn)[2]];
  const from = lerp3(CAM_B, face, 0.07 * push + 0.05 * close);
  const cam = wobble(aim(from, 44, face, 580, 760 + 20 * close), g, 0.8);
  // Nubi (foreground, a near-silhouette in the hallway) trembles; it shrinks back when the other
  // one turns. Its flashlight (left fin, the side we see) dips off the other one's face then.
  const recoil = ramp(g, TURN + 10, TURN + 40, [0, 1], EASE_OUT);
  const base: NubiPose = {
    squash: 0.98 - 0.05 * recoil + 0.012 * Math.sin(g * 0.5),
    roll: 0.02 * Math.sin(g * 2.3) * (0.5 + recoil),
    eyeScale: 1.3 + 0.2 * recoil,
    finL: 0.3,
    finR: -0.2 - 0.2 * recoil,
  };
  const pose = g < TURN ? matusitaTalk(g, base, 0.35) : { ...base };
  pose.finL = 0.3;
  const lights = 1 - 0.12 * recoil * (1 - flicker(g, 9, 0.5));
  const intruderTorch = flicker(g, 7, 0.4);
  const dip = ramp(g, TURN, TURN + 15, [0, 1], EASE_IN_OUT);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {!black ? (
        <Stage cam={cam} near={0.05}>
          <RoomLights lights={lights * 0.85} moon={0.15} />
          {/* The room's light spilling through the doorway: a thin rim on Nubi's silhouette. */}
          <directionalLight position={[PEEK[0] + 0.8, 1.6, PEEK[2] + 6]} target={rimTarget} intensity={1.6 * lights} color="#FFDDB0" />
          <primitive object={rimTarget} position={[PEEK[0], 1.0, PEEK[2]]} />
          <Room t={t} door={DOOR_FLUNG} chairYaw={turn} feedYaw={turn} rec={1} lights={lights} />
          <Doppelganger turn={turn} torch={1} stare={close} chin={chin} />
          <Nubi
            size={2}
            position={PEEK}
            rotationY={PEEK_YAW}
            pose={pose}
            palette={SHADOWED}
            shadowOpacity={0.4}
            holdL={
              <HeldTorch
                raise={0.3}
                side="L"
                pitch={-0.04 + 0.22 * dip + 0.03 * Math.sin(g * 1.9)}
                turn={0.04 * Math.sin(g * 0.7)}
                on={intruderTorch}
                intensity={45 - 33 * dip}
                beam={0.12 - 0.05 * dip}
                reach={9}
              />
            }
          />
        </Stage>
      ) : null}
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, pop, ramp } from "../../anim";
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
/** Where Nubi stops, a step into the room, to look at the chair (B). */
const PEEK: Vec3 = [ROOM_DOOR.x + 0.3, 0, ROOM.zBack + 0.75];
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
  const dark = g >= OFF;

  if (g < CUT_B) {
    // ---- A: the door bursts open; Nubi in the doorway, panting.
    const burst = g >= DOOR ? pop(g, DOOR, { damping: 10, stiffness: 260, mass: 0.6 }) : 0;
    const door = 1.72 * burst;
    const pant = Math.sin((g - DOOR) * 0.55);
    const pantK = ramp(g, DOOR, DOOR + 30, [1, 0.6]);
    const base: NubiPose = {
      squash: 1 + 0.045 * pant * pantK,
      eyeScale: 1.35,
      lookX: 0.3 * Math.sin((g - DOOR) * 0.12),
      lookY: -0.05,
      finL: 0.55 - 0.3 * ramp(g, DOOR, DOOR + 10),
      finR: 0.35,
      pitch: -0.04 + 0.03 * pant,
      hop: g >= DOOR ? 1.2 * (1 - ramp(g, DOOR, DOOR + 6)) : 0,
    };
    const pose = g >= L08 ? matusitaTalk(g, base, 0.7) : base;
    const pos: Vec3 = [-3.05, 1.15, 1.85];
    const cam = wobble(aim(pos, 45, [ROOM_THRESHOLD[0], 0, ROOM_THRESHOLD[2]], 560, 1230), g);
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
                rotationY={-0.25}
                pose={pose}
                shadowOpacity={0.4}
                holdR={<HeldTorch raise={pose.finR ?? 0} pitch={0.05 + tremble} turn={0.15} on={flicker(g, 5, 0.6)} intensity={45} beam={0.2} />}
              />
            ) : null}
          </Stage>
        </Shake>
      </AbsoluteFill>
    );
  }

  // ---- B / C: over Nubi's shoulder, the other Nubi in the chair.
  const turnK = ramp(g, TURN, TURN + 66, [0, 1], EASE_IN_OUT);
  const camPos: Vec3 = [ROOM_DOOR.x - 0.1, 2.45, ROOM.zBack - 0.45];
  const stareYaw = yawTo(camPos);
  const turn = stareYaw * turnK;
  const push = ramp(g, CUT_B, OFF, [0, 1], (x) => x);
  const close = ramp(g, TURN + 40, OFF, [0, 1], EASE_IN_OUT);
  const face: Vec3 = [sitAt(turn)[0], ROOM_SIT[1] + 1.15, sitAt(turn)[2]];
  const from = lerp3(camPos, face, 0.12 * push + 0.22 * close);
  const cam = wobble(aim(from, 48, face, 590, 700 + 40 * close), g, 0.8);
  // Nubi (foreground) trembles; it shrinks back when the other one turns.
  const recoil = ramp(g, TURN + 10, TURN + 40, [0, 1], EASE_OUT);
  const base: NubiPose = {
    squash: 0.98 - 0.05 * recoil + 0.012 * Math.sin(g * 0.5),
    roll: 0.02 * Math.sin(g * 2.3) * (0.5 + recoil),
    eyeScale: 1.3 + 0.2 * recoil,
    finL: -0.2 - 0.2 * recoil,
    finR: 0.3,
  };
  const pose = g < TURN ? matusitaTalk(g, base, 0.35) : base;
  const lights = dark ? 0 : 1 - 0.12 * recoil * (1 - flicker(g, 9, 0.5));
  const torchOn = dark ? 0 : 1;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {!dark ? (
        <Stage cam={cam} near={0.05}>
          <RoomLights lights={lights} moon={0.8} />
          <Room t={t} door={1.72} chairYaw={turn} feedYaw={turn} rec={1} lights={lights} />
          <Doppelganger turn={turn} torch={torchOn} stare={close} />
          <Nubi
            size={2}
            position={PEEK}
            rotationY={PEEK_YAW}
            pose={pose}
            shadowOpacity={0.4}
            holdR={<HeldTorch raise={0.3} pitch={0.12 + 0.03 * Math.sin(g * 1.9)} turn={0.05 * Math.sin(g * 0.7)} on={torchOn * flicker(g, 7, 0.4)} intensity={35} beam={0.12} />}
          />
        </Stage>
      ) : null}
    </AbsoluteFill>
  );
};

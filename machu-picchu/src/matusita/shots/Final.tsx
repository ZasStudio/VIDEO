import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, ramp } from "../../anim";
import { Shake, Stage } from "../../scenes/common";
import { Nubi, NubiPose } from "../../three/Nubi";
import { flicker } from "../../three/matusita/Flashlight";
import { DOPPEL_POSE, DOPPEL_TORCH, FACE_DOOR_YAW, HeldTorch, Room, RoomLights, sitAt } from "../../three/matusita/Room";
import { FINAL } from "../beats";
import { SHOTS } from "../shots";
import { matusitaTalk } from "../talk";
import { roomCam } from "./Cuarto";

// "Final" (FINAL.START → FINAL.BLACK), L11 whispered: "Pero si nunca pasó nada… entonces, ¿por qué
// siento que alguien acaba de entrar?" Same creator camera as "cuarto".
//   TURN   Nubi spins round in its chair to the door: nobody, but the door is ajar (a dark gap),
//          its flashlight on it; the lights flicker.
//   BACK   it turns back to the camera, slowly, and whispers L11 to the viewer.
//   ALGUIEN  the door behind it starts to close by itself; CLICK: shut.
//   Then Nubi goes still like the other one (eyes too wide, flashlight at the desk) and its
//   flashlight and the room's lights stutter and die just before BLACK: the loop back to the start.

const AJAR = 0.75;

export const FinalShot: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + SHOTS.final.from;
  const t = g / 30;
  const { TURN, BACK, L11, ALGUIEN, CLICK, BLACK } = FINAL;

  // ---- The door: ajar from the start; closes slowly by itself from ALGUIEN to CLICK.
  const closing = ramp(g, ALGUIEN, CLICK, [0, 1], Easing.bezier(0.45, 0, 0.75, 1));
  const door = AJAR * (1 - closing);
  const latch = g >= CLICK ? Math.exp(-(g - CLICK) / 2.5) : 0;

  // ---- Nubi: spin round, look, turn back slowly, whisper; go still at the end.
  const spin = ramp(g, TURN, TURN + 9, [0, 1], Easing.bezier(0.2, 0.9, 0.3, 1.15));
  const back = ramp(g, BACK, BACK + 26, [0, 1], EASE_IN_OUT);
  const yaw = FACE_DOOR_YAW * spin * (1 - back);
  const still = ramp(g, CLICK + 2, CLICK + 8, [0, 1], EASE_OUT);
  const dread = ramp(g, ALGUIEN, CLICK, [0, 1], (x) => x);
  let pose: NubiPose = {
    squash: 0.97 + 0.03 * Math.sin(g * 0.21) * (1 - still),
    eyeScale: 1.25 + 0.1 * dread,
    finL: 0.25 - 0.35 * back,
    finR: 0.45 - 0.35 * back,
    roll: 0.012 * Math.sin(g * 2.1) * (1 - still),
    lookY: 0.05,
    hop: g < TURN + 9 ? 0.8 * Math.sin(Math.PI * spin) : 0,
  };
  if (g >= L11 && g < CLICK) pose = matusitaTalk(g, pose, 0.45);
  if (still > 0) {
    // Mirror the other one: perfectly still, eyes a touch too wide, no blink.
    const k = still;
    pose = {
      ...pose,
      squash: (pose.squash ?? 1) * (1 - k) + (DOPPEL_POSE.squash ?? 1) * k,
      eyeScale: (pose.eyeScale ?? 1) * (1 - k) + (DOPPEL_POSE.eyeScale ?? 1) * k + 0.06 * k,
      finL: (pose.finL ?? 0) * (1 - k) + (DOPPEL_POSE.finL ?? 0) * k,
      finR: (pose.finR ?? 0) * (1 - k) + (DOPPEL_POSE.finR ?? 0) * k,
      roll: (pose.roll ?? 0) * (1 - k),
      pitch: (pose.pitch ?? 0) * (1 - k),
      yaw: (pose.yaw ?? 0) * (1 - k),
      hop: 0,
      wiggle: 0,
      blink: 0,
      lookX: 0,
      lookY: 0,
    };
  }
  const torchPitch = 0.02 * (1 - back) + (0.45 * back) * (1 - still) + DOPPEL_TORCH.pitch * still;

  // ---- Lights: flicker as it spins, steady and dim while it whispers, then stutter and die.
  const spinFlick = g < BACK + 10 ? flicker(g, 21, 1.6) : 1;
  // The room's lights stutter out first, then the flashlight (like the other one switching off).
  const OUT = BLACK - 7;
  const dieFlick = g >= CLICK + 2 ? flicker(g, 33, 3.5) * (1 - ramp(g, OUT - 4, OUT, [0, 1], (x) => x)) : 1;
  const lights = 0.8 * spinFlick * dieFlick;
  const torch = g >= OUT + 3 ? 0 : g >= CLICK + 2 ? flicker(g + 3, 41, 2.5) * (g >= OUT ? 0.5 : 1) : 1;
  const moon = 1 - ramp(g, CLICK + 4, OUT + 2, [0, 0.85], (x) => x);

  // ---- Camera: the creator camera, a slow creep in while it whispers.
  const cam = roomCam(0.12 + ramp(g, BACK, CLICK, [0, 0.1], (x) => x));

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Shake frame={g} impacts={[{ at: TURN, amp: 6, dur: 10 }, { at: CLICK, amp: 4, dur: 6 }]}>
        <Stage cam={cam} near={0.05}>
          <RoomLights lights={lights} moon={moon} />
          <Room t={t} lights={lights} desk={false} door={door} rattle={latch} chairYaw={yaw} />
          <Nubi
            size={2}
            position={sitAt(yaw)}
            rotationY={yaw}
            pose={pose}
            shadow={false}
            holdR={<HeldTorch raise={pose.finR ?? 0} pitch={torchPitch} turn={0.3 * back * (1 - still)} on={torch} intensity={back > 0.5 ? 14 : 34} beam={0.14} reach={back > 0.5 ? 4 : 7} />}
          />
        </Stage>
      </Shake>
      {/* Black once the flashlight is out. */}
      <AbsoluteFill style={{ background: "#000", opacity: ramp(g, OUT + 2, OUT + 4, [0, 1], (x) => x) }} />
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, pop, ramp, windowIn } from "../../anim";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import { HeldTorch, ROOM_SIT, Room, RoomLights } from "../../three/matusita/Room";
import { VERDAD } from "../beats";
import { SHOTS } from "../shots";
import { matusitaTalk } from "../talk";

// "Cuarto" (VERDAD.START → VERDAD.END): the real present, no VHS. Nubi's own room at night; the
// camera is its creator camera on the desk, looking at Nubi in its chair with the door behind it.
//   From black; at BREATH the flashlight clicks on, Nubi takes a deep breath (the body swells and
//   relaxes) and the room's warm lights come back slowly. L09 calmly to the camera ("…nunca
//   ocurrió…" a shrug; "…para televisión" a little flourish). L10, relieved: it slumps back and
//   lowers the flashlight. At KNOCK two knocks on the door behind it: it freezes, eyes wide.

/** The creator camera: Nubi's base at (x, y) on screen, the door readable on the left. */
export const ROOM_CAM_POS: Vec3 = [ROOM_SIT[0] + 0.9, 2.6, ROOM_SIT[2] + 15.2];
export const roomCam = (push = 0): Cam => {
  const pos = lerp3(ROOM_CAM_POS, [ROOM_SIT[0], 1.9, ROOM_SIT[2]], push);
  return aim(pos, 33, ROOM_SIT, 690 - 40 * push, 1250);
};

/** Two knocks: 1 on each hit, decaying fast. */
const knocks = (g: number, at: number) => {
  const k = (s: number) => (g >= s ? Math.exp(-(g - s) / 2.2) : 0);
  return Math.min(1, k(at) + k(at + 9));
};

export const CuartoShot: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + SHOTS.cuarto.from;
  const t = g / 30;
  const { BREATH, L09, NUNCA, TELE, L10, MENTIRA, KNOCK } = VERDAD;

  // ---- Light: black, then the flashlight clicks on and the room comes back slowly.
  const torch = g >= BREATH ? 1 : 0;
  const lights = ramp(g, BREATH + 4, BREATH + 60, [0, 1], EASE_IN_OUT);
  const moon = ramp(g, BREATH, BREATH + 30, [0, 1], EASE_OUT);

  // ---- Nubi.
  const inhale = ramp(g, BREATH, BREATH + 20, [0, 1], EASE_IN_OUT);
  const exhale = ramp(g, BREATH + 24, BREATH + 50, [0, 1], EASE_IN_OUT);
  const breath = inhale * (1 - exhale);
  const shrug = windowIn(g, NUNCA - 3, NUNCA + 26, 6);
  const flourish = windowIn(g, TELE - 2, TELE + 22, 6);
  const relief = ramp(g, L10 - 4, L10 + 24, [0, 1], EASE_IN_OUT);
  const chuckle = g >= MENTIRA && g < MENTIRA + 14 ? Math.abs(Math.sin(((g - MENTIRA) / 14) * Math.PI * 2)) : 0;
  const knock = knocks(g, KNOCK);
  const frozen = g >= KNOCK;
  const startle = frozen ? pop(g, KNOCK, { damping: 9, stiffness: 300 }) : 0;

  let pose: NubiPose = {
    squash: (1 + 0.08 * breath - 0.03 * exhale * (1 - relief)) * (1 - 0.07 * relief),
    blink: g < BREATH + 22 ? 0.85 * (g >= BREATH ? 1 - ramp(g, BREATH + 16, BREATH + 24) : 1) : 0,
    eyeScale: 1 - 0.18 * relief,
    pitch: -0.02 - 0.1 * relief,
    finL: 0.15 + 0.35 * breath + 0.55 * shrug + 0.5 * flourish - 0.45 * relief,
    finR: 0.25 + 0.3 * breath + 0.45 * shrug - 0.5 * relief,
    roll: 0.06 * flourish * Math.sin((g - TELE) * 0.3),
    hop: 0.6 * chuckle,
    lookY: -0.1 * relief,
  };
  if (g >= L09 && !frozen) pose = matusitaTalk(g, pose, 0.65);
  if (frozen) {
    // Freeze: no talk, stiff, eyes snap wide and glance towards the door side.
    pose = {
      squash: 1 + 0.06 * startle - 0.02 * knock,
      eyeScale: 1.1 + 0.42 * startle,
      pitch: 0.02,
      finL: -0.1 + 0.55 * startle,
      finR: -0.25 + 0.6 * startle,
      lookX: -0.55 * ramp(g, KNOCK + 12, KNOCK + 18, [0, 1], EASE_OUT),
      lookY: 0.05,
      hop: 0.5 * startle * (1 - ramp(g, KNOCK, KNOCK + 8)),
    };
  }
  const torchRaise = pose.finR ?? 0;
  const torchPitch = 0.55 + 0.5 * relief - 0.35 * (frozen ? startle : 0);

  // ---- Camera: locked off on the tripod, a slow creep in; a small snap in on the knocks.
  const creep = ramp(g, BREATH, KNOCK, [0, 0.05], (x) => x) + ramp(g, KNOCK, KNOCK + 14, [0, 0.07], EASE_OUT);
  const cam = roomCam(creep);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Shake frame={g} impacts={[{ at: KNOCK, amp: 5, dur: 7 }, { at: KNOCK + 9, amp: 5, dur: 7 }]}>
        <Stage cam={cam} near={0.05}>
          <RoomLights lights={lights} moon={moon} />
          <Room t={t} lights={lights} desk={false} rattle={knock} />
          <Nubi
            size={2}
            position={ROOM_SIT}
            rotationY={0}
            pose={pose}
            shadow={false}
            holdR={<HeldTorch raise={torchRaise} pitch={torchPitch} turn={-0.1} on={torch} intensity={30} beam={0.14} />}
          />
        </Stage>
      </Shake>
      {/* Fade up from black. */}
      <AbsoluteFill style={{ background: "#000", opacity: 1 - ramp(g, BREATH, BREATH + 10, [0, 1], EASE_OUT) }} />
    </AbsoluteFill>
  );
};

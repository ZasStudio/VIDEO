import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, ramp, windowIn } from "../../anim";
import { Shake, Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { Vec3 } from "../../three/CameraRig";
import { NubiPose } from "../../three/Nubi";
import { Drill, HALL, HALL_BG, HallLights, NeighbourHall, SoundRings, Speaker, Vecino } from "../../three/dormir/Street";
import { ENEMIGO } from "../beats";
import { SHOTS } from "../shots";
import { vecinoTalk } from "../talk";
import { DORMIR } from "../timeline";

// Shot "vecino" (ENEMIGO.REVEAL → ENEMIGO.L14): who's drilling. The hallway by Nubi's flat: the
// neighbour (blue-grey, backwards cap, half-lidded smug eyes, one brow up) stands in his open
// doorway holding a power drill that isn't even on (the bit never turns, the unplugged cord
// dangles), while a Bluetooth speaker on a stool beside him blasts the construction noise (the
// pumping cone, yellow sound rings) and he nods along. His cardboard sign on the wall: «SE VENDE
// SILENCIO». L13 «Cincuenta soles… y hago silencio.»: he holds out his fin for the payment and
// beckons ("gimme"), then on "silencio" the brow goes up, smug. The band y 260–520 stays a calm
// wall for the «SILENCIO: S/50 la hora» sticker.

const FPS = 30;
const FOV = 38;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

const SOLES = DORMIR.wordAt("L13", 1);
const SILENCIO = DORMIR.wordAt("L13", 4);

export const VecinoShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.vecino.from;
  const { REVEAL, L13, L14 } = ENEMIGO;
  const t = g / FPS;

  // ---- The speaker's jackhammer rhythm (4-frame pattern) and the neighbour nodding along.
  const beat = [1, 0.55, 0.15, 0.65][((g % 4) + 4) % 4];
  const nod = Math.sin(g * 0.52);

  // ---- The neighbour: smug idle → holds out his fin on "Cincuenta" → beckons on "soles" → the
  // brow goes up on "silencio".
  const offer = windowIn(g, L13 - 2, L14 + 4, 5);
  const gimme = windowIn(g, SOLES - 2, SILENCIO - 2, 3) * Math.max(0, Math.sin((g - SOLES) * 0.95));
  const smug = windowIn(g, SILENCIO - 2, L14 + 4, 4);
  const base: NubiPose = {
    hop: 0.25 * Math.max(0, nod) * (1 - offer * 0.6),
    squash: 1 + 0.02 * nod,
    roll: 0.06 + 0.04 * nod * (1 - offer) - 0.05 * smug,
    yaw: 0.12 - 0.42 * offer,
    pitch: -0.03 + 0.06 * offer - 0.05 * smug,
    finL: 0.42 + 0.06 * nod,
    finR: 0.1 + 0.55 * offer + 0.35 * gimme,
    lookX: 0.15 + 0.08 * offer,
    lookY: -0.05 + 0.1 * smug,
    wiggle: 0.18,
    wigglePhase: g * 0.5,
  };
  const pose = vecinoTalk(g, base, 0.85);
  const raise = 0.45 + 1.0 * smug + 0.3 * windowIn(g, L13, SOLES, 3);
  const droop = 0.52 + 0.08 * smug;

  // ---- Camera: a punch-in reveal on the cut, then a slow push towards him during the line.
  const punch = ramp(g, REVEAL, REVEAL + 9, [0, 1], EASE_OUT);
  const push = ramp(g, L13, L14, [0, 1], EASE_IN_OUT);
  const dist = lerp(14.8, 12.6, punch) - 0.8 * push;
  const camPos: Vec3 = [0.2 - 0.2 * push, 1.8, HALL.vecino[2] + dist];
  const cam = aim(camPos, FOV, [HALL.vecino[0] - 0.05, 0.95, HALL.vecino[2]], 540, 1030 + 20 * push);

  // The drill: in the screen-left fin, pointing out and a little up; the cord hangs plumb.
  const finAngle = (pose.finL ?? 0) * 0.55;
  const drill = (
    <group position={[0.2, -0.2, 0.6]} rotation={[0, Math.PI, 0.32]} scale={3.0}>
      <Drill hang={-0.32 + finAngle} swing={0.1 * Math.sin(t * 3.1)} />
    </group>
  );

  const [sx, , sz] = HALL.stool;
  const blur = 7 * (1 - punch);
  return (
    <AbsoluteFill style={{ background: HALL_BG }}>
      <Shake
        frame={g}
        impacts={[
          { at: REVEAL, amp: 5, dur: 10 },
          { at: SILENCIO, amp: 2, dur: 6 },
        ]}
      >
        <AbsoluteFill style={{ filter: blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : undefined, transform: `translate(${Math.sin(g * 2.1) * 2 * beat}px, ${Math.cos(g * 1.7) * 1.5 * beat}px)` }}>
          <Stage cam={cam} near={0.1}>
            <HallLights />
            <NeighbourHall />
            <group position={[sx, HALL.stoolH, sz]} rotation={[0, -0.32, 0]}>
              <Speaker beat={beat} />
              <group position={[0, 0.33, 0.3]}>
                <SoundRings g={g} every={6} life={20} reach={1.4} />
              </group>
            </group>
            <Vecino position={HALL.vecino} rotationY={0.05} pose={pose} droop={droop} raise={raise} holdL={drill} />
          </Stage>
        </AbsoluteFill>
      </Shake>
    </AbsoluteFill>
  );
};

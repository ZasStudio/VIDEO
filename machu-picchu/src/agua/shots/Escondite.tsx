import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, ramp, windowIn } from "../../anim";
import { Upright } from "../../inca/outfit";
import { Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { finTipWorld } from "../../thanos/cast";
import { Vec3 } from "../../three/CameraRig";
import { DustPuff } from "../../three/Effects3D";
import { Nubi, NubiPose } from "../../three/Nubi";
import { BOTTLE_HOLD, BOTTLE_HOLE, WaterBottle } from "../../three/agua/Bottle";
import {
  BigDrop,
  Civilian,
  DropTrail,
  DryStreet,
  HIDE_SPOT,
  HOT_SKY,
  HotLights,
  POLE_HIDE,
  alongPath,
  civilianLook,
  civilianWalk,
  streetGroundY,
} from "../../three/agua/Street";
import { GIRO } from "../beats";
import { SHOTS } from "../shots";
import { aguaTalk } from "../talk";

// "Giro": hidden behind the dumpster in alley A, Nubi unscrews the cap ("Por fin…") — "¡NO!" it's
// empty, and turned over there's a hole in the bottom. Top-down: a glowing trail of drops runs
// from alley B past the thin pole across the street to Nubi's hiding spot, the crowd following it
// like ants ("¡Me seguían porque… dejaba un rastro de agua!"). Close-up: the last drop swells at the
// hole and falls in slow motion; Nubi dives off the dumpster at it, fins out — the drop hits the
// ground and evaporates just before Nubi lands ("¡NOOO!").

const Y = 0.16;
const NUBI_AT: Vec3 = HIDE_SPOT;
const CAM_A: Vec3 = [-6.6, 4.6, 11.3];
const NUBI_ROT = Math.atan2(CAM_A[0] - NUBI_AT[0], CAM_A[2] - NUBI_AT[2]);

/** The trail of leaked drops: alley B → the thin pole → across the road → alley A → the dumpster. */
const TRAIL: Vec3[] = [
  [7.6, Y, 11.55],
  [5.25, Y, 11.45],
  [4.35, Y, 8.4],
  [POLE_HIDE[0], Y, POLE_HIDE[2]],
  [1.6, 0, 7.6],
  [-2.5, 0, 10.2],
  [-6.6, Y, 11.5],
  [-8.4, Y, 12.3],
  [-9.0, Y, 13.15],
  [-10.6, Y, 13.15],
  [-11.2, Y, 12.4],
];
const ANTS = Array.from({ length: 13 }, (_, i) => ({ look: civilianLook(400 + i), lag: i * 1.35 + ((i * 7) % 5) * 0.08, side: ((i % 3) - 1) * 0.3, phase: i * 1.3 }));

/** The last drop: Nubi on top of the dumpster holds the bottle out over the alley floor. */
const DROP_NUBI: Vec3 = [-9.6, Y + 1.62, 12.0];
const DROP_ROT = 0;
const DROP_RAISE = 1.0;
const HOLE_LOCAL: Vec3 = [BOTTLE_HOLD.position[0] + BOTTLE_HOLE[0] * BOTTLE_HOLD.scale, BOTTLE_HOLD.position[1], BOTTLE_HOLD.position[2] + BOTTLE_HOLE[2] * BOTTLE_HOLD.scale];
const HOLE_W = finTipWorld(DROP_NUBI, DROP_ROT, 2, DROP_RAISE, 1, HOLE_LOCAL);
const DROP_SIZE = 0.085;
/** The dive (side view across the open end of alley A): where the drop lands and how high it falls from. */
const DIVE_LAND: Vec3 = [-7.6, Y, 11.55];
const DIVE_DROP_Y = 2.5;

export const EsconditeShot: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + SHOTS.escondite.from;
  const t = g / 30;
  const { OPEN, L14, NO, HOLE, TRAIL: TRAIL_AT, AGUA, DROP, DIVE } = GIRO;

  // ---- A: behind the dumpster (OPEN → TRAIL)
  if (g < TRAIL_AT) {
    const cap = ramp(g, OPEN + 2, L14 + 10, [0, 1], (x) => x);
    const lift = ramp(g, L14 + 12, NO - 4, [0, 1], EASE_IN_OUT);
    const no = ramp(g, NO, NO + 5);
    const flip = ramp(g, HOLE - 6, HOLE + 1, [0, 1], EASE_IN_OUT);
    const finR = 0.5 + 0.35 * lift - 0.2 * no + 0.45 * flip;
    const shakeZ = no * (1 - flip) * Math.sin(g * 1.4) * 0.35;
    const base: NubiPose = {
      squash: 0.93 + 0.05 * no,
      finR,
      finL: 0.25 + 0.5 * no * (1 - flip),
      eyeScale: 1.0 + 0.55 * no,
      lookX: 0.45 - 0.25 * lift + 0.2 * flip,
      lookY: 0.1 + 0.35 * lift + 0.3 * flip,
      hop: 1.4 * windowIn(g, NO, NO + 8, 3),
    };
    const pose = aguaTalk(g, base, 0.7);
    const rotX = Math.PI * flip;
    const holdPos: Vec3 = [BOTTLE_HOLD.position[0] - 0.4 * flip, BOTTLE_HOLD.position[1] + 3.94 * flip * 0.85 + 1.2 * flip, BOTTLE_HOLD.position[2] + 0.6 * flip];
    const glow = 0.6 * (1 - no);
    // HOLE: punch in on the bottom of the bottle.
    const holeLocal: Vec3 = [holdPos[0] + BOTTLE_HOLE[0] * 4, holdPos[1] + 0.2, holdPos[2] - BOTTLE_HOLE[2] * 4];
    const holeW = finTipWorld(NUBI_AT, NUBI_ROT, 2 * 1, finR, 1, holeLocal);
    const zoom = ramp(g, HOLE - 1, HOLE + 4, [0, 1], EASE_IN_OUT);
    const camA = aim(CAM_A, 50, [NUBI_AT[0], Y + 1.0, NUBI_AT[2]], 540, 820);
    const cam: Cam = zoom > 0 ? aim([CAM_A[0] - 1.2 * zoom, CAM_A[1] - 0.6 * zoom, CAM_A[2]], 50 - 30 * zoom, holeW, 540, 800) : camA;
    return (
      <AbsoluteFill style={{ background: HOT_SKY }}>
        <Shake frame={g} impacts={[{ at: NO, amp: 8, dur: 10 }]}>
          <Stage cam={cam}>
            <HotLights k={0.92} />
            <DryStreet t={t} />
            <Nubi
              size={2}
              position={NUBI_AT}
              rotationY={NUBI_ROT}
              pose={pose}
              shadowOpacity={0.45}
              holdR={
                <Upright raise={finR}>
                  <group position={holdPos} rotation={[rotX, 0, shakeZ - 0.15 * lift]} scale={BOTTLE_HOLD.scale}>
                    <WaterBottle fill={0} glow={glow} cap={cap} hole={g >= HOLE - 6} t={t} />
                  </group>
                </Upright>
              }
            />
          </Stage>
        </Shake>
      </AbsoluteFill>
    );
  }

  // ---- B: the drone shot of the trail (TRAIL → DROP)
  if (g < DROP) {
    const u = ramp(g, TRAIL_AT, DROP, [0, 1], (x) => x);
    const h = 29 - 3 * u;
    const centre: Vec3 = [-2.2, 0, 8.6 - 0.4 * u];
    const cam: Cam = { position: [centre[0], h, centre[2] + 0.01], target: centre, fov: 50, roll: Math.PI / 2 };
    const pulse = windowIn(g, AGUA - 3, AGUA + 14, 5);
    const lead = 12.6 + 2.0 * ((g - TRAIL_AT) / 30);
    return (
      <AbsoluteFill style={{ background: HOT_SKY }}>
        <Stage cam={cam} far={300}>
          <HotLights />
          <DryStreet t={t} far={false} />
          <DropTrail points={TRAIL} t={t} glow={1.0 + 0.8 * pulse} size={2.6 + 0.8 * pulse} spacing={0.45} />
          {ANTS.map((a, i) => {
            const { p, yaw } = alongPath(TRAIL, lead - a.lag);
            const x = p[0] + Math.cos(yaw) * a.side;
            const z = p[2] - Math.sin(yaw) * a.side;
            const walk = civilianWalk(t, a.phase);
            return <Civilian key={i} look={a.look} position={[x, streetGroundY(x, z), z]} rotationY={yaw} pose={{ ...walk, pitch: 0.25, lookY: -0.8, eyeScale: 1.25 }} t={t} thirst={0.6} />;
          })}
          <Nubi size={2} position={NUBI_AT} rotationY={NUBI_ROT} pose={{ squash: 0.86, eyeScale: 1.4, lookX: 0.5, blink: g % 50 < 3 ? 1 : 0 }} />
        </Stage>
      </AbsoluteFill>
    );
  }

  // ---- C: the last drop (DROP → DIVE): close-up at the hole, swelling and pinching off.
  // ---- D: the slow-motion dive (DIVE → END): the drop falls, Nubi dives off the dumpster at it.
  const hang = ramp(g, DROP, DIVE, [0, 0.36], (x) => x);
  const fallK = ramp(g, DIVE, DIVE + 40, [0.36, 1], (x) => x);
  const fall = g < DIVE ? hang : fallK;
  const splash = ramp(g, DIVE + 40, DIVE + 72, [0, 1], (x) => x);
  const close = g < DIVE;
  const dive = ramp(g, DIVE, DIVE + 56, [0, 1], (x) => x);
  const land = ramp(g, DIVE + 56, DIVE + 62);
  // Side view across the alley: the drop falls at DIVE_LAND, Nubi flies in from screen-left (+z)
  // fins out and belly-flops just past it, a beat after it has evaporated.
  const from: Vec3 = [DIVE_LAND[0], 1.25, 13.3];
  const to: Vec3 = [DIVE_LAND[0], Y, 10.75];
  const arc = Math.sin(Math.PI * Math.min(1, dive)) * 0.35;
  const diveAt: Vec3 = close ? DROP_NUBI : [from[0], from[1] + (to[1] - from[1]) * dive * dive + arc * (1 - land), from[2] + (to[2] - from[2]) * dive];
  const nubiPose: NubiPose = close
    ? { finR: DROP_RAISE, finL: 0.3, eyeScale: 1.5, lookY: 1, lookX: 0.4, squash: 0.97 }
    : {
        pitch: 0.9 * (1 - 0.6 * land),
        finL: 1.05,
        finR: 1.05,
        eyeScale: 1.6 - 0.15 * land,
        lookY: -0.5,
        lookX: 0.3,
        squash: 1.12 - 0.4 * land + 0.06 * ramp(g, DIVE + 62, DIVE + 76),
        wiggle: 0.6 * (1 - land),
        wigglePhase: g * 0.12,
      };
  const camC: Cam = aim([HOLE_W[0] + 1.05, HOLE_W[1] - 0.3, Math.min(13.2, HOLE_W[2] + 0.75)], 40, [HOLE_W[0], HOLE_W[1] - 0.12, HOLE_W[2]], 540, 640);
  const camD: Cam = aim([-2.0, 0.95, 11.6], 50, [DIVE_LAND[0], 0.55, DIVE_LAND[2]], 560, 1040);
  const dropAt: Vec3 = close ? HOLE_W : [DIVE_LAND[0], DIVE_DROP_Y, DIVE_LAND[2]];
  return (
    <AbsoluteFill style={{ background: HOT_SKY }}>
      <Shake frame={g} impacts={[{ at: DIVE + 57, amp: 7, dur: 10 }]}>
        <Stage cam={close ? camC : camD} near={0.05}>
          <HotLights />
          <DryStreet t={t} far={false} />
          <group position={dropAt}>
            <BigDrop t={t} fall={fall} splash={splash} height={dropAt[1] - Y} size={close ? DROP_SIZE : DROP_SIZE * 1.6} glow={0.8} />
          </group>
          <Nubi
            size={2}
            position={diveAt}
            rotationY={close ? DROP_ROT : Math.PI - 0.75}
            pose={nubiPose}
            shadowOpacity={close ? 0.3 : 0.45 * (0.4 + 0.6 * dive)}
            holdR={
              close ? (
                <Upright raise={DROP_RAISE}>
                  <group {...BOTTLE_HOLD}>
                    <WaterBottle fill={0} hole t={t} />
                  </group>
                </Upright>
              ) : undefined
            }
          />
          {!close ? <DustPuff frame={g} at={DIVE + 57} position={to} radius={1.1} color="#F3E3C8" /> : null}
        </Stage>
      </Shake>
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, clamp01, pop, ramp } from "../../anim";
import { Upright } from "../../inca/outfit";
import { Shake, Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { DustPuff, Twinkles } from "../../three/Effects3D";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { BOTTLE_HOLD, BOTTLE_HUG, WaterBottle } from "../../three/agua/Bottle";
import {
  NightCap,
  Pajamas,
  STUDIO_BASIN,
  STUDIO_BED,
  STUDIO_BED_FLOOR,
  STUDIO_COUNTER_BOTTLE,
  STUDIO_FAUCET_OUTLET,
  STUDIO_SINK,
  STUDIO_SINK_RAISE,
  STUDIO_SINK_YAW,
  Studio,
  StudioLights,
} from "../../three/agua/Home";
import { Glow } from "../../three/thanos/FX";
import { Nubi, NubiPose } from "../../three/Nubi";
import { FINAL } from "../beats";
import { SHOTS } from "../shots";
import { aguaTalk } from "../talk";

// Shot 12 "cama" (FINAL.START → FINAL.END): it was a nightmare. Nubi, in pyjamas and nightcap,
// jolts awake in bed and tumbles out onto the floor (thud at FALL), zips to the sink (whip pan)
// and at SINK the tap gives a big glorious stream. On L17 ("¡Uf… era un sueño!") it melts with
// relief; it turns the tap off, picks up the water bottle from the counter (BOTELLA), then hops
// right up to the camera (CLOSE) and hugs it, looking into the lens; on MIRANDO its eyes narrow
// to a suspicious squint and it leans in. From CARD the lead's question card covers y 230-800:
// in the close-up Nubi's eyes sit at y ≈ 1010.

const BED_AT = STUDIO_BED;
const FLOOR_AT = STUDIO_BED_FLOOR;
const SINK_AT = STUDIO_SINK;
const CLOSE_AT: Vec3 = [-0.55, 0, -0.55];
const GRAB_YAW = -0.72;
const FOV = 38;

const CAM_BED = aim([1.3, 2.6, 7.6], FOV, [1.3, 0.3, -1.2], 540, 1180);
const CAM_SINK = aim([SINK_AT[0] - 6.5, 2.15, SINK_AT[2] + 5.5], FOV, SINK_AT, 612, 1262);
const CAM_SINK_IN = aim([SINK_AT[0] - 6.2, 2.05, SINK_AT[2] + 5.2], FOV, SINK_AT, 612, 1262);
/** Looking down into the sink (as in the "grifo" shot): the whip pan lands here on the gush. */
const POV = { position: [-1.7, 2.55, -0.85] as Vec3, target: [STUDIO_BASIN.x + 0.55, STUDIO_BASIN.floor + 0.3, STUDIO_BASIN.z] as Vec3, fov: 52 };
const EYES = (at: Vec3): Vec3 => [at[0], 1.1, at[2] + 0.88];
const CAM_CLOSE = aim([CLOSE_AT[0], 1.12, CLOSE_AT[2] + 0.88 + 3.8], FOV, EYES(CLOSE_AT), 540, 1010);
const CAM_SQUINT = aim([CLOSE_AT[0], 1.1, CLOSE_AT[2] + 0.88 + 3.35], FOV, EYES(CLOSE_AT), 540, 1010);

const mix = (a: number, b: number, k: number) => a + (b - a) * k;
/** A ramp end that stays after its start even if the beats move. */
const after = (a: number, b: number) => Math.max(a + 1, b);

export const CamaShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.cama.from;
  const { START, FALL, SINK, L17, L18, BOTELLA, CLOSE, MIRANDO, END } = FINAL;
  const t = g / 30;

  // ---- Timing -------------------------------------------------------------------------
  const JOLT = START;
  const ZIP0 = FALL + 3;
  const ZIP1 = after(ZIP0 + 2, SINK - 1);
  const OFF = BOTELLA - 22;
  const REACH = BOTELLA - 10;
  const HOP0 = CLOSE - 12;
  const HUG = CLOSE - 4;

  // ---- Where Nubi is ------------------------------------------------------------------
  const tumble = ramp(g, JOLT + 1, after(JOLT + 1, FALL), [0, 1], Easing.in(Easing.quad));
  const zip = ramp(g, ZIP0, ZIP1, [0, 1], EASE_IN_OUT);
  const hop = ramp(g, HOP0, CLOSE, [0, 1], EASE_IN_OUT);
  let at: Vec3;
  let yaw: number;
  let lift = 0;
  if (g < FALL) {
    at = lerp3(BED_AT, FLOOR_AT, tumble);
    lift = Math.sin(Math.PI * tumble) * 0.7;
    yaw = mix(-0.35, -0.1, tumble);
  } else if (g < ZIP1) {
    at = lerp3(FLOOR_AT, SINK_AT, zip);
    lift = 0.35 * Math.abs(Math.sin(zip * Math.PI * 2));
    yaw = mix(-0.1, STUDIO_SINK_YAW, zip);
  } else if (g < HOP0) {
    at = SINK_AT;
    yaw = STUDIO_SINK_YAW + mix(0, GRAB_YAW - STUDIO_SINK_YAW, ramp(g, REACH - 6, REACH + 2, [0, 1], EASE_IN_OUT) * (1 - ramp(g, BOTELLA + 6, BOTELLA + 16, [0, 1], EASE_IN_OUT)));
  } else {
    at = lerp3(SINK_AT, CLOSE_AT, hop);
    lift = Math.sin(Math.PI * hop) * 0.55;
    yaw = mix(STUDIO_SINK_YAW, 0, hop);
  }
  at = [at[0], at[1] + lift, at[2]];

  // ---- The tap ------------------------------------------------------------------------
  const handle = ramp(g, ZIP1 - 2, after(ZIP1 - 2, SINK), [0, 1], EASE_OUT) * (1 - ramp(g, OFF, OFF + 6, [0, 1], EASE_IN_OUT));
  const flow = ramp(g, SINK, SINK + 3, [0, 1], Easing.linear) * (1 - ramp(g, OFF + 2, OFF + 7, [0, 1], Easing.linear));
  const pool = ramp(g, SINK, SINK + 40, [0, 0.8], EASE_OUT) * (1 - ramp(g, OFF + 6, OFF + 40, [0, 1], EASE_IN_OUT) * 0.6);

  // ---- Pose ---------------------------------------------------------------------------
  const asleep = g < JOLT ? 1 : 0;
  const jolt = pop(g, JOLT, { damping: 9, stiffness: 260 });
  const land = g >= FALL ? 1 - pop(g, FALL, { damping: 8, stiffness: 240 }) : 0;
  const thud = g >= FALL && g < FALL + 3 ? 1 : 0;
  const joy = g >= SINK ? Math.max(0, Math.sin(Math.PI * clamp01((g - SINK) / 12))) : 0;
  const relief = ramp(g, L17, L17 + 12, [0, 1], EASE_OUT) * (1 - ramp(g, L18 - 4, L18 + 6, [0, 1], EASE_IN_OUT));
  const reach = ramp(g, REACH - 6, REACH + 2, [0, 1], EASE_IN_OUT);
  const held = g >= BOTELLA;
  const raiseBottle = ramp(g, BOTELLA, BOTELLA + 8, [0, 1], EASE_OUT);
  const hugging = g >= HUG;
  const hugK = ramp(g, HUG, CLOSE + 6, [0, 1], EASE_OUT);
  const squint = ramp(g, MIRANDO, MIRANDO + 6, [0, 1], EASE_OUT);
  const atSink = g >= ZIP1 && g < HOP0;

  let finL: number;
  if (g < ZIP1) finL = 0.9 + 0.5 * jolt - 0.8 * land + 0.8 * zip;
  else if (!held) finL = mix(STUDIO_SINK_RAISE, 0.95, reach) - 0.7 * relief * (1 - reach);
  else if (!hugging) finL = mix(0.95, 0.75, raiseBottle);
  else finL = 0.3 + 0.05 * Math.sin(g * 0.15);
  if (g >= OFF - 2 && g < OFF + 6 && !held) finL += 0.12 * Math.sin(((g - OFF + 2) / 8) * Math.PI);

  const base: NubiPose = {
    finL,
    finR: g < ZIP1 ? 0.8 + 0.6 * jolt - 0.9 * land : hugging ? 0.3 + 0.05 * Math.sin(g * 0.15 + 1) : 0.2 + 0.7 * joy - 0.6 * relief,
    hop: g < FALL ? 2.5 * jolt * (1 - tumble) : 0.0 + 1.2 * joy,
    squash: (g >= FALL ? 1 - 0.4 * land : 1) * (1 - 0.18 * relief) * (1 + 0.04 * joy),
    roll: g < FALL ? 1.1 * tumble : g < ZIP1 ? -0.15 * (1 - zip) * Math.sin(zip * 9) : 0.05 * relief * Math.sin(g * 0.12),
    pitch: g < ZIP1 && g >= FALL ? 0.25 * Math.sin(Math.PI * zip) : hugging ? 0.1 * squint : 0.06 * relief,
    eyeScale: asleep ? 1 : g < SINK ? 1.45 : hugging ? mix(1.05, 0.35, squint) : 1.15 + 0.25 * joy - 0.1 * relief,
    blink: asleep ? 1 : Math.max(0.8 * relief, thud ? 0.7 : 0),
    lookX: atSink ? (held ? -0.45 * (1 - hugK) : -0.65 + 0.4 * relief) : hugging ? 0 : g < FALL ? -0.4 * tumble : -0.6,
    lookY: atSink ? (held ? 0.25 : -0.35 + 0.3 * relief) : hugging ? -0.05 : -0.2,
    wiggle: g >= ZIP0 && g < ZIP1 ? 1 : 0.2,
    wigglePhase: g * (g >= ZIP0 && g < ZIP1 ? 1.6 : 0.3),
  };
  const talking = g >= L17 && (g < HOP0 || g >= CLOSE + 4);
  const pose = talking ? aguaTalk(g, base, hugging ? 0.6 : 1) : base;
  if (hugging) {
    // Keep the fins round the bottle and the eyes on the lens while talking.
    pose.finL = base.finL;
    pose.finR = base.finR;
    pose.lookX = base.lookX;
    pose.lookY = base.lookY;
    pose.eyeScale = base.eyeScale;
  }
  const flop = g < JOLT ? 0.4 : g < FALL ? -1 + 1.3 * tumble : hugging ? 0.5 + 0.3 * Math.sin(g * 0.13) : 0.6 + 0.6 * relief - 0.5 * joy;

  // ---- Camera -------------------------------------------------------------------------
  const whip = ramp(g, FALL + 2, after(FALL + 2, ZIP1 + 1), [0, 1], EASE_IN_OUT);
  const GUSH_END = after(SINK + 6, L17 - 2);
  const settle = ramp(g, GUSH_END, after(GUSH_END, HOP0), [0, 1], EASE_IN_OUT);
  const closeK = ramp(g, HOP0, CLOSE + 4, [0, 1], EASE_IN_OUT);
  const squintK = ramp(g, MIRANDO - 4, after(MIRANDO - 4, END), [0, 1], EASE_IN_OUT);
  const sinkCam = {
    position: lerp3(CAM_SINK.position, CAM_SINK_IN.position, settle),
    target: lerp3(CAM_SINK.target, CAM_SINK_IN.target, settle),
  };
  const closeCam = { position: lerp3(CAM_CLOSE.position, CAM_SQUINT.position, squintK), target: lerp3(CAM_CLOSE.target, CAM_SQUINT.target, squintK) };
  let position = lerp3(CAM_BED.position, POV.position, whip);
  let target = lerp3(CAM_BED.target, POV.target, whip);
  let fov = mix(FOV, POV.fov, whip);
  if (g >= GUSH_END) {
    position = sinkCam.position;
    target = sinkCam.target;
    fov = FOV;
  }
  if (g >= HOP0) {
    position = lerp3(sinkCam.position, closeCam.position, closeK);
    target = lerp3(sinkCam.target, closeCam.target, closeK);
  }
  const blur = 9 * Math.sin(Math.PI * whip);

  // ---- The bottle ---------------------------------------------------------------------
  const bottle = <WaterBottle fill={1} glow={hugging ? 0.35 + 0.25 * hugK : 0.15} t={t} />;
  const holdL =
    held && !hugging ? (
      <Upright raise={pose.finL ?? 0} side="L">
        <group position={[-BOTTLE_HOLD.position[0], BOTTLE_HOLD.position[1], BOTTLE_HOLD.position[2]]} rotation={BOTTLE_HOLD.rotation} scale={BOTTLE_HOLD.scale}>
          {bottle}
        </group>
      </Upright>
    ) : undefined;

  return (
    <AbsoluteFill style={{ background: "#FFE7D1" }}>
      <Shake frame={g} impacts={[{ at: FALL, amp: 26, dur: 14 }, { at: SINK, amp: 8, dur: 10 }]}>
        <AbsoluteFill style={{ filter: blur > 0.4 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
          <Stage cam={{ position, target, fov }} near={0.05}>
            <StudioLights />
            <Studio t={t} faucet={{ handle, flow }} pool={pool} blanket={g < JOLT ? 1 : 1 - ramp(g, JOLT, JOLT + 3, [0, 1], EASE_OUT)} lamp={0.35} />
            {!held ? (
              <group position={STUDIO_COUNTER_BOTTLE} scale={0.8}>
                {bottle}
              </group>
            ) : null}
            <Nubi size={2} position={at} rotationY={yaw} pose={pose} shadowOpacity={0.4} holdL={holdL}>
              <Pajamas />
              <NightCap flop={flop} />
              {hugging ? (
                <group position={BOTTLE_HUG.position} rotation={BOTTLE_HUG.rotation} scale={BOTTLE_HUG.scale * ramp(g, HUG, HUG + 4, [0.85, 1], EASE_OUT)}>
                  {bottle}
                </group>
              ) : null}
            </Nubi>
            <DustPuff frame={g} at={FALL} position={[FLOOR_AT[0], 0.02, FLOOR_AT[2]]} radius={1.3} color="#F3E6D2" count={12} />
            <Twinkles frame={g} at={SINK} position={STUDIO_FAUCET_OUTLET} radius={0.55} count={14} color="#BFF0FF" />
            <Glow color="#7FDBFF" size={1.6 * Math.sin(Math.PI * clamp01((g - SINK) / 18))} opacity={0.7 * Math.sin(Math.PI * clamp01((g - SINK) / 18))} position={[STUDIO_FAUCET_OUTLET[0], STUDIO_FAUCET_OUTLET[1] - 0.15, STUDIO_FAUCET_OUTLET[2]]} />
          </Stage>
        </AbsoluteFill>
      </Shake>
    </AbsoluteFill>
  );
};

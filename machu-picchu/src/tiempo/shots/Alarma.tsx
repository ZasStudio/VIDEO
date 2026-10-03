import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, ramp, windowIn } from "../../anim";
import { LifeCounter } from "../../overlay/tiempo/TiempoUI";
import { Shake, Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { Vec3 } from "../../three/CameraRig";
import { NUBI_GREEN, Nubi, NubiPose } from "../../three/Nubi";
import { AirBurst, PLAZA_NUBI, PREMIUM_LINE_Z, PremiumPlaza, TIMECO_SKY, TimeCity, TimecoFog, TimecoLights } from "../../three/tiempo/Timeco";
import * as THREE from "three";
import { CARGO } from "../beats";
import { NUBI_EVENTS, nubiDraining, nubiHolding, nubiSeconds } from "../clock";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { tiempoTalk } from "../talk";

// "Cargo automático" (CARGO.START → END): Nubi walks out happily onto the ZONA PREMIUM plaza at
// night, towards the camera; as it crosses the glowing threshold (ALARM) its counter starts
// beeping red and draining by itself; "¡Un momento! ¡Yo no he comprado nada!" (L11): panicked
// hops, fins up, eyes on its counter. TIMECO answers (L12, the 2D notification in y 230-480 from
// NOTIF): "…respirar en zona premium" — on INHALE Nubi takes a huge breath and holds it (puffed
// up 1.25×, bluish purple, eyes squeezed, trembling; the counter freezes) until EXHALE, when the
// air bursts out (a quick deflate, a little spin) and the counter drains again.
// Medium shot: the counter's bottom anchor stays at y ≈ 720 (feet ≈ y 1262 at the start).

const WALK = 2.4; // units per second
const HAPPY = NUBI_GREEN;
const BLUE = "#8C8CF2";
const PURPLE = "#A276EC";

/** Body colour while holding the breath (green → bluish purple → purple), in a few steps. */
const breathColor = (k: number, strain: number) => {
  const q = (v: number) => Math.round(v * 10) / 10;
  const c = new THREE.Color(HAPPY).lerp(new THREE.Color(BLUE), q(k)).lerp(new THREE.Color(PURPLE), q(strain) * 0.8);
  return `#${c.getHexString()}`;
};

export const AlarmaShot: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + SHOTS.alarma.from;
  const t = g / 30;
  const { START, ALARM, L11, NOTIF, L12, INHALE, EXHALE, END } = CARGO;

  // ---- The walk: it crosses the threshold on ALARM and stops a few steps later.
  const STOP = ALARM + Math.round(((PREMIUM_LINE_Z - PLAZA_NUBI[2]) / WALK) * 30);
  const walkK = 1 - ramp(g, STOP - 6, STOP + 2, [0, 1], EASE_IN_OUT);
  const z = PLAZA_NUBI[2] + (WALK * Math.max(0, STOP - g)) / 30 - (g > STOP - 6 ? (WALK / 30) * 3 * ramp(g, STOP - 6, STOP + 2) : 0);
  const at: Vec3 = [PLAZA_NUBI[0], 0, z];

  // ---- The breath: inflate on INHALE (with a little overshoot), hold, burst on EXHALE.
  const infIn = ramp(g, INHALE - 1, INHALE + 7, [0, 1], (x) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2));
  const infOut = ramp(g, EXHALE, EXHALE + 5, [0, 1], EASE_IN_OUT);
  const holding = g >= INHALE && g < EXHALE + 5;
  const strain = ramp(g, INHALE + 10, EXHALE, [0, 1], (x) => x);
  const inflate = g < INHALE ? 0 : (1 - infOut) * (infIn + 0.03 * Math.sin(g * 1.7) * strain) - 0.12 * windowIn(g, EXHALE + 3, EXHALE + 12, 3);
  const colorK = holding ? ramp(g, INHALE + 1, INHALE + 16) * (1 - infOut) : 0;
  const tremble = (holding ? ramp(g, INHALE + 6, INHALE + 16) * (1 - infOut) : 0) * (0.6 + 0.4 * strain);
  const burst = ramp(g, EXHALE, EXHALE + 12, [0, 1], (x) => 1 - Math.pow(1 - x, 3));

  // ---- Poses.
  const ph = t * 9.5;
  const happy: NubiPose = {
    hop: Math.abs(Math.sin(ph)) * 1.1 * walkK,
    squash: 1 + 0.05 * Math.cos(ph * 2) * walkK,
    roll: 0.07 * Math.sin(ph) * walkK,
    pitch: 0.05 * walkK,
    wiggle: 0.8 * walkK,
    wigglePhase: ph * 1.5,
    finL: 0.25 + 0.35 * Math.sin(ph) * walkK,
    finR: 0.25 - 0.35 * Math.sin(ph) * walkK,
    eyeScale: 0.92,
    lookY: 0.15,
  };
  const startle = ramp(g, ALARM + 2, ALARM + 7);
  const panic = windowIn(g, L11, NOTIF, 6);
  const hopP = Math.abs(Math.sin((g - L11) * 0.42));
  const no = windowIn(g, L11 + 26, L11 + 62, 5);
  const listen = ramp(g, NOTIF, NOTIF + 10) * (1 - ramp(g, INHALE - 3, INHALE));
  const respirar = windowIn(g, L12 + 36, L12 + 80, 6);
  let pose: NubiPose = {
    ...happy,
    hop: (happy.hop ?? 0) + 1.6 * windowIn(g, ALARM + 2, ALARM + 9, 3) + panic * hopP * 2.2,
    eyeScale: 0.92 + 0.45 * startle + 0.2 * panic,
    lookY: 0.15 + 0.85 * startle * (1 - 0.6 * no) - 0.5 * listen,
    lookX: no * 0.35 * Math.sin((g - L11) * 0.55) + listen * (0.25 * Math.sin(g * 0.09) - 0.35 * respirar),
    finL: (happy.finL ?? 0) * (1 - startle) + startle * (0.55 + panic * (0.45 + 0.3 * Math.sin(g * 0.95))) - 0.5 * listen,
    finR: (happy.finR ?? 0) * (1 - startle) + startle * (0.55 + panic * (0.45 - 0.3 * Math.sin(g * 0.95))) - 0.5 * listen,
    yaw: no * 0.32 * Math.sin((g - L11) * 0.55),
    squash: (happy.squash ?? 1) * (1 + 0.06 * panic * Math.cos((g - L11) * 0.84)) * (1 - 0.06 * listen),
    roll: (happy.roll ?? 0) + 0.06 * listen * Math.sin(g * 0.21),
    wiggle: Math.max(happy.wiggle ?? 0, panic * 0.9),
    wigglePhase: g * 0.5,
  };
  pose = tiempoTalk(g, pose, 0.6);
  if (g >= INHALE - 3) {
    // The breath: squash down to suck in, then puffed up and squeezed.
    const suck = windowIn(g, INHALE - 3, INHALE + 2, 2);
    const k = 1 - infOut;
    pose = {
      hop: 0.3 * tremble * Math.abs(Math.sin(g * 2.3)) + burst * (1 - burst) * 9,
      squash: (1 - 0.12 * suck) * (1 - 0.04 * k),
      finL: k * (-0.15 + 0.1 * Math.sin(g * 3.1) * tremble) + burst * 1.1 * (1 - burst),
      finR: k * (-0.15 - 0.1 * Math.sin(g * 2.7) * tremble) + burst * 1.1 * (1 - burst),
      blink: k * 0.84 * ramp(g, INHALE, INHALE + 4),
      eyeScale: 1.1 + 0.4 * burst * (1 - burst) * 4,
      roll: 0.06 * Math.sin(g * 3.7) * tremble,
      pitch: -0.05 * k,
      yaw: Math.PI * 2 * burst,
      wiggle: 0.4 * tremble + burst,
      wigglePhase: g * 0.9,
    };
  }

  const sx = 1 + 0.26 * inflate;
  const sy = 1 + 0.1 * inflate;
  const jitter = 0.03 * tremble;
  const zipX = -0.9 * burst * (1 - 0.3 * burst);
  const nubiAt: Vec3 = [at[0] + jitter * Math.sin(g * 2.9) + zipX, 0, at[2] + jitter * Math.cos(g * 3.3)];
  const tinted = colorK > 0.001;
  const body = breathColor(colorK, strain * colorK);

  // ---- Camera: medium shot from the plaza's near side, slowly pushing in; a nudge on INHALE.
  // It keeps the counter's anchor (just over the head, hops aside) at y 720, so the whole
  // counter stays under the TIMECO notification band (y 240-485); feet ≈ y 1262 at the start.
  const push = ramp(g, START, INHALE, [0, 0.35], (x) => x) + ramp(g, INHALE, INHALE + 10, [0, 0.3]);
  const camPos: Vec3 = [PLAZA_NUBI[0] + 1.0, 1.5, PLAZA_NUBI[2] - 9.3 + push];
  const cam = aim(camPos, 46, [at[0], 2.1 * sy + 0.12, at[2]], 560, 720);

  // Alarm light over Nubi: red pulses while draining, icy while frozen.
  const draining = nubiDraining(g);
  const frozen = nubiHolding(g);
  const beep = draining ? 0.5 + 0.5 * Math.sin(g * 1.4) : 0;
  const head: Vec3 = [nubiAt[0], 2.1 * sy + ((pose.hop ?? 0) * 0.2) + 0.12, nubiAt[2]];
  const ctr = counterAt(cam, head, { min: 1.0, max: 1.12 });
  return (
    <AbsoluteFill style={{ background: TIMECO_SKY }}>
      <Shake
        frame={g}
        impacts={[
          { at: ALARM, amp: 6, dur: 10 },
          { at: L11 + 1, amp: 8, dur: 12 },
          { at: EXHALE, amp: 14, dur: 14 },
        ]}
      >
        <Stage cam={cam} far={1600}>
          <TimecoLights k={1.05} red={0.4} />
          <TimecoFog near={50} far={330} />
          <directionalLight position={[3, 5, -10]} intensity={1.6} color="#FFE2B8" />
          <pointLight position={[head[0], head[1] + 0.9, head[2] - 0.6]} intensity={draining ? 9 * beep : frozen ? 5 : 0} distance={9} decay={1.6} color={frozen ? "#4FE3FF" : "#FF3030"} />
          <TimeCity t={t} />
          <PremiumPlaza t={t} line={0.9} alarm={ramp(g, ALARM, ALARM + 4)} />
          <group position={nubiAt} scale={[sx, sy, sx]}>
            <Nubi size={2} position={[0, 0, 0]} rotationY={Math.PI} pose={pose} palette={tinted ? { body } : undefined} shadowOpacity={0.5} />
          </group>
          <AirBurst frame={g} at={EXHALE + 1} position={[nubiAt[0], 1.1, nubiAt[2] - 0.4]} radius={1.9} />
        </Stage>
        {!ctr.behind && g < END ? (
          <LifeCounter frame={g} seconds={nubiSeconds(g)} events={NUBI_EVENTS} draining={draining} frozen={frozen} x={ctr.x} y={ctr.y} scale={ctr.scale} />
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};

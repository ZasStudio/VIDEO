import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, ramp, windowIn } from "../../anim";
import { LifeCounter } from "../../overlay/tiempo/TiempoUI";
import { SMOOTH, Shake, Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { DustPuff } from "../../three/Effects3D";
import { Nubi, NubiPose } from "../../three/Nubi";
import { EDGE_NUBI, HG, PremiumPlaza, TOWER_AT, TIMECO_SKY, TimeCity, TimecoFog, TimecoLights, TimecoTower } from "../../three/tiempo/Timeco";
import { TIMECO } from "../beats";
import { NUBI_EVENTS, nubiDraining, nubiHolding, nubiSeconds } from "../clock";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { tiempoTalk } from "../talk";

// "¡Timeco nos cobra por comer, dormir, respirar… y también por trabajar!" (TIMECO.START → END)
//   A  START → TOWER+20  low behind Nubi as it zips in and skids to a stop at the plaza's edge;
//                        on TOWER (the boom) the camera cranes up and the gigantic hourglass
//                        tower rises over the city, its pipes sucking golden time from the roofs.
//   B  → SCREEN          Nubi turns to the camera, angry, the tower behind it on the right.
//   C  SCREEN → END      still shouting the end of its line, Nubi small and low in a long-lens
//                        wide shot (its counter below y 900); the gigantic tower looms and its
//                        façade screen glows red (the 2D extraction screen covers x 60-940,
//                        y 260-900 here); after the line Nubi looks back up at it.

const WAIST: Vec3 = [TOWER_AT[0], HG.waistY, TOWER_AT[2]];

export const TorreShot: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + SHOTS.torre.from;
  const t = g / 30;
  const { START, TOWER, COMER, DORMIR, RESPIRAR, TRABAJAR, SCREEN, END } = TIMECO;
  const CUT_B = TOWER + 20;
  const N = EDGE_NUBI;

  let cam: Cam;
  let at: Vec3 = N;
  let rotY = Math.PI;
  let pose: NubiPose;
  let counterMin = 1.0;
  if (g < CUT_B) {
    // ---- A: zip in from the right, skid, boom up.
    const run = ramp(g, START, START + 10, [0, 1], (x) => 1 - Math.pow(1 - x, 2));
    const skid = windowIn(g, START + 7, START + 18, 4);
    at = [N[0] + 1.7 * (1 - run), 0, N[2] + 2.2 * (1 - run)];
    rotY = Math.PI + 0.55 * (1 - run);
    const ph = t * 15;
    pose = {
      hop: Math.abs(Math.sin(ph)) * 1.6 * (1 - run),
      pitch: 0.2 * (1 - run) - 0.32 * skid,
      squash: 1 - 0.1 * skid,
      finL: 0.8 + 0.3 * skid,
      finR: 0.8 + 0.3 * skid,
      wiggle: 1,
      wigglePhase: ph * 2,
      eyeScale: 1.3,
      lookY: 0.6 * ramp(g, TOWER, TOWER + 10),
    };
    const u = ramp(g, TOWER - 2, CUT_B, [0, 1], SMOOTH);
    const pos = lerp3([N[0] + 0.8, 1.25, N[2] + 7.2], [N[0] + 1.2, 8.5, N[2] + 10.5], u);
    const fov = 50 - 16 * u;
    const low = aim(pos, fov, [N[0], 0.9, N[2]], 560, 1120);
    const high = aim(pos, fov, WAIST, 560, 800);
    cam = { position: pos, target: lerp3(low.target, high.target, ramp(g, TOWER - 2, CUT_B, [0, 1], EASE_IN_OUT)), fov };
    counterMin = 0.9;
  } else {
    // ---- B (→ SCREEN): Nubi faces the camera and rants, the tower behind it on the right.
    // ---- C (SCREEN → END): still shouting "…y también por trabajar!", now small and low in a
    // long-lens wide shot (counter below y 900), the gigantic tower looming with its red screen.
    const wide = g >= SCREEN;
    rotY = wide ? 0.04 : -0.12;
    const stomp = [COMER, DORMIR, RESPIRAR].reduce((m, b) => Math.max(m, windowIn(g, b, b + 8, 2)), 0);
    const big = windowIn(g, TRABAJAR - 2, TRABAJAR + 20, 3);
    const anger: NubiPose = {
      finL: 0.85 + 0.15 * Math.sin(g * 0.31) + 0.35 * big,
      finR: 0.55 + 0.35 * windowIn(g, COMER - 4, RESPIRAR + 18, 5) * Math.abs(Math.sin(g * 0.5)) + 0.55 * big,
      eyeScale: 0.82 - 0.1 * big,
      lookY: -0.12,
      squash: 1.02,
      pitch: 0.06,
      hop: 0.8 * stomp + (g >= SCREEN ? 1.4 : 2.2) * windowIn(g, TRABAJAR - 1, TRABAJAR + 9, 3),
    };
    const turn = ramp(g, CUT_B, CUT_B + 8, [0, 1], EASE_OUT);
    // After the line, a look back up at the screen.
    const lookBack = ramp(g, TRABAJAR + 26, TRABAJAR + 40, [0, 1], EASE_IN_OUT);
    pose = tiempoTalk(g, { ...anger, yaw: Math.PI * 0.9 * (1 - turn) + 2.2 * lookBack, lookY: (anger.lookY ?? 0) + 1.1 * lookBack, eyeScale: (anger.eyeScale ?? 1) + 0.4 * lookBack }, 1.2);
    if (!wide) {
      const push = ramp(g, CUT_B, SCREEN, [0, 0.9], (x) => x) + 0.4 * stomp;
      const pos: Vec3 = [N[0] + 1.75, 0.8, N[2] + 10.4 - push];
      cam = aim(pos, 44, [N[0], 0, N[2]], 470, 1262);
    } else {
      const k = ramp(g, SCREEN, END, [0, 1], (x) => x);
      const pos: Vec3 = [N[0] + 0.5, 1.1, N[2] + 52 - 1.5 * k];
      cam = aim(pos, 22, [N[0], 0, N[2]], 540, 1300);
    }
  }

  const screenOn = ramp(g, SCREEN - 6, SCREEN + 4, [0, 1], (x) => x);
  // From SCREEN the counter stays put over the head (panel top ≥ y 910, under the 2D screen).
  const head: Vec3 = g >= SCREEN ? [at[0], 2.1, at[2]] : [at[0], 2.2 + (pose.hop ?? 0) * 0.2, at[2]];
  const ctr = counterAt(cam, head, { min: counterMin, max: 1.3 });
  // During the boom Nubi leaves the frame at the bottom: its counter fades before the captions.
  const counterFade = g < CUT_B ? 1 - ramp(ctr.y, 1060, 1200, [0, 1], (x) => x) : 1;
  return (
    <AbsoluteFill style={{ background: TIMECO_SKY }}>
      <Shake
        frame={g}
        impacts={[
          { at: TOWER, amp: 18, dur: 18 },
          { at: TRABAJAR, amp: 8, dur: 10 },
          { at: SCREEN, amp: 6, dur: 8 },
        ]}
      >
        <Stage cam={cam} far={2600}>
          <TimecoLights red={1.3} />
          <TimecoFog near={140} far={1300} />
          <directionalLight position={[at[0] + 4, 6, at[2] + 12]} intensity={g >= CUT_B && g < SCREEN ? 1.7 : 0.7} color="#FFE0B0" />
          <pointLight position={[at[0], 3.2, at[2] - 2]} intensity={nubiDraining(g) ? 4 + 3 * Math.sin(g * 1.4) : 2} distance={8} decay={1.6} color="#FF3030" />
          <TimeCity t={t} flow={1.4} />
          <PremiumPlaza t={t} line={0} sign={false} />
          <TimecoTower t={t} screen={screenOn} />
          <Nubi size={2} position={at} rotationY={rotY} pose={pose} shadowOpacity={0.5} />
          <DustPuff frame={g} at={START + 9} position={[at[0], 0.05, at[2]]} radius={1.3} color="#D9C9B0" />
        </Stage>
        {!ctr.behind && counterFade > 0 ? (
          <LifeCounter frame={g} seconds={nubiSeconds(g)} events={NUBI_EVENTS} draining={nubiDraining(g)} frozen={nubiHolding(g)} x={ctr.x} y={ctr.y} scale={ctr.scale} opacity={counterFade} />
        ) : null}
      </Shake>
    </AbsoluteFill>
  );
};

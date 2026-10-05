import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, pop, ramp, windowIn } from "../../anim";
import { Stage } from "../../scenes/common";
import { aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { NubiPose } from "../../three/Nubi";
import { BOY, BoyLights, BoyRoom, Chico, FloatingHearts, M, Phone, typingFins } from "../../three/ia/Rooms";
import { GIRO } from "../beats";
import { SHOTS } from "../shots";

// "giroChico" (GIRO.YA → GIRO.PREGUNTA, ~4.9 s), under Nubi's sincere "Ya estudiábamos, creábamos
// y trabajábamos antes…": the boy sits on the edge of his bed, warmly lit by the nightstand lamp,
// and types his OWN short message on his phone (the 2D layer shows «te extraño» sent at SENT,
// then her «yo también ❤️» at REPLY, in the top band). After sending he waits, fidgeting; on the
// reply his eyes widen, he does a happy wiggle and hop, and hugs the phone, eyes closed, swaying,
// little hearts floating up. Wholesome. Feet at y ≈ 1170, the body ≈ y 650–1170, x ≈ 300–780.

const FOV = 40;

export const GiroChicoShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.giroChico.from;
  const t = g / 30;
  const { YA, SENT, REPLY, PREGUNTA } = GIRO;
  const sit = BOY.bedSit;

  // ---- Camera: a slow, warm push-in.
  const push = ramp(g, YA, PREGUNTA, [0, 1], EASE_IN_OUT);
  const pos: Vec3 = lerp3([-1.9, 2.6, 8.4], [-2.3, 2.35, 7.0], push);
  const cam = aim(pos, FOV, sit, 540, 1170);

  // ---- The boy: types (thoughtful, a pause), sends, waits, reads the reply, wiggles, hugs.
  const typeK = Math.max(windowIn(g, YA + 4, YA + 18, 3), windowIn(g, YA + 26, SENT - 2, 3));
  const sentTap = windowIn(g, SENT - 3, SENT + 4, 2);
  const waiting = ramp(g, SENT + 4, SENT + 10) * (1 - ramp(g, REPLY - 2, REPLY));
  const read = g >= REPLY ? pop(g, REPLY, { damping: 8, stiffness: 260 }) : 0;
  const joy = ramp(g, REPLY + 10, REPLY + 14);
  const hopArc = (s: number) => Math.sin(Math.PI * ramp(g, s, s + 9, [0, 1], (x) => x));
  const hops = g >= REPLY + 10 ? hopArc(REPLY + 10) + 0.7 * hopArc(REPLY + 20) : 0;
  const hug = ramp(g, REPLY + 26, REPLY + 34, [0, 1], EASE_OUT);
  const fins = typingFins(g, typeK, -0.1, 0.9);
  const fidget = Math.max(0, Math.sin(t * 3.4)) ** 4;
  const sway = Math.sin(t * 3.2);
  const breathe = Math.sin(t * 2);
  const pose: NubiPose = {
    pitch: 0.12 * (1 - joy) - 0.06 * joy * (1 - hug) + 0.05 * hug,
    yaw: 0.08 * Math.sin(t * 1.3) * (1 - joy) + 0.1 * sway * hug,
    roll: 0.03 * fidget * waiting + 0.1 * sway * hug + 0.06 * Math.sin(t * 14) * joy * (1 - hug),
    lookY: -0.6 * (1 - hug) + 0.15 * read * (1 - hug) + 0.1 * hug,
    lookX: 0,
    eyeScale: 1 + 0.05 * waiting + 0.45 * read * (1 - hug) - 0.15 * hug,
    blink: 0.85 * hug,
    squash: 1 + 0.012 * breathe - 0.05 * sentTap + 0.07 * read * (1 - joy) - 0.05 * hops + 0.03 * hug,
    hop: 1.3 * hops + 0.3 * fidget * waiting,
    finL: fins.l * (1 - joy) + 0.15 * waiting + 0.9 * joy * (1 - hug) + 0.35 * hug,
    finR: fins.r * (1 - joy) + 0.35 * sentTap + 0.15 * waiting + 0.9 * joy * (1 - hug) + 0.35 * hug,
    wiggle: 0.9 * joy * (1 - 0.5 * hug) + 0.3 * waiting,
    wigglePhase: t * 9,
  };

  // Phone: held low in front, screen up towards his eyes; then hugged to his body.
  const phonePos: Vec3 = lerp3([0.9, 2.2 + 0.15 * Math.sin(t * 9) * typeK, 6.6], [0, 3.6, 5.0], hug);
  const phoneRot: Vec3 = [-1.0 * (1 - hug) - 0.05 * hug, 0.3 * (1 - hug), 0.1 * hug * sway];

  return (
    <AbsoluteFill style={{ background: "#FFE2C2" }}>
      <Stage cam={cam} near={0.1}>
        <BoyLights warm={1.5} lampAt={[BOY.nightstand[0] - 0.3, 1.5, BOY.nightstand[2] + 0.9]} screen={0.8 + 0.4 * read} screenAt={[sit[0] + 0.4, sit[1] + 1.2, sit[2] + 1.4]} keyFrom={[-4, 6, 8]} cozy />
        <BoyRoom t={t} lamp={1.3} />
        <Chico position={sit} rotationY={0.12} pose={pose} shadow={false}>
          <group position={phonePos} rotation={phoneRot} scale={M * 1.35}>
            <Phone on={1} caseColor="#FF8A65" glow={0.5 * read * (1 - hug)} />
          </group>
        </Chico>
        <FloatingHearts t={t} start={(REPLY + 28) / 30} at={[sit[0], sit[1] + 1.9, sit[2] + 0.6]} n={7} />
      </Stage>
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, ramp } from "../../anim";
import { LifeCounter } from "../../overlay/tiempo/TiempoUI";
import { Stage } from "../../scenes/common";
import { Cam, aim } from "../../thanos/camera";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Nubi, NubiPose } from "../../three/Nubi";
import { AvenueLights, ESTATE, ESTATE_SKY, MansionEstate } from "../../three/tiempo/Avenue";
import { ESCALA } from "../beats";
import { NUBI_EVENTS, nubiDraining, nubiHolding, nubiSeconds } from "../clock";
import { counterAt } from "../counter";
import { SHOTS } from "../shots";
import { tiempoTalk } from "../talk";

// Shot "casa" (ESCALA.CASA_CUT → ESCALA.END): "Y una casa… / Una vida entera." A low-angle
// crane-up: it opens under the giant "SE VENDE / 40 AÑOS" panel by the gate (readable on CASA),
// then rises and pulls back over the hedge to reveal the white mansion on its hill (columns,
// pool, palm trees). From L04 Nubi stands small at the gate in the foreground, looking up, its
// counter ("32 AÑOS · 4 MESES") next to the panel; on "entera" it deflates (squashes down, eyes
// droop, fins hang). The sky keeps the band y 260-460 calm for the 2D sticker.

const FOV = 44;
const NUBI = ESTATE.nubi;
const SIGN = ESTATE.sign;

/** Low start: under the panel, looking up at it. */
const LOW: Cam = aim([2.2, 0.45, 8.6], FOV, SIGN, 560, 860, 14);
/** Crane top: Nubi small at the gate (feet y ≈ 1262), the mansion over the hedge. */
const HIGH_POS: Vec3 = [1.55, 3.3, 13.4];
const HIGH: Cam = aim(HIGH_POS, FOV, NUBI, 330, 1262, 14);
const PUSH_POS: Vec3 = [1.4, 3.05, 12.4];
const PUSH: Cam = aim(PUSH_POS, FOV, NUBI, 330, 1262, 14);

export const CasaShot: React.FC = () => {
  const g = useCurrentFrame() + SHOTS.casa.from;
  const t = g / 30;
  const { CASA_CUT, CASA, L04, ENTERA, END } = ESCALA;

  // ---- Camera: crane up and back, then a slow push-in on Nubi.
  const crane = ramp(g, CASA_CUT + 4, L04 - 2, [0, 1], EASE_IN_OUT);
  const push = ramp(g, L04, END, [0, 1], Easing.inOut(Easing.sin));
  const pos = lerp3(lerp3(LOW.position, HIGH.position, crane), PUSH.position, push);
  const target = lerp3(lerp3(LOW.target, HIGH.target, crane), PUSH.target, push);
  const cam: Cam = { position: pos, target, fov: FOV };

  // ---- Nubi at the gate: looks up in awe, then deflates on "entera".
  const sad = ramp(g, ENTERA - 2, ENTERA + 12, [0, 1], EASE_OUT);
  const sigh = Math.sin(Math.PI * ramp(g, ENTERA - 2, ENTERA + 10, [0, 1], Easing.linear));
  const breathe = Math.sin(t * 2.4);
  const base: NubiPose = {
    pitch: -0.2 * (1 - sad) + 0.14 * sad,
    yaw: 0.05 * Math.sin(t * 0.8) * (1 - sad),
    roll: 0.03 * sad,
    lookX: 0.25 * (1 - sad),
    lookY: 0.9 * (1 - sad) - 0.6 * sad,
    eyeScale: 1.15 * (1 - sad) + 0.88 * sad,
    blink: 0.45 * sad,
    squash: 1 + 0.015 * breathe - 0.17 * sad + 0.05 * sigh,
    hop: 0.25 * sigh,
    finL: 0.05 * (1 - sad) - 0.45 * sad,
    finR: 0.05 * (1 - sad) - 0.45 * sad,
  };
  const pose = tiempoTalk(g, base, 0.5 * (1 - sad) + 0.25);

  const signPop = ramp(g, CASA_CUT, CASA_CUT + 8, [0, 1], EASE_OUT);
  const nubiCounter = counterAt(cam, [NUBI[0], 2.15 - 0.3 * sad, NUBI[2]]);

  return (
    <AbsoluteFill style={{ background: ESTATE_SKY }}>
      <Stage cam={cam} near={0.2}>
        <AvenueLights />
        <MansionEstate t={t} signPop={signPop} />
        <Nubi size={2} position={NUBI} rotationY={0.3} pose={pose} shadowOpacity={0.4} />
      </Stage>
      {!nubiCounter.behind ? (
        <LifeCounter
          frame={g}
          seconds={nubiSeconds(g)}
          events={NUBI_EVENTS}
          draining={nubiDraining(g)}
          frozen={nubiHolding(g)}
          x={nubiCounter.x}
          y={nubiCounter.y}
          scale={0.86}
          appear={CASA - 2}
        />
      ) : null}
    </AbsoluteFill>
  );
};

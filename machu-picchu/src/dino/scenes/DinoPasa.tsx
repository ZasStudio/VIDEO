import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, EASE_OUT, ramp, windowIn } from "../../anim";
import { Burst, Confetti } from "../../overlay/Graphics";
import { Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { DustPuff } from "../../three/Effects3D";
import { TRexHead, trexHeadCamera } from "../../three/dino/Dinos";
import { Asteroid, EarthGlobe } from "../../three/dino/Props";
import { PrehistoricValley } from "../../three/dino/Sets";
import { Nubi } from "../../three/Nubi";
import { SweatDrops } from "../../inca/effects";
import { PASA } from "../beats";
import { Outfit } from "../outfit";
import { dinoTalk } from "../talk";
import { DINO } from "../timeline";
import { DUSK, HILL_CAM_B, HILL_NUBI } from "./DinoIntro";

// The asteroid whooshes past the Earth. Back on the hill: "¡Los dinosaurios seguirían vivos!"
// Nubi celebrates… BOOM, BOOM: the ground shakes, a huge shadow falls over it. "Espera… eso
// no estaba en el plan." Cut to the T-Rex's own eyes, looking down at tiny Nubi.

// The T-Rex head for the first-person shot: behind and above Nubi, pitched down to look at it.
const REX_HEAD = { position: [HILL_NUBI[0] + 0.3, 5.4, HILL_NUBI[2] + 9] as Vec3, rotation: [0.45, Math.PI, 0] as Vec3, size: 1 };

export const DinoPasa: React.FC = () => {
  const frame = useCurrentFrame();
  const S = DINO.SCENES.pasa;
  const g = frame + S.from;
  const t = g / 30;
  const { END, PASS, CHEER, STOMP1, STOMP2, ESPERA, POV } = PASA;

  const space = g < CHEER;
  const pov = g >= POV;

  // ---- Space: the rock crosses in front of the Earth and away ----
  const k = ramp(g, S.from, CHEER + 2, [0, 1], (x) => x);
  const rock: Vec3 = lerp3([-9, 6.5, 2], [9, 2.5, 6], k);

  // ---- The hill: celebration, stomps, the shadow ----
  const party = windowIn(g, CHEER, STOMP1 - 2, 4);
  const freeze = ramp(g, STOMP1, STOMP1 + 4);
  const shadow = ramp(g, STOMP1, ESPERA + 20, [0, 1], EASE_OUT);
  const lookBack = ramp(g, ESPERA + 6, ESPERA + 26, [0, 1], EASE_IN_OUT);
  const tremble = freeze * Math.sin(g * 2.3) * 0.04;
  const pose = dinoTalk(g, {
    hop: party * Math.abs(Math.sin((g - CHEER) * 0.35)) * 2.2,
    finL: party * (1.1 + 0.2 * Math.sin((g - CHEER) * 0.7)) + freeze * 0.9 * (1 - party),
    finR: party * (1.1 + 0.2 * Math.cos((g - CHEER) * 0.7)) + freeze * 0.9 * (1 - party),
    eyeScale: 1 + party * 0.2 + freeze * 0.45,
    lookY: lookBack * 0.9,
    lookX: lookBack * 0.25,
    roll: tremble,
    squash: 1 - freeze * 0.04,
  });
  const push = ramp(g, ESPERA, POV, [0, 1], EASE_IN_OUT);
  const cam = {
    position: lerp3(HILL_CAM_B.position, [0.1, 2.2, 7.6], push),
    target: lerp3(HILL_CAM_B.target, [-0.5, 1.6, 0], push),
    fov: 42,
  };

  // ---- First person: the T-Rex looks down; snorts; the jaw opens a little ----
  const rexCam = trexHeadCamera(REX_HEAD);
  const snort = ramp(g, POV + 2, POV + 22, [0, 1], (x) => x);
  const jaw = ramp(g, POV + 8, END, [0, 0.35]);

  if (space) {
    return (
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 42%, #1B2A6B 0%, #0A0F2E 60%, #03040E 100%)" }}>
        {Array.from({ length: 90 }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: (i * 211.7) % 1080,
              top: (i * 389.1) % 1920,
              width: 3 + (i % 3) * 2,
              height: 3 + (i % 3) * 2,
              borderRadius: 4,
              background: "#FFFFFF",
              opacity: 0.3 + 0.5 * Math.abs(Math.sin(i * 2.1 + g * 0.1)),
            }}
          />
        ))}
        <Shake frame={g} impacts={[{ at: PASS + 6, amp: 18, dur: 14 }]}>
          <Stage cam={{ position: [0, 0, 16], target: [0, 0.4, 0], fov: 52 }}>
            <hemisphereLight args={["#FFFFFF", "#1B2A6B", 0.9]} />
            <directionalLight position={[-8, 4, 8]} intensity={2.6} color="#FFF3E0" />
            <group position={[0.3, -3.9, -2]} scale={3.4}>
              <EarthGlobe spin={1.2 + t * 0.15} />
            </group>
            {/* Trail along its local -z: point +z along the flight (18, -4, 4). */}
            <group position={rock} rotation={[0.21, 1.35, 0, "YXZ"]}>
              <Asteroid size={1.4} fire={1} t={t} />
            </group>
          </Stage>
        </Shake>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ background: DUSK }}>
      <AbsoluteFill style={{ background: "#1A0F2E", opacity: pov ? 0 : shadow * 0.35, pointerEvents: "none", zIndex: 2 }} />
      <Shake
        frame={g}
        impacts={[
          { at: STOMP1, amp: 22, dur: 14 },
          { at: STOMP2, amp: 26, dur: 16 },
          { at: POV, amp: 10, dur: 10 },
        ]}
      >
        <Stage cam={pov ? rexCam : cam} near={0.05}>
          <hemisphereLight args={["#FFE3C0", "#4A2A6A", 1.25 - shadow * 0.4]} />
          <directionalLight position={[-6, 8, 6]} intensity={2.2 - shadow * 0.9} color="#FFC98A" />
          <PrehistoricValley t={t} />
          <group position={HILL_NUBI} rotation={[0, pov ? Math.PI * 0.05 : 0.3 - lookBack * 0.5, 0]}>
            <Nubi size={2} pose={pov ? { ...pose, lookY: 0.8, eyeScale: 1.5, roll: Math.sin(g * 2.7) * 0.05 } : pose} shadowOpacity={0.4}>
              <Outfit kind="scientist" />
            </Nubi>
          </group>
          {/* The shadow of something enormous creeping over Nubi. */}
          {!pov && shadow > 0.01 ? (
            <mesh position={[HILL_NUBI[0] + 0.4, 0.03, HILL_NUBI[2] - 0.6 + (1 - shadow) * -3]} rotation={[-Math.PI / 2, 0, 0.3]} scale={[3.4 * shadow, 4.4 * shadow, 1]}>
              <circleGeometry args={[1, 40]} />
              <meshBasicMaterial color="#12081F" transparent opacity={0.55 * shadow} depthWrite={false} />
            </mesh>
          ) : null}
          <DustPuff frame={g} at={STOMP1} position={[HILL_NUBI[0] + 2.5, 0, HILL_NUBI[2] - 2]} radius={2} />
          <DustPuff frame={g} at={STOMP2} position={[HILL_NUBI[0] - 1.8, 0, HILL_NUBI[2] - 2.5]} radius={2.2} />
          <SweatDrops frame={g} from={ESPERA} to={END} position={[HILL_NUBI[0], 2.0, HILL_NUBI[2] + 0.2]} spread={0.8} />
          {pov ? <TRexHead {...REX_HEAD} jaw={jaw} snort={snort} blink={0} /> : null}
        </Stage>
        {!pov ? <Burst frame={g} at={CHEER} x={500} y={700} color="#4DFF7C" size={640} /> : null}
        {!pov ? <Confetti frame={g} at={CHEER} count={90} /> : null}
      </Shake>
    </AbsoluteFill>
  );
};

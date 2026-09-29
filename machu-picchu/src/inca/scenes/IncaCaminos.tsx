import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_OUT, ramp, windowIn } from "../../anim";
import { IncaMap } from "../../overlay/inca/IncaMap";
import { Shake, Stage } from "../../scenes/common";
import { Vec3 } from "../../three/CameraRig";
import { Twinkles } from "../../three/Effects3D";
import { Quipu } from "../../three/inca/Costumes";
import { Phone3D } from "../../three/inca/Phone3D";
import { Island } from "../../three/Island";
import { Nubi } from "../../three/Nubi";
import { Outfit, Upright } from "../outfit";
import { incaTalk } from "../talk";
import { CAMINOS } from "../beats";
import { INCA } from "../timeline";

// "Aunque sin celulares… los incas ya tenían más de treinta mil kilómetros de caminos,
// chasquis y quipus para comunicarse." Nubi, a chasqui again, tosses the phone away and
// presents a giant map of the Qhapaq Ñan drawing itself.

const NUBI_AT: Vec3 = [1.3, 0, 0];
const CAM = { position: [0.4, 2.3, 12.8] as Vec3, target: [0.32, 1.62, 0] as Vec3, fov: 40 };

export const IncaCaminos: React.FC = () => {
  const frame = useCurrentFrame();
  const S = INCA.SCENES.caminos;
  const g = frame + S.from;
  const { END, TOSS, LOS, KM, CHASQUIS, QUIPUS } = CAMINOS;

  // Everything is held in the screen-left fin (towards the map): the phone, flicked away on
  // "celulares", then the quipu on "quipus". In between that fin presents the map.
  const tossT = ramp(g, TOSS, TOSS + 18, [0, 1], (x) => x);
  const tossed = g >= TOSS;
  const flick = windowIn(g, TOSS - 6, TOSS + 6, 3);
  const present = windowIn(g, LOS - 4, QUIPUS - 6, 6);
  const quipuUp = windowIn(g, QUIPUS - 4, END + 20, 5);
  const runBit = windowIn(g, CHASQUIS - 2, QUIPUS - 6, 4);
  const holding = tossed ? 0 : ramp(g, S.from + 4, S.from + 14);
  const pose = incaTalk(g, {
    finL: holding * 0.55 + flick * 0.8 + present * (0.95 + 0.08 * Math.sin((g - LOS) * 0.5)) + quipuUp * 1.05,
    finR: runBit * 0.4 * Math.sin(g * 0.8) + quipuUp * 0.3,
    hop: runBit * Math.abs(Math.sin(g * 0.5)) * 1.2 + quipuUp * Math.abs(Math.sin((g - QUIPUS) * 0.3)) * 0.6,
    wiggle: runBit,
    wigglePhase: g * 1.2,
    lookX: -0.55 * holding - 0.7 * present - 0.3 * quipuUp,
    lookY: 0.2 * holding + 0.35 * present + 0.25 * quipuUp,
    yaw: -0.3 * present,
    eyeScale: 1 + (tossed && g < TOSS + 16 ? 0.3 : 0) + quipuUp * 0.1,
  });

  const phone = !tossed ? (
    <Upright raise={pose.finL ?? 0} side="L">
      <group position={[-0.3, 1.2, 0.8]} rotation={[0.1, 0.3, 0]} scale={2.6}>
        <Phone3D screen="home" glow={0.8} />
      </group>
    </Upright>
  ) : null;
  const quipu =
    quipuUp > 0.01 ? (
      <Upright raise={pose.finL ?? 0} side="L">
        <group position={[-0.4, 0.6, 0.6]} scale={0.9 * Math.min(1, quipuUp * 1.5)}>
          <Quipu swing={Math.sin((g - QUIPUS) * 0.35) * 0.6} />
        </group>
      </Upright>
    ) : null;
  // The flicked phone spins up and away over the map, shrinking into the distance.
  const tossPos: Vec3 = [NUBI_AT[0] - 0.9 - tossT * 2.6, 1.4 + tossT * 4.2 - tossT * tossT * 2.2, NUBI_AT[2] + 0.3 - tossT * 7];

  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 40%, #FFE3A8 0%, #F5B45B 45%, #B8612A 80%, #5E2A12 100%)" }}>
      <Shake frame={g} impacts={[{ at: TOSS, amp: 6, dur: 8 }, { at: LOS, amp: 8, dur: 10 }]}>
        {/* The counter lands on "kilómetros"; runners start on "chasquis", the quipu on "quipus". */}
        <IncaMap frame={g} from={LOS - 4} x={470} y={640} scale={0.74} countAt={KM - 64} chasquiAt={CHASQUIS} quipuAt={QUIPUS} />
        <Stage cam={CAM}>
          <hemisphereLight args={["#FFF3E0", "#6B3A1A", 1.3]} />
          <directionalLight position={[-6, 10, 8]} intensity={2.4} color="#FFF6E8" />
          <directionalLight position={[7, 4, -4]} intensity={0.9} color="#FFC58A" />
          <group position={[NUBI_AT[0], -0.05, NUBI_AT[2]]}>
            <Island radius={1.9} />
          </group>
          <group position={NUBI_AT} rotation={[0, -0.25, 0]}>
            <Nubi size={2.1} pose={pose} shadowOpacity={0.4} holdL={phone ?? quipu}>
              <Outfit kind="chasqui" swing={Math.sin(g * 0.3) * 0.3} />
            </Nubi>
          </group>
          {tossed && tossT < 1 ? (
            <group position={tossPos} rotation={[tossT * 7, tossT * 3, tossT * 9]} scale={0.55}>
              <Phone3D screen="home" glow={0.8} />
            </group>
          ) : null}
          <Twinkles frame={g} at={QUIPUS} position={[NUBI_AT[0] + 1.0, 2.2, 0.5]} radius={1.2} count={10} />
        </Stage>
      </Shake>
      <AbsoluteFill
        style={{
          background: "radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0) 60%, rgba(60,20,0,0.35) 100%)",
          opacity: ramp(g, S.from, S.from + 20, [0, 1], EASE_OUT),
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, ramp, windowIn } from "../../anim";
import { CommentsCTA } from "../../overlay/inca/PhoneUI";
import { Shake, Stage } from "../../scenes/common";
import { Vec3, lerp3 } from "../../three/CameraRig";
import { Twinkles } from "../../three/Effects3D";
import { Island } from "../../three/Island";
import { Nubi } from "../../three/Nubi";
import { incaTalk } from "../talk";
import { CTA } from "../beats";
import { INCA } from "../timeline";

// "¿A qué otra época debería viajar Nubi? ¡Te leo en los comentarios!" Back from the trip,
// Nubi (no costume) wonders where to go next while era bubbles pop around, then points at
// the comment button.

const NUBI_AT: Vec3 = [-0.9, 0, 1.6];
const CAM_A = { position: [0.4, 4.4, 16.5] as Vec3, target: [0.32, 1.69, 0] as Vec3 };
const CAM_B = { position: [0.2, 4.0, 15.2] as Vec3, target: [0.22, 1.52, 0] as Vec3 };

export const IncaCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const S = INCA.SCENES.cta;
  const g = frame + S.from;
  const { END, EPOCA, TE } = CTA;

  const u = ramp(g, S.from, END, [0, 1], (x) => x);
  const cam = { position: lerp3(CAM_A.position, CAM_B.position, u), target: lerp3(CAM_A.target, CAM_B.target, u), fov: 40 };

  // Wonders (looks up at the bubbles, fin on "chin"), then points right at the comments.
  const wonder = windowIn(g, EPOCA - 6, TE - 4, 6);
  const point = ramp(g, TE - 4, TE + 6, [0, 1], EASE_IN_OUT);
  const pose = incaTalk(g, {
    finL: wonder * 0.55,
    finR: point * (0.85 + 0.12 * Math.sin((g - TE) * 0.7)),
    yaw: point * 0.35,
    lookX: -0.3 * wonder + 0.7 * point,
    lookY: 0.6 * wonder + 0.1 * point,
    hop: point * Math.abs(Math.sin((g - TE) * 0.3)) * 0.9,
    eyeScale: 1 + point * 0.15,
  });

  return (
    <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 34%, #FFB36B 0%, #FF5E7E 32%, #8E44FF 64%, #24105C 100%)" }}>
      <AbsoluteFill
        style={{
          background: `repeating-conic-gradient(from ${g * 0.3}deg at 50% 34%, rgba(255,255,255,0.09) 0deg 8deg, rgba(255,255,255,0) 8deg 20deg)`,
        }}
      />
      <Shake frame={g} impacts={[{ at: TE, amp: 8, dur: 10 }]}>
        <Stage cam={cam}>
          <hemisphereLight args={["#FFF3E6", "#6A2A7A", 1.35]} />
          <directionalLight position={[-6, 12, 10]} intensity={2.5} color="#FFF6E8" />
          <directionalLight position={[9, 4, -6]} intensity={1.2} color="#FF9AD5" />
          <group position={[0, -0.02, 0]}>
            <Island radius={5.6} />
          </group>
          <group position={NUBI_AT} rotation={[0, 0.15, 0]}>
            <Nubi size={2.5} pose={pose} />
          </group>
          <Twinkles frame={g} at={S.from + 2} position={[NUBI_AT[0], 1.6, NUBI_AT[2]]} radius={2.2} count={14} />
        </Stage>
        <CommentsCTA frame={g} at={EPOCA - 8} x={630} y={610} />
      </Shake>
    </AbsoluteFill>
  );
};

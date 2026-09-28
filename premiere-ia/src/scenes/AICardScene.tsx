import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Sheep} from '../character/Sheep';
import {blinkAt, idlePose, mixPose, pose} from '../character/poses';
import {EASE_IN_OUT, pop, ramp, rand} from '../anim';
import {BlockTitle, Burst, CornerMarks, Grain, Sparkle, Sticker, UrbanBackground} from '../mg/Urban';
import {C} from '../theme';

const SHEEP_H = 700;

// Bar 9 of the music: a break that builds up to the AI section.
export const AICardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + 600;

  const land = pop(frame, 2, {damping: 12, stiffness: 140});
  const y = (1 - land) * 700;
  const squash = frame > 10 && frame < 22 ? 1 - 0.12 * Math.sin(((frame - 10) / 12) * Math.PI) : 1;
  const pointIn = ramp(frame, 22, 30, [0, 1], EASE_IN_OUT);
  const shake = frame > 48 ? (rand(Math.floor(frame / 1)) - 0.5) * 10 * ramp(frame, 48, 72) : 0;

  let p = idlePose(g, 1.2, {squash, blink: blinkAt(g, 3), mouth: 'grin'});
  p = mixPose(p, pose({...p, farShoulder: 92, farElbow: 4, farHand: 'point', head: -8, mouth: 'o', nearShoulder: -20, nearElbow: 30}), pointIn);

  const glitch = (frame > 18 && frame < 26) || (frame > 56 && frame < 75);
  const gx = glitch ? (rand(Math.floor(frame / 2) + 3) - 0.5) * 26 : 0;
  const gy = glitch ? (rand(Math.floor(frame / 2) + 9) - 0.5) * 10 : 0;
  const zoom = 1 + 0.12 * ramp(frame, 50, 75, [0, 1], EASE_IN_OUT);

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, scale: `${zoom}`, translate: `${shake}px ${shake * 0.4}px`}}>
        <UrbanBackground frame={g} word="IA" dark />
        {/* glitch copies */}
        {glitch ? (
          <>
            <div style={{position: 'absolute', inset: 0, translate: `${gx}px ${gy}px`, opacity: 0.7, mixBlendMode: 'screen'}}>
              <BlockTitle frame={frame} start={6} text="¿Y LA IA?" x={120} y={330} size={300} color="#00E5FF" stroke="#00E5FF" shadow="transparent" stagger={2} />
            </div>
            <div style={{position: 'absolute', inset: 0, translate: `${-gx}px ${-gy}px`, opacity: 0.7, mixBlendMode: 'screen'}}>
              <BlockTitle frame={frame} start={6} text="¿Y LA IA?" x={120} y={330} size={300} color="#FF2A3D" stroke="#FF2A3D" shadow="transparent" stagger={2} />
            </div>
          </>
        ) : null}
        <BlockTitle frame={frame} start={6} text="¿Y LA IA?" x={120} y={330} size={300} color={C.white} stagger={2} />
        <Sticker frame={frame} start={34} x={600} y={740} rotate={-6} size={88} bg={C.ai}>
          5 FUNCIONES CON IA
        </Sticker>
        <Sparkle x={130} y={300} size={80} frame={frame} start={28} color={C.ai} />
        <Sparkle x={1080} y={260} size={60} frame={frame} start={32} spin={-1} />
        <Sparkle x={1040} y={660} size={46} frame={frame} start={38} color={C.yellow} />
        <Burst x={1500} y={960} frame={frame} start={12} radius={330} />
        <div style={{position: 'absolute', left: 1500 - (SHEEP_H * 880) / 1160 / 2, top: 990 - (SHEEP_H * 1110) / 1160 + y}}>
          <Sheep pose={p} height={SHEEP_H} flip shadowColor="rgba(0,0,0,0.5)" />
        </div>
        <CornerMarks frame={frame} start={0} />
      </div>
      <Grain frame={g} opacity={0.1} />
    </AbsoluteFill>
  );
};

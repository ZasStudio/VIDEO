import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Sheep} from '../character/Sheep';
import {blinkAt, idlePose, mixPose, walkPose} from '../character/poses';
import {EASE_IN_OUT, EASE_OUT, ramp} from '../anim';
import {SpeechBubble} from '../mg/Avatar';
import {BlockTitle, CornerMarks, Grain, Sparkle, Sticker, Ticker, UrbanBackground} from '../mg/Urban';
import {C, FONT} from '../theme';

const SHEEP_H = 760;
const GROUND = 1000;

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();

  // --- sheep choreography ---
  const walkX = ramp(frame, 0, 58, [-420, 470], EASE_OUT);
  const settle = ramp(frame, 50, 66, [0, 1], EASE_IN_OUT);
  const wave = ramp(frame, 64, 72) * (1 - ramp(frame, 100, 108));
  const crouch = ramp(frame, 128, 138, [0, 1], EASE_IN_OUT);
  const jump = ramp(frame, 138, 150, [0, 1], EASE_OUT);

  let pose = mixPose(walkPose(frame), idlePose(frame, 1), settle);
  if (wave > 0) {
    pose = mixPose(
      pose,
      {
        ...pose,
        farShoulder: 112,
        farElbow: 22 + 24 * Math.sin(frame * 0.55),
        farHand: 'open',
        farHandRot: 0,
        mouth: 'grin',
        head: -6,
      },
      wave,
    );
  }
  if (crouch > 0) {
    pose = mixPose(pose, {...pose, squash: 0.86, y: 30, nearKnee: 40, farKnee: 40, nearHip: 26, farHip: 20, head: 6, nearShoulder: -30, farShoulder: -30, mouth: 'grin'}, crouch * (1 - jump));
  }
  if (jump > 0) {
    pose = mixPose(pose, {...pose, squash: 1.1, y: -260, nearShoulder: 170, farShoulder: 170, nearElbow: 10, farElbow: 10, nearKnee: 50, farKnee: 60, mouth: 'o', nearHand: 'fist', farHand: 'fist'}, jump);
  }
  pose = {...pose, blink: blinkAt(frame, 20)};

  const zoom = 1 + 0.06 * ramp(frame, 100, 150, [0, 1], EASE_IN_OUT);

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, scale: `${zoom}`}}>
        <UrbanBackground frame={frame} word="EDIT" />
        <Ticker frame={frame} text="PREMIERE PRO • EDICIÓN • IA" y={96} rotate={-3} speed={5} enter={2} height={70} />
        <Ticker frame={frame} text="TUTORIAL EXPRÉS • 45 SEGUNDOS" y={1012} rotate={2} speed={-4} enter={8} height={60} bg={C.yellow} color={C.ink} accent={C.ink} />

        {/* sheep */}
        <div style={{position: 'absolute', left: walkX - (SHEEP_H * 880) / 1160 / 2, top: GROUND - (SHEEP_H * 1110) / 1160}}>
          <Sheep pose={pose} height={SHEEP_H} shadowColor="rgba(60,0,10,0.45)" />
        </div>
        <SpeechBubble frame={frame} start={70} exit={104} x={560} y={330} side="right" text="¡Hola!" size={52} />

        {/* title */}
        <BlockTitle frame={frame} start={26} text="CÓMO EDITAR" x={930} y={250} size={156} stagger={2} exit={140} />
        <BlockTitle frame={frame} start={40} text="EN PREMIERE PRO" x={930} y={420} size={118} stagger={2} color={C.white} exit={142} />
        <div
          style={{
            position: 'absolute',
            left: 936,
            top: 578,
            fontFamily: FONT.ui,
            fontWeight: 800,
            fontSize: 44,
            color: C.white,
            opacity: ramp(frame, 60, 70) * (1 - ramp(frame, 138, 146)),
            translate: `${(1 - ramp(frame, 60, 72)) * -40}px 0`,
            textShadow: '4px 4px 0 rgba(0,0,0,0.3)',
          }}
        >
          …y cómo la IA te ahorra horas
        </div>
        <Sticker frame={frame} start={76} exit={140} x={1650} y={740} rotate={-9} size={150} bg={C.yellow}>
          + IA
        </Sticker>
        <Sparkle x={1500} y={660} size={70} frame={frame} start={82} />
        <Sparkle x={1815} y={640} size={48} frame={frame} start={86} spin={-1} />
        <Sparkle x={1790} y={860} size={56} frame={frame} start={90} />
        <CornerMarks frame={frame} start={4} />
      </div>
      <Grain frame={frame} />
    </AbsoluteFill>
  );
};

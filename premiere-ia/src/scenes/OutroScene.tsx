import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Sheep} from '../character/Sheep';
import {blinkAt, idlePose, walkPose} from '../character/poses';
import {EASE_IN_OUT, pop, ramp} from '../anim';
import {BlockTitle, Burst, CornerMarks, Grain, Sparkle, Sticker, Ticker, UrbanBackground} from '../mg/Urban';
import {C, FONT} from '../theme';

export const HIT = 75; // local frame of the final musical hit (global 1275 = 42.5 s)

/** Choreography for the closing scene (shared with the After Effects export). */
export const outroChoreo = (frame: number) => {
  const g = frame + 1200;
  const poster = frame >= HIT;
  // Dance, then the poster pose (walking in place + pointing, like the reference art).
  const beat = (g / 18.75) * Math.PI;
  const dance = idlePose(g, 1.8, {
    farShoulder: 118 + 22 * Math.sin(beat),
    farElbow: 24,
    farHand: 'open',
    nearShoulder: 40 + 30 * Math.sin(beat + Math.PI),
    nearElbow: 80,
    nearHand: 'fist',
    mouth: 'grin',
    lean: 6 * Math.sin(beat / 2),
    blink: blinkAt(g, 11),
  });
  const walk = walkPose(g, {farShoulder: 72, farElbow: 8, farHand: 'point', mouth: 'smile', blink: blinkAt(g, 5), head: -2});
  const p = poster ? walk : dance;

  const sheepH = poster ? 770 : 720;
  const sheepX = poster ? 960 : 560;
  const slam = poster ? pop(frame, HIT, {damping: 9, stiffness: 180}) : 1;
  const fade = ramp(frame, 138, 150, [0, 1], EASE_IN_OUT);

  return {p, sheepH, sheepX, slam, fade, poster};
};

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const g = frame + 1200;

  const {p, sheepH, sheepX, slam, fade, poster} = outroChoreo(frame);

  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#000'}}>
      <div style={{position: 'absolute', inset: 0, opacity: 1 - fade}}>
        <UrbanBackground frame={g} word={poster ? undefined : 'IA'} dots={!poster} />
        {!poster ? (
          <>
            <Ticker frame={frame} text="EDITA MÁS RÁPIDO • CREA MÁS • IA" y={96} rotate={-3} speed={6} enter={0} height={70} />
            <BlockTitle frame={frame} start={4} text="EDITA MÁS" x={1010} y={250} size={150} exit={66} />
            <BlockTitle frame={frame} start={12} text="RÁPIDO" x={1010} y={410} size={150} exit={67} />
            <BlockTitle frame={frame} start={22} text="CREA MÁS" x={1010} y={570} size={170} color={C.yellow} exit={68} />
            <Sticker frame={frame} start={34} exit={66} x={1320} y={850} rotate={-6} size={70} bg={C.white}>
              PREMIERE PRO <span style={{color: C.red}}>+ IA</span>
            </Sticker>
            <Sparkle x={1760} y={560} size={70} frame={frame} start={40} color={C.yellow} />
          </>
        ) : (
          <>
            {/* poster homage: big letters around the character */}
            {[
              {t: 'I', x: 250, y: 150, d: 0},
              {t: 'A', x: 1540, y: 150, d: 3},
            ].map((l) => {
              const s = pop(frame, HIT + l.d, {damping: 10, stiffness: 200});
              return (
                <div
                  key={l.t}
                  style={{
                    position: 'absolute',
                    left: l.x,
                    top: l.y,
                    fontFamily: FONT.block,
                    fontSize: 300,
                    lineHeight: 1,
                    color: C.white,
                    scale: `${s}`,
                  }}
                >
                  {l.t}
                </div>
              );
            })}
            <Sparkle x={1640} y={820} size={230} frame={frame} start={HIT + 6} color={C.white} spin={0.3} />
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 60,
                textAlign: 'center',
                fontFamily: FONT.sign,
                fontSize: 40,
                color: C.white,
                opacity: ramp(frame, HIT + 4, HIT + 12),
              }}
            >
              PREMIERE PRO + IA
            </div>
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 58,
                textAlign: 'center',
                fontFamily: FONT.ui,
                fontWeight: 700,
                fontSize: 28,
                lineHeight: 1.35,
                color: C.white,
                opacity: ramp(frame, HIT + 10, HIT + 20),
              }}
            >
              Tutorial exprés: cómo editar en Premiere Pro
              <br />y usar la IA para trabajar más rápido
            </div>
            <Burst x={960} y={560} frame={frame} start={HIT} radius={520} count={18} />
          </>
        )}
        <div
          style={{
            position: 'absolute',
            left: sheepX - (sheepH * 880) / 1160 / 2,
            top: (poster ? 872 : 1000) - (sheepH * 1110) / 1160,
            scale: `${slam}`,
            transformOrigin: '50% 100%',
          }}
        >
          <Sheep pose={p} height={sheepH} shadowColor={poster ? 'rgba(20,20,20,0.9)' : 'rgba(60,0,10,0.45)'} />
        </div>
        <CornerMarks frame={frame} start={poster ? HIT : 0} />
      </div>
      <Grain frame={g} />
    </AbsoluteFill>
  );
};

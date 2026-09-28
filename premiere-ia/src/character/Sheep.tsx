import React from 'react';
import {C} from '../theme';

// Urban sheep avatar, drawn from scratch as a rigged SVG.
// Local units: ground is y = 0, the top of the wool is around y = -1040.
// The character faces +x (screen right). Use `flip` to face left.

export type HandShape = 'fist' | 'point' | 'open' | 'thumb';
export type MouthShape = 'smile' | 'talk' | 'o' | 'grin';

export type SheepPose = {
  x: number;
  y: number; // negative = up
  lean: number; // deg, positive = lean forward
  squash: number; // 1 = neutral, <1 squashed, >1 stretched
  head: number; // deg, positive = nod forward
  nearShoulder: number; // deg, 0 = arm down, positive = forward
  nearElbow: number; // deg, positive = bend forward
  nearHand: HandShape;
  nearHandRot: number;
  farShoulder: number;
  farElbow: number;
  farHand: HandShape;
  farHandRot: number;
  nearHip: number; // deg, positive = leg forward
  nearKnee: number; // deg, positive = bend
  nearFoot: number; // deg, positive = toes up
  farHip: number;
  farKnee: number;
  farFoot: number;
  blink: number; // 0 open, 1 closed
  mouth: MouthShape;
  mouthOpen: number; // 0..1
  lookX: number;
  lookY: number;
  ear: number; // deg, extra ear flop
  tail: number; // deg
};

export const BASE_POSE: SheepPose = {
  x: 0,
  y: 0,
  lean: 0,
  squash: 1,
  head: 0,
  nearShoulder: -6,
  nearElbow: 10,
  nearHand: 'fist',
  nearHandRot: 0,
  farShoulder: 8,
  farElbow: 12,
  farHand: 'fist',
  farHandRot: 0,
  nearHip: 4,
  nearKnee: 4,
  nearFoot: 0,
  farHip: -4,
  farKnee: 4,
  farFoot: 0,
  blink: 0,
  mouth: 'smile',
  mouthOpen: 0,
  lookX: 0,
  lookY: 0,
  ear: 0,
  tail: 0,
};

const STROKE = 9;
const INK = C.ink;

// Rig dimensions
const HEAD_SCALE = 1.22;
const SHOE_SCALE = 1.22;
const HAND_SCALE = 1.3;
const HIP_NEAR = {x: -34, y: -262};
const HIP_FAR = {x: 42, y: -266};
const THIGH = 62;
const SHIN = 104; // knee -> ankle
const SHOULDER_NEAR = {x: -98, y: -476};
const SHOULDER_FAR = {x: 112, y: -482};
const UPPER_ARM = 70;
const FOREARM = 64;
const NECK = {x: 14, y: -512};
const HIP_PIVOT = {x: 0, y: -262};

const capsule = (x: number, y: number, w: number, h: number) => {
  const r = w / 2;
  return `M ${x},${y + r} A ${r},${r} 0 0 1 ${x + w},${y + r} L ${x + w},${y + h - r} A ${r},${r} 0 0 1 ${x},${y + h - r} Z`;
};

// ---------- Hands ----------

const Hand: React.FC<{shape: HandShape; rot: number}> = ({shape, rot}) => {
  const knuckle = '#3A3A3A';
  return (
    <g transform={`rotate(${rot})`}>
      {shape === 'point' ? (
        <path
          d="M 4,38 C 6,62 10,86 14,104 C 17,114 31,113 31,102 C 29,84 26,60 23,38 Z"
          fill={INK}
        />
      ) : null}
      {shape === 'thumb' ? (
        <path
          d="M -18,20 C -34,12 -48,2 -54,-10 C -58,-20 -48,-28 -40,-22 C -30,-12 -18,-4 -6,2 Z"
          fill={INK}
        />
      ) : null}
      {shape === 'open' ? (
        <g fill={INK}>
          <path d="M -28,6 C -36,30 -34,58 -22,74 C -10,88 14,88 24,74 C 34,58 34,30 28,6 Z" />
          <path d={capsule(-26, 52, 15, 52)} />
          <path d={capsule(-9, 58, 15, 56)} />
          <path d={capsule(8, 55, 15, 50)} />
          <path d="M 24,26 C 40,18 56,20 58,32 C 60,42 46,48 26,48 Z" />
        </g>
      ) : (
        <path
          d="M -27,4 C -32,22 -31,46 -21,58 C -9,69 13,69 23,58 C 31,46 31,22 27,4 Z"
          fill={INK}
        />
      )}
      {shape !== 'open' ? (
        <g stroke={knuckle} strokeWidth={3.5} fill="none" strokeLinecap="round">
          <path d="M -16,34 C -12,46 -4,50 4,48" />
          <path d="M -8,22 C -4,30 2,33 8,32" />
        </g>
      ) : (
        <g stroke={knuckle} strokeWidth={3} fill="none" strokeLinecap="round">
          <path d="M -12,40 C -8,50 0,54 10,52" />
        </g>
      )}
    </g>
  );
};

// ---------- Arms ----------

const Sleeve: React.FC<{w: number; top: number; len: number; cuff?: boolean}> = ({
  w,
  top,
  len,
  cuff,
}) => {
  const x = -w / 2;
  const d = capsule(x, top, w, len - top);
  const clipId = React.useId();
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <path d={d} />
        </clipPath>
      </defs>
      <path d={d} fill={C.white} />
      <g clipPath={`url(#${clipId})`}>
        <rect x={x - 2} y={top - 2} width={w * 0.34} height={len - top + 4} fill={C.pink} />
        {cuff ? (
          <g>
            <rect x={x - 2} y={len - 30} width={w + 4} height={32} fill={C.red} />
            <rect x={x - 2} y={len - 22} width={w + 4} height={6} fill={C.white} />
            <rect x={x - 2} y={len - 12} width={w + 4} height={5} fill={C.white} />
          </g>
        ) : null}
      </g>
      <path d={d} fill="none" stroke={INK} strokeWidth={STROKE} />
    </g>
  );
};

const Arm: React.FC<{
  shoulder: number;
  elbow: number;
  hand: HandShape;
  handRot: number;
}> = ({shoulder, elbow, hand, handRot}) => {
  return (
    <g transform={`rotate(${-shoulder})`}>
      <Sleeve w={78} top={-44} len={UPPER_ARM + 22} />
      <g transform={`translate(0, ${UPPER_ARM}) rotate(${-elbow})`}>
        <Sleeve w={70} top={-34} len={FOREARM} cuff />
        <g transform={`translate(0, ${FOREARM - 6}) scale(${HAND_SCALE})`}>
          <Hand shape={hand} rot={handRot} />
        </g>
      </g>
    </g>
  );
};

// ---------- Legs ----------

const Shoe: React.FC = () => {
  const upper =
    'M -46,56 C -48,20 -46,-24 -32,-40 L 10,-40 C 18,-40 22,-34 24,-26 C 32,2 54,16 82,26 C 106,34 118,46 118,58 Z';
  const toe = 'M 80,25 C 102,32 118,46 118,58 L 74,58 C 70,46 72,34 80,25 Z';
  const heel = 'M -46,56 C -48,20 -46,-6 -40,-18 C -26,-14 -18,10 -16,56 Z';
  const sole = 'M -52,54 L 120,54 C 130,54 132,78 120,78 L -50,78 C -60,78 -62,54 -52,54 Z';
  return (
    <g>
      <path d={upper} fill={C.red} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
      <path d={heel} fill={C.white} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      <path d={toe} fill={C.white} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      <path
        d="M -32,-40 L 10,-40"
        stroke={INK}
        strokeWidth={14}
        strokeLinecap="round"
      />
      <g stroke={C.white} strokeWidth={6} strokeLinecap="round">
        <path d="M 14,-22 L 30,-14" />
        <path d="M 22,-6 L 40,2" />
        <path d="M 32,8 L 50,15" />
      </g>
      <path
        d="M -30,30 C -4,14 30,14 58,26"
        stroke={C.redDark}
        strokeWidth={7}
        fill="none"
        strokeLinecap="round"
      />
      <path d={sole} fill={C.white} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
      <path d="M -50,70 L 124,70" stroke={C.redDark} strokeWidth={5} />
    </g>
  );
};

const Leg: React.FC<{hip: number; knee: number; foot: number}> = ({hip, knee, foot}) => {
  return (
    <g transform={`rotate(${-hip})`}>
      {/* thigh (mostly hidden by shorts) */}
      <path d={capsule(-21, -10, 42, THIGH + 20)} fill={INK} />
      <g transform={`translate(0, ${THIGH}) rotate(${knee})`}>
        <path d={capsule(-19, -18, 38, SHIN + 10)} fill={INK} />
        {/* sock */}
        <g>
          <path
            d={capsule(-24, SHIN - 84, 48, 76)}
            fill={C.white}
            stroke={INK}
            strokeWidth={7}
          />
          <rect x={-22} y={SHIN - 74} width={44} height={7} fill={C.red} />
          <rect x={-22} y={SHIN - 62} width={44} height={7} fill={C.red} />
        </g>
        <g transform={`translate(0, ${SHIN}) rotate(${-foot}) scale(${SHOE_SCALE})`}>
          <Shoe />
        </g>
      </g>
    </g>
  );
};

const ShortsLeg: React.FC<{hip: number}> = ({hip}) => (
  <g transform={`rotate(${-hip})`}>
    <path
      d="M -54,-30 L 54,-30 L 54,62 C 26,72 -26,72 -54,62 Z"
      fill="#1C1C1C"
      stroke={INK}
      strokeWidth={STROKE}
      strokeLinejoin="round"
    />
    <path d="M -48,54 C -22,62 22,62 48,54" stroke="#EDEDED" strokeWidth={5} fill="none" />
    <path d="M -44,-14 L -44,50" stroke="#EDEDED" strokeWidth={7} />
  </g>
);

// ---------- Head ----------

const WOOL: [number, number, number][] = [
  [-108, -296, 72],
  [-36, -352, 82],
  [58, -360, 84],
  [142, -306, 70],
  [182, -236, 48],
  [-152, -222, 56],
  [-128, -160, 40],
  [0, -262, 84],
  [100, -250, 72],
  [62, -226, 40],
  [-24, -224, 42],
  [128, -218, 34],
];

const Wool: React.FC = () => (
  <g>
    {WOOL.map(([x, y, r], i) => (
      <circle key={`o${i}`} cx={x} cy={y} r={r + STROKE / 2 + 1} fill={INK} />
    ))}
    {WOOL.map(([x, y, r], i) => (
      <circle key={`p${i}`} cx={x} cy={y} r={r - 3} fill={C.pink} />
    ))}
    {WOOL.map(([x, y, r], i) => (
      <circle key={`w${i}`} cx={x + 4} cy={y - 8} r={r * 0.86} fill={C.white} />
    ))}
  </g>
);

const FACE =
  'M -92,-150 C -96,-222 -30,-262 44,-262 C 124,-262 178,-214 178,-146 C 178,-92 150,-50 108,-36 C 72,-24 22,-26 -18,-42 C -62,-60 -90,-100 -92,-150 Z';

const Eye: React.FC<{cx: number; cy: number; rx: number; ry: number; blink: number}> = ({
  cx,
  cy,
  rx,
  ry,
  blink,
}) => {
  const s = Math.max(0.08, 1 - blink);
  return (
    <g transform={`translate(${cx}, ${cy}) scale(1, ${s})`}>
      <ellipse cx={0} cy={0} rx={rx} ry={ry} fill={INK} />
      {blink < 0.5 ? (
        <ellipse cx={-rx * 0.35} cy={-ry * 0.45} rx={rx * 0.28} ry={ry * 0.2} fill={C.white} />
      ) : null}
    </g>
  );
};

const Mouth: React.FC<{shape: MouthShape; open: number}> = ({shape, open}) => {
  if (shape === 'o') {
    return (
      <g>
        <ellipse cx={150} cy={-66} rx={11} ry={14} fill={INK} />
        <ellipse cx={150} cy={-60} rx={6} ry={5} fill={C.pinkDeep} />
      </g>
    );
  }
  if (shape === 'talk' || shape === 'grin') {
    const h = shape === 'grin' ? 26 : 6 + 26 * open;
    return (
      <g>
        <path
          d={`M 126,-78 C 136,-80 164,-82 172,-78 C 172,${-78 + h} 158,${-70 + h} 150,${-70 + h} C 140,${-70 + h} 126,${-78 + h} 126,-78 Z`}
          fill={INK}
          stroke={INK}
          strokeWidth={4}
          strokeLinejoin="round"
        />
        {h > 12 ? (
          <ellipse cx={152} cy={-78 + h * 0.85} rx={12} ry={Math.min(8, h * 0.3)} fill={C.pinkDeep} />
        ) : null}
      </g>
    );
  }
  return (
    <path
      d="M 128,-76 C 132,-64 144,-64 149,-74 C 154,-64 166,-64 170,-76"
      stroke={INK}
      strokeWidth={6}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
};

const Head: React.FC<{pose: SheepPose}> = ({pose}) => {
  const faceClip = React.useId();
  return (
    <g>
      {/* far ear + far cup (behind) */}
      <g transform={`translate(168, -150) rotate(${24 + pose.ear})`}>
        <path
          d="M 0,-18 C 30,-32 84,-28 100,-2 C 108,14 98,30 80,28 C 52,24 20,18 0,16 Z"
          fill={C.white}
          stroke={INK}
          strokeWidth={STROKE}
        />
      </g>
      <ellipse cx={182} cy={-186} rx={22} ry={50} fill={C.red} stroke={INK} strokeWidth={STROKE} />
      {/* face */}
      <defs>
        <clipPath id={faceClip}>
          <path d={FACE} />
        </clipPath>
      </defs>
      <path d={FACE} fill={C.white} />
      <g clipPath={`url(#${faceClip})`}>
        <path d="M -110,-150 C -90,-70 -20,-44 60,-40 L 60,0 L -120,0 Z" fill={C.pink} />
        <ellipse cx={138} cy={-92} rx={40} ry={24} fill={C.cream} />
      </g>
      <path d={FACE} fill="none" stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
      {/* eyes */}
      <g transform={`translate(${pose.lookX}, ${pose.lookY})`}>
        <Eye cx={10} cy={-140} rx={21} ry={35} blink={pose.blink} />
        <Eye cx={114} cy={-134} rx={16} ry={30} blink={pose.blink} />
      </g>
      {/* nose + mouth */}
      <path
        d="M 141,-106 C 148,-110 160,-109 164,-103 C 162,-95 155,-90 151,-90 C 145,-92 140,-99 141,-106 Z"
        fill={INK}
      />
      <Mouth shape={pose.mouth} open={pose.mouthOpen} />
      {/* wool */}
      <Wool />
      {/* near ear */}
      <g transform={`translate(-78, -150) rotate(${-22 - pose.ear})`}>
        <path
          d="M 0,-20 C -30,-36 -96,-32 -120,0 C -132,20 -120,40 -96,38 C -62,34 -24,24 0,20 Z"
          fill={C.white}
          stroke={INK}
          strokeWidth={STROKE}
          strokeLinejoin="round"
        />
        <path
          d="M -12,-8 C -36,-18 -84,-16 -102,4 C -108,14 -100,24 -88,22 C -60,18 -32,12 -12,8 Z"
          fill={C.pink}
        />
      </g>
      {/* headphone band */}
      <path
        d="M -96,-222 C -118,-340 -44,-452 58,-452 C 156,-452 214,-370 196,-270"
        stroke={INK}
        strokeWidth={34}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M -96,-222 C -118,-340 -44,-452 58,-452 C 156,-452 214,-370 196,-270"
        stroke={C.red}
        strokeWidth={18}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M -86,-300 C -80,-370 -30,-432 40,-440"
        stroke="#FF8A95"
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
      />
      {/* near cup */}
      <g transform="translate(-102, -168) scale(1.22)">
        <ellipse cx={26} cy={0} rx={28} ry={58} fill={INK} />
        <ellipse cx={0} cy={0} rx={52} ry={62} fill={C.red} stroke={INK} strokeWidth={STROKE} />
        <ellipse cx={-2} cy={2} rx={38} ry={46} fill={C.redDark} />
        <ellipse cx={-4} cy={2} rx={27} ry={34} fill={C.red} stroke={INK} strokeWidth={5} />
        <path
          d="M -40,-22 C -34,-44 -14,-56 6,-56"
          stroke={C.white}
          strokeWidth={7}
          fill="none"
          strokeLinecap="round"
        />
        <ellipse cx={-12} cy={-8} rx={7} ry={10} fill="#FF8A95" />
      </g>
    </g>
  );
};

// ---------- Torso ----------

const JACKET =
  'M -106,-512 C -46,-540 78,-542 132,-512 C 152,-476 158,-392 146,-330 C 142,-310 136,-298 128,-286 L -106,-286 C -124,-318 -134,-392 -128,-452 C -126,-480 -118,-500 -106,-512 Z';

const Torso: React.FC = () => {
  const clip = React.useId();
  return (
    <g>
      <defs>
        <clipPath id={clip}>
          <path d={JACKET} />
        </clipPath>
      </defs>
      <path d={JACKET} fill={C.red} />
      <g clipPath={`url(#${clip})`}>
        <path d="M -150,-560 L -54,-560 C -82,-480 -92,-390 -70,-280 L -150,-280 Z" fill={C.redDark} />
        <rect x={-150} y={-324} width={320} height={40} fill={C.red} />
        <rect x={-150} y={-315} width={320} height={7} fill={C.white} />
        <rect x={-150} y={-302} width={320} height={7} fill={C.white} />
        <path d="M -150,-324 L 170,-324" stroke={INK} strokeWidth={5} />
      </g>
      <path
        d="M 110,-494 C 130,-454 134,-392 124,-344"
        stroke="#FF6B78"
        strokeWidth={8}
        fill="none"
        strokeLinecap="round"
      />
      <path d={JACKET} fill="none" stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
      {/* shirt + collar */}
      <path
        d="M -62,-524 C -30,-492 22,-456 50,-436 C 72,-460 94,-494 108,-526 Z"
        fill={C.white}
        stroke={INK}
        strokeWidth={6}
      />
      <path
        d="M -66,-526 C -32,-490 22,-452 50,-432 C 74,-458 96,-492 112,-528"
        stroke={INK}
        strokeWidth={32}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M -66,-526 C -32,-490 22,-452 50,-432 C 74,-458 96,-492 112,-528"
        stroke={C.red}
        strokeWidth={22}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M -66,-526 C -32,-490 22,-452 50,-432 C 74,-458 96,-492 112,-528"
        stroke={C.white}
        strokeWidth={6}
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* placket + snaps */}
      <path d="M 50,-422 L 60,-290" stroke={INK} strokeWidth={5} />
      {[
        [53, -398],
        [56, -364],
        [58, -330],
      ].map(([x, y]) => (
        <circle key={y} cx={x} cy={y} r={9} fill={C.white} stroke={INK} strokeWidth={5} />
      ))}
      {/* welt pocket */}
      <path d="M -84,-404 L -62,-352" stroke={INK} strokeWidth={14} strokeLinecap="round" />
      <path d="M -84,-404 L -62,-352" stroke={C.redDark} strokeWidth={5} strokeLinecap="round" />
    </g>
  );
};

const Tail: React.FC<{rot: number}> = ({rot}) => {
  const puffs: [number, number, number][] = [
    [0, 0, 28],
    [-18, 20, 22],
    [10, 22, 20],
  ];
  return (
    <g transform={`translate(-128, -318) rotate(${rot})`}>
      {puffs.map(([x, y, r], i) => (
        <circle key={`o${i}`} cx={x} cy={y} r={r + 5} fill={INK} />
      ))}
      {puffs.map(([x, y, r], i) => (
        <circle key={`w${i}`} cx={x} cy={y} r={r} fill={C.white} />
      ))}
    </g>
  );
};

// ---------- Full character ----------

export const Sheep: React.FC<{
  pose: SheepPose;
  height: number; // px of the full viewBox height
  flip?: boolean;
  shadow?: boolean;
  shadowColor?: string;
  style?: React.CSSProperties;
}> = ({pose, height, flip, shadow = true, shadowColor = 'rgba(0,0,0,0.35)', style}) => {
  const vbX = -440;
  const vbY = -1110;
  const vbW = 880;
  const vbH = 1160;
  const width = (height * vbW) / vbH;
  const lift = Math.min(0, pose.y);
  const shadowScale = Math.max(0.55, 1 + lift / 500);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      style={{overflow: 'visible', ...style}}
    >
      <g transform={flip ? 'scale(-1, 1)' : undefined}>
        {shadow ? (
          <ellipse
            cx={pose.x + 10}
            cy={6}
            rx={200 * shadowScale}
            ry={24 * shadowScale}
            fill={shadowColor}
          />
        ) : null}
        <g
          transform={`translate(${pose.x}, ${pose.y}) translate(0, 0) scale(${1 / Math.sqrt(pose.squash)}, ${pose.squash})`}
        >
          <g transform={`translate(${HIP_PIVOT.x}, ${HIP_PIVOT.y}) rotate(${pose.lean}) translate(${-HIP_PIVOT.x}, ${-HIP_PIVOT.y})`}>
            {/* far arm (behind body) */}
            <g transform={`translate(${SHOULDER_FAR.x}, ${SHOULDER_FAR.y})`}>
              <Arm
                shoulder={pose.farShoulder}
                elbow={pose.farElbow}
                hand={pose.farHand}
                handRot={pose.farHandRot}
              />
            </g>
          </g>
          {/* far leg */}
          <g transform={`translate(${HIP_FAR.x}, ${HIP_FAR.y})`}>
            <Leg hip={pose.farHip} knee={pose.farKnee} foot={pose.farFoot} />
          </g>
          <g transform={`translate(${HIP_FAR.x}, ${HIP_FAR.y})`}>
            <ShortsLeg hip={pose.farHip} />
          </g>
          {/* near leg */}
          <g transform={`translate(${HIP_NEAR.x}, ${HIP_NEAR.y})`}>
            <Leg hip={pose.nearHip} knee={pose.nearKnee} foot={pose.nearFoot} />
          </g>
          <g transform={`translate(${HIP_NEAR.x}, ${HIP_NEAR.y})`}>
            <ShortsLeg hip={pose.nearHip} />
          </g>
          {/* pelvis */}
          <path
            d="M -112,-320 L 134,-320 L 130,-250 C 66,-230 -46,-230 -108,-250 Z"
            fill="#1C1C1C"
            stroke={INK}
            strokeWidth={STROKE}
            strokeLinejoin="round"
          />
          <g transform={`translate(${HIP_PIVOT.x}, ${HIP_PIVOT.y}) rotate(${pose.lean}) translate(${-HIP_PIVOT.x}, ${-HIP_PIVOT.y})`}>
            <Tail rot={pose.tail} />
            <Torso />
            <g transform={`translate(${NECK.x}, ${NECK.y}) rotate(${pose.head}) scale(${HEAD_SCALE})`}>
              <Head pose={pose} />
            </g>
            {/* near arm (in front) */}
            <g transform={`translate(${SHOULDER_NEAR.x}, ${SHOULDER_NEAR.y})`}>
              <Arm
                shoulder={pose.nearShoulder}
                elbow={pose.nearElbow}
                hand={pose.nearHand}
                handRot={pose.nearHandRot}
              />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
};

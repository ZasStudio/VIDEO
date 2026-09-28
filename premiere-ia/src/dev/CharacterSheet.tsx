import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {Sheep} from '../character/Sheep';
import {idlePose, pose, walkPose, talkAt} from '../character/poses';
import {C} from '../theme';

// Dev-only still to review the character rig in several poses.
export const CharacterSheet: React.FC = () => {
  const frame = useCurrentFrame();
  const poses = [
    idlePose(frame),
    walkPose(frame),
    walkPose(frame + 9),
    pose({farShoulder: 88, farElbow: 6, farHand: 'point', head: -4, mouth: 'grin'}),
    pose({
      nearShoulder: 160,
      nearElbow: 30,
      nearHand: 'open',
      mouth: 'talk',
      mouthOpen: talkAt(frame),
      head: -6,
    }),
    pose({nearShoulder: 38, nearElbow: 96, nearHand: 'thumb', mouth: 'o', blink: 0}),
  ];
  return (
    <AbsoluteFill style={{backgroundColor: C.red}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-around',
          paddingBottom: 60,
        }}
      >
        {poses.map((p, i) => (
          <Sheep key={i} pose={p} height={560} />
        ))}
      </div>
      <div style={{position: 'absolute', left: 60, top: 60}}>
        <Sheep pose={idlePose(frame, 1, {mouth: 'talk', mouthOpen: 0.7})} height={900} flip />
      </div>
    </AbsoluteFill>
  );
};

import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {PremiereUI} from '../ui/PremiereUI';
import {DEFAULT_CLIPS} from '../ui/clips';
import {L} from '../ui/layout';
import {TranscriptPanel} from '../ui/RightPanels';


// Dev-only preview of the interface.
export const UISheet: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <PremiereUI
        state={{
          frame,
          playhead: 4.2,
          clips: DEFAULT_CLIPS,
          program: {kind: 'vlog', t: frame, talking: true},
          focus: 'timeline',
          right: <TranscriptPanel r={L.right} state={{typed: 1, select: 0.6, deleted: 0}} />,
        }}
      />
    </AbsoluteFill>
  );
};

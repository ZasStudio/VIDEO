import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Captions } from "../overlay/Captions";
import { Vignette } from "../overlay/Graphics";
import { ZoomCut } from "../scenes/common";
import { Mix } from "../Soundtrack";
import { NUBI_BEDS, NUBI_CUES } from "./cues";
import { NubiFinal } from "./scenes/NubiFinal";
import { NubiHook } from "./scenes/NubiHook";
import { NubiPiedras } from "./scenes/NubiPiedras";
import { NubiSismo } from "./scenes/NubiSismo";
import { MUSIC_OFFSET, NUBI, NubiScene } from "./timeline";

// Nubi's vertical short (1080 x 1920, 15 s): why Machu Picchu survives earthquakes.

const SCENE_COMPONENTS: Record<NubiScene, React.FC> = {
  hook: NubiHook,
  piedras: NubiPiedras,
  sismo: NubiSismo,
  final: NubiFinal,
};

const SceneSlot: React.FC<{ k: NubiScene }> = ({ k }) => {
  const frame = useCurrentFrame();
  const Comp = SCENE_COMPONENTS[k];
  return (
    <ZoomCut frame={frame} duration={NUBI.SCENES[k].duration} inFrames={k === "hook" ? 0 : 6} outFrames={k === "final" ? 0 : 5}>
      <Comp />
    </ZoomCut>
  );
};

export const NubiSoundtrack: React.FC = () => (
  <Mix
    music="nubi/music.wav"
    musicTrim={MUSIC_OFFSET}
    duration={NUBI.DURATION}
    fadeOut={14}
    cues={NUBI_CUES}
    beds={NUBI_BEDS}
    lines={NUBI.LINES}
    voiceDir="nubi/voice"
    ducking={NUBI.ducking}
  />
);

export const NubiShort: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => (
  <AbsoluteFill style={{ background: "#000" }}>
    {(Object.keys(NUBI.SCENES) as NubiScene[]).map((k) => (
      <Sequence key={k} from={NUBI.SCENES[k].from} durationInFrames={NUBI.SCENES[k].duration} name={k}>
        <SceneSlot k={k} />
      </Sequence>
    ))}
    <Vignette strength={0.32} />
    {/* Mid-lower third: clear of the app buttons and descriptions at the bottom of a phone. */}
    <Captions chunks={NUBI.CAPTIONS} bottom={440} fontSize={92} maxWidth={960} />
    {withAudio ? <NubiSoundtrack /> : null}
  </AbsoluteFill>
);

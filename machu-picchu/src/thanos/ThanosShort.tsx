import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { PoofWipe } from "../inca/PoofWipe";
import { Captions } from "../overlay/Captions";
import { Vignette } from "../overlay/Graphics";
import { ZoomCut } from "../scenes/common";
import { Mix } from "../Soundtrack";
import { THANOS_BEDS, THANOS_CUES } from "./cues";
import { SAFE } from "./safe";
import { SCENE_COMPONENTS } from "./scenes";
import { MUSIC_TO, MUSIC_TRIM, THANOS, ThanosScene } from "./timeline";

// "¿Y si Thanos NUNCA chasqueaba los dedos?" Nubi's vertical short (1080 x 1920, 90 s). Every
// character is a Nubi-shaped toy in other colours; costume changes happen behind a cloud of
// smoke and several shots are in first person.

/** Scenes that open with a costume change behind smoke (and where it gathers). */
const POOF_AT: Partial<Record<ThanosScene, [number, number]>> = {
  thor: [500, 1000],
  trajes: [500, 1000],
};

/** Hard cuts (no zoom) into and out of the black post-credits cards. */
const NO_ZOOM_IN: ThanosScene[] = ["portal", "poscreditos", "doom", "cierre"];
const NO_ZOOM_OUT: ThanosScene[] = ["final", "poscreditos", "doom", "cierre"];

const SceneSlot: React.FC<{ k: ThanosScene }> = ({ k }) => {
  const frame = useCurrentFrame();
  const Comp = SCENE_COMPONENTS[k];
  return (
    <ZoomCut frame={frame} duration={THANOS.SCENES[k].duration} inFrames={NO_ZOOM_IN.includes(k) ? 0 : 6} outFrames={NO_ZOOM_OUT.includes(k) ? 0 : 5}>
      <Comp />
    </ZoomCut>
  );
};

export const ThanosSoundtrack: React.FC = () => (
  <Mix
    music="thanos/music.wav"
    musicTrim={MUSIC_TRIM}
    musicTo={MUSIC_TO}
    duration={THANOS.DURATION}
    fadeOut={8}
    cues={THANOS_CUES}
    beds={THANOS_BEDS}
    lines={THANOS.LINES}
    voiceDir="thanos/voice"
    ducking={THANOS.ducking}
  />
);

export const ThanosShort: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  const frame = useCurrentFrame();
  const keys = Object.keys(THANOS.SCENES) as ThanosScene[];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {keys.map((k) => (
        <Sequence key={k} from={THANOS.SCENES[k].from} durationInFrames={THANOS.SCENES[k].duration} name={k}>
          <SceneSlot k={k} />
        </Sequence>
      ))}
      <Vignette strength={0.28} />
      {keys.map((k) => {
        const at = POOF_AT[k];
        return at ? <PoofWipe key={k} frame={frame} at={THANOS.SCENES[k].from} x={at[0]} y={at[1]} /> : null;
      })}
      <Captions chunks={THANOS.CAPTIONS} {...SAFE.captions} />
      {withAudio ? <ThanosSoundtrack /> : null}
    </AbsoluteFill>
  );
};

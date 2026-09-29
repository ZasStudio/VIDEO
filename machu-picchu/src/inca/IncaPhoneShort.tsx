import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Captions } from "../overlay/Captions";
import { Vignette } from "../overlay/Graphics";
import { ZoomCut } from "../scenes/common";
import { Mix } from "../Soundtrack";
import { INCA_BEDS, INCA_CUES } from "./cues";
import { PoofWipe } from "./PoofWipe";
import { IncaCTA } from "./scenes/IncaCTA";
import { IncaCaminos } from "./scenes/IncaCaminos";
import { IncaChasqui } from "./scenes/IncaChasqui";
import { IncaIntro } from "./scenes/IncaIntro";
import { IncaPapa } from "./scenes/IncaPapa";
import { IncaSelfie } from "./scenes/IncaSelfie";
import { IncaThrone } from "./scenes/IncaThrone";
import { INCA, IncaScene, MUSIC_TRIM } from "./timeline";

// "¿Así sería vivir en el Imperio Inca con celular?" Nubi's vertical short (1080 x 1920, 60 s).
// Every scene change is a costume change behind a cloud of smoke.

const SCENE_COMPONENTS: Record<IncaScene, React.FC> = {
  intro: IncaIntro,
  chasqui: IncaChasqui,
  inca: IncaThrone,
  papa: IncaPapa,
  selfie: IncaSelfie,
  caminos: IncaCaminos,
  cta: IncaCTA,
};

/** Where the smoke of each costume change gathers (around Nubi in the new scene). */
const POOF_AT: Partial<Record<IncaScene, [number, number]>> = {
  chasqui: [540, 1020],
  inca: [540, 1040],
  papa: [540, 1020],
  selfie: [560, 1000],
  caminos: [760, 1120],
  cta: [470, 1060],
};

const SceneSlot: React.FC<{ k: IncaScene }> = ({ k }) => {
  const frame = useCurrentFrame();
  const Comp = SCENE_COMPONENTS[k];
  return (
    <ZoomCut frame={frame} duration={INCA.SCENES[k].duration} inFrames={k === "intro" ? 0 : 6} outFrames={k === "cta" ? 0 : 5}>
      <Comp />
    </ZoomCut>
  );
};

export const IncaSoundtrack: React.FC = () => (
  <Mix
    music="inca/music.wav"
    musicTrim={MUSIC_TRIM}
    duration={INCA.DURATION}
    fadeOut={20}
    cues={INCA_CUES}
    beds={INCA_BEDS}
    lines={INCA.LINES}
    voiceDir="inca/voice"
    ducking={INCA.ducking}
  />
);

export const IncaPhoneShort: React.FC<{ withAudio?: boolean }> = ({ withAudio = true }) => {
  const frame = useCurrentFrame();
  const keys = Object.keys(INCA.SCENES) as IncaScene[];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {keys.map((k) => (
        <Sequence key={k} from={INCA.SCENES[k].from} durationInFrames={INCA.SCENES[k].duration} name={k}>
          <SceneSlot k={k} />
        </Sequence>
      ))}
      <Vignette strength={0.3} />
      {keys.map((k) => {
        const at = POOF_AT[k];
        return at ? <PoofWipe key={k} frame={frame} at={INCA.SCENES[k].from} x={at[0]} y={at[1]} /> : null;
      })}
      {/* Mid-lower third: clear of the app buttons and descriptions at the bottom of a phone. */}
      <Captions chunks={INCA.CAPTIONS} bottom={440} fontSize={92} maxWidth={960} />
      {withAudio ? <IncaSoundtrack /> : null}
    </AbsoluteFill>
  );
};

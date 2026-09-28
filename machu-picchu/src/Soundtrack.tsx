import React from "react";
import { Audio } from "@remotion/media";
import { Sequence, interpolate, staticFile } from "remotion";
import { CUES, VOICE_CUES } from "./cues";
import { DURATION } from "./theme";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Mix bus: music under the effects, with headroom so hits never clip.
const MUSIC = 0.68;
const SFX_GAIN = 0.7;
const VOICE = 0.42;

export const Soundtrack: React.FC = () => {
  return (
    <>
      <Sequence name="Música" layout="none">
        <Audio
          src={staticFile("audio/music.wav")}
          volume={(f) =>
            interpolate(
              f,
              [0, 3, DURATION - 4, DURATION],
              [0, MUSIC, MUSIC, 0],
              CLAMP,
            )
          }
        />
      </Sequence>
      {CUES.map(([from, sfx, volume, len], i) => (
        <Sequence
          key={i}
          name={sfx}
          from={from}
          durationInFrames={len}
          layout="none"
        >
          <Audio
            src={staticFile(`audio/${sfx}.wav`)}
            volume={(f) =>
              SFX_GAIN *
              volume *
              (len ? interpolate(f, [len - 8, len], [1, 0], CLAMP) : 1)
            }
          />
        </Sequence>
      ))}
      {VOICE_CUES.map(([from, v], i) => (
        <Sequence key={`v${i}`} name="voz" from={from} layout="none">
          <Audio src={staticFile(`audio/voice-${v}.wav`)} volume={VOICE} />
        </Sequence>
      ))}
    </>
  );
};

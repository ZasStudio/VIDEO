import React from "react";
import { Audio } from "@remotion/media";
import { Sequence, interpolate, staticFile } from "remotion";
import { BEDS, BED_FRAMES, CUES } from "./cues";
import { DURATION, LINES, ducking } from "./timeline";

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Mix bus. Clawd's voice leads (about 10 dB over everything else while it speaks); the
// music ducks under it and swells back in the pauses, and the effects step back a bit.
const VOICE = 1.0;
const MUSIC = 0.5;
const MUSIC_DUCK = 0.65;
const SFX_GAIN = 0.7;
const SFX_DUCK = 0.45;
const BED_DUCK = 0.45;

/** Overlapping copies of a short loop with equal-power crossfades. */
const Bed: React.FC<{ from: number; to: number; sfx: string; volume: number; len: number }> = ({
  from,
  to,
  sfx,
  volume,
  len,
}) => {
  const xf = Math.round(len / 6);
  const pieces: { at: number; dur: number; first: boolean; last: boolean }[] = [];
  for (let at = from; at < to; at += len - xf) {
    const last = at + len >= to;
    pieces.push({ at, dur: last ? to - at : len, first: at === from, last });
    if (last) break;
  }
  return (
    <>
      {pieces.map((p) => (
        <Sequence key={p.at} name={sfx} from={p.at} durationInFrames={p.dur} layout="none">
          <Audio
            src={staticFile(`audio/${sfx}.wav`)}
            volume={(f) => {
              const fin = p.first ? interpolate(f, [0, 12], [0, 1], CLAMP) : Math.sin((Math.PI / 2) * Math.min(1, f / xf));
              const fout = p.last
                ? interpolate(f, [p.dur - 20, p.dur], [1, 0], CLAMP)
                : Math.cos((Math.PI / 2) * Math.max(0, Math.min(1, (f - (p.dur - xf)) / xf)));
              return volume * SFX_GAIN * fin * fout * (1 - BED_DUCK * ducking(p.at + f));
            }}
          />
        </Sequence>
      ))}
    </>
  );
};

export const Soundtrack: React.FC = () => {
  return (
    <>
      <Sequence name="Música" layout="none">
        <Audio
          src={staticFile("audio/music.wav")}
          volume={(f) =>
            MUSIC *
            (1 - MUSIC_DUCK * ducking(f)) *
            interpolate(f, [0, 3, DURATION - 4, DURATION], [0, 1, 1, 0], CLAMP)
          }
        />
      </Sequence>
      {BEDS.map(([from, to, sfx, volume]) => (
        <Bed key={`${sfx}${from}`} from={from} to={to} sfx={sfx} volume={volume} len={BED_FRAMES[sfx] ?? 60} />
      ))}
      {CUES.map(([from, sfx, volume, len], i) => (
        <Sequence key={i} name={sfx} from={from} durationInFrames={len} layout="none">
          <Audio
            src={staticFile(`audio/${sfx}.wav`)}
            volume={(f) =>
              SFX_GAIN *
              volume *
              (1 - SFX_DUCK * ducking(from + f)) *
              (len ? interpolate(f, [len - 8, len], [1, 0], CLAMP) : 1)
            }
          />
        </Sequence>
      ))}
      {LINES.map((l) => (
        <Sequence key={l.id} name={`voz ${l.id}`} from={l.start} layout="none">
          <Audio src={staticFile(`voice/${l.id}.wav`)} volume={VOICE} />
        </Sequence>
      ))}
    </>
  );
};

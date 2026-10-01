import React from 'react';
import {AbsoluteFill, Sequence, interpolate, useCurrentFrame} from 'remotion';
import {Captions} from './Captions';
import {FPS, EDIT_FRAMES, TOTAL_FRAMES} from './edit';
import {Footage} from './Footage';
import {Mix, type Sfx} from './Mix';
import {ChapterChip, EndCard, Hook, ProductChip, ProgressBar, SpokenQuote, findPhrase} from './Overlays';

const fr = (ms: number) => Math.round((ms / 1000) * FPS);

// Momentos del guion (calculados desde las palabras transcritas, no a mano).
const QUOTE_START = fr(findPhrase('el que busca')[0].startMs) - 4;
const QUOTE_END = fr(findPhrase('cuando uno llega')[0].startMs) - 2;
const STORY_START = fr(findPhrase('cuando uno llega')[0].startMs);
const FINAL_START = fr(findPhrase('porque si yo pude')[0].startMs) - 4;
const END_CARD = Math.max(fr(findPhrase('lograrlo')[0].endMs) + 4, EDIT_FRAMES - 12);
const PRODUCT = {from: fr(17000), to: fr(19600)}; // página del MacBook Pro 16" en pantalla

const SFX: Sfx[] = [
  {at: 2, file: 'whoosh-soft', volume: 0.35},
  {at: 10, file: 'sparkle', volume: 0.18},
  {at: PRODUCT.from, file: 'pop', volume: 0.35},
  {at: QUOTE_START, file: 'whoosh-soft', volume: 0.3},
  {at: STORY_START, file: 'whoosh-soft', volume: 0.25},
  {at: FINAL_START, file: 'impact', volume: 0.3},
  {at: END_CARD, file: 'chime', volume: 0.32},
];

/** Fundido a negro final. */
const FadeOut: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [TOTAL_FRAMES - 12, TOTAL_FRAMES - 1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{background: '#000', opacity: o}} />;
};

export const VlogEdit: React.FC<{withAudio: boolean}> = ({withAudio}) => {
  const holes: [number, number][] = [
    [(QUOTE_START / FPS) * 1000, (QUOTE_END / FPS) * 1000],
    [(FINAL_START / FPS) * 1000, 999999],
  ];
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Footage />
      <Captions holes={holes} />
      <Sequence durationInFrames={fr(3900)} layout="absolute-fill">
        <Hook />
      </Sequence>
      <ProductChip from={PRODUCT.from} to={PRODUCT.to} />
      <ChapterChip from={STORY_START} to={STORY_START + fr(3200)} text="Mi historia" />
      <SpokenQuote
        lines={[['El', 'que', 'busca,'], ['encuentra.'], ['Y', 'el', 'que', 'no', 'se', 'rinde,'], ['lo', 'logra.']]}
        from={QUOTE_START}
        to={QUOTE_END}
        size={98}
        accent={['encuentra.', 'logra.']}
      />
      <SpokenQuote
        lines={[['Porque', 'si', 'yo', 'pude,'], ['tú', 'también'], ['puedes', 'lograrlo.']]}
        from={FINAL_START}
        to={END_CARD + 2}
        serif={false}
        size={112}
        accent={['tú', 'también', 'puedes', 'lograrlo.']}
      />
      <EndCard from={END_CARD} />
      <ProgressBar />
      <FadeOut />
      {withAudio ? <Mix sfx={SFX} /> : null}
    </AbsoluteFill>
  );
};

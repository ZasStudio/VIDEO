import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from "remotion";
import { EASE_IN_OUT, clamp01 } from "./anim";
import { EDIT_FRAMES, HOLD_FRAMES, SEGMENTS } from "./edit";

// Metraje estabilizado, cortado según la EDL.
// - Cada tramo alterna un leve "punch-in" (1.00 / 1.07) para que los saltos de corte
//   dentro de un mismo plano se sientan intencionales, como en una edición profesional.
// - Dentro de cada tramo hay un push-in lento (+3 %) para que la imagen nunca quede muerta.
const Clip: React.FC<{
  index: number;
  len: number;
  from: number;
  to: number;
}> = ({ index, len, from, to }) => {
  const f = useCurrentFrame();
  const base = index % 2 === 1 ? 1.07 : 1.0;
  const push = 1 + 0.03 * EASE_IN_OUT(clamp01(f / len));
  return (
    <AbsoluteFill style={{ scale: String(base * push) }}>
      <Video
        src={staticFile("stabilized.mp4")}
        trimBefore={from}
        trimAfter={to}
        muted
        objectFit="cover"
        style={{
          width: "100%",
          height: "100%",
          // Corrección de color: un poco más de contraste y color, sin quemar pieles.
          filter: "contrast(1.07) saturate(1.1) brightness(1.03)",
        }}
      />
    </AbsoluteFill>
  );
};

/** Cuadro casi congelado al final (últimos frames a 0,08x + acercamiento lento) para sostener la frase de cierre. */
const Hold: React.FC = () => {
  const f = useCurrentFrame();
  const last = SEGMENTS[SEGMENTS.length - 1];
  const lastIndex = SEGMENTS.length - 1;
  const base = lastIndex % 2 === 1 ? 1.07 : 1.0;
  return (
    <AbsoluteFill
      style={{
        scale: String(
          base * (1.03 + 0.025 * EASE_IN_OUT(clamp01(f / HOLD_FRAMES))),
        ),
      }}
    >
      <Video
        src={staticFile("stabilized.mp4")}
        trimBefore={last.to - 3}
        playbackRate={0.08}
        muted
        objectFit="cover"
        style={{
          width: "100%",
          height: "100%",
          filter: "contrast(1.07) saturate(1.1) brightness(1.03)",
        }}
      />
    </AbsoluteFill>
  );
};

export const Footage: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    {SEGMENTS.map((s, i) => (
      <Sequence
        key={i}
        from={s.at}
        durationInFrames={s.to - s.from}
        layout="absolute-fill"
      >
        <Clip index={i} len={s.to - s.from} from={s.from} to={s.to} />
      </Sequence>
    ))}
    <Sequence
      from={EDIT_FRAMES}
      durationInFrames={HOLD_FRAMES}
      layout="absolute-fill"
    >
      <Hold />
    </Sequence>
    {/* Look: un toque azul frío (a juego con la paleta) sin enfriar la piel, y viñeta */}
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, rgba(40,90,190,0.10) 0%, rgba(20,60,140,0.05) 45%, rgba(10,40,110,0.16) 100%)",
        mixBlendMode: "soft-light",
      }}
    />
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,6,20,0.48) 100%)",
      }}
    />
    {/* Degradados azul-negro para que los textos se lean arriba y abajo */}
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(180deg, rgba(3,12,32,0.5) 0%, transparent 20%, transparent 58%, rgba(0,4,14,0.55) 100%)",
      }}
    />
  </AbsoluteFill>
);

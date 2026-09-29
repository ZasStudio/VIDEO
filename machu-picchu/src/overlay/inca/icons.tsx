import React from "react";

// Inline SVG icons for the Inca-phone overlays. No emoji anywhere: the headless renderer has
// no emoji font. Cartoon style: flat colours, a warm dark outline and small white highlights.
// Most icons draw their silhouette twice (thick outline pass, then fill pass) so overlapping
// parts share a single clean contour.

export const INK = "#26140A";

type IconProps = { size?: number; style?: React.CSSProperties };

/** Silhouette drawn as a thick outline first, then filled on top. */
const Outlined: React.FC<{ w?: number; color?: string; children: React.ReactNode }> = ({
  w = 7,
  color = INK,
  children,
}) => (
  <>
    <g stroke={color} strokeWidth={w} strokeLinejoin="round" strokeLinecap="round">
      {children}
    </g>
    <g>{children}</g>
  </>
);

// ---------------------------------------------------------------------------------------------
// Brand: ChasquiChat (an original messenger) and App-papa (a potato assistant).

/** Front-facing llama head with a little scarf: the ChasquiChat mascot. */
export const LlamaHead: React.FC<
  IconProps & { color?: string; eye?: string; outline?: string | null; scarf?: boolean }
> = ({ size = 100, color = "#FFFFFF", eye = "#3A1C0C", outline = null, scarf = true, style }) => {
  const body = (
    <>
      <ellipse cx={32} cy={21} rx={7} ry={15.5} transform="rotate(-16 32 21)" fill={color} />
      <ellipse cx={68} cy={21} rx={7} ry={15.5} transform="rotate(16 68 21)" fill={color} />
      <path d="M36 54 L36 97 Q50 101 64 97 L64 54 Z" fill={color} />
      <ellipse cx={50} cy={45} rx={22.5} ry={20} fill={color} />
      <circle cx={40.5} cy={28} r={8} fill={color} />
      <circle cx={50} cy={24.5} r={9} fill={color} />
      <circle cx={59.5} cy={28} r={8} fill={color} />
    </>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
      {outline ? (
        <g stroke={outline} strokeWidth={7} strokeLinejoin="round">
          {body}
        </g>
      ) : null}
      {body}
      <ellipse cx={32.5} cy={22} rx={2.8} ry={8.5} transform="rotate(-16 32.5 22)" fill="#FFAFA0" />
      <ellipse cx={67.5} cy={22} rx={2.8} ry={8.5} transform="rotate(16 67.5 22)" fill="#FFAFA0" />
      <ellipse cx={50} cy={57} rx={12.5} ry={9.5} fill="#FFE6D2" />
      <circle cx={40.5} cy={44} r={4} fill={eye} />
      <circle cx={59.5} cy={44} r={4} fill={eye} />
      <circle cx={41.8} cy={42.5} r={1.3} fill="#fff" />
      <circle cx={60.8} cy={42.5} r={1.3} fill="#fff" />
      <circle cx={33} cy={51} r={3.6} fill="#FF9C8A" opacity={0.7} />
      <circle cx={67} cy={51} r={3.6} fill="#FF9C8A" opacity={0.7} />
      <path
        d="M46.5 54.5 Q50 57 53.5 54.5 M50 56.5 L50 59.5 M45.5 60.5 Q50 64 54.5 60.5"
        stroke={eye}
        strokeWidth={2.2}
        fill="none"
        strokeLinecap="round"
      />
      {scarf ? (
        <>
          <path d="M35 70 Q50 76 65 70 L65 79 Q50 85 35 79 Z" fill="#17B3A3" stroke={INK} strokeWidth={2} />
          <circle cx={42} cy={76} r={1.8} fill="#FFD23F" />
          <circle cx={50} cy={78.5} r={1.8} fill="#FFD23F" />
          <circle cx={58} cy={76} r={1.8} fill="#FFD23F" />
        </>
      ) : null}
    </svg>
  );
};

/** ChasquiChat app icon: orange-to-red rounded square with the white llama. */
export const ChasquiChatIcon: React.FC<{ size?: number; border?: number; style?: React.CSSProperties }> = ({
  size = 100,
  border = 0,
  style,
}) => (
  <div
    style={{
      position: "relative",
      width: size,
      height: size,
      borderRadius: size * 0.27,
      background: "linear-gradient(150deg, #FFB12E 0%, #FF6A2B 52%, #E0262B 100%)",
      border: border ? `${border}px solid #fff` : undefined,
      boxSizing: "border-box",
      overflow: "hidden",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      flexShrink: 0,
      ...style,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: "46%",
        background: "linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0))",
      }}
    />
    <LlamaHead size={(size - 2 * border) * 0.9} style={{ marginBottom: -(size - 2 * border) * 0.08, position: "relative" }} />
  </div>
);

/** Cute potato with a sprout: the App-papa assistant. */
export const PotatoFace: React.FC<IconProps & { mouthOpen?: number }> = ({ size = 100, mouthOpen = 0, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <Outlined w={6}>
      <path d="M51 11 C45 3 36 4 33 8 C37 13 45 14 51 11 Z" fill="#5CCB5F" />
      <path d="M52 10 C57 1 67 1 70 5 C66 11 58 13 52 10 Z" fill="#5CCB5F" />
      <path d="M50 17 C73 15 88 32 86 55 C84 78 67 90 47 88 C27 86 13 72 15 50 C17 29 30 19 50 17 Z" fill="#E4B065" />
    </Outlined>
    <path d="M51 18 Q50 13 51.5 10" stroke="#3DA34A" strokeWidth={3.5} fill="none" strokeLinecap="round" />
    <path d="M78 44 C84 62 76 80 58 86 C72 76 78 62 78 44 Z" fill="#C98E45" opacity={0.7} />
    <ellipse cx={34} cy={33} rx={9} ry={5} transform="rotate(-25 34 33)" fill="#F6D597" opacity={0.9} />
    <ellipse cx={70} cy={33} rx={2.6} ry={2} fill="#B0773A" />
    <ellipse cx={26} cy={68} rx={2.4} ry={1.8} fill="#B0773A" />
    <ellipse cx={74} cy={72} rx={2.2} ry={1.7} fill="#B0773A" />
    <ellipse cx={39} cy={51} rx={4.4} ry={5.6} fill={INK} />
    <ellipse cx={61} cy={51} rx={4.4} ry={5.6} fill={INK} />
    <circle cx={40.6} cy={49} r={1.6} fill="#fff" />
    <circle cx={62.6} cy={49} r={1.6} fill="#fff" />
    <circle cx={30} cy={62} r={5.5} fill="#FF8FA3" opacity={0.75} />
    <circle cx={70} cy={62} r={5.5} fill="#FF8FA3" opacity={0.75} />
    {mouthOpen > 0.05 ? (
      <ellipse cx={50} cy={65} rx={6} ry={2 + 5 * mouthOpen} fill="#7A2618" stroke={INK} strokeWidth={2.5} />
    ) : (
      <path d="M43 63 Q50 71 57 63" stroke={INK} strokeWidth={3.2} fill="none" strokeLinecap="round" />
    )}
  </svg>
);

/** App-papa icon: green rounded square with the potato. */
export const AppPapaIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 100, style }) => (
  <div
    style={{
      position: "relative",
      width: size,
      height: size,
      borderRadius: size * 0.27,
      background: "linear-gradient(150deg, #B6F26B 0%, #43C463 55%, #139A5B 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      flexShrink: 0,
      ...style,
    }}
  >
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: "46%",
        background: "linear-gradient(180deg, rgba(255,255,255,0.3), rgba(255,255,255,0))",
      }}
    />
    <PotatoFace size={size * 0.86} style={{ position: "relative", marginTop: size * 0.04 }} />
  </div>
);

// ---------------------------------------------------------------------------------------------
// Avatars and Inca symbols.

/** Knotted-cord quipu. */
export const QuipuIcon: React.FC<IconProps> = ({ size = 100, style }) => {
  const cords = [
    { x: 20, len: 60, c: "#E63946", knots: [40, 58], sway: 3 },
    { x: 35, len: 72, c: "#FFB703", knots: [34, 50, 68], sway: -2 },
    { x: 50, len: 56, c: "#2EC4B6", knots: [46], sway: 3 },
    { x: 65, len: 70, c: "#F4E6CC", knots: [36, 62], sway: -3 },
    { x: 80, len: 58, c: "#3A86FF", knots: [46, 56], sway: 2 },
  ];
  const topY = (x: number) => {
    const t = (x - 8) / 84;
    return 20 - 16 * t * (1 - t);
  };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
      {cords.map((c) => {
        const y0 = topY(c.x);
        const d = `M${c.x} ${y0} Q${c.x + c.sway} ${y0 + c.len / 2} ${c.x} ${y0 + c.len}`;
        return (
          <g key={c.x}>
            <path d={d} stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" />
            <path d={d} stroke={c.c} strokeWidth={5} fill="none" strokeLinecap="round" />
            {c.knots.map((k) => (
              <ellipse
                key={k}
                cx={c.x + c.sway * 0.5}
                cy={k}
                rx={5}
                ry={3.6}
                fill={c.c}
                stroke={INK}
                strokeWidth={2.2}
              />
            ))}
            <ellipse cx={c.x} cy={y0 + c.len + 2} rx={3.4} ry={4.4} fill={c.c} stroke={INK} strokeWidth={2.2} />
          </g>
        );
      })}
      <path d="M8 20 Q50 4 92 20" stroke={INK} strokeWidth={13} fill="none" strokeLinecap="round" />
      <path d="M8 20 Q50 4 92 20" stroke="#8B5A2B" strokeWidth={8} fill="none" strokeLinecap="round" />
      <path d="M14 18 Q50 6 86 18" stroke="#B07A45" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </svg>
  );
};

/** Sapa Inca headdress: gold band with a sun, black-tipped feathers and the red fringe. */
export const CrownIcon: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <Outlined w={6}>
      <ellipse cx={34} cy={27} rx={6.5} ry={17} transform="rotate(-24 34 27)" fill="#FFFDF4" />
      <ellipse cx={66} cy={27} rx={6.5} ry={17} transform="rotate(24 66 27)" fill="#FFFDF4" />
      <ellipse cx={50} cy={22} rx={7} ry={19} fill="#FFFDF4" />
      <path d="M31 62 L69 62 L69 78 Q65 84 61 78 Q57 84 53 78 Q49 84 45 78 Q41 84 37 78 Q33 84 31 78 Z" fill="#E0262B" />
      <rect x={14} y={44} width={72} height={19} rx={7} fill="#FFC928" />
      <circle cx={50} cy={46} r={13} fill="#FFD84D" />
    </Outlined>
    <ellipse cx={30.5} cy={17} rx={4.6} ry={6.5} transform="rotate(-24 30.5 17)" fill="#1C1C1C" />
    <ellipse cx={69.5} cy={17} rx={4.6} ry={6.5} transform="rotate(24 69.5 17)" fill="#1C1C1C" />
    <ellipse cx={50} cy={9.5} rx={5} ry={6.5} fill="#1C1C1C" />
    <rect x={14} y={55} width={72} height={8} rx={4} fill="#F29F05" />
    {[22, 76].map((x) => (
      <rect key={x} x={x - 4} y={49} width={8} height={8} rx={1.5} fill="#E0262B" stroke={INK} strokeWidth={1.6} />
    ))}
    {[38, 45, 52, 59, 66].map((x) => (
      <path key={x} d={`M${x} 64 L${x} 76`} stroke="#9E1318" strokeWidth={2} strokeLinecap="round" />
    ))}
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return (
        <path
          key={i}
          d={`M${50 + Math.cos(a) * 8.5} ${46 + Math.sin(a) * 8.5} L${50 + Math.cos(a) * 11} ${46 + Math.sin(a) * 11}`}
          stroke="#E08A00"
          strokeWidth={2}
          strokeLinecap="round"
        />
      );
    })}
    <circle cx={46.5} cy={44.5} r={1.6} fill={INK} />
    <circle cx={53.5} cy={44.5} r={1.6} fill={INK} />
    <path d="M46.5 49 Q50 51.5 53.5 49" stroke={INK} strokeWidth={1.6} fill="none" strokeLinecap="round" />
  </svg>
);

/** A chasqui: smiling runner with a feathered headband. */
export const ChasquiFace: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <Outlined w={6}>
      <ellipse cx={75} cy={25} rx={5} ry={15} transform="rotate(22 75 25)" fill="#FFFFFF" />
      <circle cx={21} cy={58} r={7} fill="#C98B5E" />
      <circle cx={79} cy={58} r={7} fill="#C98B5E" />
      <circle cx={50} cy={57} r={30} fill="#D29467" />
      <path d="M19 55 C18 30 33 21 50 21 C67 21 82 30 81 55 C77 46 70 41 62 41 L38 41 C30 41 23 46 19 55 Z" fill="#1D1411" />
    </Outlined>
    <ellipse cx={78} cy={15} rx={3.6} ry={5.5} transform="rotate(22 78 15)" fill="#FF7A00" />
    <path d="M21 44 C35 36 65 36 79 44 L79 51 C65 43 35 43 21 51 Z" fill="#FFFFFF" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
    {[32, 44, 56, 68].map((x) => (
      <path key={x} d={`M${x - 4} 45.5 L${x} 41.5 L${x + 4} 45.5 Z`} fill="#E0262B" />
    ))}
    <ellipse cx={40} cy={60} rx={3.6} ry={4.6} fill={INK} />
    <ellipse cx={60} cy={60} rx={3.6} ry={4.6} fill={INK} />
    <circle cx={41.3} cy={58.4} r={1.3} fill="#fff" />
    <circle cx={61.3} cy={58.4} r={1.3} fill="#fff" />
    <circle cx={31} cy={68} r={5} fill="#FF8C7A" opacity={0.6} />
    <circle cx={69} cy={68} r={5} fill="#FF8C7A" opacity={0.6} />
    <path d="M42 70 Q50 79 58 70 Z" fill="#7A2618" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
  </svg>
);

/** Inti, the sun, with a face. */
export const SunFace: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <Outlined w={5}>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const b = 0.2;
        const p = (r: number, aa: number) => `${50 + Math.cos(aa) * r} ${50 + Math.sin(aa) * r}`;
        return <path key={i} d={`M${p(28, a - b)} L${p(46, a)} L${p(28, a + b)} Z`} fill="#FFB703" />;
      })}
      <circle cx={50} cy={50} r={29} fill="#FFD84D" />
    </Outlined>
    <circle cx={41} cy={46} r={3.4} fill={INK} />
    <circle cx={59} cy={46} r={3.4} fill={INK} />
    <circle cx={35} cy={56} r={4.5} fill="#FF9C5A" opacity={0.7} />
    <circle cx={65} cy={56} r={4.5} fill="#FF9C5A" opacity={0.7} />
    <path d="M42 57 Q50 64 58 57" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
  </svg>
);

// ---------------------------------------------------------------------------------------------
// Map, weather and camera glyphs.

/** Classic map pin. */
export const PinIcon: React.FC<IconProps & { color?: string }> = ({ size = 60, color = "#FF3B4E", style }) => (
  <svg width={size * 0.75} height={size} viewBox="0 0 60 80" style={style}>
    <path
      d="M30 76 C30 76 5 46 5 30 A25 25 0 1 1 55 30 C55 46 30 76 30 76 Z"
      fill={color}
      stroke={INK}
      strokeWidth={5}
      strokeLinejoin="round"
    />
    <path d="M14 22 A17 17 0 0 1 26 10" stroke="rgba(255,255,255,0.55)" strokeWidth={4} fill="none" strokeLinecap="round" />
    <circle cx={30} cy={30} r={10} fill="#fff" stroke={INK} strokeWidth={3} />
  </svg>
);

/** Smiling rain cloud with drops falling in a loop (driven by `frame`). */
export const RainCloud: React.FC<IconProps & { frame: number }> = ({ size = 260, frame, style }) => {
  const drops = [
    { x: 74, ph: 0.0 },
    { x: 102, ph: 0.55 },
    { x: 130, ph: 0.2 },
    { x: 158, ph: 0.75 },
    { x: 186, ph: 0.35 },
    { x: 116, ph: 0.9 },
    { x: 172, ph: 0.05 },
  ];
  const bob = Math.sin(frame * 0.09) * 4;
  return (
    <svg width={size} height={(size * 240) / 260} viewBox="0 0 260 240" style={style}>
      {drops.map((d, i) => {
        const u = (frame / 20 + d.ph) % 1;
        const y = 150 + u * 82;
        const x = d.x - u * 10;
        const op = u < 0.12 ? u / 0.12 : 1 - Math.max(0, (u - 0.7) / 0.3);
        return (
          <g key={i} transform={`translate(${x} ${y})`} opacity={op}>
            <path d="M0 -15 C6 -5 10 1 10 6 A10 10 0 0 1 -10 6 C-10 1 -6 -5 0 -15 Z" fill="#2F8CFF" stroke="#16325C" strokeWidth={3.5} />
            <ellipse cx={-3.5} cy={4} rx={2.2} ry={3.4} fill="#BFE0FF" />
          </g>
        );
      })}
      <g transform={`translate(0 ${bob})`}>
        <Outlined w={11} color="#16325C">
          <circle cx={78} cy={98} r={44} fill="#FFFFFF" />
          <circle cx={130} cy={72} r={57} fill="#FFFFFF" />
          <circle cx={184} cy={96} r={44} fill="#FFFFFF" />
          <rect x={38} y={96} width={186} height={50} rx={25} fill="#FFFFFF" />
        </Outlined>
        <path d="M44 124 Q130 150 218 124 L218 132 Q218 146 200 146 L62 146 Q42 146 42 130 Z" fill="#D5E6F8" />
        <ellipse cx={104} cy={50} rx={20} ry={10} transform="rotate(-20 104 50)" fill="#F1F7FF" />
        <circle cx={110} cy={108} r={6} fill="#16325C" />
        <circle cx={152} cy={108} r={6} fill="#16325C" />
        <circle cx={112} cy={106} r={2} fill="#fff" />
        <circle cx={154} cy={106} r={2} fill="#fff" />
        <circle cx={94} cy={122} r={8} fill="#FF9EB0" opacity={0.7} />
        <circle cx={168} cy={122} r={8} fill="#FF9EB0" opacity={0.7} />
        <path d="M121 121 Q131 130 141 121" stroke="#16325C" strokeWidth={4} fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
};

/** Two leaves on a stem out of a mound of soil. */
export const SproutIcon: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <Outlined w={6}>
      <path d="M50 58 C34 58 21 48 19 32 C36 32 48 42 50 58 Z" fill="#6BD66E" />
      <path d="M50 50 C64 48 77 36 81 20 C62 21 52 33 50 50 Z" fill="#4CC255" />
      <ellipse cx={50} cy={84} rx={34} ry={11} fill="#8A5A34" />
    </Outlined>
    <path d="M50 82 Q50 64 50 44" stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" />
    <path d="M50 82 Q50 64 50 44" stroke="#3DA34A" strokeWidth={4.5} fill="none" strokeLinecap="round" />
    <path d="M26 36 Q38 42 46 54" stroke="#3FA046" strokeWidth={2} fill="none" strokeLinecap="round" />
  </svg>
);

/** Chat bubble with three dots (the dots hop when `frame` is given). */
export const CommentBubbleIcon: React.FC<IconProps & { dot?: string; frame?: number }> = ({
  size = 100,
  dot = "#FF4D6D",
  frame,
  style,
}) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <path
      d="M50 13 C75 13 91 28 91 47 C91 66 75 80 50 80 C45 80 40 79.4 36 78.2 L16 89 L22.5 71.5 C14 65.5 9 57 9 47 C9 28 25 13 50 13 Z"
      fill="#FFFFFF"
      stroke={INK}
      strokeWidth={5}
      strokeLinejoin="round"
    />
    {[31, 50, 69].map((x, i) => {
      const hop = frame === undefined ? 0 : Math.max(0, Math.sin(frame * 0.3 - i * 0.9)) * 5;
      return <circle key={x} cx={x} cy={47 - hop} r={6.5} fill={dot} />;
    })}
  </svg>
);

/** Pointing hand (index finger up). */
export const HandPointer: React.FC<IconProps> = ({ size = 120, style }) => (
  <svg width={size * (100 / 124)} height={size} viewBox="0 0 100 124" style={style}>
    <Outlined w={7}>
      <rect x={31} y={96} width={46} height={26} rx={7} fill="#FF7A00" />
      <rect x={38} y={4} width={19} height={62} rx={9.5} fill="#F6C197" />
      <rect x={27} y={46} width={54} height={56} rx={18} fill="#F6C197" />
      <ellipse cx={26} cy={68} rx={10} ry={15} transform="rotate(-24 26 68)" fill="#F6C197" />
      <rect x={55} y={42} width={17} height={30} rx={8.5} fill="#F6C197" />
      <rect x={67} y={50} width={15} height={28} rx={7.5} fill="#F6C197" />
    </Outlined>
    <rect x={42} y={8} width={11} height={11} rx={4} fill="#FFE1CB" />
    <path d="M57 60 Q63 63 69 60 M70 68 Q75 70 80 68" stroke="#C98A60" strokeWidth={2.5} fill="none" strokeLinecap="round" />
    <path d="M36 110 L72 110" stroke="#FFB15C" strokeWidth={3} strokeLinecap="round" />
  </svg>
);

/** Flip-camera glyph (two arrows around a lens), white. */
export const FlipCamIcon: React.FC<IconProps & { color?: string }> = ({ size = 100, color = "#FFFFFF", style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <path d="M14 36 Q14 30 20 30 L32 30 L38 21 L62 21 L68 30 L80 30 Q86 30 86 36 L86 74 Q86 80 80 80 L20 80 Q14 80 14 74 Z" fill="none" stroke={color} strokeWidth={6} strokeLinejoin="round" />
    <path d="M36 50 A15 15 0 0 1 62 45" fill="none" stroke={color} strokeWidth={5.5} strokeLinecap="round" />
    <path d="M64 36 L63.5 47 L53 45" fill="none" stroke={color} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M64 60 A15 15 0 0 1 38 65" fill="none" stroke={color} strokeWidth={5.5} strokeLinecap="round" />
    <path d="M36 74 L36.5 63 L47 65" fill="none" stroke={color} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Paper-plane send glyph. */
export const SendIcon: React.FC<IconProps & { color?: string }> = ({ size = 100, color = "#FFFFFF", style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <path d="M12 48 L88 14 L66 88 L49 60 Z" fill={color} strokeLinejoin="round" />
    <path d="M49 60 L88 14 L40 52 Z" fill="rgba(0,0,0,0.18)" />
  </svg>
);

export const SignalIcon: React.FC<IconProps & { color?: string }> = ({ size = 30, color = "#fff", style }) => (
  <svg width={size} height={size * 0.8} viewBox="0 0 30 24" style={style}>
    {[0, 1, 2, 3].map((i) => (
      <rect key={i} x={i * 7.5} y={18 - i * 5} width={5.5} height={6 + i * 5} rx={1.5} fill={color} />
    ))}
  </svg>
);

export const BatteryIcon: React.FC<IconProps & { color?: string; level?: number }> = ({
  size = 44,
  color = "#fff",
  level = 0.8,
  style,
}) => (
  <svg width={size} height={size * 0.5} viewBox="0 0 44 22" style={style}>
    <rect x={1.5} y={1.5} width={36} height={19} rx={5} fill="none" stroke={color} strokeWidth={3} />
    <rect x={5} y={5} width={29 * level} height={12} rx={2.5} fill={color} />
    <rect x={39.5} y={7} width={3.5} height={8} rx={1.5} fill={color} />
  </svg>
);

export const BackChevron: React.FC<IconProps & { color?: string }> = ({ size = 40, color = "#fff", style }) => (
  <svg width={size * 0.6} height={size} viewBox="0 0 24 40" style={style}>
    <path d="M19 5 L6 20 L19 35" fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Tiny Machu Picchu postcard: used as the camera's gallery thumbnail. */
export const MachuThumb: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <rect width={100} height={100} fill="#6EC3FF" />
    <rect y={55} width={100} height={45} fill="#9ADF7B" />
    <circle cx={22} cy={22} r={9} fill="#FFE066" />
    <path d="M40 70 L58 16 Q62 10 66 16 L88 70 Z" fill="#3E8E4E" />
    <path d="M0 78 L20 50 L34 62 L50 44 L72 78 Z" fill="#57A85E" />
    <path d="M20 74 L28 66 L46 66 L54 74 Z" fill="#D8CDB8" />
    <path d="M30 66 L34 60 L42 60 L46 66 Z" fill="#C2B59C" />
    <rect y={80} width={100} height={20} fill="#6FC165" />
  </svg>
);

// ---------------------------------------------------------------------------------------------
// "Other eras" for the call to action.

export const PyramidIcon: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <circle cx={76} cy={26} r={10} fill="#FFD166" stroke={INK} strokeWidth={4} />
    <Outlined w={6}>
      <path d="M77 46 L94 76 L60 76 Z" fill="#E3B150" />
      <path d="M46 16 L86 78 L8 78 Z" fill="#F7CD66" />
      <ellipse cx={50} cy={82} rx={44} ry={8} fill="#F1C877" />
    </Outlined>
    <path d="M46 16 L86 78 L46 78 Z" fill="#D9A441" />
    {[34, 48, 62].map((y) => {
      const hw = ((y - 16) * 39) / 62;
      return <path key={y} d={`M${46 - hw} ${y} L${46 + hw} ${y}`} stroke="#B98530" strokeWidth={2.5} strokeLinecap="round" />;
    })}
    <path d="M46 16 L86 78 L8 78 Z" fill="none" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
  </svg>
);

export const DinoIcon: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <Outlined w={6}>
      {[30, 40, 50].map((x, i) => (
        <path key={x} d={`M${x - 5} ${50 - i * 1.5} L${x} ${40 - i * 1.5} L${x + 5} ${50 - i * 1.5} Z`} fill="#FF9F1C" />
      ))}
      <path d="M22 60 Q8 62 3 49 Q10 66 26 71 Z" fill="#4CC96B" />
      <rect x={25} y={70} width={10} height={18} rx={4} fill="#3AB25A" />
      <rect x={54} y={70} width={10} height={18} rx={4} fill="#3AB25A" />
      <ellipse cx={44} cy={64} rx={26} ry={17} fill="#4CC96B" />
      <path d="M55 58 C60 46 62 36 63 25 L76 25 C74 38 70 52 67 63 Z" fill="#4CC96B" />
      <ellipse cx={73} cy={22} rx={13} ry={9} fill="#4CC96B" />
      <rect x={37} y={72} width={10} height={16} rx={4} fill="#4CC96B" />
      <rect x={63} y={69} width={10} height={17} rx={4} fill="#4CC96B" />
    </Outlined>
    <ellipse cx={45} cy={71} rx={17} ry={6.5} fill="#A6EDB2" />
    <circle cx={36} cy={58} r={3.5} fill="#2FA14D" />
    <circle cx={48} cy={55} r={3} fill="#2FA14D" />
    <circle cx={29} cy={64} r={2.4} fill="#2FA14D" />
    <circle cx={76} cy={19} r={2.6} fill={INK} />
    <circle cx={76.8} cy={18.2} r={0.9} fill="#fff" />
    <path d="M73 26 Q78 28.5 83 25" stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" />
    <circle cx={70} cy={24} r={2.5} fill="#FF9EB0" opacity={0.8} />
  </svg>
);

export const RocketIcon: React.FC<IconProps & { frame?: number }> = ({ size = 100, frame = 0, style }) => {
  const flick = 1 + Math.sin(frame * 1.3) * 0.12 + Math.sin(frame * 2.9) * 0.06;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
      {[
        [14, 20, 3.2],
        [84, 30, 2.6],
        [20, 74, 2.4],
        [80, 80, 3],
      ].map(([x, y, r], i) => (
        <path
          key={i}
          d={`M${x} ${y - r * 2} Q${x} ${y} ${x + r * 2} ${y} Q${x} ${y} ${x} ${y + r * 2} Q${x} ${y} ${x - r * 2} ${y} Q${x} ${y} ${x} ${y - r * 2} Z`}
          fill="#FFE27A"
        />
      ))}
      <g transform="rotate(32 50 50)">
        <g transform={`translate(50 70) scale(1 ${flick}) translate(-50 -70)`}>
          <path d="M40 68 Q50 100 60 68 Z" fill="#FFB703" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          <path d="M45 68 Q50 88 55 68 Z" fill="#FF5A1F" />
        </g>
        <Outlined w={6}>
          <path d="M35 50 L22 66 L22 73 L37 65 Z" fill="#E63946" />
          <path d="M65 50 L78 66 L78 73 L63 65 Z" fill="#E63946" />
          <rect x={40} y={60} width={20} height={9} rx={2} fill="#8D99AE" />
          <path d="M50 7 C64 19 68 39 66 62 L34 62 C32 39 36 19 50 7 Z" fill="#F4F6FA" />
        </Outlined>
        <path d="M50 7 C58 14 62.5 22 64.5 31 L35.5 31 C37.5 22 42 14 50 7 Z" fill="#E63946" />
        <path d="M58 34 C62 42 63 52 62 62 L66 62 C68 48 66 40 64 34 Z" fill="#D5DBE6" />
        <circle cx={50} cy={43} r={8.5} fill="#4FC3F7" stroke={INK} strokeWidth={4} />
        <circle cx={47.5} cy={40.5} r={2.6} fill="#E6F7FF" />
        <path d="M50 7 C64 19 68 39 66 62 L34 62 C32 39 36 19 50 7 Z" fill="none" stroke={INK} strokeWidth={3.5} />
      </g>
    </svg>
  );
};

export const CastleIcon: React.FC<IconProps> = ({ size = 100, style }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={style}>
    <Outlined w={6}>
      <path d="M21 12 L21 4 L31 7 L21 10" fill="#FFB703" />
      <path d="M79 12 L79 4 L89 7 L79 10" fill="#FFB703" />
      {[24, 36, 48, 60, 72].map((x) => (
        <rect key={x} x={x - 3} y={38} width={8} height={10} rx={1} fill="#C3CAD5" />
      ))}
      <rect x={22} y={45} width={56} height={42} fill="#C3CAD5" />
      <rect x={10} y={30} width={22} height={57} rx={2} fill="#AEB7C4" />
      <rect x={68} y={30} width={22} height={57} rx={2} fill="#AEB7C4" />
      <path d="M7 32 L21 11 L35 32 Z" fill="#7B4FD6" />
      <path d="M65 32 L79 11 L93 32 Z" fill="#7B4FD6" />
    </Outlined>
    <path d="M21 11 L21 3" stroke={INK} strokeWidth={2.5} />
    <path d="M79 11 L79 3" stroke={INK} strokeWidth={2.5} />
    <path d="M40 87 L40 68 A10 10 0 0 1 60 68 L60 87 Z" fill="#6B3F22" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
    <path d="M46 62 L46 87 M54 62 L54 87 M40 74 L60 74" stroke="#3E220F" strokeWidth={2.5} />
    <path d="M17 46 L17 40 A4 4 0 0 1 25 40 L25 46 Z" fill="#3B2A55" />
    <path d="M75 46 L75 40 A4 4 0 0 1 83 40 L83 46 Z" fill="#3B2A55" />
    <path d="M26 56 L34 56 M64 60 L72 60 M14 66 L22 66 M80 72 L86 72 M28 76 L34 76" stroke="#98A2B1" strokeWidth={2.5} strokeLinecap="round" />
  </svg>
);

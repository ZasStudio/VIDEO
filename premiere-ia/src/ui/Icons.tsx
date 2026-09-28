import React from 'react';

// Minimal line icons for the Premiere-style interface (drawn from scratch).

type IconProps = {size?: number; color?: string; style?: React.CSSProperties};

const Svg: React.FC<IconProps & {children: React.ReactNode; vb?: string}> = ({
  size = 18,
  color = '#BDBDBD',
  style,
  children,
  vb = '0 0 24 24',
}) => (
  <svg
    width={size}
    height={size}
    viewBox={vb}
    fill="none"
    stroke={color}
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{display: 'block', flexShrink: 0, ...style}}
  >
    {children}
  </svg>
);

export const IconHome: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M3 11 L12 4 L21 11" />
    <path d="M6 10 V20 H18 V10" />
  </Svg>
);
export const IconMenu: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M5 7 H19 M5 12 H19 M5 17 H19" />
  </Svg>
);
export const IconChevron: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M7 10 L12 15 L17 10" />
  </Svg>
);
export const IconSearch: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx={10.5} cy={10.5} r={6} />
    <path d="M15 15 L20 20" />
  </Svg>
);
export const IconPlay: React.FC<IconProps> = ({color = '#D8D8D8', ...p}) => (
  <Svg {...p} color={color}>
    <path d="M8 5 L19 12 L8 19 Z" fill={color} />
  </Svg>
);
export const IconStepBack: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M6 5 V19" />
    <path d="M18 6 L9 12 L18 18 Z" />
  </Svg>
);
export const IconStepFwd: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M18 5 V19" />
    <path d="M6 6 L15 12 L6 18 Z" />
  </Svg>
);
export const IconMarkIn: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M14 5 H9 V19 H14" />
  </Svg>
);
export const IconMarkOut: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M10 5 H15 V19 H10" />
  </Svg>
);
export const IconMarker: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M7 4 H17 V20 L12 16 L7 20 Z" />
  </Svg>
);
export const IconInsert: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x={3} y={8} width={18} height={10} rx={1.5} />
    <path d="M12 3 V11 M9 8 L12 11 L15 8" />
  </Svg>
);
export const IconOverwrite: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x={3} y={8} width={18} height={10} rx={1.5} />
    <path d="M12 3 V14 M9 11 L12 14 L15 11" />
  </Svg>
);
export const IconCamera: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x={3} y={7} width={18} height={12} rx={2} />
    <circle cx={12} cy={13} r={3.5} />
    <path d="M8 7 L10 4 H14 L16 7" />
  </Svg>
);
export const IconWrench: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M14 6 A4 4 0 0 0 19 11 L11 19 A2 2 0 0 1 8 16 L16 8" />
  </Svg>
);
export const IconMagnet: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M6 4 V12 A6 6 0 0 0 18 12 V4" />
    <path d="M6 8 H9 M15 8 H18" />
  </Svg>
);
export const IconLink: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M10 14 L14 10" />
    <path d="M8 12 L6 14 A3 3 0 0 0 10 18 L12 16" />
    <path d="M16 12 L18 10 A3 3 0 0 0 14 6 L12 8" />
  </Svg>
);
export const IconEye: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M2 12 C5 6 19 6 22 12 C19 18 5 18 2 12 Z" />
    <circle cx={12} cy={12} r={3} />
  </Svg>
);
export const IconLock: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x={5} y={11} width={14} height={9} rx={1.5} />
    <path d="M8 11 V8 A4 4 0 0 1 16 8 V11" />
  </Svg>
);
export const IconMic: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x={9} y={3} width={6} height={11} rx={3} />
    <path d="M6 11 A6 6 0 0 0 18 11 M12 17 V21" />
  </Svg>
);
export const IconFolder: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M3 7 H10 L12 9 H21 V19 H3 Z" />
  </Svg>
);
export const IconList: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M8 7 H20 M8 12 H20 M8 17 H20 M4 7 H4.5 M4 12 H4.5 M4 17 H4.5" />
  </Svg>
);
export const IconGrid: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x={4} y={4} width={7} height={7} />
    <rect x={13} y={4} width={7} height={7} />
    <rect x={4} y={13} width={7} height={7} />
    <rect x={13} y={13} width={7} height={7} />
  </Svg>
);
export const IconTrash: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M5 7 H19 M9 7 V4 H15 V7 M7 7 L8 20 H16 L17 7" />
  </Svg>
);
export const IconNew: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M6 3 H14 L19 8 V21 H6 Z M14 3 V8 H19" />
  </Svg>
);
export const IconExport: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 15 V3 M8 7 L12 3 L16 7" />
    <path d="M5 13 V20 H19 V13" />
  </Svg>
);
export const IconFullscreen: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 9 V4 H9 M15 4 H20 V9 M20 15 V20 H15 M9 20 H4 V15" />
  </Svg>
);
export const IconCaptions: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x={3} y={5} width={18} height={14} rx={2} />
    <path d="M7 11 H11 M13 11 H17 M7 15 H14" />
  </Svg>
);
export const IconSparkle: React.FC<IconProps & {filled?: boolean}> = ({filled, color = '#BDBDBD', ...p}) => (
  <Svg {...p} color={color}>
    <path
      d="M12 3 C12.8 8 14 9.2 19 10 C14 10.8 12.8 12 12 17 C11.2 12 10 10.8 5 10 C10 9.2 11.2 8 12 3 Z"
      fill={filled ? color : 'none'}
    />
    <path d="M18.5 15 C18.8 17 19.3 17.5 21 17.8 C19.3 18.1 18.8 18.6 18.5 20.5 C18.2 18.6 17.7 18.1 16 17.8 C17.7 17.5 18.2 17 18.5 15 Z" fill={filled ? color : 'none'} />
  </Svg>
);

// ---- Tools ----
export const ToolSelect: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M6 3 L6 19 L10 15 L13 21 L15.5 20 L12.5 14 L18 14 Z" />
  </Svg>
);
export const ToolTrack: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M3 5 V19 M6 5 V19" />
    <path d="M10 6 L10 17 L13 14 L15 19 L17 18 L15 13 L19 13 Z" />
  </Svg>
);
export const ToolRipple: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M10 4 H6 V20 H10" />
    <path d="M13 12 H20 M17 9 L20 12 L17 15" />
  </Svg>
);
export const ToolRazor: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 20 L14 10" />
    <path d="M14 10 L19 5 L20 9 L16 12 Z" />
    <circle cx={6} cy={18} r={1.2} />
  </Svg>
);
export const ToolSlip: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 6 V18 M20 6 V18" />
    <path d="M8 12 H16 M10 9.5 L7.5 12 L10 14.5 M14 9.5 L16.5 12 L14 14.5" />
  </Svg>
);
export const ToolPen: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 3 L17 12 L14 20 H10 L7 12 Z" />
    <path d="M12 3 V11" />
    <circle cx={12} cy={12.5} r={1.4} />
  </Svg>
);
export const ToolHand: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M8 12 V6 A1.5 1.5 0 0 1 11 6 V11 V4.5 A1.5 1.5 0 0 1 14 4.5 V11 V6 A1.5 1.5 0 0 1 17 6 V14 C17 18 15 21 11.5 21 C8 21 7 19 5 15.5 L4 13.5 A1.5 1.5 0 0 1 6.5 12 L8 14" />
  </Svg>
);
export const ToolType: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M5 6 V4 H19 V6 M12 4 V20 M9 20 H15" />
  </Svg>
);
export const ToolGenExtend: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 5 V19 M4 12 H12" />
    <path d="M17 6 C17.5 9 18.5 10 21 10.5 C18.5 11 17.5 12 17 15 C16.5 12 15.5 11 13 10.5 C15.5 10 16.5 9 17 6 Z" />
  </Svg>
);

export const PrLogo: React.FC<{size?: number}> = ({size = 22}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.22,
      background: '#00005B',
      border: '1px solid #9999FF55',
      color: '#9999FF',
      fontFamily: 'SourceSans',
      fontWeight: 800,
      fontSize: size * 0.52,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      letterSpacing: -0.3,
      flexShrink: 0,
    }}
  >
    Pr
  </div>
);

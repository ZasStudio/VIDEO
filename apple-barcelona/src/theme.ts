export const WIDTH = 1080;
export const HEIGHT = 1920;

export const C = {
  white: '#FFFFFF',
  ink: '#0B0B0C',
  /** palabra activa en los subtítulos */
  active: '#FFD43B',
  /** palabras clave del guion */
  key: '#FF8FA3', // rosa, a juego con su polo
  glass: 'rgba(20, 20, 22, 0.55)',
  line: 'rgba(255, 255, 255, 0.28)',
} as const;

export const FONT = {
  sans: 'Manrope, sans-serif',
  serif: 'Instrument Serif, serif',
} as const;

// Sombra de texto legible sobre cualquier fondo (sin contorno duro).
export const TEXT_SHADOW = '0 4px 18px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.6)';

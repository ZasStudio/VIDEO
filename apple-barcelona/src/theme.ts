export const WIDTH = 1080;
export const HEIGHT = 1920;

// Paleta: azul que se degrada a negro.
export const C = {
  white: '#FFFFFF',
  ink: '#000000',
  /** azul principal (acentos, líneas, íconos) */
  blue: '#3D8BFF',
  /** azul cielo (palabras destacadas sobre fondo oscuro) */
  sky: '#8CC8FF',
  /** azul hielo (etiquetas pequeñas) */
  ice: 'rgba(190, 218, 255, 0.82)',
  navy: '#0A2252',
  /** palabra activa en los subtítulos */
  active: '#5AB2FF',
  /** palabras clave del guion */
  key: '#A8D4FF',
  glass: 'rgba(20, 30, 50, 0.45)',
  line: 'rgba(255, 255, 255, 0.28)',
} as const;

/** Degradado de texto blanco -> azul cielo (para las palabras grandes). */
export const TEXT_GRADIENT = 'linear-gradient(180deg, #FFFFFF 15%, #A9D3FF 100%)';
export const TEXT_GRADIENT_BLUE = 'linear-gradient(180deg, #CFE6FF 0%, #4D9CFF 100%)';

export const FONT = {
  sans: 'Manrope, sans-serif',
  serif: 'Instrument Serif, serif',
} as const;

// Sombra de texto legible sobre cualquier fondo (sin contorno duro).
export const TEXT_SHADOW = '0 4px 18px rgba(0,0,0,0.55), 0 2px 4px rgba(0,0,0,0.6)';

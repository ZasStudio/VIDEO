// Sound design of the oxygen short: the Magnific effects ("oxigeno/<name>") plus the
// synthesized ones, anchored to the same beats as the animation.
import type { Bed, Cue } from "../sfx";
import { BOTON, FINAL, FUEGO, HUMANOS, INTRO, MOTORES, REGRESO } from "./beats";
import { OXI } from "./timeline";

const { SCENES } = OXI;

const poofs = (): Cue[] => (["fuego", "motores", "humanos", "regreso"] as const).map((k) => [SCENES[k].from - 8, "inca/poof", 0.5]);

const intro = (): Cue[] => [
  [INTRO.CINCO, "impact", 0.3],
  [INTRO.CINCO + 1, "pop", 0.3],
];

const boton = (): Cue[] => {
  const { PRESS, ALARM, CERO, POLVO, MIRA } = BOTON;
  return [
    [PRESS - 10, "whoosh-short", 0.3],
    [PRESS, "oxigeno/button", 0.7],
    [PRESS + 1, "oxigeno/vacuum", 0.55],
    [PRESS + 4, "impact", 0.3],
    [ALARM - 4, "oxigeno/alarm", 0.3],
    [CERO + 6, "oxigeno/alarm", 0.22],
    [POLVO, "pop", 0.3],
    [MIRA, "whoosh-short", 0.25],
  ];
};

const fuego = (): Cue[] => {
  const { APAGARIA, VELAS, COCINAS, FOGATAS, CAFECITO } = FUEGO;
  return [
    [APAGARIA - 2, "oxigeno/snuff", 0.6],
    [VELAS, "pop", 0.25],
    [COCINAS, "pop", 0.25],
    [FOGATAS, "pop", 0.25],
    [CAFECITO + 2, "ding", 0.2],
  ];
};

const motores = (): Cue[] => {
  const { AUTOS, AVIONES, APAGADOS, COHETES, LLEVAN } = MOTORES;
  return [
    [AUTOS, "oxigeno/carstall", 0.45],
    [AVIONES, "oxigeno/jetdie", 0.5],
    [APAGADOS + 10, "oxigeno/glide", 0.35],
    [COHETES - 8, "oxigeno/rocket", 0.55],
    [LLEVAN, "ding", 0.3],
  ];
};

const humanos = (): Cue[] => {
  const { START, TRANQUILO, SANGRE, POP, GOLPE } = HUMANOS;
  return [
    [START + 1, "oxigeno/gasp", 0.6],
    [TRANQUILO + 2, "whoosh-short", 0.2],
    [SANGRE, "pop", 0.25],
    [POP, "oxigeno/earpop", 0.7],
    [POP, "impact", 0.2],
    [GOLPE, "pop", 0.25],
  ];
};

const regreso = (): Cue[] => {
  const { BACK, STRIKE1, STRIKE2, LIT } = REGRESO;
  return [
    [BACK - 10, "oxigeno/airback", 0.6],
    [BACK, "sparkle", 0.4],
    [STRIKE1 - 4, "oxigeno/matchfail", 0.55],
    [STRIKE2 - 4, "oxigeno/matchlight", 0.55],
    [LIT, "sparkle", 0.3],
  ];
};

const final = (): Cue[] => [
  [FINAL.CTA_START - 4, "pop", 0.3],
  [FINAL.TE, "ding", 0.35],
];

export const OXI_CUES: Cue[] = [...poofs(), ...intro(), ...boton(), ...fuego(), ...motores(), ...humanos(), ...regreso(), ...final()]
  .filter(([f]) => f >= 0)
  .sort((a, b) => a[0] - b[0]);

export const OXI_BEDS: Bed[] = [];

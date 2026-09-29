// Sound design of the dinosaur short: the Magnific effects ("dino/<name>", plus a few from the
// Inca short) and the synthesized ones, anchored to the same beats as the animation.
import type { Bed, Cue } from "../sfx";
import { CAVE, CIUDAD, FINAL, INTRO, PASA, PIZZA, REY } from "./beats";
import { DINO } from "./timeline";

const { SCENES } = DINO;

const poofs = (): Cue[] => (["ciudad", "pizza", "cavernicola", "rey"] as const).map((k) => [SCENES[k].from - 8, "inca/poof", 0.5]);

const intro = (): Cue[] => [
  [INTRO.ASTEROIDE - 20, "dino/asteroid", 0.5],
  [INTRO.SCOPE, "whoosh-short", 0.3],
  [INTRO.FALLADO, "ding", 0.3],
];

const pasa = (): Cue[] => {
  const { PASS, CHEER, STOMP1, ESPERA, POV } = PASA;
  return [
    [PASS - 6, "dino/asteroidpass", 0.6],
    [CHEER, "dino/party", 0.45],
    [STOMP1, "dino/stomp", 0.7],
    [ESPERA - 6, "dino/stomp", 0.5],
    [POV - 2, "dino/breath", 0.6],
  ];
};

const ciudad = (): Cue[] => {
  const { START, MUROS, SENALES, TREX } = CIUDAD;
  return [
    [MUROS, "stone-thud", 0.35],
    [SENALES, "pop", 0.35],
    [TREX + 6, "inca/shutter", 0.5],
    [START + 20, "dino/stomp", 0.3],
  ];
};

const pizza = (): Cue[] => {
  const { SNATCH, DATO, PAVO, MAMA, PLANTA, MOM_END } = PIZZA;
  return [
    [SNATCH - 2, "dino/snatch", 0.7],
    [SNATCH, "dino/raptor", 0.55],
    [DATO, "pop", 0.3],
    [PAVO - 10, "dino/munch", 0.4],
    [MAMA, "pop", 0.25],
    [PLANTA, "dino/wilt", 0.55],
    [MOM_END + 2, "dino/sadtrombone", 0.45],
  ];
};

const cave = (): Cue[] => {
  const { START, HUMANOS } = CAVE;
  return [
    [START + 8, "dino/stomp", 0.45],
    [HUMANOS, "dino/glitch", 0.55],
  ];
};

const rey = (): Cue[] => {
  const { START, ROAR, SNACK } = REY;
  return [
    [START + 2, "dino/gong", 0.55],
    [ROAR, "dino/roar", 0.75],
    [SNACK, "pop", 0.3],
  ];
};

const final = (): Cue[] => {
  const { START, GRAB, CTA, TE } = FINAL;
  return [
    [START + 2, "dino/roar", 0.35],
    [GRAB - 2, "dino/snatch", 0.55],
    [CTA - 2, "pop", 0.3],
    [TE, "ding", 0.35],
  ];
};

export const DINO_CUES: Cue[] = [...poofs(), ...intro(), ...pasa(), ...ciudad(), ...pizza(), ...cave(), ...rey(), ...final()]
  .filter(([f]) => f >= 0)
  .sort((a, b) => a[0] - b[0]);

export const DINO_BEDS: Bed[] = [
  [CIUDAD.START, CIUDAD.END, "dino/city", 0.3],
  [FINAL.START, FINAL.GRAB, "inca/run", 0.45],
];

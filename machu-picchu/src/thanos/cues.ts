// Sound design of the Thanos short: the Magnific effects ("thanos/<name>"), the costume-change
// smoke of the Inca short and the synthesized ones, anchored to the same beats as the animation.
import type { Bed, Cue } from "../sfx";
import { CARRERA, DOOM, FINAL, HEROES, PIEDRAS, PORTAL, PORTALES, POSCREDITOS, THOR, TRAJES } from "./beats";
import { DARK_FROM, DARK_TRIM, THANOS } from "./timeline";

const portal = (): Cue[] => {
  const { POV_END, LAND, UNIVERSO } = PORTAL;
  return [
    [0, "thanos/portal", 0.75],
    [4, "whoosh", 0.35],
    [POV_END - 4, "thanos/freeze", 0.6],
    [LAND, "impact", 0.28],
    [UNIVERSO, "sparkle", 0.3],
  ];
};

const carrera = (): Cue[] => {
  const { RUN, FACIL, TRIP, FALL } = CARRERA;
  return [
    [RUN, "thanos/slowmo", 0.6],
    [RUN + 84, "thanos/slowmo", 0.5],
    [FACIL + 4, "ding", 0.25],
    [TRIP - 2, "thanos/trip", 0.75],
    [FALL, "stone-thud", 0.35],
  ];
};

const thor = (): Cue[] => {
  const { START, BOLT, THROW, HIT, SNAP, SENAL } = THOR;
  return [
    [START - 8, "inca/poof", 0.55],
    [BOLT, "thanos/thunder", 0.7],
    [THROW - 2, "thanos/hammer", 0.75],
    [THROW + 18, "whoosh", 0.4],
    [HIT, "thanos/crack", 0.85],
    [HIT, "impact", 0.4],
    [SNAP, "thanos/snapfail", 0.9],
    [SENAL - 4, "tick", 0.3],
  ];
};

const heroes = (): Cue[] => {
  const { LANDS, TRISTES, TIEMPO, EQUIPO, COMPLETO } = HEROES;
  return [
    [LANDS[0] - 4, "thanos/heroes", 0.65],
    [LANDS[3] - 4, "thanos/heroes", 0.5],
    [TRISTES + 6, "stone-thud", 0.3],
    [TIEMPO + 6, "stone-thud", 0.3],
    [EQUIPO, "sparkle", 0.35],
    [COMPLETO, "ding", 0.35],
  ];
};

const trajes = (): Cue[] => {
  const { START, UNO, ITEM, PLAIN, PIEDRA, TOSS, BONK } = TRAJES;
  const items = ["thanos/shield", "thanos/thunder", "thanos/repulsor", "thanos/magic"] as const;
  return [
    [START - 8, "inca/poof", 0.5],
    ...UNO.map((f): Cue => [f - 8, "inca/poof", 0.45]),
    ...ITEM.map((f, i): Cue => [f, items[i], i === 1 ? 0.45 : 0.65]),
    [PLAIN - 8, "inca/poof", 0.45],
    [PIEDRA, "pop", 0.3],
    [TOSS, "whoosh-short", 0.35],
    [BONK, "stone-clack", 0.5],
  ];
};

const piedras = (): Cue[] => {
  const { FURY, POWER, BLAST, BURST, LAUNCH } = PIEDRAS;
  return [
    [FURY, "stone-thud", 0.35],
    [POWER, "thanos/stones", 0.75],
    [POWER + 80, "thanos/stones", 0.5],
    [BLAST, "thanos/groundbreak", 0.6],
    [BURST - 2, "thanos/groundbreak", 0.85],
    [BURST, "impact", 0.4],
    [LAUNCH, "whoosh", 0.5],
  ];
};

const portales = (): Cue[] => {
  const { OPEN, TODOS, PILE } = PORTALES;
  return [
    [OPEN - 10, "thanos/portals", 0.85],
    [OPEN + 50, "thanos/portal", 0.45],
    [TODOS, "thanos/heroes", 0.5],
    [TODOS + 20, "thanos/repulsor", 0.4],
    [TODOS + 34, "thanos/magic", 0.4],
    [TODOS + 46, "thanos/thunder", 0.35],
    [PILE, "impact", 0.45],
  ];
};

const final = (): Cue[] => {
  const { START, PIERDE, TAKE, APP, PIZZA } = FINAL;
  return [
    [START + 2, "thanos/cheer", 0.55],
    [PIERDE, "thanos/cheer", 0.4],
    [TAKE, "thanos/powerdown", 0.5],
    [APP - 6, "tick", 0.3],
    [APP, "pop", 0.3],
    [PIZZA + 6, "ding", 0.3],
  ];
};

const doom = (): Cue[] => {
  const { CLANK } = POSCREDITOS;
  const { GRAB, TURN, LIGHT } = DOOM;
  return [
    [CLANK, "thanos/clank", 0.85],
    [GRAB, "thanos/clank", 0.55],
    [TURN, "whoosh-short", 0.25],
    [LIGHT - 6, "thanos/powerup", 0.8],
  ];
};

const music = (): Cue[] => [[DARK_FROM, "thanos/dark", 0.75, THANOS.DURATION - DARK_FROM, DARK_TRIM]];

export const THANOS_CUES: Cue[] = [
  ...portal(),
  ...carrera(),
  ...thor(),
  ...heroes(),
  ...trajes(),
  ...piedras(),
  ...portales(),
  ...final(),
  ...doom(),
  ...music(),
]
  .filter(([f]) => f >= 0)
  .sort((a, b) => a[0] - b[0]);

export const THANOS_BEDS: Bed[] = [
  // The battle roars from the armies' charge to the pile-up.
  [PORTALES.TODOS - 10, PORTALES.END, "thanos/battle", 0.45],
  [DOOM.START, DOOM.END, "thanos/castle", 0.5],
];

// Narration shown as word-by-word captions (Clawd "speaks" with voice blips on each word).
// Frames are global (30 fps). A word ending in ^y/^o/^g/^r/^c gets a fixed highlight colour.

export type Word = { text: string; at: number; color?: string };
export type Chunk = { from: number; to: number; words: Word[] };

export const HIGHLIGHT: Record<string, string> = {
  y: "#FFD60A",
  o: "#FF8A3D",
  g: "#4DFF7C",
  r: "#FF4B3E",
  c: "#4FE3FF",
};

/** `times` are the frames at which each word appears. */
const chunk = (text: string, times: number[], to: number): Chunk => {
  const tokens = text.split(" ").map((t) => t.replace(/_/g, " "));
  if (tokens.length !== times.length) {
    throw new Error(
      `Caption "${text}" has ${tokens.length} words but ${times.length} times`,
    );
  }
  return {
    from: times[0],
    to,
    words: tokens.map((t, i) => {
      const m = t.match(/\^([a-z])$/);
      return {
        text: m ? t.slice(0, -2) : t,
        at: times[i],
        color: m ? HIGHLIGHT[m[1]] : undefined,
      };
    }),
  };
};

export const CAPTIONS: Chunk[] = [
  // Intro
  chunk("¡HOLA! SOY CLAWD^o", [194, 202, 209], 228),
  chunk("Y HOY TE EXPLICO", [230, 236, 241, 247], 258),
  chunk("CÓMO SE CONSTRUYÓ", [259, 266, 272], 284),
  chunk("MACHU^y PICCHU^y", [285, 291], 300),
  // Datos
  chunk("ESTÁ EN CUSCO,^y PERÚ^y", [306, 313, 320, 328], 342),
  chunk("A 2.430^g METROS", [344, 351, 360], 372),
  chunk("DE ALTURA", [373, 380], 392),
  chunk("LO CONSTRUYERON", [394, 402], 414),
  chunk("HACIA EL AÑO 1450^y", [416, 422, 427, 434], 458),
  chunk("POR ORDEN DEL", [462, 468, 473], 484),
  chunk("EMPERADOR INCA", [486, 494], 504),
  // El reto
  chunk("PERO HABÍA UN PROBLEMA^r", [544, 551, 557, 562], 576),
  chunk("CAEN CASI 2.000_mm^c", [578, 584, 590], 604),
  chunk("DE LLUVIA AL AÑO", [606, 612, 617, 622], 629),
  chunk("¡Y LA TIERRA TIEMBLA!^r", [630, 635, 640, 646], 664),
  // Secreto 1
  chunk("CORTABAN BLOQUES DE GRANITO^y", [762, 772, 780, 786], 800),
  chunk("¡SACADO DEL MISMO CERRO!", [802, 810, 816, 822], 836),
  chunk("Y LOS ENCAJABAN SIN CEMENTO^r", [838, 842, 848, 855, 862], 872),
  chunk("¡NI UNA HOJA^y DE PAPEL^y", [876, 881, 886, 893, 898], 910),
  chunk("CABE ENTRE ELLAS!", [911, 917, 923], 936),
  chunk("LOS TALLABAN A GOLPES", [940, 947, 954, 960], 970),
  chunk("CON PIEDRAS MÁS DURAS", [972, 978, 984, 990], 1000),
  chunk("¡Y BRONCE!^y", [1002, 1008], 1018),
  // Secreto 2
  chunk("SUS PUERTAS Y VENTANAS", [1060, 1066, 1072, 1076], 1088),
  chunk("SON TRAPECIOS^y", [1090, 1096], 1110),
  chunk("Y LOS MUROS SE INCLINAN", [1112, 1117, 1122, 1128, 1134], 1140),
  chunk("HACIA DENTRO^y", [1142, 1150], 1162),
  chunk("CUANDO TIEMBLA", [1164, 1172], 1184),
  chunk("LAS PIEDRAS ¡BAILAN!^y", [1186, 1192, 1200], 1216),
  chunk("¡Y VUELVEN A SU LUGAR!^g", [1218, 1223, 1229, 1233, 1238], 1258),
  // Secreto 3
  chunk("LAS TERRAZAS TIENEN CAPAS", [1300, 1306, 1312, 1318], 1332),
  chunk("PIEDRAS, GRAVA, ARENA Y TIERRA", [1334, 1342, 1350, 1357, 1361], 1372),
  chunk(
    "PARA QUE EL AGUA SE FILTRE^c",
    [1374, 1379, 1383, 1387, 1393, 1399],
    1410,
  ),
  chunk("¡EL 60%^y DE LA OBRA", [1412, 1418, 1426, 1430, 1434], 1446),
  chunk("ESTÁ BAJO TIERRA!", [1448, 1455, 1462], 1478),
  chunk("Y TIENE 129^c CANALES", [1482, 1487, 1494, 1502], 1516),
  chunk("PARA QUE LA LLUVIA", [1518, 1523, 1527, 1532], 1539),
  chunk("NO LO DESTRUYA", [1540, 1545, 1550], 1560),
  // Mit'a
  chunk("¿Y QUIÉN LO CONSTRUYÓ?", [1562, 1567, 1573, 1579], 1592),
  chunk("MILES DE PERSONAS", [1594, 1601, 1606], 1618),
  chunk("POR TURNOS", [1620, 1627], 1638),
  chunk("¡ESO SE LLAMABA...", [1640, 1646, 1651], 1657),
  // Final
  chunk("MÁS DE 500 AÑOS DESPUÉS...", [1684, 1690, 1696, 1703, 1710], 1738),
];

// Big 3D titles double as narration: they get voice blips too, but no captions.
export const TITLE_WORDS: number[] = [
  26,
  30, // SIN RUEDAS
  56,
  60, // SIN HIERRO
  86,
  90, // SIN CEMENTO
  114,
  120,
  126, // ¿CÓMO LO HICIERON?
  506, // PACHACÚTEC
  670,
  680, // ¡PARECÍA IMPOSIBLE!
  1658, // MIT'A
  1734,
  1740,
  1746, // ¡SIGUE EN PIE!
];

/** Every frame where Clawd says a word (for voice blips and talk bounces). */
export const WORD_FRAMES: number[] = [
  ...CAPTIONS.flatMap((c) => c.words.map((w) => w.at)),
  ...TITLE_WORDS,
].sort((a, b) => a - b);

import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Open-source fonts (SIL OFL) bundled in public/fonts.
const fonts = [
  { family: "Montserrat", file: "Montserrat-700.woff2", weight: "700" },
  { family: "Montserrat", file: "Montserrat-800.woff2", weight: "800" },
  { family: "Montserrat", file: "Montserrat-900.woff2", weight: "900" },
  { family: "Lilita One", file: "LilitaOne-400.woff2", weight: "400" },
  { family: "Luckiest Guy", file: "LuckiestGuy-400.woff2", weight: "400" },
];

export const fontsLoaded = Promise.all(
  fonts.map((f) =>
    loadFont({
      family: f.family,
      url: staticFile(`fonts/${f.file}`),
      weight: f.weight,
    }),
  ),
);

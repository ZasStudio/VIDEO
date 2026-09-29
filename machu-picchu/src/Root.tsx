import React from "react";
import { Composition, Folder } from "remotion";
import "./fonts";
import { MachuPicchuVideo } from "./MachuPicchuVideo";
import { NubiShort, NubiSoundtrack } from "./nubi/NubiShort";
import { NUBI, NUBI_HEIGHT, NUBI_WIDTH } from "./nubi/timeline";
import { Soundtrack } from "./Soundtrack";
import { FPS, HEIGHT, WIDTH } from "./theme";
import { DURATION } from "./timeline";
import { WorldTest } from "./dev/WorldTest";
import { ClawdSheet } from "./dev/ClawdSheet";
import { NubiSheet } from "./dev/NubiSheet";
import { INCA_UI_SHEET_DURATION, IncaUISheet } from "./dev/IncaUISheet";
import { IncaPropsSheet } from "./dev/IncaPropsSheet";
import { TitleTest } from "./dev/TitleTest";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MachuPicchu"
        component={MachuPicchuVideo}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ withAudio: true }}
      />
      {/* Audio only (no 3D), for fast mix renders: npx remotion render MachuPicchuAudio out.wav --codec=wav */}
      <Composition
        id="MachuPicchuAudio"
        component={Soundtrack}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      {/* Nubi's vertical short: why Machu Picchu survives earthquakes (15 s). */}
      <Composition
        id="NubiShort"
        component={NubiShort}
        durationInFrames={NUBI.DURATION}
        fps={FPS}
        width={NUBI_WIDTH}
        height={NUBI_HEIGHT}
        defaultProps={{ withAudio: true }}
      />
      <Composition
        id="NubiShortAudio"
        component={NubiSoundtrack}
        durationInFrames={NUBI.DURATION}
        fps={FPS}
        width={NUBI_WIDTH}
        height={NUBI_HEIGHT}
      />
      <Folder name="Dev">
        <Composition
          id="WorldTest"
          component={WorldTest}
          durationInFrames={6}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="TitleTest"
          component={TitleTest}
          durationInFrames={1}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="NubiSheet"
          component={NubiSheet}
          durationInFrames={1}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="ClawdSheet"
          component={ClawdSheet}
          durationInFrames={1}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="IncaUISheet"
          component={IncaUISheet}
          durationInFrames={INCA_UI_SHEET_DURATION}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="IncaPropsSheet"
          component={IncaPropsSheet}
          durationInFrames={1}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
    </>
  );
};

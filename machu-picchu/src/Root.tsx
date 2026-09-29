import React from "react";
import { Composition, Folder } from "remotion";
import "./fonts";
import { MachuPicchuVideo } from "./MachuPicchuVideo";
import { IncaPhoneShort, IncaSoundtrack } from "./inca/IncaPhoneShort";
import { OxigenoShort, OxigenoSoundtrack } from "./oxigeno/OxigenoShort";
import { DinoShort, DinoSoundtrack } from "./dino/DinoShort";
import { DINO, DINO_HEIGHT, DINO_WIDTH } from "./dino/timeline";
import { OXI, OXI_HEIGHT, OXI_WIDTH } from "./oxigeno/timeline";
import { INCA, INCA_HEIGHT, INCA_WIDTH } from "./inca/timeline";
import { NubiShort, NubiSoundtrack } from "./nubi/NubiShort";
import { NUBI, NUBI_HEIGHT, NUBI_WIDTH } from "./nubi/timeline";
import { Soundtrack } from "./Soundtrack";
import { FPS, HEIGHT, WIDTH } from "./theme";
import { DURATION } from "./timeline";
import { WorldTest } from "./dev/WorldTest";
import { ClawdSheet } from "./dev/ClawdSheet";
import { NubiSheet } from "./dev/NubiSheet";
import { INCA_UI_SHEET_DURATION, IncaUISheet } from "./dev/IncaUISheet";
import { INCA_PROPS_SHEET_FRAMES, IncaPropsSheet } from "./dev/IncaPropsSheet";
import { TitleTest } from "./dev/TitleTest";
import { OXI_UI_SHEET_DURATION, OxiUISheet } from "./dev/OxiUISheet";
import { OXI_PROPS_SHEET_FRAMES, OxiPropsSheet } from "./dev/OxiPropsSheet";
import { DINO_UI_SHEET_DURATION, DinoUISheet } from "./dev/DinoUISheet";
import { DINO_SHEET_FRAMES, DinoSheet } from "./dev/DinoSheet";
import { DINO_PROPS_SHEET_FRAMES, DinoPropsSheet } from "./dev/DinoPropsSheet";

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
      {/* Nubi's vertical short: life in the Inca Empire with a smartphone (60 s). */}
      <Composition
        id="IncaPhoneShort"
        component={IncaPhoneShort}
        durationInFrames={INCA.DURATION}
        fps={FPS}
        width={INCA_WIDTH}
        height={INCA_HEIGHT}
        defaultProps={{ withAudio: true }}
      />
      <Composition
        id="IncaPhoneShortAudio"
        component={IncaSoundtrack}
        durationInFrames={INCA.DURATION}
        fps={FPS}
        width={INCA_WIDTH}
        height={INCA_HEIGHT}
      />
      {/* Nubi's vertical short: what if the oxygen disappeared for 5 seconds? (60 s). */}
      <Composition
        id="OxigenoShort"
        component={OxigenoShort}
        durationInFrames={OXI.DURATION}
        fps={FPS}
        width={OXI_WIDTH}
        height={OXI_HEIGHT}
        defaultProps={{ withAudio: true }}
      />
      <Composition
        id="OxigenoShortAudio"
        component={OxigenoSoundtrack}
        durationInFrames={OXI.DURATION}
        fps={FPS}
        width={OXI_WIDTH}
        height={OXI_HEIGHT}
      />
      {/* Nubi's vertical short: what if the dinosaurs had never gone extinct? (60 s). */}
      <Composition
        id="DinoShort"
        component={DinoShort}
        durationInFrames={DINO.DURATION}
        fps={FPS}
        width={DINO_WIDTH}
        height={DINO_HEIGHT}
        defaultProps={{ withAudio: true }}
      />
      <Composition
        id="DinoShortAudio"
        component={DinoSoundtrack}
        durationInFrames={DINO.DURATION}
        fps={FPS}
        width={DINO_WIDTH}
        height={DINO_HEIGHT}
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
          durationInFrames={INCA_PROPS_SHEET_FRAMES}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="OxiUISheet"
          component={OxiUISheet}
          durationInFrames={OXI_UI_SHEET_DURATION}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="OxiPropsSheet"
          component={OxiPropsSheet}
          durationInFrames={OXI_PROPS_SHEET_FRAMES}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="DinoUISheet"
          component={DinoUISheet}
          durationInFrames={DINO_UI_SHEET_DURATION}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="DinoSheet"
          component={DinoSheet}
          durationInFrames={DINO_SHEET_FRAMES}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="DinoPropsSheet"
          component={DinoPropsSheet}
          durationInFrames={DINO_PROPS_SHEET_FRAMES}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
    </>
  );
};

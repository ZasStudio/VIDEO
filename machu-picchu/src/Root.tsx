import React from "react";
import { Composition, Folder } from "remotion";
import "./fonts";
import { MachuPicchuVideo } from "./MachuPicchuVideo";
import { IncaPhoneShort, IncaSoundtrack } from "./inca/IncaPhoneShort";
import { OxigenoShort, OxigenoSoundtrack } from "./oxigeno/OxigenoShort";
import { DinoShort, DinoSoundtrack } from "./dino/DinoShort";
import { DINO, DINO_HEIGHT, DINO_WIDTH } from "./dino/timeline";
import { ThanosShort, ThanosSoundtrack } from "./thanos/ThanosShort";
import { THANOS, THANOS_HEIGHT, THANOS_WIDTH } from "./thanos/timeline";
import { AguaShort, AguaSoundtrack } from "./agua/AguaShort";
import { AGUA, AGUA_HEIGHT, AGUA_WIDTH } from "./agua/timeline";
import { TiempoShort, TiempoSoundtrack } from "./tiempo/TiempoShort";
import { TIEMPO, TIEMPO_HEIGHT, TIEMPO_WIDTH } from "./tiempo/timeline";
import { MatusitaShort, MatusitaSoundtrack } from "./matusita/MatusitaShort";
import { IaShort, IaSoundtrack } from "./ia/IaShort";
import { IA } from "./ia/timeline";
import { MATUSITA, MATUSITA_HEIGHT, MATUSITA_WIDTH } from "./matusita/timeline";
import { MATUSITA_UI_SHEET_DURATION, MatusitaUISheet } from "./dev/MatusitaUISheet";
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
import { THANOS_CAST_SHEET_FRAMES, ThanosCastSheet } from "./dev/ThanosCastSheet";
import { THANOS_PROPS_SHEET_FRAMES, ThanosPropsSheet } from "./dev/ThanosPropsSheet";
import { THANOS_UI_SHEET_DURATION, ThanosUISheet } from "./dev/ThanosUISheet";
import { AGUA_HOME_SHEET_FRAMES, AguaHomeSheet } from "./dev/AguaHomeSheet";
import { AGUA_OUTDOOR_SHEET_FRAMES, AguaOutdoorSheet } from "./dev/AguaOutdoorSheet";
import { AGUA_SHOP_SHEET_FRAMES, AguaShopSheet } from "./dev/AguaShopSheet";
import { AGUA_STREET_SHEET_FRAMES, AguaStreetSheet } from "./dev/AguaStreetSheet";
import { AGUA_UI_SHEET_DURATION, AguaUISheet } from "./dev/AguaUISheet";
import { TIEMPO_UI_SHEET_DURATION, TiempoUISheet } from "./dev/TiempoUISheet";

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
      {/* Nubi's vertical short: what if Thanos had never snapped his fingers? (90 s). */}
      <Composition
        id="ThanosShort"
        component={ThanosShort}
        durationInFrames={THANOS.DURATION}
        fps={FPS}
        width={THANOS_WIDTH}
        height={THANOS_HEIGHT}
        defaultProps={{ withAudio: true }}
      />
      <Composition
        id="ThanosShortAudio"
        component={ThanosSoundtrack}
        durationInFrames={THANOS.DURATION}
        fps={FPS}
        width={THANOS_WIDTH}
        height={THANOS_HEIGHT}
      />
      {/* Nubi's vertical short: what if all the water disappeared? (70 s, a reply to a comment). */}
      <Composition
        id="AguaShort"
        component={AguaShort}
        durationInFrames={AGUA.DURATION}
        fps={FPS}
        width={AGUA_WIDTH}
        height={AGUA_HEIGHT}
        defaultProps={{ withAudio: true }}
      />
      <Composition
        id="AguaShortAudio"
        component={AguaSoundtrack}
        durationInFrames={AGUA.DURATION}
        fps={FPS}
        width={AGUA_WIDTH}
        height={AGUA_HEIGHT}
      />
      {/* Nubi's vertical short: what if money were time of life? (70 s). */}
      <Composition
        id="TiempoShort"
        component={TiempoShort}
        durationInFrames={TIEMPO.DURATION}
        fps={FPS}
        width={TIEMPO_WIDTH}
        height={TIEMPO_HEIGHT}
        defaultProps={{ withAudio: true }}
      />
      <Composition
        id="TiempoShortAudio"
        component={TiempoSoundtrack}
        durationInFrames={TIEMPO.DURATION}
        fps={FPS}
        width={TIEMPO_WIDTH}
        height={TIEMPO_HEIGHT}
      />
      {/* Nubi's vertical horror short: the night nobody wanted to spend in the Casa Matusita (68 s). */}
      <Composition
        id="MatusitaShort"
        component={MatusitaShort}
        durationInFrames={MATUSITA.DURATION}
        fps={FPS}
        width={MATUSITA_WIDTH}
        height={MATUSITA_HEIGHT}
        defaultProps={{ withAudio: true }}
      />
      <Composition
        id="MatusitaShortAudio"
        component={MatusitaSoundtrack}
        durationInFrames={MATUSITA.DURATION}
        fps={FPS}
        width={MATUSITA_WIDTH}
        height={MATUSITA_HEIGHT}
      />
      {/* Nubi's vertical comedy short: what if AI didn't exist (76 s). */}
      <Composition
        id="IaShort"
        component={IaShort}
        durationInFrames={IA.DURATION}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ withAudio: true }}
      />
      <Composition
        id="IaShortAudio"
        component={IaSoundtrack}
        durationInFrames={IA.DURATION}
        fps={FPS}
        width={1080}
        height={1920}
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
        <Composition
          id="ThanosCastSheet"
          component={ThanosCastSheet}
          durationInFrames={THANOS_CAST_SHEET_FRAMES}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="ThanosPropsSheet"
          component={ThanosPropsSheet}
          durationInFrames={THANOS_PROPS_SHEET_FRAMES}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="ThanosUISheet"
          component={ThanosUISheet}
          durationInFrames={THANOS_UI_SHEET_DURATION}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="AguaHomeSheet"
          component={AguaHomeSheet}
          durationInFrames={AGUA_HOME_SHEET_FRAMES}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="AguaOutdoorSheet"
          component={AguaOutdoorSheet}
          durationInFrames={AGUA_OUTDOOR_SHEET_FRAMES}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="AguaShopSheet"
          component={AguaShopSheet}
          durationInFrames={AGUA_SHOP_SHEET_FRAMES}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="AguaStreetSheet"
          component={AguaStreetSheet}
          durationInFrames={AGUA_STREET_SHEET_FRAMES}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="AguaUISheet"
          component={AguaUISheet}
          durationInFrames={AGUA_UI_SHEET_DURATION}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="TiempoUISheet"
          component={TiempoUISheet}
          durationInFrames={TIEMPO_UI_SHEET_DURATION}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="MatusitaUISheet"
          component={MatusitaUISheet}
          durationInFrames={MATUSITA_UI_SHEET_DURATION}
          fps={30}
          width={1080}
          height={1920}
        />
      </Folder>
    </>
  );
};

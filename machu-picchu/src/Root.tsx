import React from "react";
import { Composition, Folder } from "remotion";
import "./fonts";
import { MachuPicchuVideo } from "./MachuPicchuVideo";
import { Soundtrack } from "./Soundtrack";
import { FPS, HEIGHT, WIDTH } from "./theme";
import { DURATION } from "./timeline";
import { WorldTest } from "./dev/WorldTest";
import { ClawdSheet } from "./dev/ClawdSheet";
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
          id="ClawdSheet"
          component={ClawdSheet}
          durationInFrames={1}
          fps={30}
          width={1920}
          height={1080}
        />
      </Folder>
    </>
  );
};

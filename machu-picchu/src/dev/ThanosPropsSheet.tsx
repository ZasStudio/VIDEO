import React from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { FONT } from "../theme";
import { CameraRig, Vec3 } from "../three/CameraRig";
import { Nubi, NubiPalette, NubiPose } from "../three/Nubi";
import { Upright } from "../inca/outfit";
import {
  GAUNTLET_HOLD,
  GAUNTLET_LYING,
  GauntletChunk,
  HAMMER_HOLD,
  InfinityGauntlet,
  Mjolnir,
  Portal,
  ROCK_HOLD,
  Rock,
  SHIELD_HOLD,
  StarShield,
} from "../three/thanos/Props";
import { FrozenDebris, GroundCrack, LightningBolt, MagicCircle, RepulsorBeam, ShockRing, SparkBurst, StoneBlast } from "../three/thanos/FX";
import {
  ALTAR_BEHIND,
  ALTAR_TOP,
  BATTLE_SKY,
  BattleLights,
  Battlefield,
  CASTLE_SKY,
  CastleLights,
  DoomCastle,
  FIELD_CRACK,
  FIELD_GIANT_PORTALS,
  FIELD_HEROES,
  FIELD_NUBI,
  FIELD_SKY_PORTAL,
  FIELD_THANOS,
  FIELD_TRIP_ROCK,
} from "../three/thanos/Sets";

// Review sheet for the Thanos-short 3D props, effects and sets (1920 x 1080).
//   Frame 0: the gauntlet's states (normal, powered, broken, snapped, dead) and on a size-3 villain.
//   Frame 1: hammer, shield, rock (alone and held via holdR + Upright), the hero line-up, the
//            hammer's-eye view.
//   Frame 2: portals (small, opening, giant with an army, closing) and the magic circle.
//   Frame 3: lightning, repulsor, stone blast (beam / nova), frozen debris, ground crack stages.
//   Frame 4: Battlefield in vertical framings (wide frozen battle, low angle, reverse).
//   Frame 5: DoomCastle in vertical framings (hall, altar with the dead gauntlet, it lights up).
//   Frame 6: overviews from above (battlefield layout with spots, castle without its roof).

export const THANOS_PROPS_SHEET_FRAMES = 7;

type Cam = { position: Vec3; target: Vec3; fov: number };

const Panel: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  cam: Cam;
  background: string;
  title: string;
  children: React.ReactNode;
  labels?: { text: string; x: number; y: number }[];
}> = ({ x, y, w, h, cam, background, title, children, labels = [] }) => (
  <div style={{ position: "absolute", left: x + 8, top: y + 8, width: w - 16, height: h - 16, borderRadius: 26, overflow: "hidden", background }}>
    <ThreeCanvas
      width={w - 16}
      height={h - 16}
      flat
      gl={{ antialias: true, alpha: true }}
      camera={{ position: cam.position, fov: cam.fov, near: 0.05, far: 1400 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <CameraRig position={cam.position} target={cam.target} fov={cam.fov} />
      {children}
    </ThreeCanvas>
    <div style={{ position: "absolute", left: 20, top: 14, fontFamily: FONT.fun, fontSize: 30, color: "#FFFFFF", textShadow: "0 3px 0 rgba(0,0,0,0.45)" }}>{title}</div>
    {labels.map((l) => (
      <div
        key={l.text}
        style={{
          position: "absolute",
          left: l.x,
          top: l.y,
          transform: "translateX(-50%)",
          fontFamily: FONT.heavy,
          fontWeight: 800,
          fontSize: 17,
          color: "#FFFFFF",
          background: "rgba(0,0,0,0.42)",
          padding: "3px 10px",
          borderRadius: 10,
          whiteSpace: "nowrap",
        }}
      >
        {l.text}
      </div>
    ))}
  </div>
);

const Studio: React.FC<{ k?: number }> = ({ k = 1 }) => (
  <>
    <hemisphereLight args={["#FFF1E6", "#4A3A5E", 1.25 * k]} />
    <directionalLight position={[-5, 8, 7]} intensity={2.3 * k} color="#FFF0DC" />
    <directionalLight position={[6, 3, -5]} intensity={0.9 * k} color="#C9B8FF" />
  </>
);

const PURPLE = "linear-gradient(180deg, #2B1A4F 0%, #4C2C7A 55%, #24163E 100%)";
const DARK = "radial-gradient(circle at 50% 45%, #2E2450 0%, #120C22 85%)";
const NIGHT = "linear-gradient(180deg, #0B1022 0%, #1B2442 100%)";
const T = 1.35;

/** Stand-in for the size-3 villain (the real costume comes from the cast sheet). */
const VILLAIN: NubiPalette = { body: "#8A62C9", eyes: "#151515" };

const Villain: React.FC<{ position?: Vec3; yaw?: number; pose?: NubiPose; gauntlet?: React.ReactNode; size?: number }> = ({ position = [0, 0, 0], yaw = 0, pose = {}, gauntlet, size = 3 }) => (
  <Nubi size={size} position={position} rotationY={yaw} pose={pose} palette={VILLAIN} holdR={gauntlet ? <Upright raise={pose.finR ?? 0}>{gauntlet}</Upright> : undefined} />
);

const Gauntlet: React.FC<React.ComponentProps<typeof InfinityGauntlet>> = (p) => (
  <group {...GAUNTLET_HOLD}>
    <InfinityGauntlet t={T} {...p} />
  </group>
);

// =======================================================================================
// Frame 0: gauntlet

const GAUNTLET_CAM: Cam = { position: [0.55, 0.62, 2.7], target: [0.02, 0.42, 0], fov: 30 };

const GauntletStates: React.FC = () => {
  const states: { title: string; props: React.ComponentProps<typeof InfinityGauntlet> }[] = [
    { title: "NORMAL", props: { stones: 1 } },
    { title: "POWER 1", props: { stones: 1, power: 1 } },
    { title: "BROKEN 1", props: { stones: 1, broken: 1 } },
    { title: "SNAP 1", props: { stones: 1, snap: 1 } },
    { title: "DEAD 1", props: { dead: 1, relax: 0.5 } },
  ];
  return (
    <>
      {states.map((s, i) => (
        <Panel key={s.title} x={i * 384} y={0} w={384} h={540} background={i === 4 ? NIGHT : DARK} title={s.title} cam={GAUNTLET_CAM}>
          <Studio />
          <InfinityGauntlet t={T + i * 0.13} {...s.props} />
        </Panel>
      ))}
      <Panel x={0} y={540} w={640} h={540} background={PURPLE} title="VILLANO size 3 + GAUNTLET_HOLD (finR 1.4)" cam={{ position: [1.2, 2.6, 11], target: [0.6, 2.2, 0], fov: 32 }}>
        <Studio />
        <Villain pose={{ finR: 1.4, finL: -0.2, lookX: 0.5, lookY: 0.3 }} gauntlet={<Gauntlet stones={1} power={0.35} />} yaw={-0.15} />
      </Panel>
      <Panel
        x={640}
        y={540}
        w={640}
        h={540}
        background={PURPLE}
        title="SNAP 0 / 0.5 / 1 (3/4)"
        cam={{ position: [1.4, 1.0, 4.2], target: [0.05, 0.5, 0], fov: 32 }}
        labels={[
          { text: "snap 0", x: 120, y: 470 },
          { text: "snap 0.5", x: 312, y: 470 },
          { text: "snap 1 + broken", x: 500, y: 470 },
        ]}
      >
        <Studio />
        {[0, 0.5, 1].map((sn, i) => (
          <group key={sn} position={[(i - 1) * 1.05, 0, -i * 0.3]} rotation={[0, -0.45, 0]}>
            <InfinityGauntlet t={T} snap={sn} broken={i === 2 ? 1 : 0} />
          </group>
        ))}
      </Panel>
      <Panel x={1280} y={540} w={640} h={540} background={PURPLE} title="BROKEN: CHUNK FLYING / NUBI + DEAD" cam={{ position: [0.6, 2.2, 10], target: [0.6, 1.6, 0], fov: 32 }}>
        <Studio />
        <Villain position={[-1.6, 0, 0]} pose={{ finR: 1.4, eyeScale: 1.3 }} gauntlet={<Gauntlet broken={1} snap={1} />} />
        <group position={[1.1, 3.1, 0.5]} rotation={[0.6, 0.4, 0.9]} scale={1.5}>
          <GauntletChunk t={T} />
        </group>
        <SparkBurst t={0.18} position={[0.7, 2.9, 0.3]} size={1.2} seed={4} />
        <Nubi
          size={2}
          position={[2.6, 0, 0.6]}
          rotationY={-0.3}
          pose={{ finR: 1.0, lookX: 0.5, lookY: 0.4, eyeScale: 1.2 }}
          holdR={
            <Upright raise={1.0}>
              <group {...GAUNTLET_HOLD}>
                <InfinityGauntlet dead={1} relax={0.6} />
              </group>
            </Upright>
          }
        />
      </Panel>
    </>
  );
};

// =======================================================================================
// Frame 1: hammer, shield, rock, line-up, hammer POV

const HeldProps: React.FC = () => (
  <>
    <Panel x={0} y={0} w={480} h={540} background={PURPLE} title="MJOLNIR crackle 0 / 1" cam={{ position: [0.6, 0.9, 4.6], target: [0, 0.35, 0], fov: 30 }}>
      <Studio />
      <group position={[-0.65, 0, 0]} rotation={[0, 0.5, 0.1]}>
        <Mjolnir t={T} />
      </group>
      <group position={[0.75, 0, 0]} rotation={[0, -0.4, -0.15]}>
        <Mjolnir t={T} crackle={1} strapSwing={0.6} />
      </group>
    </Panel>
    <Panel x={480} y={0} w={480} h={540} background={DARK} title="HAMMER_HOLD + rayo" cam={{ position: [0.8, 2.2, 8.4], target: [0.5, 1.9, 0], fov: 34 }}>
      <Studio k={0.8} />
      <Nubi
        size={2}
        pose={{ finR: 1.5, finL: 0.3, lookY: 0.7, lookX: 0.4, eyeScale: 1.15 }}
        holdR={
          <Upright raise={1.5}>
            <group {...HAMMER_HOLD}>
              <Mjolnir t={T} crackle={1} />
            </group>
          </Upright>
        }
      />
      <LightningBolt from={[3.2, 8, -2]} to={[1.45, 2.75, 0.4]} t={T} seed={3} width={0.32} />
    </Panel>
    <Panel x={960} y={0} w={480} h={540} background={PURPLE} title="STARSHIELD + SHIELD_HOLD" cam={{ position: [0.5, 1.7, 7.5], target: [0.5, 1.15, 0], fov: 32 }}>
      <Studio />
      <group position={[-1.3, 1.2, -0.5]} rotation={[0, 0.45, 0]}>
        <StarShield />
      </group>
      <Nubi
        size={2}
        position={[0.9, 0, 0]}
        rotationY={-0.15}
        pose={{ finR: 0.9, lookX: -0.4, lookY: 0.2 }}
        holdR={
          <Upright raise={0.9}>
            <group {...SHIELD_HOLD}>
              <StarShield />
            </group>
          </Upright>
        }
      />
    </Panel>
    <Panel x={1440} y={0} w={480} h={540} background={PURPLE} title="ROCK + ROCK_HOLD" cam={{ position: [0.3, 1.6, 6.8], target: [0.3, 1.0, 0], fov: 32 }}>
      <Studio />
      <group position={[-1.4, 0, 0.5]}>
        <Rock />
      </group>
      <group position={[-1.6, 0, -0.6]}>
        <Rock size={0.55} seed={2} tint="#F0C9A0" />
      </group>
      <Nubi
        size={2}
        position={[0.6, 0, 0]}
        pose={{ finR: 1.6, finL: 0.6, eyeScale: 1.25, lookY: 0.3 }}
        holdR={
          <Upright raise={1.6}>
            <group {...ROCK_HOLD}>
              <Rock />
            </group>
          </Upright>
        }
      />
    </Panel>
    <Panel
      x={0}
      y={540}
      w={960}
      h={540}
      background={BATTLE_SKY}
      title="LÍNEA DE HÉROES: escudo, martillo, repulsor, magia… piedra"
      cam={{ position: [0, 2.6, 15], target: [0, 1.5, 0], fov: 36 }}
    >
      <BattleLights />
      <Battlefield t={T} embers={false} />
      {(
        [
          ["#3F7BE0", "shield"],
          ["#E04848", "hammer"],
          ["#E0B02E", "beam"],
          ["#2E9E8C", "magic"],
          ["#8EDCA2", "rock"],
        ] as [string, string][]
      ).map(([body, kind], i) => {
        const x = (i - 2) * 3.2;
        const finR = kind === "rock" ? 1.6 : kind === "magic" ? 0.9 : 1.2;
        return (
          <group key={kind} position={[x, 0, kind === "rock" ? 1.2 : 0]}>
            <Nubi
              size={2}
              palette={kind === "rock" ? undefined : { body }}
              pose={{ finR, lookY: 0.2, eyeScale: kind === "rock" ? 1.3 : 1 }}
              holdR={
                <Upright raise={finR}>
                  {kind === "shield" ? (
                    <group {...SHIELD_HOLD}>
                      <StarShield />
                    </group>
                  ) : kind === "hammer" ? (
                    <group {...HAMMER_HOLD}>
                      <Mjolnir t={T} crackle={0.7} />
                    </group>
                  ) : kind === "rock" ? (
                    <group {...ROCK_HOLD}>
                      <Rock />
                    </group>
                  ) : kind === "magic" ? (
                    <group position={[1.2, 0.6, 2.6]}>
                      <group scale={5}>
                        <MagicCircle t={T} radius={0.55} />
                      </group>
                    </group>
                  ) : null}
                </Upright>
              }
            />
            {kind === "beam" ? <RepulsorBeam from={[1.5, 1.3, 0.4]} to={[1.6, 2.1, -9]} t={T} width={0.32} /> : null}
          </group>
        );
      })}
    </Panel>
    <Panel x={960} y={540} w={960} h={540} background={BATTLE_SKY} title="POV DEL MARTILLO (volando hacia el guantelete)" cam={{ position: [0.15, 3.0, 5.4], target: [0.4, 2.7, -8], fov: 50 }}>
      <BattleLights />
      <Battlefield t={T} />
      <group position={[0.15, 2.55, 3.6]} rotation={[-Math.PI / 2 + 0.05, 0, 0.3]}>
        <Mjolnir t={T} crackle={1} strapSwing={1} />
      </group>
      <LightningBolt from={[0.1, 2.6, 4.8]} to={[0.3, 2.9, 9]} t={T} seed={8} width={0.2} />
      <Villain position={[0, 0, -8]} pose={{ finR: 1.4 }} gauntlet={<Gauntlet stones={1} power={0.5} />} />
    </Panel>
  </>
);

// =======================================================================================
// Frame 2: portals and magic

const Portals: React.FC = () => (
  <>
    <Panel x={0} y={0} w={640} h={1080} background={BATTLE_SKY} title="PORTAL r 2 EN EL CIELO (FIELD_SKY_PORTAL)" cam={{ position: [-1, 4.2, 17], target: [-1, 5.2, 0], fov: 50 }}>
      <BattleLights />
      <Battlefield t={T} frozen={1} />
      <group position={FIELD_SKY_PORTAL}>
        <Portal radius={2} open={1} t={T} inner={["#6FD0FF", "#2B5BC8"]} />
      </group>
      <Nubi size={2} position={[FIELD_SKY_PORTAL[0], 5.4, FIELD_SKY_PORTAL[2] + 0.4]} pose={{ finL: 1.6, finR: 1.6, eyeScale: 1.4, squash: 1.15, roll: 0.3, wiggle: 1, wigglePhase: 2 }} />
      <FrozenDebris t={T} frozen={1} area={[22, 7, 12]} count={70} seed={2} />
    </Panel>
    <Panel
      x={640}
      y={0}
      w={640}
      h={540}
      background={DARK}
      title="ABRIENDO: open 0.2 / 0.5 / 1"
      cam={{ position: [0, 0, 15], target: [0, 0, 0], fov: 36 }}
      labels={[
        { text: "0.2 (dibuja)", x: 115, y: 470 },
        { text: "0.5", x: 312, y: 470 },
        { text: "1 + inner", x: 505, y: 470 },
      ]}
    >
      {[0.2, 0.5, 1].map((o, i) => (
        <group key={o} position={[(i - 1) * 4.6, 0, 0]}>
          <Portal radius={2} open={o} t={T + i} inner={i === 2} />
        </group>
      ))}
    </Panel>
    <Panel x={1280} y={0} w={640} h={540} background={BATTLE_SKY} title="PORTAL GIGANTE r 12 + EJÉRCITO" cam={{ position: [2, 6, 38], target: [0, 9, -20], fov: 48 }}>
      <BattleLights />
      <Battlefield t={T} />
      <group position={FIELD_GIANT_PORTALS[2]}>
        <Portal radius={12} open={1} t={T} inner={["#FFE29A", "#E07A3A"]} />
      </group>
      {Array.from({ length: 21 }).map((_, i) => {
        const row = Math.floor(i / 7);
        const col = i % 7;
        return (
          <Nubi
            key={i}
            size={1.8}
            position={[(col - 3) * 3 + (row % 2) * 1.2, 0, -26 + row * 4]}
            palette={{ body: ["#E04848", "#3F7BE0", "#E0B02E", "#2E9E8C", "#B05FD0", "#F08A3A"][(i * 5) % 6] }}
            pose={{ finR: 1.2, finL: 0.6, hop: (i % 3) * 0.6 }}
          />
        );
      })}
    </Panel>
    <Panel x={640} y={540} w={640} h={540} background={DARK} title="MAGICCIRCLE open 0.4 / 1 (y en el suelo)" cam={{ position: [0, 1.6, 9], target: [0, 0.9, 0], fov: 36 }}>
      <Studio k={0.7} />
      <group position={[-1.9, 1.5, 0]}>
        <MagicCircle t={T} radius={1.1} open={0.4} />
      </group>
      <group position={[1.6, 1.6, 0]}>
        <MagicCircle t={T} radius={1.25} open={1} />
      </group>
      <group position={[0, 0.02, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <MagicCircle t={T} radius={1.4} open={1} sparks={false} />
      </group>
    </Panel>
    <Panel x={1280} y={540} w={640} h={540} background={BATTLE_SKY} title="PORTALES GIGANTES (FIELD_GIANT_PORTALS)" cam={{ position: [0, 9, 46], target: [0, 8, -20], fov: 50 }}>
      <BattleLights />
      <Battlefield t={T} />
      {FIELD_GIANT_PORTALS.map((p, i) => (
        <group key={i} position={p}>
          <Portal radius={12} open={i === 1 ? 0.6 : 1} t={T + i * 0.7} inner={i === 0 ? ["#B9F0FF", "#4A8C6A"] : i === 2 ? true : false} />
        </group>
      ))}
    </Panel>
  </>
);

// =======================================================================================
// Frame 3: effects

const Effects: React.FC = () => (
  <>
    <Panel x={0} y={0} w={480} h={540} background={DARK} title="LIGHTNINGBOLT" cam={{ position: [0, 2, 10], target: [0, 2, 0], fov: 40 }}>
      <LightningBolt from={[-1.5, 6, 0]} to={[0.4, 0, 0]} t={T} seed={1} width={0.4} />
      <LightningBolt from={[1.6, 5.5, -1]} to={[2.2, 1, 0]} t={T + 0.2} seed={2} width={0.16} />
      <LightningBolt from={[-2.6, 1, 0]} to={[-1.2, 3, 0]} t={T} seed={5} width={0.08} forks={1} />
    </Panel>
    <Panel x={480} y={0} w={480} h={540} background={BATTLE_SKY} title="REPULSORBEAM" cam={{ position: [2.5, 2.2, 8], target: [0.5, 1.4, 0], fov: 38 }}>
      <BattleLights />
      <Nubi size={2} position={[-2.2, 0, 0]} rotationY={0.9} palette={{ body: "#E0B02E" }} pose={{ finR: 1.0, lookX: 0.6 }} />
      <RepulsorBeam from={[-1.1, 1.25, 0.9]} to={[4.5, 1.6, -1.5]} t={T} />
    </Panel>
    <Panel x={960} y={0} w={480} h={540} background={BATTLE_SKY} title="STONEBLAST (con to)" cam={{ position: [3, 2.6, 10], target: [0, 1.8, 0], fov: 40 }}>
      <BattleLights />
      <Villain position={[-2.6, 0, -1]} yaw={0.7} pose={{ finR: 1.2 }} gauntlet={<Gauntlet stones={1} power={1} />} />
      <StoneBlast t={0.6} from={[-0.6, 2.6, 0]} to={[4, 0.8, 1.5]} />
    </Panel>
    <Panel x={1440} y={0} w={480} h={540} background={BATTLE_SKY} title="STONEBLAST nova t 0.12 / 0.35" cam={{ position: [0, 2.4, 11], target: [0, 2, 0], fov: 40 }}>
      <BattleLights />
      <StoneBlast t={0.12} from={[-1.6, 2.4, 0]} radius={1.4} />
      <StoneBlast t={0.35} from={[1.8, 2.4, 0]} radius={1.4} seed={3} />
      <ShockRing t={0.3} radius={3} position={[1.8, 0.05, 0]} />
    </Panel>
    <Panel x={0} y={540} w={480} h={540} background={BATTLE_SKY} title="FROZENDEBRIS frozen 1" cam={{ position: [0, 3, 13], target: [0, 2.6, 0], fov: 42 }}>
      <BattleLights />
      <Battlefield t={T} frozen={1} embers={false} />
      <FrozenDebris t={T} frozen={1} area={[14, 6, 8]} count={90} />
      <Nubi size={2} position={[0, 0, 2]} pose={{ eyeScale: 1.3, lookY: 0.6 }} />
    </Panel>
    <Panel x={480} y={540} w={480} h={540} background={BATTLE_SKY} title="frozen 0.45 (cayendo)" cam={{ position: [0, 3, 13], target: [0, 2.6, 0], fov: 42 }}>
      <BattleLights />
      <Battlefield t={T} embers={false} />
      <FrozenDebris t={T} frozen={0.45} area={[14, 6, 8]} count={90} />
      <Nubi size={2} position={[0, 0, 2]} pose={{ eyeScale: 1.3, lookY: 0.6 }} />
    </Panel>
    <Panel
      x={960}
      y={540}
      w={960}
      h={540}
      background={BATTLE_SKY}
      title="GROUNDCRACK crack 0.5 / 1 · burst 0.12 / 0.35 / 0.7"
      cam={{ position: [0, 9, 20], target: [0, 0.5, -1], fov: 44 }}
      labels={[
        { text: "crack 0.5", x: 120, y: 470 },
        { text: "crack 1", x: 300, y: 470 },
        { text: "burst 0.12", x: 475, y: 470 },
        { text: "burst 0.35", x: 650, y: 470 },
        { text: "burst 0.7", x: 830, y: 470 },
      ]}
    >
      <BattleLights />
      <Battlefield t={T} embers={false} />
      {(
        [
          [0.5, 0],
          [1, 0],
          [1, 0.12],
          [1, 0.35],
          [1, 0.7],
        ] as [number, number][]
      ).map(([c, b], i) => (
        <group key={i} position={[(i - 2) * 6.6, 0, -2]}>
          <GroundCrack crack={c} burst={b} radius={2.4} seed={i + 1} t={T} />
        </group>
      ))}
    </Panel>
  </>
);

// =======================================================================================
// Frame 4: battlefield, vertical

const HERO_COLORS = ["#3F7BE0", "#E04848", "#E0B02E", "#2E9E8C", "#B05FD0", "#F08A3A"];

const BattleVertical: React.FC = () => (
  <>
    <Panel x={0} y={0} w={640} h={1080} background={BATTLE_SKY} title="BATALLA CONGELADA (wide)" cam={{ position: [0, 4.5, 19], target: [0, 3.5, -10], fov: 58 }}>
      <BattleLights />
      <Battlefield t={T} frozen={1} />
      <FrozenDebris t={T} frozen={1} area={[30, 8, 22]} count={140} seed={3} />
      {Array.from({ length: 30 }).map((_, i) => {
        const rnd = (k: number) => {
          const s = Math.sin(i * 91.7 + k * 13.1) * 43758.5453;
          return s - Math.floor(s);
        };
        const x = (rnd(1) - 0.5) * 34;
        const z = -4 - rnd(2) * 16;
        if (Math.abs(x - FIELD_THANOS[0]) < 2.5 && Math.abs(z - FIELD_THANOS[2]) < 2.5) return null;
        return <Nubi key={i} size={1.7 + rnd(3) * 0.5} position={[x, 0, z]} rotationY={(rnd(4) - 0.5) * 2} palette={{ body: HERO_COLORS[i % 6] }} pose={{ finR: rnd(5) * 1.5, finL: rnd(6) * 1.2, hop: rnd(7) * 1.5, roll: (rnd(8) - 0.5) * 0.4 }} />;
      })}
      <Villain position={FIELD_THANOS} pose={{ finR: 1.4 }} gauntlet={<Gauntlet stones={1} power={0.4} />} />
      <Nubi size={2} position={FIELD_NUBI} rotationY={Math.PI * 0.95} pose={{ finL: 0.4, finR: 0.4 }} />
      <group position={FIELD_TRIP_ROCK}>
        <Rock size={0.5} tint="#F0C9A0" />
      </group>
    </Panel>
    <Panel x={640} y={0} w={640} h={1080} background={BATTLE_SKY} title="CONTRAPICADO: THANOS + NUBI" cam={{ position: [-2.2, 0.9, 11], target: [0.8, 3.4, -4], fov: 55 }}>
      <BattleLights />
      <Battlefield t={T} />
      <Villain position={FIELD_THANOS} pose={{ finR: 1.4, lookY: -0.3 }} gauntlet={<Gauntlet stones={1} power={0.6} />} />
      <Nubi size={2} position={[-1.2, 0, 5.5]} rotationY={Math.PI * 0.92} pose={{ finR: 0.8 }} />
      <group position={FIELD_CRACK}>
        <GroundCrack crack={0.7} radius={4} t={T} />
      </group>
    </Panel>
    <Panel x={1280} y={0} w={640} h={1080} background={BATTLE_SKY} title="CONTRAPLANO (mirando a +z)" cam={{ position: [1.5, 3.2, -14], target: [0, 2.6, 10], fov: 58 }}>
      <BattleLights />
      <Battlefield t={T} />
      {FIELD_HEROES.map((p, i) => (
        <Nubi key={i} size={2} position={p} rotationY={Math.PI} palette={{ body: HERO_COLORS[i] }} pose={{ finR: 1, finL: 0.4 }} />
      ))}
      <Nubi size={2} position={FIELD_NUBI} rotationY={Math.PI} pose={{ finR: 1.2 }} />
    </Panel>
  </>
);

// =======================================================================================
// Frame 5: castle, vertical

const DOOM: NubiPalette = { body: "#7C8796", fins: "#9AA5B4", eyes: "#57FF8A", eyeGlow: 1.2 };

const CastleVertical: React.FC = () => (
  <>
    <Panel x={0} y={0} w={640} h={1080} background={CASTLE_SKY} title="DOOMCASTLE (wide)" cam={{ position: [0, 3.2, 9], target: [0, 4.2, -8], fov: 62 }}>
      <CastleLights />
      <DoomCastle t={T} />
      <group position={ALTAR_TOP}>
        <group {...GAUNTLET_LYING}>
          <InfinityGauntlet dead={1} relax={1} />
        </group>
      </group>
    </Panel>
    <Panel x={640} y={0} w={640} h={1080} background={CASTLE_SKY} title="ALTAR: GUANTELETE MUERTO" cam={{ position: [1.2, 2.6, 2.6], target: [0, 1.6, -3.2], fov: 50 }}>
      <CastleLights />
      <DoomCastle t={T} />
      <group position={ALTAR_TOP}>
        <group {...GAUNTLET_LYING}>
          <InfinityGauntlet dead={1} relax={1} />
        </group>
      </group>
      <Nubi size={3} position={ALTAR_BEHIND} palette={DOOM} pose={{ finR: 0.6, lookY: -0.5 }} />
    </Panel>
    <Panel x={1280} y={0} w={640} h={1080} background={CASTLE_SKY} title="…Y SE ENCIENDE" cam={{ position: [0.4, 2.7, 1.2], target: [0, 2.0, -3.4], fov: 50 }}>
      <CastleLights />
      <DoomCastle t={T} />
      <Nubi
        size={3}
        position={ALTAR_BEHIND}
        palette={DOOM}
        pose={{ finR: 1.2, lookY: -0.2, lookX: 0.4 }}
        holdR={
          <Upright raise={1.2}>
            <group {...GAUNTLET_HOLD}>
              <InfinityGauntlet t={T} stones={1} power={0.7} relax={0.3} />
            </group>
          </Upright>
        }
      />
    </Panel>
  </>
);

// =======================================================================================
// Frame 6: overviews

/** Translucent marker post with a label-free colour (spots check). */
const Spot: React.FC<{ at: Vec3; color: string; h?: number }> = ({ at, color, h = 3 }) => (
  <mesh position={[at[0], at[1] + h / 2, at[2]]}>
    <cylinderGeometry args={[0.35, 0.35, h, 12]} />
    <meshBasicMaterial color={color} transparent opacity={0.75} depthWrite={false} toneMapped={false} />
  </mesh>
);

const Overviews: React.FC = () => (
  <>
    <Panel x={0} y={0} w={960} h={1080} background={BATTLE_SKY} title="BATTLEFIELD desde arriba (spots)" cam={{ position: [40, 70, 60], target: [0, 0, -14], fov: 50 }}>
      <BattleLights />
      <Battlefield t={T} />
      <Spot at={FIELD_NUBI} color="#2EE06A" />
      <Spot at={FIELD_THANOS} color="#B04CFF" />
      <Spot at={FIELD_CRACK} color="#FF3B30" h={1} />
      {FIELD_HEROES.map((p, i) => (
        <Spot key={i} at={p} color="#3F7BE0" h={2} />
      ))}
      {FIELD_GIANT_PORTALS.map((p, i) => (
        <group key={i} position={p}>
          <Portal radius={12} open={1} t={T} sparks={0.4} />
        </group>
      ))}
      <mesh position={[0, 0.05, -3]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[52, 42]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.08} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </Panel>
    <Panel x={960} y={0} w={960} h={1080} background={CASTLE_SKY} title="DOOMCASTLE sin techo" cam={{ position: [16, 30, 18], target: [0, 0, -4], fov: 50 }}>
      <CastleLights />
      <DoomCastle t={T} roof={false} />
      <group position={ALTAR_TOP}>
        <group {...GAUNTLET_LYING}>
          <InfinityGauntlet dead={1} relax={1} />
        </group>
      </group>
      <Nubi size={2} position={[0, 0, 4]} />
    </Panel>
  </>
);

export const ThanosPropsSheet: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "linear-gradient(135deg, #1B1233 0%, #2E1E55 50%, #3B2466 100%)" }}>
      {frame === 0 ? <GauntletStates /> : frame === 1 ? <HeldProps /> : frame === 2 ? <Portals /> : frame === 3 ? <Effects /> : frame === 4 ? <BattleVertical /> : frame === 5 ? <CastleVertical /> : <Overviews />}
    </AbsoluteFill>
  );
};


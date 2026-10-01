import { Vec3, projectToScreen } from "../three/CameraRig";
import { THANOS_HEIGHT, THANOS_WIDTH } from "./timeline";

export type Cam = { position: Vec3; target: Vec3; fov: number; roll?: number };

/**
 * Aims a camera at `position` so that the world point `point` lands at screen (sx, sy) of the
 * 1080 x 1920 frame: returns the look-at target, `dist` units from the camera along the view.
 * Used to keep a character's feet just above the captions while the camera moves.
 */
export const aim = (position: Vec3, fov: number, point: Vec3, sx: number, sy: number, dist = 12, roll = 0): Cam => {
  // Start looking straight at the point, then nudge the target until it lands where we want.
  const d0: Vec3 = [point[0] - position[0], point[1] - position[1], point[2] - position[2]];
  const l0 = Math.hypot(d0[0], d0[1], d0[2]) || 1;
  let dir: Vec3 = [d0[0] / l0, d0[1] / l0, d0[2] / l0];
  const pxPerRad = THANOS_HEIGHT / 2 / Math.tan((fov * Math.PI) / 360);
  for (let i = 0; i < 40; i++) {
    const target: Vec3 = [position[0] + dir[0] * dist, position[1] + dir[1] * dist, position[2] + dir[2] * dist];
    const p = projectToScreen({ position, target, fov, roll }, point, THANOS_WIDTH, THANOS_HEIGHT);
    const ex = p.x - sx;
    const ey = p.y - sy;
    if (Math.abs(ex) < 0.5 && Math.abs(ey) < 0.5) break;
    // Turn right when the point sits too far right; tilt down when it sits too high (and back).
    const yaw = Math.atan2(dir[0], dir[2]) - ex / pxPerRad;
    const pitch = Math.asin(Math.max(-0.99, Math.min(0.99, dir[1]))) - ey / pxPerRad;
    dir = [Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)];
  }
  return { position, target: [position[0] + dir[0] * dist, position[1] + dir[1] * dist, position[2] + dir[2] * dist], fov, roll };
};

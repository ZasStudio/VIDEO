// Where to draw a 3D character's floating life counter on screen: projects the point just above
// its head with the shot's camera. Each shot renders <LifeCounter> (overlay/tiempo/TiempoUI) at
// the returned position, inside the same container as its <Stage> (so it shakes with it).
import { Cam } from "../thanos/camera";
import { Vec3, projectToScreen } from "../three/CameraRig";
import { TIEMPO_HEIGHT, TIEMPO_WIDTH } from "./timeline";

/**
 * Screen anchor (bottom centre of the counter) of a world point, and a scale that follows the
 * distance to the camera (`ref` units away = scale 1), clamped so far counters stay readable.
 */
export const counterAt = (cam: Cam, point: Vec3, opts: { ref?: number; min?: number; max?: number } = {}) => {
  const { ref = 9, min = 0.55, max = 1.35 } = opts;
  const p = projectToScreen(cam, point, TIEMPO_WIDTH, TIEMPO_HEIGHT);
  const d = Math.hypot(point[0] - cam.position[0], point[1] - cam.position[1], point[2] - cam.position[2]);
  const scale = Math.min(max, Math.max(min, ref / Math.max(0.1, d)));
  return { x: p.x, y: p.y, scale, behind: p.behind };
};

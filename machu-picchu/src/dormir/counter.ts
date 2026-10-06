// Where to draw a floating money counter on screen: projects a world point (just above a bed or a
// character's head) with the shot's camera. Each shot renders <MoneyCounter> (overlay/dormir/DormirUI)
// at the returned position, inside the same container as its <Stage> (so it shakes with it).
import { Cam } from "../thanos/camera";
import { Vec3, projectToScreen } from "../three/CameraRig";
import { DORMIR_HEIGHT, DORMIR_WIDTH } from "./timeline";

/**
 * Screen anchor (bottom centre of the counter) of a world point, and a scale that follows the
 * distance to the camera (`ref` units away = scale 1), clamped so far counters stay readable.
 */
export const counterAt = (cam: Cam, point: Vec3, opts: { ref?: number; min?: number; max?: number } = {}) => {
  const { ref = 9, min = 0.5, max = 1.35 } = opts;
  const p = projectToScreen(cam, point, DORMIR_WIDTH, DORMIR_HEIGHT);
  const d = Math.hypot(point[0] - cam.position[0], point[1] - cam.position[1], point[2] - cam.position[2]);
  const scale = Math.min(max, Math.max(min, ref / Math.max(0.1, d)));
  return { x: p.x, y: p.y, scale, behind: p.behind };
};

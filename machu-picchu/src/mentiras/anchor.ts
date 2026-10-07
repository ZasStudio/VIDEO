// Where to draw a truth tag on screen: projects a world point just above a character's head with the
// shot's camera. Each shot renders <TruthTag> (overlay/mentiras/TruthTag) at the returned position,
// inside the same container as its <Stage> (so it shakes with it) and after it (so it's on top).
import { Cam } from "../thanos/camera";
import { Vec3, projectToScreen } from "../three/CameraRig";
import { MENTIRAS_HEIGHT, MENTIRAS_WIDTH } from "./timeline";

/**
 * Screen anchor (the tip of the tag's pointer) of a world point, and a scale that follows the
 * distance to the camera (`ref` units away = scale 1), clamped so the text always stays readable.
 */
export const tagAt = (cam: Cam, point: Vec3, opts: { ref?: number; min?: number; max?: number } = {}) => {
  const { ref = 9, min = 0.7, max = 1.15 } = opts;
  const p = projectToScreen(cam, point, MENTIRAS_WIDTH, MENTIRAS_HEIGHT);
  const d = Math.hypot(point[0] - cam.position[0], point[1] - cam.position[1], point[2] - cam.position[2]);
  const scale = Math.min(max, Math.max(min, ref / Math.max(0.1, d)));
  return { x: p.x, y: p.y, scale, behind: p.behind };
};

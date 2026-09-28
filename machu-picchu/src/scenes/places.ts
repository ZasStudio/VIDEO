import { Vec3 } from "../three/CameraRig";

// Shared spots in the 3D world (units ~10 m, citadel top at y = 0).

/** Where Clawd stands on the southern end of the citadel. */
export const CLAWD_SPOT: Vec3 = [3.2, 0, 20.5];
/** Clawd faces the intro camera. */
export const CLAWD_YAW = 0.47;
export const CLAWD_SIZE = 2.4;

export const INTRO_CAM_START = {
  position: [8.6, 2.2, 31.2] as Vec3,
  target: [4.1, 2.5, 14.2] as Vec3,
};
export const INTRO_CAM_END = {
  position: [7.5, 2.0, 28.7] as Vec3,
  target: [4.3, 2.45, 14.8] as Vec3,
};

/** Aerial view used for the map pin and altitude. */
export const AERIAL_CAM = {
  position: [70, 62, 118] as Vec3,
  target: [2, -6, -12] as Vec3,
};

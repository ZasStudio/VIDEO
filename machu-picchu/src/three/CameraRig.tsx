import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import * as THREE from "three";

export type Vec3 = [number, number, number];

// Positions the default camera for the current frame. Layout effects run before
// @remotion/three renders the frame, so the camera never lags one frame behind.
export const CameraRig: React.FC<{
  position: Vec3;
  target: Vec3;
  fov?: number;
  roll?: number;
}> = ({ position, target, fov = 40, roll = 0 }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(position[0], position[1], position[2]);
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(target[0], target[1], target[2]);
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
};

export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const tmpCam = new THREE.PerspectiveCamera();
/** Projects a world point to screen pixels for a camera looking from `position` to `target`. */
export const projectToScreen = (
  cam: { position: Vec3; target: Vec3; fov?: number; roll?: number },
  point: Vec3,
  width = 1920,
  height = 1080,
) => {
  tmpCam.fov = cam.fov ?? 40;
  tmpCam.aspect = width / height;
  tmpCam.near = 0.1;
  tmpCam.far = 5000;
  tmpCam.position.set(...cam.position);
  const roll = cam.roll ?? 0;
  tmpCam.up.set(Math.sin(roll), Math.cos(roll), 0);
  tmpCam.lookAt(...cam.target);
  tmpCam.updateProjectionMatrix();
  tmpCam.updateMatrixWorld();
  const v = new THREE.Vector3(...point).project(tmpCam);
  return {
    x: ((v.x + 1) / 2) * width,
    y: ((1 - v.y) / 2) * height,
    behind: v.z > 1,
  };
};

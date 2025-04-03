/**
 * CameraObserver.ts
 * 
 * Type-safe observer for camera-related events
 */
import { ImageRatio } from "@/app/util/generation/generation-util";
import { Observer } from "./Observer";

export interface CameraEvents {
  fovChanged: { fov: number };
  farClipChanged: { farClip: number };
  ratioOverlayVisibilityChanged: { visible: boolean };
  ratioOverlayPaddingChanged: { padding: number };
  ratioOverlayRightPaddingChanged: { padding: number };
  ratioOverlayRatioChanged: { ratio: ImageRatio };
}

export const cameraObserver = new Observer<CameraEvents>(); 
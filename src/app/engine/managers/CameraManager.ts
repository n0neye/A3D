/**
 * CameraManager.ts
 * 
 * Responsible for all camera-related operations in the editor.
 * This manager encapsulates camera functionality:
 * - Creating and configuring the main camera
 * - Handling camera controls and attachments
 * - Managing camera properties (FOV, position, etc.)
 * - Implementing camera behaviors (orbiting, panning, etc.)
 * 
 * By isolating camera logic in its own manager, we can:
 * - Maintain cleaner separation of concerns
 * - More easily change camera implementation details
 * - Test camera functionality independently
 */
import * as BABYLON from '@babylonjs/core';

export class CameraManager {
  private scene: BABYLON.Scene;
  private mainCamera: BABYLON.ArcRotateCamera;
  
  constructor(scene: BABYLON.Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.mainCamera = this._createMainCamera(canvas);
  }
  
  private _createMainCamera(canvas: HTMLCanvasElement): BABYLON.ArcRotateCamera {
    const camera = new BABYLON.ArcRotateCamera(
        "camera",
        -Math.PI / 2,
        Math.PI / 2.5,
        100,
        new BABYLON.Vector3(0, 0, 0),
        this.scene
    );
    camera.wheelPrecision = 20;
    camera.panningSensibility = 400;
    camera.angularSensibilityX = 400;
    camera.angularSensibilityY = 400;
    camera.lowerRadiusLimit = 1;
    camera.upperRadiusLimit = 20;
    camera.attachControl(canvas, true);
    camera.position = new BABYLON.Vector3(0, 1, 5);
    camera.minZ = 0.01;
    camera.maxZ = 50;
    camera.inertia = 0;
    camera.panningInertia = 0;
    camera.inertialPanningX = 0;
    camera.inertialPanningY = 0;
    
    return camera;
  }
  
  public attachControl(canvas: HTMLCanvasElement): void {
    this.mainCamera.attachControl(canvas, true);
  }
  
  public setFOV(fov: number): void {
    this.mainCamera.fov = Math.max(0.35, Math.min(1.57, fov));
  }
  
  // Other camera methods
} 
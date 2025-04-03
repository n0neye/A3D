/**
 * CameraManager.ts
 * 
 * Responsible for all camera-related operations in the editor.
 * This manager encapsulates camera functionality:
 * - Creating and configuring the main camera
 * - Handling camera controls and attachments
 * - Managing camera properties (FOV, position, etc.)
 * - Implementing camera behaviors (orbiting, panning, etc.)
 * - Managing framing and aspect ratios
 * 
 * By isolating camera logic in its own manager, we can:
 * - Maintain cleaner separation of concerns
 * - More easily change camera implementation details
 * - Test camera functionality independently
 */
import * as BABYLON from '@babylonjs/core';
import { ImageRatio } from '../../util/generation/generation-util';
import { cameraObserver } from '../utils/CameraObserver';

export class CameraManager {
  private scene: BABYLON.Scene;
  private mainCamera: BABYLON.ArcRotateCamera;
  private ratioOverlay: {
    frame: BABYLON.Mesh;
    padding: number;
    rightExtraPadding: number;
    ratio: ImageRatio;
    isVisible: boolean;
  } | null = null;
  
  // Make observer publicly accessible
  public observer = cameraObserver;
  
  constructor(scene: BABYLON.Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.mainCamera = this._createMainCamera(canvas);
    this._initializeRatioOverlay();
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
  
  private _initializeRatioOverlay(): void {
    // Create a plane for the ratio overlay
    const frame = BABYLON.MeshBuilder.CreatePlane("ratioOverlay", { size: 1 }, this.scene);
    
    // Set up materials for the frame (semi-transparent)
    const frameMaterial = new BABYLON.StandardMaterial("ratioOverlayMaterial", this.scene);
    frameMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
    frameMaterial.alpha = 0.3;
    frameMaterial.backFaceCulling = false;
    frame.material = frameMaterial;
    
    // Position in front of camera
    frame.position = new BABYLON.Vector3(0, 0, 10);
    frame.isPickable = false;
    
    // Store in ratioOverlay object
    this.ratioOverlay = {
      frame,
      padding: 10,
      rightExtraPadding: 0,
      ratio: '16:9',
      isVisible: true
    };
    
    // Update frame dimensions initially
    this._updateRatioOverlayDimensions();
    
    // Set up scene before render to update frame position based on camera
    this.scene.onBeforeRenderObservable.add(() => {
      if (this.ratioOverlay && this.ratioOverlay.isVisible) {
        this._updateRatioOverlayDimensions();
      }
    });
  }
  
  private _updateRatioOverlayDimensions(): void {
    if (!this.ratioOverlay) return;
    
    // Get current ratio
    let width = 16;
    let height = 9;
    
    switch (this.ratioOverlay.ratio) {
      case '1:1':
        width = 1;
        height = 1;
        break;
      case '4:3':
        width = 4;
        height = 3;
        break;
      case '16:9':
        width = 16;
        height = 9;
        break;
    }
    
    // Calculate distance from camera to keep consistent visual size
    const distanceFromCamera = 10;
    
    // Calculate the frame dimensions based on FOV and distance
    const fov = this.mainCamera.fov;
    const frameHeight = 2 * Math.tan(fov / 2) * distanceFromCamera;
    const frameWidth = frameHeight * (width / height);
    
    // Apply padding
    const paddingFactor = 1 - (this.ratioOverlay.padding / 100);
    
    // Apply scaling based on ratio and padding
    this.ratioOverlay.frame.scaling.x = frameWidth * paddingFactor;
    this.ratioOverlay.frame.scaling.y = frameHeight * paddingFactor;
    
    // Extra padding on right side if needed
    if (this.ratioOverlay.rightExtraPadding > 0) {
      const rightPaddingFactor = this.ratioOverlay.rightExtraPadding / 100;
      const rightOffset = frameWidth * rightPaddingFactor / 2;
      this.ratioOverlay.frame.position.x = -rightOffset;
    } else {
      this.ratioOverlay.frame.position.x = 0;
    }
    
    // Position in front of camera
    const forward = this.mainCamera.getTarget().subtract(this.mainCamera.position).normalize();
    const framePos = this.mainCamera.position.add(forward.scale(distanceFromCamera));
    this.ratioOverlay.frame.position = framePos;
    
    // Orient to face camera
    this.ratioOverlay.frame.lookAt(this.mainCamera.position);
  }
  
  // Public API methods
  
  public attachControl(canvas: HTMLCanvasElement): void {
    this.mainCamera.attachControl(canvas, true);
  }
  
  public setFOV(fov: number): void {
    const clampedFOV = Math.max(0.35, Math.min(1.57, fov));
    this.mainCamera.fov = clampedFOV;
    this.observer.notify('fovChanged', { fov: clampedFOV });
  }
  
  public getFOV(): number {
    return this.mainCamera.fov;
  }
  
  public setFarClip(farClip: number): void {
    this.mainCamera.maxZ = farClip;
    this.observer.notify('farClipChanged', { farClip });
  }
  
  public getFarClip(): number {
    return this.mainCamera.maxZ;
  }
  
  public setRatioOverlayVisibility(visible: boolean): void {
    if (this.ratioOverlay) {
      this.ratioOverlay.isVisible = visible;
      this.ratioOverlay.frame.isVisible = visible;
      this.observer.notify('ratioOverlayVisibilityChanged', { visible });
    }
  }
  
  public getRatioOverlayVisibility(): boolean {
    return this.ratioOverlay?.isVisible || false;
  }
  
  public setRatioOverlayPadding(padding: number): void {
    if (this.ratioOverlay) {
      this.ratioOverlay.padding = padding;
      this.observer.notify('ratioOverlayPaddingChanged', { padding });
    }
  }
  
  public getRatioOverlayPadding(): number {
    return this.ratioOverlay?.padding || 10;
  }
  
  public setRatioOverlayRightPadding(padding: number): void {
    if (this.ratioOverlay) {
      this.ratioOverlay.rightExtraPadding = padding;
      this.observer.notify('ratioOverlayRightPaddingChanged', { padding });
    }
  }
  
  public getRatioOverlayRightPadding(): number {
    return this.ratioOverlay?.rightExtraPadding || 0;
  }
  
  public setRatioOverlayRatio(ratio: ImageRatio): void {
    if (this.ratioOverlay) {
      this.ratioOverlay.ratio = ratio;
      this.observer.notify('ratioOverlayRatioChanged', { ratio });
    }
  }
  
  public getRatioOverlayRatio(): ImageRatio {
    return this.ratioOverlay?.ratio || '16:9';
  }
  
  public getCameraSettings(): {fov: number, farClip: number} {
    return {
      fov: this.getFOV(),
      farClip: this.getFarClip()
    };
  }
  
  public getRatioOverlaySettings(): {
    isVisible: boolean;
    padding: number;
    rightExtraPadding: number;
    ratio: ImageRatio;
  } {
    return {
      isVisible: this.getRatioOverlayVisibility(),
      padding: this.getRatioOverlayPadding(),
      rightExtraPadding: this.getRatioOverlayRightPadding(),
      ratio: this.getRatioOverlayRatio()
    };
  }
} 
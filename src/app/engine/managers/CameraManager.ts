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
import * as GUI from '@babylonjs/gui';
import { ImageRatio, RATIO_MAP } from '../../util/generation/generation-util';
import { cameraObserver } from '../utils/CameraObserver';

export class CameraManager {
  private scene: BABYLON.Scene;
  private mainCamera: BABYLON.ArcRotateCamera;
  private ratioOverlay: {
    container: GUI.AdvancedDynamicTexture;
    frame: GUI.Rectangle;
    borders: {
      top: GUI.Rectangle;
      right: GUI.Rectangle;
      bottom: GUI.Rectangle;
      left: GUI.Rectangle;
    };
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
    this._initializeRatioOverlay(canvas);

    // On resize, update the ratio overlay
    window.addEventListener('resize', this.onResize.bind(this));
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

  private _initializeRatioOverlay(canvas: HTMLCanvasElement): void {
    // Create fullscreen UI
    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI("ratioOverlayUI", true, this.scene);

    // Create a container to group the frame elements
    const container = new GUI.Rectangle("ratioFrameContainer");
    container.thickness = 0;
    container.background = "transparent";
    advancedTexture.addControl(container);

    // Create the frame elements (four rectangles for borders)
    const topBorder = new GUI.Rectangle("topBorder");
    const rightBorder = new GUI.Rectangle("rightBorder");
    const bottomBorder = new GUI.Rectangle("bottomBorder");
    const leftBorder = new GUI.Rectangle("leftBorder");

    // Set properties for all borders
    [topBorder, rightBorder, bottomBorder, leftBorder].forEach(border => {
      border.thickness = 0;
      border.background = "rgba(0, 0, 0, 0.3)"; // Semi-transparent black
      container.addControl(border);
    });

    // Store in environment objects with initial padding and ratio
    this.ratioOverlay = {
      container: advancedTexture,
      frame: container,
      padding: 10,
      rightExtraPadding: 0,
      ratio: '16:9',
      isVisible: true,
      borders: {
        top: topBorder,
        right: rightBorder,
        bottom: bottomBorder,
        left: leftBorder
      }
    };

    // Initial sizing
    this._updateRatioOverlayDimensions();
  };

  private _updateRatioOverlayDimensions(): void {
    if (!this.ratioOverlay || !this.ratioOverlay.borders) return;

    const { frame, padding, rightExtraPadding, borders, ratio } = this.ratioOverlay;

    // Get current engine dimensions
    const babylonEngine = this.scene.getEngine();
    const screenWidth = babylonEngine.getRenderWidth();
    const screenHeight = babylonEngine.getRenderHeight();

    // Calculate padding in pixels
    const paddingPixels = (padding / 100) * Math.min(screenWidth, screenHeight);
    const rightExtraPaddingPixels = (rightExtraPadding / 100) * Math.min(screenWidth, screenHeight);

    // Use the ratio from the ratio map instead of hardcoded value
    const { width: ratioWidth, height: ratioHeight } = RATIO_MAP[ratio];
    const targetRatio = ratioWidth / ratioHeight;

    let frameWidth, frameHeight;

    if (screenWidth / screenHeight > targetRatio) {
      // Screen is wider than the target ratio
      frameHeight = screenHeight - (paddingPixels * 2);
      frameWidth = frameHeight * targetRatio;
    } else {
      // Screen is taller than the target ratio
      frameWidth = screenWidth - (paddingPixels * 2) - rightExtraPaddingPixels;
      frameHeight = frameWidth / targetRatio;
    }

    // Calculate frame position (centered, but adjusted for extra right padding)
    const horizontalSpace = screenWidth - frameWidth;
    const leftPadding = (horizontalSpace - rightExtraPaddingPixels) / 2;
    const rightPadding = leftPadding + rightExtraPaddingPixels;

    const frameLeft = leftPadding;
    const frameTop = (screenHeight - frameHeight) / 2;

    // Set container size to match screen
    frame.width = "100%";
    frame.height = "100%";

    // Position the borders to create a hollow frame

    // Top border - covers everything above the frame
    borders.top.width = "100%";
    borders.top.height = `${frameTop}px`;
    borders.top.topInPixels = 0;
    borders.top.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    borders.top.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;

    // Bottom border - covers everything below the frame
    borders.bottom.width = "100%";
    borders.bottom.height = `${frameTop}px`;
    borders.bottom.topInPixels = frameTop + frameHeight;
    borders.bottom.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    borders.bottom.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;

    // Left border - covers left area between top and bottom borders
    borders.left.width = `${frameLeft}px`;
    borders.left.height = `${frameHeight}px`;
    borders.left.leftInPixels = 0;
    borders.left.topInPixels = frameTop;
    borders.left.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    borders.left.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;

    // Right border - covers right area between top and bottom borders
    borders.right.width = `${rightPadding}px`;
    borders.right.height = `${frameHeight}px`;
    borders.right.leftInPixels = frameLeft + frameWidth;
    borders.right.topInPixels = frameTop;
    borders.right.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    borders.right.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
  };

  // Public API methods
  public attachControl(canvas: HTMLCanvasElement): void {
    this.mainCamera.attachControl(canvas, true);
  }

  public setFOV(fov: number): void {
    const clampedFOV = Math.max(0.35, Math.min(1.57, fov));
    this.mainCamera.fov = clampedFOV;
    this.observer.notify('fovChanged', { fov: clampedFOV });
    this._updateRatioOverlayDimensions();
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
      this.ratioOverlay.container.rootContainer.isVisible = visible;
      this.observer.notify('ratioOverlayVisibilityChanged', { visible });
    }
  }

  public getRatioOverlayVisibility(): boolean {
    return this.ratioOverlay?.isVisible || false;
  }

  public setRatioOverlayPadding(padding: number): void {
    if (this.ratioOverlay) {
      this.ratioOverlay.padding = padding;
      this._updateRatioOverlayDimensions();
      this.observer.notify('ratioOverlayPaddingChanged', { padding });
    }
  }

  public getRatioOverlayPadding(): number {
    return this.ratioOverlay?.padding || 10;
  }

  public setRatioOverlayRightPadding(padding: number): void {
    if (this.ratioOverlay) {
      this.ratioOverlay.rightExtraPadding = padding;
      this._updateRatioOverlayDimensions();
      this.observer.notify('ratioOverlayRightPaddingChanged', { padding });
    }
  }

  public getRatioOverlayRightPadding(): number {
    return this.ratioOverlay?.rightExtraPadding || 0;
  }

  public setRatioOverlayRatio(ratio: ImageRatio): void {
    if (this.ratioOverlay) {
      this.ratioOverlay.ratio = ratio;
      this._updateRatioOverlayDimensions();
      this.observer.notify('ratioOverlayRatioChanged', { ratio });
    }
  }

  public getRatioOverlayRatio(): ImageRatio {
    return this.ratioOverlay?.ratio || '16:9';
  }

  public getCameraSettings(): { fov: number, farClip: number } {
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
  public getRatioOverlayDimensions = (): {
    left: number;
    top: number;
    width: number;
    height: number;
  } | null => {
    if (!this.ratioOverlay || !this.ratioOverlay.borders) return null;

    const { padding, rightExtraPadding, ratio } = this.ratioOverlay;
    const babylonEngine = this.scene.getEngine();
    const screenWidth = babylonEngine.getRenderWidth();
    const screenHeight = babylonEngine.getRenderHeight();

    // Calculate padding in pixels
    const paddingPixels = (padding / 100) * Math.min(screenWidth, screenHeight);
    const rightExtraPaddingPixels = (rightExtraPadding / 100) * Math.min(screenWidth, screenHeight);

    // Use the ratio from the ratio map
    const { width: ratioWidth, height: ratioHeight } = RATIO_MAP[ratio];
    const targetRatio = ratioWidth / ratioHeight;

    let frameWidth, frameHeight;

    if (screenWidth / screenHeight > targetRatio) {
      // Screen is wider than the target ratio
      frameHeight = screenHeight - (paddingPixels * 2);
      frameWidth = frameHeight * targetRatio;
    } else {
      // Screen is taller than the target ratio
      frameWidth = screenWidth - (paddingPixels * 2) - rightExtraPaddingPixels;
      frameHeight = frameWidth / targetRatio;
    }

    // Calculate position (centered on screen, but adjusted for extra right padding)
    const horizontalSpace = screenWidth - frameWidth;
    const leftPadding = (horizontalSpace - rightExtraPaddingPixels) / 2;

    return {
      left: leftPadding,
      top: (screenHeight - frameHeight) / 2,
      width: frameWidth,
      height: frameHeight
    };
  };

  // Add a method to handle window/canvas resize
  public onResize(): void {
    setTimeout(() => {
      this._updateRatioOverlayDimensions();
    }, 1);
  }

  // Add this to the public API to ensure the overlay updates when the engine is resized
  public update(): void {
    if (this.ratioOverlay && this.ratioOverlay.isVisible) {
      this._updateRatioOverlayDimensions();
    }
  }
} 
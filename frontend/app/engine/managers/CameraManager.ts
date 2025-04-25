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
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// Import MOUSE enum for button configuration
import { MOUSE } from 'three';
import { ImageRatio, RATIO_MAP } from '@/engine/utils/imageUtil';
import { Observer } from '@/engine/utils/Observer';

export interface CameraObserverEvents {
  fovChanged: { fov: number };
  farClipChanged: { farClip: number };
  ratioOverlayVisibilityChanged: { visible: boolean };
  ratioOverlayPaddingChanged: { padding: number };
  ratioOverlayRightPaddingChanged: { padding: number };
  ratioOverlayRatioChanged: { ratio: ImageRatio };
}

// Create a new observer for camera events
export const cameraObserver = new Observer<CameraObserverEvents>();

export class CameraManager {
  private scene: THREE.Scene;
  private mainCamera: THREE.PerspectiveCamera;
  private orbitControls: OrbitControls;
  private canvas: HTMLCanvasElement;
  
  // Simplify the ratio overlay to just contain the calculation-related properties
  private ratioOverlaySettings: {
    padding: number;
    rightExtraPadding: number;
    ratio: ImageRatio;
    isVisible: boolean;
  };

  // Make observer publicly accessible
  public observer = cameraObserver;

  constructor(scene: THREE.Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.canvas = canvas;
    
    // Create camera and controls
    this.mainCamera = this._createMainCamera();
    this.orbitControls = this._createOrbitControls(canvas);
    
    // Initialize ratio overlay settings
    this.ratioOverlaySettings = this._initializeRatioOverlaySettings();
    
    // Add window resize handler
    window.addEventListener('resize', this.onResize.bind(this));
  }

  private _createMainCamera(): THREE.PerspectiveCamera {
    // Create a perspective camera with reasonable defaults
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    const camera = new THREE.PerspectiveCamera(
      45, // FOV in degrees
      aspect,
      0.01, // Near clip
      1000 // Far clip
    );
    
    // Set initial position
    camera.position.set(0, 3, 5);
    this.scene.add(camera);
    
    return camera;
  }

  private _createOrbitControls(canvas: HTMLCanvasElement): OrbitControls {
    // Create orbit controls
    const controls = new OrbitControls(this.mainCamera, canvas);
    
    // Configure controls
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 1;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI / 1.5; // Prevent going below the ground
    controls.panSpeed = 1.0;
    controls.rotateSpeed = 1.0;
    controls.zoomSpeed = 1.0;
    
    // Configure mouse buttons:
    controls.mouseButtons = {
      LEFT: MOUSE.ROTATE,       // Left mouse button for panning
      MIDDLE: MOUSE.ROTATE,  // Middle mouse button for rotation
      RIGHT: MOUSE.PAN      // Right mouse button for zooming
    };
    
    return controls;
  }

  private _initializeRatioOverlaySettings(): {
    padding: number;
    rightExtraPadding: number;
    ratio: ImageRatio;
    isVisible: boolean;
  } {
    return {
      padding: 10,
      rightExtraPadding: 0,
      ratio: '16:9',
      isVisible: true
    };
  }

  // Public API methods
  public attachControl(canvas: HTMLCanvasElement): void {
    // OrbitControls already attached in constructor
    // This is just for API compatibility
  }

  public setFOV(fov: number): void {
    const clampedFOV = Math.max(20, Math.min(90, fov));
    this.mainCamera.fov = clampedFOV;
    this.mainCamera.updateProjectionMatrix();
    this.observer.notify('fovChanged', { fov: clampedFOV });
  }

  
  public getCameraSettings(): { fov: number, farClip: number } {
    return {
      fov: this.getFOV(),
      farClip: this.getFarClip()
    };
  }

  public getFOV(): number {
    return this.mainCamera.fov;
  }

  public setFarClip(farClip: number): void {
    this.mainCamera.far = farClip;
    this.mainCamera.updateProjectionMatrix();
    this.observer.notify('farClipChanged', { farClip });
  }

  public getFarClip(): number {
    return this.mainCamera.far;
  }

  public setRatioOverlayVisibility(visible: boolean): void {
    if (this.ratioOverlaySettings) {
      this.ratioOverlaySettings.isVisible = visible;
      this.observer.notify('ratioOverlayVisibilityChanged', { visible });
    }
  }

  public getRatioOverlayVisibility(): boolean {
    return this.ratioOverlaySettings?.isVisible || false;
  }

  public setRatioOverlayPadding(padding: number): void {
    if (this.ratioOverlaySettings) {
      this.ratioOverlaySettings.padding = padding;
      this.observer.notify('ratioOverlayPaddingChanged', { padding });
    }
  }

  public getRatioOverlayPadding(): number {
    return this.ratioOverlaySettings?.padding || 10;
  }

  public setRatioOverlayRightPadding(padding: number): void {
    if (this.ratioOverlaySettings) {
      this.ratioOverlaySettings.rightExtraPadding = padding;
      this.observer.notify('ratioOverlayRightPaddingChanged', { padding });
    }
  }

  public getRatioOverlayRightPadding(): number {
    return this.ratioOverlaySettings?.rightExtraPadding || 0;
  }

  public setRatioOverlayRatio(ratio: ImageRatio): void {
    if (this.ratioOverlaySettings) {
      this.ratioOverlaySettings.ratio = ratio;
      this.observer.notify('ratioOverlayRatioChanged', { ratio });
    }
  }

  public getRatioOverlayRatio(): ImageRatio {
    return this.ratioOverlaySettings?.ratio || '16:9';
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

  // Enhanced version of getRatioOverlayDimensions that provides all needed information
  // for both the React UI and screenshot functionality
  public getRatioOverlayDimensions = (): {
    frame: {
      left: number;
      top: number;
      width: number;
      height: number;
    };
    borders: {
      top: { x: number; y: number; width: number; height: number };
      right: { x: number; y: number; width: number; height: number };
      bottom: { x: number; y: number; width: number; height: number };
      left: { x: number; y: number; width: number; height: number };
    };
    isVisible: boolean;
  } | null => {
    if (!this.ratioOverlaySettings) return null;
    if (!this.ratioOverlaySettings.isVisible) return { frame: { left: 0, top: 0, width: 0, height: 0 }, borders: { top: { x: 0, y: 0, width: 0, height: 0 }, right: { x: 0, y: 0, width: 0, height: 0 }, bottom: { x: 0, y: 0, width: 0, height: 0 }, left: { x: 0, y: 0, width: 0, height: 0 } }, isVisible: false };

    const { padding, rightExtraPadding, ratio } = this.ratioOverlaySettings;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    // Calculate padding in pixels
    const paddingPixels = (padding / 100) * Math.min(width, height);
    const rightExtraPaddingPixels = (rightExtraPadding / 100) * Math.min(width, height);

    // Use the ratio from the ratio map
    const { width: ratioWidth, height: ratioHeight } = RATIO_MAP[ratio];
    const targetRatio = ratioWidth / ratioHeight;

    let frameWidth, frameHeight;

    if (width / height > targetRatio) {
      // Screen is wider than the target ratio
      frameHeight = height - (paddingPixels * 2);
      frameWidth = frameHeight * targetRatio;
    } else {
      // Screen is taller than the target ratio
      frameWidth = width - (paddingPixels * 2) - rightExtraPaddingPixels;
      frameHeight = frameWidth / targetRatio;
    }

    // Calculate position (centered on screen, but adjusted for extra right padding)
    const horizontalSpace = width - frameWidth;
    const leftPadding = (horizontalSpace - rightExtraPaddingPixels) / 2;
    const rightPadding = leftPadding + rightExtraPaddingPixels;
    const frameTop = (height - frameHeight) / 2;

    // Calculate border positions and dimensions for the React UI
    const borders = {
      top: {
        x: 0,
        y: 0,
        width: width,
        height: frameTop
      },
      right: {
        x: leftPadding + frameWidth,
        y: frameTop,
        width: rightPadding,
        height: frameHeight
      },
      bottom: {
        x: 0,
        y: frameTop + frameHeight,
        width: width,
        height: frameTop
      },
      left: {
        x: 0,
        y: frameTop,
        width: leftPadding,
        height: frameHeight
      }
    };

    return {
      frame: {
        left: leftPadding,
        top: frameTop,
        width: frameWidth,
        height: frameHeight
      },
      borders,
      isVisible: this.ratioOverlaySettings.isVisible
    };
  };

  // Handle window/canvas resize
  public onResize(): void {
    // Update camera aspect ratio
    this.mainCamera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.mainCamera.updateProjectionMatrix();
  }

  // Update method doesn't need to update the overlay dimensions
  // as this will be handled by the React component
  public update(): void {
    // Update orbit controls
    if (this.orbitControls && this.orbitControls.enabled) {
      this.orbitControls.update();
    }
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.mainCamera;
  }

  public getOrbitControls(): OrbitControls {
    return this.orbitControls;
  }

  public setOrbitControlsEnabled(enabled: boolean): void {
    if (this.orbitControls) {
      this.orbitControls.enabled = enabled;
    }
  }

  /**
   * Focus the camera on a specific object
   * @param target The object to focus on
   * @param offset Optional offset distance from the object (default: 1.5x object size)
   * @param duration Animation duration in milliseconds (0 for instant)
   */
  public focusOnObject(target: THREE.Object3D, offset?: number, duration: number = 300): void {
    if (!target) return;
    
    // Calculate the bounding box of the target
    const boundingBox = new THREE.Box3().setFromObject(target);
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    
    // Calculate size of the object to determine camera distance
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    const maxDimension = Math.max(size.x, size.y, size.z);
    
    // Determine camera distance (adjust multiplier as needed)
    const distance = offset || (maxDimension * 5);
    
    // Get the current camera direction normalized
    const direction = new THREE.Vector3();
    this.mainCamera.getWorldDirection(direction);
    
    // Calculate new camera position
    const newPosition = center.clone().add(
      direction.multiplyScalar(-distance)
    );
    
    if (duration > 0) {
      // Animate the transition
      this._animateCameraToPosition(newPosition, center, duration);
    } else {
      // Instant transition
      this.mainCamera.position.copy(newPosition);
      this.orbitControls.target.copy(center);
      this.orbitControls.update();
    }
  }
  
  /**
   * Animate the camera movement to a new position
   * @private
   */
  private _animateCameraToPosition(
    targetPosition: THREE.Vector3, 
    targetLookAt: THREE.Vector3,
    duration: number
  ): void {
    const startPosition = this.mainCamera.position.clone();
    const startLookAt = this.orbitControls.target.clone();
    const startTime = Date.now();
    
    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease in-out function for smooth animation
      const easeProgress = progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress;
      
      // Interpolate position and lookAt
      const newPosition = new THREE.Vector3().lerpVectors(
        startPosition, 
        targetPosition, 
        easeProgress
      );
      
      const newLookAt = new THREE.Vector3().lerpVectors(
        startLookAt,
        targetLookAt,
        easeProgress
      );
      
      // Update camera and controls
      this.mainCamera.position.copy(newPosition);
      this.orbitControls.target.copy(newLookAt);
      this.orbitControls.update();
      
      // Continue animation if not complete
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }
} 
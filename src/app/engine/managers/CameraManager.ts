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
import { ImageRatio, RATIO_MAP } from '../../util/generation/generation-util';
import { Observer } from '../utils/Observer';

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
  
  // Ratio overlay properties
  private ratioOverlay: {
    container: THREE.Group;
    overlayMesh: THREE.Mesh; // Semi-transparent quad to represent the frame
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
    
    // Initialize ratio overlay
    this.ratioOverlay = this._initializeRatioOverlay();
    
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
    camera.position.set(0, 1, 5);
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
    
    return controls;
  }

  private _initializeRatioOverlay(): {
    container: THREE.Group;
    overlayMesh: THREE.Mesh;
    padding: number;
    rightExtraPadding: number;
    ratio: ImageRatio;
    isVisible: boolean;
  } {
    // Create a container group for all overlay elements
    const container = new THREE.Group();
    container.name = "ratioOverlay";
    
    // Create the overlay mesh - this will be a colored quad rendered in screen space
    // For Three.js we'll implement this differently - using an orthographic camera and a plane
    // that we'll size based on the ratio
    
    // Create a semi-transparent material
    const material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthTest: false
    });
    
    // Create a simple plane geometry
    const geometry = new THREE.PlaneGeometry(1, 1);
    
    // Create the mesh
    const overlayMesh = new THREE.Mesh(geometry, material);
    overlayMesh.renderOrder = 999; // Make sure it renders last
    
    // Add to container
    container.add(overlayMesh);
    
    // Add container to scene
    this.scene.add(container);
    
    // Return the initialized object
    return {
      container,
      overlayMesh,
      padding: 10,
      rightExtraPadding: 0,
      ratio: '16:9',
      isVisible: true
    };
  }

  private _updateRatioOverlayDimensions(): void {
    if (!this.ratioOverlay) return;
    
    const { padding, rightExtraPadding, ratio, container, overlayMesh } = this.ratioOverlay;
    
    // Get current dimensions
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    
    // Calculate padding in pixels
    const paddingPixels = (padding / 100) * Math.min(width, height);
    const rightExtraPaddingPixels = (rightExtraPadding / 100) * Math.min(width, height);
    
    // Get aspect ratio
    const { width: ratioWidth, height: ratioHeight } = RATIO_MAP[ratio];
    const targetRatio = ratioWidth / ratioHeight;
    
    // Calculate frame dimensions
    let frameWidth, frameHeight;
    
    if (width / height > targetRatio) {
      // Screen is wider than target ratio
      frameHeight = height - (paddingPixels * 2);
      frameWidth = frameHeight * targetRatio;
    } else {
      // Screen is taller than target ratio
      frameWidth = width - (paddingPixels * 2) - rightExtraPaddingPixels;
      frameHeight = frameWidth / targetRatio;
    }
    
    // Update the visibility
    container.visible = this.ratioOverlay.isVisible;
    
    // For Three.js implementation, we'll use a different approach
    // We need to create a complex shape with a hole in it to show the frame area
    
    // To be implemented - for now, we'll just update the overlay mesh
    // We'll need a more complex implementation for Three.js using multiple meshes
    // or a shader-based solution
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
    if (this.ratioOverlay) {
      this.ratioOverlay.isVisible = visible;
      this.ratioOverlay.container.visible = visible;
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
    if (!this.ratioOverlay) return null;

    const { padding, rightExtraPadding, ratio } = this.ratioOverlay;
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

    return {
      left: leftPadding,
      top: (height - frameHeight) / 2,
      width: frameWidth,
      height: frameHeight
    };
  };

  // Handle window/canvas resize
  public onResize(): void {
    // Update camera aspect ratio
    this.mainCamera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.mainCamera.updateProjectionMatrix();
    
    // Update ratio overlay
    setTimeout(() => {
      this._updateRatioOverlayDimensions();
    }, 1);
  }

  // Update method for animation loop
  public update(): void {
    // Update orbit controls - this is crucial for OrbitControls to work properly
    // Especially when moving the mouse for orbit/pan operations
    if (this.orbitControls) {
      this.orbitControls.update();
    }
    
    // Update overlay if needed
    if (this.ratioOverlay && this.ratioOverlay.isVisible) {
      this._updateRatioOverlayDimensions();
    }
  }

  public getCamera(): THREE.PerspectiveCamera {
    return this.mainCamera;
  }

  public getOrbitControls(): OrbitControls {
    return this.orbitControls;
  }
} 
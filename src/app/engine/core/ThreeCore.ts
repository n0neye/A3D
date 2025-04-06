/**
 * ThreeCore.ts
 * 
 * Core low-level wrapper around the Three.js renderer and scene.
 * This class is responsible for:
 * - Initializing the Three.js renderer and scene
 * - Managing the render loop
 * - Handling window resize events
 * - Basic scene setup
 * 
 * It deliberately has NO knowledge of editor-specific concepts like:
 * - Selection
 * - Entities
 * - Gizmos
 * - UI integration
 * 
 * This separation allows the core Three.js functionality to be
 * completely decoupled from the editor business logic.
 */
import * as THREE from 'three';

/**
 * Core Three.js engine that's completely decoupled from React
 */
export class ThreeCore {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private canvas: HTMLCanvasElement;
  private clock: THREE.Clock;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    
    // Initialize renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Initialize scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);
    
    // Initialize clock for animations
    this.clock = new THREE.Clock();
    
    // Set up render loop
    this._startRenderLoop();
    
    // Handle resize
    window.addEventListener('resize', () => this._handleResize());
    
    // Initialize scene
    this._setupScene();
  }
  
  public getScene(): THREE.Scene {
    return this.scene;
  }

  public getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }
  
  // Other core methods
  private _startRenderLoop(): void {
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Update and render
      const delta = this.clock.getDelta();
      // This will be called by camera manager later
      this.renderer.render(this.scene, new THREE.PerspectiveCamera()); //TODO: This is a placeholder, camera will be managed by CameraManager
    };
    
    animate();
  }
  
  private _handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Update renderer
    this.renderer.setSize(width, height);
    
    // Camera aspect ratio will be handled by the camera manager
  }
  
  private _setupScene(): void {
    // Basic scene setup (add ambient light for basic visibility)
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(ambientLight);
  }
  
  public dispose(): void {
    // Clean up Three.js resources
    this.renderer.dispose();
    
    // Clean up event listeners
    window.removeEventListener('resize', () => this._handleResize());
  }
} 
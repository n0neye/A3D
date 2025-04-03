/**
 * BabylonCore.ts
 * 
 * Core low-level wrapper around the Babylon.js engine and scene.
 * This class is responsible for:
 * - Initializing the Babylon engine and scene
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
 * This separation allows the core Babylon functionality to be
 * completely decoupled from the editor business logic.
 */
import * as BABYLON from '@babylonjs/core';

/**
 * Core Babylon engine that's completely decoupled from React
 */
export class BabylonCore {
  private engine: BABYLON.Engine;
  private scene: BABYLON.Scene;
  private canvas: HTMLCanvasElement;
  
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.engine = new BABYLON.Engine(canvas, true);
    this.scene = new BABYLON.Scene(this.engine);
    
    // Set up render loop
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
    
    // Handle resize
    window.addEventListener('resize', () => this.engine.resize());
    
    // Initialize scene
    this._setupScene();
    
  }
  
  public getScene(): BABYLON.Scene {
    return this.scene;
  }

  public getEngine(): BABYLON.Engine {
    return this.engine;
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }
  
  // Other core methods
  
  private _setupScene(): void {
    // Basic scene setup
  }
  
  public dispose(): void {
    this.engine.dispose();
  }
} 
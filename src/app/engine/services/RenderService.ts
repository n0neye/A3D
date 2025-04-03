/**
 * RenderService.ts
 * 
 * Responsible for all rendering operations in the 3D editor.
 * This service encapsulates functionality for:
 * - Taking screenshots and framed captures
 * - Handling depth maps and rendering
 * - Managing gizmo visibility during renders
 * - Image processing for render outputs
 * 
 * By moving these concerns out of React components, we maintain
 * a clear separation between the 3D engine and the UI layer.
 */
import * as BABYLON from '@babylonjs/core';
import { EnableDepthRender, TakeFramedScreenshot } from '../../util/generation/render-util';
import { resizeImage, addNoiseToImage, dataURLtoBlob } from '../../util/generation/image-processing';
import { EventEmitter } from '../utils/EventEmitter';

export class RenderService {
  private scene: BABYLON.Scene;
  private babylonEngine: BABYLON.Engine;
  public events: EventEmitter = new EventEmitter();

  constructor(scene: BABYLON.Scene, babylonEngine: BABYLON.Engine) {
    this.scene = scene;
    this.babylonEngine = babylonEngine;
  }

  /**
   * Takes a screenshot of the current scene with framing
   */
  public async takeFramedScreenshot(): Promise<string | null> {
    return await TakeFramedScreenshot(this.scene, this.babylonEngine);
  }

  /**
   * Enables depth rendering and returns a depth image
   */
  public async enableDepthRender(seconds: number = 1): Promise<string | null> {
    // Create a depth renderer
    const depthImage = await EnableDepthRender(this.scene, this.babylonEngine, seconds);
    
    return depthImage;
  }

  /**
   * Gets a depth map from the scene
   */
  public async getDepthMap(): Promise<{ imageUrl: string }> {
    // Move GetDepthMap implementation here
    // Implementation depends on your current GetDepthMap function
    const dataURL = await this.enableDepthRender(1);
    if (!dataURL) throw new Error("Failed to generate depth map");
    return { imageUrl: dataURL };
  }

  /**
   * Controls visibility of all gizmos (temporary during rendering)
   */
  public setAllGizmoVisibility(visible: boolean): void {
    // Implement gizmo visibility control
    // Move the logic from setAllGizmoVisibility function
    
    // Get all entities with gizmos
    const entities = this.scene.rootNodes.filter(
      node => node instanceof BABYLON.TransformNode && node.metadata?.gizmoCapabilities
    );
    
    // Toggle visibility
    entities.forEach(entity => {
      if (entity.metadata?.gizmoMesh) {
        entity.metadata.gizmoMesh.isVisible = visible;
      }
    });
    
    // Handle any other gizmo elements that need visibility control
    // This depends on how gizmos are implemented in your system
  }

  /**
   * Process an image by adding noise
   */
  public async addNoiseToImage(imageUrl: string, noiseStrength: number): Promise<string> {
    return await addNoiseToImage(imageUrl, noiseStrength);
  }

  /**
   * Resize an image to specified dimensions
   */
  public async resizeImage(imageUrl: string, width: number, height: number): Promise<string> {
    return await resizeImage(imageUrl, width, height);
  }

  /**
   * Convert a data URL to a Blob for API calls
   */
  public dataURLtoBlob(dataURL: string): Blob {
    return dataURLtoBlob(dataURL);
  }
} 
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
import { normalizeDepthMap } from '../../util/generation/render-util';
import { resizeImage, addNoiseToImage, dataURLtoBlob, cropImageToRatioFrame } from '../../util/generation/image-processing';
import { EditorEngine } from '../EditorEngine';
import { EntityBase } from '../entity/EntityBase';
import { LightEntity } from '../entity/LightEntity';

export class RenderService {
    private scene: BABYLON.Scene;
    private engine: EditorEngine;
    private babylonEngine: BABYLON.Engine;

    constructor(scene: BABYLON.Scene, engine: EditorEngine, babylonEngine: BABYLON.Engine) {
        this.scene = scene;
        this.engine = engine;
        this.babylonEngine = babylonEngine;
    }

    /**
     * Takes a screenshot of the current scene with framing
     */
    public async takeFramedScreenshot(): Promise<string | null> {
        const maxSize = 1024;
        try {
            if (!this.scene || !this.engine) return null;
            const babylonEngine = this.babylonEngine;

            // Get standard screenshot
            const screenshot = await BABYLON.Tools.CreateScreenshotAsync(
                babylonEngine,
                this.scene.activeCamera as BABYLON.Camera,
                { precision: 1 }
            );

            // Check if we have an active ratio overlay
            const cameraManager = this.engine.getCameraManager();
            const ratioDimensions = cameraManager.getRatioOverlayDimensions();

            if (ratioDimensions) {
                // Crop to the ratio overlay
                const { imageUrl, width, height } = await cropImageToRatioFrame(screenshot, ratioDimensions);
                // Resize the screenshot if it's too large
                if (width > maxSize || height > maxSize) {
                    const resized = await resizeImage(imageUrl, maxSize, maxSize);
                    return resized;
                }
                return imageUrl;
            }

            // Return the uncropped screenshot if no overlay
            return screenshot;
        } catch (error) {
            console.error("Error taking screenshot:", error);
            return null;
        }

    }

    /**
     * Enables depth rendering and returns a depth image
     */
    public async enableDepthRender(seconds: number = 1): Promise<string | null> {
        const scene = this.scene;
        try {
            if (!scene.activeCamera) throw new Error("Active camera not found");

            // Enable depth renderer with better settings
            const depthRenderer = scene.enableDepthRenderer(
                scene.activeCamera,
                false,  // Don't colorize
                true,   // Use logarithmic depth buffer for better precision
                BABYLON.Engine.TEXTURE_NEAREST_LINEAR_MIPLINEAR,
            );

            // Adjust camera clip planes for better depth resolution
            // scene.activeCamera.minZ = 0.1;
            // scene.activeCamera.maxZ = 20.0;

            // Force a render to update the depth values
            scene.render();

            // Create an improved shader with better normalization
            BABYLON.Effect.ShadersStore['improvedDepthPixelShader'] = `
            varying vec2 vUV;
            uniform sampler2D textureSampler;
            uniform float near;
            uniform float far;
            
            void main(void) {
              // Get raw depth value
              float depth = texture2D(textureSampler, vUV).r;
              
              // Ensure depth is in valid range
              depth = clamp(depth, 0.0, 1.0);
              
              // Use a power function with more aggressive scaling for better visibility
              // depth = pow(depth, 0.45);
              
              // Invert for better visualization (closer is brighter)
              float displayDepth = 1.0 - depth;
              
              // Ensure final output is strictly in 0-1 range
              displayDepth = clamp(displayDepth, 0.0, 1.0);
              
              gl_FragColor = vec4(displayDepth, displayDepth, displayDepth, 1.0);
            }
          `;

            // Create the post process with our improved shader
            const postProcess = new BABYLON.PostProcess(
                "depthVisualizer",
                "improvedDepth",
                ["near", "far"],  // Added uniforms for near/far planes
                null,
                1.0,
                scene.activeCamera
            );

            // Set up the shader parameters and texture
            postProcess.onApply = (effect) => {
                effect.setTexture("textureSampler", depthRenderer.getDepthMap());
                effect.setFloat("near", scene.activeCamera!.minZ);
                effect.setFloat("far", scene.activeCamera!.maxZ);
            };

            //   wait for 1 frame
            await new Promise(resolve => setTimeout(resolve, 1));

            const depthSnapshot = await this.takeFramedScreenshot();

            // Normalize the depth map
            const normalizedDepthSnapshot = await normalizeDepthMap(depthSnapshot || '');

            setTimeout(() => {
                // Detach depth renderer
                if (scene.activeCamera && postProcess) {
                    scene.activeCamera.detachPostProcess(postProcess);
                    postProcess.dispose();
                }
            }, seconds * 1000);

            // Return the normalized depth map
            return normalizedDepthSnapshot;
        } catch (error) {
            console.error("Error generating depth map:", error);
            return null;
        }
    };


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

        // Hide/show light entity gizmos
        const lightEntities = this.scene.rootNodes.filter(node => node instanceof EntityBase && LightEntity.isLightEntity(node));

        lightEntities.forEach(entity => {
            // You'll need to add a visualMesh to LightEntity or update this logic
            if (entity.gizmoMesh) {
                entity.gizmoMesh.isVisible = visible;
            }
        });

        // Hide/show world grid
        const environmentObjects = this.engine.getEnvironmentManager().getEnvObjects();
        const worldGrid = environmentObjects.grid;
        if (worldGrid) {
            worldGrid.isVisible = visible;
        }
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
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
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { normalizeDepthMap } from '../../util/generation/render-util';
import { resizeImage, addNoiseToImage, dataURLtoBlob, cropImageToRatioFrame } from '../../util/generation/image-processing';
import { EditorEngine } from '../EditorEngine';
import { EntityBase } from '../entity/EntityBase';
import { LightEntity } from '../entity/LightEntity';

export class RenderService {
    private scene: THREE.Scene;
    private engine: EditorEngine;
    private renderer: THREE.WebGLRenderer;
    private composer: EffectComposer | null = null;
    private originalRenderTarget: THREE.WebGLRenderTarget | null = null;

    constructor(scene: THREE.Scene, engine: EditorEngine, renderer: THREE.WebGLRenderer) {
        this.scene = scene;
        this.engine = engine;
        this.renderer = renderer;
    }

    /**
     * Takes a screenshot of the current scene with framing
     */
    public async takeFramedScreenshot(): Promise<string | null> {
        const maxSize = 1024;
        try {
            if (!this.scene || !this.engine) return null;
            
            // Get camera
            const camera = this.engine.getCameraManager().getCamera();
            
            // Render the scene
            this.renderer.render(this.scene, camera);
            
            // Get the canvas data as base64 image
            const screenshot = this.renderer.domElement.toDataURL('image/png');

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
        try {
            const camera = this.engine.getCameraManager().getCamera();
            
            // Save original renderer state
            const originalClearColor = this.renderer.getClearColor(new THREE.Color());
            const originalClearAlpha = this.renderer.getClearAlpha();
            const originalAutoClear = this.renderer.autoClear;
            
            // Create a render target for depth rendering
            const renderTarget = new THREE.WebGLRenderTarget(
                this.renderer.domElement.width,
                this.renderer.domElement.height
            );
            this.originalRenderTarget = renderTarget;
            
            // Create depth material for all objects
            const depthMaterial = new THREE.MeshDepthMaterial({
                depthPacking: THREE.RGBADepthPacking,
                side: THREE.DoubleSide
            });
            
            // Store original materials
            const originalMaterials = new Map<THREE.Object3D, THREE.Material | THREE.Material[]>();
            
            // Replace all materials with depth material
            this.scene.traverse(object => {
                if (object instanceof THREE.Mesh) {
                    originalMaterials.set(object, object.material);
                    object.material = depthMaterial;
                }
            });
            
            // Render to target
            this.renderer.setRenderTarget(renderTarget);
            this.renderer.setClearColor(0xffffff);
            this.renderer.setClearAlpha(1.0);
            this.renderer.clear();
            this.renderer.render(this.scene, camera);
            
            // Read pixels from render target
            const width = renderTarget.width;
            const height = renderTarget.height;
            const buffer = new Uint8Array(width * height * 4);
            this.renderer.readRenderTargetPixels(renderTarget, 0, 0, width, height, buffer);
            
            // Create canvas to convert depth data to image
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d')!;
            const imageData = context.createImageData(width, height);
            
            // Convert depth data to grayscale image
            // Note: We invert the depth values so closer objects are brighter
            for (let i = 0; i < buffer.length; i += 4) {
                const r = buffer[i];
                const g = buffer[i + 1];
                const b = buffer[i + 2];
                
                // Calculate depth from RGB components (depends on your depth packing)
                // For RGBADepthPacking, you may need a more complex formula
                const depth = (r + g + b) / 3;
                
                // Invert - closer objects are brighter
                const invertedDepth = 255 - depth;
                
                imageData.data[i] = invertedDepth;
                imageData.data[i + 1] = invertedDepth;
                imageData.data[i + 2] = invertedDepth;
                imageData.data[i + 3] = 255; // Full alpha
            }
            
            // Put the image data on the canvas
            context.putImageData(imageData, 0, 0);
            
            // Convert canvas to data URL
            const depthSnapshot = canvas.toDataURL('image/png');
            
            // Normalize the depth map
            const normalizedDepthSnapshot = await normalizeDepthMap(depthSnapshot);
            
            // Restore original materials
            this.scene.traverse(object => {
                if (object instanceof THREE.Mesh && originalMaterials.has(object)) {
                    object.material = originalMaterials.get(object)!;
                }
            });
            
            // Restore original renderer state
            this.renderer.setRenderTarget(null);
            this.renderer.setClearColor(originalClearColor, originalClearAlpha);
            this.renderer.autoClear = originalAutoClear;
            
            // Cleanup
            renderTarget.dispose();
            depthMaterial.dispose();
            
            // Return the normalized depth map
            return normalizedDepthSnapshot;
        } catch (error) {
            console.error("Error generating depth map:", error);
            return null;
        }
    }

    /**
     * Gets a depth map from the scene
     */
    public async getDepthMap(): Promise<{ imageUrl: string }> {
        const dataURL = await this.enableDepthRender(1);
        if (!dataURL) throw new Error("Failed to generate depth map");
        return { imageUrl: dataURL };
    }

    /**
     * Controls visibility of all gizmos (temporary during rendering)
     */
    public setAllGizmoVisibility(visible: boolean): void {
        // Hide/show light entity gizmos
        this.scene.traverse(node => {
            if (node instanceof EntityBase && node instanceof LightEntity) {
                // Find and set visibility for light gizmos or helpers
                const helpers = node.getObjectsByProperty('isHelper', true);
                if (helpers) {
                    helpers.forEach(helper => {
                        helper.visible = visible;
                    });
                }
            }
        });

        // Hide/show transform controls
        const transformControls = this.engine.getTransformControlManager().getTransformControls();
        if (transformControls) {
            // @ts-ignore
            transformControls.visible = visible;
        }

        // Hide/show world grid
        const environmentObjects = this.engine.getEnvironmentManager().getEnvObjects();
        const worldGrid = environmentObjects.grid;
        if (worldGrid) {
            worldGrid.visible = visible;
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
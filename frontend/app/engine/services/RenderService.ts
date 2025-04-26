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
import { normalizeDepthMap } from '@/engine/utils/generation/image-processing';
import { EditorEngine } from '@/engine/core/EditorEngine';
import { EntityBase } from '@/engine/entity/base/EntityBase';
import { resizeImage, addNoiseToImage, dataURLtoBlob, cropImageToRatioFrame } from '@/engine/utils/generation/image-processing';
import { API_Info, ImageToImageResult, renderImage } from '@/engine/utils/generation/image-render-api';
import { IRenderLog, LoraConfig } from '@/engine/interfaces/rendering';
import { ImageRatio } from '../utils/imageUtil';

interface RenderParams {
    isTest: boolean;
    selectedAPI: API_Info;
    prompt: string;
    promptStrength: number;
    depthStrength?: number;
    noiseStrength: number;
    seed: number;
    selectedLoras: LoraConfig[];
    onPreview: (imageUrl: string) => void;
}


export class RenderService {
    private scene: THREE.Scene;
    private engine: EditorEngine;
    private renderer: THREE.WebGLRenderer;

    constructor(scene: THREE.Scene, engine: EditorEngine, renderer: THREE.WebGLRenderer) {
        this.scene = scene;
        this.engine = engine;
        this.renderer = renderer;
    }

    // Ratio to render size
    public getRenderSize(): { width: number, height: number } {
        const cameraManager = this.engine.getCameraManager();
        const ratio = cameraManager.getRatioOverlayRatio();

        const sizes = {
            "1:1": { width: 1024, height: 1024 },
            "4:3": { width: 1024, height: 768 },
            "3:4": { width: 768, height: 1024 },
            "16:9": { width: 1280, height: 720 },
            "9:16": { width: 1280, height: 720 },
        }
        return sizes[ratio];
    }

    /**
     * Takes a screenshot of the current scene with framing
     */
    public async takeFramedScreenshot(): Promise<string | null> {
        const maxSize = 1024;
        try {
            if (!this.scene || !this.engine) return null;

            // Get camera
            const cameraManager = this.engine.getCameraManager();
            const camera = cameraManager.getCamera();

            // Render the scene
            this.renderer.render(this.scene, camera);

            // Get the canvas data as base64 image
            const screenshot = this.renderer.domElement.toDataURL('image/png');

            // Crop the screenshot by ratio
            const cropped = await this.cropByRatio(screenshot);

            // Return the cropped screenshot
            return cropped;
        } catch (error) {
            console.error("Error taking screenshot:", error);
            return null;
        }
    }

    /**
     * Crop an image by ratio
     */
    async cropByRatio(image: string): Promise<string> {

        const maxSize = 1024;
        const cameraManager = this.engine.getCameraManager();
        const ratioDimensions = cameraManager.getRatioOverlayDimensions();


        if (!ratioDimensions) {
            throw new Error("No ratio dimensions found");
        }
        // Multiply the frame dimensions with pixel ratio to account for high-DPI displays
        const pixelRatio = this.renderer.pixelRatio || window.devicePixelRatio;
        const frame = {
            left: ratioDimensions.frame.left * pixelRatio,
            top: ratioDimensions.frame.top * pixelRatio,
            width: ratioDimensions.frame.width * pixelRatio,
            height: ratioDimensions.frame.height * pixelRatio
        };

        // Crop to the ratio overlay
        const { imageUrl, width, height } = await cropImageToRatioFrame(image, frame);

        // Resize the screenshot if it's too large
        if (width > maxSize || height > maxSize) {
            const resized = await resizeImage(imageUrl, maxSize, maxSize);
            return resized;
        }
        return imageUrl;
    }

    public async Render(params: RenderParams): Promise<{ imageUrl: string | null, executionTimeMs: number }> {
        // Start measuring time
        const startTime = Date.now();

        // Hide gizmos before rendering
        this.engine.getSelectionManager().deselectAll();
        this.setAllGizmoVisibility(false);

        // First, take a screenshot of the current scene
        const screenshot = await this.takeFramedScreenshot();
        if (!screenshot) throw new Error("Failed to take screenshot");

        if (screenshot) {
            params.onPreview(screenshot);
        }

        // Store the original screenshot
        //   setImageUrl(screenshot);

        // Apply noise to the screenshot if noiseStrength > 0
        let processedImage = screenshot;
        if (params.noiseStrength > 0) {
            processedImage = await this.addNoiseToImage(screenshot, params.noiseStrength);
        }

        // Resize the image to final dimensions before sending to API
        const renderSize = this.getRenderSize();
        const resizedImage = await this.resizeImage(processedImage, renderSize.width, renderSize.height);

        // Convert the resized image to blob for API
        const imageBlob = this.dataURLtoBlob(resizedImage);

        // TODO: Over complex, need to refactor
        let depthImage: string | undefined = undefined;
        if (params.selectedAPI.useDepthImage) {
            // Promise to get depth image
            await new Promise(async (resolve) => {
                this.showDepthRenderSeconds(1, async (imageUrl) => {
                    depthImage = imageUrl;
                    if (depthImage) {
                        console.log('Render: depthImage', depthImage);
                        depthImage = await this.cropByRatio(depthImage);
                        params.onPreview(depthImage);
                    }
                    resolve(null);
                });
            });
        }

        // Log pre-processing time
        const preProcessingTime = Date.now();
        console.log(`%cPre-processing time: ${(preProcessingTime - startTime) / 1000} seconds`, "color: #4CAF50; font-weight: bold;");

        // Restore gizmos after getting the screenshot
        this.setAllGizmoVisibility(true);

        if (params.isTest) {
            return {
                imageUrl: null,
                executionTimeMs: Date.now() - startTime
            };
        }

        
        console.log('Render: call api');
        // Call the API with the selected model and seed
        const result = await renderImage({
            imageUrl: imageBlob,
            prompt: params.prompt,
            promptStrength: params.promptStrength,
            modelApiInfo: params.selectedAPI,
            seed: params.seed,
            width: renderSize.width,
            height: renderSize.height,
            // Optional
            loras: params.selectedLoras,
            depthImageUrl: depthImage,
            depthStrength: params.selectedAPI.useDepthImage ? params.depthStrength : 0,
        });

        this.addRenderLog(result, params);

        return {
            imageUrl: result.imageUrl,
            executionTimeMs: Date.now() - startTime
        };
    }

    addRenderLog(result: ImageToImageResult, params: RenderParams) {
        // Add render log
        const renderLog: IRenderLog = {
            timestamp: new Date(),
            imageUrl: result.imageUrl,
            prompt: params.prompt,
            model: params.selectedAPI.name,
            seed: result.seed,
            promptStrength: params.promptStrength,
            depthStrength: params.depthStrength,
            selectedLoras: params.selectedLoras,
        };
        // Add render log to project manager
        EditorEngine.getInstance().getProjectManager().addRenderLog(renderLog, true);
    }

    /**
     * Show the depth map of current camera using standard depth rendering techniques
     * Uses animation loop to ensure proper rendering of depth texture
     */
    public async showDepthRenderSeconds(duration: number = 1, onGetDepthMap?: (imageUrl: string) => void): Promise<void> {
        return new Promise((resolve) => {
            try {
                const { stopDepthRender } = this.startDepthRender(onGetDepthMap);

                // Stop the animation loop and clean up resources after the duration
                setTimeout(() => {
                    stopDepthRender();
                }, duration * 1000);

                resolve();

            } catch (error) {
                console.error("Error generating depth map:", error);
                this.setAllGizmoVisibility(true);
            }
        });
    }

    startDepthRender(onGetDepthMap?: (imageUrl: string) => void) {
        console.log('startDepthRender');
        const camera = this.engine.getCameraManager().getCamera();
        const renderer = this.renderer;
        const scene = this.scene;
        const width = renderer.domElement.width;
        const height = renderer.domElement.height;

        // Hide all gizmos
        this.setAllGizmoVisibility(false);

        // Save original values to restore later
        const originalFar = camera.far;
        const originalRenderTarget = renderer.getRenderTarget();

        // Set up depth rendering target
        const target = new THREE.WebGLRenderTarget(width, height);
        target.texture.minFilter = THREE.NearestFilter;
        target.texture.magFilter = THREE.NearestFilter;
        target.texture.generateMipmaps = false;
        target.depthTexture = new THREE.DepthTexture(width, height);
        target.depthTexture.format = THREE.DepthFormat;
        target.depthTexture.type = THREE.UnsignedShortType;

        // Set up post-processing for depth visualization
        const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const postScene = new THREE.Scene();

        const postMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                        varying vec2 vUv;
                        void main() {
                            vUv = uv;
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
            fragmentShader: `
                        #include <packing>
                        varying vec2 vUv;
                        uniform sampler2D tDiffuse;
                        uniform sampler2D tDepth;
                        uniform float cameraNear;
                        uniform float cameraFar;

                        float readDepth(sampler2D depthSampler, vec2 coord) {
                            float fragCoordZ = texture2D(depthSampler, coord).x;
                            float viewZ = perspectiveDepthToViewZ(fragCoordZ, cameraNear, cameraFar);
                            return viewZToOrthographicDepth(viewZ, cameraNear, cameraFar);
                        }

                        void main() {
                            float depth = readDepth(tDepth, vUv);
                            gl_FragColor.rgb = 1.0 - vec3(depth);
                            gl_FragColor.a = 1.0;
                        }
                    `,
            uniforms: {
                cameraNear: { value: camera.near },
                cameraFar: { value: camera.far },
                tDiffuse: { value: null },
                tDepth: { value: null }
            }
        });

        const postPlane = new THREE.PlaneGeometry(2, 2);
        const postQuad = new THREE.Mesh(postPlane, postMaterial);
        postScene.add(postQuad);


        const renderDepth = () => {
            // 1. Render scene into target
            renderer.setRenderTarget(target);
            renderer.render(scene, camera);

            // 2. Render post-processing with depth visualization  
            postMaterial.uniforms.tDiffuse.value = target.texture;
            postMaterial.uniforms.tDepth.value = target.depthTexture;
            renderer.setRenderTarget(null);
            renderer.render(postScene, postCamera);

            if (onGetDepthMap) {
                console.log('startDepthRender: onGetDepthMap');
                const depthSnapshot = renderer.domElement.toDataURL('image/png');
                onGetDepthMap(depthSnapshot);
            }
        };

        // Start our animation loop
        renderer.setAnimationLoop(renderDepth);

        const stopDepthRender = () => {

            renderer.setAnimationLoop(null);

            // Restore original render target and camera
            renderer.setRenderTarget(originalRenderTarget);
            camera.far = originalFar;
            camera.updateProjectionMatrix();

            // Restore original scene
            renderer.render(scene, camera);

            // Show gizmos again
            this.setAllGizmoVisibility(true);

            // Clean up resources
            target.dispose();
            if (target.depthTexture) {
                target.depthTexture.dispose();
            }
            postMaterial.dispose();
            postPlane.dispose();
        }

        return { stopDepthRender, renderer, postScene, postCamera };
    }


    /**
     * Gets a depth map from the scene
     */
    public async getDepthMap(): Promise<{ imageUrl: string }> {
        let depthImage: string | null = null;
        await new Promise((resolve) => {
            this.showDepthRenderSeconds(1, (imageUrl) => {
                depthImage = imageUrl;
                resolve(null);
            });
        });
        if (!depthImage) throw new Error("Failed to generate depth map");
        return { imageUrl: depthImage };
    }

    /**
     * Controls visibility of all gizmos (temporary during rendering)
     */
    public setAllGizmoVisibility(visible: boolean): void {
        // Hide/show light entity gizmos
        this.scene.traverse(node => {
            if (node instanceof EntityBase) {
                node.setGizmoVisible(visible);
            }
            // if is helper, set visible
            if (node.userData?.isHelper) {
                node.visible = visible;
            }
        });


        // const helpers = this.scene.getObjectsByProperty('isHelper', true);
        // if (helpers) {
        //     helpers.forEach(helper => {
        //         helper.visible = visible;
        //     });
        // }

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
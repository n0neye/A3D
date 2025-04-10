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
import { normalizeDepthMap } from '@/app/engine/utils/generation/image-processing';
import { EditorEngine } from '@/app/engine/core/EditorEngine';
import { EntityBase } from '@/app/engine/entity/base/EntityBase';
import { resizeImage, addNoiseToImage, dataURLtoBlob, cropImageToRatioFrame } from '@/app/engine/utils/generation/image-processing';
import { API_Info, ImageToImageResult, renderImage } from '@/app/engine/utils/generation/image-render-api';
import { IRenderLog, LoraConfig } from '@/app/engine/interfaces/rendering';

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
        const resizedImage = await this.resizeImage(processedImage, 1280, 720);

        // Convert the resized image to blob for API
        const imageBlob = this.dataURLtoBlob(resizedImage);

        let depthImage: string | undefined = undefined;
        if (params.selectedAPI.useDepthImage) {
            depthImage = await this.showDepthRenderSeconds(1) || undefined;
            if (depthImage) {
                depthImage = await this.cropByRatio(depthImage);
                params.onPreview(depthImage);
            }
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

        // Call the API with the selected model and seed
        const result = await renderImage({
            imageUrl: imageBlob,
            prompt: params.prompt,
            promptStrength: params.promptStrength,
            modelApiInfo: params.selectedAPI,
            seed: params.seed,
            width: 1280,
            height: 720,
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
     * Show the depth map of current camera using EffectComposer
     * Returns the depth image and restores original state after given seconds
     */
    public async showDepthRenderSeconds(seconds: number = 1, onGetDepthMap?: (imageUrl: string) => void): Promise<string | null> {
        try {
            const camera = this.engine.getCameraManager().getCamera();
            const renderer = this.renderer;
            const scene = this.scene;

            // Hide all gizmos
            this.setAllGizmoVisibility(false);

            // Calculate optimal far value for better depth precision
            const optimalFar = this.calculateOptimalFar(camera);
            console.log(`Original camera far: ${camera.far}, Calculated optimal far: ${optimalFar}`);

            // Save original values to restore later
            const originalFar = camera.far;
            const originalComposer = this.composer;
            const originalRenderTarget = renderer.getRenderTarget();

            // Temporarily set the camera's far plane to our optimal value
            camera.far = optimalFar;
            camera.updateProjectionMatrix();

            // Create a render target for the depth effect
            const renderTarget = new THREE.WebGLRenderTarget(
                renderer.domElement.width,
                renderer.domElement.height,
                {
                    minFilter: THREE.NearestFilter,
                    magFilter: THREE.NearestFilter,
                    format: THREE.RGBAFormat,
                    generateMipmaps: false
                }
            );
            renderTarget.depthTexture = new THREE.DepthTexture(renderer.domElement.width, renderer.domElement.height);
            renderTarget.depthTexture.format = THREE.DepthFormat;
            renderTarget.depthTexture.type = THREE.UnsignedShortType;

            // Create an EffectComposer for post-processing
            const composer = new EffectComposer(renderer, renderTarget);

            // Add a render pass to render the scene
            const renderPass = new RenderPass(scene, camera);
            composer.addPass(renderPass);

            // Create a custom shader pass for depth visualization
            const depthShader = {
                uniforms: {
                    tDiffuse: { value: null },
                    tDepth: { value: null },
                    cameraNear: { value: camera.near },
                    cameraFar: { value: optimalFar }
                },
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
                `
            };

            // Create ShaderPass with our depth shader
            const depthPass = new ShaderPass(depthShader);
            depthPass.uniforms.tDepth.value = renderTarget.depthTexture;
            depthPass.renderToScreen = true;
            composer.addPass(depthPass);

            // Store the composer
            this.composer = composer;

            // Render with the composer
            composer.render();

            // Capture the depth visualization
            const depthSnapshot = renderer.domElement.toDataURL('image/png');
            if (onGetDepthMap) {
                onGetDepthMap(depthSnapshot);
            }

            // Set a timeout to restore original state
            setTimeout(() => {
                const depthSnapshot = renderer.domElement.toDataURL('image/png');
                if (onGetDepthMap) {
                    onGetDepthMap(depthSnapshot);
                }

                // Restore original render target
                renderer.setRenderTarget(originalRenderTarget);

                // Restore camera far value
                camera.far = originalFar;
                camera.updateProjectionMatrix();

                // Restore original composer
                this.composer = originalComposer;

                // Render the scene again with original settings
                if (this.composer) {
                    this.composer.render();
                } else {
                    renderer.render(scene, camera);
                }

                // Show gizmos again
                this.setAllGizmoVisibility(true);

                // Cleanup
                renderTarget.dispose();
            }, seconds * 1000);

            // Normalize the depth map if we got one
            if (depthSnapshot) {
                return await normalizeDepthMap(depthSnapshot);
            }

            return null;
        } catch (error) {
            console.error("Error generating depth map:", error);
            return null;
        }
    }


    calculateOptimalFar(camera: THREE.PerspectiveCamera): number {
        // Calculate optimal far value by finding the farthest visible vertex
        let maxDistance = 0;
        const cameraPosition = camera.position.clone();
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);

        // Traverse all visible meshes to find maximum distance
        const selectableObjects = this.engine.getInputManager().getSelectableObjects();
        selectableObjects.forEach((selectableObject) => {
            // get all meshes from the selectable object
            const meshes = selectableObject.children.filter((child) => child instanceof THREE.Mesh);
            meshes.forEach((mesh) => {
                if (mesh.geometry.boundingSphere === null) {
                    mesh.geometry.computeBoundingSphere();
                }
                if (mesh.geometry.boundingSphere) {
                    // Get world position of the bounding sphere center
                    const center = mesh.geometry.boundingSphere.center.clone();
                    const radius = mesh.geometry.boundingSphere.radius;
                    mesh.localToWorld(center);

                    // Calculate distance from camera to the farthest point of the bounding sphere
                    const direction = center.clone().sub(cameraPosition);
                    const distance = direction.length() + radius;

                    // Check if this object is in front of the camera (dot product with camera direction > 0)
                    if (direction.normalize().dot(cameraDirection) > 0 && distance > maxDistance) {
                        maxDistance = distance;
                    }
                }
            });
        });

        // Add a small margin to ensure we capture everything
        const optimalFar = Math.max(maxDistance * 1.1, camera.near * 100);
        return optimalFar;
    }

    /**
     * Gets a depth map from the scene
     */
    public async getDepthMap(): Promise<{ imageUrl: string }> {
        const dataURL = await this.showDepthRenderSeconds(1);
        if (!dataURL) throw new Error("Failed to generate depth map");
        return { imageUrl: dataURL };
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
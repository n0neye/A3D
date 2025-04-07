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
            const cameraManager = this.engine.getCameraManager();
            const camera = cameraManager.getCamera();

            // Render the scene
            this.renderer.render(this.scene, camera);

            // Get the canvas data as base64 image
            const screenshot = this.renderer.domElement.toDataURL('image/png');

            // Check if we have an active ratio overlay
            const ratioDimensions = cameraManager.getRatioOverlayDimensions();


            if (ratioDimensions) {
                // Multiply the frame dimensions with pixel ratio to account for high-DPI displays
                const pixelRatio = this.renderer.pixelRatio || window.devicePixelRatio;
                const frame = {
                    left: ratioDimensions.frame.left * pixelRatio,
                    top: ratioDimensions.frame.top * pixelRatio,
                    width: ratioDimensions.frame.width * pixelRatio,
                    height: ratioDimensions.frame.height * pixelRatio
                };

                // Crop to the ratio overlay
                const { imageUrl, width, height } = await cropImageToRatioFrame(screenshot, frame);

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
     * Show the depth map of current camera, apply to post processing, return the image, and restore original state after given seconds
     */
    public async enableDepthRender(seconds: number = 1): Promise<string | null> {
        try {
            const camera = this.engine.getCameraManager().getCamera();
            const renderer = this.renderer;
            const scene = this.scene;

            // Store gizmo visibility state and hide all gizmos
            this.setAllGizmoVisibility(false);

            // Create a render target with depth texture
            const width = renderer.domElement.width;
            const height = renderer.domElement.height;
            const renderTarget = new THREE.WebGLRenderTarget(width, height);
            renderTarget.texture.minFilter = THREE.NearestFilter;
            renderTarget.texture.magFilter = THREE.NearestFilter;
            renderTarget.texture.generateMipmaps = false;
            renderTarget.depthTexture = new THREE.DepthTexture(width, height);
            renderTarget.depthTexture.format = THREE.DepthFormat;
            renderTarget.depthTexture.type = THREE.UnsignedShortType;

            // Create post-processing for depth visualization
            const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
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
                    tDepth: { value: null }
                }
            });

            const postScene = new THREE.Scene();
            const postQuad = new THREE.Mesh(
                new THREE.PlaneGeometry(2, 2),
                postMaterial
            );
            postScene.add(postQuad);

            // Save original render target
            const originalRenderTarget = renderer.getRenderTarget();
            
            // Render scene to target with depth texture
            renderer.setRenderTarget(renderTarget);
            renderer.render(scene, camera);
            
            // Process depth texture
            postMaterial.uniforms.tDepth.value = renderTarget.depthTexture;
            
            // Render depth visualization to canvas
            renderer.setRenderTarget(null);
            renderer.render(postScene, postCamera);
            
            // Create a temporary canvas to store the result
            const canvas = renderer.domElement;

            // Convert canvas to data URL
            const depthSnapshot = canvas.toDataURL('image/png');

            // Schedule restoration of original state
            setTimeout(() => {
                // Restore render target
                renderer.setRenderTarget(originalRenderTarget);
                
                // Restore scene with original camera
                renderer.render(scene, camera);
                
                // Show gizmos again
                this.setAllGizmoVisibility(true);
                
                // Clean up
                renderTarget.dispose();
            }, seconds * 1000);

            // Normalize the depth map
            const normalizedDepthSnapshot = await normalizeDepthMap(depthSnapshot);

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
            if (node instanceof EntityBase ) {
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
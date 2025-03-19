import { fal } from "@fal-ai/client";
import * as BABYLON from '@babylonjs/core';
import "@babylonjs/loaders/glTF";
import { get3DSimulationData, getImageSimulationData, isSimulating } from "./simulation-data";
import { IMAGE_SIZE_MAP, RATIO_MAP, ImageRatio, ImageSize, EntityNode, AiObjectType, EntityType, applyImageToEntity } from './extensions/entityNode';
// Types for callbacks and results
export interface GenerationProgress {
    message: string;
    progress?: number;
}

export interface Generation2DRealtimResult {
    success: boolean;
    imageUrl?: string;
    error?: string;
}

export interface PromptProps {
    prompt: string;
    negative_prompt?: string;
    width?: number;
    height?: number;
}


export type ProgressCallback = (progress: GenerationProgress) => void;

// Singleton connection manager - updated to use a queue system
class RealtimeConnectionManager {
    private static instance: RealtimeConnectionManager;
    private connection: any = null;
    private isConnected: boolean = false;
    private isProcessing: boolean = false;

    // Queue system for handling requests one at a time
    private requestQueue: Array<{
        props: PromptProps,
        onProgress?: ProgressCallback,
        resolve: (result: Generation2DRealtimResult) => void
    }> = [];

    // Add a timeStart property to track generation start time
    private currentRequest: {
        resolve: (result: Generation2DRealtimResult) => void,
        onProgress?: ProgressCallback,
        timeStart?: number
    } | null = null;

    private constructor() { }

    public static getInstance(): RealtimeConnectionManager {
        if (!RealtimeConnectionManager.instance) {
            RealtimeConnectionManager.instance = new RealtimeConnectionManager();
        }
        return RealtimeConnectionManager.instance;
    }

    public initialize() {
        if (this.connection) return;

        console.log("Initializing WebSocket connection to FAL AI...");

        try {
            this.connection = fal.realtime.connect("fal-ai/fast-lcm-diffusion", {
                onResult: (result) => {
                    console.log("Received result:", result);

                    // Process the current request
                    if (this.currentRequest) {
                        // Calculate elapsed time if we have a start time
                        if (this.currentRequest.timeStart) {
                            const elapsedTime = performance.now() - this.currentRequest.timeStart;
                            const seconds = (elapsedTime / 1000).toFixed(2);
                            console.log("%cGeneration completed in " + seconds + " seconds", "color: #4CAF50; font-weight: bold;");
                        }

                        // Check if result has images array with at least one item
                        if (result && result.images && Array.isArray(result.images) && result.images.length > 0) {
                            try {
                                let imageUrl;
                                const imageData = result.images[0];

                                // Handle binary content (Uint8Array)
                                if (imageData.content && imageData.content instanceof Uint8Array) {
                                    // Convert Uint8Array to Blob
                                    // const blob = new Blob([imageData.content], { type: 'image/png' });

                                    // // Create a URL for the blob
                                    // imageUrl = URL.createObjectURL(blob);
                                    // console.log("Created blob URL from binary data:", imageUrl);

                                    // Convert to base64
                                    imageUrl = Buffer.from(imageData.content).toString('base64');
                                    imageUrl = `data:image/png;base64,${imageUrl}`;
                                }
                                // Handle URL if provided directly
                                else if (imageData.url) {
                                    imageUrl = imageData.url;
                                }

                                if (imageUrl) {
                                    this.currentRequest.resolve({
                                        success: true,
                                        imageUrl: imageUrl
                                    });
                                } else {
                                    throw new Error("No valid image data found");
                                }
                            } catch (error) {
                                console.error("Error processing image data:", error);
                                this.currentRequest.resolve({
                                    success: false,
                                    error: "Failed to process image data"
                                });
                            }
                        } else {
                            this.currentRequest.resolve({
                                success: false,
                                error: 'No images generated'
                            });
                        }

                        // Clear current request
                        this.currentRequest = null;
                        this.isProcessing = false;

                        // Process next request in queue if any
                        this.processNextRequest();
                    }
                },
                onError: (error) => {
                    console.error("WebSocket error:", error);

                    // Resolve current request with error
                    if (this.currentRequest) {
                        this.currentRequest.resolve({
                            success: false,
                            error: error instanceof Error ? error.message : 'WebSocket connection error'
                        });

                        // Clear current request
                        this.currentRequest = null;
                        this.isProcessing = false;
                    }

                    // Reconnect
                    this.connection = null;
                    this.isConnected = false;
                    this.initialize();

                    // Process next request after reconnecting
                    setTimeout(() => this.processNextRequest(), 1000);
                }
            });

            // Assume connection is successful immediately after creation
            this.isConnected = true;
            console.log("WebSocket connection created");

            // Try to process any queued requests
            setTimeout(() => this.processNextRequest(), 500);

        } catch (error) {
            console.error("Failed to initialize WebSocket connection:", error);
            this.connection = null;
            this.isConnected = false;
        }
    }

    private processNextRequest() {
        // If already processing or no requests in queue, return
        if (this.isProcessing || this.requestQueue.length === 0 || !this.isConnected) {
            return;
        }

        // Get next request from queue
        const nextRequest = this.requestQueue.shift();
        if (!nextRequest) return;

        // Set as current request with start time
        this.currentRequest = {
            resolve: nextRequest.resolve,
            onProgress: nextRequest.onProgress,
            timeStart: performance.now() // Store the start time
        };

        this.isProcessing = true;

        // Notify progress
        this.currentRequest.onProgress?.({ message: 'Sending prompt to AI service...' });


        // Send the request
        try {
            console.log("Sending prompt to AI service:", nextRequest.props);
            const size = nextRequest.props.width && nextRequest.props.height ? { width: nextRequest.props.width, height: nextRequest.props.height } : "square_hd";
            this.connection.send({
                prompt: nextRequest.props.prompt,
                negative_prompt: nextRequest.props.negative_prompt || "cropped, out of frame",
                image_size: size,
                sync_mode: false
            });

            this.currentRequest.onProgress?.({ message: 'Processing your request...' });
        } catch (error) {
            console.error("Error sending request:", error);
            this.currentRequest.resolve({
                success: false,
                error: error instanceof Error ? error.message : 'Error sending request'
            });

            this.currentRequest = null;
            this.isProcessing = false;

            // Try next request
            this.processNextRequest();
        }
    }

    public async generateImage(props: PromptProps, onProgress?: ProgressCallback): Promise<Generation2DRealtimResult> {
        // Initialize connection if needed
        if (!this.connection) {
            console.log("No connection, initializing");
            this.initialize();
        }

        // Progress update
        onProgress?.({ message: 'Starting generation...' });

        // Prepare the prompt
        const enhancedPrompt = `${prompt} at the center of the frame, full-body shot, uncropped, 3d render, white light, ambient light, transparent black background, object separate from the background`;

        return new Promise((resolve) => {
            // Add to request queue
            this.requestQueue.push({
                props,
                onProgress,
                resolve
            });

            // Try to process next request
            this.processNextRequest();
        });
    }

    public isInitialized(): boolean {
        return this.connection !== null;
    }
}

// Initialize the connection on module load
export function initializeRealtimeConnection(): void {
    RealtimeConnectionManager.getInstance().initialize();
}

/**
 * Generate an image using the FAL AI API with persistent WebSocket connection
 */
export async function generateRealtimeImage(
    prompt: string,
    entity: EntityNode,
    scene: BABYLON.Scene,
    options: {
        imageSize?: ImageSize;
        negativePrompt?: string;
    } = {}
): Promise<Generation2DRealtimResult> {
    // Use defaults if not provided
    const ratio = '1:1';
    const imageSize = options.imageSize || 'medium';
    const entityType = entity.getEntityType();
    const aiObjectType = entity.getAIData()?.aiObjectType || 'object';
    const negativePrompt = options.negativePrompt || 'cropped, out of frame, blurry, blur';
    // Update entity state
    entity.setProcessingState({
        isGenerating2D: true,
        isGenerating3D: false,
        progressMessage: 'Starting generation...'
    });

    // Determine dimensions
    const ratioMultipliers = RATIO_MAP[ratio];
    const baseSize = IMAGE_SIZE_MAP[imageSize];

    // Calculate width and height
    let width, height;
    if (ratioMultipliers.width > ratioMultipliers.height) {
        width = baseSize;
        height = Math.floor(baseSize * (ratioMultipliers.height / ratioMultipliers.width));
    } else {
        height = baseSize;
        width = Math.floor(baseSize * (ratioMultipliers.width / ratioMultipliers.height));
    }

    // Enhance prompt based on entity type
    let enhancedPrompt = prompt;
    if (aiObjectType === 'object' || entityType === 'aiObject') {
        enhancedPrompt = `${prompt} at the center of the frame, uncropped, solid black background`;
    } else if (aiObjectType === 'background') {
        enhancedPrompt = `expansive panoramic view of ${prompt}`;
    }

    // If the prompt is "_", use the test data
    if (prompt === "_") {
        const testData = getImageSimulationData();
        if (testData.imageUrl) {
            applyImageToEntity(entity, testData.imageUrl, scene);
            entity.addGenerationToHistory(prompt, testData.imageUrl, {
                ratio: '1:1',
                imageSize: 'medium'
            });
            entity.setProcessingState({
                isGenerating2D: false,
                isGenerating3D: false,
                progressMessage: 'Image generated successfully!'
            });
        }
        return testData;
    }

    // Get connection manager and generate the image
    const connectionManager = RealtimeConnectionManager.getInstance();
    const result = await connectionManager.generateImage({
        prompt: enhancedPrompt,
        negative_prompt: negativePrompt,
        width,
        height,
    }, ({ message }: { message: string }) => {
        entity.setProcessingState({
            isGenerating2D: true,
            isGenerating3D: false,
            progressMessage: message
        });
    });

    const success = result.success && result.imageUrl;
    if (success && result.imageUrl) {
        applyImageToEntity(entity, result.imageUrl, scene);

        // Add to history
        entity.addGenerationToHistory(prompt, result.imageUrl, {
            ratio: '1:1',
            imageSize: 'medium'
        });
    }

    entity.setProcessingState({
        isGenerating2D: false,
        isGenerating3D: false,
        progressMessage: success ? 'Image generated successfully!' : 'Failed to generate image'
    });

    return result;

}

/**
 * Generate an image using the FAL AI API with persistent WebSocket connection
 */
export async function generateBackground(
    prompt: string,
    entity: EntityNode,
    scene: BABYLON.Scene,
    options: {
        imageSize?: ImageSize;
        negativePrompt?: string;
    } = {}
): Promise<boolean> {
    // Use defaults if not provided
    const imageSize = options.imageSize || 'medium';
    const entityType = entity.getEntityType();
    const aiObjectType = entity.getAIData()?.aiObjectType || 'object';
    const negativePrompt = options.negativePrompt || 'cropped, out of frame, blurry, blur';
    // Update entity state
    entity.setProcessingState({
        isGenerating2D: true,
        isGenerating3D: false,
        progressMessage: 'Starting generation...'
    });

    const result = await fal.subscribe("fal-ai/flux/dev", {
        input: {
            prompt: prompt,
            image_size: {
                width: 1280,
                height: 720
            }
            // Flux Dev might have different parameters than the other models
            // so we're just using the basic ones for now
        },
        logs: true,
        onQueueUpdate: (update) => {
            if (update.status === "IN_PROGRESS") {
                console.log("Flux generation in progress...");
                update.logs?.map((log) => log.message).forEach(console.log);
            }
        },
    });


    const success = result.data.images.length > 0;
    if (success && result.data.images[0].url) {
        applyImageToEntity(entity, result.data.images[0].url, scene);

        // Add to history
        entity.addGenerationToHistory(prompt, result.data.images[0].url, {
            ratio: '16:9',
            imageSize: 'medium'
        });
    }

    entity.setProcessingState({
        isGenerating2D: false,
        isGenerating3D: false,
        progressMessage: success ? 'Image generated successfully!' : 'Failed to generate image'
    });

    return success;

}
/**
 * Load a 3D model and replace the current mesh
 */
export async function loadModel(
    entity: EntityNode,
    modelUrl: string,
    scene: BABYLON.Scene,
    gizmoManager: BABYLON.GizmoManager | null,
    onProgress?: ProgressCallback
): Promise<boolean> {
    try {
        onProgress?.({ message: 'Downloading 3D model...' });

        // Load the model
        return new Promise((resolve) => {
            BABYLON.SceneLoader.ImportMesh("", modelUrl, "", scene,
                (meshes) => {
                    // If there's an existing model mesh, dispose it
                    if (entity.modelMesh) {
                        entity.modelMesh.dispose();
                        entity.modelMesh = null;
                    }

                    onProgress?.({ message: 'Processing 3D model...' });
                    console.log("replaceWithModel. meshes", meshes);

                    if (meshes.length > 0) {
                        console.log("meshes length", meshes.length);

                        // Create a root container mesh if needed
                        let rootModelMesh: BABYLON.Mesh;

                        if (meshes.length === 1) {
                            rootModelMesh = meshes[0] as BABYLON.Mesh;
                        } else {
                            // Create a dummy mesh as the container
                            rootModelMesh = new BABYLON.Mesh(`${entity.name}-model-root`, scene);

                            meshes.forEach((mesh) => {
                                mesh.parent = rootModelMesh;
                            });
                        }

                        // Parent the root model to the entity
                        rootModelMesh.parent = entity;

                        // Set up the model mesh in the entity
                        entity.modelMesh = rootModelMesh;

                        // Set metadata on all meshes
                        meshes.forEach((mesh) => {
                            mesh.metadata = {
                                ...mesh.metadata,
                                rootEntity: entity
                            };
                        });

                        // Find all materials
                        meshes.forEach((mesh) => {
                            if (mesh.material) {
                                // if PBRMaterial, set emissive 
                                if (mesh.material instanceof BABYLON.PBRMaterial) {
                                    const newPbrMaterial = mesh.material as BABYLON.PBRMaterial;
                                    newPbrMaterial.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5);
                                    newPbrMaterial.emissiveTexture = newPbrMaterial.albedoTexture;
                                    mesh.material = newPbrMaterial;
                                }
                            }
                        });


                        // Switch to 3D display mode
                        entity.setDisplayMode('3d');

                        // Attach gizmo to model
                        if (gizmoManager) {
                            gizmoManager.attachToMesh(rootModelMesh);
                        }

                        onProgress?.({ message: '3D model loaded successfully!' });
                        resolve(true);
                    } else {
                        onProgress?.({ message: 'Failed to load model' });
                        resolve(false);
                    }
                },
                (evt) => {
                    if (evt.lengthComputable) {
                        const progress = (evt.loaded / evt.total * 100).toFixed(0);
                        onProgress?.({ message: `Downloading: ${progress}%` });
                    }
                },
                (_, message) => {
                    onProgress?.({ message: `Error: ${message}` });
                    resolve(false);
                }
            );
        });
    } catch (error) {
        console.error("Failed to replace with model:", error);
        onProgress?.({ message: 'Failed to replace with model' });
        return false;
    }
}

/**
 * Generate a 3D model from an image using the FAL AI Trellis API
 */
export async function generate3DModel(
    imageUrl: string,
    entity: EntityNode,
    scene: BABYLON.Scene,
    gizmoManager: BABYLON.GizmoManager | null,
    options: {
        prompt?: string;
    } = {}
): Promise<{ success: boolean, modelUrl?: string, error?: string }> {
    const entityType = entity.getEntityType();

    try {
        // Process image URL if it's a blob
        let processedImageUrl = imageUrl;
        if (imageUrl.startsWith('blob:')) {
            try {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                processedImageUrl = await blobToBase64(blob);
            } catch (error) {
                return { success: false, error: "Failed to prepare image" };
            }
        }

        // Set parameters based on entity type
        const params: any = {
            image_url: processedImageUrl,
            mesh_simplify: 0.9,
        };

        // Call the API
        entity.setProcessingState({
            isGenerating2D: false,
            isGenerating3D: true,
            progressMessage: 'Starting 3D conversion...'
        });

        const startTime = performance.now();
        if (options.prompt === "_") {
            // Wait for 1 second
            await new Promise(resolve => setTimeout(resolve, 500));
            const testData = get3DSimulationData();

            await loadModel(
                entity,
                testData.data.model_mesh.url,
                scene,
                gizmoManager,
                (progress) => {
                    entity.setProcessingState({
                        isGenerating2D: false,
                        isGenerating3D: true,
                        progressMessage: progress.message
                    });
                }
            );
            entity.setProcessingState({
                isGenerating2D: false,
                isGenerating3D: false,
                progressMessage: '3D model generated successfully!'
            });
            return {
                success: true,
                modelUrl: testData.data.model_mesh.url
            }
        }

        const result = await fal.subscribe("fal-ai/trellis", {
            input: params,
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === "IN_PROGRESS") {
                    const estimatedTime = Math.max(30000 - (performance.now() - startTime), 0);
                    const latestLog = `Processing... ${(estimatedTime / 1000).toFixed(1)}s estimated`;
                    entity.setProcessingState({
                        isGenerating2D: false,
                        isGenerating3D: true,
                        progressMessage: latestLog
                    });
                }
            },
        });

        // Log time
        const elapsedTime = performance.now() - startTime;
        const seconds = (elapsedTime / 1000).toFixed(2);
        console.log("%c3D conversion completed in " + seconds + " seconds", "color: #4CAF50; font-weight: bold;");

        console.log(result);

        // Return result
        if (result.data?.model_mesh?.url) {

            await loadModel(
                entity,
                result.data.model_mesh.url,
                scene,
                gizmoManager,
                (progress) => {
                    entity.setProcessingState({
                        isGenerating2D: false,
                        isGenerating3D: true,
                        progressMessage: progress.message
                    });
                }
            );

            entity.addModelToHistory(result.data.model_mesh.url, entity.getCurrentGeneration()?.id);

            entity.setProcessingState({
                isGenerating2D: false,
                isGenerating3D: false,
                progressMessage: ''
            });

            return { success: true, modelUrl: result.data.model_mesh.url };
        } else {
            return { success: false, error: 'No 3D model generated' };
        }
    } catch (error) {
        console.error("3D conversion failed:", error);
        entity.setProcessingState({
            isGenerating2D: false,
            isGenerating3D: false,
            progressMessage: 'Failed to generate 3D model'
        });
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Helper function to convert a Blob to a base64 data URL
 */
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('Failed to convert blob to base64'));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
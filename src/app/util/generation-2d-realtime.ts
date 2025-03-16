import { fal } from "@fal-ai/client";
import * as BABYLON from '@babylonjs/core';
// Import GLB/GLTF loaders
import "@babylonjs/loaders/glTF";
// Import the entity manager functions
import { getPrimaryMeshFromEntity } from './entity-manager';
import { IMAGE_SIZE_MAP, RATIO_MAP, ImageRatio, ImageSize } from '../types/entity';
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
class ConnectionManager {
    private static instance: ConnectionManager;
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

    public static getInstance(): ConnectionManager {
        if (!ConnectionManager.instance) {
            ConnectionManager.instance = new ConnectionManager();
        }
        return ConnectionManager.instance;
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
                                    console.log("Generated base64 image:", imageUrl);
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
export function initializeImageGeneration(): void {
    ConnectionManager.getInstance().initialize();
}

/**
 * Generate an image using the FAL AI API with persistent WebSocket connection
 */
export async function generateImage(
    prompt: string,
    options: {
        ratio?: ImageRatio;
        imageSize?: ImageSize;
        entityType?: string;
        negativePrompt?: string;
        onProgress?: ProgressCallback;
    } = {}
): Promise<Generation2DRealtimResult> {
    // Use defaults if not provided
    const ratio = options.ratio || '1:1';
    const imageSize = options.imageSize || 'medium';
    const entityType = options.entityType || 'aiObject';
    const negativePrompt = options.negativePrompt || 'cropped, out of frame';
    const onProgress = options.onProgress;

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
    if (entityType === 'character') {
        enhancedPrompt = `full body character: ${prompt}, well-lit studio shot, detailed`;
    } else if (entityType === 'object' || entityType === 'aiObject') {
        enhancedPrompt = `${prompt} at the center of the frame, uncropped, solid black background, studio lighting`;
    } else if (entityType === 'skybox') {
        enhancedPrompt = `expansive panoramic view of ${prompt}, no people, no buildings`;
    }

    // Update progress
    onProgress?.({ message: `Generating ${width}x${height} image...` });

    // Get connection manager and generate the image
    const connectionManager = ConnectionManager.getInstance();

    // Use the proper method (assuming it's called 'generateImage')
    return connectionManager.generateImage({
        prompt: enhancedPrompt,
        negative_prompt: negativePrompt,
        width,
        height,
    }, onProgress);
}

/**
 * Estimate progress percentage from logs (simplified implementation)
 */
function estimateProgressFromLogs(logs: any[]): number | undefined {
    if (!logs || logs.length === 0) return undefined;

    // Look for step information in logs
    for (let i = logs.length - 1; i >= 0; i--) {
        const log = logs[i];
        if (log.message && typeof log.message === 'string') {
            // Try to extract step information like "Step 15/50"
            const stepMatch = log.message.match(/Step (\d+)\/(\d+)/i);
            if (stepMatch && stepMatch.length === 3) {
                const [_, current, total] = stepMatch;
                return (parseInt(current) / parseInt(total)) * 100;
            }
        }
    }

    return undefined;
}

/**
 * Apply a generated image to a mesh in the scene
 */
export function applyImageToMesh(
    node: BABYLON.Node,
    imageUrl: string,
    scene: BABYLON.Scene
): void {
    // Handle both entities and direct meshes
    let mesh: BABYLON.AbstractMesh | null = null;

    if (node instanceof BABYLON.TransformNode) {
        mesh = getPrimaryMeshFromEntity(node);
    } else if (node instanceof BABYLON.AbstractMesh) {
        mesh = node;
    }

    if (!mesh) return;

    // Get the existing material or create a new one
    let material = mesh.material as BABYLON.StandardMaterial;
    if (!material || !(material instanceof BABYLON.StandardMaterial)) {
        material = new BABYLON.StandardMaterial("generatedMaterial", scene);
    }

    // Check if we need to revoke previous object URL
    if (mesh.metadata?.generatedImage && mesh.metadata.generatedImage.startsWith('blob:')) {
        URL.revokeObjectURL(mesh.metadata.generatedImage);
    }

    // Create a texture from the image URL
    const texture = new BABYLON.Texture(imageUrl, scene);
    material.diffuseTexture = texture;

    // Apply the material to the mesh
    mesh.material = material;

    // Update mesh metadata
    mesh.metadata = {
        ...mesh.metadata,
        generatedImage: imageUrl
    };
}




/**
 * Load a 3D model and replace the current mesh
 */
export async function replaceWithModel(
    entity: BABYLON.TransformNode,
    modelUrl: string,
    scene: BABYLON.Scene,
    onProgress?: ProgressCallback
): Promise<boolean> {
    try {
        onProgress?.({ message: 'Downloading 3D model...' });


        // Find all child meshes
        const childMeshes = entity.getChildMeshes?.() || [];

        // Dispose all child meshes
        for (const mesh of childMeshes) {
            mesh.dispose();
        }

        // Load the model as children of the entity
        return new Promise((resolve) => {
            BABYLON.SceneLoader.ImportMesh("", modelUrl, "", scene,
                (meshes) => {
                    onProgress?.({ message: 'Processing 3D model...' });
                    console.log("meshes", meshes);

                    if (meshes.length > 0) {
                        console.log("meshes length", meshes.length);
                        // Parent all meshes to our entity
                        meshes.forEach(mesh => {
                            mesh.parent = entity;

                            // Set up bidirectional references for the all sub meshes
                            mesh.metadata = {
                                isEntityMesh: true,
                                parentEntity: entity
                            };
                            entity.metadata.primaryMesh = mesh;
                            console.log("added metadata to mesh", mesh);
                        });

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
import { fal } from "@fal-ai/client";
import * as BABYLON from '@babylonjs/core';
// Import GLB/GLTF loaders
import "@babylonjs/loaders/glTF";
// Types for callbacks and results
export interface GenerationProgress {
    message: string;
    progress?: number;
}

export interface GenerationResult {
    success: boolean;
    imageUrl?: string;
    error?: string;
}

export type ProgressCallback = (progress: GenerationProgress) => void;

// Singleton connection manager - updated to use a queue system
class ConnectionManager {
    private static instance: ConnectionManager;
    private connection:  any = null;
    private isConnected: boolean = false;
    private isProcessing: boolean = false;
    
    // Queue system for handling requests one at a time
    private requestQueue: Array<{
        prompt: string,
        onProgress?: ProgressCallback,
        resolve: (result: GenerationResult) => void
    }> = [];
    
    // Add a timeStart property to track generation start time
    private currentRequest: {
        resolve: (result: GenerationResult) => void,
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
                                    const blob = new Blob([imageData.content], { type: 'image/png' });
                                    
                                    // Create a URL for the blob
                                    imageUrl = URL.createObjectURL(blob);
                                    console.log("Created blob URL from binary data:", imageUrl);
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
            console.log("Sending prompt to AI service:", nextRequest.prompt);
            this.connection.send({
                prompt: nextRequest.prompt,
                negative_prompt: "cropped, out of frame",
                image_size: "square_hd",
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
    
    public async generateImage(prompt: string, onProgress?: ProgressCallback): Promise<GenerationResult> {
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
                prompt: enhancedPrompt,
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
    onProgress?: ProgressCallback
): Promise<GenerationResult> {
    return ConnectionManager.getInstance().generateImage(prompt, onProgress);
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
    mesh: BABYLON.Mesh,
    imageUrl: string,
    scene: BABYLON.Scene
): void {
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
 * Generate a 3D model from an image using the FAL AI Trellis API
 */
export async function convertImageTo3D(
    imageUrl: string,
    onProgress?: ProgressCallback
): Promise<{success: boolean, modelUrl?: string, error?: string}> {
    try {
        onProgress?.({ message: 'Starting 3D conversion...' });
        
        // If the image is a blob URL, we need to convert it to base64 first
        let processedImageUrl = imageUrl;
        if (imageUrl.startsWith('blob:')) {
            onProgress?.({ message: 'Converting image format...' });
            try {
                // Fetch the blob and convert to base64
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                processedImageUrl = await blobToBase64(blob);
                console.log("Converted blob URL to base64");
            } catch (error) {
                console.error("Failed to convert blob URL:", error);
                return {
                    success: false,
                    error: "Failed to prepare image for 3D conversion"
                };
            }
        }
        
        // Call the FAL AI Trellis API
        const startTime = performance.now();
        onProgress?.({ message: 'Sending request to 3D conversion service...' });
        
        const result = await fal.subscribe("fal-ai/trellis", {
            input: {
                image_url: processedImageUrl,
                mesh_simplify: 0.9,
                // texture_size: "1024", //issue with fal api
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === "IN_PROGRESS") {
                    const latestLog = update.logs[update.logs.length - 1]?.message || 'Processing...';
                    onProgress?.({ message: latestLog });
                }
            },
        });
        
        // Log completion time
        const elapsedTime = performance.now() - startTime;
        const seconds = (elapsedTime / 1000).toFixed(2);
        console.log("%c3D conversion completed in " + seconds + " seconds", "color: #4CAF50; font-weight: bold;");
        
        // Check if we have a valid model URL
        if (result.data && result.data.model_mesh && result.data.model_mesh.url) {
            return {
                success: true,
                modelUrl: result.data.model_mesh.url
            };
        } else {
            return {
                success: false,
                error: 'No 3D model generated'
            };
        }
    } catch (error) {
        console.error("3D conversion failed:", error);
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

/**
 * Load a 3D model and replace the current mesh
 */
export async function replaceWithModel(
    currentMesh: BABYLON.Mesh,
    modelUrl: string,
    scene: BABYLON.Scene,
    onProgress?: ProgressCallback
): Promise<boolean> {
    try {
        onProgress?.({ message: 'Downloading 3D model...' });
        
        // Store position, rotation, and scaling of the current mesh
        const position = currentMesh.position.clone();
        const rotation = currentMesh.rotation.clone();
        const scaling = currentMesh.scaling.clone();
        const name = currentMesh.name;
        const metadata = {...currentMesh.metadata};
        
        // Load the 3D model
        return new Promise((resolve) => {
            BABYLON.SceneLoader.ImportMesh("", modelUrl, "", scene, 
                (meshes) => {
                    onProgress?.({ message: 'Processing 3D model...' });
                    
                    if (meshes.length > 0) {
                        // Create a parent container mesh
                        const container = new BABYLON.Mesh("container", scene);
                        
                        // Parent all imported meshes to the container
                        for (const mesh of meshes) {
                            mesh.parent = container;
                        }
                        
                        // Apply the original mesh's transforms
                        container.position = position;
                        container.rotation = rotation;
                        container.scaling = scaling;
                        container.name = name;
                        container.metadata = metadata;
                        
                        // Dispose the original mesh
                        currentMesh.dispose();
                        
                        onProgress?.({ message: '3D model loaded successfully!' });
                        resolve(true);
                    } else {
                        onProgress?.({ message: 'Failed to load 3D model' });
                        resolve(false);
                    }
                },
                (evt) => {
                    // Loading progress
                    if (evt.lengthComputable) {
                        const progress = (evt.loaded / evt.total * 100).toFixed(0);
                        onProgress?.({ message: `Downloading: ${progress}%` });
                    }
                },
                (scene, message) => {
                    // Error
                    onProgress?.({ message: `Error loading model: ${message}` });
                    resolve(false);
                }
            );
        });
    } catch (error) {
        console.error("Failed to replace with 3D model:", error);
        onProgress?.({ message: 'Failed to replace with 3D model' });
        return false;
    }
} 
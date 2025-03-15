import { fal } from "@fal-ai/client";
import * as BABYLON from '@babylonjs/core';
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
    private connection: any = null;
    private isConnected: boolean = false;
    private isProcessing: boolean = false;
    
    // Queue system for handling requests one at a time
    private requestQueue: Array<{
        prompt: string,
        onProgress?: ProgressCallback,
        resolve: (result: GenerationResult) => void
    }> = [];
    
    private currentRequest: {
        resolve: (result: GenerationResult) => void,
        onProgress?: ProgressCallback
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
            this.connection = fal.realtime.connect("fal-ai/fast-turbo-diffusion", {
                onResult: (result) => {
                    console.log("Received result:", result);
                    
                    // Process the current request
                    if (this.currentRequest) {
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
        
        // Set as current request
        this.currentRequest = {
            resolve: nextRequest.resolve,
            onProgress: nextRequest.onProgress
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
                image_size: "square",
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
        const enhancedPrompt = `image of a complete ${prompt} at the center of the frame, uncropped, and entirely visible. Render it against a solid black background, crisp edges, studio lighting`;
        
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
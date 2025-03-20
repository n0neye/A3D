import { ProgressCallback } from "./generation-util";
import { fal } from "@fal-ai/client";
import * as BABYLON from '@babylonjs/core';
import { getImageSimulationData, } from "./simulation-data";
import { IMAGE_SIZE_MAP, RATIO_MAP, ImageSize, EntityNode, applyImageToEntity, GenerationLog } from './extensions/entityNode';
import { PromptProps } from "./generation-util";
import { Runware, RunwareClient } from "@runware/sdk-js";

// Types for callbacks and results
export interface Generation2DRealtimResult {
    success: boolean;
    imageUrl?: string;
    error?: string;
}

export interface GenerationResult {
    success: boolean;
    generationLog: GenerationLog | null;
}

// Initialize the connection on module load
export function initializeRealtimeConnection(): void {
    // FalConnectionManager.getInstance().initialize();
    initRunwareClient();
}

export async function generateRealtimeImage(
    prompt: string,
    entity: EntityNode,
    scene: BABYLON.Scene,
    options: {
        imageSize?: ImageSize;
        negativePrompt?: string;
    } = {}
): Promise<GenerationResult> {
    const startTime = performance.now();
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
        enhancedPrompt = `${prompt} at the center of the frame, close up, focused on the object, uncropped, solid black background`;
    } else if (aiObjectType === 'background') {
        enhancedPrompt = `expansive panoramic view of ${prompt}`;
    }

    // If the prompt is "_", use the test data
    let result: Generation2DRealtimResult;
    if (prompt === "_") {
        result = getImageSimulationData();
    } else {
        result = await generateRealtimeImageRunware(prompt, {
            imageSize: imageSize,
            negativePrompt: negativePrompt
        });

        // result = await generateRealtimeImageFal(prompt, {
        //     width: width,
        //     height: height,
        //     negativePrompt: negativePrompt
        // });
    }

    const success = result.success && result.imageUrl !== undefined;
    if (success && result.imageUrl) {
        console.log(`%cImage generation took ${((performance.now() - startTime) / 1000).toFixed(2)} seconds`, "color: #4CAF50; font-weight: bold;");

        // Add to history
        const log = entity.addImageGenerationLog(prompt, result.imageUrl, {
            ratio: '1:1',
            imageSize: 'medium'
        });

        await applyImageToEntity(entity, result.imageUrl, scene);

        console.log(`%cTask completed in ${((performance.now() - startTime) / 1000).toFixed(2)} seconds`, "color: #4CAF50; font-weight: bold;");

        entity.setProcessingState({
            isGenerating2D: false,
            isGenerating3D: false,
            progressMessage: success ? 'Image generated successfully!' : 'Failed to generate image'
        });

        return { success, generationLog: log };
    }


    return { success: false, generationLog: null };
}

/**
 * Generate an image using the FAL AI API with persistent WebSocket connection
 */
async function generateRealtimeImageFal(
    prompt: string,
    options: {
        width?: number;
        height?: number;
        negativePrompt?: string;
    } = {}
): Promise<Generation2DRealtimResult> {
    // Get connection manager and generate the image
    const connectionManager = FalConnectionManager.getInstance();
    const result = await connectionManager.generateImage({
        prompt,
        negative_prompt: options.negativePrompt,
        width: options.width,
        height: options.height
    });
    return result;
}

let runwareClient: RunwareClient | null = null;
const RUNWARE_API_KEY = "hVH7hCVr32kVuQGbJVjUiziJ7a9lXWbZ";
const initRunwareClient = async () => {
    runwareClient = new Runware({ apiKey: RUNWARE_API_KEY });
    await runwareClient.ensureConnection();
}

async function generateRealtimeImageRunware(
    prompt: string,
    options: {
        imageSize?: ImageSize;
        negativePrompt?: string;
    } = {}
): Promise<Generation2DRealtimResult> {
    if (!runwareClient) {
        await initRunwareClient();
    }
    if (!runwareClient) {
        throw new Error("Runware client not initialized");
    }
    const runwareResult = await runwareClient.requestImages({
        positivePrompt: prompt,
        negativePrompt: options.negativePrompt,
        width: 1024,
        height: 1024,
        model: "runware:100@1",
        numberResults: 1,
        outputType: "URL",
        outputFormat: "WEBP",
        checkNSFW: false,
    })

    return {
        success: runwareResult?.[0]?.imageURL ? true : false,
        imageUrl: runwareResult?.[0]?.imageURL || undefined
    };
}


// Singleton connection manager - updated to use a queue system
class FalConnectionManager {
    private static instance: FalConnectionManager;
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

    public static getInstance(): FalConnectionManager {
        if (!FalConnectionManager.instance) {
            FalConnectionManager.instance = new FalConnectionManager();
        }
        return FalConnectionManager.instance;
    }

    private falConnection = fal.realtime.connect("fal-ai/fast-lcm-diffusion", {
        onResult: (result) => {
            console.log("Received result:", result);

            // Process the current request
            if (this.currentRequest) {
                // Calculate elapsed time if we have a start time
                if (this.currentRequest.timeStart) {
                    console.log("%cGeneration completed in " + ((performance.now() - this.currentRequest.timeStart) / 1000).toFixed(2) + "s", "color: #4CAF50; font-weight: bold;");
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

    public initialize() {
        if (this.connection) return;

        console.log("Initializing WebSocket connection to FAL AI...");

        try {
            this.connection = this.falConnection;

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

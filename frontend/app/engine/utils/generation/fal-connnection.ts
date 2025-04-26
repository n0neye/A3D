import { ProgressCallback } from "./generation-util";
import { fal } from "@fal-ai/client";
import { PromptProps } from "./generation-util";
import { Generation2DRealtimResult } from "./realtime-generation-util";

interface FalRealtimeConnection<Input> {
    send(input: Input ): void;
    close(): void;
}

// Singleton connection manager - updated to use a queue system
export class FalConnectionManager {
    private static instance: FalConnectionManager;
    private connection: FalRealtimeConnection<any> | null = null;
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
            FalConnectionManager.instance.initialize();
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
            this.connection = null;
            this.isConnected = false;
            throw error;
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
            throw error;
        }
    }

    public async generateImage(props: PromptProps, onProgress?: ProgressCallback): Promise<Generation2DRealtimResult> {
        // Initialize connection if needed
        console.log("generateImage: connection", this.connection);
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

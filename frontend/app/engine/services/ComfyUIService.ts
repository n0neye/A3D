/**
 * ComfyUIService.ts
 * 
 * Responsible for communicating with the ComfyUI server.
 * This service enables sending images and receiving results from ComfyUI.
 */
import { dataURLtoBlob } from '@/engine/utils/generation/image-processing';
import { IRenderLog, LoraConfig } from '@/engine/interfaces/rendering';
import { EditorEngine } from '@/engine/core/EditorEngine';

interface ComfyUIResponse {
    status: string;
    data?: any;
    error?: string;
}

export interface ComfyUIRenderResult {
    success: boolean;
    imageUrl?: string | null;
    message?: string;
}

export interface ComfyUIRenderParams {
    colorImage: string;
    depthImage?: string;
    prompt: string;
    promptStrength: number;
    depthStrength?: number;
    seed: number;
    selectedLoras?: LoraConfig[];
    metadata?: Record<string, any>;
}

// Add a proper interface for the payload
interface ComfyUIPayload {
    color_image_base64: string;
    depth_image_base64?: string;
    metadata: {
        timestamp: number;
        filename?: string;
        prompt?: string;
        negative_prompt?: string;
        prompt_strength?: number;
        seed?: number;
        depth_strength?: number;
        loras?: Array<{ name: string, strength: number }>;
        [key: string]: any;
    };
    [key: string]: any;
}

export class ComfyUIService {
    private serverUrl: string;
    private comfyUiBaseUrl: string;

    static instance: ComfyUIService;

    static getInstance(): ComfyUIService {
        if (!ComfyUIService.instance) {
            ComfyUIService.instance = new ComfyUIService();
        }
        return ComfyUIService.instance;
    }

    constructor(comfyUiBaseUrl: string = 'http://localhost:8188', endpointPath: string = '/a3d_data') {
        this.comfyUiBaseUrl = comfyUiBaseUrl;
        this.serverUrl = endpointPath;
    }

    /**
     * Sends images to ComfyUI for processing
     * @param params Render parameters including images and settings
     * @returns Promise with the render result
     */
    public async sendToComfyUI(params: ComfyUIRenderParams): Promise<ComfyUIRenderResult> {
        try {
            // Convert base64 data URLs to raw base64 if needed
            const colorImageBase64 = this.stripDataUrlPrefix(params.colorImage);
            const depthImageBase64 = params.depthImage ? this.stripDataUrlPrefix(params.depthImage) : undefined;

            // Separate prompt into positive and negative prompts
            let positivePrompt = params.prompt;
            let negativePrompt = '';
            
            if (params.prompt.includes('--no')) {
                [positivePrompt, negativePrompt] = params.prompt.split('--no');
            }

            // Create payload object with correct typing
            const payload: ComfyUIPayload = {
                color_image_base64: colorImageBase64,
                metadata: {
                    filename: `render_${Date.now()}.png`,
                    timestamp: Date.now() / 1000,
                    prompt: positivePrompt.trim(),
                    negative_prompt: negativePrompt.trim(),
                    seed: params.seed,
                    ...params.metadata
                }
            };

            // Add depth image if provided
            if (depthImageBase64) {
                payload.depth_image_base64 = depthImageBase64;
                payload.metadata.depth_strength = params.depthStrength || 0.5;
            }

            // Construct the full URL
            const fullUrl = `${this.comfyUiBaseUrl}${this.serverUrl}`;
            
            console.log(`Sending request to ComfyUI at ${fullUrl}`);
            console.log('Payload:', payload);

            // Send request with proper CORS headers
            const response = await fetch(fullUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                mode: 'cors', // Explicitly set CORS mode
                body: JSON.stringify(payload)
            });

            console.log("ComfyUI response:", response);

            // Handle response
            if (!response.ok) {
                throw new Error(`ComfyUI server responded with status: ${response.status} ${response.statusText}`);
            }

            const responseData = await response.json();

            if (responseData.status === 'error') {
                throw new Error(responseData.error || 'Unknown error from ComfyUI server');
            }

            return {
                success: true,
                message: responseData.message || 'Success'
            };
        } catch (error) {
            console.error('Error sending to ComfyUI:', error);
            return {
                imageUrl: null,
                success: false,
                message: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Strip 'data:image/*;base64,' prefix from data URL
     */
    private stripDataUrlPrefix(dataUrl: string): string {
        if (dataUrl.startsWith('data:')) {
            return dataUrl.split(',')[1];
        }
        return dataUrl;
    }
}
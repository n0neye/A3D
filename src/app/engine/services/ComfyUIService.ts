/**
 * ComfyUIService.ts
 * 
 * Responsible for communicating with the ComfyUI server.
 * This service enables sending images and receiving results from ComfyUI.
 */
import { dataURLtoBlob } from '@/app/engine/utils/generation/image-processing';
import { IRenderLog, LoraConfig } from '@/app/engine/interfaces/rendering';
import { EditorEngine } from '@/app/engine/core/EditorEngine';

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
    image_base64: string;
    depth_image_base64?: string;
    metadata: {
        timestamp: number;
        filename?: string;
        prompt?: string;
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

    constructor(serverUrl: string = 'http://localhost:8199') {
        this.serverUrl = serverUrl;
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

            // Create payload object with correct typing
            const payload: ComfyUIPayload = {
                image_base64: colorImageBase64,
                metadata: {
                    filename: `render_${Date.now()}.png`,
                    timestamp: Date.now() / 1000,
                    //   prompt: params.prompt,
                    //   prompt_strength: params.promptStrength,
                    //   seed: params.seed,
                    ...params.metadata
                }
            };

            // Add depth image if provided
            if (depthImageBase64) {
                payload.depth_image_base64 = depthImageBase64;
                payload.metadata.depth_strength = params.depthStrength || 0.5;
            }

            // Add LoRAs if provided
            //   if (params.selectedLoras && params.selectedLoras.length > 0) {
            //     payload.metadata.loras = params.selectedLoras.map(lora => ({
            //       name: lora.name,
            //       strength: lora.strength
            //     }));
            //   }

            // Convert to JSON
            const jsonData = JSON.stringify(payload);

            // Send request
            console.log(`Sending request to ComfyUI at ${this.serverUrl}`);
            const response = await fetch(this.serverUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: jsonData
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

            // Add render log
            // this.addRenderLog({
            //     imageUrl: responseData.data?.image_url || null,
            //     prompt: params.prompt,
            //     seed: params.seed,
            //     promptStrength: params.promptStrength,
            //     depthStrength: params.depthStrength,
            //     selectedLoras: params.selectedLoras || []
            // });

            return {
                success: true,
                // imageUrl: responseData.data?.image_url || null,
                // seed: params.seed
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

    /**
     * Add render log to project manager
     */
    private addRenderLog(log: Partial<IRenderLog>): void {
        const renderLog: IRenderLog = {
            timestamp: new Date(),
            imageUrl: log.imageUrl || '',
            prompt: log.prompt || '',
            model: 'ComfyUI',
            seed: log.seed || 0,
            promptStrength: log.promptStrength || 0.5,
            depthStrength: log.depthStrength,
            selectedLoras: log.selectedLoras || [],
        };

        // Add render log to project manager
        EditorEngine.getInstance().getProjectManager().addRenderLog(renderLog, true);
    }
}

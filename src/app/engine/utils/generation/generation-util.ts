import { fal, Result } from "@fal-ai/client";
import * as THREE from 'three';
import { GenerativeEntity } from '@/app/engine/entity/types/GenerativeEntity';
import { IGenerationLog } from '@/app/engine/interfaces/generation';
import { GenerationResult } from "./realtime-generation-util";



// Types for callbacks and results
export interface GenerationProgress {
    message: string;
    progress?: number;
}

export interface PromptProps {
    prompt: string;
    negative_prompt?: string;
    width?: number;
    height?: number;
}


export type ProgressCallback = (progress: GenerationProgress) => void;


/**
 * Generate an image using the FAL AI API with persistent WebSocket connection
 */
export async function generateBackground(
    prompt: string,
    entity: GenerativeEntity,
    scene: THREE.Scene,
    options: {
        negativePrompt?: string;
    } = {}
): Promise<GenerationResult> {
    // Use defaults if not provided
    const startTime = performance.now();
    const entityType = entity.getEntityType();
    const negativePrompt = options.negativePrompt || 'cropped, out of frame, blurry, blur';
    // Update entity state
    entity.setProcessingState('generating2D', 'Starting generation...');

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

    let log: IGenerationLog | null = null;
    const success = result.data.images.length > 0;
    if (success && result.data.images[0].url) {

        // Apply the image to the entity mesh
        entity.applyImage(result.data.images[0].url, scene);

        // Add to history
        log = entity.addImageGenerationLog(prompt, result.data.images[0].url, '16:9',);

        // Log time
        const endTime = performance.now();
        const duration = endTime - startTime;
        console.log(`%cBackground generation took ${(duration / 1000).toFixed(2)} seconds`, "color: #4CAF50; font-weight: bold;");
    }

    entity.setProcessingState('idle', success ? 'Image generated successfully!' : 'Failed to generate image');

    return { success: success, generationLog: log };
}

/**
 * Helper function to convert a Blob to a base64 data URL
 */
export function blobToBase64(blob: Blob): Promise<string> {
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
 * Remove background from an image using the FAL AI API
 */
export async function removeBackground(
    imageUrl: string,
    entity: GenerativeEntity,
    scene: THREE.Scene,
    derivedFromId: string
): Promise<GenerationResult> {
    // Update entity state
    entity.setProcessingState('generating2D', 'Removing background...');

    try {
        const startTime = performance.now();

        // Call the FAL API to remove background
        const result = await fal.subscribe("fal-ai/imageutils/rembg", {
            input: {
                image_url: imageUrl
            },
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === "IN_PROGRESS") {
                    console.log("Background removal in progress...");
                    update.logs?.map((log) => log.message).forEach(console.log);
                }
            },
        });

        const success = result.data && result.data.image && result.data.image.url;
        if (success) {
            // Apply the image to the entity mesh
            await entity.applyImage(result.data.image.url, scene, entity.temp_ratio);

            // Add to history - note this is a special case derived from another image
            const prompt = entity.getCurrentGenerationLog()?.prompt || '';
            const log = entity.addImageGenerationLog(prompt, result.data.image.url, 
               entity.temp_ratio || '1:1',
            );

            // Log time
            const endTime = performance.now();
            const duration = endTime - startTime;
            console.log(`%cBackground removal took ${(duration / 1000).toFixed(2)} seconds`, "color: #4CAF50; font-weight: bold;");

            entity.setProcessingState('idle', 'Background removed successfully!');

            return { success: true, generationLog: log };
        }

        throw new Error('Failed to remove background');

    } catch (error) {
        console.error("Background removal failed:", error);
        entity.setProcessingState('idle', 'Failed to remove background');
        return {
            success: false,
            generationLog: null
        };
    }
}
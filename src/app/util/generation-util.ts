import { fal, Result } from "@fal-ai/client";
import * as BABYLON from '@babylonjs/core';
import "@babylonjs/loaders/glTF";
import { get3DSimulationData, getImageSimulationData, isSimulating } from "./simulation-data";
import { EntityNode, AiObjectType, EntityType, applyImageToEntity, GenerationLog } from './extensions/entityNode';
import { GenerationResult } from "./realtime-generation-util";
import { TrellisOutput } from "@fal-ai/client/endpoints";


export type ImageRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
export type ImageSize = 'small' | 'medium' | 'large' | 'xl';

// Map of image sizes to actual dimensions
export const IMAGE_SIZE_MAP = {
    small: 512,
    medium: 1024,
    large: 1280,
    xl: 1920
};

// Map of ratios to width/height multipliers
export const RATIO_MAP = {
    '1:1': { width: 1, height: 1 },
    '16:9': { width: 16, height: 9 },
    '9:16': { width: 9, height: 16 },
    '4:3': { width: 4, height: 3 },
    '3:4': { width: 3, height: 4 }
};


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
    entity: EntityNode,
    scene: BABYLON.Scene,
    options: {
        imageSize?: ImageSize;
        negativePrompt?: string;
    } = {}
): Promise<GenerationResult> {
    // Use defaults if not provided
    const startTime = performance.now();
    const imageSize = options.imageSize || 'medium';
    const entityType = entity.getEntityType();
    const aiObjectType = entity.getAIData()?.aiObjectType || 'generativeObject';
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

    let log: GenerationLog | null = null;
    const success = result.data.images.length > 0;
    if (success && result.data.images[0].url) {

        // Apply the image to the entity mesh
        applyImageToEntity(entity, result.data.images[0].url, scene);

        // Add to history
        log = entity.addImageGenerationLog(prompt, result.data.images[0].url, {
            ratio: '16:9',
            imageSize: 'medium'
        });

        // Log time
        const endTime = performance.now();
        const duration = endTime - startTime;
        console.log(`%cBackground generation took ${(duration / 1000).toFixed(2)} seconds`, "color: #4CAF50; font-weight: bold;");
    }

    entity.setProcessingState({
        isGenerating2D: false,
        isGenerating3D: false,
        progressMessage: success ? 'Image generated successfully!' : 'Failed to generate image'
    });

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
    entity: EntityNode,
    scene: BABYLON.Scene,
    derivedFromId: string
): Promise<GenerationResult> {
    // Update entity state
    entity.setProcessingState({
        isGenerating2D: true,
        isGenerating3D: false,
        progressMessage: 'Removing background...'
    });

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
            await applyImageToEntity(entity, result.data.image.url, scene, entity.metadata.aiData?.ratio);

            // Add to history - note this is a special case derived from another image
            const prompt = entity.getCurrentGenerationLog()?.prompt || '';
            const log = entity.addImageGenerationLog(prompt, result.data.image.url, {
                ratio: entity.metadata.aiData?.ratio || '1:1',
                imageSize: entity.metadata.aiData?.imageSize || 'medium',
                derivedFromId: derivedFromId
            }, );

            // Log time
            const endTime = performance.now();
            const duration = endTime - startTime;
            console.log(`%cBackground removal took ${(duration / 1000).toFixed(2)} seconds`, "color: #4CAF50; font-weight: bold;");

            entity.setProcessingState({
                isGenerating2D: false,
                isGenerating3D: false,
                progressMessage: 'Background removed successfully!'
            });

            return { success: true, generationLog: log };
        }

        throw new Error('Failed to remove background');

    } catch (error) {
        console.error("Background removal failed:", error);
        entity.setProcessingState({
            isGenerating2D: false,
            isGenerating3D: false,
            progressMessage: 'Failed to remove background'
        });
        return {
            success: false,
            generationLog: null
        };
    }
}
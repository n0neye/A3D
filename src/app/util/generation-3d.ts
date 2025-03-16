import { fal } from "@fal-ai/client";
import * as BABYLON from '@babylonjs/core';
// Import GLB/GLTF loaders
import "@babylonjs/loaders/glTF";
// Import the entity manager functions
import { createEntity, applyImageToEntity, getPrimaryMeshFromEntity } from './editor/entityUtil';
import { IMAGE_SIZE_MAP, RATIO_MAP, ImageRatio, ImageSize } from '../types/entity';
import {  ProgressCallback } from "./generation-2d-realtime";
import { get3DSimulationData, isSimulating } from "./simulation-data";

// Types for callbacks and results
export interface GenerationProgress {
    message: string;
    progress?: number;
}

/**
 * Generate a 3D model from an image using the FAL AI Trellis API
 */
export async function convertImageTo3D(
    imageUrl: string,
    options: {
        entityType?: string;
        onProgress?: ProgressCallback;
    } = {}
): Promise<{success: boolean, modelUrl?: string, error?: string}> {
    const entityType = options.entityType || 'aiObject';
    const onProgress = options.onProgress;
    
    try {
        // Process image URL if it's a blob
        let processedImageUrl = imageUrl;
        if (imageUrl.startsWith('blob:')) {
            onProgress?.({ message: 'Converting image format...' });
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
        
        if (entityType === 'character') {
            params.character = true;
        }
        
        // Call the API
        onProgress?.({ message: 'Starting 3D conversion...' });
        const startTime = performance.now();
        if(isSimulating){
            // Wait for 1 second
            await new Promise(resolve => setTimeout(resolve, 500));

            const testData = get3DSimulationData();
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
                    // const latestLog = update.logs[update.logs.length - 1]?.message || 'Processing...';
                    // Calculate estimated time remaining, min 30s
                    const estimatedTime = Math.max(30000 - (performance.now() - startTime), 0);
                    const latestLog = `Processing... ${(estimatedTime/1000).toFixed(1)}s estimated`;
                    onProgress?.({ message: latestLog });
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
            return {
                success: true,
                modelUrl: result.data.model_mesh.url
            };
        } else {
            return { success: false, error: 'No 3D model generated' };
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
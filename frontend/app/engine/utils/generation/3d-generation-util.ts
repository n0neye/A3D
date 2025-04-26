import { fal, Result } from "@fal-ai/client";
import { GenerationResult } from "./realtime-generation-util";
import { TrellisOutput } from "@fal-ai/client/endpoints";
import { GenerativeEntity } from "@/engine/entity/types/GenerativeEntity";
import * as THREE from 'three';
import { FileService } from "@/engine/services/FileService/FileService";


/**
 * Generate a 3D model from an image using the FAL AI Trellis API
 */
export async function generate3DModel_Trellis(
    imageUrl: string,
    entity: GenerativeEntity,
    scene: THREE.Scene,
    derivedFromId: string,
    options: {
        prompt?: string;
    } = {}
): Promise<GenerationResult> {
    const entityType = entity.getEntityType();

    try {
        // Process image URL
        const base64Data = await FileService.getInstance().readFileAsDataUrl(imageUrl);

        // Set parameters based on entity type
        const params: any = {
            image_url: base64Data,
            mesh_simplify: 0.9,
        };

        console.log("generate3DModel_Trellis", params);

        // Call the API
        const startTime = performance.now();

        let result: Result<TrellisOutput> | null = null;

        result = await fal.subscribe("fal-ai/trellis", {
            input: params,
            logs: true,
            onQueueUpdate: (update) => {
                if (update.status === "IN_PROGRESS") {
                    const estimatedTime = Math.max(30000 - (performance.now() - startTime), 0);
                    const latestLog = `Processing... ${(estimatedTime / 1000).toFixed(1)}s est`;
                    entity.setProcessingState("generating3D", latestLog);
                }
            },
        });


        const log = await entity.createAndApplyNewGenerationLog("model", { fileUrl: result.data.model_mesh.url, prompt: options.prompt, derivedFromId: derivedFromId });

        entity.setProcessingState("idle", "");

        return { success: true, generationLog: log };
    } catch (error) {
        console.error("3D conversion failed:", error);
        entity.setProcessingState("idle", "Failed to generate 3D model");
        return {
            success: false,
            generationLog: null
        };
    }
}

/**
 * Generate a 3D model from an image using RunPod API
 */
export async function generate3DModel_Runpod(
    imageUrl: string,
    entity: GenerativeEntity,
    scene: THREE.Scene,
    derivedFromId: string,
    options: {
        prompt?: string;
    } = {}
): Promise<GenerationResult> {
    try {
        // Setup processing state
        const startTime = performance.now();
        entity.setProcessingState("generating3D", "Processing image...");

        // Process source image 
        const base64Data = await FileService.getInstance().readFileAsBase64(imageUrl);
        const payload = { imageBase64: base64Data };

        entity.setProcessingState("generating3D", "Submitting...");

        // Submit job
        const submitResponse = await fetch('/api/runpod/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!submitResponse.ok) {
            const errorData = await submitResponse.json();
            throw new Error(`Failed to submit job: ${JSON.stringify(errorData)}`);
        }

        const jobData = await submitResponse.json();
        const jobId = jobData.id;

        if (!jobId) {
            throw new Error('No job ID returned from submission');
        }

        console.log("Job submitted successfully, ID:", jobId);

        // Poll for the result
        let completed = false;
        let resultData = null;
        let attempts = 0;
        const maxAttempts = 400; // 200s

        while (!completed && attempts < maxAttempts) {
            attempts++;

            // Update progress message with elapsed time
            const elapsedTime = performance.now() - startTime;
            const elapsedSeconds = (elapsedTime / 1000).toFixed(0);
            entity.setProcessingState("generating3D", `Generating... (${elapsedSeconds}s)`);

            // Check job status
            const statusResponse = await fetch(`/api/runpod/status/${jobId}`);

            if (!statusResponse.ok) {
                console.warn(`Failed to check status, attempt ${attempts}: ${statusResponse.status}`);
                // Wait and try again
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
            }

            const statusData = await statusResponse.json();

            if (statusData.status === 'COMPLETED') {
                completed = true;
                resultData = statusData.output;
                console.log("Job completed successfully!");
            } else if (statusData.status === 'FAILED') {
                throw new Error(`Job failed: ${statusData.error || 'Unknown error'}`);
            } else {
                console.log(`Job status: ${statusData.status}, attempt ${attempts}`);
            }

            // Wait before polling again
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (!completed) {
            throw new Error('Job timed out - exceeded maximum polling attempts');
        }

        // Process the results
        if (resultData && resultData.model_base64) {
            console.log("Processing model data...");
            // Convert base64 to blob URL

            const binary = atob(resultData.model_base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            // Create blob with the proper MIME type
            const blob = new Blob([bytes.buffer], { type: 'model/gltf-binary' });

            // with a .glb extension to help recognize the format
            const fileName = `model_${derivedFromId}.glb`;
            const file = new File([blob], fileName, { type: 'model/gltf-binary' });
            const modelUrl = URL.createObjectURL(file);

            console.log("Model converted to blob URL with filename:", fileName);

            const log = await entity.createAndApplyNewGenerationLog("model", { fileUrl: modelUrl, prompt: options.prompt, derivedFromId: derivedFromId });
            entity.setProcessingState("idle", "");
            return { success: true, generationLog: log };
        }

        throw new Error('No 3D model data found in response');
    } catch (error) {
        console.error("RunPod 3D conversion failed:", error);
        entity.setProcessingState("idle", `Failed to generate 3D model: ${(error as Error).message}`);
        return {
            success: false,
            generationLog: null
        };
    }
}

/**
 * API providers for 3D model generation
 */
export type ModelApiProvider = 'trellis' | 'runpod';


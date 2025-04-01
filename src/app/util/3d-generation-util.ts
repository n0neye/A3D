import { fal, Result } from "@fal-ai/client";
import * as BABYLON from '@babylonjs/core';
import "@babylonjs/loaders/glTF";
import { get3DSimulationData, getImageSimulationData, isSimulating } from "./simulation-data";
import { GenerationResult } from "./realtime-generation-util";
import { TrellisOutput } from "@fal-ai/client/endpoints";
import { blobToBase64, ProgressCallback } from "./generation-util";
import { setupMeshShadows } from "./editor/light-util";
import { v4 as uuidv4 } from 'uuid';
import { get3DModelPersistentUrl, upload3DModelToGCP } from "./storage-util";
import { defaultPBRMaterial } from "./editor/material-util";
import { EntityBase } from "./extensions/EntityBase";
import { GenerativeEntity } from "./extensions/GenerativeEntity";

/**
 * Load a 3D model and replace the current mesh
 */
export async function loadModel(
    entity: GenerativeEntity,
    modelUrl: string,
    scene: BABYLON.Scene,
    onProgress?: ProgressCallback
): Promise<boolean> {
    try {
        onProgress?.({ message: 'Downloading 3D model...' });

        console.log("loadModel", modelUrl);

        // Load the model
        const result = await BABYLON.ImportMeshAsync(
            modelUrl,
            scene,
            {
                onProgress: (progressEvent) => {
                    if (progressEvent.lengthComputable) {
                        const progress = (progressEvent.loaded / progressEvent.total * 100).toFixed(0);
                        onProgress?.({ message: `Downloading: ${progress}%` });
                    }
                },
                pluginExtension: ".glb",
                name: "_.glb"
            }
        );

        const meshes = result.meshes;

        // If there's an existing model mesh, dispose it
        if (entity.modelMesh) {
            entity.modelMesh.dispose();
        }

        onProgress?.({ message: 'Generating...' });
        console.log("loadModel: replaceWithModel. meshes", meshes);

        if (meshes.length > 0) {
            console.log("loadModel: meshes length", meshes.length);

            // Create a root container mesh if needed
            let rootModelMesh: BABYLON.Mesh;

            if (meshes.length === 1) {
                rootModelMesh = meshes[0] as BABYLON.Mesh;
            } else {
                // Create a dummy mesh as the container
                rootModelMesh = new BABYLON.Mesh(`${entity.name}-model-root`, scene);
                meshes.forEach((mesh) => {
                    mesh.parent = rootModelMesh;
                });
            }

            // Parent the root model to the entity
            rootModelMesh.parent = entity;

            // Set up the model mesh in the entity
            entity.modelMesh = rootModelMesh;

            // Set metadata on all meshes
            meshes.forEach((mesh) => {
                mesh.metadata = {
                    ...mesh.metadata,
                    rootEntity: entity
                };
            });

            // Find all materials
            meshes.forEach((mesh) => {
                mesh.material = defaultPBRMaterial;
                console.log("loadModel: Applied default material", mesh.material.name, mesh.material);
            });

            // Switch to 3D display mode
            entity.setDisplayMode('3d');

            setupMeshShadows(entity.modelMesh);

            onProgress?.({ message: '3D model loaded successfully!' });
            return true;
        } else {
            throw new Error('No meshes found');
        }
    } catch (error) {
        console.error("Failed to replace with model:", error);
        onProgress?.({ message: `Failed to replace with model: ${(error as Error).message}` });
        return false;
    }
}

/**
 * Common helpers for 3D model generation
 */

// Process an image URL to get the right format for API submission
async function processImageUrl(imageUrl: string): Promise<{ processedUrl: string, base64Data?: string }> {
    let processedUrl = imageUrl;
    let base64Data: string | undefined;

    if (imageUrl.startsWith('blob:')) {
        try {
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            base64Data = await blobToBase64(blob);
            processedUrl = ''; // Clear the URL since we're using base64
        } catch (error) {
            console.error("Failed to process image blob:", error);
            throw new Error("Failed to process image");
        }
    } else if (imageUrl.startsWith('data:image')) {
        // Already a base64 image
        base64Data = imageUrl;
        processedUrl = ''; // Clear the URL since we're using base64
    }

    return { processedUrl, base64Data };
}

// Handle the final model loading process that's common to both implementations
async function finalizeModelGeneration(
    modelUrl: string,
    isPersistentUrl: boolean,
    entity: GenerativeEntity,
    scene: BABYLON.Scene,
    gizmoManager: BABYLON.GizmoManager | null,
    derivedFromId: string,
    startTime: number
): Promise<GenerationResult> {
    // Log time
    const elapsedTime = performance.now() - startTime;
    const seconds = (elapsedTime / 1000).toFixed(2);
    console.log(`%c3D conversion completed in ${seconds} seconds`, "color: #4CAF50; font-weight: bold;");

    entity.setProcessingState("generating3D", "Starting 3D conversion...");

    // Load the model
    await loadModel(
        entity,
        modelUrl,
        scene,
        (progress) => {
            entity.setProcessingState("generating3D", progress.message);
        }
    );

    let persistentUrl = modelUrl;
    // if not persistent url, create a uuid and upload to GCP Storage
    if (!isPersistentUrl) {
        const uuid = uuidv4();
        persistentUrl = get3DModelPersistentUrl(uuid);
        upload3DModelToGCP(modelUrl, uuid);
    }

    // Add generation log
    const log = entity.addModelGenerationLog(persistentUrl, derivedFromId);

    entity.setProcessingState("idle", "");

    return { success: true, generationLog: log };
}

/**
 * Generate a 3D model from an image using the FAL AI Trellis API
 */
export async function generate3DModel_Trellis(
    imageUrl: string,
    entity: EntityBase,
    scene: BABYLON.Scene,
    gizmoManager: BABYLON.GizmoManager | null,
    derivedFromId: string,
    options: {
        prompt?: string;
    } = {}
): Promise<GenerationResult> {
    const entityType = entity.getEntityType();

    try {
        // Process image URL
        const { processedUrl } = await processImageUrl(imageUrl);

        // Set parameters based on entity type
        const params: any = {
            image_url: processedUrl,
            mesh_simplify: 0.9,
        };

        // Call the API
        entity.setProcessingState({
            isGenerating2D: false,
            isGenerating3D: true,
            progressMessage: 'Starting 3D conversion...'
        });

        const startTime = performance.now();

        let result: Result<TrellisOutput> | null = null;

        if (options.prompt === "_") {
            // Wait for 1 second
            await new Promise(resolve => setTimeout(resolve, 500));
            result = get3DSimulationData();
        } else {
            result = await fal.subscribe("fal-ai/trellis", {
                input: params,
                logs: true,
                onQueueUpdate: (update) => {
                    if (update.status === "IN_PROGRESS") {
                        const estimatedTime = Math.max(30000 - (performance.now() - startTime), 0);
                        const latestLog = `Processing... ${(estimatedTime / 1000).toFixed(1)}s est`;
                        entity.setProcessingState({
                            isGenerating2D: false,
                            isGenerating3D: true,
                            progressMessage: latestLog
                        });
                    }
                },
            });
        }

        // Return result
        if (result.data?.model_mesh?.url) {
            return finalizeModelGeneration(
                result.data.model_mesh.url,
                true,
                entity,
                scene,
                gizmoManager,
                derivedFromId,
                startTime
            );
        }

        throw new Error('No 3D model generated');
    } catch (error) {
        console.error("3D conversion failed:", error);
        entity.setProcessingState({
            isGenerating2D: false,
            isGenerating3D: false,
            progressMessage: 'Failed to generate 3D model'
        });
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
    entity: EntityBase,
    scene: BABYLON.Scene,
    gizmoManager: BABYLON.GizmoManager | null,
    derivedFromId: string,
    options: {
        prompt?: string;
    } = {}
): Promise<GenerationResult> {
    try {
        // Set entity to processing state
        entity.setProcessingState({
            isGenerating2D: false,
            isGenerating3D: true,
            progressMessage: 'Starting 3D conversion with RunPod...'
        });

        const startTime = performance.now();

        // Process image directly
        entity.setProcessingState({
            isGenerating2D: false,
            isGenerating3D: true,
            progressMessage: 'Processing image...'
        });

        console.log("Fetching image from:", imageUrl);
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        const base64Data = await blobToBase64(blob);
        const payload = { imageBase64: base64Data };

        console.log("Image processed, size:", Math.round(base64Data.length / 1024), "KB");

        entity.setProcessingState({
            isGenerating2D: false,
            isGenerating3D: true,
            progressMessage: 'Submitting...'
        });

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
        const maxAttempts = 300; // 5 minutes at 1-second intervals

        while (!completed && attempts < maxAttempts) {
            attempts++;

            // Update progress message with elapsed time
            const elapsedTime = performance.now() - startTime;
            const elapsedSeconds = (elapsedTime / 1000).toFixed(0);
            entity.setProcessingState({
                isGenerating2D: false,
                isGenerating3D: true,
                progressMessage: `Generating... (${elapsedSeconds}s)`
            });

            // Check job status
            const statusResponse = await fetch(`/api/runpod/status/${jobId}`);

            if (!statusResponse.ok) {
                console.warn(`Failed to check status, attempt ${attempts}: ${statusResponse.status}`);
                // Wait and try again
                await new Promise(resolve => setTimeout(resolve, 1000));
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
            await new Promise(resolve => setTimeout(resolve, 1000));
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

            // Instead of just creating a blob URL, let's save the model to a File object
            // with a .glb extension to help Babylon.js recognize the format
            const fileName = `model_${derivedFromId}.glb`;
            const file = new File([blob], fileName, { type: 'model/gltf-binary' });
            const modelUrl = URL.createObjectURL(file);

            console.log("Model converted to blob URL with filename:", fileName);

            // When we load the model later, we need to modify loadModel to handle blob URLs better
            return finalizeModelGeneration(
                modelUrl,
                false,
                entity,
                scene,
                gizmoManager,
                derivedFromId,
                startTime
            );
        }

        throw new Error('No 3D model data found in response');
    } catch (error) {
        console.error("RunPod 3D conversion failed:", error);
        entity.setProcessingState({
            isGenerating2D: false,
            isGenerating3D: false,
            progressMessage: `Failed to generate 3D model: ${(error as Error).message}`
        });
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

/**
 * Unified function to generate a 3D model using the specified API provider
 */
export async function generate3DModel(
    imageUrl: string,
    entity: EntityBase,
    scene: BABYLON.Scene,
    gizmoManager: BABYLON.GizmoManager | null,
    derivedFromId: string,
    options: {
        prompt?: string;
        apiProvider?: ModelApiProvider;
    } = {}
): Promise<GenerationResult> {
    // Default to Trellis if no provider specified
    const apiProvider = options.apiProvider || 'runpod';

    console.log(`Generating 3D model using ${apiProvider} API...`);

    // Call the appropriate provider's implementation
    switch (apiProvider) {
        case 'runpod':
            return generate3DModel_Runpod(
                imageUrl,
                entity,
                scene,
                gizmoManager,
                derivedFromId,
                { prompt: options.prompt }
            );

        case 'trellis':
        default:
            return generate3DModel_Trellis(
                imageUrl,
                entity,
                scene,
                gizmoManager,
                derivedFromId,
                { prompt: options.prompt }
            );
    }
}

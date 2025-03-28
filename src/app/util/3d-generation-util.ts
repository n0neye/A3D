import { fal, Result } from "@fal-ai/client";
import * as BABYLON from '@babylonjs/core';
import "@babylonjs/loaders/glTF";
import { get3DSimulationData, getImageSimulationData, isSimulating } from "./simulation-data";
import { EntityNode, AiObjectType, EntityType, applyImageToEntity, GenerationLog } from './extensions/entityNode';
import { GenerationResult } from "./realtime-generation-util";
import { TrellisOutput } from "@fal-ai/client/endpoints";
import { blobToBase64, ProgressCallback } from "./generation-util";


/**
 * Load a 3D model and replace the current mesh
 */
export async function loadModel(
    entity: EntityNode,
    modelUrl: string,
    scene: BABYLON.Scene,
    gizmoManager: BABYLON.GizmoManager | null,
    onProgress?: ProgressCallback
): Promise<boolean> {
    try {
        onProgress?.({ message: 'Downloading 3D model...' });

        // Load the model
        return new Promise((resolve) => {
            BABYLON.SceneLoader.ImportMesh("", modelUrl, "", scene,
                (meshes) => {
                    // If there's an existing model mesh, dispose it
                    if (entity.modelMesh) {
                        entity.modelMesh.dispose();
                        entity.modelMesh = null;
                    }

                    onProgress?.({ message: 'Processing 3D model...' });
                    console.log("replaceWithModel. meshes", meshes);

                    if (meshes.length > 0) {
                        console.log("meshes length", meshes.length);

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
                            if (mesh.material) {
                                // if PBRMaterial, set emissive 
                                if (mesh.material instanceof BABYLON.PBRMaterial) {
                                    const newPbrMaterial = mesh.material as BABYLON.PBRMaterial;
                                    newPbrMaterial.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5);
                                    newPbrMaterial.emissiveTexture = newPbrMaterial.albedoTexture;
                                    mesh.material = newPbrMaterial;
                                }
                            }
                        });


                        // Switch to 3D display mode
                        entity.setDisplayMode('3d');

                        // Attach gizmo to model
                        if (gizmoManager) {
                            gizmoManager.attachToMesh(rootModelMesh);
                        }

                        onProgress?.({ message: '3D model loaded successfully!' });
                        resolve(true);
                    } else {
                        onProgress?.({ message: 'Failed to load model' });
                        resolve(false);
                    }
                },
                (evt) => {
                    if (evt.lengthComputable) {
                        const progress = (evt.loaded / evt.total * 100).toFixed(0);
                        onProgress?.({ message: `Downloading: ${progress}%` });
                    }
                },
                (_, message) => {
                    onProgress?.({ message: `Error: ${message}` });
                    resolve(false);
                }
            );
        });
    } catch (error) {
        console.error("Failed to replace with model:", error);
        onProgress?.({ message: 'Failed to replace with model' });
        return false;
    }
}

/**
 * Generate a 3D model from an image using the FAL AI Trellis API
 */
export async function generate3DModel(
    imageUrl: string,
    entity: EntityNode,
    scene: BABYLON.Scene,
    gizmoManager: BABYLON.GizmoManager | null,
    derivedFromId: string,
    options: {
        prompt?: string;
    } = {}
): Promise<GenerationResult> {
    const entityType = entity.getEntityType();

    try {
        // Process image URL if it's a blob
        let processedImageUrl = imageUrl;
        if (imageUrl.startsWith('blob:')) {
            try {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                processedImageUrl = await blobToBase64(blob);
            } catch (error) {
                return { success: false, generationLog: null };
            }
        }

        // Set parameters based on entity type
        const params: any = {
            image_url: processedImageUrl,
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

        // Log time
        const elapsedTime = performance.now() - startTime;
        const seconds = (elapsedTime / 1000).toFixed(2);
        console.log("%c3D conversion completed in " + seconds + " seconds", "color: #4CAF50; font-weight: bold;");

        // Return result
        if (result.data?.model_mesh?.url) {
            await loadModel(
                entity,
                result.data.model_mesh.url,
                scene,
                gizmoManager,
                (progress) => {
                    entity.setProcessingState({
                        isGenerating2D: false,
                        isGenerating3D: true,
                        progressMessage: progress.message
                    });
                }
            );

            const log = entity.addModelGenerationLog(result.data.model_mesh.url, derivedFromId);

            entity.setProcessingState({
                isGenerating2D: false,
                isGenerating3D: false,
                progressMessage: ''
            });
            return { success: true, generationLog: log };
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

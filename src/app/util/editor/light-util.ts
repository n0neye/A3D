import * as BABYLON from '@babylonjs/core';
import { EditorEngine } from '@/app/engine/EditorEngine';

/**
 * Creates a shadow generator for a given light
 * @param light The light to create a shadow generator for
 * @param scene The Babylon.js scene
 * @returns The created shadow generator
 */
export const createShadowGenerator = (
    light: BABYLON.IShadowLight,
    scene: BABYLON.Scene
): BABYLON.ShadowGenerator => {
    console.log("Creating shadow generator for light", light);
    // Create with higher resolution for better quality
    const shadowGenerator = new BABYLON.ShadowGenerator(2048, light);

    // Better filtering technique for smoother shadows
    shadowGenerator.usePercentageCloserFiltering = true; // Use PCF instead of blur
    shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;

    // Fix self-shadowing artifacts with proper bias
    shadowGenerator.bias = 0.05

    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurScale = 0.5;

    // Add to our global list
    const environmentObjects = EditorEngine.getInstance().getEnvironmentManager().getEnvObjects();
    environmentObjects.shadowGenerators.push(shadowGenerator);

    return shadowGenerator;
};

/**
 * Adds a mesh to all shadow generators (to cast shadows)
 * @param mesh The mesh to add
 */
export const addMeshToShadowCasters = (mesh: BABYLON.AbstractMesh): void => {
    console.log("Adding mesh to shadow casters", mesh.name);
    const environmentObjects = EditorEngine.getInstance().getEnvironmentManager().getEnvObjects();
    environmentObjects.shadowGenerators.forEach(generator => {
        generator.addShadowCaster(mesh);
    });
};

/**
 * Configures a mesh to cast and receive shadows
 * @param mesh The mesh to configure
 */
export const setupMeshShadows = (mesh: BABYLON.AbstractMesh): void => {
    // Set mesh to receive shadows
    mesh.receiveShadows = true;

    // Add mesh to all shadow generators (to cast shadows)
    addMeshToShadowCasters(mesh);
};

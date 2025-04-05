import * as BABYLON from '@babylonjs/core';
import { environmentObjects } from './editor-util';
import { LightEntity, LightProps, SerializedColor } from '@/app/engine/entity//LightEntity';
import { EntityFactory } from '../../engine/utils/EntityFactory';

// export const createSunEntity = (scene: BABYLON.Scene) => {
//     // Create the light entity
//     const lightProps: LightProps = {
//         color: { r: 0.8, g: 0.9, b: 1.0 },
//         intensity: 0.3,
//         shadowEnabled: true
//     };
    
//     // Create the sunTransform entity
//     const sunTransform = EntityFactory.createEntity(scene, 'light', {
//         name: "sunTransform",
//         position: new BABYLON.Vector3(0, 5, 0),
//         lightProps
//     }) as LightEntity;

//     // Configure the light as directional
//     const sunLight = new BABYLON.DirectionalLight(
//         "sun", 
//         new BABYLON.Vector3(0.5, -0.5, -0.5).normalize(), 
//         scene
//     );
//     sunLight.intensity = lightProps.intensity;
//     sunLight.diffuse = new BABYLON.Color3(
//         lightProps.color.r,
//         lightProps.color.g,
//         lightProps.color.b
//     );
//     sunLight.shadowEnabled = lightProps.shadowEnabled;

//     // Replace the default point light with directional light
//     if (sunTransform.light) {
//         sunTransform.light.dispose();
//     }
//     sunTransform.light = sunLight;
//     sunLight.parent = sunTransform;

//     // Create a shadow generator for the sun with specialized settings
//     const sunShadowGenerator = createShadowGenerator(sunLight, scene);

//     // For directional lights, use Cascaded Shadow Maps for better quality
//     sunShadowGenerator.usePoissonSampling = true; // Better sampling
//     sunShadowGenerator.bias = 0.0001; // Adjust as needed
//     sunShadowGenerator.useBlurExponentialShadowMap = true;

//     environmentObjects.sun = sunLight;
//     environmentObjects.sunTransform = sunTransform;
// }

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
    environmentObjects.shadowGenerators.push(shadowGenerator);

    return shadowGenerator;
};

/**
 * Adds a mesh to all shadow generators (to cast shadows)
 * @param mesh The mesh to add
 */
export const addMeshToShadowCasters = (mesh: BABYLON.AbstractMesh): void => {
    console.log("Adding mesh to shadow casters", mesh.name);
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

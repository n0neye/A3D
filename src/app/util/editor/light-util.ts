import * as BABYLON from '@babylonjs/core';
import { environmentObjects } from './editor-util';
import { EntityBase } from '../extensions/entityNode';

export const createDefaultLights = (scene: BABYLON.Scene) => {
    // Create a default point light using our entity function
    createPointLightEntity(scene, {
        name: "ambientLight",
        position: new BABYLON.Vector3(0, 2, 2),
        intensity: 0.7,
        color: new BABYLON.Color3(1, 1, 1),
        shadowEnabled: true
    });

    return;
};

export const createSunEntity = (scene: BABYLON.Scene,) => {
    // Create a transform node to group the sun and arrow
    const sunTransform = new EntityBase("sunTransform", scene, "light");
    // Position the transform at an offset from the origin
    sunTransform.position = new BABYLON.Vector3(0, 5, 0);

    // Create a sun (directional light)
    const sunLight = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(0.5, -0.5, -0.5).normalize(), scene);
    sunLight.intensity = 0.3;
    sunLight.diffuse = new BABYLON.Color3(0.8, 0.9, 1);
    sunLight.shadowEnabled = true;

    // Create a shadow generator for the sun with specialized settings
    const sunShadowGenerator = createShadowGenerator(sunLight, scene);

    // For directional lights, use Cascaded Shadow Maps for better quality
    sunShadowGenerator.usePoissonSampling = true; // Better sampling
    sunShadowGenerator.bias = 0.0001; // Adjust as needed
    sunShadowGenerator.useBlurExponentialShadowMap = true;


    // If artifacts still persist, can use contact hardening shadow
    // sunShadowGenerator.useContactHardeningShadow = true;
    // sunShadowGenerator.contactHardeningLightSizeUVRatio = 0.02;

    // Parent the light to the transform node
    sunLight.parent = sunTransform;

    environmentObjects.sun = sunLight;
    environmentObjects.sunTransform = sunTransform;
}


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

/**
 * Creates a point light entity that includes both a light source and a visual representation
 * @param scene The Babylon.js scene
 * @param options Configuration options for the light entity
 * @returns An EntityBase representing the point light
 */
export const createPointLightEntity = (
    scene: BABYLON.Scene,
    options: {
        name?: string;
        position?: BABYLON.Vector3;
        intensity?: number;
        color?: BABYLON.Color3;
        shadowEnabled?: boolean;
    } = {}
): EntityBase => {
    // Default options
    const name = options.name || `pointLight-${Date.now()}`;
    const position = options.position || new BABYLON.Vector3(0, 2, 0);
    const intensity = options.intensity !== undefined ? options.intensity : 0.7;
    const baseColor = options.color || new BABYLON.Color3(1, 1, 1);
    const shadowEnabled = options.shadowEnabled !== undefined ? options.shadowEnabled : false;

    // Create the entity node of type 'light'
    const lightEntity = new EntityBase(name, scene, 'light', {
        position: position
    });

    // Initialize light properties in metadata
    lightEntity.metadata.lightProperties = {
        color: {
            r: baseColor.r,
            g: baseColor.g,
            b: baseColor.b
        },
        intensity: intensity,
        shadowEnabled: shadowEnabled
    };

    // Create the actual point light
    const pointLight = new BABYLON.PointLight(`${name}-light`, new BABYLON.Vector3(0, 0, 0), scene);
    pointLight.intensity = intensity;
    pointLight.diffuse = baseColor;
    pointLight.specular = baseColor;
    pointLight.shadowEnabled = shadowEnabled;
    pointLight.parent = lightEntity;

    // Create shadow generator if shadows are enabled
    if (shadowEnabled) {
        createShadowGenerator(pointLight, scene);
    }

    // Create a visual representation for the light (a glowing sphere)
    const lightSphere = BABYLON.MeshBuilder.CreateSphere(
        `${name}-visual`,
        { diameter: 0.2 },
        scene
    );
    
    // Create an emissive material for the sphere
    const lightMaterial = new BABYLON.StandardMaterial(`${name}-material`, scene);
    lightMaterial.emissiveColor = baseColor;
    lightMaterial.disableLighting = true;
    lightSphere.material = lightMaterial;
    
    // Make the sphere not cast shadows (it's just a visual indicator)
    lightSphere.receiveShadows = false;
    
    // Parent the sphere to the light entity
    lightSphere.parent = lightEntity;
    
    // Add metadata to connect the mesh to its entity
    lightSphere.metadata = { rootEntity: lightEntity };

    // Store references in the entity for easy access
    lightEntity.gizmoMesh = lightSphere;
    
    // Store the light in the environmentObjects for scene management
    environmentObjects.pointLights.push(pointLight);

    return lightEntity;
};


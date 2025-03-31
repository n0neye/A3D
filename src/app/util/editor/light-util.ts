import * as BABYLON from '@babylonjs/core';
import { environmentObjects } from './editor-util';
import { EntityNode } from '../extensions/entityNode';

export const createBasicLights = (scene: BABYLON.Scene) => {

    // Sun
    // createSunEntity(scene);


    // const ambientLight = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 2, 0), scene);
    const ambientLight = new BABYLON.PointLight("ambientLight", new BABYLON.Vector3(0, 2, 0), scene);
    ambientLight.position = new BABYLON.Vector3(0, 2, 2);
    ambientLight.intensity = 0.7; // Reduced to make shadows more visible
    ambientLight.diffuse = new BABYLON.Color3(1, 1, 1);
    ambientLight.specular = new BABYLON.Color3(1, 1, 1);
    ambientLight.shadowEnabled = true;
    createShadowGenerator(ambientLight, scene);
    environmentObjects.ambientLight = ambientLight;

    // const warmLight = new BABYLON.PointLight("warmLight", new BABYLON.Vector3(0, 1, 0), scene);
    // warmLight.position = new BABYLON.Vector3(0, 5, -0.5);
    // warmLight.intensity = 0.3;
    // warmLight.diffuse = new BABYLON.Color3(0.3, 0.5, 1);
    // warmLight.specular = warmLight.diffuse;
    // environmentObjects.pointLights.push(warmLight);

    // // Create two point lights with warm and cold colors
    // const warmLight = new BABYLON.PointLight("warmLight", new BABYLON.Vector3(0, 1, 0), scene);
    // warmLight.position = new BABYLON.Vector3(5, 2, 3);
    // warmLight.intensity = 0.5;
    // warmLight.diffuse = new BABYLON.Color3(1, 0.33, 0.33);
    // warmLight.specular = new BABYLON.Color3(1, 0.33, 0.33);
    // environmentObjects.pointLights.push(warmLight);
    // warmLight.shadowEnabled = true;
    // createShadowGenerator(warmLight, scene);

    // const coldLight = new BABYLON.PointLight("coldLight", new BABYLON.Vector3(0, 1, 0), scene);
    // coldLight.intensity = 0.5;
    // coldLight.position = new BABYLON.Vector3(-5, 2, 3);
    // coldLight.diffuse = new BABYLON.Color3(0, 0.5, 1);
    // coldLight.specular = new BABYLON.Color3(0, 0.5, 1);
    // environmentObjects.pointLights.push(coldLight);
    // coldLight.shadowEnabled = true;
    // createShadowGenerator(coldLight, scene);

    return;
};

export const createSunEntity = (scene: BABYLON.Scene,) => {
    // Create a transform node to group the sun and arrow
    const sunTransform = new EntityNode("sunTransform", scene, "light");
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
 * @returns An EntityNode representing the point light
 */
export const createPointLightEntity = (
    scene: BABYLON.Scene,
    options: {
        name?: string;
        position?: BABYLON.Vector3;
        intensity?: number;
        diffuseColor?: BABYLON.Color3;
        specularColor?: BABYLON.Color3;
        radius?: number;
        shadowEnabled?: boolean;
    } = {}
): EntityNode => {
    // Default options
    const name = options.name || `pointLight-${Date.now()}`;
    const position = options.position || new BABYLON.Vector3(0, 2, 0);
    const intensity = options.intensity !== undefined ? options.intensity : 0.7;
    const diffuseColor = options.diffuseColor || new BABYLON.Color3(1, 1, 1);
    const specularColor = options.specularColor || diffuseColor.clone();
    const radius = options.radius || 0.2;
    const shadowEnabled = options.shadowEnabled !== undefined ? options.shadowEnabled : true;

    // Create the entity node of type 'light'
    const lightEntity = new EntityNode(name, scene, 'light', {
        position: position
    });

    // Create the actual point light
    const pointLight = new BABYLON.PointLight(`${name}-light`, new BABYLON.Vector3(0, 0, 0), scene);
    pointLight.intensity = intensity;
    pointLight.diffuse = diffuseColor;
    pointLight.specular = specularColor;
    pointLight.shadowEnabled = shadowEnabled;
    pointLight.parent = lightEntity;

    // Create shadow generator if shadows are enabled
    if (shadowEnabled) {
        createShadowGenerator(pointLight, scene);
    }

    // Create a visual representation for the light (a glowing sphere)
    const lightSphere = BABYLON.MeshBuilder.CreateSphere(
        `${name}-visual`,
        { diameter: radius * 2 },
        scene
    );
    
    // Create an emissive material for the sphere
    const lightMaterial = new BABYLON.StandardMaterial(`${name}-material`, scene);
    lightMaterial.emissiveColor = diffuseColor;
    lightMaterial.disableLighting = true;
    lightSphere.material = lightMaterial;
    
    // Make the sphere not cast shadows (it's just a visual indicator)
    lightSphere.receiveShadows = false;
    
    // Parent the sphere to the light entity
    lightSphere.parent = lightEntity;
    
    // Add metadata to connect the mesh to its entity
    lightSphere.metadata = { rootEntity: lightEntity };

    // Store references in the entity for easy access
    lightEntity.planeMesh = lightSphere;
    
    // Store the light in the environmentObjects for scene management
    environmentObjects.pointLights.push(pointLight);

    return lightEntity;
};


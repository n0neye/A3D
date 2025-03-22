import * as BABYLON from "@babylonjs/core";
import { GridMaterial } from "@babylonjs/materials/grid";
import { createEntity, EntityNode } from "../extensions/entityNode";

// Store environment objects
export interface EnvironmentObjects {
    sun?: BABYLON.DirectionalLight;
    sunTransform?: BABYLON.TransformNode;
    sunArrow?: BABYLON.Mesh;
    ambientLight?: BABYLON.HemisphericLight;
    skybox?: BABYLON.Mesh;
    background?: BABYLON.Mesh;
    grid?: BABYLON.Mesh;
}

// Global environment reference
const environmentObjects: EnvironmentObjects = {};

export const getEnvironmentObjects = (): EnvironmentObjects => {
    return environmentObjects;
};


export const initScene = (canvas: HTMLCanvasElement, scene: BABYLON.Scene) => {
    // Camera
    const camera = new BABYLON.ArcRotateCamera(
        "camera",
        -Math.PI / 2,
        Math.PI / 2.5,
        3,
        new BABYLON.Vector3(0, 0, 0),
        scene
    );
    camera.wheelPrecision = 40;
    camera.panningSensibility = 1000;
    camera.angularSensibilityX = 500;
    camera.angularSensibilityY = 500;
    camera.lowerRadiusLimit = 1;
    camera.upperRadiusLimit = 20;
    camera.attachControl(canvas, true);
    camera.position = new BABYLON.Vector3(0, 0, 2);

    // Ambient Light
    scene.ambientColor = new BABYLON.Color3(1, 1, 1);

    // Sun
    // createSunEntity(scene);

    // Create a background entity
    createEntity(scene, "aiObject", {
        aiObjectType: "background",
        imageUrl: "./demoAssets/skybox/qwantani_puresky_4k.jpg"
    });

    // Create world grid
    createWorldGrid(scene, 20, 10);
}


/**
 * Creates an equirectangular skybox (more suitable for 21:9 panoramic images)
 * @param scene The Babylon.js scene 
 * @param url URL to the equirectangular image
 * @returns The created skybox dome
 */
export const createEquirectangularSkybox = (
    scene: BABYLON.Scene,
    url: string,
): BABYLON.Mesh => {
    // Create a large dome for the skybox
    const skyDome = BABYLON.MeshBuilder.CreateSphere(
        "skyDome",
        {
            diameter: 1000,
            segments: 32,
            sideOrientation: BABYLON.Mesh.BACKSIDE
        },
        scene
    );


    // Flip the skybox
    skyDome.rotation.x = Math.PI;

    // Create material
    const skyMaterial = new BABYLON.StandardMaterial("skyMaterial", scene);
    skyMaterial.backFaceCulling = false;
    skyMaterial.disableLighting = true;

    // Create texture
    const skyTexture = new BABYLON.Texture(url, scene);
    skyMaterial.emissiveTexture = skyTexture;
    // skyTexture.proje

    // Apply material
    skyDome.material = skyMaterial;

    // Move the skybox with the camera
    scene.onBeforeRenderObservable.add(() => {
        if (scene.activeCamera) {
            skyDome.position.copyFrom(scene.activeCamera.position);
        }
    });

    return skyDome;
};

/**
 * Creates a 2D background that fills the viewport while maintaining image aspect ratio
 * @param scene The Babylon.js scene
 * @param url URL to the background image
 * @returns The created background plane
 */
export const create2DBackground = (
    scene: BABYLON.Scene,
    url: string,
): BABYLON.Mesh => {
    if (!scene.activeCamera) {
        throw new Error("Scene must have an active camera");
    }

    // Create a large plane for the background
    const background = BABYLON.MeshBuilder.CreatePlane(
        "background",
        {
            width: 1,
            height: 1,
            sideOrientation: BABYLON.Mesh.FRONTSIDE
        },
        scene
    );

    // CRITICAL: Ensure background renders behind everything by setting these properties
    background.renderingGroupId = 0; // Render in first group (renders before group 1)

    // Create material
    const bgMaterial = new BABYLON.StandardMaterial("backgroundMaterial", scene);
    bgMaterial.backFaceCulling = false;
    bgMaterial.disableLighting = true;
    bgMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);

    // Disable depth writing to ensure it stays in background
    bgMaterial.disableDepthWrite = true;

    // Create texture and maintain aspect ratio
    const bgTexture = new BABYLON.Texture(url, scene);
    bgTexture.hasAlpha = true;
    bgMaterial.diffuseTexture = bgTexture;
    bgMaterial.emissiveTexture = bgTexture;
    bgMaterial.useAlphaFromDiffuseTexture = true;

    // Apply material
    background.material = bgMaterial;

    // Position it far away initially
    const farDistance = scene.activeCamera.maxZ * 0.99;

    // Function to update the background size and position
    const updateBackground = () => {
        if (!scene.activeCamera) return;

        // Get engine size
        const engine = scene.getEngine();
        const viewportWidth = engine.getRenderWidth();
        const viewportHeight = engine.getRenderHeight();
        const viewportAspectRatio = viewportWidth / viewportHeight;

        // Get texture aspect ratio
        const textureWidth = bgTexture.getSize().width || 1;
        const textureHeight = bgTexture.getSize().height || 1;
        const textureAspectRatio = textureWidth / textureHeight;

        if (scene.activeCamera instanceof BABYLON.ArcRotateCamera) {
            const camera = scene.activeCamera as BABYLON.ArcRotateCamera;

            // Calculate the FOV
            const fov = camera.fov || (Math.PI / 4);

            // Calculate visible height at far distance
            const visibleHeightAtDistance = 2 * Math.tan(fov / 2) * farDistance;
            const visibleWidthAtDistance = visibleHeightAtDistance * viewportAspectRatio;

            // Get camera direction
            const direction = camera.getDirection(BABYLON.Vector3.Forward());

            // Position the background at the far clip plane
            background.position = camera.position.add(direction.scale(farDistance));

            // Orient to face the camera
            background.lookAt(camera.position);

            // Scale to fill view
            let scaleX, scaleY;
            if (textureAspectRatio > viewportAspectRatio) {
                // Image is wider than viewport
                scaleY = visibleHeightAtDistance;
                scaleX = scaleY * textureAspectRatio;
            } else {
                // Image is taller than viewport
                scaleX = visibleWidthAtDistance;
                scaleY = scaleX / textureAspectRatio;
            }

            // Add 20% margin for full coverage
            const coverageFactor = 1.1;
            background.scaling.x = scaleX * coverageFactor;
            background.scaling.y = scaleY * coverageFactor;
        } else {
            // Similar logic for other camera types
            // ... (rest of the code)
        }
    };

    // Initial setup
    updateBackground();

    // Update when needed
    window.addEventListener('resize', updateBackground);
    scene.onBeforeRenderObservable.add(updateBackground);

    // Clean up
    background.onDisposeObservable.add(() => {
        window.removeEventListener('resize', updateBackground);
        scene.onBeforeRenderObservable.removeCallback(updateBackground);
    });

    return background;
};

/**
 * Creates a world floor grid to help with spatial orientation
 * @param scene The Babylon.js scene
 * @param size The size of the grid
 * @param majorUnitFrequency How often to show major grid lines
 * @returns The created grid mesh
 */
export const createWorldGrid = (
    scene: BABYLON.Scene,
    size: number = 100,
    majorUnitFrequency: number = 10
): BABYLON.Mesh => {
    // Create a ground mesh for the grid
    const gridGround = BABYLON.MeshBuilder.CreateGround(
        "worldGrid",
        { width: size, height: size, subdivisions: 1 },
        scene
    );
    gridGround.position.y = -0.5;
    
    // Create a grid material
    const gridMaterial = new GridMaterial("gridMaterial", scene);
    gridMaterial.majorUnitFrequency = majorUnitFrequency;
    gridMaterial.minorUnitVisibility = 0.45;
    gridMaterial.gridRatio = 1;
    gridMaterial.backFaceCulling = false;
    gridMaterial.mainColor = new BABYLON.Color3(0.2, 0.2, 0.3);
    gridMaterial.lineColor = new BABYLON.Color3(0.0, 0.7, 1.0);
    gridMaterial.opacity = 0.8;
    
    // Apply the material to the grid
    gridGround.material = gridMaterial;
    
    // Set grid to be non-pickable and not receive shadows
    gridGround.isPickable = false;
    gridGround.receiveShadows = false;
    
    // Store in environment objects
    environmentObjects.grid = gridGround;
    
    return gridGround;
};

// Create an arrow to visualize direction
const createDirectionalArrow = (scene: BABYLON.Scene, size: number = 1): BABYLON.Mesh => {
    // Create a custom arrow shape
    const arrowMesh = new BABYLON.Mesh("sunArrow", scene);

    // Create the arrow shaft (cylinder)
    const shaft = BABYLON.MeshBuilder.CreateCylinder(
        "sunArrow-shaft",
        {
            height: size * 0.8,
            diameter: size * 0.1,
            tessellation: 8
        },
        scene
    );

    // Create the arrowhead (cone)
    const head = BABYLON.MeshBuilder.CreateCylinder(
        "sunArrow-head",
        {
            height: size * 0.2,
            diameterTop: 0,
            diameterBottom: size * 0.2,
            tessellation: 8
        },
        scene
    );

    // Position the arrowhead at the end of the shaft
    head.position.y = size * 0.5; // Half of shaft height + half of cone height

    // Parent the parts to the main mesh
    shaft.parent = arrowMesh;
    head.parent = arrowMesh;

    // Create the material for the arrow
    const arrowMaterial = new BABYLON.StandardMaterial("sunArrow-material", scene);
    arrowMaterial.emissiveColor = new BABYLON.Color3(1, 0.8, 0);
    arrowMaterial.disableLighting = true;

    // Apply the material to the parts
    shaft.material = arrowMaterial;
    head.material = arrowMaterial;

    // Rotate to align with the direction of the light
    // The arrow will point in the opposite direction of the light
    // (since light goes from source to target, but we want to show direction)
    arrowMesh.rotation.x = Math.PI;

    return arrowMesh;
};

export const createSunEntity = (scene: BABYLON.Scene,) => {
    // Create a transform node to group the sun and arrow
    const sunTransform = new EntityNode("sunTransform", scene, "light");
    // Position the transform at an offset from the origin
    sunTransform.position = new BABYLON.Vector3(0, 0.5, 0);

    // Create a sun (directional light)
    const sunLight = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(0.5, -0.5, -0.5).normalize(), scene);
    sunLight.intensity = 1;
    sunLight.diffuse = new BABYLON.Color3(1, 0.8, 0.5); // Warm sunlight color
    // Parent the light to the transform node
    sunLight.parent = sunTransform;

    // Create directional arrow for sun visualization
    const sunArrow = createDirectionalArrow(scene, 1);
    sunArrow.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
    // Parent the arrow to the transform node
    sunArrow.parent = sunTransform;

    environmentObjects.sun = sunLight;
    environmentObjects.sunTransform = sunTransform;
    environmentObjects.sunArrow = sunArrow;

}
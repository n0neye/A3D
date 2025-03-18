import * as BABYLON from "@babylonjs/core";
import { createEntity } from "../extensions/entityNode";

export const initScene = (canvas: HTMLCanvasElement, scene: BABYLON.Scene) => {

    // Camera
    const camera = new BABYLON.ArcRotateCamera(
        "camera",
        -Math.PI / 2,
        Math.PI / 2.5,
        3,
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
    camera.wheelPrecision = 40;
    camera.panningSensibility = 1000;
    camera.angularSensibilityX = 500;
    camera.angularSensibilityY = 500;
    camera.lowerRadiusLimit = 1;
    camera.upperRadiusLimit = 20;
    camera.attachControl(canvas, true);

    // Light
    const light = new BABYLON.HemisphericLight(
        "light",
        new BABYLON.Vector3(0, 1, 0),
        scene
    );
    light.intensity = 0.7;

    //   Create a sun

    // createEquirectangularSkybox(scene, "./demoAssets/skybox/sunsetforest.webp");
    // create2DBackground(scene, "./demoAssets/skybox/sunsetforest.webp");

    createEntity(scene, "aiObject", {
        aiObjectType: "background",
        imageUrl: "./demoAssets/skybox/sunsetforest.webp"
    });
}


/**
 * Creates an equirectangular skybox (more suitable for 21:9 panoramic images)
 * @param scene The Babylon.js scene 
 * @param url URL to the equirectangular image
 * @returns The created skybox dome
 */
export const createEquirectangularSkybox = (
    scene: BABYLON.Scene,
    url: string = "https://playground.babylonjs.com/textures/equirectangular.jpg"
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
    url: string
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
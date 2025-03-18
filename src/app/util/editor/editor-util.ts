import * as BABYLON from "@babylonjs/core";

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
    create2DBackground(scene, "./demoAssets/skybox/sunsetforest.webp");
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
    
    // Make sure this renders behind everything else
    // background.layerMask = 0x10000000;
    
    // Create material
    const bgMaterial = new BABYLON.StandardMaterial("backgroundMaterial", scene);
    bgMaterial.backFaceCulling = false;
    bgMaterial.disableLighting = true;
    
    // Create texture and maintain aspect ratio
    const bgTexture = new BABYLON.Texture(url, scene);
    bgTexture.hasAlpha = true;
    bgMaterial.diffuseTexture = bgTexture;
    bgMaterial.emissiveTexture = bgTexture;
    bgMaterial.useAlphaFromDiffuseTexture = true;
    
    // Apply material
    background.material = bgMaterial;
    
    // Function to update the background size and position
    const updateBackgroundSize = () => {
        if (!scene.activeCamera) return;
        
        // Get engine size
        const engine = scene.getEngine();
        const aspectRatio = engine.getAspectRatio(scene.activeCamera);
        
        // Check for texture size to maintain image aspect ratio
        const textureAspectRatio = bgTexture.getSize().width / bgTexture.getSize().height;
        
        // Determine how to scale the background
        let width, height;
        if (textureAspectRatio > aspectRatio) {
            // Image is wider than viewport - match height
            height = 2.0;
            width = height * textureAspectRatio;
        } else {
            // Image is taller than viewport - match width
            width = 2.0 * aspectRatio;
            height = width / textureAspectRatio;
        }

        const finalScaler = 1;
        
        // Scale the background
        background.scaling.x = width * finalScaler;
        background.scaling.y = height * finalScaler;
        
        // Position in front of camera
        if (scene.activeCamera instanceof BABYLON.ArcRotateCamera) {
            // For ArcRotateCamera, the position is the target
            const camera = scene.activeCamera as BABYLON.ArcRotateCamera;
            background.position.copyFrom(camera.target);
            
            // Orient towards camera
            const direction = camera.position.subtract(camera.target).normalize();
            
            // Get the distance from the center to ensure it's behind other content
            const distance = camera.radius * 0.9;
            
            // Offset in the opposite direction of the camera
            background.position.subtractInPlace(direction.scale(distance));
            
            // Orient to face the camera
            background.lookAt(camera.position);
        } else {
            // For other camera types, maintain a fixed distance behind the camera
            const distance = 10; // Arbitrary distance behind the camera
            const forward = scene.activeCamera.getDirection(BABYLON.Vector3.Forward());
            background.position.copyFrom(scene.activeCamera.position);
            background.position.subtractInPlace(forward.scale(distance));
            
            // Orient to face the camera
            background.lookAt(scene.activeCamera.position);
        }
    };
    
    // Initial setup
    updateBackgroundSize();
    
    // Update the background when the window is resized
    window.addEventListener('resize', updateBackgroundSize);
    
    // Update the background when the camera moves
    scene.onBeforeRenderObservable.add(updateBackgroundSize);
    
    // Clean up when the background is disposed
    background.onDisposeObservable.add(() => {
        window.removeEventListener('resize', updateBackgroundSize);
        scene.onBeforeRenderObservable.removeCallback(updateBackgroundSize);
    });
    
    return background;
};
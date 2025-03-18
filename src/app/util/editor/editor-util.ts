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

      createEquirectangularSkybox(scene, "./demoAssets/skybox/sunsetforest.webp");
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
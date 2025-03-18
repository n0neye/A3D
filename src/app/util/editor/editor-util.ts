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

}
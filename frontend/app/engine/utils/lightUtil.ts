import * as THREE from 'three';
import { EditorEngine } from '@/engine/core/EditorEngine';

/**
 * Configures a renderer for shadows
 * @param renderer The Three.js renderer
 */
export const setupRendererForShadows = (renderer: THREE.WebGLRenderer): void => {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Default soft shadow map
};

/**
 * Configures shadow properties for a light
 * @param light The light to configure
 */
export const setupLightShadows = (
  light: THREE.Light
): void => {
  // Only proceed if the light can cast shadows
  if (!(light instanceof THREE.DirectionalLight || 
        light instanceof THREE.PointLight || 
        light instanceof THREE.SpotLight)) {
    return;
  }
  
  light.castShadow = true;
  
  // Configure shadow properties based on light type
  if (light.shadow) {
    // High resolution shadow maps
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    
    // Configure near/far planes for the shadow camera
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 100;
    
    // Fix shadow acne with appropriate bias
    light.shadow.bias = -0.005;
    
    // Soft shadows
    light.shadow.radius = 2;
    light.shadow.blurSamples = 8;
    
    // Special handling for directional lights
    if (light instanceof THREE.DirectionalLight) {
      // Wider shadow camera for directional lights to cover more area
      light.shadow.camera.left = -20;
      light.shadow.camera.right = 20;
      light.shadow.camera.top = 20;
      light.shadow.camera.bottom = -20;
    }
  }
};

/**
 * Configures a mesh to cast and receive shadows
 * @param mesh The mesh to configure
 */
export const setupMeshShadows = (mesh: THREE.Mesh): void => {
  // Set mesh to cast and receive shadows
  mesh.castShadow = true;
  mesh.receiveShadow = true;
};

import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { FileService } from '../services/FileService/FileService';
import { setupMeshShadows } from './lightUtil';

export interface ModelLoadingProgress {
  message?: string;
  percentage?: number;
}

export interface ModelLoadResult {
  rootMesh: THREE.Object3D;
  animations: THREE.AnimationClip[];
  format: 'gltf' | 'fbx';
  originalUrl: string;
}

/**
 * Unified function to load 3D models from various sources and formats
 * 
 * @param modelUrl URL to the model (can be remote URL or file:// protocol)
 * @param onProgress Optional callback for loading progress updates
 * @returns Promise resolving to the loaded model result
 */
export async function loadModelFromUrl(
  modelUrl: string,
  onProgress?: (progress: ModelLoadingProgress) => void
): Promise<ModelLoadResult> {
  try {
    onProgress?.({ message: 'Determining model type...' });

    // Determine file format based on extension
    const fileExtension = modelUrl.toLowerCase().split('.').pop() || '';
    const isFbx = fileExtension === 'fbx';
    
    // Get file manager to handle local vs remote files
    const fileService = FileService.getInstance();
    const isLocalFile = fileService.isLocalFile(modelUrl);

    if (isFbx) {
      return await loadFbxModel(modelUrl, isLocalFile, onProgress);
    } else {
      return await loadGltfModel(modelUrl, isLocalFile, onProgress);
    }
  } catch (error) {
    console.error("Error loading 3D model:", error);
    throw new Error(`Failed to load model: ${(error as Error).message}`);
  }
}

/**
 * Load a GLTF/GLB model
 */
async function loadGltfModel(
  modelUrl: string, 
  isLocalFile: boolean,
  onProgress?: (progress: ModelLoadingProgress) => void
): Promise<ModelLoadResult> {
  onProgress?.({ message: 'Loading GLTF/GLB model...' });
  
  const loader = new GLTFLoader();
  let gltf: GLTF;

  if (isLocalFile && window.electron?.readFile) {
    try {
      // Get model data through file worker
      const modelData = await FileService.getInstance().readFile(modelUrl);
      
      // Parse the model data
      gltf = await new Promise<GLTF>((resolve, reject) => {
        loader.parse(
          modelData,
          '', // Base path, not needed when loading from memory
          (gltf) => resolve(gltf),
          (error) => reject(error)
        );
      });
    } catch (error) {
      console.error("Failed to load local GLTF model:", error);
      throw error;
    }
  } else {
    // Standard URL loading
    gltf = await new Promise<GLTF>((resolve, reject) => {
      loader.load(
        modelUrl,
        (gltf) => resolve(gltf),
        (xhr) => {
          if (xhr.lengthComputable) {
            const percentage = Math.round((xhr.loaded / xhr.total) * 100);
            onProgress?.({ message: `Downloading: ${percentage}%`, percentage });
          }
        },
        (error) => reject(error)
      );
    });
  }

  onProgress?.({ message: 'Processing model...' });
  
  // Apply standard processing to the model
  processLoadedModel(gltf.scene);
  
  return {
    rootMesh: gltf.scene,
    animations: gltf.animations || [],
    format: 'gltf',
    originalUrl: modelUrl
  };
}

/**
 * Load an FBX model
 */
async function loadFbxModel(
  modelUrl: string, 
  isLocalFile: boolean,
  onProgress?: (progress: ModelLoadingProgress) => void
): Promise<ModelLoadResult> {
  onProgress?.({ message: 'Loading FBX model...' });
  
  const loader = new FBXLoader();
  let fbxModel: THREE.Group;

  if (isLocalFile && window.electron?.readFile) {
    try {
      
      // Get model data through file worker
      const modelData = await FileService.getInstance().readFile(modelUrl);
      
      // FBXLoader doesn't have a parse method, create a blob URL
      const blob = new Blob([modelData]);
      const blobUrl = URL.createObjectURL(blob);
      
      // Load the model from the blob URL
      fbxModel = await new Promise<THREE.Group>((resolve, reject) => {
        loader.load(
          blobUrl,
          (model) => resolve(model),
          (xhr) => {
            if (xhr.lengthComputable) {
              const percentage = Math.round((xhr.loaded / xhr.total) * 100);
              onProgress?.({ message: `Parsing: ${percentage}%`, percentage });
            }
          },
          (error) => reject(error)
        );
      });
      
      // Clean up the blob URL
      URL.revokeObjectURL(blobUrl);
      
    } catch (error) {
      console.error("Failed to load local FBX model:", error);
      throw error;
    }
  } else {
    // Standard URL loading
    fbxModel = await new Promise<THREE.Group>((resolve, reject) => {
      loader.load(
        modelUrl,
        (model) => resolve(model),
        (xhr) => {
          if (xhr.lengthComputable) {
            const percentage = Math.round((xhr.loaded / xhr.total) * 100);
            onProgress?.({ message: `Downloading: ${percentage}%`, percentage });
          }
        },
        (error) => reject(error)
      );
    });
  }

  onProgress?.({ message: 'Processing FBX model...' });
  
  // Scale the model down to a more manageable size (common for FBX files)
  fbxModel.scale.set(0.01, 0.01, 0.01);
  
  // Apply standard processing to the model
  processLoadedModel(fbxModel);
  
  return {
    rootMesh: fbxModel,
    animations: fbxModel.animations || [],
    format: 'fbx',
    originalUrl: modelUrl
  };
}

/**
 * Process a loaded model with common operations
 * @param model The loaded 3D model
 */
function processLoadedModel(model: THREE.Object3D): void {
  // Center the model based on its bounding box
  const boundingBox = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  boundingBox.getCenter(center);
  
  // Adjust the position to put the bottom center at the pivot point
  model.position.set(
    model.position.x,         // Center horizontally
    -boundingBox.min.y,       // Bottom at the pivot point
    model.position.z          // Center depth-wise
  );

  // Set up shadows for all meshes
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      setupMeshShadows(child);
    }
  });
}

/**
 * Find a skinned mesh in a model if it exists
 * @param model The model to search for skinned meshes
 * @returns The first skinned mesh found, or undefined if none exists
 */
export function findSkinnedMesh(model: THREE.Object3D): THREE.SkinnedMesh | undefined {
  let skinnedMesh: THREE.SkinnedMesh | undefined;
  
  model.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh && !skinnedMesh) {
      skinnedMesh = child;
    }
  });
  
  return skinnedMesh;
}

/**
 * Determine if a model has a valid skeleton that can be used for animation
 * @param model The model to check
 * @returns Whether the model has a valid skeleton
 */
export function hasValidSkeleton(model: THREE.Object3D): boolean {
  const skinnedMesh = findSkinnedMesh(model);
  return !!skinnedMesh?.skeleton?.bones?.length;
}

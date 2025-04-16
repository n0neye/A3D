import { v4 as uuidv4 } from 'uuid';
import * as THREE from 'three';
import { EntityBase, SerializedEntityData } from '../base/EntityBase';
import { setupMeshShadows } from '@/app/engine/utils/lightUtil';
import { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { ProgressCallback } from '@/app/engine/utils/generation/generation-util';
import { CharacterEntity } from './CharacterEntity';

/**
 * Entity type specifically for imported 3D models
 */
export interface Basic3DEntityProps {
  modelUrl: string;
  modelFormat: '3d' | 'glb' | 'gltf' | 'fbx';
  originalFileName?: string;
}

// Add serialized data interface
export interface SerializedBasic3DEntityData extends SerializedEntityData {
  props: Basic3DEntityProps;
}

export class Basic3DEntity extends EntityBase {
  // Basic3DEntity specific properties
  props: Basic3DEntityProps;
  modelMesh?: THREE.Object3D;
  isLoaded: boolean = false;
  loadError?: string;

  constructor(
    name: string,
    scene: THREE.Scene,
    data: SerializedBasic3DEntityData,
    onLoaded?: (entity: Basic3DEntity) => void
  ) {
    super(name, scene, 'basic3D', data);

    this.props = data.props;
    this.isLoaded = false;

    // Load the 3D model
    this.loadModel(this.props.modelUrl, scene, (progress) => {
      console.log(`Loading model: ${progress.message || 'in progress...'}`);
    }).then(() => {
      console.log(`Basic3DEntity: model loaded`, this.name, this.uuid);
      this.isLoaded = true;
      onLoaded?.(this);
    }).catch(error => {
      console.error(`Error loading model:`, error);
      this.loadError = error.message || 'Failed to load model';
      // Still call onLoaded so the entity is created even if model fails
      this.isLoaded = false;
      onLoaded?.(this);
    });
  }

  /**
   * Load a 3D model based on the file format
   */
  async loadModel(
    modelUrl: string,
    scene: THREE.Scene,
    onProgress?: ProgressCallback
  ): Promise<boolean> {
    try {
      onProgress?.({ message: 'Downloading 3D model...' });
      console.log("loadModel", modelUrl);

      // Determine loader based on file format
      const fileExtension = modelUrl.toLowerCase().split('.').pop() || '';
      
      if (fileExtension === 'fbx') {
        return await this.loadFBXModel(modelUrl, scene, onProgress);
      } else {
        // Default to GLB/GLTF for other formats
        return await this.loadGLTFModel(modelUrl, scene, onProgress);
      }
    } catch (error) {
      console.error("Failed to load model:", error);
      onProgress?.({ message: `Failed to load model: ${(error as Error).message}` });
      throw error;
    }
  }

  /**
   * Load GLB/GLTF format models
   */
  private async loadGLTFModel(
    modelUrl: string,
    scene: THREE.Scene,
    onProgress?: ProgressCallback
  ): Promise<boolean> {
    try {
      // Load the model using GLTFLoader
      const loader = new GLTFLoader();
      
      // Handle local file:// URLs using Electron's IPC bridge
      if (modelUrl.startsWith('file://') && window.electron?.readFile) {
        console.log('Loading local model via IPC:', modelUrl);
        
        try {
          // Get model data through IPC
          const modelData = await window.electron.readFile(modelUrl);
          
          // Create a promise wrapper for the async load from array buffer
          const gltf = await new Promise<GLTF>((resolve, reject) => {
            loader.parse(
              modelData,
              '', // Base path, not needed when loading from memory
              (gltf) => resolve(gltf),
              (error) => reject(error)
            );
          });
          
          // Process the loaded model
          return await this.processLoadedGLTF(gltf, onProgress);
        } catch (error) {
          console.error("Failed to load local model:", error);
          onProgress?.({ message: `Failed to load local model: ${(error as Error).message}` });
          throw error;
        }
      } else {
        // Standard URL loading
        // Create a promise wrapper for the async load
        const gltf = await new Promise<GLTF>((resolve, reject) => {
          loader.load(
            modelUrl,
            (gltf) => resolve(gltf),
            (xhr) => {
              if (xhr.lengthComputable) {
                const progress = Math.round((xhr.loaded / xhr.total) * 100);
                onProgress?.({ message: `Downloading: ${progress}%` });
              }
            },
            (error) => reject(error)
          );
        });
        
        // Process the loaded model
        return await this.processLoadedGLTF(gltf, onProgress);
      }
    } catch (error) {
      console.error("Failed to load GLTF model:", error);
      onProgress?.({ message: `Failed to load GLTF model: ${(error as Error).message}` });
      throw error;
    }
  }

  /**
   * Process a loaded GLTF model
   */
  private async processLoadedGLTF(
    gltf: GLTF,
    onProgress?: ProgressCallback
  ): Promise<boolean> {
    try {
      onProgress?.({ message: 'Processing model...' });
      
      // Extract the scene from the GLTF
      const newModel = gltf.scene;
      this.add(newModel);

      // Set model mesh in entity
      this.modelMesh = newModel;

      // Position the model on the pivot point
      // Calculate the bounding box to center the model
      const boundingBox = new THREE.Box3().setFromObject(newModel);
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);
      const size = new THREE.Vector3();
      boundingBox.getSize(size);

      // Adjust the position to put the bottom center at the pivot point
      newModel.position.set(
        newModel.position.x,          // Center horizontally
        -boundingBox.min.y,           // Bottom at the pivot point
        newModel.position.z           // Center depth-wise
      );

      // Setup shadows for all meshes
      newModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          setupMeshShadows(child);
          child.userData = { rootSelectable: this };
        }
      });

      onProgress?.({ message: '3D model loaded successfully!' });
      return true;
    } catch (error) {
      console.error("Failed to process GLTF model:", error);
      onProgress?.({ message: `Failed to process model: ${(error as Error).message}` });
      throw error;
    }
  }

  /**
   * Load FBX format models
   */
  private async loadFBXModel(
    modelUrl: string,
    scene: THREE.Scene,
    onProgress?: ProgressCallback
  ): Promise<boolean> {
    try {
      // Load the model using FBXLoader
      const loader = new FBXLoader();
      
      // Handle local file:// URLs using Electron's IPC bridge
      if (modelUrl.startsWith('file://') && window.electron?.readFile) {
        console.log('Loading local FBX model via IPC:', modelUrl);
        
        try {
          // Get model data through IPC
          const modelData = await window.electron.readFile(modelUrl);
          
          // FBXLoader doesn't have a parse method that takes ArrayBuffer directly
          // We need to create a blob URL as a workaround
          const blob = new Blob([modelData]);
          const blobUrl = URL.createObjectURL(blob);
          
          // Load the model from the blob URL
          const fbxModel = await new Promise<THREE.Group>((resolve, reject) => {
            loader.load(
              blobUrl,
              (model) => resolve(model),
              (xhr) => {
                if (xhr.lengthComputable) {
                  const progress = Math.round((xhr.loaded / xhr.total) * 100);
                  onProgress?.({ message: `Parsing: ${progress}%` });
                }
              },
              (error) => reject(error)
            );
          });
          
          // Clean up the blob URL
          URL.revokeObjectURL(blobUrl);
          
          // Process the loaded model
          return await this.processLoadedFBX(fbxModel, onProgress);
        } catch (error) {
          console.error("Failed to load local FBX model:", error);
          onProgress?.({ message: `Failed to load local FBX model: ${(error as Error).message}` });
          throw error;
        }
      } else {
        // Standard URL loading
        const fbxModel = await new Promise<THREE.Group>((resolve, reject) => {
          loader.load(
            modelUrl,
            (model) => resolve(model),
            (xhr) => {
              if (xhr.lengthComputable) {
                const progress = Math.round((xhr.loaded / xhr.total) * 100);
                onProgress?.({ message: `Downloading: ${progress}%` });
              }
            },
            (error) => reject(error)
          );
        });
        
        // Process the loaded model
        return await this.processLoadedFBX(fbxModel, onProgress);
      }
    } catch (error) {
      console.error("Failed to load FBX model:", error);
      onProgress?.({ message: `Failed to load FBX model: ${(error as Error).message}` });
      throw error;
    }
  }

  /**
   * Process a loaded FBX model
   */
  private async processLoadedFBX(
    fbxModel: THREE.Group,
    onProgress?: ProgressCallback
  ): Promise<boolean> {
    try {
      onProgress?.({ message: 'Processing FBX model...' });
      
      // Add the model to the entity
      this.add(fbxModel);

      // Set model mesh in entity
      this.modelMesh = fbxModel;

      // Scale the model down to a more manageable size
      this.modelMesh.scale.set(0.01, 0.01, 0.01);

      // Position the model on the pivot point
      // Calculate the bounding box to center the model
      const boundingBox = new THREE.Box3().setFromObject(fbxModel);
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);
      const size = new THREE.Vector3();
      boundingBox.getSize(size);

      // Adjust the position to put the bottom center at the pivot point
      fbxModel.position.set(
        fbxModel.position.x,          // Center horizontally
        -boundingBox.min.y,           // Bottom at the pivot point
        fbxModel.position.z           // Center depth-wise
      );

      // Setup shadows for all meshes
      fbxModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          setupMeshShadows(child);
          child.userData = { rootSelectable: this };
        }
      });

      onProgress?.({ message: 'FBX model loaded successfully!' });
      return true;
    } catch (error) {
      console.error("Failed to process FBX model:", error);
      onProgress?.({ message: `Failed to process model: ${(error as Error).message}` });
      throw error;
    }
  }

  /**
   * Get the primary mesh for selection and manipulation
   */
  getPrimaryMesh(): THREE.Object3D | undefined {
    return this.modelMesh;
  }

  /**
   * Serialize with entity-specific properties
   */
  serialize(): SerializedBasic3DEntityData {
    const base = super.serialize();
    return {
      ...base,
      props: this.props,
    };
  }

  /**
   * Clean up resources when entity is removed
   */
  dispose(): void {
    // Clean up materials and geometries
    if (this.modelMesh) {
      this.modelMesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    }

    super.dispose();
  }


  // Check skeleton
  public findSkinnedMesh(): THREE.SkinnedMesh | undefined {
    const result = this.modelMesh?.children.find(child => child instanceof THREE.SkinnedMesh);
    console.log("findSkinnedMesh", result, result?.skeleton?.bones.length);
    return result;
  }

  public convertToCharacterEntity(): CharacterEntity {
    console.log("convertToCharacterEntity", this.name, this.uuid);
    const scene = this.engine.getScene();
    const characterEntity = new CharacterEntity(scene, this.name, {
      entityType: "character",
      characterProps: {
        url: this.props.modelUrl,
      },
      uuid: uuidv4(),
      name: this.name
    }, (entity) => {
      console.log("convertToCharacterEntity done", entity.name, entity.uuid);
      // dispose this entity
      this.dispose();
    });
    return characterEntity;
  }
}

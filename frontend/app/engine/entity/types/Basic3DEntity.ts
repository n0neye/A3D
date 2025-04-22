import { v4 as uuidv4 } from 'uuid';
import * as THREE from 'three';
import { EntityBase, SerializedEntityData } from '../base/EntityBase';
import { loadModelFromUrl, hasValidSkeleton } from '@/engine/utils/3dModelUtils';
import { ProgressCallback } from '@/engine/utils/generation/generation-util';
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
  modelAnimations: THREE.AnimationClip[] = [];

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
   * Load a 3D model using the unified loading utility
   */
  async loadModel(
    modelUrl: string,
    scene: THREE.Scene,
    onProgress?: ProgressCallback
  ): Promise<boolean> {
    try {
      const result = await loadModelFromUrl(modelUrl, (progress) => {
        onProgress?.({ message: progress.message || 'in progress...' });
      });
      
      // Store the result
      this.modelMesh = result.rootMesh;
      this.modelAnimations = result.animations;
      
      // Add the model to this entity
      this.add(this.modelMesh);
      
      // Set up user data for selection
      this.modelMesh.traverse((child) => {
        if (child instanceof THREE.Object3D) {
          child.userData = { rootSelectable: this };
        }
      });
      
      return true;
    } catch (error) {
      console.error("Failed to load model:", error);
      onProgress?.({ message: `Failed to load model: ${(error as Error).message}` });
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

  // Check if model has a skeleton
  public findSkinnedMesh(): THREE.SkinnedMesh | undefined {
    if (!this.modelMesh) return undefined;
    
    let result: THREE.SkinnedMesh | undefined;
    this.modelMesh.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh && !result) {
        result = child;
      }
    });
    
    console.log("findSkinnedMesh", result, result?.skeleton?.bones.length);
    return result;
  }

  public convertToCharacterEntity(): CharacterEntity {
    console.log("convertToCharacterEntity", this.name, this.uuid);
    const scene = this.engine.getScene();
    const characterEntity = new CharacterEntity(scene, this.name, {
      entityType: "character",
      characterProps: {
        modelUrl: this.props.modelUrl,
      },
      uuid: uuidv4(),
      name: this.name
    }, (entity) => {
      console.log("convertToCharacterEntity done", entity.name, entity.uuid);
      // dispose this entity
      this.delete();
    });
    return characterEntity;
  }
}

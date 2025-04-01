import * as BABYLON from '@babylonjs/core';
import { EntityBase } from './EntityBase';
import { ImageRatio, ProgressCallback } from '../generation-util';
import { v4 as uuidv4 } from 'uuid';
import { defaultPBRMaterial, placeholderMaterial } from '../editor/material-util';
import { setupMeshShadows } from '../editor/light-util';
/**
 * Entity that represents AI-generated content
 */

export interface GenerativeEntityProps {
  generationLogs: GenerationLog[];
  currentGenerationId?: string;
}
// Asset types
export type AssetType = 'image' | 'model';

// Processing states
export type GenerationState = 'idle' | 'generating2D' | 'generating3D' | 'error';

export interface GenerationLog {
  id: string;
  timestamp: number;
  prompt: string;

  // Asset type and URLs
  assetType: AssetType;
  fileUrl?: string;

  // If model is derived from image
  derivedFromId?: string;

  // Generation parameters
  imageParams?: {
    negativePrompt?: string;
    ratio: ImageRatio;
  }
}

export class GenerativeEntity extends EntityBase {

  // EntityBase properties
  props: GenerativeEntityProps;

  modelMesh?: BABYLON.Mesh;
  placeholderMesh: BABYLON.Mesh;

  status: GenerationState;
  statusMessage: string;

  temp_prompt: string;
  temp_ratio: ImageRatio;

  public readonly onProgress = new EventHandler<{ entity: EntityBase, state: GenerationState, message: string }>();
  getGenerationState(): GenerationState {
    return this.status;
  }

  constructor(
    name: string,
    scene: BABYLON.Scene,
    options: {
      id?: string;
      position?: BABYLON.Vector3;
      rotation?: BABYLON.Vector3;
      props: GenerativeEntityProps;
    }
  ) {
    super(name, scene, 'generative', {
      id: options.id,
      position: options.position,
      rotation: options.rotation,
    });

    // Create initial props
    this.placeholderMesh = BABYLON.MeshBuilder.CreatePlane("placeholder", { size: 1 }, scene);
    this.props = {
      generationLogs: options.props.generationLogs,
    };

    this.status = 'idle';
    this.statusMessage = '';
    this.temp_prompt = '';
    this.temp_ratio = '1:1';
  }

  setDisplayMode(mode: "3d" | "2d"): void {
    if (mode === "3d" && this.modelMesh) {
      this.modelMesh.isVisible = true;
      this.placeholderMesh.isVisible = false;
    } else {
      if (this.modelMesh) this.modelMesh.isVisible = false;
      this.placeholderMesh.isVisible = true;
    }
  }

  addModelGenerationLog(modelUrl: string, derivedFromId?: string): GenerationLog {
    const log: GenerationLog = {
      id: uuidv4(),
      timestamp: Date.now(),
      prompt: '',
      assetType: 'model',
      fileUrl: modelUrl,
      derivedFromId: derivedFromId
    }
    this.props.generationLogs.push(log);
    return log;
  }

  addImageGenerationLog(prompt: string, imageUrl: string, ratio: ImageRatio): GenerationLog {
    const log: GenerationLog = {
      id: uuidv4(),
      timestamp: Date.now(),
      prompt: prompt,
      assetType: 'image',
      fileUrl: imageUrl,
      imageParams: {
        ratio: ratio
      }
    }
    this.props.generationLogs.push(log);
    return log;
  }

  /**
   * Get current generation data
   */
  getCurrentGenerationLog(): GenerationLog | null {
    return this.props.generationLogs.find(log => log.id === this.props.currentGenerationId) || null;
  }

  /**
   * Set the processing state
   */
  setProcessingState(state: GenerationState, message?: string): void {
    this.status = state;
    this.statusMessage = message || '';
  }

  // Apply image to entity
  async applyGeneratedImage(
    imageUrl: string,
    scene: BABYLON.Scene,
    ratio?: ImageRatio
  ): Promise<boolean> {
    // Get the plane mesh
    const planeMesh = this.placeholderMesh;
    if (!planeMesh) return false;

    if (planeMesh.material === placeholderMaterial) {
      // Create material
      const newMaterial = new BABYLON.StandardMaterial(`${name}-material`, scene);
      newMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
      newMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
      newMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
      newMaterial.backFaceCulling = false;
      planeMesh.material = newMaterial;
    }

    console.log('applyImageToEntity', imageUrl);

    if (ratio) {
      const { width, height } = getPlaneSize(ratio);
      planeMesh.scaling = new BABYLON.Vector3(width, height, 1);
    }

    // Download the image
    const response = await fetch(imageUrl);

    // Check content type for PNG
    const contentType = response.headers.get('content-type');
    const isPotentiallyTransparent = contentType && contentType.includes('png');

    // convert to blob data url
    const imageBlob = await response.blob();
    const imageDataUrl = URL.createObjectURL(imageBlob);

    // For regular objects, update the material texture
    let material = planeMesh.material as BABYLON.StandardMaterial;
    if (!material || !(material instanceof BABYLON.StandardMaterial)) {
      material = new BABYLON.StandardMaterial(`${this.name}-material`, scene);
    }
    if (material) {
      // Create a new texture
      const texture = new BABYLON.Texture(imageDataUrl, scene);

      // Apply texture to the material
      material.diffuseTexture = texture;
      material.emissiveTexture = texture;

      // If the image is a PNG, check for transparency
      if (isPotentiallyTransparent) {
        console.log('isPotentiallyTransparent', isPotentiallyTransparent);

        // Set material to handle transparency
        material.diffuseTexture.hasAlpha = true;
        material.useAlphaFromDiffuseTexture = true;
        material.backFaceCulling = false;
        material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
        material.needDepthPrePass = false;

        // For best rendering quality with transparent textures
        planeMesh.renderingGroupId = 1; // Render after opaque objects
      } else {
        // Reset transparency settings if the image is not a PNG
        material.useAlphaFromDiffuseTexture = false;
        material.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;
        planeMesh.renderingGroupId = 0;
      }

    }

    // Switch to 2D display mode
    this.setDisplayMode('2d');
    return true;
  }


  // Apply a specific generation log 
  public async applyGenerationLog(log: GenerationLog): Promise<void> {

    console.log("applyGenerationLog", log);

    // Set as current state
    this.props.currentGenerationId = log.id;

    // Apply based on asset type
    if (log.assetType === 'image' && log.fileUrl) {
      // For image assets, apply the image to the entity
      this.applyGeneratedImage(log.fileUrl, this.getScene(), log.imageParams?.ratio);
    } else if (log.assetType === 'model' && log.fileUrl) {
      // For model assets, we need to set 3D display mode
      // (Assuming the model is already loaded and attached to this entity)
      await loadModel(this, log.fileUrl, this.getScene(), (progress) => {
        console.log("loadModel progress", progress);
      });
      this.setDisplayMode('3d');
    }
  }

  // Update aspect ratio of the entity
  public updateAspectRatio(ratio: ImageRatio): void {
    if (!this.placeholderMesh) return;

    // Save the new ratio in metadata
    this.temp_ratio = ratio;

    // Get the new dimensions based on ratio
    const { width, height } = getPlaneSize(ratio);
    this.placeholderMesh.scaling = new BABYLON.Vector3(width, height, 1);
  }


  /**
   * Serialize with generative-specific properties
   */
  serialize(): any {
    const base = super.serialize();
    return {
      ...base,
      props: this.props,
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.modelMesh) {
      this.modelMesh.dispose();
    }
    super.dispose();
  }
}



// Helper functions
function getPlaneSize(ratio: ImageRatio): { width: number, height: number } {
  switch (ratio) {
    case '16:9':
      return { width: 1.6, height: 0.9 };
    case '9:16':
      return { width: 0.9, height: 1.6 };
    case '4:3':
      return { width: 1.33, height: 1 };
    case '3:4':
      return { width: 1, height: 1.33 };
    default: // 1:1
      return { width: 1, height: 1 };
  }
}


// Event handler class to provide add/remove interface
export class EventHandler<T> {
  private handlers: Set<(data: T) => void> = new Set();

  public add(handler: (data: T) => void): void {
    this.handlers.add(handler);
  }

  public remove(handler: (data: T) => void): void {
    this.handlers.delete(handler);
  }

  public trigger(data: T): void {
    this.handlers.forEach(handler => handler(data));
  }
}

/**
 * Load a 3D model and replace the current mesh
 */
export async function loadModel(
  entity: GenerativeEntity,
  modelUrl: string,
  scene: BABYLON.Scene,
  onProgress?: ProgressCallback
): Promise<boolean> {
  try {
    onProgress?.({ message: 'Downloading 3D model...' });

    console.log("loadModel", modelUrl);

    // Load the model
    const result = await BABYLON.ImportMeshAsync(
      modelUrl,
      scene,
      {
        onProgress: (progressEvent) => {
          if (progressEvent.lengthComputable) {
            const progress = (progressEvent.loaded / progressEvent.total * 100).toFixed(0);
            onProgress?.({ message: `Downloading: ${progress}%` });
          }
        },
        pluginExtension: ".glb",
        name: "_.glb"
      }
    );

    const meshes = result.meshes;

    // If there's an existing model mesh, dispose it
    if (entity.modelMesh) {
      entity.modelMesh.dispose();
    }

    onProgress?.({ message: 'Generating...' });
    console.log("loadModel: replaceWithModel. meshes", meshes);

    if (meshes.length > 0) {
      console.log("loadModel: meshes length", meshes.length);

      // Create a root container mesh if needed
      let rootModelMesh: BABYLON.Mesh;

      if (meshes.length === 1) {
        rootModelMesh = meshes[0] as BABYLON.Mesh;
      } else {
        // Create a dummy mesh as the container
        rootModelMesh = new BABYLON.Mesh(`${entity.name}-model-root`, scene);
        meshes.forEach((mesh) => {
          mesh.parent = rootModelMesh;
        });
      }

      // Parent the root model to the entity
      rootModelMesh.parent = entity;

      // Set up the model mesh in the entity
      entity.modelMesh = rootModelMesh;

      // Set metadata on all meshes
      meshes.forEach((mesh) => {
        mesh.metadata = {
          ...mesh.metadata,
          rootEntity: entity
        };
      });

      // Find all materials
      meshes.forEach((mesh) => {
        mesh.material = defaultPBRMaterial;
        console.log("loadModel: Applied default material", mesh.material.name, mesh.material);
      });

      // Switch to 3D display mode
      entity.setDisplayMode('3d');

      setupMeshShadows(entity.modelMesh);

      onProgress?.({ message: '3D model loaded successfully!' });
      return true;
    } else {
      throw new Error('No meshes found');
    }
  } catch (error) {
    console.error("Failed to replace with model:", error);
    onProgress?.({ message: `Failed to replace with model: ${(error as Error).message}` });
    return false;
  }
}

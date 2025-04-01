import * as BABYLON from '@babylonjs/core';
import { EntityBase } from './EntityBase';
import { ImageRatio } from '../generation-util';
import { v4 as uuidv4 } from 'uuid';
import { placeholderMaterial } from '../editor/material-util';
/**
 * Entity that represents AI-generated content
 */

export interface GenerativeEntityProps {
  generationLogs: GenerationLog[];
  currentGenerationIdx?: number;
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
  // GenerativeEntity specific properties
  modelMesh?: BABYLON.Mesh;
  placeholderMesh: BABYLON.Mesh;
  generationState: GenerationState;
  generationStateMessage: string;
  props: GenerativeEntityProps;

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
      currentGenerationIdx: 0
    };

    this.generationState = 'idle';
    this.generationStateMessage = '';
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
  getCurrentGeneration(): GenerationLog | null {
    return this.props.generationLogs.length > 0 ? this.props.generationLogs[this.props.currentGenerationIdx || 0] : null;
  }

  /**
   * Set the processing state
   */
  setProcessingState(state: GenerationState, message?: string): void {
    this.generationState = state;
    this.generationStateMessage = message || '';
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
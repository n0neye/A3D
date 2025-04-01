import * as BABYLON from '@babylonjs/core';
import { EntityBase } from './EntityBase';
import { ImageRatio } from '../generation-util';

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
  modelMeshRoot: BABYLON.Node | null;
  placeholderMesh: BABYLON.Mesh;
  generationState: GenerationState;
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
    this.modelMeshRoot = null;
    this.placeholderMesh = BABYLON.MeshBuilder.CreatePlane("placeholder", { size: 1 }, scene);
    this.props = {
      generationLogs: options.props.generationLogs,
      currentGenerationIdx: 0
    };

    this.generationState = 'idle';
  }
  
  
  /**
   * Set generation data for this entity
   */
  setGenerationData(generation: GenerationLog): void {
    this.props.generationLogs.push(generation);
  }
  
  /**
   * Get current generation data
   */
  getCurrentGeneration(): GenerationLog | null {
    return this.props.generationLogs.length > 0 ? this.props.generationLogs[this.props.currentGenerationIdx || 0] : null;
  }
  
  /**
   * Get the processing state
   */
  getProcessingState(): GenerationState {
    return this.generationState;
  }
  
  /**
   * Set the processing state
   */
  setProcessingState(state: GenerationState): void {
    this.generationState = state;
  }
  

  /**
   * Apply a texture to this entity
   */
  applyTexture(textureUrl: string): Promise<void> {
    // Implementation for applying texture
    return Promise.resolve();
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
    if (this.modelMeshRoot) {
      this.modelMeshRoot.dispose();
    }
    super.dispose();
  }
} 
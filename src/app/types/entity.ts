import * as BABYLON from '@babylonjs/core';
import { v4 as uuidv4 } from 'uuid';

// Entity types and metadata structures
export type EntityType = 'aiObject' | 'character' | 'light' | 'skybox' | 'background' | 'terrain';
export type ImageRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
export type ImageSize = 'small' | 'medium' | 'large' | 'xl';

// Map of image sizes to actual dimensions
export const IMAGE_SIZE_MAP = {
  small: 512,
  medium: 768,
  large: 1024,
  xl: 1536
};

// Map of ratios to width/height multipliers
export const RATIO_MAP = {
  '1:1': { width: 1, height: 1 },
  '16:9': { width: 16, height: 9 },
  '9:16': { width: 9, height: 16 },
  '4:3': { width: 4, height: 3 },
  '3:4': { width: 3, height: 4 }
};

// Entity metadata structure
export interface EntityMetadata {
  entityType: EntityType;
  displayName?: string;
  created: Date;
  lastImageUrl?: string;
  
  // Add progress tracking
  processingState?: {
    isGenerating: boolean;
    isConverting: boolean;
    progressMessage: string;
  };
  
  // For AI generated entities
  aiData?: {
    stage: 'image' | '3dModel';
    currentStateId: string | null;
    ratio: ImageRatio;
    imageSize: ImageSize;
    
    generationHistory: Array<{
      id: string;
      timestamp: number;
      prompt: string;
      
      // Asset type and URLs
      assetType: 'image' | 'model';
      imageUrl?: string;
      modelUrl?: string;
      
      // If model is derived from image
      derivedFromId?: string;
      
      // Generation parameters
      ratio: ImageRatio;
      imageSize: ImageSize;
      generationParams?: Record<string, any>;
      
      // User metadata
      notes?: string;
      favorite?: boolean;
    }>;
  };
}

// Custom Entity Class that extends TransformNode
export class EntityNode extends BABYLON.TransformNode {
  public metadata: EntityMetadata;
  private _primaryMesh: BABYLON.AbstractMesh | null = null;
  
  constructor(
    name: string, 
    scene: BABYLON.Scene, 
    type: EntityType = 'aiObject',
    options: {
      position?: BABYLON.Vector3;
      ratio?: ImageRatio;
      imageSize?: ImageSize;
    } = {}
  ) {
    super(name, scene);
    
    // Set position if provided
    if (options.position) {
      this.position = options.position;
    }
    
    // Initialize metadata
    this.metadata = {
      entityType: type,
      displayName: name,
      created: new Date()
    };
    
    // Add AI data for AI entities
    if (['aiObject', 'character', 'skybox', 'background'].includes(type)) {
      this.metadata.aiData = {
        stage: 'image',
        currentStateId: null,
        ratio: options.ratio || '1:1',
        imageSize: options.imageSize || 'medium',
        generationHistory: []
      };
    }
  }
  
  // Getters and Setters
  public get primaryMesh(): BABYLON.AbstractMesh | null {
    if (this.displayMode === '3d' && this.modelMesh) {
        return this.modelMesh;
      }
      return this.planeMesh;
  }
  
  public set primaryMesh(mesh: BABYLON.AbstractMesh | null) {
    this._primaryMesh = mesh;
    if (mesh) {
      mesh.metadata = {
        ...mesh.metadata,
        rootEntity: this
      };
    }
  }
  
  // Type methods
  public get entityType(): EntityType {
    return this.metadata.entityType;
  }
  
  // AI Data methods
  public getAIData(): EntityMetadata['aiData'] | null {
    return this.metadata.aiData || null;
  }
  
  public getCurrentGeneration(): any | null {
    const aiData = this.getAIData();
    if (!aiData || !aiData.currentStateId) return null;
    
    return aiData.generationHistory.find(gen => gen.id === aiData.currentStateId) || null;
  }
  
  public addGenerationToHistory(
    prompt: string, 
    imageUrl: string, 
    options: {
      ratio: ImageRatio;
      imageSize: ImageSize;
      generationParams?: any;
    }
  ): any {
    // Create AI data if it doesn't exist
    if (!this.metadata.aiData) {
      this.metadata.aiData = {
        stage: 'image',
        currentStateId: null,
        ratio: options.ratio,
        imageSize: options.imageSize,
        generationHistory: []
      };
    }
    
    // Create new generation entry with explicit 'image' literal type
    const newGeneration = {
      id: uuidv4(),
      timestamp: Date.now(),
      prompt,
      assetType: 'image' as const, // Force literal type
      imageUrl,
      ratio: options.ratio,
      imageSize: options.imageSize,
      generationParams: options.generationParams || {}
    };
    
    // Add to history
    this.metadata.aiData.generationHistory.push(newGeneration);
    this.metadata.aiData.currentStateId = newGeneration.id;
    this.metadata.aiData.stage = 'image';
    this.metadata.aiData.ratio = options.ratio;
    this.metadata.aiData.imageSize = options.imageSize;
    
    return newGeneration;
  }
  
  public addModelToHistory(modelUrl: string, derivedFromId: string): any {
    // Early check, but TypeScript doesn't track this through to later usage
    if (!this.getAIData()) return null;
    
    // Get and store a reference to aiData to avoid undefined issues
    const aiData = this.metadata.aiData!; // Use non-null assertion after the check
    
    // Find the source generation
    const sourceGen = aiData.generationHistory.find(gen => gen.id === derivedFromId);
    if (!sourceGen) return null;
    
    // Create new model generation entry
    const newGeneration = {
      id: uuidv4(),
      timestamp: Date.now(),
      prompt: sourceGen.prompt,
      assetType: 'model' as const,
      modelUrl,
      derivedFromId,
      ratio: sourceGen.ratio,
      imageSize: sourceGen.imageSize,
      generationParams: sourceGen.generationParams
    };
    
    // Add to history using the reference
    aiData.generationHistory.push(newGeneration);
    aiData.currentStateId = newGeneration.id;
    aiData.stage = '3dModel';
    
    return newGeneration;
  }
  
  // Proxy methods for convenient access to mesh properties
  public getBoundingInfo(): BABYLON.BoundingInfo | null {
    return this.primaryMesh?.getBoundingInfo() || null;
  }
  
  // Add these methods to EntityNode class
  public setGeneratingState(isGenerating: boolean, message: string = ''): void {
    if (!this.metadata.processingState) {
      this.metadata.processingState = {
        isGenerating: false,
        isConverting: false,
        progressMessage: ''
      };
    }
    
    this.metadata.processingState.isGenerating = isGenerating;
    this.metadata.processingState.progressMessage = message;
  }
  
  public setConvertingState(isConverting: boolean, message: string = ''): void {
    if (!this.metadata.processingState) {
      this.metadata.processingState = {
        isGenerating: false,
        isConverting: false,
        progressMessage: ''
      };
    }
    
    this.metadata.processingState.isConverting = isConverting;
    this.metadata.processingState.progressMessage = message;
  }
  
  public getProcessingState(): {isGenerating: boolean; isConverting: boolean; progressMessage: string} {
    return this.metadata.processingState || {
      isGenerating: false,
      isConverting: false,
      progressMessage: ''
    };
  }
}

// Type guard function
export function isEntity(node: BABYLON.Node): node is EntityNode {
  return node instanceof EntityNode;
} 
import * as BABYLON from '@babylonjs/core';
import { v4 as uuidv4 } from 'uuid';
import { EntityNode, EntityType, EntityMetadata, ImageRatio, ImageSize, isEntity } from '../types/entity';

// Entity resolution functions
export function getEntityFromMesh(mesh: BABYLON.AbstractMesh): EntityNode | null {
  return mesh?.metadata?.parentEntity as EntityNode || null;
}

export function getPrimaryMeshFromEntity(entity: EntityNode | BABYLON.TransformNode): BABYLON.AbstractMesh | null {
  if (isEntity(entity)) {
    return entity.primaryMesh;
  }
  
  // Legacy fallback for TransformNode
  return entity?.metadata?.primaryMesh || 
         (entity?.getChildMeshes?.(false)[0] as BABYLON.AbstractMesh) || 
         null;
}

export function resolveEntity(node: BABYLON.Node): EntityNode | null {
  if (isEntity(node)) {
    return node;
  }
  
  if (node instanceof BABYLON.AbstractMesh && node.metadata?.parentEntity) {
    return node.metadata.parentEntity as EntityNode;
  }
  
  return null;
}

// Extend the BABYLON namespace to add our methods
declare module '@babylonjs/core/Meshes/transformNode' {
  export interface TransformNode {
    // Entity metadata getters/setters
    isEntity(): boolean;
    getEntityType(): EntityType | null;
    getEntityMetadata(): EntityMetadata | null;
    
    // For AI entities
    getAIData(): EntityMetadata['aiData'] | null;
    getCurrentGeneration(): any | null;
    
    // Add new generation to history
    addGenerationToHistory(prompt: string, imageUrl: string, options: {
      ratio: ImageRatio;
      imageSize: ImageSize;
      generationParams?: any;
    }): any;
    
    // Convert to 3D model
    addModelToHistory(modelUrl: string, derivedFromId: string): any;
    
    // Get primary display mesh
    getDisplayMesh(): BABYLON.AbstractMesh | null;
    
    // Proxy methods that redirect to the primary mesh
    getBoundingInfo(): BABYLON.BoundingInfo | null;
  }
}

// Implement proxy methods for TransformNode
BABYLON.TransformNode.prototype.getDisplayMesh = function(): BABYLON.AbstractMesh | null {
  return this.metadata?.primaryMesh || 
         (this.getChildMeshes?.(false)[0] as BABYLON.AbstractMesh) || 
         null;
};

BABYLON.TransformNode.prototype.getBoundingInfo = function(): BABYLON.BoundingInfo | null {
  const mesh = this.getDisplayMesh();
  return mesh ? mesh.getBoundingInfo() : null;
};

// Implement the extension methods
BABYLON.TransformNode.prototype.isEntity = function(): boolean {
  return this.metadata?.entityType !== undefined;
};

BABYLON.TransformNode.prototype.getEntityType = function(): EntityType | null {
  return this.isEntity() ? this.metadata.entityType : null;
};

BABYLON.TransformNode.prototype.getEntityMetadata = function(): EntityMetadata | null {
  return this.isEntity() ? this.metadata : null;
};

BABYLON.TransformNode.prototype.getAIData = function() {
  return this.isEntity() && this.metadata.aiData ? this.metadata.aiData : null;
};

BABYLON.TransformNode.prototype.getCurrentGeneration = function() {
  const aiData = this.getAIData();
  if (!aiData || !aiData.currentStateId) return null;
  
  return aiData.generationHistory.find(gen => gen.id === aiData.currentStateId) || null;
};

BABYLON.TransformNode.prototype.addGenerationToHistory = function(
  prompt: string, 
  imageUrl: string, 
  options: {
    ratio: ImageRatio;
    imageSize: ImageSize;
    generationParams?: any;
  }
) {
  if (!this.isEntity()) return null;
  
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
  
  // Create new generation entry
  const newGeneration = {
    id: uuidv4(),
    timestamp: Date.now(),
    prompt,
    assetType: 'image',
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
};

BABYLON.TransformNode.prototype.addModelToHistory = function(modelUrl: string, derivedFromId: string) {
  if (!this.isEntity() || !this.getAIData()) return null;
  
  // Find the source generation
  const sourceGen = this.getAIData()?.generationHistory.find(gen => gen.id === derivedFromId);
  if (!sourceGen) return null;
  
  // Create new model generation entry
  const newGeneration = {
    id: uuidv4(),
    timestamp: Date.now(),
    prompt: sourceGen.prompt,
    assetType: 'model',
    modelUrl,
    derivedFromId,
    ratio: sourceGen.ratio,
    imageSize: sourceGen.imageSize,
    generationParams: sourceGen.generationParams
  };
  
  // Add to history
  this.metadata.aiData.generationHistory.push(newGeneration);
  this.metadata.aiData.currentStateId = newGeneration.id;
  this.metadata.aiData.stage = '3dModel';
  
  return newGeneration;
};

// Entity creation functions
export function createEntity(
  scene: BABYLON.Scene, 
  type: EntityType = 'aiObject',
  options: {
    position?: BABYLON.Vector3;
    ratio?: ImageRatio;
    imageSize?: ImageSize;
    name?: string;
  } = {}
): EntityNode {
  const name = options.name || `${type}-${uuidv4().substring(0, 8)}`;
  
  // Create entity object
  const entity = new EntityNode(name, scene, type, options);
  
  // Create child mesh based on entity type
  let childMesh: BABYLON.Mesh;
  
  switch (type) {
    case 'character':
      childMesh = BABYLON.MeshBuilder.CreatePlane(`${name}-mesh`, { 
        width: 1, 
        height: 2 
      }, scene);
      break;
    
    case 'skybox':
      childMesh = BABYLON.MeshBuilder.CreateSphere(`${name}-mesh`, { 
        diameter: 1000,
        segments: 32,
        sideOrientation: BABYLON.Mesh.BACKSIDE
      }, scene);
      break;
    
    case 'background':
      childMesh = BABYLON.MeshBuilder.CreatePlane(`${name}-mesh`, { 
        width: 10, 
        height: 5 
      }, scene);
      break;
    
    case 'terrain':
      childMesh = BABYLON.MeshBuilder.CreateGround(`${name}-mesh`, {
        width: 10,
        height: 10,
        subdivisions: 32
      }, scene);
      break;
    
    default: // aiObject
      // Create a plane with the right aspect ratio
      const ratio = options.ratio || '1:1';
      const { width, height } = getPlaneSize(ratio);
      
      childMesh = BABYLON.MeshBuilder.CreatePlane(`${name}-mesh`, { 
        width, 
        height 
      }, scene);
  }
  
  // Create default material
  const material = new BABYLON.StandardMaterial(`${name}-material`, scene);
  material.diffuseColor = new BABYLON.Color3(1, 1, 1);
  material.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
  material.backFaceCulling = false;
  childMesh.material = material;
  
  // Parent the mesh to the entity
  childMesh.parent = entity;
  
  // Set as primary mesh
  entity.primaryMesh = childMesh;
  
  return entity;
}

// Helper function to get size based on ratio
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

// Apply image to entity
export function applyImageToEntity(
  entity: EntityNode | BABYLON.TransformNode,
  imageUrl: string,
  scene: BABYLON.Scene
): void {
  // Get the primary mesh
  const childMesh = isEntity(entity) ? entity.primaryMesh : getPrimaryMeshFromEntity(entity);
  
  if (!childMesh) return;
  
  // Get or create material
  let material = childMesh.material as BABYLON.StandardMaterial;
  if (!material || !(material instanceof BABYLON.StandardMaterial)) {
    material = new BABYLON.StandardMaterial(`${entity.name}-material`, scene);
    material.backFaceCulling = false;
    material.emissiveColor = new BABYLON.Color3(1, 1, 1);
  }
  
  // Check if we need to revoke previous blob URL
  const entityMetadata = isEntity(entity) ? entity.metadata : entity.metadata;
  if (entityMetadata?.lastImageUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(entityMetadata.lastImageUrl);
  }
  
  // Create texture
  const texture = new BABYLON.Texture(imageUrl, scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  
  // Apply material
  childMesh.material = material;
  
  // Update metadata
  if (entityMetadata) {
    entityMetadata.lastImageUrl = imageUrl;
  }
} 
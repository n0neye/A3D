import * as BABYLON from '@babylonjs/core';
import { v4 as uuidv4 } from 'uuid';
import { EntityNode, EntityType, EntityMetadata, ImageRatio, ImageSize, isEntity } from '../../types/entity';

// Entity resolution functions
export function getEntityFromMesh(mesh: BABYLON.AbstractMesh): EntityNode | null {
  return mesh?.metadata?.rootEntity as EntityNode || null;
}

export function resolveEntity(node: BABYLON.Node): EntityNode | null {
  if (isEntity(node)) {
    return node;
  }

  if (node instanceof BABYLON.AbstractMesh && node.metadata?.rootEntity) {
    return node.metadata.rootEntity as EntityNode;
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

    // Entity mesh properties
    planeMesh: BABYLON.AbstractMesh | null;
    modelMesh: BABYLON.AbstractMesh | null;
    displayMode: '2d' | '3d';
    
    // Get primary mesh based on current display mode
    getPrimaryMesh(): BABYLON.AbstractMesh | null;
    
    // Toggle between 2D and 3D modes
    setDisplayMode(mode: '2d' | '3d'): void;
    
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
BABYLON.TransformNode.prototype.getDisplayMesh = function (): BABYLON.AbstractMesh | null {
  return this.getPrimaryMesh();
};

BABYLON.TransformNode.prototype.getPrimaryMesh = function (): BABYLON.AbstractMesh | null {
  if (this.displayMode === '3d' && this.modelMesh) {
    return this.modelMesh;
  }
  return this.planeMesh;
};

BABYLON.TransformNode.prototype.setDisplayMode = function (mode: '2d' | '3d'): void {
  if (!this.isEntity()) return;
  
  this.displayMode = mode;
  
  // Set visibility based on mode
  if (this.planeMesh) {
    this.planeMesh.setEnabled(mode === '2d');
  }
  
  if (this.modelMesh) {
    this.modelMesh.setEnabled(mode === '3d');
  }
};

BABYLON.TransformNode.prototype.getBoundingInfo = function (): BABYLON.BoundingInfo | null {
  const mesh = this.getPrimaryMesh();
  return mesh ? mesh.getBoundingInfo() : null;
};

// Implement the extension methods
BABYLON.TransformNode.prototype.isEntity = function (): boolean {
  return this.metadata?.entityType !== undefined;
};

BABYLON.TransformNode.prototype.getEntityType = function (): EntityType | null {
  return this.isEntity() ? this.metadata.entityType : null;
};

BABYLON.TransformNode.prototype.getEntityMetadata = function (): EntityMetadata | null {
  return this.isEntity() ? this.metadata : null;
};

BABYLON.TransformNode.prototype.getAIData = function () {
  return this.isEntity() && this.metadata.aiData ? this.metadata.aiData : null;
};

BABYLON.TransformNode.prototype.getCurrentGeneration = function () {
  const aiData = this.getAIData();
  if (!aiData || !aiData.currentStateId) return null;

  return aiData.generationHistory.find(gen => gen.id === aiData.currentStateId) || null;
};

BABYLON.TransformNode.prototype.addGenerationToHistory = function (
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
  
  // Switch to 2D mode when a new image is added
  this.setDisplayMode('2d');

  return newGeneration;
};

BABYLON.TransformNode.prototype.addModelToHistory = function (modelUrl: string, derivedFromId: string) {
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
  
  // Switch to 3D mode when a new model is added
  this.setDisplayMode('3d');

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
  
  // Initialize display mode as 2D
  entity.displayMode = '2d';
  entity.modelMesh = null;

  // Create child mesh based on entity type
  let planeMesh: BABYLON.Mesh;

  switch (type) {
    case 'character':
      planeMesh = BABYLON.MeshBuilder.CreatePlane(`${name}-plane`, {
        width: 1,
        height: 2
      }, scene);
      break;

    case 'skybox':
      planeMesh = BABYLON.MeshBuilder.CreateSphere(`${name}-plane`, {
        diameter: 1000,
        segments: 32,
        sideOrientation: BABYLON.Mesh.BACKSIDE
      }, scene);
      break;

    case 'background':
      planeMesh = BABYLON.MeshBuilder.CreatePlane(`${name}-plane`, {
        width: 10,
        height: 5
      }, scene);
      break;

    case 'terrain':
      planeMesh = BABYLON.MeshBuilder.CreateGround(`${name}-plane`, {
        width: 10,
        height: 10,
        subdivisions: 32
      }, scene);
      break;

    default: // aiObject
      // Create a plane with the right aspect ratio
      const ratio = options.ratio || '1:1';
      const { width, height } = getPlaneSize(ratio);

      planeMesh = BABYLON.MeshBuilder.CreatePlane(`${name}-plane`, {
        width,
        height
      }, scene);
  }

  // Create default material
  const material = new BABYLON.StandardMaterial(`${name}-material`, scene);
  material.diffuseColor = new BABYLON.Color3(1, 1, 1);
  material.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
  material.backFaceCulling = false;
  planeMesh.material = material;

  // Parent the mesh to the entity
  planeMesh.parent = entity;

  // Look at the camera
  if (scene.activeCamera) {
    planeMesh.lookAt(scene.activeCamera.position);
  }

  // Set entity metadata on the mesh
  planeMesh.metadata = {
    rootEntity: entity
  };

  // Set up plane mesh
  entity.planeMesh = planeMesh;
  
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
  entity: EntityNode,
  imageUrl: string,
  scene: BABYLON.Scene
): void {
  // Get the plane mesh
  const planeMesh = entity.planeMesh;

  if (!planeMesh) return;

  // Get or create material
  let material = planeMesh.material as BABYLON.StandardMaterial;
  if (!material || !(material instanceof BABYLON.StandardMaterial)) {
    material = new BABYLON.StandardMaterial(`${entity.name}-material`, scene);
    material.backFaceCulling = false;
    material.emissiveColor = new BABYLON.Color3(1, 1, 1);
  }

  // Check if we need to revoke previous blob URL
  const entityMetadata = entity.metadata;
  if (entityMetadata?.lastImageUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(entityMetadata.lastImageUrl);
  }

  // Create texture
  const texture = new BABYLON.Texture(imageUrl, scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;

  // Apply material
  planeMesh.material = material;

  // Update metadata
  if (entityMetadata) {
    entityMetadata.lastImageUrl = imageUrl;
  }
  
  // Switch to 2D display mode
  entity.setDisplayMode('2d');
} 
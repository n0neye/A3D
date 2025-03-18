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
    // Entity metadata
    public metadata: EntityMetadata;

    // Entity mesh properties
    public planeMesh: BABYLON.AbstractMesh | null = null;
    public modelMesh: BABYLON.AbstractMesh | null = null;
    public displayMode: '2d' | '3d' = '2d';

    // Temporary storage for the prompt
    public tempPrompt: string | null = null;

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

    // Get the primary mesh based on current display mode
    public getPrimaryMesh(): BABYLON.AbstractMesh | null {
        if (this.displayMode === '3d' && this.modelMesh) {
            return this.modelMesh;
        }
        return this.planeMesh;
    }

    // Toggle between 2D and 3D modes
    public setDisplayMode(mode: '2d' | '3d'): void {
        this.displayMode = mode;

        // Set visibility based on mode
        if (this.planeMesh) {
            this.planeMesh.setEnabled(mode === '2d');
        }

        if (this.modelMesh) {
            this.modelMesh.setEnabled(mode === '3d');
        }
    }

    // Get the entity type
    public getEntityType(): EntityType {
        return this.metadata.entityType;
    }

    // Get entity metadata
    public getEntityMetadata(): EntityMetadata {
        return this.metadata;
    }

    // Get the AI data
    public getAIData(): EntityMetadata['aiData'] | null {
        return this.metadata.aiData || null;
    }

    // Get the current generation
    public getCurrentGeneration(): any | null {
        const aiData = this.getAIData();
        if (!aiData || !aiData.currentStateId) return null;

        return aiData.generationHistory.find(gen => gen.id === aiData.currentStateId) || null;
    }

    // Get all generation history
    public getGenerationHistory(): any[] {
        const aiData = this.getAIData();
        return aiData?.generationHistory || [];
    }

    // Add a new image generation to history
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
            assetType: 'image' as const,
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
    }

    // Add a 3D model to history
    public addModelToHistory(modelUrl: string, derivedFromId: string): any {
        const aiData = this.getAIData();
        if (!aiData) return null;

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

        // Add to history
        aiData.generationHistory.push(newGeneration);
        aiData.currentStateId = newGeneration.id;
        aiData.stage = '3dModel';

        // Switch to 3D mode when a new model is added
        this.setDisplayMode('3d');

        return newGeneration;
    }

    // Get the bounding info of the primary mesh
    public getBoundingInfo(): BABYLON.BoundingInfo | null {
        const mesh = this.getPrimaryMesh();
        return mesh ? mesh.getBoundingInfo() : null;
    }

    // Set the generating state
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

    // Set the converting state
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

    // Get the processing state
    public getProcessingState(): { isGenerating: boolean; isConverting: boolean; progressMessage: string } {
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


export function resolveEntity(node: BABYLON.Node): EntityNode | null {
    if (isEntity(node)) {
        return node;
    }

    if (node instanceof BABYLON.AbstractMesh && node.metadata?.rootEntity) {
        return node.metadata.rootEntity as EntityNode;
    }

    return null;
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

// Entity creation function
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
    const entityMetadata = entity.getEntityMetadata();
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
    entity.metadata.lastImageUrl = imageUrl;

    // Switch to 2D display mode
    entity.setDisplayMode('2d');
} 
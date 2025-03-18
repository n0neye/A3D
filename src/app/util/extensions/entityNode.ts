import * as BABYLON from '@babylonjs/core';
import { v4 as uuidv4 } from 'uuid';
import { create2DBackground } from '../editor/editor-util';

// Entity types and metadata structures
export type EntityType = 'aiObject' | 'light';
export type AiObjectType = "object" | "background";

export type ImageRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
export type ImageSize = 'small' | 'medium' | 'large' | 'xl';


// Progress event handling
export type ProgressListener = (state: EntityProcessingState) => void;

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

// Processing state interface
export interface EntityProcessingState {
    isGenerating2D: boolean;
    isGenerating3D: boolean;
    progressMessage: string;
}

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
    created: Date;
    lastImageUrl?: string;

    // Add progress tracking
    processingState?: EntityProcessingState;

    // For AI generated entities
    aiData?: {
        currentStateId: string | null;
        ratio: ImageRatio;
        imageSize: ImageSize;
        aiObjectType: AiObjectType;

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

    // Progress event - public event handler
    public readonly onProgress = new EventHandler<EntityProcessingState>();

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
            created: new Date(),
            processingState: {
                isGenerating2D: false,
                isGenerating3D: false,
                progressMessage: ''
            }
        };

        // Add AI data for AI entities
        if (type === 'aiObject') {
            this.metadata.aiData = {
                aiObjectType: "object",
                currentStateId: null,
                ratio: options.ratio || '1:1',
                imageSize: options.imageSize || 'medium',
                generationHistory: []
            };
        }
    }

    // Set the processing state and notify listeners
    public setProcessingState(state: EntityProcessingState): void {
        // Update the state
        this.metadata.processingState = state;

        // Notify all listeners
        this.onProgress.trigger(state);
    }

    // Get the processing state
    public getProcessingState(): EntityProcessingState {
        return this.metadata.processingState || {
            isGenerating2D: false,
            isGenerating3D: false,
            progressMessage: ''
        };
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
                aiObjectType: "object",
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

        // Switch to 3D mode when a new model is added
        this.setDisplayMode('3d');

        return newGeneration;
    }

    // Get the bounding info of the primary mesh
    public getBoundingInfo(): BABYLON.BoundingInfo | null {
        const mesh = this.getPrimaryMesh();
        return mesh ? mesh.getBoundingInfo() : null;
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
        aiObjectType?: AiObjectType;
        position?: BABYLON.Vector3;
        ratio?: ImageRatio;
        imageSize?: ImageSize;
        name?: string;
        imageUrl?: string;
    } = {}
): EntityNode {
    const name = options.name || `${type}-${uuidv4().substring(0, 8)}`;

    // Create entity object
    const entity = new EntityNode(name, scene, type, options);
    if (type === 'aiObject') {
        createAiObject(scene, name, entity, options);
    } else {
        // Handle other entity types (like lights, etc.) 
        // TODO
    }
    return entity;
}

// Create an arrow to visualize direction
const createDirectionalArrow = (scene: BABYLON.Scene, size: number = 1): BABYLON.Mesh => {
    // Create a custom arrow shape
    const arrowMesh = new BABYLON.Mesh("sunArrow", scene);
    
    // Create the arrow shaft (cylinder)
    const shaft = BABYLON.MeshBuilder.CreateCylinder(
      "sunArrow-shaft", 
      { 
        height: size * 0.8, 
        diameter: size * 0.1,
        tessellation: 8
      }, 
      scene
    );
    
    // Create the arrowhead (cone)
    const head = BABYLON.MeshBuilder.CreateCylinder(
      "sunArrow-head", 
      { 
        height: size * 0.2, 
        diameterTop: 0, 
        diameterBottom: size * 0.2,
        tessellation: 8
      }, 
      scene
    );
    
    // Position the arrowhead at the end of the shaft
    head.position.y = size * 0.5; // Half of shaft height + half of cone height
    
    // Parent the parts to the main mesh
    shaft.parent = arrowMesh;
    head.parent = arrowMesh;
    
    // Create the material for the arrow
    const arrowMaterial = new BABYLON.StandardMaterial("sunArrow-material", scene);
    arrowMaterial.emissiveColor = new BABYLON.Color3(1, 0.8, 0);
    arrowMaterial.disableLighting = true;
    
    // Apply the material to the parts
    shaft.material = arrowMaterial;
    head.material = arrowMaterial;
    
    // Rotate to align with the direction of the light
    // The arrow will point in the opposite direction of the light
    // (since light goes from source to target, but we want to show direction)
    arrowMesh.rotation.x = Math.PI;
    
    return arrowMesh;
  };


export const createSunEntity = (scene: BABYLON.Scene, )=>{
    // Create a transform node to group the sun and arrow
    const sunTransform = new EntityNode("sunTransform", scene, "light");
    // Position the transform at an offset from the origin
    sunTransform.position = new BABYLON.Vector3(0, 0.5, 0);

    // Create a sun (directional light)
    const sunLight = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(0.5, -0.5, -0.5).normalize(), scene);
    sunLight.intensity = 1;
    sunLight.diffuse = new BABYLON.Color3(1, 0.8, 0.5); // Warm sunlight color
    // Parent the light to the transform node
    sunLight.parent = sunTransform;

    // Create directional arrow for sun visualization
    const sunArrow = createDirectionalArrow(scene, 1);
    sunArrow.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
    // Parent the arrow to the transform node
    sunArrow.parent = sunTransform;

    return {
        sunLight,
        sunTransform,
        sunArrow
    }

}

const createAiObject = (scene: BABYLON.Scene, name: string, entity: EntityNode, options: {
    position?: BABYLON.Vector3;
    ratio?: ImageRatio;
    imageSize?: ImageSize;
    imageUrl?: string;
    aiObjectType?: AiObjectType;
}) => {
    if (!options.aiObjectType) {
        throw new Error('aiObjectType is required');
    }

    if (entity.metadata.aiData) {
        entity.metadata.aiData.aiObjectType = options.aiObjectType;
    }

    // Create child mesh based on entity type and aiObjectType
    let planeMesh: BABYLON.Mesh;
    if (options.aiObjectType === 'background') {
        // Create a background that fills the screen
        // A placeholder texture for the background until a real one is provided
        const placeholderUrl = options.imageUrl || "https://playground.babylonjs.com/textures/equirectangular.jpg";

        // Create the background mesh
        planeMesh = create2DBackground(scene, placeholderUrl);

        // Set special properties for backgrounds
        planeMesh.renderingGroupId = 0; // Ensure it renders behind everything
    } else {
        // Default object - create a plane with the right aspect ratio
        const ratio = options.ratio || '1:1';
        const { width, height } = getPlaneSize(ratio);

        planeMesh = BABYLON.MeshBuilder.CreatePlane(`${name}-plane`, {
            width,
            height
        }, scene);

        // Create default material
        const material = new BABYLON.StandardMaterial(`${name}-material`, scene);
        material.diffuseColor = new BABYLON.Color3(1, 1, 1);
        material.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        material.backFaceCulling = false;


        // Apply material to mesh
        planeMesh.material = material;


        // Look at the camera for non-background objects
        if (scene.activeCamera) {
            planeMesh.lookAt(scene.activeCamera.position);
        }
    }

    // Parent the mesh to the entity
    planeMesh.parent = entity;

    // Set up plane mesh
    entity.planeMesh = planeMesh;

    planeMesh.metadata = {
        rootEntity: entity
    };
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

    // Check if this is a background
    const isBackground = entity.metadata.aiData?.aiObjectType === 'background';

    if (isBackground) {
        // For backgrounds, we'll replace the entire mesh
        const oldMesh = entity.planeMesh;

        // Create a new background with the new image
        const newBackground = create2DBackground(scene, imageUrl);
        newBackground.parent = entity;

        // Set metadata
        newBackground.metadata = { rootEntity: entity };

        // Replace the reference
        entity.planeMesh = newBackground;

        // Dispose the old mesh
        if (oldMesh) {
            oldMesh.dispose();
        }

        // Update metadata
        entity.metadata.lastImageUrl = imageUrl;
    } else {
        // Standard object - just update the texture
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
    }

    // Switch to 2D display mode
    entity.setDisplayMode('2d');
}


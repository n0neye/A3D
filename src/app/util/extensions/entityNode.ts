import * as BABYLON from '@babylonjs/core';
import { v4 as uuidv4 } from 'uuid';
import { create2DBackground, createEquirectangularSkybox } from '../editor/editor-util';
import { ImageRatio, ImageSize, loadModel } from '../generation-util';
// Entity types and metadata structures
export type EntityType = 'aiObject' | 'light';
export type AiObjectType = "generativeObject" | "background" | "shape";
export type AssetType = 'image' | 'model';
// Add shape type definition
export type ShapeType = 'cube' | 'sphere' | 'cylinder' | 'cone' | 'plane' | 'floor' | 'torus' ;

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
        imageSize: ImageSize;
    }
}

// Entity metadata structure
export interface EntityMetadata {
    entityType: EntityType;
    created: Date;

    // Add progress tracking
    processingState?: EntityProcessingState;

    // For AI generated entities
    aiData?: {
        aiObjectType: AiObjectType;
        ratio: ImageRatio;
        imageSize: ImageSize;
        generationLogs: Array<GenerationLog>;
        currentStateId: string | null;
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
                aiObjectType: "generativeObject",
                currentStateId: null,
                ratio: options.ratio || '1:1',
                imageSize: options.imageSize || 'medium',
                generationLogs: []
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
    public getCurrentGenerationLog(): GenerationLog | null {
        const aiData = this.getAIData();
        if (!aiData || !aiData.currentStateId) return null;
        return aiData.generationLogs.find(gen => gen.id === aiData.currentStateId) || null;
    }

    // Get all generation history
    public getGenerationHistory(): any[] {
        const aiData = this.getAIData();
        return aiData?.generationLogs || [];
    }

    // Add a new image generation to history
    public addImageGenerationLog(
        prompt: string,
        fileUrl: string,
        options: {
            negativePrompt?: string,
            ratio: ImageRatio;
            imageSize: ImageSize;
            derivedFromId?: string;
        }
    ): GenerationLog {
        // Create AI data if it doesn't exist
        if (!this.metadata.aiData) {
            this.metadata.aiData = {
                aiObjectType: "generativeObject",
                currentStateId: null,
                ratio: options.ratio,
                imageSize: options.imageSize,
                generationLogs: [],
            };
        }

        // Create new generation entry with explicit 'image' literal type
        const newGeneration: GenerationLog = {
            id: uuidv4(),
            timestamp: Date.now(),
            prompt,
            assetType: 'image',
            fileUrl,
            derivedFromId: options.derivedFromId,
            imageParams: {
                negativePrompt: options.negativePrompt,
                ratio: options.ratio,
                imageSize: options.imageSize,
            }
        };

        // Add to history
        this.metadata.aiData.generationLogs.push(newGeneration);
        this.metadata.aiData.currentStateId = newGeneration.id;
        this.metadata.aiData.ratio = options.ratio;
        this.metadata.aiData.imageSize = options.imageSize;

        return newGeneration;
    }

    // Add a 3D model to history
    public addModelGenerationLog(modelUrl: string, derivedFromId: string): GenerationLog | null {
        const aiData = this.getAIData();
        if (!aiData) return null;

        // Find the source generation
        const sourceGen = aiData.generationLogs.find(gen => gen.id === derivedFromId);
        if (!sourceGen) return null;

        // Create new model generation entry
        const newGeneration: GenerationLog = {
            id: uuidv4(),
            timestamp: Date.now(),
            prompt: sourceGen.prompt,
            assetType: 'model',
            fileUrl: modelUrl,
            derivedFromId,
        };

        // Add to history
        aiData.generationLogs.push(newGeneration);
        aiData.currentStateId = newGeneration.id;

        return newGeneration;
    }

    // Get the bounding info of the primary mesh
    public getBoundingInfo(): BABYLON.BoundingInfo | null {
        const mesh = this.getPrimaryMesh();
        return mesh ? mesh.getBoundingInfo() : null;
    }

    // Apply a specific generation log 
    public applyGenerationLog(log: GenerationLog): void {
        if (!log || !this.metadata.aiData) return;

        // Set as current state
        this.metadata.aiData.currentStateId = log.id;

        // Apply based on asset type
        if (log.assetType === 'image' && log.fileUrl) {
            // For image assets, apply the image to the entity
            applyImageToEntity(this, log.fileUrl, this.getScene(), log.imageParams?.ratio);
        } else if (log.assetType === 'model' && log.fileUrl) {
            // For model assets, we need to set 3D display mode
            // (Assuming the model is already loaded and attached to this entity)
            this.setDisplayMode('3d');
        }
    }

    // Update aspect ratio of the entity
    public updateAspectRatio(ratio: ImageRatio): void {
        if (!this.metadata.aiData || !this.planeMesh) return;

        // Save the new ratio in metadata
        this.metadata.aiData.ratio = ratio;

        // Get the new dimensions based on ratio
        const { width, height } = getPlaneSize(ratio);

        // Update the mesh dimensions
        // We need to create a new geometry with the new dimensions
        const scene = this.getScene();
        const oldMaterial = this.planeMesh.material;

        // Create a new plane with the new aspect ratio
        const newPlaneMesh = BABYLON.MeshBuilder.CreatePlane(
            `${this.name}-plane-new`,
            { width, height },
            scene
        );

        // Copy position, rotation, and parent
        newPlaneMesh.position = this.planeMesh.position.clone();
        newPlaneMesh.rotation = this.planeMesh.rotation.clone();
        newPlaneMesh.parent = this;

        // Apply the existing material
        newPlaneMesh.material = oldMaterial;

        // Update metadata
        newPlaneMesh.metadata = {
            rootEntity: this
        };

        // Dispose of the old plane mesh
        const oldMesh = this.planeMesh;
        this.planeMesh = newPlaneMesh;
        oldMesh.dispose();
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
        shapeType?: ShapeType;
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



const createAiObject = (scene: BABYLON.Scene, name: string, entity: EntityNode, options: {
    aiObjectType?: AiObjectType;
    position?: BABYLON.Vector3;
    ratio?: ImageRatio;
    imageSize?: ImageSize;
    imageUrl?: string;
    shapeType?: ShapeType;
}) => {
    if (!options.aiObjectType) {
        // Instead of throwing an error, set a default aiObjectType
        options.aiObjectType = "generativeObject";
        console.warn(`No aiObjectType specified for entity ${name}, defaulting to "generativeObject"`);
    }

    if (entity.metadata.aiData) {
        entity.metadata.aiData.aiObjectType = options.aiObjectType;
    } else {
        entity.metadata.aiData = {
            aiObjectType: options.aiObjectType,
            generationLogs: [],
            currentStateId: null,
            ratio: options.ratio || '1:1',
            imageSize: options.imageSize || 'medium',
        };
    }

    // Create child mesh based on entity type and aiObjectType
    let newMesh: BABYLON.Mesh;

    if (options.aiObjectType === 'background') {
        // Create a background that fills the screen
        // A placeholder texture for the background until a real one is provided
        const placeholderUrl = options.imageUrl || "./demoAssets/skybox/qwantani_puresky_4k.jpg";
        // Create the background mesh
        // planeMesh = create2DBackground(scene, placeholderUrl);
        newMesh = createEquirectangularSkybox(scene, placeholderUrl);
        // Set special properties for backgrounds
        newMesh.renderingGroupId = 0; // Ensure it renders behind everything
        entity.metadata.aiData.generationLogs.push({
            id: uuidv4(),
            timestamp: Date.now(),
            prompt: '',
            assetType: 'image',
            fileUrl: placeholderUrl,
        });
    } else if (options.aiObjectType === 'shape' && options.shapeType) {
        // Create a primitive shape based on shapeType
        newMesh = createShapeMesh(entity, scene, options.shapeType);
        if (options.shapeType === 'floor') {
            entity.position.y = -0.5;
        }
    } else if (options.aiObjectType === 'generativeObject') {
        // Default object - create a plane with the right aspect ratio
        const ratio = options.ratio || '1:1';
        const { width, height } = getPlaneSize(ratio);

        newMesh = BABYLON.MeshBuilder.CreatePlane(`${name}-plane`, {
            width,
            height
        }, scene);

        // Create default material
        const material = new BABYLON.StandardMaterial(`${name}-material`, scene);
        material.diffuseColor = new BABYLON.Color3(1, 1, 1);
        material.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        material.backFaceCulling = false;

        // Apply material to mesh
        newMesh.material = material;

        // Always face the camera
        newMesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

        // Set up plane mesh
        entity.planeMesh = newMesh;

    } else {
        throw new Error('Invalid aiObjectType');
    }

    // Parent the mesh to the entity
    newMesh.parent = entity;

    // Set position
    entity.position = options.position || new BABYLON.Vector3(0, 0, 0);

    newMesh.metadata = {
        rootEntity: entity
    };
}

// Apply image to entity
export const applyImageToEntity = async (
    entity: EntityNode,
    imageUrl: string,
    scene: BABYLON.Scene,
    ratio?: ImageRatio
): Promise<void> => {
    // Get the plane mesh
    const planeMesh = entity.planeMesh;
    if (!planeMesh) return;

    console.log('applyImageToEntity', imageUrl);

    if (ratio) {
        const { width, height } = getPlaneSize(ratio);
        planeMesh.scaling = new BABYLON.Vector3(width, height, 1);
    }

    // Check if this is a background
    const isBackground = entity.metadata.aiData?.aiObjectType === 'background';

    // Download the image
    const response = await fetch(imageUrl);

    // Check content type for PNG
    const contentType = response.headers.get('content-type');
    const isPotentiallyTransparent = contentType && contentType.includes('png');

    // convert to blob data url
    const imageBlob = await response.blob();
    const imageDataUrl = URL.createObjectURL(imageBlob);

    if (isBackground) {
        // For backgrounds, we'll replace the entire mesh
        const oldMesh = entity.planeMesh;

        // Create a new background with the new image
        const newBackground = create2DBackground(scene, imageDataUrl);
        newBackground.parent = entity;

        // Set metadata
        newBackground.metadata = { rootEntity: entity };

        // Replace the reference
        entity.planeMesh = newBackground;

        // Dispose the old mesh
        if (oldMesh) {
            oldMesh.dispose();
        }

    } else {
        // For regular objects, update the material texture
        let material = planeMesh.material as BABYLON.StandardMaterial;
        if (!material || !(material instanceof BABYLON.StandardMaterial)) {
            material = new BABYLON.StandardMaterial(`${entity.name}-material`, scene);
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
    }

    // Switch to 2D display mode
    entity.setDisplayMode('2d');
}

// Serialization and deserialization functions for projects

// Serialize an EntityNode to a JSON-compatible object

interface SerializedEntityNode {
    id: string;
    name: string;
    displayMode: '2d' | '3d';
    position: { x: number, y: number, z: number };
    rotation: { x: number, y: number, z: number };
    scaling: { x: number, y: number, z: number };
    metadata: EntityMetadata;
    created: string;
}

export function serializeEntityNode(entity: EntityNode): any {
    // Create a base serialized object with core properties
    const serialized: SerializedEntityNode = {
        id: entity.id,
        name: entity.name,
        position: {
            x: entity.position.x,
            y: entity.position.y,
            z: entity.position.z
        },
        rotation: {
            x: entity.rotation.x,
            y: entity.rotation.y,
            z: entity.rotation.z
        },
        scaling: {
            x: entity.scaling.x,
            y: entity.scaling.y,
            z: entity.scaling.z
        },
        metadata: {
            ...entity.metadata,
        },
        // Convert Date object to ISO string for JSON serialization
        created: entity.metadata.created.toISOString(),
        displayMode: entity.displayMode
    };

    return serialized;
}

// Redesigned deserialization function for EntityNode
export function deserializeEntityNode(data: any, scene: BABYLON.Scene): EntityNode {
    // First create a base EntityNode directly
    const entity = new EntityNode(data.name, scene);

    // Restore core transform properties
    entity.position = new BABYLON.Vector3(data.position.x, data.position.y, data.position.z);
    entity.rotation = new BABYLON.Vector3(data.rotation.x, data.rotation.y, data.rotation.z);
    entity.scaling = new BABYLON.Vector3(data.scaling.x, data.scaling.y, data.scaling.z);

    // Completely restore metadata (convert date strings back to Date objects)
    entity.metadata = {
        ...data.metadata,
        created: new Date(data.metadata.created || data.created)
    };

    // Handle display mode
    entity.displayMode = data.displayMode || '2d';

    // Recreate visual representation based on entityType and aiObjectType
    if (data.metadata.entityType === 'aiObject' && data.metadata.aiData) {
        const aiData = data.metadata.aiData;

        // Recreate the appropriate visual representation
        if (aiData.aiObjectType === 'background') {
            // Recreate background
            createBackgroundMesh(entity, scene);
        }
        else if (aiData.aiObjectType === 'shape') {
            // Recreate shape
            const shapeType = findShapeType(data);
            createShapeMesh(entity, scene, shapeType);
        }
        else if (aiData.aiObjectType === 'generativeObject') {
            // For generative objects, we need to handle both 2D and 3D modes

            // Create the 2D plane (needed regardless of display mode)
            const ratio = aiData.ratio || '1:1';
            createPlaneMesh(entity, scene, ratio);

            // If there's a 3D model and display mode is 3D, we need to load that too
            const currentGeneration = aiData.generationLogs.find(
                (log: any) => log.id === aiData.currentStateId
            );

            // Check if we have a 3D model in the current generation
            const has3DModel = currentGeneration &&
                currentGeneration.assetType === 'model' &&
                currentGeneration.fileUrl;

            // If we have a 3D model and display mode is 3D, we need to load it
            if (has3DModel && entity.displayMode === '3d') {
                // Schedule the model loading (to avoid blocking)
                setTimeout(() => {
                    loadModel(entity, currentGeneration.fileUrl, scene, null);
                    entity.setDisplayMode('3d');
                }, 0);
            } else {
                // Apply current 2D texture if available
                if (currentGeneration && currentGeneration.assetType === 'image' && currentGeneration.fileUrl) {
                    applyGenerationToEntity(entity, currentGeneration, scene);
                }

                // Make sure display mode is set correctly
                entity.setDisplayMode(entity.displayMode);
            }
        }
    }

    return entity;
}

// Helper function to find shape type from entity data
function findShapeType(data: any): ShapeType {
    // Default shape
    let shapeType: ShapeType = 'cube';

    // Try to find shape type from the current generation
    if (data.metadata?.aiData?.generationLogs && data.metadata.aiData.currentStateId) {
        const currentGen = data.metadata.aiData.generationLogs.find(
            (log: any) => log.id === data.metadata.aiData.currentStateId
        );

        if (currentGen && currentGen.shapeType) {
            shapeType = currentGen.shapeType;
        }
    }

    return shapeType;
}

// Create background mesh for entity
function createBackgroundMesh(entity: EntityNode, scene: BABYLON.Scene): void {
    // Create skybox with default texture (will be replaced when applying generation)
    const defaultUrl = "https://playground.babylonjs.com/textures/equirectangular.jpg";
    const logs = entity.metadata.aiData?.generationLogs;
    const lastLog = logs && logs.length > 0 ? logs[logs.length - 1] : null;
    const fileUrl = lastLog?.fileUrl;
    console.log('createBackgroundMesh', entity, fileUrl, logs);
    const skybox = createEquirectangularSkybox(scene, fileUrl || defaultUrl);

    // Set up the mesh
    skybox.parent = entity;
    skybox.renderingGroupId = 0;
    skybox.metadata = { rootEntity: entity };

    // Store reference
    entity.planeMesh = skybox;
}

// Create shape mesh for entity
function createShapeMesh(entity: EntityNode, scene: BABYLON.Scene, shapeType: ShapeType): BABYLON.Mesh {
    // Create the shape mesh
    let shapeMesh: BABYLON.Mesh;

    switch (shapeType) {
        case 'sphere':
            shapeMesh = BABYLON.MeshBuilder.CreateSphere(`${entity.name}-sphere`, { diameter: 1 }, scene);
            break;
        case 'cylinder':
            shapeMesh = BABYLON.MeshBuilder.CreateCylinder(`${entity.name}-cylinder`, { height: 1, diameter: 1 }, scene);
            break;
        case 'cone':
            shapeMesh = BABYLON.MeshBuilder.CreateCylinder(`${entity.name}-cone`, { height: 1, diameterTop: 0, diameterBottom: 1 }, scene);
            break;
        case 'plane':
            shapeMesh = BABYLON.MeshBuilder.CreatePlane(`${entity.name}-plane`, { width: 1, height: 1 }, scene);
            break;
        case 'floor':
            shapeMesh = BABYLON.MeshBuilder.CreatePlane(`${entity.name}-floor`, { width: 10, height: 10 }, scene);
            shapeMesh.rotation.x = Math.PI / 2;
            break;
        case 'torus':
            shapeMesh = BABYLON.MeshBuilder.CreateTorus(`${entity.name}-torus`, { diameter: 1, thickness: 0.2 }, scene);
            break;
        case 'cube':
        default:
            shapeMesh = BABYLON.MeshBuilder.CreateBox(`${entity.name}-box`, { size: 1 }, scene);
    }

    // Create a default material
    const material = new BABYLON.StandardMaterial(`${entity.name}-material`, scene);
    material.diffuseColor = new BABYLON.Color3(1, 1, 1);
    material.backFaceCulling = false;

    // Apply the material
    shapeMesh.material = material;

    // Setup the mesh
    shapeMesh.parent = entity;
    shapeMesh.metadata = { rootEntity: entity };

    // Store reference
    entity.modelMesh = shapeMesh;
    entity.setDisplayMode('3d');
    return shapeMesh;
}

// Create plane mesh for generative objects
function createPlaneMesh(entity: EntityNode, scene: BABYLON.Scene, ratio: ImageRatio): void {
    // Get dimensions from ratio
    const { width, height } = getPlaneSize(ratio);

    // Create the plane
    const planeMesh = BABYLON.MeshBuilder.CreatePlane(`${entity.name}-plane`, {
        width,
        height
    }, scene);

    // Create default material
    const material = new BABYLON.StandardMaterial(`${entity.name}-material`, scene);
    material.diffuseColor = new BABYLON.Color3(1, 1, 1);
    material.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    material.backFaceCulling = false;

    // Apply material
    planeMesh.material = material;

    // Make plane face camera
    planeMesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    // Setup the mesh
    planeMesh.parent = entity;
    planeMesh.metadata = { rootEntity: entity };

    // Store reference
    entity.planeMesh = planeMesh;
}

// Helper to create a mock 3D model (for demonstration purposes)
// In a real implementation, you'd load the actual 3D model from the URL
function createMockModelMesh(entity: EntityNode, scene: BABYLON.Scene): void {
    // Create a box as a stand-in for the 3D model
    const modelMesh = BABYLON.MeshBuilder.CreateBox(`${entity.name}-model`, { size: 1 }, scene);

    // Create a material for the model
    const material = new BABYLON.StandardMaterial(`${entity.name}-model-material`, scene);
    material.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);
    modelMesh.material = material;

    // Setup the mesh
    modelMesh.parent = entity;
    modelMesh.metadata = { rootEntity: entity };

    // Store reference
    entity.modelMesh = modelMesh;
}

// Apply generation log to entity
function applyGenerationToEntity(entity: EntityNode, generation: any, scene: BABYLON.Scene): void {
    if (!generation || !generation.fileUrl) return;

    // Apply based on asset type
    if (generation.assetType === 'image') {
        // For images, we schedule an async operation to apply the image
        // This avoids blocking the UI during deserialization
        setTimeout(() => {
            applyImageToEntity(entity, generation.fileUrl, scene, generation.imageParams?.ratio);
            // Important: Only set to 2D mode if that's the current display mode
            // This prevents overriding the user's preference
            if (entity.displayMode === '2d') {
                entity.setDisplayMode('2d');
            }
        }, 0);
    }
    else if (generation.assetType === 'model') {
        // For models, we need to create the model mesh and set 3D display mode
        setTimeout(() => {
            // In a real implementation, load the model from generation.fileUrl
            // For now, create a mock model
            createMockModelMesh(entity, scene);

            // Only switch to 3D mode if that was the saved display mode
            if (entity.displayMode === '3d') {
                entity.setDisplayMode('3d');
            }
        }, 0);
    }
}


// import * as BABYLON from '@babylonjs/core';
// import { v4 as uuidv4 } from 'uuid';
// import { create2DBackground, createEquirectangularSkybox, getEnvironmentObjects } from '../editor/editor-util';
// import { ImageRatio } from '../generation-util';
// import { loadModel } from '../3d-generation-util';
// import { createShapeEntity, createShapeMesh } from '../editor/shape-util';
// import { placeholderMaterial } from '../editor/material-util';
// import { createPointLightEntity, setupMeshShadows } from '../editor/light-util';
// // Entity types and metadata structures
// export type EntityType = 'aiObject' | 'light';
// export type AiObjectType = "generativeObject" | "background" | "shape";
// export type AssetType = 'image' | 'model';
// // Add shape type definition
// export type ShapeType = 'cube' | 'sphere' | 'cylinder' | 'cone' | 'plane' | 'floor' | 'tube' | 'capsule' | 'pyramid' | 'wall';

// // Progress event handling
// export type ProgressListener = (state: EntityProcessingState) => void;

// // Event handler class to provide add/remove interface
// export class EventHandler<T> {
//     private handlers: Set<(data: T) => void> = new Set();

//     public add(handler: (data: T) => void): void {
//         this.handlers.add(handler);
//     }

//     public remove(handler: (data: T) => void): void {
//         this.handlers.delete(handler);
//     }

//     public trigger(data: T): void {
//         this.handlers.forEach(handler => handler(data));
//     }
// }

// // Processing state interface
// export interface EntityProcessingState {
//     isGenerating2D: boolean;
//     isGenerating3D: boolean;
//     progressMessage: string;
// }

// export interface GenerationLog {
//     id: string;
//     timestamp: number;
//     prompt: string;

//     // Asset type and URLs
//     assetType: AssetType;
//     fileUrl?: string;

//     // If model is derived from image
//     derivedFromId?: string;

//     // Generation parameters
//     imageParams?: {
//         negativePrompt?: string;
//         ratio: ImageRatio;
//     }
// }

// // Entity metadata structure
// export interface EntityMetadata {
//     entityType: EntityType;
//     created: Date;

//     // Add progress tracking
//     processingState?: EntityProcessingState;

//     // For AI generated entities
//     aiData?: {
//         aiObjectType: AiObjectType;
//         current_prompt: string;
//         current_ratio: ImageRatio;
//         generationLogs: Array<GenerationLog>;
//         currentGenerationId: string | null;
//     };

//     // For shape entities
//     shapeType?: ShapeType;

//     // For light entities
//     lightProperties?: {
//         color: {
//             r: number;
//             g: number;
//             b: number;
//         };
//         intensity: number;
//         shadowEnabled?: boolean;
//     };
// }

// // Custom Entity Class that extends TransformNode
// export class EntityNode extends BABYLON.TransformNode {
//     // Entity metadata
//     public metadata: EntityMetadata;

//     // Entity mesh properties
//     public gizmoMesh: BABYLON.AbstractMesh | null = null;
//     public modelMesh: BABYLON.AbstractMesh | null = null;
//     public displayMode: '2d' | '3d' = '2d';

//     // Progress event - public event handler
//     public readonly onProgress = new EventHandler<{ entity: EntityNode, state: EntityProcessingState }>();

//     constructor(
//         name: string,
//         scene: BABYLON.Scene,
//         type: EntityType = 'aiObject',
//         options: {
//             position?: BABYLON.Vector3;
//             ratio?: ImageRatio;
//         } = {}
//     ) {
//         super(name, scene);

//         // Set position if provided
//         if (options.position) {
//             this.position = options.position;
//         }

//         // Initialize metadata
//         this.metadata = {
//             entityType: type,
//             created: new Date(),
//             processingState: {
//                 isGenerating2D: false,
//                 isGenerating3D: false,
//                 progressMessage: ''
//             }
//         };

//         // Add AI data for AI entities
//         if (type === 'aiObject') {
//             this.metadata.aiData = {
//                 aiObjectType: "generativeObject",
//                 current_prompt: "",
//                 currentGenerationId: null,
//                 current_ratio: options.ratio || '1:1',
//                 generationLogs: []
//             };
//         }
//     }

//     // Set the processing state and notify listeners
//     public setProcessingState(state: EntityProcessingState): void {
//         // Update the state
//         this.metadata.processingState = state;

//         // Notify all listeners
//         this.onProgress.trigger({ entity: this, state });
//     }

//     // Get the processing state
//     public getProcessingState(): EntityProcessingState {
//         return this.metadata.processingState || {
//             isGenerating2D: false,
//             isGenerating3D: false,
//             progressMessage: ''
//         };
//     }

//     // Get the primary mesh based on current display mode
//     public getPrimaryMesh(): BABYLON.AbstractMesh | null {
//         if (this.displayMode === '3d' && this.modelMesh) {
//             return this.modelMesh;
//         }
//         return this.gizmoMesh;
//     }

//     // Toggle between 2D and 3D modes
//     public setDisplayMode(mode: '2d' | '3d'): void {
//         this.displayMode = mode;

//         // Set visibility based on mode
//         if (this.gizmoMesh) {
//             this.gizmoMesh.setEnabled(mode === '2d');
//         }

//         if (this.modelMesh) {
//             this.modelMesh.setEnabled(mode === '3d');
//         }
//     }

//     // Get the entity type
//     public getEntityType(): EntityType {
//         return this.metadata?.entityType;
//     }

//     // Get entity metadata
//     public getEntityMetadata(): EntityMetadata {
//         return this.metadata;
//     }

//     // Get the AI data
//     public getAIData(): EntityMetadata['aiData'] | null {
//         return this.metadata.aiData || null;
//     }

//     // Get the current generation
//     public getCurrentGenerationLog(): GenerationLog | null {
//         const aiData = this.getAIData();
//         if (!aiData || !aiData.currentGenerationId) return null;
//         return aiData.generationLogs.find(gen => gen.id === aiData.currentGenerationId) || null;
//     }

//     // Get all generation history
//     public getGenerationHistory(): any[] {
//         const aiData = this.getAIData();
//         return aiData?.generationLogs || [];
//     }

//     // Add a new image generation to history
//     public addImageGenerationLog(
//         prompt: string,
//         fileUrl: string,
//         options: {
//             negativePrompt?: string,
//             ratio: ImageRatio;
//             derivedFromId?: string;
//         }
//     ): GenerationLog {
//         // Create AI data if it doesn't exist
//         if (!this.metadata.aiData) {
//             this.metadata.aiData = {
//                 aiObjectType: "generativeObject",
//                 current_prompt: prompt,
//                 currentGenerationId: null,
//                 current_ratio: options.ratio,
//                 generationLogs: [],
//             };
//         }

//         // Create new generation entry with explicit 'image' literal type
//         const newGeneration: GenerationLog = {
//             id: uuidv4(),
//             timestamp: Date.now(),
//             prompt,
//             assetType: 'image',
//             fileUrl,
//             derivedFromId: options.derivedFromId,
//             imageParams: {
//                 negativePrompt: options.negativePrompt,
//                 ratio: options.ratio,
//             }
//         };

//         // Add to history
//         this.metadata.aiData.generationLogs.push(newGeneration);
//         this.metadata.aiData.currentGenerationId = newGeneration.id;
//         this.metadata.aiData.current_ratio = options.ratio;

//         return newGeneration;
//     }

//     // Add a 3D model to history
//     public addModelGenerationLog(modelUrl: string, derivedFromId: string): GenerationLog | null {
//         const aiData = this.getAIData();
//         if (!aiData) return null;

//         // Find the source generation
//         const sourceGen = aiData.generationLogs.find(gen => gen.id === derivedFromId);
//         if (!sourceGen) return null;

//         // Create new model generation entry
//         const newGeneration: GenerationLog = {
//             id: uuidv4(),
//             timestamp: Date.now(),
//             prompt: sourceGen.prompt,
//             assetType: 'model',
//             fileUrl: modelUrl,
//             derivedFromId,
//         };

//         // Add to history
//         aiData.generationLogs.push(newGeneration);
//         aiData.currentGenerationId = newGeneration.id;

//         return newGeneration;
//     }

//     // Get the bounding info of the primary mesh
//     public getBoundingInfo(): BABYLON.BoundingInfo | null {
//         const mesh = this.getPrimaryMesh();
//         return mesh ? mesh.getBoundingInfo() : null;
//     }

//     // Apply a specific generation log 
//     public async applyGenerationLog(log: GenerationLog): Promise<void> {
//         if (!log || !this.metadata.aiData) return;

//         console.log("applyGenerationLog", log);

//         // Set as current state
//         this.metadata.aiData.currentGenerationId = log.id;

//         // Apply based on asset type
//         if (log.assetType === 'image' && log.fileUrl) {
//             // For image assets, apply the image to the entity
//             applyImageToEntity(this, log.fileUrl, this.getScene(), log.imageParams?.ratio);
//         } else if (log.assetType === 'model' && log.fileUrl) {
//             // For model assets, we need to set 3D display mode
//             // (Assuming the model is already loaded and attached to this entity)
//             await loadModel(this, log.fileUrl, this.getScene(), (progress) => {
//                 console.log("loadModel progress", progress);
//             });
//             this.setDisplayMode('3d');
//         }
//     }

//     // Update aspect ratio of the entity
//     public updateAspectRatio(ratio: ImageRatio): void {
//         if (!this.metadata.aiData || !this.gizmoMesh) return;

//         // Save the new ratio in metadata
//         this.metadata.aiData.current_ratio = ratio;

//         // Get the new dimensions based on ratio
//         const { width, height } = getPlaneSize(ratio);
//         this.gizmoMesh.scaling = new BABYLON.Vector3(width, height, 1);
//     }
// }

// // Type guard function
// export function isEntity(node: BABYLON.Node): node is EntityNode {
//     return node instanceof EntityNode;
// }

// export function resolveEntity(node: BABYLON.Node): EntityNode | null {
//     if (isEntity(node)) {
//         return node;
//     }

//     if (node instanceof BABYLON.AbstractMesh && node.metadata?.rootEntity) {
//         return node.metadata.rootEntity as EntityNode;
//     }

//     return null;
// }

// // Helper function to get size based on ratio
// function getPlaneSize(ratio: ImageRatio): { width: number, height: number } {
//     switch (ratio) {
//         case '16:9':
//             return { width: 1.6, height: 0.9 };
//         case '9:16':
//             return { width: 0.9, height: 1.6 };
//         case '4:3':
//             return { width: 1.33, height: 1 };
//         case '3:4':
//             return { width: 1, height: 1.33 };
//         default: // 1:1
//             return { width: 1, height: 1 };
//     }
// }

// // Entity creation function
// export function createEntity(
//     scene: BABYLON.Scene,
//     type: EntityType = 'aiObject',
//     options: {
//         aiObjectType?: AiObjectType;
//         position?: BABYLON.Vector3;
//         scale?: BABYLON.Vector3;
//         ratio?: ImageRatio;
//         name?: string;
//         imageUrl?: string;
//         shapeType?: ShapeType;
//     } = {}
// ): EntityNode {
//     const name = options.name || `${type}-${uuidv4().substring(0, 8)}`;

//     // Create entity object
//     const entity = new EntityNode(name, scene, type, options);
//     if (type === 'aiObject') {
//         createAiObject(scene, name, entity, options);
//     } else {
//         // Handle other entity types (like lights, etc.) 
//         // TODO
//     }
//     return entity;
// }


// // TODO: This is a temporary function to duplicate an entity. Must have clear plan to for entity creation.
// export async function duplicateEntity(
//     scene: BABYLON.Scene,
//     sourceEntity: EntityNode,
// ): Promise<EntityNode> {
//     const name = sourceEntity.name + "-copy";
//     const newEntity = new EntityNode(name, scene, sourceEntity.getEntityType(), {
//         position: sourceEntity.position.clone(),
//         ratio: sourceEntity.metadata.aiData?.current_ratio,
//     });
//     newEntity.rotation = sourceEntity.rotation.clone();
//     newEntity.scaling = sourceEntity.scaling.clone();

//     // Copy metadata
//     newEntity.metadata = { ...sourceEntity.metadata };

//     if (newEntity.metadata.aiData?.aiObjectType === 'generativeObject') {
//         createGenerativeObject(scene, newEntity, {
//             ratio: newEntity.metadata.aiData?.current_ratio,
//         });
//         if (newEntity.metadata.aiData?.generationLogs && newEntity.metadata.aiData?.generationLogs.length > 0) {
//             // Apply the last generation log
//             await newEntity.applyGenerationLog(newEntity.metadata.aiData.generationLogs[newEntity.metadata.aiData?.generationLogs.length - 1]);
//         }
//         const primaryMesh = newEntity.getPrimaryMesh();
//         const sourcePrimaryMesh = sourceEntity.getPrimaryMesh();
//         if (primaryMesh && sourcePrimaryMesh) {
//             primaryMesh.scaling = sourcePrimaryMesh.scaling.clone();
//             primaryMesh.rotation = sourcePrimaryMesh.rotation.clone();
//             primaryMesh.position = sourcePrimaryMesh.position.clone();
//         }
//     } else if (newEntity.metadata.aiData?.aiObjectType === 'shape') {
//         console.log("Duplicate shape", newEntity.metadata.shapeType);
//         if (!newEntity.metadata.shapeType) {
//             throw new Error("No shapeType");
//         }
//         const childMeshes = sourceEntity.getChildMeshes();
//         for (const childMesh of childMeshes) {
//             const newChildMesh = duplicateMesh(childMesh as BABYLON.Mesh, newEntity);
//             newChildMesh.parent = newEntity;
//         }
//         newEntity.modelMesh = newEntity.getChildMeshes()[0] as BABYLON.Mesh;
//         newEntity.displayMode = '3d';
//     }

//     return newEntity;
// }

// const duplicateMesh = (sourceMesh: BABYLON.Mesh, parent: EntityNode): BABYLON.Mesh => {
//     const newMesh = sourceMesh.clone(`${sourceMesh.name}-copy`);
//     newMesh.metadata = { ...sourceMesh.metadata };
//     newMesh.scaling = sourceMesh.scaling.clone();
//     newMesh.rotation = sourceMesh.rotation.clone();
//     newMesh.position = sourceMesh.position.clone();
//     newMesh.parent = parent;
//     newMesh.metadata.rootEntity = parent;
//     return newMesh;
// }

// const createAiObject = (scene: BABYLON.Scene, name: string, entity: EntityNode, options: {
//     aiObjectType?: AiObjectType;
//     position?: BABYLON.Vector3;
//     ratio?: ImageRatio;
//     imageUrl?: string;
//     shapeType?: ShapeType;
//     scale?: BABYLON.Vector3;
// }) => {
//     if (!options.aiObjectType) {
//         // Instead of throwing an error, set a default aiObjectType
//         options.aiObjectType = "generativeObject";
//         console.warn(`No aiObjectType specified for entity ${name}, defaulting to "generativeObject"`);
//     }

//     console.log("createAiObject", name, options.aiObjectType);

//     if (entity.metadata.aiData) {
//         entity.metadata.aiData.aiObjectType = options.aiObjectType;
//     } else {
//         entity.metadata.aiData = {
//             aiObjectType: options.aiObjectType,
//             current_prompt: "",
//             generationLogs: [],
//             currentGenerationId: null,
//             current_ratio: options.ratio || '1:1',
//         };
//     }

//     // Create child mesh based on entity type and aiObjectType
//     let newMesh: BABYLON.Mesh;

//     if (options.aiObjectType === 'background') {
//         // Create a background that fills the screen
//         // A placeholder texture for the background until a real one is provided
//         const placeholderUrl = options.imageUrl || "./demoAssets/skybox/qwantani_puresky_4k.jpg";
//         // Create the background mesh
//         // planeMesh = create2DBackground(scene, placeholderUrl);
//         newMesh = createEquirectangularSkybox(scene, placeholderUrl);
//         // Set special properties for backgrounds
//         newMesh.renderingGroupId = 0; // Ensure it renders behind everything
//         entity.metadata.aiData.generationLogs.push({
//             id: uuidv4(),
//             timestamp: Date.now(),
//             prompt: '',
//             assetType: 'image',
//             fileUrl: placeholderUrl,
//         });
//     } else if (options.aiObjectType === 'shape') {
//         if (!options.shapeType) {
//             throw new Error('Shape type is required for shape entities');
//         }
//         // Create a primitive shape based on shapeType
//         newMesh = createShapeEntity(entity, scene, options.shapeType, options);
//     } else if (options.aiObjectType === 'generativeObject') {
//         newMesh = createGenerativeObject(scene, entity, options);
//     } else {
//         throw new Error('Invalid aiObjectType');
//     }

//     // Parent the mesh to the entity
//     newMesh.parent = entity;

//     // Set position
//     entity.position = options.position || new BABYLON.Vector3(0, 0, 0);

//     newMesh.metadata = {
//         rootEntity: entity
//     };
// }

// const createGenerativeObject = (scene: BABYLON.Scene, entity: EntityNode, options: {
//     ratio?: ImageRatio;
// }) => {

//     // Default object - create a plane with the right aspect ratio
//     const ratio = options.ratio || '1:1';
//     const { width, height } = getPlaneSize(ratio);

//     const newMesh = createShapeMesh(scene, "plane");

//     // Apply material to mesh
//     newMesh.material = placeholderMaterial;

//     // Always face the camera
//     newMesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

//     // Set up plane mesh
//     entity.gizmoMesh = newMesh;
//     return newMesh;
// }

// // Apply image to entity
// export const applyImageToEntity = async (
//     entity: EntityNode,
//     imageUrl: string,
//     scene: BABYLON.Scene,
//     ratio?: ImageRatio
// ): Promise<void> => {
//     // Get the plane mesh
//     const planeMesh = entity.gizmoMesh;
//     if (!planeMesh) return;

//     if (planeMesh.material === placeholderMaterial) {
//         // Create material
//         const newMaterial = new BABYLON.StandardMaterial(`${name}-material`, scene);
//         newMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
//         newMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
//         newMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
//         newMaterial.backFaceCulling = false;
//         planeMesh.material = newMaterial;
//     }

//     console.log('applyImageToEntity', imageUrl);

//     if (ratio) {
//         const { width, height } = getPlaneSize(ratio);
//         planeMesh.scaling = new BABYLON.Vector3(width, height, 1);
//     }

//     // Check if this is a background
//     const isBackground = entity.metadata.aiData?.aiObjectType === 'background';

//     // Download the image
//     const response = await fetch(imageUrl);

//     // Check content type for PNG
//     const contentType = response.headers.get('content-type');
//     const isPotentiallyTransparent = contentType && contentType.includes('png');

//     // convert to blob data url
//     const imageBlob = await response.blob();
//     const imageDataUrl = URL.createObjectURL(imageBlob);

//     if (isBackground) {
//         // For backgrounds, we'll replace the entire mesh
//         const oldMesh = entity.gizmoMesh;

//         // Create a new background with the new image
//         const newBackground = create2DBackground(scene, imageDataUrl);
//         newBackground.parent = entity;

//         // Set metadata
//         newBackground.metadata = { rootEntity: entity };

//         // Replace the reference
//         entity.gizmoMesh = newBackground;

//         // Dispose the old mesh
//         if (oldMesh) {
//             oldMesh.dispose();
//         }

//     } else {
//         // For regular objects, update the material texture
//         let material = planeMesh.material as BABYLON.StandardMaterial;
//         if (!material || !(material instanceof BABYLON.StandardMaterial)) {
//             material = new BABYLON.StandardMaterial(`${entity.name}-material`, scene);
//         }
//         if (material) {
//             // Create a new texture
//             const texture = new BABYLON.Texture(imageDataUrl, scene);

//             // Apply texture to the material
//             material.diffuseTexture = texture;
//             material.emissiveTexture = texture;

//             // If the image is a PNG, check for transparency
//             if (isPotentiallyTransparent) {
//                 console.log('isPotentiallyTransparent', isPotentiallyTransparent);

//                 // Set material to handle transparency
//                 material.diffuseTexture.hasAlpha = true;
//                 material.useAlphaFromDiffuseTexture = true;
//                 material.backFaceCulling = false;
//                 material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
//                 material.needDepthPrePass = false;

//                 // For best rendering quality with transparent textures
//                 planeMesh.renderingGroupId = 1; // Render after opaque objects
//             } else {
//                 // Reset transparency settings if the image is not a PNG
//                 material.useAlphaFromDiffuseTexture = false;
//                 material.transparencyMode = BABYLON.Material.MATERIAL_OPAQUE;
//                 planeMesh.renderingGroupId = 0;
//             }

//         }
//     }

//     // Switch to 2D display mode
//     entity.setDisplayMode('2d');
// }

// // Serialize an EntityNode to a JSON-compatible object

// type Vector3Data = {
//     x: number;
//     y: number;
//     z: number;
// }
// const toBabylonVector3 = (v: Vector3Data): BABYLON.Vector3 => {
//     return new BABYLON.Vector3(v.x, v.y, v.z);
// }
// const fromBabylonVector3 = (v: BABYLON.Vector3): Vector3Data => {
//     return { x: v.x, y: v.y, z: v.z };
// }


// interface SerializedEntityNode {
//     id: string;
//     name: string;
//     displayMode: '2d' | '3d';
//     position: Vector3Data;
//     rotation: Vector3Data;
//     scaling: Vector3Data;
//     metadata: EntityMetadata;
//     created: string;
// }

// export function serializeEntityNode(entity: EntityNode): any {
//     // Create a base serialized object with core properties
//     const mesh = entity.getPrimaryMesh();
//     const serialized: SerializedEntityNode = {
//         id: entity.id,
//         name: entity.name,

//         // TODO: Temp hack. Entity scale must stay uniform.
//         position: fromBabylonVector3(entity.position),
//         rotation: fromBabylonVector3(entity.rotation),
//         scaling: mesh ? fromBabylonVector3(mesh.scaling) : { x: 1, y: 1, z: 1 },

//         metadata: {
//             ...entity.metadata,
//         },
//         // Convert Date object to ISO string for JSON serialization
//         created: entity.metadata.created.toISOString(),
//         displayMode: entity.displayMode
//     };

//     // Add light-specific properties if this is a light entity
//     if (entity.getEntityType() === 'light') {
//         // Find the point light
//         const pointLight = findEntityPointLight(entity);
//         if (pointLight) {
//             serialized.metadata.lightProperties = {
//                 color: {
//                     r: pointLight.diffuse.r,
//                     g: pointLight.diffuse.g,
//                     b: pointLight.diffuse.b
//                 },
//                 intensity: pointLight.intensity,
//                 shadowEnabled: pointLight.shadowEnabled
//             };
//         }
//     }

//     return serialized;
// }

// // Helper function to find a point light in an entity
// function findEntityPointLight(entity: EntityNode): BABYLON.PointLight | null {
//     const children = entity.getChildren();
//     for (const child of children) {
//         if (child instanceof BABYLON.PointLight) {
//             return child;
//         }
//     }
//     return null;
// }

// // Redesigned deserialization function for EntityNode
// export async function deserializeEntityNode(data: SerializedEntityNode, scene: BABYLON.Scene): Promise<EntityNode> {
//     console.log('deserializeEntityNode', data.name, "EntityType", data.metadata.entityType, "DisplayMode", data.displayMode, data);

//     if (data.metadata.entityType === 'light') {
//         // For light entities, recreate the light using the point light entity creator
//         const lightProperties = data.metadata.lightProperties;
//         if (!lightProperties) {
//             throw new Error('Light properties are required for light entities');
//         }
//         const color = lightProperties.color ?
//             new BABYLON.Color3(lightProperties.color.r, lightProperties.color.g, lightProperties.color.b) :
//             new BABYLON.Color3(1, 1, 1);

//         const intensity = lightProperties.intensity !== undefined ? lightProperties.intensity : 0.7;

//         // Use the light creation utility to create the light
//         // This will create both the point light and its visual representation
//         const newEntity = createPointLightEntity(scene, {
//             name: data.name,
//             position: toBabylonVector3(data.position),
//             color: color,
//             intensity: intensity,
//             shadowEnabled: lightProperties.shadowEnabled
//         });

//         // Copy important properties from the newly created entity to our existing one
//         return newEntity;
//     }

//     // First create a base EntityNode directly
//     const entity = new EntityNode(data.name, scene, data.metadata.entityType);

//     // Completely restore metadata (convert date strings back to Date objects)
//     entity.metadata = {
//         ...data.metadata,
//         created: new Date(data.metadata.created || data.created)
//     };

//     // Handle display mode
//     entity.displayMode = data.displayMode || '2d';

//     // Recreate visual representation based on entityType
//     if (data.metadata.entityType === 'aiObject' && data.metadata.aiData) {
//         const aiData = data.metadata.aiData;

//         // Recreate the appropriate visual representation
//         if (aiData.aiObjectType === 'background') {
//             // Recreate background
//             createBackgroundMesh(entity, scene);
//         }
//         else if (aiData.aiObjectType === 'shape') {
//             // Recreate shape
//             const shapeType = data.metadata.shapeType;
//             if (!shapeType) {
//                 throw new Error('Shape type is required for shape entities');
//             }
//             createShapeEntity(entity, scene, shapeType);
//         }
//         else if (aiData.aiObjectType === 'generativeObject') {
//             // For generative objects, we need to handle both 2D and 3D modes

//             // Create the 2D plane (needed regardless of display mode)
//             const ratio = aiData.current_ratio || '1:1';
//             createPlaneMesh(entity, scene, ratio);

//             // If there's a 3D model and display mode is 3D, we need to load that too
//             let currentGeneration = aiData.generationLogs.find(
//                 (log: any) => log.id === aiData.currentGenerationId
//             );

//             // legacy Support
//             if(!currentGeneration){
//                 currentGeneration = aiData.generationLogs.find(
//                     // @ts-ignore
//                     (log: any) => log.id === aiData.currentStateId
//                 );
//             }

//             if (!currentGeneration) {
//                 throw new Error('No current generation found');
//             }

//             // Check if we have a 3D model in the current generation
//             const has3DModel = currentGeneration &&
//                 currentGeneration.assetType === 'model' &&
//                 currentGeneration.fileUrl;

//             console.log("DeserializeEntity generativeObject", entity.name, has3DModel, entity.displayMode);

//             // If we have a 3D model and display mode is 3D, we need to load it
//             if (has3DModel && entity.displayMode === '3d') {
//                 // Schedule the model loading (to avoid blocking)
//                 await loadModel(entity, currentGeneration.fileUrl!, scene);
//                 entity.setDisplayMode('3d');
//             } else {
//                 // Apply current 2D texture if available
//                 if (currentGeneration && currentGeneration.assetType === 'image' && currentGeneration.fileUrl) {
//                     applyGenerationToEntity(entity, currentGeneration, scene);
//                 }

//                 // Make sure display mode is set correctly
//                 entity.setDisplayMode(entity.displayMode);
//             }
//         }
//     }

//     const mesh = entity.getPrimaryMesh();
//     console.log('deserializeEntityNode', entity.name, mesh?.name);
//     entity.position = toBabylonVector3(data.position);
//     entity.rotation = toBabylonVector3(data.rotation);
//     // Apply scaling to the mesh if it exists
//     if (mesh) {
//         mesh.scaling = toBabylonVector3(data.scaling);
//     }

//     return entity;
// }


// // Create background mesh for entity
// function createBackgroundMesh(entity: EntityNode, scene: BABYLON.Scene): void {
//     // Create skybox with default texture (will be replaced when applying generation)
//     const defaultUrl = "https://playground.babylonjs.com/textures/equirectangular.jpg";
//     const logs = entity.metadata.aiData?.generationLogs;
//     const lastLog = logs && logs.length > 0 ? logs[logs.length - 1] : null;
//     const fileUrl = lastLog?.fileUrl;
//     console.log('createBackgroundMesh', entity, fileUrl, logs);
//     const skybox = createEquirectangularSkybox(scene, fileUrl || defaultUrl);

//     // Set up the mesh
//     skybox.parent = entity;
//     skybox.renderingGroupId = 0;
//     skybox.metadata = { rootEntity: entity };

//     // Store reference
//     entity.gizmoMesh = skybox;
// }


// // Create plane mesh for generative objects
// function createPlaneMesh(entity: EntityNode, scene: BABYLON.Scene, ratio: ImageRatio): void {
//     // Get dimensions from ratio
//     const { width, height } = getPlaneSize(ratio);

//     // Create the plane
//     const planeMesh = BABYLON.MeshBuilder.CreatePlane(`${entity.name}-plane`, {
//         width,
//         height
//     }, scene);

//     // Create default material
//     const material = new BABYLON.StandardMaterial(`${entity.name}-material`, scene);
//     material.diffuseColor = new BABYLON.Color3(1, 1, 1);
//     material.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
//     material.backFaceCulling = false;

//     // Apply material
//     planeMesh.material = material;

//     // Make plane face camera
//     planeMesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

//     // Setup the mesh
//     planeMesh.parent = entity;
//     planeMesh.metadata = { rootEntity: entity };

//     // Configure shadow casting (planes typically receive but don't cast shadows)
//     planeMesh.receiveShadows = true;

//     // Store reference
//     entity.gizmoMesh = planeMesh;
// }

// // Helper to create a mock 3D model (for demonstration purposes)
// function createMockModelMesh(entity: EntityNode, scene: BABYLON.Scene): void {
//     // Create a box as a stand-in for the 3D model
//     const modelMesh = BABYLON.MeshBuilder.CreateBox(`${entity.name}-model`, { size: 1 }, scene);

//     // Create a material for the model
//     const material = new BABYLON.StandardMaterial(`${entity.name}-model-material`, scene);
//     material.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);
//     modelMesh.material = material;

//     // Setup the mesh
//     modelMesh.parent = entity;
//     modelMesh.metadata = { rootEntity: entity };

//     // Setup shadows for the model
//     setupMeshShadows(modelMesh);

//     // Store reference
//     entity.modelMesh = modelMesh;
// }

// // Apply generation log to entity
// function applyGenerationToEntity(entity: EntityNode, generation: any, scene: BABYLON.Scene): void {
//     if (!generation || !generation.fileUrl) return;

//     // Apply based on asset type
//     if (generation.assetType === 'image') {
//         // For images, we schedule an async operation to apply the image
//         // This avoids blocking the UI during deserialization
//         setTimeout(() => {
//             applyImageToEntity(entity, generation.fileUrl, scene, generation.imageParams?.ratio);
//             // Important: Only set to 2D mode if that's the current display mode
//             // This prevents overriding the user's preference
//             if (entity.displayMode === '2d') {
//                 entity.setDisplayMode('2d');
//             }
//         }, 0);
//     }
//     else if (generation.assetType === 'model') {
//         // For models, we need to create the model mesh and set 3D display mode
//         setTimeout(() => {
//             // In a real implementation, load the model from generation.fileUrl
//             // For now, create a mock model
//             createMockModelMesh(entity, scene);

//             // Only switch to 3D mode if that was the saved display mode
//             if (entity.displayMode === '3d') {
//                 entity.setDisplayMode('3d');
//             }
//         }, 0);
//     }
// }


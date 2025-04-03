import { isEntity } from "../entity/entityUtils";
import { EntityBase, SerializedEntityData } from "../entity/EntityBase";
import { GenerativeEntity, SerializedGenerativeEntityData } from "../entity/GenerativeEntity";
import { ShapeEntity, SerializedShapeEntityData } from "../entity/ShapeEntity";
import { LightEntity, SerializedLightEntityData } from "../entity/LightEntity";
import { EntityFactory } from "../entity/EntityFactory";
import * as BABYLON from '@babylonjs/core';
import { getEnvironmentObjects, setRatioOverlayRatio, setRatioOverlayPadding, setRatioOverlayVisibility, setRatioOverlayRightPadding } from './editor-util';
import { ImageRatio } from '../generation/generation-util';
import { API_Info } from '../generation/image-render-api';
import { LoraConfig } from '../generation/lora';
import { GenerativeEntityProps } from "../entity/GenerativeEntity";
import { CharacterEntity, SerializedCharacterEntityData } from "../entity/CharacterEntity";

// Interface for serialized render settings
export interface SerializedProjectSettings {
    prompt: string;
    promptStrength: number;
    depthStrength: number;
    noiseStrength: number;
    selectedAPI: string; // Store API ID as string
    seed: number;
    useRandomSeed: boolean;
    selectedLoras: LoraConfig[];
    renderLogs: RenderLog[];
    openOnRendered: boolean;
}

export interface RenderLog {
    imageUrl: string;
    prompt: string;
    model: string;
    timestamp: Date;
    seed?: number;
    promptStrength?: number;
    depthStrength?: number;
    selectedLoras?: any[];
}
  
// Interface for serialized environment settings
interface SerializedEnvironment {
    sun?: {
        intensity: number;
        diffuse: { r: number, g: number, b: number };
        direction: { x: number, y: number, z: number };
    };
    ambientLight?: {
        intensity: number;
        diffuse: { r: number, g: number, b: number };
    };
    ratioOverlay?: {
        visible: boolean;
        ratio: ImageRatio;
        padding: number;
        rightExtraPadding?: number;
    };
    camera?: {
        fov: number;
        farClip: number;
        position: { x: number, y: number, z: number };
        target: { x: number, y: number, z: number };
        radius: number;
        alpha: number;
        beta: number;
    };
}

// Serialize environment settings
export function serializeEnvironment(scene: BABYLON.Scene): SerializedEnvironment {
    const env = getEnvironmentObjects();
    const serializedEnv: SerializedEnvironment = {};

    // Serialize sun properties
    if (env.sun) {
        serializedEnv.sun = {
            intensity: env.sun.intensity,
            diffuse: {
                r: env.sun.diffuse.r,
                g: env.sun.diffuse.g,
                b: env.sun.diffuse.b
            },
            direction: {
                x: env.sun.direction.x,
                y: env.sun.direction.y,
                z: env.sun.direction.z
            }
        };
    }

    // Serialize ambient light properties
    if (env.ambientLight) {
        serializedEnv.ambientLight = {
            intensity: env.ambientLight.intensity,
            diffuse: {
                r: env.ambientLight.diffuse.r,
                g: env.ambientLight.diffuse.g,
                b: env.ambientLight.diffuse.b
            }
        };
    }

    // Serialize ratio overlay settings
    if (env.ratioOverlay) {
        serializedEnv.ratioOverlay = {
            visible: env.ratioOverlay.frame.isVisible,
            ratio: env.ratioOverlay.ratio,
            padding: env.ratioOverlay.padding,
            rightExtraPadding: env.ratioOverlay.rightExtraPadding || 0
        };
    }

    // Serialize camera settings
    if (scene.activeCamera) {
        const camera = scene.activeCamera;
        
        if (camera instanceof BABYLON.ArcRotateCamera) {
            // For ArcRotateCamera, save radius, alpha, beta, and target
            serializedEnv.camera = {
                fov: camera.fov,
                farClip: camera.maxZ,
                position: {
                    x: camera.position.x,
                    y: camera.position.y,
                    z: camera.position.z
                },
                target: {
                    x: camera.target.x,
                    y: camera.target.y,
                    z: camera.target.z
                },
                radius: camera.radius,
                alpha: camera.alpha,
                beta: camera.beta
            };
        } else {
            // For other camera types, just save position and fov
            serializedEnv.camera = {
                fov: camera.fov,
                farClip: camera.maxZ,
                position: {
                    x: camera.position.x,
                    y: camera.position.y,
                    z: camera.position.z
                },
                target: { x: 0, y: 0, z: 0 }, // Default values
                radius: 0,
                alpha: 0,
                beta: 0
            };
        }
    }

    return serializedEnv;
}

// Deserialize and apply environment settings
export function deserializeEnvironment(data: SerializedEnvironment, scene: BABYLON.Scene): void {
    const env = getEnvironmentObjects();

    // Apply sun settings
    if (data.sun && env.sun) {
        env.sun.intensity = data.sun.intensity;
        env.sun.diffuse = new BABYLON.Color3(
            data.sun.diffuse.r,
            data.sun.diffuse.g,
            data.sun.diffuse.b
        );
        env.sun.direction = new BABYLON.Vector3(
            data.sun.direction.x,
            data.sun.direction.y,
            data.sun.direction.z
        );
    }

    // Apply ambient light settings
    if (data.ambientLight && env.ambientLight) {
        env.ambientLight.intensity = data.ambientLight.intensity;
        env.ambientLight.diffuse = new BABYLON.Color3(
            data.ambientLight.diffuse.r,
            data.ambientLight.diffuse.g,
            data.ambientLight.diffuse.b
        );
    }

    // Apply ratio overlay settings
    if (data.ratioOverlay && env.ratioOverlay) {
        setRatioOverlayVisibility(data.ratioOverlay.visible);
        setRatioOverlayRatio(data.ratioOverlay.ratio, scene);
        setRatioOverlayPadding(data.ratioOverlay.padding, scene);
        
        if (data.ratioOverlay.rightExtraPadding !== undefined) {
            setRatioOverlayRightPadding(data.ratioOverlay.rightExtraPadding, scene);
        }
    }

    // Apply camera settings
    if (data.camera && scene.activeCamera) {
        const camera = scene.activeCamera as BABYLON.ArcRotateCamera;
        
        // Update FOV
        if (data.camera.fov !== undefined) {
            camera.fov = data.camera.fov;
        }
        
        // Update position and target
        if (data.camera.position) {
            camera.position = new BABYLON.Vector3(
                data.camera.position.x,
                data.camera.position.y,
                data.camera.position.z
            );
        }
        
        if (data.camera.target) {
            camera.setTarget(new BABYLON.Vector3(
                data.camera.target.x,
                data.camera.target.y,
                data.camera.target.z
            ));
        }
        
        // Update alpha, beta, radius if provided
        if (data.camera.alpha !== undefined) {
            camera.alpha = data.camera.alpha;
        }
        
        if (data.camera.beta !== undefined) {
            camera.beta = data.camera.beta;
        }
        
        if (data.camera.radius !== undefined) {
            camera.radius = data.camera.radius;
        }
        
        // Update far clip if provided
        if (data.camera.farClip !== undefined) {
            camera.maxZ = data.camera.farClip;
        }
    }
}

// Deserialize a project JSON and recreate all entities in the scene
export function deserializeScene(
    data: any,
    scene: BABYLON.Scene,
    applyProjectSettings?: (settings: SerializedProjectSettings) => void
): void {
    // Clear existing entities if needed
    const existingEntities = scene.rootNodes.filter(node => isEntity(node));
    // Dispose all children of the existing entities
    existingEntities.forEach(entity => {
        if(entity instanceof CharacterEntity) {
            entity.disposeCharacter();
        }
    });
    existingEntities.forEach(entity => entity.dispose());

    // Apply environment settings if present
    if (data.environment) {
        deserializeEnvironment(data.environment, scene);
    }

    // Apply project settings if present and callback provided
    if (data.ProjectSettings && applyProjectSettings) {
        applyProjectSettings(data.ProjectSettings);
    }

    // Create entities from the saved data
    if (data.entities && Array.isArray(data.entities)) {
        // Create entities from serialized data using entity class deserializers
        data.entities.forEach((entityData: SerializedEntityData) => {
            try {
                // Create the entity based on its type
                const entityType = entityData.entityType;
                
                switch (entityType) {
                    case 'light':
                        LightEntity.deserialize(scene, entityData as SerializedLightEntityData);
                        break;
                        
                    case 'shape':
                        ShapeEntity.deserialize(scene, entityData as SerializedShapeEntityData);
                        break;
                        
                    case 'generative':
                        GenerativeEntity.deserialize(scene, entityData as SerializedGenerativeEntityData);
                        break;
                    case 'character':
                        CharacterEntity.deserialize(scene, entityData as SerializedCharacterEntityData);
                        break;                        
                    default:
                        console.warn(`Unknown entity type: ${entityType}`);
                        break;
                }
                
            } catch (error) {
                console.error(`Error creating entity from saved data:`, error, entityData);
            }
        });
    }
}

// Save scene to a JSON file for download with Save As dialog 
export async function saveProjectToFile(
    scene: BABYLON.Scene,
    ProjectSettings?: SerializedProjectSettings,
    fileName: string = 'scene-project.mud'
): Promise<void> {
    const projectData = serializeScene(scene, ProjectSettings);
    const jsonString = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/mud' });

    // Try to use the File System Access API if available (modern browsers)
    if ('showSaveFilePicker' in window) {
        try {
            // @ts-ignore - TypeScript might not recognize this API yet
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{
                    description: 'MUD Files',
                    accept: { 'application/mud': ['.mud'] },
                }],
            });

            // Create a writable stream
            // @ts-ignore - TypeScript might not recognize this API yet
            const writable = await fileHandle.createWritable();

            // Write the blob to the file
            // @ts-ignore - TypeScript might not recognize this API yet
            await writable.write(blob);

            // Close the file
            // @ts-ignore - TypeScript might not recognize this API yet
            await writable.close();

            return;
        } catch (err) {
            // User probably cancelled the save dialog or browser doesn't support it
            console.log("File System Access API failed, falling back to download method");
        }
    } else {

        // Fallback method for browsers that don't support File System Access API
        // This doesn't always show a Save As dialog, but we can try to encourage it
        const url = URL.createObjectURL(blob);

        // Create and trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;

        // Append to body and click (to ensure it works in all browsers)
        document.body.appendChild(a);
        a.click();

        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

    }
}

// Load project from a file
export async function loadProjectFromFile(
    file: File,
    scene: BABYLON.Scene,
    applyProjectSettings?: (settings: SerializedProjectSettings) => void
): Promise<void> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                if (event.target && typeof event.target.result === 'string') {
                    const projectData = JSON.parse(event.target.result);
                    deserializeScene(projectData, scene, applyProjectSettings);
                    resolve();
                }
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error('Failed to read project file'));
        };

        reader.readAsText(file);
    });
}

// Serialize all entities in a scene to a project JSON structure
export function serializeScene(
    scene: BABYLON.Scene,
    ProjectSettings?: SerializedProjectSettings
): any {
    const entities: EntityBase[] = [];

    // Find all entities in the scene
    scene.rootNodes.forEach(node => {
        if (isEntity(node) && node.isEnabled()) {
            entities.push(node);
        }
    });

    // Serialize environment settings
    const environment = serializeEnvironment(scene);

    // Create project data structure
    const project = {
        version: "1.0.1",
        timestamp: new Date().toISOString(),
        entities: entities.map(entity => entity.serialize()),
        environment: environment,
        ProjectSettings: ProjectSettings
    };

    return project;
}

// Utility function to download an image from a URL
export async function downloadImage(imageUrl: string, filename?: string): Promise<void> {
  if (!imageUrl) return;
  
  // Create default filename if not provided
  const defaultFilename = imageUrl.split('/').pop() || `render-${new Date().toISOString()}.png`;
  const downloadFilename = filename || defaultFilename;
  
  try {
    // Convert the dataURL to a blob
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    
    // Fallback method for browsers that don't support File System Access API
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadFilename;
    a.target = '_blank';
    
    // Append to body and click (to ensure it works in all browsers)
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
  } catch (error) {
    console.error("Error downloading image:", error);
  }
}

// Load project from a URL
export async function loadProjectFromUrl(
  url: string,
  scene: BABYLON.Scene,
  applyProjectSettings?: (settings: SerializedProjectSettings) => void
): Promise<void> {
  try {
    // Fetch the project data from the URL
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to load project from URL: ${response.status} ${response.statusText}`);
    }
    
    // Parse the JSON data
    const projectData = await response.json();
    
    // Deserialize the scene using the data
    deserializeScene(projectData, scene, applyProjectSettings);
    
    console.log(`Project loaded successfully from ${url}`);
    return Promise.resolve();
  } catch (error) {
    console.error("Error loading project from URL:", error);
    return Promise.reject(error);
  }
}

import { isEntity, EntityNode, deserializeEntityNode, serializeEntityNode } from "../extensions/entityNode";
import * as BABYLON from '@babylonjs/core';

// Deserialize a project JSON and recreate all EntityNodes in the scene
export function deserializeScene(data: any, scene: BABYLON.Scene): void {
    // Clear existing entities if needed
    const existingEntities = scene.rootNodes.filter(node => isEntity(node));
    existingEntities.forEach(entity => entity.dispose());

    // Create entities from the saved data
    if (data.entities && Array.isArray(data.entities)) {
        data.entities.forEach((entityData: any) => {
            deserializeEntityNode(entityData, scene);
        });
    }
}

// Utility functions for file operations

// Save scene to a JSON file for download
export function saveProjectToFile(scene: BABYLON.Scene, fileName: string = 'scene-project.json'): void {
    const projectData = serializeScene(scene);
    const jsonString = JSON.stringify(projectData, null, 2);

    // Create a blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();

    // Clean up
    URL.revokeObjectURL(url);
}

// Load project from a file
export async function loadProjectFromFile(file: File, scene: BABYLON.Scene): Promise<void> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                if (event.target && typeof event.target.result === 'string') {
                    const projectData = JSON.parse(event.target.result);
                    deserializeScene(projectData, scene);
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

// Serialize all EntityNodes in a scene to a project JSON structure
export function serializeScene(scene: BABYLON.Scene): any {
    const entityNodes: EntityNode[] = [];

    // Find all EntityNodes in the scene
    scene.rootNodes.forEach(node => {
        if (isEntity(node)) {
            entityNodes.push(node);
        }
    });

    // Create project data structure
    const project = {
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        entities: entityNodes.map(entity => serializeEntityNode(entity))
    };

    return project;
}

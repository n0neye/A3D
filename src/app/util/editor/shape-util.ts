import * as BABYLON from '@babylonjs/core';
import { getEnvironmentObjects } from './editor-util';
import { EntityBase } from '../entity/EntityBase';
import { ShapeType } from '../entity/ShapeEntity';
import { defaultMaterial } from './material-util';
import { setupMeshShadows } from './light-util';

// Add this function to load all shape meshes once
export async function loadShapeMeshes(scene: BABYLON.Scene): Promise<void> {
    // Create a map to store the loaded meshes
    const shapeMeshes = new Map<string, BABYLON.Mesh>();

    try {
        console.log("Loading shape meshes from GLTF file...");
        const result = await BABYLON.ImportMeshAsync("/models/shapes.gltf", scene);

        // Store each mesh in the map
        for (const mesh of result.meshes) {
            if (mesh instanceof BABYLON.Mesh) {
                // Only store root meshes, not child meshes
                // if (!mesh.parent || !(mesh.parent instanceof BABYLON.Mesh)) {
                const meshName = mesh.name.toLocaleLowerCase();
                console.log(`Caching shape mesh: ${meshName}`);

                // Clone the mesh to keep a clean copy in our cache
                // const clonedMesh = mesh.clone(`cached-${mesh.name}`) as BABYLON.Mesh;

                // Hide the original mesh
                // mesh.dispose();
                mesh.isVisible = false;
                mesh.setEnabled(false);

                // Add to cache
                shapeMeshes.set(meshName, mesh);
            }
        }

        // Store in environment objects
        getEnvironmentObjects().cachedShapeMeshes = shapeMeshes;

        console.log(`Successfully cached ${shapeMeshes.size} shape meshes`);
    } catch (error) {
        console.error("Error loading shape meshes:", error);
    }
}

export const createShapeMesh = (scene: BABYLON.Scene, shapeType: ShapeType): BABYLON.Mesh => {
    // Try to get the cached mesh from the environment objects
    const cachedMeshes = getEnvironmentObjects().cachedShapeMeshes;

    if (!cachedMeshes) {
        throw new Error("Shape meshes haven't been loaded yet. Using fallback box.");
    }
    // Check if the shape exists in our cache
    const cachedMesh = cachedMeshes.get(shapeType);

    if (cachedMesh) {
        // Clone the cached mesh
        const clonedMesh = cachedMesh.clone(`${shapeType}`);

        // Make sure it's visible
        clonedMesh.isVisible = true;
        clonedMesh.setEnabled(true);

        
        // Return the created mesh
        console.log(`createShapeMesh: ${clonedMesh.name}`);
        return clonedMesh;
    }
    throw new Error(`Shape "${shapeType}" not found in cached meshes. Using fallback box.`);
}


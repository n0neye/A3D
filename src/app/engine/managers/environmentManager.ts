
import { GridMaterial } from "@babylonjs/materials/grid";
import { ImageRatio } from "@/app/util/generation/generation-util";
import * as BABYLON from "@babylonjs/core";
import { EditorEngine } from "../EditorEngine";
import { EquiRectangularCubeTexture } from "@babylonjs/core";

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
export interface EnvironmentObjects {
    sun?: BABYLON.DirectionalLight;
    sunTransform?: BABYLON.TransformNode;
    sunArrow?: BABYLON.Mesh;
    ambientLight?: BABYLON.Light;
    pointLights: BABYLON.PointLight[];
    skybox?: BABYLON.Mesh;
    background?: BABYLON.Mesh;
    grid?: BABYLON.Mesh;
    shadowGenerators: BABYLON.ShadowGenerator[];
}

export class EnvironmentManager {
    private engine: EditorEngine;
    private envObjects: EnvironmentObjects = {
        pointLights: [],
        shadowGenerators: [],
    };

    constructor(engine: EditorEngine) {
        this.engine = engine;
        this.createDefaultEnvironment();
    }

    createDefaultEnvironment(): void {
        const scene = this.engine.getScene();
        this.createWorldGrid(scene);              
        this.createSkybox(scene);
    }

    createWorldGrid = (
        scene: BABYLON.Scene,
        size: number = 100,
        majorUnitFrequency: number = 10
    ): BABYLON.Mesh => {
        // Create a ground mesh for the grid
        const gridGround = BABYLON.MeshBuilder.CreateGround(
            "worldGrid",
            { width: size, height: size, subdivisions: 1 },
            scene
        );
        gridGround.position.y = -0.01;
    
        // Create a grid material
        const gridMaterial = new GridMaterial("gridMaterial", scene);
        gridMaterial.majorUnitFrequency = majorUnitFrequency;
        gridMaterial.minorUnitVisibility = 0.45;
        gridMaterial.gridRatio = 1;
        gridMaterial.backFaceCulling = false;
        gridMaterial.mainColor = new BABYLON.Color3(0.2, 0.2, 0.3);
        gridMaterial.lineColor = new BABYLON.Color3(0.0, 0.7, 1.0);
        gridMaterial.opacity = 0.8;
    
        // Apply the material to the grid
        gridGround.material = gridMaterial;
    
        // Set grid to be non-pickable and not receive shadows
        gridGround.isPickable = false;
        gridGround.receiveShadows = true; // Enable receiving shadows for the grid
    
        // Store in environment objects
        this.envObjects.grid = gridGround;
    
        return gridGround;
    };

    createSkybox = (scene: BABYLON.Scene) => {
        // Create environment texture
        const texture = new EquiRectangularCubeTexture("./demoAssets/skybox/qwantani_puresky_4k.jpg", scene, 100);
        scene.environmentTexture = texture;
        scene.createDefaultSkybox(texture, true, 100, 0.5, true);
    }

    public getEnvObjects(): EnvironmentObjects {
        return this.envObjects;
    }
    
    // Serialize environment settings
    serializeEnvironment(): SerializedEnvironment {
        const scene = this.engine.getScene();
        const env = this.envObjects;
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

    deserializeEnvironment(data: SerializedEnvironment, engine: EditorEngine): void {
        const scene = engine.getScene();
    
        // Apply sun settings
        if (data.sun && this.envObjects.sun) {
            this.envObjects.sun.intensity = data.sun.intensity;
            this.envObjects.sun.diffuse = new BABYLON.Color3(
                data.sun.diffuse.r,
                data.sun.diffuse.g,
                data.sun.diffuse.b
            );
            this.envObjects.sun.direction = new BABYLON.Vector3(
                data.sun.direction.x,
                data.sun.direction.y,
                data.sun.direction.z
            );
        }
    
        // Apply ambient light settings
        if (data.ambientLight && this.envObjects.ambientLight) {
            this.envObjects.ambientLight.intensity = data.ambientLight.intensity;
            this.envObjects.ambientLight.diffuse = new BABYLON.Color3(
                data.ambientLight.diffuse.r,
                data.ambientLight.diffuse.g,
                data.ambientLight.diffuse.b
            );
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
}

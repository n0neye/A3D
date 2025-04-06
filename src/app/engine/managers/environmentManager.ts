import * as THREE from 'three';
import { ImageRatio } from "@/app/util/generation/generation-util";
import { EditorEngine } from "../EditorEngine";

interface SerializedEnvironment {
    sun?: {
        intensity: number;
        color: { r: number, g: number, b: number };
        direction: { x: number, y: number, z: number };
    };
    ambientLight?: {
        intensity: number;
        color: { r: number, g: number, b: number };
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
    };
}

export interface EnvironmentObjects {
    sun?: THREE.DirectionalLight;
    sunHelper?: THREE.DirectionalLightHelper;
    ambientLight?: THREE.AmbientLight;
    pointLights: THREE.PointLight[];
    skybox?: THREE.Mesh;
    background?: THREE.Mesh;
    grid?: THREE.GridHelper | THREE.Mesh;
}

export class EnvironmentManager {
    private engine: EditorEngine;
    private envObjects: EnvironmentObjects = {
        pointLights: [],
    };

    constructor(engine: EditorEngine) {
        this.engine = engine;
        this.createDefaultEnvironment();
    }

    createDefaultEnvironment(): void {
        const scene = this.engine.getScene();
        this.createWorldGrid(scene);              
        this.createSkybox(scene);
        // this.createLights(scene);
    }

    createWorldGrid = (
        scene: THREE.Scene,
        size: number = 100,
        divisions: number = 100
    ): THREE.GridHelper => {
        // Create a grid helper
        const grid = new THREE.GridHelper(size, divisions);
        grid.position.y = 0.01; // Slightly above 0 to avoid z-fighting
        scene.add(grid);
        
        // Store in environment objects
        this.envObjects.grid = grid;
        
        return grid;
    };

    createLights = (scene: THREE.Scene): void => {
        // Create ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        scene.add(ambientLight);
        this.envObjects.ambientLight = ambientLight;
        
        // Create directional light (sun)
        const sunLight = new THREE.DirectionalLight(0xffffff, 1);
        sunLight.position.set(10, 10, 10);
        sunLight.castShadow = true;
        
        // Configure shadow properties
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 50;
        
        // Set up shadow camera frustum
        const d = 20;
        sunLight.shadow.camera.left = -d;
        sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d;
        sunLight.shadow.camera.bottom = -d;
        
        scene.add(sunLight);
        this.envObjects.sun = sunLight;
        
        // Create helper for the sun
        const sunHelper = new THREE.DirectionalLightHelper(sunLight, 5);
        scene.add(sunHelper);
        this.envObjects.sunHelper = sunHelper;
    };

    createSkybox = (scene: THREE.Scene): void => {
        // TODO: Load equirectangular skybox from one image
        // Load cube texture for skybox
        // const loader = new THREE.CubeTextureLoader();
        // loader.setPath('./demoAssets/skybox/');
        
        // const textureCube = loader.load([
        //     'px.jpg', 'nx.jpg',
        //     'py.jpg', 'ny.jpg',
        //     'pz.jpg', 'nz.jpg'
        // ]);
        
        // scene.background = textureCube;
        // Also set as environment map for reflections
        // scene.environment = textureCube;

        
        scene.background = new THREE.Color(0.5,0.5,1); 
        
    };

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
                color: {
                    r: env.sun.color.r,
                    g: env.sun.color.g,
                    b: env.sun.color.b
                },
                direction: {
                    x: env.sun.position.x,
                    y: env.sun.position.y,
                    z: env.sun.position.z
                }
            };
        }
    
        // Serialize ambient light properties
        if (env.ambientLight) {
            serializedEnv.ambientLight = {
                intensity: env.ambientLight.intensity,
                color: {
                    r: env.ambientLight.color.r,
                    g: env.ambientLight.color.g,
                    b: env.ambientLight.color.b
                }
            };
        }
    
        // Serialize camera settings
        const camera = this.engine.getCameraManager().getCamera();
        if (camera) {
            serializedEnv.camera = {
                fov: camera.fov,
                farClip: camera.far,
                position: {
                    x: camera.position.x,
                    y: camera.position.y,
                    z: camera.position.z
                },
                target: {
                    x: 0, y: 0, z: 0 // Need to get target from OrbitControls
                }
            };
        }
    
        return serializedEnv;
    }

    deserializeEnvironment(data: SerializedEnvironment): void {
        const scene = this.engine.getScene();
    
        // Apply sun settings
        if (data.sun && this.envObjects.sun) {
            this.envObjects.sun.intensity = data.sun.intensity;
            this.envObjects.sun.color.setRGB(
                data.sun.color.r,
                data.sun.color.g,
                data.sun.color.b
            );
            this.envObjects.sun.position.set(
                data.sun.direction.x,
                data.sun.direction.y,
                data.sun.direction.z
            );
            
            // Update helper if it exists
            if (this.envObjects.sunHelper) {
                this.envObjects.sunHelper.update();
            }
        }
    
        // Apply ambient light settings
        if (data.ambientLight && this.envObjects.ambientLight) {
            this.envObjects.ambientLight.intensity = data.ambientLight.intensity;
            this.envObjects.ambientLight.color.setRGB(
                data.ambientLight.color.r,
                data.ambientLight.color.g,
                data.ambientLight.color.b
            );
        }
        
        // Apply camera settings
        if (data.camera) {
            const cameraManager = this.engine.getCameraManager();
            const camera = cameraManager.getCamera();
            
            // Update FOV
            if (data.camera.fov !== undefined) {
                cameraManager.setFOV(data.camera.fov);
            }
            
            // Update far clip
            if (data.camera.farClip !== undefined) {
                cameraManager.setFarClip(data.camera.farClip);
            }
            
            // Update position
            if (data.camera.position) {
                camera.position.set(
                    data.camera.position.x,
                    data.camera.position.y,
                    data.camera.position.z
                );
            }
            
            // Orbit controls target would need to be updated separately
            // This would require exposing the orbit controls
        }
    }
}

import * as THREE from 'three';
import { ImageRatio } from "@/app/engine/utils/imageUtil";
import { EditorEngine } from "../core/EditorEngine";

export const skyboxFolder = "./demoAssets/skybox/";
export const skyboxFiles = [
    "1.jpg",
    "2.jpg",
    "3.jpg",
    "4.jpg",
    "5.jpg",
    "6.jpg",
    "7.jpg",
    // "8.jpg",
    // "9.jpg",
    // "10.jpg",
    "HDRI2_7_output.jpg",
    "HDRI2_21_output.jpg",
    // "HDRI2_28_output.jpg"
];

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
    skybox: {
        path?: string;
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
    skybox?: {
        path?: string;
    }
    background?: THREE.Mesh;
    grid?: THREE.GridHelper | THREE.Mesh;
}

export class EnvironmentManager {
    private engine: EditorEngine;
    private envSetting: EnvironmentObjects = {
        pointLights: [],
    };

    constructor(engine: EditorEngine) {
        this.engine = engine;
        this.createDefaultEnvironment();
    }

    createDefaultEnvironment(): void {
        const scene = this.engine.getScene();
        this.createWorldGrid(scene);
        this.createSkybox(scene, "./demoAssets/skybox/qwantani_puresky_4k.jpg");
        this.createLights(scene);
    }

    createWorldGrid = (
        scene: THREE.Scene,
        size: number = 100,
        divisions: number = 100
    ): THREE.GridHelper => {
        // Create a grid helper
        const grid = new THREE.GridHelper(size, divisions);
        grid.position.y = -0.01; // Slightly above 0 to avoid z-fighting
        scene.add(grid);

        // Store in environment objects
        this.envSetting.grid = grid;

        return grid;
    };

    createLights = (scene: THREE.Scene): void => {
        // Create ambient light
        // const ambientLight = new THREE.AmbientLight(new THREE.Color(1, 0.3, 0.3), 1);
        // scene.add(ambientLight);
        // this.envObjects.ambientLight = ambientLight;

        // Create directional light (sun)
        const sunLight = new THREE.DirectionalLight(0xffffff, 0.3);
        sunLight.position.set(0, 2, 0);
        sunLight.castShadow = false;

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
        this.envSetting.sun = sunLight;

        // // Create helper for the sun
        // const sunHelper = new THREE.DirectionalLightHelper(sunLight, 5);
        // scene.add(sunHelper);
        // this.envObjects.sunHelper = sunHelper;
    };

    createSkybox = (scene: THREE.Scene, url?: string): void => {
        if (url) {
            // Load equirectangular texture
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(url, (texture) => {
                texture.mapping = THREE.EquirectangularReflectionMapping;

                // Set as background and environment map
                scene.background = texture;
                scene.environment = texture; // For reflections on materials
                scene.environmentIntensity = 0.5;
            });
        } else {
            // Fallback to solid color background
            scene.background = new THREE.Color(0.3, 0.3, 0.3);
        }

        this.envSetting.skybox = {
            path: url
        };
    };


    public getEnvObjects(): EnvironmentObjects {
        return this.envSetting;
    }

    // Serialize environment settings
    serializeEnvironment(): SerializedEnvironment {
        const scene = this.engine.getScene();
        const env = this.envSetting;
        const serializedEnv: SerializedEnvironment = {
            skybox: {
                path: env.skybox?.path || undefined
            }
        };

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
        if (data.sun && this.envSetting.sun) {
            this.envSetting.sun.intensity = data.sun.intensity;
            this.envSetting.sun.color.setRGB(
                data.sun.color.r,
                data.sun.color.g,
                data.sun.color.b
            );
            this.envSetting.sun.position.set(
                data.sun.direction.x,
                data.sun.direction.y,
                data.sun.direction.z
            );

            // Update helper if it exists
            if (this.envSetting.sunHelper) {
                this.envSetting.sunHelper.update();
            }
        }

        // Apply ambient light settings
        if (data.ambientLight && this.envSetting.ambientLight) {
            this.envSetting.ambientLight.intensity = data.ambientLight.intensity;
            this.envSetting.ambientLight.color.setRGB(
                data.ambientLight.color.r,
                data.ambientLight.color.g,
                data.ambientLight.color.b
            );
        }

        // Apply skybox settings
        if (data.skybox && this.envSetting.skybox) {
            this.envSetting.skybox.path = data.skybox.path;
            this.createSkybox(scene, data.skybox.path);
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

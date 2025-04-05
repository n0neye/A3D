import * as BABYLON from "@babylonjs/core";
import { GridMaterial } from "@babylonjs/materials/grid";
import { EntityBase } from "@/app/engine/entity/EntityBase";
import * as GUI from '@babylonjs/gui';
import { ImageRatio, RATIO_MAP } from '../generation/generation-util';
import { EquiRectangularCubeTexture } from "@babylonjs/core";
import { TransformCommand } from "@/app/lib/commands";
import { HistoryManager } from "@/app/engine/managers/HistoryManager";
import { LightEntity } from "@/app/engine/entity/LightEntity";
// Store environment objects
export interface EnvironmentObjects {
    sun?: BABYLON.DirectionalLight;
    sunTransform?: BABYLON.TransformNode;
    sunArrow?: BABYLON.Mesh;
    ambientLight?: BABYLON.Light;
    pointLights: BABYLON.PointLight[];
    skybox?: BABYLON.Mesh;
    background?: BABYLON.Mesh;
    grid?: BABYLON.Mesh;
    ratioOverlay?: {
        container: GUI.AdvancedDynamicTexture;
        frame: GUI.Rectangle;
        padding: number;
        rightExtraPadding: number;
        ratio: ImageRatio;
        borders?: {
            top: GUI.Rectangle;
            right: GUI.Rectangle;
            bottom: GUI.Rectangle;
            left: GUI.Rectangle;
        };
    };
    shadowGenerators: BABYLON.ShadowGenerator[];
    cachedShapeMeshes?: Map<string, BABYLON.Mesh>;
}

// Global environment reference
export const environmentObjects: EnvironmentObjects = {
    shadowGenerators: [], // Initialize the array
    pointLights: []
};

export const getEnvironmentObjects = (): EnvironmentObjects => {
    return environmentObjects;
};

// Default ratio
const DEFAULT_RATIO: ImageRatio = '16:9';


export const createSkybox = (scene: BABYLON.Scene) => {

    // Create environment texture
    const texture = new EquiRectangularCubeTexture("./demoAssets/skybox/qwantani_puresky_4k.jpg", scene, 100);
    scene.environmentTexture = texture;
    // scene.createDefaultEnvironment();
    scene.createDefaultSkybox(texture, true, 100, 0.5, true);

}


/**
 * Creates an equirectangular skybox (more suitable for 21:9 panoramic images)
 * @param scene The Babylon.js scene 
 * @param url URL to the equirectangular image
 * @returns The created skybox dome
 */
export const createEquirectangularSkybox = (
    scene: BABYLON.Scene,
    url: string,
): BABYLON.Mesh => {
    // Create a large dome for the skybox
    const maxZ = scene.activeCamera?.maxZ || 100;
    const skyDome = BABYLON.MeshBuilder.CreateSphere(
        "skyDome",
        {
            diameter: maxZ * 2,
            segments: 32,
            sideOrientation: BABYLON.Mesh.BACKSIDE
        },
        scene
    );


    // Flip the skybox
    skyDome.rotation.x = Math.PI;

    // Create material
    const skyMaterial = new BABYLON.StandardMaterial("skyMaterial", scene);
    skyMaterial.backFaceCulling = false;
    skyMaterial.disableLighting = true;

    // Create texture
    const skyTexture = new BABYLON.Texture(url, scene);
    skyMaterial.emissiveTexture = skyTexture;

    // Apply material
    skyDome.material = skyMaterial;

    // Move the skybox with the camera
    scene.onBeforeRenderObservable.add(() => {
        if (scene.activeCamera) {
            skyDome.position.copyFrom(scene.activeCamera.position);
        }
    });

    return skyDome;
};

/**
 * Creates a 2D background that fills the viewport while maintaining image aspect ratio
 * @param scene The Babylon.js scene
 * @param url URL to the background image
 * @returns The created background plane
 */
export const create2DBackground = (
    scene: BABYLON.Scene,
    url: string,
): BABYLON.Mesh => {
    if (!scene.activeCamera) {
        throw new Error("Scene must have an active camera");
    }

    // Create a large plane for the background
    const background = BABYLON.MeshBuilder.CreatePlane(
        "background",
        {
            width: 1,
            height: 1,
            sideOrientation: BABYLON.Mesh.FRONTSIDE
        },
        scene
    );

    // CRITICAL: Ensure background renders behind everything by setting these properties
    background.renderingGroupId = 0; // Render in first group (renders before group 1)

    // Create material
    const bgMaterial = new BABYLON.StandardMaterial("backgroundMaterial", scene);
    bgMaterial.backFaceCulling = false;
    bgMaterial.disableLighting = true;
    bgMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);

    // Disable depth writing to ensure it stays in background
    bgMaterial.disableDepthWrite = true;

    // Create texture and maintain aspect ratio
    const bgTexture = new BABYLON.Texture(url, scene);
    bgTexture.hasAlpha = true;
    bgMaterial.diffuseTexture = bgTexture;
    bgMaterial.emissiveTexture = bgTexture;
    bgMaterial.useAlphaFromDiffuseTexture = true;

    // Apply material
    background.material = bgMaterial;

    // Position it far away initially
    const farDistance = scene.activeCamera.maxZ * 0.99;

    // Function to update the background size and position
    const updateBackground = () => {
        if (!scene.activeCamera) return;

        // Get engine size
        const engine = scene.getEngine();
        const viewportWidth = engine.getRenderWidth();
        const viewportHeight = engine.getRenderHeight();
        const viewportAspectRatio = viewportWidth / viewportHeight;

        // Get texture aspect ratio
        const textureWidth = bgTexture.getSize().width || 1;
        const textureHeight = bgTexture.getSize().height || 1;
        const textureAspectRatio = textureWidth / textureHeight;

        if (scene.activeCamera instanceof BABYLON.ArcRotateCamera) {
            const camera = scene.activeCamera as BABYLON.ArcRotateCamera;

            // Calculate the FOV
            const fov = camera.fov || (Math.PI / 4);

            // Calculate visible height at far distance
            const visibleHeightAtDistance = 2 * Math.tan(fov / 2) * farDistance;
            const visibleWidthAtDistance = visibleHeightAtDistance * viewportAspectRatio;

            // Get camera direction
            const direction = camera.getDirection(BABYLON.Vector3.Forward());

            // Position the background at the far clip plane
            background.position = camera.position.add(direction.scale(farDistance));

            // Orient to face the camera
            background.lookAt(camera.position);

            // Scale to fill view
            let scaleX, scaleY;
            if (textureAspectRatio > viewportAspectRatio) {
                // Image is wider than viewport
                scaleY = visibleHeightAtDistance;
                scaleX = scaleY * textureAspectRatio;
            } else {
                // Image is taller than viewport
                scaleX = visibleWidthAtDistance;
                scaleY = scaleX / textureAspectRatio;
            }

            // Add 20% margin for full coverage
            const coverageFactor = 1.1;
            background.scaling.x = scaleX * coverageFactor;
            background.scaling.y = scaleY * coverageFactor;
        } else {
            // Similar logic for other camera types
            // ... (rest of the code)
        }
    };

    // Initial setup
    updateBackground();

    // Update when needed
    window.addEventListener('resize', updateBackground);
    scene.onBeforeRenderObservable.add(updateBackground);

    // Clean up
    background.onDisposeObservable.add(() => {
        window.removeEventListener('resize', updateBackground);
        scene.onBeforeRenderObservable.removeCallback(updateBackground);
    });

    return background;
};

/**
 * Creates a world floor grid to help with spatial orientation
 * @param scene The Babylon.js scene
 * @param size The size of the grid
 * @param majorUnitFrequency How often to show major grid lines
 * @returns The created grid mesh
 */
export const createWorldGrid = (
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
    environmentObjects.grid = gridGround;

    return gridGround;
};

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


// Default padding percentage (can be adjusted by user)
const DEFAULT_FRAME_PADDING = 10; // percentage of screen size

/**
 * Get the current dimensions and position of the ratio overlay
 * in scene coordinates
 */
export const getRatioOverlayDimensions = (scene: BABYLON.Scene): {
    left: number;
    top: number;
    width: number;
    height: number;
} | null => {
    if (!environmentObjects.ratioOverlay || !environmentObjects.ratioOverlay.borders) return null;

    const { padding, rightExtraPadding, ratio } = environmentObjects.ratioOverlay;
    const engine = scene.getEngine();
    const screenWidth = engine.getRenderWidth();
    const screenHeight = engine.getRenderHeight();

    // Calculate padding in pixels
    const paddingPixels = (padding / 100) * Math.min(screenWidth, screenHeight);
    const rightExtraPaddingPixels = (rightExtraPadding / 100) * Math.min(screenWidth, screenHeight);

    // Use the ratio from the ratio map
    const { width: ratioWidth, height: ratioHeight } = RATIO_MAP[ratio];
    const targetRatio = ratioWidth / ratioHeight;

    let frameWidth, frameHeight;

    if (screenWidth / screenHeight > targetRatio) {
        // Screen is wider than the target ratio
        frameHeight = screenHeight - (paddingPixels * 2);
        frameWidth = frameHeight * targetRatio;
    } else {
        // Screen is taller than the target ratio
        frameWidth = screenWidth - (paddingPixels * 2) - rightExtraPaddingPixels;
        frameHeight = frameWidth / targetRatio;
    }

    // Calculate position (centered on screen, but adjusted for extra right padding)
    const horizontalSpace = screenWidth - frameWidth;
    const leftPadding = (horizontalSpace - rightExtraPaddingPixels) / 2;

    return {
        left: leftPadding,
        top: (screenHeight - frameHeight) / 2,
        width: frameWidth,
        height: frameHeight
    };
};



export function initGizmo(scene: BABYLON.Scene, historyManager: HistoryManager) {
    const gizmoManager = new BABYLON.GizmoManager(scene, 1.5);
    gizmoManager.usePointerToAttachGizmos = false;

    gizmoManager.scaleGizmoEnabled = true;
    gizmoManager.positionGizmoEnabled = true;
    gizmoManager.rotationGizmoEnabled = true;

    // Scale gizmo sensitivity
    if (gizmoManager.gizmos.scaleGizmo) {
        gizmoManager.gizmos.scaleGizmo.sensitivity = 5.0;
    }

    if (gizmoManager.gizmos.positionGizmo) {
        gizmoManager.gizmos.positionGizmo.planarGizmoEnabled = true;
        gizmoManager.gizmos.positionGizmo.xPlaneGizmo.coloredMaterial.alpha = 0.3;
        gizmoManager.gizmos.positionGizmo.yPlaneGizmo.coloredMaterial.alpha = 0.3;
        gizmoManager.gizmos.positionGizmo.zPlaneGizmo.coloredMaterial.alpha = 0.3;
    }

    // Track the active transform command
    let activeTransformCommand: TransformCommand | null = null;

    // Set up event listeners for position gizmo
    if (gizmoManager.gizmos.positionGizmo) {
        console.log("init position gizmo")
        gizmoManager.gizmos.positionGizmo.onDragStartObservable.add((event) => {
            const node = gizmoManager.gizmos.positionGizmo?.attachedNode;
            if (node && node instanceof BABYLON.TransformNode) {
                // Create a new transform command when dragging starts
                activeTransformCommand = new TransformCommand(node);
            }
        });

        gizmoManager.gizmos.positionGizmo.onDragEndObservable.add((event) => {
            if (activeTransformCommand) {
                // Update the final state and add to history
                activeTransformCommand.updateFinalState();
                historyManager.executeCommand(activeTransformCommand);
                activeTransformCommand = null;
            }
        });
    }

    // Set up event listeners for rotation gizmo 
    if (gizmoManager.gizmos.rotationGizmo) {
        console.log("init rotation gizmo")
        gizmoManager.gizmos.rotationGizmo.onDragStartObservable.add((event) => {
            const node = gizmoManager.gizmos.rotationGizmo?.attachedNode;
            if (node && node instanceof BABYLON.TransformNode) {
                activeTransformCommand = new TransformCommand(node);
            }
        });

        gizmoManager.gizmos.rotationGizmo.onDragEndObservable.add((event) => {
            if (activeTransformCommand) {
                activeTransformCommand.updateFinalState();
                historyManager.executeCommand(activeTransformCommand);
                activeTransformCommand = null;
            }
        });
    }

    // Set up event listeners for scale gizmo
    if (gizmoManager.gizmos.scaleGizmo) {
        gizmoManager.gizmos.scaleGizmo.onDragStartObservable.add((event) => {
            const node = gizmoManager.gizmos.scaleGizmo?.attachedNode;
            if (node && node instanceof BABYLON.TransformNode) {
                activeTransformCommand = new TransformCommand(node);
            }
        });

        gizmoManager.gizmos.scaleGizmo.onDragEndObservable.add((event) => {
            if (activeTransformCommand) {
                activeTransformCommand.updateFinalState();
                historyManager.executeCommand(activeTransformCommand);
                activeTransformCommand = null;
            }
        });
    }

    return gizmoManager;
}


// Add a utility function to toggle gizmo visibility
export const UpdateGizmoVisibility = (visible: boolean, scene: BABYLON.Scene) => {
    if (!scene) return;

    // Hide/show light entity gizmos
    const lightEntities = scene.rootNodes.filter(node => node instanceof EntityBase && LightEntity.isLightEntity(node));

    lightEntities.forEach(entity => {
        // You'll need to add a visualMesh to LightEntity or update this logic
        if (entity.gizmoMesh) {
            entity.gizmoMesh.isVisible = visible;
        }
    });

    // Hide/show world grid
    const worldGrid = getEnvironmentObjects().grid;
    if (worldGrid) {
        worldGrid.isVisible = visible;
    }
};
import * as THREE from 'three';
import { EntityBase, SerializedEntityData } from '../base/EntityBase';
import { ProgressCallback } from '@/engine/utils/generation/generation-util';
import { v4 as uuidv4 } from 'uuid';
import { placeholderMaterial } from '@/engine/utils/materialUtil';
import { setupMeshShadows } from '@/engine/utils/lightUtil';
import { createShapeMesh } from '@/engine/utils/shapeUtil';
import { generate3DModel_Runpod, generate3DModel_Trellis, ModelApiProvider } from '@/engine/utils/generation/3d-generation-util';
import { doGenerateRealtimeImage, GenerationResult } from '@/engine/utils/generation/realtime-generation-util';
import { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { get3DSimulationData } from '@/engine/utils/simulation-data';
import { IGenerationLog, AssetType } from '@/engine/interfaces/generation';
import { ImageRatio } from '@/engine/utils/imageUtil';
import { text } from 'stream/consumers';
import { upload3DModelToGCP, upload3DModelToGCPAndModifyUrl } from '@/engine/utils/external/storageUtil';


/**
 * Entity that represents AI-generated content
 */

export interface GenerativeEntityProps {
  generationLogs: IGenerationLog[];
  currentGenerationId?: string;
  currentGenerationIdx?: number;
  isImported?: boolean;
}

export const StylePromptOptions = {
  BASIC_3D: {
    label: "Basic 3D",
    description: "Standard 3D look",
    promptSuffix: "at the center of the frame, full body shot, 3d model, uncropped, solid black background"
  },
  WHITE_3D: {
    label: "White 3D",
    description: "Clean white 3D model",
    promptSuffix: "at the center of the frame, full body shot, white 3d model, no texture, uncropped, solid black background"
  },
  TOY_3D: {
    label: "3D Toy",
    description: "Toy-like appearance",
    promptSuffix: "3d toy style, at the center of the frame, full body shot, 3d model, uncropped, solid black background"
  },
  REALISTIC_3D: {
    label: "3D Realistic",
    description: "Highly detailed realistic 3D",
    promptSuffix: "photorealistic 3d model, highly detailed, at the center of the frame, full body shot, 3d model, uncropped, solid black background"
  },
  CUSTOM: {
    label: "Custom",
    description: "Custom style settings",
    promptSuffix: ""
  }
} as const;

export type StylePromptOptionKey = keyof typeof StylePromptOptions;
export type StylePromptOption = typeof StylePromptOptions[StylePromptOptionKey]["label"];

export const styleOptions = Object.values(StylePromptOptions).map(option => option.label);

// Processing states
export type GenerationStatus = 'idle' | 'generating2D' | 'generating3D' | 'error';

export interface SerializedGenerativeEntityData extends SerializedEntityData {
  props: GenerativeEntityProps;
}

export class GenerativeEntity extends EntityBase {

  // EntityBase properties
  props: GenerativeEntityProps;

  gltfModel?: THREE.Object3D;
  billboardMesh: THREE.Mesh;

  status: GenerationStatus;
  statusMessage: string;

  temp_prompt: string;
  temp_ratio?: ImageRatio;
  temp_displayMode?: "3d" | "2d";
  temp_styleOption?: StylePromptOptionKey;

  public readonly onProgress = new EventHandler<{ entity: GenerativeEntity, state: GenerationStatus, message: string }>();
  public readonly onGenerationChanged = new EventHandler<{ entity: GenerativeEntity }>();

  constructor(
    name: string,
    scene: THREE.Scene,
    data: SerializedGenerativeEntityData,
    onLoaded?: (entity: GenerativeEntity) => void
  ) {
    super(name, scene, 'generative', data);

    // Create initial placeholder mesh
    const ratio = '3:4';
    const { width, height } = getPlaneSize(ratio);
    this.billboardMesh = createShapeMesh(scene, "plane");
    this.billboardMesh.material = placeholderMaterial;
    this.billboardMesh.scale.set(width, height, 1);

    // Add the mesh to the entity instead of setting parent
    this.add(this.billboardMesh);
    this.billboardMesh.userData = { rootSelectable: this };

    this.props = data.props || {
      generationLogs: []
    };

    this.status = 'idle';
    this.statusMessage = '';
    this.temp_prompt = '';
    this.temp_ratio = '1:1';
    this.temp_displayMode = '2d';
    this.temp_styleOption = 'BASIC_3D';

    // Apply generation log if available
    const currentLog = this.getCurrentGenerationLog();
    if (currentLog) {
      console.log("Constructor: applyGenerationLog", currentLog);
      this.applyGenerationLog(currentLog);
    }

    onLoaded?.(this);
  }

  setDisplayMode(mode: "3d" | "2d"): void {
    if (this.gltfModel) {
      this.gltfModel.visible = mode === '3d';
    }
    this.billboardMesh.visible = mode === '2d';
    this.temp_displayMode = mode;
  }

  getPrimaryMesh(): THREE.Object3D | undefined {
    return this.temp_displayMode === '3d' ? this.gltfModel : this.billboardMesh;
  }

  getScene(): THREE.Scene {
    return this.parent as THREE.Scene;
  }


  // Update aspect ratio of the entity
  public updateAspectRatio(ratio: ImageRatio): void {
    if (!this.billboardMesh) return;

    // Save the new ratio in metadata
    this.temp_ratio = ratio;

    // Get the new dimensions based on ratio
    const { width, height } = getPlaneSize(ratio);
    this.billboardMesh.scale.set(width, height, 1);
  }

  async createAndApplyNewGenerationLog(assetType: AssetType, props: { fileUrl: string, prompt: string, derivedFromId?: string }): Promise<IGenerationLog> {
    console.log("onNewGeneration", props);
    const log: IGenerationLog = {
      id: uuidv4(),
      timestamp: Date.now(),
      prompt: props.prompt,
      assetType: assetType,
      fileUrl: props.fileUrl,
      derivedFromId: props.derivedFromId,
      imageParams: {
        ratio: this.temp_ratio || '1:1',
        stylePrompt: this.temp_styleOption || 'CUSTOM'
      }
    };

    // Add to props
    this.props.generationLogs.push(log);
    this.props.currentGenerationId = log.id;
    this.props.currentGenerationIdx = this.props.generationLogs.length - 1;

    // Update prompt
    this.temp_prompt = props.prompt;

    await this.applyGenerationLog(log);

    return log;
  }

  async applyGenerationLog(log: IGenerationLog, onFinish?: (entity: GenerativeEntity) => void): Promise<boolean> {
    try {
      console.log('applyGenerationLog', log);
      if (log.assetType === 'image' && log.fileUrl) {
        // For image assets, apply the image to the entity
        await this.applyImage(log.fileUrl, log.imageParams?.ratio);
        this.setDisplayMode('2d');
      } else if (log.assetType === 'model' && log.fileUrl) {
        // Load the model into the entity
        await loadModel(this, log.fileUrl, log, (progress) => {
          console.log("loadModel progress", progress);
        });
        this.setDisplayMode('3d');
      }

      if (onFinish) {
        onFinish(this);
      }

      // Notify that generation has changed
      this.onGenerationChanged.trigger({ entity: this });
      return true;
    } catch (error) {
      console.error("Error applying generation log:", error);
      return false;
    }
  }

  getCurrentGenerationLog(): IGenerationLog | undefined {
    // Find current generation
    const { currentGenerationId, generationLogs } = this.props;
    if (!currentGenerationId || !generationLogs?.length) return undefined;

    const log = generationLogs.find(log => log.id === currentGenerationId);
    return log;
  }

  getCurrentGenerationLogIdx(): number {
    const { currentGenerationId, generationLogs } = this.props;
    if (!currentGenerationId || !generationLogs?.length) return -1;

    const idx = generationLogs.findIndex(log => log.id === currentGenerationId);
    if (idx === -1) {
      return generationLogs.length - 1;
    }
    return idx;
  }

  goToPreviousGeneration(): void {
    const { generationLogs } = this.props;
    const currentIdx = this.getCurrentGenerationLogIdx();
    if (currentIdx > 0) {
      const prevLog = generationLogs[currentIdx - 1];
      this.props.currentGenerationId = prevLog.id;
      this.props.currentGenerationIdx = currentIdx - 1;
      this.applyGenerationLog(prevLog);
    }
  }

  goToNextGeneration(): void {
    const { generationLogs } = this.props;
    const currentIdx = this.getCurrentGenerationLogIdx();
    if (currentIdx < generationLogs.length - 1) {
      const nextLog = generationLogs[currentIdx + 1];
      this.props.currentGenerationId = nextLog.id;
      this.props.currentGenerationIdx = currentIdx + 1;
      this.applyGenerationLog(nextLog);
    }
  }

  /**
   * Set the processing state
   */
  setProcessingState(state: GenerationStatus, message?: string): void {
    this.status = state;
    this.statusMessage = message || '';
    this.onProgress.trigger({ entity: this, state, message: message || '' });
  }

  async applyImage(imageUrl: string, ratio?: ImageRatio): Promise<void> {
    try {
      // Create a texture loader
      const textureLoader = new THREE.TextureLoader();

      // For file:// URLs, we need to use IPC to get the image data
      if (imageUrl.startsWith('file://') && window.electron?.loadImageData) {
        console.log('Loading local image via IPC:', imageUrl);

        // Use the IPC bridge to get image as base64 data URL
        const base64Data = await window.electron.loadImageData(imageUrl);

        // Replace the file:// URL with the base64 data
        imageUrl = base64Data;
      }

      // Load the image
      const texture = await textureLoader.loadAsync(imageUrl);
      texture.colorSpace = THREE.SRGBColorSpace;

      // if is placeholder material, create a new material
      if (this.billboardMesh.material === placeholderMaterial) {

        // Update the material
        const newMaterial = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          side: THREE.DoubleSide,
          fog: false,
        });

        // Apply to the billboard mesh
        this.billboardMesh.material = newMaterial;
      }
      // Else, update the texture
      else if (this.billboardMesh.material instanceof THREE.MeshBasicMaterial) {
        this.billboardMesh.material.map = texture;
      }

      // Update the mesh size based on the ratio
      if (ratio) {
        const { width, height } = getPlaneSize(ratio);
        this.billboardMesh.scale.set(width, height, 1);
      }

      // Set to 2D mode
      this.setDisplayMode('2d');

    } catch (error) {
      console.error('Error in applyImage:', error);
    }
  }


  async generateRealtimeImage(
    prompt: string,
    options: {
      stylePrompt?: StylePromptOptionKey;
      negativePrompt?: string;
      ratio?: ImageRatio;
    } = { ratio: '1:1' }
  ): Promise<GenerationResult> {
    const scene = this.getScene();
    return doGenerateRealtimeImage(prompt, this, { ratio: options.ratio, styleOption: options.stylePrompt });
  }

  /**
   * Generate a 3D model from an image
   */
  async generate3DModel(
    imageUrl: string,
    derivedFromId: string,
    options: {
      prompt?: string;
      apiProvider?: ModelApiProvider;
    } = {}
  ): Promise<GenerationResult> {
    // Set a default prompt if none is provided
    const prompt = options.prompt || 'Generate a 3D model from this image';

    // Set status
    this.status = 'generating3D';
    this.statusMessage = "Starting 3D generation...";
    this.onProgress.trigger({ entity: this, state: this.status, message: this.statusMessage });


    // If prompt is "_", use simulation data
    if (options.prompt === "_") {
      // Wait for 1 second
      await new Promise(resolve => setTimeout(resolve, 500));
      const result = get3DSimulationData();
      const log = await this.createAndApplyNewGenerationLog("model", { fileUrl: result.data.model_mesh.url, prompt: options.prompt, derivedFromId: derivedFromId });
      return { success: true, generationLog: log };
    }

    try {
      // Use the specified API provider, or default to Runpod
      if (options.apiProvider === 'trellis') {
        return await generate3DModel_Trellis(
          imageUrl,
          this,
          this.getScene(),
          derivedFromId,
          { prompt: options.prompt }
        );
      } else {
        return await generate3DModel_Runpod(
          imageUrl,
          this,
          this.getScene(),
          derivedFromId,
          { prompt: options.prompt }
        );
      }
    } catch (error) {
      console.error(`Error generating 3D model:`, error);
      this.status = 'error';
      this.statusMessage = error instanceof Error ? error.message : String(error);
      this.onProgress.trigger({ entity: this, state: this.status, message: this.statusMessage });
      return { success: false, generationLog: null };
    }
  }

  addImageGenerationLog(prompt: string, imageUrl: string, ratio: ImageRatio, stylePrompt?: StylePromptOptionKey): IGenerationLog {
    const log: IGenerationLog = {
      id: uuidv4(),
      timestamp: Date.now(),
      prompt: prompt,
      assetType: 'image',
      fileUrl: imageUrl,
      imageParams: {
        ratio: ratio,
        stylePrompt: stylePrompt || 'CUSTOM'
      }
    };
    this.props.generationLogs.push(log);
    this.props.currentGenerationId = log.id;
    this.props.currentGenerationIdx = this.props.generationLogs.length - 1;
    return log;
  }

  /**
   * Serialize with generative-specific properties
   */
  serialize(): SerializedGenerativeEntityData {
    const base = super.serialize();
    return {
      ...base,
      props: this.props,
    };
  }

  // Clean up resources
  dispose(): void {
    // Clean up materials and geometries
    if (this.billboardMesh) {
      if (this.billboardMesh.material) {
        if (Array.isArray(this.billboardMesh.material)) {
          this.billboardMesh.material.forEach(mat => mat.dispose());
        } else {
          this.billboardMesh.material.dispose();
        }
      }
      if (this.billboardMesh.geometry) {
        this.billboardMesh.geometry.dispose();
      }
    }

    if (this.gltfModel) {
      this.gltfModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          child.material.dispose();
        }
      });
    }

    super.dispose();
  }
}

// Helper functions
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

/**
 * Load a 3D model and replace the current mesh
 */
export async function loadModel(
  entity: GenerativeEntity,
  modelUrl: string,
  log: IGenerationLog,
  onProgress?: ProgressCallback
): Promise<boolean> {
  try {
    onProgress?.({ message: 'Downloading 3D model...' });
    console.log("loadModel", modelUrl);


    // If not persistent url, upload to GCP.
    if (modelUrl.startsWith('blob:')) {
      // Upload to GCP
      upload3DModelToGCPAndModifyUrl(modelUrl, log);
    }

    // TODO: ATM, we'll continue to load the model from the data url, without waiting for the upload to GCP to complete. May need to change this.
    // Load the model using GLTFLoader
    const loader = new GLTFLoader();

    // Handle local file:// URLs using Electron's IPC bridge
    if (modelUrl.startsWith('file://') && window.electron?.readFile) {
      console.log('Loading local model via IPC:', modelUrl);

      try {
        // Get model data through IPC
        const modelData = await window.electron.readFile(modelUrl);

        // Create a promise wrapper for the async load from array buffer
        const gltf = await new Promise<GLTF>((resolve, reject) => {
          loader.parse(
            modelData,
            '', // Base path, not needed when loading from memory
            (gltf) => resolve(gltf),
            (error) => reject(error)
          );
        });

        // Continue with the model processing...
        return await processLoadedModel(entity, gltf, log, onProgress);
      } catch (error) {
        console.error("Failed to load local model:", error);
        onProgress?.({ message: `Failed to load local model: ${(error as Error).message}` });
        return false;
      }
    } else {
      // Standard URL loading
      // Create a promise wrapper for the async load
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        loader.load(
          modelUrl,
          (gltf) => resolve(gltf),
          (xhr) => {
            if (xhr.lengthComputable) {
              const progress = Math.round((xhr.loaded / xhr.total) * 100);
              onProgress?.({ message: `Downloading: ${progress}%` });
            }
          },
          (error) => reject(error)
        );
      });

      // Process the loaded model
      return await processLoadedModel(entity, gltf, log, onProgress);
    }
  } catch (error) {
    console.error("Failed to load model:", error);
    onProgress?.({ message: `Failed to load model: ${(error as Error).message}` });
    return false;
  }
}

/**
 * Process a loaded GLTF model
 * Helper function to share code between local and remote loading paths
 */
async function processLoadedModel(
  entity: GenerativeEntity,
  gltf: GLTF,
  log: IGenerationLog,
  onProgress?: ProgressCallback
): Promise<boolean> {
  try {
    onProgress?.({ message: 'Processing model...' });

    // If there's an existing model mesh, dispose it
    // TODO: move to other place
    if (entity.gltfModel) {
      // Remove from parent
      entity.remove(entity.gltfModel);

      // Dispose of resources
      entity.gltfModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    }

    // Extract the scene from the GLTF
    const newModel = gltf.scene;
    entity.add(newModel);

    // Set model mesh in entity
    entity.gltfModel = newModel;


    // If we haven't set the child position before, set it to the center of the model
    if (!log.childPosition) {
      // Calculate the bounding box to center the model
      const boundingBox = new THREE.Box3().setFromObject(newModel);
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);
      const size = new THREE.Vector3();
      boundingBox.getSize(size);

      // Calculate the y offset to put the bottom center at the pivot point
      const yOffset = entity.position.y - boundingBox.min.y;

      // Adjust the position to put the bottom center at the pivot point
      newModel.position.set(
        newModel.position.x,          // Center horizontally
        yOffset,           // Bottom at the pivot point
        newModel.position.z           // Center depth-wise
      );

      // Set child position
      log.childPosition = {
        x: newModel.position.x,
        y: newModel.position.y,
        z: newModel.position.z
      };
    } else {
      // If we have set the child position before (Load from project file), set the model to the position
      newModel.position.set(
        log.childPosition.x,
        log.childPosition.y,
        log.childPosition.z
      );
    }

    // Setup shadows and material
    entity.gltfModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        setupMeshShadows(child);

        // Set emissive 
        if (child.material instanceof THREE.MeshStandardMaterial) {
          child.material.emissiveMap = child.material.map;
          child.material.emissive.set(1, 1, 1);
          child.material.emissiveIntensity = 0.5;
        }
      }
    });

    // Switch to 3D display mode
    entity.setDisplayMode('3d');

    onProgress?.({ message: '3D model loaded successfully!' });
    return true;
  } catch (error) {
    console.error("Failed to process model:", error);
    onProgress?.({ message: `Failed to process model: ${(error as Error).message}` });
    return false;
  }
}

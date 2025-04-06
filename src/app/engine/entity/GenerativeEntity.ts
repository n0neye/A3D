import * as THREE from 'three';
import { EntityBase, SerializedEntityData, fromThreeVector3, toThreeVector3, toThreeEuler } from './EntityBase';
import { ImageRatio, ProgressCallback } from '@/app/util/generation/generation-util';
import { v4 as uuidv4 } from 'uuid';
import { defaultPBRMaterial, placeholderMaterial } from '@/app/util/editor/material-util';
import { setupMeshShadows } from '@/app/util/editor/light-util';
import { createShapeMesh } from '@/app/util/editor/shape-util';
import { generate3DModel_Runpod, generate3DModel_Trellis, ModelApiProvider } from '@/app/util/generation/3d-generation-util';
import { doGenerateRealtimeImage, GenerationResult } from '@/app/util/generation/realtime-generation-util';
import { EditorEngine } from '../EditorEngine';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Entity that represents AI-generated content
 */

export interface GenerativeEntityProps {
  generationLogs: GenerationLog[];
  currentGenerationId?: string;
  currentGenerationIdx?: number;
}
// Asset types
export type AssetType = 'image' | 'model';

// Processing states
export type GenerationStatus = 'idle' | 'generating2D' | 'generating3D' | 'error';

export interface SerializedGenerativeEntityData extends SerializedEntityData {
  props: GenerativeEntityProps;
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
  }
}

export class GenerativeEntity extends EntityBase {

  // EntityBase properties
  props: GenerativeEntityProps;

  modelMesh?: THREE.Mesh;
  placeholderMesh: THREE.Mesh;

  status: GenerationStatus;
  statusMessage: string;

  temp_prompt: string;
  temp_ratio?: ImageRatio;
  temp_displayMode?: "3d" | "2d";

  public readonly onProgress = new EventHandler<{ entity: GenerativeEntity, state: GenerationStatus, message: string }>();
  public readonly onGenerationChanged = new EventHandler<{ entity: GenerativeEntity }>();

  constructor(
    name: string,
    scene: THREE.Scene,
    options: {
      uuid?: string;
      position?: THREE.Vector3;
      rotation?: THREE.Euler;
      scaling?: THREE.Vector3;
      props?: GenerativeEntityProps;
      onLoaded?: (entity: GenerativeEntity) => void;
    }
  ) {
    super(name, scene, 'generative', {
      entityId: options.uuid,
      position: options.position,
      rotation: options.rotation,
      scaling: options.scaling
    });

    // Create initial placeholder mesh
    const ratio = '3:4';
    const { width, height } = getPlaneSize(ratio);
    this.placeholderMesh = createShapeMesh(scene, "plane");
    this.placeholderMesh.material = placeholderMaterial;
    this.placeholderMesh.scale.set(width, height, 1);

    // Add the mesh to the entity instead of setting parent
    this.add(this.placeholderMesh);
    this.placeholderMesh.userData = { rootEntity: this };

    this.props = options.props || {
      generationLogs: []
    };

    this.status = 'idle';
    this.statusMessage = '';
    this.temp_prompt = '';
    this.temp_ratio = '1:1';
    this.temp_displayMode = '2d';

    // Apply generation log if available
    const currentLog = this.getCurrentGenerationLog();
    if (currentLog) {
      console.log("Constructor: applyGenerationLog", currentLog);
      this.applyGenerationLog(currentLog, (entity) => {
        // Temp solution: update the mesh scaling
        if (entity.modelMesh && options.scaling) {
          console.log("Constructor: applyGenerationLog: onFinish. Apply scaling", options.scaling);
          entity.modelMesh.scale.copy(options.scaling);
        }
      });
    }

    options.onLoaded?.(this);
  }

  setDisplayMode(mode: "3d" | "2d"): void {
    if (this.modelMesh) {
      this.modelMesh.visible = mode === '3d';
    }
    this.placeholderMesh.visible = mode === '2d';
    this.temp_displayMode = mode;
  }

  getPrimaryMesh(): THREE.Mesh | undefined {
    return this.temp_displayMode === '3d' ? this.modelMesh : this.placeholderMesh;
  }

  getScene(): THREE.Scene {
    return this.parent as THREE.Scene;
  }

  onNewGeneration(assetType: AssetType, fileUrl: string, prompt: string, derivedFromId?: string): GenerationLog {
    const log: GenerationLog = {
      id: uuidv4(),
      timestamp: Date.now(),
      prompt: prompt,
      assetType: assetType,
      fileUrl: fileUrl,
      derivedFromId: derivedFromId,
      imageParams: {
        ratio: this.temp_ratio || '1:1'
      }
    };

    // Add to props
    this.props.generationLogs.push(log);
    this.props.currentGenerationId = log.id;
    this.props.currentGenerationIdx = this.props.generationLogs.length - 1;

    // Update prompt
    this.temp_prompt = prompt;

    return log;
  }

  async applyGenerationLog(log: GenerationLog, onFinish?: (entity: GenerativeEntity) => void): Promise<boolean> {
    try {
      console.log('applyGenerationLog', log);
      if (log.assetType === 'image' && log.fileUrl) {
        // For image assets, apply the image to the entity
        this.applyGeneratedImage(log.fileUrl, this.getScene(), log.imageParams?.ratio);
        this.setDisplayMode('2d');
      } else if (log.assetType === 'model' && log.fileUrl) {
        // For model assets, we need to set 3D display mode
        // (Assuming the model is already loaded and attached to this entity)
        await loadModel(this, log.fileUrl, this.getScene(), (progress) => {
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

  getCurrentGenerationLog(): GenerationLog | undefined {
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

  applyGeneratedImage(imageUrl: string, scene: THREE.Scene, ratio?: ImageRatio): void {
    // Create a texture loader
    const textureLoader = new THREE.TextureLoader();

    // Load the texture
    textureLoader.load(
      imageUrl,
      (texture) => {
        // Update the material
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide
        });

        // Apply to the placeholder mesh
        this.placeholderMesh.material = material;

        // Update the mesh size based on the ratio
        if (ratio) {
          const { width, height } = getPlaneSize(ratio);
          this.placeholderMesh.scale.set(width, height, 1);
        }

        // Set to 2D mode
        this.setDisplayMode('2d');
      },
      undefined,
      (error) => {
        console.error('Error loading image texture:', error);
      }
    );
  }

  async generateRealtimeImage(
    prompt: string,
    options: {
      negativePrompt?: string;
      ratio?: ImageRatio;
    } = { ratio: '1:1' }
  ): Promise<GenerationResult> {
    const scene = this.getScene();
    return doGenerateRealtimeImage(prompt, this, scene, { ratio: options.ratio });
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

  /**
   * Deserialize a generative entity from serialized data
   */
  static async deserialize(scene: THREE.Scene, data: SerializedGenerativeEntityData): Promise<GenerativeEntity> {
    const position = data.position ? toThreeVector3(data.position) : undefined;
    const rotation = data.rotation ? toThreeEuler(data.rotation) : undefined;
    const scaling = data.scaling ? toThreeVector3(data.scaling) : undefined;

    return new GenerativeEntity(data.name, scene, {
      uuid: data.entityId,
      position,
      rotation,
      scaling,
      props: data.props
    });
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
    if (this.placeholderMesh) {
      if (this.placeholderMesh.material) {
        if (Array.isArray(this.placeholderMesh.material)) {
          this.placeholderMesh.material.forEach(mat => mat.dispose());
        } else {
          this.placeholderMesh.material.dispose();
        }
      }
      if (this.placeholderMesh.geometry) {
        this.placeholderMesh.geometry.dispose();
      }
    }

    if (this.modelMesh) {
      if (this.modelMesh.material) {
        if (Array.isArray(this.modelMesh.material)) {
          this.modelMesh.material.forEach(mat => mat.dispose());
        } else {
          this.modelMesh.material.dispose();
        }
      }
      if (this.modelMesh.geometry) {
        this.modelMesh.geometry.dispose();
      }
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
  scene: THREE.Scene,
  onProgress?: ProgressCallback
): Promise<boolean> {
  try {
    onProgress?.({ message: 'Downloading 3D model...' });
    console.log("loadModel", modelUrl);

    // Load the model using GLTFLoader
    const loader = new GLTFLoader();

    // Create a promise wrapper for the async load
    const gltf = await new Promise<any>((resolve, reject) => {
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

    // If there's an existing model mesh, dispose it
    if (entity.modelMesh) {
      // Remove from parent
      entity.remove(entity.modelMesh);

      // Dispose of resources
      if (entity.modelMesh.geometry) {
        entity.modelMesh.geometry.dispose();
      }
      if (entity.modelMesh.material) {
        if (Array.isArray(entity.modelMesh.material)) {
          entity.modelMesh.material.forEach(mat => mat.dispose());
        } else {
          entity.modelMesh.material.dispose();
        }
      }
    }

    onProgress?.({ message: 'Processing model...' });

    // Extract the scene from the GLTF
    const model = gltf.scene;

    // Create a container mesh if needed
    let rootModelMesh: THREE.Mesh;

    if (model.children.length === 1 && model.children[0] instanceof THREE.Mesh) {
      rootModelMesh = model.children[0];
      entity.add(rootModelMesh);
    } else {
      // Use the entire gltf.scene as the root
      entity.add(model);

      // Find the first mesh to use as reference
      let firstMesh: THREE.Mesh | null = null;
      model.traverse((obj: any) => {
        if (!firstMesh && obj instanceof THREE.Mesh) {
          firstMesh = obj;
        }
      });

      rootModelMesh = firstMesh || new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0xcccccc })
      );
    }

    // Set model mesh in entity
    entity.modelMesh = rootModelMesh;

    // Set userData on all meshes
    model.traverse((obj: any) => {
      obj.userData = { ...obj.userData, rootEntity: entity };

      // Apply default material to all meshes
      if (obj instanceof THREE.Mesh) {
        // Apply material (note: you might want to keep original materials)
        obj.material = defaultPBRMaterial;

        // Setup shadows
        setupMeshShadows(obj);
      }
    });

    // Switch to 3D display mode
    entity.setDisplayMode('3d');

    onProgress?.({ message: '3D model loaded successfully!' });
    return true;
  } catch (error) {
    console.error("Failed to load model:", error);
    onProgress?.({ message: `Failed to load model: ${(error as Error).message}` });
    return false;
  }
}

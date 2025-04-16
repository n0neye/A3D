/**
 * EditorEngine.ts
 * 
 * The central coordination point for the entire 3D editor system.
 * This singleton class:
 * - Initializes and manages all subsystem managers
 * - Provides a clean public API for React components
 * - Handles communication between subsystems
 * - Emits events for UI components to react to
 * 
 * It acts as a facade over the complex Three.js functionality,
 * abstracting the details behind a simpler interface designed
 * specifically for this editor application.
 * 
 * React components should interact ONLY with this EditorEngine,
 * never directly with Three.js or individual managers.
 */
import * as THREE from 'three';
import { ThreeCore } from './ThreeCore';
import { CameraManager } from '../managers/CameraManager';
import { SelectionManager } from '../managers/SelectionManager';
import { EntityBase, EntityType } from '@/app/engine/entity/base/EntityBase';
import { EntityFactory, CreateEntityOptions } from '../entity/EntityFactory';
import { Command, HistoryManager } from '../managers/HistoryManager';
import { loadShapeMeshes } from '../utils/shapeUtil';
import { InputManager } from '../managers/InputManager';
import { createDefaultMaterials } from '../utils/materialUtil';
import { RenderService } from '../services/RenderService';
import { TransformMode, TransformControlManager } from '../managers/TransformControlManager';
import { ProjectManager } from '../managers/ProjectManager';
import { EnvironmentManager } from '../managers/environmentManager';
import { Observer } from '../utils/Observer';
import { TimelineManager } from '../managers/timeline/TimelineManager';
import { CreateEntityCommand } from '../../lib/commands';
import { ObjectManager } from '../managers/ObjectManager';
import { RenderVideoService } from '../services/RenderVideoService';
import { FileService } from '../services/FileService/FileService';


/**
 * Main editor engine that coordinates all Three.js subsystems
 * and provides a clean API for React components
 */
export class EditorEngine {
  private static instance: EditorEngine;
  private core: ThreeCore;

  private cameraManager: CameraManager;
  private selectionManager: SelectionManager;
  private transformControlManager: TransformControlManager;
  private historyManager: HistoryManager;
  private inputManager: InputManager;
  private renderService: RenderService;
  private projectManager: ProjectManager;
  private environmentManager: EnvironmentManager;
  private timelineManager: TimelineManager;
  private objectManager: ObjectManager;
  private renderVideoService: RenderVideoService;
  private fileService: FileService;

  public observer = new Observer<{
  }>();

  private constructor(canvas: HTMLCanvasElement) {
    console.log("EditorEngine constructor");
    this.core = new ThreeCore(canvas);

    const scene = this.core.getScene();
    const threeRenderer = this.core.getRenderer();
    this.cameraManager = new CameraManager(scene, canvas);
    this.transformControlManager = new TransformControlManager(scene, this.cameraManager.getCamera(), threeRenderer);
    this.selectionManager = new SelectionManager(this.transformControlManager);
    this.historyManager = new HistoryManager();
    this.projectManager = new ProjectManager(this);
    this.environmentManager = new EnvironmentManager(this);
    this.timelineManager = new TimelineManager(this);
    this.objectManager = new ObjectManager(this);
    this.fileService = new FileService();

    // Create the input manager and pass references to other managers
    this.inputManager = new InputManager(
      this,
      scene,
      this.cameraManager.getCamera(),
      threeRenderer,
      this.selectionManager,
      this.historyManager
    );

    // Create the render service
    this.renderService = new RenderService(scene, this, threeRenderer);

    // Create the render video service
    this.renderVideoService = new RenderVideoService(this, this.renderService, threeRenderer);

    // Register the update method to be called by the core
    this.core.setEngineUpdate(this.update);
  }

  public static async initEngine(canvas: HTMLCanvasElement): Promise<EditorEngine> {
    if (EditorEngine.instance) { return EditorEngine.instance; }

    console.log("EditorEngine initEngine");
    EditorEngine.instance = new EditorEngine(canvas);

    // Init other utils
    const scene = EditorEngine.instance.core.getScene();
    await loadShapeMeshes(scene);
    await createDefaultMaterials(scene);

    await EditorEngine.instance.projectManager.loadProjectFromUrl('/demoAssets/demo_xbot.json');

    return EditorEngine.instance;
  }


  // Getters
  public static getInstance(): EditorEngine {
    return EditorEngine.instance;
  }

  public getScene(): THREE.Scene {
    return this.core.getScene();
  }

  public getSelectionManager(): SelectionManager {
    return this.selectionManager;
  }

  public getInputManager(): InputManager {
    return this.inputManager;
  }

  public getRenderService(): RenderService {
    return this.renderService;
  }

  public getCameraManager(): CameraManager {
    return this.cameraManager;
  }

  public getProjectManager(): ProjectManager {
    return this.projectManager;
  }

  public getHistoryManager(): HistoryManager {
    return this.historyManager;
  }

  public getTransformControlManager(): TransformControlManager {
    return this.transformControlManager;
  }

  public getEnvironmentManager(): EnvironmentManager {
    return this.environmentManager;
  }

  public getTimelineManager(): TimelineManager {
    return this.timelineManager;
  }

  public getObjectManager(): ObjectManager {
    return this.objectManager;
  }

  public getRenderVideoService(): RenderVideoService {
    return this.renderVideoService;
  }


  // Public API methods for React components
  // Entity Management
  public selectEntity(entity: EntityBase | null): void {
    // console.log(`EditorEngine: selectEntity`, entity !== null, entity !== undefined, this.selectionManager);
    // TODO: We've to get the instance again, as the UI may not have the lastest manager instance
    if (entity) {
      EditorEngine.getInstance().getSelectionManager().select(entity);
    } else {
      EditorEngine.getInstance().getSelectionManager().deselectAll();
    }
  }
  public createEntityCommand(options: CreateEntityOptions): void {
    const createCommand = new CreateEntityCommand(
      () => EntityFactory.createEntity({
        ...options,
        onLoaded: (entity) => {
          console.log(`handleCreateCharacter onLoaded: ${entity.name}`);
          EditorEngine.getInstance().selectEntity(entity);
        }
      }),
    );
    // Execute the command through history manager
    this.executeCommand(createCommand);
  }
  public createEntityDefaultCommand(type: EntityType): void {
    const createCommand = new CreateEntityCommand(
      () => EntityFactory.createEntityDefault(type, (entity) => {
        console.log(`handleCreateCharacter onLoaded: ${entity.name}`);
        EditorEngine.getInstance().selectEntity(entity);
      }),
    );
    this.executeCommand(createCommand);
  }
  public deleteEntity(entity: EntityBase): void {
    EntityFactory.deleteEntity(entity, this);
  }
  public duplicateEntity(entity: EntityBase): void {
    EntityFactory.duplicateEntity(entity, this);
  }

  // History Management
  public executeCommand(command: Command): void {
    this.historyManager.executeCommand(command);
  }

  // Gizmo Mode Management
  public setTransformControlMode(mode: TransformMode): void {
    this.transformControlManager.setTransformControlMode(mode);
  }


  // TODO: Temp animation mixer
  private mixers: Map<string, THREE.AnimationMixer> = new Map();
  private clock = new THREE.Clock();

  public addMixer(uuid: string, mixer: THREE.AnimationMixer): void {
    this.mixers.set(uuid, mixer);
  }

  public removeMixer(uuid: string): void {
    this.mixers.delete(uuid);
  }

  // Define update as an arrow function to correctly bind `this`
  public update = (): void => {
    var delta = this.clock.getDelta();
    // Update all managers that have update methods
    // Use `this` directly now that it's correctly bound
    this.cameraManager.update();

    // Update all mixers
    if (this.mixers?.size > 0) {
      this.mixers.forEach((mixer) => {
        mixer.update(delta);
      });
    }

    // Add other managers as needed
  }
} 
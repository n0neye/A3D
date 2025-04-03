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
 * It acts as a facade over the complex Babylon.js functionality,
 * abstracting the details behind a simpler interface designed
 * specifically for this editor application.
 * 
 * React components should interact ONLY with this EditorEngine,
 * never directly with Babylon.js or individual managers.
 */
import * as BABYLON from '@babylonjs/core';
import { BabylonCore } from './core/BabylonCore';
import { CameraManager } from './managers/CameraManager';
import { SelectionManager } from './managers/SelectionManager';
import { EventEmitter } from './utils/EventEmitter';
import { EntityBase, EntityType } from '../util/entity/EntityBase';
import { EntityFactory, CreateEntityOptions } from './utils/EntityFactory';
import { Command, HistoryManager } from './managers/HistoryManager';
import { loadShapeMeshes } from '../util/editor/shape-util';
import { InputManager } from './managers/InputManager';
import { createDefaultMaterials } from '../util/editor/material-util';
import { RenderService } from './services/RenderService';
import { createSkybox, createWorldGrid } from '../util/editor/editor-util';
import { GizmoMode, GizmoModeManager } from './managers/GizmoModeManager';
import { ProjectManager } from './managers/ProjectManager';
import { DeleteMeshCommand } from '../lib/commands';


/**
 * Main editor engine that coordinates all Babylon.js subsystems
 * and provides a clean API for React components
 */
export class EditorEngine {
  private static instance: EditorEngine;
  private core: BabylonCore;

  private cameraManager: CameraManager;
  private selectionManager: SelectionManager;
  private gizmoModeManager: GizmoModeManager;
  private historyManager: HistoryManager;
  private inputManager: InputManager;
  private renderService: RenderService;
  private projectManager: ProjectManager;

  public events: EventEmitter = new EventEmitter();

  private constructor(canvas: HTMLCanvasElement) {
    this.core = new BabylonCore(canvas);

    const scene = this.core.getScene();
    const babylonEngine = this.core.getEngine();
    this.cameraManager = new CameraManager(scene, canvas);
    this.gizmoModeManager = new GizmoModeManager(scene);
    this.selectionManager = new SelectionManager(scene, this.gizmoModeManager.getGizmoManager());
    this.historyManager = new HistoryManager();
    this.projectManager = new ProjectManager(this);

    // Create the input manager and pass references to other managers
    this.inputManager = new InputManager(this, scene, this.selectionManager, this.historyManager);

    // Create the render service
    this.renderService = new RenderService(scene, this, babylonEngine);

    // Listen for events from the input manager
    this.inputManager.events.on('entityCreated', (entity) => {
      this.events.emit('entityCreated', entity);
    });
  }

  public static initEngine(canvas: HTMLCanvasElement): EditorEngine {
    if (!EditorEngine.instance) {
      EditorEngine.instance = new EditorEngine(canvas);
    }

    // Init other utils
    const engine = EditorEngine.instance;
    const scene = engine.core.getScene();
    loadShapeMeshes(scene);
    createDefaultMaterials(scene);
    createSkybox(scene);
    createWorldGrid(scene, 20, 10);

    return EditorEngine.instance;
  }


  // Getters
  public static getInstance(): EditorEngine {
    return EditorEngine.instance;
  }

  public getScene(): BABYLON.Scene {
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

  public getGizmoModeManager(): GizmoModeManager {
    return this.gizmoModeManager;
  }

  public getProjectManager(): ProjectManager {
    return this.projectManager;
  }



  // Public API methods for React components
  public selectEntity(entity: EntityBase | null): void {
    this.selectionManager.select(entity);
  }

  public createEntity(options: CreateEntityOptions): EntityBase {
    const entity = EntityFactory.createEntity(this.core.getScene(), options);
    return entity;
  }

  public createEntityDefault(type: EntityType): EntityBase {
    const entity = EntityFactory.createEntityDefault(this.core.getScene(), type);
    return entity;
  }

  // Delete entity
  public deleteEntity(entity: EntityBase): void {
    const deleteCommand = new DeleteMeshCommand(entity, this.gizmoModeManager.getGizmoManager());
    this.historyManager.executeCommand(deleteCommand);
  }

  public executeCommand(command: Command): void {
    this.historyManager.executeCommand(command);
  }

  public setGizmoMode(mode: GizmoMode): void {
    this.gizmoModeManager.setGizmoMode(mode);
  }

  public getGizmoMode(): GizmoMode {
    return this.gizmoModeManager.getGizmoMode();
  }

} 
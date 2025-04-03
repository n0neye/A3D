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
import { GizmoManager } from '@babylonjs/core';
import { EntityFactory, CreateEntityOptions } from './utils/EntityFactory';
import { Command, HistoryManager } from './managers/HistoryManager';
// import { GizmoManager } from './managers/GizmoManager';
// import { EntityManager } from './managers/EntityManager';
// import { EnvironmentManager } from './managers/EnvironmentManager';
// import { InputManager } from './managers/InputManager';

/**
 * Main editor engine that coordinates all Babylon.js subsystems
 * and provides a clean API for React components
 */
export class EditorEngine {
  private static instance: EditorEngine;
  private core: BabylonCore;

  private cameraManager: CameraManager;
  private selectionManager: SelectionManager;
  private gizmoManager: GizmoManager;
  private historyManager: HistoryManager;

  public events: EventEmitter = new EventEmitter();

  private constructor(canvas: HTMLCanvasElement) {
    this.core = new BabylonCore(canvas);

    // Forward core events
    const scene = this.core.getScene();
    const engine = this.core.getEngine();
    this.cameraManager = new CameraManager(scene, canvas);
    this.selectionManager = new SelectionManager(scene);
    this.gizmoManager = new GizmoManager(scene);
    this.historyManager = new HistoryManager();
  }

  public static initEngine(canvas: HTMLCanvasElement): EditorEngine {
    if (!EditorEngine.instance) {
      EditorEngine.instance = new EditorEngine(canvas);
    }
    return EditorEngine.instance;
  }

  public static getInstance(): EditorEngine {
    return EditorEngine.instance;
  }

  // Public API methods for React components
  public selectEntity(entity: EntityBase | null): void {
    this.selectionManager.select(entity);
    this.events.emit('entitySelected', entity);
  }

  public createEntity(options: CreateEntityOptions): EntityBase {
    const entity = EntityFactory.createEntity(this.core.getScene(), options);
    this.events.emit('entityCreated', entity);
    return entity;
  }

  public createEntityDefault(type: EntityType): EntityBase {
    const entity = EntityFactory.createEntityDefault(this.core.getScene(), type);
    this.events.emit('entityCreated', entity);
    return entity;
  }

  public executeCommand(command: Command): void {
    this.historyManager.executeCommand(command);
  }


  // And so on...
} 
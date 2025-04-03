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
import { loadShapeMeshes } from '../util/editor/shape-util';
import { CreateEntityCommand, TransformCommand } from '../lib/commands';
import { GenerativeEntityProps } from '../util/entity/GenerativeEntity';
import { ISelectable } from '../interfaces/ISelectable';
import { BoneControl } from '../util/entity/BoneControl';
// import { GizmoManager } from './managers/GizmoManager';
// import { EntityManager } from './managers/EntityManager';
// import { EnvironmentManager } from './managers/EnvironmentManager';
// import { InputManager } from './managers/InputManager';


// Temp hack to handle e and r key presses
let isWKeyPressed = false;
let isEKeyPressed = false;
let isRKeyPressed = false;

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
    this.gizmoManager = new GizmoManager(scene);
    this.selectionManager = new SelectionManager(scene, this.gizmoManager);
    this.historyManager = new HistoryManager();
  }

  public static initEngine(canvas: HTMLCanvasElement): EditorEngine {
    if (!EditorEngine.instance) {
      EditorEngine.instance = new EditorEngine(canvas);
    }

    // Init other utils

    // Load shape meshes
    const engine = EditorEngine.instance;
    loadShapeMeshes(engine.core.getScene());

    // Handle pointer events
    const scene = engine.core.getScene();
    scene.onPointerObservable.add((pointerInfo) => engine.onPointerObservable(pointerInfo, scene));

    return EditorEngine.instance;
  }

  onPointerObservable = (pointerInfo: BABYLON.PointerInfo, scene: BABYLON.Scene) => {
    if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
      if (pointerInfo.event.button === 0) {  // Left click
        // Check if Ctrl key is pressed
        if (pointerInfo.event.ctrlKey || pointerInfo.event.metaKey) { // Ctrl+Left click (or Cmd+Left click on Mac)
          this.handleCtrlClick(pointerInfo, scene);
        } else {
          this.handleRegularClick(pointerInfo, scene);
        }
      }
    }
    // Handle mouse wheel events for scaling and rotation
    else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
      this.handleMouseWheel(pointerInfo, scene);
    }
  }

   handleMouseWheel = (pointerInfo: BABYLON.PointerInfo, scene: BABYLON.Scene) => {
    const currentSelection = this.selectionManager.getCurrentSelection();
    if (!currentSelection) return;

    const currentEntity = currentSelection instanceof EntityBase ? currentSelection : null;
    if (!currentEntity) return;

    // @ts-ignore
    const wheelDelta = pointerInfo.event.deltaY;
    const scaleFactor = 0.001; // Adjust this for sensitivity
    const rotationFactor = 0.0025; // Adjust this for sensitivity

    if (isEKeyPressed || isRKeyPressed || isWKeyPressed) {
      // Disable camera zoom
      const camera = scene.activeCamera as BABYLON.ArcRotateCamera;
      camera.inputs.remove(camera.inputs.attached.mousewheel);

      // W+Wheel: Move the selected entity up
      if (isWKeyPressed) {
        currentEntity.position.y += wheelDelta * -0.001;
      }

      // E+Wheel: Scale the selected entity
      if (isEKeyPressed) {
        // Create scale command - record the starting state
        const scaleCommand = new TransformCommand(currentEntity);

        // Calculate scale factor based on wheel direction
        const delta = -wheelDelta * scaleFactor;
        const newScale = currentEntity.scaling.clone();

        // Apply uniform scaling
        newScale.x += newScale.x * delta;
        newScale.y += newScale.y * delta;
        newScale.z += newScale.z * delta;

        // Apply the new scale
        currentEntity.scaling = newScale;

        // Update the final state and record the command
        scaleCommand.updateFinalState();
        this.historyManager.executeCommand(scaleCommand);

        // Prevent default browser zoom
        pointerInfo.event.preventDefault();
      }

      // R+Wheel: Rotate the selected entity around Y axis
      else if (isRKeyPressed) {
        // Create rotation command - record the starting state
        const rotationCommand = new TransformCommand(currentEntity);

        // Calculate rotation amount based on wheel direction
        const delta = wheelDelta * rotationFactor;

        // Apply rotation around y-axis
        currentEntity.rotate(BABYLON.Vector3.Up(), delta);

        // Update the final state and record the command
        rotationCommand.updateFinalState();
        this.historyManager.executeCommand(rotationCommand);

        // Prevent default browser behavior
        pointerInfo.event.preventDefault();
      }

      // Enable camera zoom
      setTimeout(() => {
        camera.inputs.add(new BABYLON.ArcRotateCameraMouseWheelInput);
        camera.wheelPrecision = 40;
      }, 50);
    }
  }

  handleRegularClick = (pointerInfo: BABYLON.PointerInfo, scene: BABYLON.Scene) => {
    console.log("handleRegularClick called");


    const bonePickInfo = scene.pick(
      scene.pointerX,
      scene.pointerY,
      (mesh) => {
        return mesh.name.startsWith('bone_'); // Only pick meshes that start with 'bone_'
      }
    );

    // If we picked a bone control, select the bone and return
    // TODO: this is hack to select bones behind the character mesh
    if (bonePickInfo.hit && bonePickInfo.pickedMesh && bonePickInfo.pickedMesh instanceof BoneControl) {
      console.log("Bone picked:", bonePickInfo.pickedMesh.name);
      const boneControl = bonePickInfo.pickedMesh as BoneControl;
      boneControl.character.selectBone(boneControl);
      this.selectionManager.select(boneControl);
      return;
    }

    const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
    const mesh = pickInfo.pickedMesh;
    console.log("Picked mesh:", mesh?.name, "metadata:", mesh?.metadata);

    // Clicked on empty space - deselect
    if (!mesh) {
      console.log("No mesh picked, deselecting");
      this.selectionManager.select(null);
      this.selectEntity(null);
      return;
    }

    // Find the selectable object
    let selectable: ISelectable | null = null;

    // TODO: It's so messy here
    // FIRST check if the mesh has a rootEntity that's selectable
    if (mesh.metadata?.rootEntity && (mesh.metadata.rootEntity as any).gizmoCapabilities) {
      console.log("Mesh has selectable rootEntity");
      selectable = mesh.metadata.rootEntity as ISelectable;
      this.selectionManager.select(selectable);

      // If it's an EntityBase, update the selected entity in state
      if (mesh.metadata.rootEntity instanceof EntityBase) {
        console.log("rootEntity is EntityBase, selecting in UI");
        this.selectEntity(mesh.metadata.rootEntity);
      } else {
        this.selectEntity(null);
      }
    }
    // THEN check if the mesh itself is directly selectable (for BoneControl etc.)
    else if ((mesh as any).gizmoCapabilities) {
      console.log("Mesh is directly selectable");
      selectable = mesh as unknown as ISelectable;
      this.selectionManager.select(selectable);
      
      // Check if we need to show a special UI for this selection
      // or if we should use the parent's UI
      const parentSelection = this.selectionManager.getParentSelection();
      if (parentSelection instanceof EntityBase) {
        this.selectEntity(parentSelection);
      } else {
        this.selectEntity(null);
      }
    }
    // Nothing selectable found
    else {
      console.log("Nothing selectable found, deselecting");
      this.selectionManager.select(null);
      this.selectEntity(null);
    }
  }

  // Handle Ctrl+Click to create a new generative entity
  handleCtrlClick(pointerInfo: BABYLON.PointerInfo, scene: BABYLON.Scene) {
    console.log("CtrlClick", pointerInfo, scene);
    // Cast a ray from the camera through the mouse position
    const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
    let position: BABYLON.Vector3;

    if (pickInfo.hit) {
      // If we hit something, use that point
      position = pickInfo.pickedPoint!.clone();
    } else {
      // Create at the position where the user clicked, but at a fixed distance from camera
      const camera = scene.activeCamera as BABYLON.ArcRotateCamera;
      if (!camera) return;

      // Camera center
      const cameraCenter = camera.getTarget();
      const cameraPosition = camera.position;
      const distance = cameraPosition.subtract(cameraCenter).length();

      // Create a ray from the camera through the clicked point on the screen
      const ray = scene.createPickingRay(
        scene.pointerX,
        scene.pointerY,
        BABYLON.Matrix.Identity(),
        camera
      );

      // Calculate position along the ray at the specified distance
      position = ray.origin.add(ray.direction.scale(distance));
    }

    // Create entity command using the new EntityFactory
    const createCommand = new CreateEntityCommand(
      () => EntityFactory.createEntity(scene, {
        type: 'generative',
        position,
        gnerativeProps: {
          generationLogs: [],
        } as GenerativeEntityProps
      })
    );

    // Execute command and select the new entity
    console.log("About to execute command", createCommand);
    this.historyManager.executeCommand(createCommand);
    console.log("Command executed");
    const newEntity = createCommand.getEntity();
    console.log("Got entity from command", newEntity);
    this.selectEntity(newEntity);
    if (newEntity) {
      newEntity.setEnabled(true);
    } else {
      console.error("No entity returned from createCommand");
    }
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
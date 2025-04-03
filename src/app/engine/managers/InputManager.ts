/**
 * InputManager.ts
 * 
 * Central manager for all input handling in the editor.
 * Responsible for:
 * - Processing pointer events (clicks, drags, wheel)
 * - Managing keyboard input state and shortcuts
 * - Translating raw input into editor actions
 * - Coordinating input-driven interactions between managers
 * 
 * This isolates all input logic in one place rather than spreading
 * it across multiple components or the EditorEngine itself.
 */
import * as BABYLON from '@babylonjs/core';
import { SelectionManager } from './SelectionManager';
import { HistoryManager } from './HistoryManager';
import { EntityBase } from '../../util/entity/EntityBase';
import { TransformCommand, CreateEntityCommand } from '../../lib/commands';
import { EntityFactory } from '../utils/EntityFactory';
import { ISelectable } from '../../interfaces/ISelectable';
import { BoneControl } from '../../util/entity/BoneControl';
import { GenerativeEntityProps } from '../../util/entity/GenerativeEntity';
import { EventEmitter } from '../utils/EventEmitter';

export class InputManager {
  private scene: BABYLON.Scene;
  private selectionManager: SelectionManager;
  private historyManager: HistoryManager;
  public events: EventEmitter = new EventEmitter();
  
  // Keyboard state tracking
  private keysPressed: Map<string, boolean> = new Map();
  
  constructor(scene: BABYLON.Scene, selectionManager: SelectionManager, historyManager: HistoryManager) {
    this.scene = scene;
    this.selectionManager = selectionManager;
    this.historyManager = historyManager;
    
    this.initialize();
  }
  
  private initialize(): void {
    // Set up pointer observables
    this.scene.onPointerObservable.add(this.handlePointerEvent);
    
    // Set up keyboard event listeners
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }
  
  private handlePointerEvent = (pointerInfo: BABYLON.PointerInfo): void => {
    switch (pointerInfo.type) {
      case BABYLON.PointerEventTypes.POINTERDOWN:
        this.handlePointerDown(pointerInfo);
        break;
      case BABYLON.PointerEventTypes.POINTERUP:
        this.handlePointerUp(pointerInfo);
        break;
      case BABYLON.PointerEventTypes.POINTERMOVE:
        this.handlePointerMove(pointerInfo);
        break;
      case BABYLON.PointerEventTypes.POINTERWHEEL:
        this.handlePointerWheel(pointerInfo);
        break;
    }
  }
  
  private handlePointerDown = (pointerInfo: BABYLON.PointerInfo): void => {
    if (pointerInfo.event.button === 0) { // Left click
      if (this.isKeyPressed('Control') || this.isKeyPressed('Meta')) {
        this.handleCtrlClick(pointerInfo);
      } else {
        this.handleRegularClick(pointerInfo);
      }
    }
  }
  
  private handlePointerUp = (pointerInfo: BABYLON.PointerInfo): void => {
    // Handle pointer up events
  }
  
  private handlePointerMove = (pointerInfo: BABYLON.PointerInfo): void => {
    // Handle pointer move events
  }
  
  private handlePointerWheel = (pointerInfo: BABYLON.PointerInfo): void => {
    const currentSelection = this.selectionManager.getCurrentSelection();
    if (!currentSelection) return;

    const currentEntity = currentSelection instanceof EntityBase ? currentSelection : null;
    if (!currentEntity) return;

    // @ts-ignore
    const wheelDelta = pointerInfo.event.deltaY;
    const scaleFactor = 0.001; // Adjust this for sensitivity
    const rotationFactor = 0.0025; // Adjust this for sensitivity

    // Check for modifier keys
    const isWKeyPressed = this.isKeyPressed('w') || this.isKeyPressed('W');
    const isEKeyPressed = this.isKeyPressed('e') || this.isKeyPressed('E');
    const isRKeyPressed = this.isKeyPressed('r') || this.isKeyPressed('R');

    if (isEKeyPressed || isRKeyPressed || isWKeyPressed) {
      // Disable camera zoom
      const camera = this.scene.activeCamera as BABYLON.ArcRotateCamera;
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
  
  private handleRegularClick = (pointerInfo: BABYLON.PointerInfo): void => {
    console.log("handleRegularClick called");

    // First, check for bone controls (they have special selection behavior)
    const bonePickInfo = this.scene.pick(
      this.scene.pointerX,
      this.scene.pointerY,
      (mesh) => mesh.name.startsWith('bone_') // Only pick meshes that start with 'bone_'
    );

    // If we picked a bone control, select the bone and return
    if (bonePickInfo.hit && bonePickInfo.pickedMesh && bonePickInfo.pickedMesh instanceof BoneControl) {
      console.log("Bone picked:", bonePickInfo.pickedMesh.name);
      const boneControl = bonePickInfo.pickedMesh as BoneControl;
      boneControl.character.selectBone(boneControl);
      this.selectionManager.select(boneControl);
      return;
    }

    // Regular picking for entities and other selectables
    const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
    const mesh = pickInfo.pickedMesh;
    console.log("Picked mesh:", mesh?.name, "metadata:", mesh?.metadata);

    // Clicked on empty space - deselect
    if (!mesh) {
      console.log("No mesh picked, deselecting");
      this.selectionManager.select(null);
      this.events.emit('entitySelected', null);
      return;
    }

    // Find the selectable object
    let selectable: ISelectable | null = null;

    // First check if the mesh has a rootEntity that's selectable
    if (mesh.metadata?.rootEntity && (mesh.metadata.rootEntity as any).gizmoCapabilities) {
      console.log("Mesh has selectable rootEntity");
      selectable = mesh.metadata.rootEntity as ISelectable;
      this.selectionManager.select(selectable);

      // If it's an EntityBase, emit selection event
      if (mesh.metadata.rootEntity instanceof EntityBase) {
        console.log("rootEntity is EntityBase, selecting in UI");
        this.events.emit('entitySelected', mesh.metadata.rootEntity);
      } else {
        this.events.emit('entitySelected', null);
      }
    }
    // Then check if the mesh itself is directly selectable (for BoneControl etc.)
    else if ((mesh as any).gizmoCapabilities) {
      console.log("Mesh is directly selectable");
      selectable = mesh as unknown as ISelectable;
      this.selectionManager.select(selectable);
      
      // Check if we need to show a special UI for this selection
      // or if we should use the parent's UI
      const parentSelection = this.selectionManager.getParentSelection();
      if (parentSelection instanceof EntityBase) {
        this.events.emit('entitySelected', parentSelection);
      } else {
        this.events.emit('entitySelected', null);
      }
    }
    // Nothing selectable found
    else {
      console.log("Nothing selectable found, deselecting");
      this.selectionManager.select(null);
      this.events.emit('entitySelected', null);
    }
  }
  
  private handleCtrlClick = (pointerInfo: BABYLON.PointerInfo): void => {
    console.log("CtrlClick", pointerInfo);
    
    // Cast a ray from the camera through the mouse position
    const pickInfo = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
    let position: BABYLON.Vector3;

    if (pickInfo.hit) {
      // If we hit something, use that point
      position = pickInfo.pickedPoint!.clone();
    } else {
      // Create at the position where the user clicked, but at a fixed distance from camera
      const camera = this.scene.activeCamera as BABYLON.ArcRotateCamera;
      if (!camera) return;

      // Camera center
      const cameraCenter = camera.getTarget();
      const cameraPosition = camera.position;
      const distance = cameraPosition.subtract(cameraCenter).length();

      // Create a ray from the camera through the clicked point on the screen
      const ray = this.scene.createPickingRay(
        this.scene.pointerX,
        this.scene.pointerY,
        BABYLON.Matrix.Identity(),
        camera
      );

      // Calculate position along the ray at the specified distance
      position = ray.origin.add(ray.direction.scale(distance));
    }

    // Create entity command using the EntityFactory
    const createCommand = new CreateEntityCommand(
      () => EntityFactory.createEntity(this.scene, {
        type: 'generative',
        position,
        gnerativeProps: {
          generationLogs: [],
        } as GenerativeEntityProps
      })
    );

    // Execute command
    console.log("About to execute command", createCommand);
    this.historyManager.executeCommand(createCommand);
    console.log("Command executed");
    
    // Get the newly created entity and emit event
    const newEntity = createCommand.getEntity();
    console.log("Got entity from command", newEntity);
    
    if (newEntity) {
      newEntity.setEnabled(true);
      // Emit both selection and creation events
      this.events.emit('entitySelected', newEntity);
      this.events.emit('entityCreated', newEntity);
    } else {
      console.error("No entity returned from createCommand");
    }
  }
  
  private handleKeyDown = (event: KeyboardEvent): void => {
    // Update key state
    this.keysPressed.set(event.key, true);
    
    // Handle keyboard shortcuts
    this.processKeyboardShortcuts(event);
  }
  
  private handleKeyUp = (event: KeyboardEvent): void => {
    // Update key state
    this.keysPressed.set(event.key, false);
  }
  
  private isKeyPressed(key: string): boolean {
    return this.keysPressed.get(key) === true;
  }
  
  private processKeyboardShortcuts(event: KeyboardEvent): void {
    // Don't process if a text input or textarea is focused
    if (document.activeElement instanceof HTMLInputElement || 
        document.activeElement instanceof HTMLTextAreaElement) {
      return;
    }

    // Duplicate selected entity (Ctrl+D)
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault(); // Prevent browser's bookmark dialog
      
      const currentEntity = this.selectionManager.getCurrentSelection();
      if (!currentEntity || !(currentEntity instanceof EntityBase)) return;

      // Emit event to duplicate entity (implementation will be in EditorEngine)
      this.events.emit('duplicateEntity', currentEntity);
    }

    // Delete selected entity
    if (event.key === 'Delete') {
      const currentEntity = this.selectionManager.getCurrentSelection();
      if (!currentEntity || !(currentEntity instanceof EntityBase)) return;

      // Emit event to delete entity (implementation will be in EditorEngine)
      this.events.emit('deleteEntity', currentEntity);
    }

    // Handle undo (Ctrl+Z or Command+Z)
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      console.log("Undo triggered");
      this.historyManager.undo();
      event.preventDefault(); // Prevent browser's default undo
    }

    // Handle redo (Ctrl+Shift+Z or Command+Shift+Z or Ctrl+Y)
    if (((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z') ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y')) {
      console.log("Redo triggered");
      this.historyManager.redo();
      event.preventDefault(); // Prevent browser's default redo
    }

    // Handle gizmo mode changes
    switch (event.key.toLowerCase()) {
      case 'w':
        this.events.emit('gizmoModeChanged', 'position');
        break;
      case 'e':
        this.events.emit('gizmoModeChanged', 'scale');
        break;
      case 'r':
        this.events.emit('gizmoModeChanged', 'rotation');
        break;
      case 't':
        this.events.emit('gizmoModeChanged', 'boundingBox');
        break;
    }
  }
  
  public dispose(): void {
    // Clean up event listeners
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    // Scene listeners will be cleaned up when scene is disposed
  }
} 
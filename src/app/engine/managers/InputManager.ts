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
import * as THREE from 'three';
import { SelectionManager } from './SelectionManager';
import { HistoryManager } from './HistoryManager';
import { EntityBase } from '@/app/engine/entity/EntityBase';
import { TransformCommand, CreateEntityCommand } from '../../lib/commands';
import { EntityFactory } from '../services/EntityFactory';
import { ISelectable } from '../../interfaces/ISelectable';
import { BoneControl } from '@/app/engine/entity/BoneControl';
import { GenerativeEntityProps } from '@/app/engine/entity/GenerativeEntity';
import { EditorEngine } from '../EditorEngine';
import { GizmoMode } from './TransformControlManager';

export class InputManager {
  private engine: EditorEngine;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  private selectionManager: SelectionManager;
  private historyManager: HistoryManager;
  private canvas: HTMLCanvasElement;
  
  // Raycaster for picking objects
  private raycaster: THREE.Raycaster;
  private pointer: THREE.Vector2;
  
  // Keyboard state tracking
  private keysPressed: Map<string, boolean> = new Map();
  
  constructor(
    engine: EditorEngine, 
    scene: THREE.Scene, 
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    selectionManager: SelectionManager, 
    historyManager: HistoryManager
  ) {
    this.engine = engine;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.selectionManager = selectionManager;
    this.historyManager = historyManager;
    this.canvas = this.renderer.domElement;
    
    // Initialize raycaster and pointer
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    
    this.initialize();
  }
  
  private initialize(): void {
    // Set up pointer event listeners
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('wheel', this.handlePointerWheel);
    
    // Set up keyboard event listeners
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }
  
  private updateRaycaster(event: MouseEvent): void {
    // Calculate pointer position in normalized device coordinates
    // (-1 to +1) for both components
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Update the raycaster
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }
  
  private handlePointerDown = (event: PointerEvent): void => {
    // Don't handle if right-click or middle-click (let OrbitControls handle these)
    if (event.button === 2 || event.button === 1) return;
    
    if (event.button === 0) { // Left click
      this.updateRaycaster(event);
      
      if (this.isKeyPressed('Control') || this.isKeyPressed('Meta')) {
        this.handleCtrlClick(event);
      } else {
        this.handleRegularClick(event);
      }
    }
  }
  
  private handlePointerUp = (event: PointerEvent): void => {
    // Handle pointer up events
  }
  
  private handlePointerMove = (event: PointerEvent): void => {
    // Handle pointer move events for hover effects
    this.updateRaycaster(event);
    
    // Perform raycasting to find intersected objects
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    // Update cursor based on what's being hovered
    if (intersects.length > 0) {
      const object = this.findSelectableFromIntersection(intersects[0].object);
      if (object) {
        this.canvas.style.cursor = object.cursorType;
      } else {
        this.canvas.style.cursor = 'default';
      }
    } else {
      this.canvas.style.cursor = 'default';
    }
  }
  
  private handlePointerWheel = (event: WheelEvent): void => {
    const currentSelection = this.selectionManager.getCurrentSelection();
    if (!currentSelection) return;

    const currentEntity = currentSelection instanceof EntityBase ? currentSelection : null;
    if (!currentEntity) return;

    const wheelDelta = event.deltaY;
    const scaleFactor = 0.001; // Adjust this for sensitivity
    const rotationFactor = 0.0025; // Adjust this for sensitivity

    // Check for modifier keys
    const isWKeyPressed = this.isKeyPressed('w') || this.isKeyPressed('W');
    const isEKeyPressed = this.isKeyPressed('e') || this.isKeyPressed('E');
    const isRKeyPressed = this.isKeyPressed('r') || this.isKeyPressed('R');

    if (isEKeyPressed || isRKeyPressed || isWKeyPressed) {
      // Prevent default scroll behavior
      event.preventDefault();

      // W+Wheel: Move the selected entity up/down
      if (isWKeyPressed) {
        currentEntity.position.y += wheelDelta * -0.001;
      }
      
      // E+Wheel: Scale the selected entity
      else if (isEKeyPressed) {
        const scaleDelta = 1 + (wheelDelta * scaleFactor);
        currentEntity.scale.multiplyScalar(scaleDelta);
      }
      
      // R+Wheel: Rotate the selected entity around Y axis
      else if (isRKeyPressed) {
        currentEntity.rotation.y += wheelDelta * rotationFactor;
      }
    }
  }
  
  private findSelectableFromIntersection(object: THREE.Object3D): ISelectable | null {
    // Check if the object itself is selectable
    if (this.isSelectable(object)) {
      return object as unknown as ISelectable;
    }
    
    // Check if it has a selectable in userData
    if (object.userData?.rootEntity && this.isSelectable(object.userData.rootEntity)) {
      return object.userData.rootEntity as ISelectable;
    }
    
    // Check parent hierarchy
    let parent = object.parent;
    while (parent) {
      if (this.isSelectable(parent)) {
        return parent as unknown as ISelectable;
      }
      parent = parent.parent;
    }
    
    return null;
  }
  
  private isSelectable(object: any): boolean {
    return object && object.gizmoCapabilities !== undefined;
  }
  
  private handleRegularClick = (event: PointerEvent): void => {
    console.log("handleRegularClick called");
    
    // Perform raycasting to find intersected objects
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    // First check for bone controls (they have special selection behavior)
    const boneControl = intersects.find(intersect => 
      intersect.object instanceof BoneControl || 
      intersect.object.userData?.isBoneControl
    )?.object;
    
    if (boneControl) {
      console.log("Bone picked:", boneControl.name);
      const control = boneControl instanceof BoneControl ? 
        boneControl : 
        boneControl.userData.boneControl;
        
      control.character.selectBone(control);
      this.selectionManager.select(control);
      return;
    }
    
    // If no intersections, deselect
    if (intersects.length === 0) {
      console.log("No object picked, deselecting");
      this.selectionManager.deselectAll();
      return;
    }
    
    // Find the first selectable object in the intersection list
    for (const intersect of intersects) {
      const selectable = this.findSelectableFromIntersection(intersect.object);
      if (selectable) {
        console.log("Selected:", selectable.getName());
        this.selectionManager.select(selectable);
        return;
      }
    }
    
    // If we got here, nothing selectable was found
    console.log("Nothing selectable found, deselecting");
    this.selectionManager.deselectAll();
  }
  
  private handleCtrlClick = (event: PointerEvent): void => {
    console.log("CtrlClick", event);
    
    // Perform raycasting to find intersected objects
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    let position: THREE.Vector3;

    if (intersects.length > 0) {
      // If we hit something, use that point
      position = intersects[0].point.clone();
    } else {
      // Create at a point in front of the camera
      position = new THREE.Vector3(0, 0, -5);
      position.applyMatrix4(this.camera.matrixWorld);
    }

    // Create entity command using the EntityFactory
    this.engine.createEntityCommand({
      type: 'generative',
      position,
      generativeProps: {
        generationLogs: [],
      } as GenerativeEntityProps
    });
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
      this.engine.duplicateEntity(currentEntity);
    }

    // Delete selected entity
    if (event.key === 'Delete') {
      const currentEntity = this.selectionManager.getCurrentSelection();
      if (!currentEntity || !(currentEntity instanceof EntityBase)) return;
      this.engine.deleteEntity(currentEntity);
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
        this.engine.setGizmoMode(GizmoMode.Position);
        break;
      case 'e':
        this.engine.setGizmoMode(GizmoMode.Scale);
        break;
      case 'r':
        this.engine.setGizmoMode(GizmoMode.Rotation);
        break;
      case 't':
        this.engine.setGizmoMode(GizmoMode.BoundingBox);
        break;
    }
  }
  
  public dispose(): void {
    // Clean up event listeners
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('wheel', this.handlePointerWheel);
    
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
} 
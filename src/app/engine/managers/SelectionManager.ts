import * as THREE from 'three';
import { ISelectable } from '@/app/interfaces/ISelectable';
import { CharacterEntity } from '@/app/engine/entity/CharacterEntity';
import { BoneControl } from '@/app/engine/entity/BoneControl';
import { EntityBase } from '@/app/engine/entity/EntityBase';
import { Observer } from "@/app/engine/utils/Observer";
import { TransformControlManager } from './TransformControlManager';
/**
 * Manages selection of objects in the scene
 */
export class SelectionManager {

  // Observer for selection events
  public selectionObserver = new Observer<{
    entitySelected: { entity: EntityBase | null };
    selectableSelected: { selectable: ISelectable | null };
  }>();

  private _currentSelection: ISelectable | null = null;
  private _currentEntity: EntityBase | null = null;
  private _scene: THREE.Scene;
  private _camera: THREE.Camera;
  private _raycaster: THREE.Raycaster;
  private _transformControlManager: TransformControlManager;
  private _hoveredObject: THREE.Object3D | null = null;

  constructor(scene: THREE.Scene, camera: THREE.Camera, transformControlManager: TransformControlManager) {
    this._scene = scene;
    this._camera = camera;
    this._transformControlManager = transformControlManager;
    this._raycaster = new THREE.Raycaster();
    
    // Set up hover detection
    this._setupHoverDetection();
  }

  /**
   * Select an object
   */
  select(newSelectable: ISelectable | null): void {
    console.log("SelectionManager.select called with:", newSelectable?.getName());

    // Determine if need to deselect the current Entity
    if (this._currentEntity && newSelectable) {
      // Check if the new selection belongs to the same character as the current selection
      const isChildOfCurrentEntity = this._isChildOfEntity(newSelectable, this._currentEntity);
      if (!isChildOfCurrentEntity) {
        // deselect the current selection properly
        console.log("Deselecting previous entity:", this._currentEntity.getName());
        this._currentEntity.onDeselect();
        this._currentEntity = null;
      } 
      // else keep the current entity
    } else if (this._currentEntity && !newSelectable) {
      // Deselect current entity if selecting nothing
      console.log("Deselecting previous entity:", this._currentEntity.getName());
      this._currentEntity.onDeselect();
      this._currentEntity = null;
    }

    // Determine if need to deselect the current Selection
    if (this._currentSelection && !(this._currentSelection instanceof EntityBase) && 
        (!newSelectable || newSelectable !== this._currentSelection)) {
      // deselect the current selection properly
      console.log("Deselecting previous selection:", this._currentSelection.getName());
      this._currentSelection.onDeselect();
      this._currentSelection = null;
    }

    // On select new entity
    if (newSelectable && newSelectable instanceof EntityBase) {
      this._currentEntity = newSelectable;
      this.selectionObserver.notify('entitySelected', { entity: newSelectable });
    }

    // Update current selection
    this._currentSelection = newSelectable;

    // Configure for new selection
    if (newSelectable) {
      console.log("Setting up transform controls for new selection:", newSelectable.getName());
      
      // Configure transform controls based on capabilities
      this._transformControlManager.attachToSelectable(newSelectable);
      
      // Notify the selectable object
      newSelectable.onSelect();
      
      // Notify observers
      this.selectionObserver.notify('selectableSelected', { selectable: newSelectable });
    } else {
      // Detach transform controls
      this._transformControlManager.attachToSelectable(null);
      
      // Notify observers of deselection
      this.selectionObserver.notify('selectableSelected', { selectable: null });
      this.selectionObserver.notify('entitySelected', { entity: null });
    }
  }

  /**
   * Deselect all objects
   */
  deselectAll(): void {
    console.log("SelectionManager.deselectAll called");
    if (this._currentSelection) {
      console.log("Deselecting current:", this._currentSelection.getName());
      this._currentSelection.onDeselect();
      this._currentSelection = null;
    }
    
    if (this._currentEntity) {
      console.log("Deselecting current entity:", this._currentEntity.getName());
      this._currentEntity.onDeselect();
      this._currentEntity = null;
    }

    this._transformControlManager.attachToSelectable(null);

    this.selectionObserver.notify('entitySelected', { entity: null });
    this.selectionObserver.notify('selectableSelected', { selectable: null });
  }

  /**
   * Pick a selectable object from the scene using raycasting
   */
  pickSelectableAt(x: number, y: number): ISelectable | null {
    // Convert screen coordinates to normalized device coordinates
    const rect = this._scene.userData.renderer?.domElement.getBoundingClientRect();
    if (!rect) return null;
    
    const normalizedX = ((x - rect.left) / rect.width) * 2 - 1;
    const normalizedY = -((y - rect.top) / rect.height) * 2 + 1;
    
    // Update raycaster
    this._raycaster.setFromCamera(new THREE.Vector2(normalizedX, normalizedY), this._camera);
    
    // Check for intersections
    const intersects = this._raycaster.intersectObjects(this._scene.children, true);
    
    // Look for a selectable object
    for (const intersect of intersects) {
      const obj = intersect.object;
      
      // Check if the object itself is a selectable
      if (this._isSelectable(obj)) {
        return obj as unknown as ISelectable;
      }
      
      // Check if the object has a parent that is selectable (traverse up)
      let parent: THREE.Object3D | null = obj.parent;
      while (parent) {
        if (this._isSelectable(parent)) {
          return parent as unknown as ISelectable;
        }
        parent = parent.parent;
      }
      
      // Check if object has userData with entity reference
      if (obj.userData && obj.userData.rootEntity && this._isSelectable(obj.userData.rootEntity)) {
        return obj.userData.rootEntity as ISelectable;
      }
    }
    
    return null;
  }

  /**
   * Check if an object is a selectable
   */
  private _isSelectable(obj: any): boolean {
    return obj && obj.gizmoCapabilities !== undefined && typeof obj.getGizmoTarget === 'function';
  }

  /**
   * Check if the new selection is a child of the current selection
   */
  private _isChildOfEntity(selectable: ISelectable, entity: EntityBase): boolean {
    // Check specifically for BoneControl being a child of CharacterEntity
    if (selectable instanceof BoneControl && entity instanceof CharacterEntity) {
      return selectable.character === entity;
    }

    // Add other parent-child relationships here as needed
    return false;
  }

  /**
   * Get the current selection
   */
  getCurrentSelection(): ISelectable | null {
    return this._currentSelection;
  }

  /**
   * Get the currently selected entity (if any)
   */
  getCurrentEntity(): EntityBase | null {
    return this._currentEntity;
  }

  /**
   * Set up hover detection for cursor changes
   */
  private _setupHoverDetection(): void {
    // This would be implemented by the InputManager in Three.js
    // The InputManager would call updateHoveredObject when the mouse moves
  }

  /**
   * Update the hovered object and cursor
   */
  updateHoveredObject(object: THREE.Object3D | null): void {
    if (object === this._hoveredObject) return;
    
    this._hoveredObject = object;
    
    // Find a selectable from the object
    let selectable: ISelectable | null = null;
    
    if (object) {
      if (this._isSelectable(object)) {
        selectable = object as unknown as ISelectable;
      } else if (object.userData && object.userData.rootEntity && 
                this._isSelectable(object.userData.rootEntity)) {
        selectable = object.userData.rootEntity as ISelectable;
      }
    }
    
    // Update cursor based on selectable
    this._updateCursor(selectable);
  }

  /**
   * Update cursor style based on hovered selectable
   */
  private _updateCursor(selectable: ISelectable | null): void {
    if (selectable) {
      document.body.style.cursor = selectable.cursorType;
    } else {
      document.body.style.cursor = 'default';
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Clean up any resources
    // No explicit pointer observer to remove in Three.js
  }
}

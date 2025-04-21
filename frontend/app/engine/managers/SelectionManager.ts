import * as THREE from 'three';
import { Selectable, isSelectable } from '@/engine/entity/base/Selectable';
import { CharacterEntity } from '@/engine/entity/types/CharacterEntity';
import { BoneControl } from '@/engine/entity/components/BoneControl';
import { EntityBase } from '@/engine/entity/base/EntityBase';
import { Observer } from "@/engine/utils/Observer";
import { TransformControlManager } from './TransformControlManager';
/**
 * Manages selection of objects in the scene
 */
export class SelectionManager {

  // Observer for selection events
  public selectionObserver = new Observer<{
    entitySelected: { entity: EntityBase | null };
    selectableSelected: { selectable: Selectable | null };
  }>();

  private _currentSelection: Selectable | null = null;
  private _currentEntity: EntityBase | null = null;
  private _transformControlManager: TransformControlManager;
  private _hoveredObject: THREE.Object3D | null = null;

  constructor(transformControlManager: TransformControlManager) {
    this._transformControlManager = transformControlManager;
    
    // Set up hover detection
    this._setupHoverDetection();
  }

  /**
   * Select an object
   */
  select(newSelectable: Selectable): void {
    console.log("SelectionManager.select called with:", newSelectable?.getName());

    // Determine if need to deselect the current Entity
    if (this._currentEntity && newSelectable) {
      // Check if the new selection belongs to the same character as the current selection
      const isChildOfCurrentEntity = this._isChildOfEntity(newSelectable, this._currentEntity);
      if (!isChildOfCurrentEntity) {
        // deselect the current selection properly
        console.log("SelectionManager: Deselecting previous entity:", this._currentEntity.getName());
        this._currentEntity.onDeselect();
        this._currentEntity = null;
      } 
      // else keep the current entity
    } else if (this._currentEntity && !newSelectable) {
      // Deselect current entity if selecting nothing
      console.log("SelectionManager: Deselecting previous entity:", this._currentEntity.getName());
      this._currentEntity.onDeselect();
      this._currentEntity = null;
    }

    // Determine if need to deselect the current Selection
    if (this._currentSelection && !(this._currentSelection instanceof EntityBase) && 
        (!newSelectable || newSelectable !== this._currentSelection)) {
      // deselect the current selection properly
      console.log("SelectionManager: Deselecting previous selection:", this._currentSelection.getName());
      this._currentSelection.onDeselect();
      this._currentSelection = null;
    }

    // On select new entity
    if (newSelectable && newSelectable instanceof EntityBase) {
      console.log("SelectionManager: Selecting new entity:", newSelectable.getName());
      this._currentEntity = newSelectable;
      this.selectionObserver.notify('entitySelected', { entity: newSelectable });
    }

    // Update current selection
    this._currentSelection = newSelectable;

    // Configure for new selection
    if (newSelectable) {
      console.log("SelectionManager: Setting up transform controls for new selection:", newSelectable.getName());
      
      // Configure transform controls based on capabilities
      this._transformControlManager.attachToSelectable(newSelectable);
      
      // Notify the selectable object
      newSelectable.onSelect();
      
      // Notify observers
      this.selectionObserver.notify('selectableSelected', { selectable: newSelectable });
    } else {
      console.log("SelectionManager: Detaching transform controls");
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
   * Check if the new selection is a child of the current selection
   */
  private _isChildOfEntity(selectable: Selectable, entity: EntityBase): boolean {
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
  getCurrentSelection(): Selectable | null {
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
    let selectable: Selectable | null = null;
    
    if (object) {
      if (isSelectable(object)) {
        selectable = object as unknown as Selectable;
      } else if (object.userData && object.userData.rootSelectable && 
                isSelectable(object.userData.rootSelectable)) {
        selectable = object.userData.rootSelectable as Selectable;
      }
    }
    
    // Update cursor based on selectable
    this._updateCursor(selectable);
  }

  /**
   * Update cursor style based on hovered selectable
   */
  private _updateCursor(selectable: Selectable | null): void {
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

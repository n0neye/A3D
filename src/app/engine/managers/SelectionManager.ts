import * as THREE from 'three';
import { ISelectable } from '../../interfaces/ISelectable';
import { CharacterEntity } from '../entity/CharacterEntity';
import { BoneControl } from '../entity/BoneControl';
import { Observer } from '../utils/Observer';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GizmoMode } from './TransformControlManager';

export interface SelectionObserverEvents {
  entitySelected: { entity: ISelectable | null };
  parentEntitySelected: { entity: ISelectable | null };
}

/**
 * Manages selection of objects in the scene
 */
export class SelectionManager {
  private _currentSelection: ISelectable | null = null;
  private _parentSelection: ISelectable | null = null; // Track parent selection separately
  private _scene: THREE.Scene;
  private _camera: THREE.Camera;
  private _transformControls: TransformControls;
  
  // Observer for selection events
  public selectionObserver = new Observer<SelectionObserverEvents>();
  
  constructor(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    this._scene = scene;
    this._camera = camera;
    
    // Create transform controls
    this._transformControls = new TransformControls(camera, renderer.domElement);
    this._transformControls.addEventListener('dragging-changed', (event) => {
      // Disable orbit controls when using transform controls
      // This would need to be implemented based on your orbit controls setup
    });
    
    // Add to scene
    scene.add(this._transformControls);
  }
  
  /**
   * Select an object
   */
  select(selectable: ISelectable | null): void {
    console.log("SelectionManager.select called with:", selectable?.getName());
    
    // Determine if we're selecting a child of the current selection
    const isChildOfCurrentSelection = this._isChildSelection(selectable, this._currentSelection);
    
    // Check if the new selection belongs to the same character as the current selection
    if (!isChildOfCurrentSelection) {
      // If we're selecting something not related to current selection, 
      // deselect the current selection properly
      if (this._currentSelection) {
        console.log("Deselecting previous:", this._currentSelection.getName());
        this._currentSelection.onDeselect();
      }
      
      // Also clear the parent selection
      this._parentSelection = null;
    } else {
      console.log("Selecting a child of current selection - keeping parent active");
      // Keep track of parent
      this._parentSelection = this._currentSelection;
    }
    
    // Detach transform controls
    this._transformControls.detach();
    
    // Update current selection
    this._currentSelection = selectable;
    
    // Configure for new selection
    if (selectable) {
      console.log("Setting up transform controls for new selection:", selectable.getName());
      
      // Get the target to attach transform controls to
      const target = selectable.getGizmoTarget();
      console.log("Attaching transform controls to:", target.name);
      
      // Set transform controls mode based on capabilities
      const capabilities = selectable.gizmoCapabilities;
      const defaultMode = capabilities.defaultGizmoMode || GizmoMode.Position;
      
      // Set the mode if it's allowed
      if (capabilities.allowedGizmoModes.includes(defaultMode)) {
        this.setTransformControlsMode(defaultMode);
      } else if (capabilities.allowedGizmoModes.length > 0) {
        // Fall back to first allowed mode
        this.setTransformControlsMode(capabilities.allowedGizmoModes[0]);
      }
      
      // Attach transform controls to target
      this._transformControls.attach(target);
      
      // Notify the selectable object
      selectable.onSelect();
    }
    
    // Notify observers
    this.selectionObserver.notify('entitySelected', { entity: selectable });
    if (this._parentSelection) {
      this.selectionObserver.notify('parentEntitySelected', { entity: this._parentSelection });
    }
  }
  
  /**
   * Set the transform controls mode
   */
  setTransformControlsMode(mode: GizmoMode): void {
    switch (mode) {
      case GizmoMode.Position:
        this._transformControls.setMode('translate');
        break;
      case GizmoMode.Rotation:
        this._transformControls.setMode('rotate');
        break;
      case GizmoMode.Scale:
        this._transformControls.setMode('scale');
        break;
      case GizmoMode.BoundingBox:
        // Three.js doesn't have a built-in bounding box mode
        // You would need to implement this separately
        this._transformControls.setMode('translate');
        break;
    }
  }
  
  /**
   * Check if the new selection is a child of the current selection
   */
  private _isChildSelection(newSelection: ISelectable | null, currentSelection: ISelectable | null): boolean {
    if (!newSelection || !currentSelection) return false;
    
    // Check specifically for BoneControl being a child of CharacterEntity
    if (newSelection instanceof BoneControl && currentSelection instanceof CharacterEntity) {
      return newSelection.character === currentSelection;
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
   * Get the parent selection (if any)
   */
  getParentSelection(): ISelectable | null {
    return this._parentSelection;
  }
  
  /**
   * Deselect all objects
   */
  deselectAll(): void {
    this.select(null);
  }
  
  /**
   * Get the transform controls
   */
  getTransformControls(): TransformControls {
    return this._transformControls;
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    this._transformControls.dispose();
    this._scene.remove(this._transformControls);
  }
}

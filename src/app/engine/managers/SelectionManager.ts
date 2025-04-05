import * as BABYLON from '@babylonjs/core';
import { ISelectable } from '../../interfaces/ISelectable';
import { getGizmoManager } from './SceneManagers';
import { CharacterEntity } from '@/app/engine/entity/CharacterEntity';
import { BoneControl } from '@/app/engine/entity/BoneControl';
import { EntityBase } from '@/app/engine/entity/EntityBase';
import { Observer } from "@/app/engine/utils/Observer";
/**
 * Manages selection of objects in the scene
 */
export class SelectionManager {
  
  // Observer for selection events
  public selectionObserver = new Observer<{
    entitySelected: { entity: EntityBase | null };
  }
  >(); 

  private _currentSelection: ISelectable | null = null;
  private _parentSelection: ISelectable | null = null; // Track parent selection separately
  private _scene: BABYLON.Scene;
  private _gizmoManager: BABYLON.GizmoManager;
  private _hoverObserver: BABYLON.Observer<BABYLON.PointerInfo> | null = null;
  private _hoveredMesh: BABYLON.AbstractMesh | null = null;

  constructor(scene: BABYLON.Scene, gizmoManager: BABYLON.GizmoManager) {
    this._scene = scene;
    this._gizmoManager = gizmoManager;
    this._setupHoverObserver();
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

    // Notify the engine context
    if (selectable && selectable instanceof EntityBase) {
      this.selectionObserver.notify('entitySelected', { entity: selectable });
    }else {
      this.selectionObserver.notify('entitySelected', { entity: null });
    }
    
    // Clear gizmo
    if (this._gizmoManager) {
      console.log("Detaching gizmo from previous selection");
      this._gizmoManager.attachToMesh(null);
    }
    
    // Update current selection
    this._currentSelection = selectable;
    
    // Configure for new selection
    if (selectable && this._gizmoManager) {
      console.log("Setting up gizmo for new selection:", 
        selectable.getName(),
        "pos:", selectable.gizmoCapabilities.allowPosition,
        "rot:", selectable.gizmoCapabilities.allowRotation,
        "scale:", selectable.gizmoCapabilities.allowScale);
      
      // Configure gizmos based on capabilities
      this._gizmoManager.positionGizmoEnabled = selectable.gizmoCapabilities.allowPosition;
      this._gizmoManager.rotationGizmoEnabled = selectable.gizmoCapabilities.allowRotation;
      this._gizmoManager.scaleGizmoEnabled = selectable.gizmoCapabilities.allowScale;
      
      // Get the target to attach gizmos to
      const target = selectable.getGizmoTarget();
      console.log("Attaching gizmo to:", target.name);
      
      // Attach gizmo to target
      if (target instanceof BABYLON.AbstractMesh) {
        this._gizmoManager.attachToMesh(target);
      } else {
        this._gizmoManager.attachToNode(target);
      }
      
      // Notify the selectable object
      selectable.onSelect();
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
   * Set up pointer hover observer for cursor changes
   */
  private _setupHoverObserver(): void {
    console.log("Setting up hover observer");
    // this._hoverObserver = this._scene.onPointerObservable.add((pointerInfo) => {
    //   // Only handle pointer move events
    //   if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERMOVE) {
    //     return;
    //   }
      
    //   // Pick the mesh under the pointer
    //   const pickInfo = this._scene.pick(
    //     this._scene.pointerX, 
    //     this._scene.pointerY
    //   );
      
    //   // Get the picked mesh
    //   const pickedMesh = pickInfo.pickedMesh;
      
    //   // If hovering over a new mesh
    //   if (pickedMesh !== this._hoveredMesh) {
    //     console.log("Hover changed to:", pickedMesh?.name);
    //     // Update hover state
    //     this._hoveredMesh = pickedMesh;
        
    //     // Find ISelectable from mesh
    //     let selectable: ISelectable | null = null;
        
    //     if (pickedMesh) {
    //       // Check if mesh itself is selectable
    //       if ((pickedMesh as any).gizmoCapabilities) {
    //         console.log("Mesh is directly selectable");
    //         selectable = pickedMesh as unknown as ISelectable;
    //       } 
    //       // Check if mesh has a selectable entity as metadata
    //       else if (pickedMesh.metadata?.rootEntity && 
    //               (pickedMesh.metadata.rootEntity as any).gizmoCapabilities) {
    //         console.log("Mesh has selectable rootEntity");
    //         selectable = pickedMesh.metadata.rootEntity as ISelectable;
    //       }
    //     }
        
    //     // Update cursor based on selectable
    //     this._updateCursor(selectable);
    //   }
    // });
  }
  
  /**
   * Update cursor style based on hovered selectable
   */
  private _updateCursor(selectable: ISelectable | null): void {
    if (selectable) {
      // Use Babylon's built-in cursor management
      this._scene.hoverCursor = selectable.cursorType;
    } else {
      // Reset to default
      this._scene.hoverCursor = "default";
    }
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    if (this._hoverObserver) {
      this._scene.onPointerObservable.remove(this._hoverObserver);
      this._hoverObserver = null;
    }
  }
}

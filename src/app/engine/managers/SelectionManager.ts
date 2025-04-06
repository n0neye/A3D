import * as BABYLON from '@babylonjs/core';
import { ISelectable } from '../../interfaces/ISelectable';
import { CharacterEntity } from '@/app/engine/entity/CharacterEntity';
import { BoneControl } from '@/app/engine/entity/BoneControl';
import { EntityBase } from '@/app/engine/entity/EntityBase';
import { Observer } from "@/app/engine/utils/Observer";
import { GizmoModeManager } from './GizmoModeManager';
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
  private _currentEntity: EntityBase | null = null;
  private _scene: BABYLON.Scene;
  private _hoverObserver: BABYLON.Observer<BABYLON.PointerInfo> | null = null;
  private _hoveredMesh: BABYLON.AbstractMesh | null = null;
  private _gizmoModeManager: GizmoModeManager;

  constructor(scene: BABYLON.Scene, gizmoModeManager: GizmoModeManager) {
    this._scene = scene;
    this._gizmoModeManager = gizmoModeManager;
    this._setupHoverObserver();
  }


  /**
   * Select an object
   */
  select(newSelectable: ISelectable): void {
    console.log("SelectionManager.select called with:", newSelectable?.getName());

    // Determine if need to deselect the current Entity
    if (this._currentEntity) {
      // Check if the new selection belongs to the same character as the current selection
      const isChildOfCurrentEntity = this._isChildOfEntity(newSelectable, this._currentEntity);
      if (!isChildOfCurrentEntity) {
        // deselect the current selection properly
        console.log("Deselecting previous:", this._currentEntity.getName());
        this._currentEntity.onDeselect();
        this._currentEntity = null;
      } else {
        // Dont change the current entity
      }
    }

    // Determine if need to deselect the current Selection
    if(this._currentSelection && !(this._currentSelection instanceof EntityBase)){
      // deselect the current selection properly
      console.log("Deselecting previous:", this._currentSelection.getName());
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
    console.log("Setting up gizmo for new selection:", newSelectable.getName(),
      "pos:", newSelectable.gizmoCapabilities.allowPosition,
      "rot:", newSelectable.gizmoCapabilities.allowRotation,
      "scale:", newSelectable.gizmoCapabilities.allowScale);

    // Configure gizmos based on capabilities
    // TODO update the capabilities of the gizmoModeManager

    // Get the target to attach gizmos to
    console.log("SelectionManager.select: Attaching gizmo to:", newSelectable.getName());
    this._gizmoModeManager.attachToSelectable(newSelectable);

    // Notify the selectable object
    newSelectable.onSelect();
  }

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

    this._gizmoModeManager.attachToSelectable(null);

    this.selectionObserver.notify('entitySelected', { entity: null });
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
   * Get the parent selection (if any)
   */
  getCurrentEntity(): EntityBase | null {
    return this._currentEntity;
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

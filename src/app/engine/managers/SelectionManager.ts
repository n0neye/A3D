import * as BABYLON from '@babylonjs/core';
import { ISelectable } from '../../interfaces/ISelectable';
import { getGizmoManager } from './SceneManagers';
import { CharacterEntity } from '../../util/entity/CharacterEntity';
import { BoneControl } from '../../util/entity/BoneControl';

/**
 * Manages selection of objects in the scene
 */
export class SelectionManager {
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

  onSceneClick(pointerInfo: BABYLON.PointerInfo, scene: BABYLON.Scene) {
    console.log("handleRegularClick called");

    // Get the selection manager


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
      this.select(boneControl);
      return;
    }

    const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
    const mesh = pickInfo.pickedMesh;
    console.log("Picked mesh:", mesh?.name, "metadata:", mesh?.metadata);

    // Clicked on empty space - deselect
    if (!mesh) {
      console.log("No mesh picked, deselecting");
      this.select(null);
      return;
    }

    // Find the selectable object
    let selectable: ISelectable | null = null;

    // TODO: It's so messy here
    // FIRST check if the mesh has a rootEntity that's selectable
    if (mesh.metadata?.rootEntity && (mesh.metadata.rootEntity as any).gizmoCapabilities) {
      console.log("Mesh has selectable rootEntity");
      selectable = mesh.metadata.rootEntity as ISelectable;
      this.select(selectable);
    }
    // THEN check if the mesh itself is directly selectable (for BoneControl etc.)
    else if ((mesh as any).gizmoCapabilities) {
      console.log("Mesh is directly selectable");
      selectable = mesh as unknown as ISelectable;
      const parentSelection = this.getParentSelection();
      this.select(selectable);
    }
    // Nothing selectable found
    else {
      console.log("Nothing selectable found, deselecting");
      this.select(null);
    }
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

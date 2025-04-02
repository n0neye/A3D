import * as BABYLON from '@babylonjs/core';
import { ISelectable } from '../../interfaces/ISelectable';
import { getGizmoManager } from './scene-managers';

/**
 * Manages selection of objects in the scene
 */
export class SelectionManager {
  private _currentSelection: ISelectable | null = null;
  private _scene: BABYLON.Scene;
  private _gizmoManager: BABYLON.GizmoManager | null = null;
  private _hoverObserver: BABYLON.Observer<BABYLON.PointerInfo> | null = null;
  private _hoveredMesh: BABYLON.AbstractMesh | null = null;
  
  constructor(scene: BABYLON.Scene) {
    this._scene = scene;
    this._gizmoManager = getGizmoManager(scene);
    this._setupHoverObserver();
  }
  
  /**
   * Select an object
   */
  select(selectable: ISelectable | null): void {
    console.log("SelectionManager.select called with:", selectable, selectable?.getId(), selectable?.constructor.name);
    
    // Deselect previous selection
    if (this._currentSelection) {
      console.log("Deselecting previous:", this._currentSelection.getId(), this._currentSelection.constructor.name);
      this._currentSelection.onDeselect();
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
   * Get the currently selected object
   */
  getCurrentSelection(): ISelectable | null {
    return this._currentSelection;
  }
  
  /**
   * Set up pointer hover observer for cursor changes
   */
  private _setupHoverObserver(): void {
    console.log("Setting up hover observer");
    this._hoverObserver = this._scene.onPointerObservable.add((pointerInfo) => {
      // Only handle pointer move events
      if (pointerInfo.type !== BABYLON.PointerEventTypes.POINTERMOVE) {
        return;
      }
      
      // Pick the mesh under the pointer
      const pickInfo = this._scene.pick(
        this._scene.pointerX, 
        this._scene.pointerY
      );
      
      // Get the picked mesh
      const pickedMesh = pickInfo.pickedMesh;
      
      // If hovering over a new mesh
      if (pickedMesh !== this._hoveredMesh) {
        console.log("Hover changed to:", pickedMesh?.name);
        // Update hover state
        this._hoveredMesh = pickedMesh;
        
        // Find ISelectable from mesh
        let selectable: ISelectable | null = null;
        
        if (pickedMesh) {
          // Check if mesh itself is selectable
          if ((pickedMesh as any).gizmoCapabilities) {
            console.log("Mesh is directly selectable");
            selectable = pickedMesh as unknown as ISelectable;
          } 
          // Check if mesh has a selectable entity as metadata
          else if (pickedMesh.metadata?.rootEntity && 
                  (pickedMesh.metadata.rootEntity as any).gizmoCapabilities) {
            console.log("Mesh has selectable rootEntity");
            selectable = pickedMesh.metadata.rootEntity as ISelectable;
          }
        }
        
        // Update cursor based on selectable
        this._updateCursor(selectable);
      }
    });
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

// Create and register the selection manager with the scene
export function createSelectionManager(scene: BABYLON.Scene): SelectionManager {
  console.log("Creating and registering selection manager");
  const selectionManager = new SelectionManager(scene);
  
  // Store in scene metadata
  if (!scene.metadata) {
    scene.metadata = {};
  }
  scene.metadata.selectionManager = selectionManager;
  console.log("Selection manager registered with scene");
  
  return selectionManager;
}

// Get the selection manager from a scene
export function getSelectionManager(scene: BABYLON.Scene): SelectionManager | null {
  const manager = scene.metadata?.selectionManager || null;
  console.log("Getting selection manager:", !!manager);
  return manager;
} 
import * as BABYLON from '@babylonjs/core';
import { EditorMode, EditorModeManager } from '../modeManager';
import { getEntityFromMesh, resolveEntity } from '../../entity-manager';

export class DefaultMode implements EditorMode {
  id = 'default';
  name = 'Default Mode';
  
  onEnter(scene: BABYLON.Scene, previousModeId: string): void {
    // Clear any selections
    scene.meshes.forEach(mesh => {
      if (mesh.showBoundingBox) {
        mesh.showBoundingBox = false;
      }
    });
  }
  
  onExit(scene: BABYLON.Scene, nextModeId: string): void {
    // Nothing specific to clean up
  }
  
  handleSceneClick(pickInfo: BABYLON.PickingInfo, scene: BABYLON.Scene): boolean {
    // If we clicked on a mesh that's not a utility object
    const mesh = pickInfo.pickedMesh;
    
    if (mesh && 
        !mesh.name.includes("gizmo") && 
        !mesh.name.startsWith("__") &&
        !mesh.name.includes("ik-target") &&
        !(mesh.metadata && mesh.metadata.excludeFromHierarchy === true)) {
      
      // Find the entity if this mesh belongs to one
      const entity = getEntityFromMesh(mesh) || mesh;
      
      console.log("Default mode: Entity selected", entity.name, entity.metadata);
      
      // Switch to object manipulation mode and pass the selected entity
      const modeManager = EditorModeManager.getInstance();
      modeManager.setMode('entity', scene);
      
      // After switching mode, have the object mode handle this object
      modeManager.handleEntitySelected(entity, scene);
      
      return true;
    }
    
    // Background click does nothing in default mode
    return false;
  }
  
  handleEntitySelected(node: BABYLON.Node, scene: BABYLON.Scene): void {
    // When object is selected, switch to object manipulation mode
    const modeManager = EditorModeManager.getInstance();
    modeManager.setMode('object', scene);
  }
  
  handleKeyDown(event: KeyboardEvent, scene: BABYLON.Scene): boolean {
    // No special key handling in default mode
    return false;
  }
  
  configureGizmos(gizmoManager: BABYLON.GizmoManager): void {
    // Hide all gizmos
    gizmoManager.positionGizmoEnabled = false;
    gizmoManager.rotationGizmoEnabled = false;
    gizmoManager.scaleGizmoEnabled = false;
    gizmoManager.attachToMesh(null);
  }
} 
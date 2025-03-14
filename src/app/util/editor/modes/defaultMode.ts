import * as BABYLON from '@babylonjs/core';
import { EditorMode } from '../modeManager';

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
        !(mesh.metadata && mesh.metadata.excludeFromObjectsPanel === true)) {
      
      console.log("Default mode: Object selected", mesh.name);
      
      // Switch to object manipulation mode and pass the selected mesh
      const modeManager = require('../modeManager').EditorModeManager.getInstance();
      modeManager.setMode('object', scene);
      
      // After switching mode, have the object mode handle this object
      modeManager.handleObjectSelected(mesh, scene);
      
      return true;
    }
    
    // Background click does nothing in default mode
    return false;
  }
  
  handleObjectSelected(mesh: BABYLON.AbstractMesh, scene: BABYLON.Scene): void {
    // When object is selected, switch to object manipulation mode
    const modeManager = require('../modeManager').EditorModeManager.getInstance();
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
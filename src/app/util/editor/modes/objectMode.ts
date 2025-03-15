import * as BABYLON from '@babylonjs/core';
import { EditorMode } from '../modeManager';

export class ObjectManipulationMode implements EditorMode {
  id = 'object';
  name = 'Object Manipulation';
  private selectedMesh: BABYLON.AbstractMesh | null = null;
  
  onEnter(scene: BABYLON.Scene, previousModeId: string): void {
    // Nothing specific to set up
  }
  
  onExit(scene: BABYLON.Scene, nextModeId: string): void {
    this.selectedMesh = null;
  }
  
  handleSceneClick(pickInfo: BABYLON.PickingInfo, scene: BABYLON.Scene): boolean {
    // If clicked on nothing, return to default mode
    if (!pickInfo.hit || !pickInfo.pickedMesh) {
      const modeManager = require('../modeManager').EditorModeManager.getInstance();
      modeManager.setMode('default', scene);
      return true;
    }
    
    // If clicked on a mesh that's not a utility object
    const mesh = pickInfo.pickedMesh;
    if (mesh && 
        !mesh.name.includes("gizmo") && 
        !mesh.name.startsWith("__") &&
        !mesh.name.includes("ik-target") &&
        !(mesh.metadata && mesh.metadata.excludeFromHierarchy === true)) {
      
      this.handleObjectSelected(mesh, scene);
      return true;
    }
    
    return false;
  }
  
  handleObjectSelected(mesh: BABYLON.AbstractMesh, scene: BABYLON.Scene): void {
    this.selectedMesh = mesh;
    
    console.log("Object selected:", mesh.name);
    
    // Get the gizmo manager from the mode manager
    const modeManager = require('../modeManager').EditorModeManager.getInstance();
    const gizmoManager = modeManager.getGizmoManager();
    
    if (gizmoManager) {
      this.configureGizmos(gizmoManager);
      gizmoManager.attachToMesh(mesh);
    } else {
      console.error("No gizmo manager found");
    }
  }
  
  handleKeyDown(event: KeyboardEvent, scene: BABYLON.Scene): boolean {
    // Handle delete key to remove selected object
    if ((event.key === 'Delete' || event.key === 'Backspace') && this.selectedMesh) {
      // Logic to delete object would go here
      return true;
    }
    return false;
  }
  
  configureGizmos(gizmoManager: BABYLON.GizmoManager): void {
    // Show transform gizmos
    gizmoManager.positionGizmoEnabled = true;
    gizmoManager.rotationGizmoEnabled = true;
    gizmoManager.scaleGizmoEnabled = true;
  }
} 
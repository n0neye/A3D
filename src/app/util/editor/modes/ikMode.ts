import * as BABYLON from '@babylonjs/core';
import { EditorMode } from '../modeManager';
import * as IKUtils from '../../character/ikUtil';

export class IKPoseMode implements EditorMode {
  id = 'ik';
  name = 'IK Posing';
  
  onEnter(scene: BABYLON.Scene, previousModeId: string): void {
    // Set up IK targets
    IKUtils.setupIKForRegisteredCharacters(scene);
    IKUtils.toggleIKForAllCharacters(scene, true);
  }
  
  onExit(scene: BABYLON.Scene, nextModeId: string): void {
    // Hide IK controls
    IKUtils.toggleIKForAllCharacters(scene, false);
  }
  
  handleSceneClick(pickInfo: BABYLON.PickingInfo, scene: BABYLON.Scene): boolean {
    const mesh = pickInfo.pickedMesh;
    
    // Check if we clicked on an IK target
    if (mesh && mesh.name.includes("ik-target")) {
      // IK targets handle their own dragging
      return true;
    }
    
    // If clicked on background, stay in IK mode
    return false;
  }
  
  handleObjectSelected(mesh: BABYLON.AbstractMesh, scene: BABYLON.Scene): void {
    // In IK mode, we only handle IK target objects
    if (mesh && mesh.name.includes("ik-target")) {
      // The selecting of IK targets is handled by babylon's dragging system
    }
  }
  
  handleKeyDown(event: KeyboardEvent, scene: BABYLON.Scene): boolean {
    // Handle ESC key to exit IK mode
    if (event.key === 'Escape') {
      const modeManager = require('../modeManager').EditorModeManager.getInstance();
      modeManager.setMode('default', scene);
      return true;
    }
    
    // Handle R key to reset pose
    if (event.key === 'r' || event.key === 'R') {
      IKUtils.resetIKTargetsForAllCharacters(scene);
      return true;
    }
    
    return false;
  }
  
  configureGizmos(gizmoManager: BABYLON.GizmoManager): void {
    // IK mode doesn't use standard gizmos
    gizmoManager.positionGizmoEnabled = false;
    gizmoManager.rotationGizmoEnabled = false;
    gizmoManager.scaleGizmoEnabled = false;
    gizmoManager.attachToMesh(null);
  }
} 
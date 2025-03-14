import * as BABYLON from '@babylonjs/core';
import { EditorMode } from '../modeManager';
import * as BoneUtils from '../../character/bonesUtil';

export class BoneEditMode implements EditorMode {
  id = 'bone';
  name = 'Bone Editing';
  
  onEnter(scene: BABYLON.Scene, previousModeId: string): void {
    // Show bone controls
    BoneUtils.toggleBoneControlsForAllCharacters(scene, true);
  }
  
  onExit(scene: BABYLON.Scene, nextModeId: string): void {
    // Hide bone controls
    BoneUtils.toggleBoneControlsForAllCharacters(scene, false);
  }
  
  handleSceneClick(pickInfo: BABYLON.PickingInfo, scene: BABYLON.Scene): boolean {
    const mesh = pickInfo.pickedMesh;
    
    // Check if we clicked on a bone control
    if (mesh && mesh.metadata && mesh.metadata.type === "boneControl") {
      // Bone controls are handled via their own action managers
      return true;
    }
    
    // If clicked on background, stay in bone mode
    return false;
  }
  
  handleObjectSelected(mesh: BABYLON.AbstractMesh, scene: BABYLON.Scene): void {
    // Only handle bone control meshes
    if (mesh && mesh.metadata && mesh.metadata.type === "boneControl") {
      // The bone selection is handled in bones.ts via action manager
    }
  }
  
  handleKeyDown(event: KeyboardEvent, scene: BABYLON.Scene): boolean {
    // Handle ESC key to exit bone mode
    if (event.key === 'Escape') {
      const modeManager = require('../modeManager').EditorModeManager.getInstance();
      modeManager.setMode('default', scene);
      return true;
    }
    
    // Handle R key to reset pose
    if (event.key === 'r' || event.key === 'R') {
      BoneUtils.resetAllBoneRotations();
      return true;
    }
    
    return false;
  }
  
  configureGizmos(gizmoManager: BABYLON.GizmoManager): void {
    // Show only rotation gizmo for bones
    gizmoManager.positionGizmoEnabled = false;
    gizmoManager.rotationGizmoEnabled = true;
    gizmoManager.scaleGizmoEnabled = false;
  }
} 
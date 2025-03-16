import * as BABYLON from '@babylonjs/core';
import { EditorMode, EditorModeManager } from '../modeManager';
import { getEntityFromMesh, resolveEntity } from '../../entity-manager';
import { EntityNode } from '../../../types/entity';

export class DefaultMode implements EditorMode {
  id = 'default';
  name = 'Default Mode';
  
  private gizmoManager: BABYLON.GizmoManager | null = null;

  onEnter(scene: BABYLON.Scene, previousModeId: string): void {
  }

  onExit(scene: BABYLON.Scene, nextModeId: string): void {
    // Nothing specific to clean up
  }

  handleSceneClick(pickInfo: BABYLON.PickingInfo, scene: BABYLON.Scene): boolean {
    // If we clicked on a mesh that's not a utility object
    const mesh = pickInfo.pickedMesh;
    
    // If clicked on a mesh, try to get the entity
    if (mesh) {
      const entity = resolveEntity(mesh);
      console.log("Default mode: selected entity", entity?.name);
      console.log("Default mode: selected mesh", mesh.name);
      if (entity) this.handleEntitySelected(entity, scene);
      return true;
    }

    // Clear any gizmos
    console.log("Default mode: no entity selected, clearing selection");
    this.clearSelection(scene);

    // Background click does nothing in default mode
    return false;
  }

  handleEntitySelected(entity: EntityNode, scene: BABYLON.Scene): void {
    console.log("Default mode: handleEntitySelected", entity);

    // When object is selected, switch to entity manipulation mode
    const modeManager = EditorModeManager.getInstance();
    modeManager.setSelectedEntity(entity);
    
    if (this.gizmoManager && entity.primaryMesh) {
    // Enable gizmos
      this.gizmoManager.positionGizmoEnabled = true;
      this.gizmoManager.rotationGizmoEnabled = true;
      this.gizmoManager.scaleGizmoEnabled = true;

      // Attach the gizmo to the entity
      this.gizmoManager.attachToMesh(entity.primaryMesh);
    }
  }

  handleKeyDown(event: KeyboardEvent, scene: BABYLON.Scene): boolean {
    // Use the manager to get the currently selected entity
    const modeManager = EditorModeManager.getInstance();
    const selectedEntity = modeManager.getSelectedEntity();

    // Handle delete key to remove selected object
    if ((event.key === 'Delete') && selectedEntity) {
      // Logic to delete entity would go here
      // TODO: Implement delete entity
      console.log("Default mode: delete entity", selectedEntity);
      return true;
    }

    return false;
  }

  configureGizmos(gizmoManager: BABYLON.GizmoManager): void {
    // Hide all gizmos
    this.gizmoManager = gizmoManager;

  }



  // Helper functions
  clearSelection(scene: BABYLON.Scene): void {
    // Clear any selections
    scene.meshes.forEach(mesh => {
      if (mesh.showBoundingBox) {
        mesh.showBoundingBox = false;
      }
    });

    // Clear any gizmos
    if (this.gizmoManager) {
      this.gizmoManager.positionGizmoEnabled = false;
      this.gizmoManager.rotationGizmoEnabled = false;
      this.gizmoManager.scaleGizmoEnabled = false;
      this.gizmoManager.attachToMesh(null);
    }
  }
} 
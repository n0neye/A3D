import * as BABYLON from '@babylonjs/core';
import { EditorMode, EditorModeManager } from '../modeManager';
import { resolveEntity } from '../../entity-manager';
import { EntityNode } from '../../../types/entity';

export class EntityMode implements EditorMode {
  id = 'entity';
  name = 'Entity Manipulation';
  private gizmoManager: BABYLON.GizmoManager | null = null;

  onEnter(scene: BABYLON.Scene, previousModeId: string): void {
    // Get the gizmo manager from mode manager
    const modeManager = EditorModeManager.getInstance();
    this.gizmoManager = modeManager.getGizmoManager();

    // Configure gizmos if available
    if (this.gizmoManager) {
      this.configureGizmos(this.gizmoManager);
    }
  }

  onExit(scene: BABYLON.Scene, nextModeId: string): void {
    // Clear the selected entity
    const modeManager = EditorModeManager.getInstance();
    modeManager.setSelectedEntity(null)
  }

  handleSceneClick(pickInfo: BABYLON.PickingInfo, scene: BABYLON.Scene): boolean {
    // If clicked on nothing, return to default mode
    if (!pickInfo.hit || !pickInfo.pickedMesh) {
      const modeManager = EditorModeManager.getInstance();
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

      const entity = resolveEntity(mesh);
      if (entity) this.handleEntitySelected(entity, scene);
      return true;
    }

    return false;
  }

  handleEntitySelected(entity: EntityNode, scene: BABYLON.Scene): void {
    console.log("Entity mode: Entity selected", entity.name);

    // Get the ModeManager
    const modeManager = EditorModeManager.getInstance();

    // Let the manager handle selection - it will store the reference and notify listeners
    modeManager.setSelectedEntity(entity);

    // Attach gizmos (this could also be handled by the manager)
    if (this.gizmoManager && entity.primaryMesh) {
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
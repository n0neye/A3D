import * as BABYLON from '@babylonjs/core';
import { EditorMode } from '../modeManager';
import { resolveEntity, getPrimaryMeshFromEntity } from '../../entity-manager';
import { Entity, isEntity } from '../../../types/entity';

export class EntityMode implements EditorMode {
  id = 'entity';
  name = 'Entity Manipulation';
  private selectedEntity: Entity | null = null;
  private gizmoManager: BABYLON.GizmoManager | null = null;
  
  onEnter(scene: BABYLON.Scene, previousModeId: string): void {
    // Get the gizmo manager from mode manager
    const modeManager = require('../modeManager').EditorModeManager.getInstance();
    this.gizmoManager = modeManager.getGizmoManager();
    
    // Configure gizmos if available
    if (this.gizmoManager) {
      this.configureGizmos(this.gizmoManager);
    }
  }
  
  onExit(scene: BABYLON.Scene, nextModeId: string): void {
    this.selectedEntity = null;
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
      
      this.handleEntitySelected(mesh, scene);
      return true;
    }
    
    return false;
  }
  
  handleEntitySelected(node: BABYLON.Node, scene: BABYLON.Scene): void {
    // Try to get the entity
    const entity = resolveEntity(node);
    
    if (entity) {
      console.log("Entity mode: Entity selected", entity.name);
      this.selectedEntity = entity;
      
      // Get the primary mesh for gizmo attachment
      const mesh = entity.primaryMesh;
      
      if (mesh && this.gizmoManager) {
        this.gizmoManager.attachToMesh(mesh);
        
        // Store entity reference
        this.gizmoManager.metadata = {
          ...this.gizmoManager.metadata || {},
          selectedEntity: entity
        };
      }
    } else if (node instanceof BABYLON.AbstractMesh) {
      // Fall back to using the mesh directly
      console.log("Entity mode: Mesh selected", node.name);
      this.selectedEntity = null;
      
      if (this.gizmoManager) {
        this.gizmoManager.attachToMesh(node);
        
        // Clear any stored entity
        if (this.gizmoManager.metadata) {
          delete this.gizmoManager.metadata.selectedEntity;
        }
      }
    }
  }
  
  handleKeyDown(event: KeyboardEvent, scene: BABYLON.Scene): boolean {
    // Handle delete key to remove selected object
    if ((event.key === 'Delete') && this.selectedEntity) {
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
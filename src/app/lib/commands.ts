import * as BABYLON from '@babylonjs/core';
import { Command } from '../components/HistoryManager';
import { Vector3, Quaternion } from '@babylonjs/core';
import { EntityNode } from '../util/extensions/entityNode';

// Base class for mesh transform operations
export class TransformCommand implements Command {
  private initialPosition: Vector3;
  private initialRotation: Quaternion;
  private initialScaling: Vector3;

  private newPosition: Vector3;
  private newRotation: Quaternion; 
  private newScaling: Vector3;

  constructor(private mesh: BABYLON.Mesh) {
    // Store initial state
    this.initialPosition = mesh.position.clone();
    this.initialRotation = mesh.rotationQuaternion ? 
                         mesh.rotationQuaternion.clone() : 
                         Quaternion.FromEulerAngles(mesh.rotation.x, mesh.rotation.y, mesh.rotation.z);
    this.initialScaling = mesh.scaling.clone();
    
    // The new state will be set later
    this.newPosition = this.initialPosition.clone();
    this.newRotation = this.initialRotation.clone();
    this.newScaling = this.initialScaling.clone();
  }

  // Call this after the transform is complete to capture the final state
  public updateFinalState() {
    this.newPosition = this.mesh.position.clone();
    this.newRotation = this.mesh.rotationQuaternion ? 
                      this.mesh.rotationQuaternion.clone() : 
                      Quaternion.FromEulerAngles(this.mesh.rotation.x, this.mesh.rotation.y, this.mesh.rotation.z);
    this.newScaling = this.mesh.scaling.clone();
  }

  public execute(): void {
    this.mesh.position = this.newPosition.clone();
    if (this.mesh.rotationQuaternion) {
      this.mesh.rotationQuaternion = this.newRotation.clone();
    } else {
      const euler = this.newRotation.toEulerAngles();
      this.mesh.rotation = new Vector3(euler.x, euler.y, euler.z);
    }
    this.mesh.scaling = this.newScaling.clone();
  }

  public undo(): void {
    this.mesh.position = this.initialPosition.clone();
    if (this.mesh.rotationQuaternion) {
      this.mesh.rotationQuaternion = this.initialRotation.clone();
    } else {
      const euler = this.initialRotation.toEulerAngles();
      this.mesh.rotation = new Vector3(euler.x, euler.y, euler.z);
    }
    this.mesh.scaling = this.initialScaling.clone();
  }
}

// Command for creating new objects
export class CreateMeshCommand implements Command {
  private mesh: BABYLON.Mesh;

  constructor(
    private meshFactory: () => BABYLON.Mesh,
    private scene: BABYLON.Scene
  ) {
    // Create the mesh but don't add it to the scene yet
    this.mesh = this.meshFactory();
  }

  public execute(): void {
    // Add the mesh to the scene if it's not already there
    if (!this.mesh.isEnabled()) {
      this.mesh.setEnabled(true);
    }
  }

  public undo(): void {
    // Hide the mesh (more efficient than disposing and recreating)
    this.mesh.setEnabled(false);
  }

  // Helper to get the created mesh
  public getMesh(): BABYLON.Mesh {
    return this.mesh;
  }
}

// Command for deleting objects
export class DeleteMeshCommand implements Command {
  private isVisible: boolean;
  private gizmoManager: BABYLON.GizmoManager | null;

  constructor(private entity: EntityNode | BABYLON.Mesh, gizmoManager: BABYLON.GizmoManager | null = null) {
    // Check if it's an EntityNode or a Mesh
    if ('getPrimaryMesh' in entity) {
      const primaryMesh = entity.getPrimaryMesh();
      this.isVisible = primaryMesh ? primaryMesh.isEnabled() : false;
    } else {
      this.isVisible = entity.isEnabled();
    }
    this.gizmoManager = gizmoManager;
  }

  public execute(): void {
    // Hide the entity or mesh
    if ('getPrimaryMesh' in this.entity) {
      // It's an EntityNode
      const primaryMesh = this.entity.getPrimaryMesh();
      if (primaryMesh) primaryMesh.setEnabled(false);
    } else {
      // It's a Mesh
      this.entity.setEnabled(false);
    }
    
    // Detach gizmo if needed
    if (this.gizmoManager) {
      // Get the mesh to check against gizmo
      const meshToCheck = 'getPrimaryMesh' in this.entity ? 
        this.entity.getPrimaryMesh() : this.entity;
      
      if (this.gizmoManager.gizmos.positionGizmo?.attachedMesh === meshToCheck) {
        this.gizmoManager.attachToMesh(null);
      }
    }
  }

  public undo(): void {
    // Restore visibility
    if ('getPrimaryMesh' in this.entity) {
      const primaryMesh = this.entity.getPrimaryMesh();
      if (primaryMesh) primaryMesh.setEnabled(this.isVisible);
    } else {
      this.entity.setEnabled(this.isVisible);
    }
  }
} 
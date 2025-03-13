import * as BABYLON from '@babylonjs/core';
import { Command } from '../components/HistoryManager';
import { Vector3, Quaternion } from '@babylonjs/core';

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

  constructor(private mesh: BABYLON.Mesh) {
    this.isVisible = mesh.isEnabled();
  }

  public execute(): void {
    // Hide the mesh rather than actually deleting it
    this.mesh.setEnabled(false);
  }

  public undo(): void {
    // Restore the mesh's previous visibility
    this.mesh.setEnabled(this.isVisible);
  }
} 
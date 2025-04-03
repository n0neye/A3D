import * as BABYLON from '@babylonjs/core';
import { Command } from '../engine/managers/HistoryManager';
import { Vector3, Quaternion } from '@babylonjs/core';
import { EntityBase } from '../util/entity/EntityBase';
import { usePostHog } from 'posthog-js/react';

// Base class for mesh transform operations
export class TransformCommand implements Command {
  private initialPosition: Vector3;
  private initialRotation: Quaternion;
  private initialScaling: Vector3;

  private newPosition: Vector3;
  private newRotation: Quaternion; 
  private newScaling: Vector3;

  constructor(private node: BABYLON.TransformNode) {
    // Store initial state
    this.initialPosition = node.position.clone();
    this.initialRotation = node.rotationQuaternion ? 
                         node.rotationQuaternion.clone() : 
                         Quaternion.FromEulerAngles(node.rotation.x, node.rotation.y, node.rotation.z);
    this.initialScaling = node.scaling.clone();
    
    // The new state will be set later
    this.newPosition = this.initialPosition.clone();
    this.newRotation = this.initialRotation.clone();
    this.newScaling = this.initialScaling.clone();
  }

  // Call this after the transform is complete to capture the final state
  public updateFinalState() {
    this.newPosition = this.node.position.clone();
    this.newRotation = this.node.rotationQuaternion ? 
                      this.node.rotationQuaternion.clone() : 
                      Quaternion.FromEulerAngles(this.node.rotation.x, this.node.rotation.y, this.node.rotation.z);
    this.newScaling = this.node.scaling.clone();
  }

  public execute(): void {
    this.node.position = this.newPosition.clone();
    if (this.node.rotationQuaternion) {
      this.node.rotationQuaternion = this.newRotation.clone();
    } else {
      const euler = this.newRotation.toEulerAngles();
      this.node.rotation = new Vector3(euler.x, euler.y, euler.z);
    }
    this.node.scaling = this.newScaling.clone();
  }

  public undo(): void {
    this.node.position = this.initialPosition.clone();
    if (this.node.rotationQuaternion) {
      this.node.rotationQuaternion = this.initialRotation.clone();
    } else {
      const euler = this.initialRotation.toEulerAngles();
      this.node.rotation = new Vector3(euler.x, euler.y, euler.z);
    }
    this.node.scaling = this.initialScaling.clone();
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

  constructor(private entity: EntityBase | BABYLON.Mesh, gizmoManager: BABYLON.GizmoManager | null = null) {
    // Check if it's an EntityBase or a Mesh
    this.isVisible = entity.isEnabled();
    this.gizmoManager = gizmoManager;
  }

  public execute(): void {
    // Hide the entity or mesh
    this.entity.setEnabled(false);
    if (this.gizmoManager) {
      this.gizmoManager.attachToMesh(null);
    }
  }

  public undo(): void {
    this.entity.setEnabled(this.isVisible);
  }
}

// Command for creating new entities
export class CreateEntityCommand implements Command {
  private entity: EntityBase | null = null;
  private factory: () => EntityBase;

  constructor(factory: () => EntityBase) {
    this.factory = factory;
  }

  execute(): void {
    console.log("CreateEntityCommand: executing"); // Add debug log
    if (!this.entity) {
      try {
        this.entity = this.factory();
        console.log("Entity created successfully", this.entity);
      } catch (error) {
        console.error("Error creating entity:", error);
      }
    } else {
      // Re-add the entity to the scene if it was removed
      this.entity.setEnabled(true);
    }
  }

  undo(): void {
    if (this.entity) {
      this.entity.setEnabled(false);
    }
  }

  redo(): void {
    this.execute();
  }

  getEntity(): EntityBase | null {
    return this.entity;
  }
} 


export class CreateEntityAsyncCommand implements Command {
  private entity: EntityBase | null = null;
  private factory: () => Promise<EntityBase>;
  private scene: BABYLON.Scene;

  constructor(factory: () => Promise<EntityBase>, scene: BABYLON.Scene) {
    this.factory = factory;
    this.scene = scene;
  }

  async execute(): Promise<void> {
    console.log("CreateEntityCommand: executing"); // Add debug log
    if (!this.entity) {
      try {
        this.entity = await this.factory();
        console.log("Entity created successfully", this.entity);
      } catch (error) {
        console.error("Error creating entity:", error);
      }
    } else {
      // Re-add the entity to the scene if it was removed
      this.entity.setEnabled(true);
    }
  }

  undo(): void {
    if (this.entity) {
      this.entity.setEnabled(false);
    }
  }

  redo(): void {
    this.execute();
  }

  getEntity(): EntityBase | null {
    return this.entity;
  }
} 

// Updated BoneRotationCommand to store differences only
export class BoneRotationCommand implements Command {
  private initialRotation: BABYLON.Quaternion;
  private finalRotation: BABYLON.Quaternion;
  private boneName: string;
  
  constructor(
    private bone: BABYLON.Bone,
    private controlMesh: BABYLON.Mesh
  ) {
    this.boneName = bone.name;
    
    // Always store as quaternions for more reliable interpolation
    this.initialRotation = bone.getRotationQuaternion() 
      ? bone.getRotationQuaternion()!.clone() 
      : BABYLON.Quaternion.FromEulerAngles(bone.rotation.x, bone.rotation.y, bone.rotation.z);
      
    // Initially, final rotation equals initial (will be updated at end of drag)
    this.finalRotation = this.initialRotation.clone();
  }

  // Call this after the rotation is complete
  public updateFinalState(): void {
    // Capture the final rotation state after dragging
    this.finalRotation = this.bone.getRotationQuaternion() 
      ? this.bone.getRotationQuaternion()!.clone() 
      : BABYLON.Quaternion.FromEulerAngles(this.bone.rotation.x, this.bone.rotation.y, this.bone.rotation.z);
  }

  // We don't need to apply changes here - the mesh already has the right rotation
  public execute(): void {
    console.log(`Execute rotation for bone: ${this.boneName}`);
    // The rotation is already applied by the gizmo's natural behavior
    // We don't need to do anything here
  }

  // Restore the initial rotation
  public undo(): void {
    console.log(`Undo rotation for bone: ${this.boneName}`);
    // Apply the initial rotation to the bone
    if (this.bone._linkedTransformNode) {
      // If the bone has a linked transform node, apply rotation to it
      if (this.bone._linkedTransformNode.rotationQuaternion) {
        this.bone._linkedTransformNode.rotationQuaternion = this.initialRotation.clone();
      } else {
        const euler = this.initialRotation.toEulerAngles();
        this.bone._linkedTransformNode.rotation = new BABYLON.Vector3(euler.x, euler.y, euler.z);
      }
    } else {
      // Apply directly to the bone
      this.bone.setRotationQuaternion(this.initialRotation.clone());
    }
    
    // Also update the control mesh to match
    if (this.controlMesh.rotationQuaternion) {
      this.controlMesh.rotationQuaternion = this.initialRotation.clone();
    } else {
      const euler = this.initialRotation.toEulerAngles();
      this.controlMesh.rotation = new BABYLON.Vector3(euler.x, euler.y, euler.z);
    }
  }
  
  // Reapply the final rotation
  public redo(): void {
    console.log(`Redo rotation for bone: ${this.boneName}`);
    // Apply the final rotation to the bone
    if (this.bone._linkedTransformNode) {
      // If the bone has a linked transform node, apply rotation to it
      if (this.bone._linkedTransformNode.rotationQuaternion) {
        this.bone._linkedTransformNode.rotationQuaternion = this.finalRotation.clone();
      } else {
        const euler = this.finalRotation.toEulerAngles();
        this.bone._linkedTransformNode.rotation = new BABYLON.Vector3(euler.x, euler.y, euler.z);
      }
    } else {
      // Apply directly to the bone
      this.bone.setRotationQuaternion(this.finalRotation.clone());
    }
    
    // Also update the control mesh to match
    if (this.controlMesh.rotationQuaternion) {
      this.controlMesh.rotationQuaternion = this.finalRotation.clone();
    } else {
      const euler = this.finalRotation.toEulerAngles();
      this.controlMesh.rotation = new BABYLON.Vector3(euler.x, euler.y, euler.z);
    }
  }
} 
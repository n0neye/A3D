import * as THREE from 'three';
import { Command } from '../engine/managers/HistoryManager';
import { EntityBase } from '@/app/engine/entity/EntityBase';
import { EditorEngine } from '../engine/EditorEngine';

// Base class for mesh transform operations
export class TransformCommand implements Command {
  private initialPosition: THREE.Vector3;
  private initialRotation: THREE.Quaternion;
  private initialScaling: THREE.Vector3;

  private newPosition: THREE.Vector3;
  private newRotation: THREE.Quaternion; 
  private newScaling: THREE.Vector3;

  constructor(private node: THREE.Object3D) {
    // Store initial state
    this.initialPosition = node.position.clone();
    
    // Three.js objects use quaternion by default, not a separate rotationQuaternion property
    this.initialRotation = node.quaternion.clone();
    this.initialScaling = node.scale.clone();
    
    // The new state will be set later
    this.newPosition = this.initialPosition.clone();
    this.newRotation = this.initialRotation.clone();
    this.newScaling = this.initialScaling.clone();
  }

  // Call this after the transform is complete to capture the final state
  public updateFinalState() {
    this.newPosition = this.node.position.clone();
    this.newRotation = this.node.quaternion.clone();
    this.newScaling = this.node.scale.clone();
  }

  public execute(): void {
    this.node.position.copy(this.newPosition);
    this.node.quaternion.copy(this.newRotation);
    this.node.scale.copy(this.newScaling);
  }

  public undo(): void {
    this.node.position.copy(this.initialPosition);
    this.node.quaternion.copy(this.initialRotation);
    this.node.scale.copy(this.initialScaling);
  }
}

// Command for creating new objects
export class CreateMeshCommand implements Command {
  private mesh: THREE.Mesh;

  constructor(
    private meshFactory: () => THREE.Mesh,
    private scene: THREE.Scene
  ) {
    // Create the mesh but don't add it to the scene yet
    this.mesh = this.meshFactory();
  }

  public execute(): void {
    // Add the mesh to the scene if it's not already there
    if (!this.mesh.visible) {
      this.mesh.visible = true;
    }
  }

  public undo(): void {
    // Hide the mesh (more efficient than disposing and recreating)
    this.mesh.visible = false;
  }

  // Helper to get the created mesh
  public getMesh(): THREE.Mesh {
    return this.mesh;
  }
}

// Command for deleting objects
export class DeleteEntityCommand implements Command {
  constructor(private entity: EntityBase) {
  }

  public execute(): void {
    this.entity.delete();
    EditorEngine.getInstance().getSelectionManager().deselectAll();
  }

  public undo(): void {
    this.entity.undoDelete();
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
      this.entity.visible = true;
    }
  }

  undo(): void {
    if (this.entity) {
      this.entity.visible = false;
    }
  }

  redo(): void {
    this.execute();
  }
} 

export class CreateEntityAsyncCommand implements Command {
  private entity: EntityBase | null = null;
  private factory: () => Promise<EntityBase>;
  private scene: THREE.Scene;

  constructor(factory: () => Promise<EntityBase>, scene: THREE.Scene) {
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
      this.entity.visible = true;
    }
  }

  undo(): void {
    if (this.entity) {
      this.entity.visible = false;
    }
  }

  redo(): void {
    this.execute();
  }

  getEntity(): EntityBase | null {
    return this.entity;
  }
} 

// Updated BoneRotationCommand for Three.js
export class BoneRotationCommand implements Command {
  private initialRotation: THREE.Quaternion;
  private finalRotation: THREE.Quaternion;
  private boneName: string;
  
  constructor(
    private bone: THREE.Bone,
    private controlMesh: THREE.Mesh
  ) {
    this.boneName = bone.name;
    
    // Store initial quaternion
    this.initialRotation = bone.quaternion.clone();
      
    // Initially, final rotation equals initial (will be updated at end of drag)
    this.finalRotation = this.initialRotation.clone();
  }

  // Call this after the rotation is complete
  public updateFinalState(): void {
    // Capture the final rotation state after dragging
    this.finalRotation = this.bone.quaternion.clone();
  }

  // We don't need to apply changes here - the mesh already has the right rotation
  public execute(): void {
    console.log(`Execute rotation for bone: ${this.boneName}`);
    // The rotation is already applied by the gizmo's natural behavior
    // But we'll make sure it's consistent
    this.bone.quaternion.copy(this.finalRotation);
    this.controlMesh.quaternion.copy(this.finalRotation);
  }

  // Restore the initial rotation
  public undo(): void {
    console.log(`Undo rotation for bone: ${this.boneName}`);
    // Apply the initial rotation to the bone
    this.bone.quaternion.copy(this.initialRotation);
    
    // Also update the control mesh to match
    this.controlMesh.quaternion.copy(this.initialRotation);
  }
  
  // Reapply the final rotation
  public redo(): void {
    console.log(`Redo rotation for bone: ${this.boneName}`);
    // Apply the final rotation to the bone
    this.bone.quaternion.copy(this.finalRotation);
    
    // Also update the control mesh to match
    this.controlMesh.quaternion.copy(this.finalRotation);
  }
} 
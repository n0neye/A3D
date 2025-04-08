import * as THREE from 'three';
import { Command } from '../engine/managers/HistoryManager';
import { EntityBase } from '@/app/engine/entity/base/EntityBase';
import { EditorEngine } from '../engine/EditorEngine';
import { ISelectable, isISelectable } from '@/app/interfaces/ISelectable';

// Base class for mesh transform operations
export class TransformCommand implements Command {
  private initialPosition: THREE.Vector3;
  private initialRotation: THREE.Quaternion;
  private initialScaling: THREE.Vector3;

  private newPosition: THREE.Vector3;
  private newRotation: THREE.Quaternion; 
  private newScaling: THREE.Vector3;
  
  private target: THREE.Object3D;
  private selectable: ISelectable | null;

  constructor(target: THREE.Object3D | ISelectable) {
    // Handle if we receive an ISelectable directly or an Object3D
    if (isISelectable(target)) {
      this.selectable = target;
      this.target = target.getGizmoTarget();
    } else {
      this.target = target;
      this.selectable = isISelectable(target) ? target : null;
    }
    
    // Store initial state
    this.initialPosition = this.target.position.clone();
    this.initialRotation = this.target.quaternion.clone();
    this.initialScaling = this.target.scale.clone();
    
    // The new state will be set later
    this.newPosition = this.initialPosition.clone();
    this.newRotation = this.initialRotation.clone();
    this.newScaling = this.initialScaling.clone();
  }

  // Call this after the transform is complete to capture the final state
  public updateFinalState() {
    this.newPosition = this.target.position.clone();
    this.newRotation = this.target.quaternion.clone();
    this.newScaling = this.target.scale.clone();
  }

  public execute(): void {
    this.target.position.copy(this.newPosition);
    this.target.quaternion.copy(this.newRotation);
    this.target.scale.copy(this.newScaling);
    
    // Notify selectable of transform update
    this.selectable?.onTransformUpdate?.();
  }

  public undo(): void {
    this.target.position.copy(this.initialPosition);
    this.target.quaternion.copy(this.initialRotation);
    this.target.scale.copy(this.initialScaling);
    
    // Notify selectable of transform update
    this.selectable?.onTransformUpdate?.();
  }
  
  public redo(): void {
    this.execute();
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

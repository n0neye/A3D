import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import { HistoryManager } from '../../engine/managers/HistoryManager';
import { ISelectable, GizmoCapabilities, SelectableCursorType } from '../../interfaces/ISelectable';
import { EditorEngine } from '../../engine/EditorEngine';
import { GizmoMode } from '@/app/engine/managers/TransformControlManager';
/**
 * Base class for all entities in the scene
 * Extends Object3D with common functionality
 */
// Entity types
export type EntityType = 'generative' | 'shape' | 'light' | 'character';
export class EntityBase extends THREE.Object3D implements ISelectable {
  // Core properties all entities share
  entityId: string;
  entityType: EntityType;
  created: Date;
  engine: EditorEngine;

  // ISelectable implementation
  gizmoCapabilities: GizmoCapabilities = {
    allowedGizmoModes: [GizmoMode.Position, GizmoMode.Rotation, GizmoMode.Scale, GizmoMode.BoundingBox],
    gizmoVisualSize: 1
  };

  cursorType: SelectableCursorType = 'move';

  constructor(
    name: string,
    scene: THREE.Scene,
    entityType: EntityType,
    options: {
      entityId?: string;
      position?: THREE.Vector3;
      rotation?: THREE.Euler;
      scaling?: THREE.Vector3;
    } = {}
  ) {
    super();
    this.name = name;

    // Initialize core properties
    this.engine = EditorEngine.getInstance();
    this.entityId = options.entityId || uuidv4();
    this.entityType = entityType;
    this.created = new Date();

    // Set transform properties
    if (options.position) this.position.copy(options.position);
    if (options.rotation) this.rotation.copy(options.rotation);
    if (options.scaling && this.scale) {
      this.scale.copy(options.scaling);
    }

    // Add to scene
    scene.add(this);
  }

  // Common methods all entities share

  /**
   * Get the entity type
   */
  getEntityType(): EntityType {
    return this.entityType;
  }

  /**
   * Base implementation for serialization
   * Can be extended by derived classes
   */
  serialize(): SerializedEntityData {
    return {
      entityId: this.entityId,
      name: this.name,
      entityType: this.entityType,
      position: fromThreeVector3(this.position),
      rotation: fromThreeEuler(this.rotation),
      scaling: fromThreeVector3(this.scale),
      created: this.created.toISOString(),
    };
  }

  /**
   * Base deserialization method (to be implemented in derived classes)
   */
  static async deserialize(scene: THREE.Scene, data: SerializedEntityData): Promise<EntityBase | null> {
    throw new Error(`EntityBase.deserialize: Not implemented`);
  }

  /**
   * Base implementation for disposal
   * Should be extended by derived classes to clean up resources
   */
  dispose(): void {
    // Remove from parent
    this.parent?.remove(this);
    
    // Dispose geometries and materials recursively
    this.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        if (object.geometry) {
          object.geometry.dispose();
        }
        
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
    });
  }

  /**
   * Get the HistoryManager from the scene
   */
  public getHistoryManager(): HistoryManager | null {
    return EditorEngine.getInstance().getHistoryManager();
  }

  // ISelectable implementation
  onSelect(): void {
    console.log(`EntityBase.onSelect: Entity selected: ${this.name} (${this.constructor.name})`);
  }

  onDeselect(): void {
    console.log(`EntityBase.onDeselect: Entity deselected: ${this.name} (${this.constructor.name})`);
  }

  getGizmoTarget(): THREE.Object3D {
    console.log(`EntityBase.getGizmoTarget: Returning this entity: ${this.name}`);
    return this; // The entity itself is the target
  }

  getUUId(): string {
    return this.entityId;
  }

  getName(): string {
    return this.name;
  }

  delete(): void {
    console.log(`EntityBase.delete: Deleting entity: ${this.name}`, this.children.length);
    // Simply hide the entity for now
    this.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        console.log(`EntityBase.delete: Hiding child mesh: ${child.name}`);
        child.visible = false;
      }
    });
    this.visible = false;
  }

  undoDelete(): void {
    console.log(`EntityBase.undoDelete: Undoing delete for entity: ${this.name}`);
    this.visible = true;
    this.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        child.visible = true;
      }
    });
  }
}


export interface SerializedEntityData {
  entityId: string;
  name: string;
  entityType: EntityType;
  position: Vector3Data;
  rotation: EulerData;
  scaling: Vector3Data;
  created: string;
}

type Vector3Data = {
  x: number;
  y: number;
  z: number;
}

type EulerData = {
  x: number;
  y: number;
  z: number;
  order?: string;
}

export const toThreeVector3 = (v: Vector3Data): THREE.Vector3 => {
  return new THREE.Vector3(v.x, v.y, v.z);
}

export const fromThreeVector3 = (v: THREE.Vector3): Vector3Data => {
  return { x: v.x, y: v.y, z: v.z };
}

export const toThreeEuler = (e: EulerData): THREE.Euler => {
  return new THREE.Euler(e.x, e.y, e.z, e.order as THREE.EulerOrder);
}

export const fromThreeEuler = (e: THREE.Euler): EulerData => {
  return { x: e.x, y: e.y, z: e.z, order: e.order };
}

export function isEntity(node: THREE.Object3D | null): node is EntityBase {
  return node instanceof EntityBase;
}
import * as THREE from 'three';
import { HistoryManager } from '../../managers/HistoryManager';
import { Selectable, SelectableConfig, SelectableCursorType } from './Selectable';
import { EditorEngine } from '../../core/EditorEngine';
import { TransformMode } from '@/engine/managers/TransformControlManager';
import { BoneControl } from '../components/BoneControl';
/**
 * Base class for all entities in the scene
 * Extends Object3D with common functionality
 */
// Entity types
export type EntityType = 'generative' | 'shape' | 'light' | 'character' | 'basic3D';


export class EntityBase extends Selectable {
  // Core properties all entities share
  entityType: EntityType;
  isDeleted: boolean = false;

  created: Date;
  engine: EditorEngine;

  
  _gizmoObject: THREE.Object3D;

  // ISelectable implementation
  selectableConfig: SelectableConfig = {
    allowedTransformModes: [TransformMode.Position, TransformMode.Rotation, TransformMode.Scale, TransformMode.BoundingBox],
    controlSize: 1
  };

  cursorType: SelectableCursorType = 'move';

  constructor(
    name: string,
    scene: THREE.Scene,
    entityType: EntityType,
    data: SerializedEntityData
  ) {
    super();
    this.name = name;

    console.log(`EntityBase.constructor:`, name, entityType, data);

    // Initialize core properties
    this.engine = EditorEngine.getInstance();
    this.uuid = data.uuid || this.uuid;
    this.entityType = entityType;
    this.created = new Date();

    // Set transform properties
    if (data.position) this.position.set(data.position.x, data.position.y, data.position.z);
    if (data.rotation) this.rotation.copy(toThreeEuler(data.rotation));
    if (data.scaling) this.scale.set(data.scaling.x, data.scaling.y, data.scaling.z);

    // Add to scene
    if (data.parentUUID) {
      console.log(`EntityBase.constructor: parentUUID`, data.parentUUID);
      const parent = scene.getObjectByProperty('uuid', data.parentUUID);
      if (parent) {
        console.log(`EntityBase.constructor: adding to parent`, parent.name);
        parent.add(this);
      } else {
        console.error(`EntityBase.constructor: parent not found`, data.parentUUID);
        scene.add(this);
      }
    } else {
      scene.add(this);
    }

    // Notify object manager about the new entity
    this.engine.getObjectManager().registerEntity(this);
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

    const data: SerializedEntityData = {
      uuid: this.uuid,
      name: this.name,
      entityType: this.entityType,
      position: fromThreeVector3(this.position),
      rotation: fromThreeEuler(this.rotation),
      scaling: fromThreeVector3(this.scale),
      created: this.created.toISOString(),
    };

    // Serialize parent relationship
    if (this.parent && this.parent !== this.engine.getScene()) {
      if (this.parent instanceof BoneControl) {
        
        console.log(`EntityBase.serialize: parent is a bone`, this.parent.name);
        data.parentBone = {
          boneName: this.parent.bone.name,
          characterUUID: this.parent.character.uuid,
        };

      } else if (this.parent instanceof EntityBase) {
        data.parentUUID = this.parent.uuid;
      }
    }

    return data;
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

  public getHistoryManager(): HistoryManager | null {
    return EditorEngine.getInstance().getHistoryManager();
  }

  getUUId(): string {
    return this.uuid;
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
    this.isDeleted = true;

    // Notify object manager about deletion state change
    this.engine.getObjectManager().updateEntityDeletedState(this, true);
  }

  undoDelete(): void {
    console.log(`EntityBase.undoDelete: Undoing delete for entity: ${this.name}`);
    this.visible = true;
    this.isDeleted = false;
    this.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        child.visible = true;
      }
    });

    // Notify object manager about deletion state change
    this.engine.getObjectManager().updateEntityDeletedState(this, false);
  }

  setGizmoVisible(visible: boolean): void {
    if (this._gizmoObject) {
      this._gizmoObject.visible = visible;
    }
  }
}


export interface SerializedEntityData {
  uuid: string;
  name: string;
  entityType: EntityType;
  position?: Vector3Data;
  rotation?: EulerData;
  scaling?: Vector3Data;
  created?: string;
  parentUUID?: string;
  parentBone?: {
    boneName: string;
    characterUUID: string;
  };
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
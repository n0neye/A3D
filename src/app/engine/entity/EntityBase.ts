import * as BABYLON from '@babylonjs/core';
import { v4 as uuidv4 } from 'uuid';
import { HistoryManager } from '../../engine/managers/HistoryManager';
import { ISelectable, GizmoCapabilities, SelectableCursorType } from '../../interfaces/ISelectable';
import { EditorEngine } from '../../engine/EditorEngine';
/**
 * Base class for all entities in the scene
 * Extends TransformNode with common functionality
 */
// Entity types
export type EntityType = 'generative' | 'shape' | 'light' | 'character';
export class EntityBase extends BABYLON.TransformNode implements ISelectable {
  // Core properties all entities share
  id: string;
  entityType: EntityType;
  created: Date;
  engine: EditorEngine;
  
  // ISelectable implementation
  gizmoCapabilities: GizmoCapabilities = {
    allowPosition: true,
    allowRotation: true,
    allowScale: true,
    allowBoundingBox: false,
    gizmoVisualSize: 1
  };

  cursorType: SelectableCursorType = 'move';

  constructor(
    name: string,
    scene: BABYLON.Scene,
    entityType: EntityType,
    options: {
      id?: string;
      position?: BABYLON.Vector3;
      rotation?: BABYLON.Vector3;
      scaling?: BABYLON.Vector3;
    } = {}
  ) {
    super(name, scene);

    // Initialize core properties
    this.engine = EditorEngine.getInstance();
    this.id = options.id || uuidv4();
    this.entityType = entityType;
    this.created = new Date();

    // Set transform properties
    if (options.position) this.position = options.position;
    if (options.rotation) this.rotation = options.rotation;
    if (options.scaling) this.scaling = options.scaling;

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
      id: this.id,
      name: this.name,
      entityType: this.entityType,
      position: fromBabylonVector3(this.position),
      rotation: fromBabylonVector3(this.rotation),
      scaling: fromBabylonVector3(this.scaling),
      created: this.created.toISOString(),
    };
  }

  /**
   * Base deserialization method (to be implemented in derived classes)
   */
  static async deserialize(scene: BABYLON.Scene, data: SerializedEntityData): Promise<EntityBase | null> {
    throw new Error(`EntityBase.deserialize: Not implemented`);
  }

  /**
   * Base implementation for disposal
   * Should be extended by derived classes to clean up resources
   */
  dispose(): void {
    super.dispose();
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

  getGizmoTarget(): BABYLON.AbstractMesh | BABYLON.TransformNode {
    console.log(`EntityBase.getGizmoTarget: Returning this entity: ${this.name}`);
    return this; // The entity itself is the target
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  applyTransformation(
    transformType: 'position' | 'rotation' | 'scale',
    value: BABYLON.Vector3 | BABYLON.Quaternion
  ): void {
    switch (transformType) {
      case 'position':
        if (value instanceof BABYLON.Vector3) {
          this.position = value;
        }
        break;
      case 'rotation':
        if (value instanceof BABYLON.Quaternion) {
          this.rotationQuaternion = value;
        } else if (value instanceof BABYLON.Vector3) {
          this.rotation = value;
        }
        break;
      case 'scale':
        if (value instanceof BABYLON.Vector3) {
          this.scaling = value;
        }
        break;
    }
  }
}


export interface SerializedEntityData {
  id: string;
  name: string;
  entityType: EntityType;
  position: Vector3Data;
  rotation: Vector3Data;
  scaling: Vector3Data;
  created: string;
}

type Vector3Data = {
  x: number;
  y: number;
  z: number;
}

export const toBabylonVector3 = (v: Vector3Data): BABYLON.Vector3 => {
  return new BABYLON.Vector3(v.x, v.y, v.z);
}
export const fromBabylonVector3 = (v: BABYLON.Vector3): Vector3Data => {
  return { x: v.x, y: v.y, z: v.z };
}

export function isEntity(node: BABYLON.Node | null): node is EntityBase {
  return node instanceof EntityBase;
}
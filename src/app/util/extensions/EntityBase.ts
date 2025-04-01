import * as BABYLON from '@babylonjs/core';
import { v4 as uuidv4 } from 'uuid';
import { ShapeEntityProps } from './ShapeEntity';
import { GenerativeEntityProps } from './GenerativeEntity';
import { LightProps } from './LightEntity';

/**
 * Base class for all entities in the scene
 * Extends TransformNode with common functionality
 */
// Entity types
export type EntityType = 'generative' | 'shape' | 'light';
export class EntityBase extends BABYLON.TransformNode {
  // Core properties all entities share
  id: string;
  entityType: EntityType;
  created: Date;

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
  static deserialize(scene: BABYLON.Scene, data: SerializedEntityData): EntityBase | null {
    // Base implementation to be overridden by subclasses
    return null;
  }

  /**
   * Base implementation for disposal
   * Should be extended by derived classes to clean up resources
   */
  dispose(): void {
    super.dispose();
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
const toBabylonVector3 = (v: Vector3Data): BABYLON.Vector3 => {
  return new BABYLON.Vector3(v.x, v.y, v.z);
}
const fromBabylonVector3 = (v: BABYLON.Vector3): Vector3Data => {
  return { x: v.x, y: v.y, z: v.z };
}

// Make these utility functions available for export
export { toBabylonVector3, fromBabylonVector3 };
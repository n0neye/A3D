import * as BABYLON from '@babylonjs/core';
import { v4 as uuidv4 } from 'uuid';

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
    return this.metadata.entityType;
  }
  
  /**
   * Base implementation for serialization
   * Can be extended by derived classes
   */
  serialize(): any {
    return {
      id: this.id,
      name: this.name,
      position: {
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      },
      rotation: {
        x: this.rotation.x,
        y: this.rotation.y,
        z: this.rotation.z
      },
      scaling: {
        x: this.scaling.x,
        y: this.scaling.y,
        z: this.scaling.z
      },
      metadata: {
        ...this.metadata,
        created: this.metadata.created.toISOString()
      },
    };
  }
  
  /**
   * Base implementation for disposal
   * Should be extended by derived classes to clean up resources
   */
  dispose(): void {
    super.dispose();
  }
} 
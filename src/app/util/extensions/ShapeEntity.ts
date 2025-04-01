import * as BABYLON from '@babylonjs/core';
import { EntityBase } from './EntityBase';

/**
 * Entity that represents primitive shapes
 */
export type ShapeType = 'cube' | 'sphere' | 'cylinder' | 'plane' | 'pyramid' | 'cone' | 'floor';
export interface ShapeEntityProps {
  shapeType: ShapeType;
}

export class ShapeEntity extends EntityBase {
  // ShapeEntity specific properties
  props: ShapeEntityProps;

  constructor(
    name: string,
    scene: BABYLON.Scene,
    options: {
      id?: string;
      position?: BABYLON.Vector3;
      rotation?: BABYLON.Vector3;
      scaling?: BABYLON.Vector3;
      props: ShapeEntityProps;
    }
  ) {
    super(name, scene, 'shape', {
      id: options.id,
      position: options.position,
      rotation: options.rotation,
      scaling: options.scaling,
    });

    this.props = options.props;

    // Create the shape mesh
    this.createShapeMesh();
  }

  /**
   * Create the shape mesh based on shapeType
   */
  private createShapeMesh(): void {
    // Implementation for shape mesh creation
  }

  /**
   * Serialize with shape-specific properties
   */
  serialize(): any {
    const base = super.serialize();
    return {
      ...base,
      props: this.props,
    };
  }
} 
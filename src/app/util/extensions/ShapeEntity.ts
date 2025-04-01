import * as BABYLON from '@babylonjs/core';
import { EntityBase } from './EntityBase';
import { createShapeMesh } from '../editor/shape-util';
import { defaultMaterial } from '../editor/material-util';
import { setupMeshShadows } from '../editor/light-util';

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
  modelMesh: BABYLON.Mesh;

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
    const newMesh = createShapeMesh(this._scene, this.props.shapeType);
    newMesh.parent = this;
    newMesh.metadata = { rootEntity: this };
    this.modelMesh = newMesh;

    // Apply the material and setup shadows
    newMesh.material = defaultMaterial;
    setupMeshShadows(newMesh);

    // scale
    if (options?.scaling) {
      newMesh.scaling = options.scaling;
    }

    // Return the created mesh
    console.log(`createShapeEntity: ${newMesh.name}`);
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
import * as BABYLON from '@babylonjs/core';
import { EntityBase, SerializedEntityData, toBabylonVector3 } from './EntityBase';
import { createShapeMesh } from '@/app/util/editor/shape-util';
import { defaultMaterial } from '@/app/util/editor/material-util';
import { setupMeshShadows } from '@/app/util/editor/light-util';

/**
 * Entity that represents primitive shapes
 */
export type ShapeType = 'cube' | 'sphere' | 'cylinder' | 'plane' | 'pyramid' | 'cone' | 'floor';
export interface ShapeEntityProps {
  shapeType: ShapeType;
}

// Add serialized data interface
export interface SerializedShapeEntityData extends SerializedEntityData {
  props: ShapeEntityProps;
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
   * Deserialize a shape entity from serialized data
   */
  static async deserialize(scene: BABYLON.Scene, data: SerializedShapeEntityData): Promise<ShapeEntity> {
    const position = data.position ? toBabylonVector3(data.position) : undefined;
    const rotation = data.rotation ? toBabylonVector3(data.rotation) : undefined;
    const scaling = data.scaling ? toBabylonVector3(data.scaling) : undefined;

    return new ShapeEntity(data.name, scene, {
      id: data.id,
      position,
      rotation,
      scaling,
      props: data.props
    });
  }

  /**
   * Serialize with shape-specific properties
   */
  serialize(): SerializedShapeEntityData {
    const base = super.serialize();
    return {
      ...base,
      props: this.props,
    };
  }
} 
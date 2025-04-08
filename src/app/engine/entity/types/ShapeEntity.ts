import * as THREE from 'three';
import { EntityBase, SerializedEntityData, toThreeVector3, toThreeEuler } from '../base/EntityBase';
import { createShapeMesh } from '@/app/util/editor/shape-util';
import { defaultShapeMaterial } from '@/app/util/editor/material-util';
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
  modelMesh: THREE.Mesh;

  constructor(
    name: string,
    scene: THREE.Scene,
    options: {
      uuid?: string;
      position?: THREE.Vector3;
      rotation?: THREE.Euler;
      scaling?: THREE.Vector3;
      props: ShapeEntityProps;
      onLoaded?: (entity: ShapeEntity) => void;
    }
  ) {
    super(name, scene, 'shape', {
      entityId: options.uuid,
      position: options.position,
      rotation: options.rotation,
      scaling: options.scaling,
    });

    this.props = options.props;

    // Create the shape mesh
    const newMesh = createShapeMesh(scene, this.props.shapeType);
    this.add(newMesh);
    newMesh.userData = { rootEntity: this };
    this.modelMesh = newMesh;

    // Apply the material and setup shadows
    newMesh.material = defaultShapeMaterial;
    setupMeshShadows(newMesh);

    // scale
    if (options?.scaling) {
      newMesh.scale.copy(options.scaling);
    }

    // Return the created mesh
    console.log(`ShapeEntity: constructor done`, options.onLoaded);
    options.onLoaded?.(this);
  }

  /**
   * Deserialize a shape entity from serialized data
   */
  static async deserialize(scene: THREE.Scene, data: SerializedShapeEntityData): Promise<ShapeEntity> {
    const position = data.position ? toThreeVector3(data.position) : undefined;
    const rotation = data.rotation ? toThreeEuler(data.rotation) : undefined;
    const scaling = data.scaling ? toThreeVector3(data.scaling) : undefined;

    return new ShapeEntity(data.name, scene, {
      uuid: data.entityId,
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
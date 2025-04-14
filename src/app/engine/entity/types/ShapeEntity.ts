import * as THREE from 'three';
import { EntityBase, SerializedEntityData, toThreeVector3, toThreeEuler } from '../base/EntityBase';
import { createShapeMesh } from '@/app/engine/utils/shapeUtil';
import { defaultShapeMaterial } from '@/app/engine/utils/materialUtil';
import { setupMeshShadows } from '@/app/engine/utils/lightUtil';

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
    data: SerializedShapeEntityData,
    onLoaded?: (entity: ShapeEntity) => void
  ) {
    super(name, scene, 'shape', data);

    this.props = data.props;

    // Create the shape mesh
    const newMesh = createShapeMesh(scene, this.props.shapeType);
    this.add(newMesh);
    newMesh.userData = { rootSelectable: this };
    this.modelMesh = newMesh;

    // Apply the material and setup shadows
    newMesh.material = defaultShapeMaterial;
    setupMeshShadows(newMesh);

    // Return the created mesh
    console.log(`ShapeEntity: constructor done`, this.name, this.uuid);
    onLoaded?.(this);
  }

  /**
   * Deserialize a shape entity from serialized data
   */
  static async deserialize(scene: THREE.Scene, data: SerializedShapeEntityData): Promise<ShapeEntity> {
    return new ShapeEntity(data.name, scene, data);
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
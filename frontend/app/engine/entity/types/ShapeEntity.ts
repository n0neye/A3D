import * as THREE from 'three';
import { EntityBase, SerializedEntityData, toThreeVector3, toThreeEuler } from '../base/EntityBase';
import { createShapeMesh } from '@/engine/utils/shapeUtil';
import { defaultShapeMaterial } from '@/engine/utils/materialUtil';
import { setupMeshShadows } from '@/engine/utils/lightUtil';
import { MaterialProps } from '../protperty/material';
import { trackEvent } from '@/engine/utils/external/analytics';
import { ANALYTICS_EVENTS } from '@/engine/utils/external/analytics';

/**
 * Entity that represents primitive shapes
 */
export type ShapeType = 'cube' | 'sphere' | 'cylinder' | 'plane' | 'pyramid' | 'cone' | 'floor';
export interface ShapeEntityProps {
  shapeType: ShapeType;
  material?: MaterialProps;
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

    // Apply the color
    if (this.props.material?.color) {
      this._applyColorToMesh(this.props.material.color);
    }

    // Return the created mesh
    console.log(`ShapeEntity: constructor done`, this.name, this.uuid);
    onLoaded?.(this);
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

  private _applyColorToMesh(colorString: string): void {
    if (this.modelMesh.material) {
      // if is using default material, create a new one
      if (this.modelMesh.material === defaultShapeMaterial) {
        this.modelMesh.material = new THREE.MeshStandardMaterial({ color: new THREE.Color(colorString) });
        this.modelMesh.material.side = THREE.DoubleSide;
      } else {
        (this.modelMesh.material as THREE.MeshStandardMaterial).color.set(new THREE.Color(colorString));
      }
    }
  }


  public setColor(colorString: string): void {
    this.props.material = {
      ...this.props.material,
      color: colorString
    };
    this._applyColorToMesh(colorString);
  }
} 
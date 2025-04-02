import * as BABYLON from '@babylonjs/core';
import { v4 as uuidv4 } from 'uuid';
import { ISelectable, GizmoCapabilities, SelectableCursorType } from '../../interfaces/ISelectable';
import { CharacterEntity } from './CharacterEntity';

/**
 * A mesh that represents a bone for manipulation
 */
export class BoneControl extends BABYLON.Mesh implements ISelectable {
  public id: string;
  public character: CharacterEntity;
  public bone: BABYLON.Bone;

  // ISelectable implementation - bones only support rotation
  gizmoCapabilities: GizmoCapabilities = {
    allowPosition: false,
    allowRotation: true,
    allowScale: false
  };

  // Use rotate cursor to indicate rotation capability
  cursorType: SelectableCursorType = 'rotate';

  public actionManager: BABYLON.ActionManager;

  constructor(
    name: string,
    scene: BABYLON.Scene,
    bone: BABYLON.Bone,
    character: CharacterEntity,
    options: {
      id?: string;
      diameter?: number;
      material?: BABYLON.Material;
    } = {}
  ) {
    // Create with basic constructor first
    super(name, scene);
    this.id = options.id || uuidv4();
    this.character = character;
    this.bone = bone;

    // Create sphere mesh for the bone control
    const sphereSource = BABYLON.MeshBuilder.CreateSphere(
      `${name}_source`,
      { diameter: options.diameter || 0.05 },
      scene
    );

    // Copy vertices and indices
    sphereSource.convertToFlatShadedMesh();
    const positions = sphereSource.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const indices = sphereSource.getIndices();

    if (positions && indices) {
      this.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
      this.setIndices(indices);
    }

    sphereSource.dispose();

    // Set material if provided
    if (options.material) {
      this.material = options.material;
    }

    // Set metadata for identification
    this.metadata = {
      isBoneControl: true,
      boneName: bone.name
    };

    // Set up cursor interactions
    this.actionManager = new BABYLON.ActionManager(scene);

    // Set cursor on hover
    this.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPointerOverTrigger,
        () => { scene.hoverCursor = this.cursorType; }
      )
    );

    // Reset cursor when pointer leaves
    this.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPointerOutTrigger,
        () => { scene.hoverCursor = "default"; }
      )
    );

    this.renderingGroupId = 1;
  }

  // ISelectable implementation
  onSelect(): void {
    console.log(`BoneControl.onSelect: Bone selected: ${this.bone.name}`);
  }

  onDeselect(): void {
    console.log(`BoneControl.onDeselect: Bone deselected: ${this.bone.name}`);
  }

  getGizmoTarget(): BABYLON.AbstractMesh {
    console.log(`BoneControl.getGizmoTarget: Returning mesh for bone: ${this.bone.name}`);
    return this;
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.bone.name;
  }

  applyTransformation(
    transformType: 'position' | 'rotation' | 'scale',
    value: BABYLON.Vector3 | BABYLON.Quaternion
  ): void {
    // Only handle rotation
    if (transformType === 'rotation') {
      // Apply to linked transform node if available
      if (this.bone._linkedTransformNode) {
        if (value instanceof BABYLON.Quaternion) {
          this.bone._linkedTransformNode.rotationQuaternion = value;
        } else if (value instanceof BABYLON.Vector3) {
          this.bone._linkedTransformNode.rotation = value;
        }
      } else {
        // Apply directly to bone
        if (value instanceof BABYLON.Quaternion) {
          this.bone.setRotationQuaternion(value);
        } else if (value instanceof BABYLON.Vector3) {
          this.bone.rotation = value;
        }
      }

      // Apply same rotation to this control mesh
      if (value instanceof BABYLON.Quaternion) {
        this.rotationQuaternion = value.clone();
      } else if (value instanceof BABYLON.Vector3) {
        this.rotation = value.clone();
      }
    }
  }

  /**
   * Get the bone associated with this control
   */
  getBone(): BABYLON.Bone {
    return this.bone;
  }
} 
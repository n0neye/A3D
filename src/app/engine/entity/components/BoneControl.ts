import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import { SelectableConfig, SelectableCursorType } from '../interfaces/ISelectable';
import { CharacterEntity } from '../types/CharacterEntity';
import { TransformMode } from '../../managers/TransformControlManager';
import { Selectable } from '../interfaces/ISelectable';

/**
 * A mesh that represents a bone for manipulation
 */
export class BoneControl extends Selectable(THREE.Mesh) {
  public entityId: string;
  public character: CharacterEntity;
  public bone: THREE.Bone;

  // ISelectable implementation - bones only support rotation
  selectableConfig: SelectableConfig = {
    defaultTransformMode: TransformMode.Rotation,
    defaultTransformSpace: 'local',
    allowedTransformModes: [TransformMode.Rotation],
    controlSize: 0.5
  };

  // Use rotate cursor to indicate rotation capability
  cursorType: SelectableCursorType = 'rotate';

  constructor(
    name: string,
    scene: THREE.Scene,
    bone: THREE.Bone,
    character: CharacterEntity,
    options: {
      entityId?: string;
      diameter?: number;
    } = {}
  ) {
    // Create sphere geometry for the bone control
    const geometry = new THREE.SphereGeometry(options.diameter || 0.025, 16, 16);
    const material = CharacterEntity.DefaultBoneMaterial;
    
    // Call THREE.Mesh constructor
    super(geometry, material);
    
    // Set properties
    this.name = `${bone.name}`;
    this.entityId = options.entityId || uuidv4();
    this.character = character;
    this.bone = bone;

    // Make boneControl and the bone siblings to share the local space
    this.bone.parent?.add(this);

    // Set a high renderOrder to ensure it renders on top of other meshes
    this.renderOrder = 1000;
  }

  // ISelectable implementation
  onSelect(): void {
    super.onSelect();
    console.log(`BoneControl.onSelect: Bone selected: ${this.bone.name}`);
    this.rotation.copy(this.bone.rotation);

    // Set material to selected material
    this.material = CharacterEntity.HighlightBoneMaterial;
  }

  onDeselect(): void {
    super.onDeselect();
    this.material = CharacterEntity.DefaultBoneMaterial;
  }

  // Clean up resources
  public dispose(): void {
    
    // Dispose geometry and material
    if (this.geometry) {
      this.geometry.dispose();
    }
    
    if (this.material) {
      if (Array.isArray(this.material)) {
        this.material.forEach(m => m.dispose());
      } else {
        this.material.dispose();
      }
    }
    
    // Remove from parent
    this.parent?.remove(this);
  }

  /**
   * Get the bone associated with this control
   */
  getBone(): THREE.Bone {
    return this.bone;
  }
  
  delete(): void {
    this.visible = false;
  }

  undoDelete(): void {
    this.visible = true;
  }

  onTransformStart(): void {
    // sync the bone's rotation with the control mesh
    console.log(`BoneControl.onTransformStart: Syncing bone ${this.bone.name} rotation with control mesh`);
    if (this.quaternion) {
      this.bone.quaternion.copy(this.quaternion);
    }
  } 

  onTransformUpdate(): void {
    // sync the bone's rotation with the control mesh
    console.log(`BoneControl.onTransformUpdate: Syncing bone ${this.bone.name} rotation with control mesh`);
    if (this.quaternion) {
        this.bone.quaternion.copy(this.quaternion);
        // Critical: Update the matrix after changing quaternion
        this.bone.updateMatrix();
    }
  }
} 
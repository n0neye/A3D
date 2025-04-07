import * as THREE from 'three';
import { v4 as uuidv4 } from 'uuid';
import { ISelectable, SelectableConfig, SelectableCursorType } from '../../interfaces/ISelectable';
import { CharacterEntity } from './CharacterEntity';
import { BoneRotationCommand } from '../../lib/commands';
import { EditorEngine } from '../EditorEngine';
import { TransformMode } from '../managers/TransformControlManager';
import { Selectable } from '../../interfaces/ISelectable';

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


  // Command tracking for rotation
  private _currentRotationCommand: BoneRotationCommand | null = null;
  private _isDragging = false;
  private _initialRotation: THREE.Vector3 | THREE.Quaternion | null = null;

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
    this.name = `boneControl_${bone.name}`;
    this.entityId = options.entityId || uuidv4();
    this.character = character;
    this.bone = bone;

    // Make boneControl and the bone siblings to share the local space
    this.bone.parent?.add(this);

    // Set metadata for identification
    this.userData = {
      isBoneControl: true,
      boneName: bone.name
    };

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

    // Set up gizmo rotation observers
    const transformControlManager = EditorEngine.getInstance().getTransformControlManager();
    
    // TODO: Update with Three.js gizmo implementation
    // Placeholder for now - we'll add the actual Three.js gizmo integration later
    // This will need to be implemented based on your Three.js gizmo system
  }

  onDeselect(): void {
    super.onDeselect();
    console.log(`BoneControl.onDeselect: Bone deselected: ${this.bone.name}`);

    this.material = CharacterEntity.DefaultBoneMaterial;

    // Reset material to default visualization
    // if (this.character._defaultBoneMaterial) {
    //   this.material = this.character._defaultBoneMaterial;
    // }
  }

  // Helper to get the history manager
  private _getHistoryManager() {
    return EditorEngine.getInstance().getHistoryManager();
  }

  // Handle the start of gizmo rotation
  private _handleGizmoRotationStart(): void {
    console.log(`BoneControl: Started rotating bone ${this.bone.name}`);
    this._isDragging = true;

    // Store initial rotation for the command
    this._initialRotation = this.bone.quaternion.clone();

    // Create a new command
    this._currentRotationCommand = new BoneRotationCommand(this.bone, this);
  }

  // Handle ongoing gizmo rotation
  private _handleGizmoRotation(): void {
    if (!this._isDragging) return;

    // Sync the bone's rotation with the control mesh
    if (this.quaternion) {
      this.bone.quaternion.copy(this.quaternion);
    }

    // Update character's bone visualization
    this.character.updateBoneVisualization();
  }

  // Handle the end of gizmo rotation
  private _handleGizmoRotationEnd(): void {
    if (!this._isDragging || !this._currentRotationCommand) return;
    this._isDragging = false;

    // Get final rotation
    const finalRotation = this.bone.quaternion.clone();

    // Update and execute command
    if (finalRotation && this._currentRotationCommand) {
      this._currentRotationCommand.updateFinalState();

      // Add to history if there was an actual change
      const historyManager = this._getHistoryManager();
      if (historyManager) {
        historyManager.executeCommand(this._currentRotationCommand);
      }
    }

    this._currentRotationCommand = null;
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

  getGizmoTarget(): THREE.Object3D {
    return this;
  }

  getUUId(): string {
    return this.entityId;
  }

  getName(): string {
    return this.bone.name;
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
    }
  }
} 
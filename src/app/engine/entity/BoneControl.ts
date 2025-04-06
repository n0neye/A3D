import * as BABYLON from '@babylonjs/core';
import { v4 as uuidv4 } from 'uuid';
import { ISelectable, GizmoCapabilities, SelectableCursorType } from '../../interfaces/ISelectable';
import { CharacterEntity } from './CharacterEntity';
import { BoneRotationCommand } from '../../lib/commands';
import { EditorEngine } from '../EditorEngine';
import { GizmoMode } from '../managers/GizmoModeManager';

/**
 * A mesh that represents a bone for manipulation
 */
export class BoneControl extends BABYLON.Mesh implements ISelectable {
  public id: string;
  public character: CharacterEntity;
  public bone: BABYLON.Bone;


  // ISelectable implementation - bones only support rotation
  gizmoCapabilities: GizmoCapabilities = {
    defaultGizmoMode: GizmoMode.Rotation,
    allowedGizmoModes: [GizmoMode.Rotation],
    gizmoVisualSize: 0.5
  };

  // Use rotate cursor to indicate rotation capability
  cursorType: SelectableCursorType = 'rotate';

  public actionManager: BABYLON.ActionManager;

  // Gizmo observers
  private _gizmoStartDragObserver: BABYLON.Observer<any> | null = null;
  private _gizmoRotationObserver: BABYLON.Observer<any> | null = null;
  private _gizmoEndDragObserver: BABYLON.Observer<any> | null = null;

  // Command tracking for rotation
  private _currentRotationCommand: BoneRotationCommand | null = null;
  private _isDragging = false;
  private _initialRotation: BABYLON.Vector3 | BABYLON.Quaternion | null = null;

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
    this.rotation = this.bone.rotation;

    // Set up gizmo rotation observers
    // TODO: Prevent direct access to gizmo manager
    const gizmoModeManager = EditorEngine.getInstance().getGizmoModeManager();
    const _gizmoManager = gizmoModeManager.getGizmoManager();
    if (_gizmoManager && _gizmoManager.gizmos.rotationGizmo) {

      _gizmoManager.gizmos.rotationGizmo.scaleRatio = 0.5;

      // Add observer for start of rotation (when drag begins)
      this._gizmoStartDragObserver = _gizmoManager.gizmos.rotationGizmo.onDragStartObservable.add(
        () => this._handleGizmoRotationStart()
      );

      // Add observer for rotation updates (during drag)
      this._gizmoRotationObserver = _gizmoManager.gizmos.rotationGizmo.onDragObservable.add(
        () => this._handleGizmoRotation()
      );

      // Add observer for end of rotation (when drag ends)
      this._gizmoEndDragObserver = _gizmoManager.gizmos.rotationGizmo.onDragEndObservable.add(
        () => this._handleGizmoRotationEnd()
      );
    }

    // Highlight this bone
    this.material = this.character._highlightMaterial;
  }

  onDeselect(): void {
    console.log(`BoneControl.onDeselect: Bone deselected: ${this.bone.name}`);

    // Remove gizmo observers
    this._removeGizmoObservers();

    // Remove highlight
    this.material = this.character._visualizationMaterial;
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
    if (this.bone._linkedTransformNode) {
      if (this.bone._linkedTransformNode.rotationQuaternion) {
        this._initialRotation = this.bone._linkedTransformNode.rotationQuaternion.clone();
      } else {
        this._initialRotation = this.bone._linkedTransformNode.rotation.clone();
      }
    } else {
      this._initialRotation = this.bone.getRotationQuaternion()?.clone() ||
        this.bone.rotation?.clone();
    }

    // Create a new command
    this._currentRotationCommand = new BoneRotationCommand(this.bone, this);
  }

  // Handle ongoing gizmo rotation
  private _handleGizmoRotation(): void {
    if (!this._isDragging) return;

    // Sync the bone's rotation with the control mesh
    if (this.rotationQuaternion) {
      if (this.bone._linkedTransformNode) {
        this.bone._linkedTransformNode.rotationQuaternion = this.rotationQuaternion.clone();
      } else {
        this.bone.setRotationQuaternion(this.rotationQuaternion.clone());
      }
    } else {
      if (this.bone._linkedTransformNode) {
        this.bone._linkedTransformNode.rotation = this.rotation.clone();
      } else {
        this.bone.rotation = this.rotation.clone();
      }
    }

    // Update character's bone visualization
    this.character.updateBoneVisualization();
  }

  // Handle the end of gizmo rotation
  private _handleGizmoRotationEnd(): void {
    if (!this._isDragging || !this._currentRotationCommand) return;
    this._isDragging = false;

    // Get final rotation
    let finalRotation: BABYLON.Vector3 | BABYLON.Quaternion | null = null;

    if (this.bone._linkedTransformNode) {
      if (this.bone._linkedTransformNode.rotationQuaternion) {
        finalRotation = this.bone._linkedTransformNode.rotationQuaternion.clone();
      } else {
        finalRotation = this.bone._linkedTransformNode.rotation.clone();
      }
    } else {
      finalRotation = this.bone.getRotationQuaternion()?.clone() ||
        this.bone.rotation?.clone();
    }

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

  // Remove all gizmo observers
  private _removeGizmoObservers(): void {
    const gizmoManager = EditorEngine.getInstance().getGizmoModeManager().getGizmoManager();
    if (!gizmoManager || !gizmoManager.gizmos.rotationGizmo) return;

    if (this._gizmoStartDragObserver) {
      gizmoManager.gizmos.rotationGizmo.onDragStartObservable.remove(this._gizmoStartDragObserver);
      this._gizmoStartDragObserver = null;
    }

    if (this._gizmoRotationObserver) {
      gizmoManager.gizmos.rotationGizmo.onDragObservable.remove(this._gizmoRotationObserver);
      this._gizmoRotationObserver = null;
    }

    if (this._gizmoEndDragObserver) {
      gizmoManager.gizmos.rotationGizmo.onDragEndObservable.remove(this._gizmoEndDragObserver);
      this._gizmoEndDragObserver = null;
    }
  }

  // Clean up resources
  public dispose(): void {
    this._removeGizmoObservers();
    super.dispose();
  }

  getGizmoTarget(): BABYLON.AbstractMesh {
    return this;
  }

  getUUID(): string {
    return this.id;
  }

  getName(): string {
    return this.bone.name;
  }

  /**
   * Get the bone associated with this control
   */
  getBone(): BABYLON.Bone {
    return this.bone;
  }
} 
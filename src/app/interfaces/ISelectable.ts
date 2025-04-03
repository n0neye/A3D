import * as BABYLON from '@babylonjs/core';
import { HistoryManager } from '../util/editor/managers/HistoryManager';

/**
 * Defines transformation capabilities for a selectable object
 */
export interface GizmoCapabilities {
  allowPosition: boolean;
  allowRotation: boolean;
  allowScale: boolean;
  allowBoundingBox: boolean;
}

/**
 * Standard CSS cursor types that can be used for selections
 */
export type SelectableCursorType = 
  'default' | 'pointer' | 'grab' | 'grabbing' | 
  'move' | 'rotate' | 'nesw-resize' | 'nwse-resize' | 'ns-resize' | 'ew-resize';

/**
 * Interface for any object that can be selected in the editor
 */
export interface ISelectable {
  /**
   * Defines what gizmo operations are allowed on this object
   */
  readonly gizmoCapabilities: GizmoCapabilities;
  
  /**
   * The cursor type to display when hovering over this object
   */
  readonly cursorType: SelectableCursorType;
  
  /**
   * Called when the object is selected
   */
  onSelect(): void;
  
  /**
   * Called when the object is deselected
   */
  onDeselect(): void;
  
  /**
   * Get the mesh or node to attach gizmos to
   */
  getGizmoTarget(): BABYLON.AbstractMesh | BABYLON.TransformNode;
  
  /**
   * Get the unique identifier for this selectable object
   */
  getId(): string;

  getName(): string;
  
  /**
   * Apply a transformation of the specified type
   */
  applyTransformation(
    transformType: 'position' | 'rotation' | 'scale', 
    value: BABYLON.Vector3 | BABYLON.Quaternion
  ): void;
} 
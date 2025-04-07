import * as THREE from 'three';
import { HistoryManager } from '../engine/managers/HistoryManager';
import { TransformMode } from '../engine/managers/TransformControlManager';

/**
 * Defines transformation capabilities for a selectable object
 */
export interface SelectableConfig {
  defaultTransformMode?: TransformMode;
  defaultTransformSpace?: 'world' | 'local';
  allowedTransformModes: TransformMode[];
  controlSize: number;
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
  
  // Defines what gizmo operations are allowed on this object
  readonly selectableConfig: SelectableConfig;
  
  // Cursor type
  readonly cursorType: SelectableCursorType;
  
  // Selectable callbacks
  onSelect(): void;
  onDeselect(): void;
  
  // Get the threejs object to attach gizmos to
  getGizmoTarget(): THREE.Object3D;
  
  // Get the unique identifier for this selectable object
  getUUId(): string;

  // Get the name of this selectable object
  getName(): string;

  // Optional transform callbacks
  onTransformStart?(): void;
  onTransformUpdate?(): void;
  onTransformEnd?(): void;
} 

// Is ISelectable
export function isISelectable(obj: any): obj is ISelectable {
  return obj && obj.selectableConfig !== undefined;
}




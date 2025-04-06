import * as THREE from 'three';
import { HistoryManager } from '../engine/managers/HistoryManager';
import { GizmoMode } from '../engine/managers/GizmoModeManager';

/**
 * Defines transformation capabilities for a selectable object
 */
export interface GizmoCapabilities {
  defaultGizmoMode?: GizmoMode;
  allowedGizmoModes: GizmoMode[];
  gizmoVisualSize: number;
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
   * Get the object to attach gizmos to
   */
  getGizmoTarget(): THREE.Object3D;
  
  /**
   * Get the unique identifier for this selectable object
   */
  getId(): string;

  getName(): string;
} 
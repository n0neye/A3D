import * as THREE from 'three';
import { HistoryManager } from '@/app/engine/managers/HistoryManager';
import { TransformMode } from '@/app/engine/managers/TransformControlManager';

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
 * Type for the constructor of a class
 */
export type Constructor<T = {}> = new (...args: any[]) => T;

/**
 * Selectable mixin that can be applied to any class
 * This creates a new class that extends the base class with ISelectable functionality
 */
export function Selectable<TBase extends Constructor<THREE.Object3D>>(Base: TBase) {
  return class SelectableClass extends Base {
    // Properties required for being selectable
    selectableConfig: SelectableConfig = {
      defaultTransformMode: TransformMode.Position,
      defaultTransformSpace: 'world',
      allowedTransformModes: [TransformMode.Position, TransformMode.Rotation, TransformMode.Scale],
      controlSize: 1.0
    };

    cursorType: SelectableCursorType = 'pointer';

    // Using a property to track if we've been selected
    private _isSelected: boolean = false;

    constructor(...args: any[]) {
      super(...args);

      // Add the selectable flag to userData for easy checking
      this.userData = {
        ...this.userData,
        isSelectable: true
      };
    }

    /**
     * Called when this object is selected
     */
    onSelect(): void {
      this._isSelected = true;
      console.log(`SelectableClass: Selected ${this.name}`);
    }

    /**
     * Called when this object is deselected
     */
    onDeselect(): void {
      this._isSelected = false;
      console.log(`SelectableClass: Deselected ${this.name}`);
    }

    /**
     * Get the Object3D to attach gizmos to
     */
    getGizmoTarget(): THREE.Object3D | null {
      return this;
    }

    setGizmoVisible(visible: boolean): void {
      console.log(`EntityBase.setGizmoVisible: Setting gizmo visibility to ${visible} for entity: ${this.name}`);
      const gizmo = this.getGizmoTarget();
      if (gizmo) {
        gizmo.visible = visible;
      }
    }

    /**
     * Get a unique identifier for this object
     */
    getUUId(): string {
      return this.uuid;
    }

    /**
     * Get the name of this object
     */
    getName(): string {
      return this.name;
    }

    /**
     * Optional transform callbacks with default empty implementations
     */
    onTransformStart(): void { }
    onTransformUpdate(): void { }
    onTransformEnd(): void { }

    /**
     * Check if this object is currently selected
     */
    isSelected(): boolean {
      return this._isSelected;
    }
  };
}

/**
 * Interface that describes what a selectable object should implement
 * This is kept for type checking and documentation purposes
 */
export interface ISelectable {
  // Properties
  readonly selectableConfig: SelectableConfig;
  readonly cursorType: SelectableCursorType;

  // Selection methods
  onSelect(): void;
  onDeselect(): void;

  // Utility methods
  getGizmoTarget(): THREE.Object3D | null;
  setGizmoVisible(visible: boolean): void;
  getUUId(): string;
  getName(): string;

  // Optional transform callbacks
  onTransformStart?(): void;
  onTransformUpdate?(): void;
  onTransformEnd?(): void;
}

/**
 * Type guard to check if an object implements ISelectable
 * Works with both objects implementing the interface directly
 * and objects created with the Selectable mixin
 */
export function isISelectable(obj: any): obj is ISelectable {
  return obj?.userData?.isSelectable === true;
}




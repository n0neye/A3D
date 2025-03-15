import * as BABYLON from '@babylonjs/core';

// Extend GizmoManager to add metadata
declare module '@babylonjs/core/Gizmos/gizmoManager' {
  export interface GizmoManager {
    metadata?: {
      selectedEntity?: BABYLON.TransformNode;
      [key: string]: any;
    };
  }
} 
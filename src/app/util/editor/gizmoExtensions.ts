import { EntityBase } from '@/app/util/extensions/EntityBase';
import * as BABYLON from '@babylonjs/core';

// Extend GizmoManager to add metadata
declare module '@babylonjs/core/Gizmos/gizmoManager' {
  export interface GizmoManager {
    metadata?: {
      selectedEntity?: EntityBase;
      [key: string]: any;
    };
  }
}
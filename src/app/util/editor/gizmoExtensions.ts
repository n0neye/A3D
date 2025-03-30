import { EntityNode } from '@/app/util/extensions/entityNode';
import * as BABYLON from '@babylonjs/core';

// Extend GizmoManager to add metadata
declare module '@babylonjs/core/Gizmos/gizmoManager' {
  export interface GizmoManager {
    metadata?: {
      selectedEntity?: EntityNode;
      [key: string]: any;
    };
  }
}
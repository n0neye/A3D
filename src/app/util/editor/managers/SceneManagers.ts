import * as BABYLON from '@babylonjs/core';
import { HistoryManager } from './HistoryManager';

// Define the metadata structure
export interface SceneMetadata {
  gizmoManager?: BABYLON.GizmoManager;
  historyManager?: HistoryManager;
  [key: string]: any; // Allow for other metadata properties
}

/**
 * Initialize scene metadata
 */
export function initSceneMetadata(scene: BABYLON.Scene): void {
  if (!scene.metadata) {
    scene.metadata = {};
  }
}

/**
 * Register GizmoManager with the scene
 */
export function registerGizmoManager(scene: BABYLON.Scene, gizmoManager: BABYLON.GizmoManager): void {
  initSceneMetadata(scene);
  scene.metadata.gizmoManager = gizmoManager;
}

/**
 * Get GizmoManager from the scene
 */
export function getGizmoManager(scene: BABYLON.Scene): BABYLON.GizmoManager | null {
  return scene.metadata?.gizmoManager || null;
}

/**
 * Register HistoryManager with the scene
 */
export function registerHistoryManager(scene: BABYLON.Scene, historyManager: HistoryManager): void {
  initSceneMetadata(scene);
  scene.metadata.historyManager = historyManager;
}

/**
 * Get HistoryManager from the scene
 */
export function getHistoryManager(scene: BABYLON.Scene): HistoryManager | null {
  return scene.metadata?.historyManager || null;
} 
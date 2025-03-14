import * as BABYLON from '@babylonjs/core';
import { EventEmitter } from 'events';
import React from 'react';

// Mode interface that all editor modes must implement
export interface EditorMode {
  id: string;
  name: string;
  
  // Lifecycle methods
  onEnter(scene: BABYLON.Scene, previousModeId: string): void;
  onExit(scene: BABYLON.Scene, nextModeId: string): void;
  
  // Input handlers
  handleSceneClick(pickInfo: BABYLON.PickingInfo, scene: BABYLON.Scene): boolean;
  handleObjectSelected(mesh: BABYLON.AbstractMesh, scene: BABYLON.Scene): void;
  handleKeyDown(event: KeyboardEvent, scene: BABYLON.Scene): boolean;
  
  // Gizmo management
  configureGizmos(gizmoManager: BABYLON.GizmoManager): void;
}

// Main mode manager class
export class EditorModeManager extends EventEmitter {
  private static instance: EditorModeManager;
  private currentMode: EditorMode | null = null;
  private modes: Map<string, EditorMode> = new Map();
  private gizmoManager: BABYLON.GizmoManager | null = null;
  
  // Get singleton instance
  static getInstance(): EditorModeManager {
    if (!EditorModeManager.instance) {
      EditorModeManager.instance = new EditorModeManager();
    }
    return EditorModeManager.instance;
  }
  
  private constructor() {
    super();
    // Set max listeners to avoid memory leak warnings
    this.setMaxListeners(50);
  }
  
  // Register a mode
  registerMode(mode: EditorMode): void {
    this.modes.set(mode.id, mode);
    console.log(`Registered editor mode: ${mode.name} (${mode.id})`);
  }
  
  // Set active mode
  setMode(modeId: string, scene: BABYLON.Scene | null): void {
    if (!scene) return;
    
    const targetMode = this.modes.get(modeId);
    if (!targetMode) {
      console.error(`Mode ${modeId} not found`);
      return;
    }
    
    // Skip if already in this mode
    if (this.currentMode?.id === modeId) return;
    
    const previousModeId = this.currentMode?.id || '';
    
    // Exit current mode
    if (this.currentMode) {
      console.log(`Exiting mode: ${this.currentMode.name}`);
      this.currentMode.onExit(scene, modeId);
    }
    
    // Enter new mode
    console.log(`Entering mode: ${targetMode.name}`);
    this.currentMode = targetMode;
    targetMode.onEnter(scene, previousModeId);
    
    // Emit change event
    this.emit('modeChanged', modeId, previousModeId);
  }
  
  // Get current mode
  getCurrentMode(): EditorMode | null {
    return this.currentMode;
  }
  
  // Check if in specific mode
  isInMode(modeId: string): boolean {
    return this.currentMode?.id === modeId;
  }
  
  // Handle scene click
  handleSceneClick(pickInfo: BABYLON.PickingInfo, scene: BABYLON.Scene): boolean {
    if (this.currentMode) {
      return this.currentMode.handleSceneClick(pickInfo, scene);
    }
    return false;
  }
  
  // Handle object selection
  handleObjectSelected(mesh: BABYLON.AbstractMesh, scene: BABYLON.Scene): void {
    if (this.currentMode) {
      this.currentMode.handleObjectSelected(mesh, scene);
    }
  }
  
  // Handle key press
  handleKeyDown(event: KeyboardEvent, scene: BABYLON.Scene): boolean {
    if (this.currentMode) {
      return this.currentMode.handleKeyDown(event, scene);
    }
    return false;
  }
  
  // Configure gizmos based on current mode
  configureGizmos(gizmoManager: BABYLON.GizmoManager): void {
    if (this.currentMode) {
      this.currentMode.configureGizmos(gizmoManager);
    }
  }
  
  // Set the gizmo manager reference
  setGizmoManager(gizmoManager: BABYLON.GizmoManager): void {
    this.gizmoManager = gizmoManager;
  }
  
  // Get the gizmo manager
  getGizmoManager(): BABYLON.GizmoManager | null {
    return this.gizmoManager;
  }
}

// React hook for using the editor mode
export function useEditorMode(scene: BABYLON.Scene | null) {
  const [currentModeId, setCurrentModeId] = React.useState<string | null>(
    EditorModeManager.getInstance().getCurrentMode()?.id || null
  );
  
  React.useEffect(() => {
    const modeManager = EditorModeManager.getInstance();
    
    const handleModeChange = (newModeId: string) => {
      setCurrentModeId(newModeId);
    };
    
    modeManager.on('modeChanged', handleModeChange);
    
    return () => {
      modeManager.off('modeChanged', handleModeChange);
    };
  }, []);
  
  const setMode = React.useCallback((modeId: string) => {
    EditorModeManager.getInstance().setMode(modeId, scene);
  }, [scene]);
  
  const isInMode = React.useCallback((modeId: string): boolean => {
    return EditorModeManager.getInstance().isInMode(modeId);
  }, []);
  
  return { currentModeId, setMode, isInMode };
} 
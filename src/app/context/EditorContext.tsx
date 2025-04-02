import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { EntityBase } from '../util/entity/EntityBase';
import { isGenerativeEntity, isLightEntity, isShapeEntity, isCharacterEntity } from '../util/entity/entityUtils';
import { HistoryManager } from '../components/HistoryManager';
import { UpdateGizmoVisibility } from '../util/editor/editor-util';

interface EditorContextType {
  scene: BABYLON.Scene | null;
  setScene: (scene: BABYLON.Scene | null) => void;
  engine: BABYLON.Engine | null;
  setEngine: (engine: BABYLON.Engine | null) => void;
  selectedEntity: EntityBase | null;
  setSelectedEntity: (entity: EntityBase | null) => void;
  getCurrentSelectedEntity: () => EntityBase | null;
  gizmoManager: BABYLON.GizmoManager | null;
  setGizmoManager: (gizmoManager: BABYLON.GizmoManager | null) => void;
  isDebugMode: boolean;
  setIsDebugMode: (isDebugMode: boolean) => void;
  currentGizmoMode: GizmoMode;
  setGizmoMode: (mode: GizmoMode) => void;
  historyManager: HistoryManager;
  isGizmoVisible: boolean;
  setGizmoVisible: (isVisible: boolean) => void;
}
type GizmoMode = 'position' | 'rotation' | 'scale' | 'boundingBox';
const EditorContext = createContext<EditorContextType | null>(null);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [scene, setScene] = useState<BABYLON.Scene | null>(null);
  const [engine, setEngine] = useState<BABYLON.Engine | null>(null);
  const [selectedEntityState, setSelectedEntityState] = useState<EntityBase | null>(null);
  const [gizmoManager, setGizmoManager] = useState<BABYLON.GizmoManager | null>(null);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [currentGizmoMode, setCurrentGizmoMode] = useState<GizmoMode>('position');
  const [historyManager] = useState(new HistoryManager());
  const [isGizmoVisible, setIsGizmoVisible] = useState<boolean>(true);

  // Use a ref to always track current selected entity
  const selectedEntityRef = useRef<EntityBase | null>(null);

  // Keep the ref in sync with the state
  useEffect(() => {
    selectedEntityRef.current = selectedEntityState;
  }, [selectedEntityState]);

  // Function to get current entity from the ref
  const getCurrentSelectedEntity = () => selectedEntityRef.current;

  // Function to set gizmo mode
  const setGizmoMode = (mode: GizmoMode) => {
    if (!gizmoManager) return;

    // Reset all gizmos first
    gizmoManager.positionGizmoEnabled = false;
    gizmoManager.rotationGizmoEnabled = false;
    gizmoManager.scaleGizmoEnabled = false;
    gizmoManager.boundingBoxGizmoEnabled = false;

    // Enable the selected gizmo
    switch (mode) {
      case 'position':
        gizmoManager.positionGizmoEnabled = true;
        break;
      case 'rotation':
        gizmoManager.rotationGizmoEnabled = true;
        break;
      case 'scale':
        gizmoManager.scaleGizmoEnabled = true;
        break;
      case 'boundingBox':
        gizmoManager.boundingBoxGizmoEnabled = true;
        break;
      // 'none' doesn't enable any gizmo
    }

    setCurrentGizmoMode(mode);
  };

  // Add keyboard shortcuts for gizmo control
  useEffect(() => {
    if (!gizmoManager) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts if an input element is focused
      if (document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'w':
          setGizmoMode('position');
          break;
        case 'e':
          setGizmoMode('scale');
          break;
        case 'r':
          setGizmoMode('rotation');
          break;
        case 't':
          setGizmoMode('boundingBox');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gizmoManager]); // Only re-add listener when gizmoManager changes

  // Handle entity selection with gizmos
  useEffect(() => {
    if (!gizmoManager || !scene) return;

    // Clean up previous selection
    if (selectedEntityRef.current) {
      // No longer need to handle bounding box here since our entities manage their own meshes
    }

    if (selectedEntityState) {
      setGizmoMode(currentGizmoMode);
      console.log("EditorContext: selectedEntity", selectedEntityState.id);
      
      // Handle gizmo attachment based on entity type
      if (isGenerativeEntity(selectedEntityState)) {
        // For generative entities, attach to the entity itself or a specific mesh
        const primaryMesh = selectedEntityState.getPrimaryMesh();
        if (primaryMesh && (currentGizmoMode === 'boundingBox' || currentGizmoMode === 'scale')) {
          gizmoManager.attachToMesh(primaryMesh);
        } else {
          gizmoManager.attachToNode(selectedEntityState);
        }
      } 
      else if (isShapeEntity(selectedEntityState)) {
        // For shape entities
        gizmoManager.attachToNode(selectedEntityState);
      }
      else if (isLightEntity(selectedEntityState)) {
        // For light entities, only allow position control
        console.log("EditorContext: light", selectedEntityState);
        setGizmoMode("position");
        gizmoManager.attachToNode(selectedEntityState);
      }
      else {
        // Default case
        gizmoManager.attachToNode(selectedEntityState);
      }
    } else {
      gizmoManager.attachToMesh(null);
    }

    // Force a render
    scene.render();

    return () => {
      if (gizmoManager) {
        gizmoManager.attachToMesh(null);
      }
    };
  }, [selectedEntityState, gizmoManager, scene, isDebugMode, currentGizmoMode]);

  // Add keyboard shortcut for toggling gizmo visibility
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keyboard shortcuts if an input element is focused
      if (document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement) {
        return;
      }

      // Toggle gizmo visibility with 'x' key
      if (e.key.toLowerCase() === 'x') {
        setIsGizmoVisible(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Apply the visibility change
    if (scene) {
      UpdateGizmoVisibility(isGizmoVisible, scene);
    }

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isGizmoVisible, scene]);

  const setSelectedEntity = (entity: EntityBase | null) => {
    // If there's a currently selected entity, notify it about deselection
    if (selectedEntityState && isCharacterEntity(selectedEntityState)) {
      selectedEntityState.onDeselect();
    }
    
    // Update the selected entity
    setSelectedEntityState(entity);
    
    // Notify the newly selected entity
    if (entity && isCharacterEntity(entity)) {
      // Pass the gizmo manager to the character entity
      if (gizmoManager) {
        entity.setGizmoManager(gizmoManager);
      }
      // Pass the history manager to the character entity
      entity.setHistoryManager(historyManager);
      entity.onSelect();
    }
  };

  return (
    <EditorContext.Provider
      value={{
        scene,
        setScene,
        engine,
        setEngine,
        selectedEntity: selectedEntityState,
        setSelectedEntity,
        getCurrentSelectedEntity,
        gizmoManager,
        setGizmoManager,
        isDebugMode,
        setIsDebugMode,
        currentGizmoMode,
        setGizmoMode,
        historyManager,
        isGizmoVisible,
        setGizmoVisible: setIsGizmoVisible,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
}

export function useEditorContext() {
  const context = useContext(EditorContext);
  if (context === null) {
    throw new Error('useEditorContext must be used within an EditorProvider');
  }
  return context;
} 
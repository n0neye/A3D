import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { EntityBase } from '../util/extensions/EntityBase';
import { isGenerativeEntity, isLightEntity, isShapeEntity } from '../util/extensions/entityUtils';
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
  const [selectedEntity, setSelectedEntity] = useState<EntityBase | null>(null);
  const [gizmoManager, setGizmoManager] = useState<BABYLON.GizmoManager | null>(null);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [currentGizmoMode, setCurrentGizmoMode] = useState<GizmoMode>('position');
  const [historyManager] = useState(new HistoryManager());
  const [isGizmoVisible, setIsGizmoVisible] = useState<boolean>(true);

  // Use a ref to always track current selected entity
  const selectedEntityRef = useRef<EntityBase | null>(null);

  // Keep the ref in sync with the state
  useEffect(() => {
    selectedEntityRef.current = selectedEntity;
  }, [selectedEntity]);

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

    if (selectedEntity) {
      console.log("EditorContext: selectedEntity", selectedEntity.id);
      
      // Handle gizmo attachment based on entity type
      if (isGenerativeEntity(selectedEntity)) {
        // For generative entities, attach to the entity itself or a specific mesh
        if (selectedEntity.placeholderMesh && (currentGizmoMode === 'boundingBox' || currentGizmoMode === 'scale')) {
          gizmoManager.attachToMesh(selectedEntity.placeholderMesh);
        } else {
          gizmoManager.attachToNode(selectedEntity);
        }
      } 
      else if (isShapeEntity(selectedEntity)) {
        // For shape entities
        setGizmoMode(currentGizmoMode);
        gizmoManager.attachToNode(selectedEntity);
      }
      else if (isLightEntity(selectedEntity)) {
        // For light entities, only allow position control
        console.log("EditorContext: light", selectedEntity);
        setGizmoMode("position");
        gizmoManager.attachToNode(selectedEntity);
      }
      else {
        // Default case
        gizmoManager.attachToNode(selectedEntity);
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
  }, [selectedEntity, gizmoManager, scene, isDebugMode, currentGizmoMode]);

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

  return (
    <EditorContext.Provider
      value={{
        scene,
        setScene,
        engine,
        setEngine,
        selectedEntity,
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
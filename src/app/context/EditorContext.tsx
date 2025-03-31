import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { EntityNode } from '../util/extensions/entityNode';
import { HistoryManager } from '../components/HistoryManager';

interface EditorContextType {
  scene: BABYLON.Scene | null;
  setScene: (scene: BABYLON.Scene | null) => void;
  engine: BABYLON.Engine | null;
  setEngine: (engine: BABYLON.Engine | null) => void;
  selectedEntity: EntityNode | null;
  setSelectedEntity: (entity: EntityNode | null) => void;
  getCurrentSelectedEntity: () => EntityNode | null;
  gizmoManager: BABYLON.GizmoManager | null;
  setGizmoManager: (gizmoManager: BABYLON.GizmoManager | null) => void;
  isDebugMode: boolean;
  setIsDebugMode: (isDebugMode: boolean) => void;
  currentGizmoMode: GizmoMode;
  setGizmoMode: (mode: GizmoMode) => void;
  historyManager: HistoryManager;
}
type GizmoMode = 'position' | 'rotation' | 'scale' | 'boundingBox';
const EditorContext = createContext<EditorContextType | null>(null);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [scene, setScene] = useState<BABYLON.Scene | null>(null);
  const [engine, setEngine] = useState<BABYLON.Engine | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<EntityNode | null>(null);
  const [gizmoManager, setGizmoManager] = useState<BABYLON.GizmoManager | null>(null);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [currentGizmoMode, setCurrentGizmoMode] = useState<GizmoMode>('position');
  const [historyManager] = useState(new HistoryManager());

  // Use a ref to always track current selected entity
  const selectedEntityRef = useRef<EntityNode | null>(null);

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
      const prevMesh = selectedEntityRef.current.getPrimaryMesh();
      if (prevMesh) {
        prevMesh.showBoundingBox = false;
      }
    }

    if (selectedEntity) {
      console.log("EditorContext: selectedEntity", selectedEntity.name, selectedEntity, selectedEntity.getPrimaryMesh());
      // Get the primary mesh for this entity

      switch (selectedEntity.getEntityType()) {
        case 'aiObject':
          const aiObjectType = selectedEntity.metadata.aiData?.aiObjectType!;
          switch (aiObjectType) {
            case 'background':
              // gizmoManager.attachToNode(selectedEntity);
              break;
            case 'generativeObject':
              const primaryMesh = selectedEntity.getPrimaryMesh();
              if (primaryMesh) {
                setGizmoMode(currentGizmoMode);
                // TODO: Temp hack. Entity scale must stay uniform.
                if (currentGizmoMode === 'boundingBox' || currentGizmoMode === "scale") {
                  gizmoManager.attachToMesh(primaryMesh);
                } else {
                  gizmoManager.attachToNode(selectedEntity);
                }
              }
              break;
            case 'shape':
              const shapeMesh = selectedEntity.getPrimaryMesh();
              if (shapeMesh) {
                // TODO: Temp hack. Entity scale must stay uniform.
                if (currentGizmoMode === 'boundingBox' || currentGizmoMode === "scale") {
                  gizmoManager.attachToMesh(shapeMesh);
                } else {
                  gizmoManager.attachToNode(selectedEntity);
                }
              }
              break;
          }
          break;
        case 'light':
          console.log("EditorContext: light", selectedEntity);
          gizmoManager.attachToNode(selectedEntity);
          break;
        default:
          gizmoManager.attachToNode(selectedEntity);
          break;
      }


      // Store reference to entity on gizmo
      gizmoManager.metadata = {
        ...gizmoManager.metadata || {},
        selectedEntity
      };
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
        historyManager
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
import React, { createContext, useState, useContext, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { EntityNode } from '../types/entity';

interface EditorContextType {
  scene: BABYLON.Scene | null;
  setScene: (scene: BABYLON.Scene | null) => void;
  engine: BABYLON.Engine | null;
  setEngine: (engine: BABYLON.Engine | null) => void;
  selectedEntity: EntityNode | null;
  setSelectedEntity: (entity: EntityNode | null) => void;
  gizmoManager: BABYLON.GizmoManager | null;
  setGizmoManager: (gizmoManager: BABYLON.GizmoManager | null) => void;
}

const EditorContext = createContext<EditorContextType | null>(null);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [scene, setScene] = useState<BABYLON.Scene | null>(null);
  const [engine, setEngine] = useState<BABYLON.Engine | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<EntityNode | null>(null);
  const [gizmoManager, setGizmoManager] = useState<BABYLON.GizmoManager | null>(null);

  // Handle entity selection with gizmos
  useEffect(() => {
    if (!gizmoManager) return;

    if (selectedEntity) {

      // Attach gizmo to selected entity
      if (selectedEntity.primaryMesh) {
        gizmoManager.positionGizmoEnabled = true;
        gizmoManager.rotationGizmoEnabled = true;
        gizmoManager.scaleGizmoEnabled = true;
        gizmoManager.attachToMesh(selectedEntity.primaryMesh);

        // Store reference to entity on gizmo
        gizmoManager.metadata = {
          ...gizmoManager.metadata || {},
          selectedEntity
        };
      }
    } else {
      gizmoManager.attachToMesh(null);
    }

    return () => {
      // Clean up when selection changes
      if (gizmoManager) {
        gizmoManager.attachToMesh(null);
      }
    };
  }, [selectedEntity, gizmoManager]);

  return (
    <EditorContext.Provider
      value={{
        scene,
        setScene,
        engine,
        setEngine,
        selectedEntity,
        setSelectedEntity,
        gizmoManager,
        setGizmoManager
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
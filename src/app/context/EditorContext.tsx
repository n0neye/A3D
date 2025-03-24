import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { EntityNode } from '../util/extensions/entityNode';

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
}

const EditorContext = createContext<EditorContextType | null>(null);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [scene, setScene] = useState<BABYLON.Scene | null>(null);
  const [engine, setEngine] = useState<BABYLON.Engine | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<EntityNode | null>(null);
  const [gizmoManager, setGizmoManager] = useState<BABYLON.GizmoManager | null>(null);
  const [isDebugMode, setIsDebugMode] = useState(false);
  
  // Use a ref to always track current selected entity
  const selectedEntityRef = useRef<EntityNode | null>(null);
  
  // Keep the ref in sync with the state
  useEffect(() => {
    selectedEntityRef.current = selectedEntity;
  }, [selectedEntity]);
  
  // Function to get current entity from the ref
  const getCurrentSelectedEntity = () => selectedEntityRef.current;

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
      console.log("EditorContext: selectedEntity", selectedEntity);
      // Get the primary mesh for this entity
      const primaryMesh = selectedEntity.getPrimaryMesh();
      
      if (primaryMesh) {
        // Setup gizmo
        if(selectedEntity.getEntityType() === 'aiObject' && selectedEntity.metadata.aiData?.aiObjectType !== 'background') {
          gizmoManager.positionGizmoEnabled = true;
          gizmoManager.rotationGizmoEnabled = true;
          gizmoManager.scaleGizmoEnabled = true;
          gizmoManager.attachToMesh(primaryMesh);
          // Store reference to entity on gizmo
          gizmoManager.metadata = {
            ...gizmoManager.metadata || {},
            selectedEntity
          };
        }
        
        // Setup bounding box if needed
        if (isDebugMode) {
          primaryMesh.showBoundingBox = true;
        }
        
        
        // Force a render
        scene.render();
      }
    } else {
      gizmoManager.attachToMesh(null);
    }

    return () => {
      if (gizmoManager) {
        gizmoManager.attachToMesh(null);
      }
    };
  }, [selectedEntity, gizmoManager, scene, isDebugMode]);

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
        setIsDebugMode
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
/**
 * EditorEngineContext.tsx
 * 
 * React context that bridges the React component world with the
 * Babylon.js EditorEngine. This context:
 * - Provides access to the EditorEngine singleton
 * - Converts engine events into React state updates
 * - Makes engine state (like selection) available to all components
 * - Handles cleanup of event listeners
 * 
 * This is the only file that should directly interact with both
 * React hooks/state AND the EditorEngine - it acts as the boundary
 * between the two systems.
 */
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { EditorEngine } from '../engine/EditorEngine';
import { EntityBase } from '../util/entity/EntityBase';
import AddPanel from '../components/AddPanel';
import EntityPanel from '../components/EntityPanels/EntityPanel';

type GizmoMode = 'position' | 'rotation' | 'scale' | 'boundingBox';

interface EditorEngineContextType {
  engine: EditorEngine;
  isInitialized: boolean;
  selectedEntity: EntityBase | null;
  gizmoMode: GizmoMode;
}

const EditorEngineContext = createContext<EditorEngineContextType | null>(null);

export function EditorEngineProvider({ children }: { children: React.ReactNode }) {
  const engine = EditorEngine.getInstance();
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<EntityBase | null>(null);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('position');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const engine = EditorEngine.initEngine(canvasRef.current);

      engine.events.on('initialized', () => {
        setIsInitialized(true);
      });

      engine.events.on('entitySelected', (entity) => {
        setSelectedEntity(entity);
      });

      engine.events.on('gizmoModeChanged', (mode) => {
        setGizmoMode(mode);
      });
    }
  }, [canvasRef.current]);


  return (
    <EditorEngineContext.Provider
      value={{
        engine,
        isInitialized,
        selectedEntity,
        gizmoMode,
      }}
    >
      {children}
      <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full"></canvas>
      <AddPanel />
      <EntityPanel />
    </EditorEngineContext.Provider>
  );
}

export function useEditorEngine() {
  const context = useContext(EditorEngineContext);
  if (!context) {
    throw new Error('useEditorEngine must be used within an EditorEngineProvider');
  }
  return context;
} 
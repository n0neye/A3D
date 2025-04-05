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
import { EntityBase } from '@/app/engine/entity/EntityBase';
import { IRenderSettings, IRenderLog } from '../engine/managers/ProjectManager';
import { defaultSettings } from '@/app/engine/utils/ProjectUtil';
import EngineUIContainer from '../components/EngineUIContainer';
type GizmoMode = 'position' | 'rotation' | 'scale' | 'boundingBox';

interface EditorEngineContextType {
  engine: EditorEngine;
  isInitialized: boolean;
  selectedEntity: EntityBase | null;
  gizmoMode: GizmoMode;
  renderSettings: IRenderSettings;
  renderLogs: IRenderLog[];
}

const EditorEngineContext = createContext<EditorEngineContextType | null>(null);

export function EditorEngineProvider({ children }: { children: React.ReactNode }) {
  const engine = EditorEngine.getInstance();
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<EntityBase | null>(null);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('position');
  const [renderSettings, setRenderSettings] = useState<IRenderSettings>(defaultSettings);
  const [renderLogs, setRenderLogs] = useState<IRenderLog[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const engine = EditorEngine.initEngine(canvasRef.current);
      setIsInitialized(true);

      // Subscribe to engine events
      const unsubGizmoMode = engine.getGizmoModeManager().observers.subscribe('gizmoModeChanged', ({ mode }) => setGizmoMode(mode));
      const unsubEntitySelected = engine.getSelectionManager().selectionObserver.subscribe('entitySelected', ({ entity }) => setSelectedEntity(entity));

      // Subscribe to project manager events
      const unsubRenderLogsChanged = engine.getProjectManager().observers.subscribe('renderLogsChanged', ({ renderLogs }) => setRenderLogs(renderLogs));
      const unsubRenderSettingsChanged = engine.getProjectManager().observers.subscribe('renderSettingsChanged', ({ renderSettings }) => setRenderSettings(renderSettings));
      const unsubProjectLoaded = engine.getProjectManager().observers.subscribe('projectLoaded', ({ project }) => setRenderSettings(project));

      // Return cleanup function
      return () => {
        unsubGizmoMode();
        unsubEntitySelected();
        unsubProjectLoaded();
        unsubRenderLogsChanged();
        unsubRenderSettingsChanged();
      };
    }
  }, [canvasRef.current]);

  useEffect(() => {
    if (isInitialized) {
      console.log(`EditorEngineContext: isInitialized:`, isInitialized);
    }
  }, [isInitialized]);

  return (
    <EditorEngineContext.Provider
      value={{
        engine,
        isInitialized,
        selectedEntity,
        gizmoMode,
        renderSettings: renderSettings,
        renderLogs,
      }}
    >
      <canvas ref={canvasRef} className="fixed top-0 left-0 w-full h-full"></canvas>
      {children}
      {isInitialized && <EngineUIContainer />}

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
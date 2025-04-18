/**
 * EditorEngineContext.tsx
 * 
 * React context that bridges the React component world with the
 * Three.js EditorEngine. This context:
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
import { EditorEngine } from '../engine/core/EditorEngine';
import { EntityBase } from '@/app/engine/entity/base/EntityBase';
import { IRenderSettings, IRenderLog } from '../engine/interfaces/rendering';
import { defaultSettings } from '@/app/engine/utils/ProjectUtil';
import EngineUIContainer from '../components/EngineUIContainer';
import { TransformMode } from '@/app/engine/managers/TransformControlManager';
import { Selectable } from '../engine/entity/base/Selectable';
import { UserPreferences } from '../engine/managers/UserPrefManager';

interface EditorEngineContextType {
  engine: EditorEngine;
  isInitialized: boolean;
  selectedEntity: EntityBase | null;
  selectedSelectable: Selectable | null;
  gizmoMode: TransformMode;
  gizmoAllowedModes: TransformMode[];
  renderSettings: IRenderSettings;
  uiLayoutMode: UiLayoutMode;
  setUiLayoutMode: (mode: UiLayoutMode) => void;
  gizmoSpace: 'world' | 'local';
  userPreferences: UserPreferences;
  setUserPreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
}

export enum UiLayoutMode {
  Image = 'image',
  Video = 'video',
}

const EditorEngineContext = createContext<EditorEngineContextType | null>(null);

export function EditorEngineProvider({ children }: { children: React.ReactNode }) {
  const engine = EditorEngine.getInstance();
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<EntityBase | null>(null);
  const [selectedSelectable, setSelectedSelectable] = useState<Selectable | null>(null);
  const [gizmoMode, setGizmoMode] = useState<TransformMode>(TransformMode.Position);
  const [gizmoAllowedModes, setGizmoAllowedModes] = useState<TransformMode[]>([TransformMode.Position, TransformMode.Rotation, TransformMode.Scale, TransformMode.BoundingBox]);
  const [renderSettings, setRenderSettings] = useState<IRenderSettings>(defaultSettings);
  const [renderLogs, setRenderLogs] = useState<IRenderLog[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [uiLayoutMode, setUiLayoutMode] = useState<UiLayoutMode>(UiLayoutMode.Image);
  const [gizmoSpace, setGizmoSpace] = useState<'world' | 'local'>('world');
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    falApiKey: '',
    theme: 'dark'
  });

  useEffect(() => {
    if (canvasRef.current) {
      let unsubAll: (() => void)[] = [];

      const initEngine = async () => {
        if (!canvasRef.current) return;
        const engine = await EditorEngine.initEngine(canvasRef.current);
        setIsInitialized(true);

        // Subscribe to engine events
        const unsubGizmoMode = engine.getTransformControlManager().observers.subscribe('gizmoModeChanged', ({ mode }) => setGizmoMode(mode));
        const unsubGizmoAllowedModes = engine.getTransformControlManager().observers.subscribe('gizmoAllowedModesChanged', ({ modes }) => setGizmoAllowedModes(modes));
        const unsubEntitySelected = engine.getSelectionManager().selectionObserver.subscribe('entitySelected', ({ entity }) => setSelectedEntity(entity));
        const unsubSelectableSelected = engine.getSelectionManager().selectionObserver.subscribe('selectableSelected', ({ selectable }) => setSelectedSelectable(selectable));

        // Subscribe to project manager events
        const unsubRenderSettingsChanged = engine.getProjectManager().observers.subscribe('renderSettingsChanged', ({ renderSettings }) => setRenderSettings(renderSettings));
        const unsubProjectLoaded = engine.getProjectManager().observers.subscribe('projectLoaded', ({ project }) => setRenderSettings(project));

        const unsubGizmoSpace = engine.getTransformControlManager().observers.subscribe(
          'gizmoSpaceChanged',
          ({ space }) => {
            setGizmoSpace(space);
          }
        );

        // Subscribe to user preferences changes
        const unsubPreferences = engine.getUserPrefManager().observer.subscribe(
          'preferencesChanged',
          ({ preferences }) => {
            setUserPreferences(preferences);
          }
        );
        
        // Apply theme from preferences
        const theme = engine.getUserPrefManager().getPreference('theme');
        document.documentElement.classList.toggle('dark', theme === 'dark');

        unsubAll.push(unsubGizmoMode, unsubGizmoAllowedModes, unsubEntitySelected, unsubSelectableSelected, unsubRenderSettingsChanged, unsubProjectLoaded, unsubGizmoSpace, unsubPreferences);
      }

      initEngine();

      // Return cleanup function
      return () => {
        unsubAll.forEach(unsub => unsub());
      };
    }
  }, [canvasRef.current]);

  useEffect(() => {
    if (isInitialized) {
      console.log(`EditorEngineContext: isInitialized:`, isInitialized);
    }
  }, [isInitialized]);

  // Create a function to update a specific preference
  const setUserPreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void => {
    if (engine) {
      engine.getUserPrefManager().setPreference(key, value);
    }
  };

  return (
    <EditorEngineContext.Provider
      value={{
        engine,
        isInitialized,
        selectedEntity,
        selectedSelectable,
        gizmoMode,
        gizmoAllowedModes,
        renderSettings: renderSettings,
        uiLayoutMode,
        setUiLayoutMode,
        gizmoSpace,
        userPreferences,
        setUserPreference,
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
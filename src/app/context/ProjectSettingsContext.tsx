import React, { createContext, useContext, useEffect, useState } from 'react';
import { SerializedProjectSettings } from '../util/editor/project-util';
import { availableAPIs } from '../util/generation/image-render-api';
import { RenderLog } from '../util/editor/project-util';
import { useEditorEngine } from './EditorEngineContext';

// Default settings
const defaultSettings: SerializedProjectSettings = {
  prompt: '',
  promptStrength: 0.9,
  depthStrength: 0.9,
  noiseStrength: 0,
  selectedAPI: availableAPIs[0].id,
  seed: Math.floor(Math.random() * 2147483647),
  useRandomSeed: true,
  selectedLoras: [],
  renderLogs: [],
  openOnRendered: true
};

// Define the context interface
interface ProjectSettingsContextType {
  ProjectSettings: SerializedProjectSettings;
  updateProjectSettings: (settings: Partial<SerializedProjectSettings>) => void;
  addRenderLog: (image: RenderLog) => void;
}

// Create context with default values
const ProjectSettingsContext = createContext<ProjectSettingsContextType>({
  ProjectSettings: defaultSettings,
  updateProjectSettings: () => { },
  addRenderLog: () => { }
});

// Custom hook to use the render settings context
export const useProjectSettings = () => useContext(ProjectSettingsContext);

// Provider component that will wrap the app
export const ProjectSettingsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { engine } = useEditorEngine();
  const [ProjectSettings, setProjectSettings] = useState<SerializedProjectSettings>(defaultSettings);

  useEffect(() => {
    if (!engine) return;
    engine.getProjectManager().observers.subscribe('projectLoaded', ({ project }) => setProjectSettings(project));
  }, [engine]);

  const updateProjectSettings = (newSettings: Partial<SerializedProjectSettings>) => {
    setProjectSettings(prev => ({
      ...prev,
      ...newSettings
    }));
  };

  const addRenderLog = (image: RenderLog) => {
    console.log("ProjectSettingsContext: addRenderLog", ProjectSettings.renderLogs.length, image);
    setProjectSettings(prev => ({
      ...prev,
      renderLogs: [...prev.renderLogs, image]
    }));
  };

  return (
    <ProjectSettingsContext.Provider
      value={{
        ProjectSettings,
        updateProjectSettings,
        addRenderLog
      }}
    >
      {children}
    </ProjectSettingsContext.Provider>
  );
}; 
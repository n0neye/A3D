import React, { createContext, useContext, useEffect, useState } from 'react';
import { defaultSettings, IProjectSettings, IRenderLog } from '@/app/engine/managers/ProjectManager';
import { availableAPIs } from '../util/generation/image-render-api';
import { useEditorEngine } from './EditorEngineContext';


// Define the context interface
interface ProjectSettingsContextType {
  ProjectSettings: IProjectSettings;
  updateProjectSettings: (settings: Partial<IProjectSettings>) => void;
  addRenderLog: (image: IRenderLog) => void;
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
  const [tempProjectSettings, setTempProjectSettings] = useState<IProjectSettings>(defaultSettings);

  useEffect(() => {
    if (!engine) return;
    engine.getProjectManager().observers.subscribe('projectLoaded', ({ project }) => setTempProjectSettings(project));
  }, [engine]);

  const updateProjectSettings = (newSettings: Partial<IProjectSettings>) => {
    console.log("ProjectSettingsContext: updateProjectSettings", newSettings);
    engine.getProjectManager().updateProjectSettings(newSettings);
    setTempProjectSettings(prev => ({
      ...prev,
      ...newSettings
    }));
  };

  const addRenderLog = (image: IRenderLog) => {
    console.log("ProjectSettingsContext: addRenderLog", tempProjectSettings.renderLogs.length, image);
    setTempProjectSettings(prev => ({
      ...prev,
      renderLogs: [...prev.renderLogs, image]
    }));
  };

  return (
    <ProjectSettingsContext.Provider
      value={{
        ProjectSettings: tempProjectSettings,
        updateProjectSettings,
        addRenderLog
      }}
    >
      {children}
    </ProjectSettingsContext.Provider>
  );
}; 
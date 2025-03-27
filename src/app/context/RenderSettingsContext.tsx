import React, { createContext, useContext, useState } from 'react';
import { SerializedRenderSettings } from '../util/editor/project-util';
import { availableAPIs } from '../util/image-render-api';
import { RenderLog } from '../util/editor/project-util';

// Default settings
const defaultSettings: SerializedRenderSettings = {
  prompt: 'flooded office, fire, dark night, a female warrior with a spear',
  promptStrength: 0.9,
  depthStrength: 0.9,
  noiseStrength: 0,
  selectedAPI: availableAPIs[0].id,
  seed: Math.floor(Math.random() * 2147483647),
  useRandomSeed: false,
  selectedLoras: [],
  renderLogs: []
};

// Define the context interface
interface RenderSettingsContextType {
  renderSettings: SerializedRenderSettings;
  updateRenderSettings: (settings: Partial<SerializedRenderSettings>) => void;
  addRenderLog: (image: RenderLog) => void;
}

// Create context with default values
const RenderSettingsContext = createContext<RenderSettingsContextType>({
  renderSettings: defaultSettings,
  updateRenderSettings: () => { },
  addRenderLog: () => { }
});

// Custom hook to use the render settings context
export const useRenderSettings = () => useContext(RenderSettingsContext);

// Provider component that will wrap the app
export const RenderSettingsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [renderSettings, setRenderSettings] = useState<SerializedRenderSettings>(defaultSettings);

  const updateRenderSettings = (newSettings: Partial<SerializedRenderSettings>) => {
    setRenderSettings(prev => ({
      ...prev,
      ...newSettings
    }));
  };

  const addRenderLog = (image: RenderLog) => {
    console.log("RenderSettingsContext: addRenderLog", image);
    setRenderSettings(prev => ({
      ...prev,
      renderLogs: [...prev.renderLogs, image]
    }));
  };

  return (
    <RenderSettingsContext.Provider
      value={{
        renderSettings,
        updateRenderSettings,
        addRenderLog
      }}
    >
      {children}
    </RenderSettingsContext.Provider>
  );
}; 
'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { IconCloud, IconSun } from '@tabler/icons-react';
import { useEditorEngine } from '../context/EditorEngineContext';
import { skyboxFiles, skyboxFolder } from '../engine/managers/environmentManager';
import { ScrollArea } from "@/components/ui/scroll-area";
import MaterialSelector from './MaterialSelector';

const EnvironmentPanel: React.FC = () => {
  const { engine } = useEditorEngine();
  const [activeSkybox, setActiveSkybox] = useState<string | null>(null);

  // Initialize state from environment manager settings
  useEffect(() => {
    if (!engine) return;
    // You could add code to get the current skybox if the environment manager exposed that information
  }, [engine]);

  // Handle skybox selection
  const handleSkyboxChange = (skyboxFile: string) => {
    if (!engine) return;

    const environmentManager = engine.getEnvironmentManager();
    const scene = engine.getScene();

    // Update the skybox
    environmentManager.createSkybox(scene, `${skyboxFolder}${skyboxFile}`);
    setActiveSkybox(skyboxFile);
  };

  return (
    <div className='group relative'>
      <Button
        variant={'outline'}
        size="icon"
        aria-label="environment settings"
        className='relative'
      >
        <IconCloud className="h-4 w-4" />
      </Button>
      <div className="hidden group-hover:block absolute top-8 pt-5 left-1/2 -translate-x-1/2 z-10">
        <div className="panel-shape space-y-2 w-56 py-2">
          <ScrollArea className="h-48">
            <h3 className="text-sm font-medium px-4 py-2">Skybox</h3>
            <div className="grid grid-cols-3 gap-2 px-4 py-2">
              {skyboxFiles.map((skyboxFile, index) => (
                <div
                  key={index}
                  className={`relative cursor-pointer overflow-hidden hover:ring-2 hover:ring-primary transition-all rounded-full h-12 w-12 shadow-lg
                    ${activeSkybox === skyboxFile ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => handleSkyboxChange(skyboxFile)}
                >
                  <img
                    src={`${skyboxFolder}${skyboxFile.replace('.jpg', '_thumb.webp')}`}
                    alt={`Skybox ${index + 1}`}
                    className=""
                  />
                </div>
              ))}
            </div>
            {/* <MaterialSelector /> */}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

export default EnvironmentPanel;

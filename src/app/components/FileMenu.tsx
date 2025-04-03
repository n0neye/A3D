'use client';

import React, { useRef, useEffect } from 'react';
import { useEditorContext } from '../engine/utils/EngineContext';
import { saveProjectToFile, loadProjectFromFile, SerializedProjectSettings } from '../util/editor/project-util';
import { IconDeviceFloppy, IconFolderOpen } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import RenderPanel from './RenderPanel';
import { useProjectSettings } from '../context/ProjectSettingsContext';
import { trackEvent, ANALYTICS_EVENTS } from '../util/analytics';
import { isEntity } from '../util/entity/entityUtils';

export default function FileMenu() {
  const { scene } = useEditorContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { ProjectSettings, updateProjectSettings } = useProjectSettings();

  const handleSaveProject = () => {
    if (scene) {
      const projectName = `proj-${new Date().toISOString().split('T')[0]}.mud`;
      saveProjectToFile(scene, ProjectSettings, projectName);
      
      // Track save event
      trackEvent(ANALYTICS_EVENTS.SAVE_PROJECT, {
        entities_count: scene.rootNodes.filter(node => isEntity(node)).length,
        has_settings: !!ProjectSettings,
      });
    }
  };

  const handleOpenProject = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !scene) return;
    
    try {
      const file = e.target.files[0];
      await loadProjectFromFile(file, scene, (settings: SerializedProjectSettings) => {
        updateProjectSettings(settings);
      });
      // Reset file input
      e.target.value = '';
      
      // Track load event
      trackEvent(ANALYTICS_EVENTS.LOAD_PROJECT, {
        file_size: file.size,
        file_name: file.name,
        success: true,
      });
    } catch (error) {
      console.error('Error loading project:', error);
      alert('Failed to load project. See console for details.');
      
      // Track load failure
      trackEvent(ANALYTICS_EVENTS.LOAD_PROJECT, {
        error_message: error instanceof Error ? error.message : String(error),
        success: false,
      });
    }
  };
  
  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Save project (Ctrl+S)
      if (event.key === 's' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault(); // Prevent browser's save dialog
        handleSaveProject();
      }

      // Open project (Ctrl+O)
      if (event.key === 'o' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault(); // Prevent browser's open dialog
        handleOpenProject();
      }
    };
    
    // Add event listener
    window.addEventListener('keydown', handleKeyDown);
    
    // Clean up
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [scene, ProjectSettings]); // Re-attach when scene or settings change

  return (
    <div className="flex gap-2 items-center">
      <TooltipProvider>
        {/* Save Button with Tooltip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline"
              onClick={handleSaveProject} 
              className=""
            >
              <IconDeviceFloppy size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Save Project (Ctrl+S)</p>
          </TooltipContent>
        </Tooltip>
        
        {/* Open Button with Tooltip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline"
              onClick={handleOpenProject} 
              className=""
            >
              <IconFolderOpen size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Open Project (Ctrl+O)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      {/* Hidden file input for opening files */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".mud" 
        className="hidden" 
      />
    </div>
  );
} 
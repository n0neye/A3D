'use client';

import React, { useRef, useEffect } from 'react';
import { IconDeviceFloppy, IconFolderOpen } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { trackEvent, ANALYTICS_EVENTS } from '@/app/engine/utils/analytics';
import { isEntity } from '@/app/engine/entity/base/EntityBase';
import { useEditorEngine } from '../context/EditorEngineContext';

export default function FileMenu() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { renderSettings, engine } = useEditorEngine();

  const handleSaveProject = () => {
    const projectName = `proj-${new Date().toISOString().split('T')[0]}.mud`;
    engine.getProjectManager().saveProjectToFile(projectName);

    // Track save event
    trackEvent(ANALYTICS_EVENTS.SAVE_PROJECT, {
      entities_count: engine.getScene().children.filter(node => isEntity(node)).length,
      has_settings: !!renderSettings,
    });
  }

  const handleOpenProject = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    try {
      const file = e.target.files[0];
      await engine.getProjectManager().loadProjectFromFile(file);
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
  }, [renderSettings]); // Re-attach when scene or settings change

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
'use client';

import React, { useRef, useEffect, useState } from 'react';
import { IconDeviceFloppy, IconFolderOpen } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { trackEvent, ANALYTICS_EVENTS } from '@/app/engine/utils/external/analytics';
import { isEntity } from '@/app/engine/entity/base/EntityBase';
import { useEditorEngine } from '../context/EditorEngineContext';
import { toast } from 'sonner';

export default function FileMenu() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { renderSettings, engine } = useEditorEngine();
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check for electron environment once on mount
    setIsElectron(typeof window !== 'undefined' && !!window.electron?.isElectron);
  }, []);

  const handleSaveProject = async (event?: React.MouseEvent | KeyboardEvent) => {
    const isSaveAs = event?.shiftKey; // Check if Shift key is pressed for Save As
    const projectManager = engine.getProjectManager();

    try {
      if (isSaveAs) {
        console.log("Triggering Save As...");
        await projectManager.saveProjectAs(); // Default name handled inside
        toast.success('Project saved successfully.'); // Assuming saveProjectAs updates path and notifies
      } else {
        console.log("Triggering Save...");
        await projectManager.saveProject(); // Tries to overwrite or falls back to Save As
        toast.success('Project saved successfully.');
      }

      // Track save event (consider adding isSaveAs flag)
      trackEvent(ANALYTICS_EVENTS.SAVE_PROJECT, {
        entities_count: engine.getScene().children.filter(node => isEntity(node)).length,
        has_settings: !!renderSettings,
        save_mode: isSaveAs ? 'save_as' : 'save',
        environment: isElectron ? 'electron' : 'web',
      });

    } catch (error) {
        console.error('Error saving project:', error);
        toast.error(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
        // Track save failure
        trackEvent(ANALYTICS_EVENTS.SAVE_PROJECT, {
            save_mode: isSaveAs ? 'save_as' : 'save',
            environment: isElectron ? 'electron' : 'web',
            success: false,
            error_message: error instanceof Error ? error.message : String(error),
        });
    }
  };

  const handleOpenProject = async () => {
    if (isElectron && window.electron) {
        // --- Electron Open Logic ---
        try {
            const result = await window.electron.showOpenDialog();
            if (result) {
                const { filePath, content } = result;
                await engine.getProjectManager().loadProjectFromPath(filePath, content);
                toast.success(`Project loaded from ${filePath.split(/[\\/]/).pop()}`); // Show filename

                // Track load event
                trackEvent(ANALYTICS_EVENTS.LOAD_PROJECT, {
                    // file_size: content.length, // Approximate size
                    file_name: filePath.split(/[\\/]/).pop(),
                    environment: 'electron',
                    success: true,
                });
            } else {
                console.log("Open cancelled by user.");
            }
        } catch (error) {
            console.error('Error opening project via Electron:', error);
            toast.error(`Open failed: ${error instanceof Error ? error.message : String(error)}`);
             // Track load failure
            trackEvent(ANALYTICS_EVENTS.LOAD_PROJECT, {
                environment: 'electron',
                success: false,
                error_message: error instanceof Error ? error.message : String(error),
            });
        }
    } else {
        // --- Web Open Logic (using hidden input) ---
        fileInputRef.current?.click();
    }
  };

  // Web-specific file input handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isElectron) return; // Should not be triggered in Electron

    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    try {
      await engine.getProjectManager().loadProjectFromFile(file);
      toast.success(`Project loaded from ${file.name}`);
      // Reset file input
      e.target.value = '';

      // Track load event
      trackEvent(ANALYTICS_EVENTS.LOAD_PROJECT, {
        file_size: file.size,
        file_name: file.name,
        environment: 'web',
        success: true,
      });
    } catch (error) {
      console.error('Error loading project:', error);
      toast.error(`Load failed: ${error instanceof Error ? error.message : String(error)}`);

      // Track load failure
      trackEvent(ANALYTICS_EVENTS.LOAD_PROJECT, {
        file_name: file.name,
        environment: 'web',
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Save project (Ctrl+S) / Save As (Ctrl+Shift+S)
      if (event.key === 's' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault(); // Prevent browser's save dialog
        handleSaveProject(event); // Pass event to check for Shift key
      }

      // Open project (Ctrl+O)
      if (event.key === 'o' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault(); // Prevent browser's open dialog
        handleOpenProject();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [engine, isElectron]); // Re-run if engine or environment changes

  return (
    <div className="flex gap-2 items-center">
      <TooltipProvider>
        {/* Save Button with Tooltip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={handleSaveProject} // No event passed on click, defaults to Save
              className=""
            >
              <IconDeviceFloppy size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Save Project (Ctrl+S)</p>
            <p className="text-xs text-muted-foreground">Hold Shift for Save As (Shift+Click / Ctrl+Shift+S)</p>
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

      {/* Hidden file input for opening files (Web only) */}
      {!isElectron && (
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".mud"
            className="hidden"
          />
      )}
    </div>
  );
} 
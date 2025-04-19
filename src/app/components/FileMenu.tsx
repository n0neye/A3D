'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { IconDeviceFloppy, IconFolderOpen } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { trackEvent, ANALYTICS_EVENTS } from '@/app/engine/utils/external/analytics';
import { isEntity } from '@/app/engine/entity/base/EntityBase';
import { useEditorEngine } from '../context/EditorEngineContext';
import { toast } from 'sonner';

export default function FileMenu() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { renderSettings, engine } = useEditorEngine();
  const [isElectron, setIsElectron] = useState(false);
  const [projectName, setProjectName] = useState('');

  useEffect(() => {
    if (!engine) return;
    const projectManager = engine.getProjectManager();

    setProjectName(projectManager.getCurrentProjectName());

    const handleNameChange = (data: { name: string }) => {
      setProjectName(data.name);
    };
    const unsubscribe = projectManager.observers.subscribe('projectNameChanged', handleNameChange);

    setIsElectron(typeof window !== 'undefined' && !!window.electron?.isElectron);

    return () => {
      unsubscribe();
    };
  }, [engine]);

  const handleProjectNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    setProjectName(newName);
    engine.getProjectManager().updateProjectName(newName);
  };

  const handleSaveProject = async (event?: React.MouseEvent | KeyboardEvent) => {
    const isSaveAs = event?.shiftKey;
    const projectManager = engine.getProjectManager();

    try {
      if (isSaveAs) {
        console.log("Triggering Save As...");
        await projectManager.saveProjectAs();
        toast.success('Project saved successfully.');
      } else {
        console.log("Triggering Save...");
        await projectManager.saveProject();
        toast.success('Project saved successfully.');
      }

      trackEvent(ANALYTICS_EVENTS.SAVE_PROJECT, {
        entities_count: engine.getScene().children.filter(node => isEntity(node)).length,
        has_settings: !!renderSettings,
        save_mode: isSaveAs ? 'save_as' : 'save',
        environment: isElectron ? 'electron' : 'web',
      });

    } catch (error) {
      console.error('Error saving project:', error);
      toast.error(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
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
      try {
        const result = await window.electron.showOpenDialog();
        if (result) {
          const { filePath, content } = result;
          await engine.getProjectManager().loadProjectFromPath(filePath, content);
          toast.success(`Project loaded from ${filePath.split(/[\\/]/).pop()}`);

          trackEvent(ANALYTICS_EVENTS.LOAD_PROJECT, {
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
        trackEvent(ANALYTICS_EVENTS.LOAD_PROJECT, {
          environment: 'electron',
          success: false,
          error_message: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isElectron) return;

    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    try {
      await engine.getProjectManager().loadProjectFromFile(file);
      toast.success(`Project loaded from ${file.name}`);
      e.target.value = '';

      trackEvent(ANALYTICS_EVENTS.LOAD_PROJECT, {
        file_size: file.size,
        file_name: file.name,
        environment: 'web',
        success: true,
      });
    } catch (error) {
      console.error('Error loading project:', error);
      toast.error(`Load failed: ${error instanceof Error ? error.message : String(error)}`);

      trackEvent(ANALYTICS_EVENTS.LOAD_PROJECT, {
        file_name: file.name,
        environment: 'web',
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 's' && (event.ctrlKey || event.metaKey)) {
        if (document.activeElement?.tagName === 'INPUT') return;
        event.preventDefault();
        handleSaveProject(event);
      }

      if (event.key === 'o' && (event.ctrlKey || event.metaKey)) {
        if (document.activeElement?.tagName === 'INPUT') return;
        event.preventDefault();
        handleOpenProject();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [engine, isElectron, handleSaveProject, handleOpenProject]);

  return (
    <div className="flex gap-2 items-center">

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleSaveProject}
              className="h-9 w-9"
            >
              <IconDeviceFloppy size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Save Project (Ctrl+S)</p>
            <p className="text-xs text-muted-foreground">Hold Shift for Save As</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleOpenProject}
              className="h-9 w-9"
            >
              <IconFolderOpen size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Open Project (Ctrl+O)</p>
          </TooltipContent>
        </Tooltip>

        <Input
          type="text"
          value={projectName}
          onChange={handleProjectNameChange}
          placeholder="Project Name"
          className="w-48 h-9 text-sm"
          aria-label="Project Name"
        />
      </TooltipProvider>

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
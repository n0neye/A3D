'use client';

import React, { useRef, useEffect, useState } from 'react';
import { IconDeviceFloppy, IconFolderOpen, IconMenu2 } from '@tabler/icons-react';
import { Import, Save, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trackEvent, ANALYTICS_EVENTS } from '@/engine/utils/external/analytics';
import { isEntity } from '@/engine/entity/base/EntityBase';
import { useEditorEngine } from '../context/EditorEngineContext';
import { toast } from 'sonner';
import { ImportService, ACCEPTED_EXTENSIONS } from '../engine/services/ImportService';
import { siteConfig } from '@/siteConfig';

export default function FileMenu() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { renderSettings, engine } = useEditorEngine();
  const [isElectron, setIsElectron] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [hasUnsaved, setHasUnsaved] = useState(false);

  useEffect(() => {
    if (!engine) return;
    const projectManager = engine.getProjectManager();

    setProjectName(projectManager.getCurrentProjectName());
    setHasUnsaved(projectManager.hasUnsavedChangesStatus());

    const handleNameChange = (data: { name: string }) => {
      setProjectName(data.name);
    };
    const unsubscribeName = projectManager.observers.subscribe('projectNameChanged', handleNameChange);

    const handleUnsavedChange = (data: { hasUnsaved: boolean }) => {
      setHasUnsaved(data.hasUnsaved);
    };
    const unsubscribeUnsaved = projectManager.observers.subscribe('unsavedChangesStatusChanged', handleUnsavedChange);

    setIsElectron(typeof window !== 'undefined' && !!window.electron?.isElectron);

    return () => {
      unsubscribeName();
      unsubscribeUnsaved();
    };
  }, [engine]);

  const handleProjectNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    setProjectName(newName);
    engine.getProjectManager().updateProjectName(newName);
  };

  const handleNewProject = () => {
    if (hasUnsaved) {
      const confirm = window.confirm('Are you sure you want to create a new project? This will clear the current project.');
      if (!confirm) return;
    }

    engine.getProjectManager().createNewProject();
    setProjectName('untitled');
    setHasUnsaved(false);
  };

  const handleSaveProject = async (options?: { isSaveAs?: boolean}) => {
    console.log("handleSaveProject options:", options);
    const isSaveAs = options?.isSaveAs ?? false;
    const projectManager = engine.getProjectManager();

    try {
      if (isSaveAs) {
        console.log("Triggering Save As...");
        const result = await projectManager.saveProjectAs();
        console.log("Save As result:", result);
        if (result.saved) {
          toast.success('Project saved as successfully.');
        } else if (result.error !== null) {
          toast.error(`Save As failed: ${result.error}`);
        }
      } else {
        console.log("Triggering Save...");
        const result = await projectManager.saveProject();
        console.log("Save result:", result);
        if (result.saved) {
          toast.success('Project saved successfully.');
        } else if (result.error !== null) {
          toast.error(`Save failed: ${result.error}`);
        }
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

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const files = Array.from(e.target.files);
    const importPromises = files.map(async (file) => {
      try {
        const result = await ImportService.importFile(file);
        if (result) {
          toast.success(`Imported ${file.name} successfully.`);
          trackEvent(ANALYTICS_EVENTS.IMPORT_ASSET, {
            file_name: file.name,
            file_type: file.type,
            success: true,
          });
        } else {
          throw new Error(`Import failed for ${file.name}`);
        }
      } catch (error) {
        console.error(`Error importing file ${file.name}:`, error);
        toast.error(`Import failed for ${file.name}`, {
          description: error instanceof Error ? error.message : "Unknown error",
        });
        trackEvent(ANALYTICS_EVENTS.IMPORT_ASSET, {
          file_name: file.name,
          file_type: file.type,
          success: false,
          error_message: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.all(importPromises);
    e.target.value = '';
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if we're in an input field
      if (document.activeElement?.tagName === 'INPUT') return;

      // Handle New Project (Ctrl+N)
      if (event.key === 'n' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        handleNewProject();
      }

      // Handle Save (Ctrl+S)
      if (event.key === 's' && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
        event.preventDefault();
        handleSaveProject({ isSaveAs: false });
      }
      
      // Handle Save As (Ctrl+Shift+S)
      if (event.key === 's' && (event.ctrlKey || event.metaKey) && event.shiftKey) {
        event.preventDefault();
        handleSaveProject({ isSaveAs: true });
      }

      // Handle Open (Ctrl+O)
      if (event.key === 'o' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        handleOpenProject();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [engine, isElectron]);

  return (
    <div className="flex gap-0 items-center">

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 outline-none">
            <Menu size={18} />
            <span className="sr-only">File Menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => handleNewProject()}>
            <IconDeviceFloppy size={16} className="mr-2" />
            <span>New Project</span>
            <span className="ml-auto text-xs tracking-widest opacity-60">Ctrl+N</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSaveProject({ isSaveAs: false })}>
            <IconDeviceFloppy size={16} className="mr-2" />
            <span>Save {hasUnsaved ? '(Unsaved)' : ''}</span>
            <span className="ml-auto text-xs tracking-widest opacity-60">Ctrl+S</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleSaveProject({ isSaveAs: true })}>
            <Save size={16} className="mr-2" />
            <span>Save As...</span>
            <span className="ml-auto text-xs tracking-widest opacity-60">Ctrl+Shift+S</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleOpenProject}>
            <IconFolderOpen size={16} className="mr-2" />
            <span>Open Project</span>
            <span className="ml-auto text-xs tracking-widest opacity-60">Ctrl+O</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleImportClick}>
            <Import size={16} className="mr-2" />
            <span>Import Assets...</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Input
        type="text"
        value={projectName + (hasUnsaved ? '*' : '')}
        onChange={handleProjectNameChange}
        placeholder="Project Name"
        className="w-48 h-9 text-sm"
        aria-label="Project Name"
      />

      {!isElectron && (
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={`.${siteConfig.projectFileExtension}`}
          className="hidden"
        />
      )}

      <input
        type="file"
        ref={importInputRef}
        onChange={handleImportFileChange}
        accept={[...ACCEPTED_EXTENSIONS].join(',')}
        className="hidden"
        multiple
      />
    </div>
  );
} 
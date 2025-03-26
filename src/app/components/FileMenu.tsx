'use client';

import React, { useRef, useEffect } from 'react';
import { useEditorContext } from '../context/EditorContext';
import { saveProjectToFile, loadProjectFromFile, SerializedRenderSettings } from '../util/editor/project-util';
import { IconDeviceFloppy, IconFolderOpen } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import RenderPanel from './RenderPanel';
import { useRenderSettings } from '../context/RenderSettingsContext';

export default function FileMenu() {
  const { scene } = useEditorContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { renderSettings, updateRenderSettings } = useRenderSettings();

  const handleSaveProject = () => {
    if (scene) {
      const projectName = `projectAI-${new Date().toISOString().split('T')[0]}.json`;
      saveProjectToFile(scene, renderSettings, projectName);
    }
  };

  const handleOpenProject = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !scene) return;
    
    try {
      const file = e.target.files[0];
      await loadProjectFromFile(file, scene, (settings: SerializedRenderSettings) => {
        // Apply all settings at once via context
        updateRenderSettings(settings);
      });
      // Reset file input so the same file can be loaded again
      e.target.value = '';
    } catch (error) {
      console.error('Error loading project:', error);
      alert('Failed to load project. See console for details.');
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
  }, [scene, renderSettings]); // Re-attach when scene or settings change

  return (
    <div className="flex gap-2 items-center">
      {/* Save Button with Tabler icon */}
      <Button 
        variant="outline"
        onClick={handleSaveProject} 
        className=""
        title="Save Project (Ctrl+S)"
      >
        <IconDeviceFloppy size={18} />
        <span>Save</span>
      </Button>
      
      {/* Open Button with Tabler icon */}
      <Button 
        variant="outline"
        onClick={handleOpenProject} 
        className=""
        title="Open Project (Ctrl+O)"
      >
        <IconFolderOpen size={18} />
        <span>Open</span>
      </Button>
      
      {/* Hidden file input for opening files */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".json" 
        className="hidden" 
      />
    </div>
  );
} 
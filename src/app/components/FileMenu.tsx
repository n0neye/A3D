'use client';

import React, { useRef } from 'react';
import { useEditorContext } from '../context/EditorContext';
import { saveProjectToFile, loadProjectFromFile } from '../util/extensions/entityNode';
import { IconDeviceFloppy, IconFolderOpen } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

export default function FileMenu() {
  const { scene } = useEditorContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProject = () => {
    if (!scene) return;
    const projectName = `projectAI-${new Date().toISOString().split('T')[0]}.json`;
    saveProjectToFile(scene, projectName);
  };

  const handleOpenProject = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !scene) return;
    
    try {
      const file = e.target.files[0];
      await loadProjectFromFile(file, scene);
      // Reset file input so the same file can be loaded again
      e.target.value = '';
    } catch (error) {
      console.error('Error loading project:', error);
      alert('Failed to load project. See console for details.');
    }
  };

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
import React, { useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { EditorModeManager, useEditorMode } from '../util/editor/modeManager';
import { createEntity } from '../util/entity-manager';
import { ImageRatio, ImageSize } from '../types/entity';

interface GenerationMenuProps {
  scene: BABYLON.Scene | null;
}

const GenerationMenu: React.FC<GenerationMenuProps> = ({ scene }) => {
  const { setMode } = useEditorMode(scene);
  const [isGenerating, setIsGenerating] = useState(false);
  const [ratio, setRatio] = useState<ImageRatio>('1:1');
  const [imageSize, setImageSize] = useState<ImageSize>('medium');
  
  // Create an entity
  const handleCreateEntity = (type: 'aiObject' | 'character' | 'skybox' | 'background') => {
    if (!scene) return;
    
    console.log(`Creating ${type} entity`);
    setIsGenerating(true);
    
    // Create entity facing camera
    const camera = scene.activeCamera as BABYLON.ArcRotateCamera;
    if (!camera) {
      setIsGenerating(false);
      return;
    }
    
    // Calculate position in front of camera
    const distance = 3;
    const direction = camera.getTarget().subtract(camera.position).normalize();
    const position = camera.position.add(direction.scale(distance));
    
    // Create entity with the selected ratio and size
    const entity = createEntity(scene, type, {
      position,
      ratio,
      imageSize
    });
    
    // Select the entity
    const modeManager = EditorModeManager.getInstance();
    modeManager.setSelectedEntity(entity);
    
    // Reset state
    setTimeout(() => {
      setIsGenerating(false);
    }, 500);
  };
  
  return (
    <div className="">
      <h3 className="text-lg font-medium mb-3 text-white">Add</h3>
      
      {/* Ratio selection */}
      {/* <div className="mb-3">
        <label className="block text-sm text-gray-400 mb-1">Aspect Ratio</label>
        <div className="grid grid-cols-5 gap-1">
          {(['1:1', '16:9', '9:16', '4:3', '3:4'] as ImageRatio[]).map(r => (
            <button
              key={r}
              className={`py-1 px-2 text-xs rounded ${ratio === r 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              onClick={() => setRatio(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div> */}
      
      {/* Size selection */}
      {/* <div className="mb-3">
        <label className="block text-sm text-gray-400 mb-1">Image Size</label>
        <div className="grid grid-cols-4 gap-1">
          {(['small', 'medium', 'large', 'xl'] as ImageSize[]).map(size => (
            <button
              key={size}
              className={`py-1 px-2 text-xs rounded ${imageSize === size 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              onClick={() => setImageSize(size)}
            >
              {size}
            </button>
          ))}
        </div>
      </div> */}
      
      {/* Entity type buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleCreateEntity('aiObject')}
          disabled={isGenerating}
          className="py-2 px-3 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm flex items-center justify-center"
        >
          {isGenerating ? 
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating...
            </span> 
            : 'Object'
          }
        </button>
        
        <button
          onClick={() => handleCreateEntity('character')}
          disabled={isGenerating}
          className="py-2 px-3 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm flex items-center justify-center"
        >
          Character
        </button>
        
        <button
          onClick={() => handleCreateEntity('background')}
          disabled={isGenerating}
          className="py-2 px-3 bg-green-600 hover:bg-green-700 rounded text-white text-sm flex items-center justify-center"
        >
          Background
        </button>
        
        <button
          onClick={() => handleCreateEntity('skybox')}
          disabled={isGenerating}
          className="py-2 px-3 bg-amber-600 hover:bg-amber-700 rounded text-white text-sm flex items-center justify-center"
        >
          Skybox
        </button>
      </div>
    </div>
  );
};

export default GenerationMenu; 
import React, { useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { useEditorContext } from '../context/EditorContext';  
import { createEntity } from '../util/entity-manager';
import { ImageRatio, ImageSize } from '../types/entity';

const GenerationMenu: React.FC = () => {
  const { scene, setSelectedEntity } = useEditorContext();
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
    setSelectedEntity(entity);
    
    // Reset state
    setTimeout(() => {
      setIsGenerating(false);
    }, 500);
  };
  
  return (
    <div className="">
      <h3 className="text-lg font-medium mb-3 text-white">Add</h3>
      
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
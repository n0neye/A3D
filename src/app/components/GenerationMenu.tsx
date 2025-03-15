import React, { useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { useEditorMode } from '../util/editor/modeManager';

interface GenerationMenuProps {
  scene: BABYLON.Scene | null;
}

const GenerationMenu: React.FC<GenerationMenuProps> = ({ scene }) => {
  const { setMode } = useEditorMode(scene);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Create a plane facing the camera
  const createPlaneForGeneration = () => {
    if (!scene) return null;
    
    // Get the active camera
    const camera = scene.activeCamera as BABYLON.ArcRotateCamera;
    if (!camera) return null;
    
    // Create a plane
    const plane = BABYLON.MeshBuilder.CreatePlane("generation-canvas", { 
      width: 2, 
      height: 2 
    }, scene);
    
    // Position the plane in front of the camera
    const distance = 3;
    const direction = camera.getTarget().subtract(camera.position).normalize();
    const position = camera.position.add(direction.scale(distance));
    plane.position = position;
    
    // Make it face the camera
    plane.lookAt(camera.position);
    
    // Create a material for the plane
    const material = new BABYLON.StandardMaterial("generation-material", scene);
    material.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.3);
    material.alpha = 0.8;
    material.backFaceCulling = false;
    plane.material = material;
    
    return plane;
  };
  
  // Handle object generation
  const handleGenerateObject = () => {
    if (!scene) return;
    
    console.log("Creating generation plane");
    setIsGenerating(true);
    
    // Create a plane facing the camera
    const plane = createPlaneForGeneration();
    
    // Enter object mode to manipulate it
    setMode('object');
    
    // Reset generating state
    setTimeout(() => {
      setIsGenerating(false);
    }, 500);
  };
  
  // Handle character generation - we'll leave this empty for now
  const handleGenerateCharacter = () => {
    // Empty implementation
  };
  
  return (
    <div className="mb-6 pb-4 border-b border-gray-700">
      <h3 className="text-lg font-medium mb-3 text-white">Generate</h3>
      
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleGenerateObject}
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
            : 'Canvas Plane'
          }
        </button>
        
        <button
          onClick={handleGenerateCharacter}
          disabled={isGenerating}
          className="py-2 px-3 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm flex items-center justify-center"
        >
          Character
        </button>
      </div>
    </div>
  );
};

export default GenerationMenu; 
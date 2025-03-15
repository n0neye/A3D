import React, { useEffect, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
// Import the generation service and 3D conversion
import { generateImage, applyImageToMesh, convertImageTo3D, replaceWithModel } from '../util/object-generation';
import { applyImageToEntity, getPrimaryMeshFromEntity } from '../util/entity-manager';
import { useEditorMode } from '../util/editor/modeManager';
import { EntityType } from '../types/entity';

interface EntityPanelProps {
  scene: BABYLON.Scene | null;
  gizmoManager: BABYLON.GizmoManager | null;
}

const EntityPanel: React.FC<EntityPanelProps> = ({ scene, gizmoManager }) => {
  const { selectedEntity } = useEditorMode(scene);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [visible, setVisible] = useState(false);
  const [entityType, setEntityType] = useState<EntityType>('aiObject');
  
  // Add states for generation
  const [prompt, setPrompt] = useState('A rock');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  
  // Add a new state for 3D conversion
  const [isConverting, setIsConverting] = useState(false);
  
  // Update when selected entity changes
  useEffect(() => {
    if (selectedEntity) {
      setEntityType(selectedEntity.getEntityType() || 'aiObject');
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [selectedEntity]);
  
  // Update panel position
  useEffect(() => {
    if (!scene || !selectedEntity) return;
    
    const updatePosition = () => {
      // Get the primary mesh for position/bounds
      const childMesh = getPrimaryMeshFromEntity(selectedEntity);
      
      if (childMesh && scene.activeCamera) {
        // Calculate position based on the mesh's bounds
        childMesh.computeWorldMatrix(true);
        const boundingInfo = childMesh.getBoundingInfo();
        
        // Project to screen coordinates
        const camera = scene.activeCamera;
        const centerPosition = BABYLON.Vector3.Project(
          childMesh.position,
          BABYLON.Matrix.Identity(),
          scene.getTransformMatrix(),
          camera.viewport.toGlobal(
            scene.getEngine().getRenderWidth(),
            scene.getEngine().getRenderHeight()
          )
        );
        
        // Position the panel below the mesh
        const objectHeight = boundingInfo ? boundingInfo.boundingSphere.radius * 2 : 0;
        const screenScale = camera.fov / (Math.PI / 2); // Approximate screen scale factor
        const screenHeight = objectHeight * screenScale * 100; // Convert to screen units
        
        setPosition({
          left: centerPosition.x,
          top: centerPosition.y + screenHeight / 2 + 30 // Add margin
        });
      } else {
        // Fallback to entity position if no mesh
        const camera = scene.activeCamera;
        if (camera) {
          const centerPosition = BABYLON.Vector3.Project(
            selectedEntity.position,
            BABYLON.Matrix.Identity(),
            scene.getTransformMatrix(),
            camera.viewport.toGlobal(
              scene.getEngine().getRenderWidth(),
              scene.getEngine().getRenderHeight()
            )
          );
          
          setPosition({
            left: centerPosition.x,
            top: centerPosition.y + 50
          });
        }
      }
    };
    
    const observer = scene.onBeforeRenderObservable.add(updatePosition);
    
    return () => {
      scene.onBeforeRenderObservable.remove(observer);
    };
  }, [scene, selectedEntity]);
  
  // Handle image generation using the service
  const handleGenerate = async () => {
    if (!selectedEntity || !prompt.trim() || !scene) return;
    
    setIsGenerating(true);
    
    // Call the generation service
    const result = await generateImage(prompt, {
      entityType: entityType,
      onProgress: (progress) => {
        setGenerationProgress(progress.message);
      }
    });
    
    if (result.success && result.imageUrl) {
      // Add to entity's generation history
      selectedEntity.addGenerationToHistory(prompt, result.imageUrl, {
        ratio: '1:1', // You might want to get this from a state
        imageSize: 'medium'
      });
      
      // Apply the generated image
      applyImageToEntity(selectedEntity, result.imageUrl, scene);
    } else {
      // Handle error
      setGenerationProgress(result.error || 'Generation failed');
      console.error("Generation failed:", result.error);
    }
    
    setIsGenerating(false);
  };
  
  // Add key handler for the input field
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Check if Enter/Return key is pressed
    if (e.key === 'Enter' || e.key === 'Return') {
      e.preventDefault();
      
      // Only trigger if not already generating and we have a prompt
      if (!isGenerating && prompt.trim()) {
        handleGenerate();
      }
    }
  };
  
  // Add a handler for 3D conversion
  const handleConvertTo3D = async () => {
    if (!selectedEntity || !scene) return;
    
    // Get current generation
    const currentGen = selectedEntity.getCurrentGeneration();
    if (!currentGen || currentGen.assetType !== 'image' || !currentGen.imageUrl) {
      alert('Please generate an image first');
      return;
    }
    
    setIsConverting(true);
    setGenerationProgress('Starting 3D conversion...');
    
    // Call the 3D conversion service
    const result = await convertImageTo3D(currentGen.imageUrl, {
      entityType: entityType,
      onProgress: (progress) => {
        setGenerationProgress(progress.message);
      }
    });
    
    if (result.success && result.modelUrl) {
      // Add to entity's history
      selectedEntity.addModelToHistory(result.modelUrl, currentGen.id);
      
      // Replace with 3D model
      await replaceWithModel(
        selectedEntity, 
        result.modelUrl, 
        scene,
        (progress) => {
          setGenerationProgress(progress.message);
        }
      );
      
      setGenerationProgress('3D model loaded successfully!');
      setTimeout(() => setGenerationProgress(''), 3000);
    } else {
      setGenerationProgress(result.error || 'Conversion failed');
    }
    
    setIsConverting(false);
  };
  
  // UI content based on object type
  const renderContent = () => {
    switch (entityType) {
      case 'aiObject':
        return (
          <>
            <h3 className="text-sm font-medium mb-1">Generation Canvas</h3>
            <div className="space-y-2">
              <input 
                type="text" 
                placeholder="Enter prompt..."
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isGenerating || isConverting}
                autoFocus
              />
              
              {(isGenerating || isConverting) && (
                <div className="text-xs text-gray-400 mt-1 mb-1">
                  <div className="flex items-center mb-1">
                    <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{generationProgress}</span>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-1">
                <button 
                  className={`py-1 text-xs ${isGenerating || isConverting ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-700'} rounded text-white`}
                  onClick={handleGenerate}
                  disabled={isGenerating || isConverting || !prompt.trim()}
                >
                  {isGenerating ? 'Generating...' : 'Generate'}
                </button>
                
                <button 
                  className={`py-1 text-xs ${isConverting ? 'bg-gray-600' : selectedEntity?.getCurrentGeneration()?.imageUrl ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600'} rounded text-white`}
                  onClick={handleConvertTo3D}
                  disabled={isGenerating || isConverting || !selectedEntity?.getCurrentGeneration()?.imageUrl}
                >
                  {isConverting ? 'Converting...' : 'Convert to 3D'}
                </button>
              </div>
            </div>
          </>
        );
        
      default:
        return (
          <>
            <h3 className="text-sm font-medium mb-1">Object Settings</h3>
            <div className="grid grid-cols-2 gap-1">
              <button className="py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white">
                Duplicate
              </button>
              <button className="py-1 text-xs bg-red-600 hover:bg-red-700 rounded text-white">
                Delete
              </button>
            </div>
          </>
        );
    }
  };
  
  if (!visible) return null;
  
  return (
    <div 
      className="absolute z-10 bg-black bg-opacity-80 rounded shadow-lg p-2 border border-gray-600 text-white"
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
        transform: 'translateX(-50%)', // Center horizontally
        minWidth: '150px',
      }}
    >
      {renderContent()}
    </div>
  );
};

export default EntityPanel; 
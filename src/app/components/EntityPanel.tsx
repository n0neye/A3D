import React, { useEffect, useState, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';

import { generateImage, Generation2DRealtimResult, replaceWithModel } from '../util/generation-util';
import { generate3DModel } from '../util/generation-util';
import { applyImageToEntity } from '../util/editor/entityUtil';
import { useEditorContext } from '../context/EditorContext';
import { EntityNode, EntityType } from '../types/entity';
import { getImageSimulationData } from '../util/simulation-data';

let prevEntity:EntityNode | null = null;

const EntityPanel: React.FC = () => {
  const { scene, selectedEntity, gizmoManager } = useEditorContext();
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [entityType, setEntityType] = useState<EntityType>('aiObject');
  const [prompt, setPrompt] = useState('_');
  const inputBoxRef = useRef<HTMLInputElement>(null);

  // Get processing state from entity
  const processingState = selectedEntity?.getProcessingState() || {
    isGenerating: false,
    isConverting: false,
    progressMessage: ''
  };
  const { isGenerating, isConverting, progressMessage } = processingState;

  // Update when selected entity changes
  useEffect(() => {
    if (selectedEntity) {
      prevEntity = selectedEntity;
      setEntityType(selectedEntity.getEntityType() || 'aiObject');

      // Get the current generation and set the prompt if available
      const currentGen = selectedEntity.getCurrentGeneration();
      setPrompt(selectedEntity.tempPrompt || currentGen?.prompt || "");
      
      // Use setTimeout to move focus operation to the next event loop tick
      // This gives React time to complete the render with the input field
      setTimeout(() => {
        if (inputBoxRef.current) {
          inputBoxRef.current.focus();
          console.log("Focus applied to input box in setTimeout");
        }
      }, 0);
    }else{
      // Deselect the entity
      // Store the prompt
      if (prevEntity) {
        prevEntity.tempPrompt = prompt;
      }
    }
  }, [selectedEntity]);

  // Update panel position
  // useEffect(() => {
  //   if (!scene || !selectedEntity) {
  //     return;
  //   }

  //   const updatePosition = () => {
  //     const mesh = selectedEntity.primaryMesh;
  //     const camera = scene.activeCamera;
  //     if (!mesh || !camera) return;

  //     // Get the mesh's bounding info
  //     mesh.computeWorldMatrix(true);
  //     const boundingInfo = mesh.getBoundingInfo();
  //     const boundingBox = boundingInfo.boundingBox;

  //     // Project bottom position to screen coordinates
  //     const meshBottomCenterWorld = new BABYLON.Vector3(
  //       mesh.position.x,
  //       boundingBox.minimumWorld.y,
  //       mesh.position.z
  //     );

  //     const meshBottomScreenPosition = BABYLON.Vector3.Project(
  //       meshBottomCenterWorld,
  //       BABYLON.Matrix.Identity(),
  //       scene.getTransformMatrix(),
  //       camera.viewport.toGlobal(
  //         scene.getEngine().getRenderWidth(),
  //         scene.getEngine().getRenderHeight()
  //       )
  //     );

  //     // Position the panel below the object with a margin
  //     const margin = 20;
  //     setPosition({
  //       left: meshBottomScreenPosition.x,
  //       top: meshBottomScreenPosition.y + margin
  //     });

  //   };

  //   const observer = scene.onBeforeRenderObservable.add(updatePosition);

  //   return () => {
  //     scene.onBeforeRenderObservable.remove(observer);
  //   };
  // }, [scene, selectedEntity]);

  // Handle key events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGenerate();
    }
  };

  // Handle image generation
  const handleGenerate = async () => {
    if (!selectedEntity || !prompt.trim() || !scene) return;
    const thisEntity = selectedEntity;

    // Update entity state
    thisEntity.setGeneratingState(true, 'Starting generation...');

    // Call the generation service
    let result: Generation2DRealtimResult;
    if (prompt === "_") {
      result = getImageSimulationData();
    } else {
      result = await generateImage(prompt, {
        entityType: entityType,
        onProgress: (progress) => {
          thisEntity.setGeneratingState(true, progress.message);
        }
      });
    }
    console.log("Generation result", result);

    if (result.success && result.imageUrl) {
      // Add to entity's generation history
      thisEntity.addGenerationToHistory(prompt, result.imageUrl, {
        ratio: '1:1',
        imageSize: 'medium'
      });

      // Apply the generated image - this will replace any existing 3D model
      applyImageToEntity(thisEntity, result.imageUrl, scene);

      // Make sure to update entity type if needed
      setEntityType('aiObject');
    } else {
      // Handle error
      thisEntity.setGeneratingState(true, result.error || 'Generation failed');
      console.error("Generation failed:", result.error);
    }

    // Reset generation state
    thisEntity.setGeneratingState(false);
  };

  // Convert to 3D model
  const handleConvertTo3D = async () => {
    if (!selectedEntity || !scene) return;

    // Get current generation
    const currentGen = selectedEntity.getCurrentGeneration();
    if (!currentGen || currentGen.assetType !== 'image' || !currentGen.imageUrl) {
      alert('Please generate an image first');
      return;
    }

    // Update entity state
    selectedEntity.setConvertingState(true, 'Starting 3D conversion...');

    // Call the 3D conversion service
    const result = await generate3DModel(currentGen.imageUrl, {
      prompt: prompt,
      entityType: entityType,
      onProgress: (progress) => {
        selectedEntity.setConvertingState(true, progress.message);
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
        gizmoManager,
        (progress) => {
          selectedEntity.setConvertingState(true, progress.message);
        }
      );

      selectedEntity.setConvertingState(true, '3D model loaded successfully!');
      setTimeout(() => selectedEntity.setConvertingState(false), 3000);
    } else {
      selectedEntity.setConvertingState(true, result.error || 'Conversion failed');
      setTimeout(() => selectedEntity.setConvertingState(false), 3000);
    }

    // Reset conversion state
    selectedEntity.setConvertingState(false);
  };

  // UI content based on object type
  const renderContent = () => {
    switch (entityType) {
      case 'aiObject':
        return (
          <>
            <div className="space-y-2">
              <input
                type="text"
                ref={inputBoxRef}
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
                  <div className="flex items-center mb-1 p-2">
                    <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{progressMessage}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-1">
                <button
                  className={`py-1 text-xs ${isGenerating || isConverting ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-700'} rounded text-white`}
                  onClick={handleGenerate}
                  disabled={isGenerating || isConverting || !prompt.trim()}
                >
                  {isGenerating ? 'Generating...' : 'Generate Image'}
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


  if (!selectedEntity) return null;

  return (
    <div
      className="fixed z-10 bg-black bg-opacity-80 rounded-2xl p-4 text-white shadow-2xl left-1/2 bottom-4 w-80"
      style={{
        // left: `${position.left}px`,
        // top: `${position.top}px`,
        transform: 'translateX(-50%)', // Center horizontally
        minWidth: '150px',
      }}
    >
      {renderContent()}
    </div>
  );
};

export default EntityPanel; 
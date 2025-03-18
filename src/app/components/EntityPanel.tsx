import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as BABYLON from '@babylonjs/core';

import { generateImage, Generation2DRealtimResult, loadModel } from '../util/generation-util';
import { generate3DModel } from '../util/generation-util';
import { useEditorContext } from '../context/EditorContext';
import { EntityNode, EntityProcessingState, EntityType, applyImageToEntity } from '../util/extensions/entityNode';
import { getImageSimulationData } from '../util/simulation-data';

let prevEntity: EntityNode | null = null;

const EntityPanel: React.FC = () => {
  const { scene, selectedEntity, gizmoManager } = useEditorContext();
  const [promptInput, setPromptInput] = useState('_');
  const inputElementRef = useRef<HTMLInputElement>(null);

  // State for processing
  const [isGenerating2D, setIsGenerating2D] = useState(false);
  const [isGenerating3D, setIsGenerating3D] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');

  // Create progress handler
  const handleProgress = useCallback((progress: EntityProcessingState) => {
    setIsGenerating2D(progress.isGenerating2D);
    setIsGenerating3D(progress.isGenerating3D);
    setProgressMessage(progress.progressMessage);
  }, []);


  // Update when selected entity changes
  useEffect(() => {

    if (prevEntity) {
      prevEntity.tempPrompt = promptInput;
      prevEntity.onProgress.remove(handleProgress);
    }
    prevEntity = selectedEntity;

    if (selectedEntity) {
      // Initial state update
      handleProgress(selectedEntity.getProcessingState());
      // Add event handler
      selectedEntity.onProgress.add(handleProgress);

      // Get the current generation and set the prompt if available
      const currentGen = selectedEntity.getCurrentGeneration();
      setPromptInput(selectedEntity.tempPrompt || currentGen?.prompt || "");

    }
  }, [selectedEntity]);

  // Additional effect to handle the input field mounting
  useEffect(() => {
    if (selectedEntity && inputElementRef.current) {
      inputElementRef.current.focus();
      setTimeout(() => {
        inputElementRef.current?.focus();
        console.log("Focused input");
      }, 50);
    }
  }, [selectedEntity, inputElementRef]);


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
      handleGenerate2D();
    }
  };

  // Handle image generation
  const handleGenerate2D = async () => {
    if (!selectedEntity || !promptInput.trim() || !scene) return;
    const thisEntity = selectedEntity;

    // Update entity state
    thisEntity.setProcessingState({
      isGenerating2D: true,
      isGenerating3D: false,
      progressMessage: 'Starting generation...'
    });

    // Call the generation service
    let result: Generation2DRealtimResult;
    if (promptInput === "_") {
      result = getImageSimulationData();
    } else {
      result = await generateImage(promptInput, {
        entityType: thisEntity.getEntityType(),
        onProgress: (progress) => {
          thisEntity.setProcessingState({
            isGenerating2D: true,
            isGenerating3D: false,
            progressMessage: progress.message
          });
        }
      });
    }
    console.log("Generation result", result);

    if (result.success && result.imageUrl) {
      // Add to entity's generation history
      thisEntity.addGenerationToHistory(promptInput, result.imageUrl, {
        ratio: '1:1',
        imageSize: 'medium'
      });

      // Apply the generated image - this will replace any existing 3D model
      applyImageToEntity(thisEntity, result.imageUrl, scene);
    } else {
      // Handle error
      thisEntity.setProcessingState({
        isGenerating2D: false,
        isGenerating3D: false,
        progressMessage: result.error || "Failed",
      })
      console.error("Generation failed:", result.error);
    }

    // Reset generation state
    thisEntity.setProcessingState({
      isGenerating2D: false,
      isGenerating3D: false,
      progressMessage: ''
    });
  };

  // Convert to 3D model
  const handleGenerate3D = async () => {
    if (!selectedEntity || !scene) return;

    // Get current generation
    const currentGen = selectedEntity.getCurrentGeneration();
    if (!currentGen || currentGen.assetType !== 'image' || !currentGen.imageUrl) {
      alert('Please generate an image first');
      return;
    }

    // Update entity state
    selectedEntity.setProcessingState({
      isGenerating2D: false,
      isGenerating3D: true,
      progressMessage: 'Starting 3D conversion...'
    });

    // Call the 3D conversion service
    const result = await generate3DModel(currentGen.imageUrl, {
      prompt: promptInput,
      entityType: selectedEntity.getEntityType(),
      onProgress: (progress) => {
        selectedEntity.setProcessingState({
          isGenerating2D: false,
          isGenerating3D: true,
          progressMessage: progress.message
        });
      }
    });

    if (result.success && result.modelUrl) {
      // Add to entity's history
      selectedEntity.addModelToHistory(result.modelUrl, currentGen.id);

      // Replace with 3D model
      await loadModel(
        selectedEntity,
        result.modelUrl,
        scene,
        gizmoManager,
        (progress) => {
          selectedEntity.setProcessingState({
            isGenerating2D: false,
            isGenerating3D: true,
            progressMessage: progress.message
          });
        }
      );

      selectedEntity.setProcessingState({
        isGenerating2D: false,
        isGenerating3D: false,
        progressMessage: ''
      });
    } else {
      selectedEntity.setProcessingState({
        isGenerating2D: false,
        isGenerating3D: true,
        progressMessage: result.error || 'Conversion failed'
      });
    }

    // Reset conversion state
    selectedEntity.setProcessingState({
      isGenerating2D: false,
      isGenerating3D: false,
      progressMessage: ''
    });
  };

  // UI content based on object type
  const renderContent = () => {
    switch (selectedEntity?.getEntityType()) {
      case 'aiObject':
        return (
          <>
            <div className="space-y-2">
              <input
                type="text"
                ref={inputElementRef}
                placeholder="Enter prompt..."
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isGenerating2D || isGenerating3D}
              />

              {(isGenerating2D || isGenerating3D) && (
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

              {selectedEntity.metadata.aiData?.aiObjectType === 'object' && <div className="grid grid-cols-2 gap-1">
                <button
                  className={`py-1 text-xs ${isGenerating2D || isGenerating3D ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-700'} rounded text-white`}
                  onClick={handleGenerate2D}
                  disabled={isGenerating2D || isGenerating3D || !promptInput.trim()}
                >
                  {isGenerating2D ? 'Generating...' : 'Generate Image'}
                </button>

                <button
                  className={`py-1 text-xs ${isGenerating3D ? 'bg-gray-600' : selectedEntity?.getCurrentGeneration()?.imageUrl ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600'} rounded text-white`}
                  onClick={handleGenerate3D}
                  disabled={isGenerating2D || isGenerating3D || !selectedEntity?.getCurrentGeneration()?.imageUrl}
                >
                  {isGenerating3D ? 'Converting...' : 'Convert to 3D'}
                </button>
              </div>}
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
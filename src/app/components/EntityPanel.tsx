import React, { useEffect, useState, useRef, useCallback } from 'react';
import { IconArrowLeft, IconArrowRight, IconCornerDownLeft, IconScissors, IconDownload } from '@tabler/icons-react';

import { generateBackground, removeBackground } from '../util/generation-util';
import { generate3DModel } from '../util/3d-generation-util';
import { generateRealtimeImage, GenerationResult } from '../util/realtime-generation-util';
import { useEditorContext } from '../context/EditorContext';
import { EntityNode, EntityProcessingState, GenerationLog } from '../util/extensions/entityNode';
import { ImageRatio } from '../util/generation-util';
import RatioSelector from './RatioSelector';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import * as BABYLON from '@babylonjs/core';
import { trackEvent, ANALYTICS_EVENTS } from '../util/analytics';

// TODO: This is a hack to get the current entity.
// It's used to remove the event handler from the previous entity when the selected entity changes.
let CURRENT_ENTITY: EntityNode | null = null;

const EntityPanel: React.FC = () => {
  const { scene, selectedEntity, gizmoManager, setSelectedEntity } = useEditorContext();
  const [promptInput, setPromptInput] = useState('_');
  const [currentGenLog, setCurrentGenLog] = useState<GenerationLog | null>(null);
  const [generationHistory, setGenerationHistory] = useState<GenerationLog[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
  const inputElementRef = useRef<HTMLTextAreaElement>(null);
  const [currentRatio, setCurrentRatio] = useState<ImageRatio>('1:1');

  // State for processing
  const [isGenerating2D, setIsGenerating2D] = useState(false);
  const [isGenerating3D, setIsGenerating3D] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');

  // State for light settings
  const [lightColor, setLightColor] = useState('#FFFFFF');
  const [lightIntensity, setLightIntensity] = useState(0.7);

  // Update when selected entity changes
  useEffect(() => {
    const handleProgress = (param: { entity: EntityNode, state: EntityProcessingState }) => {
      if (param.entity.name === CURRENT_ENTITY?.name) {
        setIsGenerating2D(param.state.isGenerating2D);
        setIsGenerating3D(param.state.isGenerating3D);
        setProgressMessage(param.state.progressMessage);
      }
    }

    // Remove the event handler from the previous entity
    if (CURRENT_ENTITY && CURRENT_ENTITY.metadata.aiData) {
      // Save the prompt input
      CURRENT_ENTITY.metadata.aiData.prompt = promptInput;
      // Remove the event handler
      CURRENT_ENTITY.onProgress.remove(handleProgress);
      console.log("Removed handleProgress from prevEntity: ", CURRENT_ENTITY.name, CURRENT_ENTITY);
    }

    // Set the new entity
    CURRENT_ENTITY = selectedEntity;

    if (selectedEntity) {
      // Initial state update
      const newState = selectedEntity.getProcessingState();
      handleProgress({ entity: selectedEntity, state: newState });
      // Add event handler
      selectedEntity.onProgress.add(handleProgress);
      console.log("Added handleProgress to selectedEntity: ", selectedEntity.name, selectedEntity);

      // Handle light entity initialization
      if (selectedEntity.getEntityType() === 'light') {
        // Find the point light that's a child of this entity
        const pointLight = findPointLight(selectedEntity);
        if (pointLight) {
          // Initialize color state
          const color = pointLight.diffuse;
          setLightColor(rgbToHex(color.r, color.g, color.b));
          
          // Initialize intensity state
          setLightIntensity(pointLight.intensity);
        }
      } else {
        // Get the current generation and set the prompt if available
        const currentGen = selectedEntity.getCurrentGenerationLog();
        // setPromptInput(selectedEntity.tempPrompt || currentGen?.prompt || "");
        trySetPrompt('onEntityChange', selectedEntity.metadata.aiData?.prompt || currentGen?.prompt || "");
        setCurrentGenLog(currentGen);

        // Load generation history
        const history = selectedEntity.getGenerationHistory ? selectedEntity.getGenerationHistory() : [];
        setGenerationHistory(history);

        // Set current index to the latest generation
        if (currentGen && history.length > 0) {
          const index = history.findIndex(log => log.id === currentGen.id);
          setCurrentHistoryIndex(index !== -1 ? index : history.length - 1);
        } else {
          setCurrentHistoryIndex(-1);
        }

        // Set the current ratio from entity metadata
        if (selectedEntity.metadata.aiData?.ratio) {
          setCurrentRatio(selectedEntity.metadata.aiData.ratio);
        } else {
          setCurrentRatio('1:1'); // Default
        }
      }
    }
  }, [selectedEntity]);

  // Helper function to find the point light in a light entity
  const findPointLight = (entity: EntityNode): BABYLON.PointLight | null => {
    const children = entity.getChildren();
    for (const child of children) {
      if (child instanceof BABYLON.PointLight) {
        return child;
      }
    }
    return null;
  };

  // Convert RGB to hex color
  const rgbToHex = (r: number, g: number, b: number): string => {
    return "#" + ((1 << 24) + (Math.round(r * 255) << 16) + (Math.round(g * 255) << 8) + Math.round(b * 255)).toString(16).slice(1);
  };

  // Convert hex color to RGB
  const hexToRgb = (hex: string): { r: number, g: number, b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 1, g: 1, b: 1 };
  };

  // Handle light color change
  const handleLightColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setLightColor(newColor);
    
    // Update the actual light
    if (selectedEntity && selectedEntity.getEntityType() === 'light') {
      const pointLight = findPointLight(selectedEntity);
      if (pointLight) {
        const rgb = hexToRgb(newColor);
        pointLight.diffuse = new BABYLON.Color3(rgb.r, rgb.g, rgb.b);
        pointLight.specular = new BABYLON.Color3(rgb.r, rgb.g, rgb.b);
        
        // Also update the visual representation
        const lightSphere = selectedEntity.gizmoMesh;
        if (lightSphere && lightSphere.material instanceof BABYLON.StandardMaterial) {
          lightSphere.material.emissiveColor = new BABYLON.Color3(rgb.r, rgb.g, rgb.b);
        }
        
        // Update metadata
        if (!selectedEntity.metadata.lightProperties) {
          selectedEntity.metadata.lightProperties = {
            color: { r: rgb.r, g: rgb.g, b: rgb.b },
            intensity: pointLight.intensity
          };
        } else {
          selectedEntity.metadata.lightProperties.color = { r: rgb.r, g: rgb.g, b: rgb.b };
        }
      }
    }
  };

  // Handle light intensity change
  const handleLightIntensityChange = (value: number[]) => {
    const newIntensity = value[0];
    setLightIntensity(newIntensity);
    
    // Update the actual light
    if (selectedEntity && selectedEntity.getEntityType() === 'light') {
      const pointLight = findPointLight(selectedEntity);
      if (pointLight) {
        pointLight.intensity = newIntensity;
        
        // Update metadata
        if (!selectedEntity.metadata.lightProperties) {
          selectedEntity.metadata.lightProperties = {
            color: { 
              r: pointLight.diffuse.r, 
              g: pointLight.diffuse.g, 
              b: pointLight.diffuse.b 
            },
            intensity: newIntensity
          };
        } else {
          selectedEntity.metadata.lightProperties.intensity = newIntensity;
        }
      }
    }
  };

  // CurrentGenLog changed, update the ratio
  useEffect(() => {
    if (currentGenLog?.assetType === 'image' && currentGenLog.fileUrl) {
      const ratio = currentGenLog.imageParams?.ratio || '1:1';
      setCurrentRatio(ratio);
    }
  }, [currentGenLog, selectedEntity]);

  // Additional effect to handle the input field mounting
  useEffect(() => {
    // if (selectedEntity && inputElementRef.current) {
    //   inputElementRef.current.focus();
    //   setTimeout(() => {
    //     inputElementRef.current?.focus();
    //     console.log("Focused input");
    //   }, 50);
    // }
  }, [selectedEntity, inputElementRef, generationHistory]);

  // Add keyboard shortcut handler
  useEffect(() => {
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      if (!selectedEntity) return;

      if (generationHistory.length > 1 && !isGenerating2D && !isGenerating3D) {
        if (e.shiftKey && e.key === "ArrowLeft") {
          e.preventDefault();
          if (currentHistoryIndex > 0) {
            goToPreviousGeneration();
          }
        }

        if (e.shiftKey && e.key === "ArrowRight") {
          e.preventDefault();
          if (currentHistoryIndex < generationHistory.length - 1) {
            goToNextGeneration();
          }
        }
      }
    };
    // Add the event listener
    document.addEventListener("keydown", handleKeyboardShortcuts);
    // Clean up the event listener when component unmounts
    return () => {
      document.removeEventListener("keydown", handleKeyboardShortcuts);
    };
  }, [selectedEntity, currentHistoryIndex, generationHistory.length, isGenerating2D, isGenerating3D, promptInput]);

  const handleInputFieldKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift + Enter
    if (e.shiftKey && e.key === "Enter" && !e.ctrlKey) {
      console.log("handleInputFieldKeyDown: shift + enter");
      handleGenerate3D();
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
      handleGenerate2D();
    }
  }

  // Handle image generation
  const handleGenerate2D = async () => {
    console.log('handleGenerate2D', promptInput);
    if (!selectedEntity || !promptInput.trim() || !scene) return;
    let result: GenerationResult;
    if (selectedEntity.metadata.aiData?.aiObjectType === 'background') {
      result = await generateBackground(promptInput, selectedEntity, scene);
    } else {
      result = await generateRealtimeImage(promptInput, selectedEntity, scene, { ratio: currentRatio });
    }

    if (result.success && result.generationLog) {
      onNewGeneration(result.generationLog);
    }
  };

  // Convert to 3D model
  const handleGenerate3D = async () => {
    const startTime = Date.now();
    
    // Track start of 3D conversion
    trackEvent(ANALYTICS_EVENTS.CONVERT_TO_3D + '_started', {
      entity_type: selectedEntity?.getEntityType() || 'unknown',
      has_image: !!selectedEntity?.getCurrentGenerationLog()?.fileUrl,
    });
    
    try {
      console.log('handleGenerate3D');
      if (!selectedEntity || !scene) return;

      // Get current generation
      const currentGen = selectedEntity.getCurrentGenerationLog();
      if (!currentGen || currentGen.assetType !== 'image' || !currentGen.fileUrl) {
        alert('Please generate an image first');
        return;
      }

      // Call the 3D conversion service
      const result = await generate3DModel(currentGen.fileUrl, selectedEntity, scene, gizmoManager, currentGen.id, {
        prompt: promptInput,
        // apiProvider: 'trellis'
      });

      if (result.success && result.generationLog) {
        onNewGeneration(result.generationLog);
        setSelectedEntity(selectedEntity);
      }

      // Track successful 3D conversion
      trackEvent(ANALYTICS_EVENTS.CONVERT_TO_3D + '_completed', {
        execution_time_ms: Date.now() - startTime,
        success: true,
        entity_type: selectedEntity?.getEntityType() || 'unknown',
      });
    } catch (error) {
      // Track conversion error
      trackEvent(ANALYTICS_EVENTS.CONVERT_TO_3D + '_error', {
        execution_time_ms: Date.now() - startTime,
        error_message: error instanceof Error ? error.message : String(error),
        entity_type: selectedEntity?.getEntityType() || 'unknown',
      });
      
      console.error('Error generating 3D:', error);
    }
  };

  const onNewGeneration = (log: GenerationLog) => {
    console.log('onNewGeneration', log);
    setGenerationHistory(selectedEntity?.getGenerationHistory() || []);
    setCurrentGenLog(log);
    trySetPrompt('onNewGeneration', log.prompt || "");
    setCurrentHistoryIndex(generationHistory.findIndex(l => l.id === log.id));
  }

  // Handle navigation through generation history
  const goToPreviousGeneration = () => {
    if (currentHistoryIndex > 0 && generationHistory.length > 0) {
      console.log('goToPreviousGeneration', currentHistoryIndex);
      const newIndex = currentHistoryIndex - 1;
      const prevLog = generationHistory[newIndex];
      setCurrentHistoryIndex(newIndex);
      setCurrentGenLog(prevLog);
      trySetPrompt('previous', prevLog.prompt || "");

      // Apply the generation if needed
      if (selectedEntity && prevLog) {
        selectedEntity.applyGenerationLog(prevLog);
      }
    }
  };

  const goToNextGeneration = () => {
    if (currentHistoryIndex < generationHistory.length - 1) {
      console.log('goToNextGeneration', currentHistoryIndex);
      const newIndex = currentHistoryIndex + 1;
      const nextLog = generationHistory[newIndex];
      setCurrentHistoryIndex(newIndex);
      setCurrentGenLog(nextLog);
      trySetPrompt('next', nextLog.prompt || "");

      // Apply the generation if needed
      if (selectedEntity && nextLog) {
        selectedEntity.applyGenerationLog(nextLog);
      }
    }
  };

  const renderSpinner = (message?: string) => {
    return (
      <>
        <svg className=" animate-spin mb-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-50" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {message && <span className="text-xs text-white">{message}</span>}
      </>
    );
  };

  const trySetPrompt = (by: string, prompt: string) => {
    console.log('trySetPrompt', by, prompt);
    setPromptInput(prompt);
  }

  // Handle ratio change
  const handleRatioChange = (ratio: ImageRatio) => {
    if (!selectedEntity || !scene) return;

    // Update the entity's aspect ratio
    setCurrentRatio(ratio);

    // Update entity metadata
    if (selectedEntity.metadata.aiData) {
      selectedEntity.metadata.aiData.ratio = ratio;
    }

    // Apply the ratio to the mesh
    selectedEntity.updateAspectRatio(ratio);
  };

  // Handler for removing background
  const handleRemoveBackground = async () => {
    if (!selectedEntity || !currentGenLog || !scene) return;
    if (currentGenLog.assetType !== 'image' || !currentGenLog.fileUrl) return;

    // Call the background removal function
    const result = await removeBackground(
      currentGenLog.fileUrl,
      selectedEntity,
      scene,
      currentGenLog.id // Pass current image ID as the derived from ID
    );

    if (result.success && result.generationLog) {
      onNewGeneration(result.generationLog);
    }
  };

  const handleDownload = () => {
    console.log('handleDownload');
    if (!currentGenLog?.fileUrl) return;

    // Call the download function
    const a = document.createElement('a');
    a.href = currentGenLog.fileUrl;
    a.download = currentGenLog.fileUrl.split('/').pop() || 'image.png';
    a.target = '_blank';
    a.click();
  }


  // UI content based on object type
  const renderContent = () => {
    const isGenerating = isGenerating2D || isGenerating3D;
    const isObject = selectedEntity?.metadata.aiData?.aiObjectType === 'generativeObject';
    const isBackground = selectedEntity?.metadata.aiData?.aiObjectType === 'background';
    const isLight = selectedEntity?.getEntityType() === 'light';

    // Check if we can remove background (only if we have a current image)
    const canRemoveBackground =
      !isGenerating &&
      currentGenLog?.assetType === 'image' &&
      !!currentGenLog.fileUrl &&
      isObject &&
      !isBackground;

    const hasPreviousGeneration = currentHistoryIndex > 0;
    const hasNextGeneration = currentHistoryIndex < generationHistory.length - 1;

    // Handle light entity UI
    if (isLight) {
      return (
        <div className="flex flex-col space-y-2 w-80">
          <div className="flex items-center space-x-2">
            <label className="text-xs text-white w-20">Color</label>
            <input
              type="color"
              value={lightColor}
              onChange={handleLightColorChange}
              className="w-8 h-8 bg-transparent border-none cursor-pointer rounded-full"
            />
            <span className="text-xs text-white">{lightColor}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-xs text-white w-20">Intensity</label>
            <Slider
              value={[lightIntensity]}
              min={0}
              max={2}
              step={0.05}
              className="w-32"
              onValueChange={handleLightIntensityChange}
            />
            <span className="text-xs text-white w-10 text-right">{lightIntensity.toFixed(2)}</span>
          </div>
        </div>
      );
    }

    // For other entity types, proceed with existing logic
    switch (selectedEntity?.getEntityType()) {
      case 'aiObject':
        switch (selectedEntity.metadata.aiData?.aiObjectType) {
          case 'generativeObject':
            return (
              <>
                <div className="flex flex-col space-y-2">

                  {/* Prompt */}
                  <div className="space-y-2 flex flex-row space-x-2">
                    <div className="flex flex-col m-0">
                      {/* Bottom row */}
                      <div className="flex justify-start space-x-1 h-6 pr-2">

                        {isObject && !isBackground && <RatioSelector
                          value={currentRatio}
                          onChange={handleRatioChange}
                          disabled={isGenerating}
                        />}

                        {/* History navigation buttons */}
                        {generationHistory.length > 1 && (
                          <>
                            <button
                              className={`p-1 rounded mr-0 ${hasPreviousGeneration ? 'text-white hover:bg-gray-700' : 'text-gray-500 cursor-not-allowed'}`}
                              onClick={goToPreviousGeneration}
                              disabled={!hasPreviousGeneration || isGenerating}
                              title="Previous generation (Shift + ←)"
                            >
                              <IconArrowLeft size={16} />
                            </button>
                            <span className="text-xs text-gray-400 self-center">
                              {currentHistoryIndex + 1}/{generationHistory.length}
                            </span>
                            <button
                              className={`p-1 rounded ${hasNextGeneration ? 'text-white hover:bg-gray-700' : 'text-gray-500 cursor-not-allowed'}`}
                              onClick={goToNextGeneration}
                              disabled={!hasNextGeneration || isGenerating}
                              title="Next generation (Shift + →)"
                            >
                              <IconArrowRight size={16} />
                            </button>
                          </>
                        )}
                        <div className='flex-grow'></div>
                        <button className="p-1 rounded text-white hover:bg-gray-700"
                          onClick={handleDownload}
                          disabled={!currentGenLog?.fileUrl}
                        >
                          {/* Icon */}
                          <IconDownload size={16} />
                        </button>
                      </div>
                      <textarea
                        ref={inputElementRef}
                        placeholder="Enter prompt..."
                        className="w-96 px-2 py-1 text-xs bg-none border-none m-0 mr-2 focus:outline-none"
                        value={promptInput}
                        onKeyDown={handleInputFieldKeyDown}
                        onChange={(e) => setPromptInput(e.target.value)}
                        disabled={isGenerating}
                        rows={3}
                      />

                    </div>

                    <div className="flex flex-row space-x-1">
                      <Button
                        variant={"outline"}
                        className={`relative text-xs whitespace-normal w-20 h-full flex-col `}
                        onClick={handleGenerate2D}
                        disabled={isGenerating || !promptInput.trim()}
                      >
                        {isGenerating2D && renderSpinner('Generating')}
                        {!isGenerating2D && <>Generate {isBackground ? 'Background' : 'Image'}<span className="mx-1 text-xxxs opacity-50 block"><IconCornerDownLeft size={10} className='inline' /></span></>}
                      </Button>

                      {isObject && <Button
                        className={`relative text-xs whitespace-normal w-20 h-full flex-col p-1`}
                        onClick={handleGenerate3D}
                        disabled={isGenerating || !currentGenLog || currentGenLog.assetType !== 'image'}
                      >
                        {isGenerating3D && renderSpinner('')}
                        {!isGenerating3D && <>Convert 3D
                          <span className="mx-1 text-[10px] opacity-50 block">Shift+<IconCornerDownLeft size={10} className='inline' /></span>
                        </>}
                        {isGenerating3D &&
                          <span>{progressMessage}</span>}
                      </Button>}

                      {/* Remove Background button. Temporarily disabled */}
                      {/* {canRemoveBackground && (
                        <button
                          className={`relative py-1 pt-4 text-xs whitespace-normal w-20 p-2 ${isGenerating && progressMessage.includes('background') ? 'bg-gray-600' : 'bg-indigo-600 hover:bg-indigo-700'
                            } rounded text-white`}
                          onClick={handleRemoveBackground}
                          disabled={isGenerating}
                        >
                          {isGenerating2D && progressMessage.includes('background') && renderSpinner('Processing')}
                          {!(isGenerating2D && progressMessage.includes('background')) && (
                            <>
                              <IconScissors size={14} className="mx-auto mb-1" />
                              Remove BG
                            </>
                          )}
                        </button>
                      )} */}
                    </div>

                  </div>
                </div>
              </>
            );
          default:
            return (
              <>
              </>
            );
        }

      default:
        return (
          <>
          </>
        );
    }
  };

  if (!selectedEntity) return null;
  
  // Show panel for both generative objects and lights
  if (selectedEntity.getEntityType() !== 'light' && 
      (!selectedEntity.metadata.aiData || selectedEntity.metadata.aiData.aiObjectType !== 'generativeObject')) {
    return null;
  }

  return (
    <div
      className="fixed z-10 panel left-1/2 bottom-4 "
      style={{
        transform: 'translateX(-50%)', // Center horizontally
        minWidth: '150px',
      }}
    >
      {renderContent()}
    </div>
  );
};

export default EntityPanel; 
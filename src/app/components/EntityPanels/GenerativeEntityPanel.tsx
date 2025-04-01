import React, { useEffect, useState, useRef } from 'react';
import { IconArrowLeft, IconArrowRight, IconCornerDownLeft, IconScissors, IconDownload } from '@tabler/icons-react';

import {  removeBackground } from '../../util/generation-util';
import { generate3DModel } from '../../util/3d-generation-util';
import { generateRealtimeImage, GenerationResult } from '../../util/realtime-generation-util';
import { useEditorContext } from '../../context/EditorContext';
import RatioSelector from '../RatioSelector';
import { Button } from '@/components/ui/button';
import { trackEvent, ANALYTICS_EVENTS } from '../../util/analytics';
import { GenerationLog, GenerativeEntity, GenerationState } from '../../util/extensions/GenerativeEntity';

import { ImageRatio } from "../../util/generation-util";
import { EntityBase } from "../../util/extensions/EntityBase";

// TODO: This is a hack to get the current entity.
// It's used to remove the event handler from the previous entity when the selected entity changes.
let CURRENT_ENTITY: GenerativeEntity | null = null;


const GenerativeEntityPanel = (props: { entity: GenerativeEntity }) => {

  const { scene, gizmoManager } = useEditorContext();

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

  // Update when selected entity changes
  useEffect(() => {
    const handleProgress = (param: { entity: EntityBase, state: GenerationState }) => {
      if (param.entity.name === CURRENT_ENTITY?.name) {
        setIsGenerating2D(param.state === 'generating2D');
        setIsGenerating3D(param.state === 'generating3D');
        setProgressMessage(param.state);
      }
    }

    // Remove the event handler from the previous entity
    if (CURRENT_ENTITY) {
      // Save the prompt input
      CURRENT_ENTITY.temp_prompt = promptInput;
      // Remove the event handler
      CURRENT_ENTITY.onProgress.remove(handleProgress);
      console.log("Removed handleProgress from prevEntity: ", CURRENT_ENTITY.name, CURRENT_ENTITY);
    }

    // Set the new entity
    CURRENT_ENTITY = props.entity;

    if (props.entity) {

      // Initial state update
      const newState = props.entity.getGenerationState();
      handleProgress({ entity: props.entity, state: newState });
      // Add event handler
      props.entity.onProgress.add(handleProgress);
      console.log("Added handleProgress to props.entity: ", props.entity.name, props.entity);

      // Get the current generation and set the prompt if available
      const currentGen = props.entity.getCurrentGenerationLog();
      // setPromptInput(props.entity.tempPrompt || currentGen?.prompt || "");
      trySetPrompt('onEntityChange', props.entity.temp_prompt || currentGen?.prompt || "");
      setCurrentGenLog(currentGen);

      // Load generation history
      const history = props.entity.props.generationLogs;
      setGenerationHistory(history);

      // Set current index to the latest generation
      if (currentGen && history.length > 0) {
        const index = history.findIndex(log => log.id === currentGen.id);
        setCurrentHistoryIndex(index !== -1 ? index : history.length - 1);
      } else {
        setCurrentHistoryIndex(-1);
      }

      // Set the current ratio from entity metadata
      if (props.entity.temp_ratio) {
        setCurrentRatio(props.entity.temp_ratio);
      } else {
        setCurrentRatio('1:1'); // Default
      }
    }
  }, [props.entity]);

  // CurrentGenLog changed, update the ratio
  useEffect(() => {
    if (currentGenLog?.assetType === 'image' && currentGenLog.fileUrl) {
      const ratio = currentGenLog.imageParams?.ratio || '1:1';
      setCurrentRatio(ratio);
    }
  }, [currentGenLog, props.entity]);

  // Additional effect to handle the input field mounting
  useEffect(() => {
    // if (props.entity && inputElementRef.current) {
    //   inputElementRef.current.focus();
    //   setTimeout(() => {
    //     inputElementRef.current?.focus();
    //     console.log("Focused input");
    //   }, 50);
    // }
  }, [props.entity, inputElementRef, generationHistory]);

  // Add keyboard shortcut handler
  useEffect(() => {
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      if (!props.entity) return;

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
  }, [props.entity, currentHistoryIndex, generationHistory.length, isGenerating2D, isGenerating3D, promptInput]);

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
    if (!props.entity || !promptInput.trim() || !scene) return;
    let result: GenerationResult;
    result = await generateRealtimeImage(promptInput, props.entity, scene, { ratio: currentRatio });

    if (result.success && result.generationLog) {
      onNewGeneration(result.generationLog);
    }
  };

  // Convert to 3D model
  const handleGenerate3D = async () => {
    const startTime = Date.now();

    // Track start of 3D conversion
    trackEvent(ANALYTICS_EVENTS.CONVERT_TO_3D + '_started', {
      entity_type: props.entity?.getEntityType() || 'unknown',
      has_image: !!props.entity?.getCurrentGenerationLog()?.fileUrl,
    });

    try {
      console.log('handleGenerate3D');
      if (!props.entity || !scene) return;

      // Get current generation
      const currentGen = props.entity.getCurrentGenerationLog();
      if (!currentGen || currentGen.assetType !== 'image' || !currentGen.fileUrl) {
        alert('Please generate an image first');
        return;
      }

      // Call the 3D conversion service
      const result = await generate3DModel(currentGen.fileUrl, props.entity, scene, gizmoManager, currentGen.id, {
        prompt: promptInput,
        // apiProvider: 'trellis'
      });

      if (result.success && result.generationLog) {
        onNewGeneration(result.generationLog);
      }

      // Track successful 3D conversion
      trackEvent(ANALYTICS_EVENTS.CONVERT_TO_3D + '_completed', {
        execution_time_ms: Date.now() - startTime,
        success: true,
        entity_type: props.entity?.getEntityType() || 'unknown',
      });
    } catch (error) {
      // Track conversion error
      trackEvent(ANALYTICS_EVENTS.CONVERT_TO_3D + '_error', {
        execution_time_ms: Date.now() - startTime,
        error_message: error instanceof Error ? error.message : String(error),
        entity_type: props.entity?.getEntityType() || 'unknown',
      });

      console.error('Error generating 3D:', error);
    }
  };

  const onNewGeneration = (log: GenerationLog) => {
    console.log('onNewGeneration', log);
    setGenerationHistory(props.entity.props.generationLogs);
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
      if (props.entity && prevLog) {
        props.entity.applyGenerationLog(prevLog);
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
      if (props.entity && nextLog) {
        props.entity.applyGenerationLog(nextLog);
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
    if (!props.entity || !scene) return;

    // Update the entity's aspect ratio
    setCurrentRatio(ratio);
    props.entity.temp_ratio = ratio;

    // Apply the ratio to the mesh
    props.entity.updateAspectRatio(ratio);
  };

  // Handler for removing background
  const handleRemoveBackground = async () => {
    if (!props.entity || !currentGenLog || !scene) return;
    if (currentGenLog.assetType !== 'image' || !currentGenLog.fileUrl) return;

    // Call the background removal function
    const result = await removeBackground(
      currentGenLog.fileUrl,
      props.entity,
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


  const isGenerating = isGenerating2D || isGenerating3D;

  // Check if we can remove background (only if we have a current image)
  const canRemoveBackground =
    !isGenerating &&
    currentGenLog?.assetType === 'image' &&
    !!currentGenLog.fileUrl;

  const hasPreviousGeneration = currentHistoryIndex > 0;
  const hasNextGeneration = currentHistoryIndex < generationHistory.length - 1;

  return <div>
    <div><>
      <div className="flex flex-col space-y-2">

        {/* Prompt */}
        <div className="space-y-2 flex flex-row space-x-2">
          <div className="flex flex-col m-0">
            {/* Bottom row */}
            <div className="flex justify-start space-x-1 h-6 pr-2">

              {<RatioSelector
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
              {!isGenerating2D && <>Generate Image<span className="mx-1 text-xxxs opacity-50 block"><IconCornerDownLeft size={10} className='inline' /></span></>}
            </Button>

            {<Button
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
    </div>
  </div>;
};

export default GenerativeEntityPanel;



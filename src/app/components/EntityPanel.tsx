import React, { useEffect, useState, useRef, useCallback } from 'react';
import { IconArrowLeft, IconArrowRight, IconCornerDownLeft, IconChevronDown, IconAspectRatio, IconCheck } from '@tabler/icons-react';

import { generateBackground, generate3DModel } from '../util/generation-util';
import { generateRealtimeImage, GenerationResult } from '../util/realtime-generation-util';
import { useEditorContext } from '../context/EditorContext';
import { EntityNode, EntityProcessingState, GenerationLog } from '../util/extensions/entityNode';
import { ImageRatio } from '../util/generation-util';

// Ratio options with icons
const ratioOptions: { value: ImageRatio; label: string }[] = [
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '16:9', label: '16:9' },
  { value: '3:4', label: '3:4' },
  { value: '9:16', label: '9:16' },
];

// New compact ratio selector component
const RatioSelector: React.FC<{
  value: ImageRatio;
  onChange: (value: ImageRatio) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Generate ratio icon CSS class
  const getRatioIconClass = (ratio: ImageRatio) => {
    switch (ratio) {
      case '1:1': return 'ratio-icon-square';
      case '16:9': return 'ratio-icon-wide';
      case '9:16': return 'ratio-icon-tall';
      case '4:3': return 'ratio-icon-standard';
      case '3:4': return 'ratio-icon-portrait';
      default: return 'ratio-icon-square';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center p-1 rounded hover:bg-gray-700 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        title="Aspect Ratio"
      >
        <div className={`${getRatioIconClass(value)} mr-1`}></div>
        <span className="text-xs text-gray-400">{value}</span>
      </button>
      
      {isOpen && !disabled && (
        <div className="absolute z-10 left-0 mt-1 bg-gray-800 shadow-lg rounded-md py-1 min-w-[160px]">
          {ratioOptions.map((option) => (
            <div
              key={option.value}
              className="px-3 py-2 flex items-center hover:bg-gray-700 cursor-pointer"
              onClick={() => {
                onChange(option.value as ImageRatio);
                setIsOpen(false);
              }}
            >
              <div className={`${getRatioIconClass(option.value as ImageRatio)} mr-2`}></div>
              <span className="text-sm text-gray-200">{option.label}</span>
              {value === option.value && <IconCheck size={16} className="ml-auto text-blue-400" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Add CSS for the ratio icons
const ratioIconStyles = `
.ratio-icon-square, .ratio-icon-wide, .ratio-icon-tall, .ratio-icon-standard, .ratio-icon-portrait {
  display: inline-block;
  border: 2px solid #9ca3af;
  border-radius: 2px;
}

.ratio-icon-square {
  width: 14px;
  height: 14px;
}

.ratio-icon-wide {
  width: 20px;
  height: 11px;
}

.ratio-icon-tall {
  width: 11px;
  height: 20px;
}

.ratio-icon-standard {
  width: 16px;
  height: 12px;
}

.ratio-icon-portrait {
  width: 12px;
  height: 16px;
}
`;

let prevEntity: EntityNode | null = null;

// Shadcn-inspired dropdown component
interface DropdownProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const Dropdown: React.FC<DropdownProps> = ({ options, value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectedOption = options.find(option => option.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center justify-between w-full px-3 py-1 text-sm rounded-md 
                  ${disabled ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-800 text-white hover:bg-gray-700'}`}
      >
        <span>{selectedOption?.label || value}</span>
        <IconChevronDown size={16} className={`ml-2 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-gray-800 shadow-lg rounded-md py-1 text-sm">
          {options.map((option) => (
            <div
              key={option.value}
              className={`px-3 py-1.5 cursor-pointer hover:bg-gray-700 
                      ${option.value === value ? 'bg-blue-600 text-white' : 'text-gray-200'}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const EntityPanel: React.FC = () => {
  const { scene, selectedEntity, gizmoManager } = useEditorContext();
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
    const handleProgress = (progress: EntityProcessingState) => {
      setIsGenerating2D(progress.isGenerating2D);
      setIsGenerating3D(progress.isGenerating3D);
      setProgressMessage(progress.progressMessage);
    }

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
      const currentGen = selectedEntity.getCurrentGenerationLog();
      // setPromptInput(selectedEntity.tempPrompt || currentGen?.prompt || "");
      trySetPrompt('onEntityChange', selectedEntity.tempPrompt || currentGen?.prompt || "");
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
      e.preventDefault();
      handleGenerate3D();
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
      result = await generateRealtimeImage(promptInput, selectedEntity, scene);
    }

    if (result.success && result.generationLog) {
      onNewGeneration(result.generationLog);
    }
  };

  // Convert to 3D model
  const handleGenerate3D = async () => {
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
    });

    if (result.success && result.generationLog) {
      onNewGeneration(result.generationLog);
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

  // Add global style for ratio icons
  useEffect(() => {
    const styleSheet = document.createElement("style");
    styleSheet.id = "ratio-icon-styles";
    styleSheet.textContent = ratioIconStyles;
    document.head.appendChild(styleSheet);
    
    return () => {
      const existingStyle = document.getElementById("ratio-icon-styles");
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  // UI content based on object type
  const renderContent = () => {
    const isGenerating = isGenerating2D || isGenerating3D;
    const isObject = selectedEntity?.metadata.aiData?.aiObjectType === 'object';
    const isBackground = selectedEntity?.metadata.aiData?.aiObjectType === 'background';

    const hasPreviousGeneration = currentHistoryIndex > 0;
    const hasNextGeneration = currentHistoryIndex < generationHistory.length - 1;

    switch (selectedEntity?.getEntityType()) {
      case 'aiObject':
        return (
          <>
            <div className="flex flex-col space-y-2">
              {/* Object settings - now just shown as a compact icon control */}
              {isObject && !isBackground && (
                <div className="flex items-center space-x-2 mb-1">
                  <RatioSelector
                    value={currentRatio}
                    onChange={handleRatioChange}
                    disabled={isGenerating}
                  />
                </div>
              )}

              {/* Prompt */}
              <div className="space-y-2 flex flex-row space-x-2">
                <div className="flex flex-col">
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

                  {/* Bottom row */}
                  <div className="flex justify-start mt-1 space-x-1 h-4">
                    {/* History navigation buttons */}
                    {generationHistory.length > 1 && (
                      <>
                        <button
                          className={`p-1 rounded ${hasPreviousGeneration ? 'text-white hover:bg-gray-700' : 'text-gray-500 cursor-not-allowed'}`}
                          onClick={goToPreviousGeneration}
                          disabled={!hasPreviousGeneration || isGenerating}
                          title="Previous generation (Shift + ←)"
                        >
                          <IconArrowLeft size={16} />
                        </button>
                        <button
                          className={`p-1 rounded ${hasNextGeneration ? 'text-white hover:bg-gray-700' : 'text-gray-500 cursor-not-allowed'}`}
                          onClick={goToNextGeneration}
                          disabled={!hasNextGeneration || isGenerating}
                          title="Next generation (Shift + →)"
                        >
                          <IconArrowRight size={16} />
                        </button>
                        <span className="text-xs text-gray-400 self-center">
                          {currentHistoryIndex + 1}/{generationHistory.length}
                        </span></>
                    )}
                  </div>
                </div>

                <div className="flex flex-row space-x-1">
                  <button
                    className={`relative py-1 pt-4 text-xs whitespace-normal w-20 p-2 ${isGenerating ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-700'} rounded text-white`}
                    onClick={handleGenerate2D}
                    disabled={isGenerating || !promptInput.trim()}
                  >
                    {isGenerating2D && renderSpinner('Generating')}
                    {!isGenerating2D && <>Generate {isBackground ? 'Background' : 'Image'}<span className="mx-1 text-xxxs opacity-50 block"><IconCornerDownLeft size={12} className='inline' /></span></>}
                  </button>

                  {isObject && <button
                    className={`relative py-1 pt-4 text-xs whitespace-normal w-20 p-2 ${isGenerating3D ? 'bg-gray-600' : currentGenLog?.assetType === 'image' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600'} rounded text-white`}
                    onClick={handleGenerate3D}
                    disabled={isGenerating || !currentGenLog || currentGenLog.assetType !== 'image'}
                  >
                    {isGenerating3D && renderSpinner('')}
                    {!isGenerating3D && <>Convert to 3D<span className="mx-1 text-xxs opacity-50 block">Shift+<IconCornerDownLeft size={12} className='inline' /></span></>}
                    {isGenerating3D &&
                      <span>{progressMessage}</span>}
                  </button>}
                </div>

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
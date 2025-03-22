import React, { useState, useRef, useEffect } from 'react';
import { renderImage as generateRenderImage, dataURLtoBlob, ModelType, availableModels } from '../util/image-render-api';
import { addNoiseToImage, resizeImage } from '../util/image-processing';
import { useEditorContext } from '../context/EditorContext';
import * as BABYLON from '@babylonjs/core';
import StylePanel from './StylePanel';
import { LoraConfig, LoraInfo } from '../util/lora';

const RenderPanel = ({ isDebugMode }: { isDebugMode: boolean }) => {
  const { scene, engine } = useEditorContext();
  // State variables
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('flooded office, fire, dark night, a female warrior with a spear');
  const [promptStrength, setPromptStrength] = useState<number>(0.9); // Default to 0.7 strength
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const [debugImage, setDebugImage] = useState<string | null>(null);
  const [noiseStrength, setNoiseStrength] = useState<number>(0.6); // Default to 0 (no noise)
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [model, setModel] = useState<ModelType>('flux-lora-depth');

  // Style panel state
  const [selectedLoras, setSelectedLoras] = useState<LoraConfig[]>([]);
  const [isStylePanelOpen, setIsStylePanelOpen] = useState(false);

  // Add keyboard shortcut for Ctrl/Cmd+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl/Cmd + Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault(); // Prevent default browser behavior
        handleRender();
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Clean up event listener
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [prompt, promptStrength, noiseStrength, model, selectedLoras]); // Re-create handler when these dependencies change

  // Style panel handlers
  const handleSelectStyle = (lora: LoraInfo) => {
    // Only add if not already present
    if (!selectedLoras.some(l => l.info.id === lora.id)) {
      setSelectedLoras([...selectedLoras, { info: lora, strength: 0.5 }]);
    }
  };

  const handleRemoveStyle = (id: string) => {
    setSelectedLoras(selectedLoras.filter(lora => lora.info.id !== id));
  };

  const handleUpdateStyleStrength = (id: string, strength: number) => {
    setSelectedLoras(
      selectedLoras.map(lora =>
        lora.info.id === id ? { ...lora, strength } : lora
      )
    );
  };

  // Render the selected styles
  const renderSelectedStyles = () => {
    if (selectedLoras.length === 0) {
      return (
        <div
          className="w-full p-3 border border-dashed border-gray-600 rounded-md cursor-pointer hover:bg-gray-700 transition text-center"
          onClick={() => setIsStylePanelOpen(true)}
        >
          <p className="text-gray-400 text-sm">Click to add a style</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {selectedLoras.map(loraConfig => (
          <div key={loraConfig.info.id} className="bg-gray-700 rounded-md p-1 flex flex-row">

            <div className="h-14 w-14 mr-2 overflow-hidden rounded">
              <img
                src={loraConfig.info.thumbUrl}
                alt={loraConfig.info.name}
                className="object-cover w-full h-full"
              />
            </div>

            <div className="flex flex-col max-w-[140px]">

              {/* Title and remove button */}
              <div className="flex items-center mb-2 h-6">
                <div className="flex-grow">
                  <h5 className="text-white text-sm font-medium truncate max-w-[120px] text-ellipsis">{loraConfig.info.name}</h5>
                </div>
                <button
                  className="text-gray-400 hover:text-red-500 p-1"
                  onClick={() => handleRemoveStyle(loraConfig.info.id)}
                >
                  &times;
                </button>
              </div>

              {/* Strength slider */}
              <div className="flex items-center space-x-2">
                {/* <span className="text-xs text-gray-400">Strength:</span> */}
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={loraConfig.strength}
                  onChange={(e) => handleUpdateStyleStrength(loraConfig.info.id, parseFloat(e.target.value))}
                  className="flex-grow h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer max-w-[115px]"
                />
                <span className="text-xs text-gray-300 w-8 text-right">{loraConfig.strength.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}

        <button
          className="w-full p-2 text-sm bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600"
          onClick={() => setIsStylePanelOpen(true)}
        >
          Add another style
        </button>
      </div>
    );
  };

  const takeScreenshot = async () => {
    if (!scene || !engine) throw new Error("Scene or engine not found");

    // Prepare scene for screenshot - hide any UI elements if needed
    // TODO: Hide gizmos
    // Take the screenshot
    const result = await BABYLON.Tools.CreateScreenshotAsync(engine, scene.activeCamera!, { precision: 1 });
    if (!result) throw new Error("Failed to take screenshot");
    return result;
  };

  const generateDebugImage = async () => {
    try {
      // Force a fresh render
      const screenshot = await takeScreenshot();

      console.log("Screenshot generated:", screenshot.substring(0, 100) + "...");
      setDebugImage(screenshot);
      // Apply noise to the screenshot if noiseStrength > 0
      let processedImage = screenshot;
      if (noiseStrength > 0) {
        processedImage = await addNoiseToImage(screenshot, noiseStrength);
      }
      setDebugImage(processedImage);

    } catch (error) {
      console.error("Error in debug image:", error);
    }
  };

  const handleRender = async () => {
    setIsLoading(true);
    setExecutionTime(null); // Reset execution time when starting new generation

    try {
      // First, take a screenshot of the current scene
      const screenshot = await takeScreenshot();

      // Store the original screenshot
      setDebugImage(screenshot);

      // Apply noise to the screenshot if noiseStrength > 0
      let processedImage = screenshot;
      if (noiseStrength > 0) {
        processedImage = await addNoiseToImage(screenshot, noiseStrength);
      }

      // Update the debug image with the processed image
      setPreviewUrl(processedImage);

      // Resize the image to 512x512 before sending to API
      const resizedImage = await resizeImage(processedImage, 512, 512);

      // Convert the resized image to blob for API
      const imageBlob = dataURLtoBlob(resizedImage);

      // Start measuring time
      const startTime = Date.now();

      // Call the API with the selected model
      const result = await generateRenderImage({
        imageUrl: imageBlob,
        prompt: prompt,
        promptStrength: promptStrength,
        model: model,
        loras: selectedLoras,
      });

      // Calculate execution time
      const endTime = Date.now();
      setExecutionTime(endTime - startTime);

      // Update the preview with the generated image
      setPreviewUrl(result.imageUrl);
    } catch (error) {
      console.error("Error generating preview:", error);
      alert("Failed to generate preview. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>

      {/* Overlay Style Panel */}
      <StylePanel
        isOpen={isStylePanelOpen}
        onClose={() => setIsStylePanelOpen(false)}
        onSelectStyle={handleSelectStyle}
        selectedLoraIds={selectedLoras.map(lora => lora.info.id)}
      />

      <div className={`fixed z-40 right-4 bottom-4 w-64 panel overflow-y-auto ${isDebugMode ? 'right-80' : ''}`}>
        <h3 className="text-lg font-medium mb-3 text-white">Render</h3>

        <div className="flex flex-col items-center">
          {/* Debug image */}
          {/* <button
          onClick={() => generateDebugImage()}
          className="mb-4 px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
        >
          Generate Debug Image
        </button> */}
          {/* {debugImage && (
          <div className="w-full aspect-square bg-gray-700 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
            <img src={debugImage} alt="Debug" className="w-full h-full object-contain" />
          </div>
        )} */}

          {/* Preview image or placeholder */}
          <div className="w-full aspect-square bg-gray-700 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
            {isLoading ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full w-12 border-t-2 border-b-2 border-blue-500 mb-3"></div>
                <p className="text-gray-400">Generating AI preview...</p>
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="Scene Preview"
                className="w-full h-full object-contain cursor-pointer"
                onClick={() => {
                  if (previewUrl) {
                    window.open(previewUrl, '_blank');
                  }
                }}
              />
            ) : (
              <div className="text-gray-500 flex flex-col items-center">
                <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p>No preview available</p>
              </div>
            )}
          </div>

          {/* Styles section */}
          <div className="w-full mb-4">
            <label className="block text-sm text-gray-400 mb-2">Style</label>
            {renderSelectedStyles()}
          </div>

          {/* Strength slider */}
          <div className="w-full mb-4">
            <div className="flex justify-between items-center">
              <label className="block text-sm text-gray-400 mb-1">Creativity</label> <span className="text-xs text-gray-200"> {promptStrength.toFixed(2)}</span>
              {/* <span className="text-xs text-gray-500">{promptStrength < 0.4 ? 'More accurate' : promptStrength > 0.7 ? 'More creative' : 'Balanced'}</span> */}
            </div>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={promptStrength}
              onChange={(e) => setPromptStrength(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Source</span>
              <span>creative</span>
            </div>
          </div>

          {/* Client-side noise slider */}
          {/* <div className="w-full mb-4">
          <div className="flex justify-between items-center">
            <label className="block text-sm text-gray-400 mb-1">Image Noise: {noiseStrength.toFixed(2)}</label>
            <span className="text-xs text-gray-500">
              {noiseStrength === 0 ? 'None' : noiseStrength < 0.3 ? 'Subtle' : noiseStrength < 0.6 ? 'Medium' : 'Strong'}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={noiseStrength}
            onChange={(e) => setNoiseStrength(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Clean image</span>
            <span>Noisy image</span>
          </div>
        </div> */}

          {/* Prompt input */}
          <div className="w-full mb-4">
            <label className="block text-sm text-gray-400 mb-1">Render Prompt </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full p-2 border-b-2 border-gray-600 text-white text-sm focus:outline-none focus:bg-gray-700"
              rows={3}
              placeholder="Describe how you want the scene to look..."
            />
          </div>

          {/* Execution time */}
          {executionTime && (
            <div className="w-full mb-4">
              <div className="flex justify-between items-center">
                <label className="block text-sm text-gray-400 mb-1">Execution Time: {(executionTime / 1000).toFixed(2)} s</label>
              </div>
            </div>
          )}

          {/* Model selection */}
          <div className="w-full mb-4">
            <label className="block text-sm text-gray-400 mb-1">Model</label>
            <div className="grid grid-cols-2 gap-2">
              {availableModels.map((aiModel) => (
                <button
                  key={aiModel.id}
                  onClick={() => setModel(aiModel.id)}
                  className={`py-2 px-3 text-xs rounded-md ${model === aiModel.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                >
                  {aiModel.name}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 w-full">
            <button
              onClick={handleRender}
              disabled={isLoading}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Rendering...' : 'Render'}
              <span className="mx-1 text-xs opacity-50">Ctrl+⏎</span>
            </button>

          </div>
        </div>
      </div>
    </>
  );
};

export default RenderPanel; 
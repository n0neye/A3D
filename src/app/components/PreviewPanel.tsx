import React, { useState, useRef } from 'react';
import { RenderEngine } from '../lib/renderEngine';
import { generatePreviewImage, dataURLtoBlob } from '../util/image-api';
import { addNoiseToImage, resizeImage } from '../util/image-processing';

interface PreviewPanelProps {
  renderEngine: RenderEngine | null;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({ 
  renderEngine,
}) => {
  // State variables
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>('a brutalism architecture in the forest, photorealistic');
  const [strength, setStrength] = useState<number>(0.9); // Default to 0.7 strength
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const [debugImage, setDebugImage] = useState<string | null>(null);
  const [noiseStrength, setNoiseStrength] = useState<number>(0.6); // Default to 0 (no noise)
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  const generateDebugImage = async () => {
    if (!renderEngine) return;
    try {
      // Force a fresh render
      const screenshot = await renderEngine.generateScreenshot();
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

  // Generate a preview using image-to-image API
  const handleGeneratePreview = async () => {
    if (!renderEngine) return;
    
    setIsLoading(true);
    setExecutionTime(null); // Reset execution time when starting new generation
    
    try {
      // First, take a screenshot of the current scene
      const screenshot = await renderEngine.generateScreenshot();
      
      // Store the original screenshot
      setDebugImage(screenshot);
      
      // Apply noise to the screenshot if noiseStrength > 0
      let processedImage = screenshot;
      if (noiseStrength > 0) {
        processedImage = await addNoiseToImage(screenshot, noiseStrength);
      }

      // Update the debug image with the processed image
      setDebugImage(processedImage);
      
      // Resize the image to 512x512 before sending to API
      const resizedImage = await resizeImage(processedImage, 512, 512);
      
      // Convert the resized image to blob for API
      const imageBlob = dataURLtoBlob(resizedImage);
      
      // Start measuring time
      const startTime = Date.now();
      
      // Call the fal.ai API for image-to-image generation
      const result = await generatePreviewImage({
        imageUrl: imageBlob,
        prompt: prompt,
        strength: strength,
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

  // Download the current preview
  const handleDownloadPreview = () => {
    if (!previewUrl) return;
    
    // Create a download link
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = `scene-preview-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id='preview-panel' className={`p-4 bg-black bg-opacity-80 rounded-lg border border-gray-700 shadow-lg`}>
      <h3 className="text-lg font-medium mb-3 text-white">Scene Preview</h3>
      
      <div className="flex flex-col items-center">
        {/* Debug image */}
        <button 
          onClick={() => generateDebugImage()}
          className="mb-4 px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
        >
          Generate Debug Image
        </button>
        {debugImage && (
          <div className="w-full aspect-square bg-gray-700 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
            <img src={debugImage} alt="Debug" className="w-full h-full object-contain" />
          </div>
        )}
        
        {/* Preview image or placeholder */}
        <div className="w-full aspect-square bg-gray-700 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-3"></div>
              <p className="text-gray-400">Generating AI preview...</p>
            </div>
          ) : previewUrl ? (
            <img 
              src={previewUrl} 
              alt="Scene Preview" 
              className="w-full h-full object-contain"
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
        
        {/* Strength slider */}
        <div className="w-full mb-4">
          <div className="flex justify-between items-center">
            <label className="block text-sm text-gray-400 mb-1">Strength: {strength.toFixed(2)}</label>
            <span className="text-xs text-gray-500">{strength < 0.4 ? 'More accurate' : strength > 0.7 ? 'More creative' : 'Balanced'}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={strength}
            onChange={(e) => setStrength(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Closer to source</span>
            <span>More creative</span>
          </div>
        </div>
        
        {/* Client-side noise slider */}
        <div className="w-full mb-4">
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
        </div>
        
        {/* Prompt input */}
        <div className="w-full mb-4">
          <label className="block text-sm text-gray-400 mb-1">Prompt for AI generation</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm"
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
        
        {/* Action buttons */}
        <div className="flex gap-2 w-full">
          <button
            onClick={handleGeneratePreview}
            disabled={isLoading}
            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating...' : 'Generate AI Preview'}
          </button>
          
          {previewUrl && (
            <button
              onClick={handleDownloadPreview}
              className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Download
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreviewPanel; 
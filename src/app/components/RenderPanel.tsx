import React, { useState, useRef, useEffect } from 'react';
import { renderImage as generateRenderImage, dataURLtoBlob, availableAPIs, API_Info } from '../util/image-render-api';
import { addNoiseToImage, resizeImage } from '../util/image-processing';
import { useEditorContext } from '../context/EditorContext';
import * as BABYLON from '@babylonjs/core';
import StylePanel from './StylePanel';
import { LoraConfig, LoraInfo } from '../util/lora';
import { IconDownload, IconRefresh, IconDice } from '@tabler/icons-react';
import { convertTextureToImage, EnableDepthRender, GetDepthMap, TakeScreenshot } from '../util/render-util';

// Import Shadcn components
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const RenderPanel = ({ isDebugMode }: { isDebugMode: boolean }) => {
  const { scene, engine } = useEditorContext();
  // State variables
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  // Inputs
  const [prompt, setPrompt] = useState<string>('flooded office, fire, dark night, a female warrior with a spear');
  const [promptStrength, setPromptStrength] = useState<number>(0.9); // Default to 0.7 strength
  const [depthStrength, setDepthStrength] = useState<number>(0.9); // Default to 0.7 strength
  const [noiseStrength, setNoiseStrength] = useState<number>(0); // Default to 0 (no noise)
  const [selectedAPI, setSelectedAPI] = useState<API_Info>(availableAPIs[0]);
  const [seed, setSeed] = useState<number>(Math.floor(Math.random() * 2147483647));
  const [useRandomSeed, setUseRandomSeed] = useState<boolean>(false);

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
  }, [prompt, promptStrength, noiseStrength, selectedAPI, selectedLoras]); // Re-create handler when these dependencies change

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
        <Button 
          variant="outline" 
          className="w-full h-16 border-dashed" 
          onClick={() => setIsStylePanelOpen(true)}
        >
          <span className="text-muted-foreground">Click to add a style</span>
        </Button>
      );
    }

    return (
      <div className="space-y-3">
        {selectedLoras.map(loraConfig => (
          <Card key={loraConfig.info.id} className="bg-card border-border p-1 flex flex-row items-center">
            <div className="h-14 w-14 mr-2 overflow-hidden rounded">
              <img
                src={loraConfig.info.thumbUrl}
                alt={loraConfig.info.name}
                className="object-cover w-full h-full"
              />
            </div>

            <div className="flex flex-col max-w-[140px] flex-grow">
              {/* Title and remove button */}
              <div className="flex items-center mb-2 h-6">
                <span className="text-sm font-medium truncate max-w-[120px] text-ellipsis">
                  {loraConfig.info.name}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="p-0 h-6 w-6 ml-auto"
                  onClick={() => handleRemoveStyle(loraConfig.info.id)}
                >
                  &times;
                </Button>
              </div>

              {/* Strength slider */}
              <div className="flex items-center gap-2">
                <Slider
                  defaultValue={[loraConfig.strength]}
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={[loraConfig.strength]}
                  onValueChange={(values) => handleUpdateStyleStrength(loraConfig.info.id, values[0])}
                  className="flex-grow max-w-[115px]"
                />
                <span className="text-xs w-8 text-right">{loraConfig.strength.toFixed(2)}</span>
              </div>
            </div>
          </Card>
        ))}

        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => setIsStylePanelOpen(true)}
        >
          Add
        </Button>
      </div>
    );
  };


  const generateDebugImage = async () => {
    try {
      // Force a fresh render
      if (!scene || !engine) throw new Error("Scene or engine not found");
      const screenshot = await TakeScreenshot(scene, engine);
      if (!screenshot) throw new Error("Failed to take screenshot");
      console.log("Screenshot generated:", screenshot?.substring(0, 100) + "...");
      setImageUrl(screenshot);
      // Apply noise to the screenshot if noiseStrength > 0
      let processedImage = screenshot;
      if (noiseStrength > 0) {
        processedImage = await addNoiseToImage(screenshot, noiseStrength);
      }
      setImageUrl(processedImage);

    } catch (error) {
      console.error("Error in debug image:", error);
    }
  };


  const generateNewSeed = () => {
    const newSeed = Math.floor(Math.random() * 2147483647);
    setSeed(newSeed);
    return newSeed;
  };

  const handleRender = async () => {
    setIsLoading(true);
    setExecutionTime(null); // Reset execution time when starting new generation

    try {
      // First, take a screenshot of the current scene
      if (!scene || !engine) throw new Error("Scene or engine not found");
      const screenshot = await TakeScreenshot(scene, engine);
      if (!screenshot) throw new Error("Failed to take screenshot");

      // Store the original screenshot
      setImageUrl(screenshot);

      // Apply noise to the screenshot if noiseStrength > 0
      let processedImage = screenshot;
      if (noiseStrength > 0) {
        processedImage = await addNoiseToImage(screenshot, noiseStrength);
      }

      // Update the debug image with the processed image
      setImageUrl(processedImage);

      // Resize the image to 512x512 before sending to API
      const resizedImage = await resizeImage(processedImage, 1280, 720);

      // Convert the resized image to blob for API
      const imageBlob = dataURLtoBlob(resizedImage);

      // Start measuring time
      const startTime = Date.now();

      if (!scene || !engine) throw new Error("Scene or engine not found");
      let depthImageBlob = undefined;
      if (selectedAPI.useDepthImage) {
        depthImageBlob = await EnableDepthRender(scene, engine, 1) || undefined;
      }

      // If useRandomSeed is true, generate a new seed for this render
      const currentSeed = useRandomSeed ? generateNewSeed() : seed;

      // Call the API with the selected model and seed
      const result = await generateRenderImage({
        imageUrl: imageBlob,
        prompt: prompt,
        promptStrength: promptStrength,
        modelApiInfo: selectedAPI,
        seed: currentSeed,
        width: 1280,
        height: 720,
        // Optional
        loras: selectedLoras,
        depthImageUrl: depthImageBlob,
        depthStrength: selectedAPI.useDepthImage ? depthStrength : 0,
      });

      // Calculate execution time
      const endTime = Date.now();
      setExecutionTime(endTime - startTime);

      // Update the preview with the generated image
      setImageUrl(result.imageUrl);
    } catch (error) {
      console.error("Error generating preview:", error);
      alert("Failed to generate preview. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const OnEnableDepthRender = async () => {
    if (!scene || !engine) throw new Error("Scene or engine not found");
    const depthSnapshot = await EnableDepthRender(scene, engine);
    if (!depthSnapshot) throw new Error("Failed to generate depth map");
    setImageUrl(depthSnapshot);
  }

  const onGetDepthMap = async () => {
    if (!scene || !engine) throw new Error("Scene or engine not found");
    const depthSnapshot = await GetDepthMap(scene, engine);
    if (!depthSnapshot) throw new Error("Failed to generate depth map");
    setImageUrl(depthSnapshot);
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

      <Card className={`fixed panel-shape z-40 right-4 bottom-4 w-64 border-border max-h-[90vh] overflow-y-auto gap-2 ${isDebugMode ? 'right-80' : ''}`}>
        <CardHeader className="">
          <CardTitle className="text-lg font-medium">Render</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Preview image or placeholder */}
          <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden group relative">
            {isLoading ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full w-12 border-t-2 border-b-2 border-primary mb-3"></div>
                <p className="text-muted-foreground">Generating AI preview...</p>
              </div>
            ) : imageUrl ? (
              <>
                <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                  <img
                    src={imageUrl}
                    alt="Scene Preview"
                    className="w-full h-full object-contain cursor-pointer"
                  />
                </a>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  onClick={() => {
                    if (!imageUrl) return;
                    const a = document.createElement('a');
                    a.href = imageUrl;
                    a.download = imageUrl.split('/').pop() || 'image.png';
                    a.click();
                  }}
                >
                  <IconDownload size={16} />
                </Button>

                {/* Execution time */}
                {executionTime && (
                  <div className="w-full mb-1 absolute bottom-0 left-0 bg-black/50 py-1">
                    <div className="flex justify-center items-center">
                      <span className="text-xs text-white/80">{(executionTime / 1000).toFixed(2)} s</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-muted-foreground flex flex-col items-center">
                <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p>No preview available</p>
              </div>
            )}
          </div>

          {/* Styles section */}
          <div>
            <Label className="text-sm mb-2 block">Style</Label>
            {renderSelectedStyles()}
          </div>

          {/* Prompt Strength slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm">Creativity</Label>
              <span className="text-xs">{promptStrength.toFixed(2)}</span>
            </div>
            <Slider
              defaultValue={[promptStrength]}
              min={0.1}
              max={1}
              step={0.05}
              value={[promptStrength]}
              onValueChange={(values) => setPromptStrength(values[0])}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Source</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Depth Strength slider */}
          {selectedAPI.useDepthImage && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <Label className="text-sm">Depth Strength</Label>
                <span className="text-xs">{depthStrength.toFixed(2)}</span>
              </div>
              <Slider
                defaultValue={[depthStrength]}
                min={0.1}
                max={1}
                step={0.05}
                value={[depthStrength]}
                onValueChange={(values) => setDepthStrength(values[0])}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Source</span>
                <span>Creative</span>
              </div>
            </div>
          )}

          {/* Prompt input */}
          <div>
            <Label className="text-sm mb-2 block">Render Prompt</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="resize-none"
              rows={3}
              placeholder="Describe how you want the scene to look..."
            />
          </div>

          {/* Seed input */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm">Seed</Label>
            </div>
            <div className="flex items-center">
              <Input
                type="number"
                value={seed}
                onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
                disabled={useRandomSeed}
                className="rounded-r-none"
              />
              <Button
                variant="secondary"
                size="icon"
                onClick={generateNewSeed}
                disabled={useRandomSeed}
                className="rounded-l-none rounded-r-none h-10 w-10"
                title="Generate new seed"
              >
                <IconRefresh size={16} />
              </Button>
              <Button
                variant={useRandomSeed ? "default" : "secondary"}
                size="icon"
                onClick={() => setUseRandomSeed(!useRandomSeed)}
                className="rounded-l-none h-10 w-10"
                title={useRandomSeed ? "Using random seed" : "Using fixed seed"}
              >
                <IconDice size={16} />
              </Button>
            </div>
          </div>

          {/* Model selection */}
          <div>
            <Label className="text-sm mb-2 block">Model</Label>
            <div className="grid grid-cols-2 gap-2">
              {availableAPIs.map((aiModel) => (
                <Button
                  key={aiModel.id}
                  variant={selectedAPI.id === aiModel.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedAPI(aiModel)}
                  className="w-full overflow-ellipsis text-xs"
                >
                  {aiModel.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Debug Tools */}
          { (
            <div>
              <Label className="text-sm mb-2 block">Debug Tools</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateDebugImage}
                >
                  Scene Image
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onGetDepthMap}
                >
                  Get Depth
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={OnEnableDepthRender}
                >
                  Show Depth
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <Button
            variant="default"
            size="lg"
            onClick={handleRender}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? 'Rendering...' : 'Render'}
            <span className="ml-2 text-xs opacity-70">Ctrl+⏎</span>
          </Button>
        </CardContent>
      </Card>
    </>
  );
};

export default RenderPanel; 
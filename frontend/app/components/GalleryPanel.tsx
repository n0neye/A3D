'use client';

import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { IconArrowLeft, IconArrowRight, IconX, IconDownload } from '@tabler/icons-react';
import { downloadImage } from '../engine/utils/helpers';
import { IRenderLog } from '@/engine/interfaces/rendering';
import { useEditorEngine } from '../context/EditorEngineContext';
import { API_Info, availableAPIs } from '../engine/utils/generation/image-render-api';

const GalleryPanel: React.FC = () => {
  // State for the component
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [galleryLogs, setGalleryLogs] = useState<IRenderLog[]>([]);
  
  // Get engine from context
  const { engine } = useEditorEngine();

  // Subscribe to renderLogsChanged event directly from ProjectManager
  useEffect(() => {
    // When component mounts, get initial render logs
    setGalleryLogs(engine.getProjectManager().getRenderLogs() || []);
    
    // Subscribe to renderLogsChanged event
    const unsubscribe = engine.getProjectManager().observers.subscribe(
      'renderLogsChanged', 
      ({ renderLogs, isNewRenderLog }) => {
        setGalleryLogs(renderLogs);
        
        // Only open gallery if this is a new render log and settings say to open
        if (isNewRenderLog && renderLogs.length > 0) {
          const settings = engine.getProjectManager().getRenderSettings();
          if (settings.openOnRendered) {
            setCurrentIndex(renderLogs.length - 1);
            setIsOpen(true);
          }
        }
      }
    );
    
    // Clean up subscription when component unmounts
    return () => unsubscribe();
  }, [engine]);

  // Custom function to open gallery programmatically
  function openGallery(index?: number) {
    if (galleryLogs.length === 0) return;
    
    const targetIndex = index !== undefined 
      ? Math.min(Math.max(0, index), galleryLogs.length - 1) 
      : galleryLogs.length - 1;
    
    setCurrentIndex(targetIndex);
    setIsOpen(true);
  }

  // Make openGallery accessible outside
  React.useEffect(() => {
    window.openGallery = openGallery;
    return () => {
      delete window.openGallery;
    };
  }, [galleryLogs.length]);

  // Close gallery
  const closeGallery = () => setIsOpen(false);

  const navigateImages = (direction: number) => {
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = galleryLogs.length - 1;
    if (newIndex >= galleryLogs.length) newIndex = 0;
    setCurrentIndex(newIndex);
  };

  const handleApplySettings = () => {
    if (galleryLogs.length === 0 || currentIndex >= galleryLogs.length) return;
    
    // Apply settings from the selected render log
    engine.getProjectManager().updateRenderSettings({
      prompt: galleryLogs[currentIndex].prompt,
      seed: galleryLogs[currentIndex].seed,
      promptStrength: galleryLogs[currentIndex].promptStrength,
      depthStrength: galleryLogs[currentIndex].depthStrength,
      selectedLoras: galleryLogs[currentIndex].selectedLoras || [],
      // Find the API by name
      selectedAPI: availableAPIs.find((api: API_Info) => api.name === galleryLogs[currentIndex].model)?.id
    });
    
    // Close the gallery panel
    closeGallery();
  };

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        navigateImages(-1);
      } else if (e.key === 'ArrowRight') {
        navigateImages(1);
      } else if (e.key === 'Escape') {
        closeGallery();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, galleryLogs.length]);

  if (!isOpen || galleryLogs.length === 0) return null;

  const currentImage = galleryLogs[currentIndex];

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-black/50">
        <div></div>
        <Button variant="ghost" size="icon" onClick={closeGallery} className="text-white">
          <IconX size={24} />
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Image display */}
        <div className="flex-1 flex items-center justify-center p-4 relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white"
            onClick={() => navigateImages(-1)}
          >
            <IconArrowLeft size={24} />
          </Button>

          <div className="relative max-h-full max-w-full">
              <img
                src={currentImage.imageUrl}
                alt="Generated image"
                className="max-h-[70vh] min-h-[720px] max-w-full object-contain aspect-video"
              />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => {
                downloadImage(currentImage.imageUrl, `render-${new Date().toISOString()}.png`);
              }}
            >
              <IconDownload size={20} />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white"
            onClick={() => navigateImages(1)}
          >
            <IconArrowRight size={24} />
          </Button>
        </div>

        {/* Info panel */}
        <div className="w-full md:w-80 p-4 overflow-y-auto flex flex-col justify-center items-center">
          <div className="space-y-4 w-full">
            <div>
              <h3 className="text-white text-sm font-medium mb-1">Date</h3>
              <p className="text-gray-300 text-sm">{currentImage.timestamp.toLocaleString()}</p>
            </div>

            <div>
              <h3 className="text-white text-sm font-medium mb-1">Model</h3>
              <p className="text-gray-300 text-sm">{currentImage.model}</p>
            </div>

            <div>
              <h3 className="text-white text-sm font-medium mb-1">Prompt</h3>
              <p className="text-gray-300 text-sm">{currentImage.prompt}</p>
            </div>

            {currentImage.seed !== undefined && (
              <div>
                <h3 className="text-white text-sm font-medium mb-1">Seed</h3>
                <p className="text-gray-300 text-sm">{currentImage.seed}</p>
              </div>
            )}

            {currentImage.promptStrength !== undefined && (
              <div>
                <h3 className="text-white text-sm font-medium mb-1">Creativity</h3>
                <p className="text-gray-300 text-sm">{currentImage.promptStrength.toFixed(2)}</p>
              </div>
            )}

            {currentImage.depthStrength !== undefined && currentImage.depthStrength > 0 && (
              <div>
                <h3 className="text-white text-sm font-medium mb-1">Depth Strength</h3>
                <p className="text-gray-300 text-sm">{currentImage.depthStrength.toFixed(2)}</p>
              </div>
            )}

            {currentImage.selectedLoras && currentImage.selectedLoras.length > 0 && (
              <div>
                <h3 className="text-white text-sm font-medium mb-1">Styles</h3>
                <div className="text-gray-300 text-sm">
                  {currentImage.selectedLoras.map((lora: any, idx: number) => (
                    <div key={idx} className="flex justify-between">
                      <span>{lora.info.name}</span>
                      <span>{lora.strength.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Apply Settings Button - add at bottom of info panel */}
            <div className="pt-4">
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleApplySettings}
              >
                Apply Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Thumbnail grid */}
      <div className="p-2 bg-black/70">
        <div className="flex overflow-x-auto gap-2 p-2 justify-center items-center">
          {galleryLogs.map((image, idx) => (
            <div
              key={idx}
              className={`relative cursor-pointer flex-shrink-0 ${idx === currentIndex ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setCurrentIndex(idx)}
            >
              <img
                src={image.imageUrl}
                alt={`Thumbnail ${idx}`}
                className="w-24 h-16 object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Add type declaration for window
declare global {
  interface Window {
    openGallery?: (index?: number) => void;
  }
}

export default GalleryPanel; 
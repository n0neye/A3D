'use client';

import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { IconArrowLeft, IconArrowRight, IconX, IconDownload } from '@tabler/icons-react';

export interface GalleryImage {
  imageUrl: string;
  prompt: string;
  model: string;
  timestamp: Date;
  seed?: number;
  promptStrength?: number;
  depthStrength?: number;
  selectedLoras?: any[];
}

interface GalleryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  images: GalleryImage[];
  currentIndex: number;
  onSelectImage: (index: number) => void;
}

const GalleryPanel: React.FC<GalleryPanelProps> = ({
  isOpen,
  onClose,
  images,
  currentIndex,
  onSelectImage,
}) => {
  const [localIndex, setLocalIndex] = useState(currentIndex);
  
  useEffect(() => {
    setLocalIndex(currentIndex);
  }, [currentIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        navigateImages(-1);
      } else if (e.key === 'ArrowRight') {
        navigateImages(1);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, localIndex, images.length]);

  const navigateImages = (direction: number) => {
    let newIndex = localIndex + direction;
    if (newIndex < 0) newIndex = images.length - 1;
    if (newIndex >= images.length) newIndex = 0;
    
    setLocalIndex(newIndex);
    onSelectImage(newIndex);
  };

  if (!isOpen || images.length === 0) return null;

  const currentImage = images[localIndex];

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-black/50">
        {/* <h2 className="text-white text-xl">Generated Images ({localIndex + 1}/{images.length})</h2> */}
        <div></div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white">
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
              className="max-h-[70vh] max-w-full object-contain"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => {
                const a = document.createElement('a');
                a.href = currentImage.imageUrl;
                a.download = `render-${new Date().toISOString()}.png`;
                a.click();
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
          <div className="space-y-4">
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
          </div>
        </div>
      </div>

      {/* Thumbnail grid */}
      <div className="p-2 bg-black/70">
        <div className="flex overflow-x-auto gap-2 p-2 justify-center items-center">
          {images.map((image, idx) => (
            <div 
              key={idx} 
              className={`relative cursor-pointer flex-shrink-0 ${idx === localIndex ? 'ring-2 ring-primary' : ''}`}
              onClick={() => {
                setLocalIndex(idx);
                onSelectImage(idx);
              }}
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

export default GalleryPanel; 
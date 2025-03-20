import React, { useRef, useEffect, useState } from 'react';
import { CivitaiResponse, getAllLoraInfo } from '../util/lora';

// Define SelectedLora interface
export interface SelectedLora {
  id: string;
  name: string;
  imageUrl: string;
  strength: number;
  modelUrl: string;
}

interface StylePanelProps {
  selectedLoras: SelectedLora[];
  onSelectLora: (lora: SelectedLora) => void;
  onRemoveLora: (id: string) => void;
  onUpdateStrength: (id: string, strength: number) => void;
}

const StylePanel: React.FC<StylePanelProps> = ({
  selectedLoras,
  onSelectLora,
  onRemoveLora,
  onUpdateStrength
}) => {
  const [isStylePanelOpen, setIsStylePanelOpen] = useState<boolean>(false);
  const [availableStyles, setAvailableStyles] = useState<CivitaiResponse[]>([]);
  const stylePanelRef = useRef<HTMLDivElement>(null);

  // Load available styles
  useEffect(() => {
    const loadStyles = async () => {
      try {
        const loraInfo = await getAllLoraInfo();
        setAvailableStyles(loraInfo);
      } catch (error) {
        console.error("Error loading LoRA styles:", error);
      }
    };
    
    loadStyles();
  }, []);

  // Handle clicking outside the style panel to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (stylePanelRef.current && !stylePanelRef.current.contains(event.target as Node)) {
        setIsStylePanelOpen(false);
      }
    };

    if (isStylePanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStylePanelOpen]);

  // Function to select a style
  const selectStyle = (style: CivitaiResponse) => {
    const image = style.modelVersions[0].images[0];
    const newLora: SelectedLora = {
      id: style.id.toString(),
      name: style.name,
      imageUrl: image.url,
      strength: 0.7, // Default strength
      modelUrl: style.modelVersions[0].downloadUrl,
    };
    
    // Check if this style is already selected
    if (!selectedLoras.some(lora => lora.id === newLora.id)) {
      onSelectLora(newLora);
    }
    
    // Close the panel after selection
    setIsStylePanelOpen(false);
  };

  // Render the styles panel
  const renderStylesPanel = () => {
    if (!isStylePanelOpen) return null;

    return (
      <div 
        className="absolute left-0 right-0 bg-gray-800 p-4 rounded-lg shadow-lg max-h-96 overflow-y-auto z-10"
        ref={stylePanelRef}
      >
        <h4 className="text-white font-medium mb-4">Select a Style</h4>
        <div className="grid grid-cols-2 gap-3">
          {availableStyles.map(style => {
            // Get the first image from the first model version
            const image = style.modelVersions[0].images[0];
            return (
              <div 
                key={style.id} 
                className="flex flex-col bg-gray-700 rounded-md overflow-hidden cursor-pointer hover:bg-gray-600 transition"
                onClick={() => selectStyle(style)}
              >
                <div className="aspect-square overflow-hidden">
                  <img 
                    src={image.url} 
                    alt={style.name} 
                    className="object-cover w-full h-full"
                  />
                </div>
                <div className="p-2">
                  <h5 className="text-white text-sm font-medium truncate">{style.name}</h5>
                  <p className="text-gray-400 text-xs truncate">by {style.creator.username}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render selected styles
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
        {selectedLoras.map(lora => (
          <div key={lora.id} className="bg-gray-700 rounded-md p-2">
            <div className="flex items-center mb-2">
              <div className="h-10 w-10 mr-2 overflow-hidden rounded">
                <img 
                  src={lora.imageUrl} 
                  alt={lora.name} 
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="flex-grow">
                <h5 className="text-white text-sm font-medium truncate">{lora.name}</h5>
              </div>
              <button 
                className="text-gray-400 hover:text-red-500 p-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveLora(lora.id);
                }}
              >
                &times;
              </button>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400">Strength:</span>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={lora.strength}
                onChange={(e) => {
                  e.stopPropagation();
                  onUpdateStrength(lora.id, parseFloat(e.target.value));
                }}
                className="flex-grow h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-300 w-8 text-right">{lora.strength.toFixed(1)}</span>
            </div>
          </div>
        ))}
        
        <button 
          className="w-full p-2 text-sm bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600"
          onClick={(e) => {
            e.stopPropagation();
            setIsStylePanelOpen(true);
          }}
        >
          Add another style
        </button>
      </div>
    );
  };

  return (
    <div className="w-full relative">
      <label className="block text-sm text-gray-400 mb-2">Style</label>
      {renderSelectedStyles()}
      {renderStylesPanel()}
    </div>
  );
};

export default StylePanel; 
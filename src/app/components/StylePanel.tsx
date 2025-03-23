import React, { useRef, useEffect, useState } from 'react';
import { CivitaiResponse, customLoras, getAllLoraInfo, LoraInfo } from '../util/lora';


interface StylePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStyle: (lora: LoraInfo) => void;
  selectedLoraIds: string[]; // To show which styles are already selected
}

const StylePanel: React.FC<StylePanelProps> = ({
  isOpen,
  onClose,
  onSelectStyle,
  selectedLoraIds
}) => {
  const [availableStyles, setAvailableStyles] = useState<LoraInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load available styles
  useEffect(() => {
    if (availableStyles.length === 0) {
      const loadStyles = async () => {
        try {
          setIsLoading(true);
          let loraInfo = await getAllLoraInfo();
          loraInfo = [...customLoras, ...loraInfo,];
          setAvailableStyles(loraInfo);
        } catch (error) {
          console.error("Error loading LoRA styles:", error);
        } finally {
          setIsLoading(false);
        }
      };

      loadStyles();
    }
  }, []);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Prevent scrolling on body when the panel is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Function to select a style
  const selectStyle = (style: LoraInfo) => {
    onSelectStyle(style);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0  flex items-center justify-center z-50">
      <div className="bg-black opacity-60 absolute inset-0 z-0"></div>
      <div
        ref={panelRef}
        className="relative panel-shape p-0 rounded-lg shadow-lg w-4/5 max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
      >
        <div className="flex justify-between items-center p-4 pl-8 border-b border-gray-700">
          <h3 className="text-lg font-medium text-white">Select a Style</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            &times;
          </button>
        </div>

        <div className="p-8 overflow-y-auto flex-grow">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {availableStyles.map(style => {
                // Get the first image from the first model version
                const isSelected = selectedLoraIds.includes(style.id);

                return (
                  <div
                    key={style.id}
                    className={`flex flex-col bg-gray-700 rounded-md overflow-hidden cursor-pointer 
                      hover:bg-gray-600 transition ${isSelected ? '' : ''}`}
                    onClick={() => !isSelected && selectStyle(style)}
                  >
                    <div className="aspect-square overflow-hidden relative bg-black"
                      style={{ aspectRatio: "2/3" }}>
                      <img
                        src={style.thumbUrl}
                        alt={style.name}
                        className={`object-cover w-full h-full ${isSelected ? 'opacity-50' : ''}`}
                      />
                      {isSelected && (
                        <div className="absolute inset-0  flex items-center justify-center ">
                          <span className=" text-gray-400 px-2 py-1 rounded-md text-xs">Selected</span>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <h5 className="text-white text-sm font-medium truncate">{style.name}</h5>
                      <div className='flex flex-row items-center gap-2 justify-between'>
                        <p className="text-gray-400 text-xs truncate">by {style.author}</p>
                        {/* Info link */}
                        <div onClick={(e) => {
                          e.stopPropagation();
                          window.open(style.linkUrl, '_blank')
                        }} className="text-gray-400 text-xs rounded-lg p-1 px-2 bg-gray-800 hover:bg-gray-700 transition">
                          Info
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StylePanel; 
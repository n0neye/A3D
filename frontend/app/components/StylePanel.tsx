import React, { useRef, useEffect, useState } from 'react';
import { customLoras, getAllLoraInfo } from '@/engine/utils/generation/lora';
import { LoraInfo } from '@/engine/interfaces/rendering';
import { Button } from './ui/button';
import { IconInfoCircle, IconX } from '@tabler/icons-react';
import { Card, CardContent, CardTitle } from './ui/card';


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
  const [availableStylesByCategory, setAvailableStylesByCategory] = useState<Record<string, LoraInfo[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Load available styles
  useEffect(() => {
    if (Object.keys(availableStylesByCategory).length === 0) {
      const loadStyles = async () => {
        try {
          setIsLoading(true);
          const categorizedLoraInfo = await getAllLoraInfo();
          setAvailableStylesByCategory(categorizedLoraInfo);
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
        className="relative panel-shape p-0 rounded-lg shadow-lg w-3/5  max-h-[80vh] overflow-hidden flex flex-col"
      >
        <div className="flex justify-between items-center p-4 pl-8 border-b border-gray-700">
          <h3 className="text-lg font-medium ">Select a Style</h3>
          <Button
            onClick={onClose}
            variant={'ghost'}
            className=''
            size='sm'
          >
            <IconX size={16} />
          </Button>
        </div>

        <div className="p-8 overflow-y-auto flex-grow">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(availableStylesByCategory).map(([category, styles]) => (
                <div key={category}>
                  <h4 className="text-md font-semibold mb-3 ">{category}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {styles.map(style => {
                      const isSelected = selectedLoraIds.includes(style.id);

                      return (
                        <Card
                          key={style.id}
                          className={` pt-0 pb-2 overflow-hidden cursor-pointer gap-1 ${isSelected ? 'opacity-60 cursor-not-allowed' : 'hover:border-blue-500'}`}
                          onClick={() => !isSelected && selectStyle(style)}
                          title={isSelected ? `${style.name} (Selected)` : style.name}
                        >
                          <div className="aspect-square overflow-hidden relative bg-black"
                            style={{ aspectRatio: "4/5" }}>
                            <img
                              src={style.thumbUrl}
                              alt={style.name}
                              className={`object-cover w-full h-full ${isSelected ? 'opacity-50' : ''}`}
                            />
                            {isSelected && (
                              <div className="absolute inset-0  flex items-center justify-center ">
                                <span className="bg-black bg-opacity-70 text-gray-300 px-2 py-1 rounded-md text-xs font-semibold">Selected</span>
                              </div>
                            )}
                          </div>
                          <div className="p-2 flex flex-col justify-start gap-2">
                            <CardTitle className=" text-sm font-medium truncate">{style.name}</CardTitle>
                            <CardContent className='flex flex-col gap-2 px-0'>
                              {/* Author and Info link */}
                              <div className='flex flex-row items-center gap-2'>
                                <p className="text-gray-400 text-xs truncate w-full">by {style.author}</p>
                                {/* Size */}
                                <p className='text-gray-400 text-xs w-20 text-right truncate opacity-60'>{style.sizeKb ? (style.sizeKb / 1024).toFixed(0) + ' MB' : ''}</p>
                                {/* Info link */}
                                <div
                                  // variant={'ghost'}
                                  className='text-gray-400 hover:text-gray-200 cursor-pointer transition-colors'
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(style.linkUrl, '_blank')
                                  }} >
                                  <IconInfoCircle size={16} />
                                </div>
                              </div>
                            </CardContent>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StylePanel; 
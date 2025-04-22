import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getAllLoraInfo } from '@/engine/utils/generation/lora';
import { searchLoras } from '@/engine/utils/generation/civitai-api';
import { LoraInfo } from '@/engine/interfaces/rendering';
import { Button } from './ui/button';
import { IconInfoCircle, IconLoader, IconSearch, IconX } from '@tabler/icons-react';
import { Card, CardContent, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { toast } from 'sonner';


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
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LoraInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadDefaultStyles = useCallback(async () => {
    if (Object.keys(availableStylesByCategory).length === 0) {
      try {
        setIsLoadingDefaults(true);
        const categorizedLoraInfo = await getAllLoraInfo();
        setAvailableStylesByCategory(categorizedLoraInfo);
      } catch (error) {
        console.error("Error loading default LoRA styles:", error);
      } finally {
        setIsLoadingDefaults(false);
      }
    }
  }, [availableStylesByCategory]);

  useEffect(() => {
    if (isOpen) {
      loadDefaultStyles();
    }
  }, [isOpen, loadDefaultStyles]);

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setIsSearching(false);
      setSearchResults([]);
      setIsSearchLoading(false);
      if (Object.keys(availableStylesByCategory).length === 0) {
        loadDefaultStyles();
      }
      return;
    }

    setIsSearching(true);
    setIsSearchLoading(true);
    setSearchResults([]);

    try {
      const results = await searchLoras(query);
      console.log('Search results:', results.length, 'for query:', query, searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error("Error during LoRA search:", error);
       if (searchQuery === query) {
           setSearchResults([]);
       }
       toast.error("Error during LoRA search:", error);
    } finally {
       if (searchQuery === query) {
           setIsSearchLoading(false);
       }
    }
  };

  const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 500);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    } else {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
       if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
    };
  }, [isOpen, onClose]);

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    setIsSearchLoading(false);
    if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
    }
    if (Object.keys(availableStylesByCategory).length === 0) {
      loadDefaultStyles();
    }
  };

  const selectStyle = (style: LoraInfo) => {
    onSelectStyle(style);
    onClose();
  };

  if (!isOpen) return null;

  const isLoading = isLoadingDefaults || isSearchLoading;

  const renderStyleGrid = (styles: LoraInfo[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {styles.map(style => {
        const isSelected = selectedLoraIds.includes(style.id);
        return (
          <Card
            key={style.id}
            className={`pt-0 pb-2 overflow-hidden cursor-pointer gap-1 ${isSelected ? 'opacity-60 cursor-not-allowed' : 'hover:border-blue-500 transition-colors'}`}
            onClick={() => !isSelected && selectStyle(style)}
            title={isSelected ? `${style.name} (Selected)` : style.name}
          >
            <div className="aspect-square overflow-hidden relative bg-black" style={{ aspectRatio: "4/5" }}>
              <img
                src={style.thumbUrl || '/placeholder-image.png'}
                alt={style.name}
                className={`object-cover w-full h-full ${isSelected ? 'opacity-50' : ''}`}
                onError={(e) => (e.currentTarget.src = '/placeholder-image.png')}
              />
              {isSelected && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-black bg-opacity-70 text-gray-300 px-2 py-1 rounded-md text-xs font-semibold">Selected</span>
                </div>
              )}
            </div>
            <div className="p-2 flex flex-col justify-start gap-2">
              <CardTitle className="text-sm font-medium truncate">{style.name}</CardTitle>
              <CardContent className='flex flex-col gap-2 px-0'>
                <div className='flex flex-row items-center gap-2'>
                  <p className="text-gray-400 text-xs truncate w-full">by {style.author}</p>
                  <p className='text-gray-400 text-xs w-20 text-right truncate opacity-60'>{style.sizeKb && style.sizeKb > 0 ? (style.sizeKb / 1024).toFixed(0) + ' MB' : ''}</p>
                  <div
                    className='text-gray-400 hover:text-gray-200 cursor-pointer transition-colors'
                    onClick={(e) => { e.stopPropagation(); window.open(style.linkUrl, '_blank'); }}
                  >
                    <IconInfoCircle size={16} />
                  </div>
                </div>
              </CardContent>
            </div>
          </Card>
        );
      })}
    </div>
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-black opacity-60 absolute inset-0 z-0"></div>
      <div
        ref={panelRef}
        className="relative panel-shape p-0 rounded-lg shadow-lg w-4/5 max-w-5xl max-h-[80vh] overflow-hidden flex flex-col bg-gray-900 border border-gray-700"
      >
        <div className="flex justify-between items-center p-4 pl-8 border-b border-gray-700 gap-4">
          <h3 className="text-lg font-medium text-gray-100 whitespace-nowrap">Select a Style</h3>
          <div className="relative flex-grow mx-4">
            <IconSearch size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <Input
              placeholder="Search for LoRA styles..."
              className="w-full pl-10 pr-10 bg-gray-800 border-gray-600 text-gray-200 focus:border-blue-500 focus:ring-blue-500"
              value={searchQuery}
              onChange={handleSearchInputChange}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-200"
                onClick={clearSearch}
              >
                <IconX size={16} />
              </Button>
            )}
          </div>
          <Button
            onClick={onClose}
            variant={'ghost'}
            className='text-gray-400 hover:text-gray-100'
            size='sm'
          >
            <IconX size={18} />
          </Button>
        </div>

        <div className="p-6 overflow-y-auto flex-grow">
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <IconLoader size={32} className="animate-spin text-blue-500" />
            </div>
          ) : isSearching ? (
            <div>
              <h4 className="text-md font-semibold mb-4 text-gray-300">Search Results for "{searchQuery}"</h4>
              {searchResults.length > 0 ? (
                renderStyleGrid(searchResults)
              ) : (
                <p className="text-gray-500 text-center py-4">No LoRA styles found matching your search.</p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(availableStylesByCategory).map(([category, styles]) => (
                <div key={category}>
                  <h4 className="text-md font-semibold mb-3 text-gray-300">{category}</h4>
                  {renderStyleGrid(styles)}
                </div>
              ))}
              {Object.keys(availableStylesByCategory).length === 0 && !isLoadingDefaults && (
                <p className="text-gray-500 text-center py-4">Could not load default styles.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StylePanel; 
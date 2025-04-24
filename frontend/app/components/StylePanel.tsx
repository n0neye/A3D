import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getAllLoraInfo } from '@/engine/utils/generation/lora';
import { searchLoras } from '@/engine/utils/generation/civitai-api';
import { LoraInfo } from '@/engine/interfaces/rendering';
import { Button } from './ui/button';
import { IconInfoCircle, IconLoader, IconPhotoOff, IconSearch, IconX } from '@tabler/icons-react';
import { Card, CardContent, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { toast } from 'sonner';

// Import shadcn/ui components
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton
import { LoadingSpinner } from './ui/loadingSpinner';


interface StylePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStyle: (lora: LoraInfo) => void;
  selectedLoras: LoraInfo[]; // To show which styles are already selected
}

// Define a consistent number of skeleton items
const SKELETON_COUNT = 10;
const GB_IN_KB = 1024 * 1024; // 1GB in Kilobytes

const StylePanel: React.FC<StylePanelProps> = ({
  isOpen,
  onClose,
  onSelectStyle,
  selectedLoras
}) => {
  const [defaultStyles, setDefaultStyles] = useState<Record<string, LoraInfo[]>>({});
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LoraInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  // No longer need panelRef for click outside, Dialog handles it
  // const panelRef = useRef<HTMLDivElement>(null);

  const loadDefaultStyles = async () => {
    // Prevent loading if already loaded
    if (Object.keys(defaultStyles).length > 0) return;
    try {
      setIsLoadingDefaults(true);
      const categorizedLoraInfo = await getAllLoraInfo();
      setDefaultStyles(categorizedLoraInfo);
    } catch (error) {
      console.error("Error loading default LoRA styles:", error);
      toast.error("Failed to load default styles."); // Notify user
    } finally {
      setIsLoadingDefaults(false);
    }
  }

  useEffect(() => {
    // Load style before dialog opens
    loadDefaultStyles();
  }, []);

  // Load defaults when the dialog opens if they aren't loaded yet
  useEffect(() => {
    // Reset search state when dialog closes
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setIsSearching(false);
      setIsSearchLoading(false);
    }
  }, [isOpen]);

  const performSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      setIsSearching(false);
      setSearchResults([]);
      setIsSearchLoading(false);
      // Don't necessarily reload defaults here, just show them if available
      return;
    }

    setIsSearching(true);
    setIsSearchLoading(true);
    setSearchResults([]);

    try {
      const results = await searchLoras(query);
      setSearchResults(results);
    } catch (error: any) {
      console.error("Error during LoRA search:", error);
      setSearchResults([]);
      toast.error(`Search failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSearchLoading(false);
    }
  };

  const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      performSearch();
    }
  };

  const handleSearchButtonClick = () => {
    performSearch();
  };

  // Clear search and show default categories
  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    setIsSearchLoading(false);
    // Ensure defaults are visible if loaded
  };


  const selectStyle = (style: LoraInfo) => {
    // Calculate size of currently selected LoRAs
    let currentSizeKb = 0;
    selectedLoras.forEach(lora => {
      // Add size only if the LoRA info is found and has a valid sizeKb
      currentSizeKb += lora.sizeKb;
    });

    // Calculate potential new total size (ensure new style size is valid)
    const newStyleSizeKb = (typeof style.sizeKb === 'number' && style.sizeKb > 0) ? style.sizeKb : 0;
    const newPotentialSizeKb = currentSizeKb + newStyleSizeKb;

    // Validate against 1GB limit
    if (newPotentialSizeKb > GB_IN_KB) {
      const currentSizeMb = (currentSizeKb / 1024).toFixed(0);
      const newStyleSizeMb = (newStyleSizeKb / 1024).toFixed(0);
      const totalSizeMb = (newPotentialSizeKb / 1024).toFixed(0);
      toast.error(`Cannot add style: Total size would exceed 1GB (${totalSizeMb}MB).`, {
        description: `Current: ${currentSizeMb}MB + New: ${newStyleSizeMb}MB = ${totalSizeMb}MB`,
        duration: 5000, // Show toast longer
      });
      return; // Stop execution, do not select or close
    }

    // If validation passes:
    onSelectStyle(style);
    onClose(); // Dialog's onOpenChange handles closing
  };

  // --- Rendering Logic ---

  // Skeleton Card for loading states
  const renderSkeletonCard = (key: number) => (
    <div key={key} className="flex flex-col space-y-2">
      <Skeleton className="h-[150px] w-full rounded-md" style={{ aspectRatio: "4/5" }} />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );

  // Grid rendering function (styles or skeletons)
  const renderGrid = (items: LoraInfo[] | null, isLoading: boolean) => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => renderSkeletonCard(index))}
        </div>
      );
    }

    if (!items || items.length === 0) {
      // Handle empty state within the calling component
      return null;
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {items.map(style => {
          const isSelected = selectedLoras.includes(style);
          return (
            <Card
              key={style.id}
              className={`pt-0 pb-2 overflow-hidden cursor-pointer gap-1 transition-opacity ${isSelected ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary'}`} // Use primary color for hover border
              onClick={() => !isSelected && selectStyle(style)}
              title={isSelected ? `${style.name} (Selected)` : style.name}
            >
              <div className="aspect-[4/5] overflow-hidden relative bg-muted"> {/* Use muted background */}
                {style.thumbUrl ? <img
                  src={style.thumbUrl}
                  alt={style.name}
                  className={`object-cover w-full h-full transition-opacity ${isSelected ? 'opacity-50' : ''}`}
                  onError={(e) => (e.currentTarget.src = '/placeholder-image.png')}
                  loading="lazy" // Add lazy loading
                /> : <div className="aspect-[4/5] overflow-hidden relative bg-muted flex items-center justify-center">

                  <IconPhotoOff size={100} className='text-muted-foreground opacity-10' />
                </div>}
                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50"> {/* Darker overlay */}
                    <span className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-xs font-semibold">Selected</span>
                  </div>
                )}
              </div>
              <div className="p-2 flex flex-col justify-start gap-1"> {/* Reduced gap */}
                <CardTitle className="text-sm font-medium truncate">{style.name}</CardTitle>
                <CardContent className='p-0 flex flex-col gap-1 text-xs'> {/* Adjusted padding and text size */}
                  <div className='flex flex-row items-center justify-between gap-2'>
                    <span className="text-muted-foreground truncate">by {style.author}</span>
                    <span className='text-muted-foreground text-right shrink-0'>{style.sizeKb && style.sizeKb > 0 ? (style.sizeKb / 1024).toFixed(0) + ' MB' : ''}</span>
                    <Button
                      variant="ghost"
                      size="icon" // Use icon size for the button
                      className='text-muted-foreground hover:text-foreground h-6 w-6 shrink-0' // Adjusted size and colors
                      onClick={(e) => { e.stopPropagation(); window.open(style.linkUrl, '_blank'); }}
                      title="View on Civitai" // Add title for accessibility
                    >
                      <IconInfoCircle size={14} /> {/* Slightly smaller icon */}
                    </Button>
                  </div>
                </CardContent>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

  const showSearch = false;

  // Dialog component replaces the manual modal structure
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} >
      <DialogContent className="max-w-[90vw] min-w-[50vw] w-full h-[85vh] flex flex-col p-0 gap-0">
        <div className="p-4 pl-6 pr-6 border-b">
          <div className="flex justify-between items-center gap-4">
            <DialogTitle className="text-lg whitespace-nowrap">Style Lora</DialogTitle>
            {/* Search Input Group */}
            {showSearch && <div className="flex flex-grow items-center gap-2 mx-auto max-w-md"> {/* Removed max-w-md */}
              <div className="relative flex-grow">
                <IconSearch size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search on civitai..."
                  className="w-full pl-10 pr-10" // Removed specific bg/border, rely on theme
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  onKeyDown={handleKeyDown}
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground h-auto px-2"
                    onClick={clearSearch}
                    title="Clear search"
                  >
                    <IconX size={16} />
                  </Button>
                )}
              </div>
              <Button
                onClick={handleSearchButtonClick}
                size="sm"
                className="px-4" // Rely on default Button variant
                disabled={isSearchLoading}
              >
                {isSearchLoading ? (
                  <IconLoader size={16} className="animate-spin" />
                ) : (
                  <IconSearch size={16} />
                )}
                <span className="ml-2 hidden sm:inline">Search</span>
              </Button>
            </div>}
            {/* Close button is handled by Dialog overlay click or ESC, but can add one if needed */}
            {/* <DialogTitle> */}

            {/* <Button variant="ghost" size="icon" onClick={onClose} className="ml-auto">
                <IconX size={18} />
              </Button> */}
            {/* </DialogTitle> */}
            <div className='ml-auto'></div>
          </div>
        </div>

        {/* Content Area wrapped in ScrollArea */}
        <div className="flex-grow p-6 overflow-y-scroll"> {/* <--- ScrollArea is used here */}
          {isSearching ? (
            // Display Search Results Area
            <div>
              <h4 className="text-base font-semibold mb-4"> {/* Adjusted text size */}
                Search Results
              </h4>
              {renderGrid(searchResults, isSearchLoading)}
              {!isSearchLoading && searchResults.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No LoRA styles found matching "{searchQuery}".</p>
              )}
            </div>
          ) : (
            // Display Default Categories
            <div className="space-y-6">
              {isLoadingDefaults && Object.keys(defaultStyles).length === 0 && (
                // Show skeletons only on initial load
                // renderGrid(null, true)
                <div className='flex flex-col items-center justify-center h-full'>
                  <LoadingSpinner className='w-10 h-10' />
                </div>
              )}
              {!isLoadingDefaults && Object.entries(defaultStyles).map(([category, styles]) => (
                <div key={category}>
                  <h4 className="text-base font-semibold mb-3">{category}</h4>
                  {renderGrid(styles, false)} {/* Pass false for loading here */}
                </div>
              ))}
              {!isLoadingDefaults && Object.keys(defaultStyles).length === 0 && (
                <p className="text-muted-foreground text-center py-4">Could not load default styles.</p>
              )}
            </div>
          )}
        </div>
        {/* Optional Footer */}
        {/* <DialogFooter className="p-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </DialogFooter> */}
      </DialogContent>
    </Dialog>
  );
};

export default StylePanel; 
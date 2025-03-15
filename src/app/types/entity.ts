// Entity types and metadata structures
export type EntityType = 'aiObject' | 'character' | 'light' | 'skybox' | 'background' | 'terrain';
export type ImageRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
export type ImageSize = 'small' | 'medium' | 'large' | 'xl';

// Map of image sizes to actual dimensions
export const IMAGE_SIZE_MAP = {
  small: 512,
  medium: 768,
  large: 1024,
  xl: 1536
};

// Map of ratios to width/height multipliers
export const RATIO_MAP = {
  '1:1': { width: 1, height: 1 },
  '16:9': { width: 16, height: 9 },
  '9:16': { width: 9, height: 16 },
  '4:3': { width: 4, height: 3 },
  '3:4': { width: 3, height: 4 }
};

// Entity metadata structure
export interface EntityMetadata {
  entityType: EntityType;
  displayName?: string;
  tags?: string[];
  created: Date;
  
  // For AI generated entities
  aiData?: {
    stage: 'image' | '3dModel';
    currentStateId: string | null;
    ratio: ImageRatio;
    imageSize: ImageSize;
    
    generationHistory: Array<{
      id: string;
      timestamp: number;
      prompt: string;
      
      // Asset type and URLs
      assetType: 'image' | 'model';
      imageUrl?: string;
      modelUrl?: string;
      
      // If model is derived from image
      derivedFromId?: string;
      
      // Generation parameters
      ratio: ImageRatio;
      imageSize: ImageSize;
      generationParams?: Record<string, any>;
      
      // User metadata
      notes?: string;
      favorite?: boolean;
    }>;
  };
} 
import { ImageRatio } from "@/engine/utils/imageUtil";
import { StylePromptOptionKey } from "@/engine/entity/types/GenerativeEntity";
// GenerationLog: Represents the one generation step inside a GenerativeEntity, which can be an image or a 3D model. Logs can be derived from another log (eg. image to 3D model), and logs in the same generativeEntity can be applied any time to be displayed.
export interface IGenerationLog {
    id: string;
    timestamp: number;
    prompt: string;
    
    // Asset type and URLs
    assetType: AssetType;
    fileUrl?: string;
    
    // If model is derived from image
    derivedFromId?: string;
    
    // Generation parameters
    imageParams?: {
      negativePrompt?: string;
      stylePrompt?: StylePromptOptionKey;
      ratio: ImageRatio;
    }

    // Child position
    childPosition?: {
        x: number;
        y: number;
        z: number;
    }
  }

  
// Asset types
export type AssetType = 'image' | 'model';
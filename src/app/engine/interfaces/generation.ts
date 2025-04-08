import { ImageRatio } from "@/app/engine/utils/imageUtil";

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
      ratio: ImageRatio;
    }
  }

  
// Asset types
export type AssetType = 'image' | 'model';
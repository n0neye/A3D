import { fal } from "@fal-ai/client";
import * as BABYLON from '@babylonjs/core';
// Types for callbacks and results
export interface GenerationProgress {
  message: string;
  progress?: number;
}

export interface GenerationResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

export type ProgressCallback = (progress: GenerationProgress) => void;

/**
 * Generate an image using the FAL AI API
 * @param prompt The text prompt for image generation
 * @param onProgress Callback function for progress updates
 * @returns Promise with the generation result
 */
export async function generateImage(
  prompt: string, 
  onProgress?: ProgressCallback
): Promise<GenerationResult> {
  try {
    // Progress update
    onProgress?.({ message: 'Starting generation...' });

    // Extend the prompt
    // prompt = `${prompt}, full object, black background, no text, no watermark`;
    prompt = `image of a complete ${prompt} at the center of the frame, uncropped, and entirely visible. Render it against a solid black background, crisp edges, studio lighting`;
    const nagativePrompt = `cropped, out of frame`;

    // Call the FAL AI API
    const result = await fal.subscribe("fal-ai/fast-turbo-diffusion", {
      input: {
        prompt: prompt,
        negative_prompt: nagativePrompt
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          const latestLog = update.logs[update.logs.length - 1]?.message || 'Processing...';
          onProgress?.({ 
            message: latestLog,
            // You could parse progress from logs if available
            progress: estimateProgressFromLogs(update.logs)
          });
        }
      },
    });
    
    // Check for successful result
    if (result.data.images && result.data.images.length > 0) {
      return {
        success: true,
        imageUrl: result.data.images[0].url
      };
    } else {
      return {
        success: false,
        error: 'No images generated'
      };
    }
  } catch (error) {
    console.error("Generation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Estimate progress percentage from logs (simplified implementation)
 */
function estimateProgressFromLogs(logs: any[]): number | undefined {
  if (!logs || logs.length === 0) return undefined;
  
  // Look for step information in logs
  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i];
    if (log.message && typeof log.message === 'string') {
      // Try to extract step information like "Step 15/50"
      const stepMatch = log.message.match(/Step (\d+)\/(\d+)/i);
      if (stepMatch && stepMatch.length === 3) {
        const [_, current, total] = stepMatch;
        return (parseInt(current) / parseInt(total)) * 100;
      }
    }
  }
  
  return undefined;
}

/**
 * Apply a generated image to a mesh in the scene
 */
export function applyImageToMesh(
  mesh: BABYLON.Mesh, 
  imageUrl: string, 
  scene: BABYLON.Scene
): void {
  // Get the existing material or create a new one
  let material = mesh.material as BABYLON.StandardMaterial;
  if (!material || !(material instanceof BABYLON.StandardMaterial)) {
    material = new BABYLON.StandardMaterial("generatedMaterial", scene);
  }
  
  // Create a texture from the image URL
  const texture = new BABYLON.Texture(imageUrl, scene);
  material.diffuseTexture = texture;
  
  // Apply the material to the mesh
  mesh.material = material;
  
  // Update mesh metadata
  mesh.metadata = {
    ...mesh.metadata,
    generatedImage: imageUrl
  };
} 
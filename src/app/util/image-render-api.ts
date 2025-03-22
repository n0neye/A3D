import { fal } from "@fal-ai/client";
import { LoraWeight } from "@fal-ai/client/endpoints";
import { LoraConfig } from "./lora";

// Configure fal.ai client to use the proxy
fal.config({
  proxyUrl: "/api/fal/proxy",
});

export type ModelType = 'fal-turbo' | 'fal-lcm' | 'flux-dev' | 'flux-pro-depth' | 'flux-lora-depth' | 'replicate-lcm';
export interface ImageToImageParams {
  imageUrl: string | Blob;
  prompt: string;
  negativePrompt?: string;
  promptStrength?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
  model?: ModelType;
  loras?: LoraConfig[];
}

export interface AIModel {
  id: ModelType;
  name: string;
  description: string;
}

// Model definitions with descriptions
export const availableModels: AIModel[] = [
  // {
  //   id: 'fal-turbo',
  //   name: 'Fal Turbo',
  //   description: 'Fast general-purpose image-to-image model with good quality'
  // },
  // {
  //   id: 'fal-lcm',
  //   name: 'Fal LCM',
  //   description: 'Very fast Latent Consistency Model, fewer steps needed'
  // },
  // {
  //   id: 'flux-dev',
  //   name: 'Flux Dev',
  //   description: 'Experimental Flux model with creative results'
  // },
  {
    id: 'flux-lora-depth',
    name: 'Flux Dev LoRA Depth',
    description: 'With style transformations'
  },
  {
    id: 'flux-pro-depth',
    name: 'Flux Pro Depth',
    description: 'Heighest quality'
  },
  // {
  //   id: 'replicate-lcm',
  //   name: 'Replicate LCM',
  //   description: 'Alternative LCM implementation via Replicate API'
  // }
];

export interface ImageToImageResult {
  imageUrl: string;
  seed?: number;
  width: number;
  height: number;
}

// Generate image based on the selected model
export async function generatePreviewImage(params: ImageToImageParams): Promise<ImageToImageResult> {
  // Select the appropriate API based on the model parameter
  const model = params.model || 'fal-turbo';

  switch (model) {
    case 'fal-turbo':
      return generateFalTurboImage(params);
    case 'fal-lcm':
      return generateFalLcmImage(params);
    case 'flux-dev':
      return generateFluxDevImage(params);
    case 'flux-pro-depth':
      return generateFluxProDepthImage(params);
    case 'flux-lora-depth':
      return generateFluxLoraDepthImage(params);
    case 'replicate-lcm':
      return generateReplicateLcmImage(params);
    default:
      return generateFalTurboImage(params);
  }
}

// Fal.ai Turbo model (default)
async function generateFalTurboImage(params: ImageToImageParams): Promise<ImageToImageResult> {
  try {
    const result = await fal.subscribe("fal-ai/fast-turbo-diffusion/image-to-image", {
      input: {
        image_url: params.imageUrl,
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || "",
        strength: params.promptStrength,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log("Generation in progress...");
          update.logs?.map((log) => log.message).forEach(console.log);
        }
      },
    });

    return {
      imageUrl: result.data.images[0].url,
      seed: result.data.seed,
      width: result.data.images[0].width || 0,
      height: result.data.images[0].height || 0,
    };
  } catch (error) {
    console.error("Error generating image with fal-turbo:", error);
    throw error;
  }
}

// Fal.ai LCM model
async function generateFalLcmImage(params: ImageToImageParams): Promise<ImageToImageResult> {
  try {
    const result = await fal.subscribe("fal-ai/fast-lcm-diffusion/image-to-image", {
      input: {
        image_url: params.imageUrl,
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || "",
        strength: params.promptStrength || 0.3,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log("Generation in progress...");
          update.logs?.map((log) => log.message).forEach(console.log);
        }
      },
    });

    return {
      imageUrl: result.data.images[0].url,
      seed: result.data.seed,
      width: result.data.images[0].width || 0,
      height: result.data.images[0].height || 0,
    };
  } catch (error) {
    console.error("Error generating image with fal-lcm:", error);
    throw error;
  }
}

// Replicate Latent Consistency Model
async function generateReplicateLcmImage(params: ImageToImageParams): Promise<ImageToImageResult> {
  try {
    // First, convert Blob to base64 if needed
    let imageBase64 = '';
    if (params.imageUrl instanceof Blob) {
      imageBase64 = await blobToBase64(params.imageUrl);
    } else if (typeof params.imageUrl === 'string' && params.imageUrl.startsWith('data:')) {
      imageBase64 = params.imageUrl;
    } else {
      throw new Error('Unsupported image format for Replicate API');
    }

    // Create the prediction
    const createResponse = await fetch('/api/replicate/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: "683d19dc312f7a9f0428b04429a9ccefd28dbf7785fef083ad5cf991b65f406f", // Updated LCM model version
        input: {
          prompt: params.prompt,
          image: imageBase64,
          prompt_strength: params.promptStrength || 0.45, // Using prompt_strength instead of strength
          num_inference_steps: 4, // LCM is fast with few steps
        },
      }),
    });

    const prediction = await createResponse.json();

    if (prediction.error) {
      throw new Error(`Replicate API error: ${prediction.error}`);
    }

    // Poll until the prediction is complete
    const pollInterval = 1000; // 1 second
    let result;

    while (true) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const pollResponse = await fetch(`/api/replicate/proxy?id=${prediction.id}`, {
        method: 'GET',
      });

      result = await pollResponse.json();

      if (result.status === 'succeeded') {
        break;
      } else if (result.status === 'failed') {
        throw new Error(`Replicate prediction failed: ${result.error}`);
      }
      // Otherwise, still processing, continue polling
    }

    return {
      imageUrl: result.output[0], // LCM returns array of image URLs
      width: 512,
      height: 512,
    };
  } catch (error) {
    console.error("Error generating image with replicate-lcm:", error);
    throw error;
  }
}

// Helper to convert a Blob to base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Convert a data URL to a Blob
export function dataURLtoBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new Blob([u8arr], { type: mime });
}

// Add a new function for Flux Dev
async function generateFluxDevImage(params: ImageToImageParams): Promise<ImageToImageResult> {
  try {
    const result = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
      input: {
        image_url: params.imageUrl,
        prompt: params.prompt,
        // Flux Dev might have different parameters than the other models
        // so we're just using the basic ones for now
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log("Flux generation in progress...");
          update.logs?.map((log) => log.message).forEach(console.log);
        }
      },
    });

    return {
      imageUrl: result.data.images[0].url,
      seed: result.data.seed,
      width: result.data.images[0].width || 0,
      height: result.data.images[0].height || 0,
    };
  } catch (error) {
    console.error("Error generating image with flux-dev:", error);
    throw error;
  }
}

// Add a new function for Flux Pro Depth
async function generateFluxProDepthImage(params: ImageToImageParams): Promise<ImageToImageResult> {
  try {

    console.log('generateFluxProDepthImage', params.prompt, params.imageUrl);
    
    const result = await fal.subscribe("fal-ai/flux-pro/v1/depth", {
      input: {
        prompt: params.prompt,
        control_image_url: params.imageUrl, // This model uses control_image_url instead of image_url
        image_size: {
          width: 1280,
          height: 720
        }
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log("Flux Pro Depth generation in progress...");
          update.logs?.map((log) => log.message).forEach(console.log);
        }
      },
    });

    return {
      imageUrl: result.data.images[0].url,
      seed: result.data.seed || 0,
      width: result.data.images[0].width || 0,
      height: result.data.images[0].height || 0,
    };
  } catch (error) {
    console.error("Error generating image with flux-pro-depth:", error);
    throw error;
  }
}
// Add a new function for Flux LoRA Depth
async function generateFluxLoraDepthImage(params: ImageToImageParams): Promise<ImageToImageResult> {
  try {

    const loras: LoraWeight[] = params.loras?.map((lora) => ({
      path: lora.info.modelUrl,
      scale: lora.strength * 2,
      force: true,
    })) || [];

    console.log('generateFluxLoraDepthImage', params.prompt, loras);

    const result = await fal.subscribe("fal-ai/flux-lora-depth", {
      input: {
        prompt: params.prompt,
        image_url: params.imageUrl, // This model uses image_url like the standard
        num_inference_steps: 20,
        image_size: {
          width: 1280,
          height: 720
        },
        loras: loras
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log("Flux LoRA Depth generation in progress...");
          update.logs?.map((log) => log.message).forEach(console.log);
        }
      },
    });

    return {
      imageUrl: result.data.images[0].url,
      seed: result.data.seed || 0,
      width: result.data.images[0].width || 0,
      height: result.data.images[0].height || 0,
    };
  } catch (error) {
    console.error("Error generating image with flux-lora-depth:", error);
    throw error;
  }
}

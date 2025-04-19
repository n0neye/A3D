import { fal } from "@fal-ai/client";
import { LoraWeight } from "@fal-ai/client/endpoints";
import { LoraConfig } from "@/app/engine/interfaces/rendering";
import { blobToBase64 } from "./image-processing";

fal.config({
  // use the proxy in nextjs web app
  // proxyUrl: "/api/fal/proxy",

});

export interface API_Info {
  id: 'fal-turbo' | 'fast-lcm-diffusion' | 'flux-dev' | 'flux-pro-depth' | 'flux-lora-depth' | 'replicate-lcm' | 'fal-ai/flux-control-lora-depth/image-to-image' | 'fal-ai/flux-control-lora-depth';
  provider: 'fal' | 'replicate' | 'runware';
  name: string;
  description: string;
  useDepthImage: boolean;
}

// Model definitions with descriptions
export const availableAPIs: API_Info[] = [
  // {
  //   id: 'fal-turbo',
  //   name: 'Fal Turbo',
  //   description: 'Fast general-purpose image-to-image model with good quality'
  // },
  // {
  //   id: 'fast-lcm-diffusion',
  //   name: 'Fal LCM',
  //   description: 'Very fast Latent Consistency Model, fewer steps needed',
  //   useDepthImage: false,
  // },
  // {
  //   id: 'flux-dev',
  //   name: 'Flux Dev',
  //   description: 'Experimental Flux model with creative results'
  // },
  // {
  //   id: "fal-ai/flux-control-lora-depth/image-to-image",
  //   name: 'LoRA Depth(I2I)',
  //   description: 'With style transformations',
  //   useDepthImage: true,
  // },
  {
    id: 'flux-lora-depth',
    provider: 'fal',
    name: 'Flux Dev',
    description: 'With style transformations',
    useDepthImage: false,
  },
  {
    id: "fal-ai/flux-control-lora-depth",
    provider: 'fal',
    name: 'Flux Dev Depth',
    description: 'With style transformations',
    useDepthImage: true,
  },
  // {
  //   id: 'flux-pro-depth',
  //   name: 'Pro Depth',
  //     description: 'Heighest quality',
  //     useDepthImage: false,
  // },
  // {
  //   id: 'replicate-lcm',
  //   name: 'Replicate LCM',
  //   description: 'Alternative LCM implementation via Replicate API'
  // }
];

export interface ImageToImageParams {
  imageUrl: string | Blob;
  prompt: string;
  modelApiInfo: API_Info;
  seed: number;
  width: number;
  height: number;

  // Optional
  loras?: LoraConfig[];
  negativePrompt?: string;
  promptStrength?: number;
  depthImageUrl?: string | Blob;
  depthStrength?: number;

  // details
  guidanceScale?: number;
  numInferenceSteps?: number;
}

export interface ImageToImageResult {
  imageUrl: string;
  seed?: number;
  width: number;
  height: number;
}

// Generate image based on the selected model
export async function renderImage(params: ImageToImageParams): Promise<ImageToImageResult> {

  console.log('renderImage', params.modelApiInfo.id, params);

  if (!params.negativePrompt) {
    // Split prompt input by "--no"
    const promptParts = params.prompt.split("--no");
    const positivePrompt = promptParts[0];

    let negativePrompt = promptParts[1] ? promptParts[1] + ", " : "";
    negativePrompt += 'watermark, logo';

    console.log("renderImage: promptParts", positivePrompt, "negativePrompt: ", negativePrompt);

    params.negativePrompt = negativePrompt;
    params.prompt = positivePrompt;
  }

  try {

    let result: ImageToImageResult | null = null;
    switch (params.modelApiInfo.id) {
      case 'fal-turbo':
        result = await generateFalTurboImage(params);
        break;
      case 'fast-lcm-diffusion':
        result = await generateFalLcmImage(params);
        break;
      case 'flux-dev':
        result = await generateFluxDevImage(params);
        break;
      case 'flux-pro-depth':
        result = await generateFluxProDepthImage(params);
        break;
      case 'flux-lora-depth':
        result = await generateFluxLoraDepthImage(params);
        break;
      case 'replicate-lcm':
        result = await generateReplicateLcmImage(params);
        break;
      case 'fal-ai/flux-control-lora-depth/image-to-image':
        result = await generateFluxControlLoraDepthI2I(params);
        break;
      case 'fal-ai/flux-control-lora-depth':
        result = await generateFluxControlLoraDepthT2I(params);
        break;
      default:
        result = await generateFalTurboImage(params);
    }
    if (!result) {
      throw new Error('No result from renderImage');
    }
    return result;
  } catch (error) {
    throw new Error("Failed to call " + params.modelApiInfo.provider + " API. Please make sure you have entered a valid API key in the settings,l and enough credits in your account. " + (error as Error).message);
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
          width: params.width,
          height: params.height,
        },
        seed: params.seed,
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
          width: params.width,
          height: params.height
        },
        loras: loras,
        seed: params.seed,
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


async function generateFluxControlLoraDepthI2I(params: ImageToImageParams): Promise<ImageToImageResult> {
  const result = await fal.subscribe("fal-ai/flux-control-lora-depth/image-to-image", {
    input: {
      image_url: params.imageUrl,
      prompt: params.prompt,
      negative_prompt: params.negativePrompt || "text, watermark, logo",
      strength: params.promptStrength,
      image_size: {
        width: params.width,
        height: params.height,
      },
      control_lora_image_url: params.depthImageUrl,
      control_lora_strength: params.depthStrength,
      seed: params.seed,
      loras: params.loras?.map((lora) => ({
        path: lora.info.modelUrl,
        scale: lora.strength * 2,
        force: true,
      })) || [],
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
}

async function generateFluxControlLoraDepthT2I(params: ImageToImageParams): Promise<ImageToImageResult> {
  const result = await fal.subscribe("fal-ai/flux-control-lora-depth", {
    input: {
      prompt: params.prompt,
      negative_prompt: params.negativePrompt || "text, watermark, logo",
      strength: params.promptStrength,
      image_size: {
        width: params.width,
        height: params.height,
      },
      control_lora_image_url: params.depthImageUrl,
      control_lora_strength: params.depthStrength,
      seed: params.seed,
      loras: params.loras?.map((lora) => ({
        path: lora.info.modelUrl,
        scale: lora.strength * 2,
        force: true,
      })) || [],
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
}




// Fal.ai Turbo model (default)
async function generateFalTurboImage(params: ImageToImageParams): Promise<ImageToImageResult> {
  try {
    const result = await fal.subscribe("fal-ai/fast-turbo-diffusion/image-to-image", {
      input: {
        image_url: params.imageUrl,
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || "text, watermark, logo",
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
        strength: params.promptStrength || 0.3,
        seed: params.seed,
        image_size: {
          width: params.width,
          height: params.height,
        },
        negative_prompt: params.negativePrompt || "",
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

// Add a new function for Flux Dev
async function generateFluxDevImage(params: ImageToImageParams): Promise<ImageToImageResult> {
  try {
    const result = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
      input: {
        image_url: params.imageUrl,
        prompt: params.prompt,
        strength: params.promptStrength,
        seed: params.seed,
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

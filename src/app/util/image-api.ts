import { fal } from "@fal-ai/client";

// Configure fal.ai client to use the proxy instead of direct credentials
fal.config({
  proxyUrl: "/api/fal/proxy",
});

interface ImageToImageParams {
  imageUrl: string | Blob;
  prompt: string;
  negativePrompt?: string;
  strength?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
}

interface ImageToImageResult {
  imageUrl: string;
  seed?: number;
  width: number;
  height: number;
}

// Image to image generation using fal.ai's fast-lcm-diffusion model
export async function generatePreviewImage(params: ImageToImageParams): Promise<ImageToImageResult> {
  try {

    // Use the fast-lcm-diffusion model
    // const result = await fal.subscribe("fal-ai/fast-lcm-diffusion/image-to-image", {
    //   input: {
    //     image_url: params.imageUrl,
    //     prompt: params.prompt,
    //     negative_prompt: params.negativePrompt || "",
    //     // guidance_scale: params.guidanceScale || 7.5,
    //     // num_inference_steps: params.numInferenceSteps || 25,
    //     strength: params.strength || 0.3,
    //   },
    //   logs: true,
    //   onQueueUpdate: (update) => {
    //     if (update.status === "IN_PROGRESS") {
    //       console.log("Generation in progress...");
    //       update.logs?.map((log) => log.message).forEach(console.log);
    //     }
    //   },
    // });

    // Use the fast-turbo-diffusion model
    const result = await fal.subscribe("fal-ai/fast-turbo-diffusion/image-to-image", {
      input: {
        image_url: params.imageUrl,
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || "",
        // guidance_scale: params.guidanceScale || 7.5,
        // num_inference_steps: params.numInferenceSteps || 25,
        strength: params.strength,
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
    console.error("Error generating image variation:", error);
    throw error;
  }
}

// Convert a data URL to a Blob
export function dataURLtoBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new Blob([u8arr], {type: mime});
}

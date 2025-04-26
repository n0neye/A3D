
import { getImageSimulationData, } from "../simulation-data";
import { GenerativeEntity, StylePromptOptionKey, StylePromptOptions } from '@/engine/entity/types/GenerativeEntity';
import { ImageRatio, IMAGE_SIZE_MAP, RATIO_MAP } from "@/engine/utils/imageUtil";
import { Runware, RunwareClient } from "@runware/sdk-js";
import { IGenerationLog } from '@/engine/interfaces/generation';
import { FalConnectionManager } from "./fal-connnection";

// Types for callbacks and results
export interface Generation2DRealtimResult {
    success: boolean;
    imageUrl?: string;
    error?: string;
}

export interface GenerationResult {
    success: boolean;
    generationLog: IGenerationLog | null;
}


// Initialize the connection on module load
export function initializeRealtimeConnection(): void {
    FalConnectionManager.getInstance().initialize();
    // initRunwareClient();
}

export async function doGenerateRealtimeImage(
    promptInput: string,
    entity: GenerativeEntity,
    options: {
        ratio?: ImageRatio,
        styleOption?: StylePromptOptionKey
    } = {}
): Promise<GenerationResult> {
    const startTime = performance.now();

    // Split prompt input by "--no"
    const promptParts = promptInput.split("--no");
    const positivePrompt = promptParts[0];
    let negativePrompt = promptParts[1] ? promptParts[1] + ", " : "";
    negativePrompt += 'cropped, out of frame, blurry, blur';
    console.log("GenerateRealtimeImage: promptParts", positivePrompt, "negativePrompt: ", negativePrompt);

    // Use defaults if not provided
    const ratio = options.ratio || '1:1';

    // Update entity state
    entity.setProcessingState('generating2D', 'Generating image...');

    // update the entity name with first word of prompt
    entity.name = positivePrompt.split(' ')[0] + "_" + entity.name;
    entity.uuid = positivePrompt.split(' ')[0] + "_" + entity.uuid;

    // Determine dimensions
    const ratioMultipliers = RATIO_MAP[ratio];
    const baseSize = IMAGE_SIZE_MAP["medium"];

    // Calculate width and height
    let width, height;
    if (ratioMultipliers.width > ratioMultipliers.height) {
        width = baseSize;
        height = Math.floor(baseSize * (ratioMultipliers.height / ratioMultipliers.width));
    } else {
        height = baseSize;
        width = Math.floor(baseSize * (ratioMultipliers.width / ratioMultipliers.height));
    }

    // Enhance prompt based on entity type
    let enhancedPrompt = `${positivePrompt}, ${StylePromptOptions[options.styleOption].promptSuffix}`;

    // If the prompt is "_", use the test data
    let result: Generation2DRealtimResult;
    if (positivePrompt === "_") {
        result = getImageSimulationData();
    } else {

        // Use FAL AI API for now
        result = await generateRealtimeImageFal(enhancedPrompt, {
            width: width,
            height: height,
            negativePrompt: negativePrompt
        });

        // Use Runware API
        // result = await generateRealtimeImageRunware(enhancedPrompt, {
        //     width: width,
        //     height: height,
        //     negativePrompt: negativePrompt
        // });
    }
    console.log("GenerateRealtimeImage: result", result);

    const success = result.success && result.imageUrl !== undefined;
    if (success && result.imageUrl) {
        console.log(`%cImage generation took ${((performance.now() - startTime) / 1000).toFixed(2)} seconds`, "color: #4CAF50; font-weight: bold;");


        // Apply the image to the entity
        await entity.applyImage(result.imageUrl, ratio);

        // Add to history
        const log = await entity.createAndApplyNewGenerationLog("image", { fileUrl: result.imageUrl, prompt: promptInput });

        console.log(`%cTask completed in ${((performance.now() - startTime) / 1000).toFixed(2)} seconds`, "color: #4CAF50; font-weight: bold;");

        entity.setProcessingState('idle', success ? 'Image generated successfully!' : 'Failed to generate image');

        return { success, generationLog: log };
    } else {
        console.error("Failed to generate image", result);
        throw new Error("Failed to generate image");
    }
}

/**
 * Generate an image using the FAL AI API with persistent WebSocket connection
 */
async function generateRealtimeImageFal(
    prompt: string,
    options: {
        width?: number;
        height?: number;
        negativePrompt?: string;
    } = {}
): Promise<Generation2DRealtimResult> {
    // Get connection manager and generate the image
    const connectionManager = FalConnectionManager.getInstance();
    const result = await connectionManager.generateImage({
        prompt,
        negative_prompt: options.negativePrompt,
        width: options.width,
        height: options.height
    });
    return result;
}

let runwareClient: RunwareClient | null = null;
const initRunwareClient = async () => {
    runwareClient = new Runware({ apiKey: process.env.NEXT_PUBLIC_RUNWARE_API_KEY! });
    await runwareClient.ensureConnection();
}

async function generateRealtimeImageRunware(
    prompt: string,
    options: {
        width?: number;
        height?: number;
        negativePrompt?: string;
    } = {}
): Promise<Generation2DRealtimResult> {
    if (!runwareClient) {
        await initRunwareClient();
    }
    if (!runwareClient) {
        throw new Error("Runware client not initialized");
    }
    const runwareResult = await runwareClient.requestImages({
        positivePrompt: prompt,
        negativePrompt: options.negativePrompt,
        width: options.width || 1024,
        height: options.height || 1024,
        model: "runware:100@1",
        numberResults: 1,
        outputType: "URL",
        outputFormat: "WEBP",
        checkNSFW: false,
    })

    return {
        success: runwareResult?.[0]?.imageURL ? true : false,
        imageUrl: runwareResult?.[0]?.imageURL || undefined
    };
}


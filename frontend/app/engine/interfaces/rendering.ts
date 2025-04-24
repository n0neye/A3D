import { ImageRatio } from "@/engine/utils/imageUtil";
// RenderSettings: Represents the settings for the AI render of a project.
export interface IRenderSettings {
    prompt: string;
    promptStrength: number;
    depthStrength: number;
    noiseStrength: number;
    selectedAPI: string; // Store API ID as string
    seed: number;
    useRandomSeed: boolean;
    selectedLoras: LoraConfig[];
    openOnRendered: boolean;
    ratio: ImageRatio;
}


// RenderLog: Represents the one final-AI-rendered image. A project can have multiple render logs, and each render log can have multiple generation logs. Render logs can be displayed in the GalleryPanel, and can be saved in a project file.
export interface IRenderLog {
    imageUrl: string;
    prompt: string;
    model: string;
    timestamp: Date;
    seed?: number;
    promptStrength?: number;
    depthStrength?: number;
    selectedLoras?: LoraConfig[];
}


// Define SelectedLora interface
export interface LoraConfig {
    info: LoraInfo;
    strength: number;
}

export interface LoraInfo {
    id: string;
    civitaiId?: number;
    name: string;
    modelUrl: string;
    thumbUrl: string;
    author: string;
    authorLinkUrl: string;
    linkUrl?: string;
    description?: string;
    sizeKb?: number;
}
import { LoraInfo } from "@/engine/interfaces/rendering";

export const getLoraInfo = async (loraId: string): Promise<LoraInfo | null> => {
    try { // Added try-catch for robustness
        const response = await fetch(`https://civitai.com/api/v1/models/${loraId}`)
        if (!response.ok) {
            console.error(`Failed to fetch LoRA ${loraId}: ${response.statusText}`);
            return null;
        }
        const data: CivitaiResponse = await response.json()
        const modelVersion = GetFluxDevModelVersion(data);

        if (!modelVersion) {
            // console.warn(`No compatible Flux.1 D model version found for LoRA ${loraId} (${data.name})`);
            return null;
        }

        const findFirstImage = (images: CivitaiImage[]) => {
            // Find first type==="image"
            return images.find((image) => image.type === "image")
        }

        // Map to LoraInfo
        return {
            id: data.id.toString(), // Use Civitai ID as the primary ID for consistency
            civitaiId: data.id,
            name: data.name,
            thumbUrl: findFirstImage(modelVersion.images)?.url || "", // Provide fallback if no image
            modelUrl: modelVersion.downloadUrl,
            author: data.creator.username,
            authorLinkUrl: `https://civitai.com/user/${data.creator.username}`, // Correct link to author profile
            linkUrl: `https://civitai.com/models/${data.id}`,
            description: data.description || "", // Ensure description is always a string
            sizeKb: modelVersion.files?.[0]?.sizeKB || 0 // Add size in KB
        }
    } catch (error) {
        console.error(`Error fetching or processing LoRA ${loraId}:`, error);
        return null;
    }
}

const GetFluxDevModelVersion = (data: CivitaiResponse) => {
    return data.modelVersions.find((version) => {
        if (version.baseModel?.includes("Flux.1 D")) {
            return version;
        }
        return null;
    });
}



export interface CivitaiResponse {
    id: number
    name: string
    description: string
    allowNoCredit?: boolean
    allowCommercialUse?: string[]
    allowDerivatives?: boolean
    allowDifferentLicense?: boolean
    type?: string
    minor?: boolean
    poi?: boolean
    nsfw?: boolean
    nsfwLevel?: number
    availability?: string
    cosmetic?: any
    supportsGeneration?: boolean
    stats?: Stats
    creator: Creator
    tags?: string[]
    modelVersions: ModelVersion[]
}

export interface Stats {
    downloadCount: number
    favoriteCount: number
    thumbsUpCount: number
    thumbsDownCount: number
    commentCount: number
    ratingCount: number
    rating: number
    tippedAmountCount: number
}

export interface Creator {
    username: string
    image: string
}

export interface ModelVersion {
    id?: number
    index?: number
    name?: string
    baseModel?: string
    createdAt?: string
    publishedAt?: string
    status?: string
    availability?: string
    nsfwLevel?: number
    description?: string
    trainedWords?: string[]
    covered?: boolean
    stats?: Stats2
    files?: File[]
    images: CivitaiImage[]
    downloadUrl: string
}

export interface Stats2 {
    downloadCount: number
    ratingCount: number
    rating: number
    thumbsUpCount: number
    thumbsDownCount: number
}

export interface File {
    id: number
    sizeKB: number
    name: string
    type: string
    pickleScanResult: string
    pickleScanMessage: string
    virusScanResult: string
    virusScanMessage: any
    scannedAt: string
    metadata: Metadata
    hashes: Hashes
    downloadUrl: string
    primary: boolean
}

export interface Metadata {
    format: string
}

export interface Hashes {
    AutoV1: string
    AutoV2: string
    SHA256: string
    CRC32: string
    BLAKE3: string
    AutoV3: string
}

export interface CivitaiImage {
    url: string
    nsfwLevel?: number
    width?: number
    height?: number
    hash?: string
    type?: string
    hasMeta?: boolean
    hasPositivePrompt?: boolean
    onSite?: boolean
    remixOfId?: any
}
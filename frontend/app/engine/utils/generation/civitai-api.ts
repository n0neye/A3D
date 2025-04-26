import { LoraInfo } from "@/engine/interfaces/rendering";

// Interface for the overall search response
export interface CivitaiSearchResponse {
    items: CivitaiResponse[];
    metadata: {
        currentPage: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
    }
    // Add other potential metadata fields if needed
}

export const getLoraInfo = async (loraId: string): Promise<LoraInfo | null> => {
    try { // Added try-catch for robustness
        const response = await fetch(`https://civitai.com/api/v1/models/${loraId}`)
        if (!response.ok) {
            console.error(`Failed to fetch LoRA ${loraId}: ${response.statusText}`);
            return null;
        }
        const data: CivitaiResponse = await response.json()
        return parseToLoraInfo(data);
    } catch (error) {
        console.error(`Error fetching or processing LoRA ${loraId}:`, error);
        return null;
    }
}

// New function to search for LoRAs
export const searchLoras = async (query: string): Promise<LoraInfo[]> => {
    if (!query.trim()) {
        throw new Error("Query is empty");
    }
    try {
        console.log("Searching for LoRAs with query:", query);
        // Construct the search URL, ensuring the query is URL-encoded
        // TODO: Find a way to filter by Flux.1 Dev
        const searchUrl = `https://civitai.com/api/v1/models?query=${encodeURIComponent(query)}&types=LORA&limit=${20}`; // Ensure Flux.1 D is encoded if needed
        const response = await fetch(searchUrl);

        if (!response.ok) {
            throw new Error(`Failed to search LoRAs for query "${query}": ${response.statusText}`);
        }
        

        const searchData: CivitaiSearchResponse = await response.json();

        console.log('Found', searchData.items.length, 'LoRAs for query:', query);

        // Parse each item in the results
        const loraInfos = searchData.items.map(item => parseToLoraInfo(item)).filter((lora): lora is LoraInfo => lora !== null);

        console.log('Parsed', loraInfos.length, 'LoRAs');

        return loraInfos;

    } catch (error) {
        console.error(`Error searching for LoRAs for query "${query}":`, error);
        throw error;
    }
}

const parseToLoraInfo = (data: CivitaiResponse): LoraInfo | null => {
    
    const modelVersion = GetFluxDevModelVersion(data);

    if (!modelVersion) {
        // console.warn(`No compatible Flux.1 D model version found for LoRA ${loraId} (${data.name})`);
        return null;
    }

    const findFirstImage = (images: CivitaiImage[]) => {
        // Find first type==="image"
        return images.find((image) => image.type === "image")
    }

    // Ensure modelVersion.files exists and has at least one element before accessing sizeKB
    const sizeKb = modelVersion.files && modelVersion.files.length > 0 ? modelVersion.files[0].sizeKB : 0;

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
        sizeKb: sizeKb // Use the safely accessed sizeKb
    }
}

const GetFluxDevModelVersion = (data: CivitaiResponse) => {
    // Prioritize versions explicitly marked for Flux.1 D
    let foundVersion = data.modelVersions.find((version) => version.baseModel === "Flux.1 D");

    // Fallback: Check if baseModel includes "Flux.1 D" (less precise)
    if (!foundVersion) {
        foundVersion = data.modelVersions.find((version) => version.baseModel?.includes("Flux.1 D"));
    }

    // Fallback: If multiple versions exist but none match baseModel, check files for safetensors
    // This is a heuristic and might not always be correct
    if (!foundVersion && data.modelVersions.length > 0) {
       foundVersion = data.modelVersions.find(version => version.files?.some(file => file.name.endsWith('.safetensors')));
       // If still not found, maybe just return the first version as a last resort? Or null.
       // Returning null is safer if compatibility is critical.
       // if (!foundVersion) foundVersion = data.modelVersions[0];
    }

    return foundVersion || null; // Return the found version or null
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
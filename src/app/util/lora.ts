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
}


// Define SelectedLora interface
export interface LoraConfig {
    info: LoraInfo;
    strength: number;
}

export const fluxDevLoraIds: string[] = [
    "832858", // Anime art
    "736706", // Epic gorgeous Details
    "214956", // Cinematic Photography Style XL + F1D
    "235495", // Cinematic Kodak Motion Picture "Film Still" Style XL + F1D
    "678853", //SXZ Dark Fantasy
    "128568", // Cyberpunk Anime Style
    "667004", // Elden Ring
    "707312", // Luminous Shadowscape
    "118103", // Abandoned Style
    "1032948",
    "289500",
    "676275",
    "757042",
    "504579",
    "365274",
    "383452",
    "264275",
    "109414",
    "921061",
    "915918"
]

export const customLoras: LoraInfo[] = [
    {
        id: "nontech-01",
        name: "nontech",
        description: "",
        modelUrl: "https://storage.googleapis.com/nontech-webpage/ai-editor/lora/nontech-replicate.safetensors",
        thumbUrl: "https://storage.googleapis.com/nontech-webpage/ai-editor/lora/nontech-replicate.webp",
        author: "nontech",
        authorLinkUrl: "https://nontech.net",
        linkUrl: "",
    }
]

export const getAllLoraInfo = async () => {
    const loraInfos = await Promise.all(fluxDevLoraIds.map(getLoraInfo))
    return loraInfos.filter((lora) => lora !== null)
}

export const getLoraInfo = async (loraId: string): Promise<LoraInfo | null> => {
    const response = await fetch(`https://civitai.com/api/v1/models/${loraId}`)
    const data: CivitaiResponse = await response.json()
    const modelVersion = GetFluxDevModelVersion(data);

    if (!modelVersion) {
        return null;
    }

    // Map to LoraInfo
    return {
        id: data.id.toString(),
        civitaiId: data.id,
        name: data.name,
        thumbUrl: modelVersion.images[0].url,
        modelUrl: modelVersion.downloadUrl,
        author: data.creator.username,
        authorLinkUrl: data.creator.image,
        linkUrl: `https://civitai.com/models/${data.id}`,
        description: data.description
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
    images: Image[]
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

export interface Image {
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

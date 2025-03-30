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

    // Cinematic, Photography
    "214956", // Cinematic Photography Style XL + F1D
    "235495", // Cinematic Kodak Motion Picture "Film Still" Style XL + F1D
    "707312", // Luminous Shadowscape
    "118103", // Abandoned Style
    "668468",
    "675648",
    "878199",
    "1032948", // Dark Side of the light
    "289500", //Cinematic volumetric lighting
    "504579", // 16mm
    "365274", // Kodak
    "264275", // Blade Runner
    "921061", // Film Style

    // NA

    // Fantasy
    "263107",
    "667004", // Elden Ring
    "678853", //SXZ Dark Fantasy
    "660112",
    "736706", // Epic gorgeous Details
    // 3D
    "383452", // Unreal Engine
    "109414", // Digital Human
    "1059755", //3D asset
    "1180834",
    "911050",
    "730729",
    "1295619",
    "562478",
    "274425",
    // Surreal
    "721398",
    "707582",
    "915191",
    "717319",
    "1093675",
    "894628",
    "691069",
    "795791",
    // Painting
    "757042", // oil painting
    "866333",
    "803456", // sketch
    "640459",
    "858800",
    "676275", // Mezzotint Artstyle for Flux
    // Artists
    "682760",
    "751068",
    
    // Anime
    "832858", // Anime art
    "128568", // Cyberpunk Anime Style
    // "721039", // Retro Anime Flux // 1G
    "658958",
    "938811", 
    "651694",
    "1101919",
    "653658",
    "915918", // Niji

    // Util
    // "290836", // Multi view
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
        linkUrl: "https://nontech.net",
    },{
        id: "nontech-dreamer",
        name: "DRM",
        description: "",
        modelUrl: "https://storage.googleapis.com/nontech-webpage/ai-editor/lora/dreamer.safetensors",
        thumbUrl: "https://storage.googleapis.com/nontech-webpage/ai-editor/lora/dreamer.webp",
        author: "nontech",
        authorLinkUrl: "https://nontech.net",
        linkUrl: "https://nontech.net",
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

    const findFirstImage = (images: Image[]) => {
        // Find first type==="image"
        return images.find((image) => image.type === "image")
    }

    // Map to LoraInfo
    return {
        id: data.id.toString(),
        civitaiId: data.id,
        name: data.name,
        thumbUrl: findFirstImage(modelVersion.images)?.url || "",
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

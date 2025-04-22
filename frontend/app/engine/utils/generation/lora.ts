import { LoraInfo } from "@/engine/interfaces/rendering";
import { CivitaiImage, CivitaiResponse, getLoraInfo } from "./civitai-api";


// Changed from string[] to Record<string, string[]>
export const fluxDevLoraIdsByCategory: Record<string, string[]> = {
    
    "Cinematic & Photography": [
        "214956", // Cinematic Photography Style XL + F1D
        "235495", // Cinematic Kodak Motion Picture "Film Still" Style XL + F1D
        "707312", // Luminous Shadowscape
        // "118103", // Abandoned Style
        "668468",
        "675648",
        "878199",
        "1032948", // Dark Side of the light
        "289500", // Cinematic volumetric lighting
        "504579", // 16mm
        "365274", // Kodak
        "264275", // Blade Runner
        "921061", // Film Style
        "263107",
    ],
    "Anime": [
        "832858", // Anime art
        "128568", // Cyberpunk Anime Style
        // "721039", // Retro Anime Flux // 1G
        "658958",
        "938811",
        "651694",
        "1101919",
        "653658",
        "915918", // Niji
    ],
    "Fantasy": [
        "667004", // Elden Ring
        "678853", // SXZ Dark Fantasy
        "660112",
        "736706", // Epic gorgeous Details
    ],
    "3D & Digital": [
        "383452", // Unreal Engine
        "109414", // Digital Human
        "1059755", // 3D asset
        "1180834",
        "911050",
        "730729",
        "1295619",
        "562478",
        "274425",
    ],
    "Surreal & Abstract": [
        "721398",
        "707582",
        "915191",
        "717319",
        "1093675",
        "894628",
        "691069",
        "795791",
    ],
    "Painting & Sketch": [
        "757042", // oil painting
        "866333",
        "803456", // sketch
        "640459",
        "858800",
        "676275", // Mezzotint Artstyle for Flux
        "682760", //HR Giger
        "751068", //HR Giger
    ],
    // "Util": [
    //     "290836", // Multi view
    // ]
};


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


// Modified to return styles grouped by category
export const getAllLoraInfo = async (): Promise<Record<string, LoraInfo[]>> => {
    const categorizedLoras: Record<string, LoraInfo[]> = {};

    // Add custom LoRAs under a specific category
    if (customLoras.length > 0) {
        categorizedLoras["Custom"] = customLoras;
    }

    // Fetch Civitai LoRAs category by category
    const categories = Object.keys(fluxDevLoraIdsByCategory);
    for (const category of categories) {
        const ids = fluxDevLoraIdsByCategory[category];
        const loraInfoPromises = ids.map(id => getLoraInfo(id));
        const loraInfos = await Promise.all(loraInfoPromises);
        const validLoras = loraInfos.filter((lora): lora is LoraInfo => lora !== null);

        if (validLoras.length > 0) {
            categorizedLoras[category] = validLoras;
        }
    }

    return categorizedLoras;
}

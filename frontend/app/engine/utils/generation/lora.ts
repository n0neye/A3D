import { LoraInfo } from "@/engine/interfaces/rendering";
import { getLoraInfo } from "./civitai-api";


// Changed from string[] to Record<string, string[]>
export const fluxDevLoraIdsByCategory: Record<string, string[]> = {
    
    "Cinematic & Photography": [
        "214956", // Cinematic Photography Style XL + F1D
        "235495", // Cinematic Kodak Motion Picture "Film Still" Style XL + F1D
        "707312", // Luminous Shadowscape
        // "118103", // Abandoned Style
        "668468",
        "675648",
        // "878199", // 60s
        "1032948", // Dark Side of the light
        // "289500", // Cinematic volumetric lighting
        "504579", // 16mm
        "365274", // Kodak
        "264275", // Blade Runner
        "921061", // Film Style
        // "263107", // Matte
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
        "1349631", // Dark Ghibli
        "1414930", // Ghibli Style
    ],
    "Fantasy": [
        "667004", // Elden Ring
        "678853", // SXZ Dark Fantasy
        "660112",
        "736706", // Epic gorgeous Details
    ],
    "Stylized": [
        "911050", // 3D Illustration
        "650444", // 3D MM
        "1059755", // 3D asset
        "689478", // 3D Flux Style
        "741027", // 3D Render Plastic Shader Flux
        "1111853", // 3D Stylized
        "720442", // Isometric
        "668799", // Game assets cartoon style 3d isometric
        "683579", // Pixel Art Illustrations
        "793156", //Pixel Arcadia
    ],
    "3D & Game": [
        "109414", // Digital Human
        "383452", // Unreal Engine
        "1180834", //Game env
        "185722", //hyperrealism 3d vibe cinematic style
        "730729", // Fluid abstraction
    ],
    "Realism": [
        "796382", //ultrarealistic-lora-project
        "580857", //realistic-skin-texture-style-xl-detailed-skin-sd15-flux1d
    ],
    "Surreal & Abstract": [
        "721398",
        "707582",
        "915191",
        "1093675",
        "717319", // Surrealism
        "894628", // Surrealism
        // "691069", // Surrealism
        "274425", // Imposiible Gemoetry
        "1295619", //Modern Abstract Minimalist
        "562478", // Alien Landscape
        "795791", // Fractal 3D
    ],
    "Painting & Sketch": [
        "757042", // oil painting
        "866333",
        "803456", // sketch
        "640459",
        "858800",
        "170039", //graphic-portrait
        "545264", // impressionism
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
    if(process.env.NODE_ENV === "development") {
        if (customLoras.length > 0) {
            categorizedLoras["Custom"] = customLoras;
        }
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

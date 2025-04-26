import { IRenderSettings } from "@/engine/interfaces/rendering";
import { availableAPIs } from "@/engine/utils/generation/image-render-api";

export const defaultSettings: IRenderSettings = {
    prompt: '',
    promptStrength: 0.9,
    depthStrength: 0.9,
    noiseStrength: 0,
    selectedAPI: availableAPIs[0].id,
    seed: Math.floor(Math.random() * 2147483647),
    useRandomSeed: true,
    selectedLoras: [],
    openOnRendered: true,
    ratio: '16:9'
  };
  
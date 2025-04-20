

export type ImageRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

// Map of image sizes to actual dimensions
export const IMAGE_SIZE_MAP = {
    small: 512,
    medium: 1024,
    large: 1280,
    xl: 1920
};

// Map of ratios to width/height multipliers
export const RATIO_MAP = {
    '1:1': { width: 1, height: 1 },
    '16:9': { width: 16, height: 9 },
    '9:16': { width: 9, height: 16 },
    '4:3': { width: 4, height: 3 },
    '3:4': { width: 3, height: 4 }
};
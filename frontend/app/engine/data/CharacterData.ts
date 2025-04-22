export interface ICharacterData {
    builtInModelId: string,
    basePath: string,
    fileName: string,
    name: string,
    thumbnail: string,
    scale: number,
    animationsFiles: string[],
    useMixamoAnimations?: boolean
}

// characters/_mixamo_animations/
const mixamoAnimations: string[] = [
    'Walking.fbx',
    'Running.fbx',
    'Sitting Idle.fbx',
    'Sitting.fbx',
    'Male Sitting Pose.fbx',
    'Jump.fbx'
];

export const mixamoAnimationPaths: string[] = mixamoAnimations.map(animation => `./characters/_mixamo_animations/${animation}`);

export const characterDatas: Map<string, ICharacterData> = new Map([
    ["lily", {
        builtInModelId: 'lily',
        name: 'Lily',
        basePath: './characters/lily/',
        fileName: 'lily_Breathing Idle_w_skin.fbx',
        thumbnail: './characters/thumbs/lily.webp',
        scale: 1,
        animationsFiles: [
            'Idle.fbx',
            'Walking.fbx',
            'Fast Run.fbx',
            'Jump.fbx',
            'Sitting Idle.fbx',
            'Female Laying Pose.fbx',
            'Male Laying Pose.fbx',
        ]
    }],
    ["mannequin", {
        builtInModelId: 'mannequin',
        name: 'Mannequin',
        basePath: './characters/mannequin_man_idle/',
        fileName: 'mannequin_embeded_1024_white.fbx',
        thumbnail: './characters/thumbs/mannequin.webp',
        scale: 1,
        useMixamoAnimations: true,
        animationsFiles: []
    }],
    ["xbot", {
        builtInModelId: 'xbot',
        name: 'Xbot',
        basePath: './characters/xbot/',
        fileName: 'xbot_Idle.fbx',
        thumbnail: './characters/thumbs/xbot.webp',
        scale: 1,
        animationsFiles: [
            'Walking.fbx',
            'Fast Run.fbx',
            'Jump.fbx',
            'Sitting.fbx',
            'Female Dance Pose.fbx',
        ]
    }],
]);

export const getModelPathById = (builtInModelId: string, ): string => {
    const characterData = characterDatas.get(builtInModelId);
    if (!characterData) {
        throw new Error(`Character data not found for builtInModelId: ${builtInModelId}`);
    }
    return characterData.basePath + characterData.fileName;
}

export const getAnimationPathsById = (builtInModelId: string): string[] => {
    const characterData = characterDatas.get(builtInModelId);
    if (!characterData) {
        throw new Error(`Character data not found for builtInModelId: ${builtInModelId}`);
    }
    
    if (characterData.useMixamoAnimations) {
        return mixamoAnimationPaths;
    } else if (characterData.animationsFiles) {
        return characterData.animationsFiles.map(fileName => characterData.basePath + "animations/" + fileName)
    }
}

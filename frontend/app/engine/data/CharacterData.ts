export interface ICharacterData {
    basePath: string,
    fileName: string,
    name: string,
    thumbnail: string,
    scale: number,
    animationsFiles: string[]
}


export const characterDatas: Map<string, ICharacterData> = new Map([
    ["Lily", {
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
    ["Mannequin", {
        name: 'Mannequin',
        basePath: './characters/mannequin_man_idle/',
        fileName: 'mannequin_man_idle_opt.glb',
        thumbnail: './characters/thumbs/mannequin.webp',
        scale: 1,
        animationsFiles: [
            'Fast Run.fbx',
            'Jump.fbx',
        ]
    }],
    ["Xbot", {
        name: 'Xbot',
        basePath: './characters/xbot/',
        fileName: 'xbot_Idle.fbx',
        thumbnail: './characters/thumbs/xbot.webp',
        scale: 1,
        animationsFiles: [
            'Fast Run.fbx',
        ]
    }],
    ["Cat", {
        name: 'Cat',
        basePath: './characters/cat/',
        fileName: 'cat_orange.glb',
        thumbnail: './characters/thumbs/cat.webp',
        scale: 0.02,
        animationsFiles: []
    }],
    // ["female_mannequin", {
    //     name: 'female_mannequin',
    //     basePath: './characters/female_mannequin/',
    //     fileName: 'Female Mannequin@Standing Idle.fbx',
    //     thumbnail: './characters/thumbs/female_mannequin.webp',
    //     scale: 0.1,
    //     animationsFiles: []
    // }]
]);
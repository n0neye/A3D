import * as BABYLON from "@babylonjs/core";
import * as Materials from "@babylonjs/materials";

export const defaultTex = {
    // Concrete
    color: "./textures/concrete_1/color_2k.jpg",
    normal: "./textures/concrete_1/normal_2k.jpg",
    // Plaster
    // color: "./textures/white_rough_plaster_ao_2k.jpg",
    // normal: "./textures/white_rough_plaster_nor_gl_2k.jpg",
    // Clay
    // color: "./textures/patterned_clay_plaster_ao_2k.jpg",
    // normal: "./textures/patterned_clay_plaster_nor_gl_2k.jpg",
}

export let defaultMaterial: BABYLON.Material;
export let defaultPBRMaterial: BABYLON.PBRMaterial;
export let placeholderMaterial: BABYLON.StandardMaterial;

export const createDefaultMaterials = (scene: BABYLON.Scene) => {
    const material = new Materials.TriPlanarMaterial(`BasicTriPlanarMaterial`, scene);
    material.diffuseColor = new BABYLON.Color3(1, 1, 1);
    material.backFaceCulling = false;
    material.diffuseTextureX = new BABYLON.Texture(defaultTex.color, scene);
    material.diffuseTextureY = new BABYLON.Texture(defaultTex.color, scene);
    material.diffuseTextureZ = new BABYLON.Texture(defaultTex.color, scene);
    material.normalTextureX = new BABYLON.Texture(defaultTex.normal, scene);
    material.normalTextureY = new BABYLON.Texture(defaultTex.normal, scene);
    material.normalTextureZ = new BABYLON.Texture(defaultTex.normal, scene);
    material.tileSize = 3;

    const material2 = new BABYLON.PBRMaterial(`BasicPBRMaterial`, scene);
    material2.albedoColor = new BABYLON.Color3(1, 1, 1);
    material2.backFaceCulling = false;
    material2.albedoTexture = new BABYLON.Texture(defaultTex.color, scene);
    material2.bumpTexture = new BABYLON.Texture(defaultTex.normal, scene);

    placeholderMaterial = createPlaceholderPlaneMaterial(scene);
    defaultMaterial = material;
    defaultPBRMaterial = material2;


    return material;
}

const createPlaceholderPlaneMaterial = (scene: BABYLON.Scene) => {
    const material = new BABYLON.StandardMaterial("PlaceholderPlaneMaterial", scene);

    // Make it transparent
    material.alpha = 0.5;
    material.transparencyMode = BABYLON.StandardMaterial.MATERIAL_ALPHABLEND;

    // Set diffuse and emissive color
    material.emissiveColor = new BABYLON.Color3(0.2, 0.5, 0.9);

    material.opacityTexture = new BABYLON.Texture("./textures/rect-gradient-2-s.png", scene);


    // Add breathing animation for the emissive effect
    const breathingAnimation = new BABYLON.Animation(
        "breathingAnimation",
        "emissiveColor",
        30,
        BABYLON.Animation.ANIMATIONTYPE_COLOR3,
        BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
    );

    // Keyframes for breathing effect
    const keys = [
        { frame: 0, value: new BABYLON.Color3(0.1, 0.3, 0.7) },
        { frame: 30, value: new BABYLON.Color3(0.2, 0.5, 0.9) },
        { frame: 60, value: new BABYLON.Color3(0.1, 0.3, 0.7) }
    ];

    breathingAnimation.setKeys(keys);
    material.animations = [breathingAnimation];
    scene.beginAnimation(material, 0, 60, true);

    placeholderMaterial = material;
    return material;
}

const createFresnelPlaneMaterial = (scene: BABYLON.Scene) => {
    const material = new BABYLON.StandardMaterial("FresnelPlaneMaterial", scene);

    // Make it transparent
    material.alpha = 0.3;
    material.transparencyMode = BABYLON.StandardMaterial.MATERIAL_ALPHABLEND;

    // Set diffuse and emissive color
    // material.diffuseColor = new BABYLON.Color3(0.1, 0.2, 0.8);
    material.emissiveColor = new BABYLON.Color3(0.2, 0.5, 0.9);

    // Configure Fresnel parameters for edge glow
    material.diffuseFresnelParameters = new BABYLON.FresnelParameters();
    material.diffuseFresnelParameters.bias = 0.1;
    material.diffuseFresnelParameters.power = 2;
    material.diffuseFresnelParameters.leftColor = BABYLON.Color3.Blue();
    material.diffuseFresnelParameters.rightColor = BABYLON.Color3.Black();


    material.emissiveFresnelParameters = new BABYLON.FresnelParameters();
    material.emissiveFresnelParameters.bias = 0.6;
    material.emissiveFresnelParameters.power = 2;
    material.emissiveFresnelParameters.leftColor = BABYLON.Color3.Blue();
    material.emissiveFresnelParameters.rightColor = BABYLON.Color3.Black();

    material.opacityFresnelParameters = new BABYLON.FresnelParameters();
    material.opacityFresnelParameters.leftColor = new BABYLON.Color3(0,0.3,1);
    material.opacityFresnelParameters.rightColor = new BABYLON.Color3(0,0,0);

    // Add breathing animation for the emissive effect
    // const breathingAnimation = new BABYLON.Animation(
    //     "breathingAnimation",
    //     "emissiveColor",
    //     30,
    //     BABYLON.Animation.ANIMATIONTYPE_COLOR3,
    //     BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
    // );

    // // Keyframes for breathing effect
    // const keys = [
    //     { frame: 0, value: new BABYLON.Color3(0.1, 0.3, 0.7) },
    //     { frame: 30, value: new BABYLON.Color3(0.2, 0.5, 0.9) },
    //     { frame: 60, value: new BABYLON.Color3(0.1, 0.3, 0.7) }
    // ];

    // breathingAnimation.setKeys(keys);
    // material.animations = [breathingAnimation];
    // scene.beginAnimation(material, 0, 60, true);

    placeholderMaterial = material;
    return material;
}


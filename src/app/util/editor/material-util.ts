import * as BABYLON from "@babylonjs/core";
import * as Materials from "@babylonjs/materials";

export const defaultTex={
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
export const createDefaultMaterial = (scene: BABYLON.Scene) => {
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

    defaultMaterial = material;
    defaultPBRMaterial = material2;
    return material;
}
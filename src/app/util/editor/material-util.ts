import * as THREE from "three";
import { TextureLoader } from "three";

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

export let defaultShapeMaterial: THREE.Material;
export let defaultGenerative3DMaterial: THREE.Material;
export let placeholderMaterial: THREE.MeshStandardMaterial;

// Helper for creating and loading a texture
const loadTexture = (url: string, scene: THREE.Scene): THREE.Texture => {
    const texture = new THREE.TextureLoader().load(url);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    return texture;
};

export const createDefaultMaterials = (scene: THREE.Scene) => {
    // Create a standard material with repeated textures as our basic material
    // Note: Three.js doesn't have a direct equivalent to TriPlanarMaterial
    // For a full implementation, we would need a custom shader
    defaultShapeMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        map: loadTexture(defaultTex.color, scene),
        normalMap: loadTexture(defaultTex.normal, scene),
    });
    defaultShapeMaterial.name = "defaultShapeMaterial";

    // Create a PBR material that responds well to lighting
    defaultGenerative3DMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(1, 1, 1),  // Pure white base color
        side: THREE.DoubleSide,
        metalness: 0.1,                    // Very low metalness for better diffuse lighting
        roughness: 0.5,                    // Medium roughness for balanced light diffusion
    });
    defaultGenerative3DMaterial.name = "defaultGenerative3DMaterial";

    placeholderMaterial = createPlaceholderPlaneMaterial(scene);
}

const createPlaceholderPlaneMaterial = (scene: THREE.Scene) => {
    // Create a transparent material similar to the original placeholder
    const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.2, 0.5, 0.9),
        emissive: new THREE.Color(0.2, 0.5, 0.9),
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
    });

    // Load the opacity texture
    const textureLoader = new TextureLoader();
    textureLoader.load("./textures/rect-gradient-2-s.png", (texture) => {
        material.alphaMap = texture;
        material.needsUpdate = true;
    });

    // Add a simple animation for the emissive effect using Three.js animation system
    // This is different from Babylon's animation system
    // We'll use a simple approach with requestAnimationFrame for this example
    const breatheMaterial = () => {
        const time = Date.now() * 0.001; // Convert to seconds
        const intensity = 0.5 + 0.2 * Math.sin(time); // Range from 0.3 to 0.7

        // Update the emissive intensity (not direct color as in Babylon)
        material.emissiveIntensity = intensity;

        // Request next frame
        requestAnimationFrame(breatheMaterial);
    };

    // Start the animation
    breatheMaterial();

    placeholderMaterial = material;
    return material;
}

// Note: We've removed createFresnelPlaneMaterial as Three.js doesn't have a direct
// equivalent to Babylon's FresnelParameters. For a similar effect, we would need to
// create a custom shader material. This could be implemented later if needed.

// TODO: For a true Fresnel effect in Three.js, we would need to implement a custom shader material
// using ShaderMaterial or implement using Three.js's built-in Fresnel node if using the node material system


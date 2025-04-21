import * as THREE from "three";
import { TextureLoader } from "three";

interface MaterialConfig {
    name: string;
    colorMap?: string;
    normalMap?: string;
    roughnessMap?: string;
    metalnessMap?: string;
    displacementMap?: string;
    aoMap?: string;
    color?: string;
    roughness?: number;
    metalness?: number;
    repeat?: number;
    thumbnail?: string;
}

export const defaultMaterials: MaterialConfig[] = [
    {
        name: "Concrete",
        colorMap: "./textures/concrete_1/color_2k.jpg",
        normalMap: "./textures/concrete_1/normal_2k.jpg",
        roughness: 0.5,
        metalness: 0.1,
        thumbnail: "./textures/concrete_1/thumb.webp"
    },
    {
        name: "Clay Grey",
        colorMap: "./textures/patterned_clay_plaster/ao.jpg",
        normalMap: "./textures/patterned_clay_plaster/normal.jpg",
        roughness: 0.8,
        metalness: 0.1,
        repeat: 4,
        thumbnail: "./textures/patterned_clay_plaster/thumb_gray.webp"
    },
    {
        name: "Clay Colored",
        colorMap: "./textures/patterned_clay_plaster/color.jpg",
        normalMap: "./textures/patterned_clay_plaster/normal.jpg",
        roughnessMap: "./textures/patterned_clay_plaster/roughness.jpg",
        aoMap: "./textures/patterned_clay_plaster/ao.jpg",
        displacementMap: "./textures/patterned_clay_plaster/disp.jpg",
        roughness: 0.8,
        metalness: 0.1,
        repeat: 4,
        thumbnail: "./textures/patterned_clay_plaster/thumb.webp"
    },
    {
        name: "Stucco Facade",
        colorMap: "./textures/Stucco_Facade/BaseColor.jpg",
        normalMap: "./textures/Stucco_Facade/Normal.jpg",
        roughness: 0.5,
        metalness: 0.1,
        repeat: 4,
        thumbnail: "./textures/Stucco_Facade/thumb.webp"
    },
    {
        name: "Ziarat White Marble",
        colorMap: "./textures/Ziarat_White_Marble/BaseColor.jpg",
        normalMap: "./textures/Ziarat_White_Marble/Normal.jpg",
        roughnessMap: "./textures/Ziarat_White_Marble/Roughness.jpg",
        metalnessMap: "./textures/Ziarat_White_Marble/Gloss.jpg",
        roughness: 0.5,
        metalness: 1,
        repeat: 2,
        thumbnail: "./textures/Ziarat_White_Marble/thumb.webp"
    },
    {
        name: "Scratched Painted Metal",
        colorMap: "./textures/Scratched_Painted_Metal/color.jpg",
        roughnessMap: "./textures/Scratched_Painted_Metal/Roughness_opt.jpg",
        metalnessMap: "./textures/Scratched_Painted_Metal/Gloss_opt.jpg",
        roughness: 0.3,
        metalness: 1,
        repeat: 2,
        thumbnail: "./textures/Scratched_Painted_Metal/thumb.webp"
    },
];

const defaultMaterial = defaultMaterials[0];

export let defaultShapeMaterial: THREE.MeshStandardMaterial;
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
        map: defaultMaterial.colorMap ? loadTexture(defaultMaterial.colorMap, scene) : undefined,
        normalMap: defaultMaterial.normalMap ? loadTexture(defaultMaterial.normalMap, scene) : undefined,
        roughnessMap: defaultMaterial.roughnessMap ? loadTexture(defaultMaterial.roughnessMap, scene) : undefined,
        metalnessMap: defaultMaterial.metalnessMap ? loadTexture(defaultMaterial.metalnessMap, scene) : undefined,
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

    placeholderMaterial = createPlaceholderPlaneMaterial();
}

const applyTexture = async (material: THREE.MeshStandardMaterial, channel: "color" | "normal" | "roughness" | "metalness" | "displacement" | "ao", url?: string, repeat?: number) => {
    const textureLoader = new THREE.TextureLoader();
    let texture: THREE.Texture | null = null;

    if (url) {
        texture = await textureLoader.loadAsync(url);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeat || 1, repeat || 1);
    }
    
    if (channel === "color") {
        material.map = texture;
    } else if (channel === "normal") {
        material.normalMap = texture;
    } else if (channel === "roughness") {
        material.roughnessMap = texture;
    } else if (channel === "metalness") {
        material.metalnessMap = texture;
    } else if (channel === "displacement") {
        material.displacementMap = texture;
    } else if (channel === "ao") {
        material.aoMap = texture;
    }
}

// New function to handle material changes
export const applyMaterialConfig = (
    materialConfigIndex: number
): void => {
    const material = defaultShapeMaterial;
    if (!material || materialConfigIndex >= defaultMaterials.length) return;
    console.log("Applying material config", materialConfigIndex);

    const materialConfig = defaultMaterials[materialConfigIndex];
    const textureLoader = new THREE.TextureLoader();

    // Update existing material instead of creating a new one
    applyTexture(material, "color", materialConfig.colorMap, materialConfig.repeat);
    applyTexture(material, "normal", materialConfig.normalMap, materialConfig.repeat);
    applyTexture(material, "roughness", materialConfig.roughnessMap, materialConfig.repeat);
    applyTexture(material, "metalness", materialConfig.metalnessMap, materialConfig.repeat);
    applyTexture(material, "ao", materialConfig.aoMap, materialConfig.repeat);

    applyTexture(material, "displacement", materialConfig.displacementMap, materialConfig.repeat);
    material.displacementScale = materialConfig.displacementMap != null ? 0.5 : 0;

    // Update other material properties
    if (materialConfig.color) {
        material.color.set(materialConfig.color);
    }

    if (materialConfig.roughness !== undefined) {
        material.roughness = materialConfig.roughness;
    }

    if (materialConfig.metalness !== undefined) {
        material.metalness = materialConfig.metalness;
    }

    material.needsUpdate = true;
};

// Helper function to find the defaultShapeMaterial in a scene
export const findDefaultShapeMaterial = (scene: THREE.Scene): THREE.MeshStandardMaterial | null => {
    let foundMaterial: THREE.MeshStandardMaterial | null = null;

    scene.traverse((object) => {
        if (object instanceof THREE.Mesh && object.material) {
            const material = Array.isArray(object.material)
                ? object.material.find(m => m.name === "defaultShapeMaterial")
                : object.material.name === "defaultShapeMaterial" ? object.material : null;

            if (material && material instanceof THREE.MeshStandardMaterial) {
                foundMaterial = material;
            }
        }
    });

    return foundMaterial;
};

const createPlaceholderPlaneMaterial = () => {
    // Create a transparent material similar to the original placeholder
    const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.2, 0.5, 0.9),
        emissive: new THREE.Color(0.2, 0.5, 0.9),
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        flatShading: false,
        blendAlpha: THREE.AdditiveBlending,
        blending: THREE.AdditiveBlending,
        alphaTest: 0,
        alphaHash: false

    });

    // Load the opacity texture
    const textureLoader = new TextureLoader();
    textureLoader.load("./textures/rect-gradient-2-s.png", (texture) => {
        material.alphaMap = texture;
        material.needsUpdate = true;
    });

    // Add a simple animation for the emissive effect using Three.js animation system
    const breatheMaterial = () => {
        const time = Date.now() * 0.001; // Convert to seconds
        const intensity = 0.5 + 0.2 * Math.sin(time); // Range from 0.3 to 0.7

        // Update the emissive intensity 
        material.emissiveIntensity = intensity;

        // Request next frame
        requestAnimationFrame(breatheMaterial);
    };

    // Start the animation
    breatheMaterial();

    placeholderMaterial = material;
    return material;
}


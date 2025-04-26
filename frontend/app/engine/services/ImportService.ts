import { GenerativeEntity } from "../entity/types/GenerativeEntity";
import { EditorEngine } from "@/engine/EditorEngine";
import { ImageRatio } from "../utils/imageUtil";
import { EntityFactory } from "../entity/EntityFactory";
import { FileService } from './FileService/FileService';
import { Basic3DEntity } from "../entity/types/Basic3DEntity";
import { CharacterEntity } from "../entity/types/CharacterEntity";

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png'];
export const ACCEPTED_MODEL_TYPES = ['model/gltf-binary', 'model/gltf+json', 'application/fbx'];
export const ACCEPTED_MODEL_EXTENSIONS = ['.glb', '.gltf', '.fbx'];
export const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', ...ACCEPTED_MODEL_EXTENSIONS];

/**
 * Service to handle file imports into the editor
 */
export class ImportService {
    private engine: EditorEngine;

    constructor(engine: EditorEngine) {
        this.engine = engine;
    }

    /**
     * Main entry point for importing files
     * @param file The file object to import
     * @returns Promise resolving to the created entity or null if import failed
     */
    static async importFile(file: File): Promise<GenerativeEntity | Basic3DEntity | CharacterEntity | null> {
        console.log(`Importing file: ${file.name}`);

        // Get file extension
        const extension = file.name.toLowerCase().match(/\.[^.]*$/)?.[0] || '';

        // Determine which import method to use based on file extension
        if (ACCEPTED_MODEL_TYPES.includes(file.type) || ACCEPTED_MODEL_EXTENSIONS.includes(extension)) {
            // Handle 3D model
            return await ImportService.import3DModelFile(file);
        } else if (ACCEPTED_IMAGE_TYPES.includes(file.type)) {
            // Handle image
            return await ImportService.importImageFile(file);
        }
        throw new Error(`Unsupported file type: ${extension}`);
    }

    /**
     * Import an image file and create a GenerativeEntity with it
     * @param file The image file to import
     * @returns Promise resolving to the created entity or null if import failed
     */
    static async importImageFile(file: File): Promise<GenerativeEntity | null> {
        try {
            // Read file as array buffer
            const imageData = await ImportService.readFileAsArrayBuffer(file);

            // Save the file using the file manager
            const imageUrl = await FileService.getInstance().saveFile(
                imageData,
                file.name,
                file.type || 'image/jpeg'
            );

            // Determine aspect ratio (still need data URL for this)
            const tempDataUrl = await ImportService.readFileAsDataURL(file);
            const ratio = await ImportService.getImageAspectRatio(tempDataUrl);

            // Create entity with the URL
            return await ImportService.createEntityFromImage(imageUrl, file.name, ratio);
        } catch (error) {
            console.error("Error importing image file:", error);
            return null;
        }
    }

    /**
     * Import a 3D model file and create a Basic3DEntity with it
     * @param file The 3D model file to import
     * @returns Promise resolving to the created entity or null if import failed
     */
    static async import3DModelFile(file: File): Promise<Basic3DEntity | CharacterEntity | null> {
        try {
            // TODO: Prevent duplicated steps (save/read) 

            // Read the file as ArrayBuffer
            const modelData = await ImportService.readFileAsArrayBuffer(file);

            // Save the file using file manager
            const modelUrl = await FileService.getInstance().saveFile(
                modelData,
                file.name,
                file.type || 'model/gltf-binary'
            );

            // Determine the model format based on extension
            const extension = file.name.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
            const modelFormat = extension === '.fbx' ? 'fbx' : 'glb';

            // Create entity with the URL
            const entity = await ImportService.createEntityFromModel(modelUrl, file.name, modelFormat);
            return entity;
        } catch (error) {
            console.error("Error importing model file:", error);
            return null;
        }
    }

    /**
     * Read file as data URL
     * @param file The file to read
     * @returns Promise resolving to data URL string
     */
    static readFileAsDataURL(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (event) => {
                if (event.target?.result && typeof event.target.result === 'string') {
                    resolve(event.target.result);
                } else {
                    reject(new Error('Failed to read file as data URL'));
                }
            };

            reader.onerror = (error) => {
                reject(error);
            };

            reader.readAsDataURL(file);
        });
    }

    /**
     * Read file as ArrayBuffer
     * @param file The file to read
     * @returns Promise resolving to ArrayBuffer
     */
    static readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (event) => {
                if (event.target?.result && event.target.result instanceof ArrayBuffer) {
                    resolve(event.target.result);
                } else {
                    reject(new Error('Failed to read file as ArrayBuffer'));
                }
            };

            reader.onerror = (error) => {
                reject(error);
            };

            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Import an image file and create a GenerativeEntity with it
     * @param imageUrl The image URL (file:// protocol or blob:// URL)
     * @param fileName The original file name (for metadata)
     * @param ratio The aspect ratio for the image
     * @returns The created entity or null if import failed
     */
    static async createEntityFromImage(imageUrl: string, fileName: string, ratio: ImageRatio = '1:1'): Promise<GenerativeEntity | null> {
        try {
            // Create a default name from the filename or a generic one
            const name = fileName ? fileName.split('.')[0] : `Image_${new Date().toISOString().slice(0, 10)}`;

            // Create a new generative entity
            const entity = await EntityFactory.createEntity({
                type: 'generative',
                name: name,
                generativeProps: { generationLogs: [], isImported: true }
            }) as GenerativeEntity;

            if (!entity) {
                console.error("Failed to create entity for image import");
                return null;
            }

            // Create a placeholder prompt
            const prompt = `Imported image: ${fileName}`;

            // Update aspect ratio
            entity.updateAspectRatio(ratio);

            // Register the image in the entity
            const log = entity.createAndApplyNewGenerationLog('image', { fileUrl: imageUrl, prompt: prompt });

            // Notify user
            console.log(`Imported image as entity: ${entity.name}`);

            return entity;
        } catch (error) {
            console.error("Error importing image:", error);
            return null;
        }
    }

    /**
     * Import a 3D model file and create a Basic3DEntity with it
     * @param modelUrl The model URL (file:// protocol or blob:// URL)
     * @param fileName The original file name (for metadata)
     * @param modelFormat The format of the model file ('glb', 'gltf', or 'fbx')
     * @returns The created entity or null if import failed
     */
    static async createEntityFromModel(
        modelUrl: string,
        fileName: string,
        modelFormat: 'glb' | 'gltf' | 'fbx'
    ): Promise<Basic3DEntity | CharacterEntity | null> {
        // Create a default name from the filename or a generic one
        let entity: Basic3DEntity | CharacterEntity | null = null;
        const name = fileName ? fileName.split('.')[0] : `Model_${new Date().toISOString().slice(0, 10)}`;

        // Create a new basic3D entity
        const basic3D = await new Promise<Basic3DEntity>((resolve, reject) => {
            EntityFactory.createEntity({
                type: 'basic3D',
                name: name,
                basic3DProps: {
                    modelUrl: modelUrl,
                    modelFormat: modelFormat,
                    originalFileName: fileName
                }, onLoaded: (entity) => {
                    resolve(entity as Basic3DEntity);
                }
            });
        });
        entity = basic3D;


        if (!basic3D) {
            throw new Error("Failed to create entity for model import");
        }

        // TODO: Import as character at first place?
        // Check if the model has a skeleton, and if so, convert to character entity
        const skeleton = basic3D.findSkinnedMesh();
        if (skeleton) {
            console.log("Skeleton found, converting to character entity", skeleton.skeleton?.bones.length);
            const characterEntity = basic3D.convertToCharacterEntity();
            entity = characterEntity;
        }

        return entity;
    }

    /**
     * Determine aspect ratio from image data
     * @param imageDataUrl The image data as a data URL
     * @returns Promise resolving to the closest matching aspect ratio
     */
    static async getImageAspectRatio(imageDataUrl: string): Promise<ImageRatio> {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const width = img.width;
                const height = img.height;
                const ratio = width / height;

                // Determine the closest predefined ratio
                if (ratio > 1.7) {
                    resolve('16:9'); // Landscape widescreen
                } else if (ratio > 1.3) {
                    resolve('4:3'); // Standard landscape
                } else if (ratio < 0.6) {
                    resolve('9:16'); // Tall portrait
                } else if (ratio < 0.8) {
                    resolve('3:4'); // Standard portrait
                } else {
                    resolve('1:1'); // Square or near-square
                }
            };

            img.onerror = () => {
                // Default to square if there's an error
                resolve('1:1');
            };

            img.src = imageDataUrl;
        });
    }
}

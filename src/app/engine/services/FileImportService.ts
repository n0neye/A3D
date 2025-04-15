import { GenerativeEntity } from "../entity/types/GenerativeEntity";
import { EditorEngine } from "@/app/engine/EditorEngine";
import { v4 as uuidv4 } from 'uuid';
import { ImageRatio } from "../utils/imageUtil";
import { EntityFactory } from "../entity/EntityFactory";

/**
 * Service to handle file imports into the editor
 */
export class FileImportService {
  private engine: EditorEngine;

  constructor(engine: EditorEngine) {
    this.engine = engine;
  }

  /**
   * Import an image file and create a GenerativeEntity with it
   * @param imageData The image data as a data URL or file URL
   * @param fileName The original file name (for metadata)
   * @param ratio The aspect ratio for the image
   * @returns The created entity or null if import failed
   */
  static async importImage(imageData: string, fileName: string, ratio: ImageRatio = '1:1'): Promise<GenerativeEntity | null> {
    try {
      // Create a default name from the filename or a generic one
      const name = fileName ? fileName.split('.')[0] : `Image_${new Date().toISOString().slice(0, 10)}`;
      
      // Create a new generative entity
      const entity = await EntityFactory.createEntityDefault('generative') as GenerativeEntity;
      
      if (!entity) {
        console.error("Failed to create entity for image import");
        return null;
      }

      // Create a placeholder prompt
      const prompt = `Imported image: ${fileName}`;
      
      // Register the image in the entity
      const log = entity.onNewGeneration('image', imageData, prompt);
      
      // Update aspect ratio
      entity.updateAspectRatio(ratio);
      
      // Set the entity as selected
    //   this.engine.getSelectionManager().selectEntity(entity);
      
      // Notify user
      console.log(`Imported image as entity: ${entity.name}`);
      
      return entity;
    } catch (error) {
      console.error("Error importing image:", error);
      return null;
    }
  }

  /**
   * Import a 3D model file and create a GenerativeEntity with it
   * @param modelData The model data as an ArrayBuffer
   * @param fileName The original file name (for metadata)
   * @returns The created entity or null if import failed
   */
  static async importModel(modelData: ArrayBuffer, fileName: string): Promise<GenerativeEntity | null> {
    try {
      // Create a blob URL from the array buffer
      const blob = new Blob([modelData], { type: 'model/gltf-binary' });
      const modelUrl = URL.createObjectURL(blob);
      
      // Create a default name from the filename or a generic one
      const name = fileName ? fileName.split('.')[0] : `Model_${new Date().toISOString().slice(0, 10)}`;
      
      // Create a new generative entity
      const entity = await EntityFactory.createEntityDefault('generative') as GenerativeEntity;
      
      if (!entity) {
        console.error("Failed to create entity for model import");
        return null;
      }

      // Create a placeholder prompt
      const prompt = `Imported 3D model: ${fileName}`;
      
      // Register the model in the entity
      const log = entity.onNewGeneration('model', modelUrl, prompt);
      
      // Set the entity as selected
    //   this.engine.getSelectionManager().selectEntity(entity);
      
      // Notify user
      console.log(`Imported 3D model as entity: ${entity.name}`);
      
      return entity;
    } catch (error) {
      console.error("Error importing 3D model:", error);
      return null;
    }
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

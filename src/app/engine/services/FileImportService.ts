import { GenerativeEntity } from "../entity/types/GenerativeEntity";
import { EditorEngine } from "@/app/engine/EditorEngine";
import { v4 as uuidv4 } from 'uuid';
import { ImageRatio } from "../utils/imageUtil";
import { EntityFactory } from "../entity/EntityFactory";
import { FileManagerFactory } from './FileManagerFactory';

// Declare global electron interface
declare global {
  interface Window {
    electron?: {
      saveFile: (data: ArrayBuffer, fileName: string) => Promise<string>;
      readFile: (filePath: string) => Promise<ArrayBuffer>;
      getAppDataPath: () => Promise<string>;
      loadImageData: (filePath: string) => Promise<string>;
      isElectron: boolean;
      versions?: {
        electron: string;
        node: string;
        chrome: string;
      };
    }
  }
}

/**
 * Service to handle file imports into the editor
 */
export class FileImportService {
  private engine: EditorEngine;

  constructor(engine: EditorEngine) {
    this.engine = engine;
  }

  /**
   * Main entry point for importing files
   * @param file The file object to import
   * @returns Promise resolving to the created entity or null if import failed
   */
  static async importFile(file: File): Promise<GenerativeEntity | null> {
    try {
      console.log(`Importing file: ${file.name}`);
      
      // Get file extension
      const extension = file.name.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
      
      // Determine which import method to use based on file extension
      if (extension === '.glb' || extension === '.gltf') {
        // Handle 3D model
        return await FileImportService.importModelFile(file);
      } else if (['.jpg', '.jpeg', '.png'].includes(extension)) {
        // Handle image
        return await FileImportService.importImageFile(file);
      } else {
        console.error(`Unsupported file type: ${extension}`);
        return null;
      }
    } catch (error) {
      console.error("Error importing file:", error);
      return null;
    }
  }

  /**
   * Import an image file and create a GenerativeEntity with it
   * @param file The image file to import
   * @returns Promise resolving to the created entity or null if import failed
   */
  static async importImageFile(file: File): Promise<GenerativeEntity | null> {
    try {
      // Get appropriate file manager
      const fileManager = FileManagerFactory.getFileManager();
      
      // Read file as array buffer
      const imageData = await FileImportService.readFileAsArrayBuffer(file);
      
      // Save the file using the file manager
      const imageUrl = await fileManager.saveFile(
        imageData, 
        file.name,
        file.type || 'image/jpeg'
      );
      
      // Determine aspect ratio (still need data URL for this)
      const tempDataUrl = await FileImportService.readFileAsDataURL(file);
      const ratio = await FileImportService.getImageAspectRatio(tempDataUrl);
      
      // Create entity with the URL
      return await FileImportService.importImage(imageUrl, file.name, ratio);
    } catch (error) {
      console.error("Error importing image file:", error);
      return null;
    }
  }

  /**
   * Import a 3D model file and create a GenerativeEntity with it
   * @param file The 3D model file to import
   * @returns Promise resolving to the created entity or null if import failed
   */
  static async importModelFile(file: File): Promise<GenerativeEntity | null> {
    try {
      // Get appropriate file manager
      const fileManager = FileManagerFactory.getFileManager();
      
      // Read the file as ArrayBuffer
      const modelData = await FileImportService.readFileAsArrayBuffer(file);
      
      // Save the file using file manager
      const modelUrl = await fileManager.saveFile(
        modelData, 
        file.name,
        file.type || 'model/gltf-binary'
      );
      
      // Create entity with the URL
      return await FileImportService.importModel(modelUrl, file.name);
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
  static async importImage(imageUrl: string, fileName: string, ratio: ImageRatio = '1:1'): Promise<GenerativeEntity | null> {
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
      const log = entity.onNewGeneration('image', imageUrl, prompt);
      
      // Update aspect ratio
      entity.updateAspectRatio(ratio);
      
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
   * @param modelUrl The model URL (file:// protocol or blob:// URL)
   * @param fileName The original file name (for metadata)
   * @returns The created entity or null if import failed
   */
  static async importModel(modelUrl: string, fileName: string): Promise<GenerativeEntity | null> {
    try {
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

import { FileManager } from '../interfaces/FileManager';
import { LocalFileManager } from './LocalFileManager';
import { BlobFileManager } from './BlobFileManager';

/**
 * Factory that provides the appropriate FileManager implementation
 * based on the current environment
 */
export class FileManagerFactory {
  /**
   * Get the appropriate FileManager for the current environment
   * Prefers LocalFileManager (Electron) if available, falls back to BlobFileManager (Web)
   */
  static getFileManager(): FileManager {
    try {
      // First try local file manager (Electron)
      const localManager = LocalFileManager.getInstance();
      
      // Check if we're actually in Electron with proper APIs initialized
      if (typeof window !== 'undefined' && window.electron && window.electron.isElectron) {
        console.log("Using LocalFileManager for Electron environment");
        return localManager;
      }
      
      // Fall back to blob URLs (Web)
      console.log("Electron API not detected, using BlobFileManager");
      const blobManager = BlobFileManager.getInstance();
      return blobManager;
    } catch (error) {
      console.error("Error in FileManagerFactory:", error);
      
      // Last resort - return BlobFileManager as fallback
      return BlobFileManager.getInstance();
    }
  }
} 
import { FileWorker } from './FileService';
import { v4 as uuidv4 } from 'uuid';

/**
 * LocalFileWorker handles file operations for Electron environments
 * using the local filesystem through IPC
 */
export class LocalFileWorker implements FileWorker {

  /**
   * Check if we're in an Electron environment with file system access
   */
  public isSupported(): boolean {
    return typeof window !== 'undefined' && window.electron?.isElectron === true;
  }

  /**
   * Save a file to the local filesystem
   * @param data Binary data to save
   * @param fileName Name of the file (optional, will generate UUID if not provided)
   * @param fileType MIME type of the file
   * @returns URL to the saved file (file:// protocol)
   */
  public async saveFile(data: ArrayBuffer, fileName: string, fileType: string): Promise<string> {
    if (!this.isSupported()) {
      throw new Error('Local file operations are not supported in this environment');
    }
    
    // Generate a unique filename if none provided
    if (!fileName || fileName.trim() === '') {
      const extension = this.getExtensionFromFileType(fileType);
      fileName = `${uuidv4()}${extension}`;
    } else if (!fileName.includes('.')) {
      // Add extension if missing
      const extension = this.getExtensionFromFileType(fileType);
      fileName = `${fileName}${extension}`;
    }
    
    // Check if window.electron exists before using it
    if (!window.electron) {
      throw new Error('Electron API is not available');
    }
    
    // Use the Electron IPC bridge to save the file
    return await window.electron.saveFile(data, fileName);
  }

  /**
   * Read a file from the local filesystem
   * @param fileUrl URL of the file to read (file:// protocol)
   * @returns File data as ArrayBuffer
   */
  public async readFile(fileUrl: string): Promise<ArrayBuffer> {
    if (!this.isSupported()) {
      throw new Error('Local file operations are not supported in this environment');
    }
    
    if (!window.electron) {
      throw new Error('Electron API is not available');
    }
    
    const result = await window.electron.readFile(fileUrl);
    return result;
  }

  /**
   * Read a file from the local filesystem and return it as a Base64 string
   * @param fileUrl URL of the file to read (file:// protocol)
   * @returns File data as a Base64 string
   */
  public async readFileAsBase64(fileUrl: string): Promise<string> {
    if (!this.isSupported()) {
      throw new Error('Local file operations are not supported in this environment');
    }
    
    if (!window.electron) {
      throw new Error('Electron API is not available');
    }
    
    // First read the file as an ArrayBuffer
    const arrayBuffer = await this.readFile(fileUrl);
    
    // Convert the ArrayBuffer to a Base64 string
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Get the path where files are stored
   * @returns Path to the storage directory
   */
  public async getStoragePath(): Promise<string> {
    if (!this.isSupported()) {
      throw new Error('Local file operations are not supported in this environment');
    }
    
    if (!window.electron) {
      throw new Error('Electron API is not available');
    }
    
    return await window.electron.getAppDataPath();
  }
  
  /**
   * Utility to get file extension from MIME type
   */
  private getExtensionFromFileType(fileType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'model/gltf-binary': '.glb',
      'model/gltf+json': '.gltf'
    };
    
    return map[fileType] || '';
  }

  /**
   * Save a file to a specific path on the local filesystem (Electron only)
   * @param data Binary data to save
   * @param filePath The full, absolute path to save the file to
   * @returns Promise resolving when save is complete or rejecting on error
   */
  public async saveFileToPath(data: ArrayBuffer, filePath: string): Promise<void> {
    if (!this.isSupported() || !window.electron) {
      throw new Error('Local file operations (saveFileToPath) are not supported in this environment');
    }
    if (!filePath) {
        throw new Error('File path cannot be empty');
    }

    // Use the Electron IPC bridge to write the file to the specified path
    const result = await window.electron.writeFile(filePath, data);

    console.log(`LocalFileWorker: saveFileToPath: result:`, result);
    if (!result.success) {
        throw new Error(`Failed to save file to path ${filePath}: ${result.error || 'Unknown error'}`);
    }
  }
} 
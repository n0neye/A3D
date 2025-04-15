import { FileManager } from '../interfaces/FileManager';
import { v4 as uuidv4 } from 'uuid';

/**
 * BlobFileManager is a web-compatible file manager that uses in-memory storage
 * This is a placeholder implementation that will be expanded in the future
 * with cloud storage upload features
 */
export class BlobFileManager implements FileManager {
  private static instance: BlobFileManager;
  private blobUrls: Map<string, string> = new Map();
  
  private constructor() {}
  
  public static getInstance(): BlobFileManager {
    if (!BlobFileManager.instance) {
      BlobFileManager.instance = new BlobFileManager();
    }
    return BlobFileManager.instance;
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'URL' in window;
  }

  public async saveFile(data: ArrayBuffer, fileName: string, fileType: string): Promise<string> {
    if (!this.isSupported()) {
      throw new Error('Blob URL operations are not supported in this environment');
    }
    
    // Create a blob URL for in-memory storage
    const blob = new Blob([data], { type: fileType });
    const blobUrl = URL.createObjectURL(blob);
    
    // Store a reference to revoke later
    this.blobUrls.set(fileName, blobUrl);
    
    console.log("Using in-memory storage via BlobFileManager");
    
    // TODO: Future implementation will upload to cloud storage
    // and return a permanent URL instead of a temporary blob URL
    
    return blobUrl;
  }

  public async readFile(fileUrl: string): Promise<ArrayBuffer> {
    if (!this.isSupported()) {
      throw new Error('Blob URL operations are not supported in this environment');
    }
    
    // Simple implementation that fetches the blob URL
    const response = await fetch(fileUrl);
    return await response.arrayBuffer();
    
    // TODO: Future implementation will download from cloud storage
  }

  public async getStoragePath(): Promise<string> {
    return 'memory';
    // TODO: Future implementation will return cloud storage path
  }
  
  // Important: Call this when your app unloads to prevent memory leaks
  public revokeAllBlobUrls(): void {
    this.blobUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.blobUrls.clear();
  }
} 
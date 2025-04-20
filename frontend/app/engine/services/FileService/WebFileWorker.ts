import { FileWorker } from './FileService';
/**
 * WebFileWorker is a web-compatible file manager that utilizes cloud storage and in-memory storage
 * This is a placeholder implementation that will be expanded in the future with cloud storage upload features
 */
export class WebFileWorker implements FileWorker {
  // private static instance: WebFileWorker;
  private blobUrls: Map<string, string> = new Map();

  public async saveFile(data: ArrayBuffer, fileName: string, fileType: string): Promise<string> {
    
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
    
    // Simple implementation that fetches the blob URL
    const response = await fetch(fileUrl);
    return await response.arrayBuffer();
    
    // TODO: Future implementation will download from cloud storage
  }

  /**
   * Read a file from a blob URL and return it as a Base64 string
   * @param fileUrl URL of the file to read
   * @returns File data as a Base64 string
   */
  public async readFileAsBase64(fileUrl: string): Promise<string> {
    
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
  
  // Important: Call this when your app unloads to prevent memory leaks
  public revokeAllBlobUrls(): void {
    this.blobUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.blobUrls.clear();
  }
} 
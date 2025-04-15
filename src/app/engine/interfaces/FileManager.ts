export interface FileManager {
  saveFile(data: ArrayBuffer, fileName: string, fileType: string): Promise<string>;
  readFile(fileUrl: string): Promise<ArrayBuffer>;
  getStoragePath(): Promise<string>;
  isSupported(): boolean;
} 
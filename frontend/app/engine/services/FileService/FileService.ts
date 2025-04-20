import { LocalFileWorker } from './LocalFileWorker';
import { WebFileWorker } from './WebFileWorker';

export interface FileWorker {
  saveFile(data: ArrayBuffer, fileName: string, fileType: string): Promise<string>;
  readFile(fileUrl: string): Promise<ArrayBuffer>;
  readFileAsBase64(fileUrl: string): Promise<string>;
}
/**
 * Factory that provides the appropriate FileService implementation
 * based on the current environment
 */
export class FileService {

  static instance: FileService;
  private isElectron: boolean = false;
  private localFileWorker: LocalFileWorker;
  private webFileWorker: WebFileWorker;

  static getInstance(): FileService {
    if (!FileService.instance) {
      FileService.instance = new FileService();
    }
    return FileService.instance;
  }

  constructor() {
    this.isElectron = (typeof window !== 'undefined' && window.electron && window.electron.isElectron) || false;
    this.localFileWorker = new LocalFileWorker();
    this.webFileWorker = new WebFileWorker();
  }

  saveFile(data: ArrayBuffer, fileName: string, fileType: string): Promise<string> {
    if (this.isElectron) {
      return this.localFileWorker.saveFile(data, fileName, fileType);
    }
    return this.webFileWorker.saveFile(data, fileName, fileType);
  }

  readFile(fileUrl: string): Promise<ArrayBuffer> {
    if (this.isLocalFile(fileUrl)) {
      return this.localFileWorker.readFile(fileUrl);
    }
    return this.webFileWorker.readFile(fileUrl);
  }
  

  readFileAsBase64(fileUrl: string): Promise<string> {
    if (this.isLocalFile(fileUrl)) {
      return this.localFileWorker.readFileAsBase64(fileUrl);
    }
    return this.webFileWorker.readFileAsBase64(fileUrl);
  }

  async readFileAsDataUrl(fileUrl: string): Promise<string> {
    if(fileUrl.startsWith('data:image')){
      return fileUrl;
    }

    let base64Data: string;
    if (this.isLocalFile(fileUrl)) {
      base64Data = await this.localFileWorker.readFileAsBase64(fileUrl);
    } else {
      base64Data = await this.webFileWorker.readFileAsBase64(fileUrl);
    }

    return `data:image/png;base64,${base64Data}`;
  }

  isLocalFile(fileUrl: string): boolean {
    return fileUrl.startsWith('file://');
  }
} 
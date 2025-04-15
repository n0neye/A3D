import { FileImportService } from './services/FileImportService';

export class EditorEngine {
  private fileImportService: FileImportService;
  
  constructor() {
    // Initialize services
    this.fileImportService = new FileImportService(this);
  }
  
  /**
   * Get file import service
   * @returns FileImportService instance
   */
  public getFileImportService(): FileImportService {
    return this.fileImportService;
  }
} 
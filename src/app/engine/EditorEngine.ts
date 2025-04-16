import { ImportService } from './services/ImportService';

export class EditorEngine {
  private fileImportService: ImportService;
  
  constructor() {
    // Initialize services
    this.fileImportService = new ImportService(this);
  }
  
  /**
   * Get file import service
   * @returns FileImportService instance
   */
  public getFileImportService(): ImportService {
    return this.fileImportService;
  }
} 
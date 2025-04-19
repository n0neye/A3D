interface Window {
  electron?: {
    isElectron: boolean;
    versions: {
      electron: string;
      node: string;
      chrome: string;
    };

    // --- Electron API --- 
    ping: () => string;
    
    saveFile: (data: ArrayBuffer, fileName: string) => Promise<string>;
    readFile: (filePath: string) => Promise<ArrayBuffer>;
    getAppDataPath: () => Promise<string>;
    
    showOpenDialog: () => Promise<{ filePath: string; content: string } | null>;
    showSaveDialog: (defaultName: string) => Promise<string | null>;
    writeFile: (filePath: string, data: ArrayBuffer) => Promise<{ success: boolean; error?: string }>;
    loadImageData: (filePath: string) => Promise<string>;
    
    // Add user preferences API
    userPreferences: {
      get: <T>(key: string) => Promise<T>;
      set: <T>(key: string, value: T) => Promise<boolean>;
      getAll: () => Promise<Record<string, any>>;
      setAll: (preferences: Record<string, any>) => Promise<boolean>;
      reset: () => Promise<boolean>;
    }
  };

  // Add the missing definition
  showSaveFilePicker?(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
}

// Add these interfaces for the File System Access API
interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
  // Add other methods if needed
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: any): Promise<void>;
  close(): Promise<void>;
  // Add other methods/properties if needed
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    description?: string;
    accept?: Record<string, string[]>;
  }>;
} 
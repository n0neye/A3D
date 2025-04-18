interface Window {
  electron?: {
    isElectron: boolean;
    versions: {
      electron: string;
      node: string;
      chrome: string;
    };
    saveFile: (data: Buffer, fileName: string) => Promise<string>;
    readFile: (filePath: string) => Promise<ArrayBuffer>;
    getAppDataPath: () => Promise<string>;
    ping: () => string;
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
} 
import { Observer } from "../utils/Observer";

export interface UserPreferences {
  falApiKey: string;
  theme: 'light' | 'dark';
  renderMode: "fal" | "comfyui";
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  falApiKey: '',
  theme: 'dark',
  renderMode: "fal"
};

/**
 * UserPrefManager
 * 
 * Manages user preferences that persist between sessions
 * Uses Electron's IPC bridge for storage when available, falls back to localStorage
 */
export class UserPrefManager {
  private isElectron: boolean;
  public observer = new Observer<{
    preferencesChanged: { preferences: UserPreferences };
  }>();
  
  private inMemoryPrefs: UserPreferences = DEFAULT_PREFERENCES;

  constructor() {
    // Check if we're in Electron environment
    this.isElectron = typeof window !== 'undefined' && window.electron !== undefined;
    
    // Initialize preferences
    this.initPreferences();
  }

  /**
   * Initialize preferences from storage
   */
  private async initPreferences() {
    try {
      this.inMemoryPrefs = await this.getPreferences();
    } catch (error) {
      console.error('Error initializing preferences', error);
      this.inMemoryPrefs = DEFAULT_PREFERENCES;
    }
  }

  /**
   * Gets all preferences
   */
  public async getPreferences(): Promise<UserPreferences> {
    if (this.isElectron && window.electron) {
      return await window.electron.userPreferences.getAll() as UserPreferences;
    } else {
      try {
        const storedPrefs = localStorage.getItem('user-preferences');
        return storedPrefs ? JSON.parse(storedPrefs) : DEFAULT_PREFERENCES;
      } catch (error) {
        console.error('Error reading preferences from localStorage', error);
        return DEFAULT_PREFERENCES;
      }
    }
  }


  /**
   * Gets a specific preference value
   */
  public async getPreference<K extends keyof UserPreferences>(key: K): Promise<UserPreferences[K]> {
    if (this.isElectron && window.electron) {
      return await window.electron.userPreferences.get(key) as UserPreferences[K];
    } else {
      try {
        const storedPrefs = localStorage.getItem('user-preferences');
        const prefs = storedPrefs ? JSON.parse(storedPrefs) : DEFAULT_PREFERENCES;
        return prefs[key];
      } catch (error) {
        console.error(`Error reading ${key} from localStorage`, error);
        return DEFAULT_PREFERENCES[key];
      }
    }
  }

  /**
   * Updates preferences and notifies observers
   */
  public async setPreferences(preferences: Partial<UserPreferences>): Promise<void> {
    if (this.isElectron && window.electron) {
      await window.electron.userPreferences.setAll(preferences);
      
      // Update local cache
      this.inMemoryPrefs = {
        ...this.inMemoryPrefs,
        ...preferences
      };
    } else {
      try {
        const storedPrefs = localStorage.getItem('user-preferences');
        const prefs = storedPrefs ? JSON.parse(storedPrefs) : DEFAULT_PREFERENCES;
        const newPrefs = { ...prefs, ...preferences };
        localStorage.setItem('user-preferences', JSON.stringify(newPrefs));
        
        // Update local cache
        this.inMemoryPrefs = newPrefs;
      } catch (error) {
        console.error('Error writing to localStorage', error);
      }
    }
    
    // Notify observers
    this.observer.notify('preferencesChanged', { 
      preferences: this.inMemoryPrefs 
    });
  }

  /**
   * Updates a specific preference
   */
  public async setPreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): Promise<void> {
    // Update the specific preference
    if (this.isElectron && window.electron) {
      await window.electron.userPreferences.set(key, value);
      
      // Update local cache
      this.inMemoryPrefs[key] = value;
    } else {
      try {
        const storedPrefs = localStorage.getItem('user-preferences');
        const prefs = storedPrefs ? JSON.parse(storedPrefs) : DEFAULT_PREFERENCES;
        prefs[key] = value;
        localStorage.setItem('user-preferences', JSON.stringify(prefs));
        
        // Update local cache
        this.inMemoryPrefs[key] = value;
      } catch (error) {
        console.error('Error writing to localStorage', error);
      }
    }
    // Also notify general preferences change
    console.log("UserPrefManager: setPreference: notify preferencesChanged", this.inMemoryPrefs);
    this.observer.notify('preferencesChanged', { 
      preferences: this.inMemoryPrefs 
    });
  }

  /**
   * Resets preferences to defaults
   */
  public async resetPreferences(): Promise<void> {
    if (this.isElectron && window.electron) {
      await window.electron.userPreferences.reset();
      this.inMemoryPrefs = DEFAULT_PREFERENCES;
    } else {
      localStorage.removeItem('user-preferences');
      this.inMemoryPrefs = DEFAULT_PREFERENCES;
    }
    
    this.observer.notify('preferencesChanged', { 
      preferences: DEFAULT_PREFERENCES 
    });
  }
}

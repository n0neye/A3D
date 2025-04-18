import { Observer } from "../utils/Observer";
import Store from 'electron-store';

export interface UserPreferences {
  falApiKey: string;
  theme: 'light' | 'dark';
}

const DEFAULT_PREFERENCES: UserPreferences = {
  falApiKey: '',
  theme: 'dark'
};

/**
 * UserPrefManager
 * 
 * Manages user preferences that persist between sessions
 * Uses Electron Store for storage
 */
export class UserPrefManager {
  private store: Store<UserPreferences>;
  public observer = new Observer<{
    preferencesChanged: { preferences: UserPreferences };
    themeChanged: { theme: 'light' | 'dark' };
    falApiKeyChanged: { apiKey: string };
  }>();

  constructor() {
    try {
      // Initialize electron-store with schema
      this.store = new Store<UserPreferences>({
        name: 'user-preferences',
        defaults: DEFAULT_PREFERENCES,
        schema: {
          falApiKey: {
            type: 'string'
          },
          theme: {
            type: 'string',
            enum: ['light', 'dark']
          }
        }
      });
    } catch (error) {
      // Fallback to localStorage if electron-store is not available (browser context)
      console.warn('Electron Store not available, falling back to localStorage');
      this.store = this.createLocalStorageFallback();
    }
  }

  /**
   * Creates a localStorage-based fallback that mimics electron-store API
   * This allows the app to work in both Electron and browser contexts
   */
  private createLocalStorageFallback(): Store<UserPreferences> {
    return {
      get: (key?: string) => {
        if (!key) {
          try {
            const storedPrefs = localStorage.getItem('user-preferences');
            return storedPrefs ? JSON.parse(storedPrefs) : DEFAULT_PREFERENCES;
          } catch (error) {
            console.error('Error reading preferences from localStorage', error);
            return DEFAULT_PREFERENCES;
          }
        }
        
        try {
          const storedPrefs = localStorage.getItem('user-preferences');
          const prefs = storedPrefs ? JSON.parse(storedPrefs) : DEFAULT_PREFERENCES;
          return prefs[key];
        } catch (error) {
          console.error(`Error reading ${key} from localStorage`, error);
          return DEFAULT_PREFERENCES[key as keyof UserPreferences];
        }
      },
      
      set: (key: string | Partial<UserPreferences>, value?: any) => {
        try {
          // Handle object-style set: store.set({ theme: 'dark' })
          if (typeof key === 'object') {
            const storedPrefs = localStorage.getItem('user-preferences');
            const prefs = storedPrefs ? JSON.parse(storedPrefs) : DEFAULT_PREFERENCES;
            const newPrefs = { ...prefs, ...key };
            localStorage.setItem('user-preferences', JSON.stringify(newPrefs));
            return;
          }
          
          // Handle key-value style set: store.set('theme', 'dark')
          const storedPrefs = localStorage.getItem('user-preferences');
          const prefs = storedPrefs ? JSON.parse(storedPrefs) : DEFAULT_PREFERENCES;
          prefs[key] = value;
          localStorage.setItem('user-preferences', JSON.stringify(prefs));
        } catch (error) {
          console.error('Error writing to localStorage', error);
        }
      },
      
      // Add minimal Store API implementation
      has: (key: string) => {
        const prefs = localStorage.getItem('user-preferences');
        if (!prefs) return false;
        return key in JSON.parse(prefs);
      },
      reset: () => {
        localStorage.setItem('user-preferences', JSON.stringify(DEFAULT_PREFERENCES));
      },
      // Add stubs for other required methods
      onDidChange: () => { return () => {}; },
      store: DEFAULT_PREFERENCES,
    } as unknown as Store<UserPreferences>;
  }

  /**
   * Gets all preferences
   */
  public getPreferences(): UserPreferences {
    return this.store.get() as UserPreferences;
  }

  /**
   * Gets a specific preference value
   */
  public getPreference<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
    return this.store.get(key) as UserPreferences[K];
  }

  /**
   * Updates preferences and notifies observers
   */
  public setPreferences(preferences: Partial<UserPreferences>): void {
    this.store.set(preferences);
    
    // Notify observers
    this.observer.notify('preferencesChanged', { 
      preferences: this.getPreferences() 
    });
    
    // Notify individual property changes
    if (preferences.theme !== undefined) {
      this.observer.notify('themeChanged', { theme: preferences.theme });
    }
    
    if (preferences.falApiKey !== undefined) {
      this.observer.notify('falApiKeyChanged', { apiKey: preferences.falApiKey });
    }
  }

  /**
   * Updates a specific preference
   */
  public setPreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
    this.store.set(key, value);
    
    // Notify specific change
    if (key === 'theme') {
      this.observer.notify('themeChanged', { theme: value as 'light' | 'dark' });
    } else if (key === 'falApiKey') {
      this.observer.notify('falApiKeyChanged', { apiKey: value as string });
    }
    
    // Also notify general preferences change
    this.observer.notify('preferencesChanged', { 
      preferences: this.getPreferences() 
    });
  }

  /**
   * Resets preferences to defaults
   */
  public resetPreferences(): void {
    this.store.reset();
    this.observer.notify('preferencesChanged', { 
      preferences: DEFAULT_PREFERENCES 
    });
    this.observer.notify('themeChanged', { theme: DEFAULT_PREFERENCES.theme });
    this.observer.notify('falApiKeyChanged', { apiKey: DEFAULT_PREFERENCES.falApiKey });
  }
}

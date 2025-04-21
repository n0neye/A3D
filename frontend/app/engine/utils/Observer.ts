/**
 * Type-safe observer pattern implementation.
 * This replaces the string-based event emitter with typed event subscription.
 */
export class Observer<T extends Record<string, any>> {
  private listeners: {
    [K in keyof T]?: Array<(data: T[K]) => void>;
  } = {};

  /**
   * Subscribe to an event with type-safe callback
   */
  public subscribe<K extends keyof T>(event: K, callback: (data: T[K]) => void): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    
    this.listeners[event]?.push(callback);
    
    // Return unsubscribe function
    return () => {
      if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event]?.filter(
          cb => cb !== callback
        );
      }
    };
  }

  /**
   * Notify all subscribers with type-checked payload
   */
  public notify<K extends keyof T>(event: K, data: T[K]): void {
    if (this.listeners[event]) {
      this.listeners[event]?.forEach(callback => callback(data));
    }
  }
}

/**
 * Type-safe observer pattern implementation.
 * This replaces the string-based event emitter with typed event subscription.
 */

import { EntityBase } from "@/app/engine/entity/EntityBase";
import { GizmoMode } from "../managers/GizmoModeManager";
import { ImageRatio } from "@/app/util/generation/generation-util";

// Define all possible event types with their payload types
export interface EngineEvents {
  entitySelected: { entity: EntityBase | null };
  gizmoModeChanged: { mode: GizmoMode };
  entityCreated: { entity: EntityBase };
  entityDeleted: { entity: EntityBase };
  cameraChanged: { fov: number, farClip: number };
  ratioOverlayChanged: { 
    isVisible: boolean;
    padding: number;
    ratio: ImageRatio;
  };
  // Add more events as needed
}

export type EventKey = keyof EngineEvents;

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

// Create a singleton instance for the engine
export const engineObserver = new Observer<EngineEvents>(); 
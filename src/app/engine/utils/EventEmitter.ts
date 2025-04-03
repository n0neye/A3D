/**
 * EventEmitter.ts
 * 
 * A simple implementation of the Observer pattern for decoupled communication.
 * This utility class allows:
 * - Components to subscribe to named events
 * - Other components to emit events without knowing who's listening
 * - Clean separation between the Babylon engine and React components
 * 
 * The event system is central to our decoupled architecture, letting the
 * 3D engine functions run independently while still keeping the UI updated.
 */
type EventCallback = (data: any) => void;

export class EventEmitter {
  private events: Map<string, EventCallback[]> = new Map();
  
  public on(event: string, callback: EventCallback): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }
  
  public off(event: string, callback: EventCallback): void {
    if (!this.events.has(event)) return;
    
    const callbacks = this.events.get(event)!;
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }
  
  public emit(event: string, data?: any): void {
    if (!this.events.has(event)) return;
    
    this.events.get(event)!.forEach(callback => {
      callback(data);
    });
  }
} 
import { Observer } from "../utils/Observer"; // Import Observer

// Define the command interface that all commands must implement
export interface Command {
  execute(): void;
  undo(): void;
}

export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  // Add observer to notify about changes
  public observer = new Observer<{ historyChanged: null }>();

  // If pushOnly is true, the command will not be executed, but will be added to the undo stack
  executeCommand(command: Command, pushOnly: boolean = false): void {
    if(!pushOnly) {
      command.execute();
    }
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack when new command is executed
    this.observer.notify('historyChanged', null); // Notify observers
  }

  undo(): void {
    if (this.undoStack.length === 0) return;
    
    const command = this.undoStack.pop()!;
    command.undo();
    this.redoStack.push(command);
    this.observer.notify('historyChanged', null); // Notify observers
  }

  redo(): void {
    console.log("redo");
    if (this.redoStack.length === 0) return;
    
    const command = this.redoStack.pop()!;
    command.execute();
    this.undoStack.push(command);
    this.observer.notify('historyChanged', null); // Notify observers
  }

  // Optional: Method to check if there are any commands in the undo stack
  hasHistory(): boolean {
      return this.undoStack.length > 0;
  }

  // Method to clear history (e.g., on project load/new)
  clearHistory(): void {
      this.undoStack = [];
      this.redoStack = [];
      this.observer.notify('historyChanged', null); // Notify observers
  }
} 
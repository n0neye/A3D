// Command interface that all history operations must implement
export interface Command {
  execute(): void;
  undo(): void;
}

// History manager to track and execute commands
export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistorySize: number = 50;

  constructor(maxHistorySize: number = 50) {
    this.maxHistorySize = maxHistorySize;
  }

  // Execute a command and add it to the history
  public executeCommand(command: Command): void {
    // Execute the command
    command.execute();
    
    // Add to undo stack
    this.undoStack.push(command);
    
    // Clear redo stack (can't redo after a new action)
    this.redoStack = [];
    
    // Limit history size
    if (this.undoStack.length > this.maxHistorySize) {
      this.undoStack.shift();
    }
  }

  // Undo the last command
  public undo(): void {
    if (this.undoStack.length === 0) {
      console.log("Nothing to undo");
      return;
    }
    
    // Pop the last command from undo stack
    const command = this.undoStack.pop();
    
    if (command) {
      // Undo it
      command.undo();
      
      // Add to redo stack
      this.redoStack.push(command);
    }
  }

  // Redo the last undone command
  public redo(): void {
    if (this.redoStack.length === 0) {
      console.log("Nothing to redo");
      return;
    }
    
    // Pop the last command from redo stack
    const command = this.redoStack.pop();
    
    if (command) {
      // Execute it again
      command.execute();
      
      // Add back to undo stack
      this.undoStack.push(command);
    }
  }

  // Clear all history
  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  // Get the current size of the undo stack
  public get undoStackSize(): number {
    return this.undoStack.length;
  }

  // Get the current size of the redo stack
  public get redoStackSize(): number {
    return this.redoStack.length;
  }
}

// No React component here as this is just a utility class
export default HistoryManager; 
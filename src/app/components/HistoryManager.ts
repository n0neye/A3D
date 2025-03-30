// Define the command interface that all commands must implement
export interface Command {
  execute(): void;
  undo(): void;
}

export class HistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  executeCommand(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack when new command is executed
  }

  undo(): void {
    if (this.undoStack.length === 0) return;
    
    const command = this.undoStack.pop()!;
    command.undo();
    this.redoStack.push(command);
  }

  redo(): void {
    console.log("redo");
    if (this.redoStack.length === 0) return;
    
    const command = this.redoStack.pop()!;
    command.execute();
    this.undoStack.push(command);
  }
} 
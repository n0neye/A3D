import { EditorModeManager } from './modeManager';
import { DefaultMode } from './modes/defaultMode';

// Initialize all editor modes
export function initializeEditorModes(): void {
  const modeManager = EditorModeManager.getInstance();
  
  // Register all available modes
  modeManager.registerMode(new DefaultMode());
  
  // Start in default mode
  console.log('Editor modes initialized');
} 
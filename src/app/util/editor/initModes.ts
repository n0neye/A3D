import { EditorModeManager } from './modeManager';
import { DefaultMode } from './modes/defaultMode';
import { EntityMode } from './modes/entityMode';

// Initialize all editor modes
export function initializeEditorModes(): void {
  const modeManager = EditorModeManager.getInstance();
  
  // Register all available modes
  modeManager.registerMode(new DefaultMode());
  modeManager.registerMode(new EntityMode());
  
  // Start in default mode
  console.log('Editor modes initialized');
} 
import { EditorModeManager } from './modeManager';
import { DefaultMode } from './modes/defaultMode';
import { ObjectManipulationMode } from './modes/objectMode';
import { BoneEditMode } from './modes/boneEditMode';
import { IKPoseMode } from './modes/ikMode';

// Initialize all editor modes
export function initializeEditorModes(): void {
  const modeManager = EditorModeManager.getInstance();
  
  // Register all available modes
  modeManager.registerMode(new DefaultMode());
  modeManager.registerMode(new ObjectManipulationMode());
  modeManager.registerMode(new BoneEditMode());
  modeManager.registerMode(new IKPoseMode());
  
  // Start in default mode
  console.log('Editor modes initialized');
} 
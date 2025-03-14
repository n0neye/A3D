// Global scene editing modes
export enum EditMode {
  Default = 'default',
  ObjectManipulation = 'object',
  BoneEditing = 'bone',
  IKPosing = 'ik'
}

// Current active edit mode
let currentEditMode: EditMode = EditMode.Default;

// Get current edit mode
export const getCurrentEditMode = (): EditMode => {
  return currentEditMode;
};

// Set current edit mode
export const setEditMode = (mode: EditMode): void => {
  console.log(`Setting edit mode to: ${mode}`);
  currentEditMode = mode;
};

// Check if in specific mode
export const isInMode = (mode: EditMode): boolean => {
  return currentEditMode === mode;
}; 
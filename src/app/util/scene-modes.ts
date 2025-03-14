// Global scene editing modes
export enum EditModeEnum {
  Default = 'default',
  ObjectManipulation = 'object',
  BoneEditing = 'bone',
  IKPosing = 'ik'
}

// Current active edit mode
let currentEditMode: EditModeEnum = EditModeEnum.Default;

// Get current edit mode
export const getCurrentEditMode = (): EditModeEnum => {
  return currentEditMode;
};

// Set current edit mode
export const setEditMode = (mode: EditModeEnum): void => {
  console.log(`Setting edit mode to: ${mode}`);
  currentEditMode = mode;
};

// Check if in specific mode
export const isInMode = (mode: EditModeEnum): boolean => {
  return currentEditMode === mode;
}; 
// Global scene editing modes
export enum EditModeEnum {
  Default = 'default',
  ObjectManipulation = 'object',
}

// Helper function to get a friendly mode name
export const getModeName = (modeId: string | null): string => {
  if (!modeId) return 'Default';

  switch (modeId) {
    case 'object': return 'Object Manipulation';
    default: return 'Default';
  }
};

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
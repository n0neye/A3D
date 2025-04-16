import React, { useState, useEffect } from 'react';
import { useEditorEngine } from '../context/EditorEngineContext';
import { IconFileImport, IconPhoto, Icon3dCubeSphere, IconX } from '@tabler/icons-react';
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_MODEL_TYPES, ImportService } from '../engine/services/ImportService';
import { toast } from 'sonner';

const FileDragDropOverlay: React.FC = () => {
  const { engine } = useEditorEngine();
  const [isDragging, setIsDragging] = useState(false);
  const [isValidFile, setIsValidFile] = useState<boolean | null>(null);
  const [fileType, setFileType] = useState<'image' | 'model' | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isDragging) setIsDragging(true);

      // Check if any files are being dragged
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        const item = e.dataTransfer.items[0];

        // Check for valid MIME types ONLY during dragover
        if (ACCEPTED_IMAGE_TYPES.includes(item.type)) {
          setIsValidFile(true);
          setFileType('image');
        } else if (ACCEPTED_MODEL_TYPES.includes(item.type)) {
          setIsValidFile(true);
          setFileType('model');
        } else {
          // If MIME type is not recognized, assume it *might* be valid
          // but wait for the 'drop' event to check the extension.
          // Keep isValidFile null to show the neutral "Drop Files Here" state.
          setIsValidFile(null);
          setFileType(null);
        }
      }
    };

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Only set dragging to false if we're leaving the window
      // Use related target to check if we're leaving to outside the window
      if (!e.relatedTarget || !(e.relatedTarget as Node).ownerDocument) {
        setIsDragging(false);
        setIsValidFile(null);
        setFileType(null);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (isImporting) return; // Prevent multiple simultaneous imports

      setIsDragging(false);
      try {

        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];

          // Check against accepted extensions here
          setIsImporting(true);
          // Use the simplified importFile method that handles all the complexity
          const result = await ImportService.importFile(file);

          if (!result) {
            throw new Error("An error occurred during import");
          }
        }
      } catch (error) {
        console.error("Error importing file:", error);
        toast.error(`Import failed`, {
          description: error instanceof Error ? error.message : "Failed to import file",
          duration: 5000,
        });
      } finally {
        setIsImporting(false);
      }

      setIsValidFile(null);
      setFileType(null);
    };

    // Add event listeners to the window
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    // Clean up event listeners
    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [engine, isDragging, isImporting]);

  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
      <div className={`
        relative p-8 rounded-lg border-2 border-dashed transition-all duration-300
        ${isValidFile === true ? 'border-green-500 bg-green-950/20' :
          isValidFile === false ? 'border-red-500 bg-red-950/20' :
            'border-gray-400 bg-gray-800/20'}
      `} style={{ width: '80%', maxWidth: '500px', height: '300px' }}>
        <div className="absolute top-2 right-2">
          {isValidFile === false && <IconX size={24} className="text-red-500" />}
        </div>

        <div className="flex flex-col items-center justify-center h-full gap-4">
          {fileType === 'image' ? (
            <IconPhoto size={64} className="text-blue-400" />
          ) : fileType === 'model' ? (
            <Icon3dCubeSphere size={64} className="text-purple-400" />
          ) : (
            <IconFileImport size={64} className="text-gray-400" />
          )}

          <div className="text-center">
            <h3 className="text-xl font-semibold mb-2">
              {isImporting ? 'Importing...' :
                isValidFile === true ? 'Drop to Import' :
                  isValidFile === false ? 'Unsupported File Type' :
                    'Drop Files Here'}
            </h3>
            <p className="text-sm text-gray-300">
              {isValidFile === false ?
                'Please use JPG, PNG, GLB, FBX files only' :
                'Supported formats: JPG, PNG, GLB, FBX'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileDragDropOverlay; 
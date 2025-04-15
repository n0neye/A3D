import React, { useState, useEffect } from 'react';
import { useEditorEngine } from '../context/EditorEngineContext';
import { IconFileImport, IconPhoto, Icon3dCubeSphere, IconX } from '@tabler/icons-react';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png'];
const ACCEPTED_MODEL_TYPES = ['model/gltf-binary', 'model/gltf+json'];
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.glb', '.gltf'];

const FileDragDropOverlay: React.FC = () => {
  const { engine } = useEditorEngine();
  const [isDragging, setIsDragging] = useState(false);
  const [isValidFile, setIsValidFile] = useState<boolean | null>(null);
  const [fileType, setFileType] = useState<'image' | 'model' | null>(null);

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!isDragging) setIsDragging(true);
      
      // Check if any files are being dragged
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        const item = e.dataTransfer.items[0];
        
        // Check for valid MIME types
        if (ACCEPTED_IMAGE_TYPES.includes(item.type)) {
          setIsValidFile(true);
          setFileType('image');
        } else if (ACCEPTED_MODEL_TYPES.includes(item.type)) {
          setIsValidFile(true);
          setFileType('model');
        } else {
          // Check for file extensions when MIME type is not recognized
          const fileName = e.dataTransfer.items[0].getAsFile()?.name || '';
          const extension = fileName.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
          
          if (ACCEPTED_EXTENSIONS.includes(extension)) {
            setIsValidFile(true);
            setFileType(extension === '.glb' || extension === '.gltf' ? 'model' : 'image');
          } else {
            setIsValidFile(false);
            setFileType(null);
          }
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
      
      setIsDragging(false);
      setIsValidFile(null);
      setFileType(null);
      
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        const extension = file.name.toLowerCase().match(/\.[^.]*$/)?.[0] || '';
        
        if (ACCEPTED_EXTENSIONS.includes(extension)) {
          console.log(`Importing file: ${file.name}`);
          
          // Read the file
          const fileReader = new FileReader();
          
          fileReader.onload = async (event) => {
            const fileData = event.target?.result;
            
            if (fileData) {
              if (extension === '.glb' || extension === '.gltf') {
                // Handle 3D model import (placeholder for now)
                console.log('3D model import will be implemented later');
                // TODO: engine.importModel(fileData);
              } else {
                // Handle image import (placeholder for now)
                console.log('Image import will be implemented later');
                // TODO: engine.importImage(fileData);
              }
              
              // Show success notification
              // TODO: Add a toast notification system
            }
          };
          
          if (extension === '.glb' || extension === '.gltf') {
            fileReader.readAsArrayBuffer(file);
          } else {
            fileReader.readAsDataURL(file);
          }
        }
      }
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
  }, [engine, isDragging]);

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
              {isValidFile === true ? 'Drop to Import' : 
               isValidFile === false ? 'Unsupported File Type' : 
               'Drop Files Here'}
            </h3>
            <p className="text-sm text-gray-300">
              {isValidFile === false ? 
                'Please use JPG, PNG, GLB or GLTF files only' : 
                'Supported formats: JPG, PNG, GLB, GLTF'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileDragDropOverlay; 
import React, { useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { useEditorContext } from '../context/EditorContext';  
import { AiObjectType, createEntity, EntityType } from '../util/extensions/entityNode';
import { ImageRatio, ImageSize } from '../util/extensions/entityNode';

const GenerationMenu: React.FC = () => {
  const { scene, setSelectedEntity } = useEditorContext();
  const [imageSize, setImageSize] = useState<ImageSize>('medium');
  
  // Create an entity
  const handleCreateEntity = (entityType: EntityType, aiObjectType: AiObjectType) => {
    if (!scene) return;
    
    console.log(`Creating ${entityType} entity`);
    
    // Create entity facing camera
    const camera = scene.activeCamera as BABYLON.ArcRotateCamera;
    if (!camera) {
      return;
    }
    
    // Calculate position in front of camera
    const distance = 3;
    const direction = camera.getTarget().subtract(camera.position).normalize();
    const position = camera.position.add(direction.scale(distance));
    
    // Create entity with the selected ratio and size
    const entity = createEntity(scene, entityType, {
      aiObjectType,
      position,
      imageSize
    });
    
    // Select the entity
    setSelectedEntity(entity);
  };
  
  return (
    <div className="fixed z-50 left-4 bottom-4  panel ">
      {/* <h3 className="text-lg font-medium mb-3 text-white">Add</h3> */}
      
      {/* Entity type buttons */}
      <div className="grid gap-2">
        <button
          onClick={() => handleCreateEntity('aiObject', 'object')}
          className="py-2 px-3 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm flex items-center justify-center h-14"
        >
          <span className="text-2xl mb-1">+</span>
           Add Object
        </button>
      </div>
    </div>
  );
};

export default GenerationMenu; 
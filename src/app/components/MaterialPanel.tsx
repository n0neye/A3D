'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { IconPalette } from '@tabler/icons-react';
import { useEditorEngine } from '../context/EditorEngineContext';
import { defaultMaterials, applyMaterialConfig, findDefaultShapeMaterial } from '../engine/utils/materialUtil';
import { ScrollArea } from "@/components/ui/scroll-area";
import * as THREE from 'three';

const MaterialPanel: React.FC = () => {
  const { engine } = useEditorEngine();
  const [activeMaterialIndex, setActiveMaterialIndex] = useState<number>(0);
//   const [defaultShapeMat, setDefaultShapeMat] = useState<THREE.MeshStandardMaterial | null>(null);

  // Initialize state and get reference to the defaultShapeMaterial
//   useEffect(() => {
//     if (!engine) return;
    
//     // Get access to the defaultShapeMaterial using the utility function
//     const material = findDefaultShapeMaterial(engine.getScene());
//     if (material) {
//       setDefaultShapeMat(material);
//     }
//   }, [engine]);

  // Handle material selection
  const handleMaterialChange = (index: number) => {
    // if (!engine || !defaultShapeMat) return;
    
    // Use the utility function to apply the material config
    applyMaterialConfig(index);
    setActiveMaterialIndex(index);
  };

  return (
    <div className='group relative'>
      <Button
        variant={'outline'}
        size="icon"
        aria-label="material settings"
        className='relative'
      >
        <IconPalette className="h-4 w-4" />
      </Button>
      <div className="hidden group-hover:block absolute top-8 pt-5 left-1/2 -translate-x-1/2 z-10">
        <div className="panel-shape p-4 space-y-4 w-48">
          <h3 className="text-sm font-medium">Materials</h3>
          
          <ScrollArea className="h-72">
            <div className="grid grid-cols-2 gap-2">
              {defaultMaterials.map((material, index) => (
                <div 
                  key={index}
                  className={`relative cursor-pointer rounded-md overflow-hidden hover:ring-2 hover:ring-primary transition-all 
                    ${activeMaterialIndex === index ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => handleMaterialChange(index)}
                >
                  <img 
                    src={material.colorMap} 
                    alt={`Material ${index + 1}`}
                    className="w-full h-16 object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-xs p-1 truncate">
                    {material.name}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

export default MaterialPanel;

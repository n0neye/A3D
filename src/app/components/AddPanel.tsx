import { v4 as uuidv4 } from 'uuid';
import React, { useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { useEditorContext } from '../context/EditorContext';
import { AiObjectType, createEntity, EntityType, ShapeType } from '../util/extensions/entityNode';
import { ImageSize } from '../util/generation-util';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreateEntityCommand } from '../lib/commands';
import {
  IconCube,
  IconSphere,
  IconCylinder,
  IconPyramid,
  IconPlus,
  IconSquareRotated,
  IconOvalVertical,
  IconSquare,
  IconBulb,
} from '@tabler/icons-react';
import { createPointLightEntity } from '../util/editor/light-util';


const AddPanel: React.FC = () => {
  const { scene, setSelectedEntity, historyManager } = useEditorContext();
  const [imageSize, setImageSize] = useState<ImageSize>('medium');
  const [showShapesMenu, setShowShapesMenu] = useState(false);

  // Create an entity with command pattern
  const handleCreateEntity = (entityType: EntityType, aiObjectType: AiObjectType) => {
    if (!scene) return;

    console.log(`Creating ${entityType} entity`);

    const position = new BABYLON.Vector3(0, 0, 0);
    
    // Create a command with factory function
    const createCommand = new CreateEntityCommand(
      () => createEntity(scene, entityType, {
        aiObjectType,
        position,
        imageSize
      }),
      scene
    );
    
    // Execute the command through history manager
    historyManager.executeCommand(createCommand);
    
    // Select the newly created entity
    setSelectedEntity(createCommand.getEntity());
  };

  // Create a primitive shape
  const handleCreateShape = (shapeType: ShapeType) => {
    if (!scene) return;

    console.log(`Creating ${shapeType} primitive`);

    // Create a command with factory function
    const createCommand = new CreateEntityCommand(
      () => createEntity(scene, 'aiObject', {
        aiObjectType: 'shape',
        shapeType: shapeType,
        position: new BABYLON.Vector3(0, 0, 0),
        name: `${shapeType}-${uuidv4().substring(0, 8)}`
      }),
      scene
    );
    
    // Execute the command through history manager
    historyManager.executeCommand(createCommand);
    
    // Select the newly created entity
    setSelectedEntity(createCommand.getEntity());

    // Hide the shapes menu after creation
    setShowShapesMenu(false);
  };

  // Handle light entity creation
  const handleCreateLight = () => {
    if (!scene) return;

    console.log('Creating point light entity');

    // Create a command with factory function
    const createCommand = new CreateEntityCommand(
      () => createPointLightEntity(scene, {
        position: new BABYLON.Vector3(0, 2, 0),
        name: `light-${uuidv4().substring(0, 8)}`,
        color: new BABYLON.Color3(1, 0.8, 0.4) // Warm light color by default
      }),
      scene
    );
    
    // Execute the command through history manager
    historyManager.executeCommand(createCommand);
    
    // Select the newly created entity
    setSelectedEntity(createCommand.getEntity());
  };

  // List of primitive shapes with icons
  const primitiveShapes: { type: ShapeType, label: string, icon: React.ReactNode }[] = [
    { type: 'cube', label: 'Cube', icon: <IconCube size={20} /> },
    { type: 'sphere', label: 'Sphere', icon: <IconSphere size={20} /> },
    { type: 'cylinder', label: 'Cylinder', icon: <IconCylinder size={20} /> },
    { type: 'cone', label: 'Cone', icon: <IconPyramid size={20} /> },
    { type: 'plane', label: 'Plane', icon: <IconSquare size={20} /> },
    { type: 'floor', label: 'Floor', icon: <IconSquareRotated size={20} /> },
  ];

  return (
    <div className="fixed z-50 left-4 top-1/2 -translate-y-1/2 panel-shape">
      {/* <h3 className="text-lg font-medium mb-3 text-white">Add</h3> */}

      {/* Entity type buttons */}
      <div className="grid gap-2">
        <Button
          onClick={() => handleCreateEntity('aiObject', 'generativeObject')}
          variant="default"
          className="h-14 w-14 rounded-md"
        >
          <div className="flex flex-col items-center justify-center">
            <IconPlus size={20} className="mb-1" />
            <span className="text-xs">Generate</span>
          </div>
        </Button>

        <div
          className="relative"
          onMouseEnter={() => setShowShapesMenu(true)}
          onMouseLeave={() => setShowShapesMenu(false)}
        >
          <Button
            variant="secondary"
            className="h-14 w-14 rounded-md"
          >
            <div className="flex flex-col items-center justify-center">
              <IconCube size={20} className="mb-1" />
              <span className="text-xs">Shapes</span>
            </div>
          </Button>

          {/* Shapes dropdown menu */}
          {showShapesMenu && (
            <div className="absolute left-14 top-0 pl-2">
              <Card className="p-2 w-44 grid grid-cols-2 gap-2 panel-shape">
                {primitiveShapes.map((shape) => (
                  <Button
                    key={shape.type}
                    variant="ghost"
                    size="sm"
                    className="flex items-center justify-start gap-2 h-10"
                    onClick={() => handleCreateShape(shape.type)}
                  >
                    {shape.icon}
                    <span className="text-xs">{shape.label}</span>
                  </Button>
                ))}
              </Card></div>
          )}
        </div>

        
        <Button
          onClick={handleCreateLight}
          variant="secondary"
          className="h-14 w-14 rounded-md"
        >
          <div className="flex flex-col items-center justify-center">
            <IconBulb size={20} className="mb-1" />
            <span className="text-xs">Light</span>
          </div>
        </Button>

      </div>
    </div>
  );
};

export default AddPanel; 
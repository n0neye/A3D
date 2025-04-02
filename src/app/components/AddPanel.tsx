import React, { useState } from 'react';
import { useEditorContext } from '../context/EditorContext';
import { EntityType, } from '../util/entity/EntityBase';
import { ShapeType } from '../util/entity/ShapeEntity';
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
  IconSquare,
  IconBulb,
} from '@tabler/icons-react';
import { EntityFactory } from '../util/entity/EntityFactory';


const AddPanel: React.FC = () => {
  const { scene, setSelectedEntity, historyManager } = useEditorContext();
  const [showShapesMenu, setShowShapesMenu] = useState(false);

  // Create an entity with command pattern
  const handleCreateGenerativeEntity = (entityType: EntityType) => {
    if (!scene) return;

    console.log(`Creating Generative entity`);
    const createCommand = new CreateEntityCommand(
      () => EntityFactory.createEntityDefault(scene, entityType),
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
      () => EntityFactory.createEntity(scene, { type: 'shape', shapeProps: { shapeType: shapeType } }),
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

    // Create a command with factory function
    const createCommand = new CreateEntityCommand(
      () => EntityFactory.createEntityDefault(scene, 'light'),
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
          onClick={() => handleCreateGenerativeEntity('generative')}
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
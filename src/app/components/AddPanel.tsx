import React, { useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { useEditorContext } from '../context/EditorContext';
import { AiObjectType, createEntity, EntityType } from '../util/extensions/entityNode';
import { ImageSize } from '../util/generation-util';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  IconCube,
  IconSphere,
  IconCylinder,
  IconPyramid,
  IconPlus,
  IconSquareRotated,
  IconOvalVertical
} from '@tabler/icons-react';

type PrimitiveShape = 'cube' | 'sphere' | 'cylinder' | 'cone' | 'plane' | 'torus';

const AddPanel: React.FC = () => {
  const { scene, setSelectedEntity } = useEditorContext();
  const [imageSize, setImageSize] = useState<ImageSize>('medium');
  const [showShapesMenu, setShowShapesMenu] = useState(false);

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
    // const distance = 3;
    // const direction = camera.getTarget().subtract(camera.position).normalize();
    // const position = camera.position.add(direction.scale(distance));

    const position = new BABYLON.Vector3(0, 0, 0);
    const rotation = new BABYLON.Vector3(0, 0, 0);

    // Create entity with the selected ratio and size
    const entity = createEntity(scene, entityType, {
      aiObjectType,
      position,
      imageSize
    });

    // Select the entity
    setSelectedEntity(entity);
  };

  // Create a primitive shape
  const handleCreateShape = (shapeType: PrimitiveShape) => {
    if (!scene) return;

    console.log(`Creating ${shapeType} primitive`);

    // Create entity with shape type
    const entity = createEntity(scene, 'aiObject', {
      aiObjectType: 'shape',
      shapeType: shapeType,
      position: new BABYLON.Vector3(0, 0, 0)
    });

    // Select the entity
    setSelectedEntity(entity);

    // Hide the shapes menu after creation
    setShowShapesMenu(false);
  };

  // List of primitive shapes with icons
  const primitiveShapes = [
    { type: 'cube', label: 'Cube', icon: <IconCube size={20} /> },
    { type: 'sphere', label: 'Sphere', icon: <IconSphere size={20} /> },
    { type: 'cylinder', label: 'Cylinder', icon: <IconCylinder size={20} /> },
    { type: 'cone', label: 'Cone', icon: <IconPyramid size={20} /> },
    { type: 'plane', label: 'Plane', icon: <IconSquareRotated size={20} /> },
    { type: 'torus', label: 'Torus', icon: <IconOvalVertical size={20} /> },
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
            <div className="absolute left-14 bottom-0 pl-2">
              <Card className="p-2 w-44 grid grid-cols-2 gap-2 panel-shape">
                {primitiveShapes.map((shape) => (
                  <Button
                    key={shape.type}
                    variant="ghost"
                    size="sm"
                    className="flex items-center justify-start gap-2 h-10"
                    onClick={() => handleCreateShape(shape.type as PrimitiveShape)}
                  >
                    {shape.icon}
                    <span className="text-xs">{shape.label}</span>
                  </Button>
                ))}
              </Card></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddPanel; 
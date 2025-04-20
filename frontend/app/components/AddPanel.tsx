import React, { useState } from 'react';
import { EntityType, EntityBase } from '@/engine/entity/base/EntityBase';
import { ShapeType } from '@/engine/entity/types/ShapeEntity';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreateEntityCommand } from '../lib/commands';
import { v4 as uuidv4 } from 'uuid';
import {
  IconCube,
  IconSphere,
  IconCylinder,
  IconPyramid,
  IconPlus,
  IconSquareRotated,
  IconSquare,
  IconBulb,
  IconUser,
} from '@tabler/icons-react';
import { trackEvent, ANALYTICS_EVENTS } from '@/engine/utils/external/analytics';
import { EditorEngine } from '@/engine/core/EditorEngine';
import * as THREE from 'three';

const AddPanel: React.FC = () => {
  const [showShapesMenu, setShowShapesMenu] = useState(false);
  const [showCharactersMenu, setShowCharactersMenu] = useState(false);

  // Create an entity with command pattern
  const handleCreateGenerativeEntity = (entityType: EntityType) => {
    EditorEngine.getInstance().createEntityDefaultCommand(entityType);

    // Track analytics
    trackEvent(ANALYTICS_EVENTS.CREATE_ENTITY, {
      method: 'button',
      entityType: entityType
    });

  };

  // Create a primitive shape
  const handleCreateShape = (shapeType: ShapeType) => {
    console.log(`Creating ${shapeType} primitive`);
    EditorEngine.getInstance().createEntityCommand({
      type: 'shape',
      shapeProps: {
        shapeType: shapeType
      },
    })

    // Track analytics
    trackEvent(ANALYTICS_EVENTS.CREATE_ENTITY, {
      method: 'button',
      entityType: 'shape',
      shapeType: shapeType
    });
    // Hide the shapes menu after creation
    setShowShapesMenu(false);
  };

  // Handle light entity creation
  const handleCreateLight = () => {
    EditorEngine.getInstance().createEntityDefaultCommand('light');
    // Track analytics
    trackEvent(ANALYTICS_EVENTS.CREATE_ENTITY, {
      method: 'button',
      entityType: 'light'
    });
  };

  // Handle character entity creation
  const handleCreateCharacter = (modelUrl: string, modelName: string, modelScale: number) => {
    EditorEngine.getInstance().createEntityCommand({
      type: 'character',
      characterProps: {
        url: modelUrl,
        name: modelName,
      },
      scaling: new THREE.Vector3(modelScale, modelScale, modelScale),
    })

    // Track analytics
    trackEvent(ANALYTICS_EVENTS.CREATE_ENTITY, {
      method: 'button',
      entityType: 'character',
      characterModel: modelName
    });

    // Hide the characters menu after creation
    setShowCharactersMenu(false);
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

  // List of available character models
  const characterModels = [
    { url: './characters/mannequin_man_idle/mannequin_man_idle_opt.glb', name: 'Mannequin', thumbnail: './characters/thumbs/mannequin.webp', scale: 1 },
    { url: './characters/xbot/xbot_idle_opt.glb', name: 'Xbot', thumbnail: './characters/thumbs/xbot.webp', scale: 1 },
    { url: './characters/cat/cat_orange.glb', name: 'Cat', thumbnail: './characters/thumbs/cat.webp', scale: 0.02 },
    // { url: '/characters/cat/cat_-_walking_scale.glb', name: 'Cat', thumbnail: '/characters/thumbs/cat.png', scale: 1 },
  ];

  return (
    <div className="fixed z-50 left-4 top-1/2 -translate-y-1/2 panel-shape p-1">
      {/* Entity type buttons */}
      <div className="grid gap-2">
        <Button
          onClick={() => handleCreateGenerativeEntity('generative')}
          variant="outline"
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
            variant="ghost"
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
              </Card>
            </div>
          )}
        </div>

        <Button
          onClick={handleCreateLight}
          variant="ghost"
          className="h-14 w-14 rounded-md"
        >
          <div className="flex flex-col items-center justify-center">
            <IconBulb size={20} className="mb-1" />
            <span className="text-xs">Light</span>
          </div>
        </Button>

        {/* New Character button */}
        <div
          className="relative"
          onMouseEnter={() => setShowCharactersMenu(true)}
          onMouseLeave={() => setShowCharactersMenu(false)}
        >
          <Button
            variant="ghost"
            className="h-14 w-14 rounded-md"
          >
            <div className="flex flex-col items-center justify-center">
              <IconUser size={20} className="mb-1" />
              <span className="text-xs">Character</span>
            </div>
          </Button>

          {/* Characters dropdown menu */}
          {showCharactersMenu && (
            <div className="absolute left-14 -top-1 pl-2">
              <Card className="p-2 panel-shape flex flex-row gap-2">
                {characterModels.map((model) => (
                  <Button
                    key={model.url}
                    variant="ghost"
                    size="sm"
                    className="flex items-center justify-start gap-2 h-10 w-24 mb-1"
                    onClick={() => handleCreateCharacter(model.url, model.name, model.scale)}
                  >
                    {/* <IconUser size={16} />
                    <span className="text-xs truncate">{model.name}</span> */}
                    <img src={model.thumbnail} alt={model.name} className="w-20 h-20 rounded-md" />
                  </Button>
                ))}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddPanel; 
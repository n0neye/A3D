import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  IconArrowsMove, // Position
  IconRotate, // Rotation
  IconArrowsMaximize, // Scale
  IconCube3dSphere, // Bounding Box
  IconWorld, // World space
  IconAxisY // Local space
} from '@tabler/icons-react';
import { useEditorEngine } from '../context/EditorEngineContext';
import { TransformMode } from '../engine/managers/TransformControlManager';

const GizmoModeSelector: React.FC = () => {
  const { gizmoMode, gizmoAllowedModes, gizmoSpace, engine } = useEditorEngine();

  const toggleTransformSpace = () => {
    if (engine) {
      engine.getTransformControlManager().toggleTransformControlSpace();
    }
  };

  return (
    <>
      <TooltipProvider>


        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTransformSpace}
              aria-label="transform space toggle"
            >
              {gizmoSpace === 'world' ? (
                <IconWorld className="h-4 w-4" />
              ) : (
                <IconCube3dSphere className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{gizmoSpace === 'world' ? 'World Space (Q)' : 'Local Space (Q)'}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={gizmoMode === TransformMode.Position ? 'default' : 'outline'}
              disabled={!gizmoAllowedModes.includes(TransformMode.Position)}
              size="icon"
              onClick={() => engine.setTransformControlMode(TransformMode.Position)}
              aria-label="position gizmo"
            >
              <IconArrowsMove className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Move (W)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={gizmoMode === TransformMode.Rotation ? 'default' : 'outline'}
              disabled={!gizmoAllowedModes.includes(TransformMode.Rotation)}
              size="icon"
              onClick={() => engine.setTransformControlMode(TransformMode.Rotation)}
              aria-label="rotation gizmo"
            >
              <IconRotate className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Rotate (E)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={gizmoMode === TransformMode.Scale ? 'default' : 'outline'}
              disabled={!gizmoAllowedModes.includes(TransformMode.Scale)}
              size="icon"
              onClick={() => engine.setTransformControlMode(TransformMode.Scale)}
              aria-label="scale gizmo"
            >
              <IconArrowsMaximize className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Scale (R)</p>
          </TooltipContent>
        </Tooltip>

        {/* <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={currentGizmoMode === 'boundingBox' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setGizmoMode('boundingBox')}
              aria-label="bounding box gizmo"
            >
              <IconSquare className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Bounding Box (T)</p>
          </TooltipContent>
        </Tooltip> */}
      </TooltipProvider>
    </>
  );
};

export default GizmoModeSelector; 
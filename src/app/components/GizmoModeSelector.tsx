import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  IconArrowsMove, // Position
  IconRotate, // Rotation
  IconArrowsMaximize, // Scale
  IconSquare // Bounding Box
} from '@tabler/icons-react';
import { useEditorEngine } from '../context/EditorEngineContext';
import { GizmoMode } from '../engine/managers/TransformControlManager';

const GizmoModeSelector: React.FC = () => {
  const { gizmoMode, gizmoAllowedModes, engine } = useEditorEngine();

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={gizmoMode === GizmoMode.Position ? 'default' : 'outline'}
              disabled={!gizmoAllowedModes.includes(GizmoMode.Position)}
              size="icon"
              onClick={() => engine.setGizmoMode(GizmoMode.Position)}
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
              variant={gizmoMode === GizmoMode.Scale ? 'default' : 'outline'}
              disabled={!gizmoAllowedModes.includes(GizmoMode.Scale)}
              size="icon"
              onClick={() => engine.setGizmoMode(GizmoMode.Scale)}
              aria-label="scale gizmo"
            >
              <IconArrowsMaximize className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Scale (E)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={gizmoMode === GizmoMode.Rotation ? 'default' : 'outline'}
              disabled={!gizmoAllowedModes.includes(GizmoMode.Rotation)}
              size="icon"
              onClick={() => engine.setGizmoMode(GizmoMode.Rotation)}
              aria-label="rotation gizmo"
            >
              <IconRotate className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Rotate (R)</p>
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
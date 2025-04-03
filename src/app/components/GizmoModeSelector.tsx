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

const GizmoModeSelector: React.FC = () => {
  const { gizmoMode, engine } = useEditorEngine();

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={gizmoMode === 'position' ? 'default' : 'outline'}
              size="icon"
              onClick={() => engine.setGizmoMode('position')}
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
              variant={gizmoMode === 'scale' ? 'default' : 'outline'}
              size="icon"
              onClick={() => engine.setGizmoMode('scale')}
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
              variant={gizmoMode === 'rotation' ? 'default' : 'outline'}
              size="icon"
              onClick={() => engine.setGizmoMode('rotation')}
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
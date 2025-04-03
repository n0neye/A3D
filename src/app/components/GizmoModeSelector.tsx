import React from 'react';
import { useOldEditorContext } from '../context/OldEditorContext';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  IconArrowsMove, // Position
  IconRotate, // Rotation
  IconArrowsMaximize, // Scale
  IconSquare // Bounding Box
} from '@tabler/icons-react';

const GizmoModeSelector: React.FC = () => {
  const { currentGizmoMode, setGizmoMode } = useOldEditorContext();

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={currentGizmoMode === 'position' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setGizmoMode('position')}
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
              variant={currentGizmoMode === 'scale' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setGizmoMode('scale')}
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
              variant={currentGizmoMode === 'rotation' ? 'default' : 'outline'}
              size="icon"
              onClick={() => setGizmoMode('rotation')}
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
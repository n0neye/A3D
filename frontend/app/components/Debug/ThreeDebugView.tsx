import React, { useState, useEffect, useRef } from 'react';
import { useEditorEngine } from '@/context/EditorEngineContext';
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight, RefreshCw, Box, Activity } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import * as THREE from 'three';
import { EntityBase } from '@/engine/entity/base/EntityBase';
import { IconEyeOff } from '@tabler/icons-react';
import { IconEye } from '@tabler/icons-react';
import { ThreeObjectDetails } from './ThreeObjectDetail';

interface ThreeObjectNodeProps {
  object: THREE.Object3D;
  level: number;
  selectedObject: THREE.Object3D | null;
  onSelectObject: (object: THREE.Object3D) => void;
}

const ThreeObjectNode: React.FC<ThreeObjectNodeProps> = ({
  object,
  level,
  selectedObject,
  onSelectObject
}) => {
  const [expanded, setExpanded] = useState(false);
  const isSelected = selectedObject?.uuid === object.uuid;
  const hasChildren = object.children.length > 0;

  // Determine if this is an entity
  const isEntity = object instanceof EntityBase;

  return (
    <div className="select-none">
      <div
        className={`flex items-center py-1 px-1 ${isSelected ? 'bg-primary/20 rounded' : 'hover:bg-gray-100 dark:hover:bg-gray-800 rounded'}`}
        style={{ paddingLeft: `${level * 12}px` }}
        onClick={() => onSelectObject(object)}
      >
        <div className="flex items-center mr-1" onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}>
          {hasChildren ? (
            expanded ?
              <ChevronDown className="h-4 w-4" /> :
              <ChevronRight className="h-4 w-4" />
          ) : (
            <div className="w-4"></div>
          )}
        </div>
        <Box className="h-4 w-4 mr-2" />
        <span className={`text-sm truncate  ${isEntity ? 'font-medium' : ''}`}>
          {object.name || `<${object.type}>`}
          <span className="text-xs text-gray-400 ml-1">
            {isEntity ? `[Entity: ${(object as EntityBase).entityType}]` : `[${object.type}]`}
          </span>
        </span>
        {/* Toggle visibility */}
        {object instanceof THREE.Object3D && <button className='p-1'
          onClick={() => {
            object.visible = !object.visible;
          }}>
          {object.visible ? <IconEye size={16} /> : <IconEyeOff size={16} />}
        </button>}
      </div>

      {expanded && hasChildren && (
        <div>
          {object.children.map((child) => (
            <ThreeObjectNode
              key={child.uuid}
              object={child}
              level={level + 1}
              selectedObject={selectedObject}
              onSelectObject={onSelectObject}
            />
          ))}
        </div>
      )}
    </div>
  );
};





const ThreeJsDebugView: React.FC = () => {
  const { engine } = useEditorEngine();
  const [sceneRoot, setSceneRoot] = useState<THREE.Scene | null>(null);
  const [selectedObject, setSelectedObject] = useState<THREE.Object3D | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [liveMonitoring, setLiveMonitoring] = useState(false);

  // Initial load of scene
  useEffect(() => {
    if (engine) {
      setSceneRoot(engine.getScene());
    }
  }, [engine]);

  const handleRefresh = () => {
    if (!engine) return;

    setIsRefreshing(true);
    setSceneRoot(engine.getScene());

    // Visual feedback
    setTimeout(() => {
      setIsRefreshing(false);
    }, 300);
  };

  const handleSelectObject = (object: THREE.Object3D) => {
    setSelectedObject(object);
    engine.getTransformControlManager().attachToNode(object);
    console.log(`ThreeJsDebugView SelectNode: ${object.name}`, object);
  };

  if (!sceneRoot) {
    return <div>Loading scene...</div>;
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">Scene Graph</div>
        <div className="flex items-center">
          <div className="flex items-center mr-2">
            <label htmlFor="live-monitoring" className="text-xs flex items-center mr-1">
              Live
            </label>
            <Switch
              id="live-monitoring"
              checked={liveMonitoring}
              onCheckedChange={setLiveMonitoring}
              className="mr-2"
            />
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  className="h-7 w-7"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="text-xs">Refresh scene graph</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="flex flex-col h-[calc(100%-2rem)]">
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            <ThreeObjectNode
              object={sceneRoot}
              level={0}
              selectedObject={selectedObject}
              onSelectObject={handleSelectObject}
            />
          </ScrollArea>
        </div>

        <div className="mt-4 pt-2 border-t border-gray-200 dark:border-gray-800">
          <ThreeObjectDetails
            object={selectedObject}
            liveMonitoring={liveMonitoring}
          />
        </div>
      </div>
    </div>
  );
};

export default ThreeJsDebugView; 
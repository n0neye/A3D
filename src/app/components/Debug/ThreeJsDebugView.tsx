import React, { useState, useEffect } from 'react';
import { useEditorEngine } from '@/app/context/EditorEngineContext';
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight, RefreshCw, Box } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import * as THREE from 'three';
import { EntityBase } from '@/app/engine/entity/base/EntityBase';

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
        <span className={`text-sm truncate ${isEntity ? 'font-medium' : ''}`}>
          {object.name || `<${object.type}>`}
          <span className="text-xs text-gray-400 ml-1">
            {isEntity ? `[Entity: ${(object as EntityBase).entityType}]` : `[${object.type}]`}
          </span>
        </span>
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

const ThreeObjectDetails: React.FC<{ object: THREE.Object3D | null }> = ({ object }) => {
  if (!object) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-sm">Object Details</CardTitle>
          <CardDescription>No object selected</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Format object properties
  const position = {
    x: object.position.x.toFixed(2),
    y: object.position.y.toFixed(2),
    z: object.position.z.toFixed(2),
  };

  const rotation = {
    x: (object.rotation.x * (180/Math.PI)).toFixed(1),
    y: (object.rotation.y * (180/Math.PI)).toFixed(1),
    z: (object.rotation.z * (180/Math.PI)).toFixed(1),
  };

  const scale = {
    x: object.scale.x.toFixed(2),
    y: object.scale.y.toFixed(2),
    z: object.scale.z.toFixed(2),
  };

  // Get mesh-specific properties if available
  let meshDetails = null;
  if (object instanceof THREE.Mesh) {
    const geometry = object.geometry;
    const material = object.material;
    
    const geometryInfo = {
      type: geometry.type,
      vertices: geometry.attributes?.position ? geometry.attributes.position.count : 'N/A',
      index: geometry.index ? geometry.index.count / 3 : 'N/A',
    };
    
    let materialInfo;
    if (Array.isArray(material)) {
      materialInfo = `Multiple (${material.length})`;
    } else {
      materialInfo = {
        type: material.type,
        color: material.color ? '#' + material.color.getHexString() : 'N/A',
        transparent: material.transparent ? 'Yes' : 'No',
      };
    }
    
    meshDetails = (
      <>
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-800">
          <div className="font-medium mb-1">Geometry</div>
          <div><span className="opacity-70">Type:</span> {geometryInfo.type}</div>
          <div><span className="opacity-70">Vertices:</span> {geometryInfo.vertices}</div>
          <div><span className="opacity-70">Triangles:</span> {geometryInfo.index}</div>
        </div>
        
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-800">
          <div className="font-medium mb-1">Material</div>
          {typeof materialInfo === 'string' ? (
            <div>{materialInfo}</div>
          ) : (
            <>
              <div><span className="opacity-70">Type:</span> {materialInfo.type}</div>
              <div><span className="opacity-70">Color:</span> {materialInfo.color}</div>
              <div><span className="opacity-70">Transparent:</span> {materialInfo.transparent}</div>
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Object Details</CardTitle>
        <CardDescription>{object.name || `<${object.type}>`}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <div>
          <span className="font-medium">Type:</span> {object.type}
        </div>
        <div>
          <span className="font-medium">UUID:</span> 
          <span className="text-xs break-all opacity-70">{object.uuid}</span>
        </div>
        <div>
          <span className="font-medium">Visible:</span> {object.visible ? 'Yes' : 'No'}
        </div>
        <div>
          <span className="font-medium">Position:</span> 
          x: {position.x}, y: {position.y}, z: {position.z}
        </div>
        <div>
          <span className="font-medium">Rotation:</span> 
          x: {rotation.x}°, y: {rotation.y}°, z: {rotation.z}°
        </div>
        <div>
          <span className="font-medium">Scale:</span> 
          x: {scale.x}, y: {scale.y}, z: {scale.z}
        </div>
        <div>
          <span className="font-medium">Children:</span> {object.children.length}
        </div>
        
        {meshDetails}
      </CardContent>
    </Card>
  );
};

const ThreeJsDebugView: React.FC = () => {
  const { engine } = useEditorEngine();
  const [sceneRoot, setSceneRoot] = useState<THREE.Scene | null>(null);
  const [selectedObject, setSelectedObject] = useState<THREE.Object3D | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
  };

  if (!sceneRoot) {
    return <div>Loading scene...</div>;
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">Three.js Scene Graph</div>
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
          <ThreeObjectDetails object={selectedObject} />
        </div>
      </div>
    </div>
  );
};

export default ThreeJsDebugView; 
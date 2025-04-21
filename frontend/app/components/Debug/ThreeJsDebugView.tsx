import React, { useState, useEffect, useRef } from 'react';
import { useEditorEngine } from '@/context/EditorEngineContext';
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, ChevronRight, RefreshCw, Box, Activity } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import * as THREE from 'three';
import { EntityBase } from '@/engine/entity/base/EntityBase';
import { IconEyeOff } from '@tabler/icons-react';
import { IconEye } from '@tabler/icons-react';

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

// Types for tracking property changes
interface PropertyState {
  value: string;
  isChanging: boolean;
}

interface ObjectProperties {
  position: {
    x: PropertyState;
    y: PropertyState;
    z: PropertyState;
  };
  rotation: {
    x: PropertyState;
    y: PropertyState;
    z: PropertyState;
  };
  scale: {
    x: PropertyState;
    y: PropertyState;
    z: PropertyState;
  };
  visible: PropertyState;
}

const ThreeObjectDetails: React.FC<{
  object: THREE.Object3D | null;
  liveMonitoring: boolean;
}> = ({ object, liveMonitoring }) => {
  const [properties, setProperties] = useState<ObjectProperties | null>(null);
  const prevPropsRef = useRef<{
    position?: THREE.Vector3;
    rotation?: THREE.Euler;
    scale?: THREE.Vector3;
    visible?: boolean;
  }>({});
  const frameCountRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize or update properties when object changes
  useEffect(() => {
    if (!object) {
      setProperties(null);
      return;
    }

    const initialProps = createInitialProperties(object);
    setProperties(initialProps);
    prevPropsRef.current = {
      position: object.position.clone(),
      rotation: object.rotation.clone(),
      scale: object.scale.clone(),
      visible: object.visible
    };

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [object]);

  // Handle live monitoring with animation frame
  useEffect(() => {
    if (!object || !liveMonitoring) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const updatePropertiesLoop = () => {
      // Only update every 5 frames for performance (about 12 updates per second at 60fps)
      frameCountRef.current = (frameCountRef.current + 1) % 5;
      if (frameCountRef.current === 0 && object) {
        updateProperties(object);
      }

      animationFrameRef.current = requestAnimationFrame(updatePropertiesLoop);
    };

    updatePropertiesLoop();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [object, liveMonitoring]);

  // Create initial properties object
  const createInitialProperties = (obj: THREE.Object3D): ObjectProperties => {
    return {
      position: {
        x: { value: Number(obj.position.x).toFixed(2), isChanging: false },
        y: { value: Number(obj.position.y).toFixed(2), isChanging: false },
        z: { value: Number(obj.position.z).toFixed(2), isChanging: false }
      },
      rotation: {
        x: { value: (Number(obj.rotation.x) * (180 / Math.PI)).toFixed(1), isChanging: false },
        y: { value: (Number(obj.rotation.y) * (180 / Math.PI)).toFixed(1), isChanging: false },
        z: { value: (Number(obj.rotation.z) * (180 / Math.PI)).toFixed(1), isChanging: false }
      },
      scale: {
        x: { value: Number(obj.scale.x).toFixed(2), isChanging: false },
        y: { value: Number(obj.scale.y).toFixed(2), isChanging: false },
        z: { value: Number(obj.scale.z).toFixed(2), isChanging: false }
      },
      visible: { value: obj.visible ? 'Yes' : 'No', isChanging: false }
    };
  };

  // Update properties and detect changes
  const updateProperties = (obj: THREE.Object3D) => {
    if (!properties) return;

    const prev = prevPropsRef.current;
    const newProperties = { ...properties };

    // Check for position changes
    ['x', 'y', 'z'].forEach((axis) => {
      const propValue = Number(obj.position[axis as keyof THREE.Vector3]);
      const value = propValue.toFixed(2);
      newProperties.position[axis as keyof typeof newProperties.position].value = value;
      newProperties.position[axis as keyof typeof newProperties.position].isChanging =
        prev.position![axis as keyof THREE.Vector3] !== obj.position[axis as keyof THREE.Vector3];
    });

    // Check for rotation changes (convert to degrees)
    ['x', 'y', 'z'].forEach((axis) => {
      const propValue = Number(obj.rotation[axis as keyof THREE.Euler]);
      const value = (propValue * (180 / Math.PI)).toFixed(1);
      newProperties.rotation[axis as keyof typeof newProperties.rotation].value = value;
      newProperties.rotation[axis as keyof typeof newProperties.rotation].isChanging =
        prev.rotation![axis as keyof THREE.Euler] !== obj.rotation[axis as keyof THREE.Euler];
    });

    // Check for scale changes
    ['x', 'y', 'z'].forEach((axis) => {
      const propValue = Number(obj.scale[axis as keyof THREE.Vector3]);
      const value = propValue.toFixed(2);
      newProperties.scale[axis as keyof typeof newProperties.scale].value = value;
      newProperties.scale[axis as keyof typeof newProperties.scale].isChanging =
        prev.scale![axis as keyof THREE.Vector3] !== obj.scale[axis as keyof THREE.Vector3];
    });

    // Check visibility change
    newProperties.visible.value = obj.visible ? 'Yes' : 'No';
    newProperties.visible.isChanging = prev.visible !== obj.visible;

    // Update prev values reference
    prevPropsRef.current = {
      position: obj.position.clone(),
      rotation: obj.rotation.clone(),
      scale: obj.scale.clone(),
      visible: obj.visible
    };

    setProperties(newProperties);
  };

  if (!object || !properties) {
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
    x: (object.rotation.x * (180 / Math.PI)).toFixed(1),
    y: (object.rotation.y * (180 / Math.PI)).toFixed(1),
    z: (object.rotation.z * (180 / Math.PI)).toFixed(1),
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

  // Helper function to render property with highlighting if changing
  const renderProperty = (prop: PropertyState, label?: string) => {
    return (
      <span className={prop.isChanging ? 'bg-yellow-100 dark:bg-yellow-900/20 px-1 rounded transition-colors' : ''}>
        {prop.value}{label}
      </span>
    );
  };

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
          <span className="font-medium">Visible:</span> {renderProperty(properties.visible)}
        </div>
        <div>
          <span className="font-medium">Position:</span>
          x: {renderProperty(properties.position.x)},
          y: {renderProperty(properties.position.y)},
          z: {renderProperty(properties.position.z)}
        </div>
        <div>
          <span className="font-medium">Rotation:</span>
          x: {renderProperty(properties.rotation.x, '°')},
          y: {renderProperty(properties.rotation.y, '°')},
          z: {renderProperty(properties.rotation.z, '°')}
        </div>
        <div>
          <span className="font-medium">Scale:</span>
          x: {renderProperty(properties.scale.x)},
          y: {renderProperty(properties.scale.y)},
          z: {renderProperty(properties.scale.z)}
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
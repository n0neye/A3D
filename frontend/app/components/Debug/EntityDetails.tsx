import React, { useState, useEffect } from 'react';
import { useEditorEngine } from '@/context/EditorEngineContext';
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EntityBase } from '@/engine/entity/base/EntityBase';

const EntityDetails: React.FC = () => {
  const { selectedEntity: initialSelectedEntity } = useEditorEngine();
  const [entityDetails, setEntityDetails] = useState<EntityBase | null>(initialSelectedEntity);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Update local state when selected entity changes
  useEffect(() => {
    setEntityDetails(initialSelectedEntity);
  }, [initialSelectedEntity]);

  const refreshEntityDetails = () => {
    if (!initialSelectedEntity) return;
    
    setIsRefreshing(true);
    
    // Get fresh entity data from object manager
    const engine = initialSelectedEntity.engine;
    const refreshedEntity = engine.getObjectManager().getEntityByUUID(initialSelectedEntity.uuid);
    
    setEntityDetails(refreshedEntity || null);
    
    // Visual feedback for refresh action
    setTimeout(() => {
      setIsRefreshing(false);
    }, 300);
  };

  if (!entityDetails) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-sm">Entity Details</CardTitle>
          <CardDescription>No entity selected</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Format entity position and rotation values
  const position = {
    x: entityDetails.position.x.toFixed(2),
    y: entityDetails.position.y.toFixed(2),
    z: entityDetails.position.z.toFixed(2),
  };

  const rotation = {
    x: (entityDetails.rotation.x * (180/Math.PI)).toFixed(1),
    y: (entityDetails.rotation.y * (180/Math.PI)).toFixed(1),
    z: (entityDetails.rotation.z * (180/Math.PI)).toFixed(1),
  };

  const scale = {
    x: entityDetails.scale.x.toFixed(2),
    y: entityDetails.scale.y.toFixed(2),
    z: entityDetails.scale.z.toFixed(2),
  };

  const created = entityDetails.created ? entityDetails.created.toLocaleString() : 'Unknown';
  const entityStatus = entityDetails.isDeleted ? 'Deleted' : entityDetails.visible ? 'Visible' : 'Hidden';

  return (
    <Card className="w-full">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm">Entity Details</CardTitle>
          <CardDescription>{entityDetails.name}</CardDescription>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={refreshEntityDetails}
                className="h-6 w-6"
              >
                <RefreshCw 
                  className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} 
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p className="text-xs">Refresh entity details</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <div>
          <span className="font-medium">Type:</span> {entityDetails.entityType}
        </div>
        <div>
          <span className="font-medium">Status:</span> {entityStatus}
        </div>
        <div>
          <span className="font-medium">UUID:</span> 
          <span className="text-xs break-all opacity-70">{entityDetails.uuid}</span>
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
          <span className="font-medium">Created:</span> {created}
        </div>
      </CardContent>
    </Card>
  );
};

export default EntityDetails; 
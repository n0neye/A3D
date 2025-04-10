import React from 'react';
import { useEditorEngine } from '@/app/context/EditorEngineContext';
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

const EntityDetails: React.FC = () => {
  const { selectedEntity } = useEditorEngine();

  if (!selectedEntity) {
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
    x: selectedEntity.position.x.toFixed(2),
    y: selectedEntity.position.y.toFixed(2),
    z: selectedEntity.position.z.toFixed(2),
  };

  const rotation = {
    x: (selectedEntity.rotation.x * (180/Math.PI)).toFixed(1),
    y: (selectedEntity.rotation.y * (180/Math.PI)).toFixed(1),
    z: (selectedEntity.rotation.z * (180/Math.PI)).toFixed(1),
  };

  const scale = {
    x: selectedEntity.scale.x.toFixed(2),
    y: selectedEntity.scale.y.toFixed(2),
    z: selectedEntity.scale.z.toFixed(2),
  };

  const created = selectedEntity.created ? selectedEntity.created.toLocaleString() : 'Unknown';

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Entity Details</CardTitle>
        <CardDescription>{selectedEntity.name}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <div>
          <span className="font-medium">Type:</span> {selectedEntity.entityType}
        </div>
        <div>
          <span className="font-medium">UUID:</span> 
          <span className="text-xs break-all opacity-70">{selectedEntity.uuid}</span>
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
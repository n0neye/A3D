import React, { useEffect, useState } from 'react';
import * as BABYLON from '@babylonjs/core';

interface FloatingObjectPanelProps {
  scene: BABYLON.Scene | null;
  gizmoManager: BABYLON.GizmoManager | null;
}

const FloatingObjectPanel: React.FC<FloatingObjectPanelProps> = ({ scene, gizmoManager }) => {
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [visible, setVisible] = useState(false);
  const [selectedMesh, setSelectedMesh] = useState<BABYLON.AbstractMesh | null>(null);
  const [objectType, setObjectType] = useState<string>('default');
  
  useEffect(() => {
    if (!scene || !gizmoManager) return;
    
    // Function to update panel position based on mesh position
    const updatePosition = () => {
      const mesh = gizmoManager.gizmos.positionGizmo?.attachedMesh;
      
      if (mesh) {
        // Update selected mesh when it changes
        if (mesh !== selectedMesh) {
          setSelectedMesh(mesh);
          setObjectType(mesh.metadata?.type || 'default');
          setVisible(true);
        }
        
        // Get the position in screen space
        const camera = scene.activeCamera;
        if (camera) {
          // Get the mesh's bounding info
          mesh.computeWorldMatrix(true);
          const boundingInfo = mesh.getBoundingInfo();
          const boundingBox = boundingInfo.boundingBox;
          
          // Project center position to screen coordinates
          const centerPosition = BABYLON.Vector3.Project(
            mesh.position,
            BABYLON.Matrix.Identity(),
            scene.getTransformMatrix(),
            camera.viewport.toGlobal(
              scene.getEngine().getRenderWidth(),
              scene.getEngine().getRenderHeight()
            )
          );
          
          // Project bottom position to screen coordinates
          const bottomCenter = new BABYLON.Vector3(
            mesh.position.x,
            boundingBox.minimumWorld.y,
            mesh.position.z
          );
          
          const bottomPosition = BABYLON.Vector3.Project(
            bottomCenter,
            BABYLON.Matrix.Identity(),
            scene.getTransformMatrix(),
            camera.viewport.toGlobal(
              scene.getEngine().getRenderWidth(),
              scene.getEngine().getRenderHeight()
            )
          );
          
          // Calculate object height in screen space
          const objectHeight = Math.abs(centerPosition.y - bottomPosition.y) * 2;
          
          // Position the panel below the object with a margin
          const margin = 20;
          setPosition({
            left: centerPosition.x,
            top: centerPosition.y + (objectHeight / 2) + margin
          });
        }
      } else {
        // No mesh selected
        if (selectedMesh !== null) {
          setSelectedMesh(null);
          setVisible(false);
        }
      }
    };
    
    // Update on each render
    const observer = scene.onBeforeRenderObservable.add(updatePosition);
    
    return () => {
      scene.onBeforeRenderObservable.remove(observer);
    };
  }, [scene, gizmoManager, selectedMesh]);
  
  if (!visible) return null;
  
  // UI changes based on object type
  const renderContent = () => {
    switch (objectType) {
      case 'generation':
        return (
          <>
            <h3 className="text-sm font-medium mb-1">Generation Canvas</h3>
            <div className="space-y-2">
              <input 
                type="text" 
                placeholder="Enter prompt..."
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded"
              />
              <button className="w-full py-1 text-xs bg-green-600 hover:bg-green-700 rounded text-white">
                Generate
              </button>
            </div>
          </>
        );
        
      default:
        return (
          <>
            <h3 className="text-sm font-medium mb-1">Object Settings</h3>
            <div className="grid grid-cols-2 gap-1">
              <button className="py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded text-white">
                Duplicate
              </button>
              <button className="py-1 text-xs bg-red-600 hover:bg-red-700 rounded text-white">
                Delete
              </button>
            </div>
          </>
        );
    }
  };
  
  return (
    <div 
      className="absolute z-10 bg-black bg-opacity-80 rounded shadow-lg p-2 border border-gray-600 text-white"
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
        transform: 'translateX(-50%)', // Center horizontally
        minWidth: '150px',
      }}
    >
      {renderContent()}
    </div>
  );
};

export default FloatingObjectPanel; 
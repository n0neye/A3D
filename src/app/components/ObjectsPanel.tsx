import React, { useEffect, useState } from 'react';
import * as BABYLON from '@babylonjs/core';

interface ObjectsPanelProps {
  scene: BABYLON.Scene | null;
  gizmoManager: BABYLON.GizmoManager | null;
}

interface SceneObjectDisplay {
  id: string;
  name: string;
  type: string;
  mesh: BABYLON.Mesh;
}

const ObjectsPanel: React.FC<ObjectsPanelProps> = ({ scene, gizmoManager }) => {
  const [objects, setObjects] = useState<SceneObjectDisplay[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  // Update objects list when scene changes or periodically
  useEffect(() => {
    if (!scene) return;

    // Initial load of objects
    updateObjectsList();

    // Setup observer for when meshes are added or removed
    const observer = scene.onNewMeshAddedObservable.add(() => {
      updateObjectsList();
    });

    return () => {
      scene.onNewMeshAddedObservable.remove(observer);
    };
  }, [scene]);

  useEffect(() => {
    if (!scene || !gizmoManager) return;
    
    let currentAttachedMesh: BABYLON.AbstractMesh | null = null;
    
    // Function to update selected object based on gizmo attachment
    const updateSelectedFromScene = () => {
      const attachedMesh = gizmoManager.gizmos.positionGizmo?.attachedMesh;
      
      // Only update if the attached mesh has changed
      if (attachedMesh !== currentAttachedMesh) {
        currentAttachedMesh = attachedMesh;
        
        if (attachedMesh) {
          // Find the object in our list that matches this mesh
          const selectedObj = objects.find(obj => obj.mesh === attachedMesh);
          if (selectedObj) {
            setSelectedObjectId(selectedObj.id);
          }
        } else {
          // Nothing selected
          setSelectedObjectId(null);
        }
      }
    };
    
    // Check less frequently to improve performance
    const observer = scene.onBeforeRenderObservable.add(() => {
      // Only check every few frames
      if (scene.getFrameId() % 10 === 0) {
        updateSelectedFromScene();
      }
    });
    
    // Initial check
    updateSelectedFromScene();
    
    return () => {
      scene.onBeforeRenderObservable.remove(observer);
    };
  }, [scene, gizmoManager, objects]);

  const updateObjectsList = () => {
    if (!scene) return;

    const meshes = scene.meshes.filter(mesh => 
      // Exclude any utility meshes or internal BabylonJS objects
      !mesh.name.startsWith("__") && 
      mesh.name !== "BackgroundSkybox" &&
      !(mesh instanceof BABYLON.InstancedMesh) &&
      !(mesh.name.includes("gizmo"))
    );

    const objectsList = meshes.map(mesh => ({
      id: mesh.uniqueId.toString(),
      name: mesh.name,
      type: getObjectType(mesh),
      mesh: mesh as BABYLON.Mesh
    }));

    setObjects(objectsList);
  };

  const getObjectType = (mesh: BABYLON.AbstractMesh): string => {
    // Try to determine the mesh type based on properties or naming
    if (mesh.name.includes("box")) return "Box";
    if (mesh.name.includes("sphere")) return "Sphere";
    if (mesh.name.includes("cylinder")) {
      if (mesh.name.includes("cone")) return "Cone";
      return "Cylinder";
    }
    if (mesh.name.includes("plane")) return "Plane";
    if (mesh.name.includes("torus")) return "Torus";
    
    // Default fallback
    return "Mesh";
  };

  const handleSelectObject = (objectId: string) => {
    if (!gizmoManager || !scene) return;

    setSelectedObjectId(objectId);
    
    // Find the mesh and attach gizmo to it
    const selectedObject = objects.find(obj => obj.id === objectId);
    if (selectedObject) {
      gizmoManager.attachToMesh(selectedObject.mesh);
    }
  };

  const handleDeleteObject = (objectId: string) => {
    if (!scene) return;

    const objToDelete = objects.find(obj => obj.id === objectId);
    if (objToDelete) {
      // Remove mesh from scene
      objToDelete.mesh.dispose();
      
      // Update the list
      updateObjectsList();
      
      // If this was selected, detach gizmo
      if (selectedObjectId === objectId && gizmoManager) {
        gizmoManager.attachToMesh(null);
        setSelectedObjectId(null);
      }
    }
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 shadow-lg mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-medium text-white">Objects</h3>
        <button 
          onClick={updateObjectsList}
          className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded"
        >
          Refresh
        </button>
      </div>
      
      {objects.length === 0 ? (
        <div className="text-gray-400 italic text-sm">No objects in scene</div>
      ) : (
        <div className="max-h-[200px] overflow-y-auto pr-1">
          {objects.map(obj => (
            <div 
              key={obj.id}
              className={`flex justify-between items-center p-2 rounded mb-1 cursor-pointer ${
                selectedObjectId === obj.id ? 'bg-blue-900 bg-opacity-50' : 'hover:bg-gray-700'
              }`}
              onClick={() => handleSelectObject(obj.id)}
            >
              <div className="flex items-center">
                <span className="w-5 h-5 flex items-center justify-center mr-2 text-xs">
                  {getObjectIcon(obj.type)}
                </span>
                <span className="text-sm truncate">{obj.name}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteObject(obj.id);
                }}
                className="text-red-400 hover:text-red-300 text-xs px-1"
                title="Delete object"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Simple function to return icons based on type
function getObjectIcon(type: string): React.ReactNode {
  switch (type.toLowerCase()) {
    case 'box':
      return '□';
    case 'sphere':
      return '○';
    case 'cylinder':
      return '⊙';
    case 'cone':
      return '▲';
    case 'plane':
      return '▭';
    case 'torus':
      return '⊗';
    default:
      return '◇';
  }
}

export default ObjectsPanel; 
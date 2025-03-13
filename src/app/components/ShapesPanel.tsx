import React from 'react';
import * as BABYLON from '@babylonjs/core';

interface ShapesPanelProps {
  scene: BABYLON.Scene | null;
  gizmoManager: BABYLON.GizmoManager | null;
}

const ShapesPanel: React.FC<ShapesPanelProps> = ({ scene, gizmoManager }) => {
  const addShape = (shapeType: string) => {
    console.log("Trying to add shape:", scene, gizmoManager);
    if (!scene || !gizmoManager) return;

    console.log("Adding shape:", shapeType);

    let mesh: BABYLON.Mesh | null = null;
    
    // Create the selected shape type
    switch (shapeType) {
      case 'box':
        mesh = BABYLON.MeshBuilder.CreateBox(`box-${Date.now()}`, { size: 1 }, scene);
        break;
      case 'sphere':
        mesh = BABYLON.MeshBuilder.CreateSphere(`sphere-${Date.now()}`, { diameter: 1 }, scene);
        break;
      case 'cylinder':
        mesh = BABYLON.MeshBuilder.CreateCylinder(`cylinder-${Date.now()}`, { height: 1, diameter: 1 }, scene);
        break;
      case 'cone':
        mesh = BABYLON.MeshBuilder.CreateCylinder(`cone-${Date.now()}`, { height: 1, diameterTop: 0, diameterBottom: 1 }, scene);
        break;
      case 'torus':
        mesh = BABYLON.MeshBuilder.CreateTorus(`torus-${Date.now()}`, { diameter: 1, thickness: 0.3 }, scene);
        break;
      case 'plane':
        mesh = BABYLON.MeshBuilder.CreatePlane(`plane-${Date.now()}`, { width: 1, height: 1 }, scene);
        break;
    }
    
    if (mesh) {
      // Randomize position slightly to avoid exact overlapping when adding multiple objects
      mesh.position.x = (Math.random() - 0.5) * 2;
      
      // Create and assign a random colored material
      const material = new BABYLON.StandardMaterial(`${shapeType}-material-${Date.now()}`, scene);
      material.diffuseColor = new BABYLON.Color3(
        Math.random() * 0.8 + 0.2,
        Math.random() * 0.8 + 0.2,
        Math.random() * 0.8 + 0.2
      );
      mesh.material = material;
      
      // Update the gizmo to attach to this new mesh
      gizmoManager.attachToMesh(mesh);
    }
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 shadow-lg mb-4">
      <h3 className="text-lg font-medium mb-3 text-white">Add Shapes</h3>
      <div className="grid grid-cols-2 gap-2">
        <button 
          onClick={() => addShape('box')}
          className="p-2 bg-gray-700 text-blue-300 rounded hover:bg-gray-600 flex flex-col items-center justify-center border border-gray-600"
        >
          <div className="w-8 h-8 border-2 border-blue-400 mb-1"></div>
          Cube
        </button>
        <button 
          onClick={() => addShape('sphere')}
          className="p-2 bg-gray-700 text-green-300 rounded hover:bg-gray-600 flex flex-col items-center justify-center border border-gray-600"
        >
          <div className="w-8 h-8 rounded-full border-2 border-green-400 mb-1"></div>
          Sphere
        </button>
        <button 
          onClick={() => addShape('cylinder')}
          className="p-2 bg-gray-700 text-purple-300 rounded hover:bg-gray-600 flex flex-col items-center justify-center border border-gray-600"
        >
          <div className="w-6 h-8 mx-auto rounded-sm border-2 border-purple-400 mb-1"></div>
          Cylinder
        </button>
        <button 
          onClick={() => addShape('cone')}
          className="p-2 bg-gray-700 text-yellow-300 rounded hover:bg-gray-600 flex flex-col items-center justify-center border border-gray-600"
        >
          <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-b-[20px] border-b-yellow-400 mb-1"></div>
          Cone
        </button>
        <button 
          onClick={() => addShape('torus')}
          className="p-2 bg-gray-700 text-red-300 rounded hover:bg-gray-600 flex flex-col items-center justify-center border border-gray-600"
        >
          <div className="w-8 h-8 rounded-full border-4 border-red-400 mb-1"></div>
          Torus
        </button>
        <button 
          onClick={() => addShape('plane')}
          className="p-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 flex flex-col items-center justify-center border border-gray-600"
        >
          <div className="w-8 h-5 bg-gray-500 mb-1"></div>
          Plane
        </button>
      </div>
    </div>
  );
};

export default ShapesPanel; 
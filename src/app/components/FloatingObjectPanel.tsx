import React, { useEffect, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
// Import the FAL AI client
import { fal } from "@fal-ai/client";

interface FloatingObjectPanelProps {
  scene: BABYLON.Scene | null;
  gizmoManager: BABYLON.GizmoManager | null;
}

const FloatingObjectPanel: React.FC<FloatingObjectPanelProps> = ({ scene, gizmoManager }) => {
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [visible, setVisible] = useState(false);
  const [selectedMesh, setSelectedMesh] = useState<BABYLON.AbstractMesh | null>(null);
  const [objectType, setObjectType] = useState<string>('default');
  
  // Add states for generation
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  
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
  
  // Handle image generation
  const handleGenerate = async () => {
    if (!selectedMesh || !prompt.trim() || !scene) return;
    
    setIsGenerating(true);
    setGenerationProgress('Starting generation...');
    
    try {
      // Call the FAL AI API
      const result = await fal.subscribe("fal-ai/fast-turbo-diffusion", {
        input: {
          prompt: prompt
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            const latestLog = update.logs[update.logs.length - 1]?.message || 'Processing...';
            setGenerationProgress(latestLog);
          }
        },
      });
      
      // When complete, apply the image to the mesh
      if (result.data.images && result.data.images.length > 0) {
        applyImageToMesh(selectedMesh as BABYLON.Mesh, result.data.images[0].url);
      }
    } catch (error) {
      console.error("Generation failed:", error);
      setGenerationProgress("Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Apply the generated image to the mesh
  const applyImageToMesh = (mesh: BABYLON.Mesh, imageUrl: string) => {
    // get the material of the mesh
    const material = mesh.material as BABYLON.StandardMaterial;
    
    // Create a texture from the image URL
    const texture = new BABYLON.Texture(imageUrl, scene);
    material.diffuseTexture = texture;
    
    // Apply the material to the mesh
    mesh.material = material;
    
    // Update mesh metadata
    mesh.metadata = {
      ...mesh.metadata,
      generatedImage: imageUrl
    };
  };
  
  // UI content based on object type
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
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isGenerating}
              />
              
              {isGenerating && (
                <div className="text-xs text-gray-400 mt-1 mb-1">
                  <div className="flex items-center mb-1">
                    <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{generationProgress}</span>
                  </div>
                </div>
              )}
              
              <button 
                className={`w-full py-1 text-xs ${isGenerating ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-700'} rounded text-white`}
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
              >
                {isGenerating ? 'Generating...' : 'Generate'}
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
  
  if (!visible) return null;
  
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
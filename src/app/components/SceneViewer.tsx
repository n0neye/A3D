'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { GizmoManager } from '@babylonjs/core/Gizmos/gizmoManager';
import { RenderEngine } from '../lib/renderEngine';
import ShapesPanel from './ShapesPanel';
import ObjectsPanel from './ObjectsPanel';

// Mock AIService implementation for testing
class MockAIService {
  async generateImage(prompt: string, settings: any) {
    console.log("Generating image with prompt:", prompt);
    console.log("Settings:", settings);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      url: "https://via.placeholder.com/512x512.png?text=AI+Generated",
      width: 512,
      height: 512,
      generatedAt: new Date()
    };
  }
}

export default function SceneViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const renderEngineRef = useRef<RenderEngine | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);
  const gizmoManagerRef = useRef<BABYLON.GizmoManager | null>(null);
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sceneState, setSceneState] = useState<BABYLON.Scene | null>(null);
  const [gizmoManagerState, setGizmoManagerState] = useState<BABYLON.GizmoManager | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize BabylonJS engine and scene
    const engine = new BABYLON.Engine(canvasRef.current, true);
    engineRef.current = engine;
    
    const createScene = () => {
      const scene = new BABYLON.Scene(engine);
      
      // Camera
      const camera = new BABYLON.ArcRotateCamera(
        "camera", 
        -Math.PI / 2, 
        Math.PI / 2.5, 
        3, 
        new BABYLON.Vector3(0, 0, 0), 
        scene
      );
      camera.attachControl(canvasRef.current, true);
      
      // Light
      const light = new BABYLON.HemisphericLight(
        "light", 
        new BABYLON.Vector3(0, 1, 0), 
        scene
      );
      light.intensity = 0.7;
      
      // Create a box
      const box = BABYLON.MeshBuilder.CreateBox("box", { size: 1 }, scene);
      const boxMaterial = new BABYLON.StandardMaterial("boxMaterial", scene);
      boxMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.6, 0.9);
      box.material = boxMaterial;
      
      // Add gizmo manager for transformations
      const gizmoManager = new BABYLON.GizmoManager(scene);
      gizmoManager.positionGizmoEnabled = true;
      gizmoManager.rotationGizmoEnabled = true;
      gizmoManager.scaleGizmoEnabled = true;
      gizmoManager.attachableMeshes = [];
      gizmoManager.usePointerToAttachGizmos = true;
      gizmoManager.attachToMesh(box);
      
      // Store gizmo manager in ref
      gizmoManagerRef.current = gizmoManager;
      
      // Add mesh selection via pointer click
      scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERPICK) {
          const pickedMesh = pointerInfo.pickInfo?.pickedMesh;
          
          // If we clicked on a mesh that's not a gizmo or utility object
          if (pickedMesh && 
              !pickedMesh.name.includes("gizmo") && 
              !pickedMesh.name.startsWith("__")) {
            gizmoManager.attachToMesh(pickedMesh as BABYLON.Mesh);
          }
        }
      }, BABYLON.PointerEventTypes.POINTERPICK);
      
      return scene;
    };
    
    const scene = createScene();
    sceneRef.current = scene;
    
    // Set state variables so React will re-render with them
    setSceneState(scene);
    setGizmoManagerState(gizmoManagerRef.current);
    
    // Initialize the RenderEngine with our scene and mock AI service
    const mockAIService = new MockAIService();
    const renderEngine = new RenderEngine(scene, mockAIService as any);
    renderEngineRef.current = renderEngine;
    
    // Start the render loop
    engine.runRenderLoop(() => {
      scene.render();
    });
    
    // Handle window resize
    const handleResize = () => {
      engine.resize();
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      scene.dispose();
      engine.dispose();
    };
  }, []);
  
  const handleTakePreview = () => {
    if (!renderEngineRef.current) return;
    
    const img = renderEngineRef.current.generatePreview();
    if (img) {
      previewImageRef.current = img;
      // Force a re-render to display the image
      setPreviewUrl(img.src);
    }
  };

  return (
    <div className="flex flex-col w-full h-screen bg-gray-900 text-gray-200">
      <div className="flex h-full">
        {/* Left panel for shapes and controls */}
        <div className="w-64 bg-gray-800 p-4 overflow-y-auto border-r border-gray-700">
          <h2 className="text-xl font-bold mb-6 text-white">3D Editor</h2>
          
          <ShapesPanel scene={sceneState} gizmoManager={gizmoManagerState} />
          
          <ObjectsPanel scene={sceneState} gizmoManager={gizmoManagerState} />
          
          <div className="p-4 bg-gray-800 rounded-lg border border-gray-700 shadow-lg mt-4">
            <h3 className="text-lg font-medium mb-3 text-white">Render Controls</h3>
            <div className="flex flex-col gap-2">
              <button 
                onClick={handleTakePreview}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Generate Preview
              </button>
              
              <button 
                onClick={() => {
                  if (!renderEngineRef.current || !sceneRef.current) return;
                  
                  // Create a simple scene data representation
                  const sceneData = {
                    objects: [{
                      id: "box1",
                      type: "box",
                      position: { x: 0, y: 0, z: 0 },
                      rotation: { x: 0, y: 0, z: 0 },
                      scale: { x: 1, y: 1, z: 1 },
                      material: {
                        type: "standard",
                        color: { r: 0.4, g: 0.6, b: 0.9 }
                      }
                    }],
                    lighting: {
                      lights: [{
                        type: "hemispheric" as "hemispheric",
                        intensity: 0.7,
                        position: { x: 0, y: 1, z: 0 },
                        color: { r: 1, g: 1, b: 1 }
                      }]
                    },
                    camera: {
                      position: { x: 0, y: 0, z: -3 },
                      target: { x: 0, y: 0, z: 0 },
                      fov: 0.8
                    }
                  };
                  
                  renderEngineRef.current.queueHighQualityRender(
                    sceneData,
                    { width: 512, height: 512, quality: 'high' }
                  );
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Render with AI
              </button>
            </div>
          </div>
        </div>
        
        {/* Main 3D canvas - make it fill the remaining space */}
        <div className="flex-1 relative">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>
      </div>
      
      {/* Preview section as a modal/overlay when active */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-10 p-8">
          <div className="bg-gray-800 p-6 rounded-lg shadow-2xl max-w-3xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-medium text-white">Preview Image</h3>
              <button 
                onClick={() => setPreviewUrl(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <img 
              src={previewUrl} 
              alt="Scene Preview" 
              className="max-w-full border border-gray-600 rounded-md"
            />
          </div>
        </div>
      )}
    </div>
  );
} 
'use client';

import React, { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import { GizmoManager } from '@babylonjs/core/Gizmos/gizmoManager';
import { RenderEngine } from '../lib/renderEngine';

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
      gizmoManager.attachableMeshes = [box];
      gizmoManager.usePointerToAttachGizmos = false;
      gizmoManager.attachToMesh(box);
      
      return scene;
    };
    
    const scene = createScene();
    sceneRef.current = scene;
    
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
  
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative w-full h-[500px] border border-gray-400 rounded-lg overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
      
      <div className="mt-4 flex gap-4">
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
      
      {previewUrl && (
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-2">Preview Image</h3>
          <img 
            src={previewUrl} 
            alt="Scene Preview" 
            className="max-w-full border border-gray-300 rounded-md"
          />
        </div>
      )}
    </div>
  );
} 
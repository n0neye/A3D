'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { GizmoManager } from '@babylonjs/core/Gizmos/gizmoManager';
import { RenderEngine } from '../lib/renderEngine';
import ShapesPanel from './ShapesPanel';
import ObjectsPanel from './ObjectsPanel';
import { HistoryManager, Command } from './HistoryManager';
import { TransformCommand, CreateMeshCommand, DeleteMeshCommand } from '../lib/commands';

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
  const historyManagerRef = useRef<HistoryManager>(new HistoryManager());
  const activeTranformCommandRef = useRef<TransformCommand | null>(null);
  const lastAttachedMeshRef = useRef<BABYLON.AbstractMesh | null>(null);
  
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
      
      // Add these observers for transform events
      scene.onBeforeRenderObservable.add(() => {
        // Get the attached mesh, which could be undefined or null
        const attachedMesh = gizmoManager.gizmos.positionGizmo?.attachedMesh;
        
        // Only proceed if we have a mesh and it's different from the last one
        if (attachedMesh && attachedMesh !== lastAttachedMeshRef.current) {
          // Type assertion to tell TypeScript this is a Mesh
          const mesh = attachedMesh as BABYLON.Mesh;
          lastAttachedMeshRef.current = mesh;
          startTransform(mesh);
        }
      });

      gizmoManager.gizmos.positionGizmo?.onDragEndObservable.add(() => {
        endTransform();
      });

      gizmoManager.gizmos.rotationGizmo?.onDragEndObservable.add(() => {
        endTransform();
      });

      gizmoManager.gizmos.scaleGizmo?.onDragEndObservable.add(() => {
        endTransform();
      });
      
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
  
  useEffect(() => {
    if (!sceneState) return;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for key combinations
      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        // Ctrl+Z (or Cmd+Z on Mac) = Undo
        event.preventDefault();
        if (event.shiftKey) {
          // Ctrl+Shift+Z = Redo
          historyManagerRef.current.redo();
        } else {
          // Ctrl+Z = Undo
          historyManagerRef.current.undo();
        }
      } else if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
        // Ctrl+Y = Redo
        event.preventDefault();
        historyManagerRef.current.redo();
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        // Delete/Backspace = Delete selected object
        const activeMesh = gizmoManagerState?.gizmos.positionGizmo?.attachedMesh as BABYLON.Mesh;
        if (activeMesh && sceneState) {
          deleteObject(activeMesh);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sceneState, gizmoManagerState]);
  
  const handleTakePreview = () => {
    if (!renderEngineRef.current) return;
    
    const img = renderEngineRef.current.generatePreview();
    if (img) {
      previewImageRef.current = img;
      // Force a re-render to display the image
      setPreviewUrl(img.src);
    }
  };

  // Function to handle object transform start
  const startTransform = (mesh: BABYLON.Mesh) => {
    // Create a new transform command
    const command = new TransformCommand(mesh);
    activeTranformCommandRef.current = command;
  };
  
  // Function to handle object transform end
  const endTransform = () => {
    if (activeTranformCommandRef.current) {
      // Update the final state and add to history
      activeTranformCommandRef.current.updateFinalState();
      historyManagerRef.current.executeCommand(activeTranformCommandRef.current);
      activeTranformCommandRef.current = null;
    }
  };
  
  // Function to add a new object with history
  const addObject = (createFn: () => BABYLON.Mesh) => {
    if (!sceneState) return null;
    
    // Create a command for this action
    const command = new CreateMeshCommand(createFn, sceneState);
    
    // Execute the command and add to history
    historyManagerRef.current.executeCommand(command);
    
    // Return the created mesh
    return command.getMesh();
  };
  
  // Function to delete an object with history
  const deleteObject = (mesh: BABYLON.Mesh) => {
    // Create a command for this action
    const command = new DeleteMeshCommand(mesh, gizmoManagerRef.current);
    
    // Execute the command and add to history
    historyManagerRef.current.executeCommand(command);
    
    // Force update the objects list
    if (sceneState) {
      // Trigger a custom event that ObjectsPanel can listen for
      sceneState.onNewMeshAddedObservable.notifyObservers(null);
    }
  };

  return (
    <div className="flex flex-col w-full h-screen bg-gray-900 text-gray-200">
      <div className="flex h-full">
        {/* Left panel for shapes and controls */}
        <div className="w-64 bg-gray-800 p-4 overflow-y-auto border-r border-gray-700">
          <h2 className="text-xl font-bold mb-6 text-white">3D Editor</h2>
          
          <ShapesPanel 
            scene={sceneState} 
            gizmoManager={gizmoManagerState} 
            onCreateObject={addObject}
          />
          
          <ObjectsPanel 
            scene={sceneState} 
            gizmoManager={gizmoManagerState} 
            onDeleteObject={deleteObject}
          />
          
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

      {/* Add a status bar at the bottom of your UI to show available shortcuts */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-2 text-xs text-gray-400 flex justify-between">
        <div>
          <span className="mr-4">⌘Z / Ctrl+Z: Undo</span>
          <span className="mr-4">⌘⇧Z / Ctrl+Y: Redo</span>
          <span>Delete: Remove selected object</span>
        </div>
        <div>
          Press G to toggle gizmo modes
        </div>
      </div>
    </div>
  );
} 
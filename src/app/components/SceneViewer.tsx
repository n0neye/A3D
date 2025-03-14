'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import { RenderEngine } from '../lib/renderEngine';
import ShapesPanel from './ShapesPanel';
import ObjectsPanel from './ObjectsPanel';
import { HistoryManager, Command } from './HistoryManager';
import { TransformCommand, CreateMeshCommand, DeleteMeshCommand } from '../lib/commands';
import PreviewPanel from './PreviewPanel';
import CharacterPanel from './CharacterPanel';

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
  const gizmoManagerRef = useRef<BABYLON.GizmoManager | null>(null);
  const historyManagerRef = useRef<HistoryManager>(new HistoryManager());
  const activeTranformCommandRef = useRef<TransformCommand | null>(null);
  const lastAttachedMeshRef = useRef<BABYLON.AbstractMesh | null>(null);
  
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
        new BABYLON.Vector3(0, 1, 0), 
        scene
      );

      // Reduce zoom sensitivity - higher number = slower zoom
      camera.wheelPrecision = 40; // Default is around 0.3

      // Optional: Also adjust other camera control properties for better UX
      camera.panningSensibility = 1000; // Make panning less sensitive
      camera.angularSensibilityX = 500; // Make rotation less sensitive
      camera.angularSensibilityY = 500;

      // Set zoom limits to prevent zooming too far in or out
      camera.lowerRadiusLimit = 1; // Can't zoom closer than this
      camera.upperRadiusLimit = 20; // Can't zoom farther than this

      camera.attachControl(canvasRef.current, true);
      
      // Light
      const light = new BABYLON.HemisphericLight(
        "light", 
        new BABYLON.Vector3(0, 1, 0), 
        scene
      );
      light.intensity = 0.7;
      

      // Add gizmo manager for transformations
      const gizmoManager = new BABYLON.GizmoManager(scene);
      gizmoManager.positionGizmoEnabled = true;
      gizmoManager.rotationGizmoEnabled = true;
      gizmoManager.scaleGizmoEnabled = true;
      gizmoManager.attachableMeshes = [];
      gizmoManager.usePointerToAttachGizmos = true;

      
      // Create a box
      // const box = BABYLON.MeshBuilder.CreateBox("box", { size: 1 }, scene);
      // const boxMaterial = new BABYLON.StandardMaterial("boxMaterial", scene);
      // boxMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.6, 0.9);
      // box.material = boxMaterial;
      // gizmoManager.attachToMesh(box);
      
      // Store gizmo manager in ref
      gizmoManagerRef.current = gizmoManager;
      
      // Add mesh selection via pointer click
      scene.onPointerObservable.add((pointerInfo) => {
        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERPICK) {
          const pickedMesh = pointerInfo.pickInfo?.pickedMesh;
          
          console.log("SceneViewer: Picked mesh:", pickedMesh?.name);
          
          // If we clicked on a mesh that's not a gizmo or utility object or IK target
          if (pickedMesh && 
              !pickedMesh.name.includes("gizmo") && 
              !pickedMesh.name.startsWith("__") &&
              !pickedMesh.name.includes("ik-target")) {
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
      // TODO: This is a hack to force the objects list to update
      sceneState.onNewMeshAddedObservable.notifyObservers(null as any);
    }
  };

  return (
    <div className="flex flex-col w-full h-screen bg-gray-900 text-gray-200">
      <div className="flex h-full">
        {/* Left panel for shapes and controls */}
        <div className="w-64 bg-black bg-opacity-80 p-4 overflow-y-auto border-r border-gray-700">
          <h2 className="text-xl font-bold mb-6 text-white">3D Editor</h2>
          
          <ShapesPanel 
            scene={sceneState} 
            gizmoManager={gizmoManagerState} 
            onCreateObject={addObject}
          />
          
          <CharacterPanel
            scene={sceneState}
            onCreateCharacter={addObject}
          />
          
          <ObjectsPanel 
            scene={sceneState} 
            gizmoManager={gizmoManagerState} 
            onDeleteObject={deleteObject}
          />
        </div>
        
        {/* Main 3D canvas - make it fill the main area */}
        <div className="flex-1 relative">
          <canvas ref={canvasRef} className="w-full h-full" />
        </div>
        
        {/* Right panel for preview */}
        <div className="w-80 bg-black bg-opacity-80 p-4 overflow-y-auto border-l border-gray-700">
          <h2 className="text-xl font-bold mb-6 text-white">Preview</h2>
          
          <PreviewPanel
            renderEngine={renderEngineRef.current}
          />
        </div>
      </div>

      {/* Status bar at the bottom */}
      <div className="bg-gray-800 border-t border-gray-700 p-2 text-xs text-gray-400 flex justify-between">
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
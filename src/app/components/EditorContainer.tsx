'use client';

import React, { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import GenerationMenu from './GenerationMenu';
import EntityPanel from './EntityPanel';
import { useEditorContext } from '../context/EditorContext';
import { resolveEntity } from '../util/editor/entityUtil';
import { initializeImageGeneration } from '../util/generation-2d-realtime';
import RenderPanel from './RenderPanel';
import DebugLayer from './DebugLayer';

export default function EditorContainer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { 
    setScene, 
    setEngine, 
    setGizmoManager, 
    setSelectedEntity,
    selectedEntity,
    getCurrentSelectedEntity,
    gizmoManager,
    isDebugMode,
    scene
  } = useEditorContext();
  const [showInspector, setShowInspector] = React.useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize BabylonJS engine and scene
    const engine = new BABYLON.Engine(canvasRef.current, true);
    const scene = new BABYLON.Scene(engine);
    
    // Update context
    setEngine(engine);
    setScene(scene);

    // Camera
    const camera = new BABYLON.ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      Math.PI / 2.5,
      3,
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    camera.wheelPrecision = 40;
    camera.panningSensibility = 1000;
    camera.angularSensibilityX = 500;
    camera.angularSensibilityY = 500;
    camera.lowerRadiusLimit = 1;
    camera.upperRadiusLimit = 20;
    camera.attachControl(canvasRef.current, true);

    // Light
    const light = new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    light.intensity = 0.7;

    // Set up gizmo manager
    const gizmoManager = new BABYLON.GizmoManager(scene);
    gizmoManager.positionGizmoEnabled = false;
    gizmoManager.rotationGizmoEnabled = false;
    gizmoManager.scaleGizmoEnabled = false;
    gizmoManager.usePointerToAttachGizmos = false;
    setGizmoManager(gizmoManager);

    // Handle selection
    scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
        if (pointerInfo.event.button === 0) {  // Left click
          const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
          const mesh = pickInfo.pickedMesh;
          
          if (mesh && 
              !mesh.name.includes("gizmo") && 
              !mesh.name.startsWith("__")) {
            // Find entity from mesh
            const entity = resolveEntity(mesh);
            console.log("Selected entity:", entity?.name);
            setSelectedEntity(entity);
          } else {
            // Clear selection when clicking on background
            setSelectedEntity(null);
          }
        }
      }
    });

    // Handle keyboard shortcuts
    const handleKeyDown = (event: KeyboardEvent) => {
      
      // Delete selected entity - using getCurrentSelectedEntity to get the latest value
      if (event.key === 'Delete') {
        const currentEntity = getCurrentSelectedEntity();
        if (!currentEntity) return;
        
        console.log("Deleting selected entity:", currentEntity.name);
        
        // First detach any gizmos
        if (gizmoManager) {
          gizmoManager.attachToMesh(null);
        }
        
        // Get all child meshes to properly dispose them
        const meshesToDispose = currentEntity.getChildMeshes();
        
        // Dispose each mesh properly
        meshesToDispose.forEach(mesh => {
          if (mesh.material) {
            mesh.material.dispose(true, true);
          }
          mesh.dispose(false, true);
        });
        
        // Dispose the entity itself
        currentEntity.dispose();
        
        // Clear the selection state
        setSelectedEntity(null);
        
        // Force scene update
        if (scene) {
          scene.render();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);

    // Start the render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // Handle window resize
    const handleResize = () => {
      engine.resize();
    };

    window.addEventListener('resize', handleResize);

    // Initialize API connection
    initializeImageGeneration();

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <div className="flex flex-col w-full h-screen bg-gray-900 text-gray-200 overflow-hidden">
      <div className="flex h-full">
        {/* Generation menu */}
        <div className={`fixed z-50 left-4 bottom-4 w-64 bg-black bg-opacity-80 p-4 overflow-y-auto rounded-2xl shadow-xl ${isDebugMode ? '' : ''}`}>
          <GenerationMenu />
        </div>

        {/* Main 3D canvas */}
        <div className="flex-1 relative">
          <canvas ref={canvasRef} className="w-full h-full" />
          <EntityPanel />
        </div>

        {/* Render Panel */}
        <div className={`fixed z-50 right-4 bottom-4 w-64 bg-black bg-opacity-80 p-4 overflow-y-auto rounded-2xl shadow-xl ${isDebugMode ? 'right-80' : ''}`}>
          <RenderPanel />
        </div>
      </div>
      <DebugLayer />
    </div>
  );
} 
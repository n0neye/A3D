'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import AddPanel from './AddPanel';
import EntityPanel from './EntityPanel';
import { useEditorContext } from '../context/EditorContext';
import { resolveEntity } from '../util/extensions/entityNode';
import { initializeRealtimeConnection } from '../util/realtime-generation-util';
import RenderPanel from './RenderPanel';
import DebugLayer from './DebugLayer';
import { initGizmo, initScene } from '../util/editor/editor-util';
import EnvironmentPanel from './EnvironmentPanel';
import GizmoModeSelector from './GizmoModeSelector';
import FileMenu from './FileMenu';
import FramePanel from './FramePanel';
import { useProjectSettings } from '../context/ProjectSettingsContext';
import GalleryPanel from './GalleryPanel';
import { DeleteMeshCommand, TransformCommand, CreateEntityCommand } from '../lib/commands';
import { v4 as uuidv4 } from 'uuid';
import { createEntity } from '../util/extensions/entityNode';

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
    scene,
    historyManager
  } = useEditorContext();
  const [showInspector, setShowInspector] = React.useState(false);

  const { ProjectSettings } = useProjectSettings();
  const [currentGalleryIndex, setCurrentGalleryIndex] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [shouldOpenGallery, setShouldOpenGallery] = useState(false);
  const prevRenderLogsLength = useRef(0);

  // Add state to track middle click start time
  const middleClickStartTimeRef = useRef<number | null>(null);
  const clickThreshold = 300; // Milliseconds to consider a "click" vs a "hold"

  // Track when new images are added to renderLogs
  useEffect(() => {
    if (ProjectSettings.renderLogs.length > prevRenderLogsLength.current && shouldOpenGallery) {
      // A new image was added and gallery should open
      setCurrentGalleryIndex(ProjectSettings.renderLogs.length - 1);
      setIsGalleryOpen(true);
      setShouldOpenGallery(false);
    }

    // Update previous length
    prevRenderLogsLength.current = ProjectSettings.renderLogs.length;
  }, [ProjectSettings.renderLogs.length]);

  // Modified function to open the gallery
  const openGallery = (shouldAutoOpen?: boolean) => {
    console.log("openGallery called", ProjectSettings.renderLogs.length);

    if (ProjectSettings.renderLogs.length === 0) return;

    // If we're opening immediately
    if (shouldAutoOpen === undefined) {
      setCurrentGalleryIndex(ProjectSettings.renderLogs.length - 1);
      setIsGalleryOpen(true);
    } else {
      // Otherwise, set flag to open when new image is added
      setShouldOpenGallery(shouldAutoOpen);
    }
  };

  const onPointerObservable = (pointerInfo: BABYLON.PointerInfo, scene: BABYLON.Scene) => {
    if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
      if (pointerInfo.event.button === 0) {  // Left click
        const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
        const mesh = pickInfo.pickedMesh;

        if (mesh) {
          // Find entity from mesh
          const entity = resolveEntity(mesh);
          setSelectedEntity(entity);
        } else {
          // Clear selection when clicking on background
          setSelectedEntity(null);
        }
      } else if (pointerInfo.event.button === 1) { // Middle button down
        // Store the time when the middle button was pressed
        middleClickStartTimeRef.current = Date.now();
      }
    } else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERUP) {
      if (pointerInfo.event.button === 1) {  // Middle click release
        // Check if we have a starting time and it was a short click
        if (middleClickStartTimeRef.current) {
          const clickDuration = Date.now() - middleClickStartTimeRef.current;
          
          // Only create if it was a short click, not a hold
          if (clickDuration < clickThreshold) {
            // Cast a ray from the camera through the mouse position
            const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
            let position: BABYLON.Vector3;

            if (pickInfo.hit) {
              // If we hit something, use that point
              position = pickInfo.pickedPoint!.clone();
            } else {
              // Create at the position where the user clicked, but at a fixed distance from camera
              const camera = scene.activeCamera as BABYLON.ArcRotateCamera;
              if (!camera) return;

              // Camera center
              const cameraCenter = camera.getTarget();
              const cameraPosition = camera.position;
              const distance = cameraPosition.subtract(cameraCenter).length();

              // Create a ray from the camera through the clicked point on the screen
              const ray = scene.createPickingRay(
                scene.pointerX,
                scene.pointerY,
                BABYLON.Matrix.Identity(),
                camera
              );

              // Use a fixed distance from camera (2 units)

              // Calculate position along the ray at the specified distance
              position = ray.origin.add(ray.direction.scale(distance));
            }

            // Create entity command
            const createCommand = new CreateEntityCommand(
              () => createEntity(scene, 'aiObject', {
                aiObjectType: 'shape',
                shapeType: 'cube', // Default to cube
                position: position,
                name: `cube-${uuidv4().substring(0, 8)}`
              }),
              scene
            );

            // Execute command and select the new entity
            historyManager.executeCommand(createCommand);
            setSelectedEntity(createCommand.getEntity());
          }
          
          // Reset the tracking state
          middleClickStartTimeRef.current = null;
        }
      }
    }
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (event: KeyboardEvent) => {
    // Don't process if a text input or textarea is focused
    const activeElement = document.activeElement;
    if (activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA')) {
      return;
    }

    // Don't process keyboard shortcuts when gallery is open
    if (isGalleryOpen) return;

    // Delete selected entity
    if (event.key === 'Delete') {
      const currentEntity = getCurrentSelectedEntity();
      if (!currentEntity) return;

      // Create and execute a delete command
      const deleteCommand = new DeleteMeshCommand(currentEntity, gizmoManager);
      historyManager.executeCommand(deleteCommand);

      // Clear the selection state
      setSelectedEntity(null);
    }

    // Handle undo (Ctrl+Z or Command+Z)
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      console.log("Undo triggered");
      historyManager.undo();
      // Force scene update
      if (scene) {
        scene.render();
      }
      event.preventDefault(); // Prevent browser's default undo
    }

    // Handle redo (Ctrl+Shift+Z or Command+Shift+Z or Ctrl+Y)
    if (((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z') ||
      ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y')) {
      console.log("Redo triggered");
      historyManager.redo();
      // Force scene update
      if (scene) {
        scene.render();
      }
      event.preventDefault(); // Prevent browser's default redo
    }
  };

  // Initialize BabylonJS engine and scene
  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize BabylonJS engine and scene
    const engine = new BABYLON.Engine(canvasRef.current, true);
    const scene = new BABYLON.Scene(engine);

    // Update context
    setEngine(engine);
    setScene(scene);
    initScene(canvasRef.current, scene);

    // Set up gizmo manager
    const gizmoManager = initGizmo(scene, historyManager);
    setGizmoManager(gizmoManager);

    // Start the render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // Handle window resize
    const handleResize = () => {
      engine.resize();
    };

    // Listeners
    scene.onPointerObservable.add((pointerInfo) => onPointerObservable(pointerInfo, scene));
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    // Initialize API connection
    initializeRealtimeConnection();

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
        <AddPanel />

        {/* Main 3D canvas */}
        <div className="flex-1 relative">
          <canvas ref={canvasRef} className="w-full h-full" />
          <EntityPanel />
        </div>

        {/* Render Panel - no longer needs onImageGenerated */}
        <RenderPanel
          isDebugMode={isDebugMode}
          onOpenGallery={openGallery}
        />

        {/* Environment Panel */}
        {/* <EnvironmentPanel /> */}
      </div>

      {/* Top Toolbar */}
      <div className='fixed top-2  w-full flex justify-center items-center'>
        <div className=" panel-shape p-1 flex gap-2">
          <FileMenu />
          <GizmoModeSelector />
        </div>
      </div>

      {/* FramePanel  */}
      {/* <FramePanel /> */}

      {/* Gallery Panel - now uses context for images */}
      <GalleryPanel
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        images={ProjectSettings.renderLogs}
        currentIndex={currentGalleryIndex}
        onSelectImage={setCurrentGalleryIndex}
      />
      {/* <DebugLayer /> */}

    </div>
  );
} 
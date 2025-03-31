'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import AddPanel from './AddPanel';
import EntityPanel from './EntityPanel';
import { useEditorContext } from '../context/EditorContext';
import { duplicateEntity, resolveEntity } from '../util/extensions/entityNode';
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
import { DeleteMeshCommand, TransformCommand, CreateEntityCommand, CreateEntityAsyncCommand } from '../lib/commands';
import { v4 as uuidv4 } from 'uuid';
import { createEntity } from '../util/extensions/entityNode';
import Guide from './Guide';

// Temp hack to handle e and r key presses
let isWKeyPressed = false;
let isEKeyPressed = false;
let isRKeyPressed = false;

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
  const [keysPressed, setKeysPressed] = useState<Record<number, boolean>>({});

  // At the component level, add a ref to track the scene
  const sceneRef = useRef<BABYLON.Scene | null>(null);

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
        // Check if Ctrl key is pressed
        if (pointerInfo.event.ctrlKey || pointerInfo.event.metaKey) { // Ctrl+Left click (or Cmd+Left click on Mac)
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

            // Calculate position along the ray at the specified distance
            position = ray.origin.add(ray.direction.scale(distance));
          }

          // Create entity command
          const createCommand = new CreateEntityCommand(
            () => createEntity(scene, 'aiObject', {
              aiObjectType: 'generativeObject',
              position: position,
              name: `gen-${uuidv4().substring(0, 8)}`
            }),
            scene
          );

          // Execute command and select the new entity
          console.log("About to execute command", createCommand);
          historyManager.executeCommand(createCommand);
          console.log("Command executed");
          const newEntity = createCommand.getEntity();
          console.log("Got entity from command", newEntity);
          setSelectedEntity(newEntity);
          if (newEntity) {
            newEntity.setEnabled(true);
          } else {
            console.error("No entity returned from createCommand");
          }
        } else {
          // Normal left click (without Ctrl) - handle selection
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
        }
      }
    }

    // Handle mouse wheel events for scaling and rotation
    else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
      const currentEntity = getCurrentSelectedEntity();
      if (!currentEntity) return;

      // @ts-ignore
      const wheelDelta = pointerInfo.event.deltaY;
      const scaleFactor = 0.001; // Adjust this for sensitivity
      const rotationFactor = 0.0025; // Adjust this for sensitivity


      if (isEKeyPressed || isRKeyPressed || isWKeyPressed) {
        // Disable camera zoom
        const camera = scene.activeCamera as BABYLON.ArcRotateCamera;
        camera.inputs.remove(camera.inputs.attached.mousewheel);

        // W+Wheel: Move the selected entity up
        if (isWKeyPressed) {
          currentEntity.position.y += wheelDelta * -0.001;
        }

        // E+Wheel: Scale the selected entity
        if (isEKeyPressed) {
          // Create scale command - record the starting state
          const scaleCommand = new TransformCommand(currentEntity);

          // Calculate scale factor based on wheel direction
          const delta = -wheelDelta * scaleFactor;
          const newScale = currentEntity.scaling.clone();

          // Apply uniform scaling
          newScale.x += newScale.x * delta;
          newScale.y += newScale.y * delta;
          newScale.z += newScale.z * delta;

          // Apply the new scale
          currentEntity.scaling = newScale;

          // Update the final state and record the command
          scaleCommand.updateFinalState();
          historyManager.executeCommand(scaleCommand);

          // Prevent default browser zoom
          pointerInfo.event.preventDefault();
        }

        // R+Wheel: Rotate the selected entity around Y axis
        else if (isRKeyPressed) {
          // Create rotation command - record the starting state
          const rotationCommand = new TransformCommand(currentEntity);

          // Calculate rotation amount based on wheel direction
          const delta = wheelDelta * rotationFactor;

          // Apply rotation around y-axis
          currentEntity.rotate(BABYLON.Vector3.Up(), delta);

          // Update the final state and record the command
          rotationCommand.updateFinalState();
          historyManager.executeCommand(rotationCommand);

          // Prevent default browser behavior
          pointerInfo.event.preventDefault();
        }

        // Enable camera zoom
        setTimeout(() => {
          camera.inputs.add(new BABYLON.ArcRotateCameraMouseWheelInput);
          camera.wheelPrecision = 40;
        }, 50);
      }
    }
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (event: KeyboardEvent) => {
    switch (event.key.toLocaleLowerCase()) {
      case 'e':
        isEKeyPressed = true;
        break;
      case 'r':
        isRKeyPressed = true;
        break;
      case 'w':
        isWKeyPressed = true;
        break;
    }

    // Don't process if a text input or textarea is focused
    const activeElement = document.activeElement;
    if (activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA')) {
      return;
    }

    // Don't process keyboard shortcuts when gallery is open
    if (isGalleryOpen) return;

    // Duplicate selected entity (Ctrl+D)
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault(); // Prevent browser's bookmark dialog
      
      const currentEntity = getCurrentSelectedEntity();
      const currentScene = sceneRef.current;

      console.log("Duplicate selected entity", currentEntity, currentScene);
      
      if (!currentEntity || !currentScene) return;
      
      // Create the duplicate entity
      const duplicateCommand = new CreateEntityAsyncCommand(
        async () => {
          console.log("Creating duplicate entity", currentEntity.getEntityType(), currentEntity.metadata?.aiData?.aiObjectType);
          const duplicate = await duplicateEntity(currentScene, currentEntity);
          duplicate.position.x += 0.2;
          return duplicate;
        },
        currentScene
      );
      
      // Execute command and select the new entity
      historyManager.executeCommand(duplicateCommand);
      const newEntity = duplicateCommand.getEntity();
      console.log("New entity", newEntity);
      if (newEntity) {
        setSelectedEntity(newEntity);
      }
    }

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

  
  const handleKeyUp = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'e':
        isEKeyPressed = false;
        break;
      case 'r':
        isRKeyPressed = false;
        break;
      case 'w':
        isWKeyPressed = false;
        break;
    }
  };

  // Initialize BabylonJS engine and scene
  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize BabylonJS engine and scene
    const engine = new BABYLON.Engine(canvasRef.current, true);
    const scene = new BABYLON.Scene(engine);
    sceneRef.current = scene; // Store reference to scene

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

    // Add event listener to prevent default browser zoom behavior when using Ctrl+Wheel
    const preventDefaultZoom = (event: WheelEvent) => {
      const isEKeyPressed = keysPressed[69]; // 'e' key code
      const isRKeyPressed = keysPressed[82]; // 'r' key code

      if (isEKeyPressed || isRKeyPressed) {
        event.preventDefault();
      }
    };
    canvasRef.current.addEventListener('wheel', preventDefaultZoom, { passive: false });


    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Cleanup
    return () => {
      scene.dispose();
      engine.dispose();
      if (canvasRef.current) {
        canvasRef.current.removeEventListener('wheel', preventDefaultZoom);
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
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
          <FramePanel />
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

      {/* Add the Guide component */}
      <Guide />
    </div>
  );
} 
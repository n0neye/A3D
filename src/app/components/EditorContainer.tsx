'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import AddPanel from './AddPanel';
import EntityPanel from './EntityPanels/EntityPanel';
import { useEditorContext } from '../context/EditorContext';
import { initializeRealtimeConnection } from '../util/generation/realtime-generation-util';
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
import { EntityFactory } from '../util/entity/EntityFactory';
import { duplicateEntity } from '../util/entity/entityUtils';
import Guide from './Guide';
import { availableAPIs } from '../util/generation/image-render-api';
import { RenderLog, SerializedProjectSettings, loadProjectFromUrl } from '../util/editor/project-util';
import { GenerativeEntityProps } from '../util/entity/GenerativeEntity';
import { EntityBase } from '../util/entity/EntityBase';
import CharacterEditPanel from './CharacterEditPanel';
import { isCharacterEntity } from '../util/entity/entityUtils';
import { registerGizmoManager, registerHistoryManager } from '../util/editor/scene-managers';
import { createSelectionManager, getSelectionManager } from '../util/editor/selection-manager';
import { ISelectable } from '../interfaces/ISelectable';
import { BoneControl } from '../util/entity/BoneControl';

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

  const { ProjectSettings, updateProjectSettings } = useProjectSettings();
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
          handleCtrlClick(pointerInfo, scene);
        } else {
          handleRegularClick(pointerInfo, scene);
        }
      }
    }
    // Handle mouse wheel events for scaling and rotation
    else if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERWHEEL) {
      handleMouseWheel(pointerInfo, scene);
    }
  }

  const handleMouseWheel = (pointerInfo: BABYLON.PointerInfo, scene: BABYLON.Scene) => {
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

  const handleRegularClick = (pointerInfo: BABYLON.PointerInfo, scene: BABYLON.Scene) => {
    console.log("handleRegularClick called");

    // Get the selection manager
    const selectionManager = getSelectionManager(scene);
    console.log("Selection manager found:", !!selectionManager);
    if (!selectionManager) return;


    const bonePickInfo = scene.pick(
      scene.pointerX,
      scene.pointerY,
      (mesh) => {
        return mesh.name.startsWith('bone_'); // Only pick meshes that start with 'bone_'
      }
    );
    if (bonePickInfo.hit && bonePickInfo.pickedMesh && bonePickInfo.pickedMesh instanceof BoneControl) {
      console.log("Bone picked:", bonePickInfo.pickedMesh.name);
      const boneControl = bonePickInfo.pickedMesh as BoneControl;
      boneControl.character.selectBone(boneControl);
      return;
    }


    const pickInfo = scene.pick(scene.pointerX, scene.pointerY);
    const mesh = pickInfo.pickedMesh;
    console.log("Picked mesh:", mesh?.name, "metadata:", mesh?.metadata);

    // Clicked on empty space - deselect
    if (!mesh) {
      console.log("No mesh picked, deselecting");
      selectionManager.select(null);
      setSelectedEntity(null);
      return;
    }

    // Find the selectable object
    let selectable: ISelectable | null = null;

    // FIRST check if the mesh has a rootEntity that's selectable
    if (mesh.metadata?.rootEntity && (mesh.metadata.rootEntity as any).gizmoCapabilities) {
      console.log("Mesh has selectable rootEntity");
      selectable = mesh.metadata.rootEntity as ISelectable;
      selectionManager.select(selectable);

      // If it's an EntityBase, update the selected entity in state
      if (mesh.metadata.rootEntity instanceof EntityBase) {
        console.log("rootEntity is EntityBase, selecting in UI");
        setSelectedEntity(mesh.metadata.rootEntity);
      } else {
        setSelectedEntity(null);
      }
    }
    // THEN check if the mesh itself is directly selectable (for BoneControl etc.)
    else if ((mesh as any).gizmoCapabilities) {
      console.log("Mesh is directly selectable");
      selectable = mesh as unknown as ISelectable;
      selectionManager.select(selectable);
      setSelectedEntity(null); // No entity selected for direct selectable meshes
    }
    // Nothing selectable found
    else {
      console.log("Nothing selectable found, deselecting");
      selectionManager.select(null);
      setSelectedEntity(null);
    }
  }

  const handleCtrlClick = (pointerInfo: BABYLON.PointerInfo, scene: BABYLON.Scene) => {
    console.log("CtrlClick", pointerInfo, scene);
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

    // Create entity command using the new EntityFactory
    const createCommand = new CreateEntityCommand(
      () => EntityFactory.createEntity(scene, {
        type: 'generative',
        position,
        gnerativeProps: {
          generationLogs: [],
        } as GenerativeEntityProps
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
          const duplicate = await duplicateEntity(currentEntity, currentScene);
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

  const loadDefaultProject = async (scene: BABYLON.Scene) => {
    try {
      const url = "/demoAssets/default_empty.json";
      await loadProjectFromUrl(url, scene, (settings: SerializedProjectSettings) => {
        // Apply all settings at once via context
        updateProjectSettings(settings);
      });
      console.log("Default project loaded successfully");
    } catch (error) {
      console.error("Failed to load default project:", error);
      // Continue without the default project if it fails to load
    }
  };

  // Initialize BabylonJS engine and scene
  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize BabylonJS engine and scene
    const engine = new BABYLON.Engine(canvasRef.current, true);
    const scene = new BABYLON.Scene(engine);
    sceneRef.current = scene; // Store reference to scene

    // Register the history manager with the scene
    registerHistoryManager(scene, historyManager);

    // Update context
    setEngine(engine);
    setScene(scene);

    const init = async (canvas: HTMLCanvasElement) => {
      await initScene(canvas, scene);
      await loadDefaultProject(scene);

      // Set up gizmo manager and register with scene
      const gizmoManager = initGizmo(scene, historyManager);
      registerGizmoManager(scene, gizmoManager);

      // Create the selection manager
      const selectionManager = createSelectionManager(scene);

      // Set gizmo manager for UI state
      setGizmoManager(gizmoManager);
    }

    init(canvasRef.current);

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

  const handleApplyRenderSettings = (renderLog: RenderLog) => {
    // Extract settings from the renderLog
    const settings = {
      prompt: renderLog.prompt,
      seed: renderLog.seed,
      promptStrength: renderLog.promptStrength,
      depthStrength: renderLog.depthStrength,
      selectedLoras: renderLog.selectedLoras || [],
      // Find the API by name
      selectedAPI: availableAPIs.find(api => api.name === renderLog.model)?.id || availableAPIs[0].id
    };

    // Update the project settings
    updateProjectSettings(settings);
  };

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
          <FramePanel />
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
        onApplySettings={handleApplyRenderSettings}
      />
      {/* <DebugLayer /> */}

      {/* Add the Guide component */}
      <Guide />

      {/* Character Edit Panel */}
      {selectedEntity && isCharacterEntity(selectedEntity) && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2">
          <CharacterEditPanel entity={selectedEntity} />
        </div>
      )}
    </div>
  );
} 
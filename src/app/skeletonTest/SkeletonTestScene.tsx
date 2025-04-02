'use client';

import React, { useEffect, useRef } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { SkeletonViewer } from '@babylonjs/core/Debug/skeletonViewer';
import { Inspector } from '@babylonjs/inspector';

export default function SkeletonTestScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);

  useEffect(() => {
    // Initialize Babylon.js
    if (!canvasRef.current) return;

    // Create engine and scene
    const engine = new BABYLON.Engine(canvasRef.current, true);
    engineRef.current = engine;
    
    const scene = new BABYLON.Scene(engine);
    sceneRef.current = scene;

    
    Inspector.Show(scene, { overlay: true, embedMode: false });

    // Setup camera
    const camera = new BABYLON.ArcRotateCamera(
      'camera',
      -Math.PI / 2,
      Math.PI / 2.5,
      3,
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    camera.attachControl(canvasRef.current, true);
    camera.wheelPrecision = 50;
    camera.lowerRadiusLimit = 1;
    camera.upperRadiusLimit = 10;

    // Add lighting
    const light = new BABYLON.HemisphericLight(
      'light',
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    light.intensity = 0.7;

    // Add directional light for better shadows
    const dirLight = new BABYLON.DirectionalLight(
      'dirLight',
      new BABYLON.Vector3(-1, -2, -1),
      scene
    );
    dirLight.intensity = 0.5;

    // Create a ground
    const ground = BABYLON.MeshBuilder.CreateGround(
      'ground',
      { width: 6, height: 6 },
      scene
    );
    const groundMaterial = new BABYLON.StandardMaterial('groundMaterial', scene);
    groundMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    ground.material = groundMaterial;
    ground.receiveShadows = true;

    // Load the mannequin character
    BABYLON.SceneLoader.ImportMesh(
      '',
      '/characters/mannequin_man_idle/',
      'mannequin_man_idle.gltf',
      scene,
      (meshes, particleSystems, skeletons) => {
        console.log('Model loaded', { meshes, skeletons });
        
        // If there are skeletons, log information about them
        if (skeletons && skeletons.length > 0) {
          const skeleton = skeletons[0];
          console.log('Bones:', skeleton.bones.length);
          console.log('Animations:', scene.animationGroups);
          
          // Create a skeleton viewer
          const skeletonViewer = new SkeletonViewer(
            skeleton,
            meshes[0],
            scene,
            false,
            0,
            {
              displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS,
            }
          );
          
          // Configure the skeleton viewer
          skeletonViewer.isEnabled = true;
          skeletonViewer.color = new BABYLON.Color3(1, 0, 0); // Red color for bones
          
          // You can adjust display mode: 0 = Spheres, 1 = Lines
          skeletonViewer.displayMode = SkeletonViewer.DISPLAY_SPHERE_AND_SPURS;
          
          // Size of the bones representation
          
          // Play animations if they exist
          if (scene.animationGroups && scene.animationGroups.length > 0) {
            scene.animationGroups[0].play(true);
          }
        }

        // Position the model
        const rootMesh = meshes[0];
        rootMesh.position = new BABYLON.Vector3(0, 0, 0);
      },
      (event) => {
        // Loading progress
        console.log(`Loading progress: ${event.loaded} / ${event.total}`);
      },
      (scene, message) => {
        // Error handling
        console.error('Error loading model:', message);
      }
    );

    // Handle window resize
    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener('resize', handleResize);

    // Start render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return (
    <canvas ref={canvasRef} className="w-full h-full fixed" />
  );
} 
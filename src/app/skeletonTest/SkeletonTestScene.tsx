'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { SkeletonViewer } from '@babylonjs/core/Debug/skeletonViewer';
import { Inspector } from '@babylonjs/inspector';

export default function SkeletonTestScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const skeletonRef = useRef<BABYLON.Skeleton | null>(null);
  const [selectedBone, setSelectedBone] = useState<BABYLON.Bone | null>(null);
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [rotationZ, setRotationZ] = useState(0);
  const [bones, setBones] = useState<BABYLON.Bone[]>([]);

  useEffect(() => {
    // Initialize Babylon.js
    if (!canvasRef.current) return;

    // Create engine and scene
    const engine = new BABYLON.Engine(canvasRef.current, true);
    engineRef.current = engine;
    
    const scene = new BABYLON.Scene(engine);
    sceneRef.current = scene;

    
    // Inspector.Show(scene, { overlay: true, embedMode: false });

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
          skeletonRef.current = skeleton;
          setBones(skeleton.bones);
          console.log('Bones:', skeleton.bones.length);
          console.log('Animations:', scene.animationGroups);
          
          // Create a skeleton viewer
          // const skeletonViewer = new SkeletonViewer(
          //   skeleton,
          //   meshes[0],
          //   scene,
          //   false,
          //   0,
          //   {
          //     displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS,
          //   }
          // );
          
          // // Configure the skeleton viewer
          // skeletonViewer.isEnabled = true;
          // skeletonViewer.color = new BABYLON.Color3(1, 0, 0); // Red color for bones
          // skeletonViewer.displayMode = SkeletonViewer.DISPLAY_SPHERE_AND_SPURS;
          
          // Make bones selectable
          skeleton.bones.forEach((bone, index) => {
            // Create a small sphere for each bone to make it selectable
            const boneSphere = BABYLON.MeshBuilder.CreateSphere(
              `bone_${bone.name}`,
              { diameter: 0.05 },
              scene
            );
            
            // Position the sphere at the bone
            boneSphere.position = bone.getAbsolutePosition();
            
            // Make it nearly transparent but keep it selectable
            const material = new BABYLON.StandardMaterial(`bone_material_${index}`, scene);
            material.diffuseColor = new BABYLON.Color3(0, 1, 0);
            material.alpha = 0.3;
            boneSphere.material = material;
            
            // Make it pickable
            boneSphere.isPickable = true;
            
            // Add action on click
            boneSphere.actionManager = new BABYLON.ActionManager(scene);
            boneSphere.actionManager.registerAction(
              new BABYLON.ExecuteCodeAction(
                BABYLON.ActionManager.OnPickTrigger,
                () => {
                  console.log(`Selected bone: ${bone.name}`);
                  setSelectedBone(bone);
                  // Get current rotation
                  const rotation = bone.getRotation();
                  setRotationX(rotation.x * (180 / Math.PI));
                  setRotationY(rotation.y * (180 / Math.PI));
                  setRotationZ(rotation.z * (180 / Math.PI));
                }
              )
            );
          });
          
          // Play animations if they exist
          if (scene.animationGroups && scene.animationGroups.length > 0) {
            // Pause animation to allow manual adjustment
            scene.animationGroups[0].pause();
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

  // Apply rotation when sliders change
  useEffect(() => {
    if (selectedBone) {
      // Convert degrees to radians
      const radX = rotationX * (Math.PI / 180);
      const radY = rotationY * (Math.PI / 180);
      const radZ = rotationZ * (Math.PI / 180);
      
      // Create rotation quaternion
      const rotation = BABYLON.Quaternion.RotationYawPitchRoll(radY, radX, radZ);
      
      // Apply to bone
      selectedBone.setRotationQuaternion(rotation);
      
      // Update the scene
      if (sceneRef.current) {
        sceneRef.current.render();
      }
    }
  }, [rotationX, rotationY, rotationZ, selectedBone]);

  // Function to handle bone selection from dropdown
  const handleBoneSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const boneName = e.target.value;
    const bone = bones.find(b => b.name === boneName) || null;
    
    if (bone) {
      setSelectedBone(bone);
      // Get current rotation
      const rotation = bone.getRotation();
      setRotationX(rotation.x * (180 / Math.PI));
      setRotationY(rotation.y * (180 / Math.PI));
      setRotationZ(rotation.z * (180 / Math.PI));
    } else {
      setSelectedBone(null);
    }
  };

  return (
    <>
      <canvas ref={canvasRef} className="w-full h-full fixed" />
      
      {/* Controls Panel */}
      <div className="fixed top-20 right-5 bg-black p-4 rounded shadow-lg z-10" style={{ width: '300px' }}>
        <h2 className="text-lg font-bold mb-2">Bone Controls</h2>
        
        {/* Bone Selection Dropdown */}
        <div className="mb-4">
          <label className="block text-sm font-medium">Select Bone:</label>
          <select 
            className="w-full p-2 border rounded" 
            onChange={handleBoneSelect}
            value={selectedBone?.name || ''}
          >
            <option value="">Select a bone...</option>
            {bones.map((bone) => (
              <option key={bone.name} value={bone.name}>
                {bone.name}
              </option>
            ))}
          </select>
        </div>
        
        {selectedBone && (
          <>
            <div className="text-sm font-medium mb-2">
              Selected: {selectedBone.name}
            </div>
            
            {/* X Rotation Slider */}
            <div className="mb-2">
              <label className="block text-sm">X Rotation: {rotationX.toFixed(1)}°</label>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={rotationX}
                onChange={(e) => setRotationX(Number(e.target.value))}
                className="w-full"
              />
            </div>
            
            {/* Y Rotation Slider */}
            <div className="mb-2">
              <label className="block text-sm">Y Rotation: {rotationY.toFixed(1)}°</label>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={rotationY}
                onChange={(e) => setRotationY(Number(e.target.value))}
                className="w-full"
              />
            </div>
            
            {/* Z Rotation Slider */}
            <div className="mb-2">
              <label className="block text-sm">Z Rotation: {rotationZ.toFixed(1)}°</label>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={rotationZ}
                onChange={(e) => setRotationZ(Number(e.target.value))}
                className="w-full"
              />
            </div>
            
            {/* Reset Button */}
            <button
              className="bg-red-500 text-white px-4 py-2 rounded mt-2"
              onClick={() => {
                setRotationX(0);
                setRotationY(0);
                setRotationZ(0);
              }}
            >
              Reset Rotation
            </button>
          </>
        )}
      </div>
    </>
  );
} 
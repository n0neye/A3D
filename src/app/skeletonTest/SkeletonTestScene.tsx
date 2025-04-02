'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { SkeletonViewer } from '@babylonjs/core/Debug/skeletonViewer';
import { Inspector } from '@babylonjs/inspector';

let selectedBone: BABYLON.Bone | null = null;
let selectedControl: BABYLON.Mesh | null = null;
let skeleton: BABYLON.Skeleton | null = null;
let gizmoManager: BABYLON.GizmoManager | null = null;
let boneMap: { [name: string]: { bone: BABYLON.Bone, control: BABYLON.Mesh } } = {};

export default function SkeletonTestScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);

  useEffect(() => {
    // Initialize Babylon.js
    if (!canvasRef.current) return;
    console.log("SkeletonTestScene init");
    // Create engine and scene
    const engine = new BABYLON.Engine(canvasRef.current, true);
    engineRef.current = engine;
    const scene = new BABYLON.Scene(engine);
    sceneRef.current = scene;
    // Inspector.Show(scene, { overlay: true, embedMode: false });

    // Configure rendering groups to ensure bone controls render on top
    // scene.setRenderingOrder(BABYLON.RenderingGroup.OPAQUE_RENDERINGGROUP, 
    //                         BABYLON.RenderingGroup.OPAQUE_RENDERINGGROUP,
    //                         BABYLON.RenderingGroup.ALPHABLEND_RENDERINGGROUP);

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

    // Create a gizmo manager
    gizmoManager = new BABYLON.GizmoManager(scene);
    gizmoManager.positionGizmoEnabled = false;
    gizmoManager.rotationGizmoEnabled = true;
    gizmoManager.scaleGizmoEnabled = false;
    gizmoManager.usePointerToAttachGizmos = false;
    gizmoManager.attachableMeshes = []; // We'll add meshes to this later

    // Configure the rotation gizmo
    const rotationGizmo = gizmoManager.gizmos.rotationGizmo;
    if (rotationGizmo) {
      rotationGizmo.updateGizmoRotationToMatchAttachedMesh = true;
      rotationGizmo.scaleRatio = 1.5;
      rotationGizmo.onDragObservable.add(onRotationChange);
    }

    // Handle window resize
    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener('resize', handleResize);

    // Start render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    scene.onPointerObservable.add((pointerInfo) => onPointerObservable(pointerInfo, scene));
    prepareCharacter(scene);



    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      scene.dispose();
      engine.dispose();
    };
  }, []);


  const onPointerObservable = (pointerInfo: BABYLON.PointerInfo, scene: BABYLON.Scene) => {
    if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
      if (pointerInfo.event.button === 0) {  // Left click
        // First try to pick only bone controls by using a predicate function
        const pickInfo = scene.pick(
          scene.pointerX, 
          scene.pointerY,
          (mesh) => {
            return mesh.name.startsWith('bone_'); // Only pick meshes that start with 'bone_'
          }
        );
        
        if (pickInfo.hit && pickInfo.pickedMesh) {
          const mesh = pickInfo.pickedMesh;
          console.log("Picked bone control:", mesh.name);
          
          // Find which bone this control belongs to
          const boneName = mesh.name.replace('bone_', '');
          if (boneMap[boneName]) {
            selectedControl = mesh as BABYLON.Mesh;
            selectedBone = boneMap[boneName].bone;
            if (gizmoManager) {
              gizmoManager.attachToMesh(mesh);
            }
          }
        } else {
          // If no bone control was hit, perform normal picking
          const regularPickInfo = scene.pick(scene.pointerX, scene.pointerY);
          console.log("Picked regular mesh:", regularPickInfo.pickedMesh?.name);
        }
      }
    }
  }

  const prepareCharacter = async (scene: BABYLON.Scene) => {
    // Load the mannequin character
    console.log("prepareCharacter start");
    const result = await BABYLON.ImportMeshAsync(
      '/characters/mannequin_man_idle/mannequin_man_idle.gltf',
      scene,
    );
    console.log("prepareCharacter", result);
    const mesh = result.meshes[0];
    mesh.scaling = new BABYLON.Vector3(1, 1, 1);
    prepareBones(result, scene);

    // Position the model
    const rootMesh = result.meshes[0];
    rootMesh.position = new BABYLON.Vector3(0, 0, 0);
  }

  const prepareBones = (result: BABYLON.ISceneLoaderAsyncResult, scene: BABYLON.Scene) => {
    const skeletons = result.skeletons;
    if (skeletons && skeletons.length > 0) {
      skeleton = skeletons[0];
    }
    if (!skeleton) return;
    const bones = skeleton.bones;
    console.log('Bones:', skeleton.bones.length);
    console.log('Animations:', scene.animationGroups);

    // Make bones selectable
    skeleton.bones.forEach((_bone, index) => {
      // Skip the fingers
      const boneName = _bone.name.toLowerCase();
      if (boneName.includes('thumb') || boneName.includes('index') || boneName.includes('middle') || boneName.includes('ring') || boneName.includes('pinky')) {
        return;
      }

      // Create a small sphere for each bone to make it selectable
      const _boneControl = BABYLON.MeshBuilder.CreateSphere(
        `bone_${_bone.name}`,
        { diameter: 0.05 },
        scene
      );

      // Add to BoneMap
      boneMap[_bone.name] = { bone: _bone, control: _boneControl };

      // Position the sphere at the bone
      if (_bone._linkedTransformNode) {
        _boneControl.parent = _bone._linkedTransformNode.parent;
      } else {
        _boneControl.parent = _bone.parent;
      }
      _boneControl.position = _bone.position;

      // Make it nearly transparent but keep it selectable
      const material = new BABYLON.StandardMaterial(`bone_material_${index}`, scene);
      material.diffuseColor = new BABYLON.Color3(0, 1, 0);
      material.alpha = 0.3;
      _boneControl.material = material;

      // Make the bone control always render on top
      _boneControl.renderingGroupId = 1;

      // Important for picking - set this to the highest possible value
      _boneControl.renderingGroupId = 1;
      _boneControl.isPickable = true;

      // This ensures the mesh is considered for picking
      material.disableDepthWrite = true;

      // Increase visibility
      material.emissiveColor = new BABYLON.Color3(0, 0.5, 0);

      // Critical for picking priority
      _boneControl.alphaIndex = 1000; // Higher value means higher picking priority

      // Add action on click
      _boneControl.actionManager = new BABYLON.ActionManager(scene);
      _boneControl.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
          BABYLON.ActionManager.OnPickTrigger,
          () => {
            console.log(`Selected bone: ${_bone.name}`);
            selectedControl = _boneControl;
            selectedBone = _bone;
            if (gizmoManager) {
              gizmoManager.attachToMesh(_boneControl);
            }
          }
        )
      );
    });

    // Pause animation to allow manual adjustment
    if (scene.animationGroups && scene.animationGroups.length > 0) {
      scene.animationGroups[0].pause();
    }
  }

  const onRotationChange = (event: unknown) => {
    console.log("Rotating:", selectedBone?.name, selectedControl?.name);
    if (!selectedBone || !selectedControl) return;

    // Get the rotation quaternion from the gizmo's attached mesh
    const rotation = selectedControl.rotation;
    if (!rotation) return;

    console.log("Updating bone rotation", selectedBone.name, rotation.x, rotation.y, rotation.z);

    // Apply the same rotation to the bone
    if (selectedBone._linkedTransformNode) {
      selectedBone._linkedTransformNode.rotation = rotation.clone();
    } else {
      selectedBone.rotation = rotation.clone();
    }

    // Force skeleton update
    if (skeleton) {
      skeleton.prepare();
    }
  }

  return (
    <>
      <canvas ref={canvasRef} className="w-full h-full fixed" />
    </>
  );
} 
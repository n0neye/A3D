'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { SkeletonViewer } from '@babylonjs/core/Debug/skeletonViewer';
import { Inspector } from '@babylonjs/inspector';

let selectedBone: BABYLON.Bone | null = null;
let selectedSphere: BABYLON.Mesh | null = null;
let skeleton: BABYLON.Skeleton | null = null;
let gizmoManager: BABYLON.GizmoManager | null = null;
let bones: BABYLON.Bone[] = [];
let boneSpheres: { [name: string]: BABYLON.Mesh } = {};

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

    prepareCharacter(scene);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  const prepareCharacter = async (scene: BABYLON.Scene) => {
    // Load the mannequin character
    const result = await BABYLON.ImportMeshAsync(
      '/characters/mannequin_man_idle/mannequin_man_idle.gltf',
      scene,
    );
    const meshes = result.meshes;
    const skeletons = result.skeletons;

    console.log('Model loaded', { meshes, skeletons });
    // If there are skeletons, log information about them
    if (skeletons && skeletons.length > 0) {
      prepareBones(skeletons[0], scene);
    }
    // Position the model
    const rootMesh = meshes[0];
    rootMesh.position = new BABYLON.Vector3(0, 0, 0);
  }

  const prepareBones = (skeleton: BABYLON.Skeleton, scene: BABYLON.Scene) => {
    bones = skeleton.bones;
    console.log('Bones:', skeleton.bones.length);
    console.log('Animations:', scene.animationGroups);

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
            // setSelectedBone(bone);
            selectedBone = bone;
            // Get current rotation
            const rotation = bone.getRotation();

            if (gizmoManager) {
              gizmoManager.attachToMesh(boneSphere);
            }
            selectedSphere = boneSphere;
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
    console.log("Rotating:", selectedBone?.name, selectedSphere?.name);
    if (!selectedBone || !selectedSphere) return;

    // Get the rotation quaternion from the gizmo's attached mesh
    const rotation = selectedSphere.rotation;
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
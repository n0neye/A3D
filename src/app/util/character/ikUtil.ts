import * as BABYLON from '@babylonjs/core';

// Interfaces
export interface IKTarget {
  mesh: BABYLON.Mesh;
  targetBone: BABYLON.Bone;
  originalPosition: BABYLON.Vector3;
  controlNode: BABYLON.TransformNode;
  ikController?: BABYLON.BoneIKController;
}

export interface CharacterIKData {
  headBone?: string;
  leftHandBone?: string;
  rightHandBone?: string;
  leftFootBone?: string;
  rightFootBone?: string;
}

// Track all currently active IK systems
export const activeIKSystems = new Map<string, {
  targets: IKTarget[],
  skeleton: BABYLON.Skeleton,
  characterMesh: BABYLON.AbstractMesh,
  enabled: boolean
}>();

// Store characters that could have IK but haven't been set up yet
const charactersForIK = new Map<string, {
  mesh: BABYLON.AbstractMesh,
  skeleton: BABYLON.Skeleton,
  ikData: CharacterIKData,
  isSetup: boolean
}>();

// Helper to check if a mesh is a child of another
export const isChildOf = (mesh: BABYLON.AbstractMesh, potentialParent: BABYLON.AbstractMesh): boolean => {
  if (mesh === potentialParent) return true;
  
  let current = mesh.parent;
  while (current) {
    if (current === potentialParent) return true;
    current = current.parent;
  }
  
  return false;
};

// Helper to check if a mesh is an IK target
export const isIKTarget = (mesh: BABYLON.AbstractMesh | null): boolean => {
  if (!mesh) return false;
  
  // Check all IK systems
  for (const ikSystem of activeIKSystems.values()) {
    if (ikSystem.targets.some(target => target.mesh === mesh)) {
      return true;
    }
  }
  
  return false;
};

// Setup the IK system for a character
export const setupIKSystem = (
  scene: BABYLON.Scene,
  characterMesh: BABYLON.AbstractMesh,
  skeleton: BABYLON.Skeleton,
  ikData: CharacterIKData,
  ikEnabled: boolean
) => {
  if (!scene || !ikData) return;
  
  console.log("Setting up IK system for", characterMesh.name, "with skeleton", skeleton.name);
  
  // Create a unique ID for this character's IK system
  const ikSystemId = `ik-${characterMesh.id}`;
  
  // Create IK targets array
  const ikTargets: IKTarget[] = [];
  
  // Helper function to create IK target for a bone
  const createIKTarget = (boneName: string | undefined, color: BABYLON.Color3, size: number = 0.05) => {
    if (!boneName) {
      console.log(`No bone name provided for target`);
      return null;
    }
    
    // Find the bone in the skeleton
    const bone = skeleton.bones.find(b => b.name === boneName);
    if (!bone) {
      console.log(`Bone not found: ${boneName}`);
      return null;
    }
    
    console.log(`Creating IK target for bone: ${boneName}`);
    
    // Create a sphere to visualize and control the IK target
    const targetMesh = BABYLON.MeshBuilder.CreateSphere(
      `ik-target-${boneName}`, 
      { diameter: size }, 
      scene
    );
    
    // Set material for the target
    const material = new BABYLON.StandardMaterial(`ik-target-material-${boneName}`, scene);
    material.diffuseColor = color;
    material.specularColor = BABYLON.Color3.Black();
    material.emissiveColor = color.scale(0.5);
    targetMesh.material = material;
    
    // Create a transform node for controlling the bone
    const controlNode = new BABYLON.TransformNode(`ik-control-${boneName}`, scene);
    
    // Position the control at the bone's world position
    const boneWorldPosition = bone.getPosition(BABYLON.Space.WORLD);
    controlNode.position = boneWorldPosition.clone();
    
    // Position the target mesh at the control node
    targetMesh.parent = controlNode;
    targetMesh.position = BABYLON.Vector3.Zero();
    
    // Make the target mesh pickable
    targetMesh.isPickable = true;
    
    // Create the IK controller
    let ikController: BABYLON.BoneIKController | undefined;
    
    // Setup IK controller for limbs (arms and legs)
    if (boneName.includes('Hand') || boneName.includes('Foot')) {
      // Find the parent bones to create a chain
      let parentBone = bone.getParent();
      let grandparentBone = parentBone ? parentBone.getParent() : null;
      
      if (parentBone && grandparentBone) {
        // Create the IK controller but make it preserve the current pose
        ikController = new BABYLON.BoneIKController(characterMesh, bone, { targetMesh: targetMesh });
        
        // Set appropriate parameters
        ikController.poleTargetPosition = new BABYLON.Vector3(0, 0, 0);
        ikController.poleTargetBone = grandparentBone;
        ikController.maxAngle = Math.PI;
        ikController.slerpAmount = 0.5; // Lower this to make transitions smoother
        
        // Important: don't update until dragged
        ikController.update();
      }else{
        console.error(`No parent or grandparent bone found for ${boneName}`);
      }
    } else if (boneName.includes('Head')) {
      // For the head, just create a simpler controller
      ikController = new BABYLON.BoneIKController(characterMesh, bone, { targetMesh: targetMesh });
      ikController.maxAngle = Math.PI / 4; // Limit head rotation
      ikController.slerpAmount = 0.5;
    }
    
    // Store the IK target
    const ikTarget: IKTarget = {
      mesh: targetMesh,
      targetBone: bone,
      originalPosition: boneWorldPosition.clone(),
      controlNode: controlNode,
      ikController: ikController
    };
    
    // Hide the target initially
    targetMesh.setEnabled(false);
    
    return ikTarget;
  };
  
  // Create IK targets for each body part
  const headTarget = createIKTarget(ikData.headBone, new BABYLON.Color3(1, 0.5, 0));
  const leftHandTarget = createIKTarget(ikData.leftHandBone, new BABYLON.Color3(0, 1, 0));
  const rightHandTarget = createIKTarget(ikData.rightHandBone, new BABYLON.Color3(0, 0, 1));
  const leftFootTarget = createIKTarget(ikData.leftFootBone, new BABYLON.Color3(1, 0, 1));
  const rightFootTarget = createIKTarget(ikData.rightFootBone, new BABYLON.Color3(1, 1, 0));
  
  // Add valid targets to the array
  [headTarget, leftHandTarget, rightHandTarget, leftFootTarget, rightFootTarget]
    .filter(target => target !== null)
    .forEach(target => ikTargets.push(target!));
  
  // Store the IK system
  activeIKSystems.set(ikSystemId, {
    targets: ikTargets,
    skeleton: skeleton,
    characterMesh: characterMesh,
    enabled: false
  });
  
  console.log(`IK system ${ikSystemId} created with ${ikTargets.length} targets`);
  
  // Add drag behavior to each target
  ikTargets.forEach(target => {
    const dragBehavior = new BABYLON.PointerDragBehavior({
      dragPlaneNormal: new BABYLON.Vector3(0, 0, 1)
    });
    
    dragBehavior.onDragStartObservable.add(() => {
      // Logic for drag start if needed
    });
    
    dragBehavior.onDragObservable.add((event) => {
      // When dragging, update the bone position using IK
      updateIK(target, characterMesh);
    });
    
    dragBehavior.onDragEndObservable.add(() => {
      // Logic for drag end if needed
    });
    
    target.mesh.addBehavior(dragBehavior);
  });
  
  // Set up scene observable to detect when this character is selected
  scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERPICK) {
      const pickedMesh = pointerInfo.pickInfo?.pickedMesh;
      
      console.log("Pointer pick detected:", pickedMesh?.name);
      
      // If we clicked the character or any of its children
      if (pickedMesh && isChildOf(pickedMesh, characterMesh)) {
        console.log(`Character ${characterMesh.name} selected, showing IK (enabled: ${ikEnabled})`);
        // Show IK controls if IK is enabled
        setIKVisibility(scene, ikSystemId, ikEnabled);
      } else if (!isIKTarget(pickedMesh || null)) {
        console.log("Clicked outside character, hiding IK");
        // If we clicked elsewhere and not on an IK target, hide the controls
        setIKVisibility(scene, ikSystemId, false);
      }
    }
  });
  
  return ikSystemId;
};

// Function to update IK for a specific target
export const updateIK = (target: IKTarget, characterMesh: BABYLON.AbstractMesh) => {
  if (target.ikController) {
    // Use the BoneIKController when available
    target.ikController.update();
  } else {
    // Fallback to direct bone manipulation (our old method)
    // Get the current world position of the control node
    const targetWorldPos = target.controlNode.getAbsolutePosition();
    
    // Convert the world position to bone local space
    const parentBone = target.targetBone.getParent();
    let targetLocalPos: BABYLON.Vector3;
    
    if (parentBone) {
      // Get the world matrix of the parent bone
      const parentWorldMatrix = parentBone.getWorldMatrix();
      const invParentMatrix = BABYLON.Matrix.Invert(parentWorldMatrix);
      
      // Transform the target position to parent bone local space
      targetLocalPos = BABYLON.Vector3.TransformCoordinates(targetWorldPos, invParentMatrix);
    } else {
      // If no parent, use the skeleton's local space
      const skeleton = target.targetBone.getSkeleton();
      const skeletonMatrix = new BABYLON.Matrix();
      BABYLON.Matrix.FromArrayToRef(skeleton.getTransformMatrices(characterMesh), 0, skeletonMatrix);
      const invSkeletonMatrix = BABYLON.Matrix.Invert(skeletonMatrix);
      targetLocalPos = BABYLON.Vector3.TransformCoordinates(targetWorldPos, invSkeletonMatrix);
    }
    
    // Set the bone's local position to match the target
    target.targetBone.setPosition(targetLocalPos);
    
    // Update the skeleton to reflect changes
    target.targetBone.getSkeleton().computeAbsoluteTransforms();
  }
};

// Set visibility of IK targets for a specific IK system
export const setIKVisibility = (scene: BABYLON.Scene | null, ikSystemId: string, visible: boolean) => {
  const ikSystem = activeIKSystems.get(ikSystemId);
  if (!ikSystem) {
    console.log(`IK system ${ikSystemId} not found`);
    return;
  }
  
  console.log(`Setting IK visibility for ${ikSystemId} to ${visible}`);
  
  // If we're making targets visible, first reset their positions to current pose
  if (visible) {
    resetIKTargetsToCurrentPose(scene, ikSystemId);
  }
  
  // Update the enabled state
  ikSystem.enabled = visible;
  
  // Update target visibility
  ikSystem.targets.forEach(target => {
    target.mesh.setEnabled(visible);
    console.log(`  - Target ${target.mesh.name} visibility set to ${visible}`);
  });
};

// Reset IK targets to current bone positions
export const resetIKTargetsToCurrentPose = (scene: BABYLON.Scene | null, ikSystemId: string) => {
  const ikSystem = activeIKSystems.get(ikSystemId);
  if (!ikSystem || !scene) {
    console.log(`IK system ${ikSystemId} not found or scene is null`);
    return;
  }
  
  console.log(`Resetting IK targets to current pose for ${ikSystemId}`);
  
  // Temporarily pause all animations for this character
  const animationGroups = scene.animationGroups || [];
  const characterAnimations = animationGroups.filter(animGroup => 
    animGroup.targetedAnimations.some(anim => 
      anim.target.hasOwnProperty("_parentNode") && 
      (anim.target as any)._parentNode === ikSystem.characterMesh
    )
  );
  
  // Store animation states to restore later
  const wasAnimationPlaying = characterAnimations.map(anim => anim.isPlaying);
  
  // Pause animations before updating IK targets
  characterAnimations.forEach(anim => anim.pause());
  
  // Update each target to match current bone position
  ikSystem.targets.forEach(target => {
    // Get the current world position of the bone
    const currentBoneWorldPos = target.targetBone.getPosition(BABYLON.Space.WORLD);
    
    // Update the control node position to match precisely
    target.controlNode.position = currentBoneWorldPos.clone();
    
    // Update the stored original position
    target.originalPosition = currentBoneWorldPos.clone();
    
    // If we have an IK controller, make sure it's initialized with current pose
    if (target.ikController) {
      // Force the IK controller to update once to initialize its internal state
      target.ikController.update();
    }
    
    console.log(`  - Reset target for ${target.targetBone.name} to position:`, currentBoneWorldPos);
  });
  
  // Resume animations that were playing
  characterAnimations.forEach((anim, index) => {
    if (wasAnimationPlaying[index]) {
      anim.play(true);
    }
  });
};

// Toggle IK system for all characters
export const toggleIKForAllCharacters = (scene: BABYLON.Scene | null, ikEnabled: boolean) => {
  console.log(`Toggling IK mode for all characters to: ${ikEnabled}`);
  
  // Update all active IK systems
  console.log(`Active IK systems: ${activeIKSystems.size}`);
  activeIKSystems.forEach((ikSystem, id) => {
    console.log(`Updating visibility for system: ${id}`);
    
    // If we're enabling IK, make sure targets match current pose
    if (ikEnabled) {
      resetIKTargetsToCurrentPose(scene, id);
    }
    
    setIKVisibility(scene, id, ikEnabled);
  });
};

// Register scene animation loop for updating IK
export const registerIKAnimationLoop = (scene: BABYLON.Scene | null) => {
  if (!scene) return;
  
  scene.registerBeforeRender(() => {
    // Update all active IK systems on each frame
    activeIKSystems.forEach(ikSystem => {
      if (ikSystem.enabled) {
        ikSystem.targets.forEach(target => {
          if (target.ikController) {
            target.ikController.update();
          }
        });
      }
    });
  });
};


// Register a character for potential IK setup
export const registerCharacterForIK = (
  mesh: BABYLON.AbstractMesh,
  skeleton: BABYLON.Skeleton,
  ikData: CharacterIKData
) => {
  const id = `character-for-ik-${mesh.id}`;
  console.log(`Registering character ${mesh.name} for potential IK setup`);
  
  charactersForIK.set(id, {
    mesh,
    skeleton,
    ikData,
    isSetup: false
  });
};

// Set up IK for all registered characters that don't have it yet
export const setupIKForRegisteredCharacters = (scene: BABYLON.Scene | null) => {
  if (!scene) return;
  
  console.log(`Setting up IK for ${charactersForIK.size} registered characters`);
  
  charactersForIK.forEach((character, id) => {
    if (!character.isSetup) {
      console.log(`Setting up IK for registered character: ${character.mesh.name}`);
      setupIKSystem(scene, character.mesh, character.skeleton, character.ikData, true);
      character.isSetup = true;
    }
  });
};

// Add this function to your ik.ts file
export const resetIKTargetsForAllCharacters = (scene: BABYLON.Scene | null): void => {
  if (!scene) return;
  
  console.log('Resetting IK targets for all characters');
  
  // Reset all active IK targets to their original positions
  activeIKSystems.forEach((ikSystem) => {
    ikSystem.targets.forEach(target => {
      if (target.mesh && target.originalPosition) {
        // Reset the target mesh position
        target.controlNode.position = target.originalPosition.clone();
        
        // Update the IK controller if it exists
        if (target.ikController) {
          target.ikController.update();
        }
      }
    });
    
    // Make sure the skeleton is updated
    ikSystem.skeleton.computeAbsoluteMatrices();
  });
}; 
import * as BABYLON from '@babylonjs/core';
import { EditMode, setEditMode, getCurrentEditMode } from '../scene-modes';

// Track characters with available bone control
const charactersWithBones = new Map<string, {
  mesh: BABYLON.AbstractMesh,
  skeleton: BABYLON.Skeleton,
  boneControls: Map<string, {
    bone: BABYLON.Bone,
    controlMesh: BABYLON.Mesh,
    originalRotation: BABYLON.Quaternion
  }>,
  visible: boolean
}>();

// Currently selected bone for manipulation
let selectedBoneControl: {
  characterId: string,
  boneId: string
} | null = null;

// Initialize a rotation gizmo
let rotationGizmo: BABYLON.Nullable<BABYLON.IRotationGizmo> = null;
let gizmoManager: BABYLON.GizmoManager | null = null;

// Register a character for bone control
export const registerCharacterForBoneControl = (
  scene: BABYLON.Scene | null,
  mesh: BABYLON.AbstractMesh,
  skeleton: BABYLON.Skeleton
) => {
  if (!scene) return;

  const characterId = `character-bones-${mesh.id}`;
  console.log(`Registering character ${mesh.name} for bone control`);

  // Create bone controls map
  const boneControls = new Map();

  // Create the gizmo manager if it doesn't exist
  if (!gizmoManager) {
    // First, dispose any existing gizmo managers in the scene
    scene.getNodes().forEach(node => {
      // Only check constructor name and avoid direct type comparison
      if (node.constructor?.name === "GizmoManager") {
        // Use as any to bypass the TypeScript error
        (node as any).dispose();
      }
    });
    
    gizmoManager = new BABYLON.GizmoManager(scene);
    gizmoManager.positionGizmoEnabled = false;
    gizmoManager.rotationGizmoEnabled = true;
    gizmoManager.scaleGizmoEnabled = false;
    gizmoManager.usePointerToAttachGizmos = false;
    gizmoManager.attachableMeshes = [];
    
    // Customize rotation gizmo
    rotationGizmo = gizmoManager.gizmos.rotationGizmo;
    if (rotationGizmo) {
      rotationGizmo.updateGizmoRotationToMatchAttachedMesh = false;
      rotationGizmo.updateGizmoPositionToMatchAttachedMesh = true;
    }
  }

  // Store the character info
  charactersWithBones.set(characterId, {
    mesh,
    skeleton,
    boneControls,
    visible: false
  });

  return characterId;
};

// Helper function to check if a bone is a finger (child of a hand)
const isFingerBone = (bone: BABYLON.Bone): boolean => {
  // Check if this bone is a finger bone directly
  if (bone.name.includes('finger') || 
      bone.name.includes('thumb') || 
      bone.name.includes('index') || 
      bone.name.includes('middle') || 
      bone.name.includes('ring') || 
      bone.name.includes('pinky') || 
      bone.name.includes('Finger') || 
      bone.name.includes('Thumb')) {
    return true;
  }

  // Check if parent is a hand bone
  let parent = bone.getParent();
  if (parent && (parent.name.includes('Hand') || parent.name.includes('hand'))) {
    return true; // Child of a hand is a finger
  }

  // Check if this bone is too small (often fingers)
  // Get the length by checking distance to children
  if (bone.children.length > 0) {
    const childPos = bone.children[0].getPosition();
    const bonePos = bone.getPosition();
    const distance = BABYLON.Vector3.Distance(childPos, bonePos);
    if (distance < 0.05) {
      return true; // Very small bones are likely fingers
    }
  }

  return false;
};

// Create control meshes for all bones in a character
export const createBoneControlMeshes = (
  scene: BABYLON.Scene | null,
  characterId: string
) => {
  if (!scene) return;

  const character = charactersWithBones.get(characterId);
  if (!character) {
    console.error(`Character ${characterId} not found for bone control`);
    return;
  }

  // Clear any existing bone controls
  character.boneControls.forEach(control => {
    control.controlMesh.dispose();
  });
  character.boneControls.clear();

  // Create a control mesh for each bone
  character.skeleton.bones.forEach(bone => {
    // Check for main skeletal bones and skip fingers
    if ((bone.name.includes('mixamo') || 
        bone.name.includes('Hips') || 
        bone.name.includes('Hand') || 
        bone.name.includes('Foot') || 
        bone.name.includes('Arm') || 
        bone.name.includes('Leg') || 
        bone.name.includes('Head') || 
        bone.name.includes('Spine')) && 
        !isFingerBone(bone)) {
      
      // Create a small box to represent the bone
      const controlMesh = BABYLON.MeshBuilder.CreateBox(
        `bone-control-${bone.name}`,
        { size: 0.03 }, // Small size to not obstruct view
        scene
      );

      // Set the material
      const material = new BABYLON.StandardMaterial(`bone-material-${bone.name}`, scene);
      material.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.2);
      material.specularColor = BABYLON.Color3.Black();
      material.emissiveColor = new BABYLON.Color3(0.4, 0.4, 0.1);
      controlMesh.material = material;

      // Position the control at the bone's position
      const boneWorldPosition = bone.getPosition(BABYLON.Space.WORLD);
      controlMesh.position = boneWorldPosition.clone();

      // Store the original rotation
      const originalRotation = bone.getRotationQuaternion()?.clone() || 
                              BABYLON.Quaternion.FromEulerAngles(
                                bone.rotation.x, 
                                bone.rotation.y, 
                                bone.rotation.z
                              );

      // Make the control mesh pickable
      controlMesh.isPickable = true;

      // Add action manager for selection
      controlMesh.actionManager = new BABYLON.ActionManager(scene);
      controlMesh.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
          BABYLON.ActionManager.OnPickTrigger,
          () => selectBone(scene, characterId, bone.name)
        )
      );

      // Hide initially
      controlMesh.setEnabled(false);

      // Store in the bone controls map
      character.boneControls.set(bone.name, {
        bone,
        controlMesh,
        originalRotation
      });

      // Add metadata tag
      controlMesh.metadata = { 
        type: "boneControl", 
        excludeFromObjectsPanel: true 
      };
    }
  });

  console.log(`Created ${character.boneControls.size} bone controls for character ${characterId}`);
};

// Select a bone for manipulation
export const selectBone = (
  scene: BABYLON.Scene | null,
  characterId: string,
  boneId: string
) => {
  // Ensure we're in bone editing mode
  setEditMode(EditMode.BoneEditing);

  if (!scene || !gizmoManager || !rotationGizmo) return;

  const character = charactersWithBones.get(characterId);
  if (!character) return;

  const boneControl = character.boneControls.get(boneId);
  if (!boneControl) return;

  console.log(`Selected bone: ${boneId} on character ${characterId}`);

  // Highlight the selected bone control
  character.boneControls.forEach((control, id) => {
    const material = control.controlMesh.material as BABYLON.StandardMaterial;
    if (id === boneId) {
      material.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
      material.diffuseColor = new BABYLON.Color3(1, 0.8, 0);
    } else {
      material.emissiveColor = new BABYLON.Color3(0.4, 0.4, 0.1);
      material.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.2);
    }
  });

  // Attach rotation gizmo to the selected bone control
  gizmoManager.attachToMesh(boneControl.controlMesh);

  // Save selection state
  selectedBoneControl = {
    characterId,
    boneId
  };

  // Set up gizmo rotation observable
  if (rotationGizmo) {
    // Cast to specific implementation
    const concreteGizmo = rotationGizmo;
    
    // Remove any existing observers to prevent duplicates
    concreteGizmo.onDragEndObservable.clear();
    
    // Add observer for when rotation ends
    concreteGizmo.onDragEndObservable.add(() => {
      if (selectedBoneControl) {
        updateBoneRotation(scene);
      }
    });
    
    // Add observer for continuous updates during rotation
    concreteGizmo.onDragObservable.clear();
    concreteGizmo.onDragObservable.add(() => {
      if (selectedBoneControl) {
        updateBoneRotation(scene);
      }
    });
  }
};

// Update bone rotation based on gizmo
export const updateBoneRotation = (scene: BABYLON.Scene | null) => {
  console.log("Updating bone rotation");
  if (!scene || !selectedBoneControl) return;

  const character = charactersWithBones.get(selectedBoneControl.characterId);
  if (!character) return;

  const boneControl = character.boneControls.get(selectedBoneControl.boneId);
  if (!boneControl) return;

  console.log("Bone control found");

  // Get the rotationQuaternion from the control mesh
  // boneControl.controlMesh.rotationQuaternion is undefined, use absoluteRotationQuaternion instead
  if (boneControl.controlMesh.absoluteRotationQuaternion) {
    // Apply the rotation to the bone in local space
    boneControl.bone.setRotationQuaternion(
      boneControl.controlMesh.absoluteRotationQuaternion.clone()
    );
    
    // Update the skeleton to apply changes
    // computeAbsoluteTransforms is deprecated, use computeAbsoluteMatrices instead
    character.skeleton.computeAbsoluteMatrices();
    
    console.log(`Updated bone ${boneControl.bone.name} rotation:`, 
      boneControl.controlMesh.absoluteRotationQuaternion);
  }
};

// Toggle bone controls visibility for a character
export const setBoneControlsVisibility = (
  characterId: string,
  visible: boolean
) => {
  const character = charactersWithBones.get(characterId);
  if (!character) {
    console.error(`Character ${characterId} not found for bone control`);
    return;
  }

  console.log(`Setting bone controls visibility for ${characterId} to ${visible}`);

  // Update visibility state
  character.visible = visible;

  // Update each bone control mesh visibility
  character.boneControls.forEach(control => {
    control.controlMesh.setEnabled(visible);
  });

  // If hiding controls, deselect any selected bone
  if (!visible && selectedBoneControl?.characterId === characterId) {
    if (gizmoManager) {
      gizmoManager.attachToMesh(null);
    }
    selectedBoneControl = null;
  }
};

// Toggle bone controls for all characters
export const toggleBoneControlsForAllCharacters = (
  scene: BABYLON.Scene | null,
  visible: boolean
) => {
  if (!scene) return;
  
  console.log(`Toggling bone controls for all characters to ${visible}`);
  
  // Set the global edit mode
  setEditMode(visible ? EditMode.BoneEditing : EditMode.Default);
  
  // For each character that has bone controls
  charactersWithBones.forEach((character, characterId) => {
    // Create bone controls if they don't exist and we're making them visible
    if (visible && character.boneControls.size === 0) {
      createBoneControlMeshes(scene, characterId);
    }

    // Set visibility
    setBoneControlsVisibility(characterId, visible);
  });

  // If hiding all controls, detach gizmo
  if (!visible && gizmoManager) {
    gizmoManager.attachToMesh(null);
    selectedBoneControl = null;
  }
};

// Reset all bone rotations to original state
export const resetBoneRotations = (
  characterId: string
) => {
  const character = charactersWithBones.get(characterId);
  if (!character) return;

  console.log(`Resetting bone rotations for character ${characterId}`);

  // Reset each bone's rotation to its original state
  character.boneControls.forEach(control => {
    control.bone.setRotationQuaternion(control.originalRotation.clone());
    
    // Also reset the control mesh rotation
    control.controlMesh.rotationQuaternion = control.originalRotation.clone();
  });

  // Update the skeleton
  character.skeleton.computeAbsoluteTransforms();
};

// Reset all bone rotations for all characters
export const resetAllBoneRotations = () => {
  charactersWithBones.forEach((character, characterId) => {
    resetBoneRotations(characterId);
  });
}; 
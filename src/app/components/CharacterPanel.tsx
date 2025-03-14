import React, { useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { BoneIKController } from '@babylonjs/core/Bones';

interface CharacterPanelProps {
  scene: BABYLON.Scene | null;
  onCreateCharacter?: (createFn: () => BABYLON.Mesh) => BABYLON.Mesh | null;
}

interface CharacterModelData {
  id: string;
  name: string;
  thumbnailUrl: string;
  modelUrl: string; 
  scale: number;
  description: string;
  ikData?: {
    headBone?: string;
    leftHandBone?: string;
    rightHandBone?: string;
    leftFootBone?: string;
    rightFootBone?: string;
  };
}

// Available character models
const characterModels: CharacterModelData[] = [
  {
    id: 'mannequin-man',
    name: 'Mannequin Man',
    thumbnailUrl: '/characters/mannequin_man_thumbnail.jpg',
    modelUrl: '/characters/mannequin_man_idle/mannequin_man_idle_opt.glb',
    scale: 1.0,
    description: 'Mannequin with rigging and IK controls',
    ikData: {
      headBone: 'mixamorig1:HeadTop_End',
      leftHandBone: 'mixamorig1:LeftHand',
      rightHandBone: 'mixamorig1:RightHand',
      leftFootBone: 'mixamorig1:LeftFoot',
      rightFootBone: 'mixamorig1:RightFoot'
    }
  },
  {
    id: 'human-male',
    name: 'Human Male',
    thumbnailUrl: '/characters/male_thumbnail.jpg',
    modelUrl: '/characters/human_male.glb',
    scale: 1.2,
    description: 'Male human character with basic animations',
    ikData: {
      headBone: 'mixamorig:Head',
      leftHandBone: 'mixamorig:LeftHand',
      rightHandBone: 'mixamorig:RightHand',
      leftFootBone: 'mixamorig:LeftFoot',
      rightFootBone: 'mixamorig:RightFoot'
    }
  },
  // {
  //   id: 'human-female',
  //   name: 'Human Female',
  //   thumbnailUrl: '/characters/female_thumbnail.jpg',
  //   modelUrl: '/characters/human_female.glb',
  //   scale: 1.2,
  //   description: 'Female human character with basic animations'
  // },
  // {
  //   id: 'fantasy',
  //   name: 'Fantasy Character',
  //   thumbnailUrl: '/characters/fantasy_thumbnail.jpg',
  //   modelUrl: '/characters/fantasy.glb',
  //   scale: 1.5,
  //   description: 'Fantasy character with magical animations'
  // }
];

// Interface for IK target management
interface IKTarget {
  mesh: BABYLON.Mesh;
  targetBone: BABYLON.Bone;
  originalPosition: BABYLON.Vector3;
  controlNode: BABYLON.TransformNode;
  ikController?: BABYLON.BoneIKController;
}

// Track all currently active IK systems
const activeIKSystems = new Map<string, {
  targets: IKTarget[],
  skeleton: BABYLON.Skeleton,
  characterMesh: BABYLON.AbstractMesh,
  enabled: boolean
}>();

const CharacterPanel: React.FC<CharacterPanelProps> = ({ scene, onCreateCharacter }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [ikEnabled, setIkEnabled] = useState<boolean>(false);

  const addCharacter = async (modelData: CharacterModelData) => {
    if (!scene || !onCreateCharacter) return;
    
    setIsLoading(true);
    setSelectedCharacter(modelData.id);
    
    try {
      const createCharacterMesh = (): BABYLON.Mesh => {
        // Create a temporary mesh placeholder while the model loads
        const placeholder = BABYLON.MeshBuilder.CreateSphere(
          `character-${modelData.id}-${Date.now()}`, 
          { diameter: 0.5 }, 
          scene
        );
        
        // Position the placeholder
        placeholder.position.y = 0.0;
        
        // Store a reference that we can update
        let actualMesh: BABYLON.AbstractMesh | null = placeholder;
        
        // Load the actual model asynchronously
        BABYLON.SceneLoader.ImportMeshAsync(
          "", 
          modelData.modelUrl, 
          "", 
          scene
        ).then(result => {
          const root = result.meshes[0];
          actualMesh = root;  // Update our reference
          
          // Add to make tracking in the scene easier
          root.name = `${modelData.name}-${Date.now()}`;
          root.id = `character-${modelData.id}-${Date.now()}`;
          
          console.log("Character loaded successfully:", root.name);
          console.log("Found meshes:", result.meshes.map(m => m.name).join(", "));
          
          // Apply the scale
          root.scaling = new BABYLON.Vector3(modelData.scale, modelData.scale, modelData.scale);
          
          // Position at the same location as the placeholder
          root.position = placeholder.position.clone();
          
          // Get the skeleton if available
          const skeleton = result.skeletons && result.skeletons.length > 0 
            ? result.skeletons[0] 
            : null;
          
          console.log("Found skeleton:", skeleton ? skeleton.name : "None");
          if (skeleton) {
            console.log("Bones:", skeleton.bones.map(b => b.name).join(", "));
          }
          
          // Setup IK system if we have a skeleton and IK data
          if (skeleton && modelData.ikData) {
            setupIKSystem(root, skeleton, modelData.ikData);
          }
          
          // Delete the placeholder after we've finished setting up
          placeholder.dispose();
          
          // Handle animations if they exist
          if (result.animationGroups && result.animationGroups.length > 0) {
            // Get the first animation and play it
            const idleAnimation = result.animationGroups.find(a => 
              a.name.toLowerCase().includes('idle')
            ) || result.animationGroups[0];
            
            idleAnimation.play(true); // true for looping
          }
        }).catch(error => {
          console.error("Error loading character model:", error);
          placeholder.dispose();
        });
        
        return placeholder;
      };
      
      // Create the character using the provided callback
      onCreateCharacter(createCharacterMesh);
    } catch (error) {
      console.error("Error adding character:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Setup the IK system for a character
  const setupIKSystem = (
    characterMesh: BABYLON.AbstractMesh, 
    skeleton: BABYLON.Skeleton, 
    ikData: CharacterModelData['ikData']
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
          // Create an IK controller with a chain length of 2 (e.g., shoulder -> elbow -> hand)
          ikController = new BABYLON.BoneIKController(characterMesh, bone, { targetMesh: targetMesh });
          ikController.poleTargetPosition = new BABYLON.Vector3(0, 0, 0);
          ikController.poleTargetBone = grandparentBone;
          ikController.maxAngle = Math.PI;
          ikController.slerpAmount = 0.5;
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
          setIKVisibility(ikSystemId, ikEnabled);
        } else if (!isIKTarget(pickedMesh || null)) {
          console.log("Clicked outside character, hiding IK");
          // If we clicked elsewhere and not on an IK target, hide the controls
          setIKVisibility(ikSystemId, false);
        }
      }
    });
  };
  
  // Helper to check if a mesh is a child of another
  const isChildOf = (mesh: BABYLON.AbstractMesh, potentialParent: BABYLON.AbstractMesh): boolean => {
    if (mesh === potentialParent) return true;
    
    let current = mesh.parent;
    while (current) {
      if (current === potentialParent) return true;
      current = current.parent;
    }
    
    return false;
  };
  
  // Helper to check if a mesh is an IK target
  const isIKTarget = (mesh: BABYLON.AbstractMesh | null): boolean => {
    if (!mesh) return false;
    
    // Check all IK systems
    for (const ikSystem of activeIKSystems.values()) {
      if (ikSystem.targets.some(target => target.mesh === mesh)) {
        return true;
      }
    }
    
    return false;
  };
  
  // Set visibility of IK targets for a specific IK system
  const setIKVisibility = (ikSystemId: string, visible: boolean) => {
    const ikSystem = activeIKSystems.get(ikSystemId);
    if (!ikSystem) {
      console.log(`IK system ${ikSystemId} not found`);
      return;
    }
    
    console.log(`Setting IK visibility for ${ikSystemId} to ${visible}`);
    
    // Update the enabled state
    ikSystem.enabled = visible;
    
    // Update target visibility
    ikSystem.targets.forEach(target => {
      target.mesh.setEnabled(visible);
      console.log(`  - Target ${target.mesh.name} visibility set to ${visible}`);
    });
  };
  
  // Update IK for a specific target
  const updateIK = (target: IKTarget, characterMesh: BABYLON.AbstractMesh) => {
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
  
  // Toggle IK system on/off
  const toggleIK = () => {
    const newIkEnabled = !ikEnabled;
    console.log(`Toggling IK mode to: ${newIkEnabled}`);
    setIkEnabled(newIkEnabled);
    
    // Update all active IK systems
    console.log(`Active IK systems: ${activeIKSystems.size}`);
    activeIKSystems.forEach((ikSystem, id) => {
      console.log(`Updating visibility for system: ${id}`);
      setIKVisibility(id, newIkEnabled);
    });
  };

  // Animation player function
  const playAnimation = (characterMesh: BABYLON.Mesh, animationName: string) => {
    // Find the root node that holds the animations
    const rootNode = characterMesh.getChildMeshes(false)[0]?.parent || characterMesh;
    
    // Access animation groups from the scene
    const animationGroups = scene?.animationGroups || [];
    
    // Find animation groups related to this character
    const characterAnimations = animationGroups.filter(animGroup => 
      animGroup.targetedAnimations.some(anim => 
        anim.target.hasOwnProperty("_parentNode") && 
        (anim.target as any)._parentNode === rootNode
      )
    );
    
    // Stop any running animations on this character
    characterAnimations.forEach(anim => anim.stop());
    
    // Find and play the requested animation
    const requestedAnim = characterAnimations.find(anim => 
      anim.name.toLowerCase().includes(animationName.toLowerCase())
    );
    
    if (requestedAnim) {
      requestedAnim.play(true);
    } else if (characterAnimations.length > 0) {
      // Play the first available animation if the requested one isn't found
      characterAnimations[0].play(true);
    }
  };

  // Add this to the scene's animation loop
  scene?.registerBeforeRender(() => {
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

  return (
    <div className="p-4 bg-black rounded-lg border border-gray-700 shadow-lg mb-4">
      <h3 className="text-lg font-medium mb-3 text-white">Add Characters</h3>
      
      <div className="grid grid-cols-2 gap-2 mb-3">
        {characterModels.map(model => (
          <button
            key={model.id}
            onClick={() => addCharacter(model)}
            disabled={isLoading}
            className={`p-2 bg-gray-700 rounded hover:bg-gray-600 flex flex-col items-center justify-center border ${
              selectedCharacter === model.id ? 'border-blue-400' : 'border-gray-600'
            } transition-all`}
          >
            <div className="w-full h-24 bg-gray-800 mb-2 rounded overflow-hidden flex items-center justify-center">
              {/* Ideally, we'd use actual thumbnails */}
              <div className="text-2xl text-gray-400">
                {model.name[0]}
              </div>
            </div>
            <div className="text-sm text-white font-medium">{model.name}</div>
            <div className="text-xs text-gray-400 mt-1 line-clamp-2">{model.description}</div>
          </button>
        ))}
      </div>
      
      {/* IK Controls Section */}
      <div className="mt-4 border-t border-gray-700 pt-3">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-sm font-medium text-white">Character Posing</h4>
          <button 
            onClick={toggleIK}
            className={`px-3 py-1 text-xs rounded ${
              ikEnabled 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {ikEnabled ? 'IK Enabled' : 'Enable IK'}
          </button>
        </div>
        
        <div className="text-xs text-gray-400 mb-2">
          {ikEnabled 
            ? 'Click and drag the colored control points to pose the character' 
            : 'Enable IK to pose the character by dragging control points'}
        </div>
        
        {ikEnabled && (
          <div className="flex flex-wrap gap-1">
            <span className="px-2 py-1 bg-gray-800 rounded text-xs flex items-center">
              <div className="w-2 h-2 rounded-full bg-orange-500 mr-1"></div>
              Head
            </span>
            <span className="px-2 py-1 bg-gray-800 rounded text-xs flex items-center">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
              Left Hand
            </span>
            <span className="px-2 py-1 bg-gray-800 rounded text-xs flex items-center">
              <div className="w-2 h-2 rounded-full bg-blue-500 mr-1"></div>
              Right Hand
            </span>
            <span className="px-2 py-1 bg-gray-800 rounded text-xs flex items-center">
              <div className="w-2 h-2 rounded-full bg-purple-500 mr-1"></div>
              Left Foot
            </span>
            <span className="px-2 py-1 bg-gray-800 rounded text-xs flex items-center">
              <div className="w-2 h-2 rounded-full bg-yellow-500 mr-1"></div>
              Right Foot
            </span>
          </div>
        )}
      </div>
      
      {isLoading && (
        <div className="flex justify-center items-center py-2">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-blue-500"></div>
          <span className="ml-2 text-sm text-gray-400">Loading character...</span>
        </div>
      )}
    </div>
  );
};

export default CharacterPanel; 
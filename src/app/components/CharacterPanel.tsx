import React, { useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';
import { 
  setupIKSystem, 
  toggleIKForAllCharacters, 
  registerIKAnimationLoop,
  activeIKSystems,
  CharacterIKData,
  registerCharacterForIK,
  setupIKForRegisteredCharacters
} from '../util/character/ikUtil';
import { stopCharacterAnimations } from '../util/character/animationUtil';
import { 
  registerCharacterForBoneControl, 
  toggleBoneControlsForAllCharacters, 
  resetAllBoneRotations 
} from '../util/character/bonesUtil';
import { EditorModeManager } from '../util/editor/modeManager';
import { useEditorMode } from '../util/editor/modeManager';

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
  ikData?: CharacterIKData;
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
];

const CharacterPanel: React.FC<CharacterPanelProps> = ({ scene, onCreateCharacter }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const { currentModeId, setMode, isInMode } = useEditorMode(scene);
  
  // Register the IK animation loop once when the component mounts
  useEffect(() => {
    registerIKAnimationLoop(scene);
  }, [scene]);

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
        BABYLON.ImportMeshAsync(
          modelData.modelUrl, 
          scene,
        ).then(result => {
          const root = result.meshes[0];
          actualMesh = root;
          
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
            
            // Store character for potential IK setup later
            if (modelData.ikData) {
              registerCharacterForIK(root, skeleton, modelData.ikData);
            }
            
            // Register for bone control
            registerCharacterForBoneControl(scene, root, skeleton);
          }
          
          // Delete the placeholder after we've finished setting up
          placeholder.dispose();
          
          // Stop the animation
          stopCharacterAnimations(scene, root);
          
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
  
  // Toggle IK system on/off
  const toggleIK = () => {
    if (isInMode('ik')) {
      setMode('default');
    } else {
      setMode('ik');
    }
  };

  // Toggle bone control visibility for all characters
  const toggleBoneControl = () => {
    if (isInMode('bone')) {
      setMode('default');
    } else {
      setMode('bone');
    }
  };

  // Reset all bone rotations
  const resetPose = () => {
    resetAllBoneRotations();
  };

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
        <div className="flex flex-col  mb-2">
          <h4 className="text-sm font-medium text-white">Character Posing</h4>
          <div className="flex gap-2">
            <button 
              onClick={toggleIK}
              disabled={isInMode('bone')}
              className={`px-3 py-1 text-xs rounded ${
                isInMode('ik')
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              } ${isInMode('bone') ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isInMode('ik') ? 'IK Enabled' : 'Enable IK'}
            </button>
            
            <button 
              onClick={toggleBoneControl}
              disabled={isInMode('ik')}
              className={`px-3 py-1 text-xs rounded ${
                isInMode('bone')
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              } ${isInMode('ik') ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isInMode('bone') ? 'Bones Enabled' : 'Enable Bones'}
            </button>
            
            <button 
              onClick={resetPose}
              className="px-3 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
            >
              Reset Pose
            </button>
          </div>
        </div>
        
        <div className="text-xs text-gray-400 mb-2">
          {isInMode('ik') 
            ? 'Click and drag the colored control points to pose the character' 
            : isInMode('bone')
            ? 'Click on bones to select them, then use the rotation gizmo to adjust'
            : 'Enable IK or Bone control to pose the character'}
        </div>
        
        {isInMode('ik') && (
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
        
        {isInMode('bone') && (
          <div className="flex flex-wrap gap-1">
            <span className="px-2 py-1 bg-gray-800 rounded text-xs flex items-center">
              <div className="w-2 h-2 rounded-full bg-yellow-500 mr-1"></div>
              Select any bone
            </span>
            <span className="px-2 py-1 bg-gray-800 rounded text-xs flex items-center">
              <div className="w-2 h-2 rounded-full bg-orange-500 mr-1"></div>
              Rotate with gizmo
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
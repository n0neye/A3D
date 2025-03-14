import React, { useState } from 'react';
import * as BABYLON from '@babylonjs/core';
import '@babylonjs/loaders';

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
}

// Available character models
const characterModels: CharacterModelData[] = [
  {
    id: 'mannequin-man',
    name: 'Mannequin Man',
    thumbnailUrl: '/characters/mannequin_man_thumbnail.jpg',
    modelUrl: '/characters/mannequin_man_idle_opt.glb',
    scale: 1.0,
    description: 'Futuristic robot with full rig and animations'
  },
  {
    id: 'human-male',
    name: 'Human Male',
    thumbnailUrl: '/characters/male_thumbnail.jpg',
    modelUrl: '/characters/human_male.glb',
    scale: 1.2,
    description: 'Male human character with basic animations'
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

const CharacterPanel: React.FC<CharacterPanelProps> = ({ scene, onCreateCharacter }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);

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
        
        // Load the actual model asynchronously
        BABYLON.ImportMeshAsync(
          modelData.modelUrl, 
          scene
        ).then(result => {
          const root = result.meshes[0];
          
          // Apply the scale
          root.scaling = new BABYLON.Vector3(modelData.scale, modelData.scale, modelData.scale);
          
          // Position at the same location as the placeholder
          root.position = placeholder.position.clone();

          // Rename the mesh to the model name
          root.name = modelData.name;
          
          // Delete the placeholder
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
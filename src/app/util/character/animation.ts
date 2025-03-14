import * as BABYLON from '@babylonjs/core';

// Animation player function
export const playAnimation = (scene: BABYLON.Scene | null, characterMesh: BABYLON.Mesh, animationName: string) => {
    if (!scene) return;
    
    // Find the root node that holds the animations
    const rootNode = characterMesh.getChildMeshes(false)[0]?.parent || characterMesh;
    
    // Access animation groups from the scene
    const animationGroups = scene.animationGroups || [];
    
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
  
  // Helper to stop all animations for a character
  export const stopCharacterAnimations = (scene: BABYLON.Scene | null, characterMesh: BABYLON.AbstractMesh) => {
    if (!scene) return;
    
    const animationGroups = scene.animationGroups || [];
    const characterAnimations = animationGroups.filter(animGroup => 
      animGroup.targetedAnimations.some(anim => 
        anim.target.hasOwnProperty("_parentNode") && 
        (anim.target as any)._parentNode === characterMesh
      )
    );
    
    characterAnimations.forEach(anim => anim.stop());
  };
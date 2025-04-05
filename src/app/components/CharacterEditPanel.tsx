import React, { useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { Button } from "@/components/ui/button";
import { CharacterEntity } from '@/app/engine/entity/CharacterEntity';
import { IconEye, IconEyeOff, IconRotateClockwise } from '@tabler/icons-react';
import { trackEvent, ANALYTICS_EVENTS } from '../util/analytics';

interface CharacterEditPanelProps {
  entity: CharacterEntity;
}

const CharacterEditPanel: React.FC<CharacterEditPanelProps> = ({ entity }) => {
  const [showBones, setShowBones] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize when entity changes or loads
  useEffect(() => {
    const initializeCharacter = async () => {
      setIsLoading(true);
      
      // Wait for character to load if it's still loading
      if (entity.isLoading) {
        await entity.waitUntilReady();
      }
      
      // Show bone visualization
      entity.showBoneVisualization(true);
      setShowBones(true);
      
      setIsLoading(false);
    };
    
    initializeCharacter();
    
    // Clean up when component unmounts
    return () => {
      entity.showBoneVisualization(false);
    };
  }, [entity]);

  // Toggle bone visualization
  const toggleBoneVisualization = () => {
    const newState = !showBones;
    setShowBones(newState);
    entity.showBoneVisualization(newState);
    
  };
  
  // Reset all bones to initial pose
  const resetAllBones = () => {
    entity.resetAllBones();
  };

  if (isLoading) {
    return (
      <div className="panel-shape p-4">
        <div className="text-center py-2">
          <p>Loading character model...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-shape p-2 flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={toggleBoneVisualization}
        title={showBones ? "Hide bone controls" : "Show bone controls"}
      >
        {showBones ? <IconEyeOff size={16} /> : <IconEye size={16} />}
      </Button>
      {/* <Button
        variant="outline"
        size="sm"
        onClick={resetAllBones}
        title="Reset all bones to initial pose"
      >
        <IconRotateClockwise size={16} />
      </Button> */}
    </div>
  );
};

export default CharacterEditPanel; 
import React, { useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CharacterEntity } from '../util/entity/CharacterEntity';
import { IconRotate, IconRotateClockwise, IconRotate2, IconZoomIn, IconEye, IconEyeOff } from '@tabler/icons-react';
import { trackEvent, ANALYTICS_EVENTS } from '../util/analytics';

interface CharacterEditPanelProps {
  entity: CharacterEntity;
}

const CharacterEditPanel: React.FC<CharacterEditPanelProps> = ({ entity }) => {
  const [controlledBones, setControlledBones] = useState<string[]>([]);
  const [selectedBone, setSelectedBone] = useState<BABYLON.Bone | null>(null);
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [rotationZ, setRotationZ] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showBones, setShowBones] = useState(true);

  // Initialize when entity changes or loads
  useEffect(() => {
    const initializeCharacter = async () => {
      setIsLoading(true);
      
      // Wait for character to load if it's still loading
      if (entity.isLoading) {
        await entity.waitUntilReady();
      }
      
      // Get the controllable bones
      const boneNames = entity.getControlledBoneNames();
      setControlledBones(boneNames);
      
      // Show bone visualization
      entity.showBoneVisualization(true);
      setShowBones(true);
      
      // Select the first bone by default if there are bones
      if (boneNames.length > 0) {
        const firstBone = entity.selectBone(boneNames[0]);
        if (firstBone) {
          setSelectedBone(firstBone);
          // Initialize rotation values
          const boneRotation = firstBone.getRotation();
          setRotationX(boneRotation.x * (180 / Math.PI));
          setRotationY(boneRotation.y * (180 / Math.PI));
          setRotationZ(boneRotation.z * (180 / Math.PI));
        }
      }
      
      setIsLoading(false);
    };
    
    initializeCharacter();
    
    // Clean up when component unmounts
    return () => {
      entity.showBoneVisualization(false);
    };
  }, [entity]);

  // Update bone rotation when sliders change
  useEffect(() => {
    if (selectedBone) {
      // Convert degrees to radians
      const rotation = new BABYLON.Vector3(
        rotationX * (Math.PI / 180),
        rotationY * (Math.PI / 180),
        rotationZ * (Math.PI / 180)
      );
      
      // Create quaternion from rotation
      const quaternion = BABYLON.Quaternion.RotationYawPitchRoll(
        rotation.y,
        rotation.x,
        rotation.z
      );
      
      // Set the bone's rotation
      selectedBone.setRotationQuaternion(quaternion);
      
      // Track bone rotation analytics
      trackEvent(ANALYTICS_EVENTS.CHARACTER_EDIT, {
        action: 'rotate_bone',
        boneName: selectedBone.name
      });
    }
  }, [rotationX, rotationY, rotationZ, selectedBone]);

  // Handle bone selection
  const handleSelectBone = (boneName: string) => {
    const bone = entity.selectBone(boneName);
    if (bone) {
      setSelectedBone(bone);
      
      // Update rotation values based on selected bone
      const boneRotation = bone.getRotation();
      setRotationX(boneRotation.x * (180 / Math.PI));
      setRotationY(boneRotation.y * (180 / Math.PI));
      setRotationZ(boneRotation.z * (180 / Math.PI));
      
      // Track selection
      trackEvent(ANALYTICS_EVENTS.CHARACTER_EDIT, {
        action: 'select_bone',
        boneName: bone.name
      });
    }
  };

  // Reset bone rotation
  const handleResetRotation = () => {
    if (selectedBone) {
      // Get initial rotation
      const initialRotation = entity.initialBoneRotations.get(selectedBone.name);
      if (initialRotation) {
        selectedBone.setRotationQuaternion(initialRotation.clone());
        
        // Update slider values
        const eulerAngles = initialRotation.toEulerAngles();
        setRotationX(eulerAngles.x * (180 / Math.PI));
        setRotationY(eulerAngles.y * (180 / Math.PI));
        setRotationZ(eulerAngles.z * (180 / Math.PI));
      } else {
        // If no initial rotation stored, reset to zero
        setRotationX(0);
        setRotationY(0);
        setRotationZ(0);
      }
      
      // Track reset action
      trackEvent(ANALYTICS_EVENTS.CHARACTER_EDIT, {
        action: 'reset_bone',
        boneName: selectedBone.name
      });
    }
  };
  
  // Toggle bone visualization
  const toggleBoneVisualization = () => {
    const newState = !showBones;
    setShowBones(newState);
    entity.showBoneVisualization(newState);
  };
  
  // Reset all bones to initial pose
  const resetAllBones = () => {
    entity.resetAllBones();
    
    // If a bone is currently selected, update its sliders
    if (selectedBone) {
      const boneRotation = selectedBone.getRotation();
      setRotationX(boneRotation.x * (180 / Math.PI));
      setRotationY(boneRotation.y * (180 / Math.PI));
      setRotationZ(boneRotation.z * (180 / Math.PI));
    }
  };

  if (isLoading) {
    return (
      <div className="panel-shape p-4 min-w-[300px]">
        <div className="text-center py-6">
          <p>Loading character model...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-shape p-4 min-w-[300px]">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-medium">Character Editor</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleBoneVisualization}
            title={showBones ? "Hide bone controls" : "Show bone controls"}
          >
            {showBones ? <IconEyeOff size={16} /> : <IconEye size={16} />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetAllBones}
            title="Reset all bones to initial pose"
          >
            <IconRotateClockwise size={16} />
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="bones">
        <TabsList className="mb-4">
          <TabsTrigger value="bones">Bones</TabsTrigger>
          <TabsTrigger value="animation">Animation</TabsTrigger>
        </TabsList>
        
        <TabsContent value="bones">
          <div className="flex space-x-4">
            {/* Bone List */}
            <div className="w-1/3 max-h-[300px] overflow-y-auto pr-2">
              <h4 className="text-sm font-medium mb-2">Skeleton</h4>
              <div className="space-y-1">
                {controlledBones.map((boneName) => (
                  <Button
                    key={boneName}
                    variant={selectedBone?.name === boneName ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => handleSelectBone(boneName)}
                  >
                    {boneName}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Bone Controls */}
            <div className="w-2/3">
              {selectedBone ? (
                <>
                  <div className="flex justify-between mb-4">
                    <h4 className="text-sm font-medium">
                      Editing: {selectedBone.name}
                    </h4>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleResetRotation}
                    >
                      <IconRotateClockwise size={14} className="mr-1" />
                      Reset
                    </Button>
                  </div>
                  
                  {/* X Rotation */}
                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <label className="text-xs flex items-center">
                        <IconRotate size={14} className="mr-1" /> X Rotation
                      </label>
                      <span className="text-xs">{Math.round(rotationX)}°</span>
                    </div>
                    <Slider
                      value={[rotationX]}
                      min={-180}
                      max={180}
                      step={1}
                      onValueChange={(value) => setRotationX(value[0])}
                    />
                  </div>
                  
                  {/* Y Rotation */}
                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <label className="text-xs flex items-center">
                        <IconRotate2 size={14} className="mr-1" /> Y Rotation
                      </label>
                      <span className="text-xs">{Math.round(rotationY)}°</span>
                    </div>
                    <Slider
                      value={[rotationY]}
                      min={-180}
                      max={180}
                      step={1}
                      onValueChange={(value) => setRotationY(value[0])}
                    />
                  </div>
                  
                  {/* Z Rotation */}
                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <label className="text-xs flex items-center">
                        <IconRotate size={14} className="mr-1 transform rotate-90" /> Z Rotation
                      </label>
                      <span className="text-xs">{Math.round(rotationZ)}°</span>
                    </div>
                    <Slider
                      value={[rotationZ]}
                      min={-180}
                      max={180}
                      step={1}
                      onValueChange={(value) => setRotationZ(value[0])}
                    />
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm">Select a bone to edit</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="animation">
          <div className="text-center py-6">
            <p className="text-sm">Animation controls coming soon</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CharacterEditPanel; 
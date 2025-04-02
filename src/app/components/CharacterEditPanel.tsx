import React, { useState, useEffect } from 'react';
import * as BABYLON from '@babylonjs/core';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CharacterEntity } from '../util/entity/CharacterEntity';
import { IconRotate, IconRotateClockwise, IconRotate2, IconZoomIn } from '@tabler/icons-react';
import { trackEvent, ANALYTICS_EVENTS } from '../util/analytics';

interface CharacterEditPanelProps {
  entity: CharacterEntity;
}

const CharacterEditPanel: React.FC<CharacterEditPanelProps> = ({ entity }) => {
  const [bones, setBones] = useState<BABYLON.Bone[]>([]);
  const [selectedBone, setSelectedBone] = useState<BABYLON.Bone | null>(null);
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [rotationZ, setRotationZ] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize bones when entity changes or loads
  useEffect(() => {
    const loadBones = async () => {
      setIsLoading(true);

      // Wait for character to load if it's still loading
      if (entity.isLoading) {
        await entity.waitUntilReady();
      }

      // Get the bones
      const entityBones = entity.getBones();
      setBones(entityBones);

      // Select the first bone by default if there are bones
      if (entityBones.length > 0) {
        setSelectedBone(entityBones[0]);
        // Initialize rotation values from the first bone
        const initialRotation = entityBones[0].getRotation();
        setRotationX(initialRotation.x * (180 / Math.PI));
        setRotationY(initialRotation.y * (180 / Math.PI));
        setRotationZ(initialRotation.z * (180 / Math.PI));
      }

      setIsLoading(false);
    };

    loadBones();
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
      trackEvent(ANALYTICS_EVENTS.CHANGE_SETTINGS, {
        entityType: 'character',
        action: 'rotate_bone',
        boneName: selectedBone.name
      });
    }
  }, [rotationX, rotationY, rotationZ, selectedBone]);

  // Handle bone selection
  const handleSelectBone = (bone: BABYLON.Bone) => {
    setSelectedBone(bone);

    // Update rotation values based on selected bone
    const boneRotation = bone.getRotation();
    setRotationX(boneRotation.x * (180 / Math.PI));
    setRotationY(boneRotation.y * (180 / Math.PI));
    setRotationZ(boneRotation.z * (180 / Math.PI));
  };

  // Reset bone rotation
  const handleResetRotation = () => {
    if (selectedBone) {
      setRotationX(0);
      setRotationY(0);
      setRotationZ(0);

      // Track reset action
      trackEvent(ANALYTICS_EVENTS.CHANGE_SETTINGS, {
        entityType: 'character',
        action: 'reset_bone',
        boneName: selectedBone.name
      });
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

  <div className="panel-shape p-4 min-w-[300px]">
    <h3 className="text-lg font-medium mb-3">Character Editor</h3>
  </div>

};

export default CharacterEditPanel; 
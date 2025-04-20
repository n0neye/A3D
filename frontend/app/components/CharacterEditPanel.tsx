import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { CharacterEntity } from '@/engine/entity/types/CharacterEntity';
import { IconEye, IconEyeOff, IconLinkPlus, IconPlayerPlay, IconPlayerPause, IconChevronsDown, IconChevronsUp } from '@tabler/icons-react';
import { useEditorEngine } from '../context/EditorEngineContext';
import { BoneControl } from '../engine/entity/components/BoneControl';

const CharacterEditPanel = ({ entity }: { entity: CharacterEntity }) => {
  const { selectedSelectable, engine } = useEditorEngine();
  const [showBones, setShowBones] = useState(true);
  const [selectedBone, setSelectedBone] = useState<BoneControl | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEntityList, setShowEntityList] = useState(false);
  const [availableEntities, setAvailableEntities] = useState<any[]>([]);
  const entityListRef = useRef<HTMLDivElement>(null);

  // Animation states
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedAnimationIndex, setSelectedAnimationIndex] = useState<number | null>(null);
  const [showAnimationList, setShowAnimationList] = useState(false);
  const animationListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedSelectable && selectedSelectable instanceof BoneControl) {
      setSelectedBone(selectedSelectable);
    } else {
      setSelectedBone(null);
    }
  }, [selectedSelectable]);

  useEffect(() => {
    // Load available entities when showing the entity list
    if (showEntityList && engine) {
      const objectManager = engine.getObjectManager();
      const allEntities = objectManager.getAllVisibleEntities();
      // Filter out the character entity itself
      const filteredEntities = allEntities.filter(e => e !== entity);
      setAvailableEntities(filteredEntities);
    }
  }, [showEntityList, entity, engine]);

  useEffect(() => {
    // Handle clicks outside of the panel to close it
    const handleClickOutside = (event: MouseEvent) => {
      if (entityListRef.current && !entityListRef.current.contains(event.target as Node)) {
        setShowEntityList(false);
      }
      if (animationListRef.current && !animationListRef.current.contains(event.target as Node)) {
        setShowAnimationList(false);
      }
    };

    if (showEntityList || showAnimationList) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEntityList, showAnimationList]);

  // Initialize animation state when entity changes
  useEffect(() => {
    if (entity) {
      // Check if there are animations and set default animation
      if (entity.animations && entity.animations.length > 0) {
        setSelectedAnimationIndex(entity.animations.length - 1);
        setIsPlaying(entity.currentAnimationAction ? !entity.currentAnimationAction.paused : false);
      } else {
        setSelectedAnimationIndex(null);
        setIsPlaying(false);
      }
    }
  }, [entity]);

  const handleLinkObject = () => {
    setShowEntityList(!showEntityList);
  };

  const handleMouseLeave = () => {
    setShowEntityList(false);
  };

  const linkEntityToBone = (selectedEntity: any) => {
    if (selectedBone && engine) {
      const objectManager = engine.getObjectManager();
      objectManager.AddToBone(selectedEntity, selectedBone);
      objectManager.notifyHierarchyChanged();
      setShowEntityList(false);
    }
  };

  // Animation controls
  const toggleAnimationPlayback = () => {
    if (entity.currentAnimationAction) {
      entity.currentAnimationAction.paused = !entity.currentAnimationAction.paused;
      setIsPlaying(!entity.currentAnimationAction.paused);
    }
  };

  const selectAnimation = (index: number) => {
    if (entity.animations && entity.animations.length > index && entity.animationMixer) {
      // Stop current animation
      if (entity.currentAnimationAction) {
        entity.currentAnimationAction.stop();
      }

      // Start new animation
      const newAction = entity.animationMixer.clipAction(entity.animations[index]);
      entity.currentAnimationAction = newAction;
      newAction.play();
      newAction.paused = !isPlaying;

      setSelectedAnimationIndex(index);
      setShowAnimationList(false);
    }
  };

  const toggleAnimationList = () => {
    setShowAnimationList(!showAnimationList);
  };

  return (
    <>
      <div className="p-2 flex flex-row gap-2 justify-center items-center">
        {/* Animation Controls */}
        {entity.animations && entity.animations.length > 0 && (
          <div className="flex items-center gap-2 mb-1">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAnimationPlayback}
              className="w-10 h-8 flex justify-center items-center"
            >
              {isPlaying ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
            </Button>

            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAnimationList}
                className="text-xs flex items-center"
              >
                {selectedAnimationIndex !== null && entity.animations[selectedAnimationIndex]?.name
                  ? entity.animations[selectedAnimationIndex].name
                  : "Select Animation"}
                {showAnimationList ? <IconChevronsUp size={14} className="ml-1" /> : <IconChevronsDown size={14} className="ml-1" />}
              </Button>

              {showAnimationList && (
                <div
                  ref={animationListRef}
                  className="absolute bottom-full left-0 z-50 mt-1"
                >
                  <div className="panel-shape p-2 w-52 max-h-60 overflow-y-auto">
                    <h4 className="text-sm font-medium mb-2">Animations:</h4>
                    {entity.animations.length === 0 ? (
                      <p className="text-xs text-gray-400">No animations available</p>
                    ) : (
                      <ul className="space-y-1">
                        {entity.animations.map((animation, index) => (
                          <li
                            key={`anim-${index}`}
                            className={`text-xs p-2 rounded cursor-pointer transition-colors ${selectedAnimationIndex === index ? 'bg-slate-700' : 'hover:bg-slate-700'
                              }`}
                            onClick={() => selectAnimation(index)}
                          >
                            {animation.name || `Animation ${index + 1}`}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bone Controls */}
        {selectedBone && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLinkObject}
              title={"Attach object to bone"}
              className="text-xs flex items-center"
            >
              <IconLinkPlus size={16} className="mr-2" />
              Link Object to bone
            </Button>
          </div>
        )}
      </div>


      {showEntityList && (
        <div
          ref={entityListRef}
          className="absolute pt-2 left-0 z-50 bottom-20"
          onMouseLeave={handleMouseLeave}
        >
          <div className="panel-shape p-4 w-64 max-h-60 overflow-y-auto">
            <h4 className="text-sm font-medium mb-2">Select an object to link:</h4>
            {availableEntities.length === 0 ? (
              <p className="text-xs text-gray-400">No available objects to link</p>
            ) : (
              <ul className="space-y-1">
                {availableEntities.map((entity) => (
                  <li
                    key={entity.uuid}
                    className="text-xs p-2 hover:bg-slate-700 rounded cursor-pointer transition-colors"
                    onClick={() => linkEntityToBone(entity)}
                  >
                    {entity.name || `Entity-${entity.uuid.substring(0, 6)}`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default CharacterEditPanel; 
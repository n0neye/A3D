import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { CharacterEntity } from '@/engine/entity/types/CharacterEntity';
import { IconEye, IconEyeOff, IconLinkPlus, IconPlayerPlay, IconPlayerPause, IconChevronsDown, IconChevronsUp } from '@tabler/icons-react';
import { useEditorEngine } from '../context/EditorEngineContext';
import { BoneControl } from '../engine/entity/components/BoneControl';
import { ICharacterData, characterDatas } from '../engine/data/CharacterData';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import ColorPickerMenu from './ColorPickerMenu';

// Define common skin tones
const skinTones = [
  // White Tones
  '#F9E4D0', // Light Peach
  '#FFE0BD', // Pale Ivory
  '#FFCDA8', // Light Beige
  // Asian Tones
  '#EAC086', // Golden Beige
  '#EEC8A9', // Light Olive
  '#D8AE84', // Warm Beige
  // Brown Tones
  '#C68E71', // Medium Tan
  '#A56A51', // Sienna
  '#8D5524', // Caramel Brown
  // Black Tones
  '#693A2A', // Dark Brown
  '#5C2D1E', // Deep Brown
  '#3E1D10', // Espresso
];

const CharacterEditPanel = ({ entity }: { entity: CharacterEntity }) => {
  const { selectedSelectable, engine } = useEditorEngine();
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

  const [characterColor, setCharacterColor] = useState(entity.characterProps.color || '#ffffff');

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

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEntityList, showAnimationList]);

  // Initialize animation state when entity changes
  useEffect(() => {
    if (entity) {
      // Check if there are animations and set default animation
      if (entity.modelAnimations && entity.modelAnimations.length > 0) {
        setSelectedAnimationIndex(entity.modelAnimations.length - 1);
        setIsPlaying(entity.currentAnimationAction ? !entity.currentAnimationAction.paused : false);
      } else {
        setSelectedAnimationIndex(null);
        setIsPlaying(false);
      }
    }
  }, [entity]);

  // Update local color state if entity's color changes externally
  useEffect(() => {
    setCharacterColor(entity.characterProps.color || '#ffffff');
  }, [entity.characterProps.color]);

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

  const selectFileAnimation = (index: number) => {
    // entity.selectAnimation(index, isPlaying);
    entity.selectAnimationFile(index, isPlaying);
    setSelectedAnimationIndex(index);
    setShowAnimationList(false);
  };


  const selectModelAnimation = (index: number) => {
    entity.selectModelAnimation(index, isPlaying);
    setSelectedAnimationIndex(index);
    setShowAnimationList(false);
  };

  const toggleAnimationList = () => {
    setShowAnimationList(!showAnimationList);
  };

  // Updated function to set color from swatches or input
  const handleSetColor = (newColor: string) => {
    setCharacterColor(newColor);
    entity.setColor(newColor);
  };

  return (
    <>
      <div className="p-2 flex flex-row gap-2 items-center justify-start">
        <ColorPickerMenu color={characterColor} onColorChange={handleSetColor} colorOptions={skinTones} />

        {/* --- Animation Controls --- */}
        {entity.animationFiles.length + entity.modelAnimations.length > 0 && (
          <div className="flex items-center gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAnimationPlayback}
              className="w-10 h-8 flex justify-center items-center rounded-r-none"
            >
              {isPlaying ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
            </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAnimationList}
                className="text-xs flex items-center rounded-l-none"
              >
                {"Animation"}
                {showAnimationList ? <IconChevronsUp size={14} className="ml-1" /> : <IconChevronsDown size={14} className="ml-1" />}
              </Button>

              {showAnimationList && (
                <div
                  ref={animationListRef}
                  className="absolute bottom-full left-0 z-50 mt-1"
                >
                  <div className="panel-shape p-2 w-52 max-h-60 overflow-y-auto">
                    <ul className="space-y-1">
                      {entity.modelAnimations.map((animation, index) => (
                        <li
                          key={`model-anim-${index}`}
                          className={`text-xs p-2 rounded cursor-pointer transition-colors ${selectedAnimationIndex === index && !entity.animationFiles.length ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
                          onClick={() => selectModelAnimation(index)}
                        >
                          {animation.name || `Animation ${index + 1}`}
                        </li>
                      ))}
                      {entity.animationFiles.map((animationFile, index) => (
                        <li
                          key={`file-anim-${index}`}
                          className={`text-xs p-2 rounded cursor-pointer transition-colors ${selectedAnimationIndex === index + entity.modelAnimations.length ? 'bg-slate-700' : 'hover:bg-slate-700'}`}
                          onClick={() => selectFileAnimation(index)}
                        >
                          {animationFile.replace('.fbx', '').split('/').pop() || `File Anim ${index + 1}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
          </div>
        )}
        {/* --- End Animation Controls --- */}


        {/* Row for Bone Controls (only if a bone is selected) */}
        {/* {selectedBone && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLinkObject}
              title={"Attach object to bone"}
              className="text-xs flex items-center"
            >
              <IconLinkPlus size={16} className="mr-2" />
              Link Object to Bone
            </Button>
          </div>
        )} */}
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
                {availableEntities.map((e) => (
                  <li
                    key={e.uuid}
                    className="text-xs p-2 hover:bg-slate-700 rounded cursor-pointer transition-colors"
                    onClick={() => linkEntityToBone(e)}
                  >
                    {e.name || `Entity-${e.uuid.substring(0, 6)}`}
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
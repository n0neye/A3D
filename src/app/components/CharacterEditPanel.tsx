import React, { useState, useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { CharacterEntity } from '@/app/engine/entity/types/CharacterEntity';
import { IconEye, IconEyeOff, IconLinkPlus } from '@tabler/icons-react';
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
    };

    if (showEntityList) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEntityList]);

  const handleLinkObject = () => {
    setShowEntityList(!showEntityList);
  };

  const handleMouseLeave = () => {
    setShowEntityList(false);
  };

  const linkEntityToBone = (selectedEntity: any) => {
    if (selectedBone && engine) {
      const objectManager = engine.getObjectManager();
      objectManager.AddToParent(selectedEntity, selectedBone);
      objectManager.notifyHierarchyChanged();
      setShowEntityList(false);
    }
  };

  return (
    <>
      <div className="p-2 flex flex-col gap-2">
        {selectedBone && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLinkObject}
              title={"Attach object to bone"}
            >
              <IconLinkPlus size={16} className="mr-2" />
              Link Object to {selectedBone.bone.name.replace('mixamorig', '')}
            </Button>
          </div>
        )}
        {!selectedBone && (
          <div className="text-xs text-gray-400">
            No bone selected
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
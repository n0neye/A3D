import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { CharacterEntity } from '@/app/engine/entity/types/CharacterEntity';
import { IconEye, IconEyeOff, IconLinkPlus } from '@tabler/icons-react';
import { useEditorEngine } from '../context/EditorEngineContext';
import { BoneControl } from '../engine/entity/components/BoneControl';


const CharacterEditPanel = ({ entity }: { entity: CharacterEntity }) => {
  const { selectedSelectable } = useEditorEngine();
  const [showBones, setShowBones] = useState(true);
  const [selectedBone, setSelectedBone] = useState<BoneControl | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (selectedSelectable && selectedSelectable instanceof BoneControl) {
      setSelectedBone(selectedSelectable);
    } else {
      setSelectedBone(null);
    }
  }, [selectedSelectable]);


  return (
    <div className="p-2 flex gap-2">
      {/* <Button
        variant="outline"
        size="sm"
        onClick={toggleBoneVisualization}
        title={showBones ? "Hide bone controls" : "Show bone controls"}
      >
        {showBones ? <IconEyeOff size={16} /> : <IconEye size={16} />}
      </Button> */}
      {/* <Button
        variant="outline"
        size="sm"
        onClick={resetAllBones}
        title="Reset all bones to initial pose"
      >
        <IconRotateClockwise size={16} />
      </Button> */}
      {selectedBone && (
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {}}
            title={"Attach object to bone"}
          >
            <IconLinkPlus size={16} />
            Link Object to {selectedBone.bone.name.replace('mixamorig', '')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CharacterEditPanel; 
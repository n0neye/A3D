import React, { useEffect } from 'react';

import { useEditorEngine } from '../../context/EditorEngineContext';
import { LightEntity } from '@/app/engine/entity/types/LightEntity';
import GenerativeEntityPanel from './GenerativeEntityPanel';
import { GenerativeEntity } from '@/app/engine/entity/types/GenerativeEntity';
import LightEntityPanel from './LightEntityPanel';
import { CharacterEntity } from '@/app/engine/entity/types/CharacterEntity';
import CharacterEditPanel from '../CharacterEditPanel';

const EntityPanel: React.FC = () => {
  const { selectedEntity } = useEditorEngine();

  useEffect(() => {
    console.log('selectedEntity', selectedEntity);
  }, [selectedEntity]);

  // Show panel for both generative objects and lights
  if (!selectedEntity) return null;
  if (selectedEntity.getEntityType() !== 'light' && selectedEntity.getEntityType() !== 'generative' && selectedEntity.getEntityType() !== 'character') {
    return null;
  }

  return (
    <div
      id="entity-panel"
      className="fixed z-10 panel left-1/2 bottom-4 "
      style={{
        transform: 'translateX(-50%)', // Center horizontally
        minWidth: '150px',
      }}
    >
      {selectedEntity instanceof GenerativeEntity && <GenerativeEntityPanel entity={selectedEntity} />}
      {selectedEntity instanceof LightEntity && <LightEntityPanel entity={selectedEntity} />}                                                                        
      {selectedEntity instanceof CharacterEntity && <CharacterEditPanel entity={selectedEntity} />}
    </div>
  );
};

export default EntityPanel; 
import React, { useEffect } from 'react';

import { useEditorEngine } from '../../context/EditorEngineContext';
import { LightEntity } from '@/engine/entity/types/LightEntity';
import GenerativeEntityPanel from './GenerativeEntityPanel';
import { GenerativeEntity } from '@/engine/entity/types/GenerativeEntity';
import LightEntityPanel from './LightEntityPanel';
import { CharacterEntity } from '@/engine/entity/types/CharacterEntity';
import CharacterEditPanel from '../CharacterEditPanel';
import ShapeEntityPanel from './ShapeEntityPanel';
import { ShapeEntity } from '@/engine/entity/types/ShapeEntity';

const EntityPanel: React.FC = () => {
  const { selectedEntity } = useEditorEngine();

  console.log(`EntityPanel: selectedEntity:`, selectedEntity?.name);

  // Show panel for both generative objects and lights
  if (!selectedEntity) return null;

  if (selectedEntity.entityType == 'light' || selectedEntity.entityType == 'generative' || selectedEntity.entityType == 'character' || selectedEntity.entityType == 'shape') {
    return (
      <div
        id="entity-panel" className="fixed z-10 panel-shape p-1 left-1/2 -translate-x-1/2 bottom-4 min-w-[100px]">
        {selectedEntity instanceof GenerativeEntity && <GenerativeEntityPanel entity={selectedEntity} />}
        {selectedEntity instanceof LightEntity && <LightEntityPanel entity={selectedEntity} />}
        {selectedEntity instanceof CharacterEntity && <CharacterEditPanel entity={selectedEntity} />}
        {selectedEntity instanceof ShapeEntity && <ShapeEntityPanel entity={selectedEntity} />}
      </div>
    );
  }

  return null;
};

export default EntityPanel; 
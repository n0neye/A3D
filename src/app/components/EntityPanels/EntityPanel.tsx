import React, { useEffect, useState, useRef, useCallback } from 'react';

import { useEditorContext } from '../../context/EditorContext';
import { LightEntity } from '../../util/extensions/LightEntity';
import GenerativeEntityPanel from './GenerativeEntityPanel';
import { GenerativeEntity } from '@/app/util/extensions/GenerativeEntity';
import LightEntityPanel from './LightEntityPanel';


const EntityPanel: React.FC = () => {
  const {  selectedEntity } = useEditorContext();

  // Show panel for both generative objects and lights
  if (!selectedEntity) return null;
  if (selectedEntity.getEntityType() !== 'light' && selectedEntity.getEntityType() !== 'generative') {
    return null;
  }

  return (
    <div
      className="fixed z-10 panel left-1/2 bottom-4 "
      style={{
        transform: 'translateX(-50%)', // Center horizontally
        minWidth: '150px',
      }}
    >
      {
        selectedEntity instanceof GenerativeEntity && <GenerativeEntityPanel entity={selectedEntity} />
      }
      {
        selectedEntity instanceof LightEntity && <LightEntityPanel entity={selectedEntity} />
      }
    </div>
  );
};

export default EntityPanel; 
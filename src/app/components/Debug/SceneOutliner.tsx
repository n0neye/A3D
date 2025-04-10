import React, { useEffect, useState } from 'react';
import { useEditorEngine } from '@/app/context/EditorEngineContext';
import { EntityBase } from '@/app/engine/entity/base/EntityBase';
import { Folder, ChevronDown, ChevronRight, Box, Lightbulb, User, Shapes } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";

const EntityIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'shape':
      return <Box className="h-4 w-4 mr-2" />;
    case 'light':
      return <Lightbulb className="h-4 w-4 mr-2" />;
    case 'character':
      return <User className="h-4 w-4 mr-2" />;
    case 'generative':
      return <Shapes className="h-4 w-4 mr-2" />;
    default:
      return <Box className="h-4 w-4 mr-2" />;
  }
};

interface TreeNodeProps {
  entity: EntityBase;
  level: number;
  selectedEntity: EntityBase | null;
  onSelectEntity: (entity: EntityBase) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ 
  entity, 
  level, 
  selectedEntity, 
  onSelectEntity 
}) => {
  const { engine } = useEditorEngine();
  const [expanded, setExpanded] = useState(false);
  const [childEntities, setChildEntities] = useState<EntityBase[]>([]);
  const isSelected = selectedEntity?.getUUId() === entity.getUUId();
  
  useEffect(() => {
    if (expanded) {
      const children = engine.getObjectManager().getChildEntities(entity);
      setChildEntities(children);
    }
  }, [expanded, entity, engine]);

  const hasChildren = engine.getObjectManager().hasChildEntities(entity);

  return (
    <div className="select-none">
      <div 
        className={`flex items-center py-1 px-1 ${isSelected ? 'bg-primary/20 rounded' : 'hover:bg-gray-100 dark:hover:bg-gray-800 rounded'}`}
        style={{ paddingLeft: `${level * 12}px` }}
        onClick={() => onSelectEntity(entity)}
      >
        <div className="flex items-center mr-1" onClick={(e) => { 
          e.stopPropagation();
          setExpanded(!expanded);
        }}>
          {hasChildren ? (
            expanded ? 
              <ChevronDown className="h-4 w-4" /> : 
              <ChevronRight className="h-4 w-4" />
          ) : (
            <div className="w-4"></div>
          )}
        </div>
        <EntityIcon type={entity.entityType} />
        <span className="text-sm truncate">{entity.name}</span>
      </div>
      
      {expanded && childEntities.length > 0 && (
        <div>
          {childEntities.map((child) => (
            <TreeNode 
              key={child.getUUId()} 
              entity={child} 
              level={level + 1} 
              selectedEntity={selectedEntity}
              onSelectEntity={onSelectEntity}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const SceneOutliner: React.FC = () => {
  const { engine, selectedEntity } = useEditorEngine();
  const [rootEntities, setRootEntities] = useState<EntityBase[]>([]);

  useEffect(() => {
    if (!engine) return;

    // Initial load of root entities
    setRootEntities(engine.getObjectManager().getRootEntities());

    // Subscribe to hierarchy changes
    const unsubHierarchyChanged = engine.getObjectManager().observer.subscribe(
      'hierarchyChanged', 
      () => {
        setRootEntities(engine.getObjectManager().getRootEntities());
      }
    );

    // Subscribe to entity added/removed events
    const unsubEntityAdded = engine.getObjectManager().observer.subscribe(
      'entityAdded',
      () => {
        setRootEntities(engine.getObjectManager().getRootEntities());
      }
    );

    const unsubEntityRemoved = engine.getObjectManager().observer.subscribe(
      'entityRemoved',
      () => {
        setRootEntities(engine.getObjectManager().getRootEntities());
      }
    );

    return () => {
      unsubHierarchyChanged();
      unsubEntityAdded();
      unsubEntityRemoved();
    };
  }, [engine]);

  const handleSelectEntity = (entity: EntityBase) => {
    engine.selectEntity(entity);
  };

  return (
    <div className="w-full h-full">
      <div className="font-medium mb-2">Scene Hierarchy</div>
      <ScrollArea className="h-[calc(100%-2rem)] pr-4">
        {rootEntities.map((entity) => (
          <TreeNode 
            key={entity.getUUId()} 
            entity={entity} 
            level={0} 
            selectedEntity={selectedEntity}
            onSelectEntity={handleSelectEntity}
          />
        ))}
      </ScrollArea>
    </div>
  );
};

export default SceneOutliner; 
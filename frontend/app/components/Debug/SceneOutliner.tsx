import React, { useEffect, useState } from 'react';
import { useEditorEngine } from '@/context/EditorEngineContext';
import { EntityBase } from '@/engine/entity/base/EntityBase';
import { Folder, ChevronDown, ChevronRight, Box, Lightbulb, User, Shapes, EyeOff, Trash } from 'lucide-react';
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
  isDeleted?: boolean;
}

const TreeNode: React.FC<TreeNodeProps> = ({ 
  entity, 
  level, 
  selectedEntity, 
  onSelectEntity,
  isDeleted = false
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
  const isVisible = entity.visible;
  
  // Determine styles based on entity state
  const getEntityNameClass = () => {
    const baseClass = "text-sm truncate";
    
    if (isDeleted) {
      return `${baseClass} text-gray-400 line-through`;
    }
    
    if (!isVisible) {
      return `${baseClass} text-gray-400`;
    }
    
    return baseClass;
  };

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
        <span className={getEntityNameClass()}>{entity.name}</span>
        
        {/* Status indicators */}
        <div className="ml-auto flex items-center">
          {!isVisible && !isDeleted && (
            <EyeOff className="h-3 w-3 text-gray-400 ml-1" />
          )}
          {isDeleted && (
            <Trash className="h-3 w-3 text-gray-400 ml-1" />
          )}
        </div>
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
              isDeleted={engine.getObjectManager().isEntityDeleted(child)}
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
  const [deletedRootEntities, setDeletedRootEntities] = useState<EntityBase[]>([]);

  useEffect(() => {
    if (!engine) return;

    const updateEntities = () => {
      setRootEntities(engine.getObjectManager().getRootEntities());
      setDeletedRootEntities(engine.getObjectManager().getDeletedRootEntities());
    };

    // Initial load of entities
    updateEntities();

    // Subscribe to entity events
    const unsubHierarchyChanged = engine.getObjectManager().observer.subscribe('hierarchyChanged', updateEntities);
    const unsubEntityAdded = engine.getObjectManager().observer.subscribe('entityAdded', updateEntities);
    const unsubEntityRemoved = engine.getObjectManager().observer.subscribe('entityRemoved', updateEntities);
    const unsubEntityDeletedStateChanged = engine.getObjectManager().observer.subscribe('entityDeletedStateChanged', updateEntities);
    const unsubEntityVisibilityChanged = engine.getObjectManager().observer.subscribe('entityVisibilityChanged', updateEntities);

    return () => {
      unsubHierarchyChanged();
      unsubEntityAdded();
      unsubEntityRemoved();
      unsubEntityDeletedStateChanged();
      unsubEntityVisibilityChanged();
    };
  }, [engine]);

  const handleSelectEntity = (entity: EntityBase) => {
    engine.selectEntity(entity);
  };

  return (
    <div className="w-full h-full">
      <div className="font-medium mb-2">Scene Hierarchy</div>
      <ScrollArea className="h-[calc(100%-2rem)] pr-4">
        {/* Active entities */}
        {rootEntities.map((entity) => (
          <TreeNode 
            key={entity.getUUId()} 
            entity={entity} 
            level={0} 
            selectedEntity={selectedEntity}
            onSelectEntity={handleSelectEntity}
          />
        ))}
        
        {/* Deleted entities */}
        {deletedRootEntities.length > 0 && (
          <div className="mt-4 pt-2 border-t border-gray-200 dark:border-gray-800">
            <div className="text-xs text-gray-500 mb-1">Deleted Items</div>
            {deletedRootEntities.map((entity) => (
              <TreeNode 
                key={entity.getUUId()} 
                entity={entity} 
                level={0} 
                selectedEntity={selectedEntity}
                onSelectEntity={handleSelectEntity}
                isDeleted={true}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default SceneOutliner; 
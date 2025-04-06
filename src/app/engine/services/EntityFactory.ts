import * as BABYLON from '@babylonjs/core';
import { EntityBase, EntityType } from '@/app/engine/entity/EntityBase';
import { GenerativeEntity, GenerativeEntityProps, SerializedGenerativeEntityData } from '@/app/engine/entity/GenerativeEntity';
import { SerializedShapeEntityData, ShapeEntity, ShapeEntityProps } from '@/app/engine/entity/ShapeEntity';
import { LightEntity, LightProps, SerializedLightEntityData } from '@/app/engine/entity/LightEntity';
import { CharacterEntity, CharacterEntityProps, SerializedCharacterEntityData } from '@/app/engine/entity/CharacterEntity'
import { v4 as uuidv4 } from 'uuid';
import { CreateEntityAsyncCommand } from '@/app/lib/commands';
import { EditorEngine } from '../EditorEngine';
import { DeleteMeshCommand } from '@/app/lib/commands';

// Base properties common to all entities
interface BaseEntityOptions {
  name?: string;
  id?: string;
  position?: BABYLON.Vector3;
  rotation?: BABYLON.Vector3;
  scaling?: BABYLON.Vector3;
  onLoaded?: (entity: EntityBase) => void;
}

// Type-specific options using discriminated union
export type CreateEntityOptions =
  | (BaseEntityOptions & { type: 'generative', gnerativeProps: GenerativeEntityProps })
  | (BaseEntityOptions & { type: 'shape', shapeProps: ShapeEntityProps })
  | (BaseEntityOptions & { type: 'light', lightProps: LightProps, rotation?: BABYLON.Vector3 })
  | (BaseEntityOptions & { type: 'character', characterProps: CharacterEntityProps });

/**
 * Factory class for creating entities
 */
export class EntityFactory {
  /**
   * Create an entity based on type
   */
  static createEntityDefault(scene: BABYLON.Scene, type: EntityType, onLoaded?: (entity: EntityBase) => void): EntityBase {
    const name = `entity-${Date.now()}`;
    const id = uuidv4();

    switch (type) {
      case 'generative':
        return new GenerativeEntity(name, scene, { id, onLoaded });
      case 'shape':
        return new ShapeEntity(name, scene, {
          id,
          props: { shapeType: 'cube' },
          onLoaded
        });
      case 'light':
        return new LightEntity(name, scene, { id, onLoaded });
      case 'character':
        return new CharacterEntity(scene, name, id, {
          url: '/characters/mannequin_man_idle/mannequin_man_idle_opt.glb',
        }, {
          onLoaded
        });
      default:
        throw new Error(`Unknown entity type`);
    }
  }

  static createEntity(scene: BABYLON.Scene, options: CreateEntityOptions): EntityBase {
    const name = options.name || `entity-${Date.now()}`;
    switch (options.type) {
      case 'generative':
        return new GenerativeEntity(name, scene, options);
      case 'shape':
        console.log(`Creating shape entity`, options.shapeProps);
        return new ShapeEntity(name, scene, {
          id: options.id,
          position: options.position,
          rotation: options.rotation,
          props: options.shapeProps,
          onLoaded: options.onLoaded
        });
      case 'light':
        return new LightEntity(name, scene, options);
      case 'character':
        return new CharacterEntity(
          scene, name,
          options.id || uuidv4(),
          options.characterProps,
          {
            scaling: options.scaling,
            onLoaded: options.onLoaded
          }
        );
      default:
        // This ensures exhaustive type checking
        const exhaustiveCheck: never = options;
        throw new Error(`Unknown entity type: ${exhaustiveCheck}`);
    }
  }

  static async duplicateEntity(entity: EntityBase, engine: EditorEngine): Promise<EntityBase | null> {
    const scene = engine.getScene();
    const historyManager = engine.getHistoryManager();

    const duplicateCommand = new CreateEntityAsyncCommand(
      async () => {
        console.log("Creating duplicate entity", entity.getEntityType(), entity.metadata?.aiData?.aiObjectType);
        // const duplicate = await duplicateEntity(entity, scene);


        const serializedEntityData = entity.serialize();

        let newEntity: EntityBase | null = null;
        if (serializedEntityData.entityType === 'generative') {
          newEntity = await GenerativeEntity.deserialize(scene, serializedEntityData as SerializedGenerativeEntityData);
        } else if (serializedEntityData.entityType === 'shape') {
          newEntity = await ShapeEntity.deserialize(scene, serializedEntityData as SerializedShapeEntityData);
        } else if (serializedEntityData.entityType === 'light') {
          newEntity = await LightEntity.deserialize(scene, serializedEntityData as SerializedLightEntityData);
        } else if (serializedEntityData.entityType === 'character') {
          newEntity = await CharacterEntity.deserialize(scene, serializedEntityData as SerializedCharacterEntityData);
        } else {
          throw new Error(`Unknown entity type: ${serializedEntityData.entityType}`);
        }

        newEntity.position.x += 0.2;
        engine.selectEntity(newEntity);
        return newEntity;
      },
      scene
    );
    historyManager.executeCommand(duplicateCommand);
    const newEntity = duplicateCommand.getEntity();
    console.log("New entity", newEntity);
    return newEntity;
  }

  static deleteEntity(entity: EntityBase, engine: EditorEngine): void {
    const deleteCommand = new DeleteMeshCommand(entity, engine.getGizmoModeManager());
    engine.getHistoryManager().executeCommand(deleteCommand);
  }

  /**
   * Deserialize an entity from serialized data
   */
  static deserializeEntity(
    scene: BABYLON.Scene,
    data: any
  ): Promise<EntityBase> {
    // Implementation for deserialization
    return Promise.resolve(new EntityBase('temp', scene, 'shape'));
  }
} 
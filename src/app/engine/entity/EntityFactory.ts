import * as THREE from 'three';
import { EntityBase, EntityType } from '@/app/engine/entity/base/EntityBase';
import { GenerativeEntity, GenerativeEntityProps, SerializedGenerativeEntityData } from '@/app/engine/entity/types/GenerativeEntity';
import { SerializedShapeEntityData, ShapeEntity, ShapeEntityProps } from '@/app/engine/entity/types/ShapeEntity';
import { LightEntity, LightProps, SerializedLightEntityData } from '@/app/engine/entity/types/LightEntity';
import { CharacterEntity, CharacterEntityProps, SerializedCharacterEntityData } from '@/app/engine/entity/types/CharacterEntity'
import { v4 as uuidv4 } from 'uuid';
import { CreateEntityAsyncCommand } from '@/app/lib/commands';
import { EditorEngine } from '../core/EditorEngine';
import { DeleteEntityCommand } from '@/app/lib/commands';

// Base properties common to all entities
interface BaseEntityOptions {
  name?: string;
  id?: string;
  position?: THREE.Vector3;
  rotation?: THREE.Euler;
  scaling?: THREE.Vector3;
  onLoaded?: (entity: EntityBase) => void;
}

// Type-specific options using discriminated union
export type CreateEntityOptions =
  | (BaseEntityOptions & { type: 'generative', generativeProps: GenerativeEntityProps })
  | (BaseEntityOptions & { type: 'shape', shapeProps: ShapeEntityProps })
  | (BaseEntityOptions & { type: 'light', lightProps: LightProps, rotation?: THREE.Euler })
  | (BaseEntityOptions & { type: 'character', characterProps: CharacterEntityProps });

/**
 * Factory class for creating entities
 */
export class EntityFactory {
  /**
   * Create an entity based on type
   */
  static createEntityDefault(scene: THREE.Scene, type: EntityType, onLoaded?: (entity: EntityBase) => void): EntityBase {
    const name = `${type}`;
    const newUuid = uuidv4();

    switch (type) {
      case 'generative':
        return new GenerativeEntity(name, scene, {
          uuid: newUuid,
          entityType: 'generative',
          created: new Date().toISOString(),
          name: name,
          props: {
            generationLogs: [],
            currentGenerationId: undefined,
            currentGenerationIdx: undefined,
          }
        }, onLoaded);
      case 'shape':
        return new ShapeEntity(name, scene, {
          uuid: newUuid,
          entityType: 'shape',
          created: new Date().toISOString(),
          name: name,

          props: { shapeType: 'cube' },
        },
          onLoaded
        );
      case 'light':
        return new LightEntity(name, scene, {
          uuid: newUuid,
          entityType: 'light',
          created: new Date().toISOString(),
          name: name,
          props: { color: { r: 1, g: 1, b: 1 }, intensity: 1, shadowEnabled: false },
        }, onLoaded);
      case 'character':
        return new CharacterEntity(
          scene,
          name,
          {
            uuid: newUuid,
            entityType: 'character',
            created: new Date().toISOString(),
            name: name,
            characterProps: {
              url: '/characters/mannequin_man_idle/mannequin_man_idle_opt.glb',
            },
          },
          onLoaded
        );
      default:
        throw new Error(`Unknown entity type`);
    }
  }

  static createEntity(scene: THREE.Scene, options: CreateEntityOptions): EntityBase {
    const newUuid = uuidv4();
    const name = options.name || options.type;
    switch (options.type) {
      case 'generative':
        return new GenerativeEntity(
          options.name || options.type,
          scene,
          {
            uuid: newUuid,
            entityType: 'generative',
            name: name,
            props: options.generativeProps,
          },
          options.onLoaded
        );
      case 'shape':
        console.log(`Creating shape entity`, options.shapeProps);
        return new ShapeEntity(
          options.name || options.shapeProps.shapeType,
          scene,
          {
            uuid: newUuid,
            entityType: 'shape',
            name: options.name || options.shapeProps.shapeType,
            props: options.shapeProps,
          },
          options.onLoaded
        );
      case 'light':
        return new LightEntity(options.name || options.type, scene, {
          uuid: newUuid,
          entityType: 'light',
          name: options.name || "light",
          props: options.lightProps,
        },
          options.onLoaded
        );
      case 'character':
        return new CharacterEntity(
          scene,
          options.name || options.characterProps.name || options.type,
          {
            uuid: newUuid,
            entityType: 'character',
            name: options.name || options.characterProps.name || options.type,
            characterProps: options.characterProps,
            scaling: options.scaling,
          },
          options.onLoaded
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
        console.log("Creating duplicate entity", entity.getEntityType(), entity.userData?.aiData?.aiObjectType);
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
    const deleteCommand = new DeleteEntityCommand(entity);
    engine.getHistoryManager().executeCommand(deleteCommand);
  }
} 
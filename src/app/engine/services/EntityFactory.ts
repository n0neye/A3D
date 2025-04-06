import * as THREE from 'three';
import { EntityBase, EntityType } from '@/app/engine/entity/EntityBase';
import { GenerativeEntity, GenerativeEntityProps, SerializedGenerativeEntityData } from '@/app/engine/entity/GenerativeEntity';
import { SerializedShapeEntityData, ShapeEntity, ShapeEntityProps } from '@/app/engine/entity/ShapeEntity';
import { LightEntity, LightProps, SerializedLightEntityData } from '@/app/engine/entity/LightEntity';
import { CharacterEntity, CharacterEntityProps, SerializedCharacterEntityData } from '@/app/engine/entity/CharacterEntity'
import { v4 as uuidv4 } from 'uuid';
import { CreateEntityAsyncCommand } from '@/app/lib/commands';
import { EditorEngine } from '../EditorEngine';
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
  | (BaseEntityOptions & { type: 'generative', gnerativeProps: GenerativeEntityProps })
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
    const name = `entity-${Date.now()}`;
    const id = uuidv4();

    switch (type) {
      case 'generative':
        return new GenerativeEntity(name, scene, { uuid: id, onLoaded });
      case 'shape':
        return new ShapeEntity(name, scene, {
          uuid: id,
          props: { shapeType: 'cube' },
          onLoaded
        });
      case 'light':
        return new LightEntity(name, scene, { uuid: id, onLoaded });
      case 'character':
        return new CharacterEntity(
          scene, 
          name, 
          id, 
          {
            url: '/characters/mannequin_man_idle/mannequin_man_idle_opt.glb',
          }, 
          {
            onLoaded
          }
        );
      default:
        throw new Error(`Unknown entity type`);
    }
  }

  static createEntity(scene: THREE.Scene, options: CreateEntityOptions): EntityBase {
    const name = options.name || `entity-${Date.now()}`;
    switch (options.type) {
      case 'generative':
        return new GenerativeEntity(name, scene, options);
      case 'shape':
        console.log(`Creating shape entity`, options.shapeProps);
        return new ShapeEntity(name, scene, {
          uuid: options.id,
          position: options.position,
          rotation: options.rotation,
          props: options.shapeProps,
          onLoaded: options.onLoaded
        });
      case 'light':
        return new LightEntity(name, scene, options);
      case 'character':
        return new CharacterEntity(
          scene, 
          name,
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
    const deleteCommand = new DeleteEntityCommand(entity, engine.getTransformControlManager());
    engine.getHistoryManager().executeCommand(deleteCommand);
  }

  /**
   * Deserialize an entity from serialized data
   */
  static deserializeEntity(
    scene: THREE.Scene,
    data: any
  ): Promise<EntityBase> {
    // Implementation for deserialization
    return Promise.resolve(new EntityBase('temp', scene, 'shape'));
  }
} 
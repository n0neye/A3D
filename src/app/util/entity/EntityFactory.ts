import * as BABYLON from '@babylonjs/core';
import { EntityBase, EntityType } from './EntityBase';
import { GenerativeEntity, GenerativeEntityProps } from './GenerativeEntity';
import { ShapeEntity, ShapeEntityProps } from './ShapeEntity';
import { LightEntity, LightProps } from './LightEntity';
import { CharacterEntity, CharacterEntityProps } from './CharacterEntity'
import { v4 as uuidv4 } from 'uuid';

// Base properties common to all entities
interface BaseEntityOptions {
  name?: string;
  id?: string;
  position?: BABYLON.Vector3;
  rotation?: BABYLON.Vector3;
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
  static createEntityDefault(scene: BABYLON.Scene, type: EntityType): EntityBase {
    const name = `entity-${Date.now()}`;
    const id = uuidv4();

    switch (type) {
      case 'generative':
        return new GenerativeEntity(name, scene, { id });
      case 'shape':
        return new ShapeEntity(name, scene, {
          id,
          props: { shapeType: 'cube' }
        });
      case 'light':
        return new LightEntity(name, scene, { id });
      case 'character':
        return new CharacterEntity(scene, name, id, {
          url: '/characters/mannequin_man_idle/mannequin_man_idle_opt.glb'
        });
      default:
        throw new Error(`Unknown entity type`);
    }
  }
  
  static createEntity(scene: BABYLON.Scene, options: CreateEntityOptions): EntityBase {
    const name = options.name || `entity-${Date.now()}`;
    switch (options.type) {
      case 'generative':
        return new GenerativeEntity(name, scene, {
          id: options.id,
          position: options.position,
          rotation: options.rotation,
          props: options.gnerativeProps
        });
      case 'shape':
        console.log(`Creating shape entity`, options.shapeProps);
        return new ShapeEntity(name, scene, {
          id: options.id,
          position: options.position,
          rotation: options.rotation,
          props: options.shapeProps
        });
      case 'light':
        return new LightEntity(name, scene, {
          id: options.id,
          position: options.position,
          props: options.lightProps
        });
      case 'character':
        return new CharacterEntity(scene, name, options.id || uuidv4(), options.characterProps);
      default:
        // This ensures exhaustive type checking
        const exhaustiveCheck: never = options;
        throw new Error(`Unknown entity type: ${exhaustiveCheck}`);
    }
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
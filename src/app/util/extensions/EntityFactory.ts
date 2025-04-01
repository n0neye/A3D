import * as BABYLON from '@babylonjs/core';
import { EntityBase, EntityType } from './EntityBase';
import { GenerativeEntity, GenerativeEntityProps } from './GenerativeEntity';
import { ShapeEntity, ShapeEntityProps } from './ShapeEntity';
import { LightEntity, LightProps } from './LightEntity';

/**
 * Factory class for creating entities
 */
export class EntityFactory {
  /**
   * Create an entity based on type
   */
  static createEntity(
    scene: BABYLON.Scene,
    entityType: EntityType,
    options: {
      name?: string;
      id?: string;
      position?: BABYLON.Vector3;
      rotation?: BABYLON.Vector3;

      // Generative entity
      generativeProps?: GenerativeEntityProps;

      // Shape entity
      shapeProps?: ShapeEntityProps;

      // Light entity
      lightProps?: LightProps;
    } = {}
  ): EntityBase {
    const name = options.name || `entity-${Date.now()}`;

    switch (entityType) {
      case 'generative':
        if (!options.generativeProps) throw new Error('generativeProps is required for generative entities');
        return new GenerativeEntity(name, scene, {
          id: options.id,
          position: options.position,
          rotation: options.rotation,
          props: options.generativeProps
        });

      case 'shape':
        if (!options.shapeProps) throw new Error('shapeProps is required for shape entities');
        return new ShapeEntity(name, scene, {
          id: options.id,
          position: options.position,
          rotation: options.rotation,
          props: options.shapeProps
        });

      case 'light':
        if (!options.lightProps) throw new Error('lightProps is required for light entities');
        return new LightEntity(name, scene, {
          id: options.id,
          position: options.position,
          props: options.lightProps
        });

      default:
        throw new Error(`Unknown entity type: ${entityType}`);
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
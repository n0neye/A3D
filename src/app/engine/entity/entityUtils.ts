import * as BABYLON from '@babylonjs/core';
import { EntityBase } from './EntityBase';
import { GenerativeEntity, GenerativeEntityProps, SerializedGenerativeEntityData } from './GenerativeEntity';
import { SerializedShapeEntityData, ShapeEntity, ShapeEntityProps } from './ShapeEntity';
import { LightEntity, LightProps, SerializedLightEntityData } from './LightEntity';
import { EntityFactory } from '../services/EntityFactory';
import { v4 as uuidv4 } from 'uuid';
import { CharacterEntity, SerializedCharacterEntityData } from './CharacterEntity';

/**
 * Duplicate an entity
 * Creates a new entity with the same properties as the original
 */
export async function duplicateEntity(entity: EntityBase, scene: BABYLON.Scene): Promise<EntityBase> {

  const serializedEntityData = entity.serialize();
  let newEntity: EntityBase | null = null;
  if(entity instanceof GenerativeEntity) {
    newEntity = await GenerativeEntity.deserialize(scene, serializedEntityData as SerializedGenerativeEntityData);
  } else if(entity instanceof ShapeEntity) {
    newEntity = await ShapeEntity.deserialize(scene, serializedEntityData as SerializedShapeEntityData);
  } else if(entity instanceof LightEntity) {
    newEntity = await LightEntity.deserialize(scene, serializedEntityData as SerializedLightEntityData);
  } else if(entity instanceof CharacterEntity) {
    newEntity = await CharacterEntity.deserialize(scene, serializedEntityData as SerializedCharacterEntityData);
  } else {
    newEntity = await EntityBase.deserialize(scene, serializedEntityData);
  }

  if(!newEntity) {
    throw new Error('Failed to duplicate entity');
  }

  return newEntity;
} 
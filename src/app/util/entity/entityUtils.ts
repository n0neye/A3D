import * as BABYLON from '@babylonjs/core';
import { EntityBase } from './EntityBase';
import { GenerativeEntity, GenerativeEntityProps, SerializedGenerativeEntityData } from './GenerativeEntity';
import { SerializedShapeEntityData, ShapeEntity, ShapeEntityProps } from './ShapeEntity';
import { LightEntity, LightProps, SerializedLightEntityData } from './LightEntity';
import { EntityFactory } from './EntityFactory';
import { v4 as uuidv4 } from 'uuid';
import { CharacterEntity, SerializedCharacterEntityData } from './CharacterEntity';

/**
 * Check if a node is an entity
 */
export function isEntity(node: BABYLON.Node | null): node is EntityBase {
  return node instanceof EntityBase;
}

/**
 * Check if an entity is a generative entity
 */
export function isGenerativeEntity(entity: EntityBase): entity is GenerativeEntity {
  return entity instanceof GenerativeEntity;
}

/**
 * Check if an entity is a shape entity
 */
export function isShapeEntity(entity: EntityBase): entity is ShapeEntity {
  return entity instanceof ShapeEntity;
}

/**
 * Check if an entity is a light entity
 */
export function isLightEntity(entity: EntityBase): entity is LightEntity {
  return entity instanceof LightEntity;
}

/**
 * Check if an entity is a character entity
 */
export function isCharacterEntity(entity: EntityBase): entity is CharacterEntity {
  return entity instanceof CharacterEntity;
}

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
  // // Generate a new unique ID for the duplicate
  // const newId = uuidv4();
  
  // // Create a new name based on the original
  // const newName = `${entity.name}-copy`;
  
  // // Get the position of the original entity
  // const position = entity.position.clone();
  
  // // Get the rotation of the original entity
  // const rotation = entity.rotation.clone();
  
  // // Get the scaling of the original entity (will be applied to meshes)
  // const scaling = entity.scaling.clone();
  
  // // Create a new entity based on the type of the original
  // let newEntity: EntityBase;
  
  // if (isGenerativeEntity(entity)) {
  //   // Deep clone the props for the new generative entity
  //   const props: GenerativeEntityProps = {
  //     generationLogs: [...entity.props.generationLogs],
  //     currentGenerationId: entity.props.currentGenerationId || 0
  //   };
    
  //   // Create the new generative entity
  //   newEntity = EntityFactory.createEntity(scene, 'generative', {
  //     id: newId,
  //     name: newName,
  //     position,
  //     rotation,
  //     generativeProps: props
  //   });

  //   // TODO: download the model if needed
    
  //   // Copy additional generative entity properties
  //   const generativeEntity = newEntity as GenerativeEntity;
  //   generativeEntity.status = entity.status;
    
  //   // Clone texture materials if applicable
  //   if (entity.placeholderMesh && entity.placeholderMesh.material) {
  //     const material = entity.placeholderMesh.material.clone(`${newName}-material`);
  //     generativeEntity.placeholderMesh.material = material;
  //   }
    
  //   // If there's a model mesh, try to clone it
  //   if (entity.modelMesh) {
  //     // This is complex and might require special handling
  //     // For now, we'll leave it to be recreated from the generation logs
  //     console.log("Model mesh cloning is complex - it will be recreated from logs if needed");
  //   }
  // } 
  // else if (isShapeEntity(entity)) {
  //   // Clone the shape entity props
  //   const props: ShapeEntityProps = {
  //     shapeType: entity.props.shapeType
  //   };
    
  //   // Create the new shape entity
  //   newEntity = EntityFactory.createEntity(scene, 'shape', {
  //     id: newId,
  //     name: newName,
  //     position,
  //     rotation,
  //     shapeProps: props
  //   });
    
  // } 
  // else if (isLightEntity(entity)) {
  //   // Clone the light entity props
  //   const props: LightProps = {
  //     color: { ...entity.props.color },
  //     intensity: entity.props.intensity,
  //     shadowEnabled: entity.props.shadowEnabled
  //   };
    
  //   // Create the new light entity
  //   newEntity = EntityFactory.createEntity(scene, 'light', {
  //     id: newId,
  //     name: newName,
  //     position,
  //     rotation,
  //     lightProps: props
  //   });
  // } 
  // else {
  //   // Generic entity duplication (base case)
  //   newEntity = new EntityBase(newName, scene, entity.entityType, {
  //     id: newId,
  //     position,
  //     rotation,
  //     scaling
  //   });
  // }
  // return newEntity;
} 
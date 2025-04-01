import * as BABYLON from '@babylonjs/core';
import { EntityBase } from './EntityBase';
import { GenerativeEntity } from './GenerativeEntity';
import { ShapeEntity } from './ShapeEntity';
import { LightEntity } from './LightEntity';

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
 * Duplicate an entity
 */
export function duplicateEntity(entity: EntityBase, scene: BABYLON.Scene): EntityBase | null {
  // Implementation for entity duplication
  return null;
} 
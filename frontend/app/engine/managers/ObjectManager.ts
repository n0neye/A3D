import * as THREE from 'three';
import { EntityBase, EntityType, isEntity } from '../entity/base/EntityBase';
import { Observer } from '../utils/Observer';
import { EditorEngine } from '../core/EditorEngine';
import { BoneControl } from '../entity/components/BoneControl';
import { Selectable } from '../entity/base/Selectable';
import { CharacterEntity } from '../entity/types/CharacterEntity';

export interface ObjectManagerEvents {
  entityAdded: { entity: EntityBase };
  entityRemoved: { entity: EntityBase };
  entityUpdated: { entity: EntityBase };
  entityVisibilityChanged: { entity: EntityBase, visible: boolean };
  entityDeletedStateChanged: { entity: EntityBase, isDeleted: boolean };
  hierarchyChanged: {};
  gizmosVisibilityChanged: { visible: boolean };
}

/**
 * ObjectManager
 * 
 * Manages all entities and selectable objects in the scene
 * - Provides methods to query and filter objects
 * - Maintains a registry of all entities
 * - Tracks parent-child relationships
 * - Emits events when objects are added/removed/updated
 */
export class ObjectManager {
  private engine: EditorEngine;
  private scene: THREE.Scene;

  // Collections
  private entities: Map<string, EntityBase> = new Map();
  private entitiesByType: Map<EntityType, Set<string>> = new Map();
  private deletedEntities: Set<string> = new Set();
  private characterEntities: CharacterEntity[] = [];

  private showGizmos: boolean = true;

  // Observable pattern for UI updates
  public observer = new Observer<ObjectManagerEvents>();

  constructor(engine: EditorEngine) {
    this.engine = engine;
    this.scene = engine.getScene();

    // Initialize entity type collections
    this.initEntityTypeCollections();

    // Scan the scene for existing entities
    this.scanScene();
  }

  private initEntityTypeCollections(): void {
    // Initialize collections for each entity type
    const entityTypes: EntityType[] = ['generative', 'shape', 'light', 'character'];
    entityTypes.forEach(type => {
      this.entitiesByType.set(type, new Set<string>());
    });
  }

  /**
   * Scan the scene to find and register all existing entities
   */
  public scanScene(): void {
    this.entities.clear();
    this.deletedEntities.clear();

    // Reset type collections
    this.entitiesByType.forEach(set => set.clear());

    // Traverse scene and register all entities
    this.scene.traverse(node => {
      if (isEntity(node)) {
        this.registerEntity(node);

        // Track deleted state
        if (node.isDeleted) {
          this.deletedEntities.add(node.uuid);
        }
      }
    });

    // Notify that hierarchy might have changed after scan
    this.observer.notify('hierarchyChanged', {});
  }

  /**
   * Register a new entity with the manager
   */
  public registerEntity(entity: EntityBase): void {
    if (this.entities.has(entity.uuid)) {
      return; // Already registered
    }

    if (entity.entityType === 'character') {
      this.characterEntities.push(entity as CharacterEntity);
    }

    // Add to main collection
    this.entities.set(entity.uuid, entity);

    // Add to type-specific collection
    const typeSet = this.entitiesByType.get(entity.entityType);
    if (typeSet) {
      typeSet.add(entity.uuid);
    }

    // Track deleted state if needed
    if (entity.isDeleted) {
      this.deletedEntities.add(entity.uuid);
    }

    // Notify observers
    this.observer.notify('entityAdded', { entity });
  }

  /**
   * Unregister an entity from the manager
   */
  public unregisterEntity(entity: EntityBase): void {
    if (!this.entities.has(entity.uuid)) {
      return; // Not registered
    }

    if (entity.entityType === 'character') {
      this.characterEntities = this.characterEntities.filter(c => c.uuid !== entity.uuid);
    }

    // Remove from main collection
    this.entities.delete(entity.uuid);

    // Remove from type-specific collection
    const typeSet = this.entitiesByType.get(entity.entityType);
    if (typeSet) {
      typeSet.delete(entity.uuid);
    }

    // Remove from deleted collection if needed
    if (this.deletedEntities.has(entity.uuid)) {
      this.deletedEntities.delete(entity.uuid);
    }

    // Notify observers
    this.observer.notify('entityRemoved', { entity });
  }

  /**
   * Update an entity's registration (e.g., after type change)
   */
  public updateEntity(entity: EntityBase): void {
    // Re-register the entity to update collections
    this.unregisterEntity(entity);
    this.registerEntity(entity);

    // Notify observers
    this.observer.notify('entityUpdated', { entity });
  }

  /**
   * Update an entity's visibility state
   */
  public updateEntityVisibility(entity: EntityBase, visible: boolean): void {
    // Notify observers
    this.observer.notify('entityVisibilityChanged', { entity, visible });
  }

  /**
   * Update an entity's deleted state
   */
  public updateEntityDeletedState(entity: EntityBase, isDeleted: boolean): void {
    if (isDeleted) {
      this.deletedEntities.add(entity.uuid);
    } else {
      this.deletedEntities.delete(entity.uuid);
    }

    // Notify observers
    this.observer.notify('entityDeletedStateChanged', { entity, isDeleted });
    this.observer.notify('hierarchyChanged', {});
  }

  /**
   * Check if an entity is marked as deleted
   */
  public isEntityDeleted(entity: EntityBase): boolean {
    return this.deletedEntities.has(entity.uuid);
  }

  /**
   * Get all entities in the scene
   */
  public getAllEntities(): EntityBase[] {
    return Array.from(this.entities.values());
  }

  /**
   * Get all visible and non-deleted entities
   */
  public getAllVisibleEntities(): EntityBase[] {
    return Array.from(this.entities.values())
      .filter(entity => entity.visible && !entity.isDeleted);
  }

  /**
   * Get all deleted entities
   */
  public getDeletedEntities(): EntityBase[] {
    return Array.from(this.deletedEntities)
      .map(uuid => this.entities.get(uuid))
      .filter(Boolean) as EntityBase[];
  }

  /**
   * Get non-deleted root entities
   */
  public getRootEntities(): EntityBase[] {
    return Array.from(this.entities.values())
      .filter(entity =>
        (!entity.parent || entity.parent === this.scene) &&
        !this.deletedEntities.has(entity.uuid)
      );
  }

  /**
   * Get deleted root entities
   */
  public getDeletedRootEntities(): EntityBase[] {
    return Array.from(this.entities.values())
      .filter(entity =>
        (!entity.parent || entity.parent === this.scene) &&
        this.deletedEntities.has(entity.uuid)
      );
  }

  /**
   * Get entities of a specific type
   */
  public getEntitiesByType(type: EntityType): EntityBase[] {
    const typeSet = this.entitiesByType.get(type);
    if (!typeSet) return [];

    return Array.from(typeSet).map(uuid => this.entities.get(uuid)!);
  }

  /**
   * Get all character entities
   */
  public getCharacterEntities(): CharacterEntity[] {
    return this.characterEntities;
  }

  /**
   * Find an entity by UUID
   */
  public getEntityByUUID(uuid: string): EntityBase | undefined {
    return this.entities.get(uuid);
  }

  /**
   * Find entities by name (can be partial match)
   */
  public getEntitiesByName(name: string, exactMatch: boolean = false): EntityBase[] {
    return Array.from(this.entities.values()).filter(entity => {
      if (exactMatch) {
        return entity.name === name;
      } else {
        return entity.name.includes(name);
      }
    });
  }

  /**
   * Get child entities of a parent entity
   */
  public getChildEntities(parentEntity: EntityBase): EntityBase[] {
    const children: EntityBase[] = [];

    parentEntity.children.forEach(child => {
      if (isEntity(child)) {
        children.push(child);
      }
    });

    return children;
  }

  /**
   * Check if an entity has child entities
   */
  public hasChildEntities(entity: EntityBase): boolean {
    for (let i = 0; i < entity.children.length; i++) {
      if (isEntity(entity.children[i])) {
        return true;
      }
    }
    return false;
  }

  /**
   * Notify that hierarchy has changed (after reparenting)
   */
  public notifyHierarchyChanged(): void {
    this.observer.notify('hierarchyChanged', {});
  }

  public AddToParent(child: Selectable, parent: Selectable, resetTransform: boolean = true): void {
    parent.add(child);

    if (resetTransform) {
      child.rotation.set(0, 0, 0);
      child.position.set(0, 0, 0);
      child.updateWorldMatrix(true, true);
    }
  }

  public AddToBone(child: Selectable, boneControl: BoneControl, resetPosition: boolean = true): void {
    boneControl.add(child);

    if (resetPosition) {
      child.position.set(0, 0, 0);
      child.updateWorldMatrix(true, true);
    }
  }

  public toggleGizmo(): void {
    this.showGizmos = !this.showGizmos;
    this.getAllEntities().forEach(entity => {
      entity.setGizmoVisible(this.showGizmos);
    });

    // environment
    this.engine.getEnvironmentManager().setEnviromentGizmosVisible(this.showGizmos);
    
    // notify
    this.observer.notify('gizmosVisibilityChanged', { visible: this.showGizmos });
  }
} 
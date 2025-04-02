import * as BABYLON from '@babylonjs/core';
import { EntityBase, EntityType, SerializedEntityData } from './EntityBase';
import { Scene } from '@babylonjs/core/scene';
import { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { trackEvent, ANALYTICS_EVENTS } from '../analytics';

export interface CharacterEntityProps {
    url: string;
    name?: string;
}

export interface SerializedCharacterEntityData extends SerializedEntityData {
    entityType: 'character';
    characterProps: CharacterEntityProps;
    boneRotations?: Record<string, {x: number, y: number, z: number, w: number}>;
}

export class CharacterEntity extends EntityBase {
    public skeleton: Skeleton | null = null;
    public characterProps: CharacterEntityProps;
    private _isLoading = false;
    private _loadingPromise: Promise<void> | null = null;
    public rootMesh: BABYLON.AbstractMesh | null = null;
    private _initialBoneRotations: Map<string, BABYLON.Quaternion> = new Map();

    constructor(scene: Scene, name: string, id: string, props: CharacterEntityProps) {
        super(name, scene, 'character', {
            id: id,
            position: new BABYLON.Vector3(0, 0, 0),
        });
        this.characterProps = props;
        
        // Track character creation
        trackEvent(ANALYTICS_EVENTS.CREATE_ENTITY, {
            type: 'character',
            modelUrl: props.url
        });
        
        this._loadingPromise = this._loadCharacter();
    }

    private async _loadCharacter(): Promise<void> {
        if (!this.characterProps.url) {
            console.error("CharacterEntity: No URL provided.");
            return;
        }
        this._isLoading = true;
        console.log(`Loading character from: ${this.characterProps.url}`);
        try {
            const result = await BABYLON.SceneLoader.ImportMeshAsync(
                "", // meshNames
                "", // rootUrl
                this.characterProps.url,
                this._scene,
                (event) => {
                    // Progress handling if needed
                    console.log(`Loading progress: ${event.loaded} / ${event.total}`);
                }
            );

            if (result.meshes.length > 0) {
                const newMesh = result.meshes[0];
                this.rootMesh = newMesh;
                this.rootMesh.parent = this; // Attach loaded mesh hierarchy to this entity node
                this.rootMesh.name = `${this.name}_meshRoot`;

                // Find the skeleton
                if (result.skeletons.length > 0) {
                    this.skeleton = result.skeletons[0];
                    console.log(`Character ${this.name} loaded with skeleton: ${this.skeleton.name}`);
                    
                    // Store initial bone rotations for reset capability
                    this.skeleton.bones.forEach(bone => {
                        if (bone.getRotationQuaternion()) {
                            this._initialBoneRotations.set(
                                bone.name, 
                                bone.getRotationQuaternion()!.clone()
                            );
                        }
                    });
                    
                    // Ensure meshes are linked to the skeleton if not already
                    result.meshes.forEach(mesh => {
                        if (mesh instanceof AbstractMesh && !mesh.skeleton) {
                            mesh.skeleton = this.skeleton;
                        }
                    });
                } else {
                    console.warn(`Character ${this.name} loaded but no skeleton found.`);
                }

                // Handle animations if needed
                if (result.animationGroups.length > 0) {
                    console.log(`Character has ${result.animationGroups.length} animation groups`);
                    // Store animation groups for future use
                    result.animationGroups.forEach(group => {
                        console.log(`Animation: ${group.name}`);
                    });
                }

                // Position the character at origin by default
                this.position = BABYLON.Vector3.Zero();
                
                // Apply proper scaling if needed
                this.scaling = new BABYLON.Vector3(1, 1, 1);

            } else {
                console.error(`Failed to load meshes from ${this.characterProps.url}`);
            }
        } catch (error) {
            console.error(`Error loading character ${this.name} from ${this.characterProps.url}:`, error);
        } finally {
            this._isLoading = false;
            console.log(`Finished loading character ${this.name}`);
        }
    }

    public getEntityType(): EntityType {
        return 'character';
    }

    public async waitUntilReady(): Promise<void> {
        if (this._loadingPromise) {
            await this._loadingPromise;
        }
    }

    public isReady(_completeCheck?: boolean): boolean {
        return !this._isLoading;
    }

    public get isLoading(): boolean {
        return this._isLoading;
    }

    public getBones(): BABYLON.Bone[] {
        return this.skeleton?.bones || [];
    }
    
    /**
     * Reset all bones to their initial rotations
     */
    public resetAllBones(): void {
        if (!this.skeleton) return;
        
        this.skeleton.bones.forEach(bone => {
            const initialRotation = this._initialBoneRotations.get(bone.name);
            if (initialRotation) {
                bone.setRotationQuaternion(initialRotation.clone());
            }
        });
        
        // Track the reset action
        trackEvent(ANALYTICS_EVENTS.CHANGE_SETTINGS, {
            entityType: 'character',
            action: 'reset_all_bones'
        });
    }

    // --- Serialization ---
    public serialize(): SerializedCharacterEntityData {
        // Serialize bone rotations
        const boneRotations: Record<string, {x: number, y: number, z: number, w: number}> = {};
        
        if (this.skeleton) {
            this.skeleton.bones.forEach(bone => {
                const rotation = bone.getRotationQuaternion();
                if (rotation) {
                    boneRotations[bone.name] = {
                        x: rotation.x,
                        y: rotation.y,
                        z: rotation.z,
                        w: rotation.w
                    };
                }
            });
        }
        
        return {
            ...super.serialize(),
            entityType: 'character',
            characterProps: this.characterProps,
            boneRotations
        };
    }

    // Static method for deserialization
    public static async deserialize(
        scene: Scene,
        data: SerializedCharacterEntityData,
    ): Promise<CharacterEntity> {
        const entity = new CharacterEntity(scene, data.name, data.id, data.characterProps);
        
        // Wait for model to load before applying bone rotations
        await entity.waitUntilReady();
        
        // Apply base properties (transform)
        entity.position.x = data.position.x;
        entity.position.y = data.position.y;
        entity.position.z = data.position.z;
        
        entity.rotation.x = data.rotation.x;
        entity.rotation.y = data.rotation.y;
        entity.rotation.z = data.rotation.z;
        
        entity.scaling.x = data.scaling.x;
        entity.scaling.y = data.scaling.y;
        entity.scaling.z = data.scaling.z;
        
        // Apply saved bone rotations if available
        if (data.boneRotations && entity.skeleton) {
            Object.entries(data.boneRotations).forEach(([boneName, rotation]) => {
                const bone = entity.skeleton!.bones.find(b => b.name === boneName);
                if (bone) {
                    const quaternion = new BABYLON.Quaternion(
                        rotation.x,
                        rotation.y,
                        rotation.z,
                        rotation.w
                    );
                    bone.setRotationQuaternion(quaternion);
                }
            });
        }
        
        return entity;
    }

    public dispose(doNotRecurse?: boolean | undefined, disposeMaterialAndTextures?: boolean | undefined): void {
        console.log(`Disposing CharacterEntity: ${this.name}`);
        // Dispose skeleton, meshes, etc.
        this.skeleton?.dispose();
        // Children meshes are disposed automatically when the parent (this entity) is disposed
        super.dispose();
    }
} 
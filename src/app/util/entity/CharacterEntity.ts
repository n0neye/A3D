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
    public initialBoneRotations: Map<string, BABYLON.Quaternion> = new Map();
    
    // Bone visualization properties
    private _boneMap: Map<string, { bone: BABYLON.Bone, control: BABYLON.Mesh }> = new Map();
    private _boneLines: Map<string, BABYLON.LinesMesh> = new Map();
    private _visualizationMaterial: BABYLON.Material | null = null;
    private _boneColor = new BABYLON.Color3(0.5, 0.7, 1.0);
    private _selectedBone: BABYLON.Bone | null = null;
    private _isVisualizationVisible = false;
    private _boneMaterialAlpha = 0.5;
    private _linesMaterialAlpha = 0.7;

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
            const result = await BABYLON.ImportMeshAsync(
                this.characterProps.url,
                this._scene,
            );

            console.log("CharacterEntity: ImportMeshAsync result:", result);

            if (result.meshes.length > 0) {
                const newMesh = result.meshes[0];
                this.rootMesh = newMesh;
                this.rootMesh.parent = this; // Attach loaded mesh hierarchy to this entity node
                this.rootMesh.name = `${this.name}_meshRoot`;

                result.meshes.forEach(mesh => {
                    console.log("CharacterEntity: mesh:", mesh);
                    if(mesh instanceof BABYLON.Mesh && mesh.metadata) {
                        mesh.metadata.rootEntity = this;
                    }
                });

                // Find the skeleton
                if (result.skeletons.length > 0) {
                    this.skeleton = result.skeletons[0];
                    console.log(`Character ${this.name} loaded with skeleton: ${this.skeleton.name}`);
                    
                    // Store initial bone rotations for reset capability
                    this.skeleton.bones.forEach(bone => {
                        if (bone.getRotationQuaternion()) {
                            this.initialBoneRotations.set(
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
                    
                    // Create bone visualization elements
                    this._createBoneVisualization();
                } else {
                    console.warn(`Character ${this.name} loaded but no skeleton found.`);
                }

                // Handle animations if needed
                if (result.animationGroups.length > 0) {
                    console.log(`Character has ${result.animationGroups.length} animation groups`);
                    // Store animation groups for future use
                    result.animationGroups.forEach(group => {
                        console.log(`Animation: ${group.name}`);
                        // Pause animations by default to allow manual posing
                        group.pause();
                    });
                }

                // Position the character at origin by default
                this.position = BABYLON.Vector3.Zero();
            } else {
                console.error(`No meshes loaded for character ${this.name}`);
            }
        } catch (error) {
            console.error(`Error loading character model: ${error}`);
        } finally {
            this._isLoading = false;
        }
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
            const initialRotation = this.initialBoneRotations.get(bone.name);
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
    
    /**
     * Creates visualization elements for the skeleton's bones
     */
    private _createBoneVisualization(): void {
        if (!this.skeleton) return;
        
        // Create visualization material if it doesn't exist
        if (!this._visualizationMaterial) {
            const material = new BABYLON.StandardMaterial(`${this.name}_boneMaterial`, this._scene);
            material.emissiveColor = this._boneColor;
            material.diffuseColor = this._boneColor;
            material.specularColor = BABYLON.Color3.Black();
            material.alpha = this._boneMaterialAlpha;
            material.disableDepthWrite = true;
            this._visualizationMaterial = material;
        }
        
        // Create bone control spheres for each bone
        this.skeleton.bones.forEach(bone => {
            // Skip fingers and other small bones for cleaner visualization
            const boneName = bone.name.toLowerCase();
            if (boneName.includes('finger') || boneName.includes('thumb') || 
                boneName.includes('toe') || boneName.includes('eye')) {
                return;
            }
            
            // Create a small sphere for the bone
            const boneControl = BABYLON.MeshBuilder.CreateSphere(
                `bone_${bone.name}_${this.id}`,
                { diameter: 0.05 },
                this._scene
            );
            
            boneControl.material = this._visualizationMaterial;
            boneControl.renderingGroupId = 1;
            boneControl.isPickable = true;
            
            // Position the control at the bone
            if (bone._linkedTransformNode) {
                boneControl.parent = bone._linkedTransformNode;
                boneControl.position = BABYLON.Vector3.Zero();
            } else {
                boneControl.parent = this;
                boneControl.position = bone.getPosition(BABYLON.Space.WORLD);
            }
            
            // Store in bone map
            this._boneMap.set(bone.name, { bone, control: boneControl });
            
            // Hide initially
            boneControl.isVisible = false;
        });
        
        // Create bone lines to visualize the skeleton structure
        this.skeleton.bones.forEach(bone => {
            const childBones = bone.getChildren();
            
            if (childBones.length > 0) {
                childBones.forEach(childBone => {
                    // Only create lines if both bones have controls
                    if (this._boneMap.has(bone.name) && this._boneMap.has(childBone.name)) {
                        const lineName = `line_${bone.name}_to_${childBone.name}_${this.id}`;
                        
                        // Create a line mesh
                        const line = BABYLON.MeshBuilder.CreateLines(
                            lineName,
                            {
                                points: [BABYLON.Vector3.Zero(), BABYLON.Vector3.Zero()],
                                updatable: true
                            },
                            this._scene
                        );
                        
                        line.color = this._boneColor;
                        line.alpha = this._linesMaterialAlpha;
                        line.renderingGroupId = 1;
                        line.isVisible = false;
                        
                        // Store in bone lines map
                        this._boneLines.set(lineName, line);
                    }
                });
            }
        });
        
        // Register an observer to update lines when the scene renders
        this._scene.onBeforeRenderObservable.add(() => this._updateBoneLines());
    }
    
    /**
     * Updates position of all bone lines to match current skeleton pose
     */
    private _updateBoneLines(): void {
        if (!this._isVisualizationVisible) return;
        
        this.skeleton?.bones.forEach(bone => {
            const childBones = bone.getChildren();
            
            if (childBones.length > 0) {
                childBones.forEach(childBone => {
                    // Only update if both bones have controls
                    if (this._boneMap.has(bone.name) && this._boneMap.has(childBone.name)) {
                        const lineName = `line_${bone.name}_to_${childBone.name}_${this.id}`;
                        let line = this._boneLines.get(lineName);
                        
                        if (line) {
                            const parentPosition = this._boneMap.get(bone.name)!.control.getAbsolutePosition();
                            const childPosition = this._boneMap.get(childBone.name)!.control.getAbsolutePosition();
                            
                            // Update line positions
                            const points = [parentPosition, childPosition];
                            line = BABYLON.MeshBuilder.CreateLines(
                                line.name, 
                                { points, instance: line }, 
                                this._scene
                            );
                        }
                    }
                });
            }
        });
    }
    
    /**
     * Shows or hides the bone visualization
     */
    public showBoneVisualization(visible: boolean): void {
        this._isVisualizationVisible = visible;
        
        // Update visibility of bone controls
        this._boneMap.forEach(({ control }) => {
            control.isVisible = visible;
        });
        
        // Update visibility of bone lines
        this._boneLines.forEach(line => {
            line.isVisible = visible;
        });
        
        // Track visibility change
        trackEvent(ANALYTICS_EVENTS.CHARACTER_EDIT, {
            action: visible ? 'show_bones' : 'hide_bones'
        });
    }
    
    /**
     * Sets the currently selected bone
     */
    public selectBone(boneName: string): BABYLON.Bone | null {
        const boneData = this._boneMap.get(boneName);
        if (boneData) {
            this._selectedBone = boneData.bone;
            
            // Highlight selected bone control
            this._boneMap.forEach(({ control }, name) => {
                if (name === boneName) {
                    control.scaling = new BABYLON.Vector3(1.3, 1.3, 1.3);
                    control.material!.alpha = 0.8;
                } else {
                    control.scaling = new BABYLON.Vector3(1, 1, 1);
                    control.material!.alpha = this._boneMaterialAlpha;
                }
            });
            
            return boneData.bone;
        }
        
        return null;
    }
    
    /**
     * Gets all bone names that have controls
     */
    public getControlledBoneNames(): string[] {
        return Array.from(this._boneMap.keys());
    }
    
    /**
     * Handle the entity being selected in the editor
     */
    public onSelect(): void {
        this.showBoneVisualization(true);
    }
    
    /**
     * Handle the entity being deselected in the editor
     */
    public onDeselect(): void {
        this.showBoneVisualization(false);
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

    public dispose(): void {
        console.log(`Disposing CharacterEntity: ${this.name}`);
        
        // Dispose bone visualization
        this._boneMap.forEach(({ control }) => {
            control.dispose();
        });
        
        this._boneLines.forEach(line => {
            line.dispose();
        });
        
        if (this._visualizationMaterial) {
            this._visualizationMaterial.dispose();
        }
        
        // Dispose skeleton, meshes, etc.
        this.skeleton?.dispose();
        
        // Children meshes are disposed automatically when the parent (this entity) is disposed
        super.dispose();
    }
} 
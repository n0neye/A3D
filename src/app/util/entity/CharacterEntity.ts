import * as BABYLON from '@babylonjs/core';
import { EntityBase, EntityType, SerializedEntityData } from './EntityBase';
import { Scene } from '@babylonjs/core/scene';
import { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { trackEvent, ANALYTICS_EVENTS } from '../analytics';
import { BoneRotationCommand } from '../../lib/commands';
import { useOldEditorContext } from '../../context/OldEditorContext';
import { HistoryManager } from '../../engine/managers/HistoryManager';
import { BoneControl } from './BoneControl';
import { setupMeshShadows } from '../editor/light-util';

export interface CharacterEntityProps {
    url: string;
    name?: string;
}

export interface SerializedCharacterEntityData extends SerializedEntityData {
    entityType: 'character';
    characterProps: CharacterEntityProps;
    boneRotations?: Record<string, { x: number, y: number, z: number, w: number }>;
}

export class CharacterEntity extends EntityBase {
    public skeleton: Skeleton | null = null;
    public characterProps: CharacterEntityProps;
    private _isLoading = false;
    private _isDisposed = false;
    private _loadingPromise: Promise<void> | null = null;
    public rootMesh: BABYLON.AbstractMesh | null = null;
    public initialBoneRotations: Map<string, BABYLON.Quaternion> = new Map();

    // Bone visualization properties
    private _boneMap: Map<string, { bone: BABYLON.Bone, control: BoneControl }> = new Map();
    private _boneLines: Map<string, BABYLON.LinesMesh> = new Map();
    private _visualizationMaterial: BABYLON.Material | null = null;
    private _highlightMaterial: BABYLON.Material | null = null;
    private _boneColor = new BABYLON.Color3(0.5, 0.7, 1.0);
    private _selectedBone: BABYLON.Bone | null = null;
    private _selectedControl: BABYLON.Mesh | null = null;
    private _isVisualizationVisible = false;
    private _boneMaterialAlpha = 0.5;
    private _linesMaterialAlpha = 0.7;

    constructor(scene: Scene, name: string, id: string, props: CharacterEntityProps, options?: { scaling?: BABYLON.Vector3 }) {
        super(name, scene, 'character', {
            id: id,
            position: new BABYLON.Vector3(0, 0, 0),
            scaling: options?.scaling || new BABYLON.Vector3(1, 1, 1)
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
                    if (mesh instanceof BABYLON.Mesh && mesh.metadata) {
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

                setupMeshShadows(this.rootMesh);
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

        // Create highlight material if it doesn't exist
        if (!this._highlightMaterial) {
            const material = new BABYLON.StandardMaterial(`${this.name}_highlightMaterial`, this._scene);
            material.emissiveColor = new BABYLON.Color3(1, 0.5, 0);
            material.alpha = 0.8;
            this._highlightMaterial = material;
        }

        // Create bone control spheres for each bone
        this.skeleton.bones.forEach(bone => {
            // Skip fingers and other small bones for cleaner visualization
            const boneName = bone.name.toLowerCase();
            if (boneName.includes('thumb') || boneName.includes('index') || boneName.includes('middle') || boneName.includes('ring') || boneName.includes('pinky')) {
                return;
            }

            // Create a bone control instead of a regular mesh
            const boneControl = new BoneControl(
                `bone_${bone.name}_${this.id}`,
                this._scene,
                bone,
                this,
                {
                    diameter: 0.05,
                    material: this._visualizationMaterial!
                }
            );

            // Set parent and position the control
            if (bone._linkedTransformNode) {
                boneControl.parent = bone._linkedTransformNode.parent;
                boneControl.position = bone._linkedTransformNode.position;
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
        console.log("CharacterEntity: Creating bone lines");
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
        if (this._isDisposed) return;
        console.log("CharacterEntity: Updating bone lines", this.name);

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
    }

    /**
     * Called when the entity is selected in the editor
     */
    public onSelect(): void {
        console.log(`CharacterEntity: Selected ${this.name}`);
        this.showBoneVisualization(true);
    }

    /**
     * Called when the entity is deselected in the editor
     */
    public onDeselect(): void {
        console.log(`CharacterEntity: Deselected ${this.name}`);
        
        // Hide bone visualization
        this.showBoneVisualization(false);
        
        // Deselect any selected bone
        this._deselectBone();
    }

    /**
     * Select a specific bone
     */
    public selectBone(boneControl: BoneControl): void {
        const selectionManager = this._scene.metadata?.selectionManager;
        if (selectionManager) {
            selectionManager.select(boneControl);
        }
    }

    /**
     * Deselect the current bone
     */
    private _deselectBone(): void {
        if (this._selectedBone && this._selectedControl) {
            // Reset control appearance
            if (this._selectedControl.material instanceof BABYLON.StandardMaterial) {
                this._selectedControl.material = this._visualizationMaterial;
            }

            // Detach gizmo
            const gizmoManager = this.getGizmoManager();
            if (gizmoManager) {
                gizmoManager.attachToMesh(null);
            }

            // Clear selection
            this._selectedBone = null;
            this._selectedControl = null;
        }
    }

    // --- Serialization ---
    public serialize(): SerializedCharacterEntityData {
        // Serialize bone rotations
        const boneRotations: Record<string, { x: number, y: number, z: number, w: number }> = {};

        if (this.skeleton) {
            this.skeleton.bones.forEach(bone => {
                let rotation: BABYLON.Quaternion | null = null;

                // Check if bone has a linked transform node with rotation
                if (bone._linkedTransformNode) {
                    if (bone._linkedTransformNode.rotationQuaternion) {
                        rotation = bone._linkedTransformNode.rotationQuaternion;
                    } else {
                        // Convert euler rotation to quaternion
                        rotation = BABYLON.Quaternion.FromEulerAngles(
                            bone._linkedTransformNode.rotation.x,
                            bone._linkedTransformNode.rotation.y,
                            bone._linkedTransformNode.rotation.z
                        );
                    }
                } else {
                    // Use bone's rotation directly if no linked transform
                    rotation = bone.getRotationQuaternion();
                }

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
        try {
            console.log("Deserializing character:", data.name, data.id);
            const entity = new CharacterEntity(scene, data.name, data.id, data.characterProps);

            // Wait for model to load before applying bone rotations
            await entity.waitUntilReady();

            // Give Babylon an extra frame to finalize loading
            await new Promise(resolve => setTimeout(resolve, 0));

            console.log("Character loaded, applying transforms");

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
                console.log("Applying bone rotations");

                // First ensure all bones have their initial transforms updated
                entity.skeleton.prepare();

                // Apply rotations in a try/catch to prevent errors from breaking deserialization
                try {
                    Object.entries(data.boneRotations).forEach(([boneName, rotation]) => {
                        const bone = entity.skeleton!.bones.find(b => b.name === boneName);
                        if (bone) {
                            const quaternion = new BABYLON.Quaternion(
                                rotation.x,
                                rotation.y,
                                rotation.z,
                                rotation.w
                            );

                            try {
                                // Apply to the linked transform node if it exists
                                if (bone._linkedTransformNode) {
                                    if (bone._linkedTransformNode.rotationQuaternion) {
                                        bone._linkedTransformNode.rotationQuaternion = quaternion;
                                    } else {
                                        // Convert quaternion to euler for nodes using rotation
                                        const euler = quaternion.toEulerAngles();
                                        bone._linkedTransformNode.rotation = new BABYLON.Vector3(
                                            euler.x, euler.y, euler.z
                                        );
                                    }
                                } else {
                                    // Apply directly to the bone if no linked transform
                                    bone.setRotationQuaternion(quaternion);
                                }
                            } catch (boneErr) {
                                console.warn(`Error applying rotation to bone ${boneName}:`, boneErr);
                            }
                        }
                    });
                } catch (rotErr) {
                    console.error("Error applying bone rotations:", rotErr);
                }
            }

            return entity;
        } catch (error) {
            console.error("Error during character deserialization:", error);
            // Create a fallback entity without the bone rotations
            const fallbackEntity = new CharacterEntity(scene, data.name, data.id, data.characterProps);
            await fallbackEntity.waitUntilReady();
            return fallbackEntity;
        }
    }

    public dispose(): void {
        // We no longer need to clean up gizmo observers here, as BoneControl handles that

        // Rest of the dispose code for cleaning up resources
        this._boneMap.forEach(({ control }) => {
            control.dispose();
        });

        this._boneLines.forEach(line => {
            line.dispose();
        });

        if (this._visualizationMaterial) {
            this._visualizationMaterial.dispose();
        }

        this.skeleton?.dispose();
        super.dispose();
    }

    /**
     * Update the bone visualization to reflect the current state
     */
    public updateBoneVisualization(): void {
        this._updateBoneLines();
    }

    /**
     * Highlight a specific bone control
     */
    public highlightBone(boneControl: BoneControl): void {
        // Use existing _deselectBone first to clear any current selection
        this._deselectBone();
        
        // Find the bone from the control
        const boneName = boneControl.bone.name;
        const bone = this.skeleton?.bones.find(b => b.name === boneName);
        
        if (bone) {
            this._selectedBone = bone;
            this._selectedControl = boneControl;
            
            // Apply highlight material if available
            if (this._highlightMaterial && boneControl.material) {
                boneControl.material = this._highlightMaterial;
            }
        }
    }

    /**
     * Remove highlight from currently highlighted bone
     */
    public unhighlightBone(boneControl: BoneControl): void {
        if (this._selectedBone && this._selectedControl === boneControl) {
            // Reset control appearance
            if (this._selectedControl.material && this._visualizationMaterial) {
                this._selectedControl.material = this._visualizationMaterial;
            }
            
            // Clear selection
            this._selectedBone = null;
            this._selectedControl = null;
        }
    }

    public disposeCharacter(): void {
        console.log("CharacterEntity: Disposing children", this.name);
        this._boneMap.forEach(({ control }) => {
            control.dispose();
        });

        this._boneLines.forEach(line => {
            line.dispose();
        });

        this._isDisposed = true;        
    }
} 
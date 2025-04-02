import * as BABYLON from '@babylonjs/core';
import { EntityBase, EntityType, SerializedEntityData } from './EntityBase';
import { Scene } from '@babylonjs/core/scene';
import { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { trackEvent, ANALYTICS_EVENTS } from '../analytics';
import { BoneRotationCommand } from '../../lib/commands';
import { useEditorContext } from '../../context/EditorContext';
import { HistoryManager } from '../../components/HistoryManager';

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
    private _loadingPromise: Promise<void> | null = null;
    public rootMesh: BABYLON.AbstractMesh | null = null;
    public initialBoneRotations: Map<string, BABYLON.Quaternion> = new Map();

    // Bone visualization properties
    private _boneMap: Map<string, { bone: BABYLON.Bone, control: BABYLON.Mesh }> = new Map();
    private _boneLines: Map<string, BABYLON.LinesMesh> = new Map();
    private _visualizationMaterial: BABYLON.Material | null = null;
    private _highlightMaterial: BABYLON.Material | null = null;
    private _boneColor = new BABYLON.Color3(0.5, 0.7, 1.0);
    private _selectedBone: BABYLON.Bone | null = null;
    private _selectedControl: BABYLON.Mesh | null = null;
    private _isVisualizationVisible = false;
    private _boneMaterialAlpha = 0.5;
    private _linesMaterialAlpha = 0.7;

    // Pointer observable for bone selection
    private _pointerObserver: BABYLON.Observer<BABYLON.PointerInfo> | null = null;
    private _gizmoRotationObserver: BABYLON.Observer<any> | null = null;
    private _gizmoEndDragObserver: BABYLON.Observer<any> | null = null;

    // Add this as a property to the CharacterEntity class
    private _currentBoneCommand: BoneRotationCommand | null = null;

    // Add these properties for drag state tracking
    private _isDraggingBone = false;

    // Add this property
    private _gizmoStartDragObserver: BABYLON.Observer<any> | null = null;

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

            // Create a small sphere for the bone
            const boneControl = BABYLON.MeshBuilder.CreateSphere(
                `bone_${bone.name}_${this.id}`,
                { diameter: 0.05 },
                this._scene
            );

            boneControl.material = this._visualizationMaterial;
            boneControl.renderingGroupId = 1;
            boneControl.isPickable = true;
            boneControl.metadata = {
                isBoneControl: true
            }

            // Position the control at the bone
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
    }

    /**
     * Called when the entity is selected in the editor
     */
    public onSelect(): void {
        console.log(`CharacterEntity: Selected ${this.name}`);

        // Show bone visualization when selected
        this.showBoneVisualization(true);

        // Add pointer observer for bone selection
        if (!this._pointerObserver && this._scene) {
            this._pointerObserver = this._scene.onPointerObservable.add(
                (pointerInfo) => this._handlePointerEvent(pointerInfo),
                BABYLON.PointerEventTypes.POINTERDOWN |
                BABYLON.PointerEventTypes.POINTERUP
            );

            // If there's a gizmo manager, observe rotation changes
            const gizmoManager = this.getGizmoManager();
            if (gizmoManager && gizmoManager.gizmos.rotationGizmo) {
                // Add observer for start of rotation (when drag begins)
                this._gizmoStartDragObserver = gizmoManager.gizmos.rotationGizmo.onDragStartObservable.add(
                    () => this._handleGizmoRotationStart()
                );

                // Add observer for rotation changes (during drag)
                this._gizmoRotationObserver = gizmoManager.gizmos.rotationGizmo.onDragObservable.add(
                    () => this._handleGizmoRotation()
                );

                // Add observer for end of rotation (when drag ends)
                this._gizmoEndDragObserver = gizmoManager.gizmos.rotationGizmo.onDragEndObservable.add(
                    () => this._finalizeBoneRotation()
                );
            }
        }
    }

    /**
     * Called when the entity is deselected in the editor
     */
    public onDeselect(): void {
        console.log(`CharacterEntity: Deselected ${this.name}`);

        // Remove pointer observer
        if (this._pointerObserver && this._scene) {
            this._scene.onPointerObservable.remove(this._pointerObserver);
            this._pointerObserver = null;
        }

        // Remove gizmo observers
        const gizmoManager = this.getGizmoManager();
        if (gizmoManager && gizmoManager.gizmos.rotationGizmo) {
            if (this._gizmoStartDragObserver) {
                gizmoManager.gizmos.rotationGizmo.onDragStartObservable.remove(this._gizmoStartDragObserver);
                this._gizmoStartDragObserver = null;
            }

            if (this._gizmoRotationObserver) {
                gizmoManager.gizmos.rotationGizmo.onDragObservable.remove(this._gizmoRotationObserver);
                this._gizmoRotationObserver = null;
            }

            if (this._gizmoEndDragObserver) {
                gizmoManager.gizmos.rotationGizmo.onDragEndObservable.remove(this._gizmoEndDragObserver);
                this._gizmoEndDragObserver = null;
            }
        }

        // Finalize any in-progress rotation
        this._finalizeBoneRotation();

        // Deselect any selected bone
        this._deselectBone();

        // Hide bone visualization when deselected
        this.showBoneVisualization(false);
    }

    /**
     * Handle pointer events for bone selection
     */
    private _handlePointerEvent(pointerInfo: BABYLON.PointerInfo): void {
        if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
            console.log("CharacterEntity: _handlePointerEvent", pointerInfo);

            const bonePickInfo = this._scene.pick(
                this._scene.pointerX,
                this._scene.pointerY,
                (mesh) => {
                    return mesh.name.startsWith('bone_'); // Only pick meshes that start with 'bone_'
                }
            );

            if (bonePickInfo.hit && bonePickInfo.pickedMesh) {
                const pickedMesh = bonePickInfo.pickedMesh;

                // Check if this is one of our bone controls
                for (const [boneName, { bone, control }] of this._boneMap.entries()) {
                    if (control === pickedMesh) {
                        this._selectBone(bone, control);
                        return;
                    }
                }

                // If we clicked on something else, deselect current bone
                if (this._selectedBone) {
                    // Only deselect if we didn't click on a bone control
                    let isControlMesh = false;
                    for (const { control } of this._boneMap.values()) {
                        if (pickedMesh === control) {
                            isControlMesh = true;
                            break;
                        }
                    }

                    if (!isControlMesh) {
                        this._deselectBone();
                    }
                }
            }
        }
    }

    /**
     * Called when a bone rotation gizmo drag starts
     */
    private _handleGizmoRotationStart(): void {
        if (!this._selectedBone || !this._selectedControl) return;

        console.log("CharacterEntity: Starting bone rotation", this._selectedBone.name);

        // Mark the start of dragging
        this._isDraggingBone = true;

        // Create a bone rotation command that captures the initial state
        this._currentBoneCommand = new BoneRotationCommand(this._selectedBone, this._selectedControl);
    }

    /**
     * Called during bone rotation gizmo drag
     */
    private _handleGizmoRotation(): void {
        // Apply control rotation to bone
        if (!this._selectedBone || !this._selectedControl) return;
        const rotation = this._selectedControl.rotation;
        if (rotation) {
            if (this._selectedBone._linkedTransformNode) {
                this._selectedBone._linkedTransformNode.rotation = rotation.clone();
            } else {
                this._selectedBone.rotation = rotation.clone();
            }
        }
    }

    /**
     * Called when a bone rotation gizmo drag ends
     */
    private _finalizeBoneRotation(): void {
        if (!this._isDraggingBone || !this._currentBoneCommand || !this._selectedBone) return;

        console.log("CharacterEntity: Finalizing bone rotation");

        // Only record the command if the rotation actually changed
        this._currentBoneCommand.updateFinalState();

        // Track rotation change
        trackEvent(ANALYTICS_EVENTS.CHARACTER_EDIT, {
            action: 'rotate_bone',
            boneName: this._selectedBone.name,
            method: 'gizmo'
        });

        // Reset dragging state
        this._isDraggingBone = false;
        this._currentBoneCommand = null;
    }

    /**
     * Select a bone and its control
     */
    private _selectBone(bone: BABYLON.Bone, control: BABYLON.Mesh): void {
        // Deselect previous bone
        this._deselectBone();

        // Select new bone
        this._selectedBone = bone;
        this._selectedControl = control;

        // Highlight the selected control
        if (control.material instanceof BABYLON.StandardMaterial) {
            control.material = this._highlightMaterial;
        }

        // Sync rotation of the bone
        if (this._selectedBone._linkedTransformNode) {
            this._selectedControl.rotation = this._selectedBone.rotation;
            console.log(`Sync bone rotation: ${this._selectedControl.name}`, this._selectedBone.rotation);
        }

        // Track bone selection
        trackEvent(ANALYTICS_EVENTS.CHARACTER_EDIT, {
            action: 'select_bone',
            boneName: bone.name
        });

        // Attach gizmo to the control
        const gizmoManager = this.getGizmoManager();
        if (gizmoManager) {
            gizmoManager.positionGizmoEnabled = false;
            gizmoManager.rotationGizmoEnabled = true;
            gizmoManager.attachToMesh(control);
        }

        console.log(`Selected bone: ${bone.name}`);
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
        // Remove observers if they exist
        if (this._pointerObserver && this._scene) {
            this._scene.onPointerObservable.remove(this._pointerObserver);
            this._pointerObserver = null;
        }

        const gizmoManager = this.getGizmoManager();
        if (gizmoManager && gizmoManager.gizmos.rotationGizmo) {
            if (this._gizmoStartDragObserver) {
                gizmoManager.gizmos.rotationGizmo.onDragStartObservable.remove(this._gizmoStartDragObserver);
                this._gizmoStartDragObserver = null;
            }

            if (this._gizmoRotationObserver) {
                gizmoManager.gizmos.rotationGizmo.onDragObservable.remove(this._gizmoRotationObserver);
                this._gizmoRotationObserver = null;
            }

            if (this._gizmoEndDragObserver) {
                gizmoManager.gizmos.rotationGizmo.onDragEndObservable.remove(this._gizmoEndDragObserver);
                this._gizmoEndDragObserver = null;
            }
        }

        // Rest of the dispose code
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
} 
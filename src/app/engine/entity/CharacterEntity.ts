import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { EntityBase, EntityType, SerializedEntityData } from './EntityBase';
import { trackEvent, ANALYTICS_EVENTS } from '@/app/util/analytics';
import { BoneControl } from './BoneControl';
import { setupMeshShadows } from '@/app/util/editor/light-util';

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
    public skeleton: THREE.Skeleton | null = null;
    public characterProps: CharacterEntityProps;
    public rootMesh: THREE.Object3D | null = null;
    public initialBoneRotations: Map<string, THREE.Quaternion> = new Map();
    private _isLoading = false;
    private _isDisposed = false;
    private _loadingPromise: Promise<void> | null = null;
    private _isVisualizationVisible = false;
    private _drawLines = true;

    // Materials
    public static DefaultBoneMaterial: THREE.Material;
    public static HighlightBoneMaterial: THREE.Material;
    public static LineMaterial: THREE.Material;
    private static boneColor = new THREE.Color(0.5, 0.7, 1.0);
    private static linesMaterialAlpha = 0.7;
    private static boneMaterialAlpha = 0.5;

    // Bone visualization properties
    private _boneMap: Map<string, {
        bone: THREE.Bone,
        control: BoneControl,
        childBones: THREE.Bone[],
        lineConfigs: { line: THREE.Line, targetBone: THREE.Bone }[]
    }> = new Map();

    constructor(
        scene: THREE.Scene,
        name: string,
        id: string,
        props: CharacterEntityProps,
        options?: {
            scaling?: THREE.Vector3,
            onLoaded?: (entity: EntityBase) => void
        }) {
        super(name, scene, 'character', {
            entityId: id,
            position: new THREE.Vector3(0, 0, 0),
            scaling: options?.scaling || new THREE.Vector3(1, 1, 1)
        });
        this.characterProps = props;

        // Track character creation
        trackEvent(ANALYTICS_EVENTS.CREATE_ENTITY, {
            type: 'character',
            modelUrl: props.url
        });

        this._loadingPromise = this._loadCharacter(options?.onLoaded);

        // Create visualization material
        this._createMaterials(scene);
    }

    private _createMaterials(scene: THREE.Scene): void {
        // Create standard material for bones
        if (!CharacterEntity.DefaultBoneMaterial) {
            CharacterEntity.DefaultBoneMaterial = new THREE.MeshStandardMaterial({
                color: CharacterEntity.boneColor,
                emissive: CharacterEntity.boneColor,
                transparent: true,
                opacity: CharacterEntity.boneMaterialAlpha,
                depthTest: false
            });
        }

        // Create highlight material for selected bones
        if (!CharacterEntity.HighlightBoneMaterial) {
            CharacterEntity.HighlightBoneMaterial = new THREE.MeshStandardMaterial({
                color: new THREE.Color(1, 0.5, 0),
                emissive: new THREE.Color(1, 0.5, 0),
                transparent: true,
                opacity: 0.8,
                depthTest: false
            });
        }

        // Create line material
        if (!CharacterEntity.LineMaterial) {
            CharacterEntity.LineMaterial = new THREE.LineBasicMaterial({
                color: CharacterEntity.boneColor,
                transparent: true,
                opacity: CharacterEntity.linesMaterialAlpha,
                depthTest: false
            });
        }
    }


    private async _loadCharacter(onLoaded?: (entity: EntityBase) => void): Promise<void> {
        if (!this.characterProps.url) {
            console.error("CharacterEntity: No URL provided.");
            return;
        }
        this._isLoading = true;
        console.log(`Loading character from: ${this.characterProps.url}`);
        try {
            // Use Three.js GLTFLoader to load the model
            const loader = new GLTFLoader();
            const result = await loader.loadAsync(this.characterProps.url);

            console.log("CharacterEntity: GLTF load result:", result);

            if (result.scene) {
                this.rootMesh = result.scene;
                this.add(this.rootMesh); // Add to this entity
                this.rootMesh.name = `${this.name}_meshRoot`;

                // Set metadata for all meshes
                this.rootMesh.traverse(object => {
                    if (object instanceof THREE.Mesh) {
                        object.userData.rootEntity = this;
                    }
                });

                // Find the skeleton if available
                let skeletonFound = false;
                this.rootMesh.traverse(object => {
                    if (object instanceof THREE.SkinnedMesh && object.skeleton && !skeletonFound) {
                        this.skeleton = object.skeleton;
                        skeletonFound = true;
                        console.log(`Character ${this.name} loaded with skeleton: ${this.skeleton.uuid}`);

                        // Store initial bone rotations for reset capability
                        this.skeleton.bones.forEach(bone => {
                            this.initialBoneRotations.set(
                                bone.name,
                                bone.quaternion.clone()
                            );
                        });

                        // Create bone visualization elements
                        this._createBoneVisualization();
                    }
                });

                if (!skeletonFound) {
                    console.warn(`Character ${this.name} loaded but no skeleton found.`);
                }

                // Handle animations if needed
                if (result.animations && result.animations.length > 0) {
                    console.log(`Character has ${result.animations.length} animations`);
                    // Create animation mixer and store animations for future use
                    // TODO: Implement animation playback system
                }

                // Position the character at origin by default
                this.position.set(0, 0, 0);

                this.rootMesh.traverse(object => {
                    if (object instanceof THREE.Mesh) {
                        setupMeshShadows(object);
                    }
                });
                onLoaded?.(this);
            } else {
                console.error(`No scene loaded for character ${this.name}`);
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

    public getBones(): THREE.Bone[] {
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
                bone.quaternion.copy(initialRotation);
            }
        });

        // Track the reset action
        trackEvent(ANALYTICS_EVENTS.CHANGE_SETTINGS, {
            entityType: 'character',
            action: 'reset_all_bones'
        });

        // Update visualization if visible
        if (this._isVisualizationVisible) {
            this.updateBoneVisualization();
        }
    }

    /**
     * Creates visualization elements for the skeleton's bones
     */

    private _isFingerBone(bone: THREE.Bone): boolean {
        const boneName = bone.name.toLowerCase();
        return boneName.includes('thumb') || boneName.includes('index') || boneName.includes('middle') || boneName.includes('ring') || boneName.includes('pinky');
    }

    private _createBoneVisualization(): void {
        if (!this.skeleton) return;

        // Create bone control spheres for each bone
        this.skeleton.bones.forEach(bone => {
            // Skip fingers and other small bones for cleaner visualization
            if (this._isFingerBone(bone)) {
                return;
            }

            // Create a BoneControl for this bone
            const boneControl = new BoneControl(
                `bone_${bone.name}_${this.id}`,
                this.engine.getScene(),
                bone,
                this,
                {
                    diameter: 0.05,
                }
            );

            // Hide initially
            boneControl.visible = false;

            if(!this._drawLines) {
                this._boneMap.set(bone.name, { bone, control: boneControl, childBones: [], lineConfigs: [] });
                return;
            }

            // Create lines between the bone and its child bones
            const childBones = bone.children.filter(child => child instanceof THREE.Bone) as THREE.Bone[];
            const lineConfigs: { line: THREE.Line, targetBone: THREE.Bone }[] = [];
            childBones.forEach(childBone => {
                if (this._isFingerBone(childBone)) {
                    return;
                }

                const lineName = `line_${bone.name}_to_${childBone.name}_${this.id}`;
                const geometry = new THREE.BufferGeometry();
                const line = new THREE.Line(geometry, CharacterEntity.LineMaterial);
                line.name = lineName;
                line.visible = true;
                boneControl.add(line);
                
                // Set position of line to the bone control
                line.position.copy(boneControl.position);

                // Set points of line to the bone control and child bone
                const points = [
                    boneControl.position,
                    childBone.position
                ];
                geometry.setFromPoints(points);

                lineConfigs.push({ line, targetBone: childBone });
            });

            // Store in bone map
            this._boneMap.set(bone.name, { bone, control: boneControl, childBones, lineConfigs });
        });
    }

    /**
     * Updates position of all bone lines to match current skeleton pose
     */
    public updateBoneVisualization(): void {
        if (!this._isVisualizationVisible) return;
        if (this._isDisposed) return;

        console.log("CharacterEntity: updateBoneVisualization", this.name);

        // Sync the position and rotation of the bone control to the bone
        this._boneMap.forEach(({ control,bone, lineConfigs }) => {
            control.position.copy(bone.position);
            control.quaternion.copy(bone.quaternion);
            lineConfigs.forEach(({ line }) => {
                // ?
            });
        });
    }

    /**
     * Shows or hides the bone visualization
     */
    public showBoneVisualization(visible: boolean): void {
        this._isVisualizationVisible = visible;

        // Update visibility of bone controls
        this._boneMap.forEach(({ control, lineConfigs }) => {
            control.visible = visible;
            lineConfigs.forEach(({ line }) => {
                line.visible = visible;
            });
        });

        // Update line positions if becoming visible
        if (visible) {
            this.updateBoneVisualization();
        }
    }

    /**
     * Called when the entity is selected in the editor
     */
    public onSelect(): void {
        console.log(`CharacterEntity: Selected ${this.name}`);

        // Show bone visualization when selected
        this.showBoneVisualization(true);
    }

    /**
     * Called when the entity is deselected in the editor
     */
    public onDeselect(): void {
        console.log(`CharacterEntity: Deselected ${this.name}`);

        // Hide bone visualization when deselected
        this.showBoneVisualization(false);
    }

    // --- Serialization ---
    public serialize(): SerializedCharacterEntityData {
        // Serialize bone rotations
        const boneRotations: Record<string, { x: number, y: number, z: number, w: number }> = {};

        if (this.skeleton) {
            this.skeleton.bones.forEach(bone => {
                boneRotations[bone.name] = {
                    x: bone.quaternion.x,
                    y: bone.quaternion.y,
                    z: bone.quaternion.z,
                    w: bone.quaternion.w
                };
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
        scene: THREE.Scene,
        data: SerializedCharacterEntityData,
    ): Promise<CharacterEntity> {
        try {
            console.log("Deserializing character:", data.name, data.entityId);
            const entity = new CharacterEntity(scene, data.name, data.entityId, data.characterProps);

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

            entity.scale.x = data.scaling.x;
            entity.scale.y = data.scaling.y;
            entity.scale.z = data.scaling.z;

            // Apply saved bone rotations if available
            if (data.boneRotations && entity.skeleton) {
                console.log("Applying bone rotations");

                // First ensure all bones have their initial transforms updated
                entity.skeleton.bones.forEach(bone => bone.updateMatrixWorld(true));
                entity.skeleton.update();

                // Apply rotations in a try/catch to prevent errors from breaking deserialization
                try {
                    Object.entries(data.boneRotations).forEach(([boneName, rotation]) => {
                        const bone = entity.skeleton!.bones.find(b => b.name === boneName);
                        if (bone) {
                            bone.quaternion.set(
                                rotation.x,
                                rotation.y,
                                rotation.z,
                                rotation.w
                            );
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
            const fallbackEntity = new CharacterEntity(scene, data.name, data.entityId, data.characterProps);
            await fallbackEntity.waitUntilReady();
            return fallbackEntity;
        }
    }

    // Dispose all resources
    public dispose(): void {
        this.children.forEach(child => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });

        this._boneMap.forEach(({ control, lineConfigs }) => {
            control.dispose();
            lineConfigs.forEach(({ line }) => {
                line.geometry.dispose();
            });
        });

        this.skeleton?.dispose();

        this._isDisposed = true;

        super.dispose();
    }

    public delete(): void {
        super.delete();
        // Hide all bones
        this.showBoneVisualization(false);
    }

    public undoDelete(): void {
        super.undoDelete();
    }
} 
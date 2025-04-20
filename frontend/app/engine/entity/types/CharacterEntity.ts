import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { EntityBase, EntityType, SerializedEntityData } from '../base/EntityBase';
import { trackEvent, ANALYTICS_EVENTS } from '@/engine/utils/external/analytics';
import { BoneControl } from '../components/BoneControl';
import { setupMeshShadows } from '@/engine/utils/lightUtil';
import { loadModelFromUrl } from '@/engine/utils/3dModelUtils';

export interface CharacterEntityProps {
    url: string;
    name?: string;
}

export interface SerializedCharacterEntityData extends SerializedEntityData {
    entityType: 'character';
    characterProps: CharacterEntityProps;
    boneRotations?: boneRotations;
}

type boneRotations = Record<string, { x: number, y: number, z: number, w: number }>;

export class CharacterEntity extends EntityBase {
    public skeleton: THREE.Skeleton | null = null;
    public characterProps: CharacterEntityProps;
    public rootMesh: THREE.Object3D | null = null;
    public initialBoneRotations: Map<string, THREE.Quaternion> = new Map();
    public animations: THREE.AnimationClip[] = [];
    public animationMixer: THREE.AnimationMixer | null = null;
    public currentAnimationAction: THREE.AnimationAction | null = null;

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
    private static boneControlSize = 0.05;

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
        data: SerializedCharacterEntityData,
        onLoaded?: (entity: EntityBase) => void) {

        super(name, scene, 'character', data);
        this.characterProps = data.characterProps;

        // Track character creation
        trackEvent(ANALYTICS_EVENTS.CREATE_ENTITY, {
            type: 'character',
            modelUrl: data.characterProps.url
        });

        this._loadingPromise = this._loadCharacter((entity) => {
            if (data.boneRotations) {
                this._applyBoneRotationsFromData(data.boneRotations);
            }
            onLoaded?.(entity);
        });

        // Create visualization material
        this._createMaterials(scene);
    }

    private _applyBoneRotationsFromData(boneRotations: boneRotations) {
        try {
            // Apply saved bone rotations if available
            if (!this.skeleton) {
                throw new Error("Skeleton not found");
            }

            // First ensure all bones have their initial transforms updated
            this.skeleton.bones.forEach(bone => bone.updateMatrixWorld(true));
            this.skeleton.update();

            // Apply rotations in a try/catch to prevent errors from breaking deserialization
            try {
                Object.entries(boneRotations).forEach(([boneName, rotation]) => {
                    const bone = this.skeleton!.bones.find(b => b.name === boneName);
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
        } catch (error) {
            console.error("Error during character deserialization:", error);
        }
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
            // Use the unified loading function
            const result = await loadModelFromUrl(this.characterProps.url, (progress) => {
                console.log(`Loading character: ${progress.message || 'in progress...'}`);
            });

            console.log("CharacterEntity: Model load result:", result);

            if (result.rootMesh) {
                this.rootMesh = result.rootMesh;
                this.add(this.rootMesh); // Add to this entity
                this.rootMesh.name = `${this.name}_meshRoot`;

                // Set metadata for all meshes
                this.rootMesh.traverse(object => {
                    if (object instanceof THREE.Mesh) {
                        object.userData.rootSelectable = this;
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

                // Handle animations
                this.animations = result.animations || [];
                if (this.animations.length > 0) {
                    // create animation mixer and store animations for future use
                    this.animationMixer = new THREE.AnimationMixer(this.rootMesh);
                    this.currentAnimationAction = this.animationMixer.clipAction(this.animations[this.animations.length - 1]);
                    this.currentAnimationAction.play();
                    this.engine.addMixer(this.uuid, this.animationMixer);
                    setTimeout(() => {
                        if (this.currentAnimationAction) {
                            this.currentAnimationAction.paused = true;
                        }
                    }, 5);
                }

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

    public getBoneControls(): BoneControl[] {
        return Array.from(this._boneMap.values()).map(({ control }) => control);
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
                    // Quick hack to keep initial size consistent
                    diameter: CharacterEntity.boneControlSize / 2 / (this.rootMesh?.scale.x || 1),
                }
            );

            // Hide initially
            boneControl.mesh.visible = false;

            if (!this._drawLines) {
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
                line.visible = false;
                boneControl.add(line);

                // Set position of line to the bone control
                line.position.copy(boneControl.position);

                // Set points of line to the bone control and child bone
                const points = [
                    boneControl.position,
                    childBone.position
                ];
                geometry.setFromPoints(points);

                // Prevent line from being pickable by raycaster without using layers
                line.raycast = () => { }; // Empty raycast function prevents picking
                line.userData.notSelectable = true; // Flag for additional filtering if needed
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
        this._boneMap.forEach(({ control, bone, lineConfigs }) => {
            control.position.copy(bone.position);
            control.quaternion.copy(bone.quaternion);
        });
    }

    /**
     * Shows or hides the bone visualization
     */
    public showBoneVisualization(visible: boolean): void {
        this._isVisualizationVisible = visible;

        // Update visibility of bone controls
        this._boneMap.forEach(({ control, lineConfigs }) => {
            control.mesh.visible = visible;
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
        // Stop all animations
        this.engine.removeMixer(this.uuid);
    }

    public undoDelete(): void {
        super.undoDelete();
    }

} 
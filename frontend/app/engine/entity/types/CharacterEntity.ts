import * as THREE from 'three';
import { EntityBase, EntityType, SerializedEntityData } from '../base/EntityBase';
import { trackEvent, ANALYTICS_EVENTS } from '@/engine/utils/external/analytics';
import { BoneControl } from '../components/BoneControl';
import { setupMeshShadows } from '@/engine/utils/lightUtil';
import { loadModelFromUrl } from '@/engine/utils/3dModelUtils';
import { characterDatas, getAnimationPathsById, getModelPathById, ICharacterData, mixamoAnimationPaths } from '@/engine/data/CharacterData';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { setWorldScale } from '@/engine/utils/transformUtils';

export interface CharacterEntityProps {
    modelUrl?: string;
    builtInModelId?: string;
    name?: string;
    color?: string;
}

export interface SerializedCharacterEntityData extends SerializedEntityData {
    entityType: 'character';
    characterProps: CharacterEntityProps;
    boneTransforms?: boneTransforms;
}

interface IBoneTransform {
    quaternion: { x: number, y: number, z: number, w: number };
    position?: { x: number, y: number, z: number };
}
type boneTransforms = Record<string, IBoneTransform>;

export class CharacterEntity extends EntityBase {
    public mainSkeleton: THREE.Skeleton | null = null;
    public mainSkinnedMesh: THREE.SkinnedMesh | null = null;
    public characterProps: CharacterEntityProps;
    public rootMesh: THREE.Object3D | null = null;
    public meshes: THREE.Mesh[] = [];
    // public initialBoneRotations: Map<string, THREE.Quaternion> = new Map();
    public modelAnimations: THREE.AnimationClip[] = [];
    public animationFiles: string[] = [];
    public animationMixer: THREE.AnimationMixer | null = null;
    public currentAnimationAction: THREE.AnimationAction | null = null;

    private _isLoading = false;
    private _isDisposed = false;
    private _loadingPromise: Promise<void> | null = null;
    private _isVisualizationVisible = false;
    private _drawLines = true;
    private _builtInCharacterData: ICharacterData | null = null;

    // Bone visualization materials
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
        initialData: SerializedCharacterEntityData,
        onLoaded?: (entity: EntityBase) => void) {

        super(name, scene, 'character', initialData);
        this.characterProps = initialData.characterProps;

        if (!this.characterProps.modelUrl && !this.characterProps.builtInModelId) {
            throw new Error("No model URL or built-in model ID provided for character: " + this.name);
        }

        // Get built-in character data
        if (initialData.characterProps.builtInModelId) {
            const characterData = characterDatas.get(initialData.characterProps.builtInModelId);
            if (characterData) { this._builtInCharacterData = characterData; }
        }

        // Track character creation
        trackEvent(ANALYTICS_EVENTS.CREATE_ENTITY, {
            type: 'character',
            modelUrl: initialData.characterProps.modelUrl
        });

        // Create visualization material
        this._createDefaultMaterials(scene);

        // Load character model
        this._loadingPromise = this._loadCharacterModel(initialData, (entity) => {
            onLoaded?.(entity);
        });
    }

    private _createDefaultMaterials(scene: THREE.Scene): void {
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


    private async _loadCharacterModel(initialData: SerializedCharacterEntityData, onLoaded?: (entity: EntityBase) => void): Promise<void> {

        this._isLoading = true;
        console.log(`Loading character from: ${this.characterProps.modelUrl}`);

        try {
            const modelUrl = this.characterProps.modelUrl || getModelPathById(this.characterProps.builtInModelId);
            // Use the unified loading function
            const result = await loadModelFromUrl(modelUrl, (progress) => {
                console.log(`Loading character: ${progress.message || 'in progress...'}`);
            });


            console.log("CharacterEntity: Model load result:", result);

            let skeletonFound = false;

            if (result.rootMesh) {
                this.rootMesh = result.rootMesh;
                this.add(this.rootMesh); // Add to this entity
                this.rootMesh.name = `${this.rootMesh.name}_rootMesh`;

                // Traverse all child meshes
                this.rootMesh.traverse(object => {
                    // Set metadata for all child meshes
                    if (object instanceof THREE.Mesh) {
                        this.meshes.push(object);
                        object.userData = {
                            ...object.userData,
                            rootSelectable: this
                        };
                    }

                    // Find the main skinnedMesh and skeleton, and setup the bone visualization
                    if (object instanceof THREE.SkinnedMesh && object.skeleton && !skeletonFound) {


                        const extraMeshesName = ["eye", "teeth", "tongue", "head", "hair"]
                        let shouldSkip = false;
                        extraMeshesName.forEach(name => {
                            if (object.name.includes(name)) {
                                shouldSkip = true;
                            }
                        });

                        if (shouldSkip) { return; }

                        this.mainSkeleton = object.skeleton;
                        this.mainSkinnedMesh = object;
                        skeletonFound = true;
                        console.log(`CharacterEntity: ${this.name} loaded with skeleton: ${this.mainSkeleton.uuid}`);

                        // Create bone visualization elements
                        this._createBoneVisualization();
                    }
                });


                if (!skeletonFound) {
                    console.warn(`Character ${this.name} loaded but no skeleton found.`);
                }

                // Handle model animations
                this.animationFiles = getAnimationPathsById(this.characterProps.builtInModelId);
                
                // TODO: Hack to remove Take 001 (Usually the mixamo TPose)
                this.modelAnimations = result.animations.filter(animation => !animation.name.includes("Take 001"));

                // Create animation mixer, if any animations are found
                const hasAnimations = this.animationFiles.length + this.modelAnimations.length > 0;
                if (hasAnimations) {
                    this.animationMixer = new THREE.AnimationMixer(this.rootMesh);
                    this.engine.addMixer(this.uuid, this.animationMixer);
                }

                if (initialData.boneTransforms) {
                    // Apply saved bone rotations stored in project
                    this._applyBoneTransforms(initialData.boneTransforms);
                } else {
                    // Set pose to the default modelAnimations animation
                    if (this.modelAnimations.length > 0) {
                        this.currentAnimationAction = this.animationMixer.clipAction(this.modelAnimations[this.modelAnimations.length - 1]);
                        this.currentAnimationAction.play();
                        this.currentAnimationAction.paused = true;
                        this._updateBoundingBox();
                    }
                }


                onLoaded?.(this);
            } else {
                console.error(`No scene loaded for character ${this.name}`);
            }

            // Create meshStandardMaterial for built-in models
            const isBuiltIn = this.characterProps.builtInModelId !== null && this.characterProps.builtInModelId !== undefined;
            if (isBuiltIn) {
                this.meshes.forEach(mesh => {
                    if (!(mesh.material instanceof THREE.MeshStandardMaterial)) {
                        console.log("CharacterEntity: replace with meshStandardMaterial", mesh.name);
                        const newMaterial = new THREE.MeshStandardMaterial();
                        newMaterial.roughness = 0;
                        newMaterial.metalness = 0;
                        newMaterial.opacity = 1;
                        newMaterial.transparent = false;
                        mesh.material = newMaterial;
                    }
                });
            }

            // Apply initial color to materials if set
            this.setCharacterColor(this.characterProps.color || "#ffffff");
        } catch (error) {
            console.error(`Error loading character model: ${error}`);
        } finally {
            this._isLoading = false;
        }
    }

    private _applyBoneTransforms(boneTransforms: boneTransforms) {
        try {
            // Apply saved bone rotations if available
            if (!this.mainSkeleton) {
                throw new Error("Skeleton not found");
            }

            // First ensure all bones have their initial transforms updated
            this.mainSkeleton.bones.forEach(bone => bone.updateMatrixWorld(true));
            this.mainSkeleton.update();

            // Apply rotations in a try/catch to prevent errors from breaking deserialization
            try {
                Object.entries(boneTransforms).forEach(([boneName, transformData]) => {
                    const bone = this.mainSkeleton!.bones.find(b => b.name === boneName);
                    if (bone) {
                        bone.quaternion.set(
                            transformData.quaternion.x,
                            transformData.quaternion.y,
                            transformData.quaternion.z,
                            transformData.quaternion.w
                        );
                        if (transformData.position) {
                            bone.position.set(
                                transformData.position.x,
                                transformData.position.y,
                                transformData.position.z
                            );
                        }
                    }
                });
                
                // Update matrix world of the whole character and bounding box
                this.updateMatrixWorld(true);
                this._updateBoundingBox();

            } catch (rotErr) {
                console.error("Error applying bone rotations:", rotErr);
            }
        } catch (error) {
            console.error("Error during character deserialization:", error);
        }
    }

    public getBoneControls(): BoneControl[] {
        return Array.from(this._boneMap.values()).map(({ control }) => control);
    }

    /**
     * Reset all bones to their initial rotations
     */
    public resetAllBones(): void {
        if (!this.mainSkeleton) return;

        // this.mainSkeleton.bones.forEach(bone => {
        //     const initialRotation = this.initialBoneRotations.get(bone.name);
        //     if (initialRotation) {
        //         bone.quaternion.copy(initialRotation);
        //     }
        // });

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
     * Check if the bone is ignorable
     */
    private _isIgnorableBone(bone: THREE.Bone): boolean {
        const toIgnore = ["thumb", "index", "middle", "ring", "pinky", "eye", "_end"];
        const boneName = bone.name.toLowerCase();
        return toIgnore.some(name => boneName.includes(name));
    }

    /**
     * Creates visualization elements for the skeleton's bones
     */
    private _createBoneVisualization(): void {
        if (!this.mainSkeleton) return;

        // Bounding size
        const boundingSphere = this.mainSkinnedMesh?.boundingSphere;

        // Create bone control spheres for each bone
        this.mainSkeleton.bones.forEach(bone => {
            // Skip fingers and other small bones for cleaner visualization
            if (this._isIgnorableBone(bone)) {
                return;
            }
            // Create a BoneControl for this bone
            const boneControl = new BoneControl(
                `boneCtrl_${bone.name}`,
                this.engine.getScene(),
                bone,
                this,
                {
                    // Quick hack to keep initial size consistent
                    diameter: CharacterEntity.boneControlSize / 2 / (boundingSphere?.radius || 1),
                }
            );

            console.log("CharacterEntity: _createBoneVisualization", bone.name, boneControl.mesh.scale.x);

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
                if (this._isIgnorableBone(childBone)) {
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
                    new THREE.Vector3(0, 0, 0),
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

        // Sync the position and rotation of the bone control to the bone
        this._boneMap.forEach(({ control, bone, lineConfigs }) => {
            // Update position and rotation
            control.position.copy(bone.position);
            control.quaternion.copy(bone.quaternion);

            // Update size
            setWorldScale(control.mesh, new THREE.Vector3(1, 1, 1));

            // Update line positions
            lineConfigs.forEach(({ line, targetBone }) => {
                line.geometry.setFromPoints([new THREE.Vector3(0, 0, 0), targetBone.position]);
                line.updateMatrixWorld();
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
        const boneTransforms: boneTransforms = {};

        if (this.mainSkeleton) {
            this.mainSkeleton.bones.forEach(bone => {

                // Only save the rotation for now
                boneTransforms[bone.name] = {
                    quaternion: {
                        x: bone.quaternion.x,
                        y: bone.quaternion.y,
                        z: bone.quaternion.z,
                        w: bone.quaternion.w
                    },
                };

                // Hack to keep the hip bone in place
                if (bone.name.toLowerCase().includes("hip")) {
                    boneTransforms[bone.name].position = {
                        x: bone.position.x,
                        y: bone.position.y,
                        z: bone.position.z
                    };
                }
            });
        }

        return {
            ...super.serialize(),
            entityType: 'character',
            characterProps: {
                ...this.characterProps,
                color: this.characterProps.color
            },
            boneTransforms
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

        this.mainSkeleton?.dispose();

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

    public selectModelAnimation(index: number, isPlaying: boolean): void {
        if (this.modelAnimations && this.modelAnimations.length > index && this.animationMixer) {
            // Stop current animation
            if (this.currentAnimationAction) {
                this.currentAnimationAction.stop();
            }
            // Start new animation
            const newAction = this.animationMixer.clipAction(this.modelAnimations[index]);
            this.currentAnimationAction = newAction;
            newAction.play();
            newAction.paused = !isPlaying;
            this._updateBoundingBox();
        }
    }

    private _updateBoundingBox(): void {
        if (!this.mainSkinnedMesh) {
            return;
        }
        this.mainSkinnedMesh.computeBoundingBox();
        this.mainSkinnedMesh.computeBoundingSphere();
    }

    public async selectAnimationFile(index: number, playOnLoaded: boolean): Promise<void> {

        console.log("CharacterEntity: selectAnimationFile", index, playOnLoaded, this.animationFiles, this.animationMixer);

        if (!this.animationFiles || !this.animationMixer) {
            console.error("CharacterEntity: selectAnimationFile: no animations files or animation mixer");
            return;
        }
        if (this.animationFiles.length <= index) {
            console.error("CharacterEntity: selectAnimationFile: index out of range");
            return;
        }

        // Stop current animation
        if (this.currentAnimationAction) {
            this.currentAnimationAction.stop();
        }

        // Load animation file
        const animationFilePath = this.animationFiles[index];
        const animation = await this.loadAnimationFromFbxFile(animationFilePath);

        // Create new animation action
        const newAction = this.animationMixer.clipAction(animation);

        // Store the new animation action
        this.currentAnimationAction = newAction;

        // Play the new animation
        newAction.play();
        newAction.paused = !playOnLoaded;
    }

    private async loadAnimationFromFbxFile(url: string): Promise<THREE.AnimationClip> {
        const fbxLoader = new FBXLoader();
        const result = await fbxLoader.loadAsync(url);
        if (result.animations == null || result.animations.length == 0) {
            throw new Error("CharacterEntity: loadAnimationFromFbxFile: no animations found");
        }
        return result.animations[0];
    }


    /**
     * Applies a color string to a material or array of materials.
     * @param material The material or array of materials.
     * @param colorString The color string (e.g., "#ff0000").
     */
    private _applyColorToMesh(mesh: THREE.Mesh, colorString: string): void {

        // TODO: hack to not apply color to eyes
        if (mesh.name.toLocaleLowerCase().includes("eye")) {
            return;
        }

        const material = mesh.material;
        const newColor = new THREE.Color(colorString);

        // Log material type
        console.log("CharacterEntity: _applyColorToMaterial", typeof material);

        if (Array.isArray(material)) {
            material.forEach(mat => {
                if ('color' in mat) {
                    (mat as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial | THREE.MeshPhongMaterial).color.set(newColor);
                }
            });
        } else if ('color' in material) {
            (material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial | THREE.MeshPhongMaterial).color.set(newColor);
        }
    }

    /**
     * Sets the color of the character's main materials.
     * @param colorString The color string (e.g., "#ff0000").
     */
    public setCharacterColor(colorString: string): void {
        this.characterProps.color = colorString;
        this.meshes.forEach(mesh => {
            // Apply color to materials
            if (mesh.material) { this._applyColorToMesh(mesh, colorString); }
        });
        // Track color change
        trackEvent(ANALYTICS_EVENTS.CHANGE_SETTINGS, {
            entityType: 'character',
            action: 'set_color',
            color: colorString
        });
    }
} 
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
    private _isLoading = false;
    private _isDisposed = false;
    private _loadingPromise: Promise<void> | null = null;
    public rootMesh: THREE.Object3D | null = null;
    public initialBoneRotations: Map<string, THREE.Quaternion> = new Map();

    // Bone visualization properties
    private _boneMap: Map<string, { bone: THREE.Bone, control: BoneControl }> = new Map();
    private _boneLines: Map<string, THREE.Line> = new Map();
    public _visualizationMaterial: THREE.Material | null = null;
    public _highlightMaterial: THREE.Material | null = null;
    private _boneColor = new THREE.Color(0.5, 0.7, 1.0);
    private _selectedBone: THREE.Bone | null = null;
    private _selectedControl: BoneControl | null = null;
    private _isVisualizationVisible = false;
    private _boneMaterialAlpha = 0.5;
    private _linesMaterialAlpha = 0.7;

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
        this._createVisualizationMaterials(scene);
    }

    private _createVisualizationMaterials(scene: THREE.Scene): void {
        // Create standard material for bones
        this._visualizationMaterial = new THREE.MeshStandardMaterial({
            color: this._boneColor,
            emissive: this._boneColor,
            transparent: true, 
            opacity: this._boneMaterialAlpha,
            depthWrite: false
        });

        // Create highlight material for selected bones
        this._highlightMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(1, 0.5, 0),
            emissive: new THREE.Color(1, 0.5, 0),
            transparent: true, 
            opacity: 0.8,
            depthWrite: false
        });
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
                        console.log(`Character ${this.name} loaded with skeleton: ${this.skeleton.name}`);

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

                setupMeshShadows(this.rootMesh);
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
    private _createBoneVisualization(): void {
        if (!this.skeleton) return;

        // Create bone control spheres for each bone
        this.skeleton.bones.forEach(bone => {
            // Skip fingers and other small bones for cleaner visualization
            const boneName = bone.name.toLowerCase();
            if (boneName.includes('finger') || boneName.includes('thumb') ||
                boneName.includes('toe') || boneName.includes('eye')) {
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
                    material: this._visualizationMaterial || undefined
                }
            );

            // Position at the bone's world position
            bone.getWorldPosition(boneControl.position);

            // Hide initially
            boneControl.visible = false;

            // Store in bone map
            this._boneMap.set(bone.name, { bone, control: boneControl });
        });

        // Create bone lines to visualize the skeleton structure
        this.skeleton.bones.forEach(bone => {
            const childBones = bone.children.filter(child => child instanceof THREE.Bone) as THREE.Bone[];

            if (childBones.length > 0) {
                childBones.forEach(childBone => {
                    // Only create lines if both bones have controls
                    if (this._boneMap.has(bone.name) && this._boneMap.has(childBone.name)) {
                        const lineName = `line_${bone.name}_to_${childBone.name}_${this.id}`;

                        // Create line geometry
                        const points = [
                            new THREE.Vector3(0, 0, 0),
                            new THREE.Vector3(0, 0, 0)
                        ];
                        const geometry = new THREE.BufferGeometry().setFromPoints(points);
                        
                        // Create line material
                        const material = new THREE.LineBasicMaterial({
                            color: this._boneColor,
                            transparent: true,
                            opacity: this._linesMaterialAlpha
                        });
                        
                        // Create line mesh
                        const line = new THREE.Line(geometry, material);
                        line.name = lineName;
                        line.visible = false;
                        
                        // Add to scene
                        this.engine.getScene().add(line);

                        // Store in bone lines map
                        this._boneLines.set(lineName, line);
                    }
                });
            }
        });
    }

    /**
     * Updates position of all bone lines to match current skeleton pose
     */
    public updateBoneVisualization(): void {
        if (!this._isVisualizationVisible) return;
        if (this._isDisposed) return;
        console.log("CharacterEntity: Updating bone lines", this.name);

        if (this.skeleton) {
            this.skeleton.bones.forEach(bone => {
                // Update control position to match bone
                const boneControl = this._boneMap.get(bone.name)?.control;
                if (boneControl) {
                    bone.getWorldPosition(boneControl.position);
                    boneControl.quaternion.copy(bone.quaternion);
                }
                
                // Update lines between bones
                const childBones = bone.children.filter(child => child instanceof THREE.Bone) as THREE.Bone[];
                
                childBones.forEach(childBone => {
                    // Only update if both bones have controls
                    if (this._boneMap.has(bone.name) && this._boneMap.has(childBone.name)) {
                        const lineName = `line_${bone.name}_to_${childBone.name}_${this.id}`;
                        const line = this._boneLines.get(lineName);

                        if (line) {
                            const parentPosition = new THREE.Vector3();
                            const childPosition = new THREE.Vector3();
                            
                            bone.getWorldPosition(parentPosition);
                            childBone.getWorldPosition(childPosition);

                            // Update line geometry
                            const points = [parentPosition, childPosition];
                            const geometry = new THREE.BufferGeometry().setFromPoints(points);
                            line.geometry.dispose();
                            line.geometry = geometry;
                        }
                    }
                });
            });
        }
    }

    /**
     * Shows or hides the bone visualization
     */
    public showBoneVisualization(visible: boolean): void {
        this._isVisualizationVisible = visible;

        // Update visibility of bone controls
        this._boneMap.forEach(({ control }) => {
            control.visible = visible;
        });

        // Update visibility of bone lines
        this._boneLines.forEach(line => {
            line.visible = visible;
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
        
        // Set up gizmo integration and input handling here
        // This will need adapting for the Three.js input system
    }

    /**
     * Called when the entity is deselected in the editor
     */
    public onDeselect(): void {
        console.log(`CharacterEntity: Deselected ${this.name}`);
        
        // Deselect any selected bone
        this._deselectBone();
        
        // Hide bone visualization when deselected
        this.showBoneVisualization(false);
    }

    /**
     * Select a bone and its control
     */
    public selectBone(bone: THREE.Bone, control: BoneControl): void {
        // Deselect previous bone
        this._deselectBone();

        // Select new bone
        this._selectedBone = bone;
        this._selectedControl = control;

        // Highlight the selected control
        if (this._highlightMaterial) {
            control.material = this._highlightMaterial;
        }

        // Track bone selection
        trackEvent(ANALYTICS_EVENTS.CHARACTER_EDIT, {
            action: 'select_bone',
            boneName: bone.name
        });

        console.log(`Selected bone: ${bone.name}`);
    }

    /**
     * Deselect the current bone
     */
    private _deselectBone(): void {
        if (this._selectedBone && this._selectedControl) {
            // Reset control appearance
            if (this._visualizationMaterial) {
                this._selectedControl.material = this._visualizationMaterial;
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
        this.getChildMeshes().forEach(mesh => {
            mesh.dispose();
        });

        this._boneMap.forEach(({ control }) => {
            control.dispose();
        });

        this._boneLines.forEach(line => {
            if (line.geometry) line.geometry.dispose();
            if (line.material) {
                if (Array.isArray(line.material)) {
                    line.material.forEach(m => m.dispose());
                } else {
                    line.material.dispose();
                }
            }
            line.parent?.remove(line);
        });

        if (this._visualizationMaterial) {
            this._visualizationMaterial.dispose();
        }
        
        if (this._highlightMaterial) {
            this._highlightMaterial.dispose();
        }

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
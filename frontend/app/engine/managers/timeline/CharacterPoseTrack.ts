import * as THREE from 'three';
import { EntityBase } from '../../entity/base/EntityBase';
import { CharacterEntity } from '@/engine/entity/types/CharacterEntity';
import { Track, IKeyframe } from './Track';
import { BoneControl } from '@/engine/entity/components/BoneControl';

// Character Pose keyframe - storing only modified bones for efficiency
export interface CharacterPoseKeyframe extends IKeyframe<{
    bones: {
        [boneName: string]: {
            position?: THREE.Vector3;
            quaternion?: THREE.Quaternion;
        }
    }
}> {}

// Add a new CharacterPoseTrack class implementation
export class CharacterPoseTrack extends Track<CharacterPoseKeyframe> {
    protected target: CharacterEntity;
    
    constructor(name: string, character: CharacterEntity) {
        super(name, character);
        this.target = character;
    }
    
    public addKeyframe(time: number): CharacterPoseKeyframe {
        const character = this.target as CharacterEntity;
        const boneControls = character.getBoneControls();
        
        // Create a data object that only includes modified bones
        const boneData: {[boneName: string]: {
            position?: THREE.Vector3,
            quaternion?: THREE.Quaternion
        }} = {};
        
        // Get all bones and compare with initial rotations to find modified ones
        boneControls.forEach(boneControl => {
            const initialRotation = character.initialBoneRotations.get(boneControl.bone.name);
            
            // Only store bones that have been modified from their initial state
            if (initialRotation && !boneControl.bone.quaternion.equals(initialRotation)) {
                boneData[boneControl.bone.name] = {
                    quaternion: boneControl.bone.quaternion.clone()
                };
                
                // Only include position if it's not at origin (optimization)
                if (!boneControl.position.equals(new THREE.Vector3(0, 0, 0))) {
                    boneData[boneControl.bone.name].position = boneControl.position.clone();
                }
            }
        });
        
        // Create the keyframe
        const keyframe: CharacterPoseKeyframe = {
            track: this,
            time,
            data: {
                bones: boneData
            }
        };
        
        // Check if a keyframe already exists at this time
        const existingIndex = this.keyframes.findIndex(kf => Math.abs(kf.time - time) < 0.01);
        if (existingIndex >= 0) {
            // Replace existing keyframe
            this.keyframes[existingIndex] = keyframe;
            console.log(`CharacterPoseTrack: Updated keyframe at position ${time}`);
        } else {
            // Add new keyframe and sort by time
            this.keyframes.push(keyframe);
            this.keyframes.sort((a, b) => a.time - b.time);
            console.log(`CharacterPoseTrack: Added keyframe at position ${time}`);
        }

        console.log(`CharacterPoseTrack: Added Keyframe at position ${time}`, keyframe);
        
        return keyframe;
    }
    
    public deserializeKeyframe(time: number, serializedData: any): CharacterPoseKeyframe {
        // Create a new keyframe with deserialized data
        const bones: {[boneName: string]: {
            position?: THREE.Vector3,
            quaternion?: THREE.Quaternion
        }} = {};
        
        // Deserialize each bone transform
        if (serializedData.bones) {
            Object.entries(serializedData.bones).forEach(([boneName, boneData]: [string, any]) => {
                bones[boneName] = {};
                
                // Convert position array to Vector3 if it exists
                if (boneData.position) {
                    bones[boneName].position = new THREE.Vector3().fromArray(boneData.position);
                }
                
                // Convert quaternion array to Quaternion if it exists
                if (boneData.quaternion) {
                    bones[boneName].quaternion = new THREE.Quaternion().fromArray(boneData.quaternion);
                }
            });
        }
        
        return {
            track: this,
            time,
            data: {
                bones: bones
            }
        };
    }
    
    public updateTargetAtTime(time: number): void {
        const character = this.target as CharacterEntity;
        const { before, after } = this.getSurroundingKeyframes(time);
        
        if (!before && !after) {
            // No keyframes, nothing to do
            return;
        }
        
        if (before && !after) {
            // Only have keyframes before current time, apply last keyframe
            this.applyKeyframe(before);
            return;
        }
        
        if (!before && after) {
            // Only have keyframes after current time, apply first keyframe
            this.applyKeyframe(after);
            return;
        }
        
        // Have keyframes before and after, interpolate
        if (before && after) {
            const t = (time - before.time) / (after.time - before.time);
            this.interpolateKeyframes(before, after, t);
        }
    }
    
    private applyKeyframe(keyframe: CharacterPoseKeyframe): void {
        const character = this.target as CharacterEntity;
        const boneControls = character.getBoneControls();
        
        // Apply bone transforms from keyframe
        for (const [boneName, boneTransform] of Object.entries(keyframe.data.bones)) {
            const boneControl = boneControls.find(bc => bc.bone.name === boneName);
            if (boneControl) {
                this.applyTransform(boneControl, { position: boneTransform.position, quaternion: boneTransform.quaternion });
            }
        }

        console.log(`CharacterPoseTrack: Applied Keyframe at position ${keyframe.time}`, keyframe);
        
        // Critical: Update the entire skeleton after all bones have been modified
        if (character.mainSkeleton) {
            character.mainSkeleton.bones.forEach(bone => {
                // Force update the bone's world matrix
                bone.updateMatrixWorld(true);
            });
            
            // Update the skeleton to reflect bone changes
            character.mainSkeleton.update();
        }
        
        // Update character's bone visualization
        character.updateBoneVisualization();
    }
    
    private interpolateKeyframes(start: CharacterPoseKeyframe, end: CharacterPoseKeyframe, t: number): void {
        const character = this.target as CharacterEntity;
        const boneControls = character.getBoneControls();
        
        // Get unique set of all bone names from both keyframes
        const boneNames = new Set([
            ...Object.keys(start.data.bones),
            ...Object.keys(end.data.bones)
        ]);
        
        // Create a temporary quaternion for interpolation
        const tempQuaternion = new THREE.Quaternion();
        const tempPosition = new THREE.Vector3();
        
        // Process each bone
        boneNames.forEach(boneName => {
            const boneControl = boneControls.find(bc => bc.bone.name === boneName);
            if (!boneControl) return;
            
            const startTransform = start.data.bones[boneName];
            const endTransform = end.data.bones[boneName];
            
            let newQuaternion: THREE.Quaternion | undefined = undefined;
            // Handle quaternion interpolation
            if (startTransform?.quaternion && endTransform?.quaternion) {
                // Both keyframes have rotation for this bone, interpolate
                tempQuaternion.slerpQuaternions(startTransform.quaternion, endTransform.quaternion, t);
                newQuaternion = tempQuaternion.clone();
            } else if (startTransform?.quaternion) {
                // Only start keyframe has rotation
                newQuaternion = startTransform.quaternion.clone();
            } else if (endTransform?.quaternion) {
                // Only end keyframe has rotation
                newQuaternion = endTransform.quaternion.clone();
            }
            
            let newPosition: THREE.Vector3 | undefined = undefined;
            // Handle position interpolation
            if (startTransform?.position && endTransform?.position) {
                // Both keyframes have position for this bone, interpolate
                tempPosition.lerpVectors(startTransform.position, endTransform.position, t);
                newPosition = tempPosition.clone();
            } else if (startTransform?.position) {
                // Only start keyframe has position
                newPosition = startTransform.position.clone();
            } else if (endTransform?.position) {
                // Only end keyframe has position
                newPosition = endTransform.position.clone();
            }

            this.applyTransform(boneControl, { position: newPosition, quaternion: newQuaternion });
            
        });

        console.log(`CharacterPoseTrack: Interpolated Keyframes at position ${start.time} and ${end.time}`, start, end);
        
        // At the end, add these critical updates:
        if (character.mainSkeleton) {
            character.mainSkeleton.bones.forEach(bone => {
                bone.updateMatrixWorld(true);
            });
            character.mainSkeleton.update();
        }
        
        // Update character's bone visualization
        character.updateBoneVisualization();
    }

    private applyTransform(boneControl: BoneControl, transform: { position?: THREE.Vector3, quaternion?: THREE.Quaternion }): void {
        console.log(`CharacterPoseTrack: applyTransform ${boneControl.bone.name}`, transform.quaternion);

        if (transform.position) {
            boneControl.position.copy(transform.position);
            boneControl.bone.position.copy(transform.position);
        }

        if (transform.quaternion) {
            boneControl.quaternion.copy(transform.quaternion);
            boneControl.bone.quaternion.copy(transform.quaternion);
        }

        // Critical: Update the bone's matrix
        boneControl.bone.updateMatrix();
    }
}
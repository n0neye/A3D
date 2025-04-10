import * as THREE from 'three';
import { EntityBase } from '../../entity/base/EntityBase';

// Define base keyframe interface with generic type parameter
export interface IKeyframe<T = any> {
    track: Track<any>;
    time: number;
    data: T;
}

// Camera keyframe with specific data type
export interface CameraKeyframe extends IKeyframe<{
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    fov: number;
}> {}

// Object keyframe with specific data type
export interface EntityTransform extends IKeyframe<{
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    scale: THREE.Vector3;
}> {}

// Define base track class
export abstract class Track<T extends IKeyframe> {
    protected keyframes: T[] = [];
    protected target: EntityBase | THREE.Camera;
    protected name: string;
    public isActive: boolean = false;

    constructor(name: string, target: any) {
        this.name = name;
        this.target = target;
    }

    // Abstract methods that must be implemented by subclasses
    abstract addKeyframe(time: number): T;
    abstract updateTargetAtTime(time: number): void;
    
    // New method to support serialization
    abstract deserializeKeyframe(time: number, serializedData: any): T;

    public getName(): string {
        return this.name;
    }

    public getTarget(): EntityBase | THREE.Camera {
        return this.target;
    }

    public getKeyframes(): T[] {
        return this.keyframes;
    }

    public removeKeyframe(keyframe: IKeyframe): void {
        const index = this.keyframes.findIndex(kf => kf === keyframe);
        if (index >= 0) {
            this.keyframes.splice(index, 1);
        }
    }

    public removeKeyframeAt(time: number): boolean {
        const index = this.keyframes.findIndex(kf => Math.abs(kf.time - time) < 0.01);
        if (index >= 0) {
            this.keyframes.splice(index, 1);
            return true;
        }
        return false;
    }

    public updateKeyframeTime(keyframe: T, newTime: number): void {
        const index = this.keyframes.findIndex(kf => kf === keyframe);
        if (index >= 0) {
            this.keyframes[index].time = newTime;
        }
    }

    protected getSurroundingKeyframes(time: number): { before: T | null, after: T | null } {
        if (this.keyframes.length === 0) return { before: null, after: null };

        // Find keyframes before and after current time
        let beforeIndex = -1;
        for (let i = 0; i < this.keyframes.length; i++) {
            if (this.keyframes[i].time <= time) {
                beforeIndex = i;
            } else {
                break;
            }
        }

        const before = beforeIndex >= 0 ? this.keyframes[beforeIndex] : null;
        const after = beforeIndex < this.keyframes.length - 1 ? this.keyframes[beforeIndex + 1] : null;

        return { before, after };
    }
}

// Camera track implementation
export class CameraTrack extends Track<CameraKeyframe> {
    constructor(name: string, camera: THREE.PerspectiveCamera) {
        super(name, camera);
    }

    public addKeyframe(time: number): CameraKeyframe {
        const camera = this.target as THREE.PerspectiveCamera;

        // Create a new keyframe with current camera state
        const keyframe: CameraKeyframe = {
            track: this,
            time,
            data: {
                position: camera.position.clone(),
                quaternion: camera.quaternion.clone(),
                fov: camera.fov
            }
        };

        // Check if a keyframe already exists at this time
        const existingIndex = this.keyframes.findIndex(kf => Math.abs(kf.time - time) < 0.01);
        if (existingIndex >= 0) {
            // Replace existing keyframe
            this.keyframes[existingIndex] = keyframe;
            console.log(`CameraTrack: Updated keyframe at position ${time}`);
        } else {
            // Add new keyframe and sort by time
            this.keyframes.push(keyframe);
            this.keyframes.sort((a, b) => a.time - b.time);
            console.log(`CameraTrack: Added keyframe at position ${time}`);
        }

        return keyframe;
    }

    public deserializeKeyframe(time: number, serializedData: any): CameraKeyframe {
        return {
            track: this,
            time,
            data: {
                position: new THREE.Vector3().fromArray(serializedData.position),
                quaternion: new THREE.Quaternion().fromArray(serializedData.quaternion),
                fov: serializedData.fov
            }
        };
    }

    public updateTargetAtTime(time: number): void {
        const camera = this.target as THREE.PerspectiveCamera;
        const { before, after } = this.getSurroundingKeyframes(time);

        if (!before && !after) {
            // No keyframes, nothing to do
            return;
        }

        if (before && !after) {
            // Only have keyframes before current time, use last keyframe
            camera.position.copy(before.data.position);
            camera.quaternion.copy(before.data.quaternion);
            camera.fov = before.data.fov;
            camera.updateProjectionMatrix();
            return;
        }

        if (!before && after) {
            // Only have keyframes after current time, use first keyframe
            camera.position.copy(after.data.position);
            camera.quaternion.copy(after.data.quaternion);
            camera.fov = after.data.fov;
            camera.updateProjectionMatrix();
            return;
        }

        // Have keyframes before and after, interpolate
        const t = (time - before!.time) / (after!.time - before!.time);

        // Interpolate position
        camera.position.lerpVectors(before!.data.position, after!.data.position, t);

        // Interpolate rotation (using quaternion slerp for smooth rotation)
        camera.quaternion.slerpQuaternions(before!.data.quaternion, after!.data.quaternion, t);

        // Interpolate FOV
        camera.fov = THREE.MathUtils.lerp(before!.data.fov, after!.data.fov, t);
        camera.updateProjectionMatrix();
    }
}

// Object track implementation
export class EntityTransformTrack extends Track<EntityTransform> {
    protected target: EntityBase;
    constructor(name: string, object: EntityBase) {
        super(name, object);
        this.target = object;
    }

    public addKeyframe(time: number): EntityTransform {
        const object = this.target as THREE.Object3D;

        // Create a new keyframe with current object state
        const keyframe: EntityTransform = {
            track: this,
            time,
            data: {
                position: object.position.clone(),
                quaternion: object.quaternion.clone(),
                scale: object.scale.clone()
            }
        };

        // Check if a keyframe already exists at this time
        const existingIndex = this.keyframes.findIndex(kf => Math.abs(kf.time - time) < 0.01);
        if (existingIndex >= 0) {
            // Replace existing keyframe
            this.keyframes[existingIndex] = keyframe;
            console.log(`ObjectTrack: Updated keyframe at position ${time}`);
        } else {
            // Add new keyframe and sort by time
            this.keyframes.push(keyframe);
            this.keyframes.sort((a, b) => a.time - b.time);
            console.log(`ObjectTrack: Added keyframe at position ${time}`);
        }

        return keyframe;
    }

    public deserializeKeyframe(time: number, serializedData: any): EntityTransform {
        return {
            track: this,
            time,
            data: {
                position: new THREE.Vector3().fromArray(serializedData.position),
                quaternion: new THREE.Quaternion().fromArray(serializedData.quaternion),
                scale: new THREE.Vector3().fromArray(serializedData.scale)
            }
        };
    }

    public updateTargetAtTime(time: number): void {
        const object = this.target;
        const { before, after } = this.getSurroundingKeyframes(time);

        if (!before && !after) {
            // No keyframes, nothing to do
            return;
        }

        const result = {
            position: new THREE.Vector3(),
            quaternion: new THREE.Quaternion(),
            scale: new THREE.Vector3(),
            log: ""
        }
        if (before && !after) {
            // Only have keyframes before current time, use last keyframe
            result.position = before.data.position;
            result.quaternion = before.data.quaternion;
            result.scale = before.data.scale;
            result.log = `Only before`;
        } else if (!before && after) {
            // Only have keyframes after current time, use first keyframe
            result.position = after.data.position;
            result.quaternion = after.data.quaternion;
            result.scale = after.data.scale;
            result.log = `Only after`;
        } else {

            // Have keyframes before and after, interpolate
            const t = (time - before!.time) / (after!.time - before!.time);
            result.position.lerpVectors(before!.data.position, after!.data.position, t);
            result.quaternion.slerpQuaternions(before!.data.quaternion, after!.data.quaternion, t);
            result.scale.lerpVectors(before!.data.scale, after!.data.scale, t);
            result.log = `Interpolated`;
        }

        object.position.copy(result.position);
        object.quaternion.copy(result.quaternion);
        object.scale.copy(result.scale);

        object.updateMatrixWorld();

        console.log(`EntityTransformTrack: Updated object ${this.target.name} at time:`, time, object.position, object.quaternion, object.scale, result.log);
    }
}

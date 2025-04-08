import * as THREE from 'three';

// Define base keyframe interface
export interface Keyframe {
    time: number;
}

// Camera keyframe
export interface CameraKeyframe extends Keyframe {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    fov: number;
}

// Object keyframe
export interface ObjectKeyframe extends Keyframe {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    scale: THREE.Vector3;
}

// Define base track class
export abstract class Track<T extends Keyframe> {
    protected keyframes: T[] = [];
    protected target: any;
    protected name: string;
    
    constructor(name: string, target: any) {
        this.name = name;
        this.target = target;
    }
    
    // Abstract methods that must be implemented by subclasses
    abstract addKeyframe(time: number): T;
    abstract updateTargetAtTime(time: number): void;
    
    public getName(): string {
        return this.name;
    }
    
    public getKeyframes(): T[] {
        return this.keyframes;
    }
    
    public removeKeyframe(time: number): boolean {
        const index = this.keyframes.findIndex(kf => Math.abs(kf.time - time) < 0.01);
        if (index >= 0) {
            this.keyframes.splice(index, 1);
            return true;
        }
        return false;
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
            time,
            position: camera.position.clone(),
            quaternion: camera.quaternion.clone(),
            fov: camera.fov
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
    
    public updateTargetAtTime(time: number): void {
        const camera = this.target as THREE.PerspectiveCamera;
        const { before, after } = this.getSurroundingKeyframes(time);
        
        if (!before && !after) {
            // No keyframes, nothing to do
            return;
        }
        
        if (before && !after) {
            // Only have keyframes before current time, use last keyframe
            camera.position.copy(before.position);
            camera.quaternion.copy(before.quaternion);
            camera.fov = before.fov;
            camera.updateProjectionMatrix();
            return;
        }
        
        if (!before && after) {
            // Only have keyframes after current time, use first keyframe
            camera.position.copy(after.position);
            camera.quaternion.copy(after.quaternion);
            camera.fov = after.fov;
            camera.updateProjectionMatrix();
            return;
        }
        
        // Have keyframes before and after, interpolate
        const t = (time - before!.time) / (after!.time - before!.time);
        
        // Interpolate position
        camera.position.lerpVectors(before!.position, after!.position, t);
        
        // Interpolate rotation (using quaternion slerp for smooth rotation)
        camera.quaternion.slerpQuaternions(before!.quaternion, after!.quaternion, t);
        
        // Interpolate FOV
        camera.fov = THREE.MathUtils.lerp(before!.fov, after!.fov, t);
        camera.updateProjectionMatrix();
    }
}



// Object track implementation
export class ObjectTrack extends Track<ObjectKeyframe> {
    constructor(name: string, object: THREE.Object3D) {
        super(name, object);
    }
    
    public addKeyframe(time: number): ObjectKeyframe {
        const object = this.target as THREE.Object3D;
        
        // Create a new keyframe with current object state
        const keyframe: ObjectKeyframe = {
            time,
            position: object.position.clone(),
            quaternion: object.quaternion.clone(),
            scale: object.scale.clone()
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
    
    public updateTargetAtTime(time: number): void {
        const object = this.target as THREE.Object3D;
        const { before, after } = this.getSurroundingKeyframes(time);
        
        if (!before && !after) {
            // No keyframes, nothing to do
            return;
        }
        
        if (before && !after) {
            // Only have keyframes before current time, use last keyframe
            object.position.copy(before.position);
            object.quaternion.copy(before.quaternion);
            object.scale.copy(before.scale);
            return;
        }
        
        if (!before && after) {
            // Only have keyframes after current time, use first keyframe
            object.position.copy(after.position);
            object.quaternion.copy(after.quaternion);
            object.scale.copy(after.scale);
            return;
        }
        
        // Have keyframes before and after, interpolate
        const t = (time - before!.time) / (after!.time - before!.time);
        
        // Interpolate position
        object.position.lerpVectors(before!.position, after!.position, t);
        
        // Interpolate rotation (using quaternion slerp for smooth rotation)
        object.quaternion.slerpQuaternions(before!.quaternion, after!.quaternion, t);
        
        // Interpolate scale
        object.scale.lerpVectors(before!.scale, after!.scale, t);
    }
}
import * as THREE from 'three';
import { EditorEngine } from '../../core/EditorEngine';
import { Observer } from '../../utils/Observer';
import { Track, CameraTrack, EntityTransformTrack, IKeyframe } from './Track';
import { CharacterPoseTrack } from './CharacterPoseTrack';
import { EntityBase } from '../../entity/base/EntityBase';
import { CharacterEntity } from '../../entity/types/CharacterEntity';

// Define interfaces for serialization
export interface SerializedKeyframeData {
    time: number;
    data: any;
}

export interface SerializedTrackData {
    name: string;
    type: string;
    targetUUID: string;
    keyframes: SerializedKeyframeData[];
}

export interface SerializedTimelineData {
    duration: number;
    currentTime: number;
    tracks: SerializedTrackData[];
}

export class TimelineManager {
    private engine: EditorEngine;
    private isPlayingState: boolean = false;
    private currentTime: number = 0;
    private duration: number = 5; // Default duration in seconds
    private animationFrameId: number | null = null;
    private lastFrameTime: number | null = null;
    private tracks: Track<any>[] = [];
    private activeTrack: Track<any> | null = null;

    // Observer for timeline events
    public observers = new Observer<{
        timelineUpdated: { time: number };
        playbackStateChanged: { isPlaying: boolean };
        keyframeAdded: { keyframe: IKeyframe };
        keyframeRemoved: { keyframe: IKeyframe };
        trackAdded: { track: Track<any>, name: string };
        activeTrackChanged: { track: Track<any> | null };
        timelineDeserialized: {};
    }>();

    constructor(engine: EditorEngine) {
        this.engine = engine;

        // Create default camera track
        this.createCameraTrack();
    }

    /**
     * Create a camera track
     */
    public createCameraTrack(): CameraTrack {
        const camera = this.engine.getCameraManager().getCamera();
        const track = new CameraTrack('Camera', camera);

        this.tracks.push(track);

        this.setActiveTrack(track);

        this.observers.notify('trackAdded', { track, name: track.getName() });

        return track;
    }

    /**
     * Create an object track
     */
    public createEntityTrack(name: string, object: EntityBase): EntityTransformTrack {
        const track = new EntityTransformTrack(name, object);

        this.tracks.push(track);
        const trackIndex = this.tracks.length - 1;

        this.observers.notify('trackAdded', { track, name: track.getName() });

        return track;
    }

    /**
     * Create a character pose track for animating character bones
     */
    public createCharacterPoseTrack(name: string, character: CharacterEntity): CharacterPoseTrack {
        const track = new CharacterPoseTrack(name, character);

        this.tracks.push(track);
        
        this.observers.notify('trackAdded', { track, name: track.getName() });
        
        return track;
    }

    /**
     * Get all tracks
     */
    public getTracks(): Track<any>[] {
        return this.tracks;
    }

    /**
     * Get a track by index
     */
    public getTrack(index: number): Track<any> | null {
        if (index >= 0 && index < this.tracks.length) {
            return this.tracks[index];
        }
        return null;
    }

    /**
     * Set the active track index
     */
    public setActiveTrack(track: Track<any>): void {
        console.log('setActiveTrack', track);
        // Reset active state on previous active track
        if (this.activeTrack) {
            this.activeTrack.isActive = false;
        }
        
        this.activeTrack = track;
        this.activeTrack.isActive = true;
        this.observers.notify('activeTrackChanged', { track });
    }

    /**
     * Get the active track
     */
    public getActiveTrack(): Track<any> | null {
        return this.activeTrack;
    }

    /**
     * Add a keyframe to the active track at the current time
     */
    public addKeyframe(): void {
        console.log('addKeyframe', this.currentTime, this.activeTrack);
        if (!this.activeTrack) return;

        const keyframe = this.activeTrack.addKeyframe(this.currentTime);

        // Notify observers that a keyframe was added
        this.observers.notify('keyframeAdded', { keyframe });
    }

    /**
     * Delete a keyframe from track
     */
    public removeKeyframe(keyframe: IKeyframe): void {
        console.log('removeKeyframe', keyframe);
        keyframe.track.removeKeyframe(keyframe);

        // Notify observers that a keyframe was removed
        this.observers.notify('keyframeRemoved', { keyframe });
    }

    /**
     * Update all tracks at the current time
     * @param time The time to update at
     * @param restoreControlsAfter Whether to restore orbit controls after update (if not playing)
     */
    private updateTracksAtTime(time: number, restoreControlsAfter: boolean = true): void {
        // First disable orbit controls if we have a camera track
        this.engine.getCameraManager().setOrbitControlsEnabled(false);

        // Update all tracks
        for (const track of this.tracks) {
            track.updateTargetAtTime(time);
        }

        // Re-enable orbit controls if we're not playing and restoration is requested
        if (restoreControlsAfter && !this.isPlayingState) {
            this.engine.getCameraManager().setOrbitControlsEnabled(true);
        }
    }

    /**
     * Animation loop for timeline playback
     */
    private animationLoop(timestamp: number): void {
        if (!this.isPlayingState) return;

        if (this.lastFrameTime === null) {
            this.lastFrameTime = timestamp;
            this.animationFrameId = requestAnimationFrame(this.animationLoop.bind(this));
            return;
        }

        // Calculate time delta and update current time
        const delta = (timestamp - this.lastFrameTime) / 1000; // Convert to seconds
        this.lastFrameTime = timestamp;

        this.currentTime += delta;

        // Loop back to start if we reach the end
        if (this.currentTime > this.duration) {
            this.currentTime = 0;
        }

        // Update all tracks at current time but don't restore controls
        this.updateTracksAtTime(this.currentTime, false);

        // Notify observers
        this.observers.notify('timelineUpdated', { time: this.currentTime });

        // Continue animation loop
        this.animationFrameId = requestAnimationFrame(this.animationLoop.bind(this));
    }

    /**
     * Play the timeline animation
     */
    public play(): void {
        if (this.isPlayingState) return;

        this.isPlayingState = true;
        this.lastFrameTime = null;

        // Start animation loop
        this.animationFrameId = requestAnimationFrame(this.animationLoop.bind(this));

        // Notify observers
        this.observers.notify('playbackStateChanged', { isPlaying: true });
    }

    /**
     * Pause the timeline animation
     */
    public pause(): void {
        if (!this.isPlayingState) return;

        this.isPlayingState = false;

        // Stop animation loop
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Re-enable orbit controls
        this.engine.getCameraManager().setOrbitControlsEnabled(true);

        // Notify observers
        this.observers.notify('playbackStateChanged', { isPlaying: false });
    }

    /**
     * Set the current timeline position
     */
    public setCurrentTime(time: number): void {
        this.currentTime = Math.max(0, Math.min(time, this.duration));

        // Update tracks and restore controls if not playing
        this.updateTracksAtTime(this.currentTime, true);

        this.observers.notify('timelineUpdated', { time: this.currentTime });
    }

    /**
     * Get the current timeline position
     */
    public getCurrentTime(): number {
        return this.currentTime;
    }

    /**
     * Get the timeline duration
     */
    public getDuration(): number {
        return this.duration;
    }

    /**
     * Set the timeline duration
     */
    public setDuration(duration: number): void {
        this.duration = Math.max(1, duration);
        this.observers.notify('timelineUpdated', { time: this.currentTime });
    }

    /**
     * Check if the timeline is currently playing
     */
    public isPlaying(): boolean {
        return this.isPlayingState;
    }

    /**
     * Serialize the timeline state for saving
     */
    public serialize(): SerializedTimelineData {
        return {
            duration: this.duration,
            currentTime: this.currentTime,
            tracks: this.tracks.map(track => {
                // Determine track type
                let trackType = 'unknown';
                if (track instanceof CameraTrack) {
                    trackType = 'camera';
                } else if (track instanceof EntityTransformTrack) {
                    trackType = 'entity';
                } else if (track instanceof CharacterPoseTrack) {
                    trackType = 'characterPose';
                }

                // Get target ID (if available)
                let targetUUID = '';
                const target = track.getTarget();
                if (target && 'uuid' in target) {
                    targetUUID = target.uuid;
                } 

                // Serialize keyframes with THREE.js object property conversion
                const keyframes = track.getKeyframes().map(keyframe => {
                    // Deep clone and convert the data to ensure we don't modify the original
                    const serializedData = this.deepSerializeThreeObjects(keyframe.data);
                    
                    return {
                        time: keyframe.time,
                        data: serializedData
                    };
                });

                return {
                    name: track.getName(),
                    type: trackType,
                    targetUUID: targetUUID,
                    keyframes: keyframes
                };
            })
        };
    }

    /**
     * Helper method to recursively serialize THREE.js objects
     */
    private deepSerializeThreeObjects(data: any): any {
        if (!data) return data;
        
        if (data instanceof THREE.Vector3 || data instanceof THREE.Quaternion) {
            // Convert Vector3 and Quaternion directly to arrays
            return (data as any).toArray();
        }
        
        if (Array.isArray(data)) {
            // Process array elements
            return data.map(item => this.deepSerializeThreeObjects(item));
        }
        
        if (typeof data === 'object') {
            // Process object properties
            const result: any = {};
            for (const key in data) {
                result[key] = this.deepSerializeThreeObjects(data[key]);
            }
            return result;
        }
        
        // Return primitives unchanged
        return data;
    }

    /**
     * Deserialize timeline state from saved data
     */
    public deserialize(data: SerializedTimelineData, engine: EditorEngine): void {
        // Clear current tracks
        this.tracks = [];
        this.activeTrack = null;

        // Set timeline properties
        this.duration = data.duration;
        this.currentTime = data.currentTime;

        // Get camera
        const camera = engine.getCameraManager().getCamera();

        // Recreate tracks
        data.tracks.forEach(trackData => {
            console.log('deserialize track', trackData);
            let track: Track<any> | null = null;

            if (trackData.type === 'camera') {
                // Camera track
                track = new CameraTrack(trackData.name, camera);
            } else {
                // Entity tracks - find the target entity using ObjectManager
                const entity = engine.getObjectManager().getEntityByUUID(trackData.targetUUID);
                if (!entity) {
                    console.warn(`Could not find entity with ID ${trackData.targetUUID} for track ${trackData.name}`);
                    return;
                }

                if (trackData.type === 'characterPose' && entity instanceof CharacterEntity) {
                    track = new CharacterPoseTrack(trackData.name, entity);
                } else {
                    track = new EntityTransformTrack(trackData.name, entity);
                }
            }

            if (!track) return;

            // Add keyframes using the track's deserializeKeyframe method
            trackData.keyframes.forEach(keyframeData => {
                const keyframe = track.deserializeKeyframe(keyframeData.time, keyframeData.data);
                track!.getKeyframes().push(keyframe);
            });

            // Sort keyframes by time
            track.getKeyframes().sort((a, b) => a.time - b.time);

            // Add track to manager
            this.tracks.push(track);
        });

        // Set first track as active if available
        if (this.tracks.length > 0) {
            this.setActiveTrack(this.tracks[0]);
        }

        // After everything is set up, notify observers that the timeline has been deserialized
        this.observers.notify('timelineDeserialized', {});
        
        // Notify observers of timeline update
        this.observers.notify('timelineUpdated', { time: this.currentTime });
    }
}
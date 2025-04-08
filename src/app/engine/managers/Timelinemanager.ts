import * as THREE from 'three';
import { EditorEngine } from '../core/EditorEngine';
import { Observer } from '../utils/Observer';

// Define base keyframe interface
interface Keyframe {
    time: number;
}

// Define base track class
abstract class Track<T extends Keyframe> {
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

// Camera keyframe
interface CameraKeyframe extends Keyframe {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    fov: number;
}

// Camera track implementation
class CameraTrack extends Track<CameraKeyframe> {
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

// Object keyframe
interface ObjectKeyframe extends Keyframe {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    scale: THREE.Vector3;
}

// Object track implementation
class ObjectTrack extends Track<ObjectKeyframe> {
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

export class TimelineManager {
    private engine: EditorEngine;
    private isPlaying: boolean = false;
    private debugUI: HTMLElement | null = null;
    private currentTime: number = 0;
    private duration: number = 5; // Default duration in seconds
    private animationFrameId: number | null = null;
    private lastFrameTime: number | null = null;
    private tracks: Track<any>[] = [];
    private activeTrackIndex: number = 0;

    // Observer for timeline events
    public observers = new Observer<{
        timelineUpdated: { time: number };
        playbackStateChanged: { isPlaying: boolean };
        keyframeAdded: { trackIndex: number, time: number };
        trackAdded: { trackIndex: number, name: string };
        activeTrackChanged: { trackIndex: number };
    }>();

    constructor(engine: EditorEngine) {
        this.engine = engine;
        
        // Create default camera track
        this.createCameraTrack();
        
        // Create debug UI
        this.createDebugUI();
    }
    
    /**
     * Create a camera track
     */
    public createCameraTrack(): CameraTrack {
        const camera = this.engine.getCameraManager().getCamera();
        const track = new CameraTrack('Camera', camera);
        
        this.tracks.push(track);
        const trackIndex = this.tracks.length - 1;
        
        this.observers.notify('trackAdded', { trackIndex, name: track.getName() });
        
        return track;
    }
    
    /**
     * Create an object track
     */
    public createObjectTrack(name: string, object: THREE.Object3D): ObjectTrack {
        const track = new ObjectTrack(name, object);
        
        this.tracks.push(track);
        const trackIndex = this.tracks.length - 1;
        
        this.observers.notify('trackAdded', { trackIndex, name: track.getName() });
        
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
    public setActiveTrack(index: number): void {
        if (index >= 0 && index < this.tracks.length) {
            this.activeTrackIndex = index;
            this.observers.notify('activeTrackChanged', { trackIndex: index });
            this.updateTrackList();
        }
    }
    
    /**
     * Get the active track
     */
    public getActiveTrack(): Track<any> | null {
        return this.getTrack(this.activeTrackIndex);
    }

    /**
     * Add a keyframe to the active track at the current time
     */
    public addKeyframe(): void {
        const activeTrack = this.getActiveTrack();
        if (!activeTrack) return;
        
        const keyframe = activeTrack.addKeyframe(this.currentTime);
        
        // Notify observers that a keyframe was added
        this.observers.notify('keyframeAdded', { trackIndex: this.activeTrackIndex, time: this.currentTime });
        
        // Update the keyframe list in the UI
        this.updateKeyframeList();
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
        if (restoreControlsAfter && !this.isPlaying) {
            this.engine.getCameraManager().setOrbitControlsEnabled(true);
        }
    }
    
    /**
     * Animation loop for timeline playback
     */
    private animationLoop(timestamp: number): void {
        if (!this.isPlaying) return;
        
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
        
        // Update UI
        this.updateDebugUIPosition(this.currentTime);
        
        // Notify observers
        this.observers.notify('timelineUpdated', { time: this.currentTime });
        
        // Continue animation loop
        this.animationFrameId = requestAnimationFrame(this.animationLoop.bind(this));
    }
    
    /**
     * Play the timeline animation
     */
    public play(): void {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.lastFrameTime = null;
        
        // Start animation loop
        this.animationFrameId = requestAnimationFrame(this.animationLoop.bind(this));
        
        // Update UI and notify observers
        this.updateDebugUIPlaybackState();
        this.observers.notify('playbackStateChanged', { isPlaying: true });
    }
    
    /**
     * Pause the timeline animation
     */
    public pause(): void {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        
        // Stop animation loop
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Re-enable orbit controls
        this.engine.getCameraManager().setOrbitControlsEnabled(true);
        
        // Update UI and notify observers
        this.updateDebugUIPlaybackState();
        this.observers.notify('playbackStateChanged', { isPlaying: false });
    }
    
    /**
     * Set the current timeline position
     */
    public setPosition(time: number): void {
        this.currentTime = Math.max(0, Math.min(time, this.duration));
        
        // Update tracks and restore controls if not playing
        this.updateTracksAtTime(this.currentTime, true);
        
        this.updateDebugUIPosition(this.currentTime);
        this.observers.notify('timelineUpdated', { time: this.currentTime });
    }
    
    /**
     * Get the current timeline position
     */
    public getPosition(): number {
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
        
        // Update slider max value
        if (this.debugUI) {
            const slider = this.debugUI.querySelector('input[type="range"]');
            if (slider) {
                (slider as HTMLInputElement).max = this.duration.toString();
            }
        }
    }
    
    /**
     * Check if the timeline is playing
     */
    public isPlayingAnimation(): boolean {
        return this.isPlaying;
    }
    
    /**
     * Update the playback state in the debug UI
     */
    private updateDebugUIPlaybackState(): void {
        if (!this.debugUI) return;
        
        const playButton = this.debugUI.querySelector('#timeline-play-button');
        if (playButton) {
            (playButton as HTMLButtonElement).textContent = this.isPlaying ? 'Pause' : 'Play';
        }
    }
    
    /**
     * Update the position display in the debug UI
     */
    private updateDebugUIPosition(position: number): void {
        if (!this.debugUI) return;
        
        const positionDisplay = this.debugUI.querySelector('#timeline-position');
        if (positionDisplay) {
            positionDisplay.textContent = `Position: ${position.toFixed(2)}s`;
        }
        
        const slider = this.debugUI.querySelector('input[type="range"]');
        if (slider) {
            (slider as HTMLInputElement).value = position.toString();
        }
    }
    
    /**
     * Update the track list in the debug UI
     */
    private updateTrackList(): void {
        if (!this.debugUI) return;
        
        const trackList = this.debugUI.querySelector('#track-list');
        if (!trackList) return;
        
        // Clear existing list
        trackList.innerHTML = '';
        
        if (this.tracks.length === 0) {
            trackList.textContent = 'No tracks';
            return;
        }
        
        // Add each track to the list
        this.tracks.forEach((track, index) => {
            const item = document.createElement('div');
            item.textContent = `${track.getName()}`;
            item.style.cssText = `padding: 2px 0; cursor: pointer;`;
            item.addEventListener('click', () => this.setActiveTrack(index));
            
            // Highlight active track
            if (index === this.activeTrackIndex) {
                item.style.fontWeight = 'bold';
                item.style.color = '#ffcc00';
            }
            
            trackList.appendChild(item);
        });
    }
    
    /**
     * Update the keyframe list in the debug UI
     */
    private updateKeyframeList(): void {
        if (!this.debugUI) return;
        
        const keyframeList = this.debugUI.querySelector('#keyframe-list');
        if (!keyframeList) return;
        
        // Clear existing list
        keyframeList.innerHTML = '';
        
        const activeTrack = this.getActiveTrack();
        if (!activeTrack || activeTrack.getKeyframes().length === 0) {
            keyframeList.textContent = 'No keyframes';
            return;
        }
        
        // Add each keyframe to the list
        activeTrack.getKeyframes().forEach((keyframe, index) => {
            const item = document.createElement('div');
            item.textContent = `${index + 1}: ${keyframe.time.toFixed(2)}s`;
            item.style.cssText = `padding: 2px 0; cursor: pointer;`;
            item.addEventListener('click', () => this.setPosition(keyframe.time));
            
            // Highlight if current keyframe
            if (Math.abs(this.currentTime - keyframe.time) < 0.01) {
                item.style.fontWeight = 'bold';
                item.style.color = '#ffcc00';
            }
            
            keyframeList.appendChild(item);
        });
    }
    
    /**
     * Create a debug UI for controlling the timeline
     */
    private createDebugUI(): void {
        // Only create UI in non-production environments
        if (process.env.NODE_ENV === 'production') return;
        
        // Create UI container
        const container = document.createElement('div');
        container.id = 'timeline-debug-ui';
        container.style.cssText = `position: fixed; bottom: 10px; left: 10px; z-index: 1000; background-color: rgba(0, 0, 0, 0.7); padding: 10px; border-radius: 5px; color: white; font-family: Arial, sans-serif; font-size: 12px;`;

        // Title
        const title = document.createElement('div');
        title.textContent = 'Timeline Debug';
        title.style.cssText = `margin-bottom: 5px;`;
        container.appendChild(title);
        
        // Position display
        const positionDisplay = document.createElement('div');
        positionDisplay.id = 'timeline-position';
        positionDisplay.textContent = 'Position: 0.00s';
        positionDisplay.style.cssText = `margin-bottom: 5px;`;
        container.appendChild(positionDisplay);
        
        // Play/Pause button
        const playButton = document.createElement('button');
        playButton.id = 'timeline-play-button';
        playButton.textContent = 'Play';
        playButton.style.cssText = `margin-right: 5px; padding: 3px 8px;`;
        playButton.addEventListener('click', () => {
            if (this.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        });
        container.appendChild(playButton);
        
        // Reset button
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset';
        resetButton.style.cssText = `margin-right: 5px; padding: 3px 8px;`;
        resetButton.addEventListener('click', () => {
            this.setPosition(0);
        });
        container.appendChild(resetButton);
        
        // Add Keyframe button
        const keyframeButton = document.createElement('button');
        keyframeButton.textContent = 'Add Keyframe';
        keyframeButton.style.cssText = `padding: 3px 8px;`;
        keyframeButton.addEventListener('click', () => {
            this.addKeyframe();
        });
        container.appendChild(keyframeButton);
        
        // Position control
        const positionControl = document.createElement('div');
        positionControl.style.marginTop = '5px';
        
        const positionSlider = document.createElement('input');
        positionSlider.type = 'range';
        positionSlider.min = '0';
        positionSlider.max = this.duration.toString();
        positionSlider.step = '0.01';
        positionSlider.value = '0';
        positionSlider.style.width = '100%';
        positionSlider.addEventListener('input', (e) => {
            const newPosition = parseFloat((e.target as HTMLInputElement).value);
            this.setPosition(newPosition);
        });
        positionControl.appendChild(positionSlider);
        
        container.appendChild(positionControl);
        
        // Track selection section
        const trackSection = document.createElement('div');
        trackSection.style.cssText = `margin-top: 10px;`;
        
        const trackTitle = document.createElement('div');
        trackTitle.textContent = 'Tracks:';
        trackTitle.style.cssText = `font-weight: bold; margin-bottom: 3px;`;
        trackSection.appendChild(trackTitle);
        
        const trackList = document.createElement('div');
        trackList.id = 'track-list';
        trackList.style.cssText = `max-height: 60px; overflow-y: auto;`;
        trackSection.appendChild(trackList);
        
        container.appendChild(trackSection);
        
        // Keyframe list section
        const keyframeSection = document.createElement('div');
        keyframeSection.style.cssText = `margin-top: 10px;`;
        
        const keyframeTitle = document.createElement('div');
        keyframeTitle.textContent = 'Keyframes:';
        keyframeTitle.style.cssText = `font-weight: bold; margin-bottom: 3px;`;
        keyframeSection.appendChild(keyframeTitle);
        
        const keyframeList = document.createElement('div');
        keyframeList.id = 'keyframe-list';
        keyframeList.style.cssText = `max-height: 80px; overflow-y: auto;`;
        keyframeSection.appendChild(keyframeList);
        
        container.appendChild(keyframeSection);
        
        // Add to document
        document.body.appendChild(container);
        
        // Store reference
        this.debugUI = container;
        
        // Initialize track and keyframe lists
        this.updateTrackList();
        this.updateKeyframeList();
    }
    
    /**
     * Toggle debug UI visibility
     */
    public toggleDebugUI(visible?: boolean): void {
        if (!this.debugUI) return;
        
        if (visible === undefined) {
            visible = this.debugUI.style.display === 'none';
        }
        
        this.debugUI.style.display = visible ? 'block' : 'none';
    }
}
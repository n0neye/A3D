import * as THREE from 'three';
import { EditorEngine } from '../core/EditorEngine';
import { Observer } from '../utils/Observer';

// Define camera keyframe structure
interface CameraKeyframe {
    time: number;
    position: THREE.Vector3;
    rotation: THREE.Euler;
    fov: number;
}

export class TimelineManager {
    private engine: EditorEngine;
    private isPlaying: boolean = false;
    private debugUI: HTMLElement | null = null;
    private keyframes: CameraKeyframe[] = [];
    private currentTime: number = 0;
    private duration: number = 5; // Default duration in seconds
    private animationFrameId: number | null = null;
    private lastFrameTime: number | null = null;

    // Observer for timeline events
    public observers = new Observer<{
        timelineUpdated: { time: number };
        playbackStateChanged: { isPlaying: boolean };
        keyframeAdded: { time: number };
    }>();

    constructor(engine: EditorEngine) {
        this.engine = engine;
        this.createDebugUI();
    }

    /**
     * Add a keyframe with the current camera state at the current time
     */
    public addCameraKeyframe(): void {
        const camera = this.engine.getCameraManager().getCamera();
        const time = this.currentTime;
        
        // Create a new keyframe with current camera state
        const keyframe: CameraKeyframe = {
            time,
            position: camera.position.clone(),
            rotation: camera.rotation.clone(),
            fov: camera.fov
        };
        
        // Check if a keyframe already exists at this time
        const existingIndex = this.keyframes.findIndex(kf => Math.abs(kf.time - time) < 0.01);
        if (existingIndex >= 0) {
            // Replace existing keyframe
            this.keyframes[existingIndex] = keyframe;
            console.log('TimelineManager: Updated keyframe at position', time);
        } else {
            // Add new keyframe and sort by time
            this.keyframes.push(keyframe);
            this.keyframes.sort((a, b) => a.time - b.time);
            console.log('TimelineManager: Added keyframe at position', time);
        }
        
        // Notify observers that a keyframe was added/updated
        this.observers.notify('keyframeAdded', { time });
    }
    
    /**
     * Find the surrounding keyframes for the given time
     */
    private getSurroundingKeyframes(time: number): { before: CameraKeyframe | null, after: CameraKeyframe | null } {
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
    
    /**
     * Update camera state based on current timeline position
     */
    private updateCameraAtTime(time: number): void {
        const camera = this.engine.getCameraManager().getCamera();
        const { before, after } = this.getSurroundingKeyframes(time);
        
        if (!before && !after) {
            // No keyframes, nothing to do
            return;
        }
        
        if (before && !after) {
            // Only have keyframes before current time, use last keyframe
            camera.position.copy(before.position);
            camera.rotation.copy(before.rotation);
            camera.fov = before.fov;
            camera.updateProjectionMatrix();
            return;
        }
        
        if (!before && after) {
            // Only have keyframes after current time, use first keyframe
            camera.position.copy(after.position);
            camera.rotation.copy(after.rotation);
            camera.fov = after.fov;
            camera.updateProjectionMatrix();
            return;
        }
        
        // Have keyframes before and after, interpolate
        const t = (time - before!.time) / (after!.time - before!.time);
        
        // Interpolate position
        camera.position.lerpVectors(before!.position, after!.position, t);
        
        // Interpolate rotation (simple lerp for Euler angles)
        camera.rotation.set(
            THREE.MathUtils.lerp(before!.rotation.x, after!.rotation.x, t),
            THREE.MathUtils.lerp(before!.rotation.y, after!.rotation.y, t),
            THREE.MathUtils.lerp(before!.rotation.z, after!.rotation.z, t)
        );
        
        // Interpolate FOV
        camera.fov = THREE.MathUtils.lerp(before!.fov, after!.fov, t);
        camera.updateProjectionMatrix();
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
        
        // Update camera based on current time
        this.engine.getCameraManager().setOrbitControlsEnabled(false);
        this.updateCameraAtTime(this.currentTime);
        
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
        this.engine.getCameraManager().setOrbitControlsEnabled(false);
        
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
        this.updateCameraAtTime(this.currentTime);
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
            this.addCameraKeyframe();
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
        
        // Keyframe list (optional)
        const keyframeList = document.createElement('div');
        keyframeList.id = 'keyframe-list';
        keyframeList.style.cssText = `margin-top: 10px; max-height: 100px; overflow-y: auto;`;
        container.appendChild(keyframeList);
        
        // Add to document
        document.body.appendChild(container);
        
        // Store reference
        this.debugUI = container;
        
        // Set up keyframe added listener to update the list
        this.observers.subscribe('keyframeAdded', () => this.updateKeyframeList());
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
        
        if (this.keyframes.length === 0) {
            keyframeList.textContent = 'No keyframes';
            return;
        }
        
        // Add each keyframe to the list
        this.keyframes.forEach((keyframe, index) => {
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
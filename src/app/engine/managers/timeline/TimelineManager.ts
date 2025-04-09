import * as THREE from 'three';
import { EditorEngine } from '../../core/EditorEngine';
import { Observer } from '../../utils/Observer';
import { Track, CameraTrack, ObjectTrack } from './Track';
import { TimelineUI } from './TimelineUI';

export class TimelineManager {
    private engine: EditorEngine;
    private isPlayingState: boolean = false;
    private currentTime: number = 0;
    private duration: number = 5; // Default duration in seconds
    private animationFrameId: number | null = null;
    private lastFrameTime: number | null = null;
    private tracks: Track<any>[] = [];
    private activeTrackIndex: number = 0;
    private ui: TimelineUI | null = null;

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
        
        // Create UI after initializing the manager
        this.initializeUI();
    }

    async initializeUI(): Promise<void> {
        if (typeof window !== 'undefined') {
            const paper = await import('paper/dist/paper-core');
            this.ui = new TimelineUI(this, paper);
        }
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
    public setPosition(time: number): void {
        this.currentTime = Math.max(0, Math.min(time, this.duration));
        
        // Update tracks and restore controls if not playing
        this.updateTracksAtTime(this.currentTime, true);
        
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
        this.observers.notify('timelineUpdated', { time: this.currentTime });
    }
    
    /**
     * Check if the timeline is currently playing
     */
    public isPlaying(): boolean {
        return this.isPlayingState;
    }
    
    /**
     * Toggle timeline UI visibility
     */
    public toggleUI(visible?: boolean): void {
        if (this.ui) {
            this.ui.toggleUI(visible);
        }
    }
}
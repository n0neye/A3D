import * as THREE from 'three';
import { EditorEngine } from '../../core/EditorEngine';
import { Observer } from '../../utils/Observer';
import { Track, CameraTrack, ObjectTrack } from './Track';
// import * as paper from 'paper';

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
    
    // Paper.js elements
    private canvas: HTMLCanvasElement | null = null;
    private timelineScope: paper.PaperScope | null = null;
    private timelinePath: paper.Path | null = null;
    private playhead: paper.Group | null = null;
    private keyframeGroups: paper.Group[] = [];
    private trackGroups: paper.Group[] = [];
    private timeLabels: paper.PointText[] = [];
    private isDraggingPlayhead = false;

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
        this.updatePaperTimeline();
        
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
        this.updatePaperTimeline();
        
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
            this.updatePaperTimeline();
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
        
        // Update the Paper.js timeline
        this.updatePaperTimeline();
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
        this.updatePlayheadPosition();
        
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
        this.updatePaperPlayButton();
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
        this.updatePaperPlayButton();
        this.observers.notify('playbackStateChanged', { isPlaying: false });
    }
    
    /**
     * Set the current timeline position
     */
    public setPosition(time: number): void {
        this.currentTime = Math.max(0, Math.min(time, this.duration));
        
        // Update tracks and restore controls if not playing
        this.updateTracksAtTime(this.currentTime, true);
        
        // Update Paper.js playhead
        this.updatePlayheadPosition();
        
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
        this.updatePaperTimeline();
    }
    
    /**
     * Check if the timeline is playing
     */
    public isPlayingAnimation(): boolean {
        return this.isPlaying;
    }
    
    /**
     * Update the playhead position in the Paper.js timeline
     */
    private updatePlayheadPosition(): void {
        if (!this.timelineScope || !this.playhead) return;
        
        // Calculate position based on time
        const timelineWidth = this.timelineScope.view.size.width - 150; // Adjust for track names
        const playheadX = 150 + (this.currentTime / this.duration) * timelineWidth;
        
        // Update playhead position
        this.playhead.position.x = playheadX;
        
        // Update current time text
        if ((this.timelineScope.project.activeLayer.children as any)['currentTimeText']) {
            (this.timelineScope.project.activeLayer.children as any)['currentTimeText'].content = 
                `Time: ${this.currentTime.toFixed(2)}s`;
        }
        
        (this.timelineScope.view as any).draw();
    }
    
    /**
     * Initialize Paper.js timeline
     */
    private async initializePaperTimeline(container: HTMLElement): Promise<void> {
        if (typeof window !== 'undefined') {
            // Only import paper.js on the client side
            const paper = await import('paper/dist/paper-core');
            
            // Create canvas
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'timeline-canvas';
            this.canvas.width = 800;
            this.canvas.height = 200;
            this.canvas.style.width = '100%';
            this.canvas.style.height = '200px';
            this.canvas.style.marginTop = '10px';
            container.appendChild(this.canvas);
            
            // Initialize Paper.js
            this.timelineScope = new paper.PaperScope();
            this.timelineScope.setup(this.canvas);
            
            // Set up event handlers
            this.timelineScope.view.onMouseDown = this.onPaperMouseDown.bind(this);
            this.timelineScope.view.onMouseDrag = this.onPaperMouseDrag.bind(this);
            this.timelineScope.view.onMouseUp = this.onPaperMouseUp.bind(this);
            
            // Draw initial timeline
            this.updatePaperTimeline();
        }
    }
    
    /**
     * Mouse down handler for Paper.js timeline
     */
    private onPaperMouseDown(event: paper.MouseEvent): void {
        if (!this.timelineScope) return;
        
        // Check if clicking on playhead
        if (this.playhead && this.playhead.hitTest(event.point)) {
            this.isDraggingPlayhead = true;
            return;
        }
        
        // Check if clicking on timeline area (for direct positioning)
        const timelineStart = 150;
        const timelineWidth = this.timelineScope.view.size.width - timelineStart;
        
        if (event.point.x >= timelineStart && 
            event.point.y >= 30 && 
            event.point.y <= 30 + (this.tracks.length * 30)) {
            
            // Calculate time from position
            const timelinePosition = (event.point.x - timelineStart) / timelineWidth;
            const newTime = timelinePosition * this.duration;
            
            // Set timeline position
            this.setPosition(newTime);
            
            // Start dragging playhead
            this.isDraggingPlayhead = true;
        }
        
        // Check if clicking on a keyframe
        for (let i = 0; i < this.keyframeGroups.length; i++) {
            const hitResult = this.keyframeGroups[i].hitTest(event.point);
            if (hitResult) {
                // Store for potential drag operation
                (hitResult.item as any).keyframeData = {
                    trackIndex: Math.floor(i / 10), // Approximation, we'd need to store this info with the keyframe
                    originalTime: (hitResult.item.position.x - 150) / (this.timelineScope.view.size.width - 150) * this.duration
                };
                return;
            }
        }
    }
    
    /**
     * Mouse drag handler for Paper.js timeline
     */
    private onPaperMouseDrag(event: paper.MouseEvent): void {
        if (!this.timelineScope) return;
        
        // Handle playhead dragging
        if (this.isDraggingPlayhead) {
            const timelineStart = 150;
            const timelineWidth = this.timelineScope.view.size.width - timelineStart;
            
            // Clamp position to timeline area
            const x = Math.max(timelineStart, Math.min(timelineStart + timelineWidth, event.point.x));
            
            // Calculate time from position
            const timelinePosition = (x - timelineStart) / timelineWidth;
            const newTime = timelinePosition * this.duration;
            
            // Set timeline position
            this.setPosition(newTime);
            return;
        }
        
        // Handle keyframe dragging
        const hitItem = event.target;
        if (hitItem && (hitItem as any).keyframeData) {
            const timelineStart = 150;
            const timelineWidth = this.timelineScope.view.size.width - timelineStart;
            
            // Clamp position to timeline area
            const x = Math.max(timelineStart, Math.min(timelineStart + timelineWidth, event.point.x));
            
            // Calculate new time from position
            const timelinePosition = (x - timelineStart) / timelineWidth;
            const newTime = timelinePosition * this.duration;
            
            // Move the keyframe visually
            hitItem.position.x = x;
            
            // Real keyframe movement would happen on mouse up
        }
    }
    
    /**
     * Mouse up handler for Paper.js timeline
     */
    private onPaperMouseUp(event: paper.MouseEvent): void {
        // End playhead dragging
        this.isDraggingPlayhead = false;
        
        // Handle keyframe repositioning
        const hitItem = event.target;
        if (hitItem && (hitItem as any).keyframeData) {
            const keyframeData = (hitItem as any).keyframeData;
            const timelineStart = 150;
            const timelineWidth = this.timelineScope!.view.size.width - timelineStart;
            
            // Calculate new time from position
            const timelinePosition = (hitItem.position.x - timelineStart) / timelineWidth;
            const newTime = timelinePosition * this.duration;
            
            // Get the track and find the keyframe closest to the original time
            const track = this.tracks[keyframeData.trackIndex];
            if (track) {
                const keyframes = track.getKeyframes();
                let closestKeyframe = null;
                let minDiff = Number.MAX_VALUE;
                
                for (const keyframe of keyframes) {
                    const diff = Math.abs(keyframe.time - keyframeData.originalTime);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestKeyframe = keyframe;
                    }
                }
                
                if (closestKeyframe && minDiff < 0.1) {
                    // Remove old keyframe
                    track.removeKeyframe(closestKeyframe.time);
                    
                    // Add new keyframe at the new time
                    // We need to get current object state
                    this.setPosition(newTime);
                    track.addKeyframe(newTime);
                    
                    // Update timeline visualization
                    this.updatePaperTimeline();
                }
            }
            
            // Clear keyframe data
            delete (hitItem as any).keyframeData;
        }
    }
    
    /**
     * Update the Paper.js timeline visualization
     */
    private updatePaperTimeline(): void {
        if (!this.timelineScope) return;
        
        // Clear existing elements
        this.timelineScope.project.activeLayer.removeChildren();
        this.keyframeGroups = [];
        this.trackGroups = [];
        
        const width = this.timelineScope.view.size.width;
        const height = this.timelineScope.view.size.height;
        const timelineStartX = 150; // Space for track names
        
        // Background
        const background = new this.timelineScope.Path.Rectangle({
            point: [0, 0],
            size: [width, height],
            fillColor: new this.timelineScope.Color(0.2, 0.2, 0.2)
        });
        
        // Timeline container
        const timelineBackground = new this.timelineScope.Path.Rectangle({
            point: [timelineStartX, 30],
            size: [width - timelineStartX, this.tracks.length * 30],
            fillColor: new this.timelineScope.Color(0.25, 0.25, 0.25)
        });
        
        // Time markings
        for (let i = 0; i <= this.duration; i++) {
            const x = timelineStartX + (i / this.duration) * (width - timelineStartX);
            
            // Time tick
            const timeTick = new this.timelineScope.Path.Line({
                from: [x, 30],
                to: [x, 30 + this.tracks.length * 30],
                strokeColor: new this.timelineScope.Color(0.4, 0.4, 0.4),
                strokeWidth: i % 1 === 0 ? 1 : 0.5
            });
            
            // Time label
            if (i % 1 === 0) {
                const timeLabel = new this.timelineScope.PointText({
                    point: [x, 25],
                    content: i + 's',
                    fillColor: 'white',
                    fontSize: 10,
                    justification: 'center'
                });
                this.timeLabels.push(timeLabel);
            }
        }
        
        // Track rows
        this.tracks.forEach((track, index) => {
            const y = 30 + index * 30;
            const trackGroup = new this.timelineScope!.Group();
            
            // Track row background (highlight active track)
            const isActive = index === this.activeTrackIndex;
            const trackRow = new this.timelineScope!.Path.Rectangle({
                point: [0, y],
                size: [width, 30],
                fillColor: isActive 
                    ? new this.timelineScope!.Color(0.3, 0.3, 0.4)
                    : new this.timelineScope!.Color(0.25, 0.25, 0.25)
            });
            trackGroup.addChild(trackRow);
            
            // Track name
            const trackName = new this.timelineScope!.PointText({
                point: [10, y + 20],
                content: track.getName(),
                fillColor: isActive ? '#ffcc00' : 'white',
                fontSize: 12
            });
            trackGroup.addChild(trackName);
            
            // Track separator line
            const separator = new this.timelineScope!.Path.Line({
                from: [0, y + 30],
                to: [width, y + 30],
                strokeColor: new this.timelineScope!.Color(0.3, 0.3, 0.3)
            });
            trackGroup.addChild(separator);
            
            // Make track clickable to select
            trackRow.onClick = () => {
                this.setActiveTrack(index);
            };
            
            this.trackGroups.push(trackGroup);
            
            // Draw keyframes for this track
            const keyframes = track.getKeyframes();
            keyframes.forEach(keyframe => {
                const keyframeGroup = new this.timelineScope!.Group();
                const keyframeX = timelineStartX + (keyframe.time / this.duration) * (width - timelineStartX);
                
                // Keyframe diamond
                const keyframeDiamond = new this.timelineScope!.Path.RegularPolygon({
                    center: [keyframeX, y + 15],
                    sides: 4,
                    radius: 6,
                    fillColor: isActive ? '#ffcc00' : '#aaaaaa',
                    strokeColor: 'white',
                    strokeWidth: 1,
                    rotation: 45
                });
                
                keyframeGroup.addChild(keyframeDiamond);
                
                // Add to keyframe groups
                this.keyframeGroups.push(keyframeGroup);
            });
        });
        
        // Current time indicator text
        const currentTimeText = new this.timelineScope.PointText({
            point: [10, 20],
            content: `Time: ${this.currentTime.toFixed(2)}s`,
            fillColor: 'white',
            fontSize: 12
        });
        currentTimeText.name = 'currentTimeText';
        
        // Playhead
        this.playhead = new this.timelineScope.Group();
        
        const playheadX = timelineStartX + (this.currentTime / this.duration) * (width - timelineStartX);
        
        // Playhead line
        const playheadLine = new this.timelineScope.Path.Line({
            from: [playheadX, 30],
            to: [playheadX, 30 + this.tracks.length * 30],
            strokeColor: 'red',
            strokeWidth: 2
        });
        
        // Playhead handle
        const playheadHandle = new this.timelineScope.Path.RegularPolygon({
            center: [playheadX, 30],
            sides: 3,
            radius: 8,
            fillColor: 'red',
            rotation: 180
        });
        
        this.playhead.addChild(playheadLine);
        this.playhead.addChild(playheadHandle);
        
        // Create play/pause button
        this.createPaperPlayButton();
        
        // Create add keyframe button
        this.createPaperAddKeyframeButton();
        
        // Draw the view
        (this.timelineScope.view as any).draw();
    }
    
    /**
     * Create play/pause button in Paper.js
     */
    private createPaperPlayButton(): void {
        if (!this.timelineScope) return;
        
        const width = this.timelineScope.view.size.width;
        const buttonGroup = new this.timelineScope.Group();
        buttonGroup.name = 'playPauseButton';
        
        // Button background
        const buttonBackground = new this.timelineScope.Path.Rectangle({
            point: [width - 100, 5],
            size: [40, 20],
            radius: 5,
            fillColor: this.isPlaying ? '#cc5555' : '#55aa55'
        });
        
        // Button text
        const buttonText = new this.timelineScope.PointText({
            point: [width - 80, 20],
            content: this.isPlaying ? 'Pause' : 'Play',
            fillColor: 'white',
            fontSize: 12,
            justification: 'center'
        });
        
        buttonGroup.addChild(buttonBackground);
        buttonGroup.addChild(buttonText);
        
        // Make button clickable
        buttonGroup.onClick = () => {
            if (this.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        };
    }
    
    /**
     * Update play/pause button state
     */
    private updatePaperPlayButton(): void {
        if (!this.timelineScope) return;
        
        const buttonGroup = (this.timelineScope.project.activeLayer.children as any)['playPauseButton'];
        if (buttonGroup) {
            // Update button background color
            if (buttonGroup.children[0]) {
                (buttonGroup.children[0] as paper.Path).fillColor = 
                    this.isPlaying ? new this.timelineScope.Color(0.8, 0.3, 0.3) : new this.timelineScope.Color(0.3, 0.7, 0.3);
            }
            
            // Update button text
            if (buttonGroup.children[1]) {
                (buttonGroup.children[1] as paper.PointText).content = this.isPlaying ? 'Pause' : 'Play';
            }
            
            (this.timelineScope.view as any).draw();
        }
    }
    
    /**
     * Create add keyframe button in Paper.js
     */
    private createPaperAddKeyframeButton(): void {
        if (!this.timelineScope) return;
        
        const width = this.timelineScope.view.size.width;
        const buttonGroup = new this.timelineScope.Group();
        buttonGroup.name = 'addKeyframeButton';
        
        // Button background
        const buttonBackground = new this.timelineScope.Path.Rectangle({
            point: [width - 50, 5],
            size: [40, 20],
            radius: 5,
            fillColor: new this.timelineScope.Color(0.4, 0.4, 0.6)
        });
        
        // Button text
        const buttonText = new this.timelineScope.PointText({
            point: [width - 30, 20],
            content: 'Key',
            fillColor: 'white',
            fontSize: 12,
            justification: 'center'
        });
        
        buttonGroup.addChild(buttonBackground);
        buttonGroup.addChild(buttonText);
        
        // Make button clickable
        buttonGroup.onClick = () => {
            this.addKeyframe();
        };
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
        container.style.cssText = `position: fixed; bottom: 10px; left: 10px; right: 10px; z-index: 1000; background-color: rgba(0, 0, 0, 0.7); padding: 10px; border-radius: 5px; color: white; font-family: Arial, sans-serif; font-size: 12px;`;

        // Title
        const title = document.createElement('div');
        title.textContent = 'Timeline';
        title.style.cssText = `margin-bottom: 5px; font-weight: bold; font-size: 14px;`;
        container.appendChild(title);
        
        // Initialize Paper.js timeline
        this.initializePaperTimeline(container);
        
        // Legacy UI elements for compatibility and direct control
        const controlsContainer = document.createElement('div');
        controlsContainer.style.cssText = `display: flex; align-items: center; margin-top: 5px;`;
        
        // Reset button
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset';
        resetButton.style.cssText = `margin-right: 5px; padding: 3px 8px;`;
        resetButton.addEventListener('click', () => {
            this.setPosition(0);
        });
        controlsContainer.appendChild(resetButton);
        
        container.appendChild(controlsContainer);
        
        // Add to document
        document.body.appendChild(container);
        
        // Store reference
        this.debugUI = container;
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
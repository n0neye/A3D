import * as THREE from 'three';
import { EditorEngine } from '../core/EditorEngine';
import { EntityBase } from '../entity/base/EntityBase';
import { Observer } from '../utils/Observer';
import * as THEATRE from '@theatre/core';
import studio from '@theatre/studio';


export class TimelineManager {
    private engine: EditorEngine;
    private project: THEATRE.IProject;
    private mainSheet: THEATRE.ISheet;
    private isPlaying: boolean = false;

    // Observer for timeline events
    public observers = new Observer<{
        timelineUpdated: { time: number };
        playbackStateChanged: { isPlaying: boolean };
        entityAnimationCreated: { entityId: string };
    }>();

    constructor(engine: EditorEngine) {
        this.engine = engine;

        // Initialize Theatre.js Studio
        if (process.env.NODE_ENV !== 'production') {
            console.log('TimelineManager: Initializing Theatre.js Studio');
            studio.initialize();
        }

        // Create a Theatre.js project
        this.project = THEATRE.getProject('AI-Editor-Animation');
        this.mainSheet = this.project.sheet('Main');


        const camera = this.engine.getCameraManager().getCamera();
        const dummyCube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
        this.engine.getScene().add(dummyCube);
        const cameraSheetObj = this.mainSheet.object('Camera', {
            // Note that the rotation is in radians
            // (full rotation: 2 * Math.PI)
            rotation: THEATRE.types.compound({
                x: THEATRE.types.number(camera.rotation.x, { range: [-2, 2] }),
                y: THEATRE.types.number(camera.rotation.y, { range: [-2, 2] }),
                z: THEATRE.types.number(camera.rotation.z, { range: [-2, 2] }),
            }),
        })


        cameraSheetObj.onValuesChange((values) => {
            // Pause orbit controls
            this.engine.getCameraManager().setOrbitControlsEnabled(false);
            console.log('TimelineManager: Camera values changed', values);
            const { x, y, z } = values.rotation
            camera.rotation.set(x * Math.PI, y * Math.PI, z * Math.PI)
            dummyCube.rotation.set(x * Math.PI, y * Math.PI, z * Math.PI)

            setTimeout(() => {
                if(!this.isPlaying) {
                    this.engine.getCameraManager().setOrbitControlsEnabled(true);
                }
            }, 1);
        })

        // Monitor playback state changes
        THEATRE.onChange(
            this.mainSheet.sequence.pointer.playing,
            (isPlaying) => {
                console.log('TimelineManager: Playback state changed:', isPlaying);
                this.isPlaying = isPlaying;
                
                // Notify observers about playback state change
                this.observers.notify('playbackStateChanged', { isPlaying });
                
                // Re-enable orbit controls when animation is paused
                if (!isPlaying) {
                    this.engine.getCameraManager().setOrbitControlsEnabled(true);
                    console.log('TimelineManager: Orbit controls re-enabled');
                }
            }
        );

        // Monitor timeline position changes
        THEATRE.onChange(
            this.mainSheet.sequence.pointer.position,
            (position) => {
                console.log('TimelineManager: PointerChanged:', position);
                // Notify observers about timeline position change
                this.observers.notify('timelineUpdated', { time: position });
            }
        );
    }

    /**
     * Play the animation sequence
     * @param options Optional playback options
     */
    public play(options?: { iterationCount?: number, range?: [number, number] }): void {
        // Disable orbit controls before starting playback
        this.engine.getCameraManager().setOrbitControlsEnabled(false);
        
        const playOptions = {
            iterationCount: options?.iterationCount || 1,
            range: options?.range,
        };
        
        this.mainSheet.sequence.play(playOptions).then((finished) => {
            if (finished) {
                console.log('TimelineManager: Playback completed');
            } else {
                console.log('TimelineManager: Playback interrupted');
            }
            
            // Re-enable orbit controls after playback ends
            if (!this.isPlaying) {
                this.engine.getCameraManager().setOrbitControlsEnabled(true);
            }
        });
    }

    /**
     * Pause the animation sequence
     */
    public pause(): void {
        this.mainSheet.sequence.pause();
    }
    
    /**
     * Get the current playback position in seconds
     */
    public getPosition(): number {
        return this.mainSheet.sequence.position;
    }
    
    /**
     * Set the current playback position in seconds
     */
    public setPosition(position: number): void {
        this.mainSheet.sequence.position = position;
    }
    
    /**
     * Check if the animation is currently playing
     */
    public isPlayingAnimation(): boolean {
        return this.isPlaying;
    }
}